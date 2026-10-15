const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const { provisionar } = require("../src/js/30-provision.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

const escritas = (rel) => rel.filter((r) => !r.simulado).length;

test("portal vazio: cria os 9 processos, estágios, campos e a solução automatizada", async () => {
  const bx = criarBitrixFalso({ tiposIniciais: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }] });
  const { config } = await provisionar({ chamar: bx.chamar });

  assert.equal(bx.estado.tipos.length, 1 + schema.PROCESSOS.length);
  const membros = config.processos.membros;
  // filhos do Membros ligados por relação nativa
  for (const chave of ["feedbacks", "ciclo", "planos", "encerramentos", "onboarding", "leituras"]) {
    const t = bx.estado.tipos.find((x) => x.entityTypeId === config.processos[chave].entityTypeId);
    assert.deepEqual(t.relations.parent, [{ entityTypeId: membros.entityTypeId, isChildrenListEnabled: "Y" }]);
    assert.equal(config.processos[chave].campoPai, "parentId" + membros.entityTypeId);
  }
  // finalistas ficam ligados ao negócio (vaga)
  assert.equal(config.processos.finalistas.campoPai, "parentId2");
  // sem permissão aberta
  const add = bx.estado.chamadas.filter((c) => c.metodo === "crm.type.add");
  assert.ok(add.every((c) => c.params.fields.isSetOpenPermissions === "N"));

  // estágios: exatamente os do esquema, na ordem, com os padrões descartáveis apagados
  const ciclo = schema.processo("ciclo");
  const stEntity = "DYNAMIC_" + config.processos.ciclo.entityTypeId + "_STAGE_" + config.processos.ciclo.categoriaId;
  const nomes = bx.estado.status.filter((s) => s.ENTITY_ID === stEntity).sort((a, b) => a.SORT - b.SORT).map((s) => s.NAME);
  assert.deepEqual(nomes, ciclo.estagios.map((e) => e.nome));
  assert.match(config.processos.ciclo.estagios.SEM_AGENDA, /^DT\d+_\d+:SEM_AGENDA$/);

  // campos: um por definição, com código camelCase
  const total = schema.PROCESSOS.reduce((s, p) => s + p.campos.length, 0);
  assert.equal(bx.estado.campos.length, total);
  const t = config.processos.membros.typeId;
  assert.equal(config.processos.membros.campos.ingresso, "ufCrm" + t + "DataIngresso");
  const lista = bx.estado.campos.find((f) => f.fieldName === "UF_CRM_" + t + "_SENIORIDADE");
  assert.equal(lista.userTypeId, "enumeration");
  assert.deepEqual(lista.enum.map((e) => e.value), ["Estagiário", "Júnior", "Pleno", "Sênior"]);

  // solução automatizada com todos os processos
  assert.equal(bx.estado.solucoes.length, 1);
  assert.equal(bx.estado.solucoes[0].typeIds.length, schema.PROCESSOS.length);
});

test("segunda execução não escreve nada (idempotente)", async () => {
  const bx = criarBitrixFalso();
  const primeira = await provisionar({ chamar: bx.chamar });
  const segunda = await provisionar({ chamar: bx.chamar, configAtual: primeira.config });
  assert.equal(escritas(segunda.relatorio), 0);
  assert.deepEqual(segunda.config.processos, primeira.config.processos);
});

test("completa o que falta: campo apagado e estágio renomeado voltam", async () => {
  const bx = criarBitrixFalso();
  const { config } = await provisionar({ chamar: bx.chamar });
  const t = config.processos.planos.typeId;
  bx.estado.campos = bx.estado.campos.filter((f) => f.fieldName !== "UF_CRM_" + t + "_APOIO");
  const st = bx.estado.status.find((s) => s.STATUS_ID === config.processos.planos.estagios.CHECKIN_ATRASO);
  st.NAME = "nome errado";
  const r = await provisionar({ chamar: bx.chamar, configAtual: config });
  assert.deepEqual(r.relatorio.map((x) => x.metodo).sort(), ["crm.status.update", "userfieldconfig.add"]);
  assert.equal(st.NAME, "Check-in atrasado");
});

test("simulação não altera o portal e lista o que seria feito", async () => {
  const bx = criarBitrixFalso();
  const r = await provisionar({ chamar: bx.chamar, simular: true });
  assert.equal(bx.estado.tipos.length, 0);
  assert.equal(bx.estado.campos.length, 0);
  assert.ok(r.relatorio.length > 0 && r.relatorio.every((x) => x.simulado));
  assert.equal(r.relatorio.filter((x) => x.metodo === "crm.type.add").length, schema.PROCESSOS.length);
  assert.equal(r.relatorio.filter((x) => x.metodo === "userfieldconfig.add").length,
    schema.PROCESSOS.reduce((s, p) => s + p.campos.length, 0));
});

test("sem escopo userfieldconfig, o erro aparece (não é engolido)", async () => {
  const bx = criarBitrixFalso({ semEscopoCampos: true });
  await assert.rejects(provisionar({ chamar: bx.chamar }), /insufficient_scope/);
});

test("códigos camelCase iguais aos do portal", () => {
  assert.equal(schema.camelDoCampo("UF_CRM_41_VENCIMENTO_LEGAL"), "ufCrm41VencimentoLegal");
  assert.equal(schema.codigoCampo(41, "COMB_1_TEXTO"), "ufCrm41Comb1Texto");
  // sufixos únicos por processo
  for (const p of schema.PROCESSOS) {
    const s = p.campos.map((c) => c.sufixo);
    assert.equal(new Set(s).size, s.length, "sufixo repetido em " + p.chave);
    const k = p.campos.map((c) => c.chave);
    assert.equal(new Set(k).size, k.length, "chave repetida em " + p.chave);
  }
});
