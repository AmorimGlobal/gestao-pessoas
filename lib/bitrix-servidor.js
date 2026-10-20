/* =====================================================================================
   BITRIX NO SERVIDOR — o que as funções da Vercel (api/) usam para falar com o portal
   -------------------------------------------------------------------------------------
   Pelo webhook de entrada (BITRIX_WEBHOOK_URL), com os escopos crm, user, department e im.
   Lê e grava os itens com a mesma conversão do navegador (src/js/35-registros.js), então
   um campo gravado aqui aparece no app exatamente como se a tela tivesse gravado.
   ===================================================================================== */
"use strict";
const schema = require("../src/js/20-schema.js");
const reg = require("../src/js/35-registros.js");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** chamar(metodo, params) -> {dados, proximo}, com nova tentativa no limite de chamadas */
function criarChamadaWebhook(url, fetchImpl) {
  const f = fetchImpl || fetch;
  const base = String(url).replace(/\/+$/, "") + "/";
  return async function chamar(metodo, params) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const resp = await f(base + metodo + ".json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}) });
      const json = await resp.json().catch(() => ({ error: "HTTP " + resp.status }));
      if (json.error === "QUERY_LIMIT_EXCEEDED") { await espera(1000 * (tentativa + 1)); continue; }
      if (json.error) throw new Error(metodo + ": " + json.error + (json.error_description ? " — " + json.error_description : ""));
      return { dados: json.result, proximo: json.next === undefined ? null : json.next };
    }
    throw new Error(metodo + ": limite de chamadas do Bitrix excedido");
  };
}

/** Percorre as páginas de 50 (sem isto, a partir do 51º item os registros somem em silêncio) */
async function listarTudo(chamar, metodo, params, extrair, max) {
  const limite = max || 20000;
  const itens = [];
  let start = 0;
  for (;;) {
    const r = await chamar(metodo, Object.assign({}, params, start ? { start } : {}));
    itens.push(...((extrair ? extrair(r.dados) : r.dados) || []));
    if (r.proximo === null || r.proximo === undefined) break;
    if (itens.length >= limite) {
      // nunca em silêncio: quem ler os logs da Vercel sabe que a lista foi cortada
      console.warn("[gestao-pessoas] " + metodo + " cortado em " + itens.length + " itens (há mais no Bitrix)", JSON.stringify(params && params.entityTypeId ? { entityTypeId: params.entityTypeId } : {}));
      break;
    }
    start = r.proximo;
  }
  return itens;
}

