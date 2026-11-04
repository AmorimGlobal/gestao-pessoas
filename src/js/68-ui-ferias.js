/* =====================================================================================
   TELAS — Férias e ausências (Políticas de Férias e Ausências do RH, 04/11/2026)
   -------------------------------------------------------------------------------------
   Todo mundo pede aqui, inclusive o membro (é a tela dele, com o Perfil). Antes do
   formulário, a pessoa lê a política do tipo escolhido e marca que leu. O pedido fica no
   processo "Férias e ausências", e o e-mail para hr@amorimlawfirm.com com cópia para a
   liderança direta sai pronto (Gmail, e-mail do computador ou copiar). O RH analisa, a
   liderança confirma, e só então o período entra na Agenda da equipe. Cada passo avisa no
   sino do app e no Bitrix, e a resposta por e-mail também sai pronta.
   Mora aqui também o "Meu aniversário" (perfil do Bitrix), que o day off de aniversário usa.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const F = GP.ferias;
  const E = () => ui.estado;
  const COR_TIPO = { "Férias": "azul", "Day off": "verde", "Pausa contratual": "ambar" };
  const semEstrutura = () => !!(E().ctx.recursos && E().ctx.recursos.ferias === false);
  const pedido = (id) => (E().ctx.idx.porId.ferias || {})[id];
  const recentes = (lista) => lista.slice().sort((a, b) => (String(a.criadoEm) < String(b.criadoEm) ? 1 : -1));

  /* ================================================================ TELA */
  function linha(p, comPessoa) {
    const ctx = E().ctx;
    const s = F.situacao(ctx, p);
    const quem = dom.pessoa(ctx, p.responsavel);
    return '<div class="item clicavel" data-rota="#/ferias/' + esc(p.id) + '">' + (comPessoa ? c.avatar(quem, 30) : "") +
      '<div class="principal-item"><div class="t">' + (comPessoa ? esc(quem.nome) + " · " : "") + esc(p.tipo) + (p.motivoDayOff ? " (" + esc(p.motivoDayOff.toLowerCase()) + ")" : "") + "</div>" +
      '<div class="d">' + esc(F.periodo(p)) + "</div>" + (p.foraDaPolitica && p.estagio !== "FAIL" ? '<div class="d" style="color:var(--ambar)">Com pontos fora da política</div>' : "") + "</div>" +
      '<div class="lado">' + c.tag(s.texto, s.cor) + (s.prazo && p.estagio !== "FAIL" && p.estagio !== "SUCCESS" ? '<span class="prazo">' + (s.cor === "vermelho" ? "prazo vencido em " : "resposta até ") + calc.fmtData(s.prazo) + "</span>" : "") + "</div></div>";
  }
  function lista(itens, comPessoa, vazio) { return itens.length ? '<div class="lista">' + itens.map((p) => linha(p, comPessoa)).join("") + "</div>" : c.vazio(vazio); }

  /** A política inteira (o fluxo, os três tipos e os feriados), para consultar a qualquer hora */
  function politicaHtml(aberta) {
    const P = F.POLITICA;
    const sec = (t, itens) => "<h4>" + esc(t) + "</h4><ul>" + itens.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    return '<details class="card politica"' + (aberta ? " open" : "") + '><summary>' + icone("manual", 15) + " Políticas de Férias e Ausências</summary>" +
      '<div class="corpo-politica"><h4>Fluxo de solicitação</h4><ol>' + P.fluxo.map((x) => "<li><b>" + esc(x[0]) + ".</b> " + esc(x[1]) + "</li>").join("") + "</ol>" +
      sec("Férias", P["Férias"]) + sec("Day off", P["Day off"]) + sec("Pausa contratual", P["Pausa contratual"]) + sec("Feriados", P.feriados) +
      '<p class="muted" style="font-size:12px">Dúvidas: ' + esc(F.EMAIL_RH) + ".</p></div></details>";
  }

  ui.rotas.ferias = function (partes) {
    if (partes[0]) return telaPedido(partes[0]);
    const ctx = E().ctx, eu = E().eu;
    const rh = E().visao === "rh";
    const todos = ctx.registros.ferias || [];
    const meus = recentes(todos.filter((p) => String(p.responsavel) === String(eu.id)));
    const paraRH = rh ? F.paraRH(ctx) : [];
    const paraMim = F.paraLideranca(ctx, eu.id);
    const equipe = E().visao === "membro" ? [] : rh ? recentes(todos.filter((p) => String(p.responsavel) !== String(eu.id))) : F.daEquipe(ctx, eu.id);
    const u = dom.pessoa(ctx, eu.id);
    const esperam = paraRH.length + paraMim.length;
    let h = c.cabecalho("ferias", "Férias e ausências",
      (esperam ? "<span><b>" + esperam + "</b> aguardando você</span>" : "") + "<span><b>" + meus.filter((p) => p.estagio === "NEW" || p.estagio === "AG_LIDERANCA").length + "</b> pedido(s) seu(s) em andamento</span>",
      semEstrutura() ? "" : '<button class="btn" data-acao="novo-pedido-ferias">' + icone("mais", 15) + " Novo pedido</button>");
    if (semEstrutura()) {
      h += '<div class="aviso-atencao" style="margin-bottom:16px"><b>O processo "Férias e ausências" ainda não existe no Bitrix.</b> ' +
        (eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura". Depois, dê as permissões (docs/configuracao-bitrix.md, seção 4).' : "Avise o TI: falta criar a estrutura no Bitrix.") + "</div>";
    }
    h += '<div class="aviso-info" style="margin-bottom:16px">Férias, day off e pausa contratual seguem a política do RH: você pede aqui, depois de ler as regras, e envia o e-mail que o app escreve para ' + esc(F.EMAIL_RH) +
      ", com cópia para a sua liderança. O RH analisa, a liderança confirma, e o período entra na agenda da equipe.</div>";
    if (paraRH.length) h += '<div class="card acao"><h3>Aguardando o RH<span class="extra muted">resposta em até 3 dias úteis (5 na pausa contratual)</span></h3>' + lista(paraRH, true, "") + "</div>";
    if (paraMim.length) h += '<div class="card acao"><h3>Aguardando a sua confirmação<span class="extra muted">em até 2 dias úteis depois do RH (5 na pausa)</span></h3>' + lista(paraMim, true, "") + "</div>";
    // o aniversário fica no topo dos seus pedidos, numa linha: o day off de aniversário usa o mês dele
    const aniv = (u.aniversario ? "Seu aniversário: <b>" + calc.fmtData("2000-" + u.aniversario) + "</b> · day off no mês de " + calc.MESES_LONGOS[Number(u.aniversario.slice(0, 2)) - 1] + "."
      : "Seu aniversário não está cadastrado: o day off de aniversário usa o mês dele.") +
      (E().verComo ? "" : ' <a href="#" data-acao="meu-aniversario">' + (u.aniversario ? "Atualizar" : "Cadastrar") + "</a>");
    h += '<div class="card"><h3>Seus pedidos</h3><p class="muted" style="margin-top:0;font-size:12.5px">' + aniv + "</p>" + lista(meus, false, "Você ainda não fez nenhum pedido.") + "</div>";
    if (E().visao !== "membro" && equipe.length) h += '<div class="card"><h3>Pedidos da equipe<span class="extra muted">' + (equipe.length > 15 ? "os 15 mais recentes de " + equipe.length : plural(equipe.length, "pedido", "pedidos")) + "</span></h3>" + lista(equipe.slice(0, 15), true, "") + "</div>";
    h += politicaHtml(false);
    return h;
  };

  /* ================================================================ UM PEDIDO */
  function telaPedido(id) {
    const ctx = E().ctx, eu = E().eu;
    const p = pedido(id);
    if (!p) return c.voltar("#/ferias", "Férias e ausências") + '<div class="card">' + c.vazio("Pedido não encontrado ou fora da sua visão.") + "</div>";
    const s = F.situacao(ctx, p);
    const quem = dom.pessoa(ctx, p.responsavel);
    const meu = String(p.responsavel) === String(eu.id);
    const rh = E().visao === "rh";
    const souLid = String(p.lideranca) === String(eu.id);
    const aberto = p.estagio === "NEW" || p.estagio === "AG_LIDERANCA";
    let acoes = "";
    if (rh && !meu && p.estagio === "NEW") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-quem="rh" data-decisao="Aprovada">Aprovar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-quem="rh" data-decisao="Recusada">Recusar</button>';
    if (souLid && !meu && p.estagio === "AG_LIDERANCA") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-quem="lideranca" data-decisao="Aprovada">Confirmar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-quem="lideranca" data-decisao="Recusada">Recusar</button>';
    if (meu && aberto && !p.emailEnviadoEm) acoes += '<button class="btn" data-acao="email-ferias" data-id="' + esc(p.id) + '" data-quem="pedido">' + icone("email", 14) + " Enviar o e-mail ao RH</button>";
    if (!meu && ((rh && p.rhDecisao) || (souLid && p.liderancaDecisao))) acoes += '<button class="btn sec" data-acao="email-ferias" data-id="' + esc(p.id) + '" data-quem="' + (souLid && p.liderancaDecisao ? "lideranca" : "rh") + '">' + icone("email", 14) + " Responder por e-mail</button>";
    if (meu && aberto) acoes += '<button class="btn link" data-acao="cancelar-ferias" data-id="' + esc(p.id) + '">Cancelar o pedido</button>';
    const passos = [["Pedido", true], ["RH", !!p.rhDecisao], ["Liderança", !!p.liderancaDecisao], ["Aprovado", p.estagio === "SUCCESS"]];
    const atual = p.estagio === "NEW" ? 1 : p.estagio === "AG_LIDERANCA" ? 2 : -1;
    let h = c.voltar("#/ferias", "Férias e ausências") + c.cabecalho("ferias", p.tipo + " · " + quem.nome, "<span>" + c.tag(s.texto, s.cor) + "</span><span>" + esc(F.periodo(p)) + "</span>", acoes) +
      '<div class="card"><div class="passos">' + passos.map((x, i) => '<span class="p ' + (x[1] && i !== atual ? "feito" : i === atual ? "atual" : "") + '">' + x[0] + "</span>").join("") +
      (p.estagio === "FAIL" ? '<span class="p">' + esc(s.texto) + "</span>" : "") + "</div>" +
      (s.prazo && aberto ? '<p class="muted" style="font-size:12px;margin:8px 0 0">' + (p.estagio === "NEW" ? "O RH responde até " : "A liderança confirma até ") + calc.fmtDataAno(s.prazo) + ".</p>" : "") + "</div>";
    if (p.foraDaPolitica) h += '<div class="card acao"><h3>' + icone("alerta", 15) + ' Pontos fora da política</h3><ul style="margin:0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<p class="muted" style="font-size:12px;margin-bottom:0">Apontados pelo app na hora do pedido. A justificativa de quem pediu está abaixo; quem decide é o RH.</p></div>';
    const lid = p.lideranca ? dom.pessoa(ctx, p.lideranca).nome : "";
    h += '<div class="card"><h3>Pedido</h3>' + c.dados([["Tipo", p.tipo + (p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : "")], ["Período", F.periodo(p)], ["Liderança direta", lid],
      ["Pedido em", calc.fmtDataAno(p.criadoEm)], ["Regras lidas em", calc.fmtDataAno(p.regrasLidasEm)], ["E-mail ao RH", p.emailEnviadoEm ? "enviado em " + calc.fmtDataAno(p.emailEnviadoEm) : "ainda não marcado como enviado"]]) +
      '<div class="sci" style="margin-top:14px">' + c.textoRegistro("Cobertura das atividades", p.cobertura) + c.textoRegistro("Justificativa", p.justificativa) + "</div></div>";
    if (p.rhDecisao || p.liderancaDecisao || p.canceladaEm) {
      h += '<div class="card"><h3>Respostas</h3><div class="sci">' +
        (p.rhDecisao ? "<div><div class=\"k\">RH · " + esc(p.rhDecisao.toLowerCase()) + " em " + calc.fmtDataAno(p.rhEm) + '</div><div class="texto-registro">' + esc(p.rhComentario || "Sem comentário.") + "</div></div>" : "") +
        (p.liderancaDecisao ? "<div><div class=\"k\">" + esc(lid || "Liderança") + " · " + (p.liderancaDecisao === "Aprovada" ? "confirmado" : "recusado") + " em " + calc.fmtDataAno(p.liderancaEm) + '</div><div class="texto-registro">' + esc(p.liderancaComentario || "Sem comentário.") + "</div></div>" : "") +
        (p.canceladaEm ? '<div><div class="k">Cancelado por quem pediu em ' + calc.fmtDataAno(p.canceladaEm) + "</div></div>" : "") + "</div></div>";
    }
    return h;
  }

  /* ================================================================ NOVO PEDIDO */
  const CONTRATOS = ["Associado", "PJ", "Estágio", "CLT"];
  function regrasHtml(tipo) {
    if (!tipo) return "";
    return '<div class="regras"><div class="rotulo">Regras de ' + esc(F.NOME_TIPO[tipo]) + "</div><ul>" + F.POLITICA[tipo].map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<div class="rotulo">Como o pedido anda</div><ol>' + F.POLITICA.fluxo.map((x) => "<li><b>" + esc(x[0]) + ".</b> " + esc(x[1]) + "</li>").join("") + "</ol>" +
      '<label class="escolha li-regras"><input type="checkbox" name="lido"><span>Li as regras de ' + esc(F.NOME_TIPO[tipo]) + " e o fluxo do pedido</span></label></div>";
  }
  function camposHtml(pessoa) {
    const so = (tipos) => ' data-tipos="' + tipos + '"';
    const ctx = E().ctx;
    return '<div id="campos-ferias" hidden>' +
      '<div' + so("Day off") + ">" + c.campo({ nome: "motivoDayOff", rotulo: "Motivo do day off", tipo: "escolha", opcoes: GP.schema.OPCOES.motivoDayOff }) + "</div>" +
      (pessoa.contrato ? "" : c.campo({ nome: "contrato", rotulo: "Seu modelo de contrato", tipo: "lista", opcoes: CONTRATOS, opcional: true, ajuda: "O app não achou o seu contrato no cadastro. As regras mudam para estágio e CLT." })) +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Primeiro dia", tipo: "data", min: ctx.hoje }) +
      '<div' + so("Férias") + ">" + c.campo({ nome: "duracao", rotulo: "Duração", tipo: "lista", opcoes: [{ valor: "23", rotulo: "23 dias (de uma vez)" }, { valor: "15", rotulo: "15 dias (uma das partes)" }, { valor: "8", rotulo: "8 dias (uma das partes)" }, { valor: "outra", rotulo: "Outra duração" }] }) + "</div>" +
      '<div' + so("Pausa contratual,Férias-outra") + ">" + c.campo({ nome: "fim", rotulo: "Último dia", tipo: "data", min: ctx.hoje }) + "</div></div>" +
      '<div id="periodo-ferias" class="muted" style="font-size:12.5px;margin:-6px 0 14px"></div>' +
      '<div' + so("Férias,Pausa contratual") + ">" + c.campo({ nome: "cobertura", rotulo: "Como as suas atividades ficam cobertas no período?", tipo: "textoLongo", ajuda: "A política pede cobertura do time no período: quem assume o quê." }) + "</div>" +
      c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo", opcional: true, ajuda: "Obrigatória na pausa contratual e quando o pedido tem pontos fora da política." }) +
      '<div class="grupo-form"><div class="rotulo-grupo">Conferência com a política</div><div id="conferencia-ferias" class="muted">Preencha o período.</div></div></div>';
  }
  /** O pedido como está no formulário */
  function lerPedido(f) {
    const d = ui.lerForm(f);
    // o campo escondido guarda o que foi digitado antes da troca de tipo: o day off não leva cobertura
    const p = { tipo: d.tipo || "", motivoDayOff: d.tipo === "Day off" ? d.motivoDayOff || "" : "", inicio: d.inicio || "", cobertura: d.tipo === "Day off" ? "" : d.cobertura || "", justificativa: d.justificativa || "" };
    if (d.tipo === "Day off") p.fim = p.inicio;
    else if (d.tipo === "Férias" && d.duracao && d.duracao !== "outra") p.fim = p.inicio ? calc.addDias(p.inicio, Number(d.duracao) - 1) : "";
    else p.fim = d.fim || "";
    return { p, d };
  }
  function pessoaDoForm(d) {
    const pessoa = F.dadosDaPessoa(E().ctx, E().eu.id);
    if (!pessoa.contrato && d.contrato) pessoa.contrato = d.contrato;
    return pessoa;
  }
  function ligarFormFerias(el) {
    const f = el.querySelector("#form-ferias");
    const btn = el.querySelector('[data-acao="enviar-pedido-ferias"]');
    let tipoAtual = "";
    const atualizar = function (ev) {
      const { p, d } = lerPedido(f);
      // tipo novo: as regras dele, e é preciso marcar de novo que leu
      if (d.tipo !== tipoAtual) {
        tipoAtual = d.tipo;
        f.querySelector("#regras-ferias").innerHTML = regrasHtml(d.tipo);
        f.dataset.lidoEm = "";
      }
      const lido = !!(f.querySelector('[name="lido"]') || {}).checked;
      if (lido && !f.dataset.lidoEm) f.dataset.lidoEm = new Date().toISOString();
      f.querySelector("#campos-ferias").hidden = !lido;
      btn.disabled = !lido;
      f.querySelectorAll("[data-tipos]").forEach((x) => {
        const tipos = x.dataset.tipos.split(",");
        x.hidden = !(tipos.indexOf(d.tipo) >= 0 || (d.tipo === "Férias" && d.duracao === "outra" && tipos.indexOf("Férias-outra") >= 0));
      });
      const per = f.querySelector("#periodo-ferias");
      per.textContent = p.inicio && p.fim && p.fim >= p.inicio ? F.periodo(p) + (p.tipo !== "Day off" ? " · volta em " + calc.fmtDiaSemana(calc.voltaEm(p.fim, dom.feriadosDe(E().ctx, pessoaDoForm(d).sigla))) + ", " + calc.fmtData(calc.voltaEm(p.fim, dom.feriadosDe(E().ctx, pessoaDoForm(d).sigla))) : "") : "";
      const alvo = f.querySelector("#conferencia-ferias");
      if (!lido || !d.tipo) return;
      const conf = F.conferirPedido(E().ctx, p, pessoaDoForm(d));
      alvo.innerHTML = '<div class="checagem">' + conf.ok.map((x) => '<div class="ok"><span class="s">✓</span><span>' + esc(x) + "</span></div>").join("") +
        conf.fora.map((x) => '<div class="falta"><span class="s">!</span><span>' + esc(x) + "</span></div>").join("") + "</div>" +
        (conf.fora.length ? '<div class="aviso-atencao" style="margin-top:8px">O pedido pode seguir com pontos fora da política, com a justificativa. Quem decide é o RH.</div>' : "") +
        (conf.erros.length ? '<div class="muted" style="margin-top:8px">Falta: ' + esc(conf.erros.join(" ")) + "</div>" : "");
    };
    f.addEventListener("change", atualizar);
    f.addEventListener("input", (ev) => { if (ev.target.tagName === "TEXTAREA") return; atualizar(ev); });
    atualizar();
  }
  ui.acoes["novo-pedido-ferias"] = function (el) {
    if (semEstrutura()) { ui.avisar("O processo Férias e ausências ainda não existe no Bitrix.", "erro"); return; }
    const pessoa = F.dadosDaPessoa(E().ctx, E().eu.id);
    const lid = pessoa.lideranca ? dom.pessoa(E().ctx, pessoa.lideranca).nome : "";
    ui.abrirPainel({
      titulo: "Novo pedido de férias ou ausência", largo: true,
      sub: "Escolha o tipo, leia as regras e marque que leu: o formulário aparece em seguida. O pedido vai para o RH" + (lid ? " e para a sua liderança (" + esc(lid) + ")" : "") + ".",
      corpo: '<div id="form-ferias">' + c.campo({ nome: "tipo", rotulo: "O que você quer pedir?", tipo: "escolha", opcoes: F.TIPOS, valor: (el && el.dataset.tipo) || "" }) +
        '<div id="regras-ferias"></div>' + camposHtml(pessoa) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-pedido-ferias" disabled>Registrar o pedido</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: ligarFormFerias,
    });
  };
  ui.acoes["enviar-pedido-ferias"] = function (el) {
    const f = document.getElementById("form-ferias");
    const { p, d } = lerPedido(f);
    if (!d.lido) { ui.erroNoPainel("Leia as regras e marque que leu."); return; }
    const ctx = E().ctx, eu = E().eu;
    const pessoa = pessoaDoForm(d);
    const conf = F.conferirPedido(ctx, p, pessoa);
    if (conf.erros.length) { ui.erroNoPainel(conf.erros.join(" ")); return; }
    const dados = {
      titulo: p.tipo + " · " + eu.nome, responsavel: eu.id, autor: eu.id, lideranca: pessoa.lideranca || "", estagio: "NEW",
      tipo: p.tipo, motivoDayOff: p.motivoDayOff, inicio: p.inicio, fim: p.fim, dias: conf.dias,
      cobertura: p.cobertura.trim(), justificativa: p.justificativa.trim(), foraDaPolitica: conf.fora.join("\n"),
      regrasLidasEm: f.dataset.lidoEm || new Date().toISOString(),
    };
    ui.salvar(el, async () => {
      const novo = await ui.criar("ferias", dados);
      const oque = F.NOME_TIPO[p.tipo] + " (" + F.periodoCurto(novo) + ")";
      await GP.app.avisarRH(eu.nome + " pediu " + oque + (conf.fora.length ? ", com pontos fora da política" : "") + ". O RH analisa até " + calc.fmtData(F.prazoRH(ctx, novo)) + ".");
      if (pessoa.lideranca) await GP.app.avisar([pessoa.lideranca], eu.nome + " pediu " + oque + ". O RH analisa primeiro; depois é a sua vez de confirmar.");
      return novo;
    }, { mensagem: "Pedido registrado. Falta o e-mail ao RH." }).then((novo) => { if (novo && novo.id) abrirEmail(novo.id, "pedido"); });
  };

  /* ================================================================ E-MAIL (o fluxo da política) */
  function emailDe(p, quem) {
    const ctx = E().ctx;
    return quem === "pedido" ? F.emailDoPedido(ctx, p, F.dadosDaPessoa(ctx, p.responsavel)) : F.emailDaDecisao(ctx, p, quem);
  }
  function abrirEmail(id, quem) {
    const p = pedido(id);
    if (!p) return;
    const e = emailDe(p, quem);
    const doPedido = quem === "pedido";
    ui.abrirPainel({
      titulo: doPedido ? "Enviar o e-mail ao RH" : "Responder por e-mail", largo: true,
      sub: doPedido ? "A política pede o pedido por e-mail para " + esc(F.EMAIL_RH) + ", com cópia para a sua liderança direta. Está pronto: abra no seu e-mail e envie."
        : "A política pede a resposta por e-mail. Está pronta: abra no seu e-mail e envie.",
      corpo: '<div class="email-pronto">' + c.dados([["Para", e.para || "(sem e-mail no perfil do Bitrix)"], ["Cópia", e.cc.join(", ") || "—"], ["Assunto", e.assunto]]) +
        '<pre class="email-corpo" id="email-corpo">' + esc(e.corpo) + "</pre>" +
        (doPedido ? '<p class="muted" style="font-size:12px">Depois de enviar, marque "Já enviei": o RH e a sua liderança veem no pedido que o e-mail saiu.</p>' : "") + "</div>",
      rodape: '<a class="btn" target="_blank" rel="noopener" href="' + esc(F.linkGmail(e)) + '">' + icone("email", 14) + " Abrir no Gmail</a>" +
        '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(F.linkMailto(e)) + '">Abrir no e-mail do computador</a>' +
        '<button class="btn sec" data-acao="copiar-email" data-id="' + esc(id) + '" data-quem="' + esc(quem) + '">Copiar</button>' +
        (doPedido && !p.emailEnviadoEm ? '<button class="btn link" data-acao="email-enviado" data-id="' + esc(id) + '">Já enviei</button>' : '<button class="btn link" data-acao="fechar-painel">Fechar</button>'),
    });
  }
  ui.acoes["email-ferias"] = function (el) { abrirEmail(el.dataset.id, el.dataset.quem); };
  ui.acoes["copiar-email"] = function (el) {
    const texto = F.textoDoEmail(emailDe(pedido(el.dataset.id), el.dataset.quem));
    const feito = () => ui.avisar("E-mail copiado: cole no seu e-mail e envie.");
    const reserva = () => {
      // dentro do Bitrix (iframe) a área de transferência pode ser bloqueada: seleciona o texto para o Ctrl+C
      const pre = document.getElementById("email-corpo");
      try { const r = document.createRange(); r.selectNodeContents(pre); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); if (document.execCommand("copy")) { feito(); return; } } catch (e) { /* segue */ }
      ui.avisar("Não consegui copiar sozinho: o texto está selecionado, use Ctrl+C.", "erro");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, reserva); else reserva();
  };
  ui.acoes["email-enviado"] = function (el) {
    ui.salvar(el, () => ui.atualizar("ferias", el.dataset.id, { emailEnviadoEm: new Date().toISOString() }), { mensagem: "Anotado: e-mail enviado ao RH." });
  };

  /* ================================================================ DECISÕES */
  ui.acoes["decidir-ferias"] = function (el) {
    const p = pedido(el.dataset.id);
    if (!p) return;
    const rh = el.dataset.quem === "rh";
    const nome = dom.pessoa(E().ctx, p.responsavel).nome;
    ui.abrirPainel({
      titulo: (rh ? "Resposta do RH" : "Confirmação da liderança") + " · " + nome, sub: esc(p.tipo + " · " + F.periodo(p)),
      corpo: '<div id="form-decisao-ferias">' +
        (p.foraDaPolitica ? '<div class="aviso-atencao" style="margin-bottom:14px"><b>Pontos fora da política:</b><ul style="margin:6px 0 0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" + (p.justificativa ? "<div style=\"margin-top:6px\"><b>Justificativa:</b> " + esc(p.justificativa) + "</div>" : "") + "</div>" : "") +
        c.campo({ nome: "decisao", rotulo: "Decisão", tipo: "escolha", opcoes: [{ valor: "Aprovada", rotulo: rh ? "Aprovar" : "Confirmar" }, { valor: "Recusada", rotulo: "Recusar" }], valor: el.dataset.decisao }) +
        c.campo({ nome: "comentario", rotulo: "Comentário", tipo: "textoLongo", opcional: true, ajuda: "Vai no e-mail de resposta. Na recusa, é obrigatório: explique o motivo." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-decisao-ferias" data-id="' + esc(p.id) + '" data-quem="' + esc(el.dataset.quem) + '">Registrar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-decisao-ferias"] = function (el) {
    const f = document.getElementById("form-decisao-ferias");
    if (!ui.validar(f, ["decisao"])) return;
    const d = ui.lerForm(f);
    const comentario = String(d.comentario || "").trim();
    if (d.decisao === "Recusada" && !comentario) { ui.erroNoPainel("Na recusa, explique o motivo no comentário."); return; }
    const ctx = E().ctx;
    const p = pedido(el.dataset.id);
    const rh = el.dataset.quem === "rh";
    const aprovada = d.decisao === "Aprovada";
    const agora = new Date().toISOString();
    // sem liderança direta (ninguém acima no Bitrix), a aprovação do RH já fecha o pedido
    const dados = rh ? { rhDecisao: d.decisao, rhEm: agora, rhComentario: comentario, estagio: aprovada ? (p.lideranca ? "AG_LIDERANCA" : "SUCCESS") : "FAIL" }
      : { liderancaDecisao: d.decisao, liderancaEm: agora, liderancaComentario: comentario, estagio: aprovada ? "SUCCESS" : "FAIL" };
    const nome = dom.pessoa(ctx, p.responsavel).nome;
    const oque = F.NOME_TIPO[p.tipo] + " (" + F.periodoCurto(p) + ")";
    ui.salvar(el, async () => {
      const it = await ui.atualizar("ferias", p.id, dados);
      // o pedido é da própria pessoa: ela também recebe o aviso da decisão (o conteúdo de feedback é que nunca vai ao membro)
      if (rh) {
        if (p.lideranca) await GP.app.avisar([p.lideranca], aprovada ? "O RH aprovou o pedido de " + oque + " de " + nome + ". Confirme até " + calc.fmtData(F.prazoLideranca(ctx, it)) + " no app Gestão de Pessoas." : "O RH recusou o pedido de " + oque + " de " + nome + ".");
        await GP.app.avisar([p.responsavel], aprovada ? "O RH aprovou o seu pedido de " + oque + (p.lideranca ? ". Falta a confirmação da sua liderança." : ".") : "O RH não aprovou o seu pedido de " + oque + ". Veja o comentário no app Gestão de Pessoas.");
      } else {
        await GP.app.avisarRH(E().eu.nome + (aprovada ? " confirmou" : " recusou") + " o pedido de " + oque + " de " + nome + ".");
        await GP.app.avisar([p.responsavel], aprovada ? "Aprovado: o seu pedido de " + oque + " foi confirmado pela liderança e está na agenda da equipe." : "A sua liderança não confirmou o seu pedido de " + oque + ".");
      }
      return it;
    }, { mensagem: rh ? (aprovada ? "Aprovado pelo RH." + (p.lideranca ? " A liderança confirma em seguida." : "") : "Pedido recusado.") : (aprovada ? "Confirmado: o período está na agenda da equipe." : "Pedido recusado.") })
      .then((it) => { if (it) abrirEmail(p.id, rh ? "rh" : "lideranca"); });
  };
  ui.acoes["cancelar-ferias"] = function (el) {
    if (!window.confirm("Cancelar este pedido? O RH e a sua liderança recebem o aviso.")) return;
    const ctx = E().ctx;
    const p = pedido(el.dataset.id);
    const oque = F.NOME_TIPO[p.tipo] + " (" + F.periodoCurto(p) + ")";
    ui.salvar(el, async () => {
      await ui.atualizar("ferias", p.id, { estagio: "FAIL", canceladaEm: new Date().toISOString() });
      await GP.app.avisarRH(E().eu.nome + " cancelou o pedido de " + oque + ".", p.lideranca && p.estagio === "AG_LIDERANCA" ? [p.lideranca] : []);
    }, { mensagem: "Pedido cancelado.", fechar: false });
  };

  /* ================================================================ MEU ANIVERSÁRIO */
  /** Grava no perfil do Bitrix (o lugar de onde a agenda já lê); a data vem preenchida quando o perfil já tem */
  ui.acoes["meu-aniversario"] = function () {
    if (E().verComo) { ui.avisar("Em \"Ver como\", o aniversário só pode ser cadastrado pela própria pessoa.", "erro"); return; }
    const eu = E().eu;
    ui.abrirPainel({
      titulo: "Meu aniversário", sub: "Fica no seu perfil do Bitrix. No app aparecem só o dia e o mês: na agenda da equipe e no day off do mês do aniversário.",
      corpo: '<div id="form-aniversario">' + c.campo({ nome: "nascimento", rotulo: "Data de nascimento", tipo: "data", valor: eu.nascimento || "", max: E().ctx.hoje,
        ajuda: eu.nascimento ? "Preenchida com a data que já está no seu perfil do Bitrix." : "O seu perfil do Bitrix ainda não tem a data." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-aniversario">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-aniversario"] = function (el) {
    const f = document.getElementById("form-aniversario");
    if (!ui.validar(f, ["nascimento"])) return;
    const data = ui.lerForm(f).nascimento;
    if (data > E().ctx.hoje) { ui.erroNoPainel("A data de nascimento não pode ficar no futuro."); return; }
    ui.salvar(el, async () => {
      await E().repo.salvarAniversario(E().eu.id, data);
      E().eu.nascimento = data;
      const u = E().ctx.idx.usuario[String(E().eu.id)];
      if (u) u.aniversario = data.slice(5, 10);
      dom.indexar(E().ctx);
    }, { mensagem: "Aniversário salvo no seu perfil do Bitrix: " + calc.fmtData(data) + "." });
  };

  GP.telas = GP.telas || {};
  GP.telas.ferias = { abrirEmail, politicaHtml };
})(window);
