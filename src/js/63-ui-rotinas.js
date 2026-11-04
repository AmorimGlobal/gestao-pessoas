/* =====================================================================================
   TELAS — Feedbacks (o antigo "Rotinas"): feedbacks SCI (3.3.2), 1:1 mensal, O2O do
   trimestre (o "1:1 do trimestre" da especificação, 3.3 e 3.3.1) e o acesso ao plano de
   melhoria (63-ui-planos.js). Reunião de 29/10/2026.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;

  const AVISO_REGISTRO = "Registre fatos, comportamentos e resultados. Nada sobre saúde, humor ou vida pessoal entra no registro, mesmo que o assunto apareça na conversa.";
  const MODELOS_SCI = [
    { t: "Feedback de reconhecimento", s: "Na entrega do relatório mensal do cliente X, em 12/09.", c: "Você conferiu os números com o financeiro antes de enviar e explicou as variações no e-mail.", i: "O cliente aprovou sem pedir ajustes, e a equipe ganhou dois dias no fechamento.", p: "" },
    { t: "Entrega fora do prazo", s: "No parecer combinado para 05/10.", c: "O parecer chegou em 08/10, sem aviso antes do prazo.", i: "O cliente precisou remarcar a reunião, e a equipe teve de explicar o atraso.", p: "Próximo passo combinado: avisar até a véspera quando um prazo estiver em risco, com a nova data." },
    { t: "Retrabalho", s: "Nos dois últimos requerimentos de visto, em setembro.", c: "Os documentos foram enviados sem passar pelo checklist, e os dois voltaram com exigência.", i: "Cada exigência acrescentou 5 dias ao prazo do cliente.", p: "Próximo passo combinado: usar o checklist antes de cada protocolo nas próximas 4 semanas e revisar juntos na sexta." },
    { t: "Evolução de comportamento", s: "Nas reuniões de alinhamento de setembro.", c: "Você trouxe as dúvidas dos casos já com uma proposta de solução, o que não acontecia em julho.", i: "As reuniões ficaram mais curtas, e as decisões saíram na própria reunião.", p: "" },
  ];
  // Revisão do texto antes de registrar (4.7). Primeira versão por regras; a Amora entra depois.
  const SINAIS = [
    { re: /\b(sempre|nunca|todo mundo|ningu[eé]m|toda vez)\b/i, dica: "Generalização: troque por quando aconteceu (data ou situação)." },
    { re: /\b(pregui[cç]os[oa]|desorganizad[oa]|irrespons[aá]vel|descompromissad[oa]|lent[oa]|incompetente|desleixad[oa]|desatent[oa]|grosseir[oa]|arrogante|ruim|p[eé]ssim[oa])\b/i, dica: "Julgamento ou adjetivo sobre a pessoa: descreva o que ela fez ou disse." },
    { re: /\b(atitude|postura|comportamento inadequado|falta de comprometimento|falta de interesse)\b/i, dica: "Comportamento vago: diga o que foi observado, de um jeito que outra pessoa também veria." },
    { re: /\b(vai prejudicar|vai acabar|no futuro vai|pode ser demitid|perder o emprego)\b/i, dica: "Impacto no futuro: registre o efeito que já aconteceu." },
    { re: /\b(voc[eê] deve|fica determinado|[eé] obrigat[oó]rio|exijo)\b/i, dica: "Linguagem impositiva: prefira um combinado (\"combinamos que…\")." },
    { re: /\b(sa[uú]de|doen[cç]a|ansiedade|depress|gr[aá]vid|div[oó]rcio|luto|terapia|rem[eé]dio|atestado|falta[s]?\b|afastamento)\b/i, dica: "Saúde, vida pessoal, faltas ou afastamentos não entram no registro." },
  ];
  function revisarTexto(campos) {
    const achados = [];
    Object.keys(campos).forEach((k) => {
      const t = campos[k] || "";
      SINAIS.forEach((s) => { const m = s.re.exec(t); if (m) achados.push({ campo: k, trecho: m[0], dica: s.dica }); });
    });
    return achados;
  }

  /* ================================================================ TELA FEEDBACKS (antiga "Rotinas") */
  // Reunião de 29/10/2026: o módulo reúne os feedbacks SCI, o 1:1 mensal (conversa breve), o O2O
  // trimestral (sessão de desenvolvimento, o antigo "1:1 do trimestre") e o plano de melhoria.
  const RITMO = "1:1 todo mês: conversa breve, de uns 20 minutos, para saber como a pessoa está e se precisa de apoio. O2O no início de cada trimestre: a sessão de desenvolvimento. Feedback SCI sempre que algo acontecer. A conversa pode ser por WhatsApp ou outro canal: o que importa é registrar aqui.";
  ui.rotas.rotinas = function (partes) {
    if (partes[0] === "ciclo" && partes[1]) return telaCiclo(partes[1]);
    if (partes[0] === "plano" && partes[1]) return GP.telas.planos.telaPlano(partes[1]);
    if ((partes[0] === "feedback" || partes[0] === "mensal") && partes[1] === "novo") {
      // Atalho vindo de uma dica ou pendência: abre o formulário e volta a rota para #/rotinas (sem disparar
      // hashchange), senão o próximo render() abriria o formulário de novo.
      history.replaceState(null, "", "#/rotinas");
      const qual = partes[0];
      setTimeout(() => (qual === "feedback" ? abrirFormFeedback(partes[2], partes[3]) : abrirFormMensal(partes[2])), 0);
    }
    else if (partes[0] === "feedback" && partes[1]) return telaFeedback(partes[1]);
    else if (partes[0] === "mensal" && partes[1]) return telaMensal(partes[1]);
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao();
    const ind = dom.indicadoresEquipe(ctx, membros, { uid: E().eu.id });
    const comMensal = dom.temMensal(ctx);
    const numeros = (comMensal ? "<span>1:1 de " + esc(ind.mensal.mes.curto) + ": <b>" + esc(ind.mensal.texto) + "</b></span>" : "") +
      "<span>O2O do " + ctx.tri.curto + ": <b>" + esc(ind.um1a1.texto) + "</b></span><span>feedback em 90 dias: <b>" + esc(ind.feedback90.texto) + "</b></span>";
    let h = c.cabecalho("rotinas", "Feedbacks", numeros,
      '<button class="btn" data-acao="novo-feedback">' + icone("mais", 15) + " Registrar feedback</button>" +
      (comMensal ? '<button class="btn sec" data-acao="novo-mensal">' + icone("mais", 15) + " Registrar 1:1</button>" : "") +
      '<button class="btn sec" data-acao="novo-plano">' + icone("mais", 15) + " Plano de melhoria</button>");
    h += '<div class="aviso-info" style="margin-bottom:16px">' + esc(RITMO) + "</div>";
    h += cartaoMensal(membros);
    h += cartaoO2O(membros);
    // Feedbacks
    const recentes = [];
    membros.forEach((m) => dom.feedbacksDo(ctx, m.id).forEach((f) => { if (f.data >= calc.addDias(ctx.hoje, -89)) recentes.push(f); }));
    recentes.sort((a, b) => (a.data < b.data ? 1 : -1));
    const fb = ind.feedback90;
    h += '<div class="grade lado" style="margin-top:16px"><div class="card"><h3>Feedbacks SCI dos últimos 90 dias<span class="extra">' + c.tag(ind.equilibrio.texto + " reconhec. : desenv.", ind.equilibrio.cor) + "</span></h3>" +
      (recentes.length ? '<div class="lista">' + recentes.map((f) => {
        const m = dom.infoMembro(ctx, ctx.idx.membro[f.membroId]);
        return '<div class="item clicavel" data-rota="#/rotinas/feedback/' + esc(f.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">Feedback de ' + esc(f.tipo.toLowerCase()) + " · " + esc(m.nome) + '</div><div class="d">' + calc.fmtData(f.data) + " · por " + esc(dom.pessoa(ctx, f.autor || f.criadoPor).nome) + "</div></div>" +
          '<div class="lado">' + (dom.editavel(f.criadoEm, ui.agoraISO()) && f.estagio === "NEW" ? c.tag("Editável", "azul") : "") + "</div></div>";
      }).join("") + "</div>" : c.vazio("Nenhum feedback SCI nos últimos 90 dias.")) + "</div>" +
      '<div class="card"><h3>Sem feedback em 90 dias</h3>' + (fb.faltam.length ? '<div class="lista">' + fb.faltam.map((m0) => {
        const m = dom.infoMembro(ctx, m0);
        const ult = dom.ultimoFeedback(ctx, m.id);
        return '<div class="item">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + (ult ? "último em " + calc.fmtDataAno(ult.data) : "nenhum registrado") + "</div></div>" +
          '<button class="btn peq sec" data-acao="novo-feedback" data-membro="' + esc(m.id) + '">Registrar</button></div>';
      }).join("") + "</div>" : '<div class="vazio">✓ Todos os membros ativos receberam feedback nos últimos 90 dias' + (fb.maisAntigo ? ". O mais antigo é de " + esc(primeiroNome(dom.infoMembro(ctx, fb.maisAntigo.membro).nome)) + ", " + calc.fmtData(fb.maisAntigo.data) : "") + ".</div>") +
      '<p class="muted" style="font-size:12px">Meta do RH: 90% dos membros com pelo menos 1 feedback SCI em 90 dias.</p></div></div>';
    h += cartaoPlanos(membros);
    return h;
  };

  /** 1:1 do mês: quem já teve a conversa breve e quem falta, até o último dia útil do mês */
  function cartaoMensal(membros) {
    const ctx = E().ctx;
    if (!dom.temMensal(ctx)) {
      return '<div class="card"><h3>1:1 do mês</h3><div class="aviso-atencao">O 1:1 mensal usa o processo "1:1 mensais", que ainda não existe no Bitrix. ' +
        (E().eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura".' : "Um administrador do Bitrix precisa criar a estrutura em Configuração no app.") + "</div></div>";
    }
    const s = dom.situacaoMensal(ctx, membros, ctx.hoje);
    const restam = calc.diffDias(ctx.hoje, s.prazo);
    const linhas = s.ativos.map((m0) => {
      const m = dom.infoMembro(ctx, m0);
      return { m, r: dom.mensalNoMes(ctx, m.id, s.mes.chave), ult: dom.mensaisDo(ctx, m.id)[0] };
    }).sort((a, b) => (!!a.r - !!b.r) || a.m.nome.localeCompare(b.m.nome, "pt-BR"));
    const lembrete = s.faltam.length && restam >= 0 && restam <= 7
      ? '<div class="aviso-atencao" style="margin-bottom:10px">' + (restam === 0 ? "Hoje é o último dia útil do mês" : "Faltam " + plural(restam, "dia", "dias") + " para fechar " + esc(s.mes.curto)) + " e " + plural(s.faltam.length, "membro ainda está", "membros ainda estão") + " sem o 1:1.</div>" : "";
    return '<div class="card' + (lembrete ? " acao" : "") + '"><h3>1:1 de ' + esc(s.mes.rotulo) + '<span class="extra muted">' + s.feitos.length + " de " + s.ativos.length + " · até " + calc.fmtData(s.prazo) + "</span></h3>" + lembrete +
      (linhas.length ? '<div class="lista">' + linhas.map((l) => '<div class="item clicavel" data-rota="' + (l.r ? "#/rotinas/mensal/" + esc(l.r.id) : "#/membro/" + esc(l.m.id) + "/mensal") + '">' + c.avatar(l.m, 32) +
        '<div class="principal-item"><div class="t">' + esc(l.m.nome) + '</div><div class="d">' + (l.r ? "registrado em " + calc.fmtData(l.r.data) + " por " + esc(dom.pessoa(ctx, l.r.autor || l.r.criadoPor).nome) : l.ult ? "último em " + calc.fmtDataAno(l.ult.data) : "nenhum 1:1 registrado") + "</div></div>" +
        '<div class="lado">' + (l.r ? c.tag("Feito", "verde") : '<button class="btn peq" data-acao="novo-mensal" data-membro="' + esc(l.m.id) + '">Registrar</button>') + "</div></div>").join("") + "</div>"
        : c.vazio("Nenhum membro ativo na equipe. Membros em onboarding acompanham pelas avaliações do onboarding.")) + "</div>";
  }

  /** O2O do trimestre: a sessão de desenvolvimento, uma por membro ativo no início do trimestre */
  function cartaoO2O(membros) {
    const ctx = E().ctx;
    const linhas = membros.filter((m) => m.estagio === "ATIVO").map((m0) => {
      const m = dom.infoMembro(ctx, m0);
      const cic = dom.cicloDo(ctx, m.id, ctx.tri.chave);
      return { m, cic, s: cic ? dom.statusCiclo(ctx, cic) : null };
    }).sort((a, b) => a.m.nome.localeCompare(b.m.nome, "pt-BR"));
    return '<div class="card" style="margin-top:16px"><h3>O2O do ' + esc(ctx.tri.rotulo) + '<span class="extra muted">sessão de desenvolvimento no início do trimestre, de 45 a 60 minutos</span></h3>' +
      (linhas.length ? '<div class="lista">' + linhas.map((l) => {
        const btn = !l.cic ? '<span class="muted" style="font-size:12px">sem item do ciclo (o RH cria no 1º dia útil)</span>'
          : l.s.acao === "agendar" ? '<button class="btn peq" data-acao="agendar-1a1" data-id="' + esc(l.cic.id) + '">' + icone("calendario", 14) + " Agendar</button>"
          : l.s.acao === "registrar-1a1" || l.s.chave === "agendado" ? '<button class="btn peq ' + (l.s.chave === "agendado" ? "sec" : "") + '" data-acao="registrar-1a1" data-id="' + esc(l.cic.id) + '">Registrar O2O</button>' : "";
        return '<div class="item clicavel" data-rota="' + (l.cic ? "#/rotinas/ciclo/" + esc(l.cic.id) : "#/membro/" + esc(l.m.id)) + '">' + c.avatar(l.m, 34) +
          '<div class="principal-item"><div class="t">' + esc(l.m.nome) + '</div><div class="d">' + (l.cic && l.cic.link1a1 ? esc(l.cic.link1a1) : esc(l.m.funcao || "")) + "</div></div>" +
          '<div class="lado">' + (l.s ? c.tag(l.s.texto, l.s.cor) + (l.s.prazo && l.s.cor !== "azul" && l.s.cor !== "verde" ? c.prazo(l.s.prazo) : "") : "") + btn + "</div></div>";
      }).join("") + "</div>" : c.vazio("Nenhum membro ativo na equipe. Membros em onboarding entram no O2O no trimestre seguinte ao Dia 90.")) + "</div>";
  }

  /** Planos de melhoria das pessoas que a visão enxerga: os em andamento primeiro */
  function cartaoPlanos(membros) {
    const ctx = E().ctx;
    const ids = {};
    membros.forEach((m) => { ids[m.id] = true; });
    const planos = (ctx.registros.planos || []).filter((p) => ids[p.membroId] || E().visao === "rh")
      .map((p) => ({ p, s: dom.statusPlano(ctx, p), m: dom.infoMembro(ctx, ctx.idx.membro[p.membroId] || {}) }))
      .sort((a, b) => (b.s.ativo - a.s.ativo) || (a.p.inicio < b.p.inicio ? 1 : -1));
    return '<div class="card" style="margin-top:16px"><h3>Planos de melhoria<span class="extra muted">plano de alinhamento de resultados, 60 dias</span></h3>' +
      (planos.length ? '<div class="lista">' + planos.map((x) => '<div class="item clicavel" data-rota="#/rotinas/plano/' + esc(x.p.id) + '">' + c.avatar(x.m, 30) +
        '<div class="principal-item"><div class="t">' + esc(x.m.nome) + '</div><div class="d">desde ' + calc.fmtData(x.p.inicio) + " · término " + calc.fmtData(x.s.termino) + "</div></div>" +
        '<div class="lado">' + c.tag(x.s.texto, x.s.cor) + "</div></div>").join("") + "</div>" : c.vazio("Nenhum plano de melhoria.")) + "</div>";
  }

  /* ================================================================ 1:1 MENSAL (reunião de 29/10/2026) */
  function mensalHtml(r) {
    const ctx = E().ctx;
    return '<div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="color:var(--navy)"><a href="#/rotinas/mensal/' + esc(r.id) + '">1:1 de ' + esc(calc.mesDe(r.data || ctx.hoje).curto) + "</a></b>" +
      '<span class="muted">' + calc.fmtDataAno(r.data) + " · por " + esc(dom.pessoa(ctx, r.autor || r.criadoPor).nome) + "</span></div>" +
      '<div class="sci">' + c.textoRegistro("Como o membro está", r.comoEsta) + c.textoRegistro("Precisa de apoio", r.apoio) + c.textoRegistro("Principais pontos", r.pontos) + c.textoRegistro("Combinados", r.combinados) +
      (r.adendos ? '<div><div class="k">Adendos</div><div class="adendo">' + esc(r.adendos) + "</div></div>" : "") + "</div></div>";
  }
  function telaMensal(id) {
    const ctx = E().ctx;
    const r = ctx.idx.porId.mensal && ctx.idx.porId.mensal[id];
    if (!r) return c.voltar("#/rotinas", "Feedbacks") + '<div class="card">' + c.vazio("1:1 não encontrado.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[r.membroId] || {});
    const podeEditar = dom.editavel(r.criadoEm, ui.agoraISO());
    const acoes = (podeEditar ? '<button class="btn sec" data-acao="editar-mensal" data-id="' + esc(r.id) + '">Editar</button>' : '<button class="btn sec" data-acao="adendo" data-chave="mensal" data-id="' + esc(r.id) + '">Adicionar adendo</button>') +
      c.botaoExcluir("mensal", r, { volta: "#/membro/" + m.id + "/mensal", descricao: "o 1:1 de " + calc.fmtDataAno(r.data) + " de " + m.nome });
    return c.voltar("#/membro/" + esc(m.id) + "/mensal", "1:1 de " + primeiroNome(m.nome)) +
      '<div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap">' + c.pessoa(m, esc(m.funcao || ""), 40) + '<div style="margin-left:auto;display:flex;gap:8px">' + acoes + "</div></div>" +
      mensalHtml(r) + '<p class="muted" style="font-size:12px;margin-top:16px">' + icone("cadeado", 13) + " " + (podeEditar ? "Editável por 48 horas depois de registrado." : "Somente leitura: o prazo de 48 horas para edição terminou. Correções entram como adendo, com justificativa.") + "</p></div>";
  }
  function formMensal(r, membroId) {
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao().map((m) => dom.infoMembro(ctx, m)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const v = r || { data: ctx.hoje };
    return '<div id="form-mensal" data-limpo="0">' +
      (r ? '<input type="hidden" name="membroId" value="' + esc(r.membroId) + '">' : c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })), valor: membroId })) +
      '<div class="linha-campos">' + c.campo({ nome: "data", rotulo: "Data em que aconteceu", tipo: "data", valor: v.data, max: ctx.hoje }) + "<div></div></div>" +
      '<div class="aviso-info" style="margin-bottom:14px">' + esc(AVISO_REGISTRO) + "</div>" +
      c.campo({ nome: "comoEsta", rotulo: "Como o membro está", tipo: "textoLongo", valor: v.comoEsta, linhas: 2, ajuda: "No trabalho: carga, ritmo, clima com a equipe." }) +
      c.campo({ nome: "apoio", rotulo: "Precisa de apoio em algo?", tipo: "textoLongo", valor: v.apoio, linhas: 2, opcional: true }) +
      c.campo({ nome: "pontos", rotulo: "Principais pontos da conversa", tipo: "textoLongo", valor: v.pontos }) +
      c.campo({ nome: "combinados", rotulo: "Combinados", tipo: "textoLongo", valor: v.combinados, linhas: 2, opcional: true }) + "</div>";
  }
  function abrirFormMensal(membroId) {
    if (!dom.temMensal(E().ctx)) { ui.avisar("O 1:1 mensal ainda não está ligado no Bitrix (falta criar o processo em Configuração).", "erro"); return; }
    ui.abrirPainel({
      titulo: "Registrar 1:1", sub: "A conversa breve do mês. Fica editável por 48 horas depois de registrada.", corpo: formMensal(null, membroId), largo: true,
      rodape: '<button class="btn" data-acao="salvar-mensal">Registrar o 1:1</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  }
  ui.acoes["novo-mensal"] = function (el) { abrirFormMensal(el.dataset.membro || ""); };
  ui.acoes["editar-mensal"] = function (el) {
    const r = E().ctx.idx.porId.mensal[el.dataset.id];
    ui.abrirPainel({ titulo: "Editar o 1:1", corpo: formMensal(r), largo: true, rodape: '<button class="btn" data-acao="salvar-mensal" data-id="' + esc(r.id) + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>' });
  };
  ui.acoes["salvar-mensal"] = function (el) {
    const form = document.getElementById("form-mensal");
    if (!ui.validar(form, ["membroId", "data", "comoEsta", "pontos"])) return;
    const d = ui.lerForm(form);
    const ctx = E().ctx;
    if (d.data > ctx.hoje) { ui.erroNoPainel("A data em que aconteceu não pode ser futura."); return; }
    const dados = { data: d.data, comoEsta: d.comoEsta.trim(), apoio: (d.apoio || "").trim(), pontos: d.pontos.trim(), combinados: (d.combinados || "").trim() };
    const id = el.dataset.id;
    if (id) {
      const r = ctx.idx.porId.mensal[id];
      if (!dom.editavel(r.criadoEm, ui.agoraISO())) { ui.erroNoPainel("O prazo de 48 horas terminou. Use um adendo."); return; }
      ui.salvar(el, () => ui.atualizar("mensal", id, dados), { mensagem: "1:1 atualizado." });
      return;
    }
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    const ja = dom.mensalNoMes(ctx, m.id, d.data.slice(0, 7));
    if (ja && !window.confirm(primeiroNome(m.nome) + " já tem um 1:1 registrado em " + calc.mesDe(d.data).rotulo + " (" + calc.fmtData(ja.data) + "). Registrar outro mesmo assim?")) return;
    ui.salvar(el, () => ui.criar("mensal", Object.assign(dados, {
      titulo: "1:1 de " + calc.mesDe(d.data).curto + " · " + m.nome, membroId: m.id, responsavel: m.responsavel, autor: E().eu.id, estagio: "NEW",
    })), { mensagem: "1:1 registrado. Fica editável por 48 horas." });
  };

  /* ================================================================ FEEDBACK SCI */
  function feedbackHtml(f, comLink) {
    const ctx = E().ctx;
    const autor = dom.pessoa(ctx, f.autor || f.criadoPor).nome;
    return '<div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="color:var(--navy)">' + (comLink ? '<a href="#/rotinas/feedback/' + esc(f.id) + '">' : "") + "Feedback de " + esc(f.tipo.toLowerCase()) + (comLink ? "</a>" : "") + "</b>" +
      '<span class="muted">' + calc.fmtDataAno(f.data) + " · por " + esc(autor) + "</span>" + (f.retroativo ? c.tag("Registro retroativo", "cinza") : "") + "</div>" +
      '<div class="sci">' + c.textoRegistro("Situação", f.situacao) + c.textoRegistro("Comportamento", f.comportamento) + c.textoRegistro("Impacto", f.impacto) + c.textoRegistro("Combinados", f.combinados) +
      (f.adendos ? '<div><div class="k">Adendos</div><div class="adendo">' + esc(f.adendos) + "</div></div>" : "") + "</div></div>";
  }
  function telaFeedback(id) {
    const ctx = E().ctx;
    const f = ctx.idx.porId.feedbacks[id];
    if (!f) return c.voltar("#/rotinas", "Feedbacks") + '<div class="card">' + c.vazio("Feedback não encontrado.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[f.membroId] || {});
    const podeEditar = f.estagio === "NEW" && dom.editavel(f.criadoEm, ui.agoraISO());
    const ate = f.criadoEm ? new Date(Date.parse(f.criadoEm) + 48 * 3600 * 1000) : null;
    return c.voltar("#/membro/" + esc(m.id) + "/feedbacks", "Feedbacks de " + primeiroNome(m.nome)) +
      '<div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + c.pessoa(m, esc(m.funcao || ""), 40) + '<div style="margin-left:auto;display:flex;gap:8px">' +
      (podeEditar ? '<button class="btn sec" data-acao="editar-feedback" data-id="' + esc(f.id) + '">Editar</button>' : '<button class="btn sec" data-acao="adendo" data-chave="feedbacks" data-id="' + esc(f.id) + '">Adicionar adendo</button>') +
      c.botaoExcluir("feedbacks", f, { volta: "#/membro/" + m.id + "/feedbacks", descricao: "o feedback de " + String(f.tipo || "").toLowerCase() + " de " + calc.fmtDataAno(f.data) + " de " + m.nome }) + "</div></div>" +
      feedbackHtml(f, false) + '<p class="muted" style="font-size:12px;margin-top:16px">' + icone("cadeado", 13) + " " +
      (podeEditar && ate ? "Editável até " + calc.fmtData(ate.toISOString().slice(0, 10)) + " às " + String(ate.getHours()).padStart(2, "0") + ":" + String(ate.getMinutes()).padStart(2, "0") + ". Depois, somente leitura." : "Somente leitura: o prazo de 48 horas para edição terminou. Correções entram como adendo, com justificativa.") + "</p></div>";
  }
  function formFeedback(f, membroId, tipo) {
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao().map((m) => dom.infoMembro(ctx, m)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const rh = E().visao === "rh";
    const v = f || { data: ctx.hoje, tipo: tipo || "" };
    return '<div id="form-feedback" data-limpo="0">' +
      (f ? '<input type="hidden" name="membroId" value="' + esc(f.membroId) + '">' : c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })), valor: membroId })) +
      '<div class="linha-campos">' + c.campo({ nome: "data", rotulo: "Data em que aconteceu", tipo: "data", valor: v.data, max: ctx.hoje, ajuda: "O feedback entra no trimestre desta data." }) + "<div></div></div>" +
      c.campo({ nome: "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: dom.TIPOS_FEEDBACK_REGISTRO.concat(f && dom.TIPOS_FEEDBACK_REGISTRO.indexOf(f.tipo) < 0 ? [f.tipo] : []).map((t) => ({ valor: t, rotulo: t === "Reconhecimento" ? "Feedback de reconhecimento" : t === "Desenvolvimento" ? "Feedback de desenvolvimento" : t })), valor: v.tipo }) +
      '<details class="modelos"><summary>Ver os 4 modelos de feedback SCI</summary>' + MODELOS_SCI.map((mo) => '<div class="modelo"><b>' + esc(mo.t) + "</b><br><b>S</b> " + esc(mo.s) + "<br><b>C</b> " + esc(mo.c) + "<br><b>I</b> " + esc(mo.i) + (mo.p ? "<br>" + esc(mo.p) : "") + "</div>").join("") + "</details>" +
      '<div class="aviso-info" style="margin-bottom:14px">' + esc(AVISO_REGISTRO) + "</div>" +
      c.campo({ nome: "situacao", rotulo: "Situação", tipo: "textoLongo", valor: v.situacao, ajuda: "Quando e onde aconteceu. Só os fatos.", linhas: 2 }) +
      c.campo({ nome: "comportamento", rotulo: "Comportamento", tipo: "textoLongo", valor: v.comportamento, ajuda: "O que a pessoa fez ou disse, de um jeito que outra pessoa também observaria." }) +
      c.campo({ nome: "impacto", rotulo: "Impacto", tipo: "textoLongo", valor: v.impacto, ajuda: "O efeito no resultado, na equipe ou no cliente." }) +
      c.campo({ nome: "combinados", rotulo: "Combinados", tipo: "textoLongo", valor: v.combinados, opcional: true, linhas: 2 }) +
      (rh && !f ? '<div class="grupo-form"><div class="rotulo-grupo">Só o RH</div>' + c.campo({ nome: "retroativo", rotulo: "Registro retroativo", tipo: "simNao", textoCheck: "Feedback dado antes do app (exige a evidência original)" }) +
        c.campo({ nome: "evidencia", rotulo: "Evidência original", tipo: "arquivo", multiplo: true, opcional: true, ajuda: "E-mail, ata ou documento. Sem anexo, o retroativo não conta para a trava do encerramento." }) + "</div>" : "") +
      '<div id="revisao-sci"></div></div>';
  }
  function abrirFormFeedback(membroId, tipo) {
    ui.abrirPainel({
      titulo: "Registrar feedback", sub: "Situação, Comportamento e Impacto. Editável por 48 horas depois de registrado.",
      corpo: formFeedback(null, membroId, tipo), largo: true,
      rodape: '<button class="btn" data-acao="salvar-feedback">Registrar feedback</button><button class="btn sec" data-acao="revisar-feedback">Revisar o texto</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  }
  ui.acoes["novo-feedback"] = function (el) { abrirFormFeedback(el.dataset.membro || "", el.dataset.tipo || ""); };
  ui.acoes["editar-feedback"] = function (el) {
    const f = E().ctx.idx.porId.feedbacks[el.dataset.id];
    ui.abrirPainel({ titulo: "Editar feedback SCI", corpo: formFeedback(f), largo: true, rodape: '<button class="btn" data-acao="salvar-feedback" data-id="' + esc(f.id) + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>' });
  };
  ui.acoes["revisar-feedback"] = function () {
    const d = ui.lerForm(document.getElementById("form-feedback"));
    const achados = revisarTexto({ Situação: d.situacao, Comportamento: d.comportamento, Impacto: d.impacto, Combinados: d.combinados });
    const el = document.getElementById("revisao-sci");
    el.innerHTML = achados.length ? '<div class="aviso-atencao"><b>Pontos para revisar</b> (você decide: aceitar, editar ou ignorar)<ul style="margin:6px 0 0;padding-left:18px">' +
      achados.map((a) => "<li><b>" + esc(a.campo) + "</b>: \"" + esc(a.trecho) + "\". " + esc(a.dica) + "</li>").join("") + "</ul></div>"
      : '<div class="aviso-info">✓ Nenhum julgamento, generalização ou tema pessoal encontrado no texto.</div>';
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  async function arquivosParaBitrix(arquivos) {
    const lista = [];
    for (const a of arquivos || []) {
      if (a.size > 15 * 1024 * 1024) throw { descricao: "o arquivo " + a.name + " passa de 15 MB" };
      lista.push([a.name, await lerBase64(a)]);
    }
    return lista;
  }
  function lerBase64(arquivo) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result || ""); ok(s.slice(s.indexOf(",") + 1)); };
      r.onerror = () => falha({ descricao: "não consegui ler o arquivo " + arquivo.name });
      r.readAsDataURL(arquivo);
    });
  }
  ui.acoes["salvar-feedback"] = function (el) {
    const form = document.getElementById("form-feedback");
    if (!ui.validar(form, ["membroId", "data", "tipo", "situacao", "comportamento", "impacto"])) return;
    const d = ui.lerForm(form);
    const ctx = E().ctx;
    if (d.data > ctx.hoje) { ui.erroNoPainel("A data em que aconteceu não pode ser futura."); return; }
    if (d.retroativo && !(d.evidencia && d.evidencia.length)) {
      if (!window.confirm("Registro retroativo sem anexo não conta para a trava do encerramento (5.1). Registrar mesmo assim?")) return;
    }
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    const id = el.dataset.id;
    const dados = { data: d.data, tipo: d.tipo, situacao: d.situacao.trim(), comportamento: d.comportamento.trim(), impacto: d.impacto.trim(), combinados: (d.combinados || "").trim() };
    if (id) {
      const f = ctx.idx.porId.feedbacks[id];
      if (!dom.editavel(f.criadoEm, ui.agoraISO())) { ui.erroNoPainel("O prazo de 48 horas terminou. Use um adendo."); return; }
      ui.salvar(el, () => ui.atualizar("feedbacks", id, dados), { mensagem: "Feedback atualizado." });
      return;
    }
    ui.salvar(el, async () => {
      const novo = await ui.criar("feedbacks", Object.assign(dados, {
        titulo: "Feedback de " + d.tipo.toLowerCase() + " · " + m.nome, membroId: m.id, responsavel: m.responsavel,
        autor: E().eu.id, estagio: "NEW", retroativo: !!d.retroativo, evidencia: d.evidencia && d.evidencia.length ? await arquivosParaBitrix(d.evidencia) : undefined,
      }));
      return novo;
    }, { mensagem: "Feedback registrado. Fica editável por 48 horas." });
  };

  /* ---------------- adendo (4.1): serve para qualquer registro travado ---------------- */
  ui.acoes["adendo"] = function (el) {
    ui.abrirPainel({
      titulo: "Adicionar adendo", sub: "O registro original continua visível. O adendo leva data, autor e justificativa.",
      corpo: '<div id="form-adendo">' + c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo", linhas: 2, ajuda: "Por que a correção é necessária." }) +
        c.campo({ nome: "texto", rotulo: "Correção ou complemento", tipo: "textoLongo" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-adendo" data-chave="' + esc(el.dataset.chave) + '" data-id="' + esc(el.dataset.id) + '">Adicionar adendo</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-adendo"] = function (el) {
    const f = document.getElementById("form-adendo");
    if (!ui.validar(f, ["justificativa", "texto"])) return;
    const d = ui.lerForm(f);
    const item = E().ctx.idx.porId[el.dataset.chave][el.dataset.id];
    ui.salvar(el, () => ui.atualizar(el.dataset.chave, item.id, { adendos: ui.novoAdendo(item.adendos, d.justificativa, d.texto) }), { mensagem: "Adendo registrado." });
  };

  /* ================================================================ CICLO: 1:1 E PAUTA */
  function cicloResumoHtml(ci, compacto) {
    const ctx = E().ctx;
    const t = calc.trimestrePorChave(ci.trimestre) || { rotulo: ci.trimestre };
    const s = dom.statusCiclo(ctx, ci);
    const comb = dom.combinados(ci);
    return '<div class="card"><h3>' + esc(t.rotulo) + '<span class="extra">' + c.tag(s.texto, s.cor) + "</span></h3>" +
      (ci.realizadoEm ? '<div class="sci">' + c.dados([["O2O em", calc.fmtDataAno(ci.realizadoEm)], ["Próximo nível", ci.proximoNivel], ["Progresso no objetivo", ci.progresso], ["Classificação do trimestre", ci.classificacao]]) +
        c.textoRegistro("Objetivo de desenvolvimento", ci.objetivo) + c.textoRegistro("Temas trazidos pelo membro", ci.temas) + c.textoRegistro("Retorno para a liderança", ci.retorno) +
        (comb.length ? '<div><div class="k">Combinados para o próximo trimestre</div>' + comb.map((x) => "<div>• " + esc(x.texto) + ' <span class="muted">(' + esc(x.resp || "") + (x.prazo ? ", até " + calc.fmtData(x.prazo) : "") + ")</span></div>").join("") + "</div>" : "") +
        c.textoRegistro("Resultados do trimestre", ci.resultados) + c.textoRegistro("Evidências de crescimento", ci.crescimento) + c.textoRegistro("Percepções da liderança", ci.percepcoes) + c.textoRegistro("Pontos de atenção", ci.pontosAtencao) +
        (ci.adendos ? '<div><div class="k">Adendos</div><div class="adendo">' + esc(ci.adendos) + "</div></div>" : "") + "</div>"
        : '<div class="muted">' + (ci.data1a1 ? "O2O agendado para " + calc.fmtDataAno(ci.data1a1) + (ci.link1a1 ? " · " + esc(ci.link1a1) : "") : "O2O ainda sem data.") + "</div>") +
      (compacto ? "" : '<div style="margin-top:12px"><a href="#/rotinas/ciclo/' + esc(ci.id) + '">Abrir o O2O →</a></div>') + "</div>";
  }
  function telaCiclo(id) {
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[id];
    if (!ci) return c.voltar("#/rotinas", "Feedbacks") + '<div class="card">' + c.vazio("Item do ciclo não encontrado.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId] || {});
    const s = dom.statusCiclo(ctx, ci);
    const t = calc.trimestrePorChave(ci.trimestre);
    const travado1a1 = ci.registro1a1Em && !dom.editavel(ci.registro1a1Em, ui.agoraISO());
    let acoes = "";
    if (!ci.realizadoEm) acoes += '<button class="btn ' + (ci.data1a1 ? "sec" : "") + '" data-acao="agendar-1a1" data-id="' + esc(ci.id) + '">' + icone("calendario", 15) + (ci.data1a1 ? " Remarcar" : " Agendar o O2O") + "</button>";
    if (ci.data1a1 && !ci.realizadoEm) acoes += '<button class="btn" data-acao="registrar-1a1" data-id="' + esc(ci.id) + '">Registrar o O2O</button>';
    if (ci.realizadoEm && !travado1a1) acoes += '<button class="btn sec" data-acao="registrar-1a1" data-id="' + esc(ci.id) + '">Editar o O2O</button>';
    if (ci.realizadoEm && travado1a1) acoes += '<button class="btn sec" data-acao="adendo" data-chave="ciclo" data-id="' + esc(ci.id) + '">Adicionar adendo</button>';
    acoes += c.botaoExcluir("ciclo", ci, { volta: "#/rotinas", descricao: "o O2O de " + m.nome + " do " + (t ? t.rotulo : ci.trimestre) });
    if (dom.DESEMPENHO_ATIVO && ci.realizadoEm && ci.estagio !== "SUCCESS" && t && ctx.hoje > calc.addDias(t.fim, -14)) acoes += '<a class="btn" href="#/desempenho/ciclo/' + esc(ci.id) + '">Registrar evidências</a>';
    return c.voltar("#/rotinas", "Feedbacks") + c.cabecalho("rotinas", "O2O de " + m.nome, "<span>" + esc(t ? t.rotulo : ci.trimestre) + "</span><span>" + c.tag(s.texto, s.cor) + "</span>" + (s.prazo ? "<span>" + c.prazo(s.prazo) + "</span>" : ""), acoes) +
      (ci.realizadoEm ? "" : pautaHtml(ci, m)) + cicloResumoHtml(ci, true);
  }
  /** Pauta automática do 1:1 (3.3.1): só leitura, sem digitação */
  function pautaHtml(ci, m) {
    const ctx = E().ctx;
    const ant = dom.cicloAnterior(ctx, ci);
    const t = calc.trimestrePorChave(ci.trimestre);
    const combAnt = ant ? dom.combinados(ant) : [];
    const desdeO2O = ant && ant.realizadoEm ? ant.realizadoEm : calc.addDias(t ? t.inicio : ctx.hoje, -92);
    const mensais = dom.mensaisDo(ctx, m.id).filter((r) => r.data >= desdeO2O).slice(0, 4);
    const fbs = dom.feedbacksDo(ctx, m.id).filter((f) => t && f.data >= (ant ? calc.trimestrePorChave(ant.trimestre).inicio : t.inicio) && f.data <= t.fim);
    const plano = dom.planoAtivoDo(ctx, m.id);
    const objetivo = ci.objetivo || (ant && ant.objetivo) || "";
    const prox = ci.proximoNivel || (ant && ant.proximoNivel) || "";
    return '<div class="card"><h3>Pauta do O2O<span class="extra muted">montada a partir dos registros</span></h3>' +
      (plano ? '<div class="aviso-atencao" style="margin-bottom:12px">' + esc(primeiroNome(m.nome)) + " está em plano de melhoria. O andamento do plano é tratado no check-in do plano; o O2O fica para o desenvolvimento.</div>" : "") +
      '<div class="grade c2"><div>' +
      '<div class="rotulo-grupo" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);font-weight:700;margin-bottom:6px">1. Temas enviados pelo membro</div>' +
      (ci.temas ? '<div class="aviso-info" style="margin-bottom:14px">' + esc(ci.temas) + "</div>" : '<p class="muted" style="margin-top:0">Ainda sem temas. Peça ao membro 2 ou 3 temas uma semana antes do O2O.</p>') +
      '<div class="rotulo-grupo" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);font-weight:700;margin:6px 0">2. Combinados do último O2O</div>' +
      (combAnt.length ? combAnt.map((x) => "<div>• " + esc(x.texto) + ' <span class="muted">(' + esc(x.resp || "") + (x.prazo ? ", até " + calc.fmtData(x.prazo) : "") + ")</span></div>").join("") : '<p class="muted" style="margin-top:0">Nenhum combinado anterior.</p>') +
      '</div><div><div class="rotulo-grupo" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);font-weight:700;margin-bottom:6px">3. 1:1 desde o último O2O</div>' +
      (mensais.length ? mensais.map((r) => '<div>• <a href="#/rotinas/mensal/' + esc(r.id) + '">1:1 de ' + calc.fmtData(r.data) + "</a>" + (r.combinados ? ' <span class="muted">· combinados: ' + esc(r.combinados) + "</span>" : "") + "</div>").join("") : '<p class="muted" style="margin-top:0">Nenhum 1:1 mensal registrado no período.</p>') +
      '<div class="rotulo-grupo" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);font-weight:700;margin:6px 0">4. Feedbacks SCI do período</div>' +
      (fbs.length ? fbs.map((f) => '<div>• <a href="#/rotinas/feedback/' + esc(f.id) + '">Feedback de ' + esc(f.tipo.toLowerCase()) + "</a> · " + calc.fmtData(f.data) + "</div>").join("") : '<p class="muted" style="margin-top:0">Nenhum no período.</p>') +
      '<div class="rotulo-grupo" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);font-weight:700;margin:10px 0 6px">5. Objetivo de desenvolvimento</div>' +
      (objetivo ? esc(objetivo) + (prox ? ' <span class="muted">· próximo nível: ' + esc(prox) + "</span>" : "") : '<span class="muted">A definir neste O2O.</span>') + "</div></div>" +
      '<details class="modelos" style="margin:16px 0 0"><summary>Roteiro sugerido (45 a 60 minutos)</summary><div class="modelo">Temas do membro e como a pessoa está (10 min) · o trimestre que passou, a partir dos 1:1 e dos feedbacks (10 min) · desenvolvimento e próximo passo na carreira (20 min) · retorno para a liderança (5 min) · combinados (5 min).</div></details></div>';
  }

  /* ---------------- agendar o 1:1 ---------------- */
  ui.acoes["agendar-1a1"] = function (el) {
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId]);
    // ausências: as que o RH registrou em Férias e ausências (o calendário do Bitrix não é usado)
    const aus = dom.ausenciasAprovadas(ctx).filter((a) => a.pessoa === m.userId && a.fim >= ctx.hoje);
    ui.abrirPainel({
      titulo: "Agendar o O2O de " + m.nome, sub: "Ao agendar, peça ao membro 2 ou 3 temas, uma semana antes.",
      corpo: '<div id="form-agenda">' + (aus.length ? '<div class="aviso-atencao" style="margin-bottom:14px">' + esc(primeiroNome(m.nome)) + " estará fora: " + aus.map((a) => calc.fmtData(a.inicio) + " a " + calc.fmtData(a.fim)).join(", ") + ".</div>" : "") +
        '<div class="linha-campos">' + c.campo({ nome: "data1a1", rotulo: "Data", tipo: "data", valor: ci.data1a1, min: ctx.hoje }) + c.campo({ nome: "hora", rotulo: "Horário", tipo: "hora", valor: "", opcional: true }) + "</div>" +
        c.campo({ nome: "link1a1", rotulo: "Local ou link", valor: ci.link1a1, opcional: true, placeholder: "Ex.: Google Meet, sala 3" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-agenda-1a1" data-id="' + esc(ci.id) + '">Agendar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-agenda-1a1"] = function (el) {
    const f = document.getElementById("form-agenda");
    if (!ui.validar(f, ["data1a1"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId]);
    const t = calc.trimestrePorChave(ci.trimestre);
    if (t && d.data1a1 > t.fim && !window.confirm("A data fica depois do fim do trimestre (" + calc.fmtData(t.fim) + "). Agendar mesmo assim?")) return;
    const link = [d.hora, d.link1a1].filter(Boolean).join(" · ");
    ui.salvar(el, () => ui.atualizar("ciclo", ci.id, { data1a1: d.data1a1, link1a1: link, estagio: "AGENDADO" }), { mensagem: "O2O agendado para " + calc.fmtData(d.data1a1) + "." });
  };

  /* ---------------- registrar o 1:1 ---------------- */
  ui.acoes["registrar-1a1"] = function (el) {
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId]);
    const ant = dom.cicloAnterior(ctx, ci);
    const combAnt = ant ? dom.combinados(ant) : [];
    const niveis = (E().config && E().config.niveis) || [];
    const v = ci.realizadoEm ? ci : { realizadoEm: ci.data1a1 && ci.data1a1 <= ctx.hoje ? ci.data1a1 : ctx.hoje, objetivo: ant ? ant.objetivo : "", proximoNivel: ant ? ant.proximoNivel : "", temas: ci.temas };
    let corpo = '<div id="form-1a1"><div class="aviso-info" style="margin-bottom:14px">' + esc(AVISO_REGISTRO) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "realizadoEm", rotulo: "Data em que aconteceu", tipo: "data", valor: v.realizadoEm, max: ctx.hoje }) + "<div></div></div>";
    if (combAnt.length) {
      corpo += '<div class="grupo-form"><div class="rotulo-grupo">Combinados do O2O anterior</div>' + combAnt.map((x, i) =>
        c.campo({ nome: "anterior" + (i + 1), rotulo: x.texto, tipo: "escolha", opcoes: op.combinadoAnterior, valor: ci["anterior" + (i + 1)] })).join("") + "</div>";
    }
    corpo += '<div class="grupo-form"><div class="rotulo-grupo">Desenvolvimento</div>' +
      c.campo({ nome: "temas", rotulo: "Temas trazidos pelo membro", tipo: "textoLongo", valor: v.temas, opcional: true, linhas: 2 }) +
      c.campo({ nome: "objetivo", rotulo: "Objetivo de desenvolvimento", tipo: "textoLongo", valor: v.objetivo, ajuda: "Ligado ao próximo nível da Arquitetura de Cargos.", linhas: 2 }) +
      '<div class="linha-campos">' + (niveis.length ? c.campo({ nome: "proximoNivel", rotulo: "Próximo nível", tipo: "lista", opcoes: niveis, valor: v.proximoNivel }) : c.campo({ nome: "proximoNivel", rotulo: "Próximo nível", valor: v.proximoNivel })) +
      c.campo({ nome: "progresso", rotulo: "Progresso no objetivo", tipo: "lista", opcoes: op.progresso, valor: v.progresso }) + "</div>" +
      c.campo({ nome: "retorno", rotulo: "Retorno para a liderança", tipo: "textoLongo", valor: v.retorno, opcional: true, ajuda: "O que o membro pediu para a liderança fazer diferente.", linhas: 2 }) + "</div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">Combinados para o próximo trimestre (pelo menos 1, até 3)</div>' +
      [1, 2, 3].map((n) => '<div class="linha-campos" style="grid-template-columns:2fr 1fr 1fr">' + c.campo({ nome: "comb" + n + "Texto", rotulo: "Combinado " + n, valor: v["comb" + n + "Texto"], opcional: n > 1 }) +
        c.campo({ nome: "comb" + n + "Resp", rotulo: "Responsável", tipo: "lista", opcoes: op.responsavelCombinado, valor: v["comb" + n + "Resp"] }) +
        c.campo({ nome: "comb" + n + "Prazo", rotulo: "Prazo", tipo: "data", valor: v["comb" + n + "Prazo"] }) + "</div>").join("") + "</div></div>";
    ui.abrirPainel({
      titulo: "Registro do O2O de " + m.nome, sub: "Fica editável por 48 horas depois de salvo.", corpo, largo: true,
      rodape: '<button class="btn" data-acao="salvar-1a1" data-id="' + esc(ci.id) + '" data-qtd-anteriores="' + combAnt.length + '">Salvar o registro</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-1a1"] = function (el) {
    const f = document.getElementById("form-1a1");
    const n = Number(el.dataset.qtdAnteriores || 0);
    const obrig = ["realizadoEm", "objetivo", "proximoNivel", "progresso", "comb1Texto", "comb1Resp", "comb1Prazo"];
    for (let i = 1; i <= n; i++) obrig.push("anterior" + i);
    if (!ui.validar(f, obrig)) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[el.dataset.id];
    if (d.realizadoEm > ctx.hoje) { ui.erroNoPainel("A data do O2O não pode ser futura."); return; }
    for (const k of [2, 3]) {
      if (d["comb" + k + "Texto"] && (!d["comb" + k + "Resp"] || !d["comb" + k + "Prazo"])) { ui.erroNoPainel("Combinado " + k + ": informe o responsável e o prazo."); return; }
    }
    const ant = dom.cicloAnterior(ctx, ci);
    const snapshot = ant ? dom.combinados(ant).map((x, i) => (i + 1) + ". " + x.texto + " (" + (x.resp || "") + (x.prazo ? ", até " + calc.fmtData(x.prazo) : "") + ") — " + (d["anterior" + (i + 1)] || "")).join("\n") : "";
    const dados = {
      realizadoEm: d.realizadoEm, temas: d.temas, objetivo: d.objetivo, proximoNivel: d.proximoNivel, progresso: d.progresso, retorno: d.retorno,
      anterior1: d.anterior1 || "", anterior2: d.anterior2 || "", anterior3: d.anterior3 || "", combinadosAnteriores: snapshot,
      autor: E().eu.id, estagio: ci.estagio === "SUCCESS" ? "SUCCESS" : "REALIZADO",
    };
    [1, 2, 3].forEach((k) => { dados["comb" + k + "Texto"] = d["comb" + k + "Texto"] || ""; dados["comb" + k + "Resp"] = d["comb" + k + "Texto"] ? d["comb" + k + "Resp"] : ""; dados["comb" + k + "Prazo"] = d["comb" + k + "Texto"] ? d["comb" + k + "Prazo"] : ""; });
    if (!ci.registro1a1Em) dados.registro1a1Em = ui.agoraISO();
    if (!ci.data1a1) dados.data1a1 = d.realizadoEm;
    ui.salvar(el, () => ui.atualizar("ciclo", ci.id, dados), { mensagem: "O2O registrado." });
  };

  GP.telas = GP.telas || {};
  GP.telas.rotinas = { feedbackHtml, cicloResumoHtml, mensalHtml, abrirFormFeedback, abrirFormMensal, revisarTexto, MODELOS_SCI, lerBase64, arquivosParaBitrix };
})(window);
