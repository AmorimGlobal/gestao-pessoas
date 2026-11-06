// Revisão de Progresso (protótipo do RH, 05/11/2026): a matriz dos cargos, as regras (src/js/58-revisao.js)
// e a gravação da 360° no servidor, sem autor (lib/revisao360.js e api/revisao360.js), contra um Bitrix falso.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/js/57-revisao-matriz.js");
const R = require("../src/js/58-revisao.js");
const dom = require("../src/js/50-dominio.js");
const demo = require("../src/js/45-demo.js");
const schema = require("../src/js/20-schema.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const { gravar360 } = require("../lib/revisao360.js");
const handler = require("../api/revisao360.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

function contextoDemo(uid) {
  const d = demo.dadosDemo();
  return dom.indexar({ hoje: "2026-10-08", eu: { id: uid || "3" }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros });
}

/* ---------------- matriz ---------------- */
test("matriz: os 40 cargos do protótipo, cada um com KPIs e competências completos, e o glossário de 32", () => {
  assert.equal(R.CODIGOS.length, 40);
  assert.equal(R.CODIGOS[0], "C01");
  assert.equal(R.CODIGOS[39], "C40");
  const n = (c) => M.CARGOS[c].kpis.length + "/" + M.CARGOS[c].competencias.length;
  assert.deepEqual([n("C01"), n("C04"), n("C05"), n("C06"), n("C36"), n("C38")], ["8/12", "5/7", "5/7", "5/7", "7/14", "9/12"]);
  R.CODIGOS.forEach((c) => {
    const C = M.CARGOS[c];
    assert.ok(C.kpis.length >= 3 && C.competencias.length >= 3, c);
    C.kpis.forEach((k, i) => assert.ok(k.indicador && k.meta && k.calculo && k.peso, c + " KPI " + (i + 1)));
    C.competencias.forEach((x, i) => assert.ok(x.nome && x.dimensao && [1, 2, 3, 4].indexOf(x.minimo) >= 0, c + " competência " + (i + 1)));
  });
  assert.equal(M.GLOSSARIO.length, 32);
  assert.deepEqual(M.NOMES_DO_PROTOTIPO, { C05: "SDR", C06: "Analista de Pós-vendas", C04: "Estágio em SDR" });
  // o nome dado pelo RH na Configuração vale mais que o do protótipo
  assert.equal(R.rotuloCargo({}, "C05"), "C05 · SDR");
  assert.equal(R.rotuloCargo({ revisao: { cargos: { C05: "SDR Pleno" } } }, "C05"), "C05 · SDR Pleno");
  assert.equal(R.rotuloCargo({}, "C10"), "C10 · sem nome");
  assert.equal(R.cargoDo({ cargoMatriz: " c06 " }), "C06");
  assert.equal(R.cargoDo({ cargoMatriz: "C99" }), "", "código fora da matriz");
});

test("esquema: as 5 tabelas da Revisão e o cargo no Membros, dentro do limite de nomes do Bitrix", () => {
  ["revCiclos", "revAvaliacoes", "revAutoavaliacoes", "rev360", "revRetornos"].forEach((k) => assert.ok(schema.processo(k), k));
  assert.equal(schema.processo("rev360").pai, null, "a resposta 360° não tem vínculo com o card de ninguém");
  assert.ok(!schema.processo("rev360").campos.some((c) => c.tipo === "pessoa" && c.chave === "autor"), "sem campo de autor na 360°");
  assert.ok(schema.processo("membros").campos.some((c) => c.chave === "cargoMatriz"));
});

/* ---------------- ciclo e participação ---------------- */
test("ciclo: regras padrão, conferências para abrir e quem participa", () => {
  const r = R.regrasDo(null);
  assert.equal(r.minimoNotas, 3);
  assert.equal(r.minimoComentarios, 5);
  assert.equal(r.abaixoMinimo, "juntar_area");
  assert.deepEqual(R.podeAbrir(r).faltam.length, 3);
  assert.equal(R.podeAbrir(Object.assign({}, r, { liberarLideranca: false, liberarPares: false, conferencias: { lista: true, matriz: true } })).ok, true, "sem 360°, a demonstração do anonimato não é exigida");

  const ctx = contextoDemo("6");
  const ciclo = R.cicloAberto(ctx);
  assert.equal(ciclo.id, "700");
  const part = (id, c) => R.participa(ctx, c || ciclo, ctx.idx.membro[id]);
  assert.equal(part("1").ok, true);
  assert.match(part("5").motivo, /encerramento/, "Fernanda está em encerramento");
  assert.match(part("7").motivo, /sem cargo/);
  const regras = (o) => ({ id: "x", regras: JSON.stringify(Object.assign({}, JSON.parse(ciclo.regras), o)) });
  assert.match(part("1", regras({ excluidos: ["1"] })).motivo, /exceção/);
  ctx.idx.membro["2"].contrato = "Estágio";
  assert.match(part("2", regras({ publico: "sem_estagio" })).motivo, /estágio/);
  assert.equal(part("1", regras({ publico: "selecionar", areas: ["10"] })).ok, true, "Imigração fica em Soluções (10)");
  assert.match(part("1", regras({ publico: "selecionar", areas: ["30"] })).motivo, /área/);
  assert.deepEqual(R.areas(ctx).map((a) => a.nome), ["Financeiro e RH", "Soluções"]);
});

/* ---------------- formulário da liderança ---------------- */
test("formulário: o que falta para enviar, os itens que não se aplicam, os novos e as evidências das perguntas de decisão", () => {
  const C = M.CARGOS.C05;
  const vazio = R.faltando(C, {});
  assert.equal(vazio.length, 5 * 2 + 7 * 2 + 3 + 2);
  const a = {};
  C.kpis.forEach((k, i) => { a["kpi_" + (i + 1) + "_nivel"] = "Alcança"; a["kpi_" + (i + 1) + "_evidencia"] = "CRM"; });
  C.competencias.forEach((x, i) => { a["comp_" + (i + 1) + "_nivel"] = "3"; a["comp_" + (i + 1) + "_evidencia"] = "SCI"; });
  Object.assign(a, { conclusao_geral: "ok", ponto_forte_1: "x", ponto_desenv_1: "y", decisao_equipe: "Concordo", decisao_risco: "Não" });
  assert.deepEqual(R.faltando(C, a), []);
  // não se aplica: o item sai da conta
  delete a.kpi_2_nivel; a.kpi_2_ajuste = "nao_se_aplica";
  assert.deepEqual(R.faltando(C, a), []);
  // item novo começado: precisa de nível e evidência
  a.kpi_extra_1_indicador = "NPS";
  assert.deepEqual(R.faltando(C, a), ["KPI novo 1: nível de entrega", "KPI novo 1: evidência"]);
  delete a.kpi_extra_1_indicador;
  // discordância e risco pedem evidência
  a.decisao_equipe = "Discordo"; a.decisao_risco = "Sim";
  assert.deepEqual(R.faltando(C, a), ["Evidência da discordância", "Evidência do risco de baixo desempenho"]);
});

test("situação frente ao mínimo e o registro dos ajustes para o RH", () => {
  assert.deepEqual(R.situacaoMinimo(2, 3), { texto: "abaixo do mínimo (3)", cor: "ambar" });
  assert.equal(R.situacaoMinimo(3, 3).texto, "no mínimo");
  assert.equal(R.situacaoMinimo(4, 3).texto, "acima do mínimo");
  assert.equal(R.situacaoMinimo("", 3), null);
  const C = M.CARGOS.C06;
  const aj = R.ajustes(C, { kpi_1_ajuste: "ajustar", kpi_1_aj_meta: "≥ 80%", kpi_1_aj_motivo: "carteira menor", comp_2_ajuste: "nao_se_aplica", comp_extra_1_nome: "Negociação" });
  assert.deepEqual(aj.map((x) => x.item), ["KPI 1", "Competência 2", "Competência nova 1"]);
  assert.equal(aj[0].ajustado, "meta: ≥ 80%");
  assert.equal(aj[0].motivo, "carteira menor");
  assert.equal(aj[1].ajustado, "Não se aplica neste ciclo");
});

test("registros do membro: a avaliação do ciclo, o rascunho de fora do ciclo e quem lê a autoavaliação", () => {
  const ctx = contextoDemo("3");
  const ciclo = R.cicloAberto(ctx);
  assert.equal(R.avaliacaoDo(ctx, "1", ciclo).id, "710");
  assert.equal(R.situacaoDo(ctx, ciclo, ctx.idx.membro["1"]).ciencia, false);
  assert.equal(R.situacaoDo(ctx, ciclo, ctx.idx.membro["6"]).avaliacao, "Sem rascunho");
  // rascunho feito antes do ciclo entra no ciclo aberto
  ctx.registros.revAvaliacoes.push({ id: "799", membroId: "6", cicloId: "", estagio: "NEW", avaliacao: "{}" });
  dom.indexar(ctx);
  assert.equal(R.avaliacaoDo(ctx, "6", ciclo).id, "799");
  assert.equal(R.situacaoDo(ctx, ciclo, ctx.idx.membro["6"]).avaliacao, "Rascunho pronto para o ciclo");
  // a liderança só lê a autoavaliação depois de enviar a própria avaliação
  assert.equal(R.avaliacaoEnviada(R.avaliacaoDo(ctx, "4", ciclo)), false, "Eduardo: rascunho");
  assert.equal(R.avaliacaoEnviada(R.avaliacaoDo(ctx, "3", ciclo)), true, "Daniela: enviada");
  assert.equal(R.autoavaliacaoDe(ctx, "100", ciclo).estagio, "SUCCESS");
  assert.equal(R.retornoDe(ctx, "100", ciclo).id, "730");
});

/* ---------------- 360°: quem avalia quem ---------------- */
function contextoSupervisao() {
  const U = (id, nome, deptos, cargo) => ({ id, nome, departamentos: deptos, cargo: cargo || "", tipo: "employee" });
  return dom.indexar({
    hoje: "2026-11-10", eu: { id: "1" }, config: { papeis: { ceo: [{ id: "1" }], excecoes: [{ id: "99" }] } },
    usuarios: [U("1", "CEO", ["1"], "CEO"), U("2", "Helena Prado", ["10"], "Coordenação Comercial"), U("3", "Rafael Lima", ["11"], "Supervisão de SDR"),
      U("4", "Beatriz Nogueira", ["11"], "SDR"), U("5", "Caio Martins", ["11"], "Analista de Pós-vendas"), U("6", "Diana Rocha", ["11"], "Estágio em SDR"),
      U("7", "Otto Souza", ["12"], "Liderança de Marketing"), U("99", "Prestador", ["11"], "Prestador")],
    departamentos: [{ id: "1", nome: "Amorim", pai: "", chefe: "1" }, { id: "10", nome: "Comercial", pai: "1", chefe: "2" },
      { id: "11", nome: "SDR e Pós-vendas", pai: "10", chefe: "3" }, { id: "12", nome: "Marketing", pai: "10", chefe: "7" }],
    registros: { membros: [{ id: "m6", responsavel: "6", estagio: "EM_ENCERRAMENTO" }] },
  });
}
test("360°: superiores (com a supervisão, quem está acima dela), pares e liderados, sem a CEO, sem quem está fora do app", () => {
  const ctx = contextoSupervisao();
  assert.deepEqual(R.superioresDe(ctx, "4"), [{ uid: "3", relacao: "Superior", papel: "superior imediato" }, { uid: "2", relacao: "Superior", papel: "superior da sua supervisão" }]);
  assert.deepEqual(R.paresDe(ctx, "4").map((x) => x.uid), ["5"], "Diana está em encerramento e o prestador está fora do app");
  assert.deepEqual(R.paresDe(ctx, "3").map((x) => x.uid), ["7"], "lideranças com o mesmo superior também são pares");
  assert.deepEqual(R.superioresDe(ctx, "2"), [], "a CEO não entra na 360°");
  assert.deepEqual(R.lideradosDe(ctx, "3"), ["4", "5"]);
  assert.equal(R.relacaoCom(ctx, "4", "2"), "Superior");
  assert.equal(R.relacaoCom(ctx, "4", "5"), "Par");
  assert.equal(R.relacaoCom(ctx, "4", "7"), "", "Marketing não é par de quem está em SDR");
  assert.equal(R.relacaoCom(ctx, "3", "4"), "", "liderado direto é a Revisão formal, não a 360°");
  assert.equal(R.avaliadoresPossiveis(ctx, "3", "Superior"), 2);
  assert.equal(R.grupoPequeno(ctx, "3", "Superior", { minimoNotas: 3 }), true);
  assert.equal(R.grupoPequeno(ctx, "2", "Superior", { minimoNotas: 3 }), false, "Helena: Rafael, Otto e quem está abaixo da supervisão");
});

test("360°: a resposta só com valores da escala e textos de tamanho razoável", () => {
  assert.deepEqual(R.validarResposta("Superior", { lid_1: "Concordo", lid_2: "Não sei avaliar", continuar: " ok " }), { ok: true, erros: [], respostas: { lid_1: "Concordo", lid_2: "Não sei avaliar", continuar: "ok" } });
  assert.equal(R.validarResposta("Superior", { lid_1: "Ótimo" }).ok, false);
  assert.equal(R.validarResposta("Par", { lid_1: "Concordo" }).ok, false, "afirmação da liderança numa resposta de par");
  assert.equal(R.validarResposta("Par", { par_1: "Concordo", exemplo: "x".repeat(4001) }).ok, false);
  assert.deepEqual(Object.keys(R.validarResposta("Par", { par_1: "Concordo", autor: "100", identificadoPor: "100" }).respostas), ["par_1"], "chaves estranhas não passam");
});

test("relatório 360°: só grupos com o mínimo; abaixo dele, junta na área ou fica de fora; comentários só com o mínimo próprio", () => {
  const ctx = contextoDemo("6");
  const ciclo = R.cicloAberto(ctx);
  const rel = R.relatorio360(ctx, ciclo);
  assert.equal(rel.total, 14);
  assert.deepEqual(rel.pessoas.map((p) => [p.nome, p.relacao, p.n, p.comComentarios]), [["Bruno Teixeira", "Par", 3, false], ["Carla Mendes", "Superior", 5, true]]);
  assert.equal(rel.pessoas[0].textos, null, "abaixo do mínimo de comentários, os textos nem chegam à tela");
  const carla = rel.pessoas[1];
  assert.equal(carla.itens[0].media, 3.4);
  assert.equal(carla.itens[4].n, 4, "\"Não sei avaliar\" não entra na média");
  assert.deepEqual(carla.textos.continuar, carla.textos.continuar.slice().sort((a, b) => a.localeCompare(b, "pt-BR")), "em ordem alfabética, não na ordem de chegada");
  assert.deepEqual(rel.areas.map((a) => [a.area, a.relacao, a.n]), [["Soluções", "Par", 4]], "Ana e Daniela (2 cada) juntas na área");
  assert.equal(rel.foraDoRelatorio, 2, "as 2 do Marcos não atingem o mínimo nem juntas na área");
  const semJuntar = R.relatorio360(ctx, Object.assign({}, ciclo, { regras: JSON.stringify(Object.assign(JSON.parse(ciclo.regras), { abaixoMinimo: "nao_usar" })) }));
  assert.deepEqual(semJuntar.areas, []);
  assert.equal(semJuntar.foraDoRelatorio, 6);
});

test("sino: abertura para quem participa, equipe a avaliar, devolutiva a fazer, ciência a confirmar e envio ao RH", () => {
  const ctx = contextoDemo("3");
  const t = (uid) => R.notificacoes(ctx, uid).map((n) => n.titulo);
  assert.deepEqual(t("3"), ["Avalie sua equipe na Revisão de Progresso", "Calibração concluída: faça a devolutiva de Bruno Teixeira"]);
  assert.deepEqual(t("100"), ["O RH abriu a Revisão de Progresso (Novembro 2026 · inaugural (anual))", "Sua liderança registrou a devolutiva: confirme a ciência"]);
  assert.deepEqual(t("6"), ["Avaliação enviada ao RH: Daniela Rocha"]);
  assert.deepEqual(t("110"), [], "sem cargo na matriz: fora do ciclo");
  // no sino do app, junto com os outros avisos
  const N = require("../src/js/54-notificacoes.js");
  assert.ok(N.notificacoesDe(ctx, "100").some((n) => n.area === "Revisão de Progresso"));
});

/* ---------------- servidor: a 360° gravada sem autor ---------------- */
async function portalRevisao(regras) {
  const bx = criarBitrixFalso({
    autorPadrao: 77, // o dono do webhook
    usuarios: [
      { ID: "1", NAME: "Bia", LAST_NAME: "CEO", UF_DEPARTMENT: [1] },
      { ID: "2", NAME: "Helena", LAST_NAME: "Prado", WORK_POSITION: "Coordenação Comercial", UF_DEPARTMENT: [10] },
      { ID: "3", NAME: "Rafael", LAST_NAME: "Lima", WORK_POSITION: "Supervisão de SDR", UF_DEPARTMENT: [11] },
      { ID: "4", NAME: "Beatriz", LAST_NAME: "Nogueira", UF_DEPARTMENT: [11] },
      { ID: "5", NAME: "Caio", LAST_NAME: "Martins", UF_DEPARTMENT: [11] },
      { ID: "8", NAME: "Rita", LAST_NAME: "RH", UF_DEPARTMENT: [30] },
    ],
    departamentos: [{ ID: "1", NAME: "Amorim", PARENT: "", UF_HEAD: "1" }, { ID: "10", NAME: "Comercial", PARENT: "1", UF_HEAD: "2" },
      { ID: "11", NAME: "SDR", PARENT: "10", UF_HEAD: "3" }, { ID: "30", NAME: "RH", PARENT: "1", UF_HEAD: "8" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["revCiclos", "rev360"]);
  const ciclo = await portal.criar("revCiclos", { titulo: "Revisão · Novembro 2026", ciclo: "Novembro 2026 · inaugural (anual)", estagio: "ABERTO",
    regras: JSON.stringify(Object.assign({ liberarLideranca: true, liberarPares: true, minimoNotas: 3 }, regras || {})) });
  return { bx, portal, ciclo };
}
const ENV = { BITRIX_WEBHOOK_URL: "https://portal.exemplo/rest/77/segredo/", GP_AVISAR_IDS: "8", GP_CEO_IDS: "1" };

test("servidor: a resposta anônima é gravada pelo webhook, sem quem respondeu; a identificada leva o nome só no campo do RH", async () => {
  const { bx, portal, ciclo } = await portalRevisao();
  const r = await gravar360({ chamar: bx.chamar, env: ENV, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "3", modo: "Anônima", respostas: { lid_1: "Concordo", lid_9: "x", continuar: "Os feedbacks." } } });
  assert.deepEqual(r, { ok: true, status: 200 });
  const r2 = await gravar360({ chamar: bx.chamar, env: ENV, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "5", modo: "Identificada", respostas: { par_1: "Concordo totalmente" } } });
  assert.equal(r2.ok, true);
  const itens = await portal.listar("rev360");
  assert.equal(itens.length, 2);
  const [anon, ident] = itens;
  assert.equal(anon.criadoPor, "77", "autor = o dono do webhook, nunca quem respondeu");
  assert.equal(anon.responsavel, "8", "responsável = o RH");
  assert.equal(anon.identificadoPor, "");
  assert.equal(anon.relacao, "Superior");
  assert.equal(anon.avaliado, "3");
  assert.equal(anon.area, "Comercial");
  assert.deepEqual(JSON.parse(anon.respostas), { lid_1: "Concordo", continuar: "Os feedbacks." }, "só as chaves da escala e os textos");
  // o item cru no Bitrix: nenhum campo com o ID de quem respondeu (4)
  const cru = Object.values(bx.estado.itens).flat().find((x) => String(x.id) === anon.id);
  assert.ok(Object.keys(cru).every((k) => String(cru[k]) !== "4"), "o ID de quem respondeu anonimamente não está no item: " + JSON.stringify(cru));
  assert.equal(ident.identificadoPor, "4");
  assert.equal(ident.relacao, "Par");
  assert.equal(ident.modo, "Identificada");
  assert.equal(bx.estado.comentarios.length, 0);
});

test("servidor: recusa ciclo fechado, 360° não liberada, quem não tem relação, a própria pessoa e valores fora da escala", async () => {
  const { bx, portal, ciclo } = await portalRevisao({ liberarPares: false });
  const enviar = (uid, avaliado, respostas, cicloId) => gravar360({ chamar: bx.chamar, env: ENV, uid, pedido: { cicloId: cicloId || ciclo.id, avaliado, modo: "Anônima", respostas: respostas || { lid_1: "Concordo" } } });
  assert.equal((await enviar("4", "5", { par_1: "Concordo" })).status, 403, "pares não liberados neste ciclo");
  assert.equal((await enviar("4", "8")).status, 403, "o RH não é superior de quem está em SDR");
  assert.equal((await enviar("3", "4")).status, 403, "liderado direto é a Revisão formal");
  assert.equal((await enviar("2", "1")).status, 403, "a CEO não entra na 360°");
  assert.equal((await enviar("4", "4")).status, 400);
  assert.equal((await enviar("4", "3", { lid_1: "Ótimo" })).status, 400);
  await portal.atualizar("revCiclos", ciclo.id, { estagio: "SUCCESS" });
  assert.equal((await enviar("4", "3")).status, 409, "ciclo encerrado");
  assert.equal((await portal.listar("rev360")).length, 0);
});

test("rota /api/revisao360: POST com o token do Bitrix; sem token, 401; o erro do Bitrix não vai para a resposta", async () => {
  const { bx, ciclo } = await portalRevisao();
  const res = () => ({ statusCode: 0, cab: {}, corpo: "", setHeader(k, v) { this.cab[k] = v; }, end(x) { this.corpo = x; } });
  const r1 = res();
  await handler({ method: "POST", body: { cicloId: ciclo.id, avaliado: "3" } }, r1, { env: ENV, chamar: bx.chamar });
  assert.equal(r1.statusCode, 401);
  const r2 = res();
  await handler({ method: "POST", body: { auth: "tk", cicloId: ciclo.id, avaliado: "3", modo: "Anônima", respostas: { lid_2: "Discordo" } } }, r2,
    { env: ENV, chamar: bx.chamar, usuarioDoToken: async () => "4" });
  assert.equal(r2.statusCode, 200, r2.corpo);
  assert.deepEqual(JSON.parse(r2.corpo), { ok: true });
  assert.equal(r2.cab["Cache-Control"], "no-store");
  const r3 = res();
  const original = console.error;
  const logs = [];
  console.error = (...a) => logs.push(a.join(" "));
  try {
    await handler({ method: "POST", body: { auth: "tk", cicloId: ciclo.id, avaliado: "3", modo: "Anônima", respostas: { lid_2: "Discordo" } } }, r3,
      { env: ENV, chamar: async () => { throw new Error("crm.type.list: QUERY_LIMIT"); }, usuarioDoToken: async () => "4" });
  } finally { console.error = original; }
  assert.equal(r3.statusCode, 502);
  assert.equal(logs.length, 1);
  assert.ok(!/4/.test(logs[0]), "o log não diz quem respondeu: " + logs[0]);
  const r4 = res();
  await handler({ method: "GET" }, r4, { env: ENV });
  assert.equal(r4.statusCode, 405);
});
