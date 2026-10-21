// Estrutura com a forma do portal em 21/10/2026 (department.get), com nomes de pessoas fictícios:
// - Solutions e Gestão sem chefe; as áreas abaixo têm chefe (Immigration, International Law...).
// - As "supervisoras adjuntas" de Solutions aparecem na API lotadas direto em Solutions e chefiam áreas.
// - Subgrupos sem chefe (Relacionamento, Acompanhamento, SDR) respondem ao chefe acima.
// - Gente em mais de um departamento: vale o mais específico.
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const sync = require("../src/js/55-sync.js");

const HOJE = "2026-10-21";
const D = (id, nome, pai, chefe) => ({ id, nome, pai: pai || "", chefe: chefe || "" });
const DEPTOS = [
  D("1", "AMORIM", "", "1"),
  D("183", "Solutions", "1"),
  D("207", "Immigration", "183", "40"),
  D("493", "Europeia", "207", "41"),
  D("509", "Relacionamento", "493"),
  D("497", "EUA+", "207", "40"),
  D("525", "Desenvolvimento", "497", "43"),
  D("687", "Acompanhamento", "525"),
  D("215", "International Law", "183", "44"),
  D("601", "Famílias Internacionais", "215", "44"),
  D("211", "Customer Services", "1", "20"),
  D("443", "SDR", "211"),
  D("475", "Gestão", "1"),
  D("477", "Administrativo & Financeiro", "475", "5"),
  D("833", "Comitê de Inovação", "475", "1"),
];
const u = (id, nome, deptos) => ({ id, nome, departamentos: deptos, tipo: "employee", registro: "2024-01-10", email: id + "@amorimglobal.com" });
const USUARIOS = [
  u("1", "Clara CEO", ["833", "1"]),
  u("40", "Tatiana Coord", ["183", "207", "497"]),   // adjunta de Solutions, chefe de Immigration e EUA+
  u("41", "Renata Regional", ["493", "183"]),        // adjunta de Solutions, chefe de Europeia
  u("43", "Vera Dev", ["525", "497"]),               // chefe de Desenvolvimento
  u("44", "Marina Law", ["601", "215"]),             // chefe de International Law
  u("100", "Ana Relac", ["509"]),
  u("101", "Ari Acomp", ["687", "497"]),
  u("102", "Gil Familias", ["601", "215"]),
  u("20", "Mila CS", ["833", "211"]),
  u("200", "Sara SDR", ["443"]),
  u("5", "Julia Adm", ["477"]),
  u("300", "Kim Adm", ["477"]),
  u("301", "Leti Gestao", ["475"]),
];
const porDepto = {};
DEPTOS.forEach((d) => { porDepto[d.id] = d; });
const est = (id) => {
  const usr = USUARIOS.find((x) => x.id === id);
  return [dom.liderancaPelaEstrutura(porDepto, id, usr.departamentos), dom.coordenacaoPelaEstrutura(porDepto, id, usr.departamentos)];
};

test("liderança direta e coordenação pela estrutura real", () => {
  assert.deepEqual(est("100"), ["41", "40"]); // Relacionamento (sem chefe) -> Europeia; coordenação = chefe de Immigration
  assert.deepEqual(est("41"), ["40", "40"]);  // a chefe de Europeia responde à chefe de Immigration
  assert.deepEqual(est("40"), ["1", "1"]);    // a chefe de Immigration responde à CEO
  assert.deepEqual(est("101"), ["43", "40"]); // Acompanhamento (mais específico que EUA+) -> Desenvolvimento
  assert.deepEqual(est("43"), ["40", "40"]);
  assert.deepEqual(est("102"), ["44", "44"]); // International Law
  assert.deepEqual(est("44"), ["1", "1"]);
  assert.deepEqual(est("200"), ["20", "20"]); // SDR (sem chefe) -> Customer Services
  assert.deepEqual(est("20"), ["1", "1"]);    // também no Comitê de Inovação, chefiado pela CEO: o resultado é o mesmo
  assert.deepEqual(est("300"), ["5", "5"]);   // Gestão sem chefe: a chefe da área coordena
  assert.deepEqual(est("5"), ["1", "1"]);
  assert.deepEqual(est("301"), ["1", "1"]);   // direto em Gestão: a CEO
});

