/* =====================================================================================
   TELAS — Agenda da equipe (3.6): ausências, aniversários e feriados das próximas 13 semanas
   -------------------------------------------------------------------------------------
   Regras: só as ausências que o RH registrou; o motivo nunca aparece; aniversário só com dia e mês;
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
    let h = c.cabecalho("agenda", "Agenda da equipe", "<span>próximas 13 semanas · " + calc.fmtData(ag.inicio) + " a " + calc.fmtData(ag.fim) + "</span>");
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
      '<tr class="calor-semana"><td class="muted" style="font-size:10.5px">Equipe fora</td>' + foraNaSemana.map((n) => '<td><div class="c" title="' + n + ' fora" style="background:rgba(65,84,238,' + (n ? 0.15 + 0.7 * (n / maxFora) : 0.04) + ')"></div></td>').join("") + "</tr></thead><tbody>" +
      ag.linhas.map((l) => '<tr><td class="quem">' + c.pessoa(l.pessoa, l.sigla + (l.pessoa.ehLideranca ? " · liderança" : ""), 26) + "</td>" +
        '<td colspan="13"><div class="trilho">' +
        nac.map((f) => '<span class="fer" style="left:' + pos(f.data) + '%" title="Feriado nacional · ' + calc.fmtData(f.data) + '"></span>').join("") +
        l.feriadosLocais.map((f) => '<span class="fer local" style="left:' + pos(f.data) + '%" title="Feriado ' + esc(l.sigla) + " · " + esc(f.nome) + " · " + calc.fmtData(f.data) + '"></span>').join("") +
        l.ausencias.map((a) => '<span class="aus" style="left:' + pos(a.inicio < ag.inicio ? ag.inicio : a.inicio) + "%;width:" + larg(a.inicio, a.fim) + '%" title="Fora de ' + calc.fmtData(a.inicio) + " a " + calc.fmtData(a.fim) + " · volta " + calc.fmtData(a.volta) + '"></span>').join("") +
        (l.aniversario ? '<span class="aniv" style="left:' + pos(l.aniversario) + '%" title="Aniversário · ' + calc.fmtData(l.aniversario) + '">🎂</span>' : "") +
        '<span class="hoje" style="left:0" title="Hoje"></span></div></td></tr>').join("") + "</tbody></table></div>" +
      '<div class="legenda"><span><i style="background:var(--azul)"></i>fora</span><span><i style="background:#c7ccd8;width:3px"></i>feriado nacional</span><span><i style="background:#f0b65a;width:3px"></i>feriado local (SP ou BA)</span><span>🎂 aniversário (só dia e mês)</span><span><i style="background:var(--vermelho);width:2px"></i>hoje</span></div></div>';
    // Listas (celular e leitura em ordem de data). Os feriados vêm do calendário do RH (ou da lista oficial, no ano sem
    // cadastro), inclusive os que a empresa não considera, que aparecem como dia útil.
    const para = (f) => (!f.sigla ? "todos" : "quem segue " + (f.sigla === "BA" ? "Salvador (BA)" : "São Paulo (SP)"));
    const doRH = ag.feriados.some((f) => f.fonte === "rh");
    const meuAniv = (dom.pessoa(ctx, E().eu.id) || {}).aniversario;
    h += '<div class="grade c2"><div class="card"><h3>Próximos aniversários' + (E().verComo ? "" : '<span class="extra"><button class="btn peq sec" data-acao="meu-aniversario">' + (meuAniv ? "Atualizar o meu" : "Cadastrar o meu") + "</button></span>") + "</h3>" +
      (ag.aniversarios.length ? '<div class="lista">' + ag.aniversarios.map((a) => '<div class="item">' + c.pessoa(a.pessoa, calc.fmtDiaSemana(a.data) + ", " + calc.fmtData(a.data), 30) + "</div>").join("") + "</div>" : c.vazio("Nenhum no período.")) +
      '<p class="muted" style="font-size:12px">Os aniversários vêm do perfil do Bitrix, e cada pessoa cadastra o seu aqui ou em Perfil. Quem pediu ao RH fica fora da lista.</p></div>' +
      '<div class="card"><h3>Feriados até ' + calc.fmtData(ag.fim) + (podeEditarFeriados() ? '<span class="extra"><button class="btn peq sec" data-acao="editar-feriados">Editar feriados</button></span>' : "") + "</h3>" +
      (ag.feriados.length ? '<div class="lista">' + ag.feriados.map((f) => '<div class="item' + (f.considera ? "" : " nao-vale") + '"><span class="num" style="width:44px;font-weight:700;color:var(--navy)">' + calc.fmtData(f.data) + '</span><div class="principal-item"><div>' + esc(f.nome || "Feriado") + '</div><div class="d">' +
        (f.considera ? "vale para " + esc(para(f)) : "não vale na Amorim: dia útil") + "</div></div></div>").join("") + "</div>" : c.vazio("Nenhum feriado no período.")) +
      '<p class="muted" style="font-size:12px">' + (doRH ? "Calendário de feriados cadastrado pelo RH." : "Lista oficial (feriados nacionais e os locais de SP e Salvador). O RH cadastra o calendário da empresa em Editar feriados.") + "</p></div></div>";
    h += '<p class="muted" style="font-size:12px">As ausências são as férias, os day offs e as pausas contratuais que o RH registra em Férias e ausências, depois da aprovação por e-mail.</p>';
    return h;
  };

  /* ---------------- feriados da empresa: o RH cadastra (Políticas de Férias e Ausências, parte IV) ---------------- */
  // Um ano com itens no processo Feriados substitui, naquele ano, a lista oficial do app (dom.feriadosDoAno). Por isso
  // o cadastro de um ano começa sempre pela lista oficial inteira, e o RH ajusta: não considera, exclui ou acrescenta.
  const ABRANGENCIA = GP.schema.OPCOES.abrangenciaFeriado;
  const abrangenciaDe = (sigla) => (sigla === "SP" ? "São Paulo (SP)" : sigla === "BA" ? "Salvador (BA)" : "Todos");
  function podeEditarFeriados() { return (E().visao === "rh" || E().eu.admin) && !(E().ctx.recursos && E().ctx.recursos.feriados === false); }
  let anoFeriados = null;
  function corpoFeriados() {
    const ctx = E().ctx;
    const ano0 = Number(ctx.hoje.slice(0, 4));
    const ano = anoFeriados || ano0;
    const cad = dom.feriadosCadastrados(ctx, ano);
    let h = '<div class="abas" style="margin-bottom:14px">' + [ano0, ano0 + 1].map((a) => '<a href="#" data-acao="feriados-ano" data-ano="' + a + '" class="' + (a === ano ? "ativo" : "") + '">' + a + "</a>").join("") + "</div>";
    if (!cad.length) {
      const of = dom.feriadosOficiais(ctx, ano);
      return h + '<div class="aviso-info" style="margin-bottom:12px">O calendário de ' + ano + " ainda não foi cadastrado. Até lá valem estes " + of.length + " feriados: os nacionais da lei e os locais de SP e Salvador da Configuração. " +
        "Para mudar alguma coisa, cadastre o calendário a partir desta lista e ajuste.</div>" +
        '<div class="lista">' + of.map((f) => '<div class="item"><span class="num" style="width:44px;font-weight:700;color:var(--navy)">' + calc.fmtData(f.data) + '</span><div class="principal-item"><div>' + esc(f.nome) + '</div><div class="d">' + calc.fmtDiaSemana(f.data) + " · " + esc(abrangenciaDe(f.sigla)) + "</div></div></div>").join("") + "</div>" +
        '<button class="btn" style="margin-top:14px" data-acao="feriados-importar" data-ano="' + ano + '">Cadastrar o calendário de ' + ano + " a partir desta lista</button>";
    }
    h += '<div class="lista">' + cad.map((f) => '<div class="item' + (f.considera ? "" : " nao-vale") + '"><span class="num" style="width:44px;font-weight:700;color:var(--navy)">' + calc.fmtData(f.data) + "</span>" +
      '<div class="principal-item"><div>' + esc(f.nome) + '</div><div class="d">' + calc.fmtDiaSemana(f.data) + " · " + esc(f.abrangencia) + (f.considera ? "" : " · não vale: dia útil") + (f.observacao ? " · " + esc(f.observacao) : "") + "</div></div>" +
      '<div class="lado" style="flex-direction:row;gap:6px"><button class="btn peq sec" data-acao="feriado-considerar" data-id="' + esc(f.id) + '">' + (f.considera ? "Não considerar" : "Considerar") + "</button>" +
      '<button class="btn peq link excluir" data-acao="feriado-excluir" data-id="' + esc(f.id) + '" aria-label="Excluir">' + icone("lixeira", 14) + "</button></div></div>").join("") + "</div>" +
      '<div class="grupo-form" id="form-feriado" style="margin-top:16px"><div class="rotulo-grupo">Acrescentar ao calendário de ' + ano + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "data", rotulo: "Data", tipo: "data", min: ano + "-01-01", max: ano + "-12-31" }) + c.campo({ nome: "nome", rotulo: "Nome", placeholder: "Ex.: Recesso de fim de ano" }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "abrangencia", rotulo: "Vale para", tipo: "lista", opcoes: ABRANGENCIA, valor: "Todos" }) +
      c.campo({ nome: "considera", rotulo: "Na Amorim", tipo: "escolha", opcoes: [{ valor: "sim", rotulo: "Não é dia útil" }, { valor: "nao", rotulo: "É dia útil (só informativo)" }], valor: "sim" }) + "</div>" +
      c.campo({ nome: "observacao", rotulo: "Observação", opcional: true }) +
      '<button class="btn" data-acao="feriado-acrescentar">Acrescentar</button></div>';
    return h;
  }
  function redesenharFeriados() { const corpo = document.getElementById("painel-corpo"); if (corpo) { corpo.innerHTML = corpoFeriados(); corpo.dataset.limpo = "1"; } }
  ui.acoes["editar-feriados"] = function () {
    anoFeriados = null;
    ui.abrirPainel({
      titulo: "Feriados da empresa", largo: true,
      sub: "O que vale aqui vale nos prazos do app, nos pedidos de day off e na agenda da equipe. A política: nacionais para todos; estaduais e municipais de São Paulo ou de Salvador, pela cidade de referência de cada membro; pontos facultativos não se aplicam.",
      corpo: corpoFeriados(),
    });
    const corpo = document.getElementById("painel-corpo");
    if (corpo) corpo.dataset.limpo = "1"; // nada para perder ao fechar: cada mudança já grava
  };
  ui.acoes["feriados-ano"] = function (el) { anoFeriados = Number(el.dataset.ano); redesenharFeriados(); };
  ui.acoes["feriados-importar"] = function (el) {
    const ano = Number(el.dataset.ano);
    const lista = dom.feriadosOficiais(E().ctx, ano);
    ui.salvar(el, async () => {
      for (const f of lista) {
        await ui.criar("feriados", { titulo: f.nome, data: f.data, abrangencia: abrangenciaDe(f.sigla), considera: true, observacao: f.fonte === "configuracao" ? "Veio da Configuração do app" : "" });
      }
    }, { mensagem: "Calendário de " + ano + " cadastrado com " + lista.length + " feriados.", fechar: false, rotuloOcupado: "Cadastrando…" }).then(redesenharFeriados);
  };
  ui.acoes["feriado-considerar"] = function (el) {
    const f = (E().ctx.idx.porId.feriados || {})[el.dataset.id];
    if (!f) return;
    ui.salvar(el, () => ui.atualizar("feriados", f.id, { considera: !f.considera }), { mensagem: f.considera ? f.titulo + " passou a dia útil." : f.titulo + " voltou a valer.", fechar: false }).then(redesenharFeriados);
  };
  ui.acoes["feriado-excluir"] = function (el) {
    const f = (E().ctx.idx.porId.feriados || {})[el.dataset.id];
    if (!f || !window.confirm("Excluir " + f.titulo + " (" + calc.fmtDataAno(f.data) + ") do calendário? O item vai para a lixeira do CRM.")) return;
    ui.salvar(el, () => ui.excluir("feriados", f.id), { mensagem: "Excluído do calendário.", fechar: false }).then(redesenharFeriados);
  };
  ui.acoes["feriado-acrescentar"] = function (el) {
    const form = document.getElementById("form-feriado");
    if (!ui.validar(form, ["data", "nome", "abrangencia"])) return;
    const d = ui.lerForm(form);
    ui.salvar(el, () => ui.criar("feriados", { titulo: d.nome.trim(), data: d.data, abrangencia: d.abrangencia, considera: d.considera !== "nao", observacao: (d.observacao || "").trim() }),
      { mensagem: d.nome.trim() + " acrescentado ao calendário.", fechar: false }).then(redesenharFeriados);
  };
})(window);
