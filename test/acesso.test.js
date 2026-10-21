// Acesso só pelo Bitrix (lib/acesso.js e api/app.js): a página só sai com a sessão confirmada no portal.
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const acesso = require("../lib/acesso.js");
const app = require("../api/app.js");

function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: "" };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.removeHeader = (k) => { delete r.headers[k.toLowerCase()]; };
  r.end = (b) => { r.corpo = String(b || ""); };
  return r;
}
const HTML = "<html><body>APP</body></html>";
/** O POST com que o Bitrix abre o app local */
const postBitrix = (auth) => Object.assign(Readable.from(["AUTH_ID=" + auth + "&AUTH_EXPIRES=3600&REFRESH_ID=r&member_id=m&status=L&PLACEMENT=DEFAULT&PLACEMENT_OPTIONS=%7B%7D"]), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } });

test("link aberto direto no navegador (GET): acesso negado, sem a página", async () => {
  const r = resposta();
  await acesso.atenderPagina({ method: "GET", headers: {} }, r, HTML, { env: {} });
  assert.equal(r.statusCode, 403);
  assert.match(r.corpo, /Acesso só pelo Bitrix24/);
  assert.ok(r.corpo.indexOf("APP") < 0);
});

test("POST sem token ou com token recusado pelo portal: acesso negado", async () => {
  const semToken = resposta();
  await acesso.atenderPagina({ method: "POST", headers: {}, body: {} }, semToken, HTML, { env: {} });
  assert.equal(semToken.statusCode, 403);
  const recusado = resposta();
  await acesso.atenderPagina(postBitrix("falso"), recusado, HTML, { env: {}, usuarioDoToken: async () => { throw new Error("sessão do Bitrix não reconhecida"); } });
  assert.equal(recusado.statusCode, 403);
  assert.ok(recusado.corpo.indexOf("APP") < 0);
});

test("POST do Bitrix com sessão válida: entrega a página; a sessão fica guardada por alguns minutos", async () => {
  let perguntas = 0;
  const pedidos = [];
  const usuarioDoToken = async (origem, token) => {
    perguntas++;
    pedidos.push(origem);
    if (token !== "bom") throw new Error("sessão do Bitrix não reconhecida");
    return "45";
  };
  const r = resposta();
  await acesso.atenderPagina(postBitrix("bom"), r, HTML, { env: { BITRIX_WEBHOOK_URL: "https://amorimglobal.bitrix24.com.br/rest/1/x/" }, usuarioDoToken });
  assert.equal(r.statusCode, 200);
  assert.equal(r.corpo, HTML);
  assert.equal(pedidos[0], "https://amorimglobal.bitrix24.com.br/", "pergunta ao portal do webhook, não a um domínio vindo da requisição");
  const r2 = resposta();
  await acesso.atenderPagina(postBitrix("bom"), r2, HTML, { env: {}, usuarioDoToken });
  assert.equal(r2.statusCode, 200);
  assert.equal(perguntas, 1);
});

test("portal fora do ar: 503 com aviso, sem a página", async () => {
  const r = resposta();
  await acesso.atenderPagina(postBitrix("qualquer-" + Date.now()), r, HTML, { env: {}, usuarioDoToken: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(r.statusCode, 503);
  assert.ok(r.corpo.indexOf("APP") < 0);
});

test("api/app.js gerado: a página publicada não tem demonstração e é barrada sem sessão", async () => {
  const r = resposta();
  await app({ method: "GET", headers: {} }, r);
  assert.equal(r.statusCode, 403);
  const fonte = require("node:fs").readFileSync(require.resolve("../api/app.js"), "utf8");
  assert.match(fonte, /window\.GP_SO_BITRIX = true/);
});

test("portal: GP_PORTAL, depois o do webhook, depois o padrão", () => {
  assert.equal(acesso.portalDe({ GP_PORTAL: "https://outro.bitrix24.com.br/" }), "outro.bitrix24.com.br");
  assert.equal(acesso.portalDe({ BITRIX_WEBHOOK_URL: "https://amorimglobal.bitrix24.com.br/rest/1/x/" }), "amorimglobal.bitrix24.com.br");
  assert.equal(acesso.portalDe({}), "amorimglobal.bitrix24.com.br");
});
