// Rotina diária (api/sincronizar.js + lib/sincronizacao-servidor.js) contra um Bitrix falso,
// no formato do webhook: result/next, IDs numéricos, campos ufCrm<id>... e stageId com prefixo.
const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const { dadosDemo } = require("../src/js/45-demo.js");
const handler = require("../api/sincronizar.js");

function bitrixFalso(mexer) {
  const d = dadosDemo();
  if (mexer) mexer(d);
  const tipoM = { id: 61, entityTypeId: 1300, title: schema.tituloProcesso(schema.processo("membros")) };
  const tipoO = { id: 63, entityTypeId: 1302, title: schema.tituloProcesso(schema.processo("onboarding")) };
  const cod = (t, chave, p) => schema.codigoCampo(t.id, schema.processo(p).campos.find((c) => c.chave === chave).sufixo);
  const estagio = (t, c) => "DT" + t.entityTypeId + "_7:" + c;
  const itens = { 1300: [], 1302: [] };
  let seq = 5000;
  d.registros.membros.forEach((m) => {
    const it = { id: Number(m.id), title: m.titulo, stageId: estagio(tipoM, m.estagio), assignedById: Number(m.responsavel) };
    it[cod(tipoM, "lideranca", "membros")] = Number(m.lideranca);
    it[cod(tipoM, "coordenacao", "membros")] = Number(m.coordenacao);
    itens[1300].push(it);
  });
  const chamadas = [];
  async function chamar(metodo, p) {
    chamadas.push({ metodo, p });
    const r = (dados) => ({ dados, proximo: null });
    switch (metodo) {
      case "crm.type.list": return r({ types: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }, tipoM, tipoO] });
      case "crm.category.list": return r({ categories: [{ id: 7, isDefault: "Y" }] });
      case "crm.status.list": {
        const t = p.filter.ENTITY_ID.indexOf("1300") >= 0 ? tipoM : tipoO;
        const proc = schema.processo(t === tipoM ? "membros" : "onboarding");
        return r(proc.estagios.map((e) => ({ STATUS_ID: estagio(t, e.codigo), NAME: e.nome })));
      }
      case "crm.item.fields": {
        const fields = {};
        fields[cod(tipoM, "cidade", "membros")] = { items: [{ ID: 901, VALUE: "São Paulo (SP)" }, { ID: 902, VALUE: "Salvador (BA)" }] };
        return r({ fields });
      }
      case "user.get": return r(d.usuarios.map((u) => ({ ID: u.id, NAME: u.nome.split(" ")[0], LAST_NAME: u.nome.split(" ").slice(1).join(" "), UF_DEPARTMENT: u.departamentos.map(Number), DATE_REGISTER: (u.registro || "2021-03-01") + "T10:00:00+03:00", USER_TYPE: u.tipo || "employee", PERSONAL_STATE: u.estado || "" })));
      case "department.get": return r(d.departamentos.map((x) => ({ ID: x.id, NAME: x.nome, PARENT: x.pai || undefined, UF_HEAD: x.chefe })));
      case "crm.item.list": return r({ items: itens[p.entityTypeId] });
      case "crm.item.add": { const it = Object.assign({ id: ++seq }, p.fields); itens[p.entityTypeId].push(it); return r({ item: it }); }
      case "crm.item.update": { Object.assign(itens[p.entityTypeId].find((x) => x.id === p.id), p.fields); return r({ item: {} }); }
      case "crm.timeline.comment.add": case "im.notify.system.add": return r(1);
      default: throw new Error("método não simulado: " + metodo);
    }
  }
  return { chamar, chamadas, itens, tipoM, tipoO, cod: (chave) => cod(tipoM, chave, "membros") };
}
function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  return r;
}
const ENV = { CRON_SECRET: "s3gredo", BITRIX_WEBHOOK_URL: "https://x/rest/1/abc/", GP_AVISAR_IDS: "6", GP_EXCECOES_IDS: "1" };

test("sem o segredo do cron: 401; sem configuração: 503", async () => {
  const r1 = resposta();
  await handler({ headers: { authorization: "Bearer errado" } }, r1, { env: ENV });
  assert.equal(r1.statusCode, 401);
  const r2 = resposta();
  await handler({ headers: {} }, r2, { env: {} });
  assert.equal(r2.statusCode, 503);
});

test("rotina diária: cria as lideranças, encerra quem saiu e avisa o RH", async () => {
  const bx = bitrixFalso((d) => { d.usuarios = d.usuarios.filter((u) => u.id !== "101"); });
  const res = resposta();
  await handler({ headers: { authorization: "Bearer s3gredo" } }, res, { env: ENV, chamar: bx.chamar, hoje: "2026-10-08" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.corpo));
  assert.equal(res.corpo.criados, 5);   // Livia, Carla, Marcos, Rafael e Helena; a CEO (1) está nas exceções
  assert.equal(res.corpo.encerrados, 1);
  assert.deepEqual(res.corpo.falhas, []);
  const novos = bx.itens[1300].filter((x) => x.id > 5000);
  const carla = novos.find((x) => x.assignedById === 3);
  assert.equal(carla[bx.cod("lideranca")], 2);
  assert.equal(carla.stageId, "DT1300_7:ATIVO");
  assert.equal(carla[bx.cod("cidade")], 901);
  const bruno = bx.itens[1300].find((x) => x.assignedById === 101);
  assert.equal(bruno.stageId, "DT1300_7:SUCCESS");
  const aviso = bx.chamadas.find((c) => c.metodo === "im.notify.system.add" && c.p.USER_ID === 6);
  assert.match(aviso.p.MESSAGE, /saída\(s\), movida\(s\) para Encerrado: Bruno Teixeira/);
  assert.ok(!bx.chamadas.some((c) => c.metodo === "im.notify.system.add" && c.p.USER_ID === 1), "a CEO (exceção) não recebe aviso");
  // segunda execução no mesmo dia: nada a fazer
  const res2 = resposta();
  await handler({ headers: { authorization: "Bearer s3gredo" } }, res2, { env: ENV, chamar: bx.chamar, hoje: "2026-10-08" });
  assert.equal(res2.corpo.criados + res2.corpo.atualizados + res2.corpo.encerrados, 0);
});

test("pessoa nova recente ganha o item em Onboarding e o onboarding ligado a ele", async () => {
  const bx = bitrixFalso((d) => { d.usuarios.push({ id: "130", nome: "Paula Nunes", departamentos: ["11"], registro: "2026-10-01", tipo: "employee", estado: "BA" }); });
  const res = resposta();
  await handler({ headers: { authorization: "Bearer s3gredo" } }, res, { env: ENV, chamar: bx.chamar, hoje: "2026-10-08" });
  const paula = bx.itens[1300].find((x) => x.assignedById === 130);
  assert.equal(paula.stageId, "DT1300_7:NEW");
  assert.equal(paula[bx.cod("cidade")], 902);
  const ob = bx.itens[1302].find((x) => x.assignedById === 130);
  assert.equal(ob["parentId1300"], paula.id);
  assert.equal(ob.stageId, "DT1302_7:NEW");
});
