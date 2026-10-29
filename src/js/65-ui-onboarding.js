/* =====================================================================================
   TELAS — Onboarding Embarcação Amorim (3.2) e Planejamento da função
   -------------------------------------------------------------------------------------
   Reunião de 29/10/2026: o onboarding registra o planejamento da função (a Ficha, com as
   competências comportamentais) e as avaliações dos 3 primeiros meses: Ancoragem, Imersão
   e Mar Aberto. Cada entrega do mês é avaliada na régua que veio do Desempenho (Conforme
   100 · Com ajuste 70 · Fora do padrão 30 · Não entregue 0). Não há tarefas paralelas no
   Bitrix: depois dos 3 meses, cada área segue com os próprios projetos e tarefas.
   A Ficha vai para o membro por e-mail, num passo separado do salvar. Notas e
   justificativas ficam com a liderança e o RH: nunca vão para o membro.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural, normalizar } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;
  const FASES = ["Preparação", "Ancoragem", "Imersão", "Mar Aberto"];
  // Registrar a avaliação do mês move o item para a fase seguinte (3.2, robô 4)
  const PROXIMO_ESTAGIO = { 1: "IMERSAO", 2: "MAR_ABERTO", 3: "SUCCESS" };
  const ESTAGIO_POR_FASE = { "Ancoragem": "ANCORAGEM", "Imersão": "IMERSAO", "Mar Aberto": "MAR_ABERTO" };
  const COR_RESULTADO = { "Dentro do esperado": "verde", "Atenção": "ambar", "Abaixo do esperado": "vermelho" };
  const COR_LEITURA = { "Conforme": "verde", "Com ajuste": "azul", "Fora do padrão": "ambar", "Não entregue": "vermelho" };
  const CAMPO_ENTREGAS = { "Ancoragem": "entregasAncoragem", "Imersão": "entregasImersao", "Mar Aberto": "entregasMarAberto" };
  const MES_DA_FASE = { "Ancoragem": "1º mês", "Imersão": "2º mês", "Mar Aberto": "3º mês" };
  const REGUA = "Conforme 100 · Com ajuste 70 · Fora do padrão 30 · Não entregue 0";
  const PRIVADO = "As notas e as justificativas ficam com a liderança e o RH. O membro não recebe por e-mail: elas servem de base para a conversa de acompanhamento.";

  const linhasDe = (txt) => String(txt || "").split(/\r?\n/).map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);

  /* ================================================================ TELA ONBOARDING */
  ui.rotas.onboarding = function (partes) {
    if (partes[0] === "planejamento") return telaPlanejamentos();
    if (partes[0]) return telaOnboarding(partes[0]);
    const ctx = E().ctx;
    const doMembro = ui.membrosDaVisao().map((m) => dom.onboardingDo(ctx, m.id)).filter(Boolean);
    const ativos = doMembro.filter((o) => ["SUCCESS", "FAIL"].indexOf(o.estagio) < 0).map((o) => dom.statusOnboarding(ctx, o))
      .sort((a, b) => String(a.ingresso || "").localeCompare(String(b.ingresso || "")));
    const ano = calc.addDias(ctx.hoje, -365);
    const concluidos = doMembro.filter((o) => o.estagio === "SUCCESS" && (o.al3Data || "") >= ano).map((o) => dom.statusOnboarding(ctx, o));
    const prox7 = ativos.filter((s) => s.proximo && calc.diffDias(ctx.hoje, s.proximo.data) <= 7 && calc.diffDias(ctx.hoje, s.proximo.data) >= 0).length;
    const atrasados = ativos.filter((s) => s.atrasado).length;
    const links = (E().config && E().config.links) || {};
    const numeros = "<span><b>" + ativos.length + "</b> em onboarding</span><span><b>" + prox7 + "</b> " + (prox7 === 1 ? "avaliação" : "avaliações") + " nos próximos 7 dias</span>" + (atrasados ? '<span style="color:var(--vermelho)"><b>' + atrasados + "</b> atrasado(s)</span>" : "");
    let h = c.cabecalho("onboarding", "Onboarding", numeros, '<a class="btn sec" href="#/onboarding/planejamento">Planejamento da função</a>');
    h += '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b style="color:var(--navy)">Embarcação Amorim</b> · os primeiros 90 dias. ' +
      "A Ficha mostra ao membro o que se espera da função; no fim de cada mês, a liderança avalia as entregas (1º mês Ancoragem, 2º mês Imersão, 3º mês Mar Aberto). " + esc(PRIVADO) + "</div>" +
      (links.guiaOnboarding ? '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(links.guiaOnboarding) + '">' + icone("manual", 15) + " Guia do programa</a>" : "") + "</div></div>";
    h += '<div class="card"><h3>Acompanhamento<span class="extra muted">notas de cada mês contra o patamar da senioridade</span></h3>' +
      (ativos.length ? tabela(ativos, true) : c.vazio("Ninguém em onboarding na sua visão.")) + "</div>";
    if (concluidos.length) h += '<div class="card"><h3>Concluídos nos últimos 12 meses</h3>' + tabela(concluidos, false) + "</div>";
    return h;
  };
  /** Uma linha por pessoa: a Ficha, a nota de cada mês e o próximo marco */
  function tabela(lista, emAndamento) {
    const ctx = E().ctx;
    return '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Membro</th><th>Ficha</th><th>1º mês · Ancoragem</th><th>2º mês · Imersão</th><th>3º mês · Mar Aberto</th><th>' + (emAndamento ? "Próximo" : "Dia 90") + "</th></tr></thead><tbody>" +
      lista.map((s) => {
        const m = dom.infoMembro(ctx, s.membro || {});
        const ficha = !s.fichaOk ? c.tag("Falta preencher", s.fichaAtrasada ? "vermelho" : "ambar") : s.fichaEnviada ? c.tag("Enviada", "verde") : c.tag("Não enviada", "ambar");
        const mes = (a) => '<span class="nota-mini"><b>' + (a.nota === null ? "—" : a.nota) + (a.patamar !== undefined ? ' <span class="muted" style="font-weight:400;font-size:11.5px">/ ' + a.patamar + "</span>" : "") + "</b>" +
          (a.resultado ? c.tag((a.registrado ? "" : "Prévia: ") + a.resultado, COR_RESULTADO[a.resultado]) : '<span class="muted" style="font-size:11.5px">' + (a.registrado ? "sem nota" : "até " + calc.fmtData(a.data)) + "</span>") + "</span>";
        const fim = emAndamento ? (s.proximo ? esc(s.proximo.rotulo) + "<br>" + c.prazo(s.proximo.data) : "—") : (s.item.continuidade ? c.tag(s.item.continuidade, s.item.continuidade === "Continuidade confirmada" ? "verde" : "ambar") : "—");
        return '<tr class="clicavel" data-rota="#/onboarding/' + esc(s.item.id) + '"><td>' + c.pessoa(m, s.dia > 0 ? "Dia " + Math.min(s.dia, 90) + " de 90 · " + esc(s.fase) : "começa em " + calc.fmtData(s.ingresso), 30) + "</td><td>" + ficha + "</td>" +
          s.alinhamentos.map((a) => "<td>" + mes(a) + "</td>").join("") + (s.alinhamentos.length ? "" : "<td></td><td></td><td></td>") + "<td>" + fim + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* ================================================================ DETALHE */
  function resumoHtml(o, compacto) {
    const ctx = E().ctx;
    const s = dom.statusOnboarding(ctx, o);
    return '<div class="card"><h3>Onboarding · Dia 1 em ' + calc.fmtDataAno(s.ingresso) + '<span class="extra">' + c.tag(s.fase, o.estagio === "SUCCESS" ? "verde" : o.estagio === "FAIL" ? "cinza" : "azul") + "</span></h3>" +
      '<div class="muted" style="font-size:12px;margin-bottom:8px">Ficha ' + (s.fichaOk ? "preenchida em " + calc.fmtData(o.fichaEm) + (s.fichaEnviada ? " · enviada ao membro em " + calc.fmtData(String(o.fichaEnviadaEm).slice(0, 10)) : " · ainda não enviada ao membro") : "ainda não preenchida") + "</div>" +
      s.alinhamentos.map((a) => '<div style="margin-bottom:8px"><b>' + esc(a.rotulo) + "</b> (" + esc(a.fase) + ") · " + calc.fmtData(a.data) + " · " + (a.registrado ? "nota " + (a.nota === null ? "sem nota" : a.nota) + " · " + esc(a.resultado || "") : '<span class="muted">não registrada</span>') +
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
    let acoes = "";
    if (ativo) {
      acoes += '<button class="btn sec" data-acao="ficha" data-id="' + esc(o.id) + '">' + (s.fichaOk ? "Editar a Ficha" : "Completar a Ficha") + "</button>";
      if (s.fichaOk) acoes += '<button class="btn' + (s.fichaEnviada ? " sec" : "") + '" data-acao="enviar-ficha" data-id="' + esc(o.id) + '">' + icone("email", 15) + (s.fichaEnviada ? " Enviar de novo" : " Enviar a Ficha por e-mail") + "</button>";
      if (o.estagio === "NEW" && s.fichaOk && s.dia >= 1) acoes += '<button class="btn sec" data-acao="iniciar-ancoragem" data-id="' + esc(o.id) + '">Iniciar a Ancoragem</button>';
    }
    acoes += c.botaoExcluir("onboarding", o, { volta: "#/onboarding", descricao: "o onboarding de " + m.nome + " (com as avaliações registradas nele)" });
    let h = c.voltar("#/onboarding", "Onboarding") + c.cabecalho("onboarding", "Onboarding de " + m.nome,
      "<span>" + (s.dia > 0 ? "Dia <b>" + Math.min(s.dia, 90) + "</b> de 90" : "começa em <b>" + calc.fmtDataAno(s.ingresso) + "</b>") + "</span><span>fase " + c.tag(s.fase, "azul") + "</span><span>" + esc(s.senioridade || "senioridade não informada") + "</span>", acoes);
    // Linha das fases
    const idxFase = FASES.indexOf(s.fase);
    h += '<div class="card"><div class="passos">' + FASES.concat(["Concluído"]).map((f, i) => '<span class="p ' + (o.estagio === "SUCCESS" || i < idxFase ? "feito" : i === idxFase ? "atual" : "") + '">' + esc(f) + "</span>").join("") + "</div>" +
      c.dados([["Liderança (o Leme)", dom.pessoa(ctx, m.lideranca).nome], ["Supervisão (a Bússola)", o.supervisao ? dom.pessoa(ctx, o.supervisao).nome : "a definir"], ["Colega (o Mapa)", o.colega ? dom.pessoa(ctx, o.colega).nome : "a definir"],
        ["Patamar da senioridade", s.senioridade ? "1º mês " + patamar["Ancoragem"] + " · 2º mês " + patamar["Imersão"] + " · 3º mês " + patamar["Mar Aberto"] : "—"], ["Revisão esperada", s.revisaoEsperada]]) + "</div>";
    h += fichaHtml(o, s, m);
    // Evolução das notas
    h += '<div class="card"><h3>Evolução das notas<span class="extra muted">a linha tracejada é o patamar da senioridade</span></h3>' + evolucaoHtml(s) + "</div>";
    // Avaliações de cada mês
    h += '<div class="grade c3">' + s.alinhamentos.map((a) => cartaoAvaliacao(o, s, a, ativo)).join("") + "</div>";
    if (o.continuidade) h += '<div class="card"><h3>Dia 90</h3>' + c.tag(o.continuidade, o.continuidade === "Continuidade confirmada" ? "verde" : "ambar") + "</div>";
    h += '<p class="muted" style="font-size:12px">' + icone("cadeado", 13) + " " + esc(PRIVADO) + "</p>";
    return h;
  }
  function fichaHtml(o, s, m) {
    const enviada = s.fichaEnviada ? c.tag("Enviada em " + calc.fmtData(String(o.fichaEnviadaEm).slice(0, 10)) + " para " + (m.email || "o membro"), "verde") : s.fichaOk ? c.tag("Ainda não enviada ao membro", "ambar") : c.prazo(s.prazoFicha);
    const lista = (txt) => { const l = linhasDe(txt); return l.length ? '<ul style="margin:4px 0 0;padding-left:18px">' + l.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : '<span class="muted">—</span>'; };
    const bloco = (rot, html) => '<div><div class="k">' + esc(rot) + "</div>" + html + "</div>";
    return '<div class="card' + (!s.fichaOk ? " acao" + (s.fichaAtrasada ? " vermelho" : "") : "") + '"><h3>Ficha do membro<span class="extra">' + enviada + "</span></h3>" +
      (s.fichaOk ? '<div class="sci">' + c.textoRegistro("Escopo da função", o.fichaEscopo) + bloco("Competências comportamentais", lista(o.fichaPadroes)) + c.textoRegistro("Indicadores", o.fichaIndicadores) +
        bloco("Entregas planejadas", '<div class="grade c3" style="margin-top:4px">' + ["Ancoragem", "Imersão", "Mar Aberto"].map((f) => '<div><b style="font-size:12.5px">' + MES_DA_FASE[f] + " · " + f + "</b>" + lista(o[CAMPO_ENTREGAS[f]]) + "</div>").join("") + "</div>") + "</div>" +
        (s.fichaEnviada ? "" : '<p class="muted" style="font-size:12px;margin-bottom:0">Quando a Ficha estiver pronta, use "Enviar a Ficha por e-mail". Vão o escopo, as competências, os indicadores, as entregas de cada fase e as datas das avaliações.</p>')
        : '<p class="muted" style="margin-top:0">A Ficha prepara a chegada: escopo, competências comportamentais, indicadores e as entregas de cada mês. ' + (o.planejamentoId ? "Já existe um planejamento da função: a Ficha vem preenchida com ele." : "") + "</p>") + "</div>";
  }
  function evolucaoHtml(s) {
    if (!s.alinhamentos.length) return c.vazio("Sem data de ingresso: as avaliações aparecem quando o Dia 1 estiver no cadastro.");
    return '<div class="evolucao">' + s.alinhamentos.map((a) => {
      const cor = a.resultado ? COR_RESULTADO[a.resultado] : "";
      return '<div class="coluna"><div class="muted" style="font-size:12px"><b>' + esc(MES_DA_FASE[a.fase]) + "</b> · " + esc(a.fase) + "</div>" +
        '<div class="trilho" role="img" aria-label="' + esc(a.rotulo + ": " + (a.nota === null ? "sem nota" : "nota " + a.nota) + (a.patamar !== undefined ? ", patamar " + a.patamar : "")) + '">' +
        (a.nota !== null ? '<div class="valor ' + cor + '" style="height:' + Math.max(2, Math.min(100, a.nota)) + '%"></div>' : "") +
        (a.patamar !== undefined ? '<div class="patamar" style="bottom:' + a.patamar + '%" title="Patamar ' + a.patamar + '"></div>' : "") + "</div>" +
        '<div><span class="num" style="font-weight:800;color:var(--navy)">' + (a.nota === null ? "—" : a.nota) + "</span>" + (a.patamar !== undefined ? ' <span class="muted">/ patamar ' + a.patamar + "</span>" : "") +
        (!a.registrado && a.nota !== null ? ' <span class="muted">(prévia)</span>' : "") + "</div></div>";
    }).join("") + "</div>";
  }
  function cartaoAvaliacao(o, s, a, ativo) {
    const anteriorOk = a.numero === 1 || s.alinhamentos[a.numero - 2].registrado;
    const podeRegistrar = ativo && !a.registrado && anteriorOk;
    const podeEditar = a.registrado && (ativo || E().visao === "rh");
    const planejadas = linhasDe(o[CAMPO_ENTREGAS[a.fase]]);
    const ret = o["al" + a.numero + "Retorno"], comb = o["al" + a.numero + "Combinados"];
    const rot = (t) => '<div class="k" style="font-size:11px;text-transform:uppercase;color:var(--suave);font-weight:700;margin-top:10px">' + esc(t) + "</div>";
    return '<div class="card' + (a.atrasado ? " acao vermelho" : "") + '"><h3 style="font-size:13.5px">' + esc(a.rotulo) + '<span class="extra muted">' + esc(a.fase) + "</span></h3>" +
      '<div class="muted" style="font-size:12px">Dia ' + a.dia + " · " + calc.fmtDataAno(a.data) + (a.registrado ? " · registrada em " + calc.fmtData(a.dataRegistro) : "") + "</div>" +
      '<div style="margin:10px 0 6px"><span class="num" style="font-size:22px;font-weight:800;color:var(--navy)">' + (a.nota === null ? "—" : a.nota) + '</span> <span class="muted">/ patamar ' + (a.patamar === undefined ? "—" : a.patamar) + "</span></div>" +
      (a.resultado ? c.tag((a.registrado ? "" : "Prévia: ") + a.resultado, COR_RESULTADO[a.resultado]) : "") +
      (a.leituras.length ? rot("O que foi entregue") + '<div class="lista">' + a.leituras.map((l) => '<div class="item" style="padding:6px 0"><div class="principal-item"><div class="t" style="font-size:12.5px">' + esc(l.titulo || "Entrega") + '</div></div><div class="lado">' +
          (l.leitura ? c.tag(l.leitura + " · " + calc.NOTA_LEITURA[l.leitura], COR_LEITURA[l.leitura]) : c.tag("sem avaliação", "ambar")) + "</div></div>").join("") + "</div>"
        : '<div class="muted" style="font-size:12px;margin-top:8px">' + (planejadas.length ? plural(planejadas.length, "entrega planejada", "entregas planejadas") + " na Ficha." : "Sem entregas planejadas na Ficha.") + "</div>") +
      (a.registrado && ret ? rot("Justificativa") + '<div class="texto-registro" style="font-size:12.5px">' + esc(ret) + "</div>" : "") +
      (a.registrado && comb ? rot("Combinados") + '<div class="texto-registro" style="font-size:12.5px">' + esc(comb) + "</div>" : "") +
      (podeRegistrar ? '<div style="margin-top:12px">' + (a.atrasado ? c.prazo(a.data) + "<br>" : "") + '<button class="btn peq" data-acao="registrar-alinhamento" data-id="' + esc(o.id) + '" data-n="' + a.numero + '">Registrar a avaliação</button></div>' : "") +
      (podeEditar ? '<div style="margin-top:12px"><button class="btn peq sec" data-acao="registrar-alinhamento" data-id="' + esc(o.id) + '" data-n="' + a.numero + '">Editar a avaliação</button></div>' : "") + "</div>";
  }

  /* ---------------- competências comportamentais (glossário do RH, em Configuração) ---------------- */
  // Cada competência é uma linha "Nome — descrição": a Ficha que vai por e-mail não depende do glossário.
  const SEP = " — ";
  const nomeDa = (linha) => String(linha).split(SEP)[0].trim();
  function campoCompetencias(valor) {
    const glossario = (((E().config || {}).competencias) || []).filter((g) => g && g.nome);
    const marcadas = linhasDe(valor);
    const chave = (t) => normalizar(nomeDa(t));
    const naFicha = {};
    marcadas.forEach((l) => { naFicha[chave(l)] = true; });
    const doGlossario = glossario.map((g) => ({ linha: g.nome + (g.descricao ? SEP + g.descricao : ""), nome: g.nome, descricao: g.descricao || "", marcada: !!naFicha[normalizar(g.nome)] }));
    const extras = marcadas.filter((l) => !glossario.some((g) => normalizar(g.nome) === chave(l))).map((l) => ({ linha: l, nome: nomeDa(l), descricao: l.split(SEP).slice(1).join(SEP), marcada: true }));
    const caixa = (x) => '<label class="escolha"><input type="checkbox" data-competencia="' + esc(x.linha) + '"' + (x.marcada ? " checked" : "") + "><span>" + esc(x.nome) + (x.descricao ? "<small>" + esc(x.descricao) + "</small>" : "") + "</span></label>";
    return '<div class="campo" data-campo="competencias"><label>Competências comportamentais</label>' +
      '<div class="ajuda">' + (glossario.length ? "Marque as que se aplicam à função. Falta alguma? Acrescente abaixo." : "O glossário do RH ainda não foi cadastrado (Configuração → Cadastros). Acrescente as competências da função abaixo.") + "</div>" +
      '<div class="competencias">' + doGlossario.concat(extras).map(caixa).join("") + "</div>" +
      '<div class="linha-add"><input class="entrada" type="text" data-nova-competencia placeholder="Outra competência (ex.: Negociação)" aria-label="Outra competência"><button type="button" class="btn peq sec" data-acao="adicionar-competencia">' + icone("mais", 13) + " Adicionar</button></div></div>";
  }
  function lerCompetencias(raizEl) {
    return Array.prototype.slice.call(raizEl.querySelectorAll("[data-competencia]")).filter((x) => x.checked).map((x) => x.dataset.competencia).join("\n");
  }
  ui.acoes["adicionar-competencia"] = function (el) {
    const campo = el.closest(".campo");
    const entrada = campo.querySelector("[data-nova-competencia]");
    const t = String(entrada.value || "").trim();
    if (!t) { entrada.focus(); return; }
    const lista = campo.querySelector(".competencias");
    const ja = Array.prototype.find.call(lista.querySelectorAll("[data-competencia]"), (x) => normalizar(nomeDa(x.dataset.competencia)) === normalizar(t));
    if (ja) { ja.checked = true; ui.avisar("Essa competência já está na lista: ficou marcada."); }
    else lista.insertAdjacentHTML("beforeend", '<label class="escolha"><input type="checkbox" data-competencia="' + esc(t) + '" checked><span>' + esc(t) + "</span></label>");
    entrada.value = "";
    entrada.focus();
  };
  // Enter no campo "Outra competência" adiciona, em vez de não fazer nada
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || !ev.target.matches || !ev.target.matches("[data-nova-competencia]")) return;
    ev.preventDefault();
    const b = ev.target.parentElement.querySelector('[data-acao="adicionar-competencia"]');
    if (b) b.click();
  });

  /* ---------------- Ficha ---------------- */
  ui.acoes["ficha"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const pl = o.planejamentoId ? ctx.idx.porId.planejamento[o.planejamentoId] : null;
    const v = (campo, campoPl) => o[campo] || (pl ? pl[campoPl] : "");
    const usuarios = (ctx.usuarios || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    const planos = (ctx.registros.planejamento || []).filter((p) => p.estagio !== "FAIL").map((p) => ({ valor: p.id, rotulo: p.funcao || p.titulo }));
    ui.abrirPainel({
      titulo: "Ficha do membro", sub: pl ? "Preenchida a partir do planejamento \"" + esc(pl.funcao || pl.titulo) + "\". Ajuste o que for preciso." : "Comece pelos resultados esperados. Salvar não envia: o envio ao membro é um passo separado.", largo: true,
      corpo: '<div id="form-ficha">' + (planos.length && !o.fichaEm ? c.campo({ nome: "planejamentoId", rotulo: "Planejamento da função", tipo: "lista", opcoes: planos, valor: o.planejamentoId, opcional: true, ajuda: "Trocar o planejamento recarrega a Ficha com ele." }) : "") +
        '<div class="linha-campos">' + c.campo({ nome: "supervisao", rotulo: "Supervisão (a Bússola)", tipo: "lista", opcoes: usuarios, valor: o.supervisao, opcional: true }) + c.campo({ nome: "colega", rotulo: "Colega de trabalho (o Mapa)", tipo: "lista", opcoes: usuarios, valor: o.colega, opcional: true }) + "</div>" +
        c.campo({ nome: "fichaEscopo", rotulo: "Escopo da função", tipo: "textoLongo", valor: v("fichaEscopo", "escopo") }) +
        campoCompetencias(v("fichaPadroes", "padroes")) +
        c.campo({ nome: "fichaIndicadores", rotulo: "Indicadores", tipo: "textoLongo", valor: v("fichaIndicadores", "indicadores") }) +
        '<div class="grupo-form"><div class="rotulo-grupo">Entregas de cada mês (uma por linha: viram a lista da avaliação do mês)</div>' +
        c.campo({ nome: "entregasAncoragem", rotulo: "1º mês · Ancoragem", tipo: "textoLongo", valor: v("entregasAncoragem", "entregasAncoragem"), opcional: true }) +
        c.campo({ nome: "entregasImersao", rotulo: "2º mês · Imersão", tipo: "textoLongo", valor: v("entregasImersao", "entregasImersao"), opcional: true }) +
        c.campo({ nome: "entregasMarAberto", rotulo: "3º mês · Mar Aberto", tipo: "textoLongo", valor: v("entregasMarAberto", "entregasMarAberto"), opcional: true }) + "</div></div>",
      rodape: '<button class="btn" data-acao="salvar-ficha" data-id="' + esc(o.id) + '">Salvar a Ficha</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-ficha"] = function (el) {
    const f = document.getElementById("form-ficha");
    if (!ui.validar(f, ["fichaEscopo", "fichaIndicadores"])) return;
    const competencias = lerCompetencias(f);
    if (!competencias) { ui.erroNoPainel("Marque ou acrescente pelo menos uma competência comportamental."); return; }
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const s = dom.statusOnboarding(ctx, o);
    const dados = { supervisao: d.supervisao, colega: d.colega, fichaEscopo: d.fichaEscopo, fichaPadroes: competencias, fichaIndicadores: d.fichaIndicadores, entregasAncoragem: d.entregasAncoragem, entregasImersao: d.entregasImersao, entregasMarAberto: d.entregasMarAberto, autor: E().eu.id };
    if (d.planejamentoId) dados.planejamentoId = d.planejamentoId;
    if (!o.fichaEm) { dados.fichaEm = ctx.hoje; if (o.estagio === "NEW" && s.dia >= 1) dados.estagio = "ANCORAGEM"; }
    ui.salvar(el, () => ui.atualizar("onboarding", o.id, dados), { mensagem: o.fichaEnviadaEm ? "Ficha salva. Ela já tinha sido enviada: use \"Enviar de novo\" para o membro receber esta versão." : "Ficha salva. Quando estiver pronta, envie ao membro por e-mail." });
  };
  ui.acoes["iniciar-ancoragem"] = function (el) { ui.salvar(el, () => ui.atualizar("onboarding", el.dataset.id, { estagio: "ANCORAGEM" }), { mensagem: "Ancoragem iniciada.", fechar: false }); };

  /* ---------------- enviar a Ficha ao membro (reunião de 29/10/2026) ---------------- */
  ui.acoes["enviar-ficha"] = async function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const s = dom.statusOnboarding(ctx, o);
    const m = dom.infoMembro(ctx, s.membro || {});
    if (!s.fichaOk) { ui.avisar("Complete e salve a Ficha antes de enviar.", "erro"); return; }
    if (!m.email) { ui.avisar(m.nome + " está sem e-mail no cadastro do Bitrix.", "erro"); return; }
    const reenviar = !!o.fichaEnviadaEm;
    if (!window.confirm((reenviar ? "Enviar a Ficha de novo para " : "Enviar a Ficha para ") + m.nome + " (" + m.email + ")?\n\nVão o escopo, as competências comportamentais, os indicadores, as entregas de cada mês e as datas das conversas de acompanhamento. Notas e justificativas nunca vão.")) return;
    const rotulo = el.innerHTML;
    el.disabled = true; el.textContent = "Enviando…";
    try {
      const r = await E().repo.enviarFicha(o.id, reenviar);
      ui.aplicarNoContexto("onboarding", Object.assign({}, ctx.idx.porId.onboarding[o.id], { fichaEnviadaEm: r.enviadaEm || ui.agoraISO() }));
      ui.avisar("Ficha enviada para " + (r.para || m.email) + "." + (r.aviso ? " " + r.aviso : ""));
      ui.render();
    } catch (e) {
      console.error(e);
      if (e && e.status === 409) ui.avisar("A Ficha acabou de ser enviada. Espere alguns minutos para mandar de novo.", "erro");
      else if (e && e.status === 503) abrirFichaManual(o, String(e.message || ""));
      else ui.avisar("A Ficha não foi enviada: " + ((E().repo.mensagemErro && E().repo.mensagemErro(e)) || (e && e.message) || e), "erro");
    } finally { if (document.body.contains(el)) { el.disabled = false; el.innerHTML = rotulo; } }
  };
  /** A Ficha em texto: o mesmo conteúdo do e-mail, sem notas nem justificativas */
  function textoFicha(o) {
    const ctx = E().ctx;
    const s = dom.statusOnboarding(ctx, o);
    const m = dom.infoMembro(ctx, s.membro || {});
    const lista = (txt) => linhasDe(txt).map((l) => "• " + l).join("\n") || "—";
    const pessoa = (id) => (id ? dom.pessoa(ctx, id).nome : "a definir");
    return ["Olá, " + primeiroNome(m.nome) + "!", "",
      "Boas-vindas à Amorim. Esta é a sua Ficha de onboarding: o que esperamos da sua função nos primeiros 90 dias.", "",
      "SUA FUNÇÃO", o.fichaEscopo || "—", "", "COMPETÊNCIAS COMPORTAMENTAIS", lista(o.fichaPadroes), "", "INDICADORES", o.fichaIndicadores || "—", "",
      "O QUE SE ESPERA EM CADA FASE"].concat(s.alinhamentos.map((a) => MES_DA_FASE[a.fase] + " · " + a.fase + " (conversa de acompanhamento no Dia " + a.dia + ", " + calc.fmtDataAno(a.data) + ")\n" + lista(o[CAMPO_ENTREGAS[a.fase]]) + "\n"))
      .concat(["QUEM ACOMPANHA VOCÊ", "Liderança (o Leme): " + pessoa(m.lideranca), "Supervisão (a Bússola): " + pessoa(o.supervisao), "Colega de trabalho (o Mapa): " + pessoa(o.colega), "RH e TI (o Porto): para o que precisar."]).join("\n");
  }
  /** Sem a caixa de e-mail ligada na Vercel: a liderança manda a Ficha pelo próprio e-mail e marca como enviada */
  function abrirFichaManual(o, motivo) {
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[o.membroId] || {});
    const texto = textoFicha(o);
    const assunto = "Sua Ficha de onboarding na Amorim";
    const mailto = "mailto:" + encodeURIComponent(m.email || "") + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(texto.length > 1800 ? texto.slice(0, 1800) + "\n…" : texto);
    ui.abrirPainel({
      titulo: "Enviar a Ficha pelo seu e-mail", sub: "O envio automático ainda não está ligado no servidor" + (motivo ? " (" + esc(motivo) + ")" : "") + ". Copie o texto e mande para " + esc(m.email || "o membro") + ".", largo: true,
      corpo: '<div id="form-ficha-manual"><textarea class="entrada" id="texto-ficha" rows="18" readonly>' + esc(texto) + "</textarea>" +
        '<p class="muted" style="font-size:12px">Depois de mandar, marque como enviada: a pendência sai da lista e o card registra a data.</p></div>',
      rodape: '<button class="btn" data-acao="copiar-ficha">Copiar o texto</button><a class="btn sec" href="' + esc(mailto) + '">' + icone("email", 14) + ' Abrir no e-mail</a><button class="btn sec" data-acao="marcar-ficha-enviada" data-id="' + esc(o.id) + '">Marcar como enviada</button><button class="btn link" data-acao="fechar-painel">Fechar</button>',
    });
  }
  ui.acoes["copiar-ficha"] = function () {
    const t = document.getElementById("texto-ficha");
    if (!t) return;
    t.select();
    const ok = () => ui.avisar("Texto copiado.");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(ok, () => { try { document.execCommand("copy"); ok(); } catch (e) { ui.avisar("Selecione o texto e copie (Ctrl+C).", "erro"); } });
    else { try { document.execCommand("copy"); ok(); } catch (e) { ui.avisar("Selecione o texto e copie (Ctrl+C).", "erro"); } }
  };
  ui.acoes["marcar-ficha-enviada"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    ui.salvar(el, async () => {
      await ui.atualizar("onboarding", o.id, { fichaEnviadaEm: ui.agoraISO() });
      try { await E().repo.comentar("onboarding", o.id, "Ficha enviada ao membro pelo e-mail de " + E().eu.nome + " (marcado no app em " + calc.fmtDataAno(ctx.hoje) + ")."); } catch (e) { /* o comentário não impede */ }
    }, { mensagem: "Ficha marcada como enviada." });
  };

  /* ---------------- avaliações do 1º, 2º e 3º mês ---------------- */
  function linhaEntrega(titulo, leitura, lid) {
    return '<div class="linha-entrega" data-linha>' +
      '<input class="entrada" type="text" data-entrega value="' + esc(titulo || "") + '" placeholder="O que foi entregue" aria-label="Entrega">' +
      '<select class="entrada" data-regua aria-label="Avaliação na régua"><option value="">Avaliação</option>' + op.leitura.map((x) => '<option value="' + esc(x) + '"' + (x === leitura ? " selected" : "") + ">" + esc(x) + " (" + calc.NOTA_LEITURA[x] + ")</option>").join("") + "</select>" +
      '<button type="button" class="btn sec" data-acao="remover-entrega" title="Tirar da lista" aria-label="Tirar da lista">' + icone("fechar", 14) + "</button>" +
      (lid ? '<input type="hidden" data-lid value="' + esc(lid) + '">' : "") + "</div>";
  }
  function lerEntregas(raizEl) {
    return Array.prototype.slice.call(raizEl.querySelectorAll("[data-linha]")).map((l) => ({
      titulo: String(l.querySelector("[data-entrega]").value || "").trim(), leitura: l.querySelector("[data-regua]").value, id: (l.querySelector("[data-lid]") || {}).value || "",
    }));
  }
  function previaNota(raizEl, patamar) {
    const lin = lerEntregas(raizEl).filter((x) => x.titulo && x.leitura);
    const nota = calc.notaDasLeituras(lin.map((x) => x.leitura));
    const res = calc.resultadoFase(nota, patamar, lin.filter((x) => x.leitura === "Fora do padrão").length);
    const alvo = raizEl.querySelector("#previa-nota");
    if (!alvo) return;
    alvo.innerHTML = '<div><div class="muted" style="font-size:12px">Nota do mês</div><div class="num">' + (nota === null ? "—" : nota) + "</div></div>" +
      '<div><div class="muted" style="font-size:12px">Patamar</div><div class="num">' + (patamar === undefined ? "—" : patamar) + "</div></div>" +
      '<div><div class="muted" style="font-size:12px">Resultado</div><div style="margin-top:6px">' + (res ? c.tag(res, COR_RESULTADO[res]) : "—") + "</div></div>" +
      '<div class="muted" style="font-size:11.5px;flex-basis:100%">A nota é a média da régua. O resultado compara a nota com o patamar da senioridade (especificação 3.2), até o RH enviar a fórmula final.</div>';
  }
  ui.acoes["registrar-alinhamento"] = function (el) {
    const ctx = E().ctx;
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const n = Number(el.dataset.n);
    const s = dom.statusOnboarding(ctx, o);
    const a = s.alinhamentos[n - 1];
    const m = dom.infoMembro(ctx, s.membro);
    const linhas = a.leituras.length ? a.leituras.map((l) => linhaEntrega(l.titulo, l.leitura, l.id)) : linhasDe(o[CAMPO_ENTREGAS[a.fase]]).map((t) => linhaEntrega(t, "", ""));
    if (!linhas.length) linhas.push(linhaEntrega("", "", ""));
    const v = a.registrado ? { data: o["al" + n + "Data"], retorno: o["al" + n + "Retorno"], combinados: o["al" + n + "Combinados"], continuidade: o.continuidade } : { data: ctx.hoje };
    let corpo = '<div id="form-alinh"><div class="aviso-info" style="margin-bottom:14px">' + esc(PRIVADO) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "data", rotulo: "Data da avaliação", tipo: "data", valor: v.data, max: ctx.hoje }) + "<div></div></div>" +
      '<div class="campo"><label>O que foi entregue no mês</label><div class="ajuda">Avalie cada entrega na régua: ' + esc(REGUA) + ". A lista vem da Ficha: ajuste, tire ou acrescente.</div>" +
      '<div class="entregas-aval" id="entregas-aval">' + linhas.join("") + '</div><button type="button" class="btn peq sec" style="margin-top:8px" data-acao="adicionar-entrega">' + icone("mais", 13) + " Entrega</button></div>" +
      '<div class="previa-nota" id="previa-nota"></div>' +
      c.campo({ nome: "retorno", rotulo: "Justificativa da nota", tipo: "textoLongo", valor: v.retorno, linhas: 4, ajuda: "O que sustenta a avaliação: fatos, entregas e comportamentos observados no mês." }) +
      c.campo({ nome: "combinados", rotulo: n === 3 ? "Combinados para depois do onboarding" : "Combinados para o próximo mês", tipo: "textoLongo", valor: v.combinados, opcional: true, linhas: 2 });
    if (n === 3) corpo += c.campo({ nome: "continuidade", rotulo: "Continuidade, decidida com o RH antes da conversa com o membro", tipo: "escolha", opcoes: op.continuidade, valor: v.continuidade });
    corpo += "</div>";
    ui.abrirPainel({
      titulo: a.rotulo + " de " + m.nome, sub: a.fase + " · Dia " + a.dia + " (" + calc.fmtData(a.data) + ")" + (s.senioridade ? " · " + esc(s.senioridade) : ""), corpo, largo: true,
      rodape: '<button class="btn" data-acao="salvar-alinhamento" data-id="' + esc(o.id) + '" data-n="' + n + '">' + (a.registrado ? "Salvar a avaliação" : "Registrar a avaliação") + '</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: function (painel) {
        const atualizar = () => previaNota(painel, a.patamar);
        painel.__previa = atualizar;
        painel.querySelector("#form-alinh").addEventListener("change", (ev) => { if (ev.target.matches("[data-regua]")) atualizar(); });
        atualizar();
      },
    });
  };
  ui.acoes["adicionar-entrega"] = function () {
    const l = document.getElementById("entregas-aval");
    if (!l) return;
    l.insertAdjacentHTML("beforeend", linhaEntrega("", "", ""));
    const novo = l.lastElementChild.querySelector("[data-entrega]");
    if (novo) novo.focus();
  };
  ui.acoes["remover-entrega"] = function (el) {
    const linha = el.closest("[data-linha]");
    if (linha) linha.remove();
    const l = document.getElementById("entregas-aval");
    if (l && !l.children.length) l.insertAdjacentHTML("beforeend", linhaEntrega("", "", ""));
    const p = document.getElementById("painel");
    if (p && p.__previa) p.__previa();
  };
  ui.acoes["salvar-alinhamento"] = function (el) {
    const f = document.getElementById("form-alinh");
    const n = Number(el.dataset.n);
    if (!ui.validar(f, ["data", "retorno"].concat(n === 3 ? ["continuidade"] : []))) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    if (d.data > ctx.hoje) { ui.erroNoPainel("A data da avaliação não pode ser futura."); return; }
    const entregas = lerEntregas(f).filter((x) => x.titulo);
    if (!entregas.length) { ui.erroNoPainel("Inclua pelo menos uma entrega do mês."); return; }
    if (entregas.some((x) => !x.leitura)) { ui.erroNoPainel("Avalie cada entrega na régua (ou tire da lista a que não vale)."); return; }
    const o = ctx.idx.porId.onboarding[el.dataset.id];
    const s = dom.statusOnboarding(ctx, o);
    const a = s.alinhamentos[n - 1];
    const m = dom.infoMembro(ctx, s.membro);
    const nota = calc.notaDasLeituras(entregas.map((x) => x.leitura));
    const resultado = calc.resultadoFase(nota, a.patamar, entregas.filter((x) => x.leitura === "Fora do padrão").length) || "";
    const tiradas = a.leituras.filter((l) => !entregas.some((x) => x.id === l.id));
    const primeira = !a.registrado;
    const dados = { autor: E().eu.id };
    dados["al" + n + "Data"] = d.data;
    dados["al" + n + "Nota"] = nota;
    dados["al" + n + "Resultado"] = resultado;
    dados["al" + n + "Retorno"] = d.retorno.trim();
    dados["al" + n + "Combinados"] = (d.combinados || "").trim();
    if (n === 3) {
      dados.continuidade = d.continuidade;
      if (primeira || o.continuidade !== d.continuidade) dados.estagio = d.continuidade === "Continuidade confirmada" ? "SUCCESS" : "FAIL";
    } else if (primeira) dados.estagio = PROXIMO_ESTAGIO[n];
    ui.salvar(el, async () => {
      for (const x of entregas) {
        const base = { titulo: x.titulo, leitura: x.leitura, lidaEm: d.data, autor: E().eu.id, estagio: "SUCCESS" };
        if (x.id) await ui.atualizar("leituras", x.id, base);
        else await ui.criar("leituras", Object.assign(base, { membroId: m.id, responsavel: m.responsavel, origem: "Onboarding", fase: a.fase, onboardingId: o.id, trimestre: calc.trimestreDe(d.data).chave }));
      }
      // tirada da lista: vai para "Cancelada" (não some do histórico do Bitrix)
      for (const l of tiradas) await ui.atualizar("leituras", l.id, { estagio: "FAIL" });
      await ui.atualizar("onboarding", o.id, dados);
      // Dia 90 registrado: o membro passa para Ativo no processo Membros (robô 5 da 3.2)
      if (n === 3 && dados.estagio === "SUCCESS") await ui.atualizar("membros", s.membro.id, { estagio: "ATIVO" });
      if (primeira && resultado === "Abaixo do esperado") await GP.app.avisarRH("Onboarding de " + m.nome + ": " + a.rotulo + " registrada com resultado abaixo do esperado.");
    }, { mensagem: !primeira ? "Avaliação atualizada." : n === 3 ? (d.continuidade === "Continuidade confirmada" ? "Onboarding concluído. " + primeiroNome(m.nome) + " passa para Ativo." : "Avaliação final registrada. Combine com o RH os próximos passos.") : "Avaliação registrada. Próxima fase: " + (n === 1 ? "Imersão" : "Mar Aberto") + "." });
  };

  /* ================================================================ PLANEJAMENTO DA FUNÇÃO */
  function telaPlanejamentos() {
    const ctx = E().ctx;
    const lista = (ctx.registros.planejamento || []).slice().sort((a, b) => String(a.funcao || a.titulo).localeCompare(String(b.funcao || b.titulo), "pt-BR"));
    return c.voltar("#/onboarding", "Onboarding") + c.cabecalho("onboarding", "Planejamento da função", "<span>feito uma vez por função; vira o modelo da Ficha a cada nova contratação</span>", '<button class="btn" data-acao="planejamento" data-id="">' + icone("mais", 15) + " Novo planejamento</button>") +
      '<div class="card">' + (lista.length ? '<div class="lista">' + lista.map((p) => '<div class="item clicavel" data-acao="planejamento" data-id="' + esc(p.id) + '"><div class="principal-item"><div class="t">' + esc(p.funcao || p.titulo) + '</div><div class="d">' + esc(p.area || "") + (linhasDe(p.padroes).length ? " · " + plural(linhasDe(p.padroes).length, "competência", "competências") : "") + "</div></div><div class=\"lado\">" +
        c.tag(p.estagioNome, p.estagio === "SUCCESS" ? "verde" : p.estagio === "FAIL" ? "cinza" : "ambar") + "</div></div>").join("") + "</div>" : c.vazio("Nenhuma função planejada ainda.")) + "</div>";
  }
  ui.acoes["planejamento"] = function (el) {
    const p = el.dataset.id ? E().ctx.idx.porId.planejamento[el.dataset.id] : {};
    ui.abrirPainel({
      titulo: p.id ? "Planejamento: " + (p.funcao || p.titulo) : "Novo planejamento da função", largo: true,
      corpo: '<div id="form-plan">' + '<div class="linha-campos">' + c.campo({ nome: "funcao", rotulo: "Função", valor: p.funcao }) + c.campo({ nome: "area", rotulo: "Setor e área", valor: p.area }) + "</div>" +
        c.campo({ nome: "escopo", rotulo: "Escopo", tipo: "textoLongo", valor: p.escopo }) + campoCompetencias(p.padroes) +
        c.campo({ nome: "indicadores", rotulo: "Indicadores", tipo: "textoLongo", valor: p.indicadores }) +
        '<div class="grupo-form"><div class="rotulo-grupo">Entregas de cada mês (uma por linha)</div>' +
        c.campo({ nome: "entregasAncoragem", rotulo: "1º mês · Ancoragem", tipo: "textoLongo", valor: p.entregasAncoragem }) + c.campo({ nome: "entregasImersao", rotulo: "2º mês · Imersão", tipo: "textoLongo", valor: p.entregasImersao }) +
        c.campo({ nome: "entregasMarAberto", rotulo: "3º mês · Mar Aberto", tipo: "textoLongo", valor: p.entregasMarAberto }) + "</div>" +
        c.campo({ nome: "estagio", rotulo: "Situação", tipo: "escolha", opcoes: [{ valor: "NEW", rotulo: "Em elaboração" }, { valor: "SUCCESS", rotulo: "Publicado (vira modelo da Ficha)" }, { valor: "FAIL", rotulo: "Arquivado" }], valor: p.estagio || "NEW" }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-planejamento" data-id="' + esc(p.id || "") + '">Salvar</button>' + (p.id ? c.botaoExcluir("planejamento", p, { descricao: "o planejamento da função \"" + (p.funcao || p.titulo) + "\"" }) : "") + '<button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-planejamento"] = function (el) {
    const f = document.getElementById("form-plan");
    if (!ui.validar(f, ["funcao", "escopo"])) return;
    const d = ui.lerForm(f);
    const dados = { titulo: d.funcao, funcao: d.funcao, area: d.area, escopo: d.escopo, padroes: lerCompetencias(f), indicadores: d.indicadores, entregasAncoragem: d.entregasAncoragem, entregasImersao: d.entregasImersao, entregasMarAberto: d.entregasMarAberto, estagio: d.estagio || "NEW" };
    ui.salvar(el, () => (el.dataset.id ? ui.atualizar("planejamento", el.dataset.id, dados) : ui.criar("planejamento", dados)), { mensagem: "Planejamento salvo." });
  };

  GP.telas = GP.telas || {};
  GP.telas.onboarding = { resumoHtml, ESTAGIO_POR_FASE, textoFicha, COR_LEITURA };
})(window);
