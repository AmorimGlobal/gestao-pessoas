/* =====================================================================================
   TELAS — Férias e ausências (Políticas de Férias e Ausências do RH, 04/11/2026)
   -------------------------------------------------------------------------------------
   Desde 05/11/2026 (pedido do usuário: "não apenas no e-mail, mas no app, principalmente
   para a liderança e o RH aprovarem e ficar registrado para o RH quem estará ausente"):
   - quem pede (qualquer pessoa, inclusive o membro) lê as regras do tipo escolhido, marca
     que leu, o app confere com a política e o pedido fica na tabela "Férias e ausências",
     em "Aguardando o RH". O e-mail que a política pede (para hr@amorimlawfirm.com com cópia
     para a liderança) sai pronto, pela caixa do Bitrix, como complemento;
   - o RH analisa e aprova ou recusa; depois a liderança direta confirma ou recusa, cada um
     no seu prazo da política. Aprovado, o período entra na Agenda da equipe;
   - quem pediu cancela enquanto o pedido está em andamento;
   - o RH ainda registra direto uma ausência combinada fora do app (já em "Aprovada"), edita e exclui.
   Desde 06/11/2026 (protótipo do RH "Solicitacao_Ferias_Amorim.html", aprovado pelo usuário), as férias de PJ e
   associação seguem o ciclo de novembro a outubro: a pessoa escolhe a semana de férias coletivas e como tirar os
   23 dias (23, 7 + 16 ou 8 + 15), e a data de início numa lista que já tira o que não pode (antes dos 12 meses de
   contrato e dos 60 dias, a semana coletiva dela e o que a equipe já reservou, pela rota api/ferias-equipe.js).
   O RH autoriza e a liderança valida (ou devolvem); a Agenda de férias mostra o ciclo inteiro por equipe.
   Mora aqui também o "Meu aniversário" (perfil do Bitrix), que o day off de aniversário usa.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const F = GP.ferias;
  const E = () => ui.estado;
  const semEstrutura = () => !!(E().ctx.recursos && E().ctx.recursos.ferias === false);
  const ehRH = () => E().visao === "rh";
  // os pedidos e as ausências que a visão enxerga, em qualquer etapa
  const pedido = (id) => F.pedidosVisiveis(E().ctx, E().eu.id, E().visao).find((p) => p.id === String(id));
  const recentes = (lista) => lista.slice().sort((a, b) => (String(a.criadoEm) < String(b.criadoEm) ? 1 : -1));
  const emAndamento = (p) => p.estagio === "NEW" || p.estagio === "AG_LIDERANCA";
  const oQue = (p) => F.nomeDoPedido(p) + " (" + F.periodoCurto(p) + ")";
  const tipoNaTela = (p) => (F.ehColetiva(p) ? "Semana de férias coletivas" : p.tipo);

  /* ================================================================ TELA */
  function linha(p, comPessoa) {
    const ctx = E().ctx;
    const s = F.situacao(ctx, p);
    const quem = dom.pessoa(ctx, p.responsavel);
    const agora = p.estagio === "SUCCESS" && p.inicio <= ctx.hoje && (p.fim || p.inicio) >= ctx.hoje;
    return '<div class="item clicavel" data-rota="#/ferias/' + esc(p.id) + '">' + (comPessoa ? c.avatar(quem, 30) : "") +
      '<div class="principal-item"><div class="t">' + (comPessoa ? esc(quem.nome) + " · " : "") + esc(tipoNaTela(p)) + (p.motivoDayOff ? " (" + esc(p.motivoDayOff.toLowerCase()) + ")" : "") + "</div>" +
      '<div class="d">' + esc(F.periodo(p)) + "</div>" + (p.foraDaPolitica && emAndamento(p) ? '<div class="d" style="color:var(--ambar)">Com pontos fora da política</div>' : "") + "</div>" +
      '<div class="lado">' + (agora ? c.tag("fora agora", "ambar") : c.tag(s.texto, s.cor)) +
      (s.prazo && emAndamento(p) ? '<span class="prazo">' + (s.cor === "vermelho" ? "prazo vencido em " : "resposta até ") + calc.fmtData(s.prazo) + "</span>" : "") + "</div></div>";
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
    if (partes[0] === "agenda") return telaAgenda();
    if (partes[0]) return telaPedido(partes[0]);
    const ctx = E().ctx, eu = E().eu, visao = E().visao;
    const id = String(eu.id);
    const paraRH = ehRH() ? F.paraRH(ctx).filter((p) => String(p.responsavel) !== id) : [];
    const paraMim = F.paraLideranca(ctx, id).filter((p) => String(p.responsavel) !== id);
    const esperam = {};
    paraRH.concat(paraMim).forEach((p) => { esperam[p.id] = true; });
    const visiveis = F.pedidosVisiveis(ctx, id, visao);
    const limite = calc.addDias(ctx.hoje, -60);
    // os seus: em andamento, as aprovadas que ainda vão acontecer e as decisões dos últimos 60 dias
    const meus = recentes(visiveis.filter((p) => String(p.responsavel) === id &&
      (emAndamento(p) || (p.estagio === "SUCCESS" && (p.fim || p.inicio) >= ctx.hoje) || (p.estagio === "FAIL" && String(p.criadoEm).slice(0, 10) >= limite))));
    const daEquipe = visao === "membro" ? [] : recentes(visiveis.filter((p) => String(p.responsavel) !== id && emAndamento(p) && !esperam[p.id]));
    const aprovadas = F.proximas(F.visiveisPara(ctx, id, visao), ctx.hoje).filter((p) => String(p.responsavel) !== id);
    const u = dom.pessoa(ctx, id);
    const nEsperam = paraRH.length + paraMim.length;
    let h = c.cabecalho("ferias", "Férias e ausências",
      (nEsperam ? "<span><b>" + nEsperam + "</b> aguardando você</span>" : "") + "<span><b>" + meus.filter(emAndamento).length + "</b> pedido(s) seu(s) em andamento</span>",
      (semEstrutura() ? "" : '<button class="btn" data-acao="pedir-ferias">' + icone("mais", 15) + " Pedir férias ou ausência</button>") +
      (ehRH() && !semEstrutura() ? '<button class="btn sec" data-acao="registrar-ausencia">Registrar ausência</button>' : "") +
      (visao !== "membro" ? '<a class="btn sec" href="#/ferias/agenda">Agenda de férias</a>' : ""));
    if (semEstrutura()) {
      h += '<div class="aviso-atencao" style="margin-bottom:16px"><b>A tabela "Férias e ausências" ainda não existe no CRM do Bitrix.</b> ' +
        (eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura".' : "Avise o TI: falta criar a estrutura no Bitrix.") + "</div>";
    }
    h += '<div class="aviso-info" style="margin-bottom:16px">Você pede aqui, depois de ler as regras: o RH autoriza, a sua liderança valida, e o período entra na Agenda da equipe. Cada passo chega como aviso no Bitrix. ' +
      "O e-mail para " + esc(F.EMAIL_RH) + " com cópia para a liderança, que a política pede, sai pronto para enviar pela sua caixa do Bitrix." + (ehRH() ? " O RH também registra direto uma ausência combinada fora do app." : "") + "</div>";
    if (paraRH.length) h += '<div class="card acao"><h3>Aguardando a autorização do RH<span class="extra muted">por ordem de chegada · em até 3 dias úteis (5 na pausa contratual)</span></h3>' + lista(paraRH, true, "") + "</div>";
    if (paraMim.length) h += '<div class="card acao"><h3>Aguardando a sua validação<span class="extra muted">já autorizados pelo RH · em até 2 dias úteis (5 na pausa)</span></h3>' + lista(paraMim, true, "") + "</div>";
    // o aniversário fica no topo dos seus pedidos: o day off de aniversário usa o mês dele
    const aniv = (u.aniversario ? "Seu aniversário: <b>" + calc.fmtData("2000-" + u.aniversario) + "</b> · day off no mês de " + calc.MESES_LONGOS[Number(u.aniversario.slice(0, 2)) - 1] + "."
      : "Seu aniversário não está cadastrado: o day off de aniversário usa o mês dele.") +
      (E().verComo ? "" : ' <a href="#" data-acao="meu-aniversario">' + (u.aniversario ? "Atualizar" : "Cadastrar") + "</a>");
    h += '<div class="card"><h3>Seus pedidos e ausências</h3><p class="muted" style="margin-top:0;font-size:12.5px">' + aniv + "</p>" + lista(meus, false, "Nenhum pedido em andamento nem ausência sua daqui em diante.") + "</div>";
    if (daEquipe.length) h += '<div class="card"><h3>' + (ehRH() ? "Pedidos com a liderança" : "Pedidos da equipe em andamento") + '<span class="extra muted">' + plural(daEquipe.length, "pedido", "pedidos") + "</span></h3>" + lista(daEquipe, true, "") + "</div>";
    if (visao !== "membro") h += '<div class="card"><h3>' + (ehRH() ? "Próximas ausências" : "Próximas ausências da equipe") + '<span class="extra muted">aprovadas · ' + plural(aprovadas.length, "ausência", "ausências") + "</span></h3>" +
      lista(aprovadas, true, ehRH() ? "Nenhuma ausência aprovada daqui em diante." : "Ninguém da equipe com ausência aprovada daqui em diante.") + "</div>";
    h += politicaHtml(false);
    return h;
  };

  /* ================================================================ UM PEDIDO OU UMA AUSÊNCIA */
  function telaPedido(id) {
    const ctx = E().ctx, eu = E().eu;
    const p = pedido(id);
    if (!p) return c.voltar("#/ferias", "Férias e ausências") + '<div class="card">' + c.vazio("Pedido não encontrado ou fora da sua visão.") + "</div>";
    const s = F.situacao(ctx, p);
    const quem = dom.pessoa(ctx, p.responsavel);
    const meu = String(p.responsavel) === String(eu.id);
    const decide = F.decisorDoPedido(ctx, eu.id, ehRH(), p);
    const doApp = F.ehPedido(p);
    let acoes = "";
    if (decide === "rh") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Aprovada">Autorizar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Recusada">Devolver</button>';
    if (decide === "lideranca") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Aprovada">Validar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Recusada">Devolver</button>';
    if (meu && doApp && emAndamento(p) && !p.emailEnviadoEm) acoes += '<button class="btn sec" data-acao="email-do-pedido" data-id="' + esc(p.id) + '">' + icone("email", 14) + " E-mail ao RH</button>";
    if (meu && emAndamento(p)) acoes += '<button class="btn link" data-acao="cancelar-ferias" data-id="' + esc(p.id) + '">Cancelar o pedido</button>';
    if (ehRH() && !doApp) acoes += '<button class="btn sec" data-acao="registrar-ausencia" data-id="' + esc(p.id) + '">Editar</button>';
    if (ehRH()) acoes += '<button class="btn link excluir" data-acao="excluir-ausencia" data-id="' + esc(p.id) + '">' + icone("lixeira", 14) + " Excluir</button>";
    let h = c.voltar("#/ferias", "Férias e ausências") + c.cabecalho("ferias", tipoNaTela(p) + " · " + quem.nome, "<span>" + c.tag(s.texto, s.cor) + "</span><span>" + esc(F.periodo(p)) + "</span>", acoes);
    if (doApp) {
      const passos = [["Pedido", true], ["RH autoriza", !!p.rhDecisao], ["Liderança valida", !!p.liderancaDecisao], ["Na agenda", p.estagio === "SUCCESS"]];
      const atual = p.estagio === "NEW" ? 1 : p.estagio === "AG_LIDERANCA" ? 2 : -1;
      h += '<div class="card"><div class="passos">' + passos.map((x, i) => '<span class="p ' + (x[1] && i !== atual ? "feito" : i === atual ? "atual" : "") + '">' + x[0] + "</span>").join("") +
        (p.estagio === "FAIL" ? '<span class="p">' + esc(s.texto) + "</span>" : "") + "</div>" +
        (s.prazo && emAndamento(p) ? '<p class="muted" style="font-size:12px;margin:8px 0 0">' + (p.estagio === "NEW" ? "O RH autoriza até " : "A liderança valida até ") + calc.fmtDataAno(s.prazo) + ".</p>" : "") + "</div>";
    }
    // a conferência que o protótipo do RH mostra a quem decide: contrato, 12 meses, equipe (com nomes) e a autorização do RH
    if (p.tipo === "Férias" && (ehRH() || E().visao !== "membro") && String(p.responsavel) !== String(eu.id)) {
      const conf = F.conferenciaParaDecidir(ctx, p);
      if (conf.length) h += '<div class="card' + (conf.some((x) => !x.ok) && emAndamento(p) ? " acao" : "") + '"><h3>Conferência</h3><div class="checagem">' +
        conf.map((x) => '<div class="' + (x.ok ? "ok" : "falta") + '"><span class="s">' + (x.ok ? "✓" : "!") + "</span><span>" + esc(x.texto) + "</span></div>").join("") + "</div></div>";
    }
    if (p.foraDaPolitica) h += '<div class="card acao"><h3>' + icone("alerta", 15) + ' Pontos fora da política</h3><ul style="margin:0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<p class="muted" style="font-size:12px;margin-bottom:0">Apontados pelo app na hora do pedido. A justificativa de quem pediu está abaixo; quem decide é o RH.</p></div>';
    const fer = dom.feriadosDe(ctx, F.dadosDaPessoa(ctx, p.responsavel).sigla);
    const fim = p.tipo === "Day off" ? p.inicio : p.fim || p.inicio;
    const lid = p.lideranca ? dom.pessoa(ctx, p.lideranca).nome : "";
    h += '<div class="card"><h3>' + (doApp ? "Pedido" : "Ausência registrada pelo RH") + "</h3>" + c.dados([["Pessoa", quem.nome], ["Tipo", tipoNaTela(p) + (p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : "")], ["Período", F.periodo(p)],
      ["Volta em", calc.fmtDiaSemana(calc.voltaEm(fim, fer)) + ", " + calc.fmtDataAno(calc.voltaEm(fim, fer))], ["Liderança direta", lid],
      doApp ? ["Pedido em", calc.fmtDataAno(p.criadoEm)] : ["Registrada por", dom.pessoa(ctx, p.autor || p.criadoPor).nome + (p.criadoEm ? " em " + calc.fmtDataAno(p.criadoEm) : "")],
      doApp ? ["E-mail ao RH", p.emailEnviadoEm ? "enviado em " + calc.fmtDataAno(p.emailEnviadoEm) : "não enviado pelo app"] : null]) +
      '<div class="sci" style="margin-top:14px">' + c.textoRegistro("Cobertura das atividades", p.cobertura) + c.textoRegistro(doApp && p.foraDaPolitica ? "Justificativa" : "Observação", p.justificativa) + "</div></div>";
    if (doApp && (p.rhDecisao || p.liderancaDecisao || p.canceladaEm)) {
      h += '<div class="card"><h3>Respostas</h3><div class="sci">' +
        (p.rhDecisao ? '<div><div class="k">RH · ' + (p.rhDecisao === "Aprovada" ? "autorizado" : "devolvido") + " em " + calc.fmtDataAno(p.rhEm) + '</div><div class="texto-registro">' + esc(p.rhComentario || "Sem comentário.") + "</div></div>" : "") +
        (p.liderancaDecisao ? '<div><div class="k">' + esc(lid || "Liderança") + " · " + (p.liderancaDecisao === "Aprovada" ? "validado" : "devolvido") + " em " + calc.fmtDataAno(p.liderancaEm) + '</div><div class="texto-registro">' + esc(p.liderancaComentario || "Sem comentário.") + "</div></div>" : "") +
        (p.canceladaEm ? '<div><div class="k">Cancelado por quem pediu em ' + calc.fmtDataAno(p.canceladaEm) + "</div></div>" : "") + "</div></div>";
    }
    return h;
  }

  /* ================================================================ DECISÕES (o RH, depois a liderança) */
  ui.acoes["decidir-ferias"] = function (el) {
    const p = pedido(el.dataset.id);
    const quem = p ? F.decisorDoPedido(E().ctx, E().eu.id, ehRH(), p) : "";
    if (!quem) { ui.avisar("Este pedido não aguarda a sua decisão.", "erro"); return; }
    const rh = quem === "rh";
    const nome = dom.pessoa(E().ctx, p.responsavel).nome;
    ui.abrirPainel({
      titulo: (rh ? "Autorização do RH" : "Validação da liderança") + " · " + nome, sub: esc(tipoNaTela(p) + " · " + F.periodo(p)),
      corpo: '<div id="form-decisao-ferias">' +
        (p.foraDaPolitica ? '<div class="aviso-atencao" style="margin-bottom:14px"><b>Pontos fora da política:</b><ul style="margin:6px 0 0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" + (p.justificativa ? '<div style="margin-top:6px"><b>Justificativa:</b> ' + esc(p.justificativa) + "</div>" : "") + "</div>" : "") +
        (!rh && p.rhComentario ? '<div class="aviso-info" style="margin-bottom:14px"><b>Comentário do RH:</b> ' + esc(p.rhComentario) + "</div>" : "") +
        (p.tipo === "Férias" ? (function () { const conf = F.conferenciaParaDecidir(E().ctx, p); return conf.length ? '<div class="checagem" style="margin-bottom:14px">' + conf.map((x) => '<div class="' + (x.ok ? "ok" : "falta") + '"><span class="s">' + (x.ok ? "✓" : "!") + "</span><span>" + esc(x.texto) + "</span></div>").join("") + "</div>" : ""; })() : "") +
        c.campo({ nome: "decisao", rotulo: "Decisão", tipo: "escolha", opcoes: [{ valor: "Aprovada", rotulo: rh ? "Autorizar" : "Validar" }, { valor: "Recusada", rotulo: "Devolver ao membro" }], valor: el.dataset.decisao }) +
        c.campo({ nome: "comentario", rotulo: "Comentário ou motivo da devolução", tipo: "textoLongo", opcional: true, ajuda: "Vai para quem pediu. Na devolução, é obrigatório: explique o motivo. A data volta a ficar livre na equipe." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-decisao-ferias" data-id="' + esc(p.id) + '">Registrar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-decisao-ferias"] = function (el) {
    const f = document.getElementById("form-decisao-ferias");
    if (!ui.validar(f, ["decisao"])) return;
    const d = ui.lerForm(f);
    const comentario = String(d.comentario || "").trim();
    if (d.decisao === "Recusada" && !comentario) { ui.erroNoPainel("Na devolução, explique o motivo."); return; }
    const ctx = E().ctx;
    const p = pedido(el.dataset.id);
    const quem = p ? F.decisorDoPedido(ctx, E().eu.id, ehRH(), p) : "";
    if (!quem) { ui.erroNoPainel("Este pedido não aguarda mais a sua decisão."); return; }
    const rh = quem === "rh";
    const aprovada = d.decisao === "Aprovada";
    const agora = new Date().toISOString();
    // sem liderança direta (ninguém acima no Bitrix), ou quando a liderança é quem decide pelo RH, a aprovação do RH fecha o pedido
    const fechaNoRH = !p.lideranca || String(p.lideranca) === String(E().eu.id);
    const dados = rh ? { rhDecisao: d.decisao, rhEm: agora, rhComentario: comentario, estagio: aprovada ? (fechaNoRH ? "SUCCESS" : "AG_LIDERANCA") : "FAIL" }
      : { liderancaDecisao: d.decisao, liderancaEm: agora, liderancaComentario: comentario, estagio: aprovada ? "SUCCESS" : "FAIL" };
    if (rh && aprovada && fechaNoRH && p.lideranca) Object.assign(dados, { liderancaDecisao: "Aprovada", liderancaEm: agora, liderancaComentario: F.CONFIRMADO_PELO_RH });
    const nome = dom.pessoa(ctx, p.responsavel).nome;
    const oque = oQue(p);
    ui.salvar(el, async () => {
      const it = await ui.atualizar("ferias", p.id, dados);
      if (rh) {
        if (p.lideranca && !fechaNoRH) await GP.app.avisar([p.lideranca], aprovada ? "O RH autorizou o pedido de " + oque + " de " + nome + ". Valide até " + calc.fmtData(F.prazoLideranca(ctx, it)) + " no app Gestão de Pessoas → Férias e ausências." : "O RH devolveu o pedido de " + oque + " de " + nome + ".");
        await GP.app.avisar([p.responsavel], aprovada ? (it.estagio === "SUCCESS" ? "Aprovado: o seu pedido de " + oque + " está na agenda da equipe." : "O RH autorizou o seu pedido de " + oque + ". Falta a validação da sua liderança.")
          : "O RH devolveu o seu pedido de " + oque + ": " + comentario + ". A data voltou a ficar livre.");
      } else {
        await GP.app.avisarRH(E().eu.nome + (aprovada ? " validou" : " devolveu") + " o pedido de " + oque + " de " + nome + (aprovada ? ". O período está na agenda da equipe." : "."));
        await GP.app.avisar([p.responsavel], aprovada ? "Aprovado: o seu pedido de " + oque + " foi validado pela liderança e está na agenda da equipe." : "A sua liderança devolveu o seu pedido de " + oque + ": " + comentario + ". A data voltou a ficar livre.");
      }
      return it;
    }, { mensagem: rh ? (aprovada ? (dados.estagio === "SUCCESS" ? "Autorizado: o período está na agenda da equipe." : "Autorizado. O pedido seguiu para a liderança direta.") : "Devolvido ao membro. A data voltou a ficar livre na equipe.") : (aprovada ? "Validado: as férias entraram na agenda." : "Devolvido ao membro. A data voltou a ficar livre na equipe.") });
  };
  ui.acoes["cancelar-ferias"] = function (el) {
    const p = pedido(el.dataset.id);
    if (!p || String(p.responsavel) !== String(E().eu.id) || !emAndamento(p)) return;
    if (!window.confirm("Cancelar este pedido? O RH e a sua liderança recebem o aviso.")) return;
    ui.salvar(el, async () => {
      await ui.atualizar("ferias", p.id, { estagio: "FAIL", canceladaEm: new Date().toISOString() });
      await GP.app.avisarRH(E().eu.nome + " cancelou o pedido de " + oQue(p) + ".", p.lideranca && p.estagio === "AG_LIDERANCA" ? [p.lideranca] : []);
    }, { mensagem: "Pedido cancelado." });
  };

  /* ================================================================ REGISTRAR DIRETO (o RH) */
  function formAusencia(p) {
    const ctx = E().ctx;
    const v = p || {};
    // todas as pessoas da empresa (com setor no Bitrix), lideranças incluídas: nem todas têm item em Membros
    const pessoas = (ctx.usuarios || []).filter((u) => (u.departamentos || []).length && (!u.tipo || u.tipo === "employee"))
      .slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    return '<div id="form-ausencia">' +
      (p ? '<input type="hidden" name="pessoa" value="' + esc(p.responsavel) + '">' : c.campo({ nome: "pessoa", rotulo: "Quem fica ausente", tipo: "lista", opcoes: pessoas })) +
      c.campo({ nome: "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: F.TIPOS, valor: v.tipo || "Férias" }) +
      '<div data-so="Day off">' + c.campo({ nome: "motivoDayOff", rotulo: "Motivo do day off", tipo: "escolha", opcoes: GP.schema.OPCOES.motivoDayOff, valor: v.motivoDayOff, opcional: true }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Primeiro dia", tipo: "data", valor: v.inicio }) +
      '<div data-nao="Day off">' + c.campo({ nome: "fim", rotulo: "Último dia", tipo: "data", valor: v.fim }) + "</div></div>" +
      c.campo({ nome: "justificativa", rotulo: "Observação", tipo: "textoLongo", valor: v.justificativa, opcional: true, ajuda: "O que vale lembrar (por exemplo, a cobertura combinada). O motivo nunca aparece na agenda da equipe." }) +
      '<div id="aviso-ausencia"></div></div>';
  }
  function ligarFormAusencia(el, id) {
    const f = el.querySelector("#form-ausencia");
    const atualizar = function () {
      const d = ui.lerForm(f);
      f.querySelectorAll("[data-so]").forEach((x) => { x.hidden = d.tipo !== x.dataset.so; });
      f.querySelectorAll("[data-nao]").forEach((x) => { x.hidden = d.tipo === x.dataset.nao; });
      // outro pedido ou ausência da mesma pessoa no período: só avisa (pode ser de propósito, como um day off depois das férias)
      const fim = d.tipo === "Day off" ? d.inicio : d.fim;
      const junto = d.pessoa && d.inicio && fim ? F.pedidosDe(E().ctx, d.pessoa, id).find((x) => x.inicio <= fim && (x.tipo === "Day off" ? x.inicio : x.fim || x.inicio) >= d.inicio) : null;
      f.querySelector("#aviso-ausencia").innerHTML = junto ? '<div class="aviso-atencao">Essa pessoa já tem ' + (junto.estagio === "SUCCESS" ? "uma ausência aprovada" : "um pedido em andamento") + " no período: " + esc(junto.tipo + ", " + F.periodoCurto(junto)) + ".</div>" : "";
    };
    f.addEventListener("change", atualizar);
    atualizar();
  }
  ui.acoes["registrar-ausencia"] = function (el) {
    if (!ehRH()) return;
    const p = el && el.dataset.id ? pedido(el.dataset.id) : null;
    ui.abrirPainel({
      titulo: p ? "Editar a ausência" : "Registrar ausência",
      sub: "Para uma ausência combinada fora do app. Ela entra já aprovada na Agenda da equipe, e a pessoa e a liderança direta recebem o aviso.",
      corpo: formAusencia(p),
      rodape: '<button class="btn" data-acao="salvar-ausencia"' + (p ? ' data-id="' + esc(p.id) + '"' : "") + ">" + (p ? "Salvar" : "Registrar") + '</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: (painel) => ligarFormAusencia(painel, p ? p.id : ""),
    });
  };
  ui.acoes["salvar-ausencia"] = function (el) {
    const f = document.getElementById("form-ausencia");
    if (!ui.validar(f, ["pessoa", "tipo", "inicio"])) return;
    const d = ui.lerForm(f);
    const fim = d.tipo === "Day off" ? d.inicio : d.fim;
    if (!fim) { ui.validar(f, ["pessoa", "tipo", "inicio", "fim"]); return; }
    if (fim < d.inicio) { ui.erroNoPainel("O último dia vem antes do primeiro."); return; }
    const ctx = E().ctx;
    const pessoa = F.dadosDaPessoa(ctx, d.pessoa);
    const id = el.dataset.id;
    const dados = {
      tipo: d.tipo, motivoDayOff: d.tipo === "Day off" ? d.motivoDayOff || "" : "", inicio: d.inicio, fim, dias: F.diasCorridos(d.inicio, fim),
      justificativa: String(d.justificativa || "").trim(),
    };
    const oque = F.NOME_TIPO[d.tipo] + " (" + F.periodoCurto(Object.assign({}, dados)) + ")";
    ui.salvar(el, async () => {
      if (id) return ui.atualizar("ferias", id, dados);
      // registrada já aprovada: a combinação foi fora do app
      const novo = await ui.criar("ferias", Object.assign({
        titulo: d.tipo + " · " + pessoa.nome, responsavel: d.pessoa, lideranca: pessoa.lideranca || "", autor: E().eu.id,
        estagio: "SUCCESS", rhDecisao: "Aprovada", rhEm: new Date().toISOString(),
      }, dados));
      // a liderança direta e a própria pessoa (o mesmo que o sino mostra), nunca quem registrou
      const eu = String(E().eu.id);
      if (pessoa.lideranca && pessoa.lideranca !== eu) await GP.app.avisar([pessoa.lideranca], "O RH registrou a ausência de " + pessoa.nome + ": " + oque + ". Ela já aparece na Agenda da equipe.");
      if (String(d.pessoa) !== eu) await GP.app.avisar([d.pessoa], "O RH registrou a sua ausência: " + oque + ". Ela já aparece na Agenda da equipe.");
      return novo;
    }, { mensagem: id ? "Ausência atualizada." : "Ausência registrada: " + pessoa.nome + ", " + oque + "." });
  };
  ui.acoes["excluir-ausencia"] = function (el) {
    const p = pedido(el.dataset.id);
    if (!p || !ehRH()) return;
    const nome = dom.pessoa(E().ctx, p.responsavel).nome;
    if (!window.confirm("Excluir " + (F.ehPedido(p) ? "o pedido" : "a ausência") + " de " + nome + " (" + F.periodoCurto(p) + ")? Sai da agenda e vai para a lixeira do CRM.")) return;
    ui.salvar(el, async () => {
      await ui.excluir("ferias", p.id);
      const eu = String(E().eu.id), oque = F.nomeDoPedido(p) + ", " + F.periodoCurto(p);
      if (p.lideranca && String(p.lideranca) !== eu) await GP.app.avisar([p.lideranca], "O RH tirou da agenda a ausência de " + nome + " (" + oque + ").");
      if (String(p.responsavel) !== eu) await GP.app.avisar([p.responsavel], "O RH tirou da agenda a sua ausência (" + oque + ").");
      ui.navegar("#/ferias");
    }, { mensagem: "Excluído." });
  };

  /* ================================================================ PEDIR (qualquer pessoa) */
  const CONTRATOS = ["Associado", "PJ", "Estágio", "CLT"];
  function regrasHtml(tipo) {
    if (!tipo) return "";
    return '<div class="regras"><div class="rotulo">Regras de ' + esc(F.NOME_TIPO[tipo]) + "</div><ul>" + F.POLITICA[tipo].map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<div class="rotulo">Como o pedido anda</div><ol>' + F.POLITICA.fluxo.map((x) => "<li><b>" + esc(x[0]) + ".</b> " + esc(x[1]) + "</li>").join("") + "</ol>" +
      '<label class="escolha li-regras"><input type="checkbox" name="lido"><span>Li as regras de ' + esc(F.NOME_TIPO[tipo]) + " e o fluxo do pedido</span></label></div>";
  }
  /** O modo do formulário: o tipo, e as férias pela política (PJ e associação) ou pela lei (CLT e estágio) */
  function modoDo(d, pessoa) { return d.tipo === "Férias" ? (F.segueALei(pessoa) ? "Férias-lei" : "Férias-politica") : d.tipo || ""; }
  function camposHtml(pessoa) {
    const so = (modos) => ' data-modos="' + modos + '"';
    const ctx = E().ctx;
    const comDatas = "Day off,Pausa contratual,Férias-lei";
    return '<div id="campos-ferias" hidden>' +
      '<div' + so("Day off") + ">" + c.campo({ nome: "motivoDayOff", rotulo: "Motivo do day off", tipo: "escolha", opcoes: GP.schema.OPCOES.motivoDayOff }) + "</div>" +
      (pessoa.contrato ? "" : c.campo({ nome: "contrato", rotulo: "Seu modelo de contrato", tipo: "lista", opcoes: CONTRATOS, opcional: true, ajuda: "O app não achou o seu contrato no cadastro. As regras mudam para estágio e CLT." })) +
      // férias de PJ e associação: o ciclo, a semana coletiva, como tirar os 23 dias e as datas (protótipo do RH, 06/11/2026)
      '<div' + so("Férias-politica") + '><div id="bloco-politica"></div>' +
        c.campo({ nome: "observacao", rotulo: "Observação para o RH", tipo: "textoLongo", opcional: true }) + "</div>" +
      '<div' + so(comDatas) + '><div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Primeiro dia", tipo: "data", min: ctx.hoje }) +
        '<div' + so("Pausa contratual,Férias-lei") + ">" + c.campo({ nome: "fim", rotulo: "Último dia", tipo: "data", min: ctx.hoje }) + "</div></div>" +
        '<div id="periodo-ferias" class="muted" style="font-size:12.5px;margin:-6px 0 14px"></div></div>' +
      '<div' + so("Férias-lei,Pausa contratual") + ">" + c.campo({ nome: "cobertura", rotulo: "Como as suas atividades ficam cobertas no período?", tipo: "textoLongo", ajuda: "A política pede cobertura do time no período: quem assume o quê." }) + "</div>" +
      '<div' + so(comDatas) + ">" + c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo", opcional: true, ajuda: "Obrigatória na pausa contratual e quando o pedido tem pontos fora da política." }) +
        '<div class="grupo-form"><div class="rotulo-grupo">Conferência com a política</div><div id="conferencia-ferias" class="muted">Preencha o período.</div></div></div></div>';
  }
  /** O pedido como está no formulário (day off, pausa e férias pela lei) */
  function lerPedido(f) {
    const d = ui.lerForm(f);
    // o campo escondido guarda o que foi digitado antes da troca de tipo: o day off não leva cobertura
    const p = { tipo: d.tipo || "", motivoDayOff: d.tipo === "Day off" ? d.motivoDayOff || "" : "", inicio: d.inicio || "", cobertura: d.tipo === "Day off" ? "" : d.cobertura || "", justificativa: d.justificativa || "" };
    p.fim = d.tipo === "Day off" ? p.inicio : d.fim || "";
    return { p, d };
  }

  /* ---------------- férias pela política: o ciclo, a semana coletiva, os 23 dias e as datas da equipe ---------------- */
  const coletivaSemCampo = () => ((E().estrutura && E().estrutura.ausentes) || []).indexOf("ferias.coletiva") >= 0;
  /** Os ciclos em que ainda dá para fazer algo: escolher a semana coletiva ou começar um período */
  function ciclosParaPedir(pessoa) {
    const ctx = E().ctx;
    const lib = F.liberacao(pessoa, ctx.hoje);
    const atual = F.cicloDe(ctx.hoje), prox = F.proximoCiclo(atual);
    return [atual, prox].filter((ci) => ci.fim >= lib.primeiraData || F.semanasColetivas(ci)[1].inicio > ctx.hoje);
  }
  /** As datas reservadas pela equipe (do servidor; sem ele, o que o login lê) */
  async function carregarReservas(f) {
    const st = f._st;
    try { st.reservas = await E().repo.reservasEquipe(); st.erroReservas = ""; } catch (e) {
      console.warn("Datas da equipe pelo servidor indisponíveis:", e);
      st.reservas = F.reservasDaEquipe(E().ctx, E().eu.id).filter((r) => r.fim >= E().ctx.hoje);
      st.erroReservas = "Não deu para conferir no servidor as datas da equipe (" + ((e && e.message) || "erro") + "). A lista abaixo traz só o que o seu login enxerga, e o RH confere.";
    }
  }
  const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function selectDeInicio(nome, rotulo, ops, valor, ajuda) {
    const porMes = {};
    ops.forEach((o) => { const k = o.inicio.slice(0, 7); (porMes[k] = porMes[k] || []).push(o); });
    const opt = (o) => '<option value="' + o.inicio + '"' + (o.bloqueio ? " disabled" : "") + (o.inicio === valor && !o.bloqueio ? " selected" : "") + ">" +
      DIA_CURTO[calc.diaSemana(o.inicio)] + ", " + calc.fmtData(o.inicio) + " a " + calc.fmtDataAno(o.fim) + (o.bloqueio ? " · " + o.bloqueio : "") + "</option>";
    const livres = ops.filter((o) => !o.bloqueio).length;
    return '<div class="campo" data-campo="' + nome + '"><label for="f-' + nome + '">' + esc(rotulo) + "</label>" + (ajuda ? '<div class="ajuda">' + esc(ajuda) + "</div>" : "") +
      '<select class="entrada" id="f-' + nome + '" name="' + nome + '"><option value="">' + (livres ? "Escolha a data de início" : "Nenhuma data livre neste ciclo") + "</option>" +
      Object.keys(porMes).map((k) => '<optgroup label="' + calc.MESES_LONGOS[Number(k.slice(5, 7)) - 1] + " de " + k.slice(0, 4) + '">' + porMes[k].map(opt).join("") + "</optgroup>").join("") + "</select></div>";
  }
  /** O que o bloco mostra agora: o estado (st) vem do que a pessoa escolheu */
  function tamanhosDoCiclo(pessoa, ciclo, st) {
    const rest = F.restanteDoCiclo(F.partesDoCiclo(E().ctx, pessoa.id, ciclo));
    if (rest.completo) return { rest, tamanhos: [] };
    if (rest.falta) return { rest, tamanhos: [rest.falta] };
    const m = F.MODALIDADES.find((x) => x.id === st.modalidade);
    return { rest, tamanhos: m ? m.partes : [] };
  }
  function blocoPoliticaHtml(f, pessoa) {
    const ctx = E().ctx, st = f._st;
    const lib = F.liberacao(pessoa, ctx.hoje);
    const ciclos = ciclosParaPedir(pessoa);
    if (!ciclos.length) return '<div class="aviso-atencao">Não há ciclo com datas possíveis agora.</div>';
    if (!ciclos.some((x) => x.ano === st.ciclo)) st.ciclo = ciclos[0].ano;
    const ciclo = ciclos.find((x) => x.ano === st.ciclo);
    let h = "";
    if (ciclos.length > 1) h += c.campo({ nome: "pol_ciclo", rotulo: "Ciclo", tipo: "escolha", opcoes: ciclos.map((x) => ({ valor: String(x.ano), rotulo: x.rotulo })), valor: String(st.ciclo) });
    h += c.dados([["Ciclo", ciclo.rotulo], ["Início do contrato", lib.ref ? calc.fmtDataAno(lib.ref) + (lib.pelo === "cadastro" ? " (cadastro no Bitrix)" : "") : "não informado"],
      [lib.aberta ? "Primeira data possível" : "Solicitação abre em", calc.fmtDataAno(lib.aberta ? lib.primeiraData : lib.abreEm)]]);
    if (!lib.aberta) h += '<div class="aviso-atencao" style="margin-top:12px"><b>Sua solicitação abre quando você completar 10 meses de contrato.</b> A partir de ' + calc.fmtDataAno(lib.abreEm) +
      " você poderá agendar férias com início depois de " + calc.fmtDataAno(lib.completa12) + ", data em que completa 12 meses. A semana de férias coletivas você já escolhe.</div>";
    // a semana de férias coletivas (uma das duas; exceção à regra da equipe)
    const semanas = F.semanasColetivas(ciclo);
    const jaCol = F.coletivaDoCiclo(ctx, pessoa.id, ciclo);
    const meus = F.pedidosDe(ctx, pessoa.id);
    h += '<div class="grupo-form"><div class="rotulo-grupo">Sua semana de férias coletivas</div>';
    if (jaCol) h += '<p style="margin:0">' + esc(F.periodoCurto(jaCol)) + " · " + esc(F.situacao(ctx, jaCol).texto) + "</p>";
    else if (coletivaSemCampo()) h += '<p class="muted" style="margin:0">A escolha da semana ainda não está no Bitrix: um administrador cria o campo em Configuração → "Criar ou completar a estrutura".</p>';
    else {
      h += '<div class="ajuda">Metade da equipe tira a semana do Natal e metade a do Ano Novo. Não conta nos 23 dias nem na regra da equipe.</div><div class="escolhas empilhadas" data-campo="pol_coletiva">' +
        [{ valor: "", rotulo: "Escolher depois" }].concat(semanas.map((s) => ({ valor: String(s.n), rotulo: calc.fmtDiaSemana(s.inicio) + ", " + calc.fmtData(s.inicio) + " a " + calc.fmtDiaSemana(s.fim) + ", " + calc.fmtDataAno(s.fim) + " (" + s.rotulo + ")", s })))
          .map((o) => {
            const passou = o.s && o.s.inicio <= ctx.hoje;
            const cruza = o.s && meus.some((x) => !F.ehColetiva(x) && x.inicio <= o.s.fim && F.fimDe(x) >= o.s.inicio);
            const dis = passou || cruza;
            return '<label class="escolha"><input type="radio" name="pol_coletiva" value="' + o.valor + '"' + (String(st.coletiva || "") === o.valor && !dis ? " checked" : "") + (dis ? " disabled" : "") + "><span>" + esc(o.rotulo) +
              (passou ? ' <span class="op-d">já passou</span>' : cruza ? ' <span class="op-d">cai num período de férias seu</span>' : "") + "</span></label>";
          }).join("") + "</div>";
    }
    h += "</div>";
    // os 23 dias
    h += '<div class="grupo-form"><div class="rotulo-grupo">Os 23 dias</div>';
    if (!lib.aberta) h += '<p class="muted" style="margin:0">Abrem em ' + calc.fmtDataAno(lib.abreEm) + ".</p>";
    else {
      const { rest, tamanhos } = tamanhosDoCiclo(pessoa, ciclo, st);
      if (rest.completo) h += '<p style="margin:0">Você já pediu os 23 dias deste ciclo (' + esc(rest.dias.join(" + ")) + " dias)." + (rest.foraDaRegra ? " O RH confere a divisão." : "") + "</p>";
      else {
        if (rest.falta) h += '<p style="margin:0 0 10px">Falta o período de <b>' + rest.falta + " dias</b> deste ciclo (você já pediu " + rest.dias[0] + ").</p>";
        else h += c.campo({ nome: "pol_modalidade", rotulo: "Como você quer tirar os 23 dias?", tipo: "escolha", valor: st.modalidade, opcoes: F.MODALIDADES.map((m) => ({ valor: m.id, rotulo: m.rotulo })) });
        const col = jaCol || (st.coletiva ? semanas[Number(st.coletiva) - 1] : null);
        tamanhos.forEach((dias, i) => {
          const evitar = tamanhos.filter((x, j) => j !== i && st.inicios[x]).map((x) => ({ inicio: st.inicios[x], fim: calc.addDias(st.inicios[x], x - 1) }));
          const ops = F.opcoesDeInicio(ctx, ciclo, dias, { pessoa, reservas: st.reservas || [], coletiva: col ? { inicio: col.inicio, fim: F.fimDe(col) } : null, outros: meus, evitar });
          h += selectDeInicio("pol_inicio_" + dias, tamanhos.length === 1 ? "Início do período de " + dias + " dias" : "Período de " + dias + " dias", ops, st.inicios[dias],
            tamanhos.length > 1 && i === 0 ? "Dá para pedir um período agora e o outro depois." : "");
        });
        if (st.reservas === null) h += '<p class="muted" style="font-size:12px">Conferindo as datas da equipe…</p>';
      }
    }
    h += "</div>";
    // o que a equipe já reservou (sem nomes)
    const res = st.reservas || [];
    h += '<div class="grupo-form"><div class="rotulo-grupo">Já reservado na sua equipe</div>' + (st.erroReservas ? '<div class="aviso-atencao" style="margin-bottom:8px">' + esc(st.erroReservas) + "</div>" : "") +
      (st.reservas === null ? '<p class="muted" style="margin:0">Carregando…</p>' : res.length ? '<ul class="rv-reservas">' + res.map((r) => "<li>" + esc(calc.fmtData(r.inicio) + " a " + calc.fmtDataAno(r.fim)) + " · " + esc(r.situacao) + "</li>").join("") + "</ul>"
        : '<p class="muted" style="margin:0">Nada reservado na sua equipe daqui em diante.</p>') +
      '<p class="muted" style="font-size:12px;margin:8px 0 0">Quem pediu primeiro fica com a data. Se um pedido for devolvido ou cancelado, ela volta a ficar livre. A semana de férias coletivas é exceção.</p></div>';
    return h;
  }
  /** Lê as escolhas do bloco para o estado (trocar de ciclo ou de divisão limpa o que dependia disso) */
  function lerBloco(f, d) {
    const st = f._st;
    if (d.pol_ciclo && Number(d.pol_ciclo) !== st.ciclo) { st.ciclo = Number(d.pol_ciclo); st.coletiva = ""; st.modalidade = ""; st.inicios = {}; return; }
    if ("pol_coletiva" in d) st.coletiva = d.pol_coletiva || "";
    if (d.pol_modalidade && d.pol_modalidade !== st.modalidade) { st.modalidade = d.pol_modalidade; st.inicios = {}; }
    Object.keys(d).forEach((k) => { const m = /^pol_inicio_(\d+)$/.exec(k); if (m) st.inicios[m[1]] = d[k] || ""; });
  }
  /** Os itens que o pedido pela política cria: a semana coletiva e os períodos escolhidos */
  function itensDaPolitica(f, pessoa) {
    const ctx = E().ctx, st = f._st;
    const ciclo = ciclosParaPedir(pessoa).find((x) => x.ano === st.ciclo);
    if (!ciclo) return [];
    const itens = [];
    const semanas = F.semanasColetivas(ciclo);
    if (st.coletiva && !F.coletivaDoCiclo(ctx, pessoa.id, ciclo) && !coletivaSemCampo()) { const s = semanas[Number(st.coletiva) - 1]; itens.push({ tipo: "Férias", coletiva: true, inicio: s.inicio, fim: s.fim }); }
    if (F.liberacao(pessoa, ctx.hoje).aberta) tamanhosDoCiclo(pessoa, ciclo, st).tamanhos.forEach((dias) => { const i = st.inicios[dias]; if (i) itens.push({ tipo: "Férias", coletiva: false, inicio: i, fim: calc.addDias(i, dias - 1) }); });
    return itens;
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
    f._st = { ciclo: 0, coletiva: "", modalidade: "", inicios: {}, reservas: null, erroReservas: "" };
    let pedindoReservas = false;
    const atualizar = function () {
      const { p, d } = lerPedido(f);
      const modo = modoDo(d, pessoaDoForm(d));
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
      f.querySelectorAll("[data-modos]").forEach((x) => { x.hidden = x.dataset.modos.split(",").indexOf(modo) < 0; });
      if (modo === "Férias-politica" && lido) {
        // o bloco é redesenhado a cada escolha; as escolhas ficam no estado (f._st)
        lerBloco(f, d);
        const bloco = f.querySelector("#bloco-politica");
        bloco.innerHTML = blocoPoliticaHtml(f, pessoaDoForm(d));
        if (f._st.reservas === null && !pedindoReservas) {
          pedindoReservas = true;
          carregarReservas(f).then(() => { bloco.innerHTML = blocoPoliticaHtml(f, pessoaDoForm(ui.lerForm(f))); });
        }
        return;
      }
      const volta = p.fim ? calc.voltaEm(p.fim, dom.feriadosDe(E().ctx, pessoaDoForm(d).sigla)) : "";
      f.querySelector("#periodo-ferias").textContent = p.inicio && p.fim && p.fim >= p.inicio ? F.periodo(p) + (p.tipo !== "Day off" ? " · volta em " + calc.fmtDiaSemana(volta) + ", " + calc.fmtData(volta) : "") : "";
      const alvo = f.querySelector("#conferencia-ferias");
      if (!lido || !d.tipo) return;
      const conf = F.conferirPedido(E().ctx, p, pessoaDoForm(d));
      alvo.innerHTML = '<div class="checagem">' + conf.ok.map((x) => '<div class="ok"><span class="s">✓</span><span>' + esc(x) + "</span></div>").join("") +
        conf.fora.map((x) => '<div class="falta"><span class="s">!</span><span>' + esc(x) + "</span></div>").join("") + "</div>" +
        (conf.fora.length ? '<div class="aviso-atencao" style="margin-top:8px">O pedido pode seguir com pontos fora da política, com a justificativa. Quem decide é o RH.</div>' : "") +
        (conf.erros.length ? '<div class="muted" style="margin-top:8px">Falta: ' + esc(conf.erros.join(" ")) + "</div>" : "");
    };
    f.addEventListener("change", atualizar);
    f.addEventListener("input", (ev) => { if (ev.target.tagName === "TEXTAREA") return; atualizar(); });
    atualizar();
  }
  function abrirPedido() {
    if (semEstrutura()) { ui.avisar("A tabela Férias e ausências ainda não existe no Bitrix.", "erro"); return; }
    const pessoa = F.dadosDaPessoa(E().ctx, E().eu.id);
    const lid = pessoa.lideranca ? dom.pessoa(E().ctx, pessoa.lideranca).nome : "";
    ui.abrirPainel({
      titulo: "Pedir férias ou ausência", largo: true,
      sub: "Escolha o tipo, leia as regras e marque que leu: o formulário aparece em seguida. O pedido vai para o RH" + (lid ? " e depois para a sua liderança (" + esc(lid) + ")" : "") + ".",
      corpo: '<div id="form-ferias">' + c.campo({ nome: "tipo", rotulo: "O que você quer pedir?", tipo: "escolha", opcoes: F.TIPOS }) +
        '<div id="regras-ferias"></div>' + camposHtml(pessoa) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-pedido-ferias" disabled>Enviar o pedido</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: ligarFormFerias,
    });
  }
  ui.acoes["pedir-ferias"] = abrirPedido;
  ui.acoes["pedir-por-email"] = abrirPedido; // nome antigo do botão (até 05/11/2026)
  /** Recusa do Bitrix por permissão: o que liberar, e o e-mail como saída enquanto isso */
  function semPermissao(e) { return e && (e.codigo === "ACCESS_DENIED" || /access denied|not allowed|permission|acesso negado|permiss/i.test(String(e.descricao || e.message || ""))); }
  ui.acoes["enviar-pedido-ferias"] = function (el) {
    const f = document.getElementById("form-ferias");
    const { p, d } = lerPedido(f);
    if (!d.lido) { ui.erroNoPainel("Leia as regras e marque que leu."); return; }
    const ctx = E().ctx, eu = E().eu;
    const pessoa = pessoaDoForm(d);
    if (modoDo(d, pessoa) === "Férias-politica") { enviarPelaPolitica(el, f, d, pessoa); return; }
    const conf = F.conferirPedido(ctx, p, pessoa);
    if (conf.erros.length) { ui.erroNoPainel(conf.erros.join(" ")); return; }
    const dados = {
      titulo: p.tipo + " · " + eu.nome, responsavel: eu.id, autor: eu.id, lideranca: pessoa.lideranca || "", estagio: "NEW",
      tipo: p.tipo, motivoDayOff: p.motivoDayOff, inicio: p.inicio, fim: p.fim, dias: conf.dias,
      cobertura: p.cobertura.trim(), justificativa: p.justificativa.trim(), foraDaPolitica: conf.fora.join("\n"),
      regrasLidasEm: f.dataset.lidoEm || new Date().toISOString(),
    };
    const email = F.emailDoPedido(ctx, Object.assign({}, p, { foraDaPolitica: dados.foraDaPolitica }), pessoa, { registrado: true });
    let recusa = null;
    ui.salvar(el, async () => {
      let novo;
      try { novo = await ui.criar("ferias", dados); } catch (e) { if (semPermissao(e)) { recusa = e; return null; } throw e; }
      const oque = oQue(novo);
      await GP.app.avisarRH(eu.nome + " pediu " + oque + (conf.fora.length ? ", com pontos fora da política" : "") + ". O RH analisa até " + calc.fmtData(F.prazoRH(ctx, novo)) + " no app Gestão de Pessoas → Férias e ausências.");
      if (pessoa.lideranca) await GP.app.avisar([pessoa.lideranca], eu.nome + " pediu " + oque + ". O RH analisa primeiro; depois é a sua vez de confirmar.");
      return novo;
    }, { fechar: false, rotuloOcupado: "Enviando..." }).then((novo) => {
      if (recusa) {
        // sem a permissão de gravar na tabela: diz o que liberar e oferece o e-mail, que não depende dela
        const alvo = document.querySelector("#painel-rodape .erro-envio");
        if (alvo) alvo.innerHTML = '<div class="aviso-erro"><b>O pedido não foi registrado no app:</b> o Bitrix não deixou o seu usuário gravar na tabela "Férias e ausências" (avise o TI: falta a permissão da seção 4 do guia). ' +
          'Enquanto isso, mande o pedido por e-mail: <button type="button" class="btn peq" data-acao="so-email-ferias">Escrever o e-mail</button></div>';
        emailPendente = F.emailDoPedido(ctx, Object.assign({}, p, { foraDaPolitica: dados.foraDaPolitica }), pessoa);
        return;
      }
      if (!novo || !novo.id) return;
      ui.fecharPainel(true);
      abrirEmail(email, { id: novo.id, registrado: true });
    });
  };
  /** Férias de PJ e associação: a semana coletiva e os períodos escolhidos viram um item cada (cada um é autorizado
      e validado). Antes de gravar, as datas da equipe são lidas de novo: a data fica com quem pediu primeiro. */
  function enviarPelaPolitica(el, f, d, pessoa) {
    const ctx = E().ctx, eu = E().eu;
    const itens = itensDaPolitica(f, pessoa);
    if (!itens.length) { ui.erroNoPainel("Escolha a semana de férias coletivas ou a data de início de um período."); return; }
    const obs = String(d.observacao || "").trim();
    const regrasLidasEm = f.dataset.lidoEm || new Date().toISOString();
    let criados = [], recusa = null;
    ui.salvar(el, async () => {
      let reservas = f._st.reservas || [];
      try { reservas = await E().repo.reservasEquipe(); } catch (e) { /* sem o servidor: confere com o que já tinha */ }
      for (const it of itens) {
        const conf = F.conferirPedido(ctx, Object.assign({ justificativa: obs }, it), pessoa, { reservas, junto: itens.filter((x) => x !== it) });
        if (conf.erros.length) { f._st.reservas = reservas; throw { descricao: conf.erros.join(" ") }; }
        it.dias = conf.dias;
      }
      for (const it of itens) {
        try {
          criados.push(await ui.criar("ferias", {
            titulo: (it.coletiva ? "Férias coletivas · " : "Férias · ") + eu.nome, responsavel: eu.id, autor: eu.id, lideranca: pessoa.lideranca || "", estagio: "NEW",
            tipo: "Férias", coletiva: !!it.coletiva, inicio: it.inicio, fim: it.fim, dias: it.dias, cobertura: "", justificativa: obs, foraDaPolitica: "", regrasLidasEm,
          }));
        } catch (e) { if (semPermissao(e) && !criados.length) { recusa = e; return null; } throw e; }
      }
      const oque = criados.map(oQue).join(" e ");
      await GP.app.avisarRH(eu.nome + " pediu " + oque + ". O RH autoriza até " + calc.fmtData(F.prazoRH(ctx, criados[0])) + " no app Gestão de Pessoas → Férias e ausências.");
      if (pessoa.lideranca) await GP.app.avisar([pessoa.lideranca], eu.nome + " pediu " + oque + ". O RH autoriza primeiro; depois é a sua vez de validar.");
      return criados;
    }, { fechar: false, rotuloOcupado: "Enviando..." }).then((r) => {
      if (recusa) {
        const alvo = document.querySelector("#painel-rodape .erro-envio");
        if (alvo) alvo.innerHTML = '<div class="aviso-erro"><b>O pedido não foi registrado no app:</b> o Bitrix não deixou o seu usuário gravar na tabela "Férias e ausências" (avise o TI: falta a permissão da seção 4 do guia).</div>';
        return;
      }
      // conflito ou erro: o bloco mostra as datas da equipe lidas agora
      if (!r) { const bloco = f.querySelector("#bloco-politica"); if (bloco && document.body.contains(bloco)) bloco.innerHTML = blocoPoliticaHtml(f, pessoa); return; }
      ui.fecharPainel(true);
      const email = F.emailDoPedido(ctx, criados[0], pessoa, { registrado: true, junto: criados.slice(1) });
      abrirEmail(email, { id: criados.map((x) => x.id).join(","), registrado: true });
    });
  }
  let emailPendente = null;
  ui.acoes["so-email-ferias"] = function () { if (!emailPendente) return; const e = emailPendente; emailPendente = null; ui.fecharPainel(true); abrirEmail(e); };
  ui.acoes["email-do-pedido"] = function (el) {
    const p = pedido(el.dataset.id);
    if (!p) return;
    const ctx = E().ctx;
    abrirEmail(F.emailDoPedido(ctx, p, F.dadosDaPessoa(ctx, p.responsavel), { registrado: true }), { id: p.id, registrado: true, depois: true });
  };

  /* ================================================================ O E-MAIL PRONTO, PELA CAIXA DO BITRIX */
  // A Amorim usa o e-mail do Bitrix (04/11/2026): o app envia pela caixa de quem pede (mail.message.send, escopo
  // mail), e o e-mail fica nos enviados dela. A mensagem pode ser ajustada antes. Sem a permissão de e-mail no app,
  // "Abrir o e-mail do Bitrix" copia o texto e abre a tela de escrever do Bitrix sobre o app.
  // o = { id: o pedido registrado (marca "E-mail ao RH enviado em"), registrado, depois: aberto pela tela do pedido }
  let emailAberto = null;
  function abrirEmail(e, o) {
    const op = o || {};
    emailAberto = { e, id: op.id || "" };
    ui.abrirPainel({
      titulo: op.registrado && !op.depois ? "Pedido registrado" : "Enviar o e-mail ao RH", largo: true,
      sub: op.registrado ? (op.depois ? "" : "O RH e a sua liderança já receberam o aviso no Bitrix, e o pedido segue por aqui. ") + "Para deixar também o registro por e-mail, como a política pede, envie abaixo: sai pela sua caixa do Bitrix, para " + esc(F.EMAIL_RH) + " com cópia para a sua liderança."
        : "A política pede o pedido por e-mail para " + esc(F.EMAIL_RH) + ", com cópia para a sua liderança direta. O e-mail sai pela sua caixa do Bitrix e fica nos seus enviados.",
      corpo: '<div class="email-pronto">' + c.dados([["Para", e.para], ["Cópia", e.cc.join(", ") || "—"], ["Assunto", e.assunto]]) +
        c.campo({ nome: "corpoEmail", rotulo: "Mensagem", tipo: "textoLongo", valor: e.corpo, linhas: 14, ajuda: "Pode ajustar o texto antes de enviar." }) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-email-bitrix">' + icone("email", 14) + " Enviar pelo e-mail do Bitrix</button>" +
        '<button class="btn sec" data-acao="abrir-email-bitrix">Abrir o e-mail do Bitrix</button>' +
        '<button class="btn sec" data-acao="copiar-email">Copiar</button><button class="btn link" data-acao="fechar-painel">' + (op.registrado ? "Agora não" : "Fechar") + "</button>",
      // o texto já veio pronto: fechar sem enviar não pergunta "fechar sem salvar?"
      aoAbrir: (painel) => { const corpo = painel.querySelector("#painel-corpo"); if (corpo) corpo.dataset.limpo = "1"; },
    });
  }
  /** O e-mail como está no painel (a mensagem pode ter sido ajustada) */
  function emailAtual() {
    if (!emailAberto) return null;
    const t = document.querySelector('#painel [name="corpoEmail"]');
    return Object.assign({}, emailAberto.e, { corpo: t ? t.value : emailAberto.e.corpo });
  }
  function erroNoEnvio(texto) {
    const el = document.querySelector("#painel-rodape .erro-envio");
    if (el) el.innerHTML = '<div class="aviso-erro"><b>Não foi enviado.</b> ' + esc(texto) + "</div>";
  }
  /** Copia para a área de transferência. Dentro do Bitrix (iframe) o navigator.clipboard pode ser bloqueado, então
      tenta antes o comando de copiar, ainda no clique; se nada der certo, seleciona a mensagem para o Ctrl+C. */
  function copiarTexto(texto, depois) {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(t);
    if (ok) { depois(true); return; }
    let feito = false;
    const fim = (copiou) => {
      if (feito) return;
      feito = true;
      if (!copiou) { const m = document.querySelector('#painel [name="corpoEmail"]'); if (m) { m.focus(); m.select(); } }
      depois(copiou);
    };
    if (!(navigator.clipboard && navigator.clipboard.writeText)) { fim(false); return; }
    // sem a permissão do iframe, a promessa pode ficar parada: depois de 1,5 s vale como não copiado
    navigator.clipboard.writeText(texto).then(() => fim(true), () => fim(false));
    setTimeout(() => fim(false), 1500);
  }
  ui.acoes["enviar-email-bitrix"] = async function (el) {
    const e = emailAtual();
    if (!e || E().ocupado) return;
    if (!String(e.corpo || "").trim()) { erroNoEnvio("A mensagem está vazia."); return; }
    if (E().verComo) { erroNoEnvio("Em \"Ver como\", o e-mail sairia pela sua caixa, e não pela da pessoa."); return; }
    const repo = E().repo;
    const idPedido = emailAberto && emailAberto.id;
    const rotulo = el.innerHTML;
    E().ocupado = true;
    el.disabled = true;
    el.textContent = "Enviando...";
    try {
      const r = await repo.enviarEmail(e, E().eu.email);
      // o pedido registrado guarda que o e-mail saiu (o RH e a liderança veem na tela do pedido)
      // um pedido de férias pode ter criado vários itens (a semana coletiva e os dois períodos): todos ficam anotados
      if (idPedido) { for (const x of String(idPedido).split(",").filter(Boolean)) { try { await ui.atualizar("ferias", x, { emailEnviadoEm: new Date().toISOString() }); } catch (err) { console.warn("Envio do e-mail não anotado no pedido:", err); } } }
      ui.fecharPainel(true);
      ui.avisar("E-mail enviado pela sua caixa do Bitrix" + (r && r.de ? " (" + r.de + ")" : "") + " para o RH" + (e.cc.length ? ", com cópia para a sua liderança" : "") + ". Ele fica nos seus enviados.");
      ui.render();
    } catch (err) {
      console.warn("E-mail pelo Bitrix:", err);
      erroNoEnvio(err && err.semEscopo ? "O app ainda não tem a permissão de e-mail do Bitrix (falta o escopo \"mail\" no aplicativo; avise o TI). Por enquanto, use \"Abrir o e-mail do Bitrix\": o texto vai copiado."
        : err && err.codigo === "SEM_CAIXA" ? "Você não tem uma caixa de e-mail conectada no Bitrix. Conecte em Bitrix → E-mail, ou copie o texto."
        : err && err.semAcesso ? "O Bitrix não deixou enviar pela sua caixa (" + repo.mensagemErro(err) + "). Use \"Abrir o e-mail do Bitrix\": o texto vai copiado."
        : repo.mensagemErro(err) + ". Use \"Abrir o e-mail do Bitrix\": o texto vai copiado.");
    } finally {
      E().ocupado = false;
      if (document.body.contains(el)) { el.disabled = false; el.innerHTML = rotulo; }
    }
  };
  ui.acoes["abrir-email-bitrix"] = function () {
    const e = emailAtual();
    if (!e) return;
    // copia ainda no clique (o comando de copiar só vale nele) e abre a tela de escrever do Bitrix sem esperar
    copiarTexto(F.textoDoEmail(e), function (ok) {
      ui.avisar(ok ? "Texto copiado. No e-mail do Bitrix, cole (Ctrl+V) e confira o destinatário, a cópia e o assunto." : "Não consegui copiar sozinho: a mensagem está selecionada aqui no app, use Ctrl+C.", ok ? "" : "erro");
    });
    if (E().repo.abrirEmailBitrix) E().repo.abrirEmailBitrix();
  };
  ui.acoes["copiar-email"] = function () {
    const e = emailAtual();
    if (!e) return;
    copiarTexto(F.textoDoEmail(e), (ok) => ui.avisar(ok ? "E-mail copiado: cole no seu e-mail e envie." : "Não consegui copiar sozinho: a mensagem está selecionada, use Ctrl+C.", ok ? "" : "erro"));
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

  /* ================================================================ AGENDA DE FÉRIAS (protótipo do RH, 06/11/2026) */
  /** O ciclo inteiro por equipe: os números, a linha do tempo e a lista de todas as solicitações de férias */
  function telaAgenda() {
    const ctx = E().ctx, eu = E().eu, visao = E().visao;
    let h = c.voltar("#/ferias", "Férias e ausências");
    if (visao === "membro") return h + '<div class="card">' + c.vazio("A Agenda de férias é do RH e das lideranças.") + "</div>";
    const atual = F.cicloDe(ctx.hoje), prox = F.proximoCiclo(atual);
    const f = E().filtros;
    // abre no ciclo em que caem os pedidos novos: perto do fim de outubro (antecedência de 60 dias), já é o seguinte
    const padrao = calc.addDias(ctx.hoje, F.PRAZOS["Férias"].antecedencia) > atual.fim ? prox : atual;
    const ciclo = f.cicloFerias === prox.ano ? prox : f.cicloFerias === atual.ano ? atual : padrao;
    const itens = F.pedidosVisiveis(ctx, eu.id, visao).filter((p) => p.tipo === "Férias" && p.estagio !== "FAIL" && p.inicio && p.inicio <= ciclo.fim && F.fimDe(p) >= ciclo.inicio);
    // a equipe de cada pessoa: o setor principal dela no Bitrix
    const equipeDe = (uid) => { const u = dom.pessoa(ctx, uid); const dp = dom.deptoPrincipal(ctx.idx.depto, u.departamentos || []); return dp && ctx.idx.depto[dp] ? ctx.idx.depto[dp].nome : "Sem setor"; };
    const equipes = Array.from(new Set(itens.map((p) => equipeDe(p.responsavel)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const filtro = equipes.indexOf(f.equipeFerias) >= 0 ? f.equipeFerias : "";
    const lista = itens.filter((p) => !filtro || equipeDe(p.responsavel) === filtro).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const em14 = calc.addDias(ctx.hoje, 13);
    const conta = (fn) => lista.filter(fn).length;
    h += c.cabecalho("ferias", "Agenda de férias", "<span>" + esc(ciclo.rotulo) + "</span>",
      '<a class="btn sec" href="#" data-acao="ciclo-agenda-ferias" data-ano="' + (ciclo === atual ? prox.ano : atual.ano) + '">' + (ciclo === atual ? "Próximo ciclo (" + esc(prox.rotulo) + ")" : "Ciclo atual (" + esc(atual.rotulo) + ")") + "</a>");
    h += c.kpis([
      { valor: conta((p) => p.estagio === "SUCCESS" && p.inicio <= em14 && F.fimDe(p) >= ctx.hoje), rotulo: "fora nos próximos 14 dias", tom: "ambar" },
      { valor: conta((p) => p.estagio === "NEW"), rotulo: "aguardando o RH", tom: "azul" },
      { valor: conta((p) => p.estagio === "AG_LIDERANCA"), rotulo: "aguardando a liderança", tom: "roxo" },
      { valor: conta((p) => p.estagio === "SUCCESS"), rotulo: "aprovadas", tom: "verde" },
    ]);
    if (equipes.length > 1) h += '<div class="card" style="padding:12px 16px"><label class="muted" style="font-size:12.5px">Equipe <select class="entrada" style="width:auto;display:inline-block;margin-left:8px" data-mudar="equipe-agenda-ferias">' +
      '<option value="">Todas</option>' + equipes.map((x) => '<option value="' + esc(x) + '"' + (x === filtro ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></label></div>";
    // a linha do tempo: um mês por coluna, uma linha por pessoa, as barras pela situação
    const total = F.diasCorridos(ciclo.inicio, ciclo.fim);
    const pos = (d) => Math.max(0, Math.min(100, (calc.diffDias(ciclo.inicio, d) / total) * 100));
    const meses = [];
    for (let i = 0; i < 12; i++) { const d = F.addMeses(ciclo.inicio, i); meses.push({ d, rotulo: calc.MESES[Number(d.slice(5, 7)) - 1] + (i === 0 || d.slice(5, 7) === "01" ? "/" + d.slice(2, 4) : "") }); }
    const cor = { SUCCESS: "aprovada", AG_LIDERANCA: "lideranca", NEW: "rh" };
    const coletivas = F.semanasColetivas(ciclo);
    const faixaColetiva = '<span class="fa-col" style="left:' + pos(coletivas[0].inicio) + "%;width:" + (pos(calc.addDias(coletivas[1].fim, 1)) - pos(coletivas[0].inicio)) + '%"></span>';
    const hoje = ctx.hoje >= ciclo.inicio && ctx.hoje <= ciclo.fim ? '<span class="fa-hoje" style="left:' + pos(ctx.hoje) + '%"></span>' : "";
    const porEquipe = {};
    lista.forEach((p) => { const e = equipeDe(p.responsavel); (porEquipe[e] = porEquipe[e] || {}); (porEquipe[e][p.responsavel] = porEquipe[e][p.responsavel] || []).push(p); });
    const linhaTempo = Object.keys(porEquipe).sort((a, b) => a.localeCompare(b, "pt-BR")).map((e) => '<div class="fa-equipe">' + esc(e) + "</div>" +
      Object.keys(porEquipe[e]).sort((a, b) => dom.pessoa(ctx, a).nome.localeCompare(dom.pessoa(ctx, b).nome, "pt-BR")).map((uid) => '<div class="fa-linha"><div class="fa-nome">' + esc(dom.pessoa(ctx, uid).nome) + '</div><div class="fa-faixa">' + faixaColetiva + hoje +
        porEquipe[e][uid].map((p) => { const ini = p.inicio < ciclo.inicio ? ciclo.inicio : p.inicio, fim = F.fimDe(p) > ciclo.fim ? ciclo.fim : F.fimDe(p);
          return '<a class="fa-barra ' + (F.ehColetiva(p) ? "coletiva" : cor[p.estagio]) + '" href="#/ferias/' + esc(p.id) + '" title="' + esc(tipoNaTela(p) + " · " + F.periodoCurto(p) + " · " + F.situacao(ctx, p).texto) + '" style="left:' + pos(ini) + "%;width:" + Math.max(0.6, pos(calc.addDias(fim, 1)) - pos(ini)) + '%"></a>'; }).join("") +
        "</div></div>").join("")).join("");
    h += '<div class="card"><h3>Linha do tempo<span class="extra muted">clique numa barra para abrir o pedido</span></h3>' + (lista.length ? '<div class="fa-tempo"><div class="fa-linha fa-meses"><div class="fa-nome"></div><div class="fa-faixa">' +
      meses.map((m) => '<span class="fa-mes" style="left:' + pos(m.d) + '%">' + esc(m.rotulo) + "</span>").join("") + "</div></div>" + linhaTempo + "</div>" +
      '<div class="fa-legenda"><span><i class="fa-barra aprovada"></i>aprovada</span><span><i class="fa-barra lideranca"></i>aguardando a liderança</span><span><i class="fa-barra rh"></i>aguardando o RH</span><span><i class="fa-barra coletiva"></i>semana de férias coletivas</span><span><i class="fa-col-leg"></i>férias coletivas</span>' + (hoje ? '<span><i class="fa-hoje-leg"></i>hoje</span>' : "") + "</div>"
      : c.vazio("Nenhuma solicitação de férias neste ciclo.")) + "</div>";
    // todas as solicitações
    h += '<div class="card"><h3>Todas as solicitações<span class="extra muted">' + plural(lista.length, "solicitação", "solicitações") + '</span></h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Membro</th><th>Equipe</th><th>Período</th><th class="n">Dias</th><th>Situação</th></tr></thead><tbody>' +
      lista.map((p) => { const s = F.situacao(ctx, p); return '<tr class="clicavel" data-rota="#/ferias/' + esc(p.id) + '"><td>' + esc(dom.pessoa(ctx, p.responsavel).nome) + (F.ehColetiva(p) ? ' <span class="muted">(coletiva)</span>' : "") + "</td><td>" + esc(equipeDe(p.responsavel)) + "</td><td>" +
        esc(calc.fmtDataAno(p.inicio) + " a " + calc.fmtDataAno(F.fimDe(p))) + '</td><td class="n">' + (p.dias || F.diasCorridos(p.inicio, F.fimDe(p))) + "</td><td>" + c.tag(s.texto, s.cor) + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
    return h;
  }
  ui.acoes["ciclo-agenda-ferias"] = function (el) { E().filtros.cicloFerias = Number(el.dataset.ano); ui.render(); };
  ui.acoes["equipe-agenda-ferias"] = function (el) { E().filtros.equipeFerias = el.value; ui.render(); };

  GP.telas = GP.telas || {};
  GP.telas.ferias = { abrirEmail, politicaHtml };
})(window);
