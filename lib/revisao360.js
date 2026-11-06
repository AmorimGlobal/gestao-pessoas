/* =====================================================================================
   AVALIAÇÃO 360° NO SERVIDOR — grava a resposta sem ligar a quem respondeu
   -------------------------------------------------------------------------------------
   Regra do protótipo do RH (Revisão de Progresso, 05/11/2026): "a resposta anônima não pode
   guardar o autor: grave a resposta por um usuário técnico (webhook)" e "o controle de quem já
   respondeu fica separado do conteúdo". Por isso:
   - o navegador nunca grava na tabela "Revisão · Respostas 360°" (as pessoas nem têm acesso a ela);
   - aqui o item é criado pelo webhook de entrada: o Bitrix registra o dono do webhook como autor;
   - "Quem respondeu" só é gravado quando a pessoa escolhe a resposta identificada;
   - nada daqui vai para os logs da Vercel com quem respondeu (nem em erro);
   - o "já respondi" fica no navegador da pessoa (BX24.userOption), sem o conteúdo.
   Antes de gravar, confere com as regras do app (58-revisao.js): ciclo aberto, 360° liberada
   para a relação, a relação de verdade pela estrutura do Bitrix e os valores da escala.
   ===================================================================================== */
"use strict";
const dom = require("../src/js/50-dominio.js");
const R = require("../src/js/58-revisao.js");
const { abrirPortal, hojeSaoPaulo, idsDe } = require("./bitrix-servidor.js");

const falha = (status, erro) => ({ ok: false, status, erro });

/** o = { chamar, env, uid (de quem responde, pelo token), pedido: {cicloId, avaliado, modo, respostas}, agora } -> {ok, status, erro} */
async function gravar360(o) {
  const env = o.env || {};
  const p = o.pedido || {};
  const uid = String(o.uid || "");
  const avaliado = String(p.avaliado || "").trim();
  if (!uid) return falha(401, "sessão do Bitrix não reconhecida");
  if (!/^\d+$/.test(avaliado) || avaliado === uid) return falha(400, "pessoa avaliada inválida");
  if (!/^\d+$/.test(String(p.cicloId || ""))) return falha(400, "ciclo inválido");
  const modo = p.modo === "Identificada" ? "Identificada" : "Anônima";

  const portal = await abrirPortal(o.chamar, ["revCiclos", "rev360", "membros"]);
  if (!portal.est.revCiclos || !portal.est.rev360) return falha(503, "as tabelas da Revisão de Progresso ainda não existem no Bitrix: um administrador cria em Configuração → Criar ou completar a estrutura");
  const ciclo = await portal.obter("revCiclos", p.cicloId).catch(() => null);
  if (!ciclo || ciclo.estagio !== "ABERTO") return falha(409, "este ciclo da Revisão de Progresso não está aberto");
  const regras = R.regrasDo(ciclo);

  const [usuarios, departamentos, membros] = await Promise.all([portal.usuarios(), portal.departamentos(), portal.est.membros ? portal.listar("membros") : []]);
  const comoLista = (v) => idsDe(v).map((id) => ({ id }));
  const ctx = dom.indexar({
    hoje: hojeSaoPaulo(o.agora), eu: { id: uid }, usuarios, departamentos, registros: { membros },
    // a CEO e quem está fora do app não entram na 360° (as mesmas variáveis das rotinas)
    config: { papeis: { ceo: comoLista(env.GP_CEO_IDS), excecoes: comoLista(env.GP_EXCECOES_IDS) } },
  });
  const relacao = R.relacaoCom(ctx, uid, avaliado);
  if (!relacao) return falha(403, "pela estrutura do Bitrix, você não avalia esta pessoa na 360°");
  if (relacao === "Superior" && !regras.liberarLideranca) return falha(403, "a avaliação da liderança não foi liberada neste ciclo");
  if (relacao === "Par" && !regras.liberarPares) return falha(403, "a avaliação entre pares não foi liberada neste ciclo");
  const v = R.validarResposta(relacao, p.respostas);
  if (!v.ok) return falha(400, v.erros.join("; "));

  const rh = idsDe(env.GP_AVISAR_IDS);
  await portal.criar("rev360", {
    titulo: "360° · " + relacao + " · " + dom.pessoa(ctx, avaliado).nome,
    estagio: "NEW", responsavel: rh[0] || "",
    cicloId: String(ciclo.id), avaliado, relacao, modo,
    identificadoPor: modo === "Identificada" ? uid : "",
    area: R.areaDe(ctx, avaliado).nome,
    respostas: JSON.stringify(v.respostas),
  });
  return { ok: true, status: 200 };
}

module.exports = { gravar360 };
