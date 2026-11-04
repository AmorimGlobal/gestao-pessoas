// Formulários do app (04/11/2026): Solicitação de Contratação (funil 77) e Solicitação de Encerramento de
// Contrato (funil 79). Perguntas condicionais, campos do card, a regra dos 2 registros de feedback e o
// histórico que vai para a timeline, com os dados de demonstração (hoje = 08/10/2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const F = require("../src/js/52-formularios.js");
const { dadosDemo } = require("../src/js/45-demo.js");

function contexto(euId) {
  const d = dadosDemo();
  return dom.indexar({
    hoje: "2026-10-08", eu: { id: euId || "3", admin: false }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos,
    registros: d.registros, ausencias: d.ausencias, vagas: d.vagas,
    feriados: { nacionais: calc.feriadosNacionais(2026).concat(calc.feriadosNacionais(2027)) },
  });
}

/** Uma Solicitação de Contratação completa, como a liderança preencheria */
function vagaCompleta() {
  return {
    UF_CRM_RV_DEPTO: "Imigração", UF_CRM_RV_SETOR: "Soluções", UF_CRM_RV_LIDER: "Carla Mendes", UF_CRM_RV_COORD: "Livia Prado",
    UF_CRM_RV_VAGA: "  Analista de Imigração Pleno ", UF_CRM_RV_MODELO: "Híbrido", UF_CRM_RV_URGENCIA: F.VAGA.secoes[0].campos[6].opcoes[2],
    UF_CRM_RV_SENIOR: "Pleno", UF_CRM_RV_SENIOR_OUT: "Analista bilíngue", // digitado antes de trocar para Pleno
    UF_CRM_RV_SENIOR_JUS: "Carteira com casos de cidadania sem supervisão diária.", UF_CRM_RV_DOR: "Fila de pareceres acima de 10 dias.",
    UF_CRM_RV_MOTIVO: "Aumento de demanda operacional", UF_CRM_RV_ALTERN: ["Automação", "Priorização de demandas"],
    UF_CRM_RV_RISCO_REC: "Médio", UF_CRM_RV_RISCO_CLI: "Alto", UF_CRM_RV_RISCO_OPE: "Médio", UF_CRM_RV_RISCO_PRJ: "Baixo", UF_CRM_RV_RISCO_SOB: "Alto", UF_CRM_RV_RISCO_TRN: "Médio", UF_CRM_RV_RISCO_OUT: "",
    UF_CRM_RV_ATIVIDADE: "Pareceres de elegibilidade e acompanhamento dos protocolos.", UF_CRM_RV_COMP_TEC: "Direito migratório; inglês avançado.",
    UF_CRM_RV_COMP_COMP: [], UF_CRM_RV_PERFIL: F.VAGA.secoes[3].campos[4].opcoes[3], UF_CRM_RV_EXPERIEN: "", UF_CRM_RV_FIT: "", UF_CRM_RV_DATA_ENT: "2026-12-01",
  };
}

test("vaga: as perguntas \"Outro\" só são obrigatórias quando aparecem", () => {
  let falta = F.faltando(F.VAGA, { UF_CRM_RV_SENIOR: "Pleno", UF_CRM_RV_ALTERN: ["Automação"], UF_CRM_RV_RISCO_OUT: "" });
  ["UF_CRM_RV_SENIOR_OUT", "UF_CRM_RV_ALTERN_OUT", "UF_CRM_RV_RISCO_DSC", "UF_CRM_RV_COMP_OUT"].forEach((k) => assert.ok(!falta.includes(k), k));
  assert.ok(!falta.includes("UF_CRM_RV_RISCO_OUT"), "a linha Outro da grade é opcional");
  assert.ok(!falta.includes("UF_CRM_RV_COMP_COMP"), "competências comportamentais são opcionais, como no formulário 259");
  assert.ok(falta.includes("UF_CRM_RV_RISCO_REC"));
  falta = F.faltando(F.VAGA, { UF_CRM_RV_SENIOR: "Outro", UF_CRM_RV_ALTERN: ["Outro"], UF_CRM_RV_RISCO_OUT: "Alto", UF_CRM_RV_COMP_COMP: ["Outro"], UF_CRM_RV_MOTIVO: "Outro" });
  ["UF_CRM_RV_SENIOR_OUT", "UF_CRM_RV_ALTERN_OUT", "UF_CRM_RV_RISCO_DSC", "UF_CRM_RV_COMP_OUT", "UF_CRM_RV_MOTIVO_OUT"].forEach((k) => assert.ok(falta.includes(k), k));
});