test("departamento principal: o mais específico; empate fica com o primeiro da lista", () => {
  assert.equal(dom.deptoPrincipal(porDepto, ["687", "497"]), "687");
  assert.equal(dom.deptoPrincipal(porDepto, ["183", "207", "497"]), "497");
  assert.equal(dom.deptoPrincipal(porDepto, ["833", "211"]), "833");
  assert.equal(dom.deptoPrincipal(porDepto, ["999"]), null);
});

test("1ª carga: todo mundo com liderança e coordenação, nada para conferir, nada de setor sem chefe", () => {
  const plano = sync.planejar({ hoje: HOJE, usuarios: USUARIOS, departamentos: DEPTOS, membros: [], excecoes: [], ceos: ["1"] });
  assert.equal(plano.criar.length, USUARIOS.length - 1); // a CEO fica de fora
  assert.deepEqual(plano.conferir, []);
  const membros = plano.criar.map((c, i) => ({ id: String(500 + i), titulo: c.usuario.nome, responsavel: c.usuario.id, estagio: c.estagio, lideranca: c.lideranca, coordenacao: c.coordenacao }));
  const ctx = dom.indexar({
    hoje: HOJE, eu: { id: "40" }, config: { papeis: { coordenacao: [{ id: "40" }, { id: "41" }], ceo: [{ id: "1" }] } },
    usuarios: USUARIOS, departamentos: DEPTOS, registros: { membros }, feriados: { nacionais: calc.feriadosNacionais(2026) },
  });
  assert.deepEqual(dom.setoresSemChefe(ctx), []);
  assert.deepEqual(dom.equipeDe(ctx, "40").map((m) => m.titulo).sort(), ["Renata Regional", "Vera Dev"]);
  assert.deepEqual(dom.equipeDe(ctx, "41").map((m) => m.titulo), ["Ana Relac"]);
  // a coordenação de Immigration vê as lideranças abaixo dela, inclusive as das regiões
  assert.deepEqual(dom.liderancasDoSetor(ctx, "40").map((l) => l.lideranca.nome).sort(), ["Renata Regional", "Vera Dev"]);
  assert.deepEqual(dom.membrosVisiveis(ctx, "40").map((m) => m.titulo).sort(), ["Ana Relac", "Ari Acomp", "Renata Regional", "Vera Dev"]);
  const estrutura = dom.checagemImplantacao(ctx).find((x) => x.chave === "estrutura");
  assert.deepEqual(estrutura.problemas, []);
  // a segunda execução não muda nada
  const plano2 = sync.planejar({ hoje: HOJE, usuarios: USUARIOS, departamentos: DEPTOS, membros, excecoes: [], ceos: ["1"] });
  assert.equal(plano2.criar.length + plano2.atualizar.length + plano2.encerrar.length, 0);
});

test("sem chefe nenhum no caminho: vale o item do Membros, a sincronização não troca e o RH confere", () => {
  const deptos = [D("1", "Raiz"), D("2", "Setor"), D("3", "Área", "2")].map((d) => (d.id === "2" ? Object.assign(d, { pai: "1" }) : d));
  const usuarios = [u("7", "Pessoa A", ["3"]), u("8", "Pessoa B", ["3"])];
  const plano = sync.planejar({ hoje: HOJE, usuarios, departamentos: deptos, membros: [], excecoes: [], ceos: [] });
  assert.equal(plano.conferir.length, 2);
  assert.match(plano.conferir[0].motivo, /não tem chefe no Bitrix/);
  const membros = [
    { id: "1", titulo: "Pessoa A", responsavel: "7", estagio: "ATIVO", lideranca: "9", coordenacao: "9" },
    { id: "2", titulo: "Pessoa B", responsavel: "8", estagio: "ATIVO", lideranca: "", coordenacao: "" },
  ];
  const plano2 = sync.planejar({ hoje: HOJE, usuarios, departamentos: deptos, membros, excecoes: [], ceos: [] });
  assert.ok(!plano2.atualizar.some((a) => a.membro.id === "1"), "não desfaz o que foi gravado");
  const b = plano2.atualizar.find((a) => a.membro.id === "2");
  assert.deepEqual(b.mudancas, { coordenacao: "9" }); // herda a coordenação de quem está na mesma área; a liderança não
  const ctx = dom.indexar({ hoje: HOJE, eu: { id: "9" }, config: {}, usuarios, departamentos: deptos, registros: { membros }, feriados: { nacionais: [] } });
  assert.deepEqual(dom.equipeDe(ctx, "9").map((m) => m.titulo), ["Pessoa A"]);
  assert.equal(dom.setoresSemChefe(ctx).length, 1);
});
