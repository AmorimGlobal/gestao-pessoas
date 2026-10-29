/* =====================================================================================
   AVISOS DOS FUNIS DE NEGÓCIOS — e-mail a quem pediu, a cada etapa (reunião de 29/10/2026)
   -------------------------------------------------------------------------------------
   "Automatizar e-mail de solicitação e atualização": nos funis "HR | Requisição de Vagas"
   (categoria 77) e de offboarding, quem pediu recebe um e-mail quando a solicitação chega e
   a cada mudança de etapa. Na chegada, o RH também recebe uma notificação do Bitrix.

   Uma vez só, sem repetir: depois de avisar, o servidor grava a etapa avisada num campo do
   próprio negócio (UF_CRM_RV_ULT_AVISO / UF_CRM_OFF_ULT_AVISO). Essa gravação dispara de
   novo o evento de atualização, que então não tem nada a fazer. Sem o campo no Bitrix, nada é
   enviado (senão cada atualização mandaria o mesmo e-mail).

   Negócio que já existia antes dos avisos: na primeira atualização o servidor só grava a etapa
   atual, sem e-mail, a não ser que a etapa tenha acabado de mudar (histórico de etapas).

   O e-mail do offboarding leva só o nome do membro digitado no formulário e a etapa: nunca o
   motivo, a descrição ou outro conteúdo da solicitação.
   ===================================================================================== */
"use strict";
const { emailValido } = require("./email.js");

const NOVO_MS = 24 * 3600 * 1000;        // criado há menos de 1 dia: é uma solicitação nova
const MUDOU_AGORA_MS = 30 * 60 * 1000;   // negócio antigo sem marca: a etapa mudou nos últimos 30 minutos?

const TIPOS = {
  vaga: {
    campoEmail: "UF_CRM_RV_EMAIL", campoMarca: "UF_CRM_RV_ULT_AVISO", campoSolicitante: "UF_CRM_RV_LIDER",
    nome: (n) => String(n.UF_CRM_RV_VAGA || n.TITLE || "Negócio " + n.ID).trim(),
    primeira: (nome, etapa, ola) => ({
      assunto: "Recebemos a sua solicitação de vaga: " + nome,
      texto: ola + " Recebemos a sua solicitação de vaga \"" + nome + "\".\nEtapa atual: " + etapa + ".\n\nO RH acompanha a solicitação pelo funil de vagas, e você recebe um e-mail a cada mudança de etapa.",
    }),
    mudou: (nome, etapa, ola) => ({
      assunto: "Solicitação de vaga \"" + nome + "\": " + etapa,
      texto: ola + " A sua solicitação de vaga \"" + nome + "\" mudou de etapa: " + etapa + ".\n\nDúvidas? Fale com o RH.",
    }),
    avisoRH: (nome, link) => "Nova solicitação de vaga no funil HR | Requisição de Vagas: " + nome + "." + (link ? " " + link : ""),
  },
  offboarding: {
    campoEmail: "UF_CRM_OFF_EMAIL", campoMarca: "UF_CRM_OFF_ULT_AVISO", campoSolicitante: "UF_CRM_OFF_SOLICIT",
    nome: (n) => String(n.UF_CRM_OFF_MEMBRO || "").trim() || "o membro",
    primeira: (nome, etapa, ola) => ({
      assunto: "Recebemos a sua solicitação de encerramento de contrato",
      texto: ola + " Recebemos a solicitação de encerramento de contrato de " + nome + ".\nEtapa atual: " + etapa + ".\n\nAcompanhe com o RH. Você recebe um e-mail a cada mudança de etapa.",
    }),
    mudou: (nome, etapa, ola) => ({
      assunto: "Solicitação de encerramento de contrato: " + etapa,
      texto: ola + " A solicitação de encerramento de contrato de " + nome + " mudou de etapa: " + etapa + ".\n\nAcompanhe com o RH.",
    }),
    avisoRH: (nome, link) => "Nova solicitação de encerramento de contrato no funil de offboarding (" + nome + ")." + (link ? " " + link : ""),
  },
};

/** Categoria do negócio -> "vaga", "offboarding" ou null. Vagas: GP_CATEGORIA_VAGAS (padrão 77).
    Offboarding: GP_CATEGORIA_OFFBOARDING, sem padrão (sem a variável, o funil não é avisado). */
