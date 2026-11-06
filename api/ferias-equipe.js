// Férias da equipe: as datas já reservadas por quem tem a mesma liderança direta, sem nomes (lib/ferias-equipe.js).
// O formulário de férias usa para bloquear as datas ocupadas, como no protótipo do RH (06/11/2026). Escrito à mão.
//
// O app chama com POST { auth: <token da sessão do Bitrix (BX24.getAuth)> }. O token só diz quem pede.
//
// Variáveis de ambiente na Vercel: BITRIX_WEBHOOK_URL (escopos crm, user e department), a mesma das rotinas.
"use strict";
const { criarChamadaWebhook, lerCorpo, usuarioDoToken } = require("../lib/bitrix-servidor.js");
const { reservasParaPessoa } = require("../lib/ferias-equipe.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { ok: false, erro: "a conferência das férias da equipe ainda não foi ligada na Vercel (falta BITRIX_WEBHOOK_URL)" });
  const corpo = (await lerCorpo(req)) || {};
  const token = typeof corpo.auth === "string" ? corpo.auth : "";
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix: abra pelo Bitrix" });
  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }
  try {
    const r = await reservasParaPessoa({ chamar: inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL), uid, agora: inj.agora });
    return responder(res, r.status, r.ok ? { ok: true, reservas: r.reservas } : { ok: false, erro: r.erro });
  } catch (e) {
    console.error("[ferias-equipe]", String((e && e.message) || e).slice(0, 300));
    return responder(res, 502, { ok: false, erro: "o Bitrix não respondeu: tente de novo em alguns minutos" });
  }
};
