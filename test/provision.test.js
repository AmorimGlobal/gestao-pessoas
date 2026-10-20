const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const { provisionar, codigoDoEstagio: provisionCodigo } = require("../src/js/30-provision.js");
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
    assert.deepEqual(t.relations.parent.map((r) => r.entityTypeId), [membros.entityTypeId]);
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

/* ---------- falhas pontuais não derrubam o resto (a API real pode recusar algo) ---------- */
const totalCampos = schema.PROCESSOS.reduce((s, p) => s + p.campos.length, 0);

test("estágio padrão que não pode ser apagado: registra e segue", async () => {
  const bx = criarBitrixFalso({ falharSe: (m) => m === "crm.status.delete" && "estágio do sistema" });
  const r = await provisionar({ chamar: bx.chamar });
  assert.equal(r.falhas.length, schema.PROCESSOS.length * 2); // PREPARATION e CLIENT de cada processo
  assert.equal(bx.estado.campos.length, totalCampos);
  assert.equal(Object.keys(r.config.processos).length, schema.PROCESSOS.length);
  assert.equal(bx.estado.solucoes.length, 1);
});

test("campo recusado: os outros são criados e a segunda execução completa", async () => {
  let recusar = true;
  const bx = criarBitrixFalso({ falharSe: (m, p) => recusar && m === "userfieldconfig.add" && p.field.userTypeId === "double" && "tipo inválido" });
  const r1 = await provisionar({ chamar: bx.chamar });
  const numericos = schema.PROCESSOS.reduce((s, p) => s + p.campos.filter((c) => c.tipo === "numero").length, 0);
  assert.ok(numericos > 0);
  assert.equal(r1.falhas.length, numericos);
  assert.equal(bx.estado.campos.length, totalCampos - numericos);
  recusar = false;
  const r2 = await provisionar({ chamar: bx.chamar, configAtual: r1.config });
  assert.equal(r2.falhas.length, 0);
  assert.equal(bx.estado.campos.length, totalCampos);
  assert.equal(r2.relatorio.filter((x) => x.metodo === "userfieldconfig.add").length, numericos);
});

test("processo filho recusado: os demais seguem; Membros recusado: para tudo", async () => {
  const bx = criarBitrixFalso({ falharSe: (m, p) => m === "crm.type.add" && /Onboarding/.test(p.fields.title) && "limite de processos" });
  const r = await provisionar({ chamar: bx.chamar });
  assert.equal(r.falhas.length, 1);
  assert.ok(!r.config.processos.onboarding);
  assert.equal(Object.keys(r.config.processos).length, schema.PROCESSOS.length - 1);
  const bx2 = criarBitrixFalso({ falharSe: (m, p) => m === "crm.type.add" && /Membros/.test(p.fields.title) && "limite de processos" });
  await assert.rejects(provisionar({ chamar: bx2.chamar }), /limite de processos/);
});

test("falta de permissão no meio para tudo na hora (não vira 157 falhas)", async () => {
  const bx = criarBitrixFalso({ falharSe: (m) => m === "userfieldconfig.add" && "ACCESS_DENIED" });
  await assert.rejects(provisionar({ chamar: bx.chamar }), /ACCESS_DENIED/);
  assert.equal(bx.estado.chamadas.filter((c) => c.metodo === "userfieldconfig.add").length, 1);
});

test("estado do portal em 21/10: rodar de novo completa estágios e campo sem regravar as ligações", async () => {
  const bx = criarBitrixFalso();
  const { config } = await provisionar({ chamar: bx.chamar });
  // como ficou no portal: estágios do meio recusados e o campo Cidade não criado
  const sem = ["REALIZADO", "EVID_ATRASO", "ENC_PENDENTE", "ENC_ATRASO", "ENVIADA_RH", "EM_ANALISE", "APROVADA", "CONVERSA_OK", "POS", "MAR_ABERTO"];
  bx.estado.status = bx.estado.status.filter((s) => sem.indexOf(provisionCodigo(s.STATUS_ID)) < 0);
  const tM = config.processos.membros.typeId;
  bx.estado.campos = bx.estado.campos.filter((f) => f.fieldName !== "UF_CRM_" + tM + "_CIDADE_REF");
  bx.estado.atualizacoesDeTipo = 0;
  const r = await provisionar({ chamar: bx.chamar, configAtual: config });
  assert.deepEqual(r.falhas, []);
  assert.equal(r.relatorio.filter((x) => x.metodo === "crm.status.add").length, sem.length);
  assert.equal(r.relatorio.filter((x) => x.metodo === "userfieldconfig.add").length, 1);
  assert.equal(bx.estado.atualizacoesDeTipo, 0, "as ligações já existiam: nenhum crm.type.update");
  // a ligação predefinida (39) continua lá
  const fb = bx.estado.tipos.find((t) => t.entityTypeId === config.processos.feedbacks.entityTypeId);
  assert.ok(fb.relations.child.some((c) => c.entityTypeId === 39));
  // e a ordem final bate com o esquema
  const ent = "DYNAMIC_" + config.processos.ciclo.entityTypeId + "_STAGE_" + config.processos.ciclo.categoriaId;
  assert.deepEqual(bx.estado.status.filter((s) => s.ENTITY_ID === ent).sort((a, b) => a.SORT - b.SORT).map((s) => provisionCodigo(s.STATUS_ID)),
    schema.processo("ciclo").estagios.map((e) => e.codigo));
});

test("opções de lista vão com xmlId explícito e único", () => {
  const { payloadCampo } = require("../src/js/30-provision.js");
  const campo = schema.processo("membros").campos.find((c) => c.chave === "cidade");
  const p = payloadCampo(57, campo, 7);
  assert.deepEqual(p.field.enum.map((e) => e.xmlId), ["SAO_PAULO_SP_1", "SALVADOR_BA_2"]);
  for (const proc of schema.PROCESSOS) for (const c of proc.campos.filter((x) => x.tipo === "lista")) {
    const ids = payloadCampo(1, c, 0).field.enum.map((e) => e.xmlId);
    assert.equal(new Set(ids).size, ids.length, c.chave);
    ids.forEach((id) => assert.match(id, /^[A-Z0-9_]{1,45}$/));
  }
});
