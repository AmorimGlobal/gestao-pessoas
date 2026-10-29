// Ficha da função por e-mail (lib/ficha.js + api/ficha.js + lib/email.js), sem rede: o Bitrix é o
// falso do provisionamento e o SMTP é um transporte que só guarda as mensagens.
const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const { montarFicha } = require("../lib/ficha.js");
const { criarEmail, emailConfigurado, remetente } = require("../lib/email.js");
const handler = require("../api/ficha.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

const SEGREDOS = { al1Nota: 85, al1Resultado: "Dentro do esperado", al1Retorno: "Justificativa interna: triagem incompleta", al1Combinados: "Combinado interno XYZ" };
const OB = Object.assign({
  ingresso: "2026-10-06", fichaEscopo: "Atendimento dos pedidos de cidadania.",
  fichaPadroes: "- Organização\n- Comunicação clara\n• Proatividade", fichaIndicadores: "Protocolos sem exigência",
  entregasAncoragem: "Triagem de 2 processos\nChecklist de requerimento", entregasImersao: "", entregasMarAberto: "Carteira de 6 casos",
}, SEGREDOS);
const ALINH = [
  { numero: 1, dia: 30, rotulo: "Alinhamento 1", fase: "Ancoragem", data: "2026-11-04" },
  { numero: 2, dia: 60, rotulo: "Alinhamento 2", fase: "Imersão", data: "2026-12-04" },
  { numero: 3, dia: 90, rotulo: "Alinhamento final", fase: "Mar Aberto", data: "2027-01-04" },
];

test("ficha: escopo, competências, indicadores, fases com as datas e quem acompanha", () => {
  const f = montarFicha({ membro: { nome: "Ana Souza", funcao: "Imigração · Analista" }, lideranca: { nome: "Carla Mendes" }, supervisao: { nome: "Bruno Teixeira" }, colega: null, enviadoPor: { nome: "Carla Mendes" }, onboarding: OB, alinhamentos: ALINH });
  for (const t of [f.html, f.texto]) {
    assert.match(t, /Olá, Ana!/);
    assert.match(t, /Atendimento dos pedidos de cidadania\./);
    assert.match(t, /Comunicação clara/);
    assert.match(t, /Proatividade/);
    assert.match(t, /Protocolos sem exigência/);
    assert.match(t, /Checklist de requerimento/);
    assert.match(t, /Carteira de 6 casos/);
    assert.match(t, /04\/11\/2026/);
    assert.match(t, /04\/01\/2027/);
    assert.match(t, /Carla Mendes/);
    assert.match(t, /Bruno Teixeira/);
    assert.match(t, /a definir/); // colega não informado
    assert.match(t, /A sua liderança combina as entregas desta fase com você/); // Imersão sem entregas
    assert.ok(!/colaborador/i.test(t), "glossário: membro, nunca colaborador");
  }
  assert.match(f.assunto, /Ficha da sua função · Imigração · Analista/);
  assert.ok(!/<li[^>]*>\s*-/.test(f.html), "os marcadores digitados saem da lista");
});

test("ficha: nunca leva nota, resultado, justificativa ou combinados das avaliações", () => {
  const f = montarFicha({ membro: { nome: "Ana" }, onboarding: OB, alinhamentos: ALINH });
  const tudo = f.assunto + f.html + f.texto;
  ["85", "Dentro do esperado", "Justificativa interna", "Combinado interno XYZ"].forEach((s) => assert.ok(tudo.indexOf(s) < 0, "vazou " + s));
  assert.ok(!/\bnota\b/i.test(f.texto));
  assert.ok(!/avalia/i.test(tudo), "nem a palavra avaliação");
});

test("ficha: texto digitado é escapado no HTML", () => {
  const f = montarFicha({ membro: { nome: "<script>alert(1)</script> Ana" }, lideranca: { nome: "Carla & \"Cia\"" }, onboarding: { fichaEscopo: "<img src=x onerror=alert(1)>" }, alinhamentos: [] });
  assert.ok(f.html.indexOf("<script>") < 0);
  assert.ok(f.html.indexOf("<img") < 0);
  assert.match(f.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(f.html, /Carla &amp; &quot;Cia&quot;/);
});

test("e-mail: variáveis que faltam, remetente e endereço inválido", async () => {
  assert.deepEqual(emailConfigurado({}), ["SMTP_HOST", "SMTP_USUARIO", "SMTP_SENHA"]);
  assert.deepEqual(emailConfigurado({ SMTP_HOST: "h", SMTP_USUARIO: "u@x.com", SMTP_SENHA: "s" }), []);
  assert.equal(remetente({ SMTP_USUARIO: "rh@amorim.com" }), '"Gestão de Pessoas · Amorim" <rh@amorim.com>');
  assert.equal(remetente({ SMTP_USUARIO: "u@x.com", EMAIL_REMETENTE: "\"RH\" <rh@x.com>" }), "\"RH\" <rh@x.com>");
  assert.throws(() => criarEmail({}), /SMTP_HOST, SMTP_USUARIO, SMTP_SENHA/);
  const enviadas = [];
  const e = criarEmail({ SMTP_USUARIO: "rh@amorim.com" }, { sendMail: async (m) => { enviadas.push(m); return { response: "250 OK" }; } });
  assert.equal(await e.enviar({ para: "ana@amorim.com", assunto: "A", texto: "t", html: "<p>t</p>", responderPara: "carla@amorim.com" }), "250 OK");
  assert.equal(enviadas[0].replyTo, "carla@amorim.com");
  assert.equal(enviadas[0].from, '"Gestão de Pessoas · Amorim" <rh@amorim.com>');
  await assert.rejects(e.enviar({ para: "sem-arroba", assunto: "A", texto: "t" }), /inválido/);
});

/* ---------------- api/ficha.js ---------------- */
const ENV = { BITRIX_WEBHOOK_URL: "https://amorimglobal.bitrix24.com.br/rest/1/abc/", SMTP_HOST: "mail.x.com", SMTP_USUARIO: "rh@x.com", SMTP_SENHA: "s" };
const USUARIOS = [
  { ID: "3", NAME: "Carla", LAST_NAME: "Mendes", EMAIL: "carla@amorimglobal.com" },
  { ID: "6", NAME: "Helena", LAST_NAME: "Costa", EMAIL: "helena@amorimglobal.com" },
  { ID: "100", NAME: "Ana", LAST_NAME: "Souza", EMAIL: "ana@amorimglobal.com" },
  { ID: "101", NAME: "Bruno", LAST_NAME: "Teixeira", EMAIL: "bruno@amorimglobal.com" },
  { ID: "102", NAME: "Duda", LAST_NAME: "Sem Email", EMAIL: "" },
];

async function cenario() {
  const bx = criarBitrixFalso({ usuarios: USUARIOS });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar);
  const ana = await portal.criar("membros", { titulo: "Ana Souza", responsavel: "100", estagio: "NEW", lideranca: "3", coordenacao: "6", funcao: "Imigração · Analista", ingresso: "2026-10-06" });
  const duda = await portal.criar("membros", { titulo: "Duda", responsavel: "102", estagio: "NEW", lideranca: "3" });
  const obAna = await portal.criar("onboarding", Object.assign({ titulo: "Onboarding · Ana", membroId: ana.id, responsavel: "100", supervisao: "101", estagio: "ANCORAGEM" }, OB));
  const obDuda = await portal.criar("onboarding", { titulo: "Onboarding · Duda", membroId: duda.id, responsavel: "102", ingresso: "2026-10-06", fichaEscopo: "x" });
  return { bx, portal, obAna, obDuda };
}
function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  return r;
}
function emailFalso(falhar) {
  const enviadas = [];
  return { enviadas, enviar: async (m) => { if (falhar) throw new Error("SMTP recusou"); enviadas.push(m); return "250 OK"; } };
}
async function chamarFicha(c, corpo, inj) {
  const res = resposta();
  const email = (inj && inj.email) || emailFalso();
  await handler({ method: "POST", headers: {}, body: corpo }, res, Object.assign({
    env: ENV, chamar: c ? c.bx.chamar : undefined, email, usuarioDoToken: async () => "3",
    chamarComToken: async () => ({ ok: true, dados: {} }), agora: new Date("2026-10-29T18:30:00Z"),
  }, inj || {}));
  return Object.assign(res, { email });
}

