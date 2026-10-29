// E-mail a quem pediu nos funis de vagas e de offboarding (lib/avisos-negocios.js) e o
// roteamento dos eventos de negócio em api/eventos.js, contra um Bitrix de negócios em memória.
const test = require("node:test");
const assert = require("node:assert/strict");
const { decidir, tratar, tipoDaCategoria } = require("../lib/avisos-negocios.js");
const handler = require("../api/eventos.js");

const AGORA = new Date("2026-10-29T15:00:00-03:00");
const ETAPAS_77 = [
  { id: "C77:NEW", nome: "Nova solicitação", semantica: "" }, { id: "C77:PREPARATION", nome: "Em análise", semantica: "" },
  { id: "C77:WON", nome: "Vaga preenchida", semantica: "S" },
];
const ETAPAS_91 = [{ id: "C91:NEW", nome: "Nova solicitação", semantica: "" }, { id: "C91:EXECUTING", nome: "Em análise pelo RH", semantica: "" }];
const vaga = (extra) => Object.assign({ ID: "501", CATEGORY_ID: "77", STAGE_ID: "C77:NEW", TITLE: "Vaga", DATE_CREATE: "2026-10-29T14:58:00-03:00",
  UF_CRM_RV_VAGA: "Analista de Imigração", UF_CRM_RV_EMAIL: "carla@amorimglobal.com", UF_CRM_RV_LIDER: "Carla Mendes", UF_CRM_RV_ULT_AVISO: null }, extra || {});
const off = (extra) => Object.assign({ ID: "601", CATEGORY_ID: "91", STAGE_ID: "C91:NEW", TITLE: "Offboarding", DATE_CREATE: "2026-10-29T14:58:00-03:00",
  UF_CRM_OFF_MEMBRO: "Bruno Teixeira", UF_CRM_OFF_SOLICIT: "Livia Prado", UF_CRM_OFF_EMAIL: "livia@amorimglobal.com", UF_CRM_OFF_ULT_AVISO: null,
  UF_CRM_OFF_MOTIVO: "Desalinhamento de perfil", UF_CRM_OFF_DESCRICAO: "Fatos sensíveis da solicitação" }, extra || {});

test("funil do negócio: vagas por padrão na 77, offboarding só com a variável", () => {
  assert.equal(tipoDaCategoria("77", {}), "vaga");
  assert.equal(tipoDaCategoria(77, { GP_CATEGORIA_VAGAS: "80" }), null);
  assert.equal(tipoDaCategoria("80", { GP_CATEGORIA_VAGAS: "80" }), "vaga");
  assert.equal(tipoDaCategoria("91", {}), null);
  assert.equal(tipoDaCategoria("91", { GP_CATEGORIA_OFFBOARDING: "91" }), "offboarding");
  assert.equal(tipoDaCategoria("0", { GP_CATEGORIA_OFFBOARDING: "91" }), null);
  assert.equal(tipoDaCategoria(undefined, {}), null);
});

