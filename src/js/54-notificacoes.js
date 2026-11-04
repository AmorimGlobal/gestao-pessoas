/* =====================================================================================
   NOTIFICAÇÕES DO APP (04/11/2026) — o sino do menu, para o RH, as lideranças e quem pede
   -------------------------------------------------------------------------------------
   Calculadas dos próprios registros, sem guardar nada à parte: cada pedido e cada decisão
   vira uma notificação para quem precisa saber.
   - Férias e ausências: o pedido avisa o RH e a liderança direta; a decisão do RH avisa a
     liderança (que confirma) e quem pediu; a confirmação da liderança avisa o RH e quem pediu.
   - Vagas (funil 77): a solicitação avisa o RH e a coordenação do setor.
   - Encerramento (funil 79 e fluxo anterior do app): a solicitação avisa o RH; a do fluxo
     anterior que espera aprovação avisa a coordenação.
   - Finalistas: a avaliação nova avisa a liderança que avalia.
   - Feriados: o calendário mudado pelo RH avisa todo mundo.
   O "lido" é de cada pessoa: a data em que ela abriu o sino pela última vez (BX24.userOption).
   Cada evento também sai como aviso do Bitrix (GP.app.avisar), para quem está fora do app.
   Só entra o que o login de quem vê consegue ler. Funções puras: test/notificacoes.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"),
    raiz.GP && raiz.GP.dominio ? raiz.GP.dominio : require("./50-dominio.js"),
    raiz.GP && raiz.GP.ferias ? raiz.GP.ferias : require("./53-ferias.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.notificacoes = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc, dom, ferias) {
  "use strict";

  const JANELA_DIAS = 30;
  const LIMITE = 60;
  /** Instante de uma data do Bitrix ("2026-11-04T19:46:27+03:00", "2026-11-04") em milissegundos */
  function ms(v) { const t = Date.parse(String(v || "")); return isNaN(t) ? 0 : t; }

  /** As notificações de uma pessoa, da mais nova para a mais antiga, dos últimos 30 dias.
      o = { visto: data em que a pessoa abriu o sino pela última vez }. Cada uma: {id, quando, area, titulo, texto, rota, acao, nova} */
  function notificacoesDe(ctx, uid, opcoes) {
    const o = opcoes || {};
    const id = String(uid);
    const p = dom.papeis(ctx, id);
    const nome = (u) => dom.pessoa(ctx, u).nome;
    const lista = [];
    const add = (n) => { if (n.quando) lista.push(n); };

    /* Férias e ausências */
    ((ctx.registros && ctx.registros.ferias) || []).forEach((f) => {
      const quem = nome(f.responsavel), meu = String(f.responsavel) === id, souLid = String(f.lideranca) === id;
      const oque = ferias.NOME_TIPO[f.tipo] + " (" + ferias.periodoCurto(f) + ")";
      const rota = "#/ferias/" + f.id;
      if (!meu && (p.rh || souLid)) {
        add({ id: "ferias-pedido-" + f.id, quando: f.criadoEm, area: "Férias e ausências", rota,
          titulo: quem + " pediu " + oque, texto: p.rh ? "O RH analisa primeiro, até " + calc.fmtData(ferias.prazoRH(ctx, f)) + "." : "O RH analisa primeiro; depois é a sua vez de confirmar.",
          acao: p.rh && f.estagio === "NEW" });
      }
      if (f.rhEm && f.rhDecisao) {
        const aprovou = f.rhDecisao === "Aprovada";
        if (souLid && !meu) add({ id: "ferias-rh-" + f.id, quando: f.rhEm, area: "Férias e ausências", rota, acao: f.estagio === "AG_LIDERANCA",
          titulo: aprovou ? "O RH aprovou o pedido de " + quem + ": falta a sua confirmação" : "O RH recusou o pedido de " + quem,
          texto: aprovou ? oque + ". Confirme até " + calc.fmtData(ferias.prazoLideranca(ctx, f)) + "." : oque + "." });
        if (meu) add({ id: "ferias-rh-" + f.id, quando: f.rhEm, area: "Férias e ausências", rota,
          titulo: aprovou ? "O RH aprovou o seu pedido de " + oque : "O RH não aprovou o seu pedido de " + oque, texto: aprovou ? "Agora a sua liderança confirma." : (f.rhComentario || "") });
      }
      if (f.liderancaEm && f.liderancaDecisao) {
        const confirmou = f.liderancaDecisao === "Aprovada";
        if (p.rh && !meu) add({ id: "ferias-lid-" + f.id, quando: f.liderancaEm, area: "Férias e ausências", rota,
          titulo: nome(f.lideranca) + (confirmou ? " confirmou" : " recusou") + " o pedido de " + quem, texto: confirmou ? oque + ": aprovado, e já está na agenda da equipe." : oque + "." });
        if (meu) add({ id: "ferias-lid-" + f.id, quando: f.liderancaEm, area: "Férias e ausências", rota,
          titulo: confirmou ? "Aprovado: " + oque : "A sua liderança não confirmou o pedido de " + oque, texto: confirmou ? "O RH e a sua liderança aprovaram. O período está na agenda da equipe." : (f.liderancaComentario || "") });
      }
      if (f.canceladaEm && !meu && (p.rh || souLid)) add({ id: "ferias-cancelado-" + f.id, quando: f.canceladaEm, area: "Férias e ausências", rota, titulo: quem + " cancelou o pedido de " + oque, texto: "" });
    });

    /* Vagas: o RH vê todas; a coordenação, as das lideranças do setor */
    const vagas = (ctx.vagas && ctx.vagas.negocios) || [];
    if (vagas.length && (p.rh || p.coordenacao)) {
      const meuEmail = String(dom.pessoa(ctx, id).email || "").toLowerCase();
      const visiveis = {};
      dom.vagasDe(ctx, p.rh ? null : id).forEach((v) => { visiveis[v.id] = v; });
      vagas.forEach((n) => {
        const v = visiveis[String(n.ID)];
        if (!v || String(n.UF_CRM_RV_EMAIL || "").toLowerCase() === meuEmail) return;
        add({ id: "vaga-" + n.ID, quando: n.DATE_CREATE, area: "Recrutamento", rota: "#/recrutamento", acao: p.rh && v.nova,
          titulo: "Nova solicitação de vaga: " + v.titulo, texto: (v.solicitante ? "Pedida por " + v.solicitante + ". " : "") + "Está no funil HR | Requisição de Vagas, em \"" + v.etapa + "\"." });
      });
    }

    /* Encerramento de contrato: a esteira (só o RH lê) e o fluxo anterior do app */
    if (p.rh) {
      dom.solicitacoesOffboarding(ctx).forEach((s) => add({ id: "offboarding-" + s.id, quando: (((ctx.offboarding || {}).negocios || []).find((n) => String(n.ID) === s.id) || {}).DATE_CREATE,
        area: "Offboarding", rota: "#/offboarding", acao: s.nova,
        titulo: "Nova solicitação de encerramento de contrato: " + s.membro, texto: [s.motivoTexto, s.solicitante ? "pedida por " + s.solicitante : ""].filter(Boolean).join(" · ") }));
      dom.filaRH(ctx).filter((f) => f.item.estagio === "ENVIADA_RH").forEach((f) => add({ id: "encerramento-" + f.item.id, quando: f.item.enviadaRHEm || f.item.atualizadoEm,
        area: "Offboarding", rota: "#/offboarding/encerramento/" + f.item.id, acao: true, titulo: "Solicitação de encerramento enviada ao RH: " + nome((ctx.idx.membro[f.item.membroId] || {}).responsavel), texto: f.item.motivo || "" }));
    }
    dom.aprovacoesPendentes(ctx, id).forEach((a) => add({ id: "aprovar-" + a.item.id, quando: a.item.atualizadoEm || a.item.criadoEm, area: "Offboarding", rota: "#/offboarding/encerramento/" + a.item.id, acao: true,
      titulo: "Uma solicitação de encerramento aguarda a sua aprovação", texto: (a.membro ? a.membro.nome + " · " : "") + (a.item.motivo || "") }));

    /* Finalistas para avaliar */
    ((ctx.registros && ctx.registros.finalistas) || []).filter((f) => String(f.lideranca) === id && ["NEW", "ATRASADO"].indexOf(f.estagio) >= 0)
      .forEach((f) => add({ id: "finalista-" + f.id, quando: f.criadoEm, area: "Recrutamento", rota: "#/recrutamento/finalista/" + f.id, acao: true,
        titulo: "Avalie a finalista " + (f.candidato || f.titulo), texto: f.prazo ? "Prazo: " + calc.fmtData(f.prazo) + "." : "" }));

    /* Feriados: o calendário mudado pelo RH */
    const fer = ((ctx.registros && ctx.registros.feriados) || []).filter((f) => f.atualizadoEm || f.criadoEm);
    if (fer.length && !p.rh) {
      const ultimo = fer.map((f) => f.atualizadoEm || f.criadoEm).sort().pop();
      add({ id: "feriados-" + ultimo, quando: ultimo, area: "Agenda da equipe", rota: "#/agenda", titulo: "O RH atualizou o calendário de feriados", texto: "Confira na Agenda da equipe o que vale para você." });
    }

    const desde = ms(calc.addDias(ctx.hoje, -JANELA_DIAS));
    const visto = ms(o.visto);
    return lista.filter((n) => ms(n.quando) >= desde)
      .map((n) => Object.assign(n, { nova: ms(n.quando) > visto }))
      .sort((a, b) => ms(b.quando) - ms(a.quando)).slice(0, LIMITE);
  }
  /** Quantas notificações novas (o número do sino) */
  function novas(ctx, uid, opcoes) { return notificacoesDe(ctx, uid, opcoes).filter((n) => n.nova).length; }

  return { notificacoesDe, novas, JANELA_DIAS };
});
