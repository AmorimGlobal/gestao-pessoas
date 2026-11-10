// Quantos itens cada processo do app tem no Bitrix, contados pelo webhook de entrada. Escrito à mão.
//
// O app do RH compara com o que o login dele leu: se leu menos, a função de acesso do CRM esconde
// registros, e o app mostra o aviso no topo (o caso do RH em "Ver como", em 28/10/2026). Devolve só
// números, e só para quem está em GP_AVISAR_IDS (o RH) ou é administrador do Bitrix.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada (o mesmo das rotinas)
//   GP_AVISAR_IDS       o RH (os mesmos IDs que recebem os avisos)
"use strict";
const schema = require("../src/js/20-schema.js");
const { criarChamadaWebhook, listarTudo, idsDe, lerCorpo, usuarioDoToken } = require("../lib/bitrix-servidor.js");

const VALIDADE_CACHE_MS = 5 * 60 * 1000;
let cache = null; // { em, total } entre chamadas da mesma instância

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

/** O token é de administrador do portal? Pergunta ao MESMO portal do webhook, com o token da pessoa. */
async function ehAdministrador(webhookUrl, token, fetchImpl) {
  const f = fetchImpl || fetch;
  const resp = await f(new URL(webhookUrl).origin + "/rest/user.admin.json", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ auth: token }).toString() });
  const json = await resp.json().catch(() => ({}));
  return json.result === true;
}

/** Total de itens de um processo: o crm.item.list já devolve "total" na primeira página */
async function totalDoProcesso(webhookUrl, eti, fetchImpl) {
  const f = fetchImpl || fetch;
  const resp = await f(String(webhookUrl).replace(/\/+$/, "") + "/crm.item.list.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityTypeId: eti, select: ["id"] }) });
  const json = await resp.json().catch(() => ({ error: "HTTP " + resp.status }));
  if (json.error) throw new Error("crm.item.list: " + json.error + (json.error_description ? " — " + json.error_description : ""));
  return Number(json.total !== undefined ? json.total : ((json.result && json.result.items) || []).length);
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { ok: false, erro: "a contagem ainda não foi ligada na Vercel (BITRIX_WEBHOOK_URL)" });
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  const corpo = await lerCorpo(req);
  const token = corpo && typeof corpo.auth === "string" ? corpo.auth : "";
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix" });

  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }
  const rh = idsDe(env.GP_AVISAR_IDS).indexOf(uid) >= 0;
  const admin = rh ? false : await (inj.ehAdministrador || ehAdministrador)(env.BITRIX_WEBHOOK_URL, token).catch(() => false);
  if (!rh && !admin) return responder(res, 403, { ok: false, erro: "a contagem é só para o RH e para os administradores do Bitrix" });

  try {
    const agora = Date.now();
    if (inj.semCache) cache = null;
    if (!cache || agora - cache.em > VALIDADE_CACHE_MS) {
      const chamar = inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
      const tipos = await listarTudo(chamar, "crm.type.list", {}, (d) => d && d.types);
      const contar = inj.totalDoProcesso || ((eti) => totalDoProcesso(env.BITRIX_WEBHOOK_URL, eti));
      const total = {};
      for (const p of schema.PROCESSOS) {
        const t = schema.tipoPorTitulo(tipos, schema.tituloProcesso(p));
        if (t) total[p.chave] = await contar(t.entityTypeId);
      }
      cache = { em: agora, total };
    }
    return responder(res, 200, { ok: true, total: cache.total, contadoEm: new Date(cache.em).toISOString() });
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
module.exports.totalDoProcesso = totalDoProcesso;