test("api/ficha: sem webhook ou sem SMTP responde 503 dizendo o que falta", async () => {
  const r1 = resposta();
  await handler({ method: "POST", body: { auth: "t", onboardingId: "1" } }, r1, { env: {} });
  assert.equal(r1.statusCode, 503);
  const r2 = resposta();
  await handler({ method: "POST", body: { auth: "t", onboardingId: "1" } }, r2, { env: { BITRIX_WEBHOOK_URL: ENV.BITRIX_WEBHOOK_URL, SMTP_HOST: "h" } });
  assert.equal(r2.statusCode, 503);
  assert.match(r2.corpo.erro, /SMTP_USUARIO, SMTP_SENHA/);
});

test("api/ficha: sem token, sessão recusada ou sem acesso ao onboarding no Bitrix", async () => {
  const c = await cenario();
  assert.equal((await chamarFicha(c, { onboardingId: c.obAna.id })).statusCode, 401);
  assert.equal((await chamarFicha(c, { auth: "t", onboardingId: c.obAna.id }, { usuarioDoToken: async () => { throw new Error("sessão do Bitrix não reconhecida"); } })).statusCode, 401);
  assert.equal((await chamarFicha(c, { auth: "t", onboardingId: "abc" })).statusCode, 400);
  const pedidos = [];
  const negado = await chamarFicha(c, { auth: "tk-carla", onboardingId: c.obAna.id }, { chamarComToken: async (url, token, metodo, params) => { pedidos.push({ url, token, metodo, params }); return { ok: false, erro: "ACCESS_DENIED" }; } });
  assert.equal(negado.statusCode, 403);
  assert.equal(negado.corpo.erro, "sem acesso a este onboarding");
  assert.equal(negado.email.enviadas.length, 0);
  assert.deepEqual(pedidos[0], { url: ENV.BITRIX_WEBHOOK_URL, token: "tk-carla", metodo: "crm.item.get", params: { entityTypeId: c.portal.eti("onboarding"), id: Number(c.obAna.id) } });
  // o próprio membro não envia a ficha para si
  assert.equal((await chamarFicha(c, { auth: "t", onboardingId: c.obAna.id }, { usuarioDoToken: async () => "100" })).statusCode, 403);
  // membro sem e-mail no cadastro
  const semEmail = await chamarFicha(c, { auth: "t", onboardingId: c.obDuda.id });
  assert.equal(semEmail.statusCode, 400);
  assert.match(semEmail.corpo.erro, /e-mail/);
});

