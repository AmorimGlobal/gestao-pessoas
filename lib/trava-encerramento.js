/* =====================================================================================
   TRAVA DO ENCERRAMENTO NO SERVIDOR (especificação 4.1 e 3.5.3)
   -------------------------------------------------------------------------------------
   O app já confere os registros antes de enviar, mas a solicitação também pode chegar por
   fora dele: pelo formulário do Bitrix, criada direto no kanban ou arrastada de estágio.
   O Bitrix avisa cada mudança num item (evento ONCRMDYNAMICITEMADD/UPDATE, ver
   api/eventos.js) e esta regra roda de novo no servidor, qualquer que seja a origem:

   - item novo que veio de fora do app (Rascunho, sem autor): é o formulário da coordenação.
     Preenche origem e solicitante, liga ao membro pelo Responsável e confere. Passou: vai
     direto para "Enviada ao RH" (quem envia o formulário já é a coordenação). Não passou:
     "Bloqueada", com o motivo.
   - item em "Aguardando coordenação", "Enviada ao RH" ou "Em análise", sem liberação
     excepcional do RH: confere de novo. Não passou: volta para "Bloqueada", com o motivo.

   A conferência é a mesma da tela (dom.verificarRegistros). Nada aqui avisa o membro nem a
   CEO, e nenhum aviso leva o conteúdo dos registros.
   ===================================================================================== */
"use strict";
const dom = require("../src/js/50-dominio.js");

const ORIGEM_FORMULARIO = "Formulário da coordenação";
const ESTAGIOS_CONFERIDOS = ["AG_COORD", "ENVIADA_RH", "EM_ANALISE"];
const MSG_SEM_MEMBRO = "Não foi possível identificar o membro. Escolha o membro no campo Responsável e envie de novo.";
const MSG_SEM_MOTIVO = "Escolha o motivo da solicitação.";

/** Item criado fora do app: o app sempre grava o autor e o solicitante */
function veioDeFora(enc) {
  return enc.estagio === "NEW" && !enc.autor && !enc.solicitante && (!enc.origem || enc.origem === ORIGEM_FORMULARIO);
}
/** O Responsável do formulário é quem pediu (a liderança ou a coordenação), e não o membro */
function responsavelEhQuemPediu(enc) {
  const r = String(enc.responsavel || "");
  return !!r && [enc.criadoPor, enc.solicitante, enc.autor, enc.coordenacao].some((x) => String(x || "") === r);
}
function precisaConferir(enc) {
  if (veioDeFora(enc)) return true;
  return ESTAGIOS_CONFERIDOS.indexOf(enc.estagio) >= 0 && !String(enc.liberacaoRH || "").trim();
}

/** Decide o que fazer. Puro: recebe os registros já lidos e devolve as mudanças e os avisos.
    op = { hoje, encerramento, membro (ou null), feedbacks, planos, nomeDe(id), rhIds } */
function decidir(op) {
  const enc = op.encerramento;
  if (!precisaConferir(enc)) return { acao: "nada" };
  const deFora = veioDeFora(enc);
  const membro = op.membro || null;
  const nome = membro ? ((op.nomeDe && op.nomeDe(membro.responsavel)) || membro.titulo || "membro") : "membro";
  const mudancas = {};
  if (deFora) {
    mudancas.origem = enc.origem || ORIGEM_FORMULARIO;
    if (enc.criadoPor) mudancas.solicitante = enc.criadoPor;
    if (membro && !enc.membroId) mudancas.membroId = membro.id;
    if (membro && !enc.coordenacao && membro.coordenacao) mudancas.coordenacao = membro.coordenacao;
  }
  const solicitante = enc.solicitante || mudancas.solicitante || enc.autor || enc.criadoPor || "";

  let bloqueios = [];
  let ver = null;
  if (!membro) bloqueios = [MSG_SEM_MEMBRO];
  else if (!enc.motivo) bloqueios = [MSG_SEM_MOTIVO];
  else {
    const ctx = dom.indexar({ hoje: op.hoje, registros: { membros: [membro], feedbacks: op.feedbacks || [], planos: op.planos || [] } });
    ver = dom.verificarRegistros(ctx, membro.id, enc.motivo, enc.justificativa);
    bloqueios = ver.bloqueios;
  }

  if (bloqueios.length) {
    Object.assign(mudancas, {
      estagio: "BLOQUEADA", bloqueio: bloqueios.join("\n"),
      primeiraVerificacao: enc.primeiraVerificacao || "Bloqueada na 1ª verificação",
    });
    return {
      acao: "bloquear", mudancas, bloqueios,
      comentario: "Verificação automática dos registros: solicitação bloqueada. " + bloqueios.join(" ") + " Corrija os registros no app Gestão de Pessoas e envie de novo.",
      avisos: [{ ids: [solicitante], texto: "A solicitação de encerramento de contrato de " + nome + " foi bloqueada na verificação dos registros: " + bloqueios.join(" ") + " Abra o app Gestão de Pessoas para corrigir e enviar de novo." }],
    };
  }
  if (!deFora) return { acao: "nada" }; // já estava no estágio certo e os registros conferem

  const destino = dom.destinoEncerramento({ bloqueado: false, motivo: enc.motivo, origem: mudancas.origem });
  Object.assign(mudancas, { estagio: destino, primeiraVerificacao: enc.primeiraVerificacao || "Aceita na 1ª verificação" });
  if (destino === "ENVIADA_RH") mudancas.enviadaRHEm = op.hoje;
  if (ver && ver.plano && !enc.planoId) mudancas.planoId = ver.plano.id;
  if (ver && ver.feedbacks.length && !enc.feedbacksIds) mudancas.feedbacksIds = ver.feedbacks.join(",");
  return {
    acao: "aceitar", mudancas,
    comentario: "Verificação automática dos registros: solicitação aceita" + (destino === "ENVIADA_RH" ? " e enviada ao RH." : "."),
    avisos: destino === "ENVIADA_RH" ? [{ ids: op.rhIds || [], texto: "Nova solicitação de encerramento de contrato enviada ao RH (" + nome + ")." }] : [],
  };
}

