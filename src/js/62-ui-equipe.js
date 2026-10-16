/* =====================================================================================
   TELAS — Minha equipe, equipe de outra liderança e card do membro (1.3, 2.5, 4.4)
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural, normalizar } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;

  const COR_ESTAGIO_MEMBRO = { NEW: "azul", ATIVO: "verde", EM_ENCERRAMENTO: "ambar", SUCCESS: "cinza", FAIL: "cinza" };
  const ROTULO_ESTAGIO_MEMBRO = { NEW: "Onboarding", ATIVO: "Ativo", EM_ENCERRAMENTO: "Em encerramento", SUCCESS: "Encerrado", FAIL: "Arquivado" };

  /** Resumo de uma linha para a lista da equipe */
  function resumoMembro(ctx, m) {
    const tags = [];
    let atencao = false;
    if (m.estagio === "ATIVO") {
      const cic = dom.cicloDo(ctx, m.id, ctx.tri.chave);
      if (cic) { const s = dom.statusCiclo(ctx, cic); tags.push(c.tag(s.texto, s.cor)); if (s.cor === "vermelho") atencao = true; }
    }
    const ob = dom.onboardingDo(ctx, m.id);
    if (ob && ["SUCCESS", "FAIL"].indexOf(ob.estagio) < 0) {
      const s = dom.statusOnboarding(ctx, ob);
      tags.push(c.tag(s.fase + (s.dia > 0 ? " · Dia " + s.dia : ""), s.atrasado ? "vermelho" : "azul"));
      if (s.atrasado) atencao = true;
    }
    const plano = dom.planoAtivoDo(ctx, m.id);
    if (plano) { const s = dom.statusPlano(ctx, plano); tags.push(c.tag("Plano · " + s.texto, s.cor === "vermelho" ? "vermelho" : "ambar")); if (s.cor === "vermelho") atencao = true; }
    const f = dom.ultimoFeedback(ctx, m.id);
    const semFb90 = m.estagio === "ATIVO" && (!f || f.data < calc.addDias(ctx.hoje, -89));
    const det = [esc(m.funcao || m.cargo || ""), m.cidadeSigla, f ? "último feedback " + calc.fmtData(f.data) : "sem feedback registrado"].filter(Boolean).join(" · ");
    return { tags, atencao, det, semFb90 };
  }
  function linhaMembro(ctx, m0) {
    const m = dom.infoMembro(ctx, m0);
    const r = resumoMembro(ctx, m);
    return '<div class="item clicavel" data-rota="#/membro/' + esc(m.id) + '">' + c.avatar(m, 38) +
      '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + r.det + (r.semFb90 ? ' · <span style="color:var(--ambar)">sem feedback em 90 dias</span>' : "") + "</div></div>" +
      '<div class="lado">' + (m.estagio !== "ATIVO" ? c.tag(ROTULO_ESTAGIO_MEMBRO[m.estagio] || m.estagioNome, COR_ESTAGIO_MEMBRO[m.estagio]) : "") + r.tags.join("") + "</div></div>";
  }

  /* ================================================================ MINHA EQUIPE */
  ui.rotas.equipe = function (partes) {
    if (partes[0] === "lideranca") return equipeDeOutra(partes[1]);
    const ctx = E().ctx;
    const visao = E().visao;
    const doSetor = visao === "coordenacao" && partes[0] === "setor";
    let membros = visao === "rh" ? dom.membrosAtivos(ctx.registros.membros || []) : doSetor ? ui.membrosDaVisao() : ui.minhaEquipe();
    const busca = normalizar(E().filtros.equipe || "");
    const todos = membros.length;
    if (busca) membros = membros.filter((m) => normalizar(dom.infoMembro(ctx, m).nome).indexOf(busca) >= 0);
    const infos = membros.map((m) => ({ m, r: resumoMembro(ctx, dom.infoMembro(ctx, m)), nome: dom.infoMembro(ctx, m).nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const atencao = infos.filter((x) => x.r.atencao);
    const resto = infos.filter((x) => !x.r.atencao);
    const contagem = (est) => membros.filter((m) => m.estagio === est).length;
    const numeros = "<span><b>" + todos + "</b> " + (todos === 1 ? "membro" : "membros") + "</span><span><b>" + contagem("NEW") + "</b> em onboarding</span><span><b>" + contagem("EM_ENCERRAMENTO") + "</b> em encerramento</span>";
    let h = c.cabecalho("equipe", visao === "rh" ? "Todas as equipes" : "Minha equipe", numeros,
      E().eu.admin || visao === "rh" ? '<button class="btn sec" data-acao="novo-membro">' + icone("mais", 15) + " Cadastrar membro</button>" : "");
    if (visao === "coordenacao") h += c.abas([{ chave: "minha", rotulo: "Equipe direta", rota: "#/equipe" }, { chave: "setor", rotulo: "Todo o setor", rota: "#/equipe/setor" }], doSetor ? "setor" : "minha");
    h += '<div style="margin-bottom:14px"><input class="entrada" style="max-width:340px" placeholder="Buscar pelo nome" value="' + esc(E().filtros.equipe || "") + '" data-filtro="equipe" aria-label="Buscar membro"></div>';
    if (!todos) {
      return h + '<div class="card">' + c.vazio(visao === "rh" ? "Nenhum item no processo Membros ainda." :
        "Nenhum membro na sua equipe. O app usa a estrutura da empresa no Bitrix: você precisa ser chefe de um departamento com os membros que lidera, e cada membro precisa ter o item no processo Membros (especificação 1.1).") + "</div>";
    }
    if (atencao.length) h += '<div class="card acao vermelho"><h3>Precisa de atenção<span class="extra muted">' + plural(atencao.length, "membro", "membros") + "</span></h3><div class=\"lista\">" + atencao.map((x) => linhaMembro(ctx, x.m)).join("") + "</div></div>";
    h += '<div class="card"><h3>' + (atencao.length ? "Demais membros" : "Membros") + '</h3><div class="lista">' + (resto.length ? resto.map((x) => linhaMembro(ctx, x.m)).join("") : c.vazio("Ninguém aqui.")) + "</div></div>";
    return h;
  };

  /** Coordenação e RH: equipe de outra liderança, uma linha por membro (4.6) */
  function equipeDeOutra(uid) {
    const ctx = E().ctx;
    const l = dom.pessoa(ctx, uid);
    const equipe = dom.equipeDe(ctx, uid);
    const ind = dom.indicadoresEquipe(ctx, equipe, { uid });
    return c.voltar("#/painel/setor", "Meu setor") + c.cabecalho("equipe", "Equipe de " + l.nome, "<span><b>" + equipe.length + "</b> membros</span><span>situação " + c.tag(ind.situacao.rotulo, ind.situacao.cor) + "</span>") +
      '<div class="card"><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Membro</th><th>1:1 do trimestre</th><th>Feedbacks em 90 dias</th><th>Etapa</th></tr></thead><tbody>' +
      equipe.map((m0) => {
        const m = dom.infoMembro(ctx, m0);
        const cic = dom.cicloDo(ctx, m.id, ctx.tri.chave);
        const s = cic && m.estagio === "ATIVO" ? dom.statusCiclo(ctx, cic) : null;
        const n90 = dom.feedbacksDo(ctx, m.id).filter((f) => f.data >= calc.addDias(ctx.hoje, -89)).length;
        return '<tr class="clicavel" data-rota="#/membro/' + esc(m.id) + '"><td>' + c.pessoa(m, esc(m.funcao || ""), 28) + "</td><td>" + (s ? c.tag(s.texto, s.cor) : '<span class="muted">não se aplica</span>') +
          '</td><td class="num">' + n90 + "</td><td>" + c.tag(ROTULO_ESTAGIO_MEMBRO[m.estagio] || m.estagioNome, COR_ESTAGIO_MEMBRO[m.estagio]) + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  /* ================================================================ CARD DO MEMBRO */
  /** Nome da lista de onde a pessoa veio, para o "voltar" */
  function rotuloEquipe() { return E().visao === "rh" ? "Todas as equipes" : "Minha equipe"; }
  ui.rotas.membro = function (partes) {
    const ctx = E().ctx;
    const m0 = ctx.idx.membro[partes[0]];
    if (!m0) return c.voltar("#/equipe", rotuloEquipe()) + '<div class="card">' + c.vazio("Membro não encontrado ou fora da sua visão.") + "</div>";
    const m = dom.infoMembro(ctx, m0);
    const aba = partes[1] || "resumo";
    if (aba === "dossie") return dossie(m);
    const fbs = dom.feedbacksDo(ctx, m.id);
    const ciclos = (ctx.idx.porMembro.ciclo[m.id] || []).slice().sort((a, b) => (a.trimestre < b.trimestre ? 1 : -1));
    const planos = ctx.idx.porMembro.planos[m.id] || [];
    const obs = ctx.idx.porMembro.onboarding[m.id] || [];
    const encs = ctx.idx.porMembro.encerramentos[m.id] || [];
    const lid = dom.pessoa(ctx, m.lideranca), coord = dom.pessoa(ctx, m.coordenacao);
    const cic = dom.cicloDo(ctx, m.id, ctx.tri.chave);
    const acoes = '<button class="btn" data-acao="novo-feedback" data-membro="' + esc(m.id) + '">' + icone("mais", 15) + " Feedback SCI</button>" +
      (cic && !cic.data1a1 && m.estagio === "ATIVO" ? '<button class="btn sec" data-acao="agendar-1a1" data-id="' + esc(cic.id) + '">' + icone("calendario", 15) + " Agendar 1:1</button>" : "") +
      '<a class="btn sec" href="#/membro/' + esc(m.id) + '/dossie">Dossiê em PDF</a>' +
      (E().visao === "rh" || E().eu.admin ? '<button class="btn sec" data-acao="editar-membro" data-id="' + esc(m.id) + '">Editar cadastro</button>' : "");
    let h = c.voltar("#/equipe", rotuloEquipe()) +
      '<div class="card"><div class="ficha-topo">' + c.avatar(m, 64) + '<div class="info"><div class="nome-grande">' + esc(m.nome) + "</div>" +
      '<div class="muted">' + esc(m.funcao || m.cargo || "") + "</div><div style=\"margin-top:6px;display:flex;gap:6px;flex-wrap:wrap\">" + c.tag(ROTULO_ESTAGIO_MEMBRO[m.estagio] || m.estagioNome, COR_ESTAGIO_MEMBRO[m.estagio]) +
      (m.ingresso ? c.tag("Na Amorim desde " + calc.fmtDataAno(m.ingresso), "cinza") : "") + "</div></div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap" class="nao-imprimir">' + acoes + "</div></div>" +
      c.dados([["Liderança direta", lid.nome], ["Coordenação responsável", coord.nome], ["Modelo de contrato", m.contrato], ["Nível", m.nivel],
        ["Senioridade", m.senioridade], ["Cidade de referência", m.cidade], ["E-mail", m.email]]) + "</div>";
    const abas = [
      { chave: "resumo", rotulo: "Histórico", rota: "#/membro/" + m.id },
      { chave: "feedbacks", rotulo: "Feedbacks SCI", rota: "#/membro/" + m.id + "/feedbacks", qt: fbs.length },
      { chave: "ciclo", rotulo: "1:1 e evidências", rota: "#/membro/" + m.id + "/ciclo", qt: ciclos.length },
      { chave: "desempenho", rotulo: "Desempenho anual", rota: "#/membro/" + m.id + "/desempenho" },
      { chave: "carreira", rotulo: "Carreira", rota: "#/membro/" + m.id + "/carreira" },
    ];
    if (planos.length) abas.push({ chave: "planos", rotulo: "Planos", rota: "#/membro/" + m.id + "/planos", qt: planos.length });
    if (obs.length) abas.push({ chave: "onboarding", rotulo: "Onboarding", rota: "#/membro/" + m.id + "/onboarding" });
    if (encs.length) abas.push({ chave: "encerramento", rotulo: "Encerramento", rota: "#/membro/" + m.id + "/encerramento" });
    h += '<div style="margin-top:18px">' + c.abas(abas, aba) + "</div>";
    if (aba === "feedbacks") h += '<div class="card">' + (fbs.length ? fbs.map((f) => GP.telas.rotinas.feedbackHtml(f, true)).join('<hr style="border:none;border-top:1px solid var(--divisor);margin:16px 0">') : c.vazio("Nenhum feedback SCI registrado.")) + "</div>";
    else if (aba === "ciclo") h += ciclos.length ? ciclos.map((ci) => GP.telas.rotinas.cicloResumoHtml(ci)).join("") : '<div class="card">' + c.vazio("Nenhum item do Ciclo trimestral. Membros em onboarding entram no ciclo no trimestre seguinte ao Dia 90.") + "</div>";
    else if (aba === "desempenho") h += GP.telas.desempenho.anualHtml(m, Number(ctx.hoje.slice(0, 4)));
    else if (aba === "carreira") h += carreiraHtml(m, ciclos);
    else if (aba === "planos") h += planos.map((p) => GP.telas.offboarding.planoResumoHtml(p)).join("");
    else if (aba === "onboarding") h += obs.map((o) => GP.telas.onboarding.resumoHtml(o)).join("");
    else if (aba === "encerramento") h += encs.map((e) => GP.telas.offboarding.encerramentoResumoHtml(e)).join("");
    else h += historicoHtml(m);
    return h;
  };

  /** Histórico: tudo o que foi registrado, com data e autor (1.3) */
  function eventosDoMembro(m) {
    const ctx = E().ctx;
    const ev = [];
    const autor = (it) => dom.pessoa(ctx, it.autor || it.criadoPor).nome;
    dom.feedbacksDo(ctx, m.id).forEach((f) => ev.push({ data: f.data, cor: f.tipo === "Reconhecimento" ? "var(--verde)" : "var(--azul)", o: "Feedback de " + f.tipo.toLowerCase(), r: "por " + autor(f) + (f.retroativo ? " · registro retroativo" : ""), rota: "#/rotinas/feedback/" + f.id }));
    (ctx.idx.porMembro.ciclo[m.id] || []).forEach((ci) => {
      if (ci.realizadoEm) ev.push({ data: ci.realizadoEm, cor: "var(--navy)", o: "1:1 do " + (calc.trimestrePorChave(ci.trimestre) || {}).curto, r: (ci.progresso ? "progresso no objetivo: " + ci.progresso.toLowerCase() + " · " : "") + "por " + autor(ci), rota: "#/rotinas/ciclo/" + ci.id });
      if (ci.registroEvidEm) ev.push({ data: ci.registroEvidEm.slice(0, 10), cor: "var(--navy)", o: "Evidências do " + (calc.trimestrePorChave(ci.trimestre) || {}).curto, r: (ci.classificacao ? "classificação: " + ci.classificacao.toLowerCase() + " · " : "") + "por " + autor(ci), rota: "#/desempenho/ciclo/" + ci.id });
    });
    (ctx.idx.porMembro.planos[m.id] || []).forEach((p) => {
      ev.push({ data: p.inicio, cor: "var(--ambar)", o: "Plano de alinhamento de resultados aberto", r: "término " + calc.fmtData(p.termino), rota: "#/offboarding/plano/" + p.id });
      if (p.checkinData) ev.push({ data: p.checkinData, cor: "var(--ambar)", o: "Check-in do plano (Dia 30)", r: [p.checkin1, p.checkin2].filter(Boolean).join(" · "), rota: "#/offboarding/plano/" + p.id });
    });
    (ctx.idx.porMembro.onboarding[m.id] || []).forEach((o) => {
      if (o.ingresso) ev.push({ data: o.ingresso, cor: "var(--azul)", o: "Dia 1 do onboarding", r: "Embarcação Amorim", rota: "#/onboarding/" + o.id });
      [1, 2, 3].forEach((n) => { if (o["al" + n + "Data"]) ev.push({ data: o["al" + n + "Data"], cor: "var(--azul)", o: (n === 3 ? "Alinhamento final" : "Alinhamento " + n) + " do onboarding", r: o["al" + n + "Resultado"] || "", rota: "#/onboarding/" + o.id }); });
    });
    (ctx.idx.porMembro.encerramentos[m.id] || []).forEach((e) => ev.push({ data: String(e.criadoEm).slice(0, 10), cor: "var(--vermelho)", o: "Solicitação de encerramento de contrato", r: e.estagioNome, rota: "#/offboarding/encerramento/" + e.id }));
    (ctx.idx.porMembro.leituras[m.id] || []).filter((l) => l.lidaEm).forEach((l) => ev.push({ data: l.lidaEm, cor: "var(--suave)", o: "Leitura da entrega \"" + l.titulo + "\"", r: l.leitura, rota: "#/desempenho/leitura/" + l.id }));
    return ev.filter((e) => e.data).sort((a, b) => (a.data < b.data ? 1 : -1));
  }
  function historicoHtml(m) {
    const ev = eventosDoMembro(m);
    if (!ev.length) return '<div class="card">' + c.vazio("Nada registrado ainda para " + esc(primeiroNome(m.nome)) + ".") + "</div>";
    return '<div class="card"><div class="linha-tempo">' + ev.map((e) => '<div class="evento"><span class="marcador" style="background:' + e.cor + '"></span><div class="quando">' + calc.fmtDataAno(e.data) + "</div>" +
      '<div class="o-que"><a href="' + e.rota + '">' + esc(e.o) + "</a></div>" + (e.r ? '<div class="resumo">' + esc(e.r) + "</div>" : "") + "</div>").join("") + "</div></div>";
  }
  function carreiraHtml(m, ciclos) {
    const ultimo = ciclos.find((ci) => ci.proximoNivel || ci.objetivo);
    const mov = String(m.carreira || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return '<div class="card"><h3>Carreira</h3>' + c.dados([["Nível atual", m.nivel], ["Próximo nível", ultimo ? ultimo.proximoNivel : ""], ["Objetivo de desenvolvimento", ultimo ? ultimo.objetivo : ""], ["Progresso", ultimo ? ultimo.progresso : ""]]) +
      '<div class="grupo-form" style="margin-top:16px"><div class="rotulo-grupo">Histórico de movimentações</div>' + (mov.length ? '<div class="lista">' + mov.map((l) => '<div class="item">' + esc(l) + "</div>").join("") + "</div>" : c.vazio("Nenhuma movimentação registrada. A movimentação é decidida na calibração e registrada pelo RH.")) + "</div></div>";
  }

  /* ---------------- dossiê do membro (4.4) ---------------- */
  function dossie(m) {
    const ctx = E().ctx;
    const fbs = dom.feedbacksDo(ctx, m.id);
    const ciclos = (ctx.idx.porMembro.ciclo[m.id] || []).slice().sort((a, b) => (a.trimestre < b.trimestre ? 1 : -1));
    const planos = ctx.idx.porMembro.planos[m.id] || [];
    const obs = ctx.idx.porMembro.onboarding[m.id] || [];
    return '<div class="nao-imprimir" style="display:flex;gap:10px;margin-bottom:16px;align-items:center">' + c.voltar("#/membro/" + m.id, "Card do membro").replace('class="voltar"', 'class="voltar" style="margin:0"') +
      '<button class="btn" data-acao="imprimir-dossie" data-id="' + esc(m.id) + '" style="margin-left:auto">Salvar em PDF</button></div>' +
      '<div class="card"><div class="nome-grande" style="font-size:20px;font-weight:800;color:var(--navy)">Dossiê · ' + esc(m.nome) + '</div><div class="muted">Gerado em ' + calc.fmtDataAno(ctx.hoje) + " por " + esc(E().eu.nome) + ". Uso restrito: liderança, coordenação e RH.</div>" +
      c.dados([["Função", m.funcao], ["Ingresso", calc.fmtDataAno(m.ingresso)], ["Contrato", m.contrato], ["Nível", m.nivel], ["Senioridade", m.senioridade]]) + "</div>" +
      '<div class="card"><h3>Feedbacks SCI</h3>' + (fbs.length ? fbs.map((f) => GP.telas.rotinas.feedbackHtml(f, false)).join("<hr>") : c.vazio("Nenhum.")) + "</div>" +
      '<div class="card"><h3>1:1 e evidências</h3>' + (ciclos.length ? ciclos.map((ci) => GP.telas.rotinas.cicloResumoHtml(ci, true)).join("") : c.vazio("Nenhum.")) + "</div>" +
      (planos.length ? '<div class="card"><h3>Planos de alinhamento</h3>' + planos.map((p) => GP.telas.offboarding.planoResumoHtml(p, true)).join("") + "</div>" : "") +
      (obs.length ? '<div class="card"><h3>Onboarding</h3>' + obs.map((o) => GP.telas.onboarding.resumoHtml(o, true)).join("") + "</div>" : "") +
      '<div class="card"><h3>Histórico</h3>' + historicoHtml(m).replace('<div class="card">', "<div>") + "</div>";
  }
  ui.acoes["imprimir-dossie"] = async function (el) {
    // O download fica registrado: comentário na timeline do item Membros (quem e quando)
    try { if (E().repo.registrarDossie) await E().repo.registrarDossie(el.dataset.id, E().eu); } catch (e) { console.warn("Registro do dossiê não gravado:", e); }
    window.print();
  };

  /* ---------------- cadastro do membro (RH e administrador) ---------------- */
  function formMembro(m) {
    const ctx = E().ctx;
    const op = GP.schema.OPCOES;
    const niveis = (E().config && E().config.niveis) || [];
    const usuarios = (ctx.usuarios || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    const v = m || {};
    return '<div id="form-membro">' +
      c.campo({ nome: "responsavel", rotulo: "Membro (usuário do Bitrix)", tipo: "lista", opcoes: usuarios, valor: v.responsavel, desabilitado: !!m, ajuda: "É o Responsável do item. O nome e a foto vêm do perfil do Bitrix." }) +
      '<div class="linha-campos">' + c.campo({ nome: "lideranca", rotulo: "Liderança direta", tipo: "lista", opcoes: usuarios, valor: v.lideranca }) +
      c.campo({ nome: "coordenacao", rotulo: "Coordenação responsável", tipo: "lista", opcoes: usuarios, valor: v.coordenacao }) + "</div>" +
      c.campo({ nome: "funcao", rotulo: "Departamento e função", valor: v.funcao, placeholder: "Ex.: Imigração · Analista" }) +
      '<div class="linha-campos">' + c.campo({ nome: "ingresso", rotulo: "Data de ingresso", tipo: "data", valor: v.ingresso }) +
      c.campo({ nome: "contrato", rotulo: "Modelo de contrato", tipo: "lista", opcoes: op.contrato, valor: v.contrato }) + "</div>" +
      '<div class="linha-campos">' + (niveis.length ? c.campo({ nome: "nivel", rotulo: "Nível", tipo: "lista", opcoes: niveis, valor: v.nivel }) : c.campo({ nome: "nivel", rotulo: "Nível", valor: v.nivel })) +
      c.campo({ nome: "senioridade", rotulo: "Senioridade", tipo: "lista", opcoes: op.senioridade, valor: v.senioridade }) + "</div>" +
      c.campo({ nome: "cidade", rotulo: "Cidade de referência para feriados", tipo: "escolha", opcoes: op.cidade, valor: v.cidade || "São Paulo (SP)", ajuda: "Salvador (BA) para quem mora na Bahia. São Paulo (SP) para todos os outros." }) +
      (m ? c.campo({ nome: "estagio", rotulo: "Estágio", tipo: "lista", opcoes: GP.schema.processo("membros").estagios.map((e) => ({ valor: e.codigo, rotulo: e.nome })), valor: v.estagio }) : "") +
      c.campo({ nome: "ocultarAniversario", rotulo: "Agenda da equipe", tipo: "simNao", valor: v.ocultarAniversario, textoCheck: "Ocultar o aniversário (a pessoa pediu ao RH)" }) +
      c.campo({ nome: "carreira", rotulo: "Histórico de movimentações (Carreira)", tipo: "textoLongo", valor: v.carreira, opcional: true, ajuda: "Uma linha por movimentação: AAAA-MM-DD · de um nível para outro." }) + "</div>";
  }
  ui.acoes["novo-membro"] = function () {
    ui.abrirPainel({ titulo: "Cadastrar membro", sub: "O RH cria um item por membro no ingresso (2.5).", corpo: formMembro(null), rodape: '<button class="btn" data-acao="salvar-membro">Cadastrar</button><button class="btn sec" data-acao="fechar-painel">Cancelar</button>' });
  };
  ui.acoes["editar-membro"] = function (el) {
    const m = E().ctx.idx.membro[el.dataset.id];
    ui.abrirPainel({ titulo: "Cadastro de " + dom.infoMembro(E().ctx, m).nome, corpo: formMembro(m), rodape: '<button class="btn" data-acao="salvar-membro" data-id="' + esc(m.id) + '">Salvar</button><button class="btn sec" data-acao="fechar-painel">Cancelar</button>' });
  };
  ui.acoes["salvar-membro"] = function (el) {
    const f = document.getElementById("form-membro");
    const id = el.dataset.id;
    if (!ui.validar(f, id ? ["lideranca", "coordenacao", "ingresso", "senioridade", "cidade"] : ["responsavel", "lideranca", "coordenacao", "ingresso", "senioridade", "cidade"])) return;
    const d = ui.lerForm(f);
    const dados = { lideranca: d.lideranca, coordenacao: d.coordenacao, funcao: d.funcao, ingresso: d.ingresso, contrato: d.contrato, nivel: d.nivel, senioridade: d.senioridade, cidade: d.cidade, ocultarAniversario: d.ocultarAniversario, carreira: d.carreira };
    if (id) {
      if (d.estagio) dados.estagio = d.estagio;
      ui.salvar(el, () => ui.atualizar("membros", id, dados), { mensagem: "Cadastro atualizado." });
    } else {
      const u = dom.pessoa(E().ctx, d.responsavel);
      if (E().ctx.idx.membroPorUsuario[d.responsavel]) { ui.erroNoPainel(u.nome + " já tem item no processo Membros."); return; }
      Object.assign(dados, { titulo: u.nome, responsavel: d.responsavel, estagio: d.ingresso > E().ctx.hoje || calc.diffDias(d.ingresso, E().ctx.hoje) < 90 ? "NEW" : "ATIVO" });
      ui.salvar(el, async () => {
        const novo = await ui.criar("membros", dados);
        // Ingresso confirmado (3.2, robô 1): cria o onboarding em Preparação
        if (novo.estagio === "NEW") {
          await ui.criar("onboarding", { titulo: "Onboarding · " + u.nome, membroId: novo.id, responsavel: d.responsavel, ingresso: d.ingresso, senioridade: d.senioridade, autor: E().eu.id, estagio: "NEW" });
        }
        return novo;
      }, { mensagem: "Membro cadastrado." });
    }
  };

  GP.telas = GP.telas || {};
  GP.telas.equipe = { linhaMembro, eventosDoMembro, ROTULO_ESTAGIO_MEMBRO, COR_ESTAGIO_MEMBRO };
})(window);
