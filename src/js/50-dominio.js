/* =====================================================================================
   DOMÍNIO — regras de negócio sobre os registros carregados
   -------------------------------------------------------------------------------------
   Funções puras: recebem o contexto (ctx) e devolvem dados prontos para a tela. Não
   tocam no DOM nem no Bitrix, por isso são testadas no Node (test/dominio.test.js).

   ctx = { hoje, eu, config, usuarios, departamentos, registros: {membros, feedbacks, ciclo,
           planos, encerramentos, onboarding, leituras, planejamento, finalistas},
           feriados: {nacionais, SP, BA}, ausencias, vagas }
   indexar(ctx) monta os mapas usados por todas as outras funções.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.dominio = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc) {
  "use strict";

  const ESTAGIOS_FORA = ["SUCCESS", "FAIL"]; // Membros: Encerrado e Arquivado
  const MOTIVOS_COM_TRAVA = ["Resultados abaixo do acordado", "Desalinhamento de perfil"];
  const MOTIVOS_ABREVIADOS = ["Reestruturação da área", "Fim do prazo previsto no contrato"];
  const MOTIVO_GRAVE = "Situação grave ou urgente";
  const MSG_TRAVA = "Este motivo exige 2 feedbacks SCI e um plano de alinhamento de 60 dias encerrado.";
  const MSG_JUSTIFICATIVA = "Registre a justificativa do fluxo abreviado.";

  /* ================================================================ índices */
  function indexar(ctx) {
    const r = ctx.registros || {};
    const idx = {
      usuario: {}, depto: {}, membro: {}, membroPorUsuario: {}, porMembro: {}, porId: {},
    };
    (ctx.usuarios || []).forEach((u) => { idx.usuario[u.id] = u; });
    (ctx.departamentos || []).forEach((d) => { idx.depto[d.id] = d; });
    (r.membros || []).forEach((m) => { idx.membro[m.id] = m; if (m.responsavel) idx.membroPorUsuario[m.responsavel] = m; });
    Object.keys(r).forEach((chave) => {
      idx.porMembro[chave] = {};
      idx.porId[chave] = {};
      (r[chave] || []).forEach((it) => {
        idx.porId[chave][it.id] = it;
        if (it.membroId) (idx.porMembro[chave][it.membroId] = idx.porMembro[chave][it.membroId] || []).push(it);
      });
    });
    ctx.idx = idx;
    ctx.tri = calc.trimestreDe(ctx.hoje);
    ctx.triAnterior = calc.trimestreAnterior(ctx.tri);
    return ctx;
  }
  const doMembro = (ctx, chave, membroId) => (ctx.idx.porMembro[chave] && ctx.idx.porMembro[chave][membroId]) || [];

  /* ================================================================ pessoas */
  function pessoa(ctx, userId) {
    const u = ctx.idx.usuario[String(userId || "")];
    return u || { id: String(userId || ""), nome: userId ? "Usuário " + userId : "—", foto: "", email: "", departamentos: [], aniversario: "" };
  }
  /** Dados do membro para a tela: nome e foto sempre do perfil do Bitrix (2.5) */
  function infoMembro(ctx, m) {
    const u = pessoa(ctx, m.responsavel);
    const cidade = /BA/.test(m.cidade || "") ? "BA" : "SP";
    return Object.assign({}, m, {
      nome: u.nome || m.titulo, foto: u.foto, email: u.email, aniversario: m.ocultarAniversario ? "" : u.aniversario,
      cidadeSigla: cidade, userId: m.responsavel, cargo: u.cargo,
    });
  }
  function membrosAtivos(lista) { return lista.filter((m) => ESTAGIOS_FORA.indexOf(m.estagio) < 0); }

  /* ================================================================ estrutura e papéis (1.1, 1.2, 2.4) */
  function deptosChefiados(ctx, uid) { return (ctx.departamentos || []).filter((d) => d.chefe === String(uid)).map((d) => d.id); }
  function descendentes(ctx, deptoId) {
    const filhos = (ctx.departamentos || []).filter((d) => d.pai === deptoId).map((d) => d.id);
    return filhos.reduce((acc, f) => acc.concat([f], descendentes(ctx, f)), []);
  }
  const naLista = (lista, uid) => (lista || []).some((p) => String(p.id) === String(uid));

  function papeis(ctx, uid) {
    const id = String(uid || (ctx.eu && ctx.eu.id) || "");
    const cfg = (ctx.config && ctx.config.papeis) || {};
    const chefia = deptosChefiados(ctx, id);
    const rh = naLista(cfg.rh, id);
    const ceo = naLista(cfg.ceo, id);
    const coordenacao = naLista(cfg.coordenacao, id);
    const temEquipe = equipeDe(ctx, id).length > 0;
    return {
      id, rh, ceo, coordenacao,
      lideranca: !ceo && (chefia.length > 0 || temEquipe),
      admin: !!(ctx.eu && ctx.eu.id === id && ctx.eu.admin),
      chefia,
      // Coordenação e acima enviam as solicitações formais direto ao RH (1.2)
      enviaFormal: coordenacao || rh,
    };
  }

  /** Liderança direta pela estrutura (1.1): o chefe do departamento da pessoa. Se a própria
      pessoa é a chefe (ou o departamento não tem chefe), sobe até o primeiro chefe acima.
      Assim a liderança de uma área entra na equipe da coordenação do setor. */
  function liderancaPelaEstrutura(deptoPorId, userId, deptosDoUsuario) {
    let d = deptoPorId[(deptosDoUsuario || [])[0]];
    const vistos = {};
    while (d && !vistos[d.id]) {
      vistos[d.id] = true;
      if (d.chefe && d.chefe !== String(userId)) return d.chefe;
      d = d.pai ? deptoPorId[d.pai] : null;
    }
    return "";
  }
  /** Coordenação responsável: o chefe do setor, isto é, o departamento logo abaixo da raiz
      (a CEO fica acima de todos os setores). Para a própria coordenação, a liderança acima dela. */
  function coordenacaoPelaEstrutura(deptoPorId, userId, deptosDoUsuario) {
    let d = deptoPorId[(deptosDoUsuario || [])[0]];
    const cadeia = [], vistos = {};
    while (d && !vistos[d.id]) { vistos[d.id] = true; cadeia.push(d); d = d.pai ? deptoPorId[d.pai] : null; }
    const setor = cadeia.length >= 2 ? cadeia[cadeia.length - 2] : cadeia[0];
    if (setor && setor.chefe && setor.chefe !== String(userId)) return setor.chefe;
    return liderancaPelaEstrutura(deptoPorId, userId, deptosDoUsuario);
  }

  /** Membros da equipe direta: quem tem a pessoa como liderança direta pela estrutura.
      Sem estrutura no Bitrix (ou membro sem departamento), cai para o campo "Liderança direta". */
  function equipeDe(ctx, uid) {
    const id = String(uid);
    const temEstrutura = (ctx.departamentos || []).length > 0;
    const equipe = (ctx.registros.membros || []).filter((m) => {
      if (m.responsavel === id) return false;
      const u = ctx.idx.usuario[m.responsavel];
      if (!temEstrutura || !u || !(u.departamentos || []).length) return m.lideranca === id;
      return liderancaPelaEstrutura(ctx.idx.depto, u.id, u.departamentos) === id;
    });
    return membrosAtivos(equipe);
  }
  /** Coordenação: lideranças dos subdepartamentos, cada uma com a sua equipe */
  function liderancasDoSetor(ctx, uid) {
    const id = String(uid);
    const subs = deptosChefiados(ctx, id).reduce((acc, d) => acc.concat(descendentes(ctx, d)), []);
    const chefes = [];
    subs.forEach((d) => {
      const dep = ctx.idx.depto[d];
      if (dep && dep.chefe && dep.chefe !== id && chefes.indexOf(dep.chefe) < 0) chefes.push(dep.chefe);
    });
    return chefes.map((c) => ({ lideranca: pessoa(ctx, c), equipe: equipeDe(ctx, c) }))
      .sort((a, b) => a.lideranca.nome.localeCompare(b.lideranca.nome, "pt-BR"));
  }
  function membrosVisiveis(ctx, uid) {
    const p = papeis(ctx, uid);
    if (p.rh) return membrosAtivos(ctx.registros.membros || []);
    let lista = equipeDe(ctx, uid);
    if (p.coordenacao) liderancasDoSetor(ctx, uid).forEach((l) => { lista = lista.concat(l.equipe); });
    const vistos = {};
    return lista.filter((m) => (vistos[m.id] ? false : (vistos[m.id] = true)));
  }

  /* ================================================================ feriados (4.5, regra 2) */
  function feriadosDe(ctx, sigla) {
    const f = ctx.feriados || {};
    const locais = (ctx.config && ctx.config.feriadosLocais) || {};
    return calc.conjuntoFeriados([f.nacionais || [], locais[sigla || "SP"] || []]);
  }
  function feriadosDoMembro(ctx, m) { return feriadosDe(ctx, /BA/.test((m && m.cidade) || "") ? "BA" : "SP"); }
  function prazo(ctx, m, iso) { return iso ? calc.ajustarPrazo(iso, feriadosDoMembro(ctx, m)) : ""; }
  function dataDe(iso) { return String(iso || "").slice(0, 10); }

  /* ================================================================ feedbacks */
  /** Retroativo sem anexo não conta (5.1) */
  function feedbackValido(f) { return f.estagio !== "FAIL" && (!f.retroativo || (f.evidencia && f.evidencia.length > 0)); }
  function feedbacksDo(ctx, membroId) {
    return doMembro(ctx, "feedbacks", membroId).filter(feedbackValido).sort((a, b) => (a.data < b.data ? 1 : -1));
  }
  /** 48 horas depois de salvo, só leitura (4.1) */
  function editavel(registroEm, agoraIso) {
    if (!registroEm) return true;
    const t = Date.parse(registroEm);
    if (isNaN(t)) return true;
    return (Date.parse(agoraIso) - t) < 48 * 3600 * 1000;
  }

  /* ================================================================ ciclo trimestral (3.3) */
  function cicloDo(ctx, membroId, chaveTri) {
    return doMembro(ctx, "ciclo", membroId).find((c) => c.trimestre === chaveTri && c.estagio !== "FAIL") || null;
  }
  function combinados(c) {
    return [1, 2, 3].map((n) => ({ n, texto: c["comb" + n + "Texto"], resp: c["comb" + n + "Resp"], prazo: c["comb" + n + "Prazo"], status: c["anterior" + n] }))
      .filter((x) => x.texto);
  }
  function cicloAnterior(ctx, c) {
    const t = calc.trimestrePorChave(c.trimestre);
    if (!t) return null;
    const ant = calc.trimestreAnterior(t);
    return cicloDo(ctx, c.membroId, ant.chave);
  }
  /** Situação do item do ciclo, na régua de cor da 4.6 */
  function statusCiclo(ctx, c) {
    const m = ctx.idx.membro[c.membroId];
    const t = calc.trimestrePorChave(c.trimestre);
    const abertura = dataDe(c.criadoEm) || (t && t.inicio);
    const r = { item: c, trimestre: t };
    if (c.estagio === "SUCCESS") return Object.assign(r, { chave: "concluido", texto: "Evidências registradas", cor: "verde" });
    if (c.estagio === "FAIL") return Object.assign(r, { chave: "cancelado", texto: "Cancelado", cor: "cinza" });
    const carencia = (ctx.config && ctx.config.parametros && ctx.config.parametros.carencia1a1) || 7;
    if (!c.realizadoEm) {
      if (!c.data1a1) {
        const p = prazo(ctx, m, calc.dataDoDia(abertura, carencia));
        const atr = calc.atrasado(p, ctx.hoje);
        return Object.assign(r, { chave: atr ? "sem-agenda" : "agendar", texto: atr ? "1:1 sem agendamento" : "1:1 a agendar", cor: atr ? "vermelho" : "amarelo", prazo: p, acao: "agendar" });
      }
      if (ctx.hoje <= c.data1a1) return Object.assign(r, { chave: "agendado", texto: "1:1 agendado para " + calc.fmtData(c.data1a1), cor: "azul", data: c.data1a1 });
      const p = calc.addDias(c.data1a1, 1);
      const atr = calc.atrasado(p, ctx.hoje);
      return Object.assign(r, { chave: "registrar-1a1", texto: "Registrar o 1:1 de " + calc.fmtData(c.data1a1), cor: atr ? "vermelho" : "amarelo", prazo: p, acao: "registrar-1a1" });
    }
    if (t && ctx.hoje <= t.fim) return Object.assign(r, { chave: "realizado", texto: "1:1 realizado em " + calc.fmtData(c.realizadoEm), cor: "azul" });
    const p = prazo(ctx, m, c.prazoEvidencias || (t && calc.prazoEvidencias(t)));
    const atr = calc.atrasado(p, ctx.hoje);
    return Object.assign(r, { chave: atr ? "evid-atrasadas" : "evidencias", texto: atr ? "Evidências atrasadas" : "Registrar evidências até " + calc.fmtData(p), cor: atr ? "vermelho" : "amarelo", prazo: p, acao: "evidencias" });
  }

  /* ================================================================ onboarding (3.2) */
  const ESTAGIO_FASE = { NEW: "Preparação", ANCORAGEM: "Ancoragem", IMERSAO: "Imersão", MAR_ABERTO: "Mar Aberto", SUCCESS: "Concluído", FAIL: "Interrompido" };
  function statusOnboarding(ctx, ob) {
    const m = ctx.idx.membro[ob.membroId];
    const fer = feriadosDoMembro(ctx, m);
    const ingresso = ob.ingresso || (m && m.ingresso);
    const dia = ingresso ? calc.diaN(ingresso, ctx.hoje) : null;
    const fase = ESTAGIO_FASE[ob.estagio] || ob.estagio;
    const senioridade = ob.senioridade || (m && m.senioridade) || "";
    const leituras = doMembro(ctx, "leituras", ob.membroId).filter((l) => l.onboardingId === ob.id && l.estagio !== "FAIL");
    const alinhamentos = ingresso ? calc.datasAlinhamentos(ingresso, fer).map((a) => {
      const n = a.numero;
      const registrado = !!ob["al" + n + "Data"];
      const lFase = leituras.filter((l) => l.fase === a.fase);
      const lidas = lFase.filter((l) => l.leitura);
      const nota = registrado && ob["al" + n + "Nota"] !== null && ob["al" + n + "Nota"] !== undefined ? Number(ob["al" + n + "Nota"]) : calc.notaDasLeituras(lidas.map((l) => l.leitura));
      const fora = lidas.filter((l) => l.leitura === "Fora do padrão").length;
      const patamar = calc.PATAMAR[senioridade] ? calc.PATAMAR[senioridade][a.fase] : undefined;
      return Object.assign(a, {
        registrado, dataRegistro: ob["al" + n + "Data"], nota, patamar, fora,
        resultado: registrado ? ob["al" + n + "Resultado"] : calc.resultadoFase(nota, patamar, fora),
        leituras: lFase, pendentesLeitura: lFase.filter((l) => !l.leitura).length,
        atrasado: !registrado && calc.atrasado(a.data, ctx.hoje),
      });
    }) : [];
    const prazoFicha = ingresso ? calc.addDias(ingresso, -1) : "";
    const prazoEntregas = ingresso ? calc.ajustarPrazo(calc.dataDoDia(ingresso, 15), fer) : "";
    const proximo = alinhamentos.find((a) => !a.registrado) || null;
    return {
      item: ob, membro: m, ingresso, dia, fase, senioridade, alinhamentos, proximo, leituras,
      prazoFicha, fichaOk: !!ob.fichaEm, fichaAtrasada: !ob.fichaEm && prazoFicha && calc.atrasado(prazoFicha, ctx.hoje),
      prazoEntregas, entregasOk: !!ob.entregasPlanejadasEm,
      entregasAtrasadas: !ob.entregasPlanejadasEm && prazoEntregas && calc.atrasado(prazoEntregas, ctx.hoje),
      revisaoEsperada: calc.REVISAO_ESPERADA[senioridade] || "",
      atrasado: alinhamentos.some((a) => a.atrasado) || (!ob.fichaEm && prazoFicha && calc.atrasado(prazoFicha, ctx.hoje)),
    };
  }
  function onboardingDo(ctx, membroId) {
    return doMembro(ctx, "onboarding", membroId).filter((o) => o.estagio !== "FAIL").sort((a, b) => (a.ingresso < b.ingresso ? 1 : -1))[0] || null;
  }

  /* ================================================================ planos de alinhamento (3.5.2) */
  function statusPlano(ctx, p) {
    const m = ctx.idx.membro[p.membroId];
    const termino = p.termino || (p.inicio ? calc.terminoPlano(p.inicio) : "");
    const dia = p.inicio ? Math.min(calc.diaN(p.inicio, ctx.hoje), 60) : null;
    const prazoCheckin = p.inicio ? prazo(ctx, m, calc.dataDoDia(p.inicio, 30)) : "";
    const ativo = ["NEW", "CHECKIN_ATRASO", "CHECKIN_OK", "ENC_PENDENTE", "ENC_ATRASO"].indexOf(p.estagio) >= 0;
    const checkinFeito = !!p.checkinData;
    const r = { item: p, membro: m, dia, termino, prazoCheckin, ativo, checkinFeito };
    if (p.estagio === "SUCCESS") return Object.assign(r, { texto: "Resultados atingidos", cor: "verde" });
    if (p.estagio === "FAIL") return Object.assign(r, { texto: "Resultados não atingidos", cor: "cinza" });
    if (!checkinFeito) {
      const atr = calc.atrasado(prazoCheckin, ctx.hoje);
      return Object.assign(r, { texto: atr ? "Check-in atrasado" : "Check-in até " + calc.fmtData(prazoCheckin), cor: atr ? "vermelho" : "azul", prazo: prazoCheckin, acao: "checkin" });
    }
    if (ctx.hoje < termino) return Object.assign(r, { texto: "Dia " + dia + " de 60 · término " + calc.fmtData(termino), cor: "azul", prazo: termino, acao: calc.diffDias(ctx.hoje, termino) <= 5 ? "encerrar" : "" });
    const atr = calc.atrasado(termino, ctx.hoje);
    return Object.assign(r, { texto: atr ? "Encerramento atrasado" : "Encerramento pendente", cor: atr ? "vermelho" : "amarelo", prazo: termino, acao: "encerrar" });
  }
  function planoAtivoDo(ctx, membroId) {
    return doMembro(ctx, "planos", membroId).find((p) => statusPlano(ctx, p).ativo) || null;
  }

  /* ================================================================ encerramento: verificação (3.5.3 e 4.1) */
  /** Confere os registros antes de aceitar a solicitação. A mesma regra que o processo de
      negócio do Bitrix aplica no servidor (ver docs/configuracao-bitrix.md). */
  function verificarRegistros(ctx, membroId, motivo, justificativa) {
    const itens = [];
    const bloqueios = [];
    let plano = null, feedbacks = [];
    if (MOTIVOS_COM_TRAVA.indexOf(motivo) >= 0) {
      const fbs = {};
      doMembro(ctx, "feedbacks", membroId).forEach((f) => { fbs[f.id] = f; });
      const valido = (id) => id && fbs[id] && feedbackValido(fbs[id]);
      const planos = doMembro(ctx, "planos", membroId);
      plano = planos.find((p) => p.estagio === "FAIL" && valido(p.feedbackAberturaId) && valido(p.feedbackEncerramentoId))
        || planos.find((p) => p.estagio === "FAIL") || null;
      const okPlano = !!(plano && plano.estagio === "FAIL");
      const okAbertura = !!(plano && valido(plano.feedbackAberturaId));
      const okEncerramento = !!(plano && valido(plano.feedbackEncerramentoId));
      itens.push({ ok: okPlano, texto: "Plano de alinhamento de 60 dias encerrado em \"Resultados não atingidos\"" });
      itens.push({ ok: okAbertura, texto: "Feedback SCI de abertura vinculado ao plano" });
      itens.push({ ok: okEncerramento, texto: "Feedback SCI de encerramento vinculado ao plano" });
      if (!(okPlano && okAbertura && okEncerramento)) bloqueios.push(MSG_TRAVA);
      if (plano) feedbacks = [plano.feedbackAberturaId, plano.feedbackEncerramentoId].filter(valido);
    } else if (MOTIVOS_ABREVIADOS.indexOf(motivo) >= 0) {
      const ok = !!String(justificativa || "").trim();
      itens.push({ ok, texto: "Justificativa do fluxo abreviado registrada" });
      if (!ok) bloqueios.push(MSG_JUSTIFICATIVA);
    } else if (motivo === MOTIVO_GRAVE) {
      itens.push({ ok: true, texto: "Situação grave ou urgente: segue direto para o RH, sem aprovação da coordenação" });
    }
    return { ok: bloqueios.length === 0, bloqueios, itens, plano, feedbacks };
  }
  /** Estágio de entrada de uma solicitação (3.5.3). Ninguém aprova o próprio pedido (4.1). */
  function destinoEncerramento(op) {
    if (op.bloqueado) return "BLOQUEADA";
    if (op.motivo === MOTIVO_GRAVE) return "ENVIADA_RH";
    if (op.origem === "Formulário da coordenação") return "ENVIADA_RH";
    return "AG_COORD";
  }
  function aprovadorDe(ctx, enc) {
    const m = ctx.idx.membro[enc.membroId];
    const coord = enc.coordenacao || (m && m.coordenacao);
    const solicitante = enc.solicitante || enc.autor || enc.criadoPor;
    if (!coord || String(coord) === String(solicitante) || (m && String(m.lideranca) === String(coord))) return { rh: true, id: "" };
    return { rh: false, id: String(coord) };
  }

  /* ================================================================ pendências ("O que depende de você") */
  function pend(ctx, base) {
    const atrasoDias = base.prazo ? calc.diasAtraso(base.prazo, ctx.hoje) : 0;
    return Object.assign({ atrasoDias, atrasado: atrasoDias > 0, avisoCoordenacao: base.prazo ? calc.addDias(base.prazo, 14) : "" }, base);
  }
  function pendenciasDe(ctx, membros, opcoes) {
    const o = opcoes || {};
    const lista = [];
    const tri = ctx.tri;
    membros.forEach((m0) => {
      const m = infoMembro(ctx, m0);
      const nome = m.nome.split(" ")[0];
      // Ciclo: trimestre atual e o anterior (evidências ainda em prazo)
      [tri.chave, ctx.triAnterior.chave].forEach((chaveTri) => {
        const c = cicloDo(ctx, m.id, chaveTri);
        if (!c || m.estagio !== "ATIVO") return;
        const s = statusCiclo(ctx, c);
        if (s.acao === "agendar") lista.push(pend(ctx, { id: "1a1-" + c.id, tipo: "1:1", titulo: "Agendar o 1:1 de " + nome, membro: m, prazo: s.prazo, rota: "#/rotinas/ciclo/" + c.id, registro: { chave: "ciclo", id: c.id } }));
        if (s.acao === "registrar-1a1") lista.push(pend(ctx, { id: "reg1a1-" + c.id, tipo: "1:1", titulo: "Registrar o 1:1 de " + nome, membro: m, prazo: s.prazo, rota: "#/rotinas/ciclo/" + c.id, registro: { chave: "ciclo", id: c.id } }));
        if (s.acao === "evidencias") lista.push(pend(ctx, { id: "evid-" + c.id, tipo: "Evidências", titulo: "Registrar as evidências do " + s.trimestre.curto + " de " + nome, membro: m, prazo: s.prazo, rota: "#/desempenho/ciclo/" + c.id, registro: { chave: "ciclo", id: c.id } }));
      });
      // Onboarding
      const ob = onboardingDo(ctx, m.id);
      if (ob && ["SUCCESS", "FAIL"].indexOf(ob.estagio) < 0) {
        const s = statusOnboarding(ctx, ob);
        if (!s.fichaOk) lista.push(pend(ctx, { id: "ficha-" + ob.id, tipo: "Onboarding", titulo: "Completar a Ficha de " + nome, membro: m, prazo: s.prazoFicha, rota: "#/onboarding/" + ob.id }));
        if (s.fichaOk && !s.entregasOk && s.dia >= 1) lista.push(pend(ctx, { id: "entregas-" + ob.id, tipo: "Onboarding", titulo: "Planejar as 2 entregas das semanas 3 e 4 de " + nome, membro: m, prazo: s.prazoEntregas, rota: "#/onboarding/" + ob.id }));
        const prox = s.proximo;
        if (prox && calc.diffDias(ctx.hoje, prox.data) <= 7) lista.push(pend(ctx, { id: "al" + prox.numero + "-" + ob.id, tipo: "Onboarding", titulo: prox.rotulo + " de " + nome + " (Dia " + prox.dia + ")", membro: m, prazo: prox.data, rota: "#/onboarding/" + ob.id }));
      }
      // Plano de alinhamento
      doMembro(ctx, "planos", m.id).forEach((p) => {
        const s = statusPlano(ctx, p);
        if (!s.ativo) return;
        if (s.acao === "checkin" && calc.diffDias(ctx.hoje, s.prazo) <= 5) lista.push(pend(ctx, { id: "checkin-" + p.id, tipo: "Plano", titulo: "Check-in do plano de " + nome + " (Dia 30)", membro: m, prazo: s.prazo, rota: "#/offboarding/plano/" + p.id }));
        if (s.acao === "encerrar") lista.push(pend(ctx, { id: "encplano-" + p.id, tipo: "Plano", titulo: "Encerrar o plano de " + nome + " (Dia 60)", membro: m, prazo: s.prazo, rota: "#/offboarding/plano/" + p.id }));
      });
      // Leituras de entrega (só onboarding, plano e marcadas como relevantes: 4.8)
      doMembro(ctx, "leituras", m.id).forEach((l) => {
        if (l.leitura || ["SUCCESS", "FAIL"].indexOf(l.estagio) >= 0) return;
        const comPrazo = l.origem === "Plano de alinhamento" || l.origem === "Onboarding" || l.origem === "Prazo vencido sem conclusão";
        lista.push(pend(ctx, { id: "leit-" + l.id, tipo: "Leitura", titulo: "Ler a entrega \"" + (l.titulo || "sem título") + "\" de " + nome, membro: m, prazo: comPrazo ? l.prazoLeitura : "", rota: "#/desempenho/leitura/" + l.id, destaque: l.origem === "Plano de alinhamento" }));
      });
      // Encerramentos em rascunho ou bloqueados
      doMembro(ctx, "encerramentos", m.id).forEach((e) => {
        if (e.estagio === "NEW") lista.push(pend(ctx, { id: "encr-" + e.id, tipo: "Offboarding", titulo: "Completar a solicitação de encerramento de " + nome, membro: m, prazo: "", rota: "#/offboarding/encerramento/" + e.id }));
        if (e.estagio === "BLOQUEADA") lista.push(pend(ctx, { id: "encb-" + e.id, tipo: "Offboarding", titulo: "Corrigir a solicitação bloqueada de " + nome, membro: m, prazo: "", rota: "#/offboarding/encerramento/" + e.id }));
      });
    });
    // Avaliação de finalistas (3.1): da própria liderança
    if (o.uid) {
      (ctx.registros.finalistas || []).filter((f) => f.lideranca === String(o.uid) && ["NEW", "ATRASADO"].indexOf(f.estagio) >= 0).forEach((f) => {
        lista.push(pend(ctx, { id: "fin-" + f.id, tipo: "Recrutamento", titulo: "Avaliar a finalista " + (f.candidato || f.titulo), membro: null, prazo: f.prazo, rota: "#/recrutamento/finalista/" + f.id }));
      });
    }
    return ordenarPendencias(lista);
  }
  function ordenarPendencias(lista) {
    return lista.sort((a, b) => {
      if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
      if (a.atrasado) return b.atrasoDias - a.atrasoDias;
      if (!!a.prazo !== !!b.prazo) return a.prazo ? -1 : 1;
      return a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : 0;
    });
  }
  /** Coordenação: aprovações aguardando (3.5.3) */
  function aprovacoesPendentes(ctx, uid) {
    return (ctx.registros.encerramentos || []).filter((e) => e.estagio === "AG_COORD").filter((e) => {
      const a = aprovadorDe(ctx, e);
      return !a.rh && a.id === String(uid);
    }).map((e) => {
      const desde = dataDe(e.atualizadoEm || e.criadoEm);
      return { item: e, membro: ctx.idx.membro[e.membroId] ? infoMembro(ctx, ctx.idx.membro[e.membroId]) : null, desde, dias: desde ? calc.diffDias(desde, ctx.hoje) : 0, prazo: desde ? calc.addDias(desde, 3) : "" };
    });
  }
  /** RH: fila do que aguarda o RH */
  function filaRH(ctx) {
    const enc = (ctx.registros.encerramentos || []).filter((e) => ["ENVIADA_RH", "EM_ANALISE", "BLOQUEADA"].indexOf(e.estagio) >= 0 || (e.estagio === "AG_COORD" && aprovadorDe(ctx, e).rh));
    return enc.map((e) => ({ item: e, membro: ctx.idx.membro[e.membroId] ? infoMembro(ctx, ctx.idx.membro[e.membroId]) : null }));
  }

  /* ================================================================ indicadores (4.5, 4.6, 4.8) */
  function ultimoFeedback(ctx, membroId) { const f = feedbacksDo(ctx, membroId); return f[0] || null; }
  function indicadoresEquipe(ctx, membros, opcoes) {
    const o = opcoes || {};
    const tri = ctx.tri, ant = ctx.triAnterior;
    const ativos = membros.filter((m) => m.estagio === "ATIVO");
    // 1:1 do trimestre em dia: elegíveis = Ativo e com item do ciclo no trimestre (o RH cria só para quem estava Ativo no 1º dia)
    const eleg1a1 = ativos.filter((m) => cicloDo(ctx, m.id, tri.chave));
    const com1a1 = eleg1a1.filter((m) => { const c = cicloDo(ctx, m.id, tri.chave); return c.data1a1 || c.realizadoEm; });
    const sem1a1 = eleg1a1.filter((m) => com1a1.indexOf(m) < 0);
    // Evidências registradas: trimestre anterior (o atual ainda não fechou)
    const itensAnt = membros.map((m) => cicloDo(ctx, m.id, ant.chave)).filter(Boolean);
    const evidOk = itensAnt.filter((c) => c.estagio === "SUCCESS");
    // Feedback em 90 dias: membros fora de onboarding e de encerramento (4.8)
    const limite90 = calc.addDias(ctx.hoje, -89);
    const comFb = ativos.filter((m) => { const f = ultimoFeedback(ctx, m.id); return f && f.data >= limite90; });
    const semFb = ativos.filter((m) => comFb.indexOf(m) < 0);
    let maisAntigo = null;
    comFb.forEach((m) => { const f = ultimoFeedback(ctx, m.id); if (!maisAntigo || f.data < maisAntigo.data) maisAntigo = { membro: m, data: f.data }; });
    // Etapas de onboarding no prazo: etapas vencidas até hoje e feitas dentro do prazo
    let obN = 0, obD = 0;
    membros.forEach((m) => {
      const ob = onboardingDo(ctx, m.id);
      if (!ob || ob.estagio === "FAIL") return;
      const s = statusOnboarding(ctx, ob);
      const etapas = [{ prazo: s.prazoFicha, feito: ob.fichaEm }, { prazo: s.prazoEntregas, feito: ob.entregasPlanejadasEm }]
        .concat(s.alinhamentos.map((a) => ({ prazo: a.data, feito: a.dataRegistro })));
      etapas.forEach((e) => {
        if (!e.prazo || ctx.hoje <= e.prazo && !e.feito) return; // ainda não venceu
        obD++;
        if (e.feito && e.feito <= e.prazo) obN++;
      });
    });
    const pendencias = pendenciasDe(ctx, membros, { uid: o.uid });
    const atrasadas = pendencias.filter((p) => p.atrasado);
    const r1a1 = calc.percentual(com1a1.length, eleg1a1.length);
    const rEvid = calc.percentual(evidOk.length, itensAnt.length);
    const rFb = calc.percentual(comFb.length, ativos.length);
    const rOb = calc.percentual(obN, obD);
    const somaN = com1a1.length + evidOk.length + comFb.length + obN;
    const somaD = eleg1a1.length + itensAnt.length + ativos.length + obD;
    const rotinas = calc.percentual(somaN, somaD);
    // Equilíbrio e feedbacks do período
    const fbs90 = [], fbsTri = [];
    membros.forEach((m) => feedbacksDo(ctx, m.id).forEach((f) => {
      if (f.data >= limite90 && f.data <= ctx.hoje) fbs90.push(f);
      if (f.data >= tri.inicio && f.data <= tri.fim) fbsTri.push(f);
    }));
    const rec = fbs90.filter((f) => f.tipo === "Reconhecimento").length;
    return {
      tri, triAnterior: ant,
      um1a1: Object.assign(r1a1, { faltam: sem1a1 }),
      evidencias: Object.assign(rEvid, { faltam: itensAnt.filter((c) => c.estagio !== "SUCCESS").map((c) => ctx.idx.membro[c.membroId]).filter(Boolean) }),
      feedback90: Object.assign(rFb, { faltam: semFb, maisAntigo, meta: 90 }),
      onboarding: rOb,
      rotinas, atrasadas: atrasadas.length, pendencias,
      situacao: calc.situacaoLideranca(rotinas.valor, atrasadas.length),
      equilibrio: calc.equilibrioFeedbacks(rec, fbs90.length - rec),
      feedbacksTrimestre: fbsTri.length,
      conquistas: conquistas(ctx, membros, o.uid),
    };
  }
  /** Conquistas recentes: últimos 30 dias (4.5) */
  function conquistas(ctx, membros, uid) {
    const ini = calc.addDias(ctx.hoje, -30);
    const dentro = (d) => d && d >= ini && d <= ctx.hoje;
    const ev = [];
    membros.forEach((m0) => {
      const m = infoMembro(ctx, m0);
      feedbacksDo(ctx, m.id).filter((f) => f.tipo === "Reconhecimento" && dentro(f.data)).forEach((f) => ev.push({ data: f.data, texto: "Feedback de reconhecimento para " + m.nome }));
      doMembro(ctx, "planos", m.id).filter((p) => p.estagio === "SUCCESS" && dentro(dataDe(p.atualizadoEm))).forEach((p) => ev.push({ data: dataDe(p.atualizadoEm), texto: "Plano de " + m.nome + " com resultados atingidos" }));
      doMembro(ctx, "onboarding", m.id).forEach((ob) => [1, 2, 3].forEach((n) => {
        if (ob["al" + n + "Resultado"] === "Dentro do esperado" && dentro(ob["al" + n + "Data"])) ev.push({ data: ob["al" + n + "Data"], texto: "Fase do onboarding de " + m.nome + " dentro do esperado" });
      }));
    });
    vagasDe(ctx, uid).filter((v) => v.fechada && dentro(v.fechadaEm)).forEach((v) => ev.push({ data: v.fechadaEm, texto: "Vaga fechada: " + v.titulo }));
    return ev.sort((a, b) => (a.data < b.data ? 1 : -1));
  }

  /* ================================================================ coordenação (4.4, 4.6) */
  function mapaCoordenacao(ctx, uid) {
    return liderancasDoSetor(ctx, uid).map((l) => {
      const ind = indicadoresEquipe(ctx, l.equipe, { uid: l.lideranca.id });
      return {
        lideranca: l.lideranca, equipe: l.equipe, tamanho: l.equipe.length, ind,
        atrasos: ind.pendencias.filter((p) => p.atrasado).map((p) => Object.assign({ lideranca: l.lideranca }, p)),
      };
    });
  }

  /* ================================================================ recrutamento (3.1) */
  function vagasDe(ctx, uid) {
    const v = ctx.vagas || { etapas: [], negocios: [], historico: [] };
    const abertas = (v.etapas || []).filter((e) => !e.semantica);
    const ganha = (v.etapas || []).find((e) => e.semantica === "S");
    const sequencia = abertas.concat(ganha ? [ganha] : []);
    const idAprovada = (v.etapas || []).find((e) => /aprovad/i.test(e.nome));
    const u = uid ? pessoa(ctx, uid) : null;
    const email = u && u.email ? u.email.toLowerCase() : "";
    const p = uid ? papeis(ctx, uid) : { rh: true };
    const emailsSetor = {};
    if (p.coordenacao && uid) liderancasDoSetor(ctx, uid).forEach((l) => { if (l.lideranca.email) emailsSetor[l.lideranca.email.toLowerCase()] = true; });
    return (v.negocios || []).filter((n) => {
      if (!uid || p.rh || p.ceo) return true;
      const e = String(n.UF_CRM_RV_EMAIL || "").toLowerCase();
      return e === email || emailsSetor[e];
    }).map((n) => {
      const hist = (v.historico || []).filter((h) => String(h.OWNER_ID) === String(n.ID));
      // Data de aprovação: entrada na etapa "Aprovada" ou, se ela foi pulada, na primeira etapa depois dela
      const posAprov = idAprovada ? sequencia.findIndex((s) => s.id === idAprovada.id) : -1;
      const aprov = posAprov < 0 ? null
        : hist.find((h) => h.STAGE_ID === idAprovada.id) || hist.find((h) => sequencia.findIndex((s) => s.id === h.STAGE_ID) > posAprov);
      const aprovadaEm = aprov ? dataDe(aprov.CREATED_TIME) : "";
      const etapa = (v.etapas || []).find((e) => e.id === n.STAGE_ID) || { nome: n.STAGE_ID, semantica: "" };
      const pos = sequencia.findIndex((s) => s.id === n.STAGE_ID);
      const fechada = etapa.semantica === "S";
      const won = hist.find((h) => ganha && h.STAGE_ID === ganha.id);
      const fechadaEm = fechada ? dataDe((won && won.CREATED_TIME) || n.CLOSEDATE || n.DATE_MODIFY) : "";
      return {
        id: String(n.ID), titulo: n.UF_CRM_RV_VAGA || n.TITLE, etapa: etapa.nome, semantica: etapa.semantica,
        posicao: pos >= 0 ? pos + 1 : null, totalEtapas: sequencia.length, aprovadaEm, fechada, fechadaEm,
        diasEmAberto: aprovadaEm && !fechada && !etapa.semantica ? calc.diffDias(aprovadaEm, ctx.hoje) : null,
        tempoParaFechar: aprovadaEm && fechadaEm ? calc.diffDias(aprovadaEm, fechadaEm) : null,
        solicitante: n.UF_CRM_RV_LIDER || "", entradaDesejada: dataDe(n.UF_CRM_RV_DATA_ENT), atualizadoEm: dataDe(n.DATE_MODIFY),
      };
    });
  }

  /* ================================================================ agenda da equipe (3.6) */
  function agendaEquipe(ctx, pessoas, opcoes) {
    const o = opcoes || {};
    const inicio = o.inicio || ctx.hoje;
    const semanas = o.semanas || 13;
    const fim = calc.addDias(inicio, semanas * 7 - 1);
    const nacionais = (ctx.feriados && ctx.feriados.nacionais) || [];
    const locais = (ctx.config && ctx.config.feriadosLocais) || {};
    const linhas = pessoas.map((p) => {
      const sigla = p.cidadeSigla || "SP";
      const fer = feriadosDe(ctx, sigla);
      const aus = (ctx.ausencias || []).filter((a) => a.pessoa === p.userId && a.fim >= inicio && a.inicio <= fim)
        .map((a) => Object.assign({}, a, { volta: calc.voltaEm(a.fim, fer) }));
      let aniv = "";
      if (p.aniversario) {
        const ano = Number(inicio.slice(0, 4));
        [ano, ano + 1].forEach((y) => { const d = y + "-" + p.aniversario; if (!aniv && d >= inicio && d <= fim) aniv = d; });
      }
      return { pessoa: p, sigla, ausencias: aus, aniversario: aniv, feriadosLocais: (locais[sigla] || []).filter((f) => f.data >= inicio && f.data <= fim) };
    });
    const todasAus = [];
    linhas.forEach((l) => l.ausencias.forEach((a) => todasAus.push({ pessoa: l.pessoa.userId, inicio: a.inicio, fim: a.fim })));
    const pico = calc.picoAusencias(todasAus, inicio, fim);
    const aviso = calc.avisoParaPlanejar(pico.pessoas, pessoas.length, o.liderancaId);
    // período do pico: dias consecutivos com o mesmo número máximo de pessoas fora
    let picoFim = pico.data;
    if (pico.data) {
      for (let d = calc.addDias(pico.data, 1); d <= fim; d = calc.addDias(d, 1)) {
        const n = todasAus.filter((a) => a.inicio <= d && a.fim >= d).length;
        if (n < pico.pessoas.length) break;
        picoFim = d;
      }
    }
    const lim14 = calc.addDias(ctx.hoje, 13);
    return {
      inicio, fim, linhas,
      feriadosNacionais: nacionais.filter((f) => f.data >= inicio && f.data <= fim),
      feriadosLocais: ["SP", "BA"].map((s) => ({ sigla: s, lista: (locais[s] || []).filter((f) => f.data >= inicio && f.data <= fim) })),
      pico: Object.assign({}, pico, { fim: picoFim }), aviso,
      proximos14: {
        fora: linhas.flatMap((l) => l.ausencias.filter((a) => a.inicio <= lim14 && a.fim >= ctx.hoje).map((a) => ({ pessoa: l.pessoa, ate: a.fim, volta: a.volta }))),
        feriados: nacionais.filter((f) => f.data >= ctx.hoje && f.data <= lim14),
      },
      aniversarios: linhas.filter((l) => l.aniversario).map((l) => ({ pessoa: l.pessoa, data: l.aniversario })).sort((a, b) => (a.data < b.data ? -1 : 1)),
    };
  }

  /* ================================================================ dicas-modelo (4.7, primeira fase) */
  /** As dicas usam só datas, tipos e situações — nunca o texto dos registros. Cada uma
      diz "por que estou vendo isso" com os dados usados. Uma vez por semana por situação. */
  function dicas(ctx, membros, opcoes) {
    const o = opcoes || {};
    const lista = [];
    const manual = "Manual da liderança";
    membros.forEach((m0) => {
      const m = infoMembro(ctx, m0);
      const nome = m.nome.split(" ")[0];
      // 1. Reconhecer o progresso no plano
      doMembro(ctx, "planos", m.id).forEach((p) => {
        const s = statusPlano(ctx, p);
        if (!s.ativo || !p.checkinData) return;
        const atingiu = p.checkin1 === "Atingido" || p.checkin2 === "Atingido";
        const recDepois = feedbacksDo(ctx, m.id).some((f) => f.tipo === "Reconhecimento" && f.data >= p.checkinData);
        if (atingiu && !recDepois) lista.push({
          id: "rec-plano-" + p.id, titulo: "Reconheça o progresso de " + nome + " no plano",
          texto: nome + " atingiu um dos resultados esperados no check-in de " + calc.fmtData(p.checkinData) + ". Um feedback de reconhecimento agora mostra que a evolução foi vista.",
          referencia: manual + " · Feedback SCI", acao: { rotulo: "Registrar feedback de reconhecimento", rota: "#/rotinas/feedback/novo/" + m.id + "/Reconhecimento" },
          porque: "Plano ativo desde " + calc.fmtData(p.inicio) + "; resultado \"Atingido\" no check-in; nenhum feedback de reconhecimento depois de " + calc.fmtData(p.checkinData) + ".",
        });
      });
      // 2. Agendar o 1:1 fora da ausência
      const c = cicloDo(ctx, m.id, ctx.tri.chave);
      if (c && m.estagio === "ATIVO") {
        const s = statusCiclo(ctx, c);
        const lim = calc.addDias(ctx.hoje, 14);
        const aus = (ctx.ausencias || []).find((a) => a.pessoa === m.userId && a.inicio <= lim && a.fim >= ctx.hoje);
        if (s.chave === "sem-agenda" && aus) lista.push({
          id: "1a1-aus-" + c.id, titulo: "Agende o 1:1 de " + nome + " fora da ausência",
          texto: nome + " estará fora de " + calc.fmtData(aus.inicio) + " a " + calc.fmtData(aus.fim) + ". Vale marcar o 1:1 antes ou a partir de " + calc.fmtData(calc.voltaEm(aus.fim, feriadosDoMembro(ctx, m))) + ".",
          referencia: "Regra do app · Ciclo trimestral (3.3)", acao: { rotulo: "Agendar o 1:1", rota: "#/rotinas/ciclo/" + c.id },
          porque: "1:1 do " + ctx.tri.curto + " sem data; ausência confirmada nas próximas 2 semanas.",
        });
      }
      // 3. A Ficha trava o onboarding
      const ob = onboardingDo(ctx, m.id);
      if (ob && ob.estagio === "NEW") {
        const s = statusOnboarding(ctx, ob);
        if (s.fichaAtrasada) lista.push({
          id: "ficha-" + ob.id, titulo: "A Ficha de " + nome + " trava o onboarding",
          texto: "Sem a Ficha, as entregas das semanas 3 e 4 não têm referência. Comece pelos resultados esperados" + (ob.planejamentoId ? ": o planejamento da função já tem um modelo." : "."),
          referencia: "Guia do onboarding · Preparação", acao: { rotulo: "Completar a Ficha", rota: "#/onboarding/" + ob.id },
          porque: "Ficha com prazo em " + calc.fmtData(s.prazoFicha) + " e ainda não preenchida; planejamento das semanas 3 e 4 vence em " + calc.fmtData(s.prazoEntregas) + ".",
        });
      }
    });
    // 4. Ordem de leitura das entregas
    const pendLeit = [];
    membros.forEach((m) => doMembro(ctx, "leituras", m.id).forEach((l) => { if (!l.leitura && ["NEW", "ATRASADA"].indexOf(l.estagio) >= 0) pendLeit.push(l); }));
    if (pendLeit.length >= 2) {
      const ord = pendLeit.slice().sort((a, b) => {
        const pa = a.origem === "Plano de alinhamento" ? 0 : 1, pb = b.origem === "Plano de alinhamento" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a.prazoLeitura || "9999") < String(b.prazoLeitura || "9999") ? -1 : 1;
      });
      lista.push({
        id: "ordem-leituras", titulo: pendLeit.length + " entregas aguardam leitura",
        texto: "Comece por \"" + ord[0].titulo + "\"" + (ord[0].origem === "Plano de alinhamento" ? ", que está ligada a um plano de alinhamento" : ", que tem o prazo mais próximo") + ".",
        referencia: "Regra do app · Leituras de entrega (3.4)", acao: { rotulo: "Ver leituras pendentes", rota: "#/desempenho" },
        porque: pendLeit.length + " leituras pendentes na equipe.",
      });
    }
    // 5. Indicar substituto
    if (o.uid) {
      const lim = calc.addDias(ctx.hoje, 90);
      const aus = (ctx.ausencias || []).find((a) => a.pessoa === String(o.uid) && a.inicio <= lim && a.fim >= ctx.hoje);
      if (aus) lista.push({
        id: "substituto-" + aus.inicio, titulo: "Indique quem acompanha a equipe na sua ausência",
        texto: "Você estará fora de " + calc.fmtData(aus.inicio) + " a " + calc.fmtData(aus.fim) + ". Uma liderança do mesmo setor pode receber as pendências e os avisos no período.",
        referencia: "Regra do app · Liderança ausente (4.2)", acao: { rotulo: "Ver a agenda da equipe", rota: "#/agenda" },
        porque: "Ausência confirmada nos próximos 90 dias.",
      });
    }
    const dispensadas = o.dispensadas || {};
    return lista.filter((d) => !dispensadas[d.id] || dispensadas[d.id] < ctx.hoje);
  }

  /* ================================================================ desempenho anual (3.3, 3.4, 4.8) */
  function anoDoMembro(ctx, membroId, ano) {
    const ciclos = [1, 2, 3, 4].map((t) => {
      const chave = ano + "-T" + t;
      const c = cicloDo(ctx, membroId, chave);
      const leit = doMembro(ctx, "leituras", membroId).filter((l) => l.trimestre === chave && l.leitura);
      return { chave, tri: calc.trimestre(ano, t), item: c, leituras: leit, notaLeituras: calc.notaDasLeituras(leit.map((l) => l.leitura)) };
    });
    const fbs = feedbacksDo(ctx, membroId).filter((f) => f.data.slice(0, 4) === String(ano));
    const tipos = {};
    fbs.forEach((f) => { tipos[f.tipo] = (tipos[f.tipo] || 0) + 1; });
    return { ano, ciclos, feedbacks: fbs, tipos, classificados: ciclos.filter((c) => c.item && c.item.classificacao).length };
  }

  /* ================================================================ checagem antes de ligar o app (5.3) */
  const EMAIL_PESSOAL = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|icloud|me|uol|bol|terra|ig)\.(com|com\.br)$/i;
  /** Os testes que o TI roda antes de liberar o app, sobre os dados já carregados. O 5º teste (exemplos
      da 4.5) são os testes automáticos do código e a conferência dos 6 casos no ambiente de teste. */
  function checagemImplantacao(ctx) {
    const cfg = ctx.config || {};
    const pc = cfg.papeis || {};
    const fora = {};
    (pc.ceo || []).concat(pc.excecoes || []).forEach((p) => { fora[String(p.id)] = true; });
    const usuarios = (ctx.usuarios || []).filter((u) => !fora[u.id] && (u.departamentos || []).length && (!u.tipo || u.tipo === "employee"));
    const ativos = membrosAtivos(ctx.registros.membros || []);
    const porUsuario = {};
    ativos.forEach((m) => { porUsuario[m.responsavel] = m; });
    const p1 = [];
    usuarios.forEach((u) => {
      const m = porUsuario[u.id];
      if (!m) { p1.push(u.nome + ": sem item no processo Membros"); return; }
      const falta = [["lideranca", "liderança direta"], ["coordenacao", "coordenação"], ["nivel", "nível"], ["senioridade", "senioridade"], ["ingresso", "data de ingresso"]]
        .filter((x) => !m[x[0]]).map((x) => x[1]);
      if (falta.length) p1.push(u.nome + ": falta " + falta.join(", "));
    });
    const p2 = [];
    const chefes = {};
    (ctx.departamentos || []).forEach((d) => { if (d.chefe) chefes[d.chefe] = true; });
    const lids = {};
    ativos.forEach((m) => { if (m.lideranca) lids[m.lideranca] = true; });
    Object.keys(lids).forEach((l) => { if (!chefes[l]) p2.push(pessoa(ctx, l).nome + " é liderança direta no Membros, mas não chefia nenhum departamento"); });
    ativos.forEach((m) => {
      const u = ctx.idx.usuario[m.responsavel];
      if (!u || !m.lideranca || !(u.departamentos || []).length) return;
      const pela = liderancaPelaEstrutura(ctx.idx.depto, u.id, u.departamentos);
      if (pela && pela !== m.lideranca) p2.push(u.nome + ": a liderança direta no Membros é " + pessoa(ctx, m.lideranca).nome + ", e pela estrutura é " + pessoa(ctx, pela).nome);
    });
    const p3 = usuarios.filter((u) => !u.email || EMAIL_PESSOAL.test(u.email)).map((u) => u.nome + (u.email ? ": e-mail pessoal no cadastro" : ": sem e-mail"));
    const p4 = [];
    const ano = Number(String(ctx.hoje).slice(0, 4));
    const locais = cfg.feriadosLocais || {};
    [["SP", "São Paulo"], ["BA", "Salvador"]].forEach((s) => [ano, ano + 1].forEach((a) => {
      if (!(locais[s[0]] || []).some((f) => String(f.data).slice(0, 4) === String(a))) p4.push("Feriados de " + s[1] + " de " + a + " não cadastrados");
    }));
    ativos.filter((m) => !m.cidade).forEach((m) => p4.push(infoMembro(ctx, m).nome + ": sem cidade de referência"));
    return [
      { chave: "membros", titulo: "Todo membro ativo tem item no Membros, com liderança direta, coordenação, nível, senioridade e data de ingresso", problemas: p1 },
      { chave: "estrutura", titulo: "Toda liderança chefia um departamento, e cada membro está no departamento da sua liderança direta", problemas: p2 },
      { chave: "email", titulo: "Nenhum usuário ativo sem e-mail corporativo", problemas: p3 },
      { chave: "feriados", titulo: "Feriados de SP e Salvador do ano corrente e do seguinte, e cidade de referência de todo membro", problemas: p4 },
    ].map((x) => Object.assign(x, { ok: !x.problemas.length }));
  }

  /* ================================================================ painel geral do RH e da CEO (4.4, 4.6, 4.8) */
  function painelGeral(ctx) {
    const todos = membrosAtivos(ctx.registros.membros || []);
    const ind = indicadoresEquipe(ctx, todos, {});
    // áreas = departamentos com liderança e equipe
    const areas = (ctx.departamentos || []).filter((d) => d.chefe && equipeDe(ctx, d.chefe).length).map((d) => {
      const equipe = equipeDe(ctx, d.chefe);
      return { depto: d, lideranca: pessoa(ctx, d.chefe), equipe, nEquipe: equipe.length, ind: indicadoresEquipe(ctx, equipe, { uid: d.chefe }) };
    }).sort((a, b) => a.depto.nome.localeCompare(b.depto.nome, "pt-BR"));
    const emDia = areas.filter((a) => a.ind.situacao.chave === "em-dia").length;
    // Rotatividade: saídas (encerramentos concluídos) nos últimos 12 meses ÷ membros ativos (aproximação até existir a foto mensal)
    const ini12 = calc.addDias(ctx.hoje, -365);
    const saidas = (ctx.registros.encerramentos || []).filter((e) => e.estagio === "SUCCESS" && (e.concluidaEm || "") >= ini12);
    const aPedido = saidas.filter((e) => /pedido/i.test(e.motivoSaida || "")).length;
    const vagas = vagasDe(ctx, null);
    const ini6 = calc.addDias(ctx.hoje, -182);
    const tempos = vagas.filter((v) => v.fechada && v.fechadaEm >= ini6 && v.tempoParaFechar !== null).map((v) => v.tempoParaFechar);
    return {
      todos, nMembros: todos.length, ind, areas, areasEmDia: calc.percentual(emDia, areas.length),
      rotatividade: calc.percentual(saidas.length, todos.length + saidas.length), saidas: saidas.length, aPedido, decisao: saidas.length - aPedido,
      tempoVaga: calc.mediana(tempos), vagasAbertas: vagas.filter((v) => !v.semantica).length,
      emOnboarding: todos.filter((m) => m.estagio === "NEW").length,
      encerramentosAndamento: (ctx.registros.encerramentos || []).filter((e) => ["SUCCESS", "FAIL"].indexOf(e.estagio) < 0).length,
    };
  }
  /** Só números, prazos e nomes de áreas e lideranças: é o que a CEO recebe (4.4: sem o conteúdo
      escrito dos registros e sem nomes de membros). Serve também de resposta do servidor (api/painel.js). */
  function resumoPainel(g) {
    const pct = (p) => ({ n: p.n, d: p.d, valor: p.valor, texto: p.texto, curto: p.curto });
    const indicadores = (i) => ({ um1a1: pct(i.um1a1), feedback90: pct(i.feedback90), atrasadas: i.atrasadas, situacao: { chave: i.situacao.chave, rotulo: i.situacao.rotulo, cor: i.situacao.cor } });
    return {
      nMembros: g.nMembros, ind: indicadores(g.ind), areasEmDia: pct(g.areasEmDia),
      areas: g.areas.map((a) => ({ depto: { id: a.depto.id, nome: a.depto.nome }, lideranca: { id: a.lideranca.id, nome: a.lideranca.nome }, nEquipe: a.nEquipe, ind: indicadores(a.ind) })),
      rotatividade: pct(g.rotatividade), saidas: g.saidas, aPedido: g.aPedido, decisao: g.decisao,
      tempoVaga: g.tempoVaga, vagasAbertas: g.vagasAbertas, emOnboarding: g.emOnboarding, encerramentosAndamento: g.encerramentosAndamento,
    };
  }

  return {
    MOTIVOS_COM_TRAVA, MOTIVOS_ABREVIADOS, MOTIVO_GRAVE, MSG_TRAVA, MSG_JUSTIFICATIVA, ESTAGIO_FASE,
    indexar, pessoa, infoMembro, membrosAtivos, deptosChefiados, descendentes, papeis, equipeDe, liderancaPelaEstrutura, coordenacaoPelaEstrutura, liderancasDoSetor, membrosVisiveis,
    feriadosDe, feriadosDoMembro, feedbackValido, feedbacksDo, editavel, ultimoFeedback,
    cicloDo, cicloAnterior, combinados, statusCiclo, statusOnboarding, onboardingDo, statusPlano, planoAtivoDo,
    verificarRegistros, destinoEncerramento, aprovadorDe,
    pendenciasDe, ordenarPendencias, aprovacoesPendentes, filaRH,
    indicadoresEquipe, conquistas, mapaCoordenacao, vagasDe, agendaEquipe, dicas, anoDoMembro, painelGeral, resumoPainel, checagemImplantacao,
  };
});