/** Lê o item e o que a regra precisa, decide e aplica.
    op = { portal (lib/bitrix-servidor.abrirPortal), id, hoje, rhIds, naoAvisar } */
async function tratar(op) {
  const portal = op.portal;
  const enc = await portal.obter("encerramentos", op.id);
  if (!precisaConferir(enc)) return { acao: "nada", id: enc.id, estagio: enc.estagio };

  let membro = null;
  if (enc.membroId) membro = await portal.obter("membros", enc.membroId).catch(() => null);
  else if (enc.responsavel && !responsavelEhQuemPediu(enc)) {
    // o item ativo mais recente da pessoa (numa recontratação, o item antigo está Encerrado ou Arquivado)
    const ativos = (await portal.listar("membros", { assignedById: Number(enc.responsavel) })).filter((m) => ["SUCCESS", "FAIL"].indexOf(m.estagio) < 0);
    membro = ativos.sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
  }
  const [feedbacks, planos] = membro ? [await portal.doMembro("feedbacks", membro.id), await portal.doMembro("planos", membro.id)] : [[], []];
  const nomes = {};
  if (membro && membro.responsavel) {
    const u = await portal.chamar("user.get", { ID: Number(membro.responsavel) }).catch(() => null);
    const d = u && Array.isArray(u.dados) && u.dados[0];
    if (d) nomes[membro.responsavel] = [d.NAME, d.LAST_NAME].filter(Boolean).join(" ").trim();
  }

  const d = decidir({ hoje: op.hoje, encerramento: enc, membro, feedbacks, planos, nomeDe: (id) => nomes[id], rhIds: op.rhIds });
  if (d.acao === "nada") return { acao: "nada", id: enc.id, estagio: enc.estagio };
  // nunca o membro (Responsável de todo registro, 4.1) nem quem está fora do app (a CEO)
  const nunca = new Set([enc.responsavel, membro && membro.responsavel].concat(op.naoAvisar || []).filter(Boolean).map(String));

  // O Bitrix pode mandar dois eventos quase juntos (criado e atualizado). Lê de novo antes de gravar:
  // se outra execução já mexeu no item, esta não grava nem avisa de novo.
  const atual = await portal.obter("encerramentos", enc.id);
  if (atual.estagio !== enc.estagio || atual.atualizadoEm !== enc.atualizadoEm || veioDeFora(atual) !== veioDeFora(enc)) {
    return { acao: "nada", id: enc.id, estagio: atual.estagio, motivo: "o item mudou durante a conferência" };
  }
  try {
    await portal.atualizar("encerramentos", enc.id, d.mudancas);
  } catch (e) {
    // ex.: campo obrigatório no estágio de destino. O RH fica sabendo, em vez de o item parar em silêncio.
    const rh = (op.rhIds || []).filter((x) => !nunca.has(String(x)));
    await portal.notificar(rh, "A verificação automática não conseguiu mover a solicitação de encerramento nº " + enc.id + " para \"" + ((portal.est.encerramentos && portal.est.encerramentos.nomes[d.mudancas.estagio]) || d.mudancas.estagio || "") + "\": " + String((e && e.message) || e).slice(0, 300) + " Confira o item no Bitrix.").catch(() => {});
    throw e;
  }
  if (d.comentario) await portal.comentar("encerramentos", enc.id, d.comentario);
  for (const a of d.avisos || []) await portal.notificar(a.ids.filter((x) => x && !nunca.has(String(x))), a.texto);
  return { acao: d.acao, id: enc.id, estagio: d.mudancas.estagio, bloqueios: d.bloqueios || [] };
}

module.exports = { decidir, tratar, veioDeFora, precisaConferir, ESTAGIOS_CONFERIDOS };
