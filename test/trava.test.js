// Trava do encerramento no servidor (4.1): api/eventos.js + lib/trava-encerramento.js contra um
// Bitrix falso provisionado do mesmo jeito que o portal (mesmos códigos de campo e de estágio).
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const schema = require("../src/js/20-schema.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const handler = require("../api/eventos.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

const HOJE = "2026-10-20";
const ENV = { BITRIX_EVENTO_TOKEN: "tok-saida", BITRIX_WEBHOOK_URL: "https://x/rest/1/abc/", GP_AVISAR_IDS: "6, 1", GP_EXCECOES_IDS: "1" };
const USUARIOS = [
  { ID: "1", NAME: "Giselle", LAST_NAME: "CEO" }, { ID: "2", NAME: "Livia", LAST_NAME: "Prado" },
  { ID: "3", NAME: "Carla", LAST_NAME: "Mendes" }, { ID: "6", NAME: "Helena", LAST_NAME: "Costa" },
  { ID: "100", NAME: "Ana", LAST_NAME: "Souza" }, { ID: "101", NAME: "Bruno", LAST_NAME: "Teixeira" },
];

async function cenario() {
  const bx = criarBitrixFalso({ tiposIniciais: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }], usuarios: USUARIOS });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar);
  const ana = await portal.criar("membros", { titulo: "Ana Souza", responsavel: "100", estagio: "ATIVO", lideranca: "3", coordenacao: "2" });
  const bruno = await portal.criar("membros", { titulo: "Bruno Teixeira", responsavel: "101", estagio: "ATIVO", lideranca: "3", coordenacao: "2" });
  const E = portal.est.encerramentos;
  /** O que o formulário do Bitrix grava: só os campos do formulário, sem autor e sem estágio */
  async function peloFormulario(responsavel, motivo, extra) {
    const f = Object.assign({ title: "Solicitação pelo formulário", assignedById: Number(responsavel), createdBy: 2 }, extra || {});
    f[E.campos.motivo] = E.enums.motivo.porValor[motivo];
    const r = await bx.chamar("crm.item.add", { entityTypeId: E.eti, fields: f });
    return String(r.dados.item.id);
  }
  /** Plano encerrado sem os resultados, com os 2 feedbacks SCI */
  async function planoCompleto(membro) {
    const fa = await portal.criar("feedbacks", { titulo: "Abertura", membroId: membro.id, responsavel: membro.responsavel, tipo: "Abertura de plano", estagio: "SUCCESS" });
    const fe = await portal.criar("feedbacks", { titulo: "Encerramento", membroId: membro.id, responsavel: membro.responsavel, tipo: "Encerramento de plano", estagio: "SUCCESS" });
    return portal.criar("planos", { titulo: "Plano", membroId: membro.id, responsavel: membro.responsavel, estagio: "FAIL", feedbackAberturaId: fa.id, feedbackEncerramentoId: fe.id });
  }
  return { bx, portal, ana, bruno, E, peloFormulario, planoCompleto };
}

function corpoEvento(evento, eti, id, token) {
  return "event=" + evento + "&data%5BFIELDS%5D%5BID%5D=" + id + "&data%5BFIELDS%5D%5BENTITY_TYPE_ID%5D=" + eti +
    "&ts=1760968800&auth%5Bdomain%5D=amorimglobal.bitrix24.com.br&auth%5Bapplication_token%5D=" + (token || ENV.BITRIX_EVENTO_TOKEN);
}
/** Requisição como a Vercel entrega: corpo urlencoded já lido em objeto plano, ou cru no stream */
function requisicao(corpo, cru) {
  if (cru) return Object.assign(Readable.from([corpo]), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } });
  const body = {};
  new URLSearchParams(corpo).forEach((v, k) => { body[k] = v; });
  return { method: "POST", headers: {}, body };
}
function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  return r;
}
async function evento(c, nome, id, extra) {
  const res = resposta();
  await handler(requisicao(corpoEvento(nome, c.E.eti, id), extra && extra.cru), res, { env: ENV, chamar: c.bx.chamar, hoje: HOJE, semCache: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.corpo));
  return res.corpo;
}

test("formulário sem os registros: bloqueia com o motivo, liga ao membro e avisa só quem pediu", async () => {
  const c = await cenario();
  const id = await c.peloFormulario("100", "Resultados abaixo do acordado");
  const r = await evento(c, "ONCRMDYNAMICITEMADD", id);
  assert.equal(r.acao, "bloquear");
  const enc = await c.portal.obter("encerramentos", id);
  assert.equal(enc.estagio, "BLOQUEADA");
  assert.equal(enc.bloqueio, "Este motivo exige 2 feedbacks SCI e um plano de alinhamento de 60 dias encerrado.");
  assert.equal(enc.membroId, c.ana.id);
  assert.equal(enc.coordenacao, "2");
  assert.equal(enc.origem, "Formulário da coordenação");
  assert.equal(enc.solicitante, "2");
  assert.equal(enc.primeiraVerificacao, "Bloqueada na 1ª verificação");
  assert.match(c.bx.estado.comentarios[0].COMMENT, /bloqueada/);
  assert.deepEqual(c.bx.estado.avisos.map((a) => a.USER_ID), [2]);
  assert.match(c.bx.estado.avisos[0].MESSAGE, /Ana Souza/);
  // o próprio update do servidor gera outro evento: nada mais acontece
  const r2 = await evento(c, "ONCRMDYNAMICITEMUPDATE", id);
  assert.equal(r2.acao, "nada");
  assert.equal(c.bx.estado.avisos.length, 1);
});