test("vaga: o formulário completo vira os campos do card, sem as respostas escondidas", () => {
  const r = vagaCompleta();
  assert.deepEqual(F.faltando(F.VAGA, r), []);
  const campos = F.camposDoNegocio(F.VAGA, r);
  assert.equal(campos.UF_CRM_RV_VAGA, "Analista de Imigração Pleno");
  assert.equal(campos.UF_CRM_RV_SENIOR, "Pleno");
  assert.equal(campos.UF_CRM_RV_SENIOR_OUT, undefined, "o \"Outro\" desmarcado não deixa o texto no card");
  assert.deepEqual(campos.UF_CRM_RV_ALTERN, ["Automação", "Priorização de demandas"]);
  assert.equal(campos.UF_CRM_RV_RISCO_OUT, undefined);
  assert.equal(campos.UF_CRM_RV_COMP_COMP, undefined);
  assert.match(campos.UF_CRM_RV_PERFIL, /^Analistas — detalhistas/);
  assert.ok(Object.keys(campos).every((k) => /^UF_CRM_RV_/.test(k)));
  // as 32 perguntas do formulário 259, menos o e-mail (vem do login)
  assert.equal(F.campos(F.VAGA).filter((c) => /^UF_CRM_RV_/.test(c.codigo)).length, 31);
});

test("vaga: quem pede vem do login (departamento, setor, nome e coordenação)", () => {
  const ctx = contexto("3");
  const carla = F.inicialVaga(ctx, "3");
  assert.equal(carla.UF_CRM_RV_DEPTO, "Imigração");
  assert.equal(carla.UF_CRM_RV_SETOR, "Soluções");
  assert.equal(carla.UF_CRM_RV_LIDER, "Carla Mendes");
  assert.equal(carla.UF_CRM_RV_COORD, "Livia Prado");
  assert.equal(carla.coordenacaoId, "2");
  const livia = F.inicialVaga(ctx, "2"); // a própria coordenação
  assert.equal(livia.UF_CRM_RV_COORD, "Livia Prado");
  assert.equal(livia.UF_CRM_RV_SETOR, "Soluções");
});

test("encerramento: o membro escolhido preenche a área, a coordenação, a liderança e o cargo", () => {
  const ctx = contexto("4");
  const igor = F.inicialEncerramento(ctx, "7");
  assert.equal(igor.UF_CRM_OFF_SETOR, "Soluções · Tributário");
  assert.equal(igor.UF_CRM_OFF_SOLICIT, "Coordenação: Livia Prado · Liderança: Marcos Lima");
  assert.equal(igor.UF_CRM_OFF_CARGO, "Tributário · Analista"); // sem cargo no perfil: a função do Membros
  assert.equal(igor.nome, "Igor Santos");
  const ana = F.inicialEncerramento(ctx, "1");
  assert.equal(ana.UF_CRM_OFF_CARGO, "Analista de Imigração"); // cargo do perfil do Bitrix
  assert.deepEqual(F.inicialEncerramento(ctx, "999"), {});
});

