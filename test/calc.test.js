// Casos de teste da coluna "Exemplo" da seção 4.5 da especificação.
// Rodar: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../src/js/10-calc.js");

const FERIADOS_2026 = c.conjuntoFeriados([c.feriadosNacionais(2026)]);

test("Dia do onboarding: Daniela, ingresso 27/08, está no dia 43 em 08/10", () => {
  assert.equal(c.diaN("2026-08-27", "2026-10-08"), 43);
  assert.equal(c.faseDoDia(43), "Imersão");
});

test("Dia do plano: Eduardo, plano desde 31/08, dia 39 de 60, término 29/10", () => {
  assert.equal(c.diaN("2026-08-31", "2026-10-08"), 39);
  assert.equal(c.terminoPlano("2026-08-31"), "2026-10-29");
});

test("Volta em: Bruno, fora até 16/10 (sexta), volta em 19/10", () => {
  assert.equal(c.fmtDiaSemana("2026-10-16"), "sexta");
  assert.equal(c.voltaEm("2026-10-16", FERIADOS_2026), "2026-10-19");
});

test("Prazo em feriado ou fim de semana passa para o próximo dia útil", () => {
  assert.equal(c.ajustarPrazo("2026-10-10", FERIADOS_2026), "2026-10-13"); // sáb → (12/10 é feriado) → 13/10
  assert.equal(c.ajustarPrazo("2026-10-14", FERIADOS_2026), "2026-10-14");
  const comSP = c.conjuntoFeriados([c.feriadosNacionais(2026), ["2026-07-09"]]);
  assert.equal(c.ajustarPrazo("2026-07-09", comSP), "2026-07-10");
});

test("Páscoa e Sexta-feira Santa", () => {
  assert.equal(c.pascoa(2026), "2026-04-05");
  assert.ok(c.feriadosNacionais(2026).some((f) => f.data === "2026-04-03" && f.nome === "Sexta-feira Santa"));
  assert.equal(c.pascoa(2027), "2027-03-28");
});

test("Atraso conta a partir do dia seguinte; 7 dias de atraso = prazo + 7", () => {
  assert.equal(c.diasAtraso("2026-10-08", "2026-10-08"), 0);
  assert.equal(c.diasAtraso("2026-10-08", "2026-10-09"), 1);
  assert.equal(c.dataAviso("2026-10-01", 7), "2026-10-08");
  assert.equal(c.diasAtraso("2026-10-01", "2026-10-08"), 7);
  assert.ok(c.pertoDoAvisoDe14("2026-10-01", "2026-10-08"));
  assert.ok(!c.pertoDoAvisoDe14("2026-10-01", "2026-10-15"));
});

test("Trimestres civis e prazo das evidências (fim + 15)", () => {
  const t = c.trimestreDe("2026-10-08");
  assert.deepEqual([t.chave, t.inicio, t.fim], ["2026-T4", "2026-10-01", "2026-12-31"]);
  assert.equal(c.trimestreDe("2026-02-28").fim, "2026-03-31");
  assert.equal(c.prazoEvidencias(c.trimestre(2026, 3)), "2026-10-15");
  assert.equal(c.trimestreAnterior(c.trimestre(2026, 1)).chave, "2025-T4");
});

test("Percentual: arredondamento e conta visível; denominador zero = sem dado", () => {
  assert.equal(c.percentual(5, 7).texto, "71% · 5 de 7");
  assert.equal(c.percentual(2, 3).texto, "67% · 2 de 3");
  assert.equal(c.percentual(1, 8).valor, 13); // 12,5 → 13
  assert.equal(c.percentual(0, 0).texto, "sem dado");
  assert.equal(c.percentual(7, 48).valor, 15); // rotatividade do exemplo
});

test("Nota do trimestre (média das leituras): Ana, 1º trimestre = 94", () => {
  assert.equal(c.notaDasLeituras(["Conforme", "Conforme", "Conforme", "Conforme", "Com ajuste"]), 94);
  assert.equal(c.notaDasLeituras([]), null);
});

