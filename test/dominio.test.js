// Regras de negócio com os dados de demonstração (os 6 casos do protótipo, hoje = 08/10/2026).
// Os números esperados vêm da coluna "Exemplo" da 4.5 sempre que a especificação dá um.
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const { dadosDemo } = require("../src/js/45-demo.js");

function contexto(euId, hoje) {
  const d = dadosDemo();
  const h = hoje || "2026-10-08";
  return dom.indexar({
    hoje: h, eu: { id: euId || "3", admin: false }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos,
    registros: d.registros, ausencias: d.ausencias, vagas: d.vagas,
    feriados: { nacionais: calc.feriadosNacionais(2026).concat(calc.feriadosNacionais(2027)) },
  });
}
const nomes = (ctx, membros) => membros.map((m) => dom.infoMembro(ctx, m).nome.split(" ")[0]).sort();

test("papéis e equipe pela estrutura da empresa", () => {
  const ctx = contexto("3");
  assert.deepEqual(nomes(ctx, dom.equipeDe(ctx, "3")), ["Ana", "Bruno", "Daniela", "Eduardo", "Fernanda", "Gustavo"]);
  const carla = dom.papeis(ctx, "3");
  assert.ok(carla.lideranca && !carla.coordenacao && !carla.rh && !carla.enviaFormal);
  const livia = dom.papeis(ctx, "2");
  assert.ok(livia.coordenacao && livia.enviaFormal);
  assert.deepEqual(dom.liderancasDoSetor(ctx, "2").map((l) => l.lideranca.nome), ["Carla Mendes", "Marcos Lima", "Rafael Souza"]);
  assert.equal(dom.membrosVisiveis(ctx, "2").length, 13);
  assert.ok(dom.papeis(ctx, "1").ceo && !dom.papeis(ctx, "1").lideranca);
  assert.equal(dom.membrosVisiveis(ctx, "6").length, 13); // RH vê todas as equipes
});

test("1:1 do trimestre em dia: 2 de 3 (Ana e Eduardo agendados, Bruno sem data)", () => {
  const ctx = contexto("3");
  const ind = dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" });
  assert.equal(ind.um1a1.texto, "67% · 2 de 3");
  assert.deepEqual(nomes(ctx, ind.um1a1.faltam), ["Bruno"]);
});

test("Evidências registradas: 3 de 4 no 3º trimestre, falta Ana", () => {
  const ctx = contexto("3");
  const ind = dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" });
  assert.equal(ind.evidencias.texto, "75% · 3 de 4");
  assert.deepEqual(nomes(ctx, ind.evidencias.faltam), ["Ana"]);
});

