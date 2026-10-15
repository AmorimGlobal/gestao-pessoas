/* =====================================================================================
   TELAS — Desempenho: leituras de entrega (3.4), evidências do trimestre e ano (3.3, 4.8)
   -------------------------------------------------------------------------------------
   Revisão de 13/10 (4.8): só entram para leitura as entregas do onboarding, do plano de
   alinhamento e as marcadas como relevantes. A leitura não é indicador. A nota do
   trimestre é a classificação da liderança em 4 níveis, com base nas evidências.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, primeiroNome, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;
  const COR_LEITURA = { "Conforme": "verde", "Com ajuste": "azul", "Fora do padrão": "ambar", "Não entregue": "vermelho" };

  function leiturasPendentes(membros) {
    const ctx = E().ctx;
    const lista = [];
    membros.forEach((m) => (ctx.idx.porMembro.leituras[m.id] || []).forEach((l) => { if (!l.leitura && ["NEW", "ATRASADA"].indexOf(l.estagio) >= 0) lista.push(l); }));
    return lista.sort((a, b) => {
      const pa = a.origem === "Plano de alinhamento" ? 0 : 1, pb = b.origem === "Plano de alinhamento" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.prazoLeitura || "9999") < String(b.prazoLeitura || "9999") ? -1 : 1;
    });
  }

  /* ================================================================ TELA DESEMPENHO */
  ui.rotas.desempenho = function (partes) {
    if (partes[0] === "leitura" && partes[1]) return telaLeitura(partes[1]);
    if (partes[0] === "ciclo" && partes[1]) return telaEvidencias(partes[1]);
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao();
    const pend = leiturasPendentes(membros);
    const ant = ctx.triAnterior;
    const itensAnt = membros.map((m) => dom.cicloDo(ctx, m.id, ant.chave)).filter(Boolean);
    const okAnt = itensAnt.filter((x) => x.estagio === "SUCCESS").length;
    const numeros = "<span><b>" + pend.length + "</b> " + (pend.length === 1 ? "entrega aguarda" : "entregas aguardam") + " leitura</span><span>evidências do " + ant.curto + ": <b>" + esc(calc.percentual(okAnt, itensAnt.length).texto) + "</b></span>";
    let h = c.cabecalho("desempenho", "Desempenho", numeros, '<button class="btn sec" data-acao="marcar-entrega">' + icone("mais", 15) + " Marcar entrega como relevante</button>");
    h += '<div class="grade lado"><div><div class="card"><h3>Leituras de entrega pendentes<span class="extra muted">ligadas a plano primeiro</span></h3>' +
      (pend.length ? '<div class="lista">' + pend.map((l) => {
        const m = dom.infoMembro(ctx, ctx.idx.membro[l.membroId]);
        return '<div class="item clicavel" data-rota="#/desempenho/leitura/' + esc(l.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(l.titulo || "Entrega") + '</div><div class="d">' + esc(m.nome) + " · " + esc(l.origem || "") + (l.fase ? " · " + esc(l.fase) : "") + (l.concluidaEm ? " · concluída em " + calc.fmtData(l.concluidaEm) : "") + "</div></div>" +
          '<div class="lado">' + (l.prazoLeitura && l.origem !== "Marcada como relevante" ? c.prazo(l.prazoLeitura) : '<span class="prazo">sem prazo</span>') + "</div></div>";
      }).join("") + "</div>" : c.vazio("Nenhuma entrega aguardando leitura.")) +
      '<p class="muted" style="font-size:12px">Régua: Conforme 100 · Com ajuste 70 · Fora do padrão 30 · Não entregue 0. A leitura e o comentário interno ficam fora do alcance do membro e não entram nos indicadores.</p></div>';
    // Evidências do trimestre anterior
    h += '<div class="card"><h3>Evidências do ' + esc(ant.rotulo) + '<span class="extra muted">prazo ' + calc.fmtData(calc.prazoEvidencias(ant)) + "</span></h3>" +
      (itensAnt.length ? '<div class="lista">' + itensAnt.map((ci) => {
        const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId]);
        const s = dom.statusCiclo(ctx, ci);
        return '<div class="item clicavel" data-rota="#/desempenho/ciclo/' + esc(ci.id) + '">' + c.avatar(m, 30) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + (ci.classificacao ? "Classificação: " + esc(ci.classificacao) : "sem classificação") + "</div></div>" +
          '<div class="lado">' + c.tag(s.texto, s.cor) + "</div></div>";
      }).join("") + "</div>" : c.vazio("Nenhum item do ciclo no trimestre anterior.")) + "</div></div>";
    // Lateral: resultados do CRM e o ano
    h += '<div><div class="card"><h3>Resultados das funções medidas no CRM</h3><p class="muted" style="margin-top:0">Os números de cada função (por exemplo, reuniões agendadas de SDR ou processos concluídos de Soluções) entram sozinhos no card de cada membro, como evidência. Nunca lado a lado, para não virar ranking.</p>' +
      '<div class="aviso-atencao">Aguardando a lista de indicadores por função, definida por Operações (especificação 6.3). O botão "Sincronizar resultados" entra quando a lista existir.</div></div>' +
      '<div class="card"><h3>Desempenho anual</h3><p class="muted" style="margin-top:0">A avaliação anual é a soma dos 4 trimestres do Ciclo, com os 1:1 e os feedbacks ligados. Abra o card do membro, aba Desempenho anual.</p><div class="lista">' +
      membros.filter((m) => m.estagio === "ATIVO").map((m0) => { const m = dom.infoMembro(ctx, m0); const a = dom.anoDoMembro(ctx, m.id, Number(ctx.hoje.slice(0, 4))); return '<div class="item clicavel" data-rota="#/membro/' + esc(m.id) + '/desempenho">' + c.avatar(m, 28) + '<div class="principal-item"><div class="t">' + esc(m.nome) + '</div><div class="d">' + a.classificados + " de 4 trimestres classificados</div></div></div>"; }).join("") +
      "</div></div></div></div>";
    return h;
  };

  /* ================================================================ LEITURA DE ENTREGA */
  function telaLeitura(id) {
    const ctx = E().ctx;
    const l = ctx.idx.porId.leituras[id];
    if (!l) return c.voltar("#/desempenho", "Desempenho") + '<div class="card">' + c.vazio("Leitura não encontrada.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[l.membroId] || {});
    const travada = l.leitura && l.lidaEm && calc.diffDias(l.lidaEm, ctx.hoje) > 2;
    const plano = l.planoId ? ctx.idx.porId.planos[l.planoId] : null;
    let h = c.voltar("#/desempenho", "Desempenho") + c.cabecalho("desempenho", l.titulo || "Entrega", "<span>" + esc(m.nome) + "</span><span>" + esc(l.origem || "") + "</span>" + (l.leitura ? "<span>" + c.tag(l.leitura, COR_LEITURA[l.leitura]) + "</span>" : ""),
      l.tarefaId ? '<button class="btn sec" data-acao="abrir-tarefa" data-id="' + esc(l.tarefaId) + '">' + icone("externo", 14) + " Abrir a tarefa</button>" : (l.tarefaLink ? '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(l.tarefaLink) + '">' + icone("externo", 14) + " Abrir a tarefa</a>" : ""));
    h += '<div class="card">' + c.dados([["Pronta quando", l.prontaQuando], ["Prazo da tarefa", calc.fmtDataAno(l.prazoTarefa)], ["Concluída em", calc.fmtDataAno(l.concluidaEm)], ["No prazo", l.noPrazo],
      ["Voltou para ajuste", l.ajustes === null || l.ajustes === undefined ? "" : String(l.ajustes)], ["Complexidade", l.complexidade], ["Fase do onboarding", l.fase], ["Trimestre", (calc.trimestrePorChave(l.trimestre) || {}).rotulo],
      plano ? ["Plano de alinhamento", '<a href="#/offboarding/plano/' + esc(plano.id) + '">abrir o plano</a>', true] : null]) + "</div>";
    if (l.leitura) {
      h += '<div class="card"><h3>Leitura registrada</h3>' + c.dados([["Leitura", l.leitura + " (" + calc.NOTA_LEITURA[l.leitura] + ")"], ["Lida em", calc.fmtDataAno(l.lidaEm)], ["Por", dom.pessoa(ctx, l.autor).nome]]) +
        (l.comentario ? '<div style="margin-top:12px">' + c.textoRegistro("Comentário interno", l.comentario) + "</div>" : "") +
        (l.adendos ? '<div style="margin-top:12px"><div class="k" style="font-size:11px;text-transform:uppercase;color:var(--suave);font-weight:700">Adendos</div><div class="adendo">' + esc(l.adendos) + "</div></div>" : "") +
        '<div style="margin-top:14px">' + (travada ? '<button class="btn sec" data-acao="adendo" data-chave="leituras" data-id="' + esc(l.id) + '">Adicionar adendo</button>' : '<button class="btn sec" data-acao="registrar-leitura" data-id="' + esc(l.id) + '">Editar a leitura</button>') + "</div></div>";
    } else {
      h += '<div class="card acao"><h3>Registrar a leitura</h3><p class="muted" style="margin-top:0">Abra a tarefa, confira a entrega e registre a leitura aqui. Ela nunca vai para o comentário da tarefa: o membro não vê a leitura (4.1).</p><button class="btn" data-acao="registrar-leitura" data-id="' + esc(l.id) + '">Registrar a leitura</button></div>';
    }
    return h;
  }
  ui.acoes["abrir-tarefa"] = function (el) {
    if (E().repo.modo === "bitrix" && window.BX24 && BX24.openPath) BX24.openPath("/company/personal/user/0/tasks/task/view/" + el.dataset.id + "/");
    else ui.avisar("Na demonstração, a tarefa " + el.dataset.id + " abriria no Bitrix.");
  };
  ui.acoes["registrar-leitura"] = function (el) {
    const l = E().ctx.idx.porId.leituras[el.dataset.id];
    ui.abrirPainel({
      titulo: "Leitura: " + (l.titulo || "entrega"), sub: "Conforme 100 · Com ajuste 70 · Fora do padrão 30 · Não entregue 0",
      corpo: '<div id="form-leitura">' + c.campo({ nome: "leitura", rotulo: "Leitura", tipo: "escolha", opcoes: op.leitura.map((x) => ({ valor: x, rotulo: x + " (" + calc.NOTA_LEITURA[x] + ")" })), valor: l.leitura }) +
        c.campo({ nome: "complexidade", rotulo: "Complexidade", tipo: "escolha", opcoes: op.complexidade, valor: l.complexidade, opcional: true, ajuda: "Definida pela liderança ao combinar a entrega." }) +
        c.campo({ nome: "comentario", rotulo: "Comentário interno", tipo: "textoLongo", valor: l.comentario, opcional: true, ajuda: "Só liderança, coordenação e RH veem. O retorno ao membro vai em feedback SCI." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-leitura" data-id="' + esc(l.id) + '">Salvar a leitura</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-leitura"] = function (el) {
    const f = document.getElementById("form-leitura");
    if (!ui.validar(f, ["leitura"])) return;
    const d = ui.lerForm(f);
    ui.salvar(el, () => ui.atualizar("leituras", el.dataset.id, { leitura: d.leitura, complexidade: d.complexidade, comentario: d.comentario, lidaEm: E().ctx.hoje, autor: E().eu.id, estagio: "SUCCESS" }), { mensagem: "Leitura registrada." });
  };

  /* ---------------- marcar entrega como relevante / entrega fora do modelo (4.2) ---------------- */
  ui.acoes["marcar-entrega"] = function () {
    const ctx = E().ctx;
    const membros = ui.membrosDaVisao().map((m) => dom.infoMembro(ctx, m)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    ui.abrirPainel({
      titulo: "Marcar entrega como relevante", sub: "Também serve para uma tarefa concluída fora do modelo \"Entrega\": cole o link e informe o \"pronta quando\".",
      corpo: '<div id="form-entrega">' + c.campo({ nome: "membroId", rotulo: "Membro", tipo: "lista", opcoes: membros.map((m) => ({ valor: m.id, rotulo: m.nome })) }) +
        c.campo({ nome: "tarefa", rotulo: "Link ou número da tarefa no Bitrix", placeholder: "https://…/tasks/task/view/4521/ ou 4521" }) +
        c.campo({ nome: "titulo", rotulo: "O que foi entregue", placeholder: "Ex.: Parecer de elegibilidade do caso Moura" }) +
        c.campo({ nome: "prontaQuando", rotulo: "Pronta quando", tipo: "textoLongo", linhas: 2, ajuda: "O critério combinado para a entrega estar pronta." }) +
        '<div class="linha-campos">' + c.campo({ nome: "prazoTarefa", rotulo: "Prazo da tarefa", tipo: "data" }) + c.campo({ nome: "concluidaEm", rotulo: "Concluída em", tipo: "data", max: ctx.hoje }) + "</div>" +
        c.campo({ nome: "complexidade", rotulo: "Complexidade", tipo: "escolha", opcoes: op.complexidade, opcional: true }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-entrega">Incluir na lista de leitura</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-entrega"] = function (el) {
    const f = document.getElementById("form-entrega");
    if (!ui.validar(f, ["membroId", "tarefa", "titulo", "prontaQuando", "concluidaEm"])) return;
    const d = ui.lerForm(f);
    const ctx = E().ctx;
    const m = dom.infoMembro(ctx, ctx.idx.membro[d.membroId]);
    const idTarefa = (/(\d+)\/?\s*$/.exec(d.tarefa.trim()) || [])[1] || "";
    const plano = dom.planoAtivoDo(ctx, m.id);
    ui.salvar(el, () => ui.criar("leituras", {
      titulo: d.titulo, membroId: m.id, responsavel: m.responsavel, tarefaId: idTarefa, tarefaLink: /^https?:/.test(d.tarefa.trim()) ? d.tarefa.trim() : "",
      prontaQuando: d.prontaQuando, prazoTarefa: d.prazoTarefa, concluidaEm: d.concluidaEm, complexidade: d.complexidade,
      noPrazo: d.prazoTarefa ? (d.concluidaEm <= d.prazoTarefa ? "Sim" : "Não") : "",
      origem: plano ? "Plano de alinhamento" : "Marcada como relevante", planoId: plano ? plano.id : "",
      prazoLeitura: plano ? calc.addDias(ctx.hoje, ((E().config.parametros || {}).prazoLeitura) || 7) : "",
      trimestre: calc.trimestreDe(d.concluidaEm).chave, estagio: "NEW",
    }), { mensagem: "Entrega incluída na lista de leitura." });
  };

  /* ================================================================ EVIDÊNCIAS DO TRIMESTRE */
  function telaEvidencias(id) {
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[id];
    if (!ci) return c.voltar("#/desempenho", "Desempenho") + '<div class="card">' + c.vazio("Item do ciclo não encontrado.") + "</div>";
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId] || {});
    const t = calc.trimestrePorChave(ci.trimestre);
    const s = dom.statusCiclo(ctx, ci);
    const leit = (ctx.idx.porMembro.leituras[m.id] || []).filter((l) => l.trimestre === ci.trimestre && l.estagio !== "FAIL");
    const pend = leit.filter((l) => !l.leitura);
    const travado = ci.registroEvidEm && !dom.editavel(ci.registroEvidEm, ui.agoraISO());
    const acao = ci.estagio === "SUCCESS" ? (travado ? '<button class="btn sec" data-acao="adendo" data-chave="ciclo" data-id="' + esc(ci.id) + '">Adicionar adendo</button>' : '<button class="btn sec" data-acao="registrar-evidencias" data-id="' + esc(ci.id) + '">Editar as evidências</button>')
      : '<button class="btn" data-acao="registrar-evidencias" data-id="' + esc(ci.id) + '"' + (pend.length ? " disabled title=\"Leia as entregas pendentes primeiro\"" : "") + ">Registrar as evidências</button>";
    return c.voltar("#/desempenho", "Desempenho") + c.cabecalho("desempenho", "Evidências de " + m.nome, "<span>" + esc(t ? t.rotulo : ci.trimestre) + "</span><span>" + c.tag(s.texto, s.cor) + "</span>" + (s.prazo ? "<span>" + c.prazo(s.prazo) + "</span>" : ""), acao) +
      '<div class="card"><h3>Leitura das entregas do trimestre<span class="extra muted">' + plural(leit.length - pend.length, "lida", "lidas") + (pend.length ? " · " + pend.length + " pendente(s)" : "") + "</span></h3>" +
      (leit.length ? '<div class="lista">' + leit.map((l) => '<div class="item clicavel" data-rota="#/desempenho/leitura/' + esc(l.id) + '"><div class="principal-item"><div class="t">' + esc(l.titulo) + '</div><div class="d">' + esc(l.origem || "") + "</div></div><div class=\"lado\">" + (l.leitura ? c.tag(l.leitura, COR_LEITURA[l.leitura]) : c.tag("Aguardando leitura", "ambar")) + "</div></div>").join("") + "</div>"
        : c.vazio("Nenhuma entrega com leitura no trimestre (só entram as de onboarding, de plano e as marcadas como relevantes).")) +
      (pend.length ? '<div class="aviso-atencao" style="margin-top:10px">Complete as leituras pendentes antes de registrar as evidências.</div>' : "") + "</div>" +
      GP.telas.rotinas.cicloResumoHtml(ci, true);
  }
  ui.acoes["registrar-evidencias"] = function (el) {
    const ctx = E().ctx;
    const ci = ctx.idx.porId.ciclo[el.dataset.id];
    const m = dom.infoMembro(ctx, ctx.idx.membro[ci.membroId]);
    ui.abrirPainel({
      titulo: "Evidências do trimestre · " + m.nome, sub: "Os números do Bitrix entram sozinhos. Escreva o contexto.", largo: true,
      corpo: '<div id="form-evid">' +
        c.campo({ nome: "resultados", rotulo: "Resultados do trimestre", tipo: "textoLongo", valor: ci.resultados, linhas: 4 }) +
        c.campo({ nome: "crescimento", rotulo: "Evidências de crescimento", tipo: "textoLongo", valor: ci.crescimento, ajuda: "O que a pessoa passou a fazer que antes não fazia." }) +
        c.campo({ nome: "percepcoes", rotulo: "Percepções da liderança", tipo: "textoLongo", valor: ci.percepcoes, opcional: true }) +
        c.campo({ nome: "pontosAtencao", rotulo: "Pontos de atenção para o próximo trimestre", tipo: "textoLongo", valor: ci.pontosAtencao, opcional: true }) +
        c.campo({ nome: "classificacao", rotulo: "Classificação do trimestre", tipo: "escolha", opcoes: op.classificacao, valor: ci.classificacao, ajuda: "Com base nas evidências, nos resultados esperados da Ficha e no contexto do CRM. A nota anual é definida depois da autoavaliação e da calibração." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-evidencias" data-id="' + esc(ci.id) + '">Registrar as evidências</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-evidencias"] = function (el) {
    const f = document.getElementById("form-evid");
    if (!ui.validar(f, ["resultados", "crescimento", "classificacao"])) return;
    const d = ui.lerForm(f);
    const ci = E().ctx.idx.porId.ciclo[el.dataset.id];
    const dados = { resultados: d.resultados, crescimento: d.crescimento, percepcoes: d.percepcoes, pontosAtencao: d.pontosAtencao, classificacao: d.classificacao, autor: E().eu.id, estagio: "SUCCESS" };
    if (!ci.registroEvidEm) dados.registroEvidEm = ui.agoraISO();
    ui.salvar(el, () => ui.atualizar("ciclo", ci.id, dados), { mensagem: "Evidências registradas." });
  };

  /* ================================================================ ANO DO MEMBRO */
  function anualHtml(m, ano) {
    const ctx = E().ctx;
    const a = dom.anoDoMembro(ctx, m.id, ano);
    const linhas = a.ciclos.map((x) => {
      const ci = x.item;
      const fbs = a.feedbacks.filter((f) => f.data >= x.tri.inicio && f.data <= x.tri.fim);
      return "<tr" + (ci ? ' class="clicavel" data-rota="#/desempenho/ciclo/' + esc(ci.id) + '"' : "") + "><td><b>" + esc(x.tri.rotulo) + "</b></td><td>" + (ci && ci.realizadoEm ? calc.fmtData(ci.realizadoEm) : '<span class="muted">—</span>') + "</td>" +
        "<td>" + (ci && ci.classificacao ? esc(ci.classificacao) : '<span class="muted">' + (ci ? "sem classificação" : "sem item do ciclo") + "</span>") + '</td><td class="num">' + x.leituras.length + '</td><td class="num">' + fbs.length + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>Avaliação de desempenho de ' + ano + '<span class="extra muted">' + a.classificados + " de 4 trimestres classificados</span></h3>" +
      '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Trimestre</th><th>1:1</th><th>Classificação da liderança</th><th class="n">Leituras</th><th class="n">Feedbacks SCI</th></tr></thead><tbody>' + linhas + "</tbody></table></div>" +
      '<p class="muted" style="font-size:12px;margin-top:12px">Feedbacks no ano: ' + (Object.keys(a.tipos).map((t) => esc(a.tipos[t] + " de " + t.toLowerCase())).join(", ") || "nenhum") +
      ". Autoavaliação em 01/11, calibração em 09/12 e devolutiva até 18/12 (4.8): a nota anual só é registrada depois da calibração.</p></div>";
  }

  GP.telas = GP.telas || {};
  GP.telas.desempenho = { anualHtml, leiturasPendentes, COR_LEITURA };
})(window);