test("vaga nova: e-mail de recebimento com a etapa e aviso ao RH com o link", () => {
  const d = decidir({ negocio: vaga(), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA, link: "https://portal/crm/deal/details/501/" });
  assert.equal(d.acao, "avisar");
  assert.equal(d.primeira, true);
  assert.equal(d.para, "carla@amorimglobal.com");
  assert.match(d.assunto, /Recebemos a sua solicitação de vaga: Analista de Imigração/);
  assert.match(d.texto, /^Olá, Carla! Recebemos a sua solicitação de vaga "Analista de Imigração"\./);
  assert.match(d.texto, /Etapa atual: Nova solicitação\./);
  assert.match(d.avisoRH, /Nova solicitação de vaga .*Analista de Imigração\. https:\/\/portal\/crm\/deal\/details\/501\//);
  // sem o nome de quem pediu: só "Olá!"
  assert.match(decidir({ negocio: vaga({ UF_CRM_RV_LIDER: null }), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA }).texto, /^Olá! Recebemos/);
  assert.equal(d.marca, "C77:NEW");
});

test("mudança de etapa: e-mail com a etapa nova, sem aviso ao RH; mesma etapa: nada", () => {
  const d = decidir({ negocio: vaga({ STAGE_ID: "C77:PREPARATION", UF_CRM_RV_ULT_AVISO: "C77:NEW" }), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALUPDATE", agora: AGORA });
  assert.equal(d.acao, "avisar");
  assert.equal(d.primeira, false);
  assert.match(d.texto, /mudou de etapa: Em análise\./);
  assert.equal(d.avisoRH, "");
  const igual = decidir({ negocio: vaga({ UF_CRM_RV_ULT_AVISO: "C77:NEW" }), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALUPDATE", agora: AGORA });
  assert.deepEqual(igual, { acao: "ignorar", motivo: "etapa já avisada" });
});

test("sem o campo da marca no Bitrix: não avisa (senão repetiria a cada atualização)", () => {
  const n = vaga();
  delete n.UF_CRM_RV_ULT_AVISO;
  const d = decidir({ negocio: n, etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA });
  assert.equal(d.acao, "ignorar");
  assert.match(d.motivo, /UF_CRM_RV_ULT_AVISO não existe/);
});

test("negócio antigo, ainda sem marca: só grava a etapa, a não ser que ela tenha acabado de mudar", () => {
  const antigo = vaga({ DATE_CREATE: "2026-10-10T10:00:00-03:00", STAGE_ID: "C77:PREPARATION" });
  const so = decidir({ negocio: antigo, etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALUPDATE", agora: AGORA, ultimaMudanca: "2026-10-12T10:00:00-03:00" });
  assert.equal(so.acao, "marcar");
  const mudou = decidir({ negocio: antigo, etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALUPDATE", agora: AGORA, ultimaMudanca: "2026-10-29T14:55:00-03:00" });
  assert.equal(mudou.acao, "avisar");
  assert.equal(mudou.primeira, false);
  assert.equal(mudou.avisoRH, "");
});

test("offboarding: só o nome do membro e a etapa, nunca o motivo ou a descrição", () => {
  for (const n of [off(), off({ STAGE_ID: "C91:EXECUTING", UF_CRM_OFF_ULT_AVISO: "C91:NEW" })]) {
    const d = decidir({ negocio: n, etapas: ETAPAS_91, tipo: "offboarding", evento: "ONCRMDEALUPDATE", agora: AGORA, link: "https://portal/crm/deal/details/601/" });
    assert.equal(d.acao, "avisar");
    const tudo = d.assunto + d.texto + d.html + d.avisoRH;
    assert.match(d.texto, /encerramento de contrato de Bruno Teixeira/);
    assert.match(d.texto, /Acompanhe com o RH/);
    assert.match(d.texto, /^Olá, Livia!/);
    assert.ok(!/Bruno/.test(d.assunto), "o nome do membro não vai no assunto");
    ["Desalinhamento", "Fatos sensíveis", "desligamento", "colaborador"].forEach((s) => assert.ok(tudo.indexOf(s) < 0, "vazou " + s));
  }
});

function chamarFalso() {
  const chamadas = [];
  return { chamadas, chamar: async (metodo, params) => { chamadas.push({ metodo, params }); return { dados: true }; } };
}
function emailFalso(falhar) {
  const enviadas = [];
  return { enviadas, enviar: async (m) => { if (falhar) throw new Error("SMTP fora"); enviadas.push(m); return "250 OK"; } };
}

test("tratar: e-mail, RH avisado (menos quem fica fora do app) e marca gravada", async () => {
  const bx = chamarFalso(), email = emailFalso();
  const r = await tratar({ negocio: vaga(), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA, email, chamar: bx.chamar, rhIds: ["6", "1", "6"], naoAvisar: ["1"] });
  assert.equal(r.enviado, true);
  assert.equal(email.enviadas[0].para, "carla@amorimglobal.com");
  assert.deepEqual(bx.chamadas.filter((c) => c.metodo === "im.notify.system.add").map((c) => c.params.USER_ID), [6]);
  assert.deepEqual(bx.chamadas.find((c) => c.metodo === "crm.deal.update").params, { id: 501, fields: { UF_CRM_RV_ULT_AVISO: "C77:NEW" } });
});

test("tratar: sem e-mail configurado não faz nada; SMTP fora não grava a marca", async () => {
  const bx = chamarFalso();
  assert.deepEqual(await tratar({ negocio: vaga(), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA, email: null, chamar: bx.chamar }), { acao: "ignorar", motivo: "e-mail não configurado na Vercel" });
  assert.equal(bx.chamadas.length, 0);
  await assert.rejects(tratar({ negocio: vaga(), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA, email: emailFalso(true), chamar: bx.chamar, rhIds: ["6"] }), /SMTP fora/);
  assert.equal(bx.chamadas.length, 0);
});

test("tratar: quem pediu sem e-mail válido: o RH é avisado e a marca é gravada", async () => {
  const bx = chamarFalso(), email = emailFalso();
  const r = await tratar({ negocio: vaga({ UF_CRM_RV_EMAIL: "carla" }), etapas: ETAPAS_77, tipo: "vaga", evento: "ONCRMDEALADD", agora: AGORA, email, chamar: bx.chamar, rhIds: ["6"] });
  assert.equal(r.enviado, false);
  assert.equal(email.enviadas.length, 0);
  assert.equal(bx.chamadas.filter((c) => c.metodo === "im.notify.system.add").length, 1);
  assert.equal(bx.chamadas.filter((c) => c.metodo === "crm.deal.update").length, 1);
});

/* ---------------- api/eventos.js: eventos de negócio ---------------- */
const ENV = { BITRIX_EVENTO_TOKEN: "tok-saida", BITRIX_WEBHOOK_URL: "https://amorimglobal.bitrix24.com.br/rest/1/abc/", GP_AVISAR_IDS: "6, 1", GP_EXCECOES_IDS: "1", GP_CATEGORIA_OFFBOARDING: "91" };
function negociosFalsos() {
  const negocios = { 501: vaga(), 601: off(), 701: { ID: "701", CATEGORY_ID: "1", STAGE_ID: "C1:NEW" } };
  const chamadas = [];
  async function chamar(metodo, p) {
    chamadas.push({ metodo, p });
    switch (metodo) {
      case "crm.deal.get": return { dados: Object.assign({}, negocios[p.id]) };
      case "crm.deal.update": Object.assign(negocios[p.id], p.fields); return { dados: true };
      case "crm.dealcategory.stage.list": return { dados: (Number(p.id) === 77 ? ETAPAS_77 : ETAPAS_91).map((e, i) => ({ STATUS_ID: e.id, NAME: e.nome, SORT: (i + 1) * 10 })) };
      case "crm.stagehistory.list": return { dados: { items: [] } };
      case "im.notify.system.add": return { dados: 1 };
      default: throw new Error("método não simulado: " + metodo);
    }
  }
  return { negocios, chamadas, chamar };
}
async function eventoNegocio(bx, nome, id, inj) {
  const res = { statusCode: 0, setHeader() {}, end(b) { this.corpo = JSON.parse(b); } };
  const body = { event: nome, "data[FIELDS][ID]": String(id), "auth[application_token]": (inj && inj.token) || ENV.BITRIX_EVENTO_TOKEN };
  await handler({ method: "POST", headers: {}, body }, res, Object.assign({ env: ENV, chamar: bx.chamar, semCache: true, agora: AGORA }, inj || {}));
  return res;
}

test("eventos: vaga nova avisa uma vez; a gravação da marca volta como evento e não repete", async () => {
  const bx = negociosFalsos(), email = emailFalso();
  const r1 = await eventoNegocio(bx, "ONCRMDEALADD", 501, { email });
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.corpo.tipo, "vaga");
  assert.equal(r1.corpo.enviado, true);
  assert.equal(bx.negocios[501].UF_CRM_RV_ULT_AVISO, "C77:NEW");
  const r2 = await eventoNegocio(bx, "ONCRMDEALUPDATE", 501, { email });
  assert.equal(r2.corpo.acao, "ignorar");
  assert.equal(email.enviadas.length, 1);
  // o RH muda a etapa: novo e-mail, sem novo aviso ao RH
  bx.negocios[501].STAGE_ID = "C77:PREPARATION";
  const r3 = await eventoNegocio(bx, "ONCRMDEALUPDATE", 501, { email });
  assert.equal(r3.corpo.enviado, true);
  assert.match(email.enviadas[1].texto, /Em análise/);
  assert.equal(bx.chamadas.filter((c) => c.metodo === "im.notify.system.add").length, 1);
});

test("eventos: offboarding com a variável do funil; outro funil e e-mail desligado são ignorados", async () => {
  const bx = negociosFalsos(), email = emailFalso();
  const r = await eventoNegocio(bx, "ONCRMDEALADD", 601, { email });
  assert.equal(r.corpo.tipo, "offboarding");
  assert.equal(email.enviadas[0].para, "livia@amorimglobal.com");
  const outro = await eventoNegocio(bx, "ONCRMDEALUPDATE", 701, { email });
  assert.equal(outro.corpo.ignorado, "outro funil");
  assert.ok(!bx.chamadas.some((c) => c.metodo === "crm.dealcategory.stage.list" && Number(c.p.id) === 1));
  const semSmtp = await eventoNegocio(negociosFalsos(), "ONCRMDEALADD", 501, {});
  assert.match(semSmtp.corpo.ignorado, /e-mail não configurado/);
  const tokenErrado = await eventoNegocio(bx, "ONCRMDEALADD", 501, { email, token: "outro" });
  assert.equal(tokenErrado.statusCode, 401);
});
