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

test("férias pela política (PJ e associação): 23 dias em qualquer dia da semana, depois dos 12 meses e dos 60 dias, sem conflito na equipe", () => {
  const ctx = contexto("101"); // Bruno: associado desde 02/05/2023
  const r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-02-06", fim: "2027-02-28" }, pessoa(ctx, "101")); // sábado
  assert.deepEqual(r.erros, [], r.erros.join(" | "));
  assert.deepEqual(r.fora, []);
  assert.equal(r.dias, 23);
  assert.ok(r.ok.some((x) => /Contrato desde 02\/05\/2023/.test(x)) && r.ok.some((x) => /Sem conflito na equipe/.test(x)) && r.ok.some((x) => /os 23 dias de uma vez/.test(x)));
  assert.ok(!r.ok.concat(r.fora, r.erros).some((x) => /segunda-feira/.test(x)), "as férias começam em qualquer dia da semana (06/11/2026)");
  // a cobertura vira observação opcional: a regra da equipe cobre o período
  assert.ok(!r.erros.some((x) => /cobertas/.test(x)));
});

test("férias pela política: o que não pode trava o pedido (60 dias, ciclo, divisão, equipe, semana coletiva)", () => {
  const ctx = contexto("101");
  const bruno = pessoa(ctx, "101");
  let r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2026-10-28", fim: "2026-11-06" }, bruno); // 20 dias antes, 10 dias, passa de outubro
  assert.equal(r.erros.length, 3, r.erros.join(" | "));
  assert.ok(r.erros.some((x) => /60 dias de antecedência: a primeira data possível é 07\/12\/2026/.test(x)));
  assert.ok(r.erros.some((x) => /passa do fim do ciclo \(31\/10\/2026\)/.test(x)));
  assert.ok(r.erros.some((x) => /10 dias corridos: a política aceita 23 dias de uma vez, ou 7 \+ 16, ou 8 \+ 15/.test(x)));
  assert.deepEqual(r.fora, [], "nada vira ponto a justificar: o pedido não sai");
  // a equipe: as férias da Ana (07/12 a 21/12, aguardando o RH) ocupam a data
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2026-12-10", fim: "2027-01-01" }, bruno);
  assert.deepEqual(r.erros, ["Já reservado na sua equipe: 07/12 a 21/12 (aguardando o RH). A data fica com quem pediu primeiro."]);
  // as datas da equipe vindas do servidor valem no lugar das que o login lê
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-03-01", fim: "2027-03-23" }, bruno, { reservas: [{ inicio: "2027-03-20", fim: "2027-03-27", situacao: "Aprovada" }] });
  assert.match(r.erros[0], /Já reservado na sua equipe: 20\/03 a 27\/03 \(aprovada\)/);
  // a semana coletiva escolhida no mesmo pedido não pode cair no período
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-02-06", fim: "2027-02-28" }, bruno, { junto: [{ coletiva: true, inicio: "2027-02-08", fim: "2027-02-12" }] });
  assert.ok(r.erros.some((x) => /cai na sua semana de férias coletivas/.test(x)));
  // a semana coletiva: uma das duas do ciclo, sem antecedência nem regra da equipe
  r = F.conferirPedido(ctx, { tipo: "Férias", coletiva: true, inicio: "2026-12-28", fim: "2027-01-01" }, bruno);
  assert.deepEqual(r.erros, []);
  assert.match(r.ok[0], /fora dos 23 dias e da regra da equipe/);
  r = F.conferirPedido(ctx, { tipo: "Férias", coletiva: true, inicio: "2026-12-22", fim: "2026-12-26" }, bruno);
  assert.deepEqual(r.erros, ["A semana de férias coletivas é de 21/12 a 25/12 ou de 28/12 a 01/01."]);
});

