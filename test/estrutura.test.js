// Estrutura oficial com setores sem chefe no Bitrix (organograma de 21/10/2026): Solutions é coordenado
// por supervisoras adjuntas, que a API não informa, e Gestão não tem chefe. Customer Services tem chefe.
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const sync = require("../src/js/55-sync.js");

const HOJE = "2026-10-21";
const DEPTOS = [
  { id: "1", nome: "AMORIM", pai: "", chefe: "1" },
  { id: "10", nome: "Solutions", pai: "1", chefe: "" },
  { id: "11", nome: "Imigração", pai: "10", chefe: "3" },
  { id: "12", nome: "Tributário", pai: "10", chefe: "4" },
  { id: "20", nome: "Customer Services", pai: "1", chefe: "20" },
  { id: "21", nome: "Atendimento", pai: "20", chefe: "22" },
  { id: "30", nome: "Gestão", pai: "1", chefe: "" },
  { id: "31", nome: "Administrativo & Financeiro", pai: "30", chefe: "5" },
];
const u = (id, nome, depto) => ({ id, nome, departamentos: [depto], tipo: "employee", registro: "2024-01-10", email: nome.split(" ")[0].toLowerCase() + "@amorimglobal.com" });
const USUARIOS = [
  u("1", "Giselle Amorim", "1"), u("40", "Taily Fiori", "10"), u("41", "Rafaela Osorio", "10"),
  u("3", "Carla Mendes", "11"), u("100", "Ana Ribeiro", "11"), u("101", "Bruno Teixeira", "11"),
  u("4", "Marcos Lima", "12"), u("102", "Daniela Rocha", "12"),
  u("20", "Michelle Tavares", "20"), u("22", "Pedro Basile", "21"), u("200", "Igor Santos", "21"),
  u("5", "Juliana Soares", "31"), u("300", "Kátia Moraes", "31"),
];

/** Roda a sincronização como a primeira carga faria e devolve os itens do Membros resultantes */
function primeiraCarga() {
  const plano = sync.planejar({ hoje: HOJE, usuarios: USUARIOS, departamentos: DEPTOS, membros: [], excecoes: [], ceos: ["1"] });
  let seq = 500;
  const membros = plano.criar.map((c) => ({ id: String(++seq), titulo: c.usuario.nome, responsavel: c.usuario.id, estagio: c.estagio, lideranca: c.lideranca, coordenacao: c.coordenacao }));
  return { plano, membros };
}
function contexto(membros) {
  return dom.indexar({
    hoje: HOJE, eu: { id: "40" }, config: { papeis: { coordenacao: [{ id: "40" }, { id: "41" }], ceo: [{ id: "1" }] } },
    usuarios: USUARIOS, departamentos: DEPTOS, registros: { membros }, feriados: { nacionais: calc.feriadosNacionais(2026) },
  });
}
const de = (membros, uid) => membros.find((m) => m.responsavel === uid);

test("1ª carga: onde há chefe, a estrutura decide; em setor sem chefe, nada de palpite e o RH confere", () => {
  const { plano, membros } = primeiraCarga();
  assert.deepEqual([de(membros, "100").lideranca, de(membros, "100").coordenacao], ["3", ""]); // Ana: liderança clara, coordenação não
  assert.deepEqual([de(membros, "3").lideranca, de(membros, "3").coordenacao], ["", ""]);     // Carla chefia uma área de Solutions
  assert.deepEqual([de(membros, "200").lideranca, de(membros, "200").coordenacao], ["22", "20"]); // Customer Services tem chefe
  assert.deepEqual([de(membros, "20").lideranca, de(membros, "20").coordenacao], ["1", "1"]); // a chefe do setor responde à CEO
  assert.ok(!de(membros, "1"), "a CEO não ganha item");
  const conferir = plano.conferir.map((x) => x.usuario.id);
  ["3", "100", "4", "102", "40", "41", "5", "300"].forEach((id) => assert.ok(conferir.indexOf(id) >= 0, "faltou conferir " + id));
  assert.match(plano.conferir.find((x) => x.usuario.id === "3").motivo, /Solutions não tem chefe no Bitrix/);
  assert.ok(conferir.indexOf("200") < 0 && conferir.indexOf("20") < 0);
});

