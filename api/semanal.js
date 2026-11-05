// Botão "Buscar agora" das revisões semanais (Configuração): copia as respostas do alinhamento semanal
// pelo WhatsApp (app-gestao-semanal) para a tabela "Revisões semanais" do Bitrix. A rotina das 6h
// (api/sincronizar.js) faz o mesmo todo dia. Escrito à mão (não é gerado pelo build.js).
//
// O app chama com POST { auth: <token da sessão do Bitrix (BX24.getAuth)> }. Só o RH (GP_AVISAR_IDS)
// e os administradores do portal buscam: o servidor confere quem é pelo token, no próprio portal.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada (o mesmo das rotinas), escopos crm e user
//   GP_AVISAR_IDS       IDs do RH
//   SEMANAL_URL         opcional: endereço do app semanal (padrão https://app-gestao-semanal.vercel.app)
//   SEMANAL_TOKEN       opcional: vai como "Authorization: Bearer" quando o app semanal pedir senha
"use strict";
const { criarChamadaWebhook, lerCorpo, usuarioDoToken, idsDe } = require("../lib/bitrix-servidor.js");
const { importarSemanal } = require("../lib/semanal-servidor.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

/** O dono deste token é administrador do portal? Pergunta ao MESMO portal do webhook, nunca a um endereço do navegador */
async function ehAdmin(webhookUrl, token, fetchImpl) {
  const f = fetchImpl || fetch;
  const resp = await f(new URL(webhookUrl).origin + "/rest/user.admin.json", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ auth: token }).toString() });
  const j = await resp.json().catch(() => ({}));
  return j.result === true;
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { ok: false, erro: "a busca ainda não foi ligada na Vercel (falta BITRIX_WEBHOOK_URL)" });
  const corpo = (await lerCorpo(req)) || {};
  const token = typeof corpo.auth === "string" ? corpo.auth : "";
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix: abra pelo Bitrix" });
  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }
  const rh = idsDe(env.GP_AVISAR_IDS).indexOf(String(uid)) >= 0;
  const admin = rh || (await (inj.ehAdmin || ehAdmin)(env.BITRIX_WEBHOOK_URL, token).catch(() => false));
  if (!admin) return responder(res, 403, { ok: false, erro: "só o RH e os administradores do portal buscam as revisões semanais" });
  try {
    const r = await importarSemanal({ chamar: inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL), env, agora: inj.agora, fetch: inj.fetch });
    return responder(res, r.semTabela ? 503 : 200, r);
  } catch (e) {
    console.error(e);
    return responder(res, 502, { ok: false, erro: String((e && e.message) || e) });
  }
};
