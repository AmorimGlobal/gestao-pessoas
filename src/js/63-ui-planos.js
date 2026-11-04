/* =====================================================================================
   TELAS — Plano de melhoria (plano de alinhamento de resultados, 3.5.2)
   -------------------------------------------------------------------------------------
   Reunião de 29/10/2026: o plano saiu do Offboarding e foi para Feedbacks, porque o
   alinhamento acontece antes de a pessoa chegar ao desligamento. Ele ganhou botão e
   formulário próprios: não nasce mais de um feedback "de abertura" (o tipo saiu do
   formulário de feedback). O RH vai mandar a estrutura final dos campos; até lá vale a
   da especificação: 2 resultados esperados, check-in no Dia 30 e término no Dia 60.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, primeiroNome } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;
  const VOLTA = "#/rotinas";

  function planoResumoHtml(p, compacto) {
    const ctx = E().ctx;
    const s = dom.statusPlano(ctx, p);
    const fbA = p.feedbackAberturaId ? ctx.idx.porId.feedbacks[p.feedbackAberturaId] : null;
    const fbE = p.feedbackEncerramentoId ? ctx.idx.porId.feedbacks[p.feedbackEncerramentoId] : null;
    const res = (n) => '<div style="padding:10px 12px;background:var(--sutil);border-radius:10px"><div class="k" style="font-size:11px;text-transform:uppercase;color:var(--suave);font-weight:700">Resultado esperado ' + n + '</div><div class="texto-registro">' + esc(p["resultado" + n]) + "</div>" +
      '<div class="muted" style="font-size:12.5px;margin-top:4px">Evidência: ' + esc(p["evidencia" + n] || "") + "</div>" +
      '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + (p["checkin" + n] ? c.tag("Check-in: " + p["checkin" + n], p["checkin" + n] === "Atingido" ? "verde" : p["checkin" + n] === "Não atingido" ? "vermelho" : "ambar") : "") +
      (p["final" + n] ? c.tag("Final: " + p["final" + n], p["final" + n] === "Atingido" ? "verde" : "vermelho") : "") + "</div></div>";
    const linkFb = (f, rot) => '<div>• <a href="#/rotinas/feedback/' + esc(f.id) + '">' + esc(rot) + " · " + calc.fmtData(f.data) + "</a></div>";
    return '<div class="card"><h3>Plano de melhoria de ' + calc.fmtData(p.inicio) + " a " + calc.fmtData(s.termino) + '<span class="extra">' + c.tag(s.texto, s.cor) + "</span></h3>" +
      '<div class="grade c2" style="margin-bottom:12px">' + res(1) + res(2) + "</div>" +
      '<div class="sci">' + c.textoRegistro("Apoio oferecido", p.apoio) + (p.checkinData ? c.textoRegistro("Check-in de " + calc.fmtData(p.checkinData), p.checkinComentario) : "") +
      (fbA || fbE ? '<div><div class="k">Feedbacks SCI ligados ao plano</div>' + (fbA ? linkFb(fbA, "Feedback de " + String(fbA.tipo || "").toLowerCase()) : "") + (fbE ? linkFb(fbE, "Feedback de " + String(fbE.tipo || "").toLowerCase()) : "") + "</div>" : "") +
      (p.adendos ? '<div><div class="k">Adendos</div><div class="adendo">' + esc(p.adendos) + "</div></div>" : "") + "</div>" +
      (compacto ? "" : '<div style="margin-top:12px"><a href="#/rotinas/plano/' + esc(p.id) + '">Abrir o plano →</a></div>') + "</div>";
  }

  function telaPlano(id) {
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[id];
    if (!p) return c.voltar(VOLTA, "Feedbacks") + '<div class="card">' + c.vazio("Plano não encontrado.") + "</div>";
    const s = dom.statusPlano(ctx, p);
    const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId] || {});
    let acoes = "";
    if (s.ativo && !s.checkinFeito) acoes += '<button class="btn" data-acao="checkin-plano" data-id="' + esc(p.id) + '">Registrar o check-in</button>';
    if (s.ativo && s.checkinFeito) acoes += '<button class="btn" data-acao="encerrar-plano" data-id="' + esc(p.id) + '">Encerrar o plano</button>';
    if (E().visao === "rh" && s.ativo) acoes += '<button class="btn sec" data-acao="prorrogar-plano" data-id="' + esc(p.id) + '">Prorrogar</button>';
    acoes += '<button class="btn sec" data-acao="adendo" data-chave="planos" data-id="' + esc(p.id) + '">Adendo</button>';
    acoes += c.botaoExcluir("planos", p, { volta: VOLTA, descricao: "o plano de melhoria de " + m.nome + " (início em " + calc.fmtDataAno(p.inicio) + ")" });
    let h = c.voltar(VOLTA, "Feedbacks") + c.cabecalho("rotinas", "Plano de melhoria de " + m.nome, "<span>" + (s.dia ? "Dia <b>" + s.dia + "</b> de 60" : "") + "</span><span>check-in no Dia 30 (" + calc.fmtData(s.prazoCheckin) + ")</span><span>término " + calc.fmtData(s.termino) + "</span>", acoes);
    h += '<div class="card" style="padding:16px 22px"><div class="barra"><div class="preench ' + (s.cor === "vermelho" ? "vermelho" : "") + '" style="width:' + Math.round(((s.dia || 0) / 60) * 100) + '%"></div><div class="meta" style="left:50%" title="Check-in no Dia 30"></div></div><div class="barra-nota">Dia ' + (s.dia || 0) + " de 60 · " + esc(s.texto) + "</div></div>";
    if (p.estagio === "FAIL") {
      // solicitação do fluxo anterior do app, se houver; as novas vão pelo formulário de encerramento (04/11/2026)
      const jaTem = (ctx.idx.porMembro.encerramentos[p.membroId] || []).find((e) => e.estagio !== "FAIL");
      h += '<div class="card acao vermelho"><h3>O plano terminou sem os resultados</h3><p class="muted" style="margin-top:0">O app sugere avaliar o encerramento de contrato. A decisão é da liderança direta, alinhada com a coordenação. ' +
        "Se seguir, o formulário de encerramento abre com " + esc(primeiroNome(m.nome)) + " e a justificativa \"Desempenho abaixo da média\", e o plano, os feedbacks SCI e os 1:1 vão para a timeline do card do RH.</p>" +
        (jaTem ? '<a class="btn sec" href="#/offboarding/encerramento/' + esc(jaTem.id) + '">Abrir a solicitação existente</a>'
          : '<button class="btn" data-acao="solicitar-encerramento" data-membro="' + esc(p.membroId) + '" data-motivo="Desempenho abaixo da média">Solicitar o encerramento</button>') + "</div>";
    }
    return h + planoResumoHtml(p, true);
  }

  /** Formulário do plano de melhoria. Pode ligar um feedback de desenvolvimento já registrado (opcional). */
  function abrirFormPlano(membroId) {
    const ctx = E().ctx;
    const membros = ui.minhaEquipe().concat(E().visao !== "lideranca" ? ui.membrosDaVisao() : []).filter((m, i, a) => a.indexOf(m) === i && m.estagio === "ATIVO").map((m) => dom.infoMembro(ctx, m))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const usados = {};
    (ctx.registros.planos || []).forEach((p) => { usados[p.feedbackAberturaId] = true; });
    const desde = calc.addDias(ctx.hoje, -90);
    const opcoesFb = (mid) => dom.feedbacksDo(ctx, mid).filter((f) => calc.ehFeedbackDesenvolvimento(f.tipo) && f.data >= desde && !usados[f.id])
      .map((f) => ({ valor: f.id, rotulo: "Feedback de " + String(f.tipo || "").toLowerCase() + " · " + calc.fmtDataAno(f.data) }));
    const corpo = '<div id="form-plano">' + c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })), valor: membroId }) +
      c.campo({ nome: "feedbackAberturaId", rotulo: "Feedback de desenvolvimento ligado ao plano", tipo: "lista", opcoes: membroId ? opcoesFb(membroId) : [], opcional: true, ajuda: "O feedback SCI em que o plano foi conversado com o membro, se já estiver registrado (últimos 90 dias)." }) +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Data de início (Dia 1)", tipo: "data", valor: ctx.hoje }) + '<div class="campo"><div class="rotulo">Término (Dia 60)</div><div class="entrada" id="termino-plano" style="background:var(--sutil)">' + calc.fmtDataAno(calc.terminoPlano(ctx.hoje)) + "</div></div></div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">2 resultados esperados</div>' +
      c.campo({ nome: "resultado1", rotulo: "Resultado esperado 1", tipo: "textoLongo", linhas: 2, ajuda: "Um resultado de trabalho, mensurável. Nada sobre horário ou forma de execução." }) + c.campo({ nome: "evidencia1", rotulo: "Evidência de atingimento 1", tipo: "textoLongo", linhas: 2 }) +
      c.campo({ nome: "resultado2", rotulo: "Resultado esperado 2", tipo: "textoLongo", linhas: 2 }) + c.campo({ nome: "evidencia2", rotulo: "Evidência de atingimento 2", tipo: "textoLongo", linhas: 2 }) + "</div>" +
      c.campo({ nome: "apoio", rotulo: "Apoio oferecido", tipo: "textoLongo", linhas: 2, ajuda: "O que a liderança e a supervisão vão fazer para apoiar." }) + "</div>";
    ui.abrirPainel({
      titulo: "Plano de melhoria", sub: "Plano de alinhamento de resultados: 60 dias, com check-in no Dia 30. Coordenação e RH são avisados na abertura.", corpo, largo: true,
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
  ui.acoes["novo-plano"] = function (el) { abrirFormPlano(el.dataset.membro || ""); };
  ui.acoes["salvar-plano"] = function (el) {
    const f = document.getElementById("form-plano");
    if (!ui.validar(f, ["membroId", "inicio", "resultado1", "evidencia1", "resultado2", "evidencia2", "apoio"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    if (dom.planoAtivoDo(ctx, m.id)) { ui.erroNoPainel(m.nome + " já tem um plano em andamento."); return; }
    ui.salvar(el, async () => {
      const p = await ui.criar("planos", {
        titulo: "Plano de melhoria · " + m.nome, membroId: m.id, responsavel: m.responsavel, feedbackAberturaId: d.feedbackAberturaId || "", inicio: d.inicio, termino: calc.terminoPlano(d.inicio),
        resultado1: d.resultado1, evidencia1: d.evidencia1, resultado2: d.resultado2, evidencia2: d.evidencia2, apoio: d.apoio, autor: E().eu.id, estagio: "NEW",
      });
      if (d.feedbackAberturaId) await ui.atualizar("feedbacks", d.feedbackAberturaId, { planoId: p.id });
      await GP.app.avisarRH("Plano de melhoria (alinhamento de resultados) aberto para " + m.nome + ", com término em " + calc.fmtData(p.termino) + ".", [m.coordenacao]);
      ui.navegar("#/rotinas/plano/" + p.id);
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
    const fbs = dom.feedbacksDo(ctx, p.membroId).filter((f) => f.data >= p.inicio && f.id !== p.feedbackAberturaId).map((f) => ({ valor: f.id, rotulo: "Feedback de " + String(f.tipo || "").toLowerCase() + " · " + calc.fmtDataAno(f.data) }));
    ui.abrirPainel({
      titulo: "Encerrar o plano (Dia 60)", largo: true,
      corpo: '<div id="form-enc-plano">' +
        "<p><b>1.</b> " + esc(p.resultado1) + "</p>" + c.campo({ nome: "final1", rotulo: "Situação final do resultado 1", tipo: "escolha", opcoes: op.situacaoFinal }) +
        "<p><b>2.</b> " + esc(p.resultado2) + "</p>" + c.campo({ nome: "final2", rotulo: "Situação final do resultado 2", tipo: "escolha", opcoes: op.situacaoFinal }) +
        c.campo({ nome: "feedbackEncerramentoId", rotulo: "Feedback SCI do encerramento do plano", tipo: "lista", opcoes: fbs, opcional: true, ajuda: "O feedback em que o resultado do plano foi conversado com o membro, se já estiver registrado." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-enc-plano" data-id="' + esc(p.id) + '">Encerrar o plano</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-enc-plano"] = function (el) {
    const f = document.getElementById("form-enc-plano");
    if (!ui.validar(f, ["final1", "final2"])) return;
    const d = ui.lerForm(f);
    const atingiu = d.final1 === "Atingido" && d.final2 === "Atingido";
    const ctx = E().ctx;
    const p = ctx.idx.porId.planos[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[p.membroId]);
    ui.salvar(el, async () => {
      await ui.atualizar("planos", p.id, { final1: d.final1, final2: d.final2, feedbackEncerramentoId: d.feedbackEncerramentoId || "", estagio: atingiu ? "SUCCESS" : "FAIL" });
      if (d.feedbackEncerramentoId) await ui.atualizar("feedbacks", d.feedbackEncerramentoId, { planoId: p.id });
      await GP.app.avisarRH("Plano de melhoria de " + m.nome + " encerrado: " + (atingiu ? "resultados atingidos." : "resultados não atingidos."), [m.coordenacao]);
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

  GP.telas = GP.telas || {};
  GP.telas.planos = { planoResumoHtml, telaPlano, abrirFormPlano };
})(window);
