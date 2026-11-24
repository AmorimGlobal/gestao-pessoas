/* =====================================================================================
   REVISÃO DE PROGRESSO — regras (protótipo do RH "Revisao_de_Progresso_Prototipo.html", 05/11/2026)
   -------------------------------------------------------------------------------------
   Ciclos abertos pelo RH em junho e novembro. Etapas: autoavaliação do membro, avaliação da
   liderança e 360°, calibração do RH, devolutiva da liderança, retornos do RH.
   - A liderança avalia cada liderado direto pelos KPIs e competências do cargo (matriz em
     57-revisao-matriz.js), com evidência, ajustes que valem na hora (o RH recebe o registro) e
     até 2 itens novos por seção. Fora do ciclo, só rascunho; com o ciclo aberto, envia ao RH.
   - Lê a autoavaliação do membro só depois de enviar a própria avaliação.
   - 360°: cada membro avalia os superiores (o imediato e, quando ele é uma supervisão, quem está
     acima) e os pares (mesma liderança direta), anônima ou identificada. A resposta é gravada pelo
     servidor, sem autor na anônima. Ninguém recebe a própria avaliação: só o RH lê, e os relatórios
     só usam grupos com o mínimo de respostas definido na abertura do ciclo.
   As respostas longas ficam em JSON nos campos de texto (as chaves são os "name" do protótipo:
   kpi_1_nivel, comp_2_evidencia, ...). Funções puras (Node + navegador): test/revisao.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"),
    raiz.GP && raiz.GP.dominio ? raiz.GP.dominio : require("./50-dominio.js"),
    raiz.GP && raiz.GP.revisaoMatriz ? raiz.GP.revisaoMatriz : require("./57-revisao-matriz.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.revisao = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc, dom, M) {
  "use strict";

  /* ================================================================ escalas e textos do protótipo */
  const NIVEIS_KPI = [
    { valor: "Ainda não alcança", desc: "Entregou menos do que foi combinado, de forma recorrente." },
    { valor: "Alcança em parte", desc: "Entregou parte do combinado ou de forma irregular." },
    { valor: "Alcança", desc: "Entregou o combinado." },
    { valor: "Supera", desc: "Entregou claramente além do combinado, com evidência." },
  ];
  const NIVEIS_COMP = [
    { n: 1, rotulo: "Básico", desc: "Competência ainda pontual ou com apoio constante." },
    { n: 2, rotulo: "Em desenvolvimento", desc: "Competência presente, mas ainda sem consistência." },
    { n: 3, rotulo: "Consistente", desc: "Nível mínimo esperado dos cargos já formalizados." },
    { n: 4, rotulo: "Referência", desc: "Sinal de prontidão para o próximo nível." },
  ];
  const rotuloNivel = (n) => { const x = NIVEIS_COMP.find((y) => y.n === Number(n)); return x ? x.n + " · " + x.rotulo : ""; };
  const ACORDO = ["Discordo totalmente", "Discordo", "Concordo", "Concordo totalmente"];
  const NAO_SEI = "Não sei avaliar";
  const AUTO = [
    { campo: "auto1", pergunta: "Quais foram minhas 3 principais entregas do período, com evidência?", dica: "Ex.: números, clientes atendidos, processos entregues. Até 3 entregas." },
    { campo: "auto2", pergunta: "O que eu fiz melhor do que esperava?", dica: "Algo que superou o que você mesmo esperava, com um exemplo." },
    { campo: "auto3", pergunta: "Onde eu fiquei abaixo do combinado e por quê?", dica: "Seja direto: o que ficou abaixo, o motivo e o que você faria diferente." },
    { campo: "auto4", pergunta: "O que eu preciso da minha liderança ou da empresa para entregar mais?", dica: "Recursos, informações, ferramentas, apoio da liderança." },
    { campo: "auto5", pergunta: "O que eu quero desenvolver no próximo semestre?", dica: "Uma ou duas competências ou conhecimentos. Isso ajuda a montar o seu PDI." },
  ];
  const SOBRE_LIDERANCA = [
    "Deixa claro o que é prioridade e o que se espera das minhas entregas.",
    "Me dá feedback com exemplos concretos, do que vai bem e do que precisa melhorar.",
    "Está disponível quando preciso destravar uma entrega.",
    "Reconhece as entregas bem feitas da equipe.",
    "Apoia meu desenvolvimento (PDI, aprendizado, novos desafios).",
    "Confia no meu trabalho e me dá autonomia dentro do meu escopo.",
    "Trata as pessoas com respeito, e me sinto à vontade para discordar.",
    "Comunica decisões e mudanças com antecedência e explica o porquê.",
  ];
  const SOBRE_PAR = [
    ["Contribuição", "Entrega a parte que lhe cabe no trabalho conjunto, no prazo combinado."],
    ["Qualidade", "O que entrega para mim pode ser usado sem retrabalho."],
    ["Coordenação", "Avisa com antecedência sobre andamento, riscos e mudanças que afetam meu trabalho."],
    ["Conhecimento", "Compartilha o que sabe e as informações de que preciso para fazer minhas entregas."],
    ["Cooperação", "Ajuda quando a equipe precisa, mesmo fora da própria demanda."],
    ["Comunicação", "Comunica com clareza e respeito, inclusive quando discorda."],
    ["Conflitos", "Trata divergências de forma direta e construtiva, buscando solução."],
    ["Abertura", "Recebe bem sugestões e feedbacks e ajusta o que for preciso."],
  ];
  const CICLOS = ["Novembro 2026 · inaugural (anual)", "Junho 2027 · 1º semestre", "Novembro 2027 · 2º semestre", "Junho 2028 · 1º semestre", "Novembro 2028 · 2º semestre"];
  const ETAPAS = ["Autoavaliação", "Avaliação da liderança e 360°", "Calibração", "Devolutivas das lideranças", "Retornos do RH"];
  const MAX_EXTRAS = 2;

  /* ================================================================ utilidades */
  function lerJSON(txt, padrao) {
    if (!txt) return padrao === undefined ? {} : padrao;
    if (typeof txt === "object") return txt;
    try { return JSON.parse(txt); } catch (e) { return padrao === undefined ? {} : padrao; }
  }
  const preenchido = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const reg = (ctx, chave) => (ctx.registros && ctx.registros[chave]) || [];

  /* ================================================================ ciclo e regras */
  const REGRAS_PADRAO = {
    publico: "todos", areas: [], excluidos: [], excecoes: "",
    // ciclo de teste (18/11/2026): só as pessoas escolhidas (IDs do Membros) participam, avisam e entram na 360°
    pessoas: [], teste: false,
    liberarLideranca: true, liberarPares: true, minimoNotas: 3, minimoComentarios: 5,
    abaixoMinimo: "juntar_area", retornoLidPequeno: "diagnostico_area", retornoTopo: "consultoria",
    conferencias: { lista: false, matriz: false, anonimato: false },
    // 23/11/2026, pedido do RH: neste primeiro ciclo as avaliações chegam em arquivo, por categoria (autoavaliação,
    // lideranças, pares e, para quem lidera, liderados). Os formulários do app voltam quando o RH revisar (2027): "formularios".
    entrega: "anexos",
    // 23/11/2026, pedido do usuário: o ciclo abre em silêncio (sem aviso no Bitrix nem no sino) até o RH clicar em "Avisar as pessoas"
    silencioso: false, avisadoEm: "",
  };
  /** Os retornos ao membro (devolutiva, retorno do RH, ciência) ficam fora até o RH liberar (pedido de 23/11/2026):
      o membro não vê "Seus retornos", não recebe aviso e o item de retornos nunca passa para ele. */
  const RETORNOS_AO_MEMBRO = false;
  function regrasDo(ciclo) {
    const r = Object.assign({}, REGRAS_PADRAO, lerJSON(ciclo && ciclo.regras));
    r.minimoNotas = Number(r.minimoNotas) || 3;
    r.minimoComentarios = Number(r.minimoComentarios) || 5;
    r.conferencias = Object.assign({}, REGRAS_PADRAO.conferencias, r.conferencias || {});
    r.pessoas = (r.pessoas || []).map(String);
    r.teste = !!r.teste || r.publico === "pessoas";
    r.entrega = r.entrega === "formularios" ? "formularios" : "anexos";
    if (r.teste) { r.minimoNotas = Number(lerJSON(ciclo && ciclo.regras).minimoNotas) || 1; r.minimoComentarios = Number(lerJSON(ciclo && ciclo.regras).minimoComentarios) || 1; }
    return r;
  }
  /** Ciclo aberto sem aviso: nenhuma notificação da Revisão (Bitrix ou sino) até o RH avisar as pessoas */
  const silencioso = (ciclo) => { const r = regrasDo(ciclo); return !!(ciclo && r.silencioso && !r.avisadoEm); };
  /** As avaliações deste ciclo chegam em arquivo (anexo), e não pelos formulários do app */
  const porAnexo = (ciclo) => regrasDo(ciclo).entrega === "anexos";
  /** A data em que as entregas fecham: o encerramento do ciclo ou, em ciclo antigo, o prazo da liderança */
  const encerramentoDo = (ciclo) => (ciclo && (ciclo.encerramento || ciclo.prazoLideranca || ciclo.prazoAuto)) || "";
  /** Ciclo de teste: só as pessoas escolhidas pelo RH, sem as conferências e com mínimo 1 nos relatórios */
  const ehTeste = (ciclo) => !!(ciclo && regrasDo(ciclo).teste);
  /** Os usuários do Bitrix que estão no ciclo de teste (null = ciclo normal, sem filtro) */
  function usuariosDoTeste(ctx, ciclo) {
    if (!ehTeste(ciclo)) return null;
    const ids = regrasDo(ciclo).pessoas;
    const set = {};
    reg(ctx, "membros").forEach((m) => { if (ids.indexOf(String(m.id)) >= 0 && m.responsavel) set[String(m.responsavel)] = true; });
    return set;
  }
  /** O RH só abre com a lista conferida, as matrizes conferidas e, com a 360° liberada, a demonstração do anonimato.
      O ciclo de teste não pede as conferências: é ele que serve para conferir. */
  function podeAbrir(regras) {
    const r = regras || REGRAS_PADRAO, cf = r.conferencias || {};
    const faltam = [];
    if (r.teste || r.publico === "pessoas") return { ok: true, faltam };
    if (!cf.lista) faltam.push("conferir a liderança direta de cada membro");
    if (!cf.matriz && r.entrega === "formularios") faltam.push("conferir as matrizes dos cargos participantes");
    if ((r.liberarLideranca || r.liberarPares) && !cf.anonimato) faltam.push("a demonstração técnica do anonimato pela TI");
    return { ok: !faltam.length, faltam };
  }
  const recentes = (lista) => lista.slice().sort((a, b) => (String(a.dataAbertura || a.criadoEm) < String(b.dataAbertura || b.criadoEm) ? 1 : -1));
  /** O ciclo aberto (o mais recente, se houver mais de um) */
  function cicloAberto(ctx) { return recentes(reg(ctx, "revCiclos").filter((c) => c.estagio === "ABERTO"))[0] || null; }
  /** O rascunho de abertura do RH (ainda não aberto) */
  function cicloRascunho(ctx) { return recentes(reg(ctx, "revCiclos").filter((c) => c.estagio === "NEW"))[0] || null; }
  /** O último ciclo encerrado ou aberto, para mostrar o que já passou */
  function ultimoCiclo(ctx) { return recentes(reg(ctx, "revCiclos").filter((c) => c.estagio === "ABERTO" || c.estagio === "SUCCESS"))[0] || null; }

  /* ================================================================ cargos */
  const CODIGOS = Object.keys(M.CARGOS).sort();
  function nomeCargo(config, codigo) {
    const nomes = (config && config.revisao && config.revisao.cargos) || {};
    return String(nomes[codigo] || M.NOMES_DO_PROTOTIPO[codigo] || "").trim();
  }
  function rotuloCargo(config, codigo) {
    if (!codigo) return "";
    const n = nomeCargo(config, codigo);
    return codigo + (n ? " · " + n : " · sem nome");
  }
  function cargoDo(m) { const c = String((m && m.cargoMatriz) || "").trim().toUpperCase(); return M.CARGOS[c] ? c : ""; }
  function matrizDo(m) { const c = cargoDo(m); return c ? M.CARGOS[c] : null; }
  const ehEstagio = (m) => /est[aá]gi/i.test(String((m && (m.contrato || "")) + " " + ((m && m.senioridade) || "")));

  /** Quem participa do ciclo: membro ativo (fora de encerramento) com cargo na matriz, conforme o público e as exceções */
  function participa(ctx, ciclo, m) {
    if (!m || ["SUCCESS", "FAIL", "EM_ENCERRAMENTO"].indexOf(m.estagio) >= 0) return { ok: false, motivo: "fora do app ou em encerramento" };
    const r = regrasDo(ciclo);
    if (r.publico === "pessoas" && r.pessoas.indexOf(String(m.id)) < 0) return { ok: false, motivo: "fora do ciclo de teste" };
    if ((r.excluidos || []).map(String).indexOf(String(m.id)) >= 0) return { ok: false, motivo: "exceção definida pelo RH neste ciclo" };
    if (r.publico === "sem_estagio" && ehEstagio(m)) return { ok: false, motivo: "estágios fora deste ciclo" };
    if (r.publico === "selecionar") {
      const area = areaDe(ctx, m.responsavel).id;
      if ((r.areas || []).map(String).indexOf(String(area)) < 0) return { ok: false, motivo: "área fora deste ciclo" };
    }
    // com entrega por anexo, a matriz do cargo não entra (o arquivo do RH já traz o que avaliar)
    if (!cargoDo(m) && r.entrega !== "anexos") return { ok: false, motivo: "sem cargo na matriz (o RH define no cadastro do membro)" };
    return { ok: true, motivo: "" };
  }
  /** A área de uma pessoa: o primeiro nível abaixo da empresa no caminho do departamento principal */
  function areaDe(ctx, uid) {
    const u = dom.pessoa(ctx, uid);
    const principal = dom.deptoPrincipal(ctx.idx.depto, u.departamentos || []);
    const cadeia = [], vistos = {};
    let d = principal ? ctx.idx.depto[principal] : null;
    while (d && !vistos[d.id]) { vistos[d.id] = true; cadeia.unshift(d); d = d.pai ? ctx.idx.depto[d.pai] : null; }
    const area = cadeia[1] || cadeia[0] || null;
    return { id: area ? String(area.id) : "", nome: area ? area.nome : "" };
  }
  /** As áreas da empresa (primeiro nível abaixo da raiz), para o RH escolher o público */
  function areas(ctx) {
    const raizes = (ctx.departamentos || []).filter((d) => !d.pai);
    const ids = raizes.map((d) => String(d.id));
    return (ctx.departamentos || []).filter((d) => ids.indexOf(String(d.pai)) >= 0).map((d) => ({ id: String(d.id), nome: d.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  /* ================================================================ os registros de cada membro */
  /** A avaliação da liderança deste membro no ciclo (ou o rascunho feito fora do ciclo, que entra no ciclo aberto) */
  function avaliacaoDo(ctx, membroId, ciclo) {
    const doMembro = reg(ctx, "revAvaliacoes").filter((a) => String(a.membroId) === String(membroId) && a.estagio !== "FAIL");
    if (ciclo) { const noCiclo = doMembro.find((a) => String(a.cicloId) === String(ciclo.id)); if (noCiclo) return noCiclo; }
    return doMembro.find((a) => !a.cicloId && a.estagio === "NEW") || null;
  }
  /** A autoavaliação da pessoa no ciclo (pela pessoa responsável: o membro nem sempre lê o próprio item do Membros) */
  function autoavaliacaoDe(ctx, uid, ciclo) {
    if (!ciclo) return null;
    return reg(ctx, "revAutoavaliacoes").find((a) => String(a.responsavel) === String(uid) && String(a.cicloId) === String(ciclo.id) && a.estagio !== "FAIL") || null;
  }
  /** Os retornos da pessoa no ciclo. Pelo item do Membros quando ele é lido; senão pelo responsável, desde que o item não seja de outra
      pessoa (antes da conversa de devolutiva o responsável é a liderança, então o item de um liderado não pode virar o retorno dela). */
  function retornoDe(ctx, uid, ciclo) {
    if (!ciclo) return null;
    const idx = ctx.idx || {};
    const lista = reg(ctx, "revRetornos").filter((a) => String(a.cicloId) === String(ciclo.id) && a.estagio !== "FAIL");
    const meu = idx.membroPorUsuario && idx.membroPorUsuario[String(uid)];
    if (meu) { const r = lista.find((a) => String(a.membroId) === String(meu.id)); if (r) return r; }
    return lista.find((a) => {
      if (String(a.responsavel) !== String(uid)) return false;
      const dono = idx.membro && idx.membro[a.membroId];
      return !dono || String(dono.responsavel) === String(uid);
    }) || null;
  }
  /** A devolutiva só chega ao membro depois que a liderança confirma que a conversa aconteceu (pedido de 18/11/2026):
      a data da conversa (devolutivaEm) é o que libera. Antes disso o registro é só preparação da liderança. */
  const devolutivaLiberada = (ret) => !!(ret && ret.devolutivaEm);
  const devolutivaPreparada = (ret) => !!(ret && !ret.devolutivaEm && (ret.fortes || ret.desenvolver || ret.metas));
  /** Quem fica de responsável pelo item de retornos antes da conversa: a liderança que avalia (o membro, com "Próprios" no CRM,
      não lê o que ainda não foi conversado). Na liberação, o item passa ao membro. */
  function donoAntesDaConversa(ctx, m, ciclo, reserva) {
    const av = avaliacaoDo(ctx, m.id, ciclo);
    return String((av && (av.avaliador || av.responsavel)) || dom.liderancaEfetiva(ctx, m) || reserva || m.responsavel);
  }

  /* ================================================================ o formulário da liderança */
  /** Os itens do formulário que faltam para enviar ao RH, em palavras. av = as respostas (JSON); cargo = a matriz. */
  function faltando(cargo, av) {
    const a = av || {}, faltam = [];
    const nivelOk = (k) => preenchido(a[k]);
    (cargo ? cargo.kpis : []).forEach((k, i) => {
      const n = i + 1;
      if (a["kpi_" + n + "_ajuste"] === "nao_se_aplica") return;
      if (!nivelOk("kpi_" + n + "_nivel")) faltam.push("KPI " + n + ": nível de entrega");
      if (!preenchido(a["kpi_" + n + "_evidencia"])) faltam.push("KPI " + n + ": evidência");
    });
    for (let e = 1; e <= MAX_EXTRAS; e++) {
      if (!preenchido(a["kpi_extra_" + e + "_indicador"])) continue;
      if (!nivelOk("kpi_extra_" + e + "_entrega")) faltam.push("KPI novo " + e + ": nível de entrega");
      if (!preenchido(a["kpi_extra_" + e + "_evidencia"])) faltam.push("KPI novo " + e + ": evidência");
    }
    (cargo ? cargo.competencias : []).forEach((c, i) => {
      const n = i + 1;
      if (a["comp_" + n + "_ajuste"] === "nao_se_aplica") return;
      if (!nivelOk("comp_" + n + "_nivel")) faltam.push("Competência " + n + ": nível");
      if (!preenchido(a["comp_" + n + "_evidencia"])) faltam.push("Competência " + n + ": evidência");
    });
    for (let e = 1; e <= MAX_EXTRAS; e++) {
      if (!preenchido(a["comp_extra_" + e + "_nome"])) continue;
      if (!nivelOk("comp_extra_" + e + "_observado")) faltam.push("Competência nova " + e + ": nível observado");
      if (!preenchido(a["comp_extra_" + e + "_evidencia"])) faltam.push("Competência nova " + e + ": evidência");
    }
    if (!preenchido(a.conclusao_geral)) faltam.push("Conclusão geral");
    if (!preenchido(a.ponto_forte_1)) faltam.push("Ponto forte 1");
    if (!preenchido(a.ponto_desenv_1)) faltam.push("Ponto de desenvolvimento 1");
    if (!preenchido(a.decisao_equipe)) faltam.push("Pergunta de decisão: ter esta pessoa na equipe");
    else if (/^Discordo/.test(a.decisao_equipe) && !preenchido(a.decisao_equipe_evidencia)) faltam.push("Evidência da discordância");
    if (!preenchido(a.decisao_risco)) faltam.push("Pergunta de decisão: risco de baixo desempenho");
    else if (a.decisao_risco === "Sim" && !preenchido(a.decisao_risco_evidencia)) faltam.push("Evidência do risco de baixo desempenho");
    return faltam;
  }
  /** A situação da competência frente ao mínimo do cargo (ou o mínimo proposto no ajuste) */
  function situacaoMinimo(nivel, minimo) {
    const n = Number(nivel), m = Number(minimo);
    if (!n || !m) return null;
    if (n < m) return { texto: "abaixo do mínimo (" + m + ")", cor: "ambar" };
    if (n === m) return { texto: "no mínimo", cor: "verde" };
    return { texto: "acima do mínimo", cor: "verde" };
  }
  /** O que a liderança ajustou na matriz para esta avaliação (o RH recebe o registro: original x ajustado) */
  function ajustes(cargo, av) {
    const a = av || {}, lista = [];
    (cargo ? cargo.kpis : []).forEach((k, i) => {
      const n = i + 1, aj = a["kpi_" + n + "_ajuste"];
      if (aj === "nao_se_aplica") lista.push({ item: "KPI " + n, original: k.indicador, ajustado: "Não se aplica neste ciclo", motivo: a["kpi_" + n + "_aj_motivo"] || "" });
      else if (aj === "ajustar") {
        const mud = [["indicador", "aj_indicador"], ["meta", "aj_meta"], ["calculo", "aj_calculo"]].filter(([, s]) => preenchido(a["kpi_" + n + "_" + s]))
          .map(([o, s]) => o + ": " + a["kpi_" + n + "_" + s]);
        lista.push({ item: "KPI " + n, original: k.indicador + " · meta " + k.meta, ajustado: mud.join(" · ") || "ajustado sem mudança de texto", motivo: a["kpi_" + n + "_aj_motivo"] || "" });
      }
    });
    (cargo ? cargo.competencias : []).forEach((c, i) => {
      const n = i + 1, aj = a["comp_" + n + "_ajuste"];
      if (aj === "nao_se_aplica") lista.push({ item: "Competência " + n, original: c.nome, ajustado: "Não se aplica neste ciclo", motivo: a["comp_" + n + "_aj_motivo"] || "" });
      else if (aj === "ajustar") {
        const mud = [];
        if (preenchido(a["comp_" + n + "_aj_descricao"])) mud.push("descrição: " + a["comp_" + n + "_aj_descricao"]);
        if (preenchido(a["comp_" + n + "_minprop"])) mud.push("mínimo proposto: " + rotuloNivel(a["comp_" + n + "_minprop"]));
        lista.push({ item: "Competência " + n, original: c.nome + " · mínimo " + rotuloNivel(c.minimo), ajustado: mud.join(" · ") || "ajustado sem mudança", motivo: a["comp_" + n + "_aj_motivo"] || "" });
      }
    });
    for (let e = 1; e <= MAX_EXTRAS; e++) {
      if (preenchido(a["kpi_extra_" + e + "_indicador"])) lista.push({ item: "KPI novo " + e, original: "", ajustado: a["kpi_extra_" + e + "_indicador"], motivo: a["kpi_extra_" + e + "_motivo"] || "" });
      if (preenchido(a["comp_extra_" + e + "_nome"])) lista.push({ item: "Competência nova " + e, original: "", ajustado: a["comp_extra_" + e + "_nome"], motivo: a["comp_extra_" + e + "_motivo"] || "" });
    }
    return lista;
  }

  /* ================================================================ situação de cada liderado */
  const SITUACAO_AVALIACAO = { NEW: "Rascunho", ENVIADA: "Enviada ao RH", CALIBRADA: "Calibrada", DEVOLUTIVA: "Devolutiva feita", SUCCESS: "Concluída" };
  /** Para a lista da liderança e do RH */
  function situacaoDo(ctx, ciclo, m) {
    const av = avaliacaoDo(ctx, m.id, ciclo);
    const auto = autoavaliacaoDe(ctx, m.responsavel, ciclo);
    const ret = retornoDe(ctx, m.responsavel, ciclo);
    const preparada = av && av.estagio === "CALIBRADA" && devolutivaPreparada(ret);
    return {
      avaliacao: av ? (preparada ? "Devolutiva preparada · falta a conversa" : av.cicloId || !ciclo ? SITUACAO_AVALIACAO[av.estagio] || av.estagio : "Rascunho pronto para o ciclo") : "Sem rascunho",
      avaliacaoEstagio: av ? av.estagio : "",
      auto: !ciclo ? "" : auto && auto.estagio === "SUCCESS" ? "Autoavaliação recebida" : auto ? "Autoavaliação em rascunho" : "Aguardando autoavaliação",
      autoEnviada: !!(auto && auto.estagio === "SUCCESS"),
      ciencia: !!(ret && ret.cienciaEm), item: av,
    };
  }

  /* ================================================================ 360°: quem avalia quem (pela estrutura do Bitrix) */
  /** Quem entra na 360°: pessoas da estrutura, sem a CEO e sem quem está fora do app (Papéis), e sem quem saiu,
      foi arquivado ou está em encerramento no Membros */
  function ativos(ctx, ciclo) {
    const pc = (ctx.config && ctx.config.papeis) || {};
    const doTeste = usuariosDoTeste(ctx, ciclo);
    const fora = {};
    (pc.ceo || []).concat(pc.excecoes || []).forEach((p) => { fora[String(p.id)] = true; });
    return (ctx.usuarios || []).filter((u) => {
      if (fora[String(u.id)] || !(u.departamentos || []).length || (u.tipo && u.tipo !== "employee")) return false;
      if (doTeste && !doTeste[String(u.id)]) return false;
      const m = ctx.idx.membroPorUsuario[String(u.id)];
      return !m || ["SUCCESS", "FAIL", "EM_ENCERRAMENTO"].indexOf(m.estagio) < 0;
    });
  }
  /** A liderança direta: a mesma do resto do app (liderança efetiva do Membros); sem item, pela estrutura */
  function liderDe(ctx, uid) {
    const m = ctx.idx.membroPorUsuario[String(uid)];
    if (m) { const l = dom.liderancaEfetiva(ctx, m); if (l) return String(l); }
    const u = dom.pessoa(ctx, uid);
    if (!(u.departamentos || []).length) return "";
    return String(dom.liderancaNaEstrutura(ctx.idx.depto, String(uid), u.departamentos).id || "");
  }
  const ehSupervisao = (ctx, uid) => /supervis/i.test(String(dom.pessoa(ctx, uid).cargo || ""));
  /** No ciclo de teste, quem não está nele não responde a 360° de ninguém */
  const foraDoTeste = (ctx, ciclo, uid) => { const t = usuariosDoTeste(ctx, ciclo); return !!t && !t[String(uid)]; };
  const naEstrutura = (ctx, uid, ciclo) => ativos(ctx, ciclo).some((u) => String(u.id) === String(uid));
  /** Quem pode ser avaliado como liderança (24/11/2026, pedido do RH: "falta aparecer a liderança acima de mim"):
      também a CEO, que não avalia ninguém mas é a liderança direta de quem se reporta a ela. Fora: quem está fora
      do app (Papéis → exceções), quem saiu ou está em encerramento. No ciclo de teste, só quem está no teste. */
  function avaliavelComoLideranca(ctx, uid, ciclo) {
    if (foraDoTeste(ctx, ciclo, uid)) return false;
    const pc = (ctx.config && ctx.config.papeis) || {};
    if ((pc.excecoes || []).some((p) => String(p.id) === String(uid))) return false;
    const u = (ctx.usuarios || []).find((x) => String(x.id) === String(uid));
    if (!u || !(u.departamentos || []).length || (u.tipo && u.tipo !== "employee")) return false;
    const m = ctx.idx.membroPorUsuario[String(uid)];
    return !m || ["SUCCESS", "FAIL", "EM_ENCERRAMENTO"].indexOf(m.estagio) < 0;
  }
  /** Superiores: o imediato e, quando ele é uma supervisão, quem está acima dela (no ciclo de teste, só quem está no teste) */
  function superioresDe(ctx, uid, ciclo) {
    const lista = [];
    if (foraDoTeste(ctx, ciclo, uid)) return lista;
    const imediato = liderDe(ctx, uid);
    if (!imediato || !avaliavelComoLideranca(ctx, imediato, ciclo)) return lista;
    lista.push({ uid: imediato, relacao: "Superior", papel: "liderança imediata" });
    if (ehSupervisao(ctx, imediato)) {
      const acima = liderDe(ctx, imediato);
      if (acima && acima !== String(uid) && avaliavelComoLideranca(ctx, acima, ciclo)) lista.push({ uid: acima, relacao: "Superior", papel: "liderança acima da sua supervisão" });
    }
    return lista;
  }
  /** Pares: quem tem a mesma liderança direta (inclusive lideranças com o mesmo superior) */
  function paresDe(ctx, uid, ciclo) {
    if (foraDoTeste(ctx, ciclo, uid)) return [];
    const lider = liderDe(ctx, uid);
    if (!lider) return [];
    return ativos(ctx, ciclo).filter((u) => String(u.id) !== String(uid) && String(u.id) !== lider && liderDe(ctx, u.id) === lider)
      .map((u) => ({ uid: String(u.id), relacao: "Par", papel: "par" }));
  }
  /** As lideranças acima de alguém, da direta até o topo */
  function cadeiaAcima(ctx, uid) {
    const lista = [], vistos = {};
    vistos[String(uid)] = true;
    let l = liderDe(ctx, uid);
    while (l && !vistos[l]) { vistos[l] = true; lista.push(l); l = liderDe(ctx, l); }
    return lista;
  }
  /** Colegas da mesma área (23/11/2026: "avalie seus colegas de equipe ou da mesma área"), só na entrega por anexo:
      quem está na área de quem avalia, fora os pares de mesma liderança e quem está acima ou abaixo na cadeia de
      liderança (a coordenação da área não é colega; quem a pessoa lidera, mesmo indiretamente, também não) */
  function colegasDaArea(ctx, uid, ciclo) {
    if (!porAnexo(ciclo) || foraDoTeste(ctx, ciclo, uid)) return [];
    const area = areaDe(ctx, uid).id;
    if (!area) return [];
    const id = String(uid);
    const ja = {};
    ja[id] = true;
    superioresDe(ctx, uid, ciclo).concat(paresDe(ctx, uid, ciclo)).forEach((x) => { ja[x.uid] = true; });
    cadeiaAcima(ctx, uid).forEach((x) => { ja[x] = true; });
    return ativos(ctx, ciclo).filter((u) => !ja[String(u.id)] && areaDe(ctx, u.id).id === area && cadeiaAcima(ctx, u.id).indexOf(id) < 0)
      .map((u) => ({ uid: String(u.id), relacao: "Par", papel: "colega da área" }));
  }
  /** Liderados diretos (aparecem com o link para a Revisão formal, sem formulário duplicado) */
  function lideradosDe(ctx, uid, ciclo) { return ativos(ctx, ciclo).filter((u) => String(u.id) !== String(uid) && liderDe(ctx, u.id) === String(uid)).map((u) => String(u.id)); }
  /** Quantas pessoas podem avaliar alguém nesta relação: abaixo do mínimo, o grupo é pequeno (resposta só usada junto da área) */
  function avaliadoresPossiveis(ctx, avaliado, relacao, ciclo) {
    if (relacao === "Par") return paresDe(ctx, avaliado, ciclo).length;
    return ativos(ctx, ciclo).filter((u) => superioresDe(ctx, u.id, ciclo).some((s) => s.uid === String(avaliado))).length;
  }
  function grupoPequeno(ctx, avaliado, relacao, regras, ciclo) { return avaliadoresPossiveis(ctx, avaliado, relacao, ciclo) < (Number(regras && regras.minimoNotas) || 3); }
  /** A relação de quem responde com o avaliado, ou "" se não há (o servidor recusa) */
  function relacaoCom(ctx, uid, avaliado, ciclo) {
    if (superioresDe(ctx, uid, ciclo).some((s) => s.uid === String(avaliado))) return "Superior";
    if (paresDe(ctx, uid, ciclo).some((s) => s.uid === String(avaliado))) return "Par";
    if (colegasDaArea(ctx, uid, ciclo).some((s) => s.uid === String(avaliado))) return "Par";
    return "";
  }
  /** Confere uma resposta 360° antes de gravar: as chaves certas, valores da escala e textos de tamanho razoável.
      Com o arquivo (entrega por anexo, 23/11/2026), a resposta pode vir só com ele: grava {anexo: true}. */
  function validarResposta(relacao, r, comArquivo) {
    if (comArquivo) return { ok: true, erros: [], respostas: { anexo: true } };
    const pre = relacao === "Superior" ? "lid_" : "par_";
    const erros = [], limpo = {};
    for (let i = 1; i <= 8; i++) {
      const v = r && r[pre + i];
      if (!v) continue;
      if (ACORDO.indexOf(v) < 0 && v !== NAO_SEI) erros.push(pre + i + ": valor fora da escala");
      else limpo[pre + i] = v;
    }
    ["continuar", "comecar", "exemplo"].forEach((k) => {
      const v = String((r && r[k]) || "").trim();
      if (v.length > 4000) erros.push(k + ": texto longo demais");
      else if (v) limpo[k] = v;
    });
    if (!Object.keys(limpo).some((k) => k.indexOf(pre) === 0)) erros.push("responda pelo menos uma afirmação");
    return { ok: !erros.length, erros, respostas: limpo };
  }

  /* ================================================================ entrega por anexo */
  const LIMITE_ANEXO = 3 * 1024 * 1024; // bytes somados por envio (a 360° passa pelo servidor da Vercel, que aceita até 4,5 MB)
  const EXTENSOES_ANEXO = ["pdf", "doc", "docx", "xls", "xlsx", "odt", "ods", "ppt", "pptx", "png", "jpg", "jpeg", "txt"];
  /** Confere os arquivos de uma entrega: arquivos = [[nome, base64], ...] (servidor) ou [{name, size}] (navegador) */
  function conferirAnexos(arquivos) {
    const lista = Array.isArray(arquivos) ? arquivos : [];
    const erros = [];
    if (!lista.length) erros.push("escolha o arquivo da avaliação");
    if (lista.length > 5) erros.push("até 5 arquivos por envio");
    let total = 0;
    lista.forEach((a) => {
      const nome = String(Array.isArray(a) ? a[0] : (a && a.name) || "");
      const ext = (nome.split(".").pop() || "").toLowerCase();
      if (!nome || nome.length > 200) erros.push("nome de arquivo inválido");
      else if (EXTENSOES_ANEXO.indexOf(ext) < 0) erros.push(nome + ": envie PDF, Word, Excel, PowerPoint ou imagem");
      total += Array.isArray(a) ? Math.floor(String(a[1] || "").length * 3 / 4) : Number(a && a.size) || 0;
    });
    if (total > LIMITE_ANEXO) erros.push("os arquivos passam de 3 MB juntos: salve em PDF ou reduza as imagens");
    return { ok: !erros.length, erros };
  }
  const temAnexo = (x) => !!(x && Array.isArray(x.anexos) && x.anexos.length);
  /** Resposta 360° que só traz o arquivo (sem as afirmações): fica fora das médias e aparece na lista de arquivos */
  const so360Anexo = (x) => { const r = lerJSON(x && x.respostas); return !!r.anexo || (temAnexo(x) && !Object.keys(r).some((k) => /^(lid|par)_/.test(k))); };
  /** As avaliações 360° em arquivo do ciclo, por pessoa avaliada e relação (para o RH abrir no Bitrix) */
  function anexos360(ctx, ciclo) {
    const resp = reg(ctx, "rev360").filter((x) => String(x.cicloId) === String(ciclo && ciclo.id) && x.estagio !== "FAIL" && so360Anexo(x));
    const grupos = {};
    resp.forEach((x) => { const k = String(x.avaliado) + "|" + (x.relacao || ""); (grupos[k] = grupos[k] || { avaliado: String(x.avaliado), relacao: x.relacao || "", itens: [] }).itens.push(x); });
    return Object.keys(grupos).map((k) => Object.assign(grupos[k], { nome: dom.pessoa(ctx, grupos[k].avaliado).nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.relacao.localeCompare(b.relacao));
  }

  /* ================================================================ relatório do RH (só agregados, com o mínimo) */
  const PONTOS = { "Discordo totalmente": 1, "Discordo": 2, "Concordo": 3, "Concordo totalmente": 4 };
  /** Agrega um grupo de respostas: n, médias por afirmação (sem o "Não sei avaliar") e quantos comentários */
  function agregar(lista, relacao) {
    const pre = relacao === "Superior" ? "lid_" : "par_";
    const itens = [];
    for (let i = 1; i <= 8; i++) {
      const vals = lista.map((x) => PONTOS[lerJSON(x.respostas)[pre + i]]).filter(Boolean);
      itens.push({ n: vals.length, media: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null });
    }
    const comentarios = lista.reduce((s, x) => { const r = lerJSON(x.respostas); return s + ["continuar", "comecar", "exemplo"].filter((k) => preenchido(r[k])).length; }, 0);
    return { n: lista.length, itens, comentarios };
  }
  /** Os comentários de um grupo, em ordem alfabética (nunca na ordem em que chegaram), para o RH resumir em temas */
  function textosDe(lista) {
    const t = { continuar: [], comecar: [], exemplo: [] };
    lista.forEach((x) => { const r = lerJSON(x.respostas); Object.keys(t).forEach((k) => { if (preenchido(r[k])) t[k].push(String(r[k]).trim()); }); });
    Object.keys(t).forEach((k) => t[k].sort((a, b) => a.localeCompare(b, "pt-BR")));
    return t;
  }
  /** O relatório 360° do ciclo, por pessoa avaliada e relação. Abaixo do mínimo de notas, a pessoa não aparece sozinha:
      vai para o grupo da área (juntar_area) ou fica de fora (nao_usar). Os comentários só entram com o mínimo próprio. */
  function relatorio360(ctx, ciclo) {
    const r = regrasDo(ciclo);
    const resp = reg(ctx, "rev360").filter((x) => String(x.cicloId) === String(ciclo && ciclo.id) && x.estagio !== "FAIL" && !so360Anexo(x));
    const grupos = {};
    resp.forEach((x) => { const k = String(x.avaliado) + "|" + (x.relacao || ""); (grupos[k] = grupos[k] || []).push(x); });
    const pessoas = [], porArea = {};
    let foraDoRelatorio = 0;
    Object.keys(grupos).forEach((k) => {
      const [avaliado, relacao] = k.split("|");
      const lista = grupos[k];
      if (lista.length >= r.minimoNotas) {
        const ag = agregar(lista, relacao);
        const com = ag.n >= r.minimoComentarios;
        // os textos só existem no relatório com o mínimo de comentários: abaixo dele, nem chegam à tela
        pessoas.push(Object.assign({ avaliado, nome: dom.pessoa(ctx, avaliado).nome, relacao, area: lista[0].area || "" }, ag, { comComentarios: com, textos: com ? textosDe(lista) : null }));
      } else if (r.abaixoMinimo === "juntar_area") {
        const chave = (lista[0].area || "Sem área") + "|" + relacao;
        (porArea[chave] = porArea[chave] || []).push(...lista);
      } else foraDoRelatorio += lista.length;
    });
    const areasJuntas = [];
    Object.keys(porArea).forEach((k) => {
      const [area, relacao] = k.split("|");
      const lista = porArea[k];
      const com = lista.length >= r.minimoComentarios;
      if (lista.length >= r.minimoNotas) areasJuntas.push(Object.assign({ area, relacao }, agregar(lista, relacao), { comComentarios: com, textos: com ? textosDe(lista) : null }));
      else foraDoRelatorio += lista.length;
    });
    return { total: resp.length, pessoas: pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), areas: areasJuntas, foraDoRelatorio, minimoNotas: r.minimoNotas, minimoComentarios: r.minimoComentarios };
  }

  /* ================================================================ quem participa e o que cada um enxerga */
  /** Os liderados diretos desta pessoa que participam do ciclo (sem ciclo: os que têm cargo na matriz, para o rascunho) */
  function equipeNoCiclo(ctx, uid, ciclo) {
    // no ciclo de teste, só avalia quem também está no teste (a CEO, fora dele, não recebe nada)
    const doTeste = usuariosDoTeste(ctx, ciclo);
    if (doTeste && !doTeste[String(uid)]) return [];
    return dom.equipeDe(ctx, uid).filter((m) => (ciclo ? participa(ctx, ciclo, m).ok : !!cargoDo(m) && ["SUCCESS", "FAIL", "EM_ENCERRAMENTO"].indexOf(m.estagio) < 0));
  }
  /** Todos os membros do app com a situação no ciclo: {m, ok, motivo}. Para o RH conferir a lista antes de abrir. */
  function participantes(ctx, ciclo) {
    return dom.membrosAtivos(ctx.registros.membros || []).map((m) => Object.assign({ m }, participa(ctx, ciclo, m)));
  }
  /** O item do Membros da pessoa, se ela participa do ciclo */
  function euParticipo(ctx, uid, ciclo) {
    const m = ctx.idx.membroPorUsuario[String(uid)];
    return m && ciclo && participa(ctx, ciclo, m).ok ? m : null;
  }
  /** A liderança só lê a autoavaliação depois de enviar a própria avaliação ao RH (o RH lê sempre) */
  const avaliacaoEnviada = (av) => !!(av && av.cicloId && av.estagio !== "NEW" && av.estagio !== "FAIL");

  /* ================================================================ avisos do sino */
  /** O que a Revisão de Progresso avisa a cada pessoa (calculado dos registros, como o resto do sino) */
  function notificacoes(ctx, uid) {
    const id = String(uid);
    const ciclo = cicloAberto(ctx);
    if (!ciclo) return [];
    const p = dom.papeis(ctx, id);
    const lista = [];
    const nomeCiclo = ciclo.ciclo || "Revisão de Progresso";
    const quando = ciclo.dataAbertura ? ciclo.dataAbertura + "T08:00:00-03:00" : ciclo.criadoEm;
    const auto = autoavaliacaoDe(ctx, id, ciclo);
    const anexo = porAnexo(ciclo), fim = encerramentoDo(ciclo);
    // em silêncio, só o RH vê o que chegou para calibrar
    if (silencioso(ciclo)) return p.rh ? enviadasAoRH(ctx, ciclo) : [];
    if (euParticipo(ctx, id, ciclo)) lista.push({ id: "rev-ciclo-" + ciclo.id, quando, area: "Revisão de Progresso", rota: anexo ? "#/revisao" : "#/revisao/auto",
      titulo: "O RH abriu a Revisão de Progresso (" + nomeCiclo + ")",
      texto: anexo ? (fim ? "Envie as suas avaliações (autoavaliação, lideranças e pares) até " + calc.fmtData(fim) + "." : "") : ciclo.prazoAuto ? "Sua autoavaliação vai até " + calc.fmtData(ciclo.prazoAuto) + "." : "",
      acao: !(auto && auto.estagio === "SUCCESS") });
    const equipe = equipeNoCiclo(ctx, id, ciclo);
    if (equipe.length) {
      const faltam = equipe.filter((m) => { const a = avaliacaoDo(ctx, m.id, ciclo); return !a || a.estagio === "NEW"; }).length;
      if (faltam) lista.push({ id: "rev-equipe-" + ciclo.id, quando, area: "Revisão de Progresso", rota: "#/revisao", acao: true,
        titulo: "Avalie sua equipe na Revisão de Progresso", texto: faltam + " de " + equipe.length + " avaliações a enviar" + ((anexo ? fim : ciclo.prazoLideranca) ? " até " + calc.fmtData(anexo ? fim : ciclo.prazoLideranca) : "") + "." });
      equipe.forEach((m) => {
        const a = avaliacaoDo(ctx, m.id, ciclo);
        if (a && a.estagio === "CALIBRADA" && a.calibradaEm) lista.push({ id: "rev-calib-" + a.id, quando: a.calibradaEm, area: "Revisão de Progresso", rota: "#/revisao/membro/" + m.id, acao: true,
          titulo: "Calibração concluída: converse com " + dom.pessoa(ctx, m.responsavel).nome + (RETORNOS_AO_MEMBRO ? " e libere a devolutiva" : " e registre a devolutiva"),
          texto: (RETORNOS_AO_MEMBRO ? "O registro só chega à pessoa depois que você confirmar a conversa." : "O registro fica com você e o RH.") + (ciclo.prazoDevolutiva ? " Até " + calc.fmtData(ciclo.prazoDevolutiva) + "." : "") });
        const ret = retornoDe(ctx, m.responsavel, ciclo);
        if (ret && ret.cienciaEm) lista.push({ id: "rev-ciencia-" + ret.id, quando: ret.cienciaEm, area: "Revisão de Progresso", rota: "#/revisao/membro/" + m.id,
          titulo: dom.pessoa(ctx, m.responsavel).nome + " confirmou a ciência da devolutiva", texto: "" });
      });
    }
    const meu = retornoDe(ctx, id, ciclo);
    if (RETORNOS_AO_MEMBRO && devolutivaLiberada(meu) && meu.estagio === "DEVOLUTIVA" && !meu.cienciaEm) lista.push({ id: "rev-devolutiva-" + meu.id, quando: meu.atualizadoEm || meu.criadoEm, area: "Revisão de Progresso", rota: "#/revisao/retornos", acao: true,
      titulo: "Sua liderança registrou a devolutiva: confirme a ciência", texto: "Ciência, não concordância." });
    if (p.rh) lista.push(...enviadasAoRH(ctx, ciclo));
    return lista;
  }
  function enviadasAoRH(ctx, ciclo) {
    return reg(ctx, "revAvaliacoes").filter((a) => String(a.cicloId) === String(ciclo.id) && a.estagio === "ENVIADA").map((a) => {
      const m = ctx.idx.membro[a.membroId];
      return { id: "rev-enviada-" + a.id, quando: a.enviadaEm || a.atualizadoEm, area: "Revisão de Progresso", rota: "#/revisao/membro/" + a.membroId, acao: true,
        titulo: "Avaliação enviada ao RH: " + (m ? dom.pessoa(ctx, m.responsavel).nome : a.titulo), texto: "Por " + dom.pessoa(ctx, a.avaliador || a.responsavel).nome + ". Aguarda a calibração." };
    });
  }

  return {
    NIVEIS_KPI, NIVEIS_COMP, ACORDO, NAO_SEI, AUTO, SOBRE_LIDERANCA, SOBRE_PAR, CICLOS, ETAPAS, MAX_EXTRAS, REGRAS_PADRAO, CODIGOS, PONTOS,
    RETORNOS_AO_MEMBRO, LIMITE_ANEXO, EXTENSOES_ANEXO, porAnexo, silencioso, encerramentoDo, conferirAnexos, temAnexo, so360Anexo, anexos360, colegasDaArea,
    rotuloNivel, lerJSON, regrasDo, podeAbrir, cicloAberto, cicloRascunho, ultimoCiclo, ehTeste, usuariosDoTeste,
    nomeCargo, rotuloCargo, cargoDo, matrizDo, participa, areaDe, areas,
    avaliacaoDo, autoavaliacaoDe, retornoDe, devolutivaLiberada, devolutivaPreparada, donoAntesDaConversa, faltando, situacaoMinimo, ajustes, situacaoDo,
    equipeNoCiclo, participantes, euParticipo, avaliacaoEnviada,
    ativos, liderDe, avaliavelComoLideranca, superioresDe, paresDe, lideradosDe, avaliadoresPossiveis, grupoPequeno, relacaoCom, validarResposta,
    agregar, relatorio360, notificacoes,
  };
});
