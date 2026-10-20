// Rotina diária (Vercel Cron, ver vercel.json): sincroniza o processo Membros com a estrutura
// da empresa no Bitrix. Escrito à mão (não é gerado pelo build.js).
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada com escopos crm, user, department e im
//   CRON_SECRET         a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron
//   GP_AVISAR_IDS       IDs de usuário do RH que recebem o resumo (separados por vírgula)
//   GP_EXCECOES_IDS     IDs de quem fica fora do app (ex.: a CEO), separados por vírgula
"use strict";
const { criarChamadaWebhook, sincronizar, hojeSaoPaulo } = require("../lib/sincronizacao-servidor.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}
const ids = (v) => String(v || "").split(/[,\s;]+/).filter(Boolean);

module.exports = async function handler(req, res, injetado) {
  const env = (injetado && injetado.env) || process.env;
  if (!env.CRON_SECRET) return responder(res, 503, { erro: "CRON_SECRET não configurado na Vercel" });
  if ((req.headers || {}).authorization !== "Bearer " + env.CRON_SECRET) return responder(res, 401, { erro: "não autorizado" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { erro: "BITRIX_WEBHOOK_URL não configurado na Vercel" });
  try {
    const r = await sincronizar({
      chamar: (injetado && injetado.chamar) || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL),
      hoje: (injetado && injetado.hoje) || hojeSaoPaulo(),
      excecoes: ids(env.GP_EXCECOES_IDS), ceos: [], avisarIds: ids(env.GP_AVISAR_IDS), limite: 40,
    });
    return responder(res, 200, Object.assign({ ok: true }, r));
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
