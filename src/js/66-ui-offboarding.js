/* =====================================================================================
   TELAS — Offboarding: esteira "HR | Offboarding", histórico de desligamentos e os
   encerramentos de contrato feitos pelo app (3.5.3), com a verificação de registros (4.1)
   e o guia da liderança (3.5.4). O plano de melhoria foi para Feedbacks (63-ui-planos.js).
   -------------------------------------------------------------------------------------
   Na solicitação pelo app, a verificação roda antes de criar e de novo a cada envio. A
   trava "no servidor" (4.1) está em lib/trava-encerramento.js: a tela sozinha não basta.
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
  /* Reunião de 29/10/2026: a solicitação vai por um formulário do Bitrix e vira um card na esteira
     "HR | Offboarding" (funil de negócios), onde o RH gerencia. O app mostra o alerta das solicitações
     novas, a esteira e o histórico de desligamentos por período. Enquanto o formulário não existir
     (link vazio em Configuração), a solicitação continua pelo próprio app, com a verificação. */
  ui.rotas.offboarding = function (partes) {
    if (partes[0] === "plano" && partes[1]) return GP.telas.planos.telaPlano(partes[1]); // links antigos: o plano foi para Feedbacks
    if (partes[0] === "encerramento" && partes[1]) return telaEncerramento(partes[1]);
    const ctx = E().ctx;
    const rh = E().visao === "rh";
    const membros = ui.membrosDaVisao();
    const ids = {};
    membros.forEach((m) => { ids[m.id] = true; });
    const encs = (ctx.registros.encerramentos || []).filter((e) => ids[e.membroId] || rh);
    const andamentoApp = encs.filter((e) => ["SUCCESS", "FAIL"].indexOf(e.estagio) < 0);
    const funil = rh ? dom.solicitacoesOffboarding(ctx) : [];
    const abertas = funil.filter((s) => !s.semantica);
    const aprov = dom.aprovacoesPendentes(ctx, E().eu.id);
    const links = (E().config && E().config.links) || {};
    const ano = ctx.hoje.slice(0, 4);
    const doAno = (dom.historicoDesligamentos(ctx, "ano", filtroHistorico()).find((l) => l.periodo.chave === ano) || { desligamentos: [] }).desligamentos.length;
    let h = c.cabecalho("offboarding", "Offboarding", "<span><b>" + (abertas.length + andamentoApp.length) + "</b> " + (abertas.length + andamentoApp.length === 1 ? "solicitação" : "solicitações") + " em andamento</span>" +
      "<span><b>" + doAno + "</b> " + (doAno === 1 ? "desligamento" : "desligamentos") + " em " + ano + "</span>");
    if (rh) h += alertaRH(funil.filter((s) => s.nova), dom.filaRH(ctx));
    h += cartaoSolicitar(links);
    h += '<details class="card" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;color:var(--navy)">' + icone("manual", 15) + " Guia da liderança para o encerramento de contrato</summary>" +
      '<div style="margin-top:12px">' + Object.keys(GUIA).filter((k) => k !== "AG_COORD").map((k) => "<p><b>" + esc(GUIA[k].t) + ".</b> " + esc(GUIA[k].d) + "</p>").join("") +
      (links.guiaOffboarding ? '<a target="_blank" rel="noopener" href="' + esc(links.guiaOffboarding) + '">Abrir o guia completo na Base de Conhecimento →</a>' : '<span class="muted">O guia completo fica na Base de Conhecimento (link a cadastrar).</span>') + "</div></details>";
    if (aprov.length) h += '<div class="card acao"><h3>Aguardando a sua aprovação</h3><div class="lista">' + aprov.map((a) =>
      '<div class="item clicavel" data-rota="#/offboarding/encerramento/' + esc(a.item.id) + '">' + (a.membro ? c.avatar(a.membro, 30) : "") + '<div class="principal-item"><div class="t">' + esc(a.membro ? a.membro.nome : "") + '</div><div class="d">' + esc(a.item.motivo) + " · aguardando há " + plural(a.dias, "dia", "dias") + " (prazo de 3)</div></div>" +
      '<div class="lado">' + c.prazo(a.prazo) + "</div></div>").join("") + "</div></div>";
    if (rh) h += esteiraHtml(funil);
    h += historicoHtml();
    if (encs.length) h += '<div class="card"><h3>Solicitações feitas pelo app<span class="extra muted">' + plural(encs.length, "solicitação", "solicitações") + "</span></h3>" +
      '<div class="lista">' + encs.slice().sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).map((e) => linhaEnc(e)).join("") + "</div></div>";
    return h;
  };
  function linhaEnc(e) {
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[e.membroId] || {});
    return '<div class="item clicavel" data-rota="#/offboarding/encerramento/' + esc(e.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + esc(e.motivo || "motivo a definir") + (e.dataDesejada ? " · data desejada " + calc.fmtData(e.dataDesejada) : "") + "</div></div>" +
      '<div class="lado">' + c.tag(e.estagioNome, COR_ENC[e.estagio]) + "</div></div>";
  }
  /** O que o RH acompanha no histórico: tudo. A coordenação e a liderança: as próprias equipes. */
  function filtroHistorico() {
    const v = E().visao, uid = String(E().eu.id);
    if (v === "rh") return null;
    if (v === "coordenacao") return (m) => String(m.coordenacao || "") === uid || String(m.lideranca || "") === uid;
    return (m) => String(m.lideranca || "") === uid;
  }

  /** Alerta vermelho do RH: solicitações que chegaram e ainda não foram tocadas (reunião de 29/10/2026) */
  function alertaRH(novasFunil, filaApp) {
    const doApp = filaApp.filter((f) => f.item.estagio === "ENVIADA_RH" || f.item.estagio === "AG_COORD");
    const n = novasFunil.length + doApp.length;
    if (!n) return "";
    return '<div class="card acao vermelho"><h3>' + icone("alerta", 16) + " " + plural(n, "solicitação nova aguarda o RH", "solicitações novas aguardam o RH") + "</h3><div class=\"lista\">" +
      novasFunil.map((s) => '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(s.id) + '"><div class="principal-item"><div class="t">' + esc(s.membro || s.titulo) + '</div><div class="d">' +
        esc([s.setor, s.motivoTexto, s.solicitante ? "pedida por " + s.solicitante : "", s.criadaEm ? "em " + calc.fmtData(s.criadaEm) : ""].filter(Boolean).join(" · ")) + "</div>" + atencaoFunil(s) +
        '</div><div class="lado">' + c.tag("Nova · esteira", "vermelho") + "</div></div>").join("") +
      doApp.map((f) => linhaEnc(f.item)).join("") + "</div>" +
      '<p class="muted" style="font-size:12px;margin:10px 0 0">O alerta some quando a solicitação sai de "Nova solicitação" na esteira (ou de "Enviada ao RH", nas feitas pelo app).</p></div>';
  }

  /** O que pede a atenção do RH numa solicitação da esteira: os registros de feedback que o formulário
      exige (no mínimo 2, por desempenho ou incompatibilidade com a função) e os pontos marcados em Riscos */
  function atencaoFunil(s) {
    let h = "";
    if (s.faltamFeedbacks) h += '<div class="d" style="color:var(--vermelho)">' + esc((s.anexos ? plural(s.anexos, "registro de feedback anexado", "registros de feedback anexados") : "Nenhum registro de feedback anexado") + ": o formulário pede no mínimo 2") + "</div>";
    if (s.riscos.length) h += '<div class="d" style="color:var(--ambar)">' + esc("Considerar: " + s.riscos.join(", ")) + "</div>";
    return h;
  }

  /** Quem envia a solicitação (3.6): com coordenação acima da liderança, é a coordenação que envia; sem
      coordenação acima, segue direto para o RH. */
  function cartaoSolicitar(links) {
    const ctx = E().ctx, uid = String(E().eu.id);
    const p = dom.papeis(ctx, uid);
    const meu = ctx.idx.membroPorUsuario[uid];
    const coord = meu ? String(dom.coordenacaoEfetiva(ctx, meu) || "") : "";
    const coordAcima = !p.rh && !p.enviaFormal && coord && coord !== uid;
    const texto = E().visao === "rh" ? "O RH registra direto na esteira." : p.enviaFormal ? "Como coordenação, você envia a solicitação direto ao RH." :
      coordAcima ? "Na sua área, quem envia a solicitação é a coordenação (" + dom.pessoa(ctx, coord).nome + "). Converse com ela antes: ela envia, e o RH acompanha pela esteira." :
      "Sem coordenação acima de você, a solicitação vai direto para o RH.";
    const botao = links.formOffboarding
      ? '<a class="btn' + (coordAcima ? " sec" : "") + '" target="_blank" rel="noopener" href="' + esc(links.formOffboarding) + '">' + icone("externo", 14) + " Abrir o formulário de solicitação</a>"
      : '<button class="btn' + (coordAcima ? " sec" : "") + '" data-acao="solicitar-encerramento">Verificar registros e solicitar</button>';
    return '<div class="card acao" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="margin-bottom:4px">Solicitar encerramento de contrato</h3>' +
      '<div class="muted">' + esc(texto) + (links.formOffboarding ? " O formulário cria o card na esteira HR | Offboarding, e o RH conduz a partir dali." : " Antes de enviar, o app confere se os registros do membro estão completos.") +
      " Dúvidas sobre o contrato vão para o RH.</div></div>" + botao + "</div></div>";
  }

  /** Esteira "HR | Offboarding" (só o RH lê o funil): as solicitações em andamento, por etapa */
  function esteiraHtml(funil) {
    const off = E().ctx.offboarding || {};
    const abertas = funil.filter((s) => !s.semantica);
    let corpo;
    if (off.erro) corpo = '<div class="aviso-atencao">Não foi possível ler a esteira: ' + esc(off.erro) + '. A função do RH precisa de leitura no funil "HR | Offboarding" (CRM → Configurações → Permissões de acesso).</div>';
    else if (!off.categoria) corpo = c.vazio("A esteira de offboarding ainda não está ligada ao app (Configuração → funil de offboarding).");
    else corpo = abertas.length ? '<div class="lista">' + abertas.map((s) =>
      '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(s.id) + '"><div class="principal-item"><div class="t">' + esc(s.membro || s.titulo) + '</div><div class="d">' +
      esc([s.setor, s.motivoTexto, s.solicitante ? "pedida por " + s.solicitante : "", s.dataLimite ? "data limite " + calc.fmtData(s.dataLimite) : ""].filter(Boolean).join(" · ")) + "</div>" + atencaoFunil(s) +
      '<div class="barra" style="margin-top:8px;max-width:360px"><div class="preench" style="width:' + (s.posicao ? Math.round((s.posicao / s.totalEtapas) * 100) : 0) + '%"></div></div></div>' +
      '<div class="lado">' + c.tag(s.nova ? "Nova solicitação" : s.etapa, s.nova ? "vermelho" : "azul") + '<span class="prazo">desde ' + calc.fmtData(s.criadaEm) + "</span></div></div>").join("") + "</div>"
      : c.vazio("Nenhuma solicitação em andamento na esteira.");
    return '<div class="card"><h3>Esteira HR | Offboarding<span class="extra muted">' + plural(abertas.length, "em andamento", "em andamento") + " · o RH move os cards no Bitrix</span></h3>" + corpo + "</div>";
  }
  ui.acoes["abrir-negocio"] = function (el) {
    if (E().repo.modo === "bitrix" && E().repo.abrirNegocio) E().repo.abrirNegocio(el.dataset.id);
    else ui.avisar("Na demonstração, o card " + el.dataset.id + " abriria na esteira do Bitrix.");
  };

  /** Histórico de desligamentos por trimestre, semestre ou ano (reunião de 29/10/2026) */
  const GRANULARIDADES = [["trimestre", "Trimestre"], ["semestre", "Semestre"], ["ano", "Ano"]];
  function historicoHtml() {
    const ctx = E().ctx;
    const g = E().filtros.offPeriodo || "trimestre";
    const linhas = dom.historicoDesligamentos(ctx, g, filtroHistorico());
    const rh = E().visao === "rh";
    const seletor = '<select class="entrada" style="width:auto;padding:4px 8px" data-mudar="off-periodo" aria-label="Agrupar por">' + GRANULARIDADES.map((x) => '<option value="' + x[0] + '"' + (x[0] === g ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>";
    const corpo = linhas.length ? '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Período</th><th class="n">Desligamentos</th><th class="n">Solicitações</th><th>Motivos (solicitações concluídas)</th></tr></thead><tbody>' +
      linhas.map((l) => "<tr><td><b>" + esc(l.periodo.rotulo) + "</b>" + (l.desligamentos.length ? '<div class="muted" style="font-size:12px">' + esc(l.desligamentos.map((d) => d.nome + " (" + calc.fmtData(d.data) + ")").join(", ")) + "</div>" : "") + "</td>" +
        '<td class="n"><b>' + l.desligamentos.length + '</b></td><td class="n">' + l.solicitacoes + "</td><td>" +
        (Object.keys(l.motivos).length ? Object.keys(l.motivos).map((k) => esc(k) + " (" + l.motivos[k] + ")").join(" · ") : '<span class="muted">—</span>') + "</td></tr>").join("") + "</tbody></table></div>"
      : c.vazio("Nenhum desligamento registrado ainda.");
    return '<div class="card"><h3>Histórico de desligamentos<span class="extra">' + seletor + (rh ? ' <button class="btn peq sec" data-acao="exportar-csv" data-conjunto="desligamentos">' + icone("baixar", 13) + " CSV</button>" : "") + "</span></h3>" +
      '<p class="muted" style="margin-top:0;font-size:12px">Desligamentos: membros que passaram para Encerrado no processo Membros, na data da mudança. Solicitações: as que entraram pela esteira' + (rh ? "" : " (o RH vê as da esteira)") + " e pelo app, na data em que foram criadas.</p>" + corpo + "</div>";
  }
  ui.acoes["off-periodo"] = function (el) { E().filtros.offPeriodo = el.value; E().manterRolagem = true; ui.render(); };

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
    acoes += c.botaoExcluir("encerramentos", e, { volta: "#/offboarding", descricao: "a solicitação de encerramento de contrato de " + m.nome });
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
      '<div class="card"><h3>Verificação de registros</h3>' + checagemHtml(ver) + (plano ? '<p style="margin-top:12px"><a href="#/rotinas/plano/' + esc(plano.id) + '">Abrir o plano de melhoria vinculado →</a></p>' : "") + "</div>";
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
  // planoResumoHtml e abrirFormPlano ficam aqui só por compatibilidade: o plano mora em 63-ui-planos.js
  GP.telas.offboarding = { encerramentoResumoHtml, planoResumoHtml: (p, x) => GP.telas.planos.planoResumoHtml(p, x), abrirFormPlano: (m) => GP.telas.planos.abrirFormPlano(m) };
})(window);
