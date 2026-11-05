// Rotina diária (Vercel Cron, ver vercel.json): sincroniza o processo Membros com a estrutura
// da empresa no Bitrix. Escrito à mão (não é gerado pelo build.js).
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada com escopos crm, user, department e im
//   CRON_SECRET         a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron
//   GP_AVISAR_IDS       IDs de usuário do RH que recebem o resumo (separados por vírgula)
//   GP_CEO_IDS          IDs da CEO: não ganha item no Membros e nunca recebe aviso
//   GP_EXCECOES_IDS     IDs de quem fica fora do app, separados por vírgula
//   SEMANAL_URL, SEMANAL_TOKEN  opcionais: o app semanal das revisões semanais (ver api/semanal.js)
"use strict";
const { criarChamadaWebhook, sincronizar, hojeSaoPaulo } = require("../lib/sincronizacao-servidor.js");
const { idsDe, foraDoApp } = require("../lib/bitrix-servidor.js");
const { importarSemanal } = require("../lib/semanal-servidor.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

module.exports = async function handler(req, res, injetado) {
  const env = (injetado && injetado.env) || process.env;
  if (!env.CRON_SECRET) return responder(res, 503, { erro: "CRON_SECRET não configurado na Vercel" });
  if ((req.headers || {}).authorization !== "Bearer " + env.CRON_SECRET) return responder(res, 401, { erro: "não autorizado" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { erro: "BITRIX_WEBHOOK_URL não configurado na Vercel" });
  try {
    const chamar = (injetado && injetado.chamar) || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
    const r = await sincronizar({
      chamar,
      hoje: (injetado && injetado.hoje) || hojeSaoPaulo(),
      // a CEO e quem está fora do app não ganham item no Membros nem recebem aviso
      excecoes: idsDe(env.GP_EXCECOES_IDS), ceos: idsDe(env.GP_CEO_IDS), avisarIds: idsDe(env.GP_AVISAR_IDS).filter((id) => foraDoApp(env).indexOf(id) < 0), limite: 40,
    });
    // Revisões semanais do WhatsApp (04/11/2026): o app semanal apaga as respostas a cada ciclo, então a rotina guarda
    // todo dia, às 6h (antes do ciclo novo das sextas). Uma falha aqui não derruba a sincronização.
    let semanal;
    try { semanal = await importarSemanal({ chamar, env, agora: injetado && injetado.agora, fetch: injetado && injetado.fetch }); }
    catch (e) { console.error(e); semanal = { ok: false, erro: String((e && e.message) || e) }; }
    return responder(res, 200, Object.assign({ ok: true }, r, { semanal }));
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