function tipoDaCategoria(categoria, env) {
  const c = String(categoria === undefined || categoria === null ? "" : categoria).trim();
  if (!c) return null;
  const e = env || {};
  if (c === String(e.GP_CATEGORIA_VAGAS || 77).trim()) return "vaga";
  const off = String(e.GP_CATEGORIA_OFFBOARDING || "").trim();
  if (off && c === off) return "offboarding";
  return null;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function html(texto) {
  return '<div style="font-family:Poppins,Arial,Helvetica,sans-serif;color:#1d2433;font-size:15px;line-height:1.55;max-width:600px">' +
    texto.split(/\n\n/).map((p) => '<p style="margin:0 0 12px">' + esc(p).replace(/\n/g, "<br>") + "</p>").join("") +
    '<p style="margin:16px 0 0;color:#5b6478;font-size:12px">Gestão de Pessoas · Amorim</p></div>';
}

/** Decide o que fazer com um negócio. Puro.
    op = { negocio (crm.deal.get), etapas ([{id, nome, semantica}]), tipo, evento, agora (Date), ultimaMudanca (ISO ou null), link }
    -> { acao: "ignorar" | "marcar" | "avisar", motivo, primeira, etapa, para, assunto, texto, html, avisoRH, marca } */
function decidir(op) {
  const cfg = TIPOS[op.tipo];
  const n = op.negocio || {};
  if (!cfg) return { acao: "ignorar", motivo: "funil sem avisos" };
  const etapaId = String(n.STAGE_ID || "").trim();
  if (!etapaId) return { acao: "ignorar", motivo: "negócio sem etapa" };
  if (!Object.prototype.hasOwnProperty.call(n, cfg.campoMarca)) {
    return { acao: "ignorar", motivo: "o campo " + cfg.campoMarca + " não existe no Bitrix: crie o campo antes de ligar os avisos" };
  }
  const marca = String(n[cfg.campoMarca] || "").trim();
  if (marca === etapaId) return { acao: "ignorar", motivo: "etapa já avisada" };
  const etapa = (op.etapas || []).find((e) => e.id === etapaId) || { id: etapaId, nome: etapaId };
  const agora = (op.agora || new Date()).getTime();
  let primeira = false;
  if (!marca) {
    const criado = Date.parse(n.DATE_CREATE || "");
    const novo = /ADD$/i.test(String(op.evento || "")) || (!isNaN(criado) && agora - criado < NOVO_MS);
    const mudou = op.ultimaMudanca && !isNaN(Date.parse(op.ultimaMudanca)) && agora - Date.parse(op.ultimaMudanca) < MUDOU_AGORA_MS;
    if (novo) primeira = true;
    else if (!mudou) return { acao: "marcar", motivo: "negócio anterior aos avisos: só grava a etapa atual", etapa, marca: etapaId };
  }
  const nome = cfg.nome(n);
  const solicitante = String(n[cfg.campoSolicitante] || "").trim().split(/\s+/)[0];
  const msg = (primeira ? cfg.primeira : cfg.mudou)(nome, etapa.nome, "Olá" + (solicitante ? ", " + solicitante : "") + "!");
  const para = String(n[cfg.campoEmail] || "").trim();
  return {
    acao: "avisar", primeira, etapa, marca: etapaId,
    para: emailValido(para) ? para : "", motivo: emailValido(para) ? "" : "sem e-mail válido de quem pediu",
    assunto: msg.assunto, texto: msg.texto, html: html(msg.texto),
    avisoRH: primeira ? cfg.avisoRH(nome, op.link) : "",
  };
}

/** Executa a decisão: e-mail a quem pediu, notificação ao RH (só na chegada) e a marca da etapa.
    op = decidir() + { email (lib/email.js ou null), chamar (webhook), rhIds, naoAvisar, ultimaMudanca: async () => ISO|null, log } */
async function tratar(op) {
  const log = op.log || (() => {});
  const n = op.negocio || {};
  if (!op.email) {
    log("negócio " + n.ID + ": e-mail não configurado na Vercel, nenhum aviso enviado");
    return { acao: "ignorar", motivo: "e-mail não configurado na Vercel" };
  }
  let d = decidir(Object.assign({}, op, { ultimaMudanca: null }));
  // só consulta o histórico de etapas quando precisa: negócio antigo, ainda sem marca
  if (d.acao === "marcar" && typeof op.ultimaMudanca === "function") {
    const ultima = await op.ultimaMudanca().catch(() => null);
    if (ultima) d = decidir(Object.assign({}, op, { ultimaMudanca: ultima }));
  }
  if (d.acao === "ignorar") return { acao: "ignorar", motivo: d.motivo };
  const r = { acao: d.acao, etapa: d.etapa.nome, primeira: !!d.primeira, enviado: false };
  if (d.acao === "avisar") {
    if (d.para) {
      // se o envio falhar, a marca não é gravada e o próximo evento tenta de novo
      r.resposta = await op.email.enviar({ para: d.para, assunto: d.assunto, html: d.html, texto: d.texto });
      r.enviado = true;
      r.para = d.para;
      log("negócio " + n.ID + ": e-mail para " + d.para + " (" + d.etapa.nome + ") · servidor: " + r.resposta);
    } else log("negócio " + n.ID + ": " + d.motivo + "; nenhum e-mail enviado");
    if (d.avisoRH) {
      const nunca = new Set((op.naoAvisar || []).map(String));
      const ids = Array.from(new Set((op.rhIds || []).map(String))).filter((id) => id && !nunca.has(id));
      for (const id of ids) {
        try { await op.chamar("im.notify.system.add", { USER_ID: Number(id), MESSAGE: "[Gestão de Pessoas] " + d.avisoRH }); }
        catch (e) { log("aviso ao RH " + id + " não enviado: " + ((e && e.message) || e)); }
      }
      r.rhAvisados = ids.length;
    }
  }
  const campos = {};
  campos[TIPOS[op.tipo].campoMarca] = d.marca;
  await op.chamar("crm.deal.update", { id: Number(n.ID), fields: campos });
  r.marca = d.marca;
  return r;
}

module.exports = { decidir, tratar, tipoDaCategoria, TIPOS };