test("Nota e resultado da fase: Daniela, Ancoragem (100 + 70) ÷ 2 = 85 contra 60", () => {
  const nota = c.notaDasLeituras(["Conforme", "Com ajuste"]);
  assert.equal(nota, 85);
  assert.equal(c.resultadoFase(nota, c.PATAMAR["Júnior"]["Ancoragem"], 0), "Dentro do esperado");
});

test("Resultado da fase: ordem Abaixo → Atenção → Dentro", () => {
  assert.equal(c.resultadoFase(44, 60, 0), "Abaixo do esperado"); // mais de 15 abaixo
  assert.equal(c.resultadoFase(45, 60, 0), "Atenção");            // exatamente 15 abaixo
  assert.equal(c.resultadoFase(90, 60, 2), "Abaixo do esperado"); // 2 fora do padrão
  assert.equal(c.resultadoFase(90, 60, 1), "Atenção");
  assert.equal(c.resultadoFase(60, 60, 0), "Dentro do esperado");
});

test("Situação da liderança: Carla, Marcos e Rafael", () => {
  assert.equal(c.situacaoLideranca(71, 2).rotulo, "Atenção");
  assert.equal(c.situacaoLideranca(55, 3).rotulo, "Precisa de apoio");
  assert.equal(c.situacaoLideranca(88, 1).rotulo, "Em dia");
  assert.equal(c.situacaoLideranca(90, 2).rotulo, "Atenção");
  assert.equal(c.situacaoLideranca(null, 0).rotulo, "Em dia");
});

test("Equilíbrio dos feedbacks: Carla 2:3 amarelo, Lucas 1:4 vermelho", () => {
  assert.deepEqual(c.equilibrioFeedbacks(2, 3), { texto: "2 : 3", cor: "ambar" });
  assert.deepEqual(c.equilibrioFeedbacks(1, 4), { texto: "1 : 4", cor: "vermelho" });
  assert.equal(c.equilibrioFeedbacks(3, 0).cor, "verde");
  assert.equal(c.equilibrioFeedbacks(1, 3).cor, "ambar"); // 1:3 não está abaixo de 1:3
});

test("Pessoas fora no mesmo período: 3 de 7 entre 26/12 e 02/01", () => {
  const aus = [
    { pessoa: "a", inicio: "2026-12-26", fim: "2027-01-02" },
    { pessoa: "b", inicio: "2026-12-28", fim: "2027-01-05" },
    { pessoa: "c", inicio: "2026-12-30", fim: "2027-01-01" },
  ];
  const pico = c.picoAusencias(aus, "2026-12-20", "2027-01-10");
  assert.equal(pico.pessoas.length, 3);
  const aviso = c.avisoParaPlanejar(pico.pessoas, 7, "x");
  assert.equal(aviso.pct.texto, "43% · 3 de 7");
  assert.ok(aviso.avisar);
  assert.ok(c.avisoParaPlanejar(["lid", "b"], 10, "lid").comLideranca);
});

test("Tempo para fechar a vaga: 28 dias, de 28/08 a 25/09", () => {
  assert.equal(c.diffDias("2026-08-28", "2026-09-25"), 28);
});

test("Alinhamentos do onboarding nos Dias 30, 60 e 90 com regra do dia útil", () => {
  const al = c.datasAlinhamentos("2026-08-27", FERIADOS_2026);
  assert.equal(c.dataDoDia("2026-08-27", 30), "2026-09-25");
  assert.deepEqual(al.map((a) => a.data), ["2026-09-25", "2026-10-26", "2026-11-24"]); // Dia 60 = 25/10 (domingo) → 26/10
});

test("Mediana do tempo para preencher vaga", () => {
  assert.equal(c.mediana([20, 34, 50]), 34);
  assert.equal(c.mediana([30, 38]), 34);
  assert.equal(c.mediana([]), null);
});