test("encerramento: redistribuição só sem sucessor e sem contratação prevista; riscos aceitam \"nenhum\"", () => {
  const sem = (r) => F.faltando(F.ENCERRAMENTO, r);
  assert.ok(!sem({ UF_CRM_OFF_SUCESSOR: "Não", UF_CRM_OFF_REPOSICAO: "Sim" }).includes("UF_CRM_OFF_REDISTRIB"));
  assert.ok(sem({ UF_CRM_OFF_SUCESSOR: "Não", UF_CRM_OFF_REPOSICAO: "Em avaliação" }).includes("UF_CRM_OFF_REDISTRIB"));
  assert.ok(sem({ UF_CRM_OFF_SUCESSOR: "Não", UF_CRM_OFF_REPOSICAO: "Não" }).includes("UF_CRM_OFF_REDISTRIB"));
  assert.ok(!sem({ UF_CRM_OFF_SUCESSOR: "Sim", UF_CRM_OFF_REPOSICAO: "Não" }).includes("UF_CRM_OFF_REDISTRIB"));
  assert.ok(sem({ UF_CRM_OFF_MOTIVO: "Outro" }).includes("UF_CRM_OFF_MOT_OUT"));
  // "Nenhum desses pontos" responde a pergunta obrigatória e deixa o campo vazio no card
  assert.ok(!sem({ UF_CRM_OFF_RISCOS: [F.NENHUM] }).includes("UF_CRM_OFF_RISCOS"));
  assert.ok(sem({ UF_CRM_OFF_RISCOS: [] }).includes("UF_CRM_OFF_RISCOS"));
  assert.equal(F.camposDoNegocio(F.ENCERRAMENTO, { UF_CRM_OFF_RISCOS: [F.NENHUM] }).UF_CRM_OFF_RISCOS, undefined);
  assert.deepEqual(F.camposDoNegocio(F.ENCERRAMENTO, { UF_CRM_OFF_RISCOS: ["Projetos críticos", "Outro"], UF_CRM_OFF_RISCO_OUT: " Viagem marcada " }),
    { UF_CRM_OFF_RISCOS: ["Projetos críticos", "Outro"], UF_CRM_OFF_RISCO_OUT: "Viagem marcada" });
  // o membro (campo do app) e os anexos (arquivo) não vão como texto
  assert.deepEqual(F.camposDoNegocio(F.ENCERRAMENTO, { membroId: "7", UF_CRM_OFF_FEEDBACKS: "Sim", UF_CRM_OFF_ANEXOS: [{}] }), { UF_CRM_OFF_FEEDBACKS: "Sim" });
});

test("encerramento: no mínimo 2 registros de feedback para desempenho ou incompatibilidade, contando os SCI do app", () => {
  let c = F.conferirRegistros({ UF_CRM_OFF_MOTIVO: "Desempenho abaixo da média", UF_CRM_OFF_FEEDBACKS: "Sim" }, 1, 0);
  assert.equal(c.ok, false);
  assert.equal(c.minimo, 2);
  assert.match(c.mensagem, /no mínimo 2 registros/);
  assert.match(c.mensagem, /Há 1 feedback SCI de desenvolvimento no app\./);
  assert.ok(F.conferirRegistros({ UF_CRM_OFF_MOTIVO: "Incompatibilidade com a função", UF_CRM_OFF_FEEDBACKS: "Sim" }, 1, 1).ok);
  assert.ok(F.conferirRegistros({ UF_CRM_OFF_MOTIVO: "Desempenho abaixo da média", UF_CRM_OFF_FEEDBACKS: "Não" }, 2, 0).ok);
  c = F.conferirRegistros({ UF_CRM_OFF_MOTIVO: "Otimização de Custos", UF_CRM_OFF_FEEDBACKS: "Sim" }, 0, 0);
  assert.equal(c.minimo, 1);
  assert.equal(c.ok, false);
  c = F.conferirRegistros({ UF_CRM_OFF_MOTIVO: "Otimização de Custos", UF_CRM_OFF_FEEDBACKS: "Não se aplica" }, 0, 0);
  assert.equal(c.minimo, 0);
  assert.ok(c.ok);
  const ctx = contexto("4");
  assert.equal(F.feedbacksDeDesenvolvimento(ctx, "9").length, 2);
  assert.equal(F.feedbacksDeDesenvolvimento(ctx, "4").length, 1); // "Abertura de plano" conta como desenvolvimento
  assert.equal(F.feedbacksDeDesenvolvimento(ctx, "10").length, 0); // só reconhecimento
});

