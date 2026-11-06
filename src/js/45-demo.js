/* =====================================================================================
   DEMONSTRAÇÃO — mesma interface do repositório Bitrix, com dados em memória
   -------------------------------------------------------------------------------------
   Usada quando o app abre fora do Bitrix (navegador) e nos testes. Reproduz os 6 casos
   do protótipo (Ana, Bruno, Daniela, Eduardo, Fernanda e Gustavo) com "hoje" em
   08/10/2026, para os números baterem com a coluna "Exemplo" da seção 4.5.
   Nada é gravado: recarregar a página volta ao estado inicial.
   Parâmetros de URL: ?papel=lideranca|coordenacao|rh|ceo  ?hoje=AAAA-MM-DD
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.schema ? raiz.GP.schema : require("./20-schema.js"),
    raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.demo = m; }
})(typeof window !== "undefined" ? window : globalThis, function (schema, calc) {
  "use strict";

  const HOJE_PADRAO = "2026-10-08";
  // membro: quem não lidera ninguém entra só em Férias e ausências e no Perfil (04/11/2026)
  const PAPEL_USUARIO = { lideranca: "3", coordenacao: "2", rh: "6", ceo: "1", membro: "100" };

  function dadosDemo() {
    const U = (id, nome, deptos, aniversario, cargo, registro) => ({
      registro: registro || "2021-03-01", tipo: "employee", estado: "", cidade: "",
      id, nome, foto: "", email: nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".") + "@amorimglobal.com",
      cargo: cargo || "", departamentos: deptos, aniversario: aniversario || "",
    });
    const usuarios = [
      U("1", "Beatriz Amorim", ["1"], "03-08", "CEO"),
      U("2", "Livia Prado", ["10"], "07-19", "Coordenação Negócios e Investimentos e Famílias e Sucessões"),
      U("3", "Carla Mendes", ["11"], "11-12", "Liderança Imigração"),
      U("4", "Marcos Lima", ["12"], "02-27", "Liderança Tributário"),
      U("5", "Rafael Souza", ["13"], "05-30", "Liderança Negócios e Investimentos"),
      U("6", "Helena Costa", ["30"], "09-02", "Gestão de Pessoas"),
      U("100", "Ana Ribeiro", ["11"], "10-21", "Analista de Imigração"),
      U("101", "Bruno Teixeira", ["11"], "11-03", "Analista de Imigração"),
      U("102", "Daniela Rocha", ["11"], "10-19", "Analista de Imigração"),
      U("103", "Eduardo Martins", ["11"], "12-30", "Analista de Imigração"),
      U("104", "Fernanda Alves", ["11"], "01-15", "Estagiária de Imigração"),
      U("105", "Gustavo Pereira", ["11"], "10-28", "Analista de Imigração"),
      U("110", "Igor Santos", ["12"], "04-11"), U("111", "Júlia Freitas", ["12"], "08-05"), U("112", "Kátia Moraes", ["12"], "06-21"),
      U("120", "Leonardo Dias", ["13"], "03-14"), U("121", "Mariana Castro", ["13"], "09-09"),
      U("122", "Nina Barbosa", ["13"], "12-01"), U("123", "Otávio Ramos", ["13"], "01-29"),
    ];
    const departamentos = [
      { id: "1", nome: "Amorim", pai: "", chefe: "1" },
      { id: "10", nome: "Soluções", pai: "1", chefe: "2" },
      { id: "11", nome: "Imigração", pai: "10", chefe: "3" },
      { id: "12", nome: "Tributário", pai: "10", chefe: "4" },
      { id: "13", nome: "Negócios e Investimentos", pai: "10", chefe: "5" },
      { id: "30", nome: "Financeiro e RH", pai: "1", chefe: "6" },
    ];

    // config no mesmo formato do provisionamento (ids fictícios)
    const config = { versao: 1, processos: {}, demo: true };
    schema.PROCESSOS.forEach((p, i) => {
      const eti = 1200 + i * 2, typeId = 60 + i * 2;
      const estagios = {};
      p.estagios.forEach((e) => { estagios[e.codigo] = "DT" + eti + "_9:" + e.codigo; });
      config.processos[p.chave] = { entityTypeId: eti, typeId, categoriaId: 9, campoPai: p.pai ? "parentId" + (p.pai === "negocio" ? 2 : 1200) : null, estagios };
    });
    Object.assign(config, {
      papeis: {
        coordenacao: [{ id: "2", nome: "Livia Prado" }],
        rh: [{ id: "6", nome: "Helena Costa" }],
        ceo: [{ id: "1", nome: "Beatriz Amorim" }],
      },
      niveis: ["Assistente", "Analista I", "Analista II", "Analista III", "Especialista", "Coordenação"],
      feriadosLocais: {
        SP: [
          { data: "2026-01-25", nome: "Aniversário de São Paulo" }, { data: "2026-06-04", nome: "Corpus Christi (São Paulo)" },
          { data: "2026-07-09", nome: "Revolução Constitucionalista (SP)" }, { data: "2027-01-25", nome: "Aniversário de São Paulo" },
        ],
        BA: [
          { data: "2026-06-24", nome: "São João (Salvador)" }, { data: "2026-07-02", nome: "Independência da Bahia" },
          { data: "2026-12-08", nome: "Nossa Senhora da Conceição da Praia (Salvador)" },
        ],
      },
      links: {
        manual: "https://drive.google.com/file/d/1fZNxcYlnxcGshaoWlYZ9pjLljZOVkqcL/view",
        baseConhecimento: "", guiaOnboarding: "", guiaOffboarding: "", modelosSCI: "",
      },
      recrutamento: { categoria: 77 },
      offboarding: { categoria: 79 },
      // glossário de exemplo: o do RH entra em Configuração (reunião de 29/10/2026)
      competencias: [
        { nome: "Comunicação clara", descricao: "Explica o andamento e os riscos sem precisar ser cobrado." },
        { nome: "Organização", descricao: "Mantém a própria fila de casos em ordem de prazo." },
        { nome: "Atenção aos detalhes", descricao: "Confere documentos e números antes de enviar." },
        { nome: "Colaboração", descricao: "Pede e oferece ajuda à equipe no tempo certo." },
        { nome: "Autonomia", descricao: "Resolve o que está no seu escopo e traz proposta para o que não está." },
      ],
    });

    /* ---------- registros ---------- */
    const seq = { n: 0 };
    const reg = {};
    schema.PROCESSOS.forEach((p) => { reg[p.chave] = []; });
    function vazio(chave) {
      const p = schema.processo(chave), o = {};
      p.campos.forEach((d) => {
        o[d.chave] = d.tipo === "simNao" ? false : d.tipo === "arquivo" ? [] : d.tipo === "numero" ? null : "";
      });
      return o;
    }
    function add(chave, base) {
      const p = schema.processo(chave);
      const id = base.id || String(++seq.n + 500);
      const estagio = base.estagio || "NEW";
      const e = p.estagios.find((x) => x.codigo === estagio);
      const o = Object.assign(vazio(chave), {
        id, titulo: "", estagio, estagioNome: e ? e.nome : estagio, stageId: config.processos[chave].estagios[estagio],
        criadoEm: "2026-01-01T10:00:00-03:00", atualizadoEm: "", criadoPor: "6", responsavel: "", membroId: "",
      }, base);
      o.estagioNome = (p.estagios.find((x) => x.codigo === o.estagio) || {}).nome || o.estagio;
      reg[chave].push(o);
      return o;
    }
    const nomeDe = (uid) => (usuarios.find((u) => u.id === uid) || {}).nome || "";
    const membro = (id, uid, lid, coord, est, extra) => add("membros", Object.assign({
      id, titulo: nomeDe(uid), responsavel: uid, estagio: est, lideranca: lid, coordenacao: coord, contrato: "Associado",
      cidade: "São Paulo (SP)",
    }, extra));

    membro("1", "100", "3", "2", "ATIVO", { funcao: "Imigração · Analista", ingresso: "2024-03-11", nivel: "Analista II", senioridade: "Pleno", carreira: "2025-12-15 · de Analista I para Analista II" });
    membro("2", "101", "3", "2", "ATIVO", { funcao: "Imigração · Analista", ingresso: "2023-05-02", nivel: "Analista I", senioridade: "Júnior" });
    membro("3", "102", "3", "2", "NEW", { funcao: "Imigração · Analista", ingresso: "2026-08-27", nivel: "Analista I", senioridade: "Júnior", cidade: "Salvador (BA)" });
    membro("4", "103", "3", "2", "ATIVO", { funcao: "Imigração · Analista", ingresso: "2022-01-10", nivel: "Analista II", senioridade: "Pleno" });
    membro("5", "104", "3", "2", "EM_ENCERRAMENTO", { funcao: "Imigração · Estágio", ingresso: "2025-10-20", contrato: "Estágio", nivel: "Assistente", senioridade: "Estagiário" });
    membro("6", "105", "3", "2", "NEW", { funcao: "Imigração · Analista", ingresso: "2026-10-06", nivel: "Analista II", senioridade: "Pleno", planejamentoId: "90" });
    membro("7", "110", "4", "2", "ATIVO", { funcao: "Tributário · Analista", ingresso: "2021-02-01", nivel: "Analista III", senioridade: "Sênior" });
    membro("8", "111", "4", "2", "ATIVO", { funcao: "Tributário · Analista", ingresso: "2024-06-03", nivel: "Analista I", senioridade: "Júnior" });
    membro("9", "112", "4", "2", "ATIVO", { funcao: "Tributário · Analista", ingresso: "2023-09-11", nivel: "Analista II", senioridade: "Pleno" });
    membro("10", "120", "5", "2", "ATIVO", { funcao: "Negócios · Analista", ingresso: "2022-08-01", nivel: "Analista II", senioridade: "Pleno" });
    membro("11", "121", "5", "2", "ATIVO", { funcao: "Negócios · Analista", ingresso: "2023-03-06", nivel: "Analista I", senioridade: "Júnior" });
    membro("12", "122", "5", "2", "ATIVO", { funcao: "Negócios · Analista", ingresso: "2020-11-16", nivel: "Especialista", senioridade: "Sênior" });
    membro("13", "123", "5", "2", "ATIVO", { funcao: "Negócios · Analista", ingresso: "2025-01-13", nivel: "Analista I", senioridade: "Júnior" });
    // Saídas anteriores (item em Encerrado; o usuário já foi desativado no Bitrix): o histórico do offboarding
    const saida = (id, uid, nome, lid, quando) => add("membros", { id, titulo: nome, responsavel: uid, estagio: "SUCCESS", lideranca: lid, coordenacao: "2", contrato: "Associado", movidoEm: quando + "T18:00:00-03:00", atualizadoEm: quando + "T18:00:00-03:00" });
    saida("20", "190", "Paulo Viana", "4", "2026-08-29");
    saida("21", "191", "Clara Neves", "3", "2026-03-31");
    saida("22", "192", "Sérgio Lopes", "5", "2025-11-14");

    /* 1:1 mensais (conversa breve do mês) */
    const mensal = (mid, resp, data, autor, extra) => add("mensal", Object.assign({
      titulo: "1:1 de " + calc.mesDe(data).curto + " · " + nomeDe(resp), membroId: mid, responsavel: resp, data, autor, estagio: "NEW", criadoEm: data + "T17:00:00-03:00",
      comoEsta: "Bem, com a carga do mês organizada.", apoio: "", pontos: "Andamento dos casos do mês e prioridades da semana.", combinados: "",
    }, extra));
    mensal("1", "100", "2026-09-10", "3", { apoio: "Quer acompanhar uma reunião de cliente com a liderança." });
    mensal("1", "100", "2026-10-06", "3", { pontos: "Preparação para o O2O do trimestre e os casos de cidadania.", combinados: "Trazer 2 temas para o O2O de 14/10." });
    mensal("2", "101", "2026-09-17", "3");
    mensal("4", "103", "2026-09-24", "3", { comoEsta: "Mais tranquilo depois do check-in do plano.", pontos: "Fila de pareceres e tempo de resposta." });
    ["10", "11", "12", "13"].forEach((mid, i) => mensal(mid, String(120 + i), "2026-09-" + String(8 + i * 3).padStart(2, "0"), "5"));
    mensal("10", "120", "2026-10-02", "5");
    mensal("12", "122", "2026-10-05", "5");

    /* Ciclo trimestral */
    const T3 = { trimestre: "2026-T3", fimTrimestre: "2026-09-30", prazoEvidencias: "2026-10-15", criadoEm: "2026-07-01T09:00:00-03:00" };
    const T4 = { trimestre: "2026-T4", fimTrimestre: "2026-12-31", prazoEvidencias: "2027-01-15", criadoEm: "2026-10-01T09:00:00-03:00" };
    const ciclo = (mid, resp, t, est, extra) => add("ciclo", Object.assign({ titulo: nomeDe(resp) + " · " + t.trimestre, membroId: mid, responsavel: resp, autor: "", estagio: est }, t, extra));
    const fechado = (data, classif, lid) => ({
      registroEvidEm: calc.addDias(calc.trimestreDe(data).fim, 6) + "T11:00:00-03:00",
      realizadoEm: data, registro1a1Em: data + "T16:00:00-03:00", objetivo: "Ganhar autonomia nos casos de maior complexidade da carteira.",
      proximoNivel: "Analista III", progresso: "Em andamento", comb1Texto: "Conduzir um caso completo com revisão só no fechamento", comb1Resp: "Membro", comb1Prazo: "2026-09-30",
      resultados: "Entregas do trimestre dentro dos prazos combinados, com 1 ajuste de formato.", crescimento: "Passou a organizar a própria fila de casos por prazo legal.",
      classificacao: classif, autor: lid,
    });
    ciclo("1", "100", T4, "AGENDADO", { data1a1: "2026-10-14", link1a1: "14h · Google Meet", objetivo: "Conduzir sozinha os pedidos de cidadania por descendência.", proximoNivel: "Analista III" });
    ciclo("1", "100", T3, "REALIZADO", {
      realizadoEm: "2026-08-12", registro1a1Em: "2026-08-12T15:00:00-03:00", autor: "3",
      temas: "Quer entender o caminho para Analista III e pediu mais casos de cidadania.",
      objetivo: "Conduzir sozinha os pedidos de cidadania por descendência.", proximoNivel: "Analista III", progresso: "Em andamento",
      retorno: "Pediu retorno mais rápido nas revisões de requerimento.",
      comb1Texto: "Assumir 2 casos completos de cidadania", comb1Resp: "Membro", comb1Prazo: "2026-09-30",
      comb2Texto: "Revisar os modelos de requerimento com a supervisão", comb2Resp: "Liderança", comb2Prazo: "2026-09-15",
    });
    ciclo("1", "100", { trimestre: "2026-T2", fimTrimestre: "2026-06-30", prazoEvidencias: "2026-07-15", criadoEm: "2026-04-01T09:00:00-03:00" }, "SUCCESS", fechado("2026-05-14", "Dentro do esperado", "3"));
    ciclo("1", "100", { trimestre: "2026-T1", fimTrimestre: "2026-03-31", prazoEvidencias: "2026-04-15", criadoEm: "2026-01-02T09:00:00-03:00" }, "SUCCESS", fechado("2026-02-19", "Acima do esperado", "3"));
    ciclo("2", "101", T4, "SEM_AGENDA", {});
    ciclo("2", "101", T3, "SUCCESS", fechado("2026-07-22", "Dentro do esperado", "3"));
    ciclo("4", "103", T4, "AGENDADO", { data1a1: "2026-10-20", link1a1: "10h · sala 3" });
    ciclo("4", "103", T3, "SUCCESS", fechado("2026-07-28", "Com ajuste", "3"));
    ciclo("5", "104", T4, "NEW", {});
    ciclo("5", "104", T3, "SUCCESS", fechado("2026-08-04", "Dentro do esperado", "3"));
    ciclo("7", "110", T4, "AGENDADO", { data1a1: "2026-10-09" });
    ciclo("7", "110", T3, "SUCCESS", fechado("2026-08-18", "Acima do esperado", "4"));
    ciclo("8", "111", T4, "SEM_AGENDA", {});
    ciclo("8", "111", T3, "REALIZADO", { realizadoEm: "2026-08-25", registro1a1Em: "2026-08-25T10:00:00-03:00", autor: "4" });
    ciclo("9", "112", T4, "SEM_AGENDA", {});
    ciclo("9", "112", T3, "REALIZADO", { realizadoEm: "2026-09-02", registro1a1Em: "2026-09-02T10:00:00-03:00", autor: "4" });
    ["10", "11", "12", "13"].forEach((mid, i) => {
      const uid = String(120 + i);
      ciclo(mid, uid, T4, "AGENDADO", { data1a1: "2026-10-" + String(13 + i).padStart(2, "0") });
      ciclo(mid, uid, T3, "SUCCESS", fechado("2026-08-0" + (3 + i), "Dentro do esperado", "5"));
    });

    /* Feedbacks SCI */
    const fb = (mid, resp, data, tipo, autor, extra) => add("feedbacks", Object.assign({
      titulo: tipo + " · " + nomeDe(resp), membroId: mid, responsavel: resp, data, tipo, autor,
      estagio: "SUCCESS", criadoEm: data + "T17:30:00-03:00",
      situacao: "Na entrega de " + calc.fmtData(data) + ".", comportamento: "Organizou as pendências do caso e avisou o cliente antes do prazo.",
      impacto: "O cliente recebeu a resposta sem precisar cobrar.",
    }, extra));
    fb("1", "100", "2026-10-02", "Reconhecimento", "3", {
      situacao: "No protocolo do pedido de cidadania da família Rossi, em 01/10.",
      comportamento: "Revisou toda a documentação antes do envio e encontrou duas certidões com grafia divergente.",
      impacto: "O pedido foi protocolado sem exigência, e o prazo do cliente foi mantido.",
    });
    fb("1", "100", "2026-07-20", "Desenvolvimento", "3", { comportamento: "Enviou o requerimento sem a revisão da supervisão.", impacto: "O caso voltou com exigência e atrasou 5 dias.", combinados: "Toda petição passa pela revisão da supervisão antes do protocolo." });
    fb("2", "101", "2026-09-15", "Reconhecimento", "3");
    const fbAbertura = fb("4", "103", "2026-08-31", "Abertura de plano", "3", {
      id: "70", situacao: "Nas entregas de julho e agosto da carteira tributária.",
      comportamento: "4 de 6 pareceres voltaram para ajuste e o tempo de resposta aos clientes passou de 5 dias.",
      impacto: "Dois clientes cobraram retorno e um parecer saiu fora do prazo combinado.",
      combinados: "Plano de alinhamento de resultados de 60 dias, com check-in no Dia 30.", planoId: "80",
    });
    fb("5", "104", "2026-10-07", "Reconhecimento", "3", { estagio: "NEW", criadoEm: "2026-10-07T18:10:00-03:00" });
    fb("7", "110", "2026-06-10", "Desenvolvimento", "4");
    fb("8", "111", "2026-09-01", "Desenvolvimento", "4");
    fb("9", "112", "2026-08-20", "Desenvolvimento", "4");
    fb("9", "112", "2026-09-28", "Desenvolvimento", "4");
    fb("10", "120", "2026-09-10", "Reconhecimento", "5");
    fb("11", "121", "2026-09-22", "Desenvolvimento", "5");
    fb("12", "122", "2026-10-01", "Reconhecimento", "5");
    fb("13", "123", "2026-08-15", "Reconhecimento", "5");

    /* Plano de alinhamento (Eduardo, desde 31/08) */
    add("planos", {
      id: "80", titulo: "Plano · Eduardo Martins", membroId: "4", responsavel: "103", estagio: "CHECKIN_OK", autor: "3",
      criadoEm: "2026-08-31T18:00:00-03:00", feedbackAberturaId: fbAbertura.id,
      inicio: "2026-08-31", termino: calc.terminoPlano("2026-08-31"),
      resultado1: "Responder os clientes da carteira em até 2 dias úteis.", evidencia1: "Relatório de atendimento do CRM, semanal.",
      resultado2: "Entregar os pareceres revisados já na primeira versão (no máximo 1 ajuste por parecer).", evidencia2: "Leitura das entregas ligadas ao plano.",
      apoio: "Revisão semanal da fila com a liderança e modelo de parecer atualizado pela supervisão.",
      checkin1: "Em evolução", checkin2: "Atingido", checkinData: "2026-09-29",
      checkinComentario: "Tempo de resposta caiu para 3 dias. Os dois últimos pareceres vieram sem ajuste.",
    });

    /* Encerramento (Fernanda, fim do contrato de estágio) */
    add("encerramentos", {
      titulo: "Encerramento · Fernanda Alves", membroId: "5", responsavel: "104", estagio: "ENVIADA_RH", criadoEm: "2026-10-05T11:00:00-03:00",
      motivo: "Fim do prazo previsto no contrato", origem: "Formulário da coordenação", solicitante: "2", coordenacao: "2", autor: "2",
      descricao: "Contrato de estágio termina em 23/10/2026.", justificativa: "O contrato de estágio termina em 23/10 e a área não tem posição de efetivação neste semestre.",
      dataDesejada: "2026-10-23", reposicao: "Sem reposição", apoioRH: "Sim", primeiraVerificacao: "Aceita na 1ª verificação", enviadaRHEm: "2026-10-05",
    });

    /* Férias e ausências (05/11/2026): pedidos feitos no app (com "regras lidas"), que o RH aprova e a liderança confirma,
       e ausências que o RH (Helena) registrou direto, combinadas fora do app */
    const pedido = (resp, lid, base) => add("ferias", Object.assign({ titulo: base.tipo + " · " + nomeDe(resp), responsavel: resp, lideranca: lid, autor: resp,
      regrasLidasEm: base.criadoEm }, base));
    const ausencia = (resp, lid, base) => add("ferias", Object.assign({ titulo: base.tipo + " · " + nomeDe(resp), responsavel: resp, lideranca: lid, autor: "6",
      estagio: "SUCCESS", rhDecisao: "Aprovada", rhEm: base.criadoEm }, base));
    // a Ana pediu férias ontem: aguarda o RH
    pedido("100", "3", { id: "300", tipo: "Férias", inicio: "2026-12-07", fim: "2026-12-21", dias: 15, estagio: "NEW", criadoEm: "2026-10-07T09:30:00-03:00",
      cobertura: "Bruno acompanha os protocolos da carteira; os casos novos esperam a volta.", emailEnviadoEm: "2026-10-07T09:35:00-03:00" });
    // o Bruno pediu o day off de aniversário: o RH aprovou, falta a confirmação da Carla
    pedido("101", "3", { id: "301", tipo: "Day off", motivoDayOff: "Aniversário", inicio: "2026-11-13", fim: "2026-11-13", dias: 1, estagio: "AG_LIDERANCA", criadoEm: "2026-10-05T16:00:00-03:00",
      rhDecisao: "Aprovada", rhEm: "2026-10-07T15:00:00-03:00", rhComentario: "Dentro do mês do aniversário." });
    ausencia("110", "4", { id: "302", tipo: "Férias", inicio: "2026-10-19", fim: "2026-11-02", dias: 15, criadoEm: "2026-08-12T09:00:00-03:00",
      justificativa: "Júlia assume a carteira tributária." });
    // registradas há mais de 30 dias (fora do sino): são as ausências da agenda da equipe da Carla
    const antiga = (resp, lid, id, tipo, inicio, fim) => ausencia(resp, lid, { id, tipo, inicio, fim, dias: calc.diffDias(inicio, fim) + 1, criadoEm: "2026-08-05T10:00:00-03:00" });
    antiga("101", "3", "310", "Pausa contratual", "2026-10-13", "2026-10-16");
    antiga("102", "3", "311", "Pausa contratual", "2026-11-09", "2026-11-13");
    antiga("3", "2", "312", "Férias", "2026-12-26", "2027-01-02");
    antiga("105", "3", "313", "Férias", "2026-12-28", "2027-01-05");
    antiga("103", "3", "314", "Pausa contratual", "2026-12-30", "2027-01-01");
    // a Júlia pediu uma pausa e cancelou: fica fora da agenda
    pedido("111", "4", { id: "303", tipo: "Pausa contratual", inicio: "2026-11-23", fim: "2026-11-27", dias: 5, estagio: "FAIL", criadoEm: "2026-09-20T10:00:00-03:00",
      justificativa: "Mudança de cidade.", cobertura: "Kátia cobre os pareceres.", canceladaEm: "2026-09-22T10:00:00-03:00" });

    /* Revisões semanais (o alinhamento pelo WhatsApp, guardado pela rotina das 6h) */
    const P1 = "1. Sua semana — Como foi a sua semana? Conte as principais atividades e entregas, o que funcionou bem e qual foi a maior dificuldade que você enfrentou.\n";
    const P2 = "\n\n2. Casos sensíveis — Teve algum caso sensível ou delicado nesta semana, que exigiu atenção especial ou a intervenção da liderança?\n";
    const P3 = "\n\n3. Pontos de atenção — Existe algum gargalo, risco ou situação que precisa de acompanhamento?\n";
    const P4 = "\n\n4. Próxima semana — Quais são as suas prioridades para a próxima semana?\n";
    const revisao = (mid, resp, semana, respostas, n) => add("semanal", {
      titulo: "Revisão semanal · " + nomeDe(resp) + " · " + calc.fmtData(calc.addDias(semana, -4)) + " a " + calc.fmtData(semana),
      membroId: mid, responsavel: resp, semana, papel: "Membro", respostas, respondidas: n, estagio: "NEW",
      guardadaEm: calc.addDias(semana, 1) + "T06:00:00-03:00", criadoEm: calc.addDias(semana, 1) + "T06:00:00-03:00", origem: "liderado:demo-" + resp + ":" + semana,
    });
    revisao("1", "100", "2026-09-25", P1 + "Fechei os três protocolos de visto da carteira e atualizei o checklist de documentos. A maior dificuldade foi a demora do consulado em um dos casos." +
      P2 + "Não." + P3 + "O prazo do caso da família Souza depende de um documento do cliente." + P4 + "Protocolar os dois pedidos de cidadania e revisar o modelo de parecer.", 4);
    revisao("1", "100", "2026-10-02", P1 + "Protocolei os dois pedidos de cidadania e entreguei o parecer revisado na primeira versão." +
      P2 + "Um cliente ficou muito ansioso com o prazo; pedi apoio da Carla para a ligação." + P3 + "Nenhum novo." + P4 + "Atender a fila de dúvidas dos clientes e preparar a auditoria de documentos.", 4);
    revisao("2", "101", "2026-10-02", P1 + "Semana de muitas reuniões com clientes; consegui fechar o relatório mensal." + P3 + "Preciso de acesso ao sistema do cartório para agilizar as certidões." +
      P4 + "Fechar as certidões pendentes.", 3);

    /* Onboarding */
    add("onboarding", {
      id: "60", titulo: "Onboarding · Daniela Rocha", membroId: "3", responsavel: "102", estagio: "IMERSAO", criadoEm: "2026-08-20T10:00:00-03:00",
      ingresso: "2026-08-27", senioridade: "Júnior", supervisao: "100", colega: "103", planejamentoId: "90",
      fichaEscopo: "Atendimento dos pedidos de cidadania e vistos da carteira de Salvador.", fichaPadroes: "Checklist de documentos completo antes de cada protocolo.",
      fichaIndicadores: "Protocolos sem exigência; prazo de resposta ao cliente.",
      entregasAncoragem: "Triagem de documentos de 2 processos; checklist de requerimento.", entregasImersao: "Dossiê completo; parecer de elegibilidade; 1 atendimento acompanhado.",
      entregasMarAberto: "Carteira de 6 casos no volume regular.", fichaEm: "2026-08-26", fichaEnviadaEm: "2026-08-26T18:20:00-03:00", entregasPlanejadasEm: "2026-09-10",
      al1Data: "2026-09-25", al1Nota: 85, al1Resultado: "Dentro do esperado",
      al1Retorno: "Feedback de reconhecimento: a triagem chegou completa nas duas entregas.", al1Combinados: "Na Imersão, assumir o dossiê completo com revisão da supervisão.", autor: "3",
    });
    add("onboarding", {
      id: "61", titulo: "Onboarding · Gustavo Pereira", membroId: "6", responsavel: "105", estagio: "NEW", criadoEm: "2026-09-29T10:00:00-03:00",
      ingresso: "2026-10-06", senioridade: "Pleno", supervisao: "", colega: "100", planejamentoId: "90",
    });

    /* Leituras de entrega */
    const leit = (mid, resp, titulo, extra) => add("leituras", Object.assign({ titulo, membroId: mid, responsavel: resp }, extra));
    leit("3", "102", "Triagem de documentos de 2 processos", { origem: "Onboarding", fase: "Ancoragem", onboardingId: "60", trimestre: "2026-T3", concluidaEm: "2026-09-16", prazoTarefa: "2026-09-17", noPrazo: "Sim", leitura: "Conforme", lidaEm: "2026-09-18", prazoLeitura: "2026-09-23", estagio: "SUCCESS", autor: "3" });
    leit("3", "102", "Checklist de requerimento", { origem: "Onboarding", fase: "Ancoragem", onboardingId: "60", trimestre: "2026-T3", concluidaEm: "2026-09-21", prazoTarefa: "2026-09-21", noPrazo: "Sim", leitura: "Com ajuste", lidaEm: "2026-09-22", prazoLeitura: "2026-09-28", estagio: "SUCCESS", autor: "3", comentario: "Faltou a certidão de casamento atualizada." });
    leit("3", "102", "Dossiê completo do caso Moura", { origem: "Onboarding", fase: "Imersão", onboardingId: "60", trimestre: "2026-T4", concluidaEm: "2026-10-01", prazoTarefa: "2026-10-02", noPrazo: "Sim", leitura: "Conforme", lidaEm: "2026-10-03", prazoLeitura: "2026-10-08", estagio: "SUCCESS", autor: "3" });
    leit("3", "102", "Parecer de elegibilidade", { origem: "Onboarding", fase: "Imersão", onboardingId: "60", trimestre: "2026-T4", concluidaEm: "2026-10-05", prazoTarefa: "2026-10-06", noPrazo: "Sim", prazoLeitura: "2026-10-12", estagio: "NEW", tarefaId: "4521" });
    leit("4", "103", "Parecer tributário da carteira Lopes", { origem: "Plano de alinhamento", planoId: "80", trimestre: "2026-T4", concluidaEm: "2026-10-06", prazoTarefa: "2026-10-06", noPrazo: "Sim", ajustes: 0, prazoLeitura: "2026-10-13", estagio: "NEW", tarefaId: "4533" });
    ["Conforme", "Conforme", "Conforme", "Conforme", "Com ajuste"].forEach((l, i) => leit("1", "100", "Entrega relevante " + (i + 1) + " do 1º trimestre", {
      origem: "Marcada como relevante", trimestre: "2026-T1", concluidaEm: "2026-02-" + String(10 + i).padStart(2, "0"), leitura: l, estagio: "SUCCESS", lidaEm: "2026-02-" + String(12 + i).padStart(2, "0"), autor: "3",
    }));

    /* Planejamento da função */
    add("planejamento", {
      id: "90", titulo: "Analista de Imigração", estagio: "SUCCESS", funcao: "Analista de Imigração", area: "Soluções · Imigração",
      escopo: "Atendimento dos pedidos de cidadania e vistos, do recebimento dos documentos ao protocolo.",
      padroes: "Checklist completo antes do protocolo; resposta ao cliente em até 2 dias úteis.",
      indicadores: "Protocolos sem exigência; casos concluídos no trimestre.",
      entregasAncoragem: "Triagem de documentos de 2 processos; checklist de requerimento.",
      entregasImersao: "Dossiê completo; parecer de elegibilidade; atendimento acompanhado.", entregasMarAberto: "Carteira de 6 casos.",
    });

    /* Avaliação de finalista */
    add("finalistas", {
      titulo: "Paula Nunes · Analista de Imigração Pleno", membroId: "9001", candidato: "Paula Nunes", lideranca: "3", estagio: "NEW",
      parecerRH: "Boa experiência em vistos de trabalho; inglês fluente; pretensão dentro da faixa.", prazo: "2026-10-13", criadoEm: "2026-10-06T15:00:00-03:00",
    });


    /* ---------- Revisão de Progresso (protótipo do RH, 05/11/2026): um ciclo aberto, uma avaliação em cada etapa ---------- */
    // 57-revisao-matriz.js carrega depois deste arquivo: no navegador já está em GP na hora da chamada
    const MZ = (typeof window !== "undefined" && window.GP && window.GP.revisaoMatriz) || require("./57-revisao-matriz.js");
    // os 3 cargos que o protótipo nomeia: SDR (C05), Analista de Pós-vendas (C06) e Estágio em SDR (C04)
    [["1", "C06"], ["2", "C05"], ["3", "C06"], ["4", "C05"], ["5", "C04"], ["6", "C06"]].forEach(([id, cg]) => { reg.membros.find((x) => x.id === id).cargoMatriz = cg; });
    add("revCiclos", { id: "700", titulo: "Revisão de Progresso · Novembro 2026 · inaugural (anual)", estagio: "ABERTO", ciclo: "Novembro 2026 · inaugural (anual)",
      periodoInicio: "2025-11-01", periodoFim: "2026-10-31", dataAbertura: "2026-10-01", prazoAuto: "2026-10-09", prazoLideranca: "2026-10-16",
      prazoCalibracao: "2026-10-23", prazoDevolutiva: "2026-11-06", prazoRetornos: "2026-11-20", autor: "6", criadoEm: "2026-09-28T10:00:00-03:00",
      regras: JSON.stringify({ publico: "todos", excluidos: [], excecoes: "", liberarLideranca: true, liberarPares: true, minimoNotas: 3, minimoComentarios: 5,
        abaixoMinimo: "juntar_area", retornoLidPequeno: "diagnostico_area", retornoTopo: "consultoria", conferencias: { lista: true, matriz: true, anonimato: true } }),
      mensagem: "Primeiro ciclo da Revisão de Progresso. Avaliem com evidência (SCI) e enviem até 16/10." });
    /** Uma avaliação da liderança preenchida, no formato do formulário (as chaves são os "name" do protótipo) */
    const avaliacaoDemo = (cargo, niveis, comps, extra) => {
      const a = {}, C = MZ.CARGOS[cargo];
      C.kpis.forEach((k, i) => {
        const n = i + 1;
        a["kpi_" + n + "_resultado"] = ["92%", "14 reuniões", "100%", "4,6 de 5", "3 dias"][i % 5];
        a["kpi_" + n + "_nivel"] = niveis[i % niveis.length];
        a["kpi_" + n + "_evidencia"] = "Relatório mensal do CRM de nov/2025 a out/2026; acompanhamento nas reuniões de 1:1.";
        a["kpi_" + n + "_ajuste"] = "manter";
      });
      C.competencias.forEach((x, i) => {
        const n = i + 1;
        a["comp_" + n + "_nivel"] = String(comps[i % comps.length]);
        a["comp_" + n + "_evidencia"] = "Situação: atendimento de um caso urgente em setembro. Comportamento: organizou a fila e avisou o cliente antes do prazo. Impacto: nenhuma reclamação e o caso fechou na data.";
        a["comp_" + n + "_ajuste"] = "manter";
      });
      return JSON.stringify(Object.assign(a, {
        conclusao_geral: "Entrega consistente no período, com evolução clara na organização da carteira. Precisa ganhar autonomia nos casos complexos.",
        ponto_forte_1: "Organização da carteira", ponto_forte_2: "Relacionamento com o cliente", ponto_desenv_1: "Autonomia em casos complexos",
        decisao_equipe: "Concordo totalmente", decisao_risco: "Não",
      }, extra || {}));
    };
    // responsável = a liderança que avalia (o membro nunca é dono do item: não lê o formulário)
    const avaliacao = (id, mid, uid, cargo, estagio, extra) => add("revAvaliacoes", Object.assign({ id, titulo: "Revisão · " + nomeDe(uid), membroId: mid, responsavel: "3", avaliador: "3", autor: "3",
      cargo, cicloId: "700", estagio, criadoEm: "2026-09-20T10:00:00-03:00" }, extra));
    avaliacao("710", "1", "100", "C06", "DEVOLUTIVA", { avaliacao: avaliacaoDemo("C06", ["Alcança", "Supera", "Alcança", "Alcança em parte"], [3, 4, 3, 2]), enviadaEm: "2026-10-02T17:00:00-03:00",
      calibracao: JSON.stringify({ calib_ajuste: "Não", calib_data: "2026-10-05", calib_detalhe: "Sem ajuste: as evidências batem com as dos pares do cargo." }), calibradaEm: "2026-10-05T18:00:00-03:00",
      pdi: JSON.stringify({ pdi_1_ligada: "Autonomia em casos complexos", pdi_1_acao: "Conduzir 2 casos complexos com revisão quinzenal da liderança", pdi_1_prazo: "2027-03-31",
        pdi_1_sucesso: "Os 2 casos protocolados sem retrabalho", pdi_1_apoio: "Revisão quinzenal", pdi_1_resp: "Ana e Carla", promo_elegivel: "Não" }),
      devolutivaEm: "2026-10-07" });
    avaliacao("711", "2", "101", "C05", "CALIBRADA", { avaliacao: avaliacaoDemo("C05", ["Alcança", "Alcança em parte"], [3, 2, 3]), enviadaEm: "2026-10-03T16:00:00-03:00",
      calibracao: JSON.stringify({ calib_ajuste: "Sim", calib_data: "2026-10-06", calib_detalhe: "KPI 2 de Supera para Alcança: a meta do período foi revista em julho." }), calibradaEm: "2026-10-06T18:00:00-03:00" });
    avaliacao("712", "3", "102", "C06", "ENVIADA", { avaliacao: avaliacaoDemo("C06", ["Alcança"], [3, 3, 2]), enviadaEm: "2026-10-06T11:00:00-03:00" });
    avaliacao("713", "4", "103", "C05", "NEW", { avaliacao: JSON.stringify({ kpi_1_resultado: "11 reuniões", kpi_1_nivel: "Alcança em parte", kpi_1_evidencia: "CRM, setembro." }) });
    const auto = (id, mid, uid, estagio, enviadaEm) => add("revAutoavaliacoes", { id, titulo: "Autoavaliação · " + nomeDe(uid), membroId: mid, responsavel: uid, cicloId: "700", estagio, enviadaEm,
      criadoPor: uid, auto1: "1) Reorganizei a carteira de 40 casos por prazo; 2) 12 processos protocolados sem pendência; 3) treinei a nova analista.",
      auto2: "Os prazos do segundo semestre: nenhum caso atrasado desde julho.", auto3: estagio === "SUCCESS" ? "Casos complexos: ainda dependo de revisão. Faria checkpoints semanais com a liderança." : "",
      auto4: estagio === "SUCCESS" ? "Acesso à base de pareceres antigos e uma revisão quinzenal." : "", auto5: estagio === "SUCCESS" ? "Análise de casos complexos e comunicação escrita." : "" });
    auto("720", "1", "100", "SUCCESS", "2026-10-02T09:30:00-03:00");
    auto("721", "2", "101", "SUCCESS", "2026-10-03T10:00:00-03:00");
    auto("722", "3", "102", "SUCCESS", "2026-10-05T15:00:00-03:00");
    auto("723", "4", "103", "NEW", "");
    add("revRetornos", { id: "730", titulo: "Retornos · Ana Ribeiro", membroId: "1", responsavel: "100", cicloId: "700", estagio: "DEVOLUTIVA", criadoPor: "3", criadoEm: "2026-10-07T17:00:00-03:00",
      devolutivaEm: "2026-10-07", fortes: "Organização da carteira e relacionamento com o cliente: nenhum caso atrasado desde julho.",
      desenvolver: "Autonomia nos casos complexos: hoje a estratégia ainda depende da revisão da liderança.",
      metas: JSON.stringify({ meta_1_tipo: "Resultado", meta_1_descricao: "Conduzir 2 casos complexos do início ao protocolo", meta_1_prazo: "2027-03-31", meta_1_indicador: "Casos protocolados sem retrabalho", meta_1_combinada: "Sim",
        meta_2_tipo: "Aprendizado", meta_2_descricao: "Curso de redação jurídica", meta_2_prazo: "2027-02-28", meta_2_combinada: "Sim" }) });
    // respostas da 360°: gravadas pelo servidor, sem autor (5 sobre a Carla, 3 sobre o Bruno, 2 sobre a Ana e 2 sobre a Daniela; 2 sobre o Marcos, abaixo do mínimo)
    const r360 = (avaliado, relacao, notas, textos) => {
      const pre = relacao === "Superior" ? "lid_" : "par_", resp = {};
      notas.forEach((v, i) => { resp[pre + (i + 1)] = v; });
      add("rev360", { titulo: "360° · " + relacao + " · " + nomeDe(avaliado), cicloId: "700", avaliado, relacao, modo: "Anônima", area: "Soluções", criadoPor: "", responsavel: "6",
        criadoEm: "2026-10-04T12:00:00-03:00", respostas: JSON.stringify(Object.assign(resp, textos || {})) });
    };
    const C3 = "Concordo", CT = "Concordo totalmente", D2 = "Discordo";
    r360("3", "Superior", [CT, C3, C3, CT, C3, CT, CT, D2], { continuar: "Explicar as prioridades da semana na segunda-feira.", comecar: "Avisar antes das mudanças de carteira." });
    r360("3", "Superior", [C3, C3, D2, C3, C3, C3, CT, C3], { continuar: "Os feedbacks com exemplo.", comecar: "Ter um horário fixo para dúvidas." });
    r360("3", "Superior", [CT, CT, C3, CT, CT, CT, CT, C3], { continuar: "A confiança na equipe." });
    r360("3", "Superior", [C3, D2, C3, C3, C3, C3, C3, D2], { comecar: "Explicar o porquê das decisões de prioridade." });
    r360("3", "Superior", [C3, C3, C3, CT, "Não sei avaliar", CT, C3, C3], { continuar: "Reconhecer as entregas na reunião da equipe." });
    r360("101", "Par", [C3, C3, CT, C3, C3, C3, C3, C3]); r360("101", "Par", [CT, C3, C3, C3, CT, C3, C3, CT]); r360("101", "Par", [C3, D2, C3, C3, C3, C3, C3, C3]);
    r360("100", "Par", [CT, CT, C3, CT, CT, C3, C3, C3]); r360("100", "Par", [C3, C3, C3, C3, C3, C3, C3, C3]);
    r360("102", "Par", [C3, C3, D2, C3, C3, CT, C3, C3]); r360("102", "Par", [C3, C3, C3, C3, D2, C3, C3, C3]);
    r360("4", "Superior", [C3, C3, C3, C3, C3, C3, C3, C3]); r360("4", "Superior", [D2, C3, C3, C3, C3, C3, C3, C3]);

    const vagas = {
      etapas: [
        { id: "C77:NEW", nome: "Nova solicitação", semantica: "" }, { id: "C77:PREPARATION", nome: "Em análise", semantica: "" },
        { id: "C77:PREPAYMENT_INVOIC", nome: "Aprovada", semantica: "" }, { id: "C77:EXECUTING", nome: "Em recrutamento", semantica: "" },
        { id: "C77:WON", nome: "Vaga preenchida", semantica: "S" }, { id: "C77:LOSE", nome: "Reprovada", semantica: "F" }, { id: "C77:APOLOGY", nome: "Cancelada", semantica: "F" },
      ],
      negocios: [
        { ID: "9001", TITLE: "Analista de Imigração Pleno", STAGE_ID: "C77:EXECUTING", DATE_CREATE: "2026-09-08T10:00:00-03:00", DATE_MODIFY: "2026-10-06T15:00:00-03:00", UF_CRM_RV_VAGA: "Analista de Imigração Pleno", UF_CRM_RV_EMAIL: "carla.mendes@amorimglobal.com", UF_CRM_RV_LIDER: "Carla Mendes", UF_CRM_RV_SETOR: "Soluções", UF_CRM_RV_DATA_ENT: "2026-11-03" },
        { ID: "9002", TITLE: "Assistente de Imigração", STAGE_ID: "C77:WON", DATE_CREATE: "2026-08-20T10:00:00-03:00", DATE_MODIFY: "2026-09-25T10:00:00-03:00", CLOSEDATE: "2026-09-25", UF_CRM_RV_VAGA: "Assistente de Imigração", UF_CRM_RV_EMAIL: "carla.mendes@amorimglobal.com", UF_CRM_RV_LIDER: "Carla Mendes", UF_CRM_RV_SETOR: "Soluções" },
        { ID: "9003", TITLE: "Analista Tributário Júnior", STAGE_ID: "C77:PREPARATION", DATE_CREATE: "2026-10-02T10:00:00-03:00", DATE_MODIFY: "2026-10-03T10:00:00-03:00", UF_CRM_RV_VAGA: "Analista Tributário Júnior", UF_CRM_RV_EMAIL: "marcos.lima@amorimglobal.com", UF_CRM_RV_LIDER: "Marcos Lima", UF_CRM_RV_SETOR: "Soluções" },
        // Solicitações de promoção (05/11/2026): o mesmo funil, com os campos UF_CRM_PR_*
        { ID: "9011", TITLE: "Promoção · Ana Ribeiro", STAGE_ID: "C77:NEW", DATE_CREATE: "2026-10-07T11:00:00-03:00", DATE_MODIFY: "2026-10-07T11:00:00-03:00", ASSIGNED_BY_ID: "2",
          ORIGINATOR_ID: "gestao-pessoas", ORIGIN_ID: "1", UF_CRM_PR_MEMBRO: "100", UF_CRM_PR_SOLICIT: "3", UF_CRM_PR_COORD: "2",
          UF_CRM_PR_ATUAL: "Imigração · Analista", UF_CRM_PR_NIVEL_ATU: "Analista II", UF_CRM_PR_NIVEL: "Analista III", UF_CRM_PR_SENIOR: "Sênior", UF_CRM_PR_DATA: "2026-11-01",
          UF_CRM_PR_REMUN: "A definir com o RH", UF_CRM_PR_MOTIVO: "Conduz sozinha os casos de vistos de investidor desde março e virou referência do time nesse tema.",
          UF_CRM_PR_RESULT: "Fechou 42 processos no semestre, sem nenhuma exigência do consulado por documentação. Treinou as duas analistas novas.",
          UF_CRM_PR_RESPONS: "Revisa os dossiês das colegas antes do envio e atende os clientes mais sensíveis da carteira.", UF_CRM_PR_COMPET: "Comunicação clara; Organização; Autonomia",
          UF_CRM_PR_DESENV: "Delegar mais e dar retorno estruturado às colegas que revisa. Vou acompanhar nos 1:1 do mês.", UF_CRM_PR_IMPACTO: "Continuam com a pessoa",
          UF_CRM_PR_CIENTE: "Não: a conversa fica para depois da aprovação" },
        { ID: "9012", TITLE: "Promoção · Júlia Freitas", STAGE_ID: "C77:PREPARATION", DATE_CREATE: "2026-10-05T09:00:00-03:00", DATE_MODIFY: "2026-10-06T17:30:00-03:00", ASSIGNED_BY_ID: "6",
          ORIGINATOR_ID: "gestao-pessoas", ORIGIN_ID: "8", UF_CRM_PR_MEMBRO: "111", UF_CRM_PR_SOLICIT: "4", UF_CRM_PR_COORD: "2",
          UF_CRM_PR_ATUAL: "Tributário · Analista", UF_CRM_PR_NIVEL_ATU: "Analista I", UF_CRM_PR_NIVEL: "Analista II", UF_CRM_PR_SENIOR: "Pleno", UF_CRM_PR_DATA: "2026-11-01",
          UF_CRM_PR_REMUN: "Sim", UF_CRM_PR_REAJUSTE: "Faixa do Analista II", UF_CRM_PR_MOTIVO: "Assumiu a apuração mensal de dois clientes grandes sem supervisão.",
          UF_CRM_PR_RESULT: "Entregou todas as apurações do trimestre no prazo e encontrou um crédito de PIS/COFINS que o cliente não tinha visto.",
          UF_CRM_PR_RESPONS: "Faz a primeira revisão das obrigações acessórias do time.", UF_CRM_PR_DESENV: "Apresentar resultados direto ao cliente. Vai acompanhar as reuniões comigo.",
          UF_CRM_PR_IMPACTO: "Continuam com a pessoa", UF_CRM_PR_CIENTE: "Sim, já conversamos",
          UF_CRM_PR_COORD_DEC: "Aprovada", UF_CRM_PR_COORD_EM: "2026-10-06", UF_CRM_PR_COORD_OBS: "De acordo. A Júlia já atua como Analista II há alguns meses." },
      ],
      historico: [
        { OWNER_ID: "9001", STAGE_ID: "C77:PREPAYMENT_INVOIC", CREATED_TIME: "2026-09-14T10:00:00-03:00" },
        { OWNER_ID: "9001", STAGE_ID: "C77:EXECUTING", CREATED_TIME: "2026-09-16T10:00:00-03:00" },
        { OWNER_ID: "9002", STAGE_ID: "C77:PREPAYMENT_INVOIC", CREATED_TIME: "2026-08-28T10:00:00-03:00" },
        { OWNER_ID: "9002", STAGE_ID: "C77:WON", CREATED_TIME: "2026-09-25T10:00:00-03:00" },
      ],
    };

    /* Funil "HR | Offboarding" (formulário CRM): o mesmo formato que o repositório do Bitrix devolve */
    const offboarding = {
      etapas: [
        { id: "C79:NEW", nome: "Nova solicitação", semantica: "" }, { id: "C79:PREPARATION", nome: "Aguardando coordenação", semantica: "" },
        { id: "C79:PREPAYMENT_INVOIC", nome: "Em análise (RH)", semantica: "" }, { id: "C79:EXECUTING", nome: "Aprovada", semantica: "" },
        { id: "C79:FINAL_INVOICE", nome: "Conversa realizada", semantica: "" }, { id: "C79:POS_ENC", nome: "Pós-encerramento", semantica: "" },
        { id: "C79:WON", nome: "Concluída", semantica: "S" }, { id: "C79:LOSE", nome: "Cancelada", semantica: "F" },
      ],
      negocios: [
        { ID: "9101", TITLE: "Encerramento · Igor Santos", STAGE_ID: "C79:NEW", DATE_CREATE: "2026-10-07T16:20:00-03:00", DATE_MODIFY: "2026-10-07T16:20:00-03:00",
          UF_CRM_OFF_SOLICIT: "Livia Prado e Rafael Souza", UF_CRM_OFF_EMAIL: "livia.prado@amorimglobal.com", UF_CRM_OFF_MEMBRO: "Igor Santos", UF_CRM_OFF_SETOR: "Soluções · Tributário",
          UF_CRM_OFF_MOTIVO: "Desempenho abaixo da média", UF_CRM_OFF_FEEDBACKS: "Sim", UF_CRM_OFF_ANEXOS: [{ id: 1 }], UF_CRM_OFF_SUCESSOR: "Não", UF_CRM_OFF_REPOSICAO: "Em avaliação",
          UF_CRM_OFF_RISCOS: ["Clientes estratégicos"], UF_CRM_OFF_DATA_DES: "2026-10-30" },
        { ID: "9102", TITLE: "Encerramento · Paulo Viana", STAGE_ID: "C79:WON", DATE_CREATE: "2026-08-10T10:00:00-03:00", DATE_MODIFY: "2026-08-29T18:00:00-03:00", CLOSEDATE: "2026-08-29",
          UF_CRM_OFF_SOLICIT: "Livia Prado", UF_CRM_OFF_EMAIL: "livia.prado@amorimglobal.com", UF_CRM_OFF_MEMBRO: "Paulo Viana", UF_CRM_OFF_SETOR: "Soluções · Tributário",
          UF_CRM_OFF_MOTIVO: "Otimização de Custos", UF_CRM_OFF_FEEDBACKS: "Não se aplica", UF_CRM_OFF_SUCESSOR: "Sim", UF_CRM_OFF_REPOSICAO: "Não", UF_CRM_OFF_DATA_EFET: "2026-08-29" },
        { ID: "9103", TITLE: "Encerramento · Clara Neves", STAGE_ID: "C79:WON", DATE_CREATE: "2026-03-02T10:00:00-03:00", DATE_MODIFY: "2026-03-31T18:00:00-03:00", CLOSEDATE: "2026-03-31",
          UF_CRM_OFF_SOLICIT: "Carla Mendes", UF_CRM_OFF_EMAIL: "carla.mendes@amorimglobal.com", UF_CRM_OFF_MEMBRO: "Clara Neves", UF_CRM_OFF_SETOR: "Soluções · Imigração",
          UF_CRM_OFF_MOTIVO: "Incompatibilidade com a função", UF_CRM_OFF_FEEDBACKS: "Sim", UF_CRM_OFF_ANEXOS: [{ id: 2 }, { id: 3 }], UF_CRM_OFF_SUCESSOR: "Não", UF_CRM_OFF_REPOSICAO: "Sim",
          UF_CRM_OFF_DATA_EFET: "2026-03-31" },
        { ID: "9104", TITLE: "Encerramento · (cancelada)", STAGE_ID: "C79:LOSE", DATE_CREATE: "2026-09-15T10:00:00-03:00", DATE_MODIFY: "2026-09-18T10:00:00-03:00",
          UF_CRM_OFF_SOLICIT: "Rafael Souza", UF_CRM_OFF_EMAIL: "rafael.souza@amorimglobal.com", UF_CRM_OFF_MEMBRO: "Otávio Ramos", UF_CRM_OFF_SETOR: "Soluções · Negócios",
          UF_CRM_OFF_MOTIVO: "Outro", UF_CRM_OFF_MOT_OUT: "Fim do projeto do cliente" },
      ],
    };

    return { usuarios, departamentos, config, registros: reg, vagas, offboarding };
  }

  /** Repositório em memória com a interface de GP.bitrix.criarRepositorio() */
  function criarRepositorioDemo(opcoes) {
    const o = opcoes || {};
    const d = dadosDemo();
    const hoje = o.hoje || HOJE_PADRAO;
    const euId = PAPEL_USUARIO[o.papel] || PAPEL_USUARIO.lideranca;
    let seq = 9000;
    const copia = (x) => JSON.parse(JSON.stringify(x));
    const atraso = () => new Promise((r) => setTimeout(r, o.atrasoMs === undefined ? 120 : o.atrasoMs));
    const estagioNome = (chave, cod) => ((schema.processo(chave).estagios.find((e) => e.codigo === cod)) || {}).nome || cod;
    const agora = () => hoje + "T" + new Date().toTimeString().slice(0, 8) + "-03:00";

    return {
      modo: "demo", hoje, dados: d,
      iniciar: async () => {},
      mensagemErro: (e) => (e && (e.descricao || e.message)) || "erro desconhecido",
      lerConfig: async () => ({ config: copia(d.config), origem: "demo", ausentes: [] }),
      salvarConfig: async (cfg) => { d.config = copia(cfg); },
      estrutura: () => ({}),
      provisionar: async () => { throw new Error("Na demonstração não há portal para configurar."); },
      eu: async () => {
        const u = d.usuarios.find((x) => x.id === euId);
        return { id: u.id, nome: u.nome, foto: "", email: u.email, admin: euId === "6", nascimento: u.aniversario ? "1990-" + u.aniversario : "" };
      },
      salvarAniversario: async (uid, data) => {
        await atraso();
        const u = d.usuarios.find((x) => x.id === String(uid));
        if (u) u.aniversario = String(data).slice(5, 10);
      },
      usuarios: async () => copia(d.usuarios),
      departamentos: async () => copia(d.departamentos),
      selecionarUsuarios: async () => {
        const nome = (typeof window !== "undefined" && window.prompt) ? window.prompt("Demonstração: nome de um usuário (ex.: Ana Ribeiro)") : "";
        const u = d.usuarios.find((x) => x.nome.toLowerCase() === String(nome || "").trim().toLowerCase());
        return u ? [{ id: u.id, nome: u.nome }] : [];
      },
      listar: async (chave) => copia(d.registros[chave] || []),
      listarTodos: async () => { await atraso(); return copia(d.registros); },
      criar: async (chave, dados) => {
        await atraso();
        const p = schema.processo(chave);
        const o2 = {};
        p.campos.forEach((c) => { o2[c.chave] = c.tipo === "simNao" ? false : c.tipo === "arquivo" ? [] : c.tipo === "numero" ? null : ""; });
        Object.assign(o2, dados, { id: String(++seq), criadoEm: agora(), atualizadoEm: agora(), criadoPor: euId });
        o2.estagio = dados.estagio || "NEW";
        o2.estagioNome = estagioNome(chave, o2.estagio);
        o2.titulo = dados.titulo || "";
        (d.registros[chave] = d.registros[chave] || []).push(o2);
        return copia(o2);
      },
      atualizar: async (chave, id, dados) => {
        await atraso();
        const it = (d.registros[chave] || []).find((x) => x.id === String(id));
        if (!it) throw { descricao: "registro " + id + " não encontrado" };
        Object.assign(it, dados, { atualizadoEm: agora() });
        if (dados.estagio) it.estagioNome = estagioNome(chave, dados.estagio);
        return copia(it);
      },
      buscar: async (chave, id) => copia((d.registros[chave] || []).find((x) => x.id === String(id))),
      excluir: async (chave, id) => {
        await atraso();
        const lista = d.registros[chave] || [];
        const i = lista.findIndex((x) => x.id === String(id));
        if (i < 0) throw { descricao: "registro " + id + " não encontrado" };
        lista.splice(i, 1);
      },
      temProcesso: () => true,
      acessoNegado: [],
      abrirCard: () => {},
      abrirNegocio: () => {},
      offboarding: async () => copia(d.offboarding),
      /** Formulários do app: o card entra no funil em memória (vagas ou offboarding), na primeira etapa */
      camposNegocio: async () => ({}),
      negociosCriados: [],
      criarNegocio: async function (n) {
        await atraso();
        const funil = Number(n.categoria) === Number(d.config.offboarding.categoria) ? d.offboarding : d.vagas;
        const id = String(++seq);
        const campos = Object.assign({}, n.campos);
        Object.keys(campos).forEach((k) => { if (Array.isArray(campos[k]) && Array.isArray(campos[k][0])) campos[k] = campos[k].map((a, i) => ({ id: i + 1, nome: a[0] })); });
        const estagio = n.estagio || (funil.etapas[0] || {}).id || "";
        funil.negocios.unshift(Object.assign({ ID: id, TITLE: n.titulo, STAGE_ID: estagio, DATE_CREATE: agora(), DATE_MODIFY: agora(), ASSIGNED_BY_ID: String(n.responsavel) },
          n.origem ? { ORIGINATOR_ID: n.origem.sistema, ORIGIN_ID: String(n.origem.id) } : {}, campos));
        this.negociosCriados.push({ id, categoria: Number(n.categoria), titulo: n.titulo, responsavel: String(n.responsavel), campos: n.campos, origem: n.origem || null, observadores: (n.observadores || []).map(String), estagio, restrito: !!n.restrito });
        return { id, estagio };
      },
      /** Decisão sobre o card (promoção): grava os campos, a etapa e o responsável no funil em memória */
      negociosAtualizados: [],
      atualizarNegocio: async function (id, o2) {
        await atraso();
        const n = d.vagas.negocios.concat(d.offboarding.negocios).find((x) => x.ID === String(id));
        if (!n) throw { descricao: "card " + id + " não encontrado" };
        Object.assign(n, o2.campos || {}, { DATE_MODIFY: agora() }, o2.estagio ? { STAGE_ID: o2.estagio } : {}, o2.responsavel ? { ASSIGNED_BY_ID: String(o2.responsavel) } : {});
        this.negociosAtualizados.push({ id: String(id), campos: o2.campos || {}, estagio: o2.estagio || "", responsavel: o2.responsavel ? String(o2.responsavel) : "" });
      },
      passarNegocio: async function (id, responsavel) {
        [d.vagas, d.offboarding].forEach((f) => f.negocios.forEach((x) => { if (x.ID === String(id)) x.ASSIGNED_BY_ID = String(responsavel); }));
        const n = this.negociosCriados.find((x) => x.id === String(id));
        if (n) n.responsavel = String(responsavel);
      },
      linkNegocio: (id) => "https://amorimglobal.bitrix24.com.br/crm/deal/details/" + id + "/",
      comentarNegocio: async function (id, texto) { this.comentarios.push({ chave: "negocio", id: String(id), texto }); },
      contagemServidor: async () => null, // fora do Bitrix não há servidor para comparar
      /** Na demonstração a Ficha não sai por e-mail: só marca o envio */
      enviarFicha: async (onboardingId) => {
        await atraso();
        const o = (d.registros.onboarding || []).find((x) => x.id === String(onboardingId));
        const m = o && (d.registros.membros || []).find((x) => x.id === o.membroId);
        const u = m && d.usuarios.find((x) => x.id === m.responsavel);
        if (!o || !u) throw { descricao: "onboarding não encontrado" };
        o.fichaEnviadaEm = agora();
        return { ok: true, para: u.email, enviadaEm: o.fichaEnviadaEm, demo: true };
      },
      vagas: async () => copia(d.vagas),
      notificacoes: [],
      notificar: async function (ids, mensagem) { this.notificacoes.push({ ids, mensagem }); },
      /** E-mail pela caixa do Bitrix: na demonstração, fica guardado aqui (nada sai) */
      emailsEnviados: [],
      enviarEmail: async function (e, emailDaPessoa) {
        await atraso();
        this.emailsEnviados.push(Object.assign({ de: emailDaPessoa }, e));
        return { de: emailDaPessoa, demo: true };
      },
      abrirEmailBitrix: function () { this.emailBitrixAberto = (this.emailBitrixAberto || 0) + 1; },
      /** Revisões semanais: na demonstração, a busca "acha" a resposta da Daniela da última semana */
      buscarSemanal: async function () {
        await atraso();
        const ja = (d.registros.semanal || []).some((x) => x.responsavel === "102" && x.semana === "2026-10-02");
        if (!ja) {
          (d.registros.semanal = d.registros.semanal || []).push({
            id: String(++seq), titulo: "Revisão semanal · Daniela Rocha · 28/09 a 02/10", membroId: "3", responsavel: "102", estagio: "NEW", estagioNome: "Guardada",
            semana: "2026-10-02", papel: "Membro", respondidas: 2, origem: "liderado:demo-102:2026-10-02", guardadaEm: agora(), criadoEm: agora(), atualizadoEm: agora(), criadoPor: euId,
            respostas: "1. Sua semana — Como foi a sua semana?\nTerminei a imersão e acompanhei dois atendimentos.\n\n4. Próxima semana — Quais são as suas prioridades para a próxima semana?\nAssumir os seis casos da carteira.",
          });
        }
        return { ok: true, demo: true, agora: "2026-10-08T06:00", pessoas: 5, guardadas: ja ? 0 : 1, atualizadas: 0, semMudanca: 3, semResposta: 1,
          naoEncontradas: [{ nome: "Contato Amorim", papel: "Membro" }], semMembro: [], semanas: ja ? [] : ["2026-10-02"], falhas: [] };
      },
      registrarDossie: async () => {},
      /** Na demonstração o resumo da CEO é calculado aqui, com a mesma função do servidor */
      painelServidor: async (ctx) => {
        await atraso();
        // 50-dominio.js carrega depois deste arquivo: no navegador já está em GP na hora da chamada
        const D = (typeof window !== "undefined" && window.GP && window.GP.dominio) || require("./50-dominio.js");
        return D.resumoPainel(D.painelGeral(ctx));
      },
      statusServidor: async () => null, // fora do Bitrix não há servidor para conferir
      /** Revisão de Progresso: as mesmas conferências de api/revisao360.js, e a resposta entra sem autor */
      enviar360: async function (dados) {
        await atraso();
        const D = (typeof window !== "undefined" && window.GP && window.GP.dominio) || require("./50-dominio.js");
        const RV = (typeof window !== "undefined" && window.GP && window.GP.revisao) || require("./58-revisao.js");
        const ctx = D.indexar({ hoje, eu: { id: euId }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros });
        const ciclo = (d.registros.revCiclos || []).find((x) => x.id === String(dados.cicloId));
        if (!ciclo || ciclo.estagio !== "ABERTO") throw { descricao: "este ciclo da Revisão de Progresso não está aberto" };
        const relacao = RV.relacaoCom(ctx, euId, String(dados.avaliado));
        if (!relacao) throw { descricao: "pela estrutura, você não avalia esta pessoa na 360°" };
        const regras = RV.regrasDo(ciclo);
        if ((relacao === "Superior" && !regras.liberarLideranca) || (relacao === "Par" && !regras.liberarPares)) throw { descricao: "esta parte da 360° não foi liberada neste ciclo" };
        const v = RV.validarResposta(relacao, dados.respostas);
        if (!v.ok) throw { descricao: v.erros.join("; ") };
        d.registros.rev360.push({ id: String(++seq), titulo: "360° · " + relacao + " · " + D.pessoa(ctx, dados.avaliado).nome, estagio: "NEW", estagioNome: "Recebida",
          cicloId: String(ciclo.id), avaliado: String(dados.avaliado), relacao, modo: dados.modo === "Identificada" ? "Identificada" : "Anônima",
          identificadoPor: dados.modo === "Identificada" ? euId : "", area: RV.areaDe(ctx, dados.avaliado).nome, respostas: JSON.stringify(v.respostas),
          criadoEm: agora(), atualizadoEm: agora(), criadoPor: "", responsavel: "6", membroId: "" });
        return true;
      },
      comentarios: [],
      comentar: async function (chave, id, texto) { this.comentarios.push({ chave, id, texto }); },
      lerPreferencia: (nome) => { try { return localStorage.getItem("gp_demo_" + euId + "_" + nome); } catch (e) { return null; } },
      gravarPreferencia: (nome, valor) => { try { localStorage.setItem("gp_demo_" + euId + "_" + nome, valor); } catch (e) { /* sem storage */ } },
    };
  }

  return { dadosDemo, criarRepositorioDemo, HOJE_PADRAO, PAPEL_USUARIO };
});
