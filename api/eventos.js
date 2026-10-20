// Recebe os eventos do Bitrix (webhook de SAÍDA) e aplica a trava do encerramento no
// servidor (lib/trava-encerramento.js). Escrito à mão (não é gerado pelo build.js).
//
// No Bitrix: Desenvolvedores > Outros > Webhook de saída, com o endereço
//   https://gestao-pessoas-bice.vercel.app/api/eventos
// e os eventos ONCRMDYNAMICITEMADD e ONCRMDYNAMICITEMUPDATE. O Bitrix mostra um "token de
// aplicação": ele vai na variável BITRIX_EVENTO_TOKEN da Vercel e é conferido em cada chamada.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_EVENTO_TOKEN  token de aplicação do webhook de saída
//   BITRIX_WEBHOOK_URL   webhook de entrada (o mesmo da rotina diária), para ler e gravar os itens
//   GP_AVISAR_IDS        IDs do RH que recebem o aviso de solicitação enviada ao RH
//   GP_EXCECOES_IDS      IDs de quem fica fora do app (ex.: a CEO): nunca recebem aviso
"use strict";
const { criarChamadaWebhook, abrirPortal, hojeSaoPaulo, idsDe } = require("../lib/bitrix-servidor.js");
const trava = require("../lib/trava-encerramento.js");

const PROCESSOS = ["membros", "feedbacks", "planos", "encerramentos"];
const VALIDADE_CACHE_MS = 10 * 60 * 1000;
let cache = null; // estrutura do portal entre chamadas da mesma instância

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

/** O Bitrix manda application/x-www-form-urlencoded com chaves "data[FIELDS][ID]" */
async function lerCorpo(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let texto = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  if (texto === null) {
    texto = await new Promise((ok, falha) => {
      let acc = "";
      req.on("data", (c) => { acc += c; });
      req.on("end", () => ok(acc));
      req.on("error", falha);
    });
  }
  const t = String(texto || "").trim();
  if (t.charAt(0) === "{") { try { return JSON.parse(t); } catch (e) { return {}; } }
  const o = {};
  new URLSearchParams(t).forEach((v, k) => { o[k] = v; });
  return o;
}
/** pegar(corpo, "data", "FIELDS", "ID"): aceita o corpo aninhado ou com chaves planas */
function pegar(corpo, ...chaves) {
  let v = corpo;
  for (const k of chaves) v = v && typeof v === "object" ? v[k] : undefined;
  if (v !== undefined) return v;
  const plana = chaves[0] + chaves.slice(1).map((k) => "[" + k + "]").join("");
  return corpo ? corpo[plana] : undefined;
}

async function portalEmCache(chamar, agora) {
  if (cache && agora - cache.em < VALIDADE_CACHE_MS) return cache.portal;
  const portal = await abrirPortal(chamar, PROCESSOS);
  cache = { portal, em: agora };
  return portal;
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.BITRIX_EVENTO_TOKEN || !env.BITRIX_WEBHOOK_URL) return responder(res, 503, { erro: "BITRIX_EVENTO_TOKEN e BITRIX_WEBHOOK_URL precisam estar configurados na Vercel" });
  if (req.method !== "POST") return responder(res, 405, { erro: "use POST" });
  const corpo = await lerCorpo(req);
  if (String(pegar(corpo, "auth", "application_token") || "") !== env.BITRIX_EVENTO_TOKEN) return responder(res, 401, { erro: "não autorizado" });

  const evento = String(pegar(corpo, "event") || "").toUpperCase();
  if (!/^ONCRMDYNAMICITEM(ADD|UPDATE)/.test(evento)) return responder(res, 200, { ok: true, ignorado: "evento " + evento });
  const eti = String(pegar(corpo, "data", "FIELDS", "ENTITY_TYPE_ID") || "");
  const id = String(pegar(corpo, "data", "FIELDS", "ID") || "");
  if (!eti || !id) return responder(res, 200, { ok: true, ignorado: "evento sem item" });

  try {
    if (inj.semCache) cache = null;
    const chamar = inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
    const portal = await portalEmCache(chamar, Date.now());
    if (String(portal.eti("encerramentos")) !== eti) return responder(res, 200, { ok: true, ignorado: "outro processo" });
    const r = await trava.tratar({
      portal, id, hoje: inj.hoje || hojeSaoPaulo(), rhIds: idsDe(env.GP_AVISAR_IDS), naoAvisar: idsDe(env.GP_EXCECOES_IDS),
    });
    return responder(res, 200, Object.assign({ ok: true, evento }, r));
  } catch (e) {
    console.error(e);
    cache = null; // a estrutura pode ter mudado (processo recriado, campo novo)
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
