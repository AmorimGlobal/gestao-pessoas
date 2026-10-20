// Rotina diária (Vercel Cron, ver vercel.json) dos avisos da especificação 4.4: resumo semanal,
// aviso no dia em que algo atrasa, lembrete com 7 dias e aviso à coordenação com 14 dias.
// Regras em lib/avisos.js. Escrito à mão (não é gerado pelo build.js).
//
// Variáveis de ambiente na Vercel (as mesmas da rotina de sincronização):
//   BITRIX_WEBHOOK_URL  webhook de entrada com escopos crm, user, department e im
//   CRON_SECRET         a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron
//   GP_AVISAR_IDS       IDs do RH (resumo do RH e avisos de 14 dias quando a liderança é a coordenação)
//   GP_EXCECOES_IDS     IDs de quem fica fora do app (ex.: a CEO): nunca recebem aviso
//   GP_LINK_APP         opcional: endereço do app no Bitrix, vai no fim de cada aviso
//
// ?simular=1 devolve as mensagens do dia sem enviar (com o mesmo segredo do cron).
"use strict";
const { criarChamadaWebhook, hojeSaoPaulo, idsDe } = require("../lib/bitrix-servidor.js");
const { montarContexto } = require("../lib/contexto-servidor.js");
const avisos = require("../lib/avisos.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.CRON_SECRET) return responder(res, 503, { erro: "CRON_SECRET não configurado na Vercel" });
  if ((req.headers || {}).authorization !== "Bearer " + env.CRON_SECRET) return responder(res, 401, { erro: "não autorizado" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { erro: "BITRIX_WEBHOOK_URL não configurado na Vercel" });
  const simular = /[?&]simular=1\b/.test(String(req.url || ""));
  try {
    const hoje = inj.hoje || hojeSaoPaulo();
    const { ctx, portal } = await montarContexto(inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL), hoje);
    const plano = avisos.planejar({ ctx, rhIds: idsDe(env.GP_AVISAR_IDS), naoAvisar: idsDe(env.GP_EXCECOES_IDS), link: env.GP_LINK_APP || "" });
    const porTipo = {};
    plano.mensagens.forEach((m) => { porTipo[m.tipo] = (porTipo[m.tipo] || 0) + 1; });
    const resumo = { ok: true, hoje, diaUtil: plano.diaUtil, semanal: plano.semanal, mensagens: plano.mensagens.length, porTipo };
    if (simular) return responder(res, 200, Object.assign(resumo, { simulado: true, detalhe: plano.mensagens }));
    const falhas = await avisos.enviar(plano.mensagens, portal.notificar);
    return responder(res, 200, Object.assign(resumo, { falhas }));
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