/** Data de hoje no fuso de São Paulo, em AAAA-MM-DD */
function hojeSaoPaulo(agora) {
  return (agora || new Date()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function usuarioDoBitrix(u) {
  const nasc = String(u.PERSONAL_BIRTHDAY || "");
  return {
    id: String(u.ID), nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || u.EMAIL || ("Usuário " + u.ID),
    email: u.EMAIL || "", cargo: u.WORK_POSITION || "", foto: "",
    departamentos: (u.UF_DEPARTMENT || []).map(String), aniversario: nasc ? reg.dataBitrix(nasc).slice(5, 10) : "",
    registro: reg.dataBitrix(u.DATE_REGISTER), tipo: u.USER_TYPE || "",
    estado: [u.PERSONAL_STATE, u.WORK_STATE].filter(Boolean).join(" "), cidade: [u.PERSONAL_CITY, u.WORK_CITY].filter(Boolean).join(" "),
  };
}
function departamentoDoBitrix(d) {
  return { id: String(d.ID), nome: d.NAME, pai: d.PARENT ? String(d.PARENT) : "", chefe: d.UF_HEAD ? String(d.UF_HEAD) : "" };
}

/** Acha os processos do app pelo título e lê os campos de cada um.
    chaves: só esses processos (ex.: ["membros", "encerramentos"]); sem chaves, todos. */
async function abrirPortal(chamar, chaves) {
  const listar = (metodo, params, chave) => listarTudo(chamar, metodo, params, chave ? (d) => d && d[chave] : null);
  const cfg = await reg.descobrirEstrutura(listar, chaves);
  const est = {};
  const faltando = [];
  for (const chave of chaves || schema.PROCESSOS.map((p) => p.chave)) {
    const c = cfg.processos[chave];
    if (!c) { faltando.push(chave); continue; }
    const e = reg.estruturaDoProcesso(schema.processo(chave), c);
    const flds = ((await chamar("crm.item.fields", { entityTypeId: e.eti })).dados || {}).fields || {};
    e.ausentes = reg.aplicarMetadados(e, flds);
    est[chave] = e;
  }
  const exigir = (chave) => {
    if (!est[chave]) throw new Error("processo \"" + schema.tituloProcesso(schema.processo(chave)) + "\" não encontrado no Bitrix (rode a configuração do app)");
    return est[chave];
  };
  const SELECT = ["*", "ufCrm*"];
  return {
    est, faltando, chamar,
    eti: (chave) => est[chave] && est[chave].eti,
    listar: async (chave, filtro) => {
      const e = exigir(chave);
      const itens = await listarTudo(chamar, "crm.item.list", { entityTypeId: e.eti, select: SELECT, order: { id: "ASC" }, filter: filtro || {} }, (d) => d && d.items);
      return itens.map((it) => reg.normalizar(e, it));
    },
    /** Filhos de um membro (relação pai/filho nativa) */
    doMembro: async function (chave, membroId) {
      const e = exigir(chave);
      if (!e.campoPai || !membroId) return [];
      const filtro = {};
      filtro[e.campoPai] = Number(membroId);
      return this.listar(chave, filtro);
    },
    obter: async (chave, id) => {
      const e = exigir(chave);
      const r = await chamar("crm.item.get", { entityTypeId: e.eti, id: Number(id) });
      return reg.normalizar(e, r.dados.item);
    },
    criar: async (chave, dados) => {
      const e = exigir(chave);
      const r = await chamar("crm.item.add", { entityTypeId: e.eti, fields: reg.montarCampos(e, dados) });
      return reg.normalizar(e, r.dados.item);
    },
    atualizar: async (chave, id, dados) => {
      const e = exigir(chave);
      await chamar("crm.item.update", { entityTypeId: e.eti, id: Number(id), fields: reg.montarCampos(e, dados) });
    },
    comentar: async (chave, id, texto) => {
      const e = exigir(chave);
      await chamar("crm.timeline.comment.add", { fields: { ENTITY_ID: Number(id), ENTITY_TYPE: "DYNAMIC_" + e.eti, COMMENT: texto } });
    },
    /** Aviso no sino do Bitrix, um por pessoa, sem repetir */
    notificar: async (ids, texto) => {
      for (const id of Array.from(new Set((ids || []).filter(Boolean).map(String)))) {
        await chamar("im.notify.system.add", { USER_ID: Number(id), MESSAGE: "[Gestão de Pessoas] " + texto });
      }
    },
    usuarios: async () => (await listarTudo(chamar, "user.get", { FILTER: { ACTIVE: true } })).map(usuarioDoBitrix),
    departamentos: async () => (await listarTudo(chamar, "department.get", {})).map(departamentoDoBitrix),
    /** Funil de negócios "HR | Requisição de Vagas", no mesmo formato que o navegador lê (40-bitrix.js) */
    vagas: async (categoria) => {
      const cat = Number(categoria || 77);
      const etapas = (await chamar("crm.dealcategory.stage.list", { id: cat })).dados || [];
      const negocios = await listarTudo(chamar, "crm.deal.list", {
        filter: { CATEGORY_ID: cat }, order: { ID: "DESC" },
        select: ["ID", "TITLE", "STAGE_ID", "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE", "CLOSED", "ASSIGNED_BY_ID",
          "UF_CRM_RV_VAGA", "UF_CRM_RV_EMAIL", "UF_CRM_RV_LIDER", "UF_CRM_RV_COORD", "UF_CRM_RV_SETOR", "UF_CRM_RV_DEPTO", "UF_CRM_RV_DATA_ENT"],
      });
      const historico = await listarTudo(chamar, "crm.stagehistory.list", { entityTypeId: 2, filter: { CATEGORY_ID: cat }, order: { ID: "ASC" } }, (d) => d && d.items).catch(() => []);
      return { etapas: reg.etapasDoFunil(etapas), negocios, historico };
    },
  };
}

/** Corpo da requisição: objeto já lido pela Vercel, JSON ou application/x-www-form-urlencoded
    (o webhook de saída do Bitrix manda chaves planas como "data[FIELDS][ID]") */
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

/** Quem está com este token do Bitrix (BX24.getAuth().access_token). Pergunta ao MESMO portal
    do webhook de entrada: nunca a um endereço vindo do navegador. Devolve o ID ou lança erro. */
async function usuarioDoToken(webhookUrl, token, fetchImpl) {
  const f = fetchImpl || fetch;
  const origem = new URL(webhookUrl).origin;
  const resp = await f(origem + "/rest/user.current.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auth: token }) });
  const json = await resp.json().catch(() => ({}));
  if (json.error || !json.result || !json.result.ID) throw new Error(json.error === "expired_token" ? "a sessão do Bitrix expirou: recarregue a página" : "sessão do Bitrix não reconhecida");
  return String(json.result.ID);
}

/** Lista de IDs vinda de variável de ambiente ("6, 12;40") */
const idsDe = (v) => String(v || "").split(/[,\s;]+/).filter(Boolean);
/** Quem nunca recebe aviso nem ganha item: a CEO (GP_CEO_IDS) e quem está fora do app (GP_EXCECOES_IDS) */
const foraDoApp = (env) => Array.from(new Set(idsDe(env.GP_CEO_IDS).concat(idsDe(env.GP_EXCECOES_IDS))));

module.exports = { criarChamadaWebhook, listarTudo, hojeSaoPaulo, abrirPortal, usuarioDoBitrix, departamentoDoBitrix, idsDe, foraDoApp, lerCorpo, pegar, usuarioDoToken };
