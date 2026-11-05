/* =====================================================================================
   FORMULÁRIOS — Solicitação de Contratação (funil 77) e Solicitação de Encerramento de
   Contrato (funil 79), feitas no próprio app desde 04/11/2026
   -------------------------------------------------------------------------------------
   Antes eram formulários CRM do Bitrix (o 259 e o script do console de 03/11/2026). Agora
   o app faz as perguntas e cria o card no funil. No encerramento, também copia para a
   timeline do card o histórico de feedbacks SCI, 1:1 mensais e planos de melhoria do membro.

   As perguntas, a ordem, as dicas e as opções são as dos formulários originais
   (amorim-api/requisicao-vagas-bitrix e amorim-api/offboarding-bitrix). O texto de cada
   opção é o mesmo do campo no Bitrix: o repositório troca o texto pelo ID da opção ao gravar.
   Campo com código UF_CRM_* vai para o card; os outros são só do app.
   Funções puras (Node + navegador): test/formularios.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"),
    raiz.GP && raiz.GP.dominio ? raiz.GP.dominio : require("./50-dominio.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.formularios = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc, dom) {
  "use strict";

  // Opção só do app em "Riscos": a pergunta da Luciele é obrigatória e não tem "nenhum". Marcada, o campo fica vazio no card.
  const NENHUM = "Nenhum desses pontos";
  // Formulário da Luciele: estas justificativas pedem no mínimo 2 registros de feedback estruturado
  const PEDE_DOIS = ["Desempenho abaixo da média", "Incompatibilidade com a função"];

  /* ================================================================ Solicitação de Contratação (funil 77) */
  const NIVEL = ["Baixo", "Médio", "Alto"];
  const VAGA = {
    chave: "vaga",
    nome: "Solicitação de Contratação",
    descricao: "Este formulário tem como objetivo garantir que as solicitações de contratação sejam avaliadas de forma estratégica, estruturada e alinhada às necessidades da empresa. " +
      "Antes do preenchimento, é indispensável que a liderança solicitante realize alinhamento prévio com sua coordenação sobre a necessidade da vaga, escopo da posição, senioridade esperada, perfil comportamental desejado e prioridade da contratação. " +
      "Todas as requisições devem apresentar justificativas claras sobre necessidade operacional, impacto no negócio, urgência da demanda e resultados esperados com a contratação. " +
      "Antes de iniciar, reúna os principais indicadores da área, dados de capacidade operacional, impactos atuais e projeções de demanda relacionadas à posição solicitada.",
    secoes: [
      { titulo: "Identificação da vaga", campos: [
        { codigo: "UF_CRM_RV_DEPTO", rotulo: "Departamento", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_RV_SETOR", rotulo: "Setor", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_RV_LIDER", rotulo: "Liderança solicitante", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_RV_COORD", rotulo: "Coordenação responsável", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_RV_VAGA", rotulo: "Vaga solicitada", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_RV_MODELO", rotulo: "Modelo de trabalho", tipo: "escolha", obrigatorio: true, opcoes: ["Presencial", "Híbrido", "Remoto"] },
        { codigo: "UF_CRM_RV_URGENCIA", rotulo: "Nível de urgência da vaga", tipo: "escolha", obrigatorio: true, empilhado: true, opcoes: [
          "Baixa (Pode aguardar sem impacto relevante para a operação ou resultados da área)",
          "Média (A ausência da contratação gera impactos moderados em produtividade, prazos ou qualidade das entregas)",
          "Alta (A não contratação pode comprometer operações críticas, metas estratégicas, clientes, receita ou gerar risco elevado para a empresa)",
        ] },
        { codigo: "UF_CRM_RV_SENIOR", rotulo: "Nível de senioridade da vaga", tipo: "escolha", obrigatorio: true,
          opcoes: ["Estagiário(a)", "Assistente", "Júnior", "Pleno", "Sênior", "Especialista", "Coordenador(a)", "Outro"] },
        { codigo: "UF_CRM_RV_SENIOR_OUT", rotulo: "Qual outro nível de senioridade?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_RV_SENIOR", igual: "Outro" } },
        { codigo: "UF_CRM_RV_SENIOR_JUS", rotulo: "Por que esta posição precisa deste nível de senioridade?", tipo: "textoLongo", obrigatorio: true,
          ajuda: "Explique complexidade técnica esperada, grau de autonomia necessário, necessidades, comparação com estrutura atual da equipe." },
      ] },
      { titulo: "Justificativa", campos: [
        { codigo: "UF_CRM_RV_DOR", rotulo: "Qual é a principal dor que essa contratação resolve?", tipo: "textoLongo", obrigatorio: true,
          ajuda: "Descreva objetivamente quais dores serão resolvidas com essa contratação." },
        { codigo: "UF_CRM_RV_MOTIVO", rotulo: "A solicitação está relacionada a:", tipo: "escolha", obrigatorio: true,
          opcoes: ["Crescimento de receita", "Aumento de demanda operacional", "Novo projeto estratégico", "Substituição de colaborador", "Outro"] },
        { codigo: "UF_CRM_RV_MOTIVO_OUT", rotulo: "Qual outro motivo?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_RV_MOTIVO", igual: "Outro" } },
        { codigo: "UF_CRM_RV_ALTERN", rotulo: "Antes da solicitação de contratação, quais alternativas foram avaliadas?", tipo: "multi", obrigatorio: true,
          opcoes: ["Redistribuição interna", "Priorização de demandas", "Reestruturação de processos", "Suporte temporário de outro setor", "Automação", "Nenhuma", "Outro"] },
        { codigo: "UF_CRM_RV_ALTERN_OUT", rotulo: "Qual outra alternativa?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_RV_ALTERN", inclui: "Outro" } },
      ] },
      { titulo: "Risco de impacto", texto: "Caso a contratação NÃO aconteça nos próximos 90 dias, classifique o risco de impacto:", campos: [
        { codigo: "riscos", tipo: "grade", colunas: NIVEL, linhas: [
          { codigo: "UF_CRM_RV_RISCO_REC", rotulo: "Perda de receita", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_CLI", rotulo: "Impacto em clientes", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_OPE", rotulo: "Risco operacional", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_PRJ", rotulo: "Atraso em projetos", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_SOB", rotulo: "Sobrecarga da equipe", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_TRN", rotulo: "Turnover", obrigatorio: true },
          { codigo: "UF_CRM_RV_RISCO_OUT", rotulo: "Outro", obrigatorio: false },
        ] },
        { codigo: "UF_CRM_RV_RISCO_DSC", rotulo: "Qual outro risco?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_RV_RISCO_OUT", preenchido: true } },
      ] },
      { titulo: "Perfil da vaga", campos: [
        { codigo: "UF_CRM_RV_ATIVIDADE", rotulo: "Principais atividades, responsabilidades e entregas esperadas no dia a dia da função", tipo: "textoLongo", obrigatorio: true },
        { codigo: "UF_CRM_RV_COMP_TEC", rotulo: "Competências técnicas obrigatórias", tipo: "textoLongo", obrigatorio: true },
        // Opcional, como no formulário 259: quem já está no mapeamento de funções não precisa marcar
        { codigo: "UF_CRM_RV_COMP_COMP", rotulo: "Selecione as competências comportamentais essenciais para o sucesso nesta posição", tipo: "multi", obrigatorio: false,
          ajuda: "Caso essa função já esteja no mapeamento de funções, não há necessidade de preencher.",
          opcoes: ["Comunicação Interpessoal", "Pensamento Analítico", "Influência e Persuasão", "Resolução de Problemas", "Orientação para Execução", "Atenção aos Detalhes",
            "Foco em Resultados", "Visão Estratégica", "Planejamento e Organização", "Tomada de Decisão", "Orientação ao Cliente", "Liderança (quando aplicável)", "Outro"] },
        { codigo: "UF_CRM_RV_COMP_OUT", rotulo: "Qual outra competência?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_RV_COMP_COMP", inclui: "Outro" } },
        { codigo: "UF_CRM_RV_PERFIL", rotulo: "Qual perfil tem as características mais compatíveis com o profissional que desempenhará esta função?", tipo: "escolha", obrigatorio: true, empilhado: true, opcoes: [
          "Executores — ativos, competitivos, otimistas e dinâmicos. Gostam de desafios, liderança e assumir riscos; não gostam de processos lentos e falta de autonomia",
          "Comunicadores — falantes, adaptáveis e ativos. Gostam de falta de rotina, autonomia e trabalho em equipe; não gostam de rigidez, monotonia e falta de reconhecimento",
          "Planejadores — calmos, prudentes e com muito autocontrole. Gostam de rotina, planejamento e ajudar os outros; não gostam de falta de disciplina e improvisos",
          "Analistas — detalhistas, precisos, cautelosos e críticos. Gostam de perfeição, métodos e ambientes calmos; não gostam de pressão, falta de garantia e falta de segurança",
        ] },
        { codigo: "UF_CRM_RV_EXPERIEN", rotulo: "Caso seja necessário experiência, descreva o tempo mínimo", tipo: "texto", obrigatorio: false },
        { codigo: "UF_CRM_RV_FIT", rotulo: "Observações adicionais sobre fit cultural e comportamental", tipo: "textoLongo", obrigatorio: false },
        { codigo: "UF_CRM_RV_DATA_ENT", rotulo: "Data desejada de entrada, em caso de contratação", tipo: "data", obrigatorio: true },
      ] },
    ],
  };

  /* ================================================================ Solicitação de Encerramento de Contrato (funil 79) */
  const ENCERRAMENTO = {
    chave: "encerramento",
    nome: "Solicitação de Encerramento de Contrato",
    descricao: "Este formulário tem como objetivo formalizar as solicitações de desligamento, garantindo o registro das justificativas, o alinhamento entre a liderança e o RH e a adequada documentação do processo. " +
      "As informações preenchidas devem ser claras, objetivas e fundamentadas em fatos e evidências que justifiquem a decisão. " +
      "Atenção: nos casos de desligamento motivados por baixo desempenho ou incompatibilidade com a função, é obrigatória a inclusão de, no mínimo, 2 (dois) registros de feedback estruturado, devidamente documentados e anexados ao formulário. " +
      "Esses registros devem evidenciar os pontos abordados, as orientações fornecidas e as oportunidades de melhoria comunicadas ao membro.",
    secoes: [
      { titulo: "1. Dados da Solicitação", campos: [
        // No formulário original era texto livre; no app, o membro é escolhido na equipe (o nome vai para UF_CRM_OFF_MEMBRO)
        { codigo: "membroId", rotulo: "Profissional a ter contrato encerrado", tipo: "lista", obrigatorio: true },
        { codigo: "UF_CRM_OFF_SETOR", rotulo: "Departamento/Área", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_OFF_SOLICIT", rotulo: "Coordenação e Liderança", tipo: "texto", obrigatorio: true },
        { codigo: "UF_CRM_OFF_CARGO", rotulo: "Cargo e responsabilidades do profissional", tipo: "textoLongo", obrigatorio: true },
        { codigo: "UF_CRM_OFF_DATA_DES", rotulo: "Data limite para o desligamento", tipo: "data", obrigatorio: true, ajuda: "Pelo menos 7 dias a partir de hoje. Evite sextas-feiras." },
      ] },
      { titulo: "2. Justificativa", campos: [
        { codigo: "UF_CRM_OFF_MOTIVO", rotulo: "Marque a justificativa correta", tipo: "escolha", obrigatorio: true, empilhado: true,
          opcoes: ["Desempenho abaixo da média", "Infração ao Código de Ética", "Incompatibilidade com a função", "Otimização de Custos", "Outro"] },
        { codigo: "UF_CRM_OFF_MOT_OUT", rotulo: "Qual outra justificativa?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_OFF_MOTIVO", igual: "Outro" } },
        { codigo: "UF_CRM_OFF_DESCRICAO", rotulo: "Descreva objetivamente os resultados concretos que fundamentam a decisão", tipo: "textoLongo", obrigatorio: true },
        { codigo: "UF_CRM_OFF_FEEDBACKS", rotulo: "Caso trate-se de desempenho ou comportamento, o membro recebeu feedbacks formais sobre os pontos acima?", tipo: "escolha", obrigatorio: true,
          opcoes: ["Sim", "Não", "Não se aplica"] },
        // Os feedbacks SCI do app vão sozinhos para a timeline do card; o anexo fica para o que foi registrado fora do app.
        // A tela preenche o bloco com os feedbacks do membro e a conta dos registros (conferirRegistros).
        { codigo: "registros", tipo: "bloco" },
        { codigo: "UF_CRM_OFF_ANEXOS", rotulo: "Anexe os registros de feedback feitos fora do app", tipo: "arquivo", multiplo: true, obrigatorio: false, se: { campo: "UF_CRM_OFF_FEEDBACKS", igual: "Sim" },
          ajuda: "Desempenho abaixo da média ou incompatibilidade com a função: no mínimo 2 registros de feedback estruturado, contando os feedbacks SCI do app." },
      ] },
      { titulo: "3. Impacto Operacional", campos: [
        { codigo: "UF_CRM_OFF_SUCESSOR", rotulo: "Há sucessor interno para assumir essa função?", tipo: "escolha", obrigatorio: true, opcoes: ["Sim", "Não"] },
        { codigo: "UF_CRM_OFF_REPOSICAO", rotulo: "Será necessária nova contratação?", tipo: "escolha", obrigatorio: true, opcoes: ["Sim", "Não", "Em avaliação"] },
        // No formulário do Bitrix a regra só aceitava uma condição; aqui vale a pergunta inteira: sem sucessor E sem contratação prevista
        { codigo: "UF_CRM_OFF_REDISTRIB", rotulo: "Caso não haja sucessor nem previsão de nova contratação, como as responsabilidades e atividades da função serão redistribuídas?", tipo: "textoLongo", obrigatorio: true,
          se: { todas: [{ campo: "UF_CRM_OFF_SUCESSOR", igual: "Não" }, { campo: "UF_CRM_OFF_REPOSICAO", em: ["Não", "Em avaliação"] }] } },
      ] },
      { titulo: "4. Riscos", campos: [
        { codigo: "UF_CRM_OFF_RISCOS", rotulo: "Existe algum ponto que o RH deva considerar antes do encerramento?", tipo: "multi", obrigatorio: true, exclusivo: NENHUM,
          opcoes: ["Clientes estratégicos", "Projetos críticos", "Questões de saúde", "Comissionamentos pendentes", "Vulnerabilidade psicológica ou social", "Outro", NENHUM] },
        { codigo: "UF_CRM_OFF_RISCO_OUT", rotulo: "Qual outro ponto?", tipo: "texto", obrigatorio: true, se: { campo: "UF_CRM_OFF_RISCOS", inclui: "Outro" } },
        { codigo: "UF_CRM_OFF_OBS", rotulo: "Observações adicionais", tipo: "textoLongo", obrigatorio: false },
      ] },
    ],
  };

  /* ================================================================ regras */
  /** Os campos na ordem do formulário; as linhas da grade de riscos entram como perguntas de escolha */
  function campos(def) {
    const lista = [];
    def.secoes.forEach((s) => s.campos.forEach((c) => {
      if (c.tipo === "grade") c.linhas.forEach((l) => lista.push(Object.assign({ tipo: "escolha", opcoes: c.colunas, grade: c.codigo }, l)));
      else lista.push(c);
    }));
    return lista;
  }
  const vazio = (v) => v === undefined || v === null || v === false || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);

  /** Condição de uma pergunta: {campo, igual} | {campo, inclui} | {campo, em: [...]} | {campo, preenchido} | {todas: [...]} */
  function atende(cond, r) {
    if (!cond) return true;
    if (cond.todas) return cond.todas.every((x) => atende(x, r));
    const v = r[cond.campo];
    if (cond.igual !== undefined) return v === cond.igual;
    if (cond.inclui !== undefined) return Array.isArray(v) && v.indexOf(cond.inclui) >= 0;
    if (cond.em) return cond.em.indexOf(v) >= 0;
    if (cond.preenchido) return !vazio(v);
    return true;
  }
  function visivel(c, r) { return atende(c.se, r); }

  /** Obrigatórias sem resposta, só entre as que aparecem */
  function faltando(def, r) {
    return campos(def).filter((c) => c.obrigatorio && visivel(c, r) && vazio(r[c.codigo])).map((c) => c.codigo);
  }

  /** Respostas -> campos do card ({UF_CRM_...: texto, lista de textos ou data}). Pergunta escondida não vai
      (um "Outro" desmarcado não deixa o texto no card); arquivo e campos só do app também não. */
  function camposDoNegocio(def, r) {
    const f = {};
    campos(def).forEach((c) => {
      if (!/^UF_CRM_/.test(c.codigo) || c.tipo === "arquivo" || !visivel(c, r)) return;
      let v = r[c.codigo];
      if (c.tipo === "multi") v = (Array.isArray(v) ? v : []).filter((x) => x !== NENHUM);
      else if (typeof v === "string") v = v.trim();
      if (!vazio(v)) f[c.codigo] = v;
    });
    return f;
  }

  /** Feedbacks SCI válidos do membro que contam como registro de feedback estruturado (desenvolvimento) */
  function feedbacksDeDesenvolvimento(ctx, membroId) {
    return dom.feedbacksDo(ctx, membroId).filter((f) => calc.ehFeedbackDesenvolvimento(f.tipo));
  }
  /** Regra do formulário da Luciele: desempenho abaixo da média e incompatibilidade com a função pedem no mínimo
      2 registros de feedback estruturado; "recebeu feedbacks formais = Sim" pede ao menos 1. Contam os feedbacks
      SCI de desenvolvimento do app (vão para a timeline do card) e os arquivos anexados. Os de reconhecimento não
      contam: a regra pede registros com os pontos a melhorar. o.reconhecimento: quantos o membro tem (para a mensagem). */
  function conferirRegistros(r, sci, anexos, o) {
    const rec = (o && o.reconhecimento) || 0;
    const motivo = r.UF_CRM_OFF_MOTIVO || "";
    const minimo = PEDE_DOIS.indexOf(motivo) >= 0 ? 2 : r.UF_CRM_OFF_FEEDBACKS === "Sim" ? 1 : 0;
    const total = (sci || 0) + (anexos || 0);
    const conta = (sci === 1 ? "1 feedback SCI de desenvolvimento" : (sci || 0) + " feedbacks SCI de desenvolvimento") + " no app" +
      (anexos ? " e " + (anexos === 1 ? "1 registro anexado" : anexos + " registros anexados") : "");
    const naoContam = rec ? " " + (rec === 1 ? "O feedback SCI de reconhecimento não conta" : "Os " + rec + " feedbacks SCI de reconhecimento não contam") + ": a regra pede registros com os pontos a melhorar." : "";
    let mensagem = "";
    if (total < minimo) {
      mensagem = minimo === 2
        ? "Para \"" + motivo + "\", o RH pede no mínimo 2 registros de feedback estruturado. Há " + conta + "." + naoContam + " Registre os feedbacks SCI de desenvolvimento no app (Feedbacks → Feedback SCI) ou anexe os registros feitos fora dele."
        : "Você marcou que o membro recebeu feedbacks formais. Há " + conta + "." + naoContam + " Anexe os registros ou registre os feedbacks SCI de desenvolvimento no app.";
    }
    return { minimo, total, sci: sci || 0, anexos: anexos || 0, ok: total >= minimo, mensagem };
  }

  /* ================================================================ respostas iniciais (vêm da estrutura do Bitrix) */
  /** Lotação de uma pessoa: o departamento principal, o setor (o primeiro nível abaixo da raiz) e o caminho até ele */
  function lotacao(ctx, uid) {
    const u = dom.pessoa(ctx, uid);
    const principal = dom.deptoPrincipal(ctx.idx.depto, u.departamentos || []);
    const cadeia = [], vistos = {};
    let d = principal ? ctx.idx.depto[principal] : null;
    while (d && !vistos[d.id]) { vistos[d.id] = true; cadeia.unshift(d); d = d.pai ? ctx.idx.depto[d.pai] : null; }
    const abaixo = cadeia.slice(1); // sem a raiz (a empresa)
    return {
      departamento: principal ? ctx.idx.depto[principal].nome : "",
      setor: (abaixo[0] || cadeia[0] || {}).nome || "",
      caminho: abaixo.map((x) => x.nome),
    };
  }
  /** Quem pede a vaga vem do login: o nome, o departamento, o setor e a coordenação pela estrutura */
  function inicialVaga(ctx, uid) {
    const id = String(uid);
    const u = dom.pessoa(ctx, id);
    const l = lotacao(ctx, id);
    const meu = ctx.idx.membroPorUsuario[id];
    let coord = "";
    if (dom.papeis(ctx, id).coordenacao) coord = id;
    else if (meu) coord = dom.coordenacaoEfetiva(ctx, meu);
    else coord = dom.coordenacaoNaEstrutura(ctx.idx.depto, id, u.departamentos || []).id;
    return {
      UF_CRM_RV_DEPTO: l.departamento, UF_CRM_RV_SETOR: l.setor, UF_CRM_RV_LIDER: u.nome,
      UF_CRM_RV_COORD: coord ? dom.pessoa(ctx, coord).nome : "", coordenacaoId: coord || "",
    };
  }
  /** O que o app já sabe do membro escolhido: área, coordenação e liderança, e o cargo do perfil do Bitrix */
  function inicialEncerramento(ctx, membroId) {
    const m0 = ctx.idx.membro[membroId];
    if (!m0) return {};
    const m = dom.infoMembro(ctx, m0);
    const l = lotacao(ctx, m.responsavel);
    const lid = dom.liderancaEfetiva(ctx, m0), coord = dom.coordenacaoEfetiva(ctx, m0);
    const nomes = [];
    if (coord) nomes.push("Coordenação: " + dom.pessoa(ctx, coord).nome);
    if (lid && lid !== coord) nomes.push("Liderança: " + dom.pessoa(ctx, lid).nome);
    return {
      UF_CRM_OFF_SETOR: l.caminho.join(" · ") || l.departamento, UF_CRM_OFF_SOLICIT: nomes.join(" · "),
      UF_CRM_OFF_CARGO: m.cargo || m.funcao || "", nome: m.nome, liderancaId: lid || "", coordenacaoId: coord || "",
    };
  }

  /* ================================================================ histórico para a timeline do card (encerramento) */
  const linhas = (pares) => pares.filter((p) => p[1] && String(p[1]).trim()).map((p) => p[0] + ": " + String(p[1]).trim()).join("\n");
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);
  const faixa = (datas) => {
    const d = datas.filter(Boolean).sort();
    if (!d.length) return "";
    return d.length === 1 ? "em " + calc.fmtDataAno(d[0]) : "de " + calc.fmtDataAno(d[0]) + " a " + calc.fmtDataAno(d[d.length - 1]);
  };
  /** Os comentários que vão para a timeline do card, na ordem de gravação. A timeline mostra o mais novo no alto:
      os planos de melhoria (quando há) ficam embaixo, depois os O2O (só na promoção), os 1:1 mensais, e os feedbacks SCI no alto.
      o = { quem, registradoPor, data, pedido: "na solicitação de ..." (padrão: encerramento de contrato), o2o: inclui os O2O realizados } */
  function historicoEncerramento(ctx, membroId, o) {
    const m = dom.infoMembro(ctx, ctx.idx.membro[membroId] || {});
    const autor = (it) => dom.pessoa(ctx, it.autor || it.criadoPor).nome;
    const origem = "Copiado do app Gestão de Pessoas " + (o.pedido || "na solicitação de encerramento de contrato") + ", enviada por " + o.quem +
      (o.registradoPor ? " (registrado por " + o.registradoPor + ")" : "") + " em " + calc.fmtDataAno(o.data) + ".";
    const textos = [];

    const planos = ((ctx.idx.porMembro.planos || {})[membroId] || []).slice().sort((a, b) => (String(a.inicio) < String(b.inicio) ? 1 : -1));
    if (planos.length) {
      textos.push("[B]Planos de melhoria de " + m.nome + "[/B]\n" + origem + " " + plural(planos.length, "plano.", "planos.") + "\n\n" + planos.map((p) =>
        "[B]Plano de " + calc.fmtDataAno(p.inicio) + " a " + calc.fmtDataAno(p.termino || calc.terminoPlano(p.inicio)) + " · " + (p.estagioNome || p.estagio) + "[/B] · registrado por " + autor(p) + "\n" +
        linhas([["Resultado esperado 1", p.resultado1], ["Check-in do resultado 1", p.checkin1], ["Situação final do resultado 1", p.final1], ["Evidência 1", p.evidencia1],
          ["Resultado esperado 2", p.resultado2], ["Check-in do resultado 2", p.checkin2], ["Situação final do resultado 2", p.final2], ["Evidência 2", p.evidencia2],
          ["Apoio oferecido", p.apoio], [p.checkinData ? "Check-in de " + calc.fmtDataAno(p.checkinData) : "Check-in", p.checkinComentario], ["Adendos", p.adendos]])).join("\n\n"));
    }

    if (o.o2o) {
      const o2o = ((ctx.idx.porMembro.ciclo || {})[membroId] || []).filter((ci) => ci.realizadoEm).sort((a, b) => (a.realizadoEm < b.realizadoEm ? 1 : -1));
      textos.push("[B]O2O de " + m.nome + "[/B]\n" + origem + " " +
        (o2o.length ? plural(o2o.length, "registro", "registros") + ", " + faixa(o2o.map((ci) => ci.realizadoEm)) + "." : "Nenhum O2O registrado no app.") +
        (o2o.length ? "\n\n" + o2o.map((ci) => "[B]" + calc.fmtDataAno(ci.realizadoEm) + " · O2O do " + ((calc.trimestrePorChave(ci.trimestre) || {}).curto || ci.trimestre || "trimestre") + "[/B] · registrado por " + autor(ci) + "\n" +
          linhas([["Temas trazidos pelo membro", ci.temas], ["Objetivo de desenvolvimento", ci.objetivo], ["Próximo nível", ci.proximoNivel], ["Progresso no objetivo", ci.progresso],
            ["Resultados do trimestre", ci.resultados], ["Evidências de crescimento", ci.crescimento], ["Percepções da liderança", ci.percepcoes], ["Pontos de atenção", ci.pontosAtencao]])).join("\n\n") : ""));
    }

    const mensais = dom.temMensal(ctx) ? dom.mensaisDo(ctx, membroId) : [];
    textos.push("[B]1:1 mensais de " + m.nome + "[/B]\n" + origem + " " +
      (mensais.length ? plural(mensais.length, "registro", "registros") + ", " + faixa(mensais.map((r) => r.data)) + "." : "Nenhum 1:1 mensal registrado no app.") +
      (mensais.length ? "\n\n" + mensais.map((r) => "[B]" + calc.fmtDataAno(r.data) + " · 1:1 de " + calc.mesDe(r.data || ctx.hoje).curto + "[/B] · registrado por " + autor(r) + "\n" +
        linhas([["Como o membro está", r.comoEsta], ["Precisa de apoio", r.apoio], ["Principais pontos", r.pontos], ["Combinados", r.combinados], ["Adendos", r.adendos]])).join("\n\n") : ""));

    const sci = dom.feedbacksDo(ctx, membroId);
    const dev = sci.filter((f) => calc.ehFeedbackDesenvolvimento(f.tipo)).length;
    const tipos = [dev ? dev + " de desenvolvimento" : "", sci.length - dev ? (sci.length - dev) + " de reconhecimento" : ""].filter(Boolean).join(" e ");
    textos.push("[B]Feedbacks SCI de " + m.nome + "[/B]\n" + origem + " " +
      (sci.length ? plural(sci.length, "registro", "registros") + ", " + faixa(sci.map((f) => f.data)) + ": " + tipos + "." : "Nenhum feedback SCI registrado no app.") +
      (sci.length ? "\n\n" + sci.map((f) => "[B]" + calc.fmtDataAno(f.data) + " · Feedback de " + String(f.tipo || "").toLowerCase() + "[/B] · registrado por " + autor(f) + (f.retroativo ? " · registro retroativo" : "") + "\n" +
        linhas([["Situação", f.situacao], ["Comportamento", f.comportamento], ["Impacto", f.impacto], ["Combinados", f.combinados], ["Adendos", f.adendos]])).join("\n\n") : ""));
    return textos;
  }

  /* ================================================================ Solicitação de Promoção (05/11/2026) */
  /* Pedido do usuário: "elabore um formulário" (sem modelo do RH). A liderança direta ou a coordenação pede; a
     coordenação e o RH aprovam; o card cai no funil de vagas (77), com os campos UF_CRM_PR_* (20-schema.js). */
  const REMUNERACAO = ["Sim", "Não", "A definir com o RH"];
  const IMPACTO = ["Continuam com a pessoa", "Serão redistribuídas no time", "Será preciso contratar alguém"];
  const CIENTE = ["Não: a conversa fica para depois da aprovação", "Sim, já conversamos"];
  // reserva quando o RH ainda não cadastrou o glossário de competências (Configuração): as da Solicitação de Contratação
  const COMPETENCIAS_PADRAO = ["Comunicação Interpessoal", "Pensamento Analítico", "Influência e Persuasão", "Resolução de Problemas", "Orientação para Execução",
    "Atenção aos Detalhes", "Foco em Resultados", "Visão Estratégica", "Planejamento e Organização", "Tomada de Decisão", "Orientação ao Cliente", "Liderança (quando aplicável)"];
  /** O formulário com as listas da Configuração. o = { niveis: [...], senioridades: [...], competencias: [nomes] } */
  function formPromocao(o) {
    const op = o || {};
    const niveis = (op.niveis || []).filter(Boolean);
    const competencias = (op.competencias || []).filter(Boolean);
    return {
      chave: "promocao",
      nome: "Solicitação de Promoção",
      descricao: "Este formulário formaliza a indicação de um membro para promoção, com os fatos que a sustentam. " +
        "A coordenação e o RH precisam aprovar: quando a liderança direta pede, a coordenação aprova primeiro e depois o RH; quando a própria coordenação pede, vai direto ao RH. " +
        "Use fatos e exemplos: entregas, números e situações observadas. Os feedbacks SCI, os 1:1 mensais e os O2O do membro registrados no app vão junto para o card. " +
        "O app não avisa o membro: a conversa com a pessoa fica com a liderança, depois da aprovação.",
      secoes: [
        { titulo: "1. Membro e posição atual", campos: [
          { codigo: "membroId", rotulo: "Membro indicado", tipo: "lista", obrigatorio: true },
          // a tela preenche com o tempo de casa, a última movimentação e os registros do membro no app
          { codigo: "resumo", tipo: "bloco" },
          { codigo: "UF_CRM_PR_ATUAL", rotulo: "Cargo e área atuais", tipo: "texto", obrigatorio: true, ajuda: "Vem do card do membro. Corrija se estiver desatualizado." },
          { codigo: "UF_CRM_PR_NIVEL_ATU", rotulo: "Nível atual na Arquitetura de Cargos", tipo: "texto", obrigatorio: false, ajuda: "Vem do card do membro." },
        ] },
        { titulo: "2. Proposta", campos: [
          Object.assign({ codigo: "UF_CRM_PR_NIVEL", rotulo: "Nível proposto", obrigatorio: true }, niveis.length ? { tipo: "lista", opcoes: niveis } : { tipo: "texto" }),
          { codigo: "UF_CRM_PR_SENIOR", rotulo: "Senioridade proposta", tipo: "lista", obrigatorio: false, opcoes: op.senioridades || [], ajuda: "Só se a senioridade muda com a promoção." },
          { codigo: "UF_CRM_PR_CARGO", rotulo: "Novo cargo ou função", tipo: "texto", obrigatorio: false, ajuda: "Só se o título do cargo ou a função mudam." },
          { codigo: "UF_CRM_PR_DATA", rotulo: "A partir de quando a promoção deve valer?", tipo: "data", obrigatorio: true, ajuda: "Data sugerida. O RH confirma na aprovação." },
          { codigo: "UF_CRM_PR_REMUN", rotulo: "A promoção vem com reajuste salarial?", tipo: "escolha", obrigatorio: true, opcoes: REMUNERACAO },
          { codigo: "UF_CRM_PR_REAJUSTE", rotulo: "Reajuste sugerido", tipo: "texto", obrigatorio: false, se: { campo: "UF_CRM_PR_REMUN", igual: "Sim" }, ajuda: "Valor ou percentual. O RH confere com a faixa do nível." },
        ] },
        { titulo: "3. Justificativa e evidências", texto: "Fatos e exemplos, não impressões. O RH e a coordenação leem isto junto com o histórico do membro no app.", campos: [
          { codigo: "UF_CRM_PR_MOTIVO", rotulo: "Por que esta pessoa está pronta para a promoção agora?", tipo: "textoLongo", obrigatorio: true },
          { codigo: "UF_CRM_PR_RESULT", rotulo: "Principais resultados e entregas dos últimos 6 a 12 meses", tipo: "textoLongo", obrigatorio: true,
            ajuda: "Metas atingidas, casos ou projetos conduzidos, indicadores, retorno de clientes." },
          { codigo: "UF_CRM_PR_RESPONS", rotulo: "Que responsabilidades do novo nível a pessoa já assume hoje?", tipo: "textoLongo", obrigatorio: true, ajuda: "Exemplos concretos do dia a dia." },
          { codigo: "UF_CRM_PR_COMPET", rotulo: "Competências comportamentais que se destacam", tipo: "multi", obrigatorio: false, opcoes: competencias.length ? competencias : COMPETENCIAS_PADRAO },
          { codigo: "UF_CRM_PR_DESENV", rotulo: "O que a pessoa ainda precisa desenvolver no novo nível, e como você vai apoiar?", tipo: "textoLongo", obrigatorio: true },
        ] },
        { titulo: "4. Impacto e comunicação", campos: [
          { codigo: "UF_CRM_PR_IMPACTO", rotulo: "Como ficam as atividades atuais da pessoa?", tipo: "escolha", obrigatorio: true, empilhado: true, opcoes: IMPACTO },
          { codigo: "UF_CRM_PR_IMPAC_DSC", rotulo: "Conte como fica a operação", tipo: "textoLongo", obrigatorio: true, se: { campo: "UF_CRM_PR_IMPACTO", em: IMPACTO.slice(1) },
            ajuda: "Quem assume o quê e a partir de quando. Se for preciso contratar, abra também a solicitação de vaga." },
          { codigo: "UF_CRM_PR_CIENTE", rotulo: "A pessoa já sabe da indicação?", tipo: "escolha", obrigatorio: true, empilhado: true, opcoes: CIENTE },
          { codigo: "UF_CRM_PR_OBS", rotulo: "Observações", tipo: "textoLongo", obrigatorio: false },
        ] },
      ],
    };
  }
  /** O que o app já sabe do membro: cargo e área, nível e senioridade do card, e a liderança e a coordenação */
  function inicialPromocao(ctx, membroId) {
    const m0 = ctx.idx.membro[membroId];
    if (!m0) return {};
    const m = dom.infoMembro(ctx, m0);
    return {
      UF_CRM_PR_ATUAL: m.funcao || m.cargo || "", UF_CRM_PR_NIVEL_ATU: m.nivel || "",
      nome: m.nome, senioridadeAtual: m.senioridade || "", liderancaId: dom.liderancaEfetiva(ctx, m0) || "", coordenacaoId: dom.coordenacaoEfetiva(ctx, m0) || "",
    };
  }
  /** Meses inteiros entre duas datas AAAA-MM-DD */
  function mesesEntre(de, ate) {
    if (!de || !ate || ate < de) return 0;
    const [a1, m1, d1] = de.split("-").map(Number), [a2, m2, d2] = ate.split("-").map(Number);
    return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  }
  function duracao(meses) {
    const a = Math.floor(meses / 12), m = meses % 12;
    if (!a && !m) return "menos de 1 mês";
    return [a ? plural(a, "ano", "anos") : "", m ? plural(m, "mês", "meses") : ""].filter(Boolean).join(" e ");
  }
  /** O resumo do membro que aparece no formulário (o que vai junto para o card) */
  function resumoPromocao(ctx, membroId) {
    const m0 = ctx.idx.membro[membroId];
    if (!m0) return null;
    const m = dom.infoMembro(ctx, m0);
    const mov = String(m.carreira || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sci = dom.feedbacksDo(ctx, membroId);
    const dev = sci.filter((f) => calc.ehFeedbackDesenvolvimento(f.tipo)).length;
    const o2o = ((ctx.idx.porMembro.ciclo || {})[membroId] || []).filter((ci) => ci.realizadoEm).sort((a, b) => (a.realizadoEm < b.realizadoEm ? 1 : -1));
    const comNivel = o2o.find((ci) => ci.proximoNivel || ci.objetivo);
    return {
      nome: m.nome, ingresso: m.ingresso || "", tempoDeCasa: m.ingresso ? duracao(mesesEntre(m.ingresso, ctx.hoje)) : "",
      ultimaMovimentacao: mov.length ? mov[mov.length - 1] : "",
      feedbacks: sci.length, reconhecimento: sci.length - dev, mensais: dom.temMensal(ctx) ? dom.mensaisDo(ctx, membroId).length : 0, o2o: o2o.length,
      proximoNivel: comNivel ? comNivel.proximoNivel || "" : "", objetivo: comNivel ? comNivel.objetivo || "" : "", progresso: comNivel ? comNivel.progresso || "" : "",
      planoAtivo: !!dom.planoAtivoDo(ctx, membroId),
    };
  }
  const normal = (s) => String(s || "").trim().toLowerCase();
  /** Confere o pedido antes de enviar: o que bloqueia volta em mensagem. o = { niveis, promocoes (dom.promocoes), hoje } */
  function conferirPromocao(ctx, r, o) {
    const op = o || {};
    const ini = inicialPromocao(ctx, r.membroId);
    const aberta = (op.promocoes || []).find((x) => x.membroId === String(r.membroId) && (x.situacao === "coordenacao" || x.situacao === "rh"));
    if (aberta) return { ok: false, mensagem: "Já há uma solicitação de promoção de " + (ini.nome || "este membro") + " em andamento (" + (aberta.situacao === "coordenacao" ? "aguarda a coordenação" : "aguarda o RH") + "). Acompanhe em Recrutamento → Promoções." };
    if (r.UF_CRM_PR_DATA && r.UF_CRM_PR_DATA < (op.hoje || ctx.hoje)) return { ok: false, mensagem: "A data sugerida não pode ficar no passado." };
    const atual = normal(r.UF_CRM_PR_NIVEL_ATU), novo = normal(r.UF_CRM_PR_NIVEL);
    const niveis = (op.niveis || []).map(normal);
    const iA = niveis.indexOf(atual), iN = niveis.indexOf(novo);
    if (iA >= 0 && iN >= 0 && iN < iA) return { ok: false, mensagem: "O nível proposto fica abaixo do atual na Arquitetura de Cargos. Para uma promoção, escolha um nível acima." };
    const mudaSenioridade = r.UF_CRM_PR_SENIOR && normal(r.UF_CRM_PR_SENIOR) !== normal(ini.senioridadeAtual);
    if (novo && novo === atual && !normal(r.UF_CRM_PR_CARGO) && !mudaSenioridade) return { ok: false, mensagem: "Nada muda na proposta: o nível proposto é o atual. Escolha um nível acima, uma nova senioridade ou um novo cargo." };
    return { ok: true, mensagem: "" };
  }
  /** Respostas -> campos do card. As várias escolhas vão como texto, porque os campos da promoção não são listas. */
  function camposDaPromocao(def, r) {
    const f = camposDoNegocio(def, r);
    Object.keys(f).forEach((k) => { if (Array.isArray(f[k])) f[k] = f[k].join("; "); });
    return f;
  }
  /** O pedido inteiro como comentário da timeline do card (o RH lê ali, mesmo sem as seções no layout do card).
      o = { nome, quem, papel, registradoPor, data, aprovacao: texto de quem aprova } */
  function textoPedidoPromocao(def, r, o) {
    const valor = (c) => {
      const v = r[c.codigo];
      if (Array.isArray(v)) return v.filter((x) => x !== NENHUM).join("; ");
      if (c.tipo === "data") return v ? calc.fmtDataAno(v) : "";
      return String(v || "").trim();
    };
    const rotulo = (c) => (/\?$/.test(c.rotulo) ? c.rotulo : c.rotulo + ":");
    const secoes = def.secoes.map((s) => {
      const itens = s.campos.filter((c) => /^UF_CRM_/.test(c.codigo) && visivel(c, r) && valor(c))
        .map((c) => rotulo(c) + (c.tipo === "textoLongo" ? "\n" : " ") + valor(c));
      return itens.length ? "[B]" + s.titulo + "[/B]\n" + itens.join("\n") : "";
    }).filter(Boolean);
    return "[B]Solicitação de promoção de " + o.nome + "[/B]\nEnviada por " + o.quem + (o.papel ? " (" + o.papel.toLowerCase() + ")" : "") + " em " + calc.fmtDataAno(o.data) +
      ", pelo app Gestão de Pessoas" + (o.registradoPor ? " (registrado por " + o.registradoPor + ")" : "") + "." + (o.aprovacao ? "\nAprovação: " + o.aprovacao + "." : "") +
      "\n\n" + secoes.join("\n\n");
  }
  /** O histórico do membro para a timeline do card da promoção: planos de melhoria, O2O, 1:1 mensais e feedbacks SCI */
  function historicoPromocao(ctx, membroId, o) {
    return historicoEncerramento(ctx, membroId, Object.assign({ pedido: "na solicitação de promoção", o2o: true }, o));
  }
  /** A linha da movimentação na aba Carreira do membro, no formato de lá ("AAAA-MM-DD · de um nível para outro") */
  function linhaCarreira(o) {
    const de = o.de || "nível não registrado";
    return o.vigencia + " · de " + de + " para " + o.para + (o.cargo ? " (" + o.cargo + ")" : "") + " · promoção aprovada pelo RH";
  }

  /* ================================================================ o card como a tela lê (sem recarregar) */
  /** O card recém-criado no formato do crm.deal.list (listas com o texto da opção), para entrar na lista da tela.
      o = { id, titulo, estagio, agora, campos, origem } */
  function negocioLocal(o) {
    return Object.assign({ ID: String(o.id), TITLE: o.titulo, STAGE_ID: o.estagio, DATE_CREATE: o.agora, DATE_MODIFY: o.agora },
      o.origem ? { ORIGINATOR_ID: o.origem.sistema, ORIGIN_ID: String(o.origem.id) } : {}, o.campos || {});
  }

  return {
    NENHUM, PEDE_DOIS, VAGA, ENCERRAMENTO,
    campos, atende, visivel, faltando, camposDoNegocio, feedbacksDeDesenvolvimento, conferirRegistros,
    lotacao, inicialVaga, inicialEncerramento, historicoEncerramento, negocioLocal,
    REMUNERACAO, IMPACTO, CIENTE, COMPETENCIAS_PADRAO, formPromocao, inicialPromocao, resumoPromocao, conferirPromocao, camposDaPromocao, textoPedidoPromocao,
    historicoPromocao, linhaCarreira, mesesEntre, duracao,
  };
});
