/* =====================================================================================
   PROVISIONAMENTO — cria no Bitrix o que o esquema (20-schema.js) descreve
   -------------------------------------------------------------------------------------
   Idempotente: pode rodar quantas vezes quiser; só cria ou acerta o que falta.
   Não depende de onde roda: recebe uma função `chamar(metodo, params)` que devolve
   Promise<{ dados, proximo }>. No app, ela usa BX24.callMethod (com o login do admin);
   no Node (tools/provisionar.js), um webhook de entrada.

   Escopos necessários: crm (tipos, estágios, solução automatizada) e userfieldconfig
   (campos). O webhook atual do webflow-btrix-api só tem crm e task.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP ? raiz.GP.schema : require("./20-schema.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.provision = m; }
})(typeof window !== "undefined" ? window : globalThis, function (schema) {
  "use strict";

  const TIPO_UF = {
    texto: "string", textoLongo: "string", data: "date", dataHora: "datetime", pessoa: "employee",
    lista: "enumeration", simNao: "boolean", arquivo: "file", numero: "double",
  };
  const ESTAGIOS_PADRAO_DESCARTAVEIS = ["PREPARATION", "CLIENT"];

  function rotulos(texto) { return { br: texto, en: texto }; }

  function payloadCampo(typeId, campo, ordem) {
    const settings = {};
    if (campo.tipo === "textoLongo") settings.ROWS = 5;
    if (campo.tipo === "texto") settings.ROWS = 1;
    if (campo.tipo === "simNao") { settings.DEFAULT_VALUE = 0; settings.DISPLAY = "CHECKBOX"; }
    if (campo.tipo === "numero") settings.PRECISION = 0;
    if (campo.tipo === "lista") settings.DISPLAY = "UI";
    const field = {
      entityId: "CRM_" + typeId,
      fieldName: schema.nomeCampo(typeId, campo.sufixo),
      userTypeId: TIPO_UF[campo.tipo],
      multiple: campo.multiplo ? "Y" : "N",
      mandatory: "N", // obrigatoriedade por estágio é configurada no card (ver docs/configuracao-bitrix.md)
      showFilter: "E", showInList: "Y", editInList: "Y", isSearchable: "N",
      sort: 100 + ordem * 10,
      editFormLabel: rotulos(campo.rotulo), listColumnLabel: rotulos(campo.rotulo), listFilterLabel: rotulos(campo.rotulo),
      settings,
    };
    if (campo.ajuda) field.helpMessage = rotulos(campo.ajuda);
    if (campo.tipo === "lista") field.enum = campo.opcoes.map((v, i) => ({ value: v, sort: (i + 1) * 10, def: "N" }));
    return { moduleId: "crm", field };
  }

  /** Sufixo do STATUS_ID ("DT1100_7:ATIVO" -> "ATIVO") */
  function codigoDoEstagio(statusId) { const s = String(statusId); return s.slice(s.lastIndexOf(":") + 1); }

  async function provisionar(op) {
    const chamarReal = op.chamar;
    const log = op.log || function () {};
    const simular = !!op.simular;
    const configAnterior = op.configAtual || {};
    const relatorio = [];
    let seq = 0;

    async function chamar(metodo, params) {
      const escrita = /\.(add|update|delete)$/.test(metodo);
      if (escrita) relatorio.push({ metodo, params, simulado: simular });
      if (simular && escrita) return { dados: resultadoSimulado(metodo), proximo: null };
      return chamarReal(metodo, params);
    }
    function resultadoSimulado(metodo) {
      seq++;
      if (metodo === "crm.type.add") return { type: { id: "novo" + seq, entityTypeId: "novo" + seq, relations: { parent: [], child: [] } } };
      if (metodo === "crm.automatedsolution.add") return { automatedSolution: { id: "novo" + seq } };
      return true;
    }
    // Uma falha pontual (um campo, um estágio) fica registrada e o resto continua: rodar de
    // novo completa o que faltou. Falta de permissão ou sessão vencida param tudo na hora.
    const falhas = [];
    const SISTEMICO = /insufficient_scope|ACCESS_DENIED|expired_token|invalid_token|NO_AUTH_FOUND|QUERY_LIMIT/i;
    function registrarFalha(desc, e) {
      const msg = (e && e.message) || String(e);
      if (SISTEMICO.test(msg)) throw e;
      falhas.push(desc + ": " + msg);
      log("  FALHOU " + desc + ": " + msg);
    }
    async function tentar(desc, fn) {
      try { return await fn(); } catch (e) { registrarFalha(desc, e); return null; }
    }
    async function listarTodos(metodo, params, extrair) {
      const itens = [];
      let start = 0;
      for (let pagina = 0; pagina < 200; pagina++) {
        const r = await chamar(metodo, Object.assign({}, params, start ? { start } : {}));
        itens.push(...(extrair(r.dados) || []));
        if (r.proximo === null || r.proximo === undefined || r.proximo === false) break;
        start = r.proximo;
      }
      return itens;
    }

    /* 1. tipos existentes */
    const tipos = await listarTodos("crm.type.list", {}, (d) => d && d.types);
    log("Processos inteligentes existentes no portal: " + tipos.length);
    const porEntity = {}, porTitulo = {};
    tipos.forEach((t) => { porEntity[String(t.entityTypeId)] = t; porTitulo[t.title] = t; });

    const config = { versao: 1, processos: {}, provisionadoEm: new Date().toISOString() };
    const etiDe = (chave) => config.processos[chave] && config.processos[chave].entityTypeId;

    // membros primeiro: os outros são filhos dele
    const ordem = schema.PROCESSOS.slice().sort((a, b) => (a.pai === null ? -1 : 0) - (b.pai === null ? -1 : 0));
    for (const p of ordem) {
     try {
      const titulo = schema.tituloProcesso(p);
      const anterior = configAnterior.processos && configAnterior.processos[p.chave];
      let tipo = (anterior && porEntity[String(anterior.entityTypeId)]) || porTitulo[titulo];
      let criadoAgora = false;

      const paiEti = p.pai === "membros" ? etiDe("membros") : p.pai === "negocio" ? schema.ENTITY_TYPE_NEGOCIO : null;
      const relPai = paiEti ? [{ entityTypeId: paiEti, isChildrenListEnabled: "Y" }] : [];

      if (!tipo) {
        log("Criando processo " + titulo);
        const r = await chamar("crm.type.add", {
          fields: {
            title: titulo,
            isStagesEnabled: "Y", isCategoriesEnabled: "N", isBeginCloseDatesEnabled: "N", isClientEnabled: "N",
            isUseInUserfieldEnabled: "Y", isLinkWithProductsEnabled: "N", isMycompanyEnabled: "N",
            isDocumentsEnabled: "Y", isSourceEnabled: "N", isObserversEnabled: "N", isRecyclebinEnabled: "Y",
            isAutomationEnabled: "Y", isBizProcEnabled: "Y",
            // sem permissão aberta: o acesso é dado pelas funções do CRM (2.4)
            isSetOpenPermissions: "N",
            relations: { parent: relPai, child: [] },
          },
        });
        tipo = r.dados.type;
        criadoAgora = true;
      } else {
        log("Processo já existe: " + titulo + " (entityTypeId " + tipo.entityTypeId + ")");
        const rel = tipo.relations || { parent: [], child: [] };
        const temPai = !paiEti || (rel.parent || []).some((x) => String(x.entityTypeId) === String(paiEti));
        if (!temPai) {
          log("  ligando ao processo pai (entityTypeId " + paiEti + ")");
          await tentar("ligação de " + p.nome + " ao processo pai", () => chamar("crm.type.update", {
            id: tipo.id,
            fields: { relations: { parent: (rel.parent || []).concat(relPai), child: rel.child || [] } },
          }));
        }
      }

      const typeId = tipo.id, eti = tipo.entityTypeId;

      /* 2. categoria padrão */
      let categoriaId = null;
      if (!simular || !criadoAgora) {
        const cats = await listarTodos("crm.category.list", { entityTypeId: eti }, (d) => d && d.categories);
        const padrao = cats.find((x) => x.isDefault === "Y" || x.isDefault === true) || cats[0];
        categoriaId = padrao ? padrao.id : null;
      }
      const entityStage = "DYNAMIC_" + eti + "_STAGE_" + (categoriaId === null ? "?" : categoriaId);
      const prefixo = "DT" + eti + "_" + (categoriaId === null ? "?" : categoriaId);

      /* 3. estágios */
      const estagiosAtuais = (simular && criadoAgora) ? [] : await listarTodos("crm.status.list", { filter: { ENTITY_ID: entityStage } }, (d) => d);
      for (let i = 0; i < p.estagios.length; i++) {
        const e = p.estagios[i];
        const sort = (i + 1) * 10;
        const atual = estagiosAtuais.find((s) => codigoDoEstagio(s.STATUS_ID) === e.codigo);
        if (atual) {
          if (atual.NAME !== e.nome || String(atual.COLOR || "").toUpperCase() !== e.cor.toUpperCase() || Number(atual.SORT) !== sort) {
            await tentar("estágio \"" + e.nome + "\" de " + p.nome, () => chamar("crm.status.update", { id: atual.ID, fields: { NAME: e.nome, COLOR: e.cor, SORT: sort } }));
          }
        } else {
          await tentar("estágio \"" + e.nome + "\" de " + p.nome, () => chamar("crm.status.add", { fields: { ENTITY_ID: entityStage, STATUS_ID: prefixo + ":" + e.codigo, NAME: e.nome, COLOR: e.cor, SORT: sort } }));
        }
      }
      if (criadoAgora) {
        for (const s of estagiosAtuais) {
          const cod = codigoDoEstagio(s.STATUS_ID);
          if (ESTAGIOS_PADRAO_DESCARTAVEIS.indexOf(cod) >= 0 && !p.estagios.some((e) => e.codigo === cod)) {
            await tentar("remover o estágio padrão " + cod + " de " + p.nome, () => chamar("crm.status.delete", { id: s.ID }));
          }
        }
      }
      const estagiosFinais = (simular && criadoAgora) ? [] : await listarTodos("crm.status.list", { filter: { ENTITY_ID: entityStage } }, (d) => d);
      const estagios = {};
      p.estagios.forEach((e) => {
        const s = estagiosFinais.find((x) => codigoDoEstagio(x.STATUS_ID) === e.codigo);
        estagios[e.codigo] = s ? s.STATUS_ID : prefixo + ":" + e.codigo;
      });

      /* 4. campos */
      const camposAtuais = (simular && criadoAgora) ? [] : await listarTodos(
        "userfieldconfig.list", { moduleId: "crm", filter: { entityId: "CRM_" + typeId } }, (d) => d && d.fields);
      const existentes = new Set(camposAtuais.map((f) => String(f.fieldName).toUpperCase()));
      let criados = 0, jaExistiam = 0, falharam = 0;
      for (let i = 0; i < p.campos.length; i++) {
        const campo = p.campos[i];
        if (existentes.has(schema.nomeCampo(typeId, campo.sufixo))) { jaExistiam++; continue; }
        const r = await tentar("campo \"" + campo.rotulo + "\" de " + p.nome, () => chamar("userfieldconfig.add", payloadCampo(typeId, campo, i)));
        if (r) criados++; else falharam++;
      }
      log("  campos: " + jaExistiam + " já existiam, " + criados + (simular ? " seriam criados" : " criados") + (falharam ? ", " + falharam + " falharam" : ""));

      const campos = {};
      p.campos.forEach((campo) => { campos[campo.chave] = schema.codigoCampo(typeId, campo.sufixo); });
      config.processos[p.chave] = {
        entityTypeId: eti, typeId, categoriaId, titulo,
        campoPai: paiEti ? "parentId" + paiEti : null,
        estagios, campos,
      };
     } catch (e) {
      // Sem o processo Membros, os outros não têm a quem se ligar: para tudo.
      if (p.chave === "membros") throw e;
      registrarFalha("processo " + p.nome, e);
     }
    }

    /* 5. solução automatizada "Gestão de Pessoas" (menu lateral) */
    const typeIds = schema.PROCESSOS.filter((p) => config.processos[p.chave]).map((p) => config.processos[p.chave].typeId);
    await tentar("solução automatizada " + schema.SOLUCAO, async () => {
      const solucoes = await listarTodos("crm.automatedsolution.list", {}, (d) => d && d.automatedSolutions);
      const solucao = solucoes.find((s) => s.title === schema.SOLUCAO);
      if (!solucao) {
        log("Criando a solução automatizada " + schema.SOLUCAO);
        const r = await chamar("crm.automatedsolution.add", { fields: { title: schema.SOLUCAO, typeIds } });
        config.solucaoId = r.dados && r.dados.automatedSolution ? r.dados.automatedSolution.id : null;
      } else {
        config.solucaoId = solucao.id;
        const atuais = (solucao.typeIds || []).map(String);
        const faltam = typeIds.filter((id) => atuais.indexOf(String(id)) < 0);
        if (faltam.length) {
          log("Incluindo " + faltam.length + " processo(s) na solução automatizada");
          await chamar("crm.automatedsolution.update", { id: solucao.id, fields: { typeIds: atuais.concat(faltam.map(String)) } });
        }
      }
      return true;
    });

    if (falhas.length) log("\n" + falhas.length + " item(ns) não foram criados. Rode de novo para tentar completar; o que já existe não é recriado.");
    return { config, relatorio, falhas };
  }

  return { provisionar, payloadCampo, codigoDoEstagio, TIPO_UF };
});