test("formulário com plano e 2 feedbacks: vai direto ao RH, com plano e feedbacks vinculados; a CEO nunca é avisada", async () => {
  const c = await cenario();
  const plano = await c.planoCompleto(c.ana);
  const id = await c.peloFormulario("100", "Resultados abaixo do acordado");
  const r = await evento(c, "ONCRMDYNAMICITEMADD", id, { cru: true });
  assert.equal(r.acao, "aceitar");
  const enc = await c.portal.obter("encerramentos", id);
  assert.equal(enc.estagio, "ENVIADA_RH");
  assert.equal(enc.enviadaRHEm, HOJE);
  assert.equal(enc.planoId, plano.id);
  assert.equal(enc.feedbacksIds.split(",").length, 2);
  assert.equal(enc.primeiraVerificacao, "Aceita na 1ª verificação");
  assert.deepEqual(c.bx.estado.avisos.map((a) => a.USER_ID), [6]); // GP_AVISAR_IDS tem a CEO (1), mas ela está nas exceções
  assert.ok(!c.bx.estado.avisos.some((a) => a.USER_ID === 100), "o membro nunca é avisado");
  const r2 = await evento(c, "ONCRMDYNAMICITEMUPDATE", id);
  assert.equal(r2.acao, "nada");
});

test("arrastado no kanban sem passar pelo app: volta para Bloqueada", async () => {
  const c = await cenario();
  const enc = await c.portal.criar("encerramentos", {
    titulo: "Encerramento · Bruno", membroId: c.bruno.id, responsavel: "101", motivo: "Reestruturação da área", coordenacao: "2",
    origem: "Solicitação da liderança direta", solicitante: "3", autor: "3", estagio: "NEW",
  });
  assert.equal((await evento(c, "ONCRMDYNAMICITEMADD", enc.id)).acao, "nada"); // rascunho do app: não mexe
  await c.portal.atualizar("encerramentos", enc.id, { estagio: "ENVIADA_RH" });
  const r = await evento(c, "ONCRMDYNAMICITEMUPDATE", enc.id);
  assert.equal(r.acao, "bloquear");
  const depois = await c.portal.obter("encerramentos", enc.id);
  assert.equal(depois.estagio, "BLOQUEADA");
  assert.equal(depois.bloqueio, "Registre a justificativa do fluxo abreviado.");
  assert.deepEqual(c.bx.estado.avisos.map((a) => a.USER_ID), [3]);
});

test("com a justificativa, liberação do RH ou situação grave, a solicitação segue", async () => {
  const c = await cenario();
  const ok = await c.portal.criar("encerramentos", {
    titulo: "Com justificativa", membroId: c.bruno.id, responsavel: "101", motivo: "Fim do prazo previsto no contrato", justificativa: "Contrato de 6 meses terminou.",
    origem: "Solicitação da liderança direta", solicitante: "3", autor: "3", estagio: "AG_COORD",
  });
  assert.equal((await evento(c, "ONCRMDYNAMICITEMUPDATE", ok.id)).acao, "nada");
  const liberada = await c.portal.criar("encerramentos", {
    titulo: "Liberada", membroId: c.ana.id, responsavel: "100", motivo: "Resultados abaixo do acordado", origem: "Solicitação da liderança direta",
    solicitante: "3", autor: "3", estagio: "ENVIADA_RH", liberacaoRH: "Caso excepcional analisado com as sócias.",
  });
  assert.equal((await evento(c, "ONCRMDYNAMICITEMUPDATE", liberada.id)).acao, "nada");
  const grave = await c.peloFormulario("101", "Situação grave ou urgente");
  assert.equal((await evento(c, "ONCRMDYNAMICITEMADD", grave)).acao, "aceitar");
  assert.equal((await c.portal.obter("encerramentos", grave)).estagio, "ENVIADA_RH");
  assert.equal((await c.portal.obter("encerramentos", ok.id)).estagio, "AG_COORD");
});

test("formulário sem membro identificável: bloqueia pedindo o membro", async () => {
  const c = await cenario();
  const id = await c.peloFormulario("3", "Reestruturação da área", { title: "Sem membro" }); // Responsável = a liderança, não um membro
  const r = await evento(c, "ONCRMDYNAMICITEMADD", id);
  assert.equal(r.acao, "bloquear");
  assert.match((await c.portal.obter("encerramentos", id)).bloqueio, /identificar o membro/);
});

test("segurança: token errado 401, sem configuração 503, GET 405, outros processos e eventos ignorados", async () => {
  const c = await cenario();
  const r1 = resposta();
  await handler(requisicao(corpoEvento("ONCRMDYNAMICITEMADD", c.E.eti, 1, "outro")), r1, { env: ENV, chamar: c.bx.chamar });
  assert.equal(r1.statusCode, 401);
  const r2 = resposta();
  await handler(requisicao(corpoEvento("ONCRMDYNAMICITEMADD", c.E.eti, 1)), r2, { env: {} });
  assert.equal(r2.statusCode, 503);
  const r3 = resposta();
  await handler({ method: "GET", headers: {} }, r3, { env: ENV });
  assert.equal(r3.statusCode, 405);
  const r4 = resposta();
  const membrosEti = c.portal.eti("membros");
  await handler(requisicao(corpoEvento("ONCRMDYNAMICITEMUPDATE", membrosEti, c.ana.id)), r4, { env: ENV, chamar: c.bx.chamar, semCache: true });
  assert.equal(r4.corpo.ignorado, "outro processo");
  const r5 = resposta();
  await handler(requisicao(corpoEvento("ONCRMDEALUPDATE", 2, 10)), r5, { env: ENV, chamar: c.bx.chamar });
  assert.match(r5.corpo.ignorado, /ONCRMDEALUPDATE/);
  assert.equal(c.bx.estado.avisos.length, 0);
  assert.ok(schema.processo("encerramentos"));
});