test("api/ficha: envia ao membro, responde para quem enviou, grava a data e comenta no histórico", async () => {
  const c = await cenario();
  const r = await chamarFicha(c, { auth: "tk", onboardingId: c.obAna.id });
  assert.equal(r.statusCode, 200, JSON.stringify(r.corpo));
  assert.deepEqual(r.corpo, { ok: true, para: "ana@amorimglobal.com", enviadaEm: "2026-10-29T18:30:00.000Z" });
  const m = r.email.enviadas[0];
  assert.equal(m.para, "ana@amorimglobal.com");
  assert.equal(m.responderPara, "carla@amorimglobal.com");
  assert.match(m.assunto, /Imigração · Analista/);
  assert.match(m.html, /Carla Mendes/);         // liderança (o Leme) e quem enviou
  assert.match(m.html, /Bruno Teixeira/);       // supervisão (a Bússola)
  assert.match(m.texto, /Conversa de acompanhamento com a sua liderança: Dia 30, 04\/11\/2026\./);
  assert.ok(!/avalia/i.test(m.texto + m.html), "a ficha não fala em avaliação");
  ["Justificativa interna", "Combinado interno XYZ", "Dentro do esperado"].forEach((s) => assert.ok((m.html + m.texto).indexOf(s) < 0, "vazou " + s));
  const comentario = c.bx.estado.comentarios.find((x) => String(x.ENTITY_ID) === String(c.obAna.id));
  assert.equal(comentario.COMMENT, "Ficha enviada por e-mail para ana@amorimglobal.com por Carla Mendes em 29/10/2026 15:30.");
  const temCampo = schema.processo("onboarding").campos.some((x) => x.chave === "fichaEnviadaEm");
  const ob = await c.portal.obter("onboarding", c.obAna.id);
  if (temCampo) {
    assert.ok(ob.fichaEnviadaEm, "data do envio gravada");
    // dois cliques seguidos: o segundo não manda outro e-mail
    const de2 = await chamarFicha(c, { auth: "tk", onboardingId: c.obAna.id }, { agora: new Date("2026-10-29T18:31:00Z") });
    assert.equal(de2.statusCode, 409);
    assert.equal(de2.email.enviadas.length, 0);
    const reenvio = await chamarFicha(c, { auth: "tk", onboardingId: c.obAna.id, reenviar: true }, { agora: new Date("2026-10-29T18:31:00Z") });
    assert.equal(reenvio.statusCode, 200);
  }
});

test("api/ficha: SMTP recusou: erro para quem enviou e nada gravado no item", async () => {
  const c = await cenario();
  const r = await chamarFicha(c, { auth: "tk", onboardingId: c.obAna.id }, { email: emailFalso(true) });
  assert.equal(r.statusCode, 500);
  assert.match(r.corpo.erro, /SMTP recusou/);
  assert.equal(c.bx.estado.comentarios.length, 0);
});

test("chamada com o token de quem está no app: no portal do webhook, formulário com auth", async () => {
  const pedidos = [];
  const fetchFalso = async (url, op) => { pedidos.push({ url, corpo: Object.fromEntries(new URLSearchParams(op.body)) }); return { json: async () => ({ result: { item: { id: 9 } } }) }; };
  const r = await handler.chamarComToken("https://amorimglobal.bitrix24.com.br/rest/1/abc/", "tk", "crm.item.get", { entityTypeId: 1210, id: 9 }, fetchFalso);
  assert.equal(r.ok, true);
  assert.equal(pedidos[0].url, "https://amorimglobal.bitrix24.com.br/rest/crm.item.get.json");
  assert.deepEqual(pedidos[0].corpo, { auth: "tk", entityTypeId: "1210", id: "9" });
  const negado = await handler.chamarComToken("https://x.bitrix24.com.br/rest/1/a/", "tk", "crm.item.get", {}, async () => ({ json: async () => ({ error: "ACCESS_DENIED" }) }));
  assert.deepEqual(negado, { ok: false, erro: "ACCESS_DENIED" });
});
