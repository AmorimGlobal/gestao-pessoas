/* =====================================================================================
   REGISTROS — conversão entre o item do Bitrix (crm.item.*) e o objeto do app
   -------------------------------------------------------------------------------------
   Usado pelo navegador (40-bitrix.js) e pelo servidor (lib/bitrix-servidor.js), para os
   dois lados lerem e gravarem os campos do mesmo jeito:
     item do Bitrix  { id, title, stageId, ufCrm57Lideranca: 3, parentId1114: 12, ... }
     objeto do app   { id, titulo, estagio: "ATIVO", lideranca: "3", membroId: "12", ... }

   Não chama o Bitrix: quem chama passa a função `listar(metodo, params, chave)` que
   percorre as páginas e devolve a lista.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.schema ? raiz.GP.schema : require("./20-schema.js"),
    raiz.GP && raiz.GP.provision ? raiz.GP.provision : require("./30-provision.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.registros = m; }
})(typeof window !== "undefined" ? window : globalThis, function (schema, provision) {
  "use strict";
  const codigoDoEstagio = provision.codigoDoEstagio;

  /** Data do Bitrix em ISO, venha ela como "2026-10-08T...", "08.10.2026 ..." ou "08/10/2026 ..." */
  function dataBitrix(s) {
    const t = String(s || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = /^(\d{2})[./](\d{2})[./](\d{4})/.exec(t);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }

  /* ---------- conversão de valores ---------- */
  function lerValor(def, v, enumInfo) {
    switch (def.tipo) {
      case "data": return v ? String(v).slice(0, 10) : "";
      case "dataHora": return v ? String(v) : "";
      case "pessoa": return Array.isArray(v) ? v.map(String) : (v ? String(v) : "");
      case "lista": {
        const ler = (x) => (enumInfo && enumInfo.porId[String(x)]) || "";
        return Array.isArray(v) ? v.map(ler).filter(Boolean) : (v ? ler(v) : "");
      }
      case "simNao": return v === true || v === 1 || v === "1" || v === "Y";
      case "arquivo": return Array.isArray(v) ? v : (v && typeof v === "object" ? [v] : []);
      case "numero": return v === null || v === undefined || v === "" ? null : Number(v);
      default: return v === null || v === undefined ? "" : String(v);
    }
  }
  function escreverValor(def, v, enumInfo) {
    switch (def.tipo) {
      case "lista": return v ? ((enumInfo && enumInfo.porValor[v]) || "") : "";
      case "pessoa": return v ? Number(v) : "";
      case "simNao": return v ? 1 : 0;
      case "numero": return v === null || v === undefined || v === "" ? "" : Number(v);
      case "data": return v || "";
      default: return v === null || v === undefined ? "" : String(v);
    }
  }

  /* ---------- estrutura de um processo ---------- */
  /** p = processo do esquema; c = { entityTypeId, typeId, campoPai, estagios: {codigo: STATUS_ID} } */
  function estruturaDoProcesso(p, c) {
    const defs = {}, campos = {}, nomes = {}, estagioPorId = {};
    p.campos.forEach(function (d) { defs[d.chave] = d; campos[d.chave] = schema.codigoCampo(c.typeId, d.sufixo); });
    p.estagios.forEach(function (e) { nomes[e.codigo] = e.nome; });
    Object.keys(c.estagios || {}).forEach(function (cod) { estagioPorId[c.estagios[cod]] = cod; });
    return {
      eti: c.entityTypeId, typeId: c.typeId, campoPai: c.campoPai, estagios: c.estagios || {},
      estagioPorId, nomes, campos, defs, enums: {}, presentes: new Set(),
    };
  }
  /** Aplica a resposta de crm.item.fields: quais campos existem e os IDs das listas. Devolve as chaves ausentes. */
  function aplicarMetadados(e, fields) {
    const ausentes = [];
    Object.keys(e.campos).forEach(function (ch) {
      const f = (fields || {})[e.campos[ch]];
      if (!f) { ausentes.push(ch); return; }
      e.presentes.add(ch);
      if (f.items) {
        const porId = {}, porValor = {};
        f.items.forEach(function (i) { porId[String(i.ID)] = i.VALUE; porValor[i.VALUE] = i.ID; });
        e.enums[ch] = { porId, porValor };
      }
    });
    return ausentes;
  }

  /** Item do Bitrix -> objeto do app */
  function normalizar(e, it) {
    const o = {
      id: String(it.id), titulo: it.title || "", stageId: it.stageId || "",
      estagio: e.estagioPorId[it.stageId] || codigoDoEstagio(it.stageId || ""),
      criadoEm: it.createdTime || "", atualizadoEm: it.updatedTime || "", movidoEm: it.movedTime || "",
      criadoPor: String(it.createdBy || ""), responsavel: String(it.assignedById || ""),
      membroId: e.campoPai && it[e.campoPai] ? String(it[e.campoPai]) : "",
    };
    o.estagioNome = e.nomes[o.estagio] || o.estagio;
    Object.keys(e.campos).forEach(function (ch) { o[ch] = lerValor(e.defs[ch], it[e.campos[ch]], e.enums[ch]); });
    return o;
  }

  /** Objeto do app (só as chaves presentes) -> fields do crm.item.add/update */
  function montarCampos(e, dados, avisar) {
    const f = {};
    Object.keys(dados || {}).forEach(function (ch) {
      if (ch === "titulo") { f.title = dados[ch]; return; }
      if (ch === "estagio") { if (dados[ch]) f.stageId = e.estagios[dados[ch]]; return; }
      if (ch === "membroId") { if (e.campoPai && dados[ch]) f[e.campoPai] = Number(dados[ch]); return; }
      if (ch === "responsavel") { if (dados[ch]) f.assignedById = Number(dados[ch]); return; }
      const def = e.defs[ch];
      if (!def) return;
      if (!e.presentes.has(ch)) { if (avisar) avisar(ch); return; }
      if (def.tipo === "arquivo") { f[e.campos[ch]] = dados[ch]; return; } // já no formato [{id}, [nome, base64]]
      f[e.campos[ch]] = escreverValor(def, dados[ch], e.enums[ch]);
    });
    return f;
  }

  /** Etapas de um funil de negócios. crm.dealcategory.stage.list não traz SEMANTICS (portal, 10/2026):
      no Bitrix, a etapa de sucesso é a WON e as de fracasso vêm depois dela na ordem. */
  function etapasDoFunil(lista) {
    const etapas = (lista || []).slice().sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0));
    const ganha = etapas.find((x) => x.SEMANTICS === "S") || etapas.find((x) => /(^|:)WON$/.test(String(x.STATUS_ID)));
    return etapas.map(function (x) {
      let sem = x.SEMANTICS || "";
      if (!sem && ganha) sem = x === ganha ? "S" : Number(x.SORT || 0) > Number(ganha.SORT || 0) ? "F" : "";
      return { id: x.STATUS_ID, nome: x.NAME, semantica: sem };
    });
  }

  /** Sem configuração gravada: acha os processos pelo título.
      listar(metodo, params, chave) -> Promise<lista> (todas as páginas). chaves: só esses processos. */
  async function descobrirEstrutura(listar, chaves) {
    const tipos = await listar("crm.type.list", {}, "types");
    const cfg = { versao: 1, processos: {}, descoberta: true };
    const membrosT = tipos.find((t) => t.title === schema.tituloProcesso(schema.processo("membros")));
    for (const p of schema.PROCESSOS) {
      if (chaves && chaves.indexOf(p.chave) < 0) continue;
      const t = tipos.find((x) => x.title === schema.tituloProcesso(p));
      if (!t) continue;
      const cats = await listar("crm.category.list", { entityTypeId: t.entityTypeId }, "categories");
      const cat = cats.find((x) => x.isDefault === "Y" || x.isDefault === true) || cats[0];
      if (!cat) continue;
      const st = await listar("crm.status.list", { filter: { ENTITY_ID: "DYNAMIC_" + t.entityTypeId + "_STAGE_" + cat.id } });
      const estagios = {};
      p.estagios.forEach(function (e) {
        const s = st.find((x) => codigoDoEstagio(x.STATUS_ID) === e.codigo);
        if (s) estagios[e.codigo] = s.STATUS_ID;
      });
      const paiEti = p.pai === "membros" ? (membrosT && membrosT.entityTypeId) : p.pai === "negocio" ? schema.ENTITY_TYPE_NEGOCIO : null;
      cfg.processos[p.chave] = { entityTypeId: t.entityTypeId, typeId: t.id, categoriaId: cat.id, campoPai: paiEti ? "parentId" + paiEti : null, estagios };
    }
    return cfg;
  }

  return { dataBitrix, lerValor, escreverValor, estruturaDoProcesso, aplicarMetadados, normalizar, montarCampos, descobrirEstrutura, codigoDoEstagio, etapasDoFunil };
});
