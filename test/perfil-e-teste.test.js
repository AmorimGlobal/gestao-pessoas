// 18/11/2026, pedidos do usuário:
//  - o ciclo de teste da Revisão de Progresso: só as pessoas escolhidas participam, avisam e entram na 360°
//    (src/js/58-revisao.js e lib/revisao360.js);
//  - o Perfil do membro com os próprios feedbacks SCI e o próprio alinhamento semanal, lidos pelo servidor
//    (lib/perfil-membro.js e api/membro.js, o: "perfil").
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/js/58-revisao.js");
const dom = require("../src/js/50-dominio.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const { gravar360 } = require("../lib/revisao360.js");
const handler = require("../api/membro.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

/* A mesma estrutura do teste da 360° (CEO > Helena > Rafael, supervisão de SDR > Beatriz, Caio), com o Membros */
function contexto(regrasTeste) {
  const U = (id, nome, deptos, cargo) => ({ id, nome, departamentos: deptos, cargo: cargo || "", tipo: "employee" });
  const M = (id, resp, lid) => ({ id, responsavel: resp, lideranca: lid, coordenacao: lid, estagio: "ATIVO", cargoMatriz: "C05" });
  const ciclo = { id: "900", ciclo: "Teste · 18/11/2026", estagio: "ABERTO", dataAbertura: "2026-11-18", prazoAuto: "2026-11-19",
    regras: JSON.stringify(Object.assign({ publico: "pessoas", pessoas: ["m3", "m4"], teste: true, liberarLideranca: true, liberarPares: true }, regrasTeste || {})) };
  return dom.indexar({
    hoje: "2026-11-18", eu: { id: "8" }, config: { papeis: { ceo: [{ id: "1" }], rh: [{ id: "8" }] } },
    usuarios: [U("1", "CEO", ["1"], "CEO"), U("2", "Helena Prado", ["10"], "Coordenação Comercial"), U("3", "Rafael Lima", ["11"], "Supervisão de SDR"),
      U("4", "Beatriz Nogueira", ["11"], "SDR"), U("5", "Caio Martins", ["11"], "SDR"), U("8", "Rita RH", ["30"], "RH")],
    departamentos: [{ id: "1", nome: "Amorim", pai: "", chefe: "1" }, { id: "10", nome: "Comercial", pai: "1", chefe: "2" },
      { id: "11", nome: "SDR", pai: "10", chefe: "3" }, { id: "30", nome: "RH", pai: "1", chefe: "8" }],
    registros: { membros: [M("m2", "2", "1"), M("m3", "3", "2"), M("m4", "4", "3"), M("m5", "5", "3")], revCiclos: [ciclo] },
  });
}

test("ciclo de teste: só as pessoas escolhidas participam, sem as conferências e com mínimo 1 nos relatórios", () => {
  const ctx = contexto();
  const ciclo = R.cicloAberto(ctx);
  assert.equal(R.ehTeste(ciclo), true);
  assert.equal(R.ehTeste({ regras: JSON.stringify({ publico: "todos" }) }), false);
  const r = R.regrasDo(ciclo);
  assert.equal(r.minimoNotas, 1);
  assert.equal(r.minimoComentarios, 1);
  assert.equal(R.podeAbrir(r).ok, true, "o teste é o que serve para conferir");
  assert.equal(R.podeAbrir(R.regrasDo(null)).ok, false, "o ciclo de verdade continua pedindo as conferências");
  assert.equal(R.participa(ctx, ciclo, ctx.idx.membro.m4).ok, true);
  assert.match(R.participa(ctx, ciclo, ctx.idx.membro.m5).motivo, /teste/);
  assert.deepEqual(R.participantes(ctx, ciclo).filter((x) => x.ok).map((x) => x.m.id), ["m3", "m4"]);
});

test("ciclo de teste: a 360° e a avaliação ficam entre as pessoas do teste; quem está fora não avalia nem é avisado", () => {
  const ctx = contexto();
  const ciclo = R.cicloAberto(ctx);
  // fora do teste a regra continua a mesma de sempre
  assert.deepEqual(R.superioresDe(ctx, "4").map((x) => x.uid), ["3", "2"]);
  assert.deepEqual(R.paresDe(ctx, "4").map((x) => x.uid), ["5"]);
  // no teste: Helena (fora) não é superior de ninguém, e Caio (fora) não é par
  assert.deepEqual(R.superioresDe(ctx, "4", ciclo).map((x) => x.uid), ["3"]);
  assert.deepEqual(R.paresDe(ctx, "4", ciclo), []);
  assert.equal(R.relacaoCom(ctx, "4", "3", ciclo), "Superior");
  assert.equal(R.relacaoCom(ctx, "4", "5", ciclo), "");
  assert.equal(R.relacaoCom(ctx, "5", "3", ciclo), "", "quem está fora do teste não responde a 360°");
  assert.deepEqual(R.lideradosDe(ctx, "3", ciclo), ["4"]);
  assert.equal(R.avaliadoresPossiveis(ctx, "3", "Superior", ciclo), 1);
  // a avaliação da liderança: Rafael (no teste) avalia Beatriz; Helena (fora) não avalia Rafael
  assert.deepEqual(R.equipeNoCiclo(ctx, "3", ciclo).map((m) => m.id), ["m4"]);
  assert.deepEqual(R.equipeNoCiclo(ctx, "2", ciclo), []);
  // o sino: só quem está no teste
  assert.deepEqual(R.notificacoes(ctx, "2"), [], "a liderança de fora do teste não recebe nada");
  assert.deepEqual(R.notificacoes(ctx, "5"), []);
  assert.ok(R.notificacoes(ctx, "4").some((n) => /abriu a Revisão/.test(n.titulo)));
  assert.ok(R.notificacoes(ctx, "3").some((n) => /Avalie sua equipe/.test(n.titulo)));
});

test("ciclo de teste no servidor: a 360° de quem está fora do teste é recusada", async () => {
  const bx = criarBitrixFalso({
    autorPadrao: 77,
    usuarios: [{ ID: "1", NAME: "Bia", LAST_NAME: "CEO", UF_DEPARTMENT: [1] }, { ID: "2", NAME: "Helena", LAST_NAME: "Prado", UF_DEPARTMENT: [10] },
      { ID: "3", NAME: "Rafael", LAST_NAME: "Lima", UF_DEPARTMENT: [11] }, { ID: "4", NAME: "Beatriz", LAST_NAME: "Nogueira", UF_DEPARTMENT: [11] },
      { ID: "5", NAME: "Caio", LAST_NAME: "Martins", UF_DEPARTMENT: [11] }, { ID: "8", NAME: "Rita", LAST_NAME: "RH", UF_DEPARTMENT: [30] }],
    departamentos: [{ ID: "1", NAME: "Amorim", PARENT: "", UF_HEAD: "1" }, { ID: "10", NAME: "Comercial", PARENT: "1", UF_HEAD: "2" },
      { ID: "11", NAME: "SDR", PARENT: "10", UF_HEAD: "3" }, { ID: "30", NAME: "RH", PARENT: "1", UF_HEAD: "8" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["membros", "revCiclos", "rev360"]);
  const m3 = await portal.criar("membros", { titulo: "Rafael", responsavel: "3", lideranca: "2", estagio: "ATIVO", cargoMatriz: "C05" });
  const m4 = await portal.criar("membros", { titulo: "Beatriz", responsavel: "4", lideranca: "3", estagio: "ATIVO", cargoMatriz: "C05" });
  await portal.criar("membros", { titulo: "Caio", responsavel: "5", lideranca: "3", estagio: "ATIVO", cargoMatriz: "C05" });
  const ciclo = await portal.criar("revCiclos", { titulo: "Revisão · Teste", ciclo: "Teste · 18/11/2026", estagio: "ABERTO",
    regras: JSON.stringify({ publico: "pessoas", pessoas: [String(m3.id), String(m4.id)], teste: true, liberarLideranca: true, liberarPares: true }) });
  const env = { BITRIX_WEBHOOK_URL: "https://portal.exemplo/rest/77/segredo/", GP_AVISAR_IDS: "8", GP_CEO_IDS: "1" };
  const resp = { lid_1: "Concordo" };
  const ok = await gravar360({ chamar: bx.chamar, env, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "3", modo: "Anônima", respostas: resp } });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const fora = await gravar360({ chamar: bx.chamar, env, uid: "5", pedido: { cicloId: ciclo.id, avaliado: "3", modo: "Anônima", respostas: resp } });
  assert.equal(fora.ok, false);
  assert.equal(fora.status, 403);
  const acima = await gravar360({ chamar: bx.chamar, env, uid: "3", pedido: { cicloId: ciclo.id, avaliado: "2", modo: "Anônima", respostas: resp } });
  assert.equal(acima.status, 403, "Helena está fora do teste: Rafael não a avalia");
});

test("perfil: o servidor devolve só os feedbacks e as semanas da pessoa da sessão, sem os anulados nem a evidência", async () => {
  const bx = criarBitrixFalso({
    usuarios: [{ ID: "3", NAME: "Carla", LAST_NAME: "Mendes", UF_DEPARTMENT: [11] }, { ID: "100", NAME: "Ana", LAST_NAME: "Ribeiro", UF_DEPARTMENT: [11] },
      { ID: "101", NAME: "Bruno", LAST_NAME: "Teixeira", UF_DEPARTMENT: [11] }],
    departamentos: [{ ID: "10", NAME: "Soluções", PARENT: "", UF_HEAD: "" }, { ID: "11", NAME: "Imigração", PARENT: "10", UF_HEAD: "3" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["feedbacks", "semanal"]);
  const fb = (resp, data, tipo, estagio) => portal.criar("feedbacks", { titulo: "Feedback · " + resp, responsavel: resp, autor: "3", data, tipo, estagio,
    situacao: "Na reunião de " + data, comportamento: "Trouxe a proposta pronta", impacto: "A decisão saiu na hora", combinados: "", planoId: "55" });
  await fb("100", "2026-10-02", "Reconhecimento", "SUCCESS");
  await fb("100", "2026-11-10", "Desenvolvimento", "NEW");
  await fb("100", "2026-09-01", "Desenvolvimento", "FAIL");
  await fb("101", "2026-11-01", "Reconhecimento", "SUCCESS");
  const sem = (resp, semana, estagio) => portal.criar("semanal", { titulo: "Semana · " + resp, responsavel: resp, semana, estagio, papel: "Membro", respostas: "1. Como foi a semana?\nBoa", respondidas: 1 });
  await sem("100", "2026-11-07", "NEW");
  await sem("100", "2026-11-14", "SUCCESS");
  await sem("100", "2026-10-31", "FAIL");
  await sem("101", "2026-11-14", "NEW");

  const res = () => ({ statusCode: 0, cab: {}, corpo: "", setHeader(k, v) { this.cab[k] = v; }, end(x) { this.corpo = x; } });
  const env = { BITRIX_WEBHOOK_URL: "https://portal.exemplo/rest/1/x/" };
  const r1 = res();
  await handler({ method: "POST", body: { o: "perfil" } }, r1, { env, chamar: bx.chamar });
  assert.equal(r1.statusCode, 401, "sem o token do Bitrix");
  const r2 = res();
  await handler({ method: "POST", body: { auth: "tk", o: "perfil" } }, r2, { env, chamar: bx.chamar, usuarioDoToken: async () => "100" });
  assert.equal(r2.statusCode, 200, r2.corpo);
  const j = JSON.parse(r2.corpo);
  assert.deepEqual(j.feedbacks.map((f) => [f.data, f.tipo]), [["2026-11-10", "Desenvolvimento"], ["2026-10-02", "Reconhecimento"]], "os mais recentes primeiro, sem o anulado e sem o do Bruno");
  assert.equal(j.feedbacks[0].autor, "3");
  assert.equal(j.feedbacks[0].comportamento, "Trouxe a proposta pronta");
  assert.ok(!("planoId" in j.feedbacks[0]) && !("evidencia" in j.feedbacks[0]), "sem o vínculo com plano nem a evidência");
  assert.deepEqual(j.semanal.map((s) => s.semana), ["2026-11-14", "2026-11-07"]);
  assert.deepEqual(j.existe, { feedbacks: true, semanal: true });
  assert.ok(!/Bruno|101/.test(r2.corpo), "nada de outra pessoa");
  // a consulta das férias continua no mesmo endereço (o padrão, sem "o")
  const r3 = res();
  await handler({ method: "POST", body: { auth: "tk" } }, r3, { env, chamar: bx.chamar, usuarioDoToken: async () => "100", agora: new Date("2026-11-18T12:00:00Z") });
  assert.equal(r3.statusCode, 200, r3.corpo);
  assert.deepEqual(JSON.parse(r3.corpo), { ok: true, reservas: [] }, "sem \"o\", continua a consulta das férias da equipe");
});
