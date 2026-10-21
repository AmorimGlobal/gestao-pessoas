// Bitrix24 em memória: os métodos do provisionamento e, por cima da estrutura criada por ele,
// itens (crm.item.*), comentários, avisos, usuários e departamentos.
// Responde no mesmo formato da API (result/next), via chamar(metodo, params) -> {dados, proximo}.
const { camelDoCampo } = require("../src/js/20-schema.js");

function criarBitrixFalso(opcoes) {
  const o = opcoes || {};
  const estado = {
    tipos: (o.tiposIniciais || []).map((t) => Object.assign({ relations: { parent: [], child: [] } }, t)),
    categorias: {}, // eti -> [{id, isDefault}]
    status: [],     // {ID, ENTITY_ID, STATUS_ID, NAME, COLOR, SORT}
    campos: [],     // {entityId, fieldName, ...}
    solucoes: [],
    chamadas: [],
    itens: {},       // eti -> [item no formato do crm.item.get]
    comentarios: [], // {ENTITY_TYPE, ENTITY_ID, COMMENT}
    avisos: [],      // {USER_ID, MESSAGE}
    usuarios: o.usuarios || [],         // formato do user.get
    departamentos: o.departamentos || [], // formato do department.get
    agora: o.agora || "2026-10-08T10:00:00-03:00",
  };
  let proxTipo = 50, proxEti = 1200, proxCat = 300, proxStatus = 1, proxSol = 10, proxEnum = 9000, proxItem = 500;

  const tipoPorEti = (eti) => estado.tipos.find((t) => String(t.entityTypeId) === String(eti));
  /** filtro simples do crm.item.list: igualdade (lista = "um destes"), com ou sem "=" na frente */
  function confere(it, filtro) {
    return Object.keys(filtro || {}).every((k) => {
      const v = filtro[k], atual = it[k.replace(/^=/, "")];
      return Array.isArray(v) ? v.map(String).indexOf(String(atual)) >= 0 : String(atual) === String(v);
    });
  }

  function paginar(lista, params) {
    const start = Number(params.start || 0);
    const pagina = lista.slice(start, start + 50);
    return { pagina, proximo: start + 50 < lista.length ? start + 50 : null };
  }

  async function chamar(metodo, params) {
    params = params || {};
    estado.chamadas.push({ metodo, params });
    // o.falharSe(metodo, params) -> mensagem de erro para simular uma recusa da API
    const recusa = o.falharSe && o.falharSe(metodo, params);
    if (recusa) throw new Error(metodo + ": " + recusa);
    switch (metodo) {
      case "crm.type.list": {
        // como no portal real: a listagem NÃO traz as ligações (relations); crm.type.get traz
        const { pagina, proximo } = paginar(estado.tipos.map((t) => Object.assign({}, t, { relations: undefined })), params);
        return { dados: { types: pagina }, proximo };
      }
      case "crm.type.get": {
        const t = estado.tipos.find((x) => String(x.id) === String(params.id));
        if (!t) throw new Error("tipo não encontrado");
        return { dados: { type: t }, proximo: null };
      }
      case "crm.type.add": {
        const f = params.fields;
        const t = { id: proxTipo++, entityTypeId: proxEti, title: f.title,
          relations: { parent: (f.relations.parent || []).map((r) => Object.assign({}, r, { isChildrenListEnabled: "N", isPredefined: "N" })), child: [{ entityTypeId: 39, isChildrenListEnabled: "Y", isPredefined: "Y" }] } };
        proxEti += 2;
        estado.tipos.push(t);
        const cat = { id: proxCat++, isDefault: "Y" };
        estado.categorias[t.entityTypeId] = [cat];
        ["NEW", "PREPARATION", "CLIENT", "SUCCESS", "FAIL"].forEach((cod, i) => estado.status.push({
          ID: proxStatus++, ENTITY_ID: "DYNAMIC_" + t.entityTypeId + "_STAGE_" + cat.id,
          STATUS_ID: "DT" + t.entityTypeId + "_" + cat.id + ":" + cod, NAME: cod, COLOR: "#000000", SORT: (i + 1) * 10,
          SEMANTICS: cod === "SUCCESS" ? "S" : cod === "FAIL" ? "F" : null,
        }));
        return { dados: { type: t }, proximo: null };
      }
      case "crm.type.update": {
        const t = estado.tipos.find((x) => x.id === params.id);
        estado.atualizacoesDeTipo = (estado.atualizacoesDeTipo || 0) + 1;
        if (params.fields.relations) t.relations = params.fields.relations;
        return { dados: { type: t }, proximo: null };
      }
      case "crm.category.list":
        return { dados: { categories: estado.categorias[params.entityTypeId] || [] }, proximo: null };
      case "crm.status.list": {
        const lista = estado.status.filter((s) => s.ENTITY_ID === params.filter.ENTITY_ID).sort((a, b) => a.SORT - b.SORT);
        return { dados: lista, proximo: null };
      }
      case "crm.status.add": {
        const final = estado.status.find((x) => x.ENTITY_ID === params.fields.ENTITY_ID && x.SEMANTICS === "S");
        if (final && Number(params.fields.SORT) >= Number(final.SORT)) {
          throw new Error("crm.status.add: Não é possível criar mais etapas após a etapa final porque a etapa final bem-sucedida já existe.");
        }
        const s = Object.assign({ ID: proxStatus++ }, params.fields);
        estado.status.push(s);
        return { dados: s.ID, proximo: null };
      }
      case "crm.status.update": {
        Object.assign(estado.status.find((s) => s.ID === params.id), params.fields);
        return { dados: true, proximo: null };
      }
      case "crm.status.delete":
        estado.status = estado.status.filter((s) => s.ID !== params.id);
        return { dados: true, proximo: null };
      case "userfieldconfig.list": {
        const lista = estado.campos.filter((f) => f.entityId === params.filter.entityId);
        const { pagina, proximo } = paginar(lista, params);
        return { dados: { fields: pagina }, proximo };
      }
      case "userfieldconfig.add":
        if (o.semEscopoCampos) throw new Error("insufficient_scope");
        estado.campos.push(Object.assign({}, params.field, params.field.enum ? { enum: params.field.enum.map((e) => Object.assign({ id: proxEnum++ }, e)) } : {}));
        return { dados: { field: params.field }, proximo: null };
      case "crm.automatedsolution.list":
        return { dados: { automatedSolutions: estado.solucoes }, proximo: null };
      case "crm.automatedsolution.add": {
        const s = { id: proxSol++, title: params.fields.title, typeIds: params.fields.typeIds.slice() };
        estado.solucoes.push(s);
        return { dados: { automatedSolution: s }, proximo: null };
      }
      case "crm.automatedsolution.update": {
        Object.assign(estado.solucoes.find((s) => s.id === params.id), params.fields);
        return { dados: true, proximo: null };
      }
      /* ---------- itens ---------- */
      case "crm.item.fields": {
        const t = tipoPorEti(params.entityTypeId);
        const fields = {};
        estado.campos.filter((f) => t && f.entityId === "CRM_" + t.id).forEach((f) => {
          fields[camelDoCampo(f.fieldName)] = Object.assign({ type: f.userTypeId, isMultiple: f.multiple === "Y", upperName: f.fieldName },
            f.enum ? { items: f.enum.map((e) => ({ ID: String(e.id), VALUE: e.value })) } : {});
        });
        return { dados: { fields }, proximo: null };
      }
      case "crm.item.list": {
        const lista = (estado.itens[params.entityTypeId] || []).filter((it) => confere(it, params.filter));
        const { pagina, proximo } = paginar(lista, params);
        return { dados: { items: pagina.map((x) => Object.assign({}, x)) }, proximo };
      }
      case "crm.item.get": {
        const it = (estado.itens[params.entityTypeId] || []).find((x) => String(x.id) === String(params.id));
        if (!it) throw new Error("crm.item.get: NOT_FOUND");
        return { dados: { item: Object.assign({}, it) }, proximo: null };
      }
      case "crm.item.add": {
        const t = tipoPorEti(params.entityTypeId);
        const cat = estado.categorias[params.entityTypeId][0];
        const primeiro = estado.status.filter((x) => x.ENTITY_ID === "DYNAMIC_" + t.entityTypeId + "_STAGE_" + cat.id).sort((a, b) => a.SORT - b.SORT)[0];
        const it = Object.assign({ id: proxItem++, stageId: primeiro.STATUS_ID, createdBy: o.autorPadrao || 1, createdTime: estado.agora, updatedTime: estado.agora, movedTime: estado.agora }, params.fields);
        (estado.itens[params.entityTypeId] = estado.itens[params.entityTypeId] || []).push(it);
        return { dados: { item: Object.assign({}, it) }, proximo: null };
      }
      case "crm.item.update": {
        const it = (estado.itens[params.entityTypeId] || []).find((x) => String(x.id) === String(params.id));
        if (!it) throw new Error("crm.item.update: NOT_FOUND");
        if (params.fields.stageId && params.fields.stageId !== it.stageId) it.movedTime = estado.agora;
        Object.assign(it, params.fields, { updatedTime: estado.agora });
        return { dados: { item: Object.assign({}, it) }, proximo: null };
      }
      case "crm.timeline.comment.add":
        estado.comentarios.push(Object.assign({}, params.fields));
        return { dados: estado.comentarios.length, proximo: null };
      case "im.notify.system.add":
        estado.avisos.push({ USER_ID: params.USER_ID, MESSAGE: params.MESSAGE });
        return { dados: estado.avisos.length, proximo: null };
      case "user.get": {
        const F = Object.assign({}, params.FILTER || {}, params.ID !== undefined ? { ID: params.ID } : {});
        const lista = estado.usuarios.filter((u) => (!F.ACTIVE || u.ACTIVE !== false) && (F.ID === undefined || String(u.ID) === String(F.ID)));
        const { pagina, proximo } = paginar(lista, params);
        return { dados: pagina, proximo };
      }
      case "department.get":
        return { dados: estado.departamentos, proximo: null };
      default:
        throw new Error("método não simulado: " + metodo);
    }
  }
  return { chamar, estado };
}
module.exports = { criarBitrixFalso };
