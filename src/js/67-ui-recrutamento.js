/* =====================================================================================
   TELAS — Recrutamento (3.1): solicitar vaga, acompanhar e avaliar finalistas
   -------------------------------------------------------------------------------------
   As vagas vêm do funil de negócios "HR | Requisição de Vagas" (categoria 77), criado em
   07/10/2026. Desde 04/11/2026 a Solicitação de Contratação é feita aqui no app (antes era
   o formulário CRM 259): as mesmas perguntas, e o card nasce em "Nova solicitação". A
   liderança vê as vagas que pediu (pelo e-mail do solicitante), a coordenação as do setor
   e o RH todas. O funil de R&S está em criação: quando existir, só a categoria muda em
   Configuração.
   Desde 05/11/2026 a liderança direta e a coordenação também pedem promoção por aqui (e pela aba
   Carreira do membro): o card cai no mesmo funil, a coordenação aprova e depois o RH. Ver a seção
   "Solicitação de promoção" no fim deste arquivo.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural, primeiroNome } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const F = GP.formularios;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;

  ui.rotas.recrutamento = function (partes) {
    if (partes[0] === "finalista" && partes[1]) return telaFinalista(partes[1]);
    if (partes[0] === "promocao" && partes[1]) return telaPromocao(partes[1]);
    const ctx = E().ctx;
    const uid = E().visao === "rh" ? null : E().eu.id;
    const vagas = dom.vagasDe(ctx, uid);
    const abertas = vagas.filter((v) => !v.semantica);
    const fechadas = vagas.filter((v) => v.fechada);
    const fin = (ctx.registros.finalistas || []).filter((f) => E().visao === "rh" || f.lideranca === E().eu.id);
    const finPend = fin.filter((f) => ["NEW", "ATRASADO"].indexOf(f.estagio) >= 0);
    const formal = dom.papeis(ctx, E().eu.id).enviaFormal;
    const erroVagas = ctx.vagas && ctx.vagas.erro;
    const promoAguardando = dom.promocoesAguardando(ctx, E().eu.id);
    const podePromover = dom.membrosParaPromover(ctx, E().eu.id).length > 0;
    let h = c.cabecalho("recrutamento", "Recrutamento", "<span><b>" + abertas.length + "</b> vaga(s) em aberto</span><span><b>" + finPend.length + "</b> finalista(s) para avaliar</span>" +
      (promoAguardando.length ? "<span><b>" + promoAguardando.length + "</b> promoção(ões) aguardando você</span>" : ""),
      '<button class="btn" data-acao="solicitar-vaga">' + icone("mais", 15) + " Solicitar vaga</button>" +
      (podePromover ? '<button class="btn sec" data-acao="solicitar-promocao">' + icone("mais", 15) + " Solicitar promoção</button>" : ""));
    h += '<div class="aviso-info" style="margin-bottom:16px">A solicitação cria o card no funil HR | Requisição de Vagas, em "Nova solicitação", e avisa o RH. ' +
      (E().visao === "rh" ? "O RH também pode registrar um pedido por aqui." : formal ? "Como coordenação, a sua solicitação vai direto ao RH." : "Antes de enviar, alinhe com a sua coordenação a necessidade, o escopo, a senioridade, o perfil e a prioridade da vaga. Ela recebe um aviso quando você envia.") +
      (podePromover ? " A solicitação de promoção também cai neste funil" + (formal ? " e, pedida por você, também vai direto ao RH." : ": a coordenação aprova e depois o RH.") : "") + "</div>";
    if (erroVagas) h += '<div class="aviso-atencao" style="margin-bottom:16px">Não foi possível ler o funil de vagas: ' + esc(erroVagas) + ". O TI precisa dar à função Liderança acesso de leitura ao funil \"HR | Requisição de Vagas\".</div>";
    // Alerta vermelho do RH: solicitações que ainda estão em "Nova solicitação" (reunião de 29/10/2026)
    const novas = E().visao === "rh" ? vagas.filter((v) => v.nova) : [];
    if (novas.length) h += '<div class="card acao vermelho"><h3>' + icone("alerta", 16) + " " + plural(novas.length, "solicitação de vaga nova aguarda o RH", "solicitações de vaga novas aguardam o RH") + '</h3><div class="lista">' +
      novas.map((v) => '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">' + (v.solicitante ? "pedida por " + esc(v.solicitante) : "") + (v.atualizadoEm ? " · em " + calc.fmtData(v.atualizadoEm) : "") + '</div></div><div class="lado">' + c.tag("Nova solicitação", "vermelho") + "</div></div>").join("") +
      '</div><p class="muted" style="font-size:12px;margin:10px 0 0">O alerta some quando o card sai de "Nova solicitação" no funil HR | Requisição de Vagas.</p></div>';
    // promoções que aguardam a decisão de quem vê (coordenação ou RH)
    if (promoAguardando.length) h += '<div class="card acao"><h3>' + plural(promoAguardando.length, "promoção aguarda a sua aprovação", "promoções aguardam a sua aprovação") + '</h3><div class="lista">' + promoAguardando.map(itemPromocao).join("") + "</div></div>";
    if (finPend.length) {
      h += '<div class="card acao"><h3>Avaliar os finalistas<span class="extra muted">prazo de 5 dias úteis</span></h3><div class="lista">' + finPend.map((f) =>
        '<div class="item clicavel" data-rota="#/recrutamento/finalista/' + esc(f.id) + '"><div class="principal-item"><div class="t">' + esc(f.candidato || f.titulo) + '</div><div class="d">' + esc(f.titulo) + "</div></div><div class=\"lado\">" + c.prazo(f.prazo) + "</div></div>").join("") + "</div></div>";
    }
    h += '<div class="card"><h3>Vagas em andamento</h3>' + (abertas.length ? '<div class="lista">' + abertas.map((v) =>
      '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">' + (v.solicitante ? "pedida por " + esc(v.solicitante) + " · " : "") + (v.atualizadoEm ? "última atualização do RH em " + calc.fmtData(v.atualizadoEm) : "") + "</div>" +
      '<div class="barra" style="margin-top:8px;max-width:360px"><div class="preench" style="width:' + (v.posicao ? Math.round((v.posicao / v.totalEtapas) * 100) : 0) + '%"></div></div></div>' +
      '<div class="lado"><span class="tag azul">Etapa ' + (v.posicao || "?") + " de " + v.totalEtapas + " · " + esc(v.etapa) + "</span>" +
      (v.diasEmAberto !== null ? '<span class="prazo">' + plural(v.diasEmAberto, "dia", "dias") + " em aberto</span>" : '<span class="prazo">aguardando aprovação</span>') +
      (v.entradaDesejada ? '<span class="prazo">entrada desejada ' + calc.fmtData(v.entradaDesejada) + "</span>" : "") + "</div></div>").join("") + "</div>" : c.vazio("Nenhuma vaga em andamento.")) + "</div>";
    if (fechadas.length) h += '<div class="card"><h3>Vagas preenchidas</h3><div class="lista">' + fechadas.map((v) => '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">fechada em ' + calc.fmtData(v.fechadaEm) + "</div></div><div class=\"lado\">" +
      (v.tempoParaFechar !== null ? c.tag(v.tempoParaFechar + " dias para fechar", "verde") : "") + "</div></div>").join("") + "</div></div>";
    h += listaPromocoesHtml(promoAguardando, podePromover);
    return h;
  };

  function telaFinalista(id) {
    const ctx = E().ctx;
    const f = ctx.idx.porId.finalistas[id];
    if (!f) return c.voltar("#/recrutamento", "Recrutamento") + '<div class="card">' + c.vazio("Avaliação não encontrada.") + "</div>";
    const registrado = f.estagio === "SUCCESS";
    return c.voltar("#/recrutamento", "Recrutamento") + c.cabecalho("recrutamento", "Finalista: " + (f.candidato || f.titulo), "<span>" + esc(f.titulo) + "</span>" + (registrado ? "" : "<span>" + c.prazo(f.prazo) + "</span>")) +
      '<div class="card"><h3>Parecer do RH</h3><div class="texto-registro">' + esc(f.parecerRH || "O RH ainda não registrou o parecer.") + "</div></div>" +
      (registrado ? '<div class="card"><h3>Seu parecer</h3>' + c.dados([["Parecer", f.parecer]]) + '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Pontos fortes e pontos de atenção", f.pontos) + "</div></div>"
        : '<div class="card acao"><h3>Seu parecer</h3><div id="form-finalista">' + c.campo({ nome: "parecer", rotulo: "Parecer da liderança", tipo: "escolha", opcoes: op.parecerFinalista }) +
          c.campo({ nome: "pontos", rotulo: "Pontos fortes e pontos de atenção", tipo: "textoLongo", ajuda: "O que você viu na entrevista." }) +
          '<button class="btn" data-acao="salvar-finalista" data-id="' + esc(f.id) + '">Registrar o parecer</button></div></div>');
  }
  ui.acoes["salvar-finalista"] = function (el) {
    const f = document.getElementById("form-finalista");
    if (!ui.validar(f, ["parecer", "pontos"])) return;
    const d = ui.lerForm(f);
    const item = E().ctx.idx.porId.finalistas[el.dataset.id];
    ui.salvar(el, async () => {
      await ui.atualizar("finalistas", item.id, { parecer: d.parecer, pontos: d.pontos, estagio: "SUCCESS" });
      // "Quero conversar com o RH antes" pede ao RH que agende a conversa
      if (d.parecer === "Quero conversar com o RH antes") await GP.app.avisarRH("A liderança quer conversar antes de seguir com a finalista " + (item.candidato || "") + ". Agende a conversa.");
      else await GP.app.avisarRH("Parecer da liderança registrado para a finalista " + (item.candidato || "") + ".");
    }, { mensagem: "Parecer registrado. O RH segue com a próxima etapa." });
  };

  /* ---------------- Solicitação de Contratação (o antigo formulário CRM 259, agora no app) ---------------- */
  let inicial = {}; // respostas iniciais do formulário aberto: o aviso à coordenação só sai se ela não foi trocada
  ui.acoes["solicitar-vaga"] = function () {
    const ctx = E().ctx, eu = E().eu;
    inicial = F.inicialVaga(ctx, eu.id);
    // já lê os campos do funil enquanto a pessoa preenche (a leitura é grande: todos os campos de negócio do portal)
    if (E().repo.camposNegocio) E().repo.camposNegocio().catch((e) => console.warn("Campos do funil não lidos:", e));
    ui.abrirPainel({
      titulo: "Solicitar vaga", largo: true,
      sub: "Solicitação de Contratação. O card nasce no funil HR | Requisição de Vagas, em \"Nova solicitação\", e o RH recebe o aviso.",
      corpo: '<div id="form-vaga"><p class="desc-form">' + esc(F.VAGA.descricao) + "</p>" +
        '<div class="aviso-info" style="margin-bottom:14px">Enviada em nome de <b>' + esc(eu.nome) + "</b>" + (eu.email ? " (" + esc(eu.email) + ")" : "") + ". É por esse e-mail que a vaga aparece para você aqui no Recrutamento.</div>" +
        GP.ui.formulario.html(F.VAGA, inicial, { min: { UF_CRM_RV_DATA_ENT: ctx.hoje } }) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-vaga">Enviar ao RH</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: (el) => GP.ui.formulario.ligar(el.querySelector("#form-vaga"), F.VAGA),
    });
  };
  ui.acoes["enviar-vaga"] = function (el) {
    const FU = GP.ui.formulario;
    const f = document.getElementById("form-vaga");
    const r = FU.aplicar(f, F.VAGA);
    if (!FU.validar(f, F.VAGA, r)) return;
    const ctx = E().ctx, eu = E().eu;
    if (r.UF_CRM_RV_DATA_ENT < ctx.hoje) { ui.erroNoPainel("A data desejada de entrada não pode ficar no passado."); return; }
    const cfg = E().config || {};
    const categoria = Number((cfg.recrutamento || {}).categoria) || 77;
    const responsavel = FU.responsavelDoFunil("recrutamento");
    const campos = Object.assign(F.camposDoNegocio(F.VAGA, r), { UF_CRM_RV_EMAIL: eu.email || "" });
    const vaga = r.UF_CRM_RV_VAGA.trim();
    const titulo = vaga + " · " + (r.UF_CRM_RV_DEPTO || r.UF_CRM_RV_SETOR).trim();
    // a coordenação recebe o aviso se continua a da estrutura (se a pessoa trocou o nome, o app não sabe quem é)
    const coord = inicial.coordenacaoId && inicial.coordenacaoId !== String(eu.id) && r.UF_CRM_RV_COORD.trim() === inicial.UF_CRM_RV_COORD ? inicial.coordenacaoId : "";
    ui.salvar(el, async () => {
      const neg = await FU.enviarCard({ categoria, titulo, campos, responsavel, nomeFunil: "HR | Requisição de Vagas" });
      // a vaga entra em "Vagas em andamento" sem recarregar
      const vagas = ctx.vagas = ctx.vagas || { etapas: [], negocios: [], historico: [] };
      vagas.negocios = vagas.negocios || [];
      vagas.negocios.unshift(F.negocioLocal({ id: neg.id, titulo, estagio: neg.estagio || ((vagas.etapas || [])[0] || {}).id || "", agora: new Date().toISOString(), campos }));
      const link = FU.linkNoAviso(neg);
      await GP.app.avisarRH("Nova solicitação de vaga no funil HR | Requisição de Vagas: " + vaga + " (" + (r.UF_CRM_RV_SETOR || r.UF_CRM_RV_DEPTO).trim() + "), pedida por " + eu.nome + "." + link);
      if (coord && !dom.papeis(ctx, coord).rh) await GP.app.avisar([coord], eu.nome + " enviou ao RH a solicitação de vaga \"" + vaga + "\". Ela está no funil HR | Requisição de Vagas." + link);
      // quem pediu guarda o link nas notificações do Bitrix, para acompanhar
      await GP.app.avisar([eu.id], "Você enviou ao RH a solicitação de vaga \"" + vaga + "\". Acompanhe pelo card." + link);
      return neg;
    }, { rotuloOcupado: "Enviando..." }).then((neg) => {
      if (neg && neg.id) FU.mostrarEnviado({ neg, nomeFunil: "HR | Requisição de Vagas", titulo: "Vaga enviada ao RH", texto: "O card \"" + titulo + "\" está no funil HR | Requisição de Vagas, em \"Nova solicitação\". Ele também aparece em Vagas em andamento." });
    });
  };

  /* =====================================================================================
     Solicitação de promoção (05/11/2026)
     Pedido do usuário: a liderança direta ou a coordenação pede; a coordenação e o RH aprovam; o card cai no
     funil de vagas. O card nasce com quem pede (para o histórico entrar na timeline) e passa para quem decide
     agora: a coordenação ou, quando ela mesma pediu (ou o membro não tem coordenação), o RH. A decisão é dada
     aqui no app e grava os campos UF_CRM_PR_*, a etapa e o novo responsável. Aprovada pelo RH, o app registra
     a movimentação na aba Carreira do membro. O app nunca avisa o membro: a conversa fica com a liderança.
     ===================================================================================== */
  const SITUACAO = {
    coordenacao: { t: "Aguarda a coordenação", cor: "ambar" },
    rh: { t: "Aguarda o RH", cor: "azul" },
    aprovada: { t: "Aprovada", cor: "verde" },
    naoAprovada: { t: "Não aprovada", cor: "vermelho" },
    cancelada: { t: "Cancelada", cor: "cinza" },
  };
  function tagPromocao(x) {
    const s = SITUACAO[x.situacao] || { t: x.etapa, cor: "cinza" };
    return c.tag(x.situacao === "naoAprovada" ? (x.naoAprovadaPor === "coordenacao" ? "Não aprovada pela coordenação" : "Não aprovada pelo RH") : s.t, s.cor);
  }
  const deParaTexto = (x) => (x.nivelAtual ? x.nivelAtual + " → " : "") + (x.nivel || "") + (x.cargo ? " (" + x.cargo + ")" : "");
  const fmtAno = (d) => (d ? calc.fmtDataAno(String(d).slice(0, 10)) : "");
  const nomeDe = (uid) => dom.pessoa(E().ctx, uid).nome;
  function itemPromocao(x) {
    const ctx = E().ctx;
    const m = x.membroId && ctx.idx.membro[x.membroId] ? dom.infoMembro(ctx, ctx.idx.membro[x.membroId]) : { nome: x.nome };
    return '<div class="item clicavel" data-rota="#/recrutamento/promocao/' + esc(x.id) + '">' + c.avatar(m, 30) +
      '<div class="principal-item"><div class="t">' + esc(x.nome) + " · " + esc(deParaTexto(x)) + '</div><div class="d">pedida por ' + esc(nomeDe(x.solicitante)) +
      (x.criadaEm ? " em " + fmtAno(x.criadaEm) : "") + (x.situacao === "coordenacao" && x.coordenacao ? " · com " + esc(nomeDe(x.coordenacao)) : "") +
      (x.situacao === "aprovada" && x.vigencia ? " · vale a partir de " + fmtAno(x.vigencia) : "") + '</div></div><div class="lado">' + tagPromocao(x) + "</div></div>";
  }
  /** A lista de todas as solicitações que a pessoa acompanha (as que aguardam a decisão dela ficam no alto da tela) */
  function listaPromocoesHtml(aguardando, podePromover) {
    const ctx = E().ctx;
    const ja = {};
    (aguardando || []).forEach((x) => { ja[x.id] = true; });
    const outras = dom.promocoesDe(ctx, E().eu.id).filter((x) => !ja[x.id]);
    if (!outras.length && !podePromover) return "";
    return '<div class="card"><h3>Solicitações de promoção<span class="extra muted">a coordenação aprova, depois o RH</span></h3>' +
      (outras.length ? '<div class="lista">' + outras.map(itemPromocao).join("") + "</div>" : c.vazio("Nenhuma solicitação de promoção" + (podePromover ? ". Para pedir, use \"Solicitar promoção\", no alto, ou a aba Carreira do card do membro." : "."))) + "</div>";
  }
  /** Para a aba Carreira do card do membro */
  function promocoesDoMembroHtml(membroId) {
    const ctx = E().ctx, uid = E().eu.id;
    const lista = dom.promocoesDe(ctx, uid).filter((x) => x.membroId === String(membroId));
    const pode = dom.membrosParaPromover(ctx, uid).some((m) => m.id === String(membroId));
    if (!lista.length && !pode) return "";
    return '<div class="grupo-form" style="margin-top:16px"><div class="rotulo-grupo">Solicitações de promoção</div>' +
      (lista.length ? '<div class="lista">' + lista.map(itemPromocao).join("") + "</div>" : '<div class="muted" style="font-size:13px">Nenhuma solicitação de promoção.</div>') +
      (pode && !lista.some((x) => x.situacao === "coordenacao" || x.situacao === "rh") ? '<div style="margin-top:10px"><button class="btn peq" data-acao="solicitar-promocao" data-membro="' + esc(membroId) + '">' + icone("mais", 13) + " Solicitar promoção</button></div>" : "") + "</div>";
  }

  /** A tela de uma solicitação: andamento, a decisão (para quem decide agora), a proposta e a justificativa */
  function telaPromocao(id) {
    const ctx = E().ctx, uid = E().eu.id;
    const x = dom.promocoesDe(ctx, uid).find((p) => p.id === String(id));
    const volta = c.voltar("#/recrutamento", "Recrutamento");
    if (!x) return volta + '<div class="card">' + c.vazio("Solicitação de promoção não encontrada, ou você não acompanha esta solicitação.") + "</div>";
    const D = dom.DECISAO_PROMOCAO;
    const decide = dom.decisorDaPromocao(ctx, uid, x);
    const pelaCoord = x.coordDecisao === D.pelaCoordenacao;
    const m0 = x.membroId ? ctx.idx.membro[x.membroId] : null;
    const vejoMembro = m0 && dom.membrosVisiveis(ctx, uid).some((m) => m.id === m0.id);
    let coordTexto;
    if (pelaCoord) coordTexto = "Pedida pela própria coordenação" + (x.coordenacao ? " (" + nomeDe(x.coordenacao) + ")" : "");
    else if (x.coordDecisao === D.semCoordenacao) coordTexto = "O membro não tem coordenação na estrutura: foi direto ao RH";
    else if (x.coordDecisao === D.aprovada) coordTexto = "Aprovada por " + nomeDe(x.coordenacao) + (x.coordEm ? " em " + fmtAno(x.coordEm) : "");
    else if (x.coordDecisao === D.naoAprovada) coordTexto = "Não aprovada por " + nomeDe(x.coordenacao) + (x.coordEm ? " em " + fmtAno(x.coordEm) : "");
    else coordTexto = x.situacao === "coordenacao" ? "Aguardando " + nomeDe(x.coordenacao) : "—";
    let rhTexto;
    if (x.rhDecisao === D.aprovada) rhTexto = "Aprovada" + (x.rhPor ? " por " + nomeDe(x.rhPor) : "") + (x.rhEm ? " em " + fmtAno(x.rhEm) : "") + (x.vigencia ? ". Vale a partir de " + fmtAno(x.vigencia) : "");
    else if (x.rhDecisao === D.naoAprovada) rhTexto = "Não aprovada" + (x.rhPor ? " por " + nomeDe(x.rhPor) : "") + (x.rhEm ? " em " + fmtAno(x.rhEm) : "");
    else if (x.situacao === "rh") rhTexto = "Aguardando o RH";
    else if (x.situacao === "coordenacao") rhTexto = "Depois da coordenação";
    else if (x.situacao === "aprovada") rhTexto = "Aprovada no funil (etapa \"" + x.etapa + "\")";
    else rhTexto = x.situacao === "naoAprovada" && x.naoAprovadaPor === "rh" ? "Não aprovada no funil" : "—";
    const papel = pelaCoord || (x.solicitante && x.solicitante === x.coordenacao) ? "coordenação" : "liderança direta";
    let h = volta + c.cabecalho("recrutamento", "Promoção: " + x.nome, "<span>" + tagPromocao(x) + "</span><span>" + esc(deParaTexto(x)) + "</span>",
      '<button class="btn sec" data-acao="abrir-negocio" data-id="' + esc(x.id) + '">Abrir o card na pipe</button>' +
      (vejoMembro ? '<a class="btn sec" href="#/membro/' + esc(m0.id) + '/carreira">Card do membro</a>' : ""));
    h += '<div class="card"><h3>Andamento</h3>' + c.dados([["Pedido", nomeDe(x.solicitante) + " (" + papel + ")" + (x.criadaEm ? " em " + fmtAno(x.criadaEm) : "")], ["Coordenação", coordTexto], ["RH", rhTexto]]) +
      ((x.coordObs || x.rhObs) ? '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Comentário da coordenação", x.coordObs) + c.textoRegistro("Comentário do RH", x.rhObs) + "</div>" : "") + "</div>";
    if (decide) h += decisaoHtml(x, decide);
    h += '<div class="card"><h3>A proposta</h3>' + c.dados([["Membro", x.nome], ["Cargo e área atuais", x.atual], ["Nível atual", x.nivelAtual], ["Nível proposto", x.nivel],
      ["Senioridade proposta", x.senioridade], ["Novo cargo ou função", x.cargo], ["Data sugerida", fmtAno(x.data)], ["Reajuste salarial", [x.remuneracao, x.reajuste].filter(Boolean).join(" · ")],
      ["A pessoa já sabe?", x.ciente]]) + "</div>";
    h += '<div class="card"><h3>Justificativa e evidências</h3><div class="sci">' +
      c.textoRegistro("Por que agora", x.motivo) + c.textoRegistro("Resultados e entregas", x.resultados) + c.textoRegistro("Responsabilidades do novo nível que já assume", x.responsabilidades) +
      c.textoRegistro("Competências que se destacam", x.competencias) + c.textoRegistro("O que desenvolver e como apoiar", x.desenvolver) +
      c.textoRegistro("Atividades atuais", [x.impacto, x.impactoTexto].filter(Boolean).join("\n")) + c.textoRegistro("Observações", x.obs) + "</div>" +
      '<p class="muted" style="font-size:12px;margin:12px 0 0">Os feedbacks SCI, os 1:1 mensais e os O2O de ' + esc(primeiroNome(x.nome)) + " estão na timeline do card na pipe, copiados no envio.</p></div>";
    return h;
  }
  function decisaoHtml(x, decide) {
    const ctx = E().ctx;
    const botoes = (rotulo) => '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-acao="promocao-decidir" data-id="' + esc(x.id) + '" data-decisao="aprovar">' + rotulo + "</button>" +
      '<button class="btn sec" data-acao="promocao-decidir" data-id="' + esc(x.id) + '" data-decisao="recusar">Não aprovar</button></div>';
    const comentario = c.campo({ nome: "comentario", rotulo: "Comentário", tipo: "textoLongo", opcional: true, ajuda: "Obrigatório para não aprovar. Vai para o card e para quem pediu." });
    if (decide === "coordenacao") {
      return '<div class="card acao"><h3>Sua decisão como coordenação</h3><div id="form-decisao-promocao">' +
        '<p class="muted" style="margin-top:0">Aprovada, a solicitação segue para o RH, que dá a decisão final. Não aprovada, ela é encerrada e ' + esc(nomeDe(x.solicitante)) + " recebe o aviso com o seu comentário.</p>" +
        comentario + botoes("Aprovar e enviar ao RH") + "</div></div>";
    }
    const D = dom.DECISAO_PROMOCAO;
    const m0 = x.membroId ? ctx.idx.membro[x.membroId] : null;
    const antes = x.coordDecisao === D.aprovada ? "A coordenação (" + nomeDe(x.coordenacao) + ") aprovou" + (x.coordEm ? " em " + fmtAno(x.coordEm) : "") + ". "
      : x.coordDecisao === D.pelaCoordenacao ? "Pedida pela própria coordenação. " : x.coordDecisao === D.semCoordenacao ? "O membro não tem coordenação na estrutura: a decisão é só do RH. " : "";
    return '<div class="card acao"><h3>Decisão do RH</h3><div id="form-decisao-promocao">' +
      '<p class="muted" style="margin-top:0">' + esc(antes) + "Aprovada, a promoção fica registrada no card da pipe e, se marcado abaixo, no card do membro. O app não avisa " + esc(primeiroNome(x.nome)) + ": a conversa fica com a liderança.</p>" +
      c.campo({ nome: "vigencia", rotulo: "Vale a partir de", tipo: "data", valor: x.data || ctx.hoje, ajuda: "A data sugerida por quem pediu. Ajuste se o RH combinar outra." }) +
      (m0 ? c.campo({ nome: "atualizarMembro", rotulo: "Card do membro", tipo: "simNao", valor: true,
        textoCheck: "Atualizar o nível" + (x.senioridade ? ", a senioridade" : "") + " e o histórico de movimentações (aba Carreira) de " + primeiroNome(x.nome) })
        : '<div class="aviso-atencao" style="margin-bottom:12px">O membro não foi achado no app: depois de aprovar, registre a movimentação no card dele à mão.</div>') +
      comentario + botoes("Aprovar a promoção") + "</div></div>";
  }

  ui.acoes["promocao-decidir"] = function (el) {
    const ctx = E().ctx, eu = E().eu;
    const x = dom.promocoes(ctx).find((p) => p.id === el.dataset.id);
    if (!x) return;
    const decide = dom.decisorDaPromocao(ctx, eu.id, x);
    if (!decide) { ui.avisar("Esta solicitação não aguarda a sua decisão.", "erro"); return; }
    const f = document.getElementById("form-decisao-promocao");
    const d = ui.lerForm(f);
    const aprovar = el.dataset.decisao === "aprovar";
    const comentario = String(d.comentario || "").trim();
    if (!aprovar && !ui.validar(f, ["comentario"])) { ui.avisar("Para não aprovar, escreva o motivo no comentário.", "erro"); return; }
    if (decide === "rh" && aprovar && !ui.validar(f, ["vigencia"])) return;
    const pergunta = aprovar ? (decide === "coordenacao" ? "Aprovar a promoção de " + x.nome + " e enviar ao RH?" : "Aprovar a promoção de " + x.nome + " para " + (x.nivel || "o nível proposto") + ", a partir de " + fmtAno(d.vigencia) + "?")
      : "Não aprovar a promoção de " + x.nome + "? A solicitação é encerrada.";
    if (!window.confirm(pergunta)) return;
    const cfg = E().config || {};
    const et = dom.etapasPromocao((ctx.vagas || {}).etapas, Number((cfg.recrutamento || {}).categoria) || 77);
    const D = dom.DECISAO_PROMOCAO;
    const hoje = ctx.hoje;
    const quem = eu.nome + (E().verComo && E().euReal ? " (registrado por " + E().euReal.nome + ")" : "");
    const link = E().repo.linkNegocio ? " [URL=" + E().repo.linkNegocio(x.id) + "]Abrir o card na pipe[/URL]" : "";
    let campos, estagio, responsavel = "", nota;
    if (decide === "coordenacao") {
      campos = { UF_CRM_PR_COORD_DEC: aprovar ? D.aprovada : D.naoAprovada, UF_CRM_PR_COORD_EM: hoje, UF_CRM_PR_COORD_OBS: comentario };
      estagio = aprovar ? et.rh : et.naoAprovada;
      if (aprovar) responsavel = GP.ui.formulario.responsavelDoFunil("recrutamento");
      nota = "[B]Coordenação: " + (aprovar ? "aprovada" : "não aprovada") + "[/B]\n" + quem + " em " + fmtAno(hoje) + "." + (comentario ? "\n" + comentario : "") + (aprovar ? "\nA solicitação segue para o RH." : "");
    } else {
      campos = { UF_CRM_PR_RH_DEC: aprovar ? D.aprovada : D.naoAprovada, UF_CRM_PR_RH_EM: hoje, UF_CRM_PR_RH_POR: Number(eu.id), UF_CRM_PR_RH_OBS: comentario };
      if (aprovar) campos.UF_CRM_PR_VIGENCIA = d.vigencia;
      estagio = aprovar ? et.aprovada : et.naoAprovada;
      nota = "[B]RH: " + (aprovar ? "promoção aprovada" : "não aprovada") + "[/B]\n" + quem + " em " + fmtAno(hoje) + "." + (aprovar ? " Vale a partir de " + fmtAno(d.vigencia) + "." : "") + (comentario ? "\n" + comentario : "");
    }
    const outros = (lista) => lista.filter((u, i) => u && String(u) !== String(eu.id) && lista.indexOf(u) === i);
    const avisos = [];
    ui.salvar(el, async () => {
      // o comentário primeiro: depois da decisão o card pode passar ao RH, e quem decidiu deixa de poder comentar nele
      try { await E().repo.comentarNegocio(x.id, nota); } catch (e) { avisos.push("o comentário não entrou na timeline do card (" + E().repo.mensagemErro(e) + ")"); }
      await E().repo.atualizarNegocio(x.id, { campos, estagio, responsavel });
      // a tela mostra a decisão sem recarregar
      const n = ((ctx.vagas || {}).negocios || []).find((y) => String(y.ID) === x.id);
      if (n) Object.assign(n, campos, { STAGE_ID: estagio, DATE_MODIFY: new Date().toISOString() }, responsavel ? { ASSIGNED_BY_ID: String(responsavel) } : {});
      // aprovada pelo RH: a movimentação vai para o card do membro (nível, senioridade e a linha na aba Carreira)
      if (decide === "rh" && aprovar && d.atualizarMembro && x.membroId && ctx.idx.membro[x.membroId]) {
        const m = ctx.idx.membro[x.membroId];
        const dados = { carreira: (m.carreira ? String(m.carreira).replace(/\s+$/, "") + "\n" : "") + F.linhaCarreira({ vigencia: d.vigencia, de: x.nivelAtual || m.nivel, para: x.nivel, cargo: x.cargo }) };
        if (x.nivel) dados.nivel = x.nivel;
        if (x.senioridade) dados.senioridade = x.senioridade;
        try { await ui.atualizar("membros", m.id, dados); } catch (e) { avisos.push("o card do membro não foi atualizado (" + E().repo.mensagemErro(e) + "): registre o nível e a movimentação em Editar cadastro"); }
      }
      if (decide === "coordenacao" && aprovar) {
        await GP.app.avisarRH("A coordenação (" + eu.nome + ") aprovou a promoção de " + x.nome + " (" + deParaTexto(x) + "). Agora aguarda o RH no app Gestão de Pessoas → Recrutamento." + link);
        await GP.app.avisar(outros([x.solicitante, x.lideranca]), "A coordenação aprovou a promoção de " + x.nome + ". Agora está com o RH." + link);
      } else if (decide === "coordenacao") {
        await GP.app.avisar(outros([x.solicitante, x.lideranca]), "A coordenação (" + eu.nome + ") não aprovou a promoção de " + x.nome + ": " + comentario + link);
      } else if (aprovar) {
        await GP.app.avisar(outros([x.solicitante, x.coordenacao, x.lideranca]), "O RH aprovou a promoção de " + x.nome + " para " + (x.nivel || "o nível proposto") + ", a partir de " + fmtAno(d.vigencia) + ". A conversa com " + primeiroNome(x.nome) + " fica com a liderança." + link);
      } else {
        await GP.app.avisar(outros([x.solicitante, x.coordenacao, x.lideranca]), "O RH não aprovou a promoção de " + x.nome + ": " + comentario + link);
      }
    }, { rotuloOcupado: "Gravando...", mensagem: aprovar ? (decide === "coordenacao" ? "Aprovada. A solicitação seguiu para o RH." : "Promoção aprovada" + (d.atualizarMembro ? " e registrada no card do membro." : ".")) : "Decisão gravada: não aprovada." })
      .then((ok) => { if (ok && avisos.length) setTimeout(() => ui.avisar("A decisão foi gravada, mas " + avisos.join("; ") + ".", "erro"), 60); });
  };

  /* ---------------- o formulário ---------------- */
  // preenchidos pelo app a partir do membro escolhido: trocar o membro troca o valor, se a pessoa não tiver editado
  const AUTO_PROMOCAO = ["UF_CRM_PR_ATUAL", "UF_CRM_PR_NIVEL_ATU"];
  function defPromocao() {
    const cfg = E().config || {};
    return F.formPromocao({ niveis: cfg.niveis || [], senioridades: op.senioridade || [], competencias: (cfg.competencias || []).map((x) => x && x.nome).filter(Boolean) });
  }
  function resumoPromocaoHtml(membroId) {
    const s = membroId ? F.resumoPromocao(E().ctx, membroId) : null;
    if (!s) return "";
    const nome = primeiroNome(s.nome);
    const registros = [plural(s.feedbacks, "feedback SCI", "feedbacks SCI") + (s.reconhecimento ? " (" + s.reconhecimento + " de reconhecimento)" : ""),
      plural(s.mensais, "1:1 mensal", "1:1 mensais"), plural(s.o2o, "O2O", "O2O")];
    return '<div class="rotulo">O que o app sabe de ' + esc(nome) + "</div>" + c.dados([
      ["Na Amorim desde", s.ingresso ? fmtAno(s.ingresso) + " (" + s.tempoDeCasa + ")" : ""],
      ["Última movimentação", s.ultimaMovimentacao || "nenhuma registrada na Carreira"],
      s.proximoNivel || s.objetivo ? ["No último O2O", [s.proximoNivel ? "próximo nível: " + s.proximoNivel : "", s.progresso ? "progresso: " + s.progresso.toLowerCase() : ""].filter(Boolean).join(" · ") || s.objetivo] : null,
      ["Registros no app", registros.join(", ").replace(/, ([^,]*)$/, " e $1")],
    ]) +
      (s.planoAtivo ? '<div class="aviso-atencao" style="margin-top:8px">' + esc(nome) + " tem um plano de melhoria em andamento. A coordenação e o RH vão ver no card.</div>" : "") +
      '<div class="ajuda" style="margin-top:8px">Os feedbacks SCI, os 1:1 mensais, os O2O e os planos de melhoria de ' + esc(nome) + " vão para a timeline do card, para a coordenação e o RH.</div>";
  }
  /** Os campos da promoção ainda não criados no portal: avisa e trava o envio (o administrador cria em Configuração) */
  async function conferirCamposDoFunil(painel) {
    const repo = E().repo;
    if (repo.modo === "demo" || !repo.camposNegocio) return;
    try {
      const mapa = await repo.camposNegocio();
      if (mapa && !mapa.UF_CRM_PR_MEMBRO) {
        const aviso = painel.querySelector("#promocao-campos-aviso");
        if (aviso) aviso.innerHTML = '<div class="aviso-erro" style="margin-bottom:14px">Os campos da promoção ainda não existem no funil. Um administrador do Bitrix cria em Configuração → "Criar ou completar a estrutura". Até lá, o envio não funciona.</div>';
        const b = document.querySelector('[data-acao="enviar-promocao"]');
        if (b) b.disabled = true;
      }
    } catch (e) { console.warn("Campos do funil não lidos:", e); }
  }
  ui.acoes["solicitar-promocao"] = function (el) {
    const ctx = E().ctx, eu = E().eu;
    const membros = dom.membrosParaPromover(ctx, eu.id).map((m) => dom.infoMembro(ctx, m)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((m) => ({ valor: m.id, rotulo: m.nome }));
    if (!membros.length) { ui.avisar("Você não é liderança direta nem coordenação de nenhum membro ativo.", "erro"); return; }
    const pre = el && el.dataset && el.dataset.membro && membros.some((x) => x.valor === el.dataset.membro) ? el.dataset.membro : "";
    const def = defPromocao();
    const ini = Object.assign({ membroId: pre }, pre ? F.inicialPromocao(ctx, pre) : {});
    ui.abrirPainel({
      titulo: "Solicitar promoção", largo: true,
      sub: "Solicitação de Promoção. O card nasce no funil HR | Requisição de Vagas: a coordenação aprova, depois o RH.",
      corpo: '<div id="form-promocao"><p class="desc-form">' + esc(def.descricao) + '</p><div id="promocao-campos-aviso"></div>' +
        '<div class="aviso-info" style="margin-bottom:14px">Enviada em nome de <b>' + esc(eu.nome) + "</b>. Acompanham a solicitação: você, a coordenação, a liderança direta do membro e o RH. O card fica restrito no funil.</div>" +
        GP.ui.formulario.html(def, ini, { opcoes: { membroId: membros }, min: { UF_CRM_PR_DATA: ctx.hoje } }) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-promocao">Enviar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: (painel) => {
        const f = painel.querySelector("#form-promocao");
        AUTO_PROMOCAO.forEach((k) => { const n = f.querySelector('[name="' + k + '"]'); if (n) n.dataset.auto = n.value; });
        GP.ui.formulario.ligar(f, def, (r, ev) => {
          if (ev && ev.target && ev.target.name === "membroId") {
            const novo = F.inicialPromocao(E().ctx, r.membroId);
            AUTO_PROMOCAO.forEach((k) => { const n = f.querySelector('[name="' + k + '"]'); if (n && n.value === (n.dataset.auto || "")) { n.value = novo[k] || ""; n.dataset.auto = n.value; } });
          }
          const bloco = f.querySelector('[data-campo="resumo"]');
          if (bloco) bloco.innerHTML = resumoPromocaoHtml(r.membroId);
        });
        conferirCamposDoFunil(painel);
      },
    });
  };
  ui.acoes["enviar-promocao"] = function (el) {
    const FU = GP.ui.formulario;
    const f = document.getElementById("form-promocao");
    const def = defPromocao();
    const r = FU.aplicar(f, def);
    if (!FU.validar(f, def, r)) return;
    const ctx = E().ctx, eu = E().eu, cfg = E().config || {};
    const conf = F.conferirPromocao(ctx, r, { niveis: cfg.niveis || [], promocoes: dom.promocoes(ctx) });
    if (!conf.ok) { ui.erroNoPainel(conf.mensagem); return; }
    const m0 = ctx.idx.membro[r.membroId];
    const m = dom.infoMembro(ctx, m0);
    const D = dom.DECISAO_PROMOCAO;
    const categoria = Number((cfg.recrutamento || {}).categoria) || 77;
    const et = dom.etapasPromocao((ctx.vagas || {}).etapas, categoria);
    const coord = String(dom.coordenacaoEfetiva(ctx, m0) || "");
    const lider = String(dom.liderancaEfetiva(ctx, m0) || "");
    const pelaCoord = !!coord && coord === String(eu.id);
    const vaiParaCoord = !!coord && !pelaCoord;
    const papel = dom.papelNaPromocao(ctx, eu.id, m0) || (E().visao === "rh" ? "RH" : "");
    const rh = FU.responsavelDoFunil("recrutamento");
    const campos = Object.assign(F.camposDaPromocao(def, r), { UF_CRM_PR_MEMBRO: Number(m.responsavel), UF_CRM_PR_SOLICIT: Number(eu.id) });
    if (coord) campos.UF_CRM_PR_COORD = Number(coord);
    if (pelaCoord) Object.assign(campos, { UF_CRM_PR_COORD_DEC: D.pelaCoordenacao, UF_CRM_PR_COORD_EM: ctx.hoje });
    if (!coord) campos.UF_CRM_PR_COORD_DEC = D.semCoordenacao;
    const aprovacao = vaiParaCoord ? "a coordenação (" + nomeDe(coord) + ") e depois o RH" : pelaCoord ? "pedida pela própria coordenação, vai direto ao RH" : "o membro não tem coordenação na estrutura, vai direto ao RH";
    const titulo = "Promoção · " + m.nome;
    const registradoPor = E().verComo && E().euReal ? E().euReal.nome : "";
    const dePara = (r.UF_CRM_PR_NIVEL_ATU ? r.UF_CRM_PR_NIVEL_ATU + " → " : "") + r.UF_CRM_PR_NIVEL;
    ui.salvar(el, async () => {
      // a timeline mostra o mais novo no alto: o histórico do membro embaixo e o pedido por cima
      const comentarios = F.historicoPromocao(ctx, m.id, { quem: eu.nome, registradoPor, data: ctx.hoje })
        .concat([F.textoPedidoPromocao(def, r, { nome: m.nome, quem: eu.nome, papel, registradoPor, data: ctx.hoje, aprovacao })]);
      const neg = await FU.enviarCard({ categoria, titulo, campos, origem: { sistema: dom.ORIGEM_APP, id: m.id }, restrito: true, comentarios,
        responsavel: vaiParaCoord ? coord : rh, estagio: vaiParaCoord ? "" : et.rh, observadores: [coord, lider], nomeFunil: "HR | Requisição de Vagas" });
      // a solicitação aparece na lista sem recarregar
      const vagas = ctx.vagas = ctx.vagas || { etapas: [], negocios: [], historico: [] };
      vagas.negocios = vagas.negocios || [];
      vagas.negocios.unshift(F.negocioLocal({ id: neg.id, titulo, estagio: neg.estagio || (vaiParaCoord ? et.coordenacao : et.rh), agora: new Date().toISOString(), campos, origem: { sistema: dom.ORIGEM_APP, id: m.id } }));
      const link = FU.linkNoAviso(neg);
      if (vaiParaCoord) await GP.app.avisar([coord], eu.nome + " pediu a promoção de " + m.nome + " (" + dePara + "). A coordenação aprova primeiro: abra o app Gestão de Pessoas → Recrutamento." + link);
      else await GP.app.avisarRH("Nova solicitação de promoção: " + m.nome + " (" + dePara + "), pedida por " + eu.nome + (pelaCoord ? ", da coordenação" : ". O membro não tem coordenação na estrutura") + ". Aguarda o RH no app Gestão de Pessoas → Recrutamento." + link);
      if (lider && lider !== String(eu.id) && lider !== coord) await GP.app.avisar([lider], eu.nome + " pediu a promoção de " + m.nome + ", da sua equipe." + link);
      await GP.app.avisar([eu.id], "Você pediu a promoção de " + m.nome + ". Acompanhe pelo card." + link);
      return neg;
    }, { rotuloOcupado: "Enviando..." }).then((neg) => {
      if (neg && neg.id) FU.mostrarEnviado({ neg, nomeFunil: "HR | Requisição de Vagas", titulo: "Promoção enviada",
        texto: "O card \"" + titulo + "\" está no funil HR | Requisição de Vagas. " + (vaiParaCoord ? "Agora aguarda a aprovação de " + nomeDe(coord) + "; depois vai ao RH." : "Agora aguarda o RH.") + " Ele também aparece em Recrutamento → Solicitações de promoção." });
    });
  };

  GP.telas = GP.telas || {};
  GP.telas.recrutamento = { promocoesDoMembroHtml, tagPromocao };
})(window);
