// Férias e ausências (Políticas de Férias e Ausências do RH, 04/11/2026), feriados cadastrados pelo RH e as
// notificações do app, com os dados de demonstração (hoje = 08/10/2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const F = require("../src/js/53-ferias.js");
const N = require("../src/js/54-notificacoes.js");
const { dadosDemo } = require("../src/js/45-demo.js");

function contexto(euId, extra) {
  const d = dadosDemo();
  return dom.indexar(Object.assign({
    hoje: "2026-10-08", eu: { id: euId || "3", admin: false }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos,
    registros: d.registros, vagas: d.vagas, offboarding: d.offboarding,
    // o calendário do Bitrix não é lido (a empresa não usa): mesmo que o contexto traga datas dele, elas não entram
    feriados: { nacionais: [{ data: "2026-12-24", nome: "Feriado" }] },
  }, extra || {}));
}
const pessoa = (ctx, uid, extra) => Object.assign(F.dadosDaPessoa(ctx, uid), extra || {});
const feriado = (id, data, nome, abrangencia, considera, extra) => Object.assign({ id, titulo: nome, data, abrangencia, considera, estagio: "NEW", criadoEm: "2026-10-07T10:00:00-03:00" }, extra || {});

test("feriados: sem cadastro do RH, vale a lista oficial (lei + locais da Configuração), sem o calendário do Bitrix", () => {
  const ctx = contexto("3");
  const of = dom.feriadosDoAno(ctx, 2026);
  assert.ok(of.some((f) => f.data === "2026-11-20" && /Consciência Negra/.test(f.nome)), "o 20/11 é feriado nacional pela lei");
  assert.ok(!of.some((f) => f.data === "2026-12-24"), "data do calendário do Bitrix não entra");
  assert.ok(of.some((f) => f.data === "2026-06-24" && f.sigla === "BA"), "São João de Salvador, da Configuração");
  assert.ok(dom.feriadosDe(ctx, "SP").has("2026-11-20"));
  assert.ok(!dom.feriadosDe(ctx, "SP").has("2026-06-24") && dom.feriadosDe(ctx, "BA").has("2026-06-24"));
});

test("feriados: o calendário do RH substitui o ano inteiro; o que a empresa não considera vira dia útil", () => {
  const ctx = contexto("3");
  ctx.registros.feriados = [
    feriado("1", "2026-11-20", "Consciência Negra", "Todos", false), // a empresa decidiu trabalhar
    feriado("2", "2026-12-24", "Véspera de Natal", "Todos", true),
    feriado("3", "2026-11-25", "Recesso SP", "São Paulo (SP)", true),
  ];
  dom.indexar(ctx);
  assert.equal(dom.feriadosCadastrados(ctx, 2026).length, 3);
  const sp = dom.feriadosDe(ctx, "SP"), ba = dom.feriadosDe(ctx, "BA");
  assert.ok(!sp.has("2026-11-20"), "não considerado: dia útil");
  assert.ok(!sp.has("2026-12-25"), "o ano cadastrado substitui a lista oficial: o Natal só vale se o RH cadastrar");
  assert.ok(sp.has("2026-12-24") && ba.has("2026-12-24"));
  assert.ok(sp.has("2026-11-25") && !ba.has("2026-11-25"));
  assert.ok(sp.has("2027-01-01"), "2027 sem cadastro: segue a lista oficial");
  const cal = dom.calendarioFeriados(ctx, "2026-11-01", "2026-11-30");
  assert.deepEqual(cal.map((f) => [f.data, f.considera]), [["2026-11-20", false], ["2026-11-25", true]]);
  // a agenda lista o não considerado (como dia útil), mas a linha do tempo só marca o que vale
  const ag = dom.agendaEquipe(ctx, dom.equipeDe(ctx, "3").map((m) => dom.infoMembro(ctx, m)), { inicio: "2026-11-01", semanas: 8 });
  assert.ok(ag.feriados.some((f) => f.data === "2026-11-20" && !f.considera));
  assert.ok(!ag.feriadosNacionais.some((f) => f.data === "2026-11-20"));
});

test("férias: pedido dentro da política (segunda-feira, 60 dias, 15 dias, mais de 12 meses de contrato)", () => {
  const ctx = contexto("101");
  const r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-01-11", fim: "2027-01-25", cobertura: "Ana cobre." }, pessoa(ctx, "101"));
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.fora, []);
  assert.equal(r.dias, 15);
  assert.ok(r.ok.some((x) => /segunda-feira/.test(x)) && r.ok.some((x) => /12 meses/.test(x)));
});

