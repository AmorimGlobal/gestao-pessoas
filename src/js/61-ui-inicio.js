/* =====================================================================================
   TELAS — Início, Painel (liderança, coordenação, RH, CEO), Perfil e tour (4.4, 4.6, 4.7)
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;

  function faixa(titulo, sub, numeros, links) {
    const simbolo = GP.marca && GP.marca.simboloBranco ? '<img class="curvas" src="' + GP.marca.simboloBranco + '" alt="">' : "";
    return '<section class="faixa">' + simbolo + '<div class="ola">' + esc(sub) + '</div><div class="titulo">' + esc(titulo) + "</div>" +
      (numeros ? '<div class="numeros">' + numeros.map((n) => '<div><div class="n' + (n.alerta ? " alerta" : "") + '">' + esc(n.valor) + '</div><div class="r">' + esc(n.rotulo) + "</div></div>").join("") + "</div>" : "") +
      (links ? '<div class="links">' + links + "</div>" : "") + "</section>";
  }
  function saudacao() {
    const h = new Date().getHours();
    return (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", " + primeiroNome(E().eu.nome);
  }

  /* ================================================================ INÍCIO */
  ui.rotas.inicio = function () {
    const ctx = E().ctx;
    if (E().visao === "ceo") return inicioCEO();
    const visao = E().visao;
    // Liderança: a própria equipe. Coordenação sem equipe direta e RH: o que a visão enxerga.
    const equipe = ui.minhaEquipe();
    const amplo = visao === "rh" || (visao === "coordenacao" && !equipe.length);
    const base = amplo ? ui.membrosDaVisao() : equipe;
    const pend = dom.pendenciasDe(ctx, base, { uid: E().eu.id });
    const atrasadas = pend.filter((p) => p.atrasado).length;
    const semana = pend.filter((p) => !p.atrasado && p.prazo && calc.diffDias(ctx.hoje, p.prazo) <= 7).length;
    const links = (E().config && E().config.links) || {};
    const onde = visao === "rh" ? "em todas as equipes" : amplo ? "no setor" : "";
    const numeros = [
      { valor: atrasadas, rotulo: (atrasadas === 1 ? "pendência atrasada" : "pendências atrasadas") + (onde ? " " + onde : ""), alerta: atrasadas > 0 },
      { valor: semana, rotulo: "vencem nos próximos 7 dias" + (onde ? " " + onde : "") },
      { valor: base.length, rotulo: (base.length === 1 ? "membro" : "membros") + (onde ? " " + onde : " na equipe") },
    ];
    let linksFaixa = '<a href="#/painel">Ver o que depende de você →</a>';
    if (links.manual) linksFaixa += '<a href="' + esc(links.manual) + '" target="_blank" rel="noopener">' + icone("manual", 14) + " Manual da liderança</a>";
    linksFaixa += '<a href="#" data-acao="abrir-tour">Rever o tour</a>';
    let h = faixa(saudacao(), "Gestão de Pessoas", numeros, linksFaixa);

    if (E().visao === "coordenacao") h += atalhosCoordenacao();
    if (E().visao === "rh") h += atalhosRH();
    h += proximos14();
    h += '<div class="card"><div class="destinos">' +
      destino("equipe", "equipe", "Minha equipe", "Card de cada membro, com o histórico") +
      destino("recrutamento", "recrutamento", "Recrutamento", "Solicitar vaga e acompanhar") +
      destino("onboarding", "onboarding", "Onboarding", "Embarcação: os primeiros 90 dias") +
      destino("rotinas", "rotinas", "Rotinas", "1:1 do trimestre e feedbacks SCI") +
      destino("desempenho", "desempenho", "Desempenho", "Entregas, evidências e o ano") +
      destino("offboarding", "offboarding", "Offboarding", "Planos e encerramentos de contrato") +
      '<div class="sep">Para consultar</div>' +
      destino("agenda", "agenda", "Agenda", "Ausências, aniversários e feriados") +
      (links.manual ? '<a href="' + esc(links.manual) + '" target="_blank" rel="noopener"><span class="ic">' + icone("manual", 18) + '</span><span><span class="t">Manual</span><br><span class="d">Manual da liderança</span></span></a>'
        : destino("perfil", "manual", "Manual", "Link a cadastrar pelo RH")) +
      destino("perfil", "perfil", "Perfil", "Seus dados e preferências") +
      "</div></div>";
    return h;
  };
  function destino(rota, ic, t, d) {
    return '<a href="#/' + rota + '"><span class="ic">' + icone(ic, 18) + '</span><span><span class="t">' + esc(t) + '</span><br><span class="d">' + esc(d) + "</span></span></a>";
  }
  function proximos14() {
    const ctx = E().ctx;
    const pessoas = ui.minhaEquipe().map((m) => dom.infoMembro(ctx, m));
    const ag = dom.agendaEquipe(ctx, pessoas, { inicio: ctx.hoje, semanas: 2 });
    const itens = [];
    ag.proximos14.fora.forEach((f) => itens.push(esc(primeiroNome(f.pessoa.nome)) + " fora até " + calc.fmtData(f.ate) + ", volta " + calc.fmtData(f.volta)));
    ag.aniversarios.forEach((a) => itens.push("🎂 " + esc(primeiroNome(a.pessoa.nome)) + " · " + calc.fmtDiaSemana(a.data) + ", " + calc.fmtData(a.data)));
    ag.proximos14.feriados.forEach((f) => itens.push("Feriado " + calc.fmtData(f.data) + (f.nome && f.nome !== "Feriado" ? " · " + esc(f.nome) : "")));
    if (!itens.length) return "";
    return '<div class="card" style="margin-bottom:16px;padding:14px 20px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px">' +
      '<b style="color:var(--navy)">' + icone("agenda", 15) + " Próximos 14 dias</b>" + itens.map((t) => '<span class="tag cinza">' + t + "</span>").join("") +
      '<a href="#/agenda" style="margin-left:auto">Agenda da equipe →</a></div></div>';
  }
  function atalhosCoordenacao() {
    const ctx = E().ctx, uid = E().eu.id;
    const aprov = dom.aprovacoesPendentes(ctx, uid);
    const mapa = dom.mapaCoordenacao(ctx, uid);
    const atrasos = mapa.reduce((s, l) => s + l.atrasos.length, 0);
    const atencao = mapa.filter((l) => l.ind.situacao.chave !== "em-dia");
    const at = (n, rot, rota, alerta) => '<a class="card" href="' + rota + '" style="display:block;text-decoration:none;' + (alerta ? "border-left:4px solid var(--ambar)" : "") + '"><div style="font-size:24px;font-weight:800;color:var(--navy)" class="num">' + n + '</div><div class="muted">' + rot + "</div></a>";
    return '<div class="grade c3" style="margin-bottom:16px">' +
      at(aprov.length, "aprovações aguardando você", "#/offboarding", aprov.some((a) => a.dias > 3)) +
      at(atrasos, "itens atrasados nas outras equipes", "#/painel/setor", atrasos > 0) +
      at(atencao.length, atencao.length === 1 ? "liderança em Atenção ou Precisa de apoio" : "lideranças em Atenção ou Precisa de apoio", "#/painel/setor", atencao.length > 0) + "</div>";
  }
  function atalhosRH() {
    const fila = dom.filaRH(E().ctx);
    if (!fila.length) return "";
    return '<div class="card acao" style="margin-bottom:16px"><h3>' + icone("alerta", 16) + " " + plural(fila.length, "solicitação aguarda o RH", "solicitações aguardam o RH") +
      '<a class="extra" href="#/painel">Abrir a fila do RH →</a></h3></div>';
  }
  function inicioCEO() {
    const g = geral();
    return faixa(saudacao(), "Visão geral", [
      { valor: g.ind.um1a1.curto, rotulo: "1:1 do trimestre agendados" },
      { valor: g.areasEmDia.texto.split(" · ")[1] || g.areasEmDia.texto, rotulo: "áreas em dia" },
      { valor: g.ind.atrasadas, rotulo: "itens atrasados", alerta: g.ind.atrasadas > 0 },
    ], '<a href="#/painel">Abrir o painel geral →</a>') +
      '<div class="aviso-info">Esta visão mostra números, prazos e situação das equipes. O conteúdo escrito dos registros (feedbacks, leituras, planos e motivos) não aparece aqui.</div>';
  }

  /* ================================================================ PAINEL */
  ui.rotas.painel = function (partes) {
    const v = E().visao;
    if (v === "ceo") return painelGeral(false, partes[0]);
    if (v === "rh") return painelGeral(true, partes[0]);
    if (v === "coordenacao") {
      // Coordenação sem equipe direta abre direto em "Meu setor"
      const aba = partes[0] === "setor" || (!partes[0] && !ui.minhaEquipe().length) ? "setor" : "equipe";
      const abas = c.abas([{ chave: "equipe", rotulo: "Minha equipe", rota: "#/painel" }, { chave: "setor", rotulo: "Meu setor", rota: "#/painel/setor" }], aba);
      return aba === "setor" ? painelSetor(abas) : painelLideranca(abas);
    }
    return painelLideranca("");
  };

  function painelLideranca(abas) {
    const ctx = E().ctx;
    const equipe = ui.minhaEquipe();
    const ind = dom.indicadoresEquipe(ctx, equipe, { uid: E().eu.id });
    const h0 = faixa("Painel da sua equipe", ctx.tri.rotulo, [
      { valor: ind.atrasadas, rotulo: "atrasadas", alerta: ind.atrasadas > 0 },
      { valor: ind.rotinas.curto, rotulo: "rotinas no prazo" },
      { valor: ind.situacao.rotulo, rotulo: "situação da equipe" },
    ]);
    const lista = ind.pendencias;
    const pendHtml = lista.length ? '<div class="lista">' + lista.map((p) => c.pendencia(p)).join("") + "</div>" : '<div class="vazio">✓ Tudo em dia nesta semana.</div>';
    const conq = ind.conquistas;
    const dicas = dom.dicas(ctx, equipe, { uid: E().eu.id, dispensadas: E().dispensadas });
    const nomesFaltam = (lista2) => lista2.map((m) => esc(primeiroNome(dom.infoMembro(ctx, m).nome))).join(", ");
    const fb = ind.feedback90;
    const rotinas = '<div class="card"><h3>Rotinas do trimestre<span class="extra muted">' + esc(ctx.tri.rotulo) + "</span></h3>" +
      c.barra({ rotulo: "1:1 do trimestre agendados", r: ind.um1a1, meta: 100, atraso: ind.um1a1.faltam.some((m) => dom.statusCiclo(ctx, dom.cicloDo(ctx, m.id, ctx.tri.chave)).cor === "vermelho"), nota: ind.um1a1.faltam.length ? "Falta: " + nomesFaltam(ind.um1a1.faltam) : (ind.um1a1.d ? "Todos agendados." : "") }) +
      c.barra({ rotulo: "Evidências do " + ctx.triAnterior.curto + " registradas", r: ind.evidencias, nota: ind.evidencias.faltam.length ? "Falta: " + nomesFaltam(ind.evidencias.faltam) + " · prazo " + calc.fmtData(calc.prazoEvidencias(ctx.triAnterior)) : "" }) +
      c.barra({ rotulo: "Membros com feedback nos últimos 90 dias", r: fb, meta: 90, nota: fb.faltam.length ? "Sem feedback: " + nomesFaltam(fb.faltam) : (fb.maisAntigo ? "O mais antigo é de " + esc(primeiroNome(dom.infoMembro(ctx, fb.maisAntigo.membro).nome)) + ", " + calc.fmtData(fb.maisAntigo.data) : "") }) +
      c.barra({ rotulo: "Etapas do onboarding no prazo", r: ind.onboarding }) +
      '<div class="barra-nota" style="margin-top:14px">Equilíbrio dos feedbacks em 90 dias (reconhecimento : desenvolvimento): ' + c.tag(ind.equilibrio.texto, ind.equilibrio.cor) + "</div></div>";
    return abas + h0 + (dicas.length ? dicaHtml(dicas) : "") +
      '<div class="grade lado"><div><div class="card"><h3>O que depende de você<span class="extra muted">' + plural(lista.length, "item", "itens") + "</span></h3>" + pendHtml + "</div>" + rotinas + "</div>" +
      '<div><div class="card"><h3>Conquistas recentes<span class="extra muted">últimos 30 dias</span></h3>' +
      (conq.length ? '<div class="lista">' + conq.slice(0, 8).map((x) => '<div class="item"><span class="ponto verde"></span><div class="principal-item"><div>' + esc(x.texto) + '</div><div class="d">' + calc.fmtData(x.data) + "</div></div></div>").join("") + "</div>" : c.vazio("Nenhuma ainda neste período.")) +
      "</div>" + calendarioAno(equipe) + "</div></div>";
  }

  function dicaHtml(dicas) {
    const d = dicas[0];
    const outras = dicas.slice(1, 4);
    return '<div class="card dica" style="margin-bottom:16px"><div class="marca-amora">' + icone("amora", 16) + " Dica da semana · Amora</div>" +
      '<div class="titulo-dica">' + esc(d.titulo) + "</div><div>" + esc(d.texto) + '</div><div class="ref">Referência: ' + esc(d.referencia) + "</div>" +
      '<div class="acoes-dica"><a class="btn peq" href="' + esc(d.acao.rota) + '">' + esc(d.acao.rotulo) + '</a><button class="btn link" data-acao="dispensar-dica" data-id="' + esc(d.id) + '">Não foi útil</button></div>' +
      "<details><summary>Por que estou vendo isso?</summary>" + esc(d.porque) + " A dica usa só datas, tipos e situações, nunca o texto dos registros.</details>" +
      (outras.length ? '<details><summary>Outras sugestões (' + outras.length + ")</summary>" + outras.map((o) => '<div style="margin-top:8px"><a href="' + esc(o.acao.rota) + '"><b>' + esc(o.titulo) + "</b></a><br>" + esc(o.texto) + "</div>").join("") + "</details>" : "") + "</div>";
  }
  ui.acoes["dispensar-dica"] = function (el) {
    // "Não foi útil" esconde aquela dica por 30 dias (4.7)
    E().dispensadas[el.dataset.id] = calc.addDias(E().ctx.hoje, 30);
    try { localStorage.setItem("gp_dicas_" + E().eu.id, JSON.stringify(E().dispensadas)); } catch (e) { /* sem storage */ }
    ui.avisar("Dica escondida por 30 dias. Obrigado pelo retorno.");
    ui.render();
  };

  /** Calendário do ano (4.4): marcos fixos do ciclo + datas da equipe, próximos 3 meses */
  function calendarioAno(equipe) {
    const ctx = E().ctx;
    const fim = calc.addDias(ctx.hoje, 92);
    const ev = [];
    const ano = Number(ctx.hoje.slice(0, 4));
    [ano, ano + 1].forEach((a) => [1, 2, 3, 4].forEach((t) => {
      const tri = calc.trimestre(a, t);
      ev.push({ data: tri.inicio, texto: "Abertura do " + tri.curto, fixo: true });
      ev.push({ data: calc.prazoEvidencias(tri), texto: "Prazo das evidências do " + tri.curto, fixo: true });
    }));
    [ano, ano + 1].forEach((a) => {
      ev.push({ data: a + "-11-01", texto: "Autoavaliação anual enviada aos membros", fixo: true });
      ev.push({ data: a + "-12-09", texto: "Calibração da avaliação anual", fixo: true });
      ev.push({ data: a + "-12-18", texto: "Devolutiva da avaliação anual (até)", fixo: true });
    });
    equipe.forEach((m0) => {
      const m = dom.infoMembro(ctx, m0);
      const cic = dom.cicloDo(ctx, m.id, ctx.tri.chave);
      if (cic && cic.data1a1 && !cic.realizadoEm) ev.push({ data: cic.data1a1, texto: "1:1 de " + primeiroNome(m.nome) });
      const ob = dom.onboardingDo(ctx, m.id);
      if (ob && ["SUCCESS", "FAIL"].indexOf(ob.estagio) < 0) dom.statusOnboarding(ctx, ob).alinhamentos.filter((a) => !a.registrado).forEach((a) => ev.push({ data: a.data, texto: a.rotulo + " de " + primeiroNome(m.nome) }));
      const p = dom.planoAtivoDo(ctx, m.id);
      if (p) ev.push({ data: dom.statusPlano(ctx, p).termino, texto: "Fim do plano de " + primeiroNome(m.nome) });
    });
    const lista = ev.filter((e) => e.data >= ctx.hoje && e.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
    return '<div class="card"><h3>' + icone("calendario", 16) + " Próximas datas do ciclo</h3>" + (lista.length ? '<div class="lista">' + lista.slice(0, 10).map((e) =>
      '<div class="item"><span class="num" style="width:44px;font-weight:700;color:var(--navy)">' + calc.fmtData(e.data) + '</span><div class="principal-item">' + (e.fixo ? "<b>" + esc(e.texto) + "</b>" : esc(e.texto)) + "</div></div>").join("") + "</div>" : c.vazio("Nada nos próximos 3 meses.")) + "</div>";
  }

  /* ---------------- coordenação: meu setor ---------------- */
  function corDe(r, meta) { if (r.valor === null) return "cinza"; if (r.valor >= (meta || 85)) return "verde"; if (r.valor >= 60) return "ambar"; return "vermelho"; }
  function painelSetor(abas) {
    const ctx = E().ctx, uid = E().eu.id;
    const mapa = dom.mapaCoordenacao(ctx, uid);
    const aprov = dom.aprovacoesPendentes(ctx, uid);
    const perto = mapa.reduce((acc, l) => acc.concat(l.atrasos.filter((a) => a.atrasoDias >= 7 && a.atrasoDias <= 13)), []);
    const planos = mapa.reduce((acc, l) => acc.concat(l.equipe.map((m) => dom.planoAtivoDo(ctx, m.id)).filter(Boolean)), []);
    const cartao = (t, n, nota, alerta, rota) => '<a class="card" href="' + rota + '" style="display:block;text-decoration:none;color:inherit;' + (alerta ? "border-left:4px solid var(--ambar)" : "") + '"><div class="muted" style="font-size:12px">' + t + '</div><div class="num" style="font-size:26px;font-weight:800;color:var(--navy)">' + n + '</div><div class="muted" style="font-size:12px">' + nota + "</div></a>";
    const membrosSetor = mapa.reduce((n, l) => n + l.tamanho, 0);
    const atrasosSetor = mapa.reduce((n, l) => n + l.atrasos.length, 0);
    const emDia = mapa.filter((l) => l.ind.situacao.chave === "em-dia").length;
    let h = abas + faixa("Meu setor", "Lideranças do seu departamento", [
      { valor: mapa.length, rotulo: mapa.length === 1 ? "liderança" : "lideranças" },
      { valor: membrosSetor, rotulo: "membros no setor" },
      { valor: atrasosSetor, rotulo: atrasosSetor === 1 ? "item atrasado" : "itens atrasados", alerta: atrasosSetor > 0 },
      { valor: emDia + " de " + mapa.length, rotulo: "equipes em dia" },
    ]) +
      '<div class="grade c3" style="margin-bottom:16px">' +
      cartao("Suas aprovações", aprov.length, aprov.length ? "a mais antiga há " + Math.max.apply(null, aprov.map((a) => a.dias)) + " dias (prazo de 3)" : "nenhuma aguardando", aprov.some((a) => a.dias > 3), "#/offboarding") +
      cartao("Perto do aviso de 14 dias", perto.length, perto.length ? "aviso a partir de " + calc.fmtData(perto.map((p) => p.avisoCoordenacao).sort()[0]) : "nenhum item com 7 a 13 dias de atraso", perto.length > 0, "#/painel/setor") +
      cartao("Planos de alinhamento", planos.length, planos.length ? "em andamento no setor" : "nenhum em andamento", false, "#/offboarding") + "</div>";
    h += '<div class="card"><h3>Lideranças do setor<span class="extra muted">ordem alfabética, sem ranking</span></h3><div class="tabela-wrap"><table class="tabela"><thead><tr>' +
      "<th>Liderança</th><th class='n'>Equipe</th><th>1:1 do tri</th><th>Evidências</th><th>Feedback 90 dias</th><th>Onboarding</th><th class='n'>Atrasadas</th><th>Reconhec. : desenv.</th><th>Situação</th></tr></thead><tbody>" +
      mapa.map((l) => {
        const i = l.ind;
        const cel = (r, meta) => '<span class="calor ' + corDe(r, meta) + '" title="' + esc(r.texto) + '">' + esc(r.valor === null ? "sem dado" : r.curto + " · " + r.n + "/" + r.d) + "</span>";
        return '<tr class="clicavel" data-rota="#/equipe/lideranca/' + esc(l.lideranca.id) + '"><td>' + c.pessoa(l.lideranca, "", 28) + '</td><td class="n">' + l.tamanho + "</td>" +
          "<td>" + cel(i.um1a1, 100) + "</td><td>" + cel(i.evidencias) + "</td><td>" + cel(i.feedback90, 90) + "</td><td>" + cel(i.onboarding) + '</td><td class="n">' +
          (i.atrasadas ? '<b style="color:var(--vermelho)">' + i.atrasadas + "</b>" : "0") + "</td><td>" + c.tag(i.equilibrio.texto, i.equilibrio.cor) + "</td><td>" + c.tag(i.situacao.rotulo, i.situacao.cor) + "</td></tr>";
      }).join("") + '</tbody></table></div><div class="legenda"><span><i style="background:var(--verde-bg)"></i>em dia</span><span><i style="background:var(--ambar-bg)"></i>atenção</span><span><i style="background:var(--vermelho-bg)"></i>precisa de apoio</span>' +
      "<span>O equilíbrio dos feedbacks não entra no cálculo da situação: é um sinal para a conversa de apoio.</span></div></div>";
    const comAtraso = mapa.filter((l) => l.atrasos.length);
    h += '<div class="card"><h3>Atrasos das equipes<span class="extra muted">sem o conteúdo dos registros</span></h3>' + (comAtraso.length ? comAtraso.map((l) =>
      '<div style="margin-bottom:12px"><div class="h3" style="font-size:13px;margin-bottom:4px">' + esc(l.lideranca.nome) + '</div><div class="lista">' + l.atrasos.map((a) =>
        '<div class="item"><div class="principal-item"><div class="t">' + esc(a.tipo) + (a.membro ? " · " + esc(a.membro.nome) : "") + '</div><div class="d">prazo ' + calc.fmtData(a.prazo) + " · " + a.atrasoDias + " dias de atraso</div></div>" +
        '<div class="lado"><span class="prazo' + (a.atrasoDias >= 14 ? " atrasado" : "") + '">' + (a.atrasoDias >= 14 ? "aviso de 14 dias enviado" : "aviso de 14 dias em " + calc.fmtData(a.avisoCoordenacao)) + "</span></div></div>").join("") + "</div></div>").join("") : c.vazio("Nenhum atraso nas equipes do setor.")) + "</div>";
    return h;
  }

  /* ---------------- RH e CEO: painel geral (4.4, 4.6, 4.8) ---------------- */
  function geral() {
    const ctx = E().ctx;
    const todos = dom.membrosAtivos(ctx.registros.membros || []);
    const ind = dom.indicadoresEquipe(ctx, todos, {});
    // áreas = departamentos com liderança e equipe
    const areas = (ctx.departamentos || []).filter((d) => d.chefe && dom.equipeDe(ctx, d.chefe).length).map((d) => {
      const equipe = dom.equipeDe(ctx, d.chefe);
      return { depto: d, lideranca: dom.pessoa(ctx, d.chefe), equipe, ind: dom.indicadoresEquipe(ctx, equipe, { uid: d.chefe }) };
    }).sort((a, b) => a.depto.nome.localeCompare(b.depto.nome, "pt-BR"));
    const emDia = areas.filter((a) => a.ind.situacao.chave === "em-dia").length;
    // Rotatividade: saídas (encerramentos concluídos) nos últimos 12 meses ÷ membros ativos (aproximação até existir a foto mensal)
    const ini12 = calc.addDias(ctx.hoje, -365);
    const saidas = (ctx.registros.encerramentos || []).filter((e) => e.estagio === "SUCCESS" && (e.concluidaEm || "") >= ini12);
    const aPedido = saidas.filter((e) => /pedido/i.test(e.motivoSaida || "")).length;
    const vagas = dom.vagasDe(ctx, null);
    const ini6 = calc.addDias(ctx.hoje, -182);
    const tempos = vagas.filter((v) => v.fechada && v.fechadaEm >= ini6 && v.tempoParaFechar !== null).map((v) => v.tempoParaFechar);
    return {
      todos, ind, areas, areasEmDia: calc.percentual(emDia, areas.length),
      rotatividade: calc.percentual(saidas.length, todos.length + saidas.length), saidas: saidas.length, aPedido, decisao: saidas.length - aPedido,
      tempoVaga: calc.mediana(tempos), vagasAbertas: vagas.filter((v) => !v.semantica).length,
      emOnboarding: todos.filter((m) => m.estagio === "NEW").length,
      encerramentosAndamento: (ctx.registros.encerramentos || []).filter((e) => ["SUCCESS", "FAIL"].indexOf(e.estagio) < 0).length,
    };
  }
  function painelGeral(rh, aba0) {
    const ctx = E().ctx;
    const g = geral();
    const aba = aba0 || (rh ? "hoje" : "indicadores");
    const lista = (rh ? [{ chave: "hoje", rotulo: "Hoje", rota: "#/painel/hoje" }] : [])
      .concat([{ chave: "indicadores", rotulo: "Indicadores", rota: "#/painel/indicadores" }, { chave: "setores", rotulo: "Setores e retenção", rota: "#/painel/setores" }])
      .concat(rh ? [{ chave: "processos", rotulo: "Processos e cadastros", rota: "#/painel/processos" }] : []);
    let h = faixa(rh ? "Painel do RH" : "Painel geral", g.todos.length + " membros · " + ctx.tri.rotulo, null, atencaoHoje(g)) + c.abas(lista, aba);
    if (aba === "hoje" && rh) h += abaHoje(g);
    else if (aba === "setores") h += abaSetores(g, rh);
    else if (aba === "processos" && rh) h += abaProcessos(g);
    else h += abaIndicadores(g, rh);
    return h;
  }
  /** "O que pede atenção hoje": até 3 frases geradas pelos dados (4.6) */
  function atencaoHoje(g) {
    const frases = [];
    const apoio = g.areas.filter((a) => a.ind.situacao.chave === "apoio").sort((a, b) => b.ind.atrasadas - a.ind.atrasadas)[0];
    if (apoio) frases.push('<a href="#/painel/setores">' + esc(apoio.depto.nome) + " precisa de apoio: " + plural(apoio.ind.atrasadas, "item atrasado", "itens atrasados") + " →</a>");
    const sem1a1 = g.ind.um1a1.d - g.ind.um1a1.n;
    if (sem1a1 > 0) frases.push('<a href="#/painel/indicadores">' + plural(sem1a1, "membro ainda sem 1:1 agendado", "membros ainda sem 1:1 agendado") + " no " + E().ctx.tri.curto + " →</a>");
    const prazoEvid = calc.prazoEvidencias(E().ctx.triAnterior);
    if (prazoEvid >= E().ctx.hoje) frases.push('<a href="#/painel/indicadores">Próximo prazo do ciclo: evidências do ' + E().ctx.triAnterior.curto + " até " + calc.fmtData(prazoEvid) + " →</a>");
    return frases.slice(0, 3).join("");
  }
  function cartaoIndicador(rotulo, valor, contexto, meta) {
    return '<div class="card"><div class="muted" style="font-size:12px;font-weight:600">' + esc(rotulo) + '</div><div class="num" style="font-size:28px;font-weight:800;color:var(--navy);line-height:1.2">' + esc(valor) +
      '</div><div class="muted" style="font-size:12px">' + contexto + "</div>" + (meta ? '<div class="suave" style="font-size:11.5px;margin-top:6px">Meta: ' + esc(meta) + "</div>" : "") +
      '<div class="suave" style="font-size:11px;margin-top:6px">Comparação com o trimestre anterior: sem histórico ainda.</div></div>';
  }
  function abaIndicadores(g, rh) {
    const i = g.ind;
    const cartoes = rh ? [
      cartaoIndicador("1:1 do trimestre agendados", i.um1a1.curto, esc(i.um1a1.texto), "100%"),
      cartaoIndicador("Feedback nos últimos 90 dias", i.feedback90.curto, esc(i.feedback90.texto), "90%"),
      cartaoIndicador("Pendências atrasadas", String(i.atrasadas), "tarefas, não pessoas"),
      cartaoIndicador("Áreas em dia", g.areasEmDia.curto, esc(g.areasEmDia.texto)),
    ] : [
      cartaoIndicador("1:1 do trimestre agendados", i.um1a1.curto, esc(i.um1a1.texto), "100%"),
      cartaoIndicador("Áreas em dia", g.areasEmDia.curto, esc(g.areasEmDia.texto)),
      cartaoIndicador("Rotatividade (12 meses)", g.rotatividade.curto, g.saidas + " saídas · " + g.aPedido + " a pedido do membro, " + g.decisao + " por decisão da empresa"),
      cartaoIndicador("Tempo para preencher vaga", g.tempoVaga === null ? "sem dado" : Math.round(g.tempoVaga) + " dias", "mediana das vagas fechadas nos últimos 6 meses"),
    ];
    let h = '<div class="grade c4">' + cartoes.join("") + "</div>";
    h += '<div class="card" style="margin-top:16px"><h3>Fluxos hoje</h3><div class="grade c4">' +
      [["Itens atrasados", i.atrasadas], ["Vagas abertas", g.vagasAbertas], ["Pessoas em onboarding", g.emOnboarding], ["Encerramentos em andamento", g.encerramentosAndamento]]
        .map((x) => '<div><div class="num" style="font-size:22px;font-weight:800;color:var(--navy)">' + x[1] + '</div><div class="muted" style="font-size:12px">' + x[0] + "</div></div>").join("") + "</div></div>";
    return h;
  }
  function abaSetores(g, rh) {
    return '<div class="card"><h3>Setores e áreas<span class="extra muted">ordem alfabética</span></h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Área</th><th>Liderança</th><th class="n">Membros</th><th>1:1 do tri</th><th>Feedback 90 dias</th><th class="n">Atrasadas</th><th>Situação</th></tr></thead><tbody>' +
      g.areas.map((a) => "<tr" + (rh ? ' class="clicavel" data-rota="#/equipe/lideranca/' + esc(a.lideranca.id) + '"' : "") + "><td><b>" + esc(a.depto.nome) + "</b></td><td>" + esc(a.lideranca.nome) + '</td><td class="n">' + a.equipe.length +
        '</td><td class="num">' + esc(a.ind.um1a1.texto) + '</td><td class="num">' + esc(a.ind.feedback90.texto) + '</td><td class="n">' + a.ind.atrasadas + "</td><td>" + c.tag(a.ind.situacao.rotulo, a.ind.situacao.cor) + "</td></tr>").join("") +
      "</tbody></table></div></div>" +
      '<div class="card"><h3>Membros por liderança<span class="extra muted">faixa de referência 3 a 7 (a definir pelo RH)</span></h3>' +
      g.areas.map((a) => { const n = a.equipe.length; const fora = n < 3 || n > 7; return '<div class="barra-bloco"><div class="barra-topo"><span class="rot">' + esc(a.lideranca.nome) + '</span><span class="val' + (fora ? " suave" : "") + '">' + n + "</span></div><div class=\"barra\"><div class=\"preench\" style=\"width:" + Math.min(100, n * 10) + '%"></div></div></div>'; }).join("") + "</div>";
  }
  function abaHoje(g) {
    const ctx = E().ctx;
    const fila = dom.filaRH(ctx);
    let h = '<div class="card"><h3>Fila do RH<span class="extra muted">' + plural(fila.length, "item", "itens") + "</span></h3>" + (fila.length ? '<div class="lista">' + fila.map((f) =>
      '<div class="item clicavel" data-rota="#/offboarding/encerramento/' + esc(f.item.id) + '">' + (f.membro ? c.avatar(f.membro, 30) : "") + '<div class="principal-item"><div class="t">Encerramento de contrato · ' + esc(f.membro ? f.membro.nome : "") + '</div><div class="d">' + esc(f.item.motivo || "") + "</div></div>" +
      '<div class="lado">' + c.tag(f.item.estagioNome, f.item.estagio === "BLOQUEADA" ? "vermelho" : "azul") + "</div></div>").join("") + "</div>" : c.vazio("Nada aguardando o RH.")) + "</div>";
    h += '<div class="card"><h3>Pendências atrasadas por liderança</h3>' + (g.areas.filter((a) => a.ind.atrasadas).length ? '<div class="lista">' + g.areas.filter((a) => a.ind.atrasadas).map((a) =>
      '<div class="item clicavel" data-rota="#/equipe/lideranca/' + esc(a.lideranca.id) + '">' + c.avatar(a.lideranca, 30) + '<div class="principal-item"><div class="t">' + esc(a.lideranca.nome) + '</div><div class="d">' + esc(a.ind.pendencias.filter((p) => p.atrasado).map((p) => p.titulo).slice(0, 3).join(" · ")) + '</div></div><div class="lado"><b style="color:var(--vermelho)">' + a.ind.atrasadas + "</b></div></div>").join("") + "</div>" : c.vazio("Nenhuma pendência atrasada.")) + "</div>";
    return h + dadosFaltando();
  }
  /** Lista de "dados faltando" (5.3), para correção semanal */
  function dadosFaltando() {
    const ctx = E().ctx;
    const falta = [];
    (ctx.registros.membros || []).filter((m) => ["SUCCESS", "FAIL"].indexOf(m.estagio) < 0).forEach((m0) => {
      const m = dom.infoMembro(ctx, m0);
      const f = [];
      if (!m.lideranca) f.push("liderança direta"); if (!m.coordenacao) f.push("coordenação");
      if (!m.ingresso) f.push("data de ingresso"); if (!m.senioridade) f.push("senioridade"); if (!m.nivel) f.push("nível");
      if (!m.foto) f.push("foto"); if (!dom.pessoa(ctx, m.responsavel).aniversario) f.push("data de nascimento");
      if (f.length) falta.push({ m, f });
    });
    const membrosIds = {};
    (ctx.registros.membros || []).forEach((m) => { membrosIds[m.responsavel] = true; });
    const papeis = (ctx.config && ctx.config.papeis) || {};
    const ceo = {};
    (papeis.ceo || []).forEach((p) => { ceo[p.id] = true; });
    (papeis.excecoes || []).forEach((p) => { ceo[p.id] = true; });
    const semItem = (ctx.usuarios || []).filter((u) => !membrosIds[u.id] && !ceo[u.id] && (u.departamentos || []).length);
    return '<div class="card"><h3>Dados faltando<span class="extra muted">para corrigir toda semana</span></h3>' +
      (semItem.length ? '<div class="aviso-atencao" style="margin-bottom:10px">' + plural(semItem.length, "usuário ativo sem item", "usuários ativos sem item") + " no processo Membros: " + esc(semItem.slice(0, 8).map((u) => u.nome).join(", ")) + (semItem.length > 8 ? "…" : "") + "</div>" : "") +
      (falta.length ? '<div class="lista">' + falta.map((x) => '<div class="item clicavel" data-rota="#/membro/' + esc(x.m.id) + '">' + c.avatar(x.m, 28) + '<div class="principal-item"><div class="t">' + esc(x.m.nome) + '</div><div class="d">Falta: ' + esc(x.f.join(", ")) + "</div></div></div>").join("") + "</div>" : c.vazio("Nenhum dado faltando nos itens Membros.")) + "</div>";
  }
  function abaProcessos(g) {
    const ctx = E().ctx;
    const enc = ctx.registros.encerramentos || [];
    const porEstagio = GP.schema.processo("encerramentos").estagios.map((e) => ({ e, n: enc.filter((x) => x.estagio === e.codigo).length }));
    const passaram = enc.filter((x) => x.primeiraVerificacao === "Bloqueada na 1ª verificação").length;
    const aceitas = enc.filter((x) => x.primeiraVerificacao === "Aceita na 1ª verificação" && x.motivo !== dom.MOTIVO_GRAVE).length;
    const total1 = enc.filter((x) => x.primeiraVerificacao && x.motivo !== dom.MOTIVO_GRAVE).length;
    const semCiclo = dom.membrosAtivos(ctx.registros.membros || []).filter((m) => m.estagio === "ATIVO" && !dom.cicloDo(ctx, m.id, ctx.tri.chave));
    return '<div class="card acao"><h3>Ciclo trimestral do ' + esc(ctx.tri.rotulo) + '</h3><p class="muted" style="margin-top:0">No primeiro dia útil de cada trimestre, o RH cria um item do Ciclo para cada membro no estágio Ativo (3.3). A criação do item é o aviso de início do trimestre. Membros em onboarding entram no trimestre seguinte ao Dia 90.</p>' +
      (semCiclo.length ? '<p><b>' + plural(semCiclo.length, "membro ativo ainda sem item", "membros ativos ainda sem item") + "</b>: " + esc(semCiclo.map((m) => dom.infoMembro(ctx, m).nome).join(", ")) + '.</p><button class="btn" data-acao="abrir-trimestre">Abrir o ' + esc(ctx.tri.curto) + " para " + plural(semCiclo.length, "membro", "membros") + "</button>"
        : '<p class="muted">✓ Todos os membros ativos já têm o item do ' + esc(ctx.tri.curto) + ".</p>") + "</div>" +
      '<div class="card"><h3>Encerramentos de contrato por etapa</h3><div class="grade c4">' + porEstagio.map((p) =>
      '<div><div class="num" style="font-size:20px;font-weight:800;color:var(--navy)">' + p.n + '</div><div class="muted" style="font-size:12px">' + esc(p.e.nome) + "</div></div>").join("") + "</div>" +
      '<p class="muted" style="margin-top:14px">Completos na 1ª verificação: <b>' + esc(calc.percentual(aceitas, total1).texto) + "</b> · passaram por \"Bloqueada\": <b>" + passaram + "</b></p></div>" +
      '<div class="card"><h3>Cadastros que o RH mantém</h3><div class="lista">' +
      '<div class="item"><div class="principal-item"><div class="t">Itens do processo Membros</div><div class="d">' + (ctx.registros.membros || []).length + " itens · criados pelo RH no ingresso</div></div></div>" +
      '<div class="item"><div class="principal-item"><div class="t">Planejamento da função</div><div class="d">' + (ctx.registros.planejamento || []).length + " funções com planejamento</div></div></div>" +
      '<div class="item"><div class="principal-item"><div class="t">Feriados de SP e Salvador, níveis, links e papéis</div><div class="d">Em <a href="#/config">Configuração</a> (administrador do Bitrix)</div></div></div></div></div>';
  }

  /** Importação em lote do Ciclo trimestral (3.3 e 6.2), pelo app em vez da planilha */
  ui.acoes["abrir-trimestre"] = function (el) {
    const ctx = E().ctx;
    const t = ctx.tri;
    const lista = dom.membrosAtivos(ctx.registros.membros || []).filter((m) => m.estagio === "ATIVO" && !dom.cicloDo(ctx, m.id, t.chave));
    if (!lista.length || !window.confirm("Criar o item do Ciclo do " + t.rotulo + " para " + plural(lista.length, "membro", "membros") + "? As lideranças são avisadas pela criação do item.")) return;
    ui.salvar(el, async () => {
      for (const m0 of lista) {
        const m = dom.infoMembro(ctx, m0);
        await ui.criar("ciclo", {
          titulo: m.nome + " · " + t.chave, membroId: m.id, responsavel: m.responsavel, trimestre: t.chave,
          fimTrimestre: t.fim, prazoEvidencias: calc.prazoEvidencias(t), estagio: "NEW",
        });
      }
    }, { mensagem: plural(lista.length, "item criado", "itens criados") + " no Ciclo do " + t.curto + ".", fechar: false, rotuloOcupado: "Criando…" });
  };

  /* ================================================================ PERFIL */
  ui.rotas.perfil = function () {
    const ctx = E().ctx, eu = E().eu;
    const p = dom.papeis(ctx, eu.id);
    const papeisTxt = [p.ceo && "CEO", p.rh && "RH", p.coordenacao && "Coordenação", p.lideranca && "Liderança"].filter(Boolean).join(", ") || "sem papel no app";
    const deptos = p.chefia.map((d) => (ctx.idx.depto[d] || {}).nome).filter(Boolean);
    return c.cabecalho("perfil", "Perfil", "") +
      '<div class="card"><div class="ficha-topo">' + c.avatar(eu, 64) + '<div class="info"><div class="nome-grande">' + esc(eu.nome) + '</div><div class="muted">' + esc(eu.email) + "</div></div></div>" +
      c.dados([["Papel no app", papeisTxt], ["Departamentos que chefia", deptos.join(", ") || "nenhum"], ["Membros na equipe direta", String(dom.equipeDe(ctx, eu.id).length)]]) + "</div>" +
      '<div class="card"><h3>' + icone("amora", 16) + " Perfil da liderança para a Amora</h3>" +
      '<p class="muted">O formulário de cerca de 3 minutos (trajetória, contexto da equipe, desafios e preferências) entra quando o RH liberar o assistente de IA (especificação 4.7). Só você e o RH verão o perfil, e ele nunca serve para avaliar.</p>' +
      "<p class=\"muted\">Hoje, as dicas da semana do Painel são as dicas-modelo da primeira fase: usam só datas, tipos e situações da sua equipe.</p></div>";
  };

  /* ================================================================ TOUR (3 passos, uma vez por pessoa) */
  const PASSOS = [
    { t: "O Início mostra o seu dia", d: "Os números do dia, a faixa dos próximos 14 dias e um caminho para cada módulo.", ic: "inicio" },
    { t: "O Painel mostra o que fazer", d: "O que depende de você, com os atrasados primeiro, e as rotinas do trimestre da equipe.", ic: "painel" },
    { t: "O card do membro guarda o histórico", d: "Feedbacks, 1:1, evidências, planos e onboarding de cada pessoa, com data e autor.", ic: "equipe" },
  ];
  ui.renderTour = function () {
    const n = E().tourPasso;
    const el = document.getElementById("tour");
    if (n === null) { el.innerHTML = ""; return; }
    const p = PASSOS[n];
    el.innerHTML = '<div class="tour" role="dialog" aria-modal="true" aria-label="Tour"><div class="caixa"><div class="desenho">' + icone(p.ic, 64) + '</div><div class="passo">Passo ' + (n + 1) + " de 3</div><h2>" + esc(p.t) + '</h2><div class="muted">' + esc(p.d) + "</div>" +
      '<div class="botoes"><button class="btn link pular" data-acao="tour-pular">Pular</button>' + (n > 0 ? '<button class="btn sec" data-acao="tour-voltar">Voltar</button>' : "") +
      '<button class="btn" data-acao="tour-proximo">' + (n === 2 ? "Ir para o Painel" : "Próximo") + "</button></div></div></div>";
  };
  function fimTour(irPainel) {
    E().tourPasso = null;
    GP.app.marcarTourVisto();
    ui.renderTour();
    if (irPainel) ui.navegar("#/painel");
  }
  ui.acoes["abrir-tour"] = function () { E().tourPasso = 0; ui.renderTour(); };
  ui.acoes["tour-pular"] = function () { fimTour(false); };
  ui.acoes["tour-voltar"] = function () { E().tourPasso = Math.max(0, E().tourPasso - 1); ui.renderTour(); };
  ui.acoes["tour-proximo"] = function () { if (E().tourPasso >= 2) fimTour(true); else { E().tourPasso++; ui.renderTour(); } };

  GP.telas = GP.telas || {};
  GP.telas.inicio = { faixa, geral };
})(window);