test("encerramento: o histórico vai para a timeline do card (planos embaixo, 1:1 no meio, SCI no alto)", () => {
  const ctx = contexto("3");
  const t = F.historicoEncerramento(ctx, "4", { quem: "Carla Mendes", registradoPor: "", data: "2026-10-08" }); // Eduardo: plano, 1:1 e feedback
  assert.equal(t.length, 3);
  assert.match(t[0], /^\[B\]Planos de melhoria de Eduardo Martins\[\/B\]/);
  assert.match(t[0], /Resultado esperado 1: Responder os clientes/);
  assert.match(t[0], /Check-in de 29\/09\/2026: Tempo de resposta caiu para 3 dias/);
  assert.match(t[1], /^\[B\]1:1 mensais de Eduardo Martins\[\/B\]/);
  assert.match(t[1], /\[B\]24\/09\/2026 · 1:1 de setembro\[\/B\] · registrado por Carla Mendes/);
  assert.match(t[1], /Como o membro está: Mais tranquilo depois do check-in do plano\./);
  assert.match(t[2], /^\[B\]Feedbacks SCI de Eduardo Martins\[\/B\]/);
  assert.match(t[2], /enviada por Carla Mendes em 08\/10\/2026\. 1 registro, em 31\/08\/2026: 1 de desenvolvimento\./);
  assert.match(t[2], /Comportamento: 4 de 6 pareceres voltaram para ajuste/);
  assert.ok(!/Precisa de apoio:/.test(t[1]), "pergunta sem resposta não vira linha vazia");
  // Ana: 2 feedbacks (o mais novo primeiro) e 2 1:1
  const ana = F.historicoEncerramento(ctx, "1", { quem: "Helena Costa", registradoPor: "Fernando", data: "2026-10-08" });
  assert.equal(ana.length, 2);
  assert.match(ana[1], /2 registros, de 20\/07\/2026 a 02\/10\/2026: 1 de desenvolvimento e 1 de reconhecimento\./);
  assert.ok(ana[1].indexOf("02/10/2026 · Feedback de reconhecimento") < ana[1].indexOf("20/07/2026 · Feedback de desenvolvimento"));
  assert.match(ana[0], /enviada por Helena Costa \(registrado por Fernando\)/);
  // nada registrado: o RH fica sabendo que não há
  const igor = F.historicoEncerramento(ctx, "7", { quem: "Marcos Lima", data: "2026-10-08" });
  assert.equal(igor.length, 2);
  assert.match(igor[0], /Nenhum 1:1 mensal registrado no app\./);
});

test("o card recém-criado entra na lista da tela no formato do crm.deal.list", () => {
  const n = F.negocioLocal({ id: 321, titulo: "Encerramento · Igor Santos", estagio: "C79:NEW", agora: "2026-10-08T10:00:00Z", campos: { UF_CRM_OFF_MOTIVO: "Outro" }, origem: { sistema: "gestao-pessoas", id: "7" } });
  assert.deepEqual(n, { ID: "321", TITLE: "Encerramento · Igor Santos", STAGE_ID: "C79:NEW", DATE_CREATE: "2026-10-08T10:00:00Z", DATE_MODIFY: "2026-10-08T10:00:00Z", ORIGINATOR_ID: "gestao-pessoas", ORIGIN_ID: "7", UF_CRM_OFF_MOTIVO: "Outro" });
});