test("Feedbacks SCI no trimestre: 2 (Ana em 02/10 e Fernanda em 07/10)", () => {
  const ctx = contexto("3");
  assert.equal(dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" }).feedbacksTrimestre, 2);
});

test("Pendências atrasadas: 2 (1:1 de Bruno e Ficha de Gustavo)", () => {
  const ctx = contexto("3");
  const ind = dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" });
  assert.equal(ind.atrasadas, 2);
  const atrasadas = ind.pendencias.filter((p) => p.atrasado).map((p) => p.titulo);
  assert.deepEqual(atrasadas.sort(), ["Agendar o 1:1 de Bruno", "Completar a Ficha de Gustavo"]);
  // atrasadas vêm primeiro na lista
  assert.ok(ind.pendencias[0].atrasado && ind.pendencias[1].atrasado && !ind.pendencias[2].atrasado);
  assert.equal(ind.situacao.rotulo, "Atenção"); // 2 atrasadas
});

test("Membros com feedback nos últimos 90 dias: o mais antigo é Eduardo, 31/08", () => {
  const ctx = contexto("3");
  const fb = dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" }).feedback90;
  assert.equal(fb.texto, "100% · 3 de 3");
  assert.equal(dom.infoMembro(ctx, fb.maisAntigo.membro).nome, "Eduardo Martins");
  assert.equal(fb.maisAntigo.data, "2026-08-31");
});

test("Conquistas recentes: 5 entre 08/09 e 08/10", () => {
  const ctx = contexto("3");
  const c = dom.indicadoresEquipe(ctx, dom.equipeDe(ctx, "3"), { uid: "3" }).conquistas;
  assert.equal(c.length, 5);
});

test("Onboarding da Daniela: dia 43, Ancoragem 85 contra patamar 60, Alinhamento 2 em 26/10", () => {
  const ctx = contexto("3");
  const s = dom.statusOnboarding(ctx, dom.onboardingDo(ctx, "3"));
  assert.equal(s.dia, 43);
  assert.equal(s.alinhamentos[0].nota, 85);
  assert.equal(s.alinhamentos[0].patamar, 60);
  assert.equal(s.alinhamentos[0].resultado, "Dentro do esperado");
  assert.equal(s.alinhamentos[1].data, "2026-10-26"); // Dia 60 cai num domingo
  assert.equal(s.alinhamentos[1].pendentesLeitura, 1);
  const g = dom.statusOnboarding(ctx, dom.onboardingDo(ctx, "6"));
  assert.ok(g.fichaAtrasada);
  assert.equal(g.prazoFicha, "2026-10-05");
});

test("Plano do Eduardo: dia 39 de 60, término 29/10", () => {
  const ctx = contexto("3");
  const s = dom.statusPlano(ctx, dom.planoAtivoDo(ctx, "4"));
  assert.equal(s.dia, 39);
  assert.equal(s.termino, "2026-10-29");
  assert.match(s.texto, /Dia 39 de 60/);
});

test("Verificação de registros do encerramento (bloqueios da 3.5.3)", () => {
  const ctx = contexto("3");
  const r1 = dom.verificarRegistros(ctx, "4", "Resultados abaixo do acordado", "");
  assert.equal(r1.ok, false);
  assert.deepEqual(r1.bloqueios, [dom.MSG_TRAVA]); // plano ainda em andamento
  const r2 = dom.verificarRegistros(ctx, "5", "Fim do prazo previsto no contrato", "  ");
  assert.deepEqual(r2.bloqueios, [dom.MSG_JUSTIFICATIVA]);
  assert.ok(dom.verificarRegistros(ctx, "5", "Fim do prazo previsto no contrato", "Contrato de estágio termina").ok);
  assert.ok(dom.verificarRegistros(ctx, "2", "Situação grave ou urgente", "").ok);

  // plano encerrado sem os resultados, com os 2 feedbacks: libera
  const plano = ctx.registros.planos.find((p) => p.membroId === "4");
  plano.estagio = "FAIL";
  ctx.registros.feedbacks.push({ id: "71", membroId: "4", data: "2026-10-29", tipo: "Encerramento de plano", estagio: "SUCCESS", retroativo: false, evidencia: [] });
  plano.feedbackEncerramentoId = "71";
  dom.indexar(ctx);
  const r3 = dom.verificarRegistros(ctx, "4", "Desalinhamento de perfil", "");
  assert.ok(r3.ok);
  assert.deepEqual(r3.feedbacks, ["70", "71"]);

  // retroativo sem anexo não conta (5.1)
  ctx.registros.feedbacks.find((f) => f.id === "71").retroativo = true;
  dom.indexar(ctx);
  assert.equal(dom.verificarRegistros(ctx, "4", "Resultados abaixo do acordado", "").ok, false);
});

test("Destino da solicitação: ninguém aprova o próprio pedido", () => {
  assert.equal(dom.destinoEncerramento({ bloqueado: true, motivo: "Resultados abaixo do acordado" }), "BLOQUEADA");
  assert.equal(dom.destinoEncerramento({ motivo: "Situação grave ou urgente", origem: "Plano encerrado sem os resultados" }), "ENVIADA_RH");
  assert.equal(dom.destinoEncerramento({ motivo: "Reestruturação da área", origem: "Formulário da coordenação" }), "ENVIADA_RH");
  assert.equal(dom.destinoEncerramento({ motivo: "Resultados abaixo do acordado", origem: "Plano encerrado sem os resultados" }), "AG_COORD");
  const ctx = contexto("3");
  assert.deepEqual(dom.aprovadorDe(ctx, { membroId: "4", coordenacao: "2", solicitante: "3" }), { rh: false, id: "2" });
  // coordenadora que é a liderança direta do membro: aprovação vai para o RH
  assert.deepEqual(dom.aprovadorDe(ctx, { membroId: "4", coordenacao: "2", solicitante: "2" }), { rh: true, id: "" });
});

test("Status do ciclo: Bruno sem agendamento desde 08/10 (Dia 7 = 07/10)", () => {
  const ctx = contexto("3");
  const s = dom.statusCiclo(ctx, dom.cicloDo(ctx, "2", "2026-T4"));
  assert.equal(s.chave, "sem-agenda");
  assert.equal(s.prazo, "2026-10-07");
  const ctx2 = contexto("3", "2026-10-07");
  assert.equal(dom.statusCiclo(ctx2, dom.cicloDo(ctx2, "2", "2026-T4")).chave, "agendar");
  // Ana: Q3 com 1:1 realizado e evidências pendentes até 15/10
  const ana = dom.statusCiclo(ctx, dom.cicloDo(ctx, "1", "2026-T3"));
  assert.equal(ana.chave, "evidencias");
  assert.equal(ana.prazo, "2026-10-15");
});

test("Agenda: Bruno volta em 19/10; 3 de 7 fora entre 26/12 e 02/01, com a liderança", () => {
  const ctx = contexto("3");
  const pessoas = dom.equipeDe(ctx, "3").map((m) => dom.infoMembro(ctx, m));
  pessoas.push(Object.assign({ userId: "3", cidadeSigla: "SP" }, dom.pessoa(ctx, "3")));
  const ag = dom.agendaEquipe(ctx, pessoas, { liderancaId: "3" });
  const bruno = ag.linhas.find((l) => l.pessoa.nome === "Bruno Teixeira");
  assert.equal(bruno.ausencias[0].volta, "2026-10-19");
  assert.equal(ag.pico.pessoas.length, 3);
  assert.equal(ag.aviso.pct.texto, "43% · 3 de 7");
  assert.ok(ag.aviso.comLideranca && ag.aviso.avisar);
  assert.equal(ag.proximos14.fora.length, 1);
  assert.equal(ag.aniversarios[0].pessoa.nome, "Daniela Rocha"); // 19/10
});

test("Coordenação: mapa das lideranças do setor, em ordem alfabética", () => {
  const ctx = contexto("2");
  const mapa = dom.mapaCoordenacao(ctx, "2");
  assert.deepEqual(mapa.map((l) => l.lideranca.nome), ["Carla Mendes", "Marcos Lima", "Rafael Souza"]);
  const marcos = mapa[1];
  assert.equal(marcos.ind.um1a1.texto, "33% · 1 de 3");
  assert.equal(marcos.ind.situacao.rotulo, "Precisa de apoio");
  assert.equal(marcos.ind.equilibrio.cor, "vermelho");
  const rafael = mapa[2];
  assert.equal(rafael.ind.situacao.rotulo, "Em dia");
});

test("Recrutamento: etapa, dias em aberto e tempo para fechar (28 dias)", () => {
  const ctx = contexto("3");
  const v = dom.vagasDe(ctx, "3");
  assert.deepEqual(v.map((x) => x.id).sort(), ["9001", "9002"]); // só as pedidas pela Carla
  const aberta = v.find((x) => x.id === "9001");
  assert.equal(aberta.posicao, 4);
  assert.equal(aberta.totalEtapas, 5);
  assert.equal(aberta.diasEmAberto, 24); // aprovada em 14/09
  assert.equal(v.find((x) => x.id === "9002").tempoParaFechar, 28);
  assert.equal(dom.vagasDe(ctx, "2").length, 3); // coordenação vê o setor
});

test("Dicas-modelo: reconhecer o progresso do Eduardo, Ficha do Gustavo, ordem das leituras, substituto", () => {
  const ctx = contexto("3");
  const ids = dom.dicas(ctx, dom.equipeDe(ctx, "3"), { uid: "3" }).map((d) => d.id);
  assert.ok(ids.indexOf("rec-plano-80") >= 0);
  assert.ok(ids.indexOf("ficha-61") >= 0);
  assert.ok(ids.indexOf("ordem-leituras") >= 0);
  assert.ok(ids.some((i) => i.indexOf("substituto-") === 0));
});

test("Bloqueio de edição em 48 horas", () => {
  assert.ok(dom.editavel("2026-10-07T18:10:00-03:00", "2026-10-08T10:00:00-03:00"));
  assert.ok(!dom.editavel("2026-10-02T17:30:00-03:00", "2026-10-08T10:00:00-03:00"));
});

test("Desempenho anual: 4 trimestres e nota das leituras do 1º trimestre = 94", () => {
  const ctx = contexto("3");
  const a = dom.anoDoMembro(ctx, "1", 2026);
  assert.equal(a.ciclos.length, 4);
  assert.equal(a.ciclos[0].notaLeituras, 94);
  assert.equal(a.classificados, 2);
});
