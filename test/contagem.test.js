// api/contagem.js: só números, só para o RH ou administrador, sempre com a sessão do Bitrix conferida.
const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const handler = require("../api/contagem.js");

const ENV = { BITRIX_WEBHOOK_URL: "https://portal/rest/1/segredo/", GP_AVISAR_IDS: "6" };
// portal falso: crm.type.list com os processos do app (menos o "1:1 mensais", que ainda não foi criado)
const tipos = schema.PROCESSOS.filter((p) => p.chave !== "mensal").map((p, i) => ({ id: 60 + i, entityTypeId: 1200 + i * 2, title: schema.tituloProcesso(p) }));
const chamarFalso = async (metodo) => {
  if (metodo === "crm.type.list") return { dados: { types: tipos.concat([{ id: 5, entityTypeId: 1100, title: "Outro processo" }]) }, proximo: null };
  throw new Error("método inesperado: " + metodo);
};
async function chamar(env, req, inj) {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  await handler(req || { method: "POST", body: { auth: "tk" } }, r, Object.assign({
    env, semCache: true, usuarioDoToken: async () => "6", ehAdministrador: async () => false, chamar: chamarFalso,
    totalDoProcesso: async (eti) => eti - 1190, // um número diferente por processo
  }, inj || {}));
  return r;
}

test("RH: devolve o total de cada processo do app que existe no portal", async () => {
  const r = await chamar(ENV);
  assert.equal(r.statusCode, 200);
  assert.equal(r.corpo.total.membros, 10);
  assert.equal(r.corpo.total.mensal, undefined, "processo que não existe no portal fica de fora");
  assert.equal(Object.keys(r.corpo.total).length, schema.PROCESSOS.length - 1);
});

test("sem sessão, sem papel ou sem configuração: recusa", async () => {
  assert.equal((await chamar({})).statusCode, 503);
  assert.equal((await chamar(ENV, { method: "GET" })).statusCode, 405);
  assert.equal((await chamar(ENV, { method: "POST", body: {} })).statusCode, 401);
  assert.equal((await chamar(ENV, null, { usuarioDoToken: async () => { throw new Error("sessão do Bitrix não reconhecida"); } })).statusCode, 401);
  const membro = await chamar(ENV, null, { usuarioDoToken: async () => "100" });
  assert.equal(membro.statusCode, 403);
  assert.equal(membro.corpo.total, undefined);
});

test("administrador do Bitrix fora do RH também pode", async () => {
  const r = await chamar(ENV, null, { usuarioDoToken: async () => "497", ehAdministrador: async () => true });
  assert.equal(r.statusCode, 200);
  assert.equal(typeof r.corpo.total.feedbacks, "number");
});

test("total do processo: lê o campo total da primeira página", async () => {
  const fetchFalso = async (url, op) => {
    assert.match(url, /crm\.item\.list\.json$/);
    assert.deepEqual(JSON.parse(op.body).select, ["id"]);
    return { status: 200, json: async () => ({ result: { items: [{ id: 1 }] }, total: 59, next: 50 }) };
  };
  assert.equal(await handler.totalDoProcesso("https://portal/rest/1/x/", 1234, fetchFalso), 59);
});
