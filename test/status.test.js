// api/status.js: só diz o que está ligado e o nome do que falta, nunca os valores.
const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/status.js");

const sessaoOk = async () => "6";
async function chamar(env, req, inj) {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); r.bruto = b; };
  await handler(req || { method: "POST", body: { auth: "tk-status" } }, r, Object.assign({ env, usuarioDoToken: sessaoOk }, inj || {}));
  return r;
}

test("sem sessão do Bitrix: recusa", async () => {
  assert.equal((await chamar({}, { method: "GET" })).statusCode, 401);
  const recusado = await chamar({}, { method: "POST", body: { auth: "tk-falso" } }, { usuarioDoToken: async () => { throw new Error("sessão do Bitrix não reconhecida"); } });
  assert.equal(recusado.statusCode, 401);
  assert.equal(recusado.corpo.rotinas, undefined);
});

test("nada configurado: tudo desligado, com o nome das variáveis que faltam", async () => {
  const r = await chamar({});
  assert.equal(r.statusCode, 200);
  assert.equal(r.corpo.rotinas.trava.ligada, false);
  assert.deepEqual(r.corpo.rotinas.painelCEO.falta, ["BITRIX_WEBHOOK_URL", "GP_CEO_IDS"]);
});

test("configurado: liga as rotinas e não devolve nenhum valor", async () => {
  const env = { BITRIX_WEBHOOK_URL: "https://portal/rest/1/segredo123/", CRON_SECRET: "cron-xyz", GP_AVISAR_IDS: "6", BITRIX_EVENTO_TOKEN: "tok-abc", GP_CEO_IDS: "1", GP_LINK_APP: "https://portal/marketplace/app/9/" };
  const r = await chamar(env);
  Object.values(r.corpo.rotinas).forEach((x) => assert.equal(x.ligada, true));
  assert.equal(r.corpo.opcionais.GP_LINK_APP, true);
  assert.equal(r.corpo.opcionais.GP_EXCECOES_IDS, false);
  ["segredo123", "cron-xyz", "tok-abc", "marketplace"].forEach((v) => assert.ok(r.bruto.indexOf(v) < 0, "vazou " + v));
});