test("férias: o ciclo de novembro a outubro, as semanas coletivas, a abertura aos 10 meses e o que falta no ciclo", () => {
  assert.deepEqual(F.cicloDe("2026-10-08"), { ano: 2025, inicio: "2025-11-01", fim: "2026-10-31", rotulo: "nov/2025 a out/2026" });
  assert.equal(F.proximoCiclo(F.cicloDe("2026-10-08")).rotulo, "nov/2026 a out/2027");
  assert.deepEqual(F.semanasColetivas(F.cicloDe("2026-12-01")).map((s) => s.inicio + "/" + s.fim), ["2026-12-21/2026-12-25", "2026-12-28/2027-01-01"]);
  assert.deepEqual(F.semanasColetivas(F.cicloDe("2027-12-01")).map((s) => s.inicio + "/" + s.fim), ["2027-12-20/2027-12-24", "2027-12-27/2027-12-31"], "Natal num sábado");
  assert.equal(F.addMeses("2026-01-31", 1), "2026-02-28");
  // o protótipo: contrato em 10/12/2025 → primeira data 11/12/2026; contrato em 01/05/2026 → abre em 01/03/2027
  assert.equal(F.liberacao({ ingresso: "2025-12-10" }, "2026-11-05").primeiraData, "2027-01-04", "60 dias depois de hoje, que vem depois dos 12 meses");
  assert.equal(F.liberacao({ ingresso: "2025-12-10" }, "2026-08-01").primeiraData, "2026-12-11", "o dia seguinte aos 12 meses");
  const nova = F.liberacao({ ingresso: "2026-05-01" }, "2026-11-05");
  assert.deepEqual([nova.aberta, nova.abreEm, nova.completa12], [false, "2027-03-01", "2027-05-01"]);
  const ctx = contexto("100"); // Ana pediu 15 dias em dezembro de 2026 (aguardando o RH)
  const ana = pessoa(ctx, "100");
  let r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-03-01", fim: "2027-03-23" }, ana);
  assert.deepEqual(r.erros, ["Neste ciclo falta o período de 8 dias (você já pediu 15)."]);
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-03-01", fim: "2027-03-08" }, ana);
  assert.deepEqual(r.erros, []);
  assert.ok(r.ok.some((x) => /a parte que faltava do ciclo/.test(x)));
  // abre aos 10 meses
  r = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-06-01", fim: "2027-06-23" }, Object.assign({}, ana, { ingresso: "2026-05-01" }));
  assert.ok(r.erros.some((x) => /abre em 01\/03\/2027, quando você completa 10 meses de contrato/.test(x)));
  // 7 + 16 pedidos juntos: cada parte confere com a outra
  const bruno = pessoa(ctx, "101");
  const p7 = { tipo: "Férias", inicio: "2027-03-01", fim: "2027-03-07" }, p16 = { tipo: "Férias", inicio: "2027-05-01", fim: "2027-05-16" };
  assert.deepEqual(F.conferirPedido(ctx, p7, bruno, { junto: [p16] }).erros, []);
  assert.deepEqual(F.conferirPedido(ctx, p16, bruno, { junto: [p7] }).erros, []);
  assert.deepEqual(F.conferirPedido(ctx, p7, bruno, { junto: [{ tipo: "Férias", inicio: "2027-05-01", fim: "2027-05-15" }] }).erros, ["Neste ciclo falta o período de 8 dias (você já pediu 15)."]);
  // o que resta no ciclo
  assert.equal(F.restanteDoCiclo([]).modalidades.length, 3);
  assert.equal(F.restanteDoCiclo([{ dias: 16 }]).falta, 7);
  assert.equal(F.restanteDoCiclo([{ dias: 7 }, { dias: 16 }]).completo, true);
  assert.equal(F.restanteDoCiclo([{ dias: 10 }]).foraDaRegra, true, "parte antiga fora da regra: o RH confere");
  // estágio e CLT: a lei vale para a duração e a divisão
  const fer = F.conferirPedido(ctx, { tipo: "Férias", inicio: "2027-02-03", fim: "2027-02-12", cobertura: "x" }, pessoa(ctx, "104"));
  assert.deepEqual(fer.fora, []);
  assert.ok(fer.ok.some((x) => /Estágio: vale a legislação/.test(x)));
  assert.equal(F.segueALei({ contrato: "CLT" }), true);
  assert.equal(F.segueALei({ contrato: "" }), false, "sem contrato no cadastro, vale a política");
});