test("férias: o que foge da política vira ponto a justificar, sem travar", () => {
  const ctx = contexto("101");
  const p = { tipo: "Férias", inicio: "2026-10-28", fim: "2026-11-06", cobertura: "Ana cobre." }; // quarta, 20 dias antes, 10 dias
  let r = F.conferirPedido(ctx, p, pessoa(ctx, "101"));
  assert.equal(r.fora.length, 3, r.fora.join(" | "));
  assert.ok(r.fora.some((x) => /segundas-feiras/.test(x)) && r.fora.some((x) => /20 dias de antecedência/.test(x)) && r.fora.some((x) => /10 dias corridos/.test(x)));
  // o day off do Bruno em 13/11 cruza um período que o inclua
  assert.ok(F.conferirPedido(ctx, { tipo: "Férias", inicio: "2026-11-09", fim: "2026-11-23", cobertura: "x" }, pessoa(ctx, "101")).fora.some((x) => /Já há um pedido seu nesse período \(day off, 13\/11\)/.test(x)));
  assert.deepEqual(r.erros, ["Explique na justificativa os pontos fora da política."]);
  r = F.conferirPedido(ctx, Object.assign({ justificativa: "Viagem de família marcada." }, p), pessoa(ctx, "101"));
  assert.deepEqual(r.erros, []);
  // cobertura é obrigatória nas férias
  assert.match(F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-01-11", fim: "2027-01-25" }, pessoa(ctx, "101")).erros[0], /cobertas/);
});

test("férias: cada pedido nas partes de 23, 15 ou 8 dias, sem saldo do ano; estágio segue a lei; a semana coletiva do fim de ano", () => {
  const ctx = contexto("100"); // Ana já pediu 15 dias em dezembro de 2026
  assert.equal(F.saldoFerias, undefined, "sem saldo por pessoa (04/11/2026): o RH confere o direito");
  let r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2026-12-07", fim: "2026-12-14", cobertura: "x" }, pessoa(ctx, "100"));
  assert.ok(r.fora.some((x) => /já há um pedido seu/i.test(x)), "sobrepõe o pedido de dezembro");
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2026-12-28", fim: "2027-01-11", cobertura: "x", justificativa: "x" }, pessoa(ctx, "100"));
  assert.ok(r.fora.some((x) => /férias coletivas entre o Natal de 2026/.test(x)));
  assert.ok(r.ok.some((x) => /15 dias corridos: uma das duas partes/.test(x)), "cada pedido é conferido sozinho, sem somar o ano");
  assert.ok(!r.fora.some((x) => /Somando/.test(x)));
  // estágio: sem a regra da segunda-feira e das partes
  const fer = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-02-03", fim: "2027-02-12", cobertura: "x" }, pessoa(ctx, "104"));
  assert.deepEqual(fer.fora, []);
  assert.ok(fer.ok.some((x) => /Estágio/.test(x)));
});

test("day off: mês do aniversário, longe de feriado e das férias", () => {
  const ctx = contexto("101"); // Bruno faz aniversário em 03/11
  const bruno = pessoa(ctx, "101");
  let r = F.conferirPedido(ctx, { tipo: "Day off", motivoDayOff: "Aniversário", inicio: "2026-11-24" }, bruno);
  assert.ok(r.fora.some((x) => /já há um day off de aniversário em 2026/i.test(x)), "Bruno já pediu o de 13/11");
  r = F.conferirPedido(ctx, { tipo: "Day off", motivoDayOff: "Aniversário", inicio: "2026-11-19", justificativa: "x" }, bruno);
  assert.ok(r.fora.some((x) => /20\/11\/2026/.test(x)), "véspera da Consciência Negra");
  r = F.conferirPedido(ctx, { tipo: "Day off", motivoDayOff: "Aniversário", inicio: "2026-12-09", justificativa: "x" }, bruno);
  assert.ok(r.fora.some((x) => /mês do aniversário \(novembro\)/.test(x)));
  // logo depois das férias da Ana (07/12 a 21/12, segunda): 22/12 encosta
  const ctxAna = contexto("100");
  r = F.conferirPedido(ctxAna, { tipo: "Day off", motivoDayOff: "Desempenho", inicio: "2026-12-22", justificativa: "x" }, pessoa(ctxAna, "100"));
  assert.ok(r.fora.some((x) => /logo antes ou logo depois das férias/.test(x)), r.fora.join(" | "));
  // sem aniversário cadastrado: o app avisa, e o RH confere
  r = F.conferirPedido(ctx, { tipo: "Day off", motivoDayOff: "Aniversário", inicio: "2026-11-24", justificativa: "x" }, Object.assign({}, bruno, { aniversario: "" }));
  assert.ok(r.fora.some((x) => /não está cadastrado/.test(x)));
  assert.ok(F.conferirPedido(ctx, { tipo: "Day off", inicio: "2026-11-24" }, bruno).erros.some((x) => /motivo/.test(x)));
});

test("pausa contratual: até 7 dias, só PJ e associação, sempre com justificativa", () => {
  const ctx = contexto("103");
  let r = F.conferirPedido(ctx, { tipo: "Pausa contratual", inicio: "2026-11-16", fim: "2026-11-24", cobertura: "x" }, pessoa(ctx, "103"));
  assert.deepEqual(r.erros, ["A pausa contratual pede justificativa por escrito."]);
  r = F.conferirPedido(ctx, { tipo: "Pausa contratual", inicio: "2026-11-16", fim: "2026-11-24", cobertura: "x", justificativa: "Mudança." }, pessoa(ctx, "103"));
  assert.ok(r.fora.some((x) => /9 dias corridos: o máximo é 7/.test(x)));
  r = F.conferirPedido(ctx, { tipo: "Pausa contratual", inicio: "2026-11-16", fim: "2026-11-18", cobertura: "x", justificativa: "x" }, pessoa(ctx, "104"));
  assert.ok(r.fora.some((x) => /só para contratos PJ e de associação \(o seu: Estágio\)/.test(x)));
});

test("prazos, situação e lista de cada um", () => {
  const ctx = contexto("6");
  const ana = ctx.idx.porId.ferias["300"], bruno = ctx.idx.porId.ferias["301"];
  assert.equal(F.prazoRH(ctx, ana), "2026-10-13"); // 07/10 (quarta) + 3 dias úteis; 12/10 é feriado
  assert.equal(F.prazoLideranca(ctx, bruno), "2026-10-09"); // RH em 07/10 + 2 dias úteis
  assert.deepEqual(F.situacao(ctx, ana), { texto: "Aguardando o RH", cor: "azul", prazo: "2026-10-13" });
  assert.equal(F.situacao(ctx, ctx.idx.porId.ferias["303"]).texto, "Cancelado");
  assert.deepEqual(F.paraRH(ctx).map((p) => p.id), ["300"]);
  assert.deepEqual(F.paraLideranca(ctx, "3").map((p) => p.id), ["301"]);
  assert.deepEqual(F.daEquipe(ctx, "4").map((p) => p.id).sort(), ["302", "303"]);
});

test("aprovado pelo RH e confirmado pela liderança: só então entra na agenda da equipe", () => {
  const ctx = contexto("4");
  const pessoas = dom.equipeDe(ctx, "4").map((m) => dom.infoMembro(ctx, m));
  const ag = dom.agendaEquipe(ctx, pessoas, { inicio: ctx.hoje, semanas: 13 });
  const igor = ag.linhas.find((l) => l.pessoa.userId === "110");
  assert.deepEqual(igor.ausencias.map((a) => [a.inicio, a.fim, a.volta]), [["2026-10-19", "2026-11-02", "2026-11-03"]]); // 02/11 é Finados: volta na terça
  const ctxCarla = contexto("3");
  const ag2 = dom.agendaEquipe(ctxCarla, dom.equipeDe(ctxCarla, "3").map((m) => dom.infoMembro(ctxCarla, m)), { inicio: ctxCarla.hoje, semanas: 13 });
  assert.ok(!ag2.linhas.find((l) => l.pessoa.userId === "100").ausencias.some((a) => a.origem === "app"), "o pedido da Ana ainda espera o RH");
});

test("e-mail do pedido: para o RH, com cópia para a liderança, pronto no Gmail e no e-mail do computador", () => {
  const ctx = contexto("100");
  const ana = ctx.idx.porId.ferias["300"];
  const e = F.emailDoPedido(ctx, Object.assign({}, ana, { foraDaPolitica: "Pedido com 30 dias de antecedência: a política pede pelo menos 60." }), pessoa(ctx, "100"));
  assert.equal(e.para, "hr@amorimlawfirm.com");
  assert.deepEqual(e.cc, ["carla.mendes@amorimglobal.com"]);
  assert.equal(e.assunto, "Solicitação de férias · Ana Ribeiro · 07/12 a 21/12");
  assert.match(e.corpo, /^Olá, RH e Carla,/);
  assert.match(e.corpo, /Período: de segunda, 07\/12\/2026 a segunda, 21\/12\/2026 \(15 dias corridos\)/);
  assert.match(e.corpo, /Cobertura das atividades: Bruno acompanha/);
  assert.match(e.corpo, /- Pedido com 30 dias de antecedência/);
  assert.ok(F.linkMailto(e).startsWith("mailto:hr@amorimlawfirm.com?cc=carla.mendes@amorimglobal.com&subject=Solicita%C3%A7%C3%A3o"));
  assert.match(F.linkGmail(e), /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=hr%40amorimlawfirm\.com&cc=carla\.mendes%40amorimglobal\.com&su=/);
  // a resposta do RH vai para quem pediu, com cópia para a liderança
  const r = F.emailDaDecisao(ctx, Object.assign({}, ana, { rhDecisao: "Aprovada", rhComentario: "Boas férias!" }), "rh");
  assert.equal(r.para, "ana.ribeiro@amorimglobal.com");
  assert.deepEqual(r.cc, ["carla.mendes@amorimglobal.com"]);
  assert.match(r.corpo, /O RH aprovou o seu pedido de férias .*Agora a sua liderança confirma, em até 2 dias úteis\.\n\nBoas férias!/s);
  const l = F.emailDaDecisao(ctx, Object.assign({}, ana, { liderancaDecisao: "Aprovada" }), "lideranca");
  assert.deepEqual(l.cc, ["hr@amorimlawfirm.com"]);
});

test("notificações: o pedido avisa o RH e a liderança; a decisão avisa quem pediu", () => {
  const rh = N.notificacoesDe(contexto("6"), "6");
  const t = rh.map((n) => n.titulo);
  assert.ok(t.includes("Ana Ribeiro pediu férias (07/12 a 21/12)"), t.join(" | "));
  assert.ok(rh.find((n) => n.id === "ferias-pedido-300").acao, "aguarda o RH");
  assert.ok(t.includes("Nova solicitação de vaga: Analista Tributário Júnior"), "vaga de 02/10");
  assert.ok(!t.some((x) => /Assistente de Imigração/.test(x)), "vaga de agosto: fora dos 30 dias");
  assert.ok(t.includes("Nova solicitação de encerramento de contrato: Igor Santos"), "esteira de offboarding");
  assert.ok(t.some((x) => /Solicitação de encerramento enviada ao RH: Fernanda Alves/.test(x)), "fluxo anterior do app");
  const carla = N.notificacoesDe(contexto("3"), "3");
  const tc = carla.map((n) => n.titulo);
  assert.ok(tc.includes("Ana Ribeiro pediu férias (07/12 a 21/12)"));
  assert.ok(tc.includes("O RH aprovou o pedido de Bruno Teixeira: falta a sua confirmação"));
  assert.ok(carla.find((n) => n.id === "ferias-rh-301").acao);
  assert.ok(tc.includes("Avalie a finalista Paula Nunes"));
  assert.ok(!tc.some((x) => /vaga/i.test(x)), "a liderança não é avisada das vagas que não pediu");
  const bruno = N.notificacoesDe(contexto("101"), "101");
  assert.deepEqual(bruno.map((n) => n.titulo), ["O RH aprovou o seu pedido de day off (13/11)"]);
  assert.deepEqual(N.notificacoesDe(contexto("100"), "100"), [], "o próprio pedido não notifica quem pediu");
  // a coordenação é avisada das vagas das lideranças do setor
  assert.ok(N.notificacoesDe(contexto("2"), "2").some((n) => n.titulo === "Nova solicitação de vaga: Analista Tributário Júnior"));
});

test("notificações: o lido é de cada pessoa, e o calendário mudado pelo RH avisa todo mundo", () => {
  const ctx = contexto("3");
  assert.equal(N.novas(ctx, "3", { visto: "" }), N.notificacoesDe(ctx, "3").length);
  assert.equal(N.novas(ctx, "3", { visto: "2026-10-07T23:00:00-03:00" }), 0);
  assert.equal(N.novas(ctx, "3", { visto: "2026-10-07T12:00:00-03:00" }), 1); // só o RH aprovar o day off do Bruno (15h) veio depois
  ctx.registros.feriados = [feriado("1", "2026-11-20", "Consciência Negra", "Todos", true, { atualizadoEm: "2026-10-08T09:00:00-03:00" })];
  dom.indexar(ctx);
  assert.ok(N.notificacoesDe(ctx, "100").some((n) => n.titulo === "O RH atualizou o calendário de feriados"));
  assert.ok(!N.notificacoesDe(ctx, "6").some((n) => /calendário de feriados/.test(n.titulo)), "o próprio RH não precisa do aviso");
});
