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
const { criarChamadaWebhook, listarTudo, hojeSaoPaulo, usuarioDoBitrix, departamentoDoBitrix } = require("./bitrix-servidor.js");


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
  const usuarios = usuariosBrutos.map(usuarioDoBitrix);
  const departamentos = deptosBrutos.map(departamentoDoBitrix);
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

module.exports = { criarChamadaWebhook, carregarEstrutura, carregarDados, criarOps, sincronizar, hojeSaoPaulo };