test("férias: as datas de início do formulário e as datas da equipe (quem pediu primeiro fica com a data)", () => {
  const ctx = contexto("101");
  const bruno = pessoa(ctx, "101");
  // a equipe do Bruno (liderança: Carla): as férias da Ana e do Gustavo, sem nomes
  assert.deepEqual(F.reservasDaEquipe(ctx, "101"), [{ inicio: "2026-12-07", fim: "2026-12-21", situacao: "Aguardando o RH" }, { inicio: "2026-12-28", fim: "2027-01-05", situacao: "Aprovada" }]);
  assert.deepEqual(F.reservasDaEquipe(ctx, "100").map((r) => r.inicio), ["2026-12-28"], "o próprio pedido não conta");
  assert.deepEqual(F.reservasDaEquipe(ctx, "3"), [], "a Carla: ninguém mais com a liderança dela (Livia)");
  const ciclo = F.cicloDe("2026-12-01");
  const ops = F.opcoesDeInicio(ctx, ciclo, 23, { pessoa: bruno, reservas: F.reservasDaEquipe(ctx, "101"), coletiva: F.semanasColetivas(ciclo)[1], outros: F.pedidosDe(ctx, "101") });
  assert.equal(ops[0].inicio, "2026-12-07", "a primeira data possível (hoje + 60 dias)");
  assert.equal(ops[ops.length - 1].fim, "2027-10-31", "o último período termina no fim do ciclo");
  assert.equal(ops.find((o) => o.inicio === "2026-12-07").bloqueio, "sua semana de férias coletivas");
  assert.equal(ops.find((o) => o.inicio === "2027-01-02").bloqueio, "já reservado na equipe");
  assert.equal(ops.find((o) => o.inicio === "2027-02-06").bloqueio, "", "sábado livre");
  // a conferência de quem decide: o pedido de depois cruza com o de antes, e o RH vê com quem
  ctx.registros.ferias.push({ id: "390", titulo: "Férias · Bruno Teixeira", responsavel: "101", lideranca: "3", autor: "101", tipo: "Férias", inicio: "2026-12-14", fim: "2026-12-29", dias: 16,
    estagio: "NEW", regrasLidasEm: "2026-10-08T09:00:00-03:00", criadoEm: "2026-10-08T09:00:00-03:00" });
  dom.indexar(ctx);
  const doBruno = F.conferenciaParaDecidir(ctx, ctx.idx.porId.ferias["390"]).map((x) => (x.ok ? "ok " : "! ") + x.texto);
  assert.ok(doBruno.some((x) => /^! Cruza com Ana Ribeiro \(07\/12 a 21\/12, aguardando o RH\), pedido antes deste: a data fica com essa pessoa/.test(x)), doBruno.join(" | "));
  const daAna = F.conferenciaParaDecidir(ctx, ctx.idx.porId.ferias["300"]).map((x) => x.texto);
  assert.ok(daAna.some((x) => /Cruza com Bruno Teixeira .*pedido depois deste: a data fica com este pedido/.test(x)), daAna.join(" | "));
  assert.ok(daAna.indexOf("Início após 12 meses de contrato") >= 0);
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

test("ausências aprovadas: só as da etapa Aprovada, por data; cada visão vê as suas", () => {
  const ctx = contexto("6");
  const todas = F.registradas(ctx).map((p) => p.id);
  assert.deepEqual(todas, ["310", "302", "311", "312", "313", "314"]);
  assert.ok(!todas.includes("300") && !todas.includes("301"), "pedido em andamento não é ausência aprovada");
  assert.ok(!todas.includes("303"), "o pedido cancelado fica fora");
  assert.deepEqual(F.visiveisPara(ctx, "6", "rh").map((p) => p.id), todas);
  // a Carla: a equipe dela e a própria ausência, sem a equipe do Marcos (o Igor)
  assert.deepEqual(F.visiveisPara(ctx, "3", "lideranca").map((p) => p.id), ["310", "311", "312", "313", "314"]);
  // o membro: só as suas
  assert.deepEqual(F.visiveisPara(ctx, "101", "membro").map((p) => p.id), ["310"]);
  assert.deepEqual(F.visiveisPara(ctx, "101", "lideranca").map((p) => p.id), ["310"], "sem equipe: só as suas");
  // daqui em diante: o que já terminou sai da lista
  assert.deepEqual(F.proximas(F.registradas(ctx), "2026-11-03").map((p) => p.id), ["311", "312", "313", "314"]);
  // na conferência contam os pedidos em andamento e as aprovadas; o cancelado, não
  assert.deepEqual(F.pedidosDe(ctx, "111"), [], "o pedido cancelado não conta");
  assert.deepEqual(F.pedidosDe(ctx, "101").map((p) => p.id), ["301", "310"]);
  assert.deepEqual(F.pedidosDe(ctx, "101", "301").map((p) => p.id), ["310"], "o item em edição fica fora da conferência dele mesmo");
});

test("pedidos no app (05/11/2026): o RH analisa, depois a liderança confirma, cada um no prazo da política", () => {
  const ctx = contexto("6");
  const p = (id) => ctx.idx.porId.ferias[id];
  assert.equal(F.ehPedido(p("300")), true, "pedido feito no app: leu as regras");
  assert.equal(F.ehPedido(p("302")), false, "registrada direto pelo RH");
  // a Ana pediu em 07/10: o RH responde em até 3 dias úteis (12/10 é feriado)
  assert.equal(F.prazoRH(ctx, p("300")), "2026-10-13");
  assert.deepEqual(F.situacao(ctx, p("300")), { texto: "Aguardando o RH", cor: "azul", prazo: "2026-10-13" });
  // o RH aprovou o day off do Bruno em 07/10: a Carla confirma em até 2 dias úteis
  assert.equal(F.prazoLideranca(ctx, p("301")), "2026-10-09");
  assert.deepEqual(F.situacao(ctx, p("301")), { texto: "Aguardando a liderança", cor: "ambar", prazo: "2026-10-09" });
  assert.equal(F.situacao(Object.assign({}, ctx, { hoje: "2026-10-14" }), p("300")).cor, "vermelho", "prazo vencido");
  assert.equal(F.situacao(ctx, p("303")).texto, "Cancelado");
  assert.equal(F.situacao(ctx, p("302")).texto, "Registrada pelo RH");
  assert.equal(F.situacao(ctx, Object.assign({}, p("301"), { estagio: "SUCCESS", liderancaDecisao: "Aprovada" })).texto, "Aprovado");
  assert.equal(F.situacao(ctx, Object.assign({}, p("301"), { estagio: "FAIL", liderancaDecisao: "Recusada" })).texto, "Devolvido pela liderança");
  assert.equal(F.situacao(ctx, Object.assign({}, p("300"), { estagio: "FAIL", rhDecisao: "Recusada" })).texto, "Devolvido pelo RH");
  // quem espera quem
  assert.deepEqual(F.paraRH(ctx).map((x) => x.id), ["300"]);
  assert.deepEqual(F.paraLideranca(ctx, "3").map((x) => x.id), ["301"]);
  assert.deepEqual(F.paraLideranca(ctx, "4"), []);
  // quem decide agora: o RH no "Aguardando o RH"; a liderança direta no "Aguardando a liderança"; ninguém o próprio pedido
  assert.equal(F.decisorDoPedido(ctx, "6", true, p("300")), "rh");
  assert.equal(F.decisorDoPedido(ctx, "6", true, p("301")), "", "o RH já decidiu; agora é a liderança");
  assert.equal(F.decisorDoPedido(ctx, "3", false, p("301")), "lideranca");
  assert.equal(F.decisorDoPedido(ctx, "3", false, p("300")), "", "a liderança espera o RH");
  assert.equal(F.decisorDoPedido(ctx, "100", true, p("300")), "", "nem o RH decide o próprio pedido");
  // o que cada um enxerga, em qualquer etapa
  assert.equal(F.pedidosVisiveis(ctx, "6", "rh").length, 9);
  assert.deepEqual(F.pedidosVisiveis(ctx, "3", "lideranca").map((x) => x.id).sort(), ["300", "301", "310", "311", "312", "313", "314"]);
  assert.deepEqual(F.pedidosVisiveis(ctx, "100", "membro").map((x) => x.id), ["300"]);
  assert.deepEqual(F.pedidosVisiveis(ctx, "111", "membro").map((x) => x.id), ["303"]);
});

test("a ausência registrada entra na agenda da equipe; a de outra etapa, não", () => {
  const ctx = contexto("4");
  const pessoas = dom.equipeDe(ctx, "4").map((m) => dom.infoMembro(ctx, m));
  const ag = dom.agendaEquipe(ctx, pessoas, { inicio: ctx.hoje, semanas: 13 });
  const igor = ag.linhas.find((l) => l.pessoa.userId === "110");
  assert.deepEqual(igor.ausencias.map((a) => [a.inicio, a.fim, a.volta]), [["2026-10-19", "2026-11-02", "2026-11-03"]]); // 02/11 é Finados: volta na terça
  assert.ok(!ag.linhas.some((l) => l.ausencias.some((a) => a.inicio === "2026-11-23")), "a pausa cancelada não aparece");
  const ctxCarla = contexto("3");
  const ag2 = dom.agendaEquipe(ctxCarla, dom.equipeDe(ctxCarla, "3").map((m) => dom.infoMembro(ctxCarla, m)), { inicio: ctxCarla.hoje, semanas: 13 });
  assert.deepEqual(ag2.linhas.find((l) => l.pessoa.userId === "100").ausencias, [], "as férias da Ana aguardam o RH: ainda fora da agenda");
  assert.deepEqual(ag2.linhas.find((l) => l.pessoa.userId === "101").ausencias.map((a) => a.inicio), ["2026-10-13"], "o day off do Bruno aguarda a Carla");
  // aprovado pela liderança: entra
  ctxCarla.registros.ferias.find((x) => x.id === "301").estagio = "SUCCESS";
  dom.indexar(ctxCarla);
  const ag3 = dom.agendaEquipe(ctxCarla, dom.equipeDe(ctxCarla, "3").map((m) => dom.infoMembro(ctxCarla, m)), { inicio: ctxCarla.hoje, semanas: 13 });
  assert.deepEqual(ag3.linhas.find((l) => l.pessoa.userId === "101").ausencias.map((a) => a.inicio), ["2026-10-13", "2026-11-13"], "em ordem de data");
});

test("e-mail do pedido: para o RH, com cópia para a liderança, pronto para sair pela caixa do Bitrix", () => {
  const ctx = contexto("100");
  const ana = { tipo: "Férias", inicio: "2026-12-07", fim: "2026-12-21", cobertura: "Bruno acompanha os protocolos da carteira." };
  const e = F.emailDoPedido(ctx, Object.assign({}, ana, { foraDaPolitica: "Pedido com 30 dias de antecedência: a política pede pelo menos 60." }), pessoa(ctx, "100"));
  assert.equal(e.para, "hr@amorimlawfirm.com");
  assert.deepEqual(e.cc, ["carla.mendes@amorimglobal.com"]);
  assert.equal(e.assunto, "Solicitação de férias · Ana Ribeiro · 07/12 a 21/12");
  assert.match(e.corpo, /^Olá, RH e Carla,/);
  assert.match(e.corpo, /Período: de segunda, 07\/12\/2026 a segunda, 21\/12\/2026 \(15 dias corridos\)/);
  assert.match(e.corpo, /Cobertura das atividades: Bruno acompanha/);
  assert.match(e.corpo, /- Pedido com 30 dias de antecedência/);
  assert.doesNotMatch(e.corpo, /registrad/i, "sem o pedido gravado (só o e-mail), o texto não fala do app");
  assert.match(F.emailDoPedido(ctx, ana, pessoa(ctx, "100"), { registrado: true }).corpo, /O pedido também está registrado no app Gestão de Pessoas, onde o RH autoriza e a liderança valida\./);
  // o pedido com a semana coletiva e um período junto: os dois no mesmo e-mail
  const junto = F.emailDoPedido(ctx, { tipo: "Férias", coletiva: true, inicio: "2026-12-28", fim: "2027-01-01" }, pessoa(ctx, "100"), { junto: [{ tipo: "Férias", inicio: "2027-03-01", fim: "2027-03-08" }] });
  assert.match(junto.corpo, /Períodos:\n- de segunda, 28\/12\/2026 a sexta, 01\/01\/2027 \(5 dias corridos\) \(semana de férias coletivas\)\n- de segunda, 01\/03\/2027 a segunda, 08\/03\/2027 \(8 dias corridos\)/);
  assert.equal(F.emailDaDecisao, undefined, "a decisão é dada no app, e o aviso sai pelo Bitrix");
  assert.equal(F.linkGmail, undefined, "a Amorim usa o e-mail do Bitrix: sem Gmail nem mailto");
  // o corpo vai em HTML simples: texto escapado, quebras de linha em <br>
  assert.equal(F.corpoHtml("Olá, RH,\n\nPeríodo: <15 dias> & cobertura\r\nFim"), "Olá, RH,<br><br>Período: &lt;15 dias&gt; &amp; cobertura<br>Fim");
  // o remetente é a caixa da própria pessoa; sem ela, a primeira oferecida
  const caixas = [{ email: "geral@amorimglobal.com", name: "Geral" }, { email: "Ana.Ribeiro@amorimglobal.com", name: "Ana" }];
  assert.equal(F.escolherRemetente(caixas, "ana.ribeiro@amorimglobal.com").name, "Ana");
  assert.equal(F.escolherRemetente(caixas, "outra@amorimglobal.com").name, "Geral");
  assert.equal(F.escolherRemetente([], "ana@x.com"), null);
});

test("notificações: o pedido avisa o RH e a liderança; cada decisão avisa quem precisa; o registro direto do RH, como antes", () => {
  const rh = N.notificacoesDe(contexto("6"), "6");
  const t = rh.map((n) => n.titulo);
  const ana = rh.find((n) => n.titulo === "Ana Ribeiro pediu férias (07/12 a 21/12)");
  assert.ok(ana && ana.acao === true && /O RH autoriza primeiro, até 13\/10/.test(ana.texto), t.join(" | "));
  assert.equal(rh.find((n) => n.titulo === "Bruno Teixeira pediu day off (13/11)").acao, false, "já aprovado pelo RH: agora é a liderança");
  assert.ok(t.includes("Júlia Freitas cancelou o pedido de pausa contratual (23/11 a 27/11)"));
  assert.ok(!t.some((x) => /registrou/.test(x)), "quem registrou não é avisado do próprio registro");
  assert.ok(t.includes("Nova solicitação de vaga: Analista Tributário Júnior"), "vaga de 02/10");
  assert.ok(!t.some((x) => /Assistente de Imigração/.test(x)), "vaga de agosto: fora dos 30 dias");
  assert.ok(t.includes("Nova solicitação de encerramento de contrato: Igor Santos"), "esteira de offboarding");
  assert.ok(t.some((x) => /Solicitação de encerramento enviada ao RH: Fernanda Alves/.test(x)), "fluxo anterior do app");
  const carla = N.notificacoesDe(contexto("3"), "3");
  const tc = carla.map((n) => n.titulo);
  assert.ok(tc.includes("Ana Ribeiro pediu férias (07/12 a 21/12)"), tc.join(" | "));
  const bruno = carla.find((n) => n.titulo === "O RH autorizou o pedido de Bruno Teixeira: falta a sua validação");
  assert.ok(bruno && bruno.acao === true && /Valide até 09\/10/.test(bruno.texto));
  assert.equal(bruno.rota, "#/ferias/301");
  assert.ok(tc.includes("Avalie a finalista Paula Nunes"));
  assert.ok(!tc.some((x) => /vaga/i.test(x)), "a liderança não é avisada das vagas que não pediu");
  // só as de férias: a demonstração também tem um ciclo da Revisão de Progresso aberto (avisos testados em test/revisao.test.js)
  const deFerias = (uid) => N.notificacoesDe(contexto(uid), uid).filter((n) => n.area !== "Revisão de Progresso");
  assert.deepEqual(deFerias("101").map((n) => n.titulo), ["O RH autorizou o seu pedido de day off (13/11)"]);
  assert.deepEqual(deFerias("100"), [], "o próprio pedido, ainda sem decisão, não avisa quem pediu");
  assert.deepEqual(deFerias("110"), [], "registrada há mais de 30 dias: fora do sino");
  assert.deepEqual(deFerias("111"), [], "o próprio cancelamento não avisa quem cancelou");
  // a ausência que o RH registra direto avisa a liderança direta e a própria pessoa
  const ctx = contexto("3");
  ctx.registros.ferias.push({ id: "399", titulo: "Day off · Gustavo Pereira", responsavel: "105", lideranca: "3", autor: "6", estagio: "SUCCESS", tipo: "Day off", inicio: "2026-10-28", fim: "2026-10-28", criadoEm: "2026-10-08T08:00:00-03:00" });
  dom.indexar(ctx);
  assert.ok(N.notificacoesDe(ctx, "3").some((n) => n.titulo === "O RH registrou a ausência de Gustavo Pereira: day off (28/10)"));
  assert.ok(N.notificacoesDe(ctx, "105").some((n) => n.titulo === "O RH registrou a sua ausência: day off (28/10)"));
  // a confirmação da liderança avisa o RH e quem pediu
  const ctx2 = contexto("6");
  Object.assign(ctx2.registros.ferias.find((x) => x.id === "301"), { estagio: "SUCCESS", liderancaDecisao: "Aprovada", liderancaEm: "2026-10-08T10:00:00-03:00" });
  dom.indexar(ctx2);
  assert.ok(N.notificacoesDe(ctx2, "6").some((n) => n.titulo === "Carla Mendes validou o pedido de Bruno Teixeira"));
  assert.ok(N.notificacoesDe(ctx2, "101").some((n) => n.titulo === "Aprovado: day off (13/11)"));
  // a coordenação é avisada das vagas das lideranças do setor
  assert.ok(N.notificacoesDe(contexto("2"), "2").some((n) => n.titulo === "Nova solicitação de vaga: Analista Tributário Júnior"));
});

test("notificações: o lido é de cada pessoa, e o calendário mudado pelo RH avisa todo mundo", () => {
  const ctx = contexto("3");
  assert.equal(N.novas(ctx, "3", { visto: "" }), N.notificacoesDe(ctx, "3").length);
  assert.equal(N.novas(ctx, "3", { visto: "2026-10-07T23:00:00-03:00" }), 0);
  assert.equal(N.novas(ctx, "3", { visto: "2026-10-07T09:00:00-03:00" }), 2); // o pedido da Ana (09h30) e a aprovação do RH no do Bruno (15h)
  ctx.registros.feriados = [feriado("1", "2026-11-20", "Consciência Negra", "Todos", true, { atualizadoEm: "2026-10-08T09:00:00-03:00" })];
  dom.indexar(ctx);
  assert.ok(N.notificacoesDe(ctx, "100").some((n) => n.titulo === "O RH atualizou o calendário de feriados"));
  assert.ok(!N.notificacoesDe(ctx, "6").some((n) => /calendário de feriados/.test(n.titulo)), "o próprio RH não precisa do aviso");
});

test("api/ferias-equipe: as datas da equipe pelo webhook, sem nomes; sem token, 401", async () => {
  const { criarBitrixFalso } = require("./fake-bitrix.js");
  const { provisionar } = require("../src/js/30-provision.js");
  const { abrirPortal } = require("../lib/bitrix-servidor.js");
  const handler = require("../api/ferias-equipe.js");
  const bx = criarBitrixFalso({
    usuarios: [{ ID: "3", NAME: "Carla", LAST_NAME: "Mendes", UF_DEPARTMENT: [11] }, { ID: "100", NAME: "Ana", LAST_NAME: "Ribeiro", UF_DEPARTMENT: [11] },
      { ID: "101", NAME: "Bruno", LAST_NAME: "Teixeira", UF_DEPARTMENT: [11] }, { ID: "4", NAME: "Marcos", LAST_NAME: "Lima", UF_DEPARTMENT: [12] }, { ID: "110", NAME: "Igor", LAST_NAME: "Santos", UF_DEPARTMENT: [12] }],
    departamentos: [{ ID: "10", NAME: "Soluções", PARENT: "", UF_HEAD: "" }, { ID: "11", NAME: "Imigração", PARENT: "10", UF_HEAD: "3" }, { ID: "12", NAME: "Tributário", PARENT: "10", UF_HEAD: "4" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["ferias"]);
  const f = (resp, lid, tipo, inicio, fim, estagio, extra) => portal.criar("ferias", Object.assign({ titulo: tipo + " · " + resp, responsavel: resp, lideranca: lid, tipo, inicio, fim, estagio, justificativa: "Viagem com a família" }, extra || {}));
  await f("100", "3", "Férias", "2027-01-11", "2027-01-25", "SUCCESS");
  await f("100", "3", "Férias", "2026-12-28", "2027-01-01", "NEW", { coletiva: true });
  await f("100", "3", "Day off", "2026-11-20", "2026-11-20", "SUCCESS");
  await f("110", "4", "Férias", "2027-02-01", "2027-02-15", "NEW");
  await f("100", "3", "Férias", "2027-03-01", "2027-03-23", "FAIL");
  const res = () => ({ statusCode: 0, cab: {}, corpo: "", setHeader(k, v) { this.cab[k] = v; }, end(x) { this.corpo = x; } });
  const env = { BITRIX_WEBHOOK_URL: "https://portal.exemplo/rest/1/x/" };
  const r1 = res();
  await handler({ method: "POST", body: {} }, r1, { env, chamar: bx.chamar });
  assert.equal(r1.statusCode, 401);
  const r2 = res();
  await handler({ method: "POST", body: { auth: "tk" } }, r2, { env, chamar: bx.chamar, usuarioDoToken: async () => "101", agora: new Date("2026-11-06T12:00:00Z") });
  assert.equal(r2.statusCode, 200, r2.corpo);
  // só as férias aprovadas ou em andamento da mesma liderança; sem a semana coletiva, o day off, o devolvido e a outra equipe
  assert.deepEqual(JSON.parse(r2.corpo), { ok: true, reservas: [{ inicio: "2027-01-11", fim: "2027-01-25", situacao: "Aprovada" }] });
  assert.ok(!/Ana|Viagem|100/.test(r2.corpo), "sem nome, motivo nem ID");
});
