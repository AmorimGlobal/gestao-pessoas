// Sincronização com a estrutura da empresa (55-sync.js), com os dados de demonstração.
const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../src/js/55-sync.js");
const dom = require("../src/js/50-dominio.js");
const calc = require("../src/js/10-calc.js");
const { dadosDemo } = require("../src/js/45-demo.js");

const HOJE = "2026-10-08";
function entrada(mexer) {
  const d = dadosDemo();
  const e = { hoje: HOJE, usuarios: d.usuarios, departamentos: d.departamentos, membros: d.registros.membros, excecoes: [], ceos: ["1"] };
  if (mexer) mexer(e, d);
  return e;
}
const nomes = (lista, f) => lista.map(f).sort();

test("primeira execução: as lideranças sem item entram, a CEO fica de fora", () => {
  const p = sync.planejar(entrada());
  assert.deepEqual(nomes(p.criar, (c) => c.usuario.nome), ["Carla Mendes", "Helena Costa", "Livia Prado", "Marcos Lima", "Rafael Souza"]);
  const carla = p.criar.find((c) => c.usuario.id === "3");
  assert.equal(carla.lideranca, "2");      // chefe de Imigração -> a coordenação do setor
  assert.equal(carla.coordenacao, "2");
  assert.equal(carla.estagio, "ATIVO");    // cadastro antigo: não entra em onboarding
  const livia = p.criar.find((c) => c.usuario.id === "2");
  assert.equal(livia.lideranca, "1");      // coordenação responde à CEO
  assert.equal(p.atualizar.length, 0);     // os 13 itens da demonstração já batem com a estrutura
  assert.equal(p.encerrar.length, 0);
});

test("exceções (Fora do app) não ganham item", () => {
  const p = sync.planejar(entrada((e) => { e.excecoes = ["6"]; }));
  assert.ok(!p.criar.some((c) => c.usuario.id === "6"));
});

test("pessoa nova há menos de 90 dias entra com onboarding; cidade pela Bahia", () => {
  const p = sync.planejar(entrada((e) => {
    e.usuarios.push({ id: "130", nome: "Paula Nunes", departamentos: ["11"], registro: "2026-10-01", tipo: "employee", estado: "Bahia", cidade: "Salvador" });
  }));
  const paula = p.criar.find((c) => c.usuario.id === "130");
  assert.equal(paula.estagio, "NEW");
  assert.ok(paula.onboarding);
  assert.equal(paula.ingresso, "2026-10-01");
  assert.equal(paula.lideranca, "3");
  assert.equal(paula.cidade, "Salvador (BA)");
});

test("bots, extranet e usuários sem departamento ficam de fora", () => {
  const p = sync.planejar(entrada((e) => {
    e.usuarios.push({ id: "900", nome: "Bot do Chat", departamentos: ["11"], tipo: "bot" });
    e.usuarios.push({ id: "901", nome: "Cliente Extranet", departamentos: [], tipo: "extranet" });
  }));
  assert.ok(!p.criar.some((c) => ["900", "901"].indexOf(c.usuario.id) >= 0));
});

test("mudou de departamento: atualiza liderança direta e coordenação", () => {
  const p = sync.planejar(entrada((e) => { e.usuarios.find((u) => u.id === "100").departamentos = ["12"]; }));
  assert.equal(p.atualizar.length, 1);
  assert.deepEqual(p.atualizar[0].mudancas, { lideranca: "4" });
  assert.equal(p.atualizar[0].antes.lideranca, "3");
});

test("usuário desativado: o item vai para Encerrado", () => {
  const p = sync.planejar(entrada((e) => { e.usuarios = e.usuarios.filter((u) => u.id !== "101"); }));
  assert.deepEqual(p.encerrar.map((x) => x.membro.titulo), ["Bruno Teixeira"]);
  assert.equal(p.alerta, "");
});

test("proteção: muitas saídas de uma vez não são aplicadas sem confirmação", () => {
  const p = sync.planejar(entrada((e) => { e.usuarios = e.usuarios.filter((u) => ["100", "101", "102", "103", "104", "105"].indexOf(u.id) < 0); }));
  assert.equal(p.encerrar.length, 0);
  assert.equal(p.saidasRetidas.length, 6);
  assert.match(p.alerta, /6 saídas de uma vez/);
  const vazio = sync.planejar(entrada((e) => { e.usuarios = []; }));
  assert.equal(vazio.encerrar.length, 0);
  assert.match(vazio.alerta, /vazia/);
});

