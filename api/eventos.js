// Recebe os eventos do Bitrix (webhook de SAÍDA). Escrito à mão (não é gerado pelo build.js).
//   - Itens de processo inteligente: a trava do encerramento no servidor (lib/trava-encerramento.js).
//   - Negócios dos funis de vagas e de offboarding: o e-mail a quem pediu, na chegada e a cada
//     mudança de etapa (lib/avisos-negocios.js). Negócios de outros funis são ignorados.
//
// No Bitrix: Desenvolvedores > Outros > Webhook de saída, com o endereço
//   https://gestao-pessoas-bice.vercel.app/api/eventos
// e os eventos ONCRMDYNAMICITEMADD, ONCRMDYNAMICITEMUPDATE, ONCRMDEALADD e ONCRMDEALUPDATE. O
// Bitrix mostra um "token de aplicação": ele vai na variável BITRIX_EVENTO_TOKEN da Vercel e é
// conferido em cada chamada.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_EVENTO_TOKEN  token de aplicação do webhook de saída
//   BITRIX_WEBHOOK_URL   webhook de entrada (o mesmo da rotina diária), para ler e gravar os itens
//   GP_AVISAR_IDS        IDs do RH que recebem o aviso de solicitação enviada ao RH
//   GP_CEO_IDS e GP_EXCECOES_IDS  a CEO e quem fica fora do app: nunca recebem aviso
//   SMTP_* e EMAIL_REMETENTE (lib/email.js), GP_CATEGORIA_VAGAS (padrão 77) e GP_CATEGORIA_OFFBOARDING:
//                        os e-mails dos funis de negócios
"use strict";
const { criarChamadaWebhook, abrirPortal, hojeSaoPaulo, idsDe, foraDoApp, lerCorpo, pegar } = require("../lib/bitrix-servidor.js");
const trava = require("../lib/trava-encerramento.js");
const negocios = require("../lib/avisos-negocios.js");
const { emailConfigurado, criarEmail } = require("../lib/email.js");
const reg = require("../src/js/35-registros.js");

const PROCESSOS = ["membros", "feedbacks", "planos", "encerramentos"];
const VALIDADE_CACHE_MS = 10 * 60 * 1000;
let cache = null; // estrutura do portal entre chamadas da mesma instância

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

async function portalEmCache(chamar, agora) {
  if (cache && agora - cache.em < VALIDADE_CACHE_MS) return cache.portal;
  const portal = await abrirPortal(chamar, PROCESSOS);
  cache = { portal, em: agora };
  return portal;
}

const etapasCache = new Map(); // categoria -> { etapas, em }
async function etapasEmCache(chamar, categoria, agora) {
  const c = etapasCache.get(String(categoria));
  if (c && agora - c.em < VALIDADE_CACHE_MS) return c.etapas;
  const etapas = reg.etapasDoFunil((await chamar("crm.dealcategory.stage.list", { id: Number(categoria) })).dados || []);
  etapasCache.set(String(categoria), { etapas, em: agora });
  return etapas;
}

/** Negócio criado ou atualizado: e-mail a quem pediu nos funis de vagas e de offboarding.
    O Bitrix manda o evento de TODOS os funis; só o crm.deal.get diz de qual funil é. */
async function tratarNegocio(res, corpo, evento, env, inj) {
  const id = String(pegar(corpo, "data", "FIELDS", "ID") || "");
  if (!/^\d+$/.test(id)) return responder(res, 200, { ok: true, ignorado: "evento sem negócio" });
  const falta = emailConfigurado(env);
  if (falta.length && !inj.email) return responder(res, 200, { ok: true, ignorado: "e-mail não configurado na Vercel (falta " + falta.join(", ") + ")" });
  try {
    const chamar = inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
    const negocio = (await chamar("crm.deal.get", { id: Number(id) })).dados || {};
    const tipo = negocios.tipoDaCategoria(negocio.CATEGORY_ID, env);
    if (!tipo) return responder(res, 200, { ok: true, ignorado: "outro funil" });
    if (inj.semCache) etapasCache.clear();
    const etapas = await etapasEmCache(chamar, negocio.CATEGORY_ID, Date.now());
    const r = await negocios.tratar({
      negocio, etapas, tipo, evento, agora: inj.agora || new Date(), email: inj.email || criarEmail(env), chamar,
      rhIds: idsDe(env.GP_AVISAR_IDS), naoAvisar: foraDoApp(env), link: new URL(env.BITRIX_WEBHOOK_URL).origin + "/crm/deal/details/" + id + "/",
      ultimaMudanca: async () => {
        const h = await chamar("crm.stagehistory.list", { entityTypeId: 2, filter: { OWNER_ID: Number(id) }, order: { ID: "DESC" } });
        const it = ((h.dados && h.dados.items) || [])[0];
        return it ? it.CREATED_TIME : null;
      },
      log: (t) => console.log("[gestao-pessoas] " + t),
    });
    return responder(res, 200, Object.assign({ ok: true, evento, negocio: id, tipo }, r));
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.BITRIX_EVENTO_TOKEN || !env.BITRIX_WEBHOOK_URL) return responder(res, 503, { erro: "BITRIX_EVENTO_TOKEN e BITRIX_WEBHOOK_URL precisam estar configurados na Vercel" });
  if (req.method !== "POST") return responder(res, 405, { erro: "use POST" });
  const corpo = await lerCorpo(req);
  if (String(pegar(corpo, "auth", "application_token") || "") !== env.BITRIX_EVENTO_TOKEN) return responder(res, 401, { erro: "não autorizado" });

  const evento = String(pegar(corpo, "event") || "").toUpperCase();
  if (/^ONCRMDEAL(ADD|UPDATE)$/.test(evento)) return tratarNegocio(res, corpo, evento, env, inj);
  if (!/^ONCRMDYNAMICITEM(ADD|UPDATE)/.test(evento)) return responder(res, 200, { ok: true, ignorado: "evento " + evento });
  const eti = String(pegar(corpo, "data", "FIELDS", "ENTITY_TYPE_ID") || "");
  const id = String(pegar(corpo, "data", "FIELDS", "ID") || "");
  if (!eti || !id) return responder(res, 200, { ok: true, ignorado: "evento sem item" });

  try {
    if (inj.semCache) cache = null;
    const chamar = inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
    let portal = await portalEmCache(chamar, Date.now());
    // processo recriado (entityTypeId novo) enquanto a estrutura estava guardada: lê de novo, no máximo 1 vez por minuto
    if (String(portal.eti("encerramentos")) !== eti && cache && Date.now() - cache.em > 60 * 1000) {
      cache = null;
      portal = await portalEmCache(chamar, Date.now());
    }
    if (String(portal.eti("encerramentos")) !== eti) return responder(res, 200, { ok: true, ignorado: "outro processo" });
    const r = await trava.tratar({
      portal, id, hoje: inj.hoje || hojeSaoPaulo(), rhIds: idsDe(env.GP_AVISAR_IDS), naoAvisar: foraDoApp(env),
    });
    return responder(res, 200, Object.assign({ ok: true, evento }, r));
  } catch (e) {
    console.error(e);
    cache = null; // a estrutura pode ter mudado (processo recriado, campo novo)
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
