// Painel da CEO calculado no servidor (api/painel.js + dom.painelGeral/resumoPainel).
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const { dadosDemo } = require("../src/js/45-demo.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal, usuarioDoToken } = require("../lib/bitrix-servidor.js");
const handler = require("../api/painel.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

function ctxDemo() {
  const d = dadosDemo();
  return dom.indexar({ hoje: "2026-10-08", eu: { id: "1" }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros, vagas: d.vagas, feriados: { nacionais: calc.feriadosNacionais(2026) } });
}

test("resumo da CEO: os mesmos números do painel do RH, sem nomes de membros nem conteúdo", () => {
  const ctx = ctxDemo();
  const g = dom.painelGeral(ctx);
  const r = dom.resumoPainel(g);
  assert.equal(r.nMembros, g.todos.length);
  assert.equal(r.ind.atrasadas, g.ind.atrasadas);
  assert.equal(r.ind.um1a1.texto, g.ind.um1a1.texto);
  assert.equal(r.areas.length, g.areas.length);
  assert.equal(r.areas.reduce((s, a) => s + a.nEquipe, 0) <= r.nMembros, true);
  // nenhum membro que não seja liderança aparece pelo nome; nenhuma lista de pendências ou de quem falta
  const texto = JSON.stringify(r);
  const liderancas = new Set(r.areas.map((a) => a.lideranca.nome));
  dadosDemo().usuarios.filter((u) => !liderancas.has(u.nome)).forEach((u) => assert.ok(texto.indexOf(u.nome) < 0, "vazou " + u.nome));
  assert.ok(!/pendencias|faltam|titulo|motivo|descricao/.test(texto));
});

test("token: pergunta ao mesmo portal do webhook, nunca a outro endereço", async () => {
  const pedidos = [];
  const fetchFalso = async (url, op) => { pedidos.push({ url, corpo: JSON.parse(op.body) }); return { json: async () => ({ result: { ID: "1" } }) }; };
  assert.equal(await usuarioDoToken("https://amorimglobal.bitrix24.com.br/rest/1/abc/", "tk", fetchFalso), "1");
  assert.equal(pedidos[0].url, "https://amorimglobal.bitrix24.com.br/rest/user.current.json");
  assert.equal(pedidos[0].corpo.auth, "tk");
  const expirado = async () => ({ json: async () => ({ error: "expired_token" }) });
  await assert.rejects(usuarioDoToken("https://x.bitrix24.com.br/rest/1/a/", "tk", expirado), /expirou/);
});

function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  return r;
}
const ENV = { BITRIX_WEBHOOK_URL: "https://x/rest/1/abc/", GP_CEO_IDS: "1" };
const quem = (mapa) => async (url, token) => { if (!mapa[token]) throw new Error("sessão do Bitrix não reconhecida"); return mapa[token]; };

test("acesso: só a CEO, com sessão válida do Bitrix", async () => {
  const casos = [
    [{ env: {} }, { method: "POST", body: { auth: "a" } }, 503],
    [{ env: ENV }, { method: "GET" }, 405],
    [{ env: ENV }, { method: "POST", body: {} }, 401],
    [{ env: ENV, usuarioDoToken: quem({}) }, { method: "POST", body: { auth: "falso" } }, 401],
    [{ env: ENV, usuarioDoToken: quem({ lid: "3" }) }, { method: "POST", body: { auth: "lid" } }, 403],
  ];
  for (const [inj, req, status] of casos) {
    const res = resposta();
    await handler(Object.assign({ headers: {} }, req), res, inj);
    assert.equal(res.statusCode, status, JSON.stringify(res.corpo));
    assert.equal(res.corpo.resumo, undefined);
  }
});

test("CEO recebe o resumo calculado com os registros do portal", async () => {
  const bx = criarBitrixFalso({
    tiposIniciais: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }],
    usuarios: [{ ID: "1", NAME: "Giselle" }, { ID: "3", NAME: "Carla", LAST_NAME: "Mendes", UF_DEPARTMENT: [11] }, { ID: "100", NAME: "Ana", LAST_NAME: "Souza", UF_DEPARTMENT: [11] }, { ID: "101", NAME: "Bruno", UF_DEPARTMENT: [11] }],
    departamentos: [{ ID: "1", NAME: "Amorim", UF_HEAD: "1" }, { ID: "11", NAME: "Imigração", PARENT: "1", UF_HEAD: "3" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar);
  await portal.criar("membros", { titulo: "Ana Souza", responsavel: "100", estagio: "ATIVO", lideranca: "3" });
  await portal.criar("membros", { titulo: "Bruno", responsavel: "101", estagio: "ATIVO", lideranca: "3" });
  const chamar = async (m, p) => (m === "crm.dealcategory.stage.list" ? { dados: [], proximo: null } : m === "crm.deal.list" || m === "crm.stagehistory.list" ? { dados: m === "crm.deal.list" ? [] : { items: [] }, proximo: null } : bx.chamar(m, p));
  const res = resposta();
  await handler({ method: "POST", headers: {}, body: { auth: "ceo" } }, res, { env: ENV, usuarioDoToken: quem({ ceo: "1" }), chamar, hoje: "2026-10-20", semCache: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.corpo));
  assert.equal(res.corpo.resumo.nMembros, 2);
  assert.deepEqual(res.corpo.resumo.areas.map((a) => [a.depto.nome, a.lideranca.nome, a.nEquipe]), [["Imigração", "Carla Mendes", 2]]);
  assert.ok(JSON.stringify(res.corpo).indexOf("Ana") < 0);
});
