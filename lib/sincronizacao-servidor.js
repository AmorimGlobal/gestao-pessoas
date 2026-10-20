/* =====================================================================================
   SINCRONIZAÇÃO NO SERVIDOR — usada pela rotina diária da Vercel (api/sincronizar.js)
   -------------------------------------------------------------------------------------
   Mesmo motor do botão "Sincronizar agora" (src/js/55-sync.js), falando com o Bitrix
   por webhook de entrada. O webhook precisa dos escopos crm, user, department e im.
   Só lê e grava os processos Membros e Onboarding.
   ===================================================================================== */
"use strict";
const schema = require("../src/js/20-schema.js");
const sync = require("../src/js/55-sync.js");
const { codigoDoEstagio } = require("../src/js/30-provision.js");

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

async function listarTudo(chamar, metodo, params, extrair, max) {
  const itens = [];
  let start = 0;
  for (let i = 0; i < 200; i++) {
    const r = await chamar(metodo, Object.assign({}, params, start ? { start } : {}));
    itens.push(...((extrair ? extrair(r.dados) : r.dados) || []));
    if (r.proximo === null || r.proximo === undefined || itens.length >= (max || 5000)) break;
    start = r.proximo;
  }
  return itens;
}

function dataISO(v) {
  const t = String(v || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = /^(\d{2})[./](\d{2})[./](\d{4})/.exec(t);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
}

/** Acha Membros e Onboarding pelo título (como o app faz sem configuração gravada) */
async function carregarEstrutura(chamar) {
  const tipos = await listarTudo(chamar, "crm.type.list", {}, (d) => d && d.types);
  const est = {};
  for (const chave of ["membros", "onboarding"]) {
    const p = schema.processo(chave);
    const t = tipos.find((x) => x.title === schema.tituloProcesso(p));
    if (!t) throw new Error("processo \"" + schema.tituloProcesso(p) + "\" não encontrado no Bitrix (rode a configuração do app)");
    const cats = await listarTudo(chamar, "crm.category.list", { entityTypeId: t.entityTypeId }, (d) => d && d.categories);
    const cat = cats.find((x) => x.isDefault === "Y" || x.isDefault === true) || cats[0];
    const st = await listarTudo(chamar, "crm.status.list", { filter: { ENTITY_ID: "DYNAMIC_" + t.entityTypeId + "_STAGE_" + cat.id } });
    const estagios = {};
    st.forEach((s) => { estagios[codigoDoEstagio(s.STATUS_ID)] = s.STATUS_ID; });
    const flds = ((await chamar("crm.item.fields", { entityTypeId: t.entityTypeId })).dados || {}).fields || {};
    const codigos = {}, enums = {};
    p.campos.forEach((d) => {
      const cod = schema.codigoCampo(t.id, d.sufixo);
      codigos[d.chave] = cod;
      if (flds[cod] && flds[cod].items) {
        enums[d.chave] = {};
        flds[cod].items.forEach((i) => { enums[d.chave][i.VALUE] = i.ID; });
      }
    });
    est[chave] = { eti: t.entityTypeId, typeId: t.id, estagios, codigos, enums };
  }
  return est;
}

async function carregarDados(chamar, est) {
  const [usuariosBrutos, deptosBrutos, itens] = [
    await listarTudo(chamar, "user.get", { FILTER: { ACTIVE: true } }),
    await listarTudo(chamar, "department.get", {}),
    await listarTudo(chamar, "crm.item.list", {
      entityTypeId: est.membros.eti, select: ["id", "title", "stageId", "assignedById", est.membros.codigos.lideranca, est.membros.codigos.coordenacao],
    }, (d) => d && d.items),
  ];
  const usuarios = usuariosBrutos.map((u) => ({
    id: String(u.ID), nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || u.EMAIL || ("Usuário " + u.ID),
    departamentos: (u.UF_DEPARTMENT || []).map(String), registro: dataISO(u.DATE_REGISTER), tipo: u.USER_TYPE || "",
    estado: [u.PERSONAL_STATE, u.WORK_STATE].filter(Boolean).join(" "), cidade: [u.PERSONAL_CITY, u.WORK_CITY].filter(Boolean).join(" "),
  }));
  const departamentos = deptosBrutos.map((d) => ({ id: String(d.ID), nome: d.NAME, pai: d.PARENT ? String(d.PARENT) : "", chefe: d.UF_HEAD ? String(d.UF_HEAD) : "" }));
  const membros = itens.map((it) => ({
    id: String(it.id), titulo: it.title || "", estagio: codigoDoEstagio(it.stageId || ""), responsavel: String(it.assignedById || ""),
    lideranca: it[est.membros.codigos.lideranca] ? String(it[est.membros.codigos.lideranca]) : "",
    coordenacao: it[est.membros.codigos.coordenacao] ? String(it[est.membros.codigos.coordenacao]) : "",
  }));
  return { usuarios, departamentos, membros };
}

function criarOps(chamar, est, usuarios) {
  const M = est.membros, O = est.onboarding;
  const nomes = {};
  usuarios.forEach((u) => { nomes[u.id] = u.nome; });
  function camposMembro(d) {
    const f = {};
    if (d.titulo) f.title = d.titulo;
    if (d.responsavel) f.assignedById = Number(d.responsavel);
    if (d.estagio) f.stageId = M.estagios[d.estagio];
    if (d.lideranca !== undefined) f[M.codigos.lideranca] = d.lideranca ? Number(d.lideranca) : "";
    if (d.coordenacao !== undefined) f[M.codigos.coordenacao] = d.coordenacao ? Number(d.coordenacao) : "";
    if (d.ingresso) f[M.codigos.ingresso] = d.ingresso;
    if (d.cidade && M.enums.cidade && M.enums.cidade[d.cidade]) f[M.codigos.cidade] = M.enums.cidade[d.cidade];
    return f;
  }
  return {
    criarMembro: async (d) => {
      const r = await chamar("crm.item.add", { entityTypeId: M.eti, fields: camposMembro(d) });
      return { id: String(r.dados.item.id) };
    },
    criarOnboarding: async (d) => {
      const f = { title: d.titulo, assignedById: Number(d.responsavel), stageId: O.estagios.NEW };
      f["parentId" + M.eti] = Number(d.membroId);
      if (d.ingresso) f[O.codigos.ingresso] = d.ingresso;
      await chamar("crm.item.add", { entityTypeId: O.eti, fields: f });
    },
    atualizarMembro: async (id, d) => { await chamar("crm.item.update", { entityTypeId: M.eti, id: Number(id), fields: camposMembro(d) }); },
    comentar: async (id, texto) => { await chamar("crm.timeline.comment.add", { fields: { ENTITY_ID: Number(id), ENTITY_TYPE: "DYNAMIC_" + M.eti, COMMENT: texto } }); },
    notificar: async (ids, texto) => {
      for (const id of Array.from(new Set(ids.map(String)))) {
        await chamar("im.notify.system.add", { USER_ID: Number(id), MESSAGE: "[Gestão de Pessoas] " + texto });
      }
    },
    nomeDe: (id) => nomes[String(id)] || "",
  };
}

/** Carrega, planeja e aplica. limite: máximo de mudanças por execução (o resto fica para o dia seguinte). */
async function sincronizar(op) {
  const est = await carregarEstrutura(op.chamar);
  const dados = await carregarDados(op.chamar, est);
  const plano = sync.planejar({ hoje: op.hoje, usuarios: dados.usuarios, departamentos: dados.departamentos, membros: dados.membros, excecoes: op.excecoes || [], ceos: op.ceos || [] });
  const resumo = await sync.executar(plano, criarOps(op.chamar, est, dados.usuarios), { hoje: op.hoje, avisarIds: op.avisarIds || [], limite: op.limite || 40 });
  return {
    hoje: op.hoje, usuarios: dados.usuarios.length, membros: dados.membros.length,
    criados: resumo.criados.length, atualizados: resumo.atualizados.length, encerrados: resumo.encerrados.length,
    pendentes: resumo.pendentes, alerta: plano.alerta, conferir: plano.conferir.length, falhas: resumo.falhas, texto: resumo.texto,
  };
}

/** Data de hoje no fuso de São Paulo, em AAAA-MM-DD */
function hojeSaoPaulo(agora) {
  return (agora || new Date()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

module.exports = { criarChamadaWebhook, carregarEstrutura, carregarDados, criarOps, sincronizar, hojeSaoPaulo };
