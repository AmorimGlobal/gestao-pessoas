/* =====================================================================================
   TELAS — Agenda da equipe (3.6): ausências, aniversários e feriados das próximas 13 semanas
   -------------------------------------------------------------------------------------
   Regras: só ausências confirmadas; o motivo nunca aparece; aniversário só com dia e mês;
   feriado local só na linha de quem o tem (SP ou BA pela cidade de referência).
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;

  function pessoasDaAgenda() {
    const ctx = E().ctx;
    const pessoas = ui.membrosDaVisao().map((m) => dom.infoMembro(ctx, m));
    // A equipe inclui a liderança (4.5: "membros da equipe, incluindo a liderança")
    if (E().visao !== "rh") {
      const eu = dom.pessoa(ctx, E().eu.id);
      const meuItem = ctx.idx.membroPorUsuario[E().eu.id];
      pessoas.unshift(Object.assign({}, eu, { userId: eu.id, cidadeSigla: meuItem && /BA/.test(meuItem.cidade || "") ? "BA" : "SP", ehLideranca: true }));
    }
    return pessoas;
  }

  ui.rotas.agenda = function () {
    const ctx = E().ctx;
    const pessoas = pessoasDaAgenda();
    const ag = dom.agendaEquipe(ctx, pessoas, { inicio: ctx.hoje, semanas: 13, liderancaId: E().visao !== "rh" ? E().eu.id : null });
    const dias = calc.diffDias(ag.inicio, ag.fim) + 1;
    const pos = (d) => Math.max(0, Math.min(100, (calc.diffDias(ag.inicio, d) / dias) * 100));
    const larg = (a, b) => Math.max(0.8, ((calc.diffDias(a < ag.inicio ? ag.inicio : a, b > ag.fim ? ag.fim : b) + 1) / dias) * 100);
    let h = c.cabecalho("agenda", "Agenda da equipe", "<span>próximas 13 semanas · " + calc.fmtData(ag.inicio) + " a " + calc.fmtData(ag.fim) + "</span>",
      E().repo.modo === "bitrix" ? '<button class="btn sec" data-acao="abrir-calendario">' + icone("externo", 14) + " Ver no calendário do Bitrix</button>" : "");
    // Próximos 14 dias e próximo aniversário
    const prox = ag.aniversarios[0];
    h += '<div class="grade c3"><div class="card"><h3>Próximos 14 dias</h3>' +
      (ag.proximos14.fora.length ? ag.proximos14.fora.map((f) => '<div style="margin-bottom:6px">' + esc(f.pessoa.nome) + ' <span class="muted">fora até ' + calc.fmtData(f.ate) + ", volta em " + calc.fmtDiaSemana(f.volta) + ", " + calc.fmtData(f.volta) + "</span></div>").join("") : '<div class="muted">Ninguém fora.</div>') +
      ag.proximos14.feriados.map((f) => '<div class="muted" style="margin-top:6px">Feriado nacional em ' + calc.fmtData(f.data) + (f.nome && f.nome !== "Feriado" ? " · " + esc(f.nome) : "") + "</div>").join("") + "</div>" +
      '<div class="card"><h3>Próximo aniversário</h3>' + (prox ? c.pessoa(prox.pessoa, calc.fmtDiaSemana(prox.data) + ", " + calc.fmtData(prox.data), 44) : '<div class="muted">Nenhum nas próximas 13 semanas.</div>') + "</div>" +
      '<div class="card' + (ag.aviso.avisar ? " acao" : "") + '"><h3>Para planejar</h3>' + (ag.aviso.avisar && ag.pico.data
        ? "<div>" + (ag.aviso.comLideranca ? "Você e mais " + plural(ag.pico.pessoas.length - 1, "pessoa", "pessoas") : plural(ag.pico.pessoas.length, "pessoa", "pessoas")) + " fora entre " + calc.fmtData(ag.pico.data) + " e " + calc.fmtData(ag.pico.fim) + ' <span class="muted">(' + esc(ag.aviso.pct.texto) + ")</span>.</div>" +
          (ag.aviso.comLideranca ? '<p class="muted" style="font-size:12px">Uma liderança do mesmo setor pode receber as pendências e os avisos no período (4.2). Registre o substituto com a sua coordenação.</p>' : "")
        : '<div class="muted">Nenhum período com 30% ou mais da equipe fora.</div>') + "</div></div>";
    // Linha do tempo
    const semanas = [];
    for (let i = 0; i < 13; i++) semanas.push(calc.addDias(ag.inicio, i * 7));
    const foraNaSemana = semanas.map((s) => {
      const fimS = calc.addDias(s, 6);
      return ag.linhas.filter((l) => l.ausencias.some((a) => a.inicio <= fimS && a.fim >= s)).length;
    });
    const maxFora = Math.max(1, ...foraNaSemana);
    const nac = ag.feriadosNacionais;
    h += '<div class="card" style="margin-top:16px"><h3>Linha do tempo</h3><div class="tempo"><table><thead><tr><th></th>' + semanas.map((s) => '<th colspan="1">' + calc.fmtData(s) + "</th>").join("") + "</tr>" +
      '<tr class="calor-semana"><td class="muted" style="font-size:10.5px">Equipe fora</td>' + foraNaSemana.map((n) => '<td><div class="c" title="' + n + ' fora" style="background:rgba(0,68,255,' + (n ? 0.15 + 0.7 * (n / maxFora) : 0.04) + ')"></div></td>').join("") + "</tr></thead><tbody>" +
      ag.linhas.map((l) => '<tr><td class="quem">' + c.pessoa(l.pessoa, l.sigla + (l.pessoa.ehLideranca ? " · liderança" : ""), 26) + "</td>" +
        '<td colspan="13"><div class="trilho">' +
        nac.map((f) => '<span class="fer" style="left:' + pos(f.data) + '%" title="Feriado nacional · ' + calc.fmtData(f.data) + '"></span>').join("") +
        l.feriadosLocais.map((f) => '<span class="fer local" style="left:' + pos(f.data) + '%" title="Feriado ' + esc(l.sigla) + " · " + esc(f.nome) + " · " + calc.fmtData(f.data) + '"></span>').join("") +
        l.ausencias.map((a) => '<span class="aus" style="left:' + pos(a.inicio < ag.inicio ? ag.inicio : a.inicio) + "%;width:" + larg(a.inicio, a.fim) + '%" title="Fora de ' + calc.fmtData(a.inicio) + " a " + calc.fmtData(a.fim) + " · volta " + calc.fmtData(a.volta) + '"></span>').join("") +
        (l.aniversario ? '<span class="aniv" style="left:' + pos(l.aniversario) + '%" title="Aniversário · ' + calc.fmtData(l.aniversario) + '">🎂</span>' : "") +
        '<span class="hoje" style="left:0" title="Hoje"></span></div></td></tr>').join("") + "</tbody></table></div>" +
      '<div class="legenda"><span><i style="background:var(--azul)"></i>fora</span><span><i style="background:#c7ccd8;width:3px"></i>feriado nacional</span><span><i style="background:#f0b65a;width:3px"></i>feriado local (SP ou BA)</span><span>🎂 aniversário (só dia e mês)</span><span><i style="background:var(--vermelho);width:2px"></i>hoje</span></div></div>';
    // Listas (celular e leitura em ordem de data)
    const feriadosAte = [];
    nac.forEach((f) => feriadosAte.push({ data: f.data, nome: f.nome, para: "todos" }));
    ag.feriadosLocais.forEach((g) => g.lista.forEach((f) => feriadosAte.push({ data: f.data, nome: f.nome, para: "quem segue " + (g.sigla === "BA" ? "Salvador (BA)" : "São Paulo (SP)") })));
    feriadosAte.sort((a, b) => (a.data < b.data ? -1 : 1));
    h += '<div class="grade c2"><div class="card"><h3>Próximos aniversários</h3>' + (ag.aniversarios.length ? '<div class="lista">' + ag.aniversarios.map((a) => '<div class="item">' + c.pessoa(a.pessoa, calc.fmtDiaSemana(a.data) + ", " + calc.fmtData(a.data), 30) + "</div>").join("") + "</div>" : c.vazio("Nenhum no período.")) +
      '<p class="muted" style="font-size:12px">Quem pediu ao RH fica fora da lista.</p></div>' +
      '<div class="card"><h3>Feriados até ' + calc.fmtData(ag.fim) + "</h3>" + (feriadosAte.length ? '<div class="lista">' + feriadosAte.map((f) => '<div class="item"><span class="num" style="width:44px;font-weight:700;color:var(--navy)">' + calc.fmtData(f.data) + '</span><div class="principal-item"><div>' + esc(f.nome || "Feriado") + '</div><div class="d">vale para ' + esc(f.para) + "</div></div></div>").join("") + "</div>" : c.vazio("Nenhum feriado no período.")) + "</div></div>";
    if (E().repo.modo === "bitrix") h += '<p class="muted" style="font-size:12px">As ausências vêm dos eventos marcados como "Ausente" na agenda de cada pessoa. A leitura do gráfico de ausências nativo e do futuro app de ausências do RH é validação pendente do TI (6.2).</p>';
    return h;
  };
  ui.acoes["abrir-calendario"] = function () { try { BX24.openPath("/calendar/"); } catch (e) { ui.avisar("Abra o calendário pelo menu do Bitrix."); } };
})(window);
