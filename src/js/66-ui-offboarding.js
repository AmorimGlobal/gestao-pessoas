/* =====================================================================================
   TELAS — Offboarding: planos de alinhamento de resultados (3.5.2) e encerramentos de
   contrato (3.5.3), com a verificação de registros (4.1) e o guia da liderança (3.5.4)
   -------------------------------------------------------------------------------------
   A verificação roda aqui antes de criar a solicitação e de novo a cada envio. A trava
   "no servidor" (4.1) é o processo de negócio do Bitrix descrito em
   docs/configuracao-bitrix.md: a tela sozinha não basta.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;
  const COR_ENC = { NEW: "cinza", AG_COORD: "ambar", BLOQUEADA: "vermelho", ENVIADA_RH: "azul", EM_ANALISE: "azul", APROVADA: "verde", CONVERSA_OK: "verde", POS: "verde", SUCCESS: "verde", FAIL: "cinza" };
  const FLUXO = ["NEW", "AG_COORD", "ENVIADA_RH", "EM_ANALISE", "APROVADA", "CONVERSA_OK", "POS", "SUCCESS"];
  const NOMES_FLUXO = { NEW: "Rascunho", AG_COORD: "Coordenação", ENVIADA_RH: "Enviada ao RH", EM_ANALISE: "Em análise", APROVADA: "Aprovada", CONVERSA_OK: "Conversa", POS: "Acompanhamento", SUCCESS: "Concluída" };

  // Trechos do Guia de Offboarding (versão 2, com os ajustes da 3.5.4) por etapa
  const GUIA = {
    NEW: { t: "Alinhamento interno", d: "Antes de enviar, alinhe com a coordenação responsável: o motivo real e o que será dito, a data oficial e como a equipe será comunicada. Solicite com pelo menos 7 dias de antecedência e evite sextas-feiras." },
    AG_COORD: { t: "Alinhamento interno", d: "A coordenação confere o motivo real e o que será dito, a data oficial e a comunicação ao time. Dúvidas sobre o contrato vão para o RH." },
    APROVADA: { t: "Conversa de encerramento e comunicado ao time", d: "Roteiro em 3 etapas: contexto e decisão, o que acontece a partir de agora, espaço para perguntas. No mesmo dia, comunique o time com o roteiro do comunicado. Encerrar bem é liderar até o fim." },
    CONVERSA_OK: { t: "Clima da equipe", d: "Semana 1: redistribuição equilibrada das demandas. Semana 2: conversa rápida com pelo menos 2 membros. Semana 4: check-in de clima com o RH. Sinais de alerta: queda nas entregas, comunicação mais fechada, menor participação nas reuniões." },
  };

  /* ================================================================ TELA OFFBOARDING */
  ui.rotas.offboarding = function (partes) {
    if (partes[0] === "plano" && partes[1]) return telaPlano(partes[1]);
    if (partes[0] === "encerramento" && partes[1]) return telaEncerramento(partes[1]);
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao();
    const ids = {};
    membros.forEach((m) => { ids[m.id] = true; });
    const planos = (ctx.registros.planos || []).filter((p) => ids[p.membroId] || E().visao === "rh");
    const ativos = planos.filter((p) => dom.statusPlano(ctx, p).ativo);
    const encs = (ctx.registros.encerramentos || []).filter((e) => ids[e.membroId] || E().visao === "rh");
    const andamento = encs.filter((e) => ["SUCCESS", "FAIL"].indexOf(e.estagio) < 0);
    const aprov = dom.aprovacoesPendentes(ctx, E().eu.id);
    const filaRH = E().visao === "rh" ? dom.filaRH(ctx) : [];
    const links = (E().config && E().config.links) || {};
    let h = c.cabecalho("offboarding", "Offboarding", "<span><b>" + ativos.length + "</b> plano(s) de alinhamento em andamento</span><span><b>" + andamento.length + "</b> encerramento(s) em andamento</span>",
      '<button class="btn sec" data-acao="novo-plano">' + icone("mais", 15) + " Plano de alinhamento</button>");
    // Cartão fixo do topo (3.5.3)
    h += '<div class="card acao" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="margin-bottom:4px">Solicitar encerramento de contrato</h3>' +
      '<div class="muted">Primeiro o app confere se os registros do membro estão completos. ' + (E().visao === "rh" ? "Registrada pelo RH, a solicitação já entra na fila do RH." : dom.papeis(ctx, E().eu.id).enviaFormal ? "Como coordenação, a sua solicitação vai direto ao RH." : "A sua solicitação segue para a aprovação da coordenação responsável.") +
      " Dúvidas sobre o contrato vão para o RH.</div></div><button class=\"btn\" data-acao=\"solicitar-encerramento\">Verificar registros e solicitar</button></div></div>";
    h += '<details class="card" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;color:var(--navy)">' + icone("manual", 15) + " Guia da liderança para o encerramento de contrato</summary>" +
      '<div style="margin-top:12px">' + Object.keys(GUIA).filter((k) => k !== "AG_COORD").map((k) => "<p><b>" + esc(GUIA[k].t) + ".</b> " + esc(GUIA[k].d) + "</p>").join("") +
      (links.guiaOffboarding ? '<a target="_blank" rel="noopener" href="' + esc(links.guiaOffboarding) + '">Abrir o guia completo na Base de Conhecimento →</a>' : '<span class="muted">O guia completo fica na Base de Conhecimento (link a cadastrar).</span>') + "</div></details>";
    if (aprov.length) h += '<div class="card acao"><h3>Aguardando a sua aprovação</h3><div class="lista">' + aprov.map((a) =>
      '<div class="item clicavel" data-rota="#/offboarding/encerramento/' + esc(a.item.id) + '">' + (a.membro ? c.avatar(a.membro, 30) : "") + '<div class="principal-item"><div class="t">' + esc(a.membro ? a.membro.nome : "") + '</div><div class="d">' + esc(a.item.motivo) + " · aguardando há " + plural(a.dias, "dia", "dias") + " (prazo de 3)</div></div>" +
      '<div class="lado">' + c.prazo(a.prazo) + "</div></div>").join("") + "</div></div>";
    if (filaRH.length) h += '<div class="card acao"><h3>Fila do RH</h3><div class="lista">' + filaRH.map((f) => linhaEnc(f.item)).join("") + "</div></div>";
    h += '<div class="grade c2"><div class="card"><h3>Planos de alinhamento de resultados</h3>' + (planos.length ? '<div class="lista">' + planos.slice().sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).map((p) => {
      const s = dom.statusPlano(ctx, p);
      const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId] || {});
      return '<div class="item clicavel" data-rota="#/offboarding/plano/' + esc(p.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">desde ' + calc.fmtData(p.inicio) + " · término " + calc.fmtData(s.termino) + "</div></div><div class=\"lado\">" + c.tag(s.texto, s.cor) + "</div></div>";
    }).join("") + "</div>" : c.vazio("Nenhum plano de alinhamento.")) + "</div>" +
      '<div class="card"><h3>Encerramentos de contrato</h3>' + (encs.length ? '<div class="lista">' + encs.slice().sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).map((e) => linhaEnc(e)).join("") + "</div>" : c.vazio("Nenhuma solicitação.")) + "</div></div>";
    return h;
  };
  function linhaEnc(e) {
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId] || {});
    return '<div class="item clicavel" data-rota="#/offboarding/encerramento/' + esc(e.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + esc(e.motivo || "motivo a definir") + (e.dataDesejada ? " · data desejada " + calc.fmtData(e.dataDesejada) : "") + "</div></div>" +
      '<div class="lado">' + c.tag(e.estagioNome, COR_ENC[e.estagio]) + "</div></div>";
  }

  /* ================================================================ PLANO */
  function planoResumoHtml(p, compacto) {
    const ctx = E().ctx;
    const s = dom.statusPlano(ctx, p);
    const fbA = p.feedbackAberturaId ? ctx.idx.porId.feedbacks[p.feedbackAberturaId] : null;
    const fbE = p.feedbackEncerramentoId ? ctx.idx.porId.feedbacks[p.feedbackEncerramentoId] : null;
    const res = (n) => '<div style="padding:10px 12px;background:var(--sutil);border-radius:10px"><div class="k" style="font-size:11px;text-transform:uppercase;color:var(--suave);font-weight:700">Resultado esperado ' + n + '</div><div class="texto-registro">' + esc(p["resultado" + n]) + "</div>" +
      '<div class="muted" style="font-size:12.5px;margin-top:4px">Evidência: ' + esc(p["evidencia" + n] || "") + "</div>" +
      '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + (p["checkin" + n] ? c.tag("Check-in: " + p["checkin" + n], p["checkin" + n] === "Atingido" ? "verde" : p["checkin" + n] === "Não atingido" ? "vermelho" : "ambar") : "") +
      (p["final" + n] ? c.tag("Final: " + p["final" + n], p["final" + n] === "Atingido" ? "verde" : "vermelho") : "") + "</div></div>";
    return '<div class="card"><h3>Plano de ' + calc.fmtData(p.inicio) + " a " + calc.fmtData(s.termino) + '<span class="extra">' + c.tag(s.texto, s.cor) + "</span></h3>" +
      '<div class="grade c2" style="margin-bottom:12px">' + res(1) + res(2) + "</div>" +
      '<div class="sci">' + c.textoRegistro("Apoio oferecido", p.apoio) + (p.checkinData ? c.textoRegistro("Check-in de " + calc.fmtData(p.checkinData), p.checkinComentario) : "") +
      '<div><div class="k">Feedbacks SCI vinculados</div>' + (fbA ? '<div>• <a href="#/rotinas/feedback/' + esc(fbA.id) + '">Abertura de plano · ' + calc.fmtData(fbA.data) + "</a></div>" : '<div class="muted">sem feedback de abertura</div>') +
      (fbE ? '<div>• <a href="#/rotinas/feedback/' + esc(fbE.id) + '">Encerramento de plano · ' + calc.fmtData(fbE.data) + "</a></div>" : "") + "</div>" +
      (p.adendos ? '<div><div class="k">Adendos</div><div class="adendo">' + esc(p.adendos) + "</div></div>" : "") + "</div>" +
      (compacto ? "" : '<div style="margin-top:12px"><a href="#/offboarding/plano/' + esc(p.id) + '">Abrir o plano →</a></div>') + "</div>";
  }
  function telaPlano(id) {
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[id];
    if (!p) return c.voltar("#/offboarding", "Offboarding") + '<div class="card">' + c.vazio("Plano não encontrado.") + "</div>";
    const s = dom.statusPlano(ctx, p);
    const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId] || {});
    let acoes = "";
    if (s.ativo && !s.checkinFeito) acoes += '<button class="btn" data-acao="checkin-plano" data-id="' + esc(p.id) + '">Registrar o check-in</button>';
    if (s.ativo && s.checkinFeito) acoes += '<button class="btn" data-acao="encerrar-plano" data-id="' + esc(p.id) + '">Encerrar o plano</button>';
    if (E().visao === "rh" && s.ativo) acoes += '<button class="btn sec" data-acao="prorrogar-plano" data-id="' + esc(p.id) + '">Prorrogar</button>';
    acoes += '<button class="btn sec" data-acao="adendo" data-chave="planos" data-id="' + esc(p.id) + '">Adendo</button>';
    let h = c.voltar("#/offboarding", "Offboarding") + c.cabecalho("offboarding", "Plano de alinhamento de " + m.nome, "<span>" + (s.dia ? "Dia <b>" + s.dia + "</b> de 60" : "") + "</span><span>check-in no Dia 30 (" + calc.fmtData(s.prazoCheckin) + ")</span><span>término " + calc.fmtData(s.termino) + "</span>", acoes);
    h += '<div class="card" style="padding:16px 22px"><div class="barra"><div class="preench ' + (s.cor === "vermelho" ? "vermelho" : "") + '" style="width:' + Math.round(((s.dia || 0) / 60) * 100) + '%"></div><div class="meta" style="left:50%" title="Check-in no Dia 30"></div></div><div class="barra-nota">Dia ' + (s.dia || 0) + " de 60 · " + esc(s.texto) + "</div></div>";
    if (p.estagio === "FAIL") {
      const jaTem = (ctx.idx.porMembro.encerramentos[p.membroId] || []).find((e) => e.estagio !== "FAIL");
      h += '<div class="card acao vermelho"><h3>O plano terminou sem os resultados</h3><p class="muted" style="margin-top:0">O app sugere avaliar o encerramento de contrato. A decisão é da liderança direta: se seguir, a solicitação nasce em Rascunho, já com o plano e os 2 feedbacks vinculados, e depois passa pela coordenação.</p>' +
        (jaTem ? '<a class="btn sec" href="#/offboarding/encerramento/' + esc(jaTem.id) + '">Abrir a solicitação existente</a>' : '<button class="btn" data-acao="encerramento-de-plano" data-id="' + esc(p.id) + '">Avaliar o encerramento</button>') + "</div>";
    }
    return h + planoResumoHtml(p, true);
  }

  /** Formulário do plano. feedbackId: o feedback de abertura recém-registrado (vindo de Rotinas). */
  function abrirFormPlano(membroId, feedbackId) {
    const ctx = E().ctx;
    const membros = ui.minhaEquipe().concat(E().visao !== "lideranca" ? ui.membrosDaVisao() : []).filter((m, i, a) => a.indexOf(m) === i && m.estagio === "ATIVO").map((m) => dom.infoMembro(ctx, m));
    const usados = {};
    (ctx.registros.planos || []).forEach((p) => { usados[p.feedbackAberturaId] = true; });
    const opcoesFb = (mid) => dom.feedbacksDo(ctx, mid).filter((f) => f.tipo === "Abertura de plano" && !usados[f.id]).map((f) => ({ valor: f.id, rotulo: "Abertura de plano · " + calc.fmtDataAno(f.data) }));
    const fbs = membroId ? opcoesFb(membroId) : [];
    const corpo = '<div id="form-plano">' + c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })), valor: membroId, desabilitado: !!feedbackId }) +
      (feedbackId ? '<input type="hidden" name="membroId" value="' + esc(membroId) + '">' : "") +
      c.campo({ nome: "feedbackAberturaId", rotulo: "Feedback SCI de abertura", tipo: "lista", opcoes: fbs, valor: feedbackId, ajuda: "O plano nasce logo depois do feedback de abertura. Sem ele, registre primeiro o feedback em Rotinas, com o tipo \"Abertura de plano\"." }) +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Data de início (Dia 1)", tipo: "data", valor: ctx.hoje }) + '<div class="campo"><div class="rotulo">Término (Dia 60)</div><div class="entrada" id="termino-plano" style="background:var(--sutil)">' + calc.fmtDataAno(calc.terminoPlano(ctx.hoje)) + "</div></div></div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">2 resultados esperados</div>' +
      c.campo({ nome: "resultado1", rotulo: "Resultado esperado 1", tipo: "textoLongo", linhas: 2, ajuda: "Um resultado de trabalho, mensurável. Nada sobre horário ou forma de execução." }) + c.campo({ nome: "evidencia1", rotulo: "Evidência de atingimento 1", tipo: "textoLongo", linhas: 2 }) +
      c.campo({ nome: "resultado2", rotulo: "Resultado esperado 2", tipo: "textoLongo", linhas: 2 }) + c.campo({ nome: "evidencia2", rotulo: "Evidência de atingimento 2", tipo: "textoLongo", linhas: 2 }) + "</div>" +
      c.campo({ nome: "apoio", rotulo: "Apoio oferecido", tipo: "textoLongo", linhas: 2, ajuda: "O que a liderança e a supervisão vão fazer para apoiar." }) + "</div>";
    ui.abrirPainel({
      titulo: "Plano de alinhamento de resultados", sub: "60 dias, com check-in no Dia 30. Coordenação e RH são avisados na abertura.", corpo, largo: true,
      rodape: '<button class="btn" data-acao="salvar-plano">Abrir o plano</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: function (el) {
        const sel = el.querySelector('select[name="membroId"]');
        if (sel) sel.addEventListener("change", function () {
          const fbSel = el.querySelector('select[name="feedbackAberturaId"]');
          fbSel.innerHTML = '<option value="">Selecione</option>' + opcoesFb(sel.value).map((o) => '<option value="' + esc(o.valor) + '">' + esc(o.rotulo) + "</option>").join("");
        });
        const ini = el.querySelector('input[name="inicio"]');
        ini.addEventListener("change", function () { if (calc.dataValida(ini.value)) document.getElementById("termino-plano").textContent = calc.fmtDataAno(calc.terminoPlano(ini.value)); });
      },
    });
  }
  ui.acoes["novo-plano"] = function (el) { abrirFormPlano(el.dataset.membro || "", ""); };
  ui.acoes["salvar-plano"] = function (el) {
    const f = document.getElementById("form-plano");
    if (!ui.validar(f, ["membroId", "feedbackAberturaId", "inicio", "resultado1", "evidencia1", "resultado2", "evidencia2", "apoio"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    if (dom.planoAtivoDo(ctx, m.id)) { ui.erroNoPainel(m.nome + " já tem um plano em andamento."); return; }
    ui.salvar(el, async () => {
      const p = await ui.criar("planos", {
        titulo: "Plano · " + m.nome, membroId: m.id, responsavel: m.responsavel, feedbackAberturaId: d.feedbackAberturaId, inicio: d.inicio, termino: calc.terminoPlano(d.inicio),
        resultado1: d.resultado1, evidencia1: d.evidencia1, resultado2: d.resultado2, evidencia2: d.evidencia2, apoio: d.apoio, autor: E().eu.id, estagio: "NEW",
      });
      await ui.atualizar("feedbacks", d.feedbackAberturaId, { planoId: p.id });
      await GP.app.avisarRH("Plano de alinhamento de resultados aberto para " + m.nome + ", com término em " + calc.fmtData(p.termino) + ".", [m.coordenacao]);
      ui.navegar("#/offboarding/plano/" + p.id);
      return p;
    }, { mensagem: "Plano aberto. Check-in no Dia 30." });
  };
  ui.acoes["checkin-plano"] = function (el) {
    const p = E().ctx.idx.porId.planos[el.dataset.id];
    ui.abrirPainel({
      titulo: "Check-in do plano (Dia 30)", largo: true,
      corpo: '<div id="form-checkin"><p class="muted" style="margin-top:0">Situação de cada resultado esperado até aqui.</p>' +
        "<p><b>1.</b> " + esc(p.resultado1) + "</p>" + c.campo({ nome: "checkin1", rotulo: "Resultado 1", tipo: "escolha", opcoes: op.checkin }) +
        "<p><b>2.</b> " + esc(p.resultado2) + "</p>" + c.campo({ nome: "checkin2", rotulo: "Resultado 2", tipo: "escolha", opcoes: op.checkin }) +
        c.campo({ nome: "checkinComentario", rotulo: "Comentário", tipo: "textoLongo", ajuda: "Fatos e resultados, com datas." }) + c.campo({ nome: "checkinData", rotulo: "Data do check-in", tipo: "data", valor: E().ctx.hoje, max: E().ctx.hoje }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-checkin" data-id="' + esc(p.id) + '">Registrar o check-in</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-checkin"] = function (el) {
    const f = document.getElementById("form-checkin");
    if (!ui.validar(f, ["checkin1", "checkin2", "checkinComentario", "checkinData"])) return;
    const d = ui.lerForm(f);
    ui.salvar(el, () => ui.atualizar("planos", el.dataset.id, { checkin1: d.checkin1, checkin2: d.checkin2, checkinComentario: d.checkinComentario, checkinData: d.checkinData, estagio: "CHECKIN_OK" }), { mensagem: "Check-in registrado." });
  };
  ui.acoes["encerrar-plano"] = function (el) {
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[el.dataset.id];
    const fbs = dom.feedbacksDo(ctx, p.membroId).filter((f) => f.tipo === "Encerramento de plano" && f.data >= p.inicio).map((f) => ({ valor: f.id, rotulo: "Encerramento de plano · " + calc.fmtDataAno(f.data) }));
    ui.abrirPainel({
      titulo: "Encerrar o plano (Dia 60)", largo: true,
      corpo: '<div id="form-enc-plano">' + (fbs.length ? "" : '<div class="aviso-atencao" style="margin-bottom:14px">Falta o feedback SCI de encerramento do plano. <a href="#" data-acao="novo-feedback" data-membro="' + esc(p.membroId) + '" data-tipo="Encerramento de plano">Registrar agora</a> e volte aqui.</div>') +
        "<p><b>1.</b> " + esc(p.resultado1) + "</p>" + c.campo({ nome: "final1", rotulo: "Situação final do resultado 1", tipo: "escolha", opcoes: op.situacaoFinal }) +
        "<p><b>2.</b> " + esc(p.resultado2) + "</p>" + c.campo({ nome: "final2", rotulo: "Situação final do resultado 2", tipo: "escolha", opcoes: op.situacaoFinal }) +
        c.campo({ nome: "feedbackEncerramentoId", rotulo: "Feedback SCI de encerramento", tipo: "lista", opcoes: fbs }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-enc-plano" data-id="' + esc(p.id) + '">Encerrar o plano</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-enc-plano"] = function (el) {
    const f = document.getElementById("form-enc-plano");
    if (!ui.validar(f, ["final1", "final2", "feedbackEncerramentoId"])) return;
    const d = ui.lerForm(f);
    const atingiu = d.final1 === "Atingido" && d.final2 === "Atingido";
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId]);
    ui.salvar(el, async () => {
      await ui.atualizar("planos", p.id, { final1: d.final1, final2: d.final2, feedbackEncerramentoId: d.feedbackEncerramentoId, estagio: atingiu ? "SUCCESS" : "FAIL" });
      await ui.atualizar("feedbacks", d.feedbackEncerramentoId, { planoId: p.id });
      await GP.app.avisarRH("Plano de alinhamento de " + m.nome + " encerrado: " + (atingiu ? "resultados atingidos." : "resultados não atingidos."), [m.coordenacao]);
    }, { mensagem: atingiu ? "Plano encerrado com os resultados atingidos." : "Plano encerrado sem os resultados." });
  };
  ui.acoes["prorrogar-plano"] = function (el) {
    const p = E().ctx.idx.porId.planos[el.dataset.id];
    ui.abrirPainel({
      titulo: "Prorrogar o plano", sub: "O RH altera a data de término e devolve o plano para \"Check-in realizado\" (3.5.2).",
      corpo: '<div id="form-prorrogar">' + c.campo({ nome: "termino", rotulo: "Nova data de término", tipo: "data", valor: p.termino, min: E().ctx.hoje }) + c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-prorrogar" data-id="' + esc(p.id) + '">Prorrogar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-prorrogar"] = function (el) {
    const f = document.getElementById("form-prorrogar");
    if (!ui.validar(f, ["termino", "justificativa"])) return;
    const d = ui.lerForm(f);
    const p = E().ctx.idx.porId.planos[el.dataset.id];
    ui.salvar(el, () => ui.atualizar("planos", p.id, { termino: d.termino, estagio: "CHECKIN_OK", adendos: ui.novoAdendo(p.adendos, d.justificativa, "Prorrogado de " + calc.fmtData(p.termino) + " para " + calc.fmtData(d.termino) + ".") }), { mensagem: "Plano prorrogado." });
  };

  /* ================================================================ ENCERRAMENTO */
  function checagemHtml(v) {
    return '<div class="checagem">' + v.itens.map((i) => '<div class="' + (i.ok ? "ok" : "falta") + '"><span class="s">' + (i.ok ? "✓" : "✕") + "</span><span>" + esc(i.texto) + "</span></div>").join("") + "</div>" +
      (v.bloqueios.length ? '<div class="aviso-erro" style="margin-top:10px">' + v.bloqueios.map(esc).join("<br>") + "</div>" : "");
  }
  function encerramentoResumoHtml(e) {
    return '<div class="card"><h3>' + esc(e.motivo || "Encerramento de contrato") + '<span class="extra">' + c.tag(e.estagioNome, COR_ENC[e.estagio]) + '</span></h3><a href="#/offboarding/encerramento/' + esc(e.id) + '">Abrir a solicitação →</a></div>';
  }
  function telaEncerramento(id) {
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[id];
    if (!e) return c.voltar("#/offboarding", "Offboarding") + '<div class="card">' + c.vazio("Solicitação não encontrada.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId] || {});
    const rh = E().visao === "rh";
    const aprovador = dom.aprovadorDe(ctx, e);
    const souAprovador = e.estagio === "AG_COORD" && ((aprovador.rh && rh) || (!aprovador.rh && aprovador.id === E().eu.id));
    const posRH = FLUXO.indexOf(e.estagio) >= FLUXO.indexOf("ENVIADA_RH");
    const podeEditar = !posRH && ["NEW", "BLOQUEADA"].indexOf(e.estagio) >= 0;
    const ver = dom.verificarRegistros(ctx, e.membroId, e.motivo, e.justificativa);
    let acoes = "";
    if (podeEditar) acoes += '<button class="btn sec" data-acao="editar-encerramento" data-id="' + esc(e.id) + '">Editar</button><button class="btn" data-acao="enviar-encerramento" data-id="' + esc(e.id) + '">' + (e.estagio === "BLOQUEADA" ? "Reenviar" : "Enviar") + "</button>";
    if (souAprovador) acoes += '<button class="btn" data-acao="decidir-encerramento" data-id="' + esc(e.id) + '" data-decisao="aprovar">Aprovar e enviar ao RH</button><button class="btn sec" data-acao="decidir-encerramento" data-id="' + esc(e.id) + '" data-decisao="recusar">Devolver com comentário</button>';
    if (rh) {
      if (e.estagio === "BLOQUEADA") acoes += '<button class="btn sec" data-acao="liberar-encerramento" data-id="' + esc(e.id) + '">Liberar em caso excepcional</button>';
      if (e.estagio === "ENVIADA_RH") acoes += '<button class="btn" data-acao="mover-encerramento" data-id="' + esc(e.id) + '" data-para="EM_ANALISE">Iniciar a análise</button>';
      if (e.estagio === "EM_ANALISE") acoes += '<button class="btn" data-acao="mover-encerramento" data-id="' + esc(e.id) + '" data-para="APROVADA">Aprovar</button><button class="btn sec" data-acao="decidir-encerramento" data-id="' + esc(e.id) + '" data-decisao="devolver">Devolver para rascunho</button>';
      if (e.estagio === "CONVERSA_OK") acoes += '<button class="btn" data-acao="mover-encerramento" data-id="' + esc(e.id) + '" data-para="POS">Iniciar o acompanhamento</button>';
      if (e.estagio === "POS") acoes += '<button class="btn" data-acao="concluir-encerramento" data-id="' + esc(e.id) + '">Concluir</button>';
    }
    if (e.estagio === "APROVADA") acoes += '<button class="btn" data-acao="registrar-conversa" data-id="' + esc(e.id) + '">Registrar a conversa</button>';
    if (["SUCCESS", "FAIL"].indexOf(e.estagio) < 0 && (rh || !posRH)) acoes += '<button class="btn link" data-acao="cancelar-encerramento" data-id="' + esc(e.id) + '">Cancelar a solicitação</button>';
    const idx = FLUXO.indexOf(e.estagio);
    const passos = '<div class="passos">' + FLUXO.map((s, i) => '<span class="p ' + (e.estagio === "SUCCESS" || (idx >= 0 && i < idx) ? "feito" : i === idx ? "atual" : "") + '">' + NOMES_FLUXO[s] + "</span>").join("") + (e.estagio === "BLOQUEADA" ? '<span class="p" style="background:var(--vermelho-bg);color:var(--vermelho);font-weight:600">Bloqueada</span>' : "") + (e.estagio === "FAIL" ? '<span class="p">Cancelada</span>' : "") + "</div>";
    const guia = GUIA[e.estagio];
    const plano = e.planoId ? ctx.idx.porId.planos[e.planoId] : null;
    let h = c.voltar("#/offboarding", "Offboarding") + c.cabecalho("offboarding", "Encerramento de contrato · " + m.nome, "<span>" + c.tag(e.estagioNome, COR_ENC[e.estagio]) + "</span><span>" + esc(e.origem || "") + "</span>", acoes) +
      '<div class="card">' + passos + (posRH && !rh ? '<p class="muted" style="font-size:12px;margin:8px 0 0">' + icone("cadeado", 13) + " A partir de \"Enviada ao RH\", a liderança só acompanha. Dúvidas vão para o RH.</p>" : "") +
      (e.estagio === "AG_COORD" ? '<p class="muted" style="font-size:12px;margin:8px 0 0">Aprovação com ' + (aprovador.rh ? "o RH (quem pediu é a própria coordenação)" : esc(dom.pessoa(ctx, aprovador.id).nome)) + ".</p>" : "") + "</div>";
    if (e.estagio === "BLOQUEADA") h += '<div class="card acao vermelho"><h3>Bloqueada</h3><div class="texto-registro">' + esc(e.bloqueio || "") + "</div><p class=\"muted\">Corrija os registros e reenvie. A verificação roda de novo a cada envio.</p></div>";
    if (guia) h += '<div class="card dica"><div class="marca-amora">' + icone("manual", 15) + " Guia da liderança · " + esc(guia.t) + '</div><div style="margin-top:6px">' + esc(guia.d) + "</div></div>";
    h += '<div class="card"><h3>Solicitação</h3>' + c.dados([["Motivo", e.motivo], ["Data desejada", calc.fmtDataAno(e.dataDesejada) + (e.dataDesejada && calc.diaSemana(e.dataDesejada) === 5 ? " (sexta-feira)" : "")], ["Reposição da posição", e.reposicao],
      ["Apoio do RH na conversa", e.apoioRH], ["Coordenação responsável", dom.pessoa(ctx, e.coordenacao).nome], ["Quem solicitou", dom.pessoa(ctx, e.solicitante || e.criadoPor).nome], ["Data da conversa", calc.fmtDataAno(e.dataConversa)]]) +
      '<div class="sci" style="margin-top:14px">' + c.textoRegistro("Descrição do motivo", e.descricao) + c.textoRegistro("Justificativa do fluxo abreviado", e.justificativa) + c.textoRegistro("Liberação excepcional do RH", e.liberacaoRH) +
      (e.adendos ? '<div><div class="k">Comentários e adendos</div><div class="adendo">' + esc(e.adendos) + "</div></div>" : "") + "</div></div>" +
      '<div class="card"><h3>Verificação de registros</h3>' + checagemHtml(ver) + (plano ? '<p style="margin-top:12px"><a href="#/offboarding/plano/' + esc(plano.id) + '">Abrir o plano vinculado →</a></p>' : "") + "</div>";
    return h;
  }

  /* ---------------- solicitar (verificação primeiro) ---------------- */
  function formEncerramento(e, membroId) {
    const ctx = E().ctx;
    const membros = (E().visao === "rh" ? dom.membrosAtivos(ctx.registros.membros || []) : ui.membrosDaVisao()).map((m) => dom.infoMembro(ctx, m)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const usuarios = (ctx.usuarios || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    const v = e || { membroId };
    const mSel = v.membroId ? ctx.idx.membro[v.membroId] : null;
    return '<div id="form-enc">' + (e ? '<input type="hidden" name="membroId" value="' + esc(e.membroId) + '">' : c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })), valor: v.membroId })) +
      c.campo({ nome: "motivo", rotulo: "Motivo", tipo: "lista", opcoes: op.motivoEncerramento, valor: v.motivo }) +
      '<div class="grupo-form"><div class="rotulo-grupo">Verificação de registros</div><div id="verificacao-enc" class="muted">Escolha o membro e o motivo.</div></div>' +
      c.campo({ nome: "descricao", rotulo: "Descrição do motivo", tipo: "textoLongo", valor: v.descricao, ajuda: "Descreva fatos e resultados, com datas." }) +
      c.campo({ nome: "justificativa", rotulo: "Justificativa do fluxo abreviado", tipo: "textoLongo", valor: v.justificativa, opcional: true, ajuda: "Obrigatória para Reestruturação da área e Fim do prazo previsto no contrato." }) +
      '<div class="linha-campos">' + c.campo({ nome: "dataDesejada", rotulo: "Data desejada de encerramento", tipo: "data", valor: v.dataDesejada, min: ctx.hoje, ajuda: "Pelo menos 7 dias a partir de hoje. Evite sextas-feiras." }) +
      c.campo({ nome: "reposicao", rotulo: "Reposição da posição", tipo: "lista", opcoes: op.reposicao, valor: v.reposicao }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "coordenacao", rotulo: "Coordenação responsável", tipo: "lista", opcoes: usuarios, valor: v.coordenacao || (mSel && mSel.coordenacao) }) +
      c.campo({ nome: "apoioRH", rotulo: "Deseja apoio do RH na conversa?", tipo: "escolha", opcoes: op.simNao, valor: v.apoioRH }) + "</div></div>";
  }
  function ligarVerificacao(el) {
    const atualizar = function () {
      const d = ui.lerForm(el.querySelector("#form-enc"));
      const alvo = el.querySelector("#verificacao-enc");
      if (!d.membroId || !d.motivo) { alvo.innerHTML = '<span class="muted">Escolha o membro e o motivo.</span>'; return; }
      alvo.innerHTML = checagemHtml(dom.verificarRegistros(E().ctx, d.membroId, d.motivo, d.justificativa));
      const coord = el.querySelector('select[name="coordenacao"]');
      const m = E().ctx.idx.membro[d.membroId];
      if (coord && !coord.value && m && m.coordenacao) coord.value = m.coordenacao;
    };
    el.querySelectorAll('[name="membroId"], [name="motivo"], [name="justificativa"]').forEach((x) => x.addEventListener(x.tagName === "TEXTAREA" ? "input" : "change", atualizar));
    atualizar();
  }
  ui.acoes["solicitar-encerramento"] = function (el) {
    const formal = dom.papeis(E().ctx, E().eu.id).enviaFormal;
    ui.abrirPainel({
      titulo: "Solicitar encerramento de contrato", sub: formal ? "Pelo formulário da coordenação: depois da verificação, vai direto ao RH." : "Depois da verificação, segue para a aprovação da coordenação responsável.",
      corpo: formEncerramento(null, el.dataset.membro || ""), largo: true,
      rodape: '<button class="btn" data-acao="criar-encerramento">Enviar a solicitação</button><button class="btn sec" data-acao="criar-encerramento" data-rascunho="1">Salvar como rascunho</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: ligarVerificacao,
    });
  };
  function validarDatas(d) {
    const ctx = E().ctx;
    if (d.dataDesejada && calc.diffDias(ctx.hoje, d.dataDesejada) < 7) return window.confirm("A data desejada fica a menos de 7 dias de hoje. O guia pede pelo menos 7 dias. Enviar mesmo assim?");
    if (d.dataDesejada && calc.diaSemana(d.dataDesejada) === 5) return window.confirm("A data desejada é uma sexta-feira, que o guia pede para evitar. Enviar mesmo assim?");
    return true;
  }
  ui.acoes["criar-encerramento"] = function (el) {
    const f = document.getElementById("form-enc");
    const rascunho = !!el.dataset.rascunho;
    if (!ui.validar(f, rascunho ? ["membroId", "motivo", "coordenacao"] : ["membroId", "motivo", "coordenacao", "descricao", "dataDesejada", "reposicao", "apoioRH"])) return;
    const d = ui.lerForm(f);
    if (!rascunho && !validarDatas(d)) return;
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    const formal = dom.papeis(ctx, E().eu.id).enviaFormal;
    const origem = formal ? "Formulário da coordenação" : "Solicitação da liderança direta";
    const ver = dom.verificarRegistros(ctx, d.membroId, d.motivo, d.justificativa);
    const estagio = rascunho ? "NEW" : dom.destinoEncerramento({ bloqueado: !ver.ok, motivo: d.motivo, origem });
    ui.salvar(el, async () => {
      const e = await ui.criar("encerramentos", {
        titulo: "Encerramento · " + m.nome, membroId: m.id, responsavel: m.responsavel, motivo: d.motivo, coordenacao: d.coordenacao, descricao: d.descricao, justificativa: d.justificativa,
        dataDesejada: d.dataDesejada, reposicao: d.reposicao, apoioRH: d.apoioRH, origem, solicitante: E().eu.id, autor: E().eu.id,
        planoId: ver.plano ? ver.plano.id : "", feedbacksIds: ver.feedbacks.join(","), bloqueio: ver.bloqueios.join("\n"),
        primeiraVerificacao: rascunho ? "" : (ver.ok ? "Aceita na 1ª verificação" : "Bloqueada na 1ª verificação"),
        enviadaRHEm: estagio === "ENVIADA_RH" ? ctx.hoje : "", estagio,
      });
      if (estagio === "ENVIADA_RH") await GP.app.avisarRH("Nova solicitação de encerramento de contrato enviada ao RH (" + m.nome + ").");
      if (estagio === "AG_COORD") await avisarAprovador(e, m);
      ui.navegar("#/offboarding/encerramento/" + e.id);
      return e;
    }, { mensagem: rascunho ? "Rascunho salvo." : estagio === "BLOQUEADA" ? "Solicitação bloqueada: confira o que falta." : estagio === "ENVIADA_RH" ? "Solicitação enviada ao RH." : "Solicitação enviada para a coordenação." });
  };
  ui.acoes["editar-encerramento"] = function (el) {
    const e = E().ctx.idx.porId.encerramentos[el.dataset.id];
    ui.abrirPainel({ titulo: "Editar a solicitação", corpo: formEncerramento(e), largo: true, aoAbrir: ligarVerificacao,
      rodape: '<button class="btn" data-acao="salvar-encerramento" data-id="' + esc(e.id) + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>' });
  };
  ui.acoes["salvar-encerramento"] = function (el) {
    const f = document.getElementById("form-enc");
    if (!ui.validar(f, ["motivo", "coordenacao"])) return;
    const d = ui.lerForm(f);
    ui.salvar(el, () => ui.atualizar("encerramentos", el.dataset.id, { motivo: d.motivo, coordenacao: d.coordenacao, descricao: d.descricao, justificativa: d.justificativa, dataDesejada: d.dataDesejada, reposicao: d.reposicao, apoioRH: d.apoioRH }), { mensagem: "Solicitação salva." });
  };
  /** Enviar/reenviar um rascunho ou uma solicitação bloqueada: a verificação roda de novo */
  ui.acoes["enviar-encerramento"] = function (el) {
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[el.dataset.id];
    const faltam = ["descricao", "dataDesejada", "reposicao", "apoioRH"].filter((k) => !e[k]);
    if (faltam.length) { ui.avisar("Complete a solicitação antes de enviar (descrição, data desejada, reposição e apoio do RH).", "erro"); return; }
    if (!validarDatas(e)) return;
    const ver = dom.verificarRegistros(ctx, e.membroId, e.motivo, e.justificativa);
    const origem = e.origem || "Solicitação da liderança direta";
    const estagio = dom.destinoEncerramento({ bloqueado: !ver.ok, motivo: e.motivo, origem });
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId]);
    ui.salvar(el, async () => {
      await ui.atualizar("encerramentos", e.id, {
        estagio, bloqueio: ver.bloqueios.join("\n"), planoId: ver.plano ? ver.plano.id : e.planoId, feedbacksIds: ver.feedbacks.length ? ver.feedbacks.join(",") : e.feedbacksIds,
        primeiraVerificacao: e.primeiraVerificacao || (ver.ok ? "Aceita na 1ª verificação" : "Bloqueada na 1ª verificação"), enviadaRHEm: estagio === "ENVIADA_RH" ? ctx.hoje : e.enviadaRHEm,
      });
      if (estagio === "ENVIADA_RH") await GP.app.avisarRH("Nova solicitação de encerramento de contrato enviada ao RH (" + m.nome + ").");
      if (estagio === "AG_COORD") await avisarAprovador(Object.assign({}, e, { estagio }), m);
    }, { mensagem: estagio === "BLOQUEADA" ? "Bloqueada: confira o que falta." : estagio === "AG_COORD" ? "Enviada para a aprovação da coordenação." : "Enviada ao RH.", fechar: false });
  };
  /** "Aguardando coordenação": avisa quem aprova (a coordenação responsável, ou o RH quando ela é quem pediu) */
  async function avisarAprovador(e, m) {
    const a = dom.aprovadorDe(E().ctx, e);
    const texto = "Uma solicitação de encerramento de contrato aguarda a sua aprovação (" + m.nome + "). Abra o app Gestão de Pessoas.";
    if (a.rh) await GP.app.avisarRH(texto);
    else await GP.app.avisar([a.id], texto);
  }
  ui.acoes["decidir-encerramento"] = function (el) {
    const dec = el.dataset.decisao;
    if (dec === "aprovar") {
      const ctx = E().ctx;
      const e = ctx.idx.porId.encerramentos[el.dataset.id];
      const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId]);
      ui.salvar(el, async () => {
        await ui.atualizar("encerramentos", e.id, { estagio: "ENVIADA_RH", enviadaRHEm: ctx.hoje, adendos: ui.novoAdendo(e.adendos, "Aprovação da coordenação", "Aprovada e enviada ao RH.") });
        await GP.app.avisarRH("Solicitação de encerramento de contrato aprovada pela coordenação e enviada ao RH (" + m.nome + ").");
      }, { mensagem: "Aprovada e enviada ao RH.", fechar: false });
      return;
    }
    ui.abrirPainel({
      titulo: dec === "recusar" ? "Devolver para a liderança" : "Devolver para rascunho", sub: "A solicitação volta para Rascunho com o seu comentário.",
      corpo: '<div id="form-decisao">' + c.campo({ nome: "comentario", rotulo: "Comentário", tipo: "textoLongo", ajuda: "O que precisa ser ajustado." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-devolucao" data-id="' + esc(el.dataset.id) + '">Devolver</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-devolucao"] = function (el) {
    const f = document.getElementById("form-decisao");
    if (!ui.validar(f, ["comentario"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId]);
    ui.salvar(el, async () => {
      await ui.atualizar("encerramentos", e.id, { estagio: "NEW", adendos: ui.novoAdendo(e.adendos, "Devolvida para ajuste", d.comentario) });
      // 3.5.3: recusado volta para Rascunho com o comentário e notifica a liderança (o comentário fica no app, não no aviso)
      const quem = e.solicitante || e.autor;
      if (quem && quem !== E().eu.id) await GP.app.avisar([quem], "A solicitação de encerramento de contrato de " + m.nome + " voltou para rascunho com um comentário. Abra o app Gestão de Pessoas para ajustar.");
    }, { mensagem: "Solicitação devolvida." });
  };
  ui.acoes["liberar-encerramento"] = function (el) {
    ui.abrirPainel({
      titulo: "Liberar em caso excepcional", sub: "Decisão do RH (6.1). A justificativa fica registrada na solicitação.",
      corpo: '<div id="form-liberar">' + c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-liberacao" data-id="' + esc(el.dataset.id) + '">Liberar e enviar ao RH</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-liberacao"] = function (el) {
    const f = document.getElementById("form-liberar");
    if (!ui.validar(f, ["justificativa"])) return;
    const d = ui.lerForm(f);
    ui.salvar(el, () => ui.atualizar("encerramentos", el.dataset.id, { liberacaoRH: d.justificativa, estagio: "ENVIADA_RH", enviadaRHEm: E().ctx.hoje }), { mensagem: "Solicitação liberada." });
  };
  ui.acoes["mover-encerramento"] = function (el) {
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[el.dataset.id];
    const para = el.dataset.para;
    ui.salvar(el, async () => {
      await ui.atualizar("encerramentos", e.id, { estagio: para });
      if (para === "APROVADA") await ui.atualizar("membros", e.membroId, { estagio: "EM_ENCERRAMENTO" });
    }, { mensagem: "Solicitação em \"" + GP.schema.processo("encerramentos").estagios.find((x) => x.codigo === para).nome + "\".", fechar: false });
  };
  ui.acoes["registrar-conversa"] = function (el) {
    ui.abrirPainel({
      titulo: "Registrar a conversa de encerramento", sub: esc(GUIA.APROVADA.d),
      corpo: '<div id="form-conversa">' + c.campo({ nome: "dataConversa", rotulo: "Data da conversa", tipo: "data", valor: E().ctx.hoje, max: E().ctx.hoje }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-conversa" data-id="' + esc(el.dataset.id) + '">Registrar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-conversa"] = function (el) {
    const f = document.getElementById("form-conversa");
    if (!ui.validar(f, ["dataConversa"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId]);
    ui.salvar(el, async () => {
      await ui.atualizar("encerramentos", e.id, { dataConversa: d.dataConversa, estagio: "CONVERSA_OK" });
      await GP.app.avisarRH("Conversa de encerramento realizada (" + m.nome + "). Distrato e acessos com o RH.");
    }, { mensagem: "Conversa registrada." });
  };
  ui.acoes["concluir-encerramento"] = function (el) {
    ui.abrirPainel({
      titulo: "Concluir o encerramento", sub: "O membro passa para Encerrado no processo Membros.",
      corpo: '<div id="form-concluir">' + c.campo({ nome: "motivoSaida", rotulo: "Motivo de saída (conversa de saída)", ajuda: "Preenchido pelo RH. Alimenta o gráfico de retenção, sem nomes." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-conclusao" data-id="' + esc(el.dataset.id) + '">Concluir</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-conclusao"] = function (el) {
    const d = ui.lerForm(document.getElementById("form-concluir"));
    const ctx = E().ctx;
    const e = ctx.idx.porId.encerramentos[el.dataset.id];
    ui.salvar(el, async () => {
      await ui.atualizar("encerramentos", e.id, { motivoSaida: d.motivoSaida, concluidaEm: ctx.hoje, estagio: "SUCCESS" });
      await ui.atualizar("membros", e.membroId, { estagio: "SUCCESS" });
    }, { mensagem: "Encerramento concluído." });
  };
  ui.acoes["cancelar-encerramento"] = function (el) {
    if (!window.confirm("Cancelar esta solicitação de encerramento?")) return;
    ui.salvar(el, () => ui.atualizar("encerramentos", el.dataset.id, { estagio: "FAIL" }), { mensagem: "Solicitação cancelada.", fechar: false });
  };
  /** Plano encerrado sem os resultados: a liderança decide seguir a sugestão (3.5.3, caminho 2) */
  ui.acoes["encerramento-de-plano"] = function (el) {
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId]);
    ui.salvar(el, async () => {
      const e = await ui.criar("encerramentos", {
        titulo: "Encerramento · " + m.nome, membroId: m.id, responsavel: m.responsavel, motivo: "Resultados abaixo do acordado", coordenacao: m.coordenacao,
        planoId: p.id, feedbacksIds: [p.feedbackAberturaId, p.feedbackEncerramentoId].filter(Boolean).join(","), origem: "Plano encerrado sem os resultados",
        solicitante: E().eu.id, autor: E().eu.id, estagio: "NEW",
      });
      ui.navegar("#/offboarding/encerramento/" + e.id);
      return e;
    }, { mensagem: "Solicitação criada em Rascunho, com o plano e os feedbacks vinculados.", fechar: false });
  };

  GP.telas = GP.telas || {};
  GP.telas.offboarding = { planoResumoHtml, encerramentoResumoHtml, abrirFormPlano };
})(window);