test("Configuração → Setores sem chefe: cada área ganha a sua coordenação, e a chefe da área responde a ela", () => {
  const { membros } = primeiraCarga();
  const ctx = contexto(membros);
  const setores = dom.setoresSemChefe(ctx);
  assert.deepEqual(setores.map((s) => s.depto.nome), ["Solutions", "Gestão"]);
  const sol = setores[0];
  assert.deepEqual(sol.grupos.map((g) => (g.direto ? "direto" : g.depto.nome)), ["direto", "Imigração", "Tributário"]);
  const escolha = { direto: "1", Imigração: "40", Tributário: "41" };
  sol.grupos.forEach((g) => dom.mudancasSetorSemChefe(ctx, g, escolha[g.direto ? "direto" : g.depto.nome]).forEach((x) => Object.assign(x.membro, x.dados)));
  assert.deepEqual([de(membros, "3").lideranca, de(membros, "3").coordenacao], ["40", "40"]);
  assert.deepEqual([de(membros, "100").lideranca, de(membros, "100").coordenacao], ["3", "40"]); // a liderança da Ana continua a Carla
  assert.deepEqual([de(membros, "4").lideranca, de(membros, "102").coordenacao], ["41", "41"]);
  assert.deepEqual([de(membros, "40").lideranca, de(membros, "40").coordenacao], ["1", "1"]); // as adjuntas respondem à CEO

  const ctx2 = contexto(membros);
  assert.deepEqual(dom.equipeDe(ctx2, "40").map((m) => m.titulo), ["Carla Mendes"]);
  assert.deepEqual(dom.equipeDe(ctx2, "3").map((m) => m.titulo).sort(), ["Ana Ribeiro", "Bruno Teixeira"]);
  const setorTaily = dom.liderancasDoSetor(ctx2, "40");
  assert.deepEqual(setorTaily.map((l) => l.lideranca.nome), ["Carla Mendes"]);
  assert.equal(setorTaily[0].equipe.length, 2);
  assert.deepEqual(dom.membrosVisiveis(ctx2, "40").map((m) => m.titulo).sort(), ["Ana Ribeiro", "Bruno Teixeira", "Carla Mendes"]);
  const p = dom.papeis(ctx2, "40");
  assert.equal(p.coordenacao && p.lideranca, true);
  // a checagem não reclama de Solutions, só de Gestão, que ainda não foi definida
  const estrutura = dom.checagemImplantacao(ctx2).find((x) => x.chave === "estrutura");
  assert.ok(!estrutura.problemas.some((t) => /Solutions|Taily|Rafaela/.test(t)), estrutura.problemas.join(" | "));
  assert.ok(estrutura.problemas.some((t) => /Gestão não tem chefe/.test(t)));
});

test("sincronização seguinte: não desfaz o que foi definido e repete a coordenação para quem entra na área", () => {
  const { membros } = primeiraCarga();
  const ctx = contexto(membros);
  const sol = dom.setoresSemChefe(ctx)[0];
  const escolha = { direto: "1", Imigração: "40", Tributário: "41" };
  sol.grupos.forEach((g) => dom.mudancasSetorSemChefe(ctx, g, escolha[g.direto ? "direto" : g.depto.nome]).forEach((x) => Object.assign(x.membro, x.dados)));
  const novos = USUARIOS.concat([u("103", "Eduardo Martins", "11"), u("42", "Nova Adjunta", "10")]);
  const plano = sync.planejar({ hoje: HOJE, usuarios: novos, departamentos: DEPTOS, membros, excecoes: [], ceos: ["1"] });
  assert.ok(!plano.atualizar.some((a) => ["3", "100", "4", "40"].indexOf(a.usuario.id) >= 0), JSON.stringify(plano.atualizar.map((a) => [a.usuario.id, a.mudancas])));
  const eduardo = plano.criar.find((c) => c.usuario.id === "103");
  assert.deepEqual([eduardo.lideranca, eduardo.coordenacao], ["3", "40"]); // coordenação herdada da área
  assert.ok(!plano.conferir.some((x) => x.usuario.id === "103"));
  const nova = plano.criar.find((c) => c.usuario.id === "42");
  assert.equal(nova.lideranca, "", "liderança nunca é herdada");
  assert.ok(plano.conferir.some((x) => x.usuario.id === "42"));
});

test("Customer Services (com chefe) segue a estrutura como antes", () => {
  const { membros } = primeiraCarga();
  const ctx = contexto(membros);
  assert.deepEqual(dom.equipeDe(ctx, "22").map((m) => m.titulo), ["Igor Santos"]);
  assert.deepEqual(dom.liderancasDoSetor(ctx, "20").map((l) => l.lideranca.nome), ["Pedro Basile"]);
});
