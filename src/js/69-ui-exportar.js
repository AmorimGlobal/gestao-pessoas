/* =====================================================================================
   TELA — Exportar (só o RH): planilhas CSV para as análises mensais, trimestrais,
   semestrais e anuais (reunião de 29/10/2026: o RH extrai sozinho, sem pedir ao TI).
   -------------------------------------------------------------------------------------
   Sai o que o app já carregou com o login do RH, no período escolhido. CSV com ";" e
   BOM, que o Excel em português abre direto. Cada conjunto tem a data que define o período.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;

  const dia = (iso) => String(iso || "").slice(0, 10);
  const nome = (id) => (id ? dom.pessoa(E().ctx, id).nome : "");
  const membroDe = (r) => { const ctx = E().ctx; const m = ctx.idx.membro[r.membroId]; return m ? dom.infoMembro(ctx, m) : { nome: r.titulo || "", lideranca: "", coordenacao: "" }; };

  /** Conjuntos: rótulo, de onde vem a data do período, colunas e linhas */
  const CONJUNTOS = {
    membros: {
      rotulo: "Membros", nota: "Todos os itens do processo Membros (o período não se aplica).", semPeriodo: true,
      linhas: (ctx) => (ctx.registros.membros || []).map((m0) => {
        const m = dom.infoMembro(ctx, m0);
        return { "Membro": m.nome, "E-mail": m.email, "Estágio": m.estagioNome || m.estagio, "Departamento e função": m.funcao || m.cargo, "Liderança direta": nome(m.lideranca), "Coordenação": nome(m.coordenacao),
          "Ingresso": dia(m.ingresso), "Contrato": m.contrato, "Nível": m.nivel, "Senioridade": m.senioridade, "Cidade de referência": m.cidade, "Saiu em": m.estagio === "SUCCESS" ? dia(m.movidoEm) : "" };
      }),
    },
    feedbacks: {
      rotulo: "Feedbacks SCI", nota: "Pela data em que o feedback aconteceu.", data: (r) => r.data,
      linhas: (ctx) => (ctx.registros.feedbacks || []).filter((f) => f.estagio !== "FAIL").map((f) => {
        const m = membroDe(f);
        return { _data: f.data, "Data": dia(f.data), "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Registrado por": nome(f.autor || f.criadoPor), "Tipo": f.tipo,
          "Situação": f.situacao, "Comportamento": f.comportamento, "Impacto": f.impacto, "Combinados": f.combinados, "Retroativo": f.retroativo ? "Sim" : "Não" };
      }),
    },
    mensal: {
      rotulo: "1:1 mensais", nota: "Pela data da conversa.",
      linhas: (ctx) => (ctx.registros.mensal || []).filter((r) => r.estagio !== "FAIL").map((r) => {
        const m = membroDe(r);
        return { _data: r.data, "Data": dia(r.data), "Mês": calc.mesDe(r.data || ctx.hoje).rotulo, "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Registrado por": nome(r.autor || r.criadoPor),
          "Como o membro está": r.comoEsta, "Precisa de apoio": r.apoio, "Principais pontos": r.pontos, "Combinados": r.combinados };
      }),
    },
    o2o: {
      rotulo: "O2O (trimestral)", nota: "Pela data em que o O2O aconteceu (ou o início do trimestre, se ainda não aconteceu).",
      linhas: (ctx) => (ctx.registros.ciclo || []).filter((x) => x.estagio !== "FAIL").map((ci) => {
        const m = membroDe(ci);
        const t = calc.trimestrePorChave(ci.trimestre);
        return { _data: ci.realizadoEm || (t && t.inicio), "Trimestre": t ? t.rotulo : ci.trimestre, "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Agendado para": dia(ci.data1a1), "Realizado em": dia(ci.realizadoEm),
          "Registrado por": nome(ci.autor), "Temas do membro": ci.temas, "Objetivo de desenvolvimento": ci.objetivo, "Próximo nível": ci.proximoNivel, "Progresso": ci.progresso, "Retorno para a liderança": ci.retorno,
          "Combinados": dom.combinados(ci).map((x) => x.texto + " (" + (x.resp || "") + (x.prazo ? ", até " + calc.fmtDataAno(x.prazo) : "") + ")").join(" | ") };
      }),
    },
    planos: {
      rotulo: "Planos de melhoria", nota: "Pela data de início do plano.",
      linhas: (ctx) => (ctx.registros.planos || []).map((p) => {
        const m = membroDe(p);
        const s = dom.statusPlano(ctx, p);
        return { _data: p.inicio, "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Início": dia(p.inicio), "Término": dia(s.termino), "Situação": s.texto, "Resultado esperado 1": p.resultado1, "Resultado esperado 2": p.resultado2,
          "Check-in 1": p.checkin1, "Check-in 2": p.checkin2, "Final 1": p.final1, "Final 2": p.final2, "Apoio oferecido": p.apoio };
      }),
    },
    onboarding: {
      rotulo: "Onboarding (avaliações)", nota: "Pela data de ingresso (Dia 1).",
      linhas: (ctx) => (ctx.registros.onboarding || []).map((o) => {
        const m = membroDe(o);
        const s = dom.statusOnboarding(ctx, o);
        const r = { _data: s.ingresso, "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Dia 1": dia(s.ingresso), "Senioridade": s.senioridade, "Fase": s.fase, "Ficha preenchida em": dia(o.fichaEm), "Ficha enviada em": dia(o.fichaEnviadaEm) };
        s.alinhamentos.forEach((a) => {
          const p = a.numero + "º mês";
          r[p + " · data"] = a.registrado ? dia(a.dataRegistro) : ""; r[p + " · nota"] = a.registrado && a.nota !== null ? a.nota : ""; r[p + " · patamar"] = a.patamar === undefined ? "" : a.patamar; r[p + " · resultado"] = a.registrado ? (a.resultado || "") : "";
        });
        r["Continuidade"] = o.continuidade;
        return r;
      }),
    },
    entregas: {
      rotulo: "Entregas avaliadas (onboarding)", nota: "Pela data da avaliação.",
      linhas: (ctx) => (ctx.registros.leituras || []).filter((l) => l.estagio !== "FAIL" && l.leitura).map((l) => {
        const m = membroDe(l);
        return { _data: l.lidaEm, "Membro": m.nome, "Liderança direta": nome(m.lideranca), "Fase": l.fase || l.origem, "Entrega": l.titulo, "Avaliação": l.leitura, "Nota": calc.NOTA_LEITURA[l.leitura], "Avaliada em": dia(l.lidaEm), "Por": nome(l.autor) };
      }),
    },
    desligamentos: {
      rotulo: "Desligamentos", nota: "Membros que passaram para Encerrado no processo Membros, pela data da mudança.",
      linhas: (ctx) => (ctx.registros.membros || []).filter((m) => m.estagio === "SUCCESS").map((m0) => {
        const m = dom.infoMembro(ctx, m0);
        const data = dia(m0.movidoEm || m0.atualizadoEm);
        return { _data: data, "Membro": ctx.idx.usuario[m0.responsavel] ? m.nome : m0.titulo, "Saiu em": data, "Trimestre": data ? calc.periodoDe(data, "trimestre").rotulo : "", "Semestre": data ? calc.periodoDe(data, "semestre").rotulo : "", "Ano": data.slice(0, 4),
          "Liderança direta": nome(m.lideranca), "Coordenação": nome(m.coordenacao), "Contrato": m.contrato };
      }),
    },
    solicitacoes: {
      rotulo: "Solicitações de encerramento", nota: "Pela data em que a solicitação foi criada (esteira e app).",
      // as mesmas colunas nas duas origens (o cabeçalho sai da primeira linha); as do formulário da Luciele ficam vazias nas do app
      linhas: (ctx) => dom.solicitacoesOffboarding(ctx).map((s) => ({ _data: s.criadaEm, "Origem": "Esteira HR | Offboarding", "Membro": s.membro, "Setor": s.setor, "Motivo": s.motivoTexto, "Solicitante": s.solicitante,
        "Etapa": s.etapa, "Criada em": s.criadaEm, "Data limite": s.dataLimite, "Data efetiva": s.dataEfetiva,
        "Feedbacks formais": s.feedbacksFormais, "Registros anexados": s.anexos, "Sucessor interno": s.sucessor, "Nova contratação": s.novaContratacao, "Pontos a considerar": s.riscos.join("; ") }))
        .concat((ctx.registros.encerramentos || []).map((e) => {
          const m = membroDe(e);
          return { _data: dia(e.criadoEm), "Origem": "App", "Membro": m.nome, "Setor": m.funcao || "", "Motivo": e.motivo, "Solicitante": nome(e.solicitante || e.autor),
            "Etapa": e.estagioNome || e.estagio, "Criada em": dia(e.criadoEm), "Data limite": dia(e.dataDesejada), "Data efetiva": dia(e.concluidaEm),
            "Feedbacks formais": "", "Registros anexados": "", "Sucessor interno": "", "Nova contratação": "", "Pontos a considerar": "" };
        })),
    },
    vagas: {
      rotulo: "Vagas", nota: "Pela data de aprovação (ou de fechamento).",
      linhas: (ctx) => dom.vagasDe(ctx, null).map((v) => ({ _data: v.aprovadaEm || v.fechadaEm || v.atualizadoEm, "Vaga": v.titulo, "Etapa": v.etapa, "Solicitante": v.solicitante, "Aprovada em": v.aprovadaEm, "Fechada em": v.fechadaEm,
        "Dias em aberto": v.diasEmAberto === null ? "" : v.diasEmAberto, "Dias para fechar": v.tempoParaFechar === null ? "" : v.tempoParaFechar, "Entrada desejada": v.entradaDesejada })),
    },
  };

  function csv(linhas) {
    if (!linhas.length) return "";
    const cols = Object.keys(linhas[0]).filter((k) => k.charAt(0) !== "_");
    const cel = (v) => { const t = v === null || v === undefined ? "" : String(v); return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return "﻿" + [cols.map(cel).join(";")].concat(linhas.map((l) => cols.map((k) => cel(l[k])).join(";"))).join("\r\n");
  }
  function linhasDoPeriodo(chave, de, ate) {
    const cj = CONJUNTOS[chave];
    const todas = cj.linhas(E().ctx);
    if (cj.semPeriodo) return todas;
    return todas.filter((l) => { const d = dia(l._data); return d && (!de || d >= de) && (!ate || d <= ate); }).sort((a, b) => (dia(a._data) < dia(b._data) ? -1 : 1));
  }
  function baixar(nomeArquivo, texto) {
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = nomeArquivo;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) { console.warn("Download bloqueado:", e); return false; }
  }

  function periodoPadrao() {
    const f = E().filtros;
    const hoje = E().ctx.hoje;
    return { de: f.expDe || hoje.slice(0, 4) + "-01-01", ate: f.expAte || hoje };
  }
  function abaExportar() {
    const p = periodoPadrao();
    const atalhos = [["Este mês", calc.mesDe(E().ctx.hoje)], ["Este trimestre", calc.trimestreDe(E().ctx.hoje)], ["Este semestre", calc.semestreDe(E().ctx.hoje)], ["Este ano", { inicio: E().ctx.hoje.slice(0, 4) + "-01-01", fim: E().ctx.hoje.slice(0, 4) + "-12-31" }]];
    return '<div class="card"><h3>Exportar dados<span class="extra muted">planilhas CSV que o Excel abre direto</span></h3>' +
      '<p class="muted" style="margin-top:0">Escolha o período e baixe o conjunto. Sai o que o app leu com o seu login, inclusive o texto dos registros: guarde os arquivos com o mesmo cuidado do dossiê.</p>' +
      '<div id="form-exportar" class="linha-campos" style="max-width:520px">' + c.campo({ nome: "de", rotulo: "De", tipo: "data", valor: p.de }) + c.campo({ nome: "ate", rotulo: "Até", tipo: "data", valor: p.ate }) + "</div>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 16px">' + atalhos.map((x) => '<button class="btn peq sec" data-acao="exportar-periodo" data-de="' + x[1].inicio + '" data-ate="' + x[1].fim + '">' + esc(x[0]) + "</button>").join("") + "</div>" +
      '<div class="lista">' + Object.keys(CONJUNTOS).map((k) => {
        const n = linhasDoPeriodo(k, p.de, p.ate).length;
        return '<div class="item"><div class="principal-item"><div class="t">' + esc(CONJUNTOS[k].rotulo) + '</div><div class="d">' + esc(CONJUNTOS[k].nota) + " · " + plural(n, "linha", "linhas") + "</div></div>" +
          '<div class="lado"><button class="btn peq" data-acao="exportar-csv" data-conjunto="' + k + '"' + (n ? "" : " disabled") + ">" + icone("baixar", 13) + " Baixar</button></div></div>";
      }).join("") + "</div></div>";
  }
  ui.acoes["exportar-periodo"] = function (el) { E().filtros.expDe = el.dataset.de; E().filtros.expAte = el.dataset.ate; E().manterRolagem = true; ui.render(); };
  document.addEventListener("change", function (ev) {
    const f = ev.target.closest && ev.target.closest("#form-exportar");
    if (!f) return;
    const d = ui.lerForm(f);
    E().filtros.expDe = d.de; E().filtros.expAte = d.ate;
    E().manterRolagem = true;
    ui.render();
  });
  ui.acoes["exportar-csv"] = function (el) {
    const chave = el.dataset.conjunto;
    if (!CONJUNTOS[chave]) return;
    const p = periodoPadrao();
    const linhas = linhasDoPeriodo(chave, p.de, p.ate);
    if (!linhas.length) { ui.avisar("Nada para exportar neste período."); return; }
    const arquivo = "gestao-pessoas_" + chave + (CONJUNTOS[chave].semPeriodo ? "_" + E().ctx.hoje : "_" + p.de + "_a_" + p.ate) + ".csv";
    if (baixar(arquivo, csv(linhas))) ui.avisar(plural(linhas.length, "linha exportada", "linhas exportadas") + ": " + arquivo + ".");
    else ui.avisar("O navegador bloqueou o download. Tente pelo Bitrix no navegador do computador.", "erro");
  };

  GP.telas = GP.telas || {};
  GP.telas.exportar = { abaExportar, CONJUNTOS, csv, linhasDoPeriodo };
})(window);
