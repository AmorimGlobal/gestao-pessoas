/* =====================================================================================
   TELAS — Onboarding Embarcação Amorim (3.2) e Planejamento da função
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;
  const FASES = ["Preparação", "Ancoragem", "Imersão", "Mar Aberto"];
  // Registro do alinhamento move o item para a fase seguinte (3.2, robô 4)
  const PROXIMO_ESTAGIO = { 1: "IMERSAO", 2: "MAR_ABERTO", 3: "SUCCESS" };
  const ESTAGIO_POR_FASE = { "Ancoragem": "ANCORAGEM", "Imersão": "IMERSAO", "Mar Aberto": "MAR_ABERTO" };
  const COR_RESULTADO = { "Dentro do esperado": "verde", "Atenção": "ambar", "Abaixo do esperado": "vermelho" };

  function onboardingsDaVisao() {
    const ctx = E().ctx;
    return ui.membrosDaVisao().map((m) => dom.onboardingDo(ctx, m.id)).filter((o) => o && ["SUCCESS", "FAIL"].indexOf(o.estagio) < 0);
  }

  /* ================================================================ TELA ONBOARDING */
  ui.rotas.onboarding = function (partes) {
    if (partes[0] === "planejamento") return telaPlanejamentos();
    if (partes[0]) return telaOnboarding(partes[0]);
    const ctx = E().ctx;
    const obs = onboardingsDaVisao().map((o) => dom.statusOnboarding(ctx, o));
    const prox7 = obs.filter((s) => s.proximo && calc.diffDias(ctx.hoje, s.proximo.data) <= 7 && calc.diffDias(ctx.hoje, s.proximo.data) >= 0).length;
    const atrasados = obs.filter((s) => s.atrasado).length;
    const links = (E().config && E().config.links) || {};
    const numeros = "<span><b>" + obs.length + "</b> em onboarding</span><span><b>" + prox7 + "</b> alinhamento(s) nos próximos 7 dias</span>" + (atrasados ? '<span style="color:var(--vermelho)"><b>' + atrasados + "</b> atrasado(s)</span>" : "");
    let h = c.cabecalho("onboarding", "Onboarding", numeros, '<a class="btn sec" href="#/onboarding/planejamento">Planejamento da função</a>');
    h += '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b style="color:var(--navy)">Embarcação Amorim</b> · os primeiros 90 dias, em 4 fases e 3 alinhamentos (Dias 30, 60 e 90). ' +
      'A liderança é o Leme, a supervisão é a Bússola, o colega é o Mapa e RH e TI são o Porto.</div>' +
      (links.guiaOnboarding ? '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(links.guiaOnboarding) + '">' + icone("manual", 15) + " Guia do programa</a>" : '<span class="muted" style="font-size:12px">Guia do programa: link a cadastrar na Base de Conhecimento</span>') + "</div></div>";
    h += '<div class="grade c4">' + FASES.map((fase) => {
      const daFase = obs.filter((s) => s.fase === fase);
      return '<div class="card" style="padding:16px"><h3 style="font-size:13.5px">' + esc(fase) + '<span class="extra muted">' + daFase.length + "</span></h3>" +
        (daFase.length ? daFase.map((s) => {
          const m = dom.infoMembro(ctx, s.membro);
          const marco = !s.fichaOk ? "Ficha até " + calc.fmtData(s.prazoFicha) : s.proximo ? s.proximo.rotulo + " · " + calc.fmtData(s.proximo.data) : "";
          return '<div class="item clicavel" data-rota="#/onboarding/' + esc(s.item.id) + '" style="display:block;padding:10px;border:1px solid var(--divisor);border-radius:10px;margin-bottom:8px' + (s.atrasado ? ";border-left:4px solid var(--vermelho)" : "") + '">' +
            c.pessoa(m, s.dia > 0 ? "Dia " + s.dia + " de 90" : "começa em " + calc.fmtData(s.ingresso), 30) +
            '<div style="font-size:12px;margin-top:6px" class="' + (s.atrasado ? "" : "muted") + '">' + (s.atrasado ? '<b style="color:var(--vermelho)">✕ atrasado</b> · ' : "") + esc(marco) + "</div></div>";
        }).join("") : '<div class="muted" style="font-size:12px">Ninguém nesta fase.</div>') + "</div>";
    }).join("") + "</div>";
    return h;
  };

  /* ================================================================ DETALHE */
  function resumoHtml(o, compacto) {
    const ctx = E().ctx;
    const s = dom.statusOnboarding(ctx, o);
    return '<div class="card"><h3>Onboarding · Dia 1 em ' + calc.fmtDataAno(s.ingresso) + '<span class="extra">' + c.tag(s.fase, o.estagio === "SUCCESS" ? "verde" : o.estagio === "FAIL" ? "cinza" : "azul") + "</span></h3>" +
      s.alinhamentos.map((a) => '<div style="margin-bottom:8px"><b>' + esc(a.rotulo) + "</b> · " + calc.fmtData(a.data) + " · " + (a.registrado ? "nota " + (a.nota === null ? "sem nota" : a.nota) + " · " + esc(a.resultado || "") : '<span class="muted">não registrado</span>') +
        (a.registrado && o["al" + a.numero + "Retorno"] ? '<div class="texto-registro muted" style="font-size:12.5px">' + esc(o["al" + a.numero + "Retorno"]) + "</div>" : "") + "</div>").join("") +
      (compacto ? "" : '<a href="#/onboarding/' + esc(o.id) + '">Abrir o onboarding →</a>') + "</div>";
  }
  function telaOnboarding(id) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[id];
    if (!o) return c.voltar("#/onboarding", "Onboarding") + '<div class="card">' + c.vazio("Onboarding não encontrado.") + "</div>";
    const s = dom.statusOnboarding(ctx, o);
    const m = dom.infoMembro(ctx, s.membro || {});
    const patamar = calc.PATAMAR[s.senioridade] || {};
    const ativo = ["SUCCESS", "FAIL"].indexOf(o.estagio) < 0;
    let acoes = '<button class="btn sec" data-acao="ficha" data-id="' + esc(o.id) + '">' + (s.fichaOk ? "Editar a Ficha" : "Completar a Ficha") + "</button>";
    if (o.estagio === "NEW" && s.fichaOk && s.dia >= 1) acoes += '<button class="btn" data-acao="iniciar-ancoragem" data-id="' + esc(o.id) + '">Iniciar a Ancoragem</button>';
    let h = c.voltar("#/onboarding", "Onboarding") + c.cabecalho("onboarding", "Onboarding de " + m.nome,
      "<span>" + (s.dia > 0 ? "Dia <b>" + Math.min(s.dia, 90) + "</b> de 90" : "começa em <b>" + calc.fmtDataAno(s.ingresso) + "</b>") + "</span><span>fase " + c.tag(s.fase, "azul") + "</span><span>" + esc(s.senioridade || "senioridade não informada") + "</span>", ativo ? acoes : "");
    // Linha das fases
    const idxFase = FASES.indexOf(s.fase);
    h += '<div class="card"><div class="passos">' + FASES.concat(["Concluído"]).map((f, i) => '<span class="p ' + (o.estagio === "SUCCESS" || i < idxFase ? "feito" : i === idxFase ? "atual" : "") + '">' + esc(f) + "</span>").join("") + "</div>" +
      c.dados([["Liderança (o Leme)", dom.pessoa(ctx, m.lideranca).nome], ["Supervisão (a Bússola)", o.supervisao ? dom.pessoa(ctx, o.supervisao).nome : "a definir"], ["Colega (o Mapa)", o.colega ? dom.pessoa(ctx, o.colega).nome : "a definir"],
        ["Patamar da senioridade", s.senioridade ? "Ancoragem " + patamar["Ancoragem"] + " · Imersão " + patamar["Imersão"] + " · Mar Aberto " + patamar["Mar Aberto"] : "—"], ["Revisão esperada", s.revisaoEsperada]]) + "</div>";
    // Ficha
    h += '<div class="card' + (!s.fichaOk ? " acao" + (s.fichaAtrasada ? " vermelho" : "") : "") + '"><h3>Ficha do membro<span class="extra">' + (s.fichaOk ? c.tag("Preenchida em " + calc.fmtData(o.fichaEm), "verde") : c.prazo(s.prazoFicha)) + "</span></h3>" +
      (s.fichaOk ? '<div class="sci">' + c.textoRegistro("Escopo da função", o.fichaEscopo) + c.textoRegistro("Padrões", o.fichaPadroes) + c.textoRegistro("Indicadores", o.fichaIndicadores) + "</div>"
        : '<p class="muted" style="margin-top:0">A Ficha prepara a chegada: escopo, padrões, indicadores e entregas de cada fase. ' + (o.planejamentoId ? "Já existe um planejamento da função: a Ficha vem preenchida com ele." : "") + "</p>") + "</div>";
    // Entregas planejadas
    h += '<div class="card"><h3>Entregas planejadas</h3><div class="sci">' +
      '<div><div class="k">Ancoragem · semanas 3 e 4 (planejar até o Dia 15, ' + calc.fmtData(s.prazoEntregas) + ")</div>" + (o.entregasAncoragem ? '<div class="texto-registro">' + esc(o.entregasAncoragem) + "</div>" : '<span class="muted">Ainda não planejadas.</span>') +
      (ativo && !s.entregasOk ? ' <button class="btn peq" data-acao="planejar-entregas" data-id="' + esc(o.id) + '">Planejar as 2 entregas</button>' : "") + "</div>" +
      c.textoRegistro("Imersão · de 3 a 6 entregas de casos reais", o.entregasImersao) + c.textoRegistro("Mar Aberto · escopo completo", o.entregasMarAberto) +
      '<div class="muted" style="font-size:12px">Semanas 1 e 2: só exercícios práticos, sem leitura nem nota.</div></div></div>';
    // Alinhamentos
    h += '<div class="grade c3">' + s.alinhamentos.map((a) => {
      const pode = ativo && !a.registrado && (a.numero === 1 || s.alinhamentos[a.numero - 2].registrado);
      return '<div class="card' + (a.atrasado ? " acao vermelho" : "") + '"><h3 style="font-size:13.5px">' + esc(a.rotulo) + '<span class="extra muted">Dia ' + a.dia + "</span></h3>" +
        '<div class="muted" style="font-size:12px">' + esc(a.fase) + " · " + calc.fmtDataAno(a.data) + "</div>" +
        '<div style="margin:10px 0"><span class="num" style="font-size:22px;font-weight:800;color:var(--navy)">' + (a.nota === null ? "—" : a.nota) + '</span> <span class="muted">/ patamar ' + (a.patamar === undefined ? "—" : a.patamar) + "</span></div>" +
        (a.resultado ? c.tag((a.registrado ? "" : "Prévia: ") + a.resultado, COR_RESULTADO[a.resultado]) : '<span class="muted" style="font-size:12px">' + (a.leituras.length ? "" : "sem leituras ainda") + "</span>") +
        (!a.registrado && a.nota !== null ? '<div class="muted" style="font-size:11.5px;margin-top:4px">Prévia com as leituras feitas até agora.</div>' : "") +
        '<div class="muted" style="font-size:12px;margin-top:8px">' + plural(a.leituras.length, "entrega", "entregas") + (a.pendentesLeitura ? " · " + a.pendentesLeitura + " aguardando leitura" : "") + (a.fora ? " · " + a.fora + " fora do padrão" : "") + "</div>" +
        (a.registrado ? '<div class="muted" style="font-size:12px;margin-top:6px">Registrado em ' + calc.fmtData(a.dataRegistro) + "</div>" : "") +
        (pode ? '<div style="margin-top:12px">' + (a.atrasado ? c.prazo(a.data) + "<br>" : "") + '<button class="btn peq" data-acao="registrar-alinhamento" data-id="' + esc(o.id) + '" data-n="' + a.numero + '"' + (a.pendentesLeitura ? ' disabled title="Leia as entregas da fase primeiro"' : "") + ">Registrar o alinhamento</button></div>" : "") + "</div>";
    }).join("") + "</div>";
    // Entregas da fase (leituras)
    h += '<div class="card"><h3>Entregas e leituras<span class="extra">' + (ativo && ["ANCORAGEM", "IMERSAO", "MAR_ABERTO"].indexOf(o.estagio) >= 0 ? '<button class="btn peq sec" data-acao="nova-entrega-onb" data-id="' + esc(o.id) + '">' + icone("mais", 13) + " Entrega da fase</button>" : "") + "</span></h3>" +
      (s.leituras.length ? '<div class="lista">' + s.leituras.map((l) => '<div class="item clicavel" data-rota="#/desempenho/leitura/' + esc(l.id) + '"><div class="principal-item"><div class="t">' + esc(l.titulo) + '</div><div class="d">' + esc(l.fase || "") + (l.concluidaEm ? " · concluída em " + calc.fmtData(l.concluidaEm) : "") + "</div></div>" +
        '<div class="lado">' + (l.leitura ? c.tag(l.leitura + " · " + calc.NOTA_LEITURA[l.leitura], GP.telas.desempenho.COR_LEITURA[l.leitura]) : c.tag("Aguardando leitura", "ambar") + c.prazo(l.prazoLeitura)) + "</div></div>").join("") + "</div>"
        : c.vazio("Nenhuma entrega com leitura ainda.")) + "</div>";
    if (o.continuidade) h += '<div class="card"><h3>Dia 90</h3>' + c.tag(o.continuidade, o.continuidade === "Continuidade confirmada" ? "verde" : "ambar") + "</div>";
    return h;
  }

  /* ---------------- Ficha ---------------- */
  ui.acoes["ficha"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const pl = o.planejamentoId ? ctx.idx.porId.planejamento[o.planejamentoId] : null;
    const v = (campo, campoPl) => o[campo] || (pl ? pl[campoPl] : "");
    const usuarios = (ctx.usuarios || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    const planos = (ctx.registros.planejamento || []).filter((p) => p.estagio !== "FAIL").map((p) => ({ valor: p.id, rotulo: p.funcao || p.titulo }));
    ui.abrirPainel({
      titulo: "Ficha do membro", sub: pl ? "Preenchida a partir do planejamento \"" + esc(pl.funcao || pl.titulo) + "\". Ajuste o que for preciso." : "Comece pelos resultados esperados.", largo: true,
      corpo: '<div id="form-ficha">' + (planos.length && !o.fichaEm ? c.campo({ nome: "planejamentoId", rotulo: "Planejamento da função", tipo: "lista", opcoes: planos, valor: o.planejamentoId, opcional: true, ajuda: "Trocar o planejamento recarrega a Ficha com ele." }) : "") +
        '<div class="linha-campos">' + c.campo({ nome: "supervisao", rotulo: "Supervisão (a Bússola)", tipo: "lista", opcoes: usuarios, valor: o.supervisao, opcional: true }) + c.campo({ nome: "colega", rotulo: "Colega de trabalho (o Mapa)", tipo: "lista", opcoes: usuarios, valor: o.colega, opcional: true }) + "</div>" +
        c.campo({ nome: "fichaEscopo", rotulo: "Escopo da função", tipo: "textoLongo", valor: v("fichaEscopo", "escopo") }) +
        c.campo({ nome: "fichaPadroes", rotulo: "Padrões", tipo: "textoLongo", valor: v("fichaPadroes", "padroes") }) +
        c.campo({ nome: "fichaIndicadores", rotulo: "Indicadores", tipo: "textoLongo", valor: v("fichaIndicadores", "indicadores") }) +
        c.campo({ nome: "entregasAncoragem", rotulo: "Entregas da Ancoragem (semanas 3 e 4)", tipo: "textoLongo", valor: v("entregasAncoragem", "entregasAncoragem"), opcional: true }) +
        c.campo({ nome: "entregasImersao", rotulo: "Entregas da Imersão", tipo: "textoLongo", valor: v("entregasImersao", "entregasImersao"), opcional: true }) +
        c.campo({ nome: "entregasMarAberto", rotulo: "Entregas do Mar Aberto", tipo: "textoLongo", valor: v("entregasMarAberto", "entregasMarAberto"), opcional: true }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-ficha" data-id="' + esc(o.id) + '">Salvar a Ficha</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-ficha"] = function (el) {
    const f = document.getElementById("form-ficha");
    if (!ui.validar(f, ["fichaEscopo", "fichaPadroes", "fichaIndicadores"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const s = dom.statusOnboarding(ctx, o);
    const dados = { supervisao: d.supervisao, colega: d.colega, fichaEscopo: d.fichaEscopo, fichaPadroes: d.fichaPadroes, fichaIndicadores: d.fichaIndicadores, entregasAncoragem: d.entregasAncoragem, entregasImersao: d.entregasImersao, entregasMarAberto: d.entregasMarAberto, autor: E().eu.id };
    if (d.planejamentoId) dados.planejamentoId = d.planejamentoId;
    if (!o.fichaEm) { dados.fichaEm = ctx.hoje; if (o.estagio === "NEW" && s.dia >= 1) dados.estagio = "ANCORAGEM"; }
    ui.salvar(el, () => ui.atualizar("onboarding", o.id, dados), { mensagem: "Ficha salva." });
  };
  ui.acoes["iniciar-ancoragem"] = function (el) { ui.salvar(el, () => ui.atualizar("onboarding", el.dataset.id, { estagio: "ANCORAGEM" }), { mensagem: "Ancoragem iniciada.", fechar: false }); };
  ui.acoes["planejar-entregas"] = function (el) {
    const o = E().ctx.idx.porId.onboarding[el.dataset.id];
    ui.abrirPainel({
      titulo: "Planejar as 2 entregas das semanas 3 e 4", sub: "Entregas curtas. Cada uma vira uma tarefa \"Entrega\" no Bitrix, com a liderança como criadora.",
      corpo: '<div id="form-plan-ent">' + c.campo({ nome: "entregasAncoragem", rotulo: "Entregas e o \"pronta quando\" de cada uma", tipo: "textoLongo", valor: o.entregasAncoragem, linhas: 5 }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-plan-ent" data-id="' + esc(o.id) + '">Salvar o planejamento</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-plan-ent"] = function (el) {
    const f = document.getElementById("form-plan-ent");
    if (!ui.validar(f, ["entregasAncoragem"])) return;
    const d = ui.lerForm(f);
    ui.salvar(el, () => ui.atualizar("onboarding", el.dataset.id, { entregasAncoragem: d.entregasAncoragem, entregasPlanejadasEm: E().ctx.hoje }), { mensagem: "Entregas planejadas." });
  };
  ui.acoes["nova-entrega-onb"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const fase = dom.ESTAGIO_FASE[o.estagio];
    ui.abrirPainel({
      titulo: "Entrega da " + fase, sub: "Entra na lista de leitura da liderança, com prazo de 7 dias depois da conclusão.",
      corpo: '<div id="form-ent-onb">' + c.campo({ nome: "titulo", rotulo: "O que será entregue" }) + c.campo({ nome: "prontaQuando", rotulo: "Pronta quando", tipo: "textoLongo", linhas: 2 }) +
        c.campo({ nome: "tarefa", rotulo: "Link ou número da tarefa no Bitrix", opcional: true }) +
        '<div class="linha-campos">' + c.campo({ nome: "prazoTarefa", rotulo: "Prazo", tipo: "data" }) + c.campo({ nome: "concluidaEm", rotulo: "Concluída em", tipo: "data", opcional: true, max: ctx.hoje }) + "</div></div>",
      rodape: '<button class="btn" data-acao="salvar-ent-onb" data-id="' + esc(o.id) + '">Incluir a entrega</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-ent-onb"] = function (el) {
    const f = document.getElementById("form-ent-onb");
    if (!ui.validar(f, ["titulo", "prontaQuando", "prazoTarefa"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const m = ctx.idx.membro[o.membroId];
    const base = d.concluidaEm || d.prazoTarefa;
    ui.salvar(el, () => ui.criar("leituras", {
      titulo: d.titulo, membroId: m.id, responsavel: m.responsavel, prontaQuando: d.prontaQuando, prazoTarefa: d.prazoTarefa, concluidaEm: d.concluidaEm,
      tarefaId: (/(\d+)\/?\s*$/.exec(String(d.tarefa || "").trim()) || [])[1] || "", tarefaLink: /^https?:/.test(String(d.tarefa || "").trim()) ? d.tarefa.trim() : "",
      noPrazo: d.concluidaEm ? (d.concluidaEm <= d.prazoTarefa ? "Sim" : "Não") : "",
      origem: "Onboarding", fase: dom.ESTAGIO_FASE[o.estagio], onboardingId: o.id, trimestre: calc.trimestreDe(base).chave,
      prazoLeitura: calc.addDias(base, ((E().config.parametros || {}).prazoLeitura) || 7), estagio: "NEW",
    }), { mensagem: "Entrega incluída." });
  };

  /* ---------------- alinhamentos dos Dias 30, 60 e 90 ---------------- */
  ui.acoes["registrar-alinhamento"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const n = Number(el.dataset.n);
    const s = dom.statusOnboarding(ctx, o);
    const a = s.alinhamentos[n - 1];
    const m = dom.infoMembro(ctx, s.membro);
    let corpo = '<div id="form-alinh"><div class="grade c3" style="margin-bottom:14px"><div><div class="muted" style="font-size:12px">Nota da fase</div><div class="num" style="font-size:24px;font-weight:800;color:var(--navy)">' + (a.nota === null ? "sem nota" : a.nota) + "</div></div>" +
      '<div><div class="muted" style="font-size:12px">Patamar (' + esc(s.senioridade) + ')</div><div class="num" style="font-size:24px;font-weight:800;color:var(--navy)">' + (a.patamar === undefined ? "—" : a.patamar) + "</div></div>" +
      '<div><div class="muted" style="font-size:12px">Resultado da fase</div><div style="margin-top:6px">' + (a.resultado ? c.tag(a.resultado, COR_RESULTADO[a.resultado]) : "—") + "</div></div></div>" +
      '<div class="aviso-info" style="margin-bottom:14px">A nota é a média das leituras da fase e fica só para controle interno. O membro recebe o retorno em SCI.' + (a.resultado === "Abaixo do esperado" ? " Abaixo do esperado avisa o RH ao registrar." : "") + "</div>" +
      c.campo({ nome: "data", rotulo: "Data do alinhamento", tipo: "data", valor: ctx.hoje, max: ctx.hoje }) +
      c.campo({ nome: "retorno", rotulo: "Retorno em SCI", tipo: "textoLongo", linhas: 4, ajuda: "Situação, Comportamento e Impacto, como será dito ao membro." }) +
      c.campo({ nome: "combinados", rotulo: "Combinados para a próxima fase", tipo: "textoLongo", opcional: n === 3, linhas: 2 });
    if (n === 3) corpo += c.campo({ nome: "continuidade", rotulo: "Continuidade, decidida com o RH antes da conversa com o membro", tipo: "escolha", opcoes: op.continuidade });
    corpo += "</div>";
    ui.abrirPainel({
      titulo: a.rotulo + " de " + m.nome, sub: a.fase + " · Dia " + a.dia + " (" + calc.fmtData(a.data) + ")", corpo, largo: true,
      rodape: '<button class="btn" data-acao="salvar-alinhamento" data-id="' + esc(o.id) + '" data-n="' + n + '">Registrar o alinhamento</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-alinhamento"] = function (el) {
    const f = document.getElementById("form-alinh");
    const n = Number(el.dataset.n);
    if (!ui.validar(f, ["data", "retorno"].concat(n === 3 ? ["continuidade"] : ["combinados"]))) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const s = dom.statusOnboarding(ctx, o);
    const a = s.alinhamentos[n - 1];
    const dados = { autor: E().eu.id };
    dados["al" + n + "Data"] = d.data;
    dados["al" + n + "Nota"] = a.nota;
    dados["al" + n + "Resultado"] = a.resultado || "";
    dados["al" + n + "Retorno"] = d.retorno;
    dados["al" + n + "Combinados"] = d.combinados || "";
    if (n === 3) { dados.continuidade = d.continuidade; dados.estagio = d.continuidade === "Continuidade confirmada" ? "SUCCESS" : "FAIL"; }
    else dados.estagio = PROXIMO_ESTAGIO[n];
    const m = dom.infoMembro(ctx, s.membro);
    ui.salvar(el, async () => {
      await ui.atualizar("onboarding", o.id, dados);
      // Dia 90 registrado: o membro passa para Ativo no processo Membros (robô 5 da 3.2)
      if (n === 3 && d.continuidade === "Continuidade confirmada") await ui.atualizar("membros", s.membro.id, { estagio: "ATIVO" });
      if (a.resultado === "Abaixo do esperado") await GP.app.avisarRH("Onboarding de " + m.nome + ": " + a.rotulo + " registrado com resultado da fase abaixo do esperado.");
    }, { mensagem: n === 3 ? (d.continuidade === "Continuidade confirmada" ? "Onboarding concluído. " + primeiroNome(m.nome) + " passa para Ativo." : "Alinhamento final registrado. Combine com o RH os próximos passos.") : "Alinhamento registrado. Próxima fase: " + (n === 1 ? "Imersão" : "Mar Aberto") + "." });
  };

  /* ================================================================ PLANEJAMENTO DA FUNÇÃO */
  function telaPlanejamentos() {
    const ctx = E().ctx;
    const lista = (ctx.registros.planejamento || []).slice().sort((a, b) => String(a.funcao || a.titulo).localeCompare(String(b.funcao || b.titulo), "pt-BR"));
    return c.voltar("#/onboarding", "Onboarding") + c.cabecalho("onboarding", "Planejamento da função", "<span>feito uma vez por função; vira o modelo da Ficha a cada nova contratação</span>", '<button class="btn" data-acao="planejamento" data-id="">' + icone("mais", 15) + " Novo planejamento</button>") +
      '<div class="card">' + (lista.length ? '<div class="lista">' + lista.map((p) => '<div class="item clicavel" data-acao="planejamento" data-id="' + esc(p.id) + '"><div class="principal-item"><div class="t">' + esc(p.funcao || p.titulo) + '</div><div class="d">' + esc(p.area || "") + "</div></div><div class=\"lado\">" +
        c.tag(p.estagioNome, p.estagio === "SUCCESS" ? "verde" : p.estagio === "FAIL" ? "cinza" : "ambar") + "</div></div>").join("") + "</div>" : c.vazio("Nenhuma função planejada ainda.")) + "</div>";
  }
  ui.acoes["planejamento"] = function (el) {
    const p = el.dataset.id ? E().ctx.idx.porId.planejamento[el.dataset.id] : {};
    ui.abrirPainel({
      titulo: p.id ? "Planejamento: " + (p.funcao || p.titulo) : "Novo planejamento da função", largo: true,
      corpo: '<div id="form-plan">' + '<div class="linha-campos">' + c.campo({ nome: "funcao", rotulo: "Função", valor: p.funcao }) + c.campo({ nome: "area", rotulo: "Setor e área", valor: p.area }) + "</div>" +
        c.campo({ nome: "escopo", rotulo: "Escopo", tipo: "textoLongo", valor: p.escopo }) + c.campo({ nome: "padroes", rotulo: "Padrões", tipo: "textoLongo", valor: p.padroes }) +
        c.campo({ nome: "indicadores", rotulo: "Indicadores", tipo: "textoLongo", valor: p.indicadores }) +
        c.campo({ nome: "entregasAncoragem", rotulo: "Entregas da Ancoragem", tipo: "textoLongo", valor: p.entregasAncoragem }) + c.campo({ nome: "entregasImersao", rotulo: "Entregas da Imersão", tipo: "textoLongo", valor: p.entregasImersao }) +
        c.campo({ nome: "entregasMarAberto", rotulo: "Entregas do Mar Aberto", tipo: "textoLongo", valor: p.entregasMarAberto }) +
        c.campo({ nome: "estagio", rotulo: "Situação", tipo: "escolha", opcoes: [{ valor: "NEW", rotulo: "Em elaboração" }, { valor: "SUCCESS", rotulo: "Publicado (vira modelo da Ficha)" }, { valor: "FAIL", rotulo: "Arquivado" }], valor: p.estagio || "NEW" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-planejamento" data-id="' + esc(p.id || "") + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-planejamento"] = function (el) {
    const f = document.getElementById("form-plan");
    if (!ui.validar(f, ["funcao", "escopo"])) return;
    const d = ui.lerForm(f);
    const dados = { titulo: d.funcao, funcao: d.funcao, area: d.area, escopo: d.escopo, padroes: d.padroes, indicadores: d.indicadores, entregasAncoragem: d.entregasAncoragem, entregasImersao: d.entregasImersao, entregasMarAberto: d.entregasMarAberto, estagio: d.estagio || "NEW" };
    ui.salvar(el, () => (el.dataset.id ? ui.atualizar("planejamento", el.dataset.id, dados) : ui.criar("planejamento", dados)), { mensagem: "Planejamento salvo." });
  };

  GP.telas = GP.telas || {};
  GP.telas.onboarding = { resumoHtml, ESTAGIO_POR_FASE };
})(window);
