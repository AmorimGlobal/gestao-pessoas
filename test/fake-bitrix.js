// Bitrix24 em memória, só com os métodos que o provisionamento usa.
// Responde no mesmo formato da API (result/next), via chamar(metodo, params) -> {dados, proximo}.
function criarBitrixFalso(opcoes) {
  const o = opcoes || {};
  const estado = {
    tipos: (o.tiposIniciais || []).map((t) => Object.assign({ relations: { parent: [], child: [] } }, t)),
    categorias: {}, // eti -> [{id, isDefault}]
    status: [],     // {ID, ENTITY_ID, STATUS_ID, NAME, COLOR, SORT}
    campos: [],     // {entityId, fieldName, ...}
    solucoes: [],
    chamadas: [],
  };
  let proxTipo = 50, proxEti = 1200, proxCat = 300, proxStatus = 1, proxSol = 10;

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
        estado.campos.push(Object.assign({}, params.field));
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
      default:
        throw new Error("método não simulado: " + metodo);
    }
  }
  return { chamar, estado };
}
module.exports = { criarBitrixFalso };
