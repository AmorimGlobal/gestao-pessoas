// Revisões semanais (04/11/2026): o alinhamento pelo WhatsApp (app-gestao-semanal) guardado no card do membro.
// Funções puras (src/js/56-semanal.js), a importação no servidor (lib/semanal-servidor.js) contra um Bitrix falso
// e um app semanal falso, e a rota do botão "Buscar agora" (api/semanal.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/js/56-semanal.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const { importarSemanal, agoraSaoPaulo } = require("../lib/semanal-servidor.js");
const handler = require("../api/semanal.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

test("telefone: DDD + os 8 últimos dígitos, com ou sem o 55 e o 9 da frente", () => {
  assert.equal(S.chaveFone("+55 (11) 98765-4321"), "1187654321");
  assert.equal(S.chaveFone("5511987654321"), "1187654321");
  assert.equal(S.chaveFone("551187654321"), "1187654321", "WhatsApp sem o 9");
  assert.equal(S.chaveFone("(71) 3333-4444"), "7133334444");
  assert.equal(S.chaveFone("12345"), "");
  assert.equal(S.chaveFone(""), "");
});

test("quem respondeu: pelo telefone, senão pelo nome completo, senão pelo primeiro e último nome (só se for um só)", () => {
  const us = [
    { id: "100", nome: "Ana Ribeiro", fones: ["(11) 98765-4321"] },
    { id: "101", nome: "Bruno Teixeira", fones: [] },
    { id: "102", nome: "Daniela Souza Rocha", fones: [] },
    { id: "103", nome: "Pedro Lima", fones: [] }, { id: "104", nome: "Pedro Henrique Lima", fones: [] },
  ];
  assert.deepEqual(S.casarPessoa({ nome: "Ana R.", whatsapp: "5511987654321" }, us), { usuario: us[0], como: "telefone" });
  assert.equal(S.casarPessoa({ nome: "BRUNO TEIXEIRA", whatsapp: "" }, us).usuario.id, "101");
  assert.equal(S.casarPessoa({ nome: "Daniela Rocha", whatsapp: "5571999990000" }, us).usuario.id, "102", "primeiro e último nome");
  assert.equal(S.casarPessoa({ nome: "Pedro Lima", whatsapp: "" }, us).usuario.id, "103", "nome completo exato vence");
  assert.equal(S.casarPessoa({ nome: "Pedro Silva Lima", whatsapp: "" }, us).usuario, null, "dois Pedro ... Lima: ninguém, para o RH conferir");
  assert.equal(S.casarPessoa({ nome: "Visitante", whatsapp: "5511911112222" }, us).usuario, null);
});

test("a semana: a sexta-feira da semana de trabalho, pelo calendário do app semanal (ciclo às 8h de sexta e de segunda)", () => {
  // liderados respondem de sexta até segunda 07h, sobre a semana que termina na sexta
  assert.equal(S.semanaDasRespostas("2026-11-04T19:00", "liderado"), "2026-10-30");
  assert.equal(S.semanaDasRespostas("2026-11-02T06:30", "liderado"), "2026-10-30");
  assert.equal(S.semanaDasRespostas("2026-11-06T06:00", "liderado"), "2026-10-30", "a rotina das 6h de sexta ainda guarda o ciclo anterior");
  assert.equal(S.semanaDasRespostas("2026-11-06T15:00", "liderado"), "2026-11-06");
  // lideranças respondem na segunda, sobre a semana anterior
  assert.equal(S.semanaDasRespostas("2026-11-02T15:00", "lider"), "2026-10-30");
  assert.equal(S.semanaDasRespostas("2026-11-04T19:00", "lider"), "2026-10-30");
  assert.equal(S.semanaDasRespostas("2026-11-09T06:00", "lider"), "2026-10-30", "segunda antes das 8h: o ciclo das lideranças ainda não começou");
  assert.equal(S.rotuloSemana("2026-10-30"), "26/10 a 30/10");
  assert.equal(agoraSaoPaulo(new Date("2026-11-04T22:05:00Z")), "2026-11-04T19:05");
  assert.equal(agoraSaoPaulo(new Date("2026-11-06T03:00:00Z")), "2026-11-06T00:00");
});

test("o texto guardado: título e pergunta no cabeçalho, a resposta embaixo; só o que foi respondido", () => {
  const t = S.formatarRespostas([
    { pergunta: "*Sua semana*\nComo foi a sua semana? Conte as principais atividades.", resposta: "Fechei os protocolos.\nFaltou um documento." },
    { pergunta: "Casos sensíveis\nTeve algum caso sensível?", resposta: "  " },
    { pergunta: "Uma pergunta sem título", resposta: "Sim." },
  ]);
  assert.equal(t, "1. Sua semana — Como foi a sua semana? Conte as principais atividades.\nFechei os protocolos.\nFaltou um documento.\n\n2. Uma pergunta sem título\nSim.");
  assert.deepEqual(S.lerRespostas(t), [
    { titulo: "Sua semana", pergunta: "Como foi a sua semana? Conte as principais atividades.", resposta: "Fechei os protocolos.\nFaltou um documento." },
    { titulo: "", pergunta: "Uma pergunta sem título", resposta: "Sim." },
  ]);
  assert.equal(S.formatarRespostas([]), "");
});

test("o plano: cria, atualiza o que mudou, não duplica e conta quem ficou de fora", () => {
  const usuarios = [{ id: "100", nome: "Ana Ribeiro", fones: ["11987654321"] }, { id: "101", nome: "Bruno Teixeira", fones: [] }, { id: "3", nome: "Carla Mendes", fones: [] }];
  const membros = [{ id: "1", responsavel: "100", estagio: "ATIVO" }, { id: "2", responsavel: "101", estagio: "ATIVO" }, { id: "9", responsavel: "3", estagio: "FAIL" }];
  const pessoas = [
    { id: "A", papel: "liderado", nome: "Ana", whatsapp: "5511987654321", respostas: [{ pergunta: "Sua semana", resposta: "Boa." }] },
    { id: "B", papel: "liderado", nome: "Bruno Teixeira", whatsapp: "", respostas: [{ pergunta: "Sua semana", resposta: "Corrida." }] },
    { id: "C", papel: "lider", nome: "Carla Mendes", whatsapp: "", respostas: [{ pergunta: "Equipe", resposta: "Tudo entregue." }] },
    { id: "X", papel: "liderado", nome: "Visitante", whatsapp: "5511911112222", respostas: [{ pergunta: "Sua semana", resposta: "Ok." }] },
    { id: "Y", papel: "liderado", nome: "Sem Resposta", whatsapp: "", respostas: [] },
  ];
  const base = { pessoas, usuarios, membros, agora: "2026-11-04T19:00", agoraIso: "2026-11-04T22:00:00.000Z" };
  const r = S.planejar(Object.assign({ existentes: [] }, base));
  assert.deepEqual(r.criar.map((d) => [d.membroId, d.responsavel, d.semana, d.papel, d.origem]), [
    ["1", "100", "2026-10-30", "Membro", "liderado:A:2026-10-30"], ["2", "101", "2026-10-30", "Membro", "liderado:B:2026-10-30"],
  ]);
  assert.equal(r.criar[0].titulo, "Revisão semanal · Ana Ribeiro · 26/10 a 30/10");
  assert.equal(r.criar[0].respostas, "1. Sua semana\nBoa.");
  assert.deepEqual(r.naoEncontradas, [{ nome: "Visitante", papel: "Membro" }]);
  assert.deepEqual(r.semMembro, [{ nome: "Carla Mendes", papel: "Liderança" }], "item do Membros encerrado ou arquivado não recebe");
  assert.equal(r.semResposta, 1);

  // de novo, com a Ana já guardada e o Bruno mudado: atualiza só o Bruno
  const existentes = [
    { id: "50", membroId: "1", semana: "2026-10-30", papel: "Membro", origem: "liderado:A:2026-10-30", respostas: "1. Sua semana\nBoa." },
    { id: "51", membroId: "2", semana: "2026-10-30", papel: "Membro", origem: "liderado:B:2026-10-30", respostas: "1. Sua semana\nCorr" },
  ];
  const r2 = S.planejar(Object.assign({ existentes }, base));
  assert.equal(r2.criar.length, 0);
  assert.deepEqual(r2.atualizar, [{ id: "51", dados: { respostas: "1. Sua semana\nCorrida.", respondidas: 1, guardadaEm: "2026-11-04T22:00:00.000Z" } }]);
  assert.equal(r2.semMudanca, 1);

  // sexta à tarde, antes de o app semanal começar o ciclo novo: o mesmo texto da semana passada não vira semana nova
  const r3 = S.planejar(Object.assign({}, base, { agora: "2026-11-06T15:00", existentes }));
  assert.deepEqual(r3.criar.map((d) => d.responsavel), ["101"], "o Bruno mudou a resposta: entra na semana nova");
  assert.equal(r3.semMudanca, 1, "a Ana tem o mesmo texto da semana passada");
});

/* ---------------- servidor ---------------- */
function appSemanalFalso(dados) {
  const chamadas = [];
  const f = async (url, op) => {
    chamadas.push({ url: String(url), auth: op && op.headers && op.headers.Authorization });
    const u = new URL(url);
    const json = (x) => ({ ok: true, status: 200, json: async () => x });
    if (u.pathname === "/api/status") return json({ ciclo_ativo: true, lideres_all: dados.lideres, liderados_all: dados.liderados });
    if (u.pathname === "/api/respostas") return json(dados.doLider[u.searchParams.get("lider_id")] || []);
    if (u.pathname === "/api/respostas-liderados") return json(dados.daEquipe[u.searchParams.get("lider_id")] || []);
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { f, chamadas };
}
function dadosSemanal() {
  return {
    lideres: [
      { id: "L1", nome: "Carla Mendes", whatsapp: "5511999990003", ativo: true, pergunta_atual: 10 },
      { id: "L2", nome: "Liderança Sem Ciclo", whatsapp: "5511900000000", ativo: true, pergunta_atual: 0 },
      { id: "L3", nome: "Liderança Inativa", whatsapp: "5511900000001", ativo: false, pergunta_atual: 10 },
    ],
    liderados: [
      { id: "A", lider_id: "L1", nome: "Ana R.", whatsapp: "5511987654321", ativo: true, pergunta_atual: 10 },
      { id: "B", lider_id: "L1", nome: "Bruno Teixeira", whatsapp: "5521900001111", ativo: true, pergunta_atual: 3 },
      { id: "X", lider_id: "L1", nome: "Visitante Externo", whatsapp: "5511911112222", ativo: true, pergunta_atual: 2 },
      { id: "Z", lider_id: "L1", nome: "Zé Inativo", whatsapp: "5511933334444", ativo: false, pergunta_atual: 5 },
    ],
    doLider: { L1: [{ ordem: 1, pergunta: "Resultados da equipe\nComo foi a semana da equipe?", resposta: "Entregamos tudo." }] },
    daEquipe: {
      L1: [
        { liderado: "Ana R.", pergunta: "Sua semana\nComo foi a sua semana?", resposta: "Boa." },
        { liderado: "Ana R.", pergunta: "Casos sensíveis\nTeve algum caso sensível?", resposta: "Não." },
        { liderado: "Bruno Teixeira", pergunta: "Sua semana\nComo foi a sua semana?", resposta: "Corrida." },
        { liderado: "Visitante Externo", pergunta: "Sua semana\nComo foi a sua semana?", resposta: "Ok." },
      ],
    },
  };
}
async function portalComMembros() {
  const bx = criarBitrixFalso({
    usuarios: [
      { ID: "100", NAME: "Ana", LAST_NAME: "Ribeiro", PERSONAL_MOBILE: "(11) 98765-4321", UF_DEPARTMENT: [11] },
      { ID: "101", NAME: "Bruno", LAST_NAME: "Teixeira", UF_DEPARTMENT: [11] },
      { ID: "3", NAME: "Carla", LAST_NAME: "Mendes", WORK_PHONE: "+55 11 99999-0003", UF_DEPARTMENT: [11] },
      { ID: "6", NAME: "Helena", LAST_NAME: "Costa", UF_DEPARTMENT: [12] },
    ],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["membros"]);
  const ana = await portal.criar("membros", { titulo: "Ana Ribeiro", responsavel: "100", estagio: "ATIVO" });
  const bruno = await portal.criar("membros", { titulo: "Bruno Teixeira", responsavel: "101", estagio: "ATIVO" });
  return { bx, ana, bruno };
}
const QUANDO = new Date("2026-11-04T22:00:00Z"); // quarta, 19h em São Paulo

test("importação: guarda uma revisão por pessoa e semana, no card do membro, sem duplicar", async () => {
  const { bx, ana, bruno } = await portalComMembros();
  const app = appSemanalFalso(dadosSemanal());
  const env = { SEMANAL_URL: "https://semanal.exemplo/", SEMANAL_TOKEN: "tk-semanal" };
  const r = await importarSemanal({ chamar: bx.chamar, env, agora: QUANDO, fetch: app.f });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pessoas, 5, "as 2 lideranças ativas e os 3 liderados ativos");
  assert.equal(r.guardadas, 2);
  assert.deepEqual(r.semanas, ["2026-10-30"]);
  assert.deepEqual(r.naoEncontradas, [{ nome: "Visitante Externo", papel: "Membro" }]);
  assert.deepEqual(r.semMembro, [{ nome: "Carla Mendes", papel: "Liderança" }]);
  assert.equal(r.semResposta, 1);
  // o app semanal: status e, só da liderança com respostas, as dela e as da equipe; sempre com o token
  assert.deepEqual(app.chamadas.map((c) => c.url), ["https://semanal.exemplo/api/status", "https://semanal.exemplo/api/respostas?lider_id=L1", "https://semanal.exemplo/api/respostas-liderados?lider_id=L1"]);
  assert.ok(app.chamadas.every((c) => c.auth === "Bearer tk-semanal"));

  const portal = await abrirPortal(bx.chamar, ["membros", "semanal"]);
  const itens = await portal.listar("semanal");
  const daAna = itens.find((x) => x.membroId === ana.id);
  assert.equal(daAna.responsavel, "100");
  assert.equal(daAna.semana, "2026-10-30");
  assert.equal(daAna.papel, "Membro");
  assert.equal(daAna.respondidas, 2);
  assert.equal(daAna.respostas, "1. Sua semana — Como foi a sua semana?\nBoa.\n\n2. Casos sensíveis — Teve algum caso sensível?\nNão.");
  assert.equal(daAna.titulo, "Revisão semanal · Ana Ribeiro · 26/10 a 30/10");
  assert.ok(itens.some((x) => x.membroId === bruno.id));
  assert.ok(!JSON.stringify(itens).includes("98765"), "o telefone não vai para o Bitrix");

  // de novo: nada novo; com uma resposta a mais do Bruno: atualiza
  const r2 = await importarSemanal({ chamar: bx.chamar, env, agora: QUANDO, fetch: app.f });
  assert.equal(r2.guardadas, 0);
  assert.equal(r2.semMudanca, 2);
  const d = dadosSemanal();
  d.daEquipe.L1.push({ liderado: "Bruno Teixeira", pergunta: "Próxima semana\nQuais são as suas prioridades?", resposta: "Certidões." });
  const r3 = await importarSemanal({ chamar: bx.chamar, env, agora: QUANDO, fetch: appSemanalFalso(d).f });
  assert.equal(r3.atualizadas, 1);
  assert.equal((await portal.listar("semanal")).length, 2);
});

test("sem a tabela no Bitrix: avisa e nem chama o app semanal", async () => {
  const bx = criarBitrixFalso({});
  const app = appSemanalFalso(dadosSemanal());
  const r = await importarSemanal({ chamar: bx.chamar, env: {}, agora: QUANDO, fetch: app.f });
  assert.equal(r.ok, false);
  assert.equal(r.semTabela, true);
  assert.match(r.erro, /Criar ou completar a estrutura/);
  assert.equal(app.chamadas.length, 0);
});

test("botão Buscar agora: só o RH e os administradores, com a sessão do Bitrix conferida", async () => {
  const { bx } = await portalComMembros();
  const app = appSemanalFalso(dadosSemanal());
  const ENV = { BITRIX_WEBHOOK_URL: "https://portal/rest/1/segredo/", GP_AVISAR_IDS: "6" };
  async function chamar(env, req, inj) {
    const r = { statusCode: 0, headers: {}, corpo: null };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    r.end = (b) => { r.corpo = JSON.parse(b); };
    await handler(req || { method: "POST", body: { auth: "tk" } }, r, Object.assign({
      env, chamar: bx.chamar, fetch: app.f, agora: QUANDO, usuarioDoToken: async () => "6", ehAdmin: async () => false,
    }, inj || {}));
    return r;
  }
  assert.equal((await chamar(ENV, { method: "GET" })).statusCode, 405);
  assert.equal((await chamar({})).statusCode, 503);
  assert.equal((await chamar(ENV, { method: "POST", body: {} })).statusCode, 401);
  assert.equal((await chamar(ENV, null, { usuarioDoToken: async () => { throw new Error("sessão do Bitrix não reconhecida"); } })).statusCode, 401);
  const membro = await chamar(ENV, null, { usuarioDoToken: async () => "100" });
  assert.equal(membro.statusCode, 403);
  assert.equal(app.chamadas.length, 0, "recusado antes de ler o app semanal");
  const admin = await chamar(ENV, null, { usuarioDoToken: async () => "100", ehAdmin: async () => true });
  assert.equal(admin.statusCode, 200, JSON.stringify(admin.corpo));
  assert.equal(admin.corpo.guardadas, 2);
  const rh = await chamar(ENV);
  assert.equal(rh.statusCode, 200);
  assert.equal(rh.corpo.guardadas, 0, "o RH busca de novo: já estava tudo guardado");
  assert.equal(rh.corpo.semMudanca, 2);
});