test("executar: cria, atualiza, encerra, comenta e avisa RH e liderança (sem conteúdo de registros)", async () => {
  const plano = sync.planejar(entrada((e) => {
    e.usuarios = e.usuarios.filter((u) => u.id !== "101");
    e.usuarios.find((u) => u.id === "100").departamentos = ["12"];
    e.usuarios.push({ id: "130", nome: "Paula Nunes", departamentos: ["11"], registro: "2026-10-01", tipo: "employee" });
  }));
  const log = { membros: [], onboarding: [], updates: [], comentarios: [], avisos: [] };
  let seq = 1000;
  const ops = {
    criarMembro: async (d) => { const it = Object.assign({ id: String(++seq) }, d); log.membros.push(it); return it; },
    criarOnboarding: async (d) => { log.onboarding.push(d); },
    atualizarMembro: async (id, d) => { log.updates.push({ id, d }); },
    comentar: async (id, t) => { log.comentarios.push({ id, t }); },
    notificar: async (ids, t) => { log.avisos.push({ ids, t }); },
    nomeDe: (id) => ({ "3": "Carla Mendes", "4": "Marcos Lima" })[id] || "",
  };
  const r = await sync.executar(plano, ops, { hoje: HOJE, avisarIds: ["6"] });
  assert.equal(r.falhas.length, 0);
  assert.equal(r.criados.length, 6);                    // 5 lideranças + Paula
  assert.equal(log.onboarding.length, 1);               // só a Paula (cadastro recente)
  assert.equal(log.onboarding[0].membroId, log.membros.find((m) => m.responsavel === "130").id);
  assert.ok(log.updates.some((u) => u.d.estagio === "SUCCESS"));
  assert.ok(log.updates.some((u) => u.d.lideranca === "4"));
  assert.ok(log.comentarios.some((c) => /Carla Mendes → Marcos Lima/.test(c.t)));
  assert.ok(log.comentarios.some((c) => /desativado no Bitrix/.test(c.t)));
  const rh = log.avisos.find((a) => a.ids[0] === "6");
  assert.match(rh.t, /6 entrada\(s\)/);
  assert.match(rh.t, /1 saída\(s\), movida\(s\) para Encerrado: Bruno Teixeira/);
  assert.ok(log.avisos.some((a) => a.ids[0] === "3" && /Paula Nunes/.test(a.t)));
  assert.ok(!log.avisos.some((a) => a.ids.indexOf("1") >= 0), "a CEO nunca recebe avisos");
});

test("executar: falha numa pessoa não impede as outras; limite deixa o resto para depois", async () => {
  const plano = sync.planejar(entrada());
  const ops = {
    criarMembro: async (d) => { if (d.responsavel === "4") throw new Error("ACCESS_DENIED"); return { id: "x" + d.responsavel }; },
    criarOnboarding: async () => {}, atualizarMembro: async () => {}, comentar: async () => {}, notificar: async () => {},
  };
  const r = await sync.executar(plano, ops, { hoje: HOJE });
  assert.equal(r.criados.length, 4);
  assert.equal(r.falhas.length, 1);
  const r2 = await sync.executar(plano, Object.assign({}, ops, { criarMembro: async (d) => ({ id: d.responsavel }) }), { hoje: HOJE, limite: 2 });
  assert.equal(r2.criados.length, 2);
  assert.equal(r2.pendentes, 3);
});

test("equipe pela estrutura: a liderança de área entra na equipe da coordenação", () => {
  const d = dadosDemo();
  d.registros.membros.push({ id: "50", responsavel: "3", titulo: "Carla Mendes", estagio: "ATIVO", lideranca: "", coordenacao: "" });
  const ctx = dom.indexar({ hoje: HOJE, eu: { id: "2" }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros, feriados: { nacionais: calc.feriadosNacionais(2026) } });
  assert.deepEqual(dom.equipeDe(ctx, "2").map((m) => m.titulo), ["Carla Mendes"]);
  assert.equal(dom.equipeDe(ctx, "3").length, 6); // a equipe da Carla continua a mesma
});
