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
   - o RH ainda registra direto uma ausência combinada fora do app (já aprovada), edita e exclui.
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
  const oQue = (p) => F.NOME_TIPO[p.tipo] + " (" + F.periodoCurto(p) + ")";

  /* ================================================================ TELA */
  function linha(p, comPessoa) {
    const ctx = E().ctx;
    const s = F.situacao(ctx, p);
    const quem = dom.pessoa(ctx, p.responsavel);
    const agora = p.estagio === "SUCCESS" && p.inicio <= ctx.hoje && (p.fim || p.inicio) >= ctx.hoje;
    return '<div class="item clicavel" data-rota="#/ferias/' + esc(p.id) + '">' + (comPessoa ? c.avatar(quem, 30) : "") +
      '<div class="principal-item"><div class="t">' + (comPessoa ? esc(quem.nome) + " · " : "") + esc(p.tipo) + (p.motivoDayOff ? " (" + esc(p.motivoDayOff.toLowerCase()) + ")" : "") + "</div>" +
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
      (ehRH() && !semEstrutura() ? '<button class="btn sec" data-acao="registrar-ausencia">Registrar ausência</button>' : ""));
    if (semEstrutura()) {
      h += '<div class="aviso-atencao" style="margin-bottom:16px"><b>A tabela "Férias e ausências" ainda não existe no CRM do Bitrix.</b> ' +
        (eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura".' : "Avise o TI: falta criar a estrutura no Bitrix.") + "</div>";
    }
    h += '<div class="aviso-info" style="margin-bottom:16px">Você pede aqui, depois de ler as regras: o RH analisa, a sua liderança confirma, e o período entra na Agenda da equipe. Cada passo chega como aviso no Bitrix. ' +
      "O e-mail para " + esc(F.EMAIL_RH) + " com cópia para a liderança, que a política pede, sai pronto para enviar pela sua caixa do Bitrix." + (ehRH() ? " O RH também registra direto uma ausência combinada fora do app." : "") + "</div>";
    if (paraRH.length) h += '<div class="card acao"><h3>Aguardando o RH<span class="extra muted">resposta em até 3 dias úteis (5 na pausa contratual)</span></h3>' + lista(paraRH, true, "") + "</div>";
    if (paraMim.length) h += '<div class="card acao"><h3>Aguardando a sua confirmação<span class="extra muted">em até 2 dias úteis depois do RH (5 na pausa)</span></h3>' + lista(paraMim, true, "") + "</div>";
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
    if (decide === "rh") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Aprovada">Aprovar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Recusada">Recusar</button>';
    if (decide === "lideranca") acoes += '<button class="btn" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Aprovada">Confirmar</button><button class="btn sec" data-acao="decidir-ferias" data-id="' + esc(p.id) + '" data-decisao="Recusada">Recusar</button>';
    if (meu && doApp && emAndamento(p) && !p.emailEnviadoEm) acoes += '<button class="btn sec" data-acao="email-do-pedido" data-id="' + esc(p.id) + '">' + icone("email", 14) + " E-mail ao RH</button>";
    if (meu && emAndamento(p)) acoes += '<button class="btn link" data-acao="cancelar-ferias" data-id="' + esc(p.id) + '">Cancelar o pedido</button>';
    if (ehRH() && !doApp) acoes += '<button class="btn sec" data-acao="registrar-ausencia" data-id="' + esc(p.id) + '">Editar</button>';
    if (ehRH()) acoes += '<button class="btn link excluir" data-acao="excluir-ausencia" data-id="' + esc(p.id) + '">' + icone("lixeira", 14) + " Excluir</button>";
    let h = c.voltar("#/ferias", "Férias e ausências") + c.cabecalho("ferias", p.tipo + " · " + quem.nome, "<span>" + c.tag(s.texto, s.cor) + "</span><span>" + esc(F.periodo(p)) + "</span>", acoes);
    if (doApp) {
      const passos = [["Pedido", true], ["RH", !!p.rhDecisao], ["Liderança", !!p.liderancaDecisao], ["Aprovado", p.estagio === "SUCCESS"]];
      const atual = p.estagio === "NEW" ? 1 : p.estagio === "AG_LIDERANCA" ? 2 : -1;
      h += '<div class="card"><div class="passos">' + passos.map((x, i) => '<span class="p ' + (x[1] && i !== atual ? "feito" : i === atual ? "atual" : "") + '">' + x[0] + "</span>").join("") +
        (p.estagio === "FAIL" ? '<span class="p">' + esc(s.texto) + "</span>" : "") + "</div>" +
        (s.prazo && emAndamento(p) ? '<p class="muted" style="font-size:12px;margin:8px 0 0">' + (p.estagio === "NEW" ? "O RH responde até " : "A liderança confirma até ") + calc.fmtDataAno(s.prazo) + ".</p>" : "") + "</div>";
    }
    if (p.foraDaPolitica) h += '<div class="card acao"><h3>' + icone("alerta", 15) + ' Pontos fora da política</h3><ul style="margin:0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<p class="muted" style="font-size:12px;margin-bottom:0">Apontados pelo app na hora do pedido. A justificativa de quem pediu está abaixo; quem decide é o RH.</p></div>';
    const fer = dom.feriadosDe(ctx, F.dadosDaPessoa(ctx, p.responsavel).sigla);
    const fim = p.tipo === "Day off" ? p.inicio : p.fim || p.inicio;
    const lid = p.lideranca ? dom.pessoa(ctx, p.lideranca).nome : "";
    h += '<div class="card"><h3>' + (doApp ? "Pedido" : "Ausência registrada pelo RH") + "</h3>" + c.dados([["Pessoa", quem.nome], ["Tipo", p.tipo + (p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : "")], ["Período", F.periodo(p)],
      ["Volta em", calc.fmtDiaSemana(calc.voltaEm(fim, fer)) + ", " + calc.fmtDataAno(calc.voltaEm(fim, fer))], ["Liderança direta", lid],
      doApp ? ["Pedido em", calc.fmtDataAno(p.criadoEm)] : ["Registrada por", dom.pessoa(ctx, p.autor || p.criadoPor).nome + (p.criadoEm ? " em " + calc.fmtDataAno(p.criadoEm) : "")],
      doApp ? ["E-mail ao RH", p.emailEnviadoEm ? "enviado em " + calc.fmtDataAno(p.emailEnviadoEm) : "não enviado pelo app"] : null]) +
      '<div class="sci" style="margin-top:14px">' + c.textoRegistro("Cobertura das atividades", p.cobertura) + c.textoRegistro(doApp ? "Justificativa" : "Observação", p.justificativa) + "</div></div>";
    if (doApp && (p.rhDecisao || p.liderancaDecisao || p.canceladaEm)) {
      h += '<div class="card"><h3>Respostas</h3><div class="sci">' +
        (p.rhDecisao ? '<div><div class="k">RH · ' + esc(p.rhDecisao.toLowerCase()) + " em " + calc.fmtDataAno(p.rhEm) + '</div><div class="texto-registro">' + esc(p.rhComentario || "Sem comentário.") + "</div></div>" : "") +
        (p.liderancaDecisao ? '<div><div class="k">' + esc(lid || "Liderança") + " · " + (p.liderancaDecisao === "Aprovada" ? "confirmado" : "recusado") + " em " + calc.fmtDataAno(p.liderancaEm) + '</div><div class="texto-registro">' + esc(p.liderancaComentario || "Sem comentário.") + "</div></div>" : "") +
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
      titulo: (rh ? "Resposta do RH" : "Confirmação da liderança") + " · " + nome, sub: esc(p.tipo + " · " + F.periodo(p)),
      corpo: '<div id="form-decisao-ferias">' +
        (p.foraDaPolitica ? '<div class="aviso-atencao" style="margin-bottom:14px"><b>Pontos fora da política:</b><ul style="margin:6px 0 0;padding-left:18px">' + p.foraDaPolitica.split("\n").filter(Boolean).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" + (p.justificativa ? '<div style="margin-top:6px"><b>Justificativa:</b> ' + esc(p.justificativa) + "</div>" : "") + "</div>" : "") +
        (!rh && p.rhComentario ? '<div class="aviso-info" style="margin-bottom:14px"><b>Comentário do RH:</b> ' + esc(p.rhComentario) + "</div>" : "") +
        c.campo({ nome: "decisao", rotulo: "Decisão", tipo: "escolha", opcoes: [{ valor: "Aprovada", rotulo: rh ? "Aprovar" : "Confirmar" }, { valor: "Recusada", rotulo: "Recusar" }], valor: el.dataset.decisao }) +
        c.campo({ nome: "comentario", rotulo: "Comentário", tipo: "textoLongo", opcional: true, ajuda: "Vai para quem pediu. Na recusa, é obrigatório: explique o motivo." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-decisao-ferias" data-id="' + esc(p.id) + '">Registrar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
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
        if (p.lideranca && !fechaNoRH) await GP.app.avisar([p.lideranca], aprovada ? "O RH aprovou o pedido de " + oque + " de " + nome + ". Confirme até " + calc.fmtData(F.prazoLideranca(ctx, it)) + " no app Gestão de Pessoas → Férias e ausências." : "O RH recusou o pedido de " + oque + " de " + nome + ".");
        await GP.app.avisar([p.responsavel], aprovada ? (it.estagio === "SUCCESS" ? "Aprovado: o seu pedido de " + oque + " está na agenda da equipe." : "O RH aprovou o seu pedido de " + oque + ". Falta a confirmação da sua liderança.")
          : "O RH não aprovou o seu pedido de " + oque + ": " + comentario);
      } else {
        await GP.app.avisarRH(E().eu.nome + (aprovada ? " confirmou" : " recusou") + " o pedido de " + oque + " de " + nome + (aprovada ? ". O período está na agenda da equipe." : "."));
        await GP.app.avisar([p.responsavel], aprovada ? "Aprovado: o seu pedido de " + oque + " foi confirmado pela liderança e está na agenda da equipe." : "A sua liderança não confirmou o seu pedido de " + oque + ": " + comentario);
      }
      return it;
    }, { mensagem: rh ? (aprovada ? (dados.estagio === "SUCCESS" ? "Aprovado: o período está na agenda da equipe." : "Aprovado pelo RH. A liderança confirma em seguida.") : "Pedido recusado.") : (aprovada ? "Confirmado: o período está na agenda da equipe." : "Pedido recusado.") });
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
      const eu = String(E().eu.id), oque = F.NOME_TIPO[p.tipo] + ", " + F.periodoCurto(p);
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
    const atualizar = function () {
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
      if (idPedido) { try { await ui.atualizar("ferias", idPedido, { emailEnviadoEm: new Date().toISOString() }); } catch (err) { console.warn("Envio do e-mail não anotado no pedido:", err); } }
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

  GP.telas = GP.telas || {};
  GP.telas.ferias = { abrirEmail, politicaHtml };
})(window);
