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
  const PAPEL_USUARIO = { lideranca: "3", coordenacao: "2", rh: "6", ceo: "1" };

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
        formVaga: "https://b24-ljukko.bitrix24.site/crm_form_4nlpe/",
        formEncerramento: "", baseConhecimento: "", guiaOnboarding: "", guiaOffboarding: "", modelosSCI: "",
      },
      recrutamento: { categoria: 77 },
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

    /* Onboarding */
    add("onboarding", {
      id: "60", titulo: "Onboarding · Daniela Rocha", membroId: "3", responsavel: "102", estagio: "IMERSAO", criadoEm: "2026-08-20T10:00:00-03:00",
      ingresso: "2026-08-27", senioridade: "Júnior", supervisao: "100", colega: "103", planejamentoId: "90",
      fichaEscopo: "Atendimento dos pedidos de cidadania e vistos da carteira de Salvador.", fichaPadroes: "Checklist de documentos completo antes de cada protocolo.",
      fichaIndicadores: "Protocolos sem exigência; prazo de resposta ao cliente.",
      entregasAncoragem: "Triagem de documentos de 2 processos; checklist de requerimento.", entregasImersao: "Dossiê completo; parecer de elegibilidade; 1 atendimento acompanhado.",
      entregasMarAberto: "Carteira de 6 casos no volume regular.", fichaEm: "2026-08-26", entregasPlanejadasEm: "2026-09-10",
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

    const ausencias = [
      { pessoa: "101", inicio: "2026-10-13", fim: "2026-10-16" },
      { pessoa: "102", inicio: "2026-11-09", fim: "2026-11-13" },
      { pessoa: "3", inicio: "2026-12-26", fim: "2027-01-02" },
      { pessoa: "100", inicio: "2026-12-28", fim: "2027-01-05" },
      { pessoa: "103", inicio: "2026-12-30", fim: "2027-01-01" },
    ];

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
      ],
      historico: [
        { OWNER_ID: "9001", STAGE_ID: "C77:PREPAYMENT_INVOIC", CREATED_TIME: "2026-09-14T10:00:00-03:00" },
        { OWNER_ID: "9001", STAGE_ID: "C77:EXECUTING", CREATED_TIME: "2026-09-16T10:00:00-03:00" },
        { OWNER_ID: "9002", STAGE_ID: "C77:PREPAYMENT_INVOIC", CREATED_TIME: "2026-08-28T10:00:00-03:00" },
        { OWNER_ID: "9002", STAGE_ID: "C77:WON", CREATED_TIME: "2026-09-25T10:00:00-03:00" },
      ],
    };

    return { usuarios, departamentos, config, registros: reg, ausencias, vagas };
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
        return { id: u.id, nome: u.nome, foto: "", email: u.email, admin: euId === "6" };
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
      abrirCard: () => {},
      feriadosNacionais: async (ano) => calc.feriadosNacionais(ano),
      ausencias: async (ids) => copia(d.ausencias.filter((a) => ids.indexOf(a.pessoa) >= 0)),
      agendarPendencia: async () => { await atraso(); return true; },
      vagas: async () => copia(d.vagas),
      notificacoes: [],
      notificar: async function (ids, mensagem) { this.notificacoes.push({ ids, mensagem }); },
      registrarDossie: async () => {},
      /** Na demonstração o resumo da CEO é calculado aqui, com a mesma função do servidor */
      painelServidor: async (ctx) => {
        await atraso();
        // 50-dominio.js carrega depois deste arquivo: no navegador já está em GP na hora da chamada
        const D = (typeof window !== "undefined" && window.GP && window.GP.dominio) || require("./50-dominio.js");
        return D.resumoPainel(D.painelGeral(ctx));
      },
      statusServidor: async () => null, // fora do Bitrix não há servidor para conferir
      comentarios: [],
      comentar: async function (chave, id, texto) { this.comentarios.push({ chave, id, texto }); },
      lerPreferencia: (nome) => { try { return localStorage.getItem("gp_demo_" + euId + "_" + nome); } catch (e) { return null; } },
      gravarPreferencia: (nome, valor) => { try { localStorage.setItem("gp_demo_" + euId + "_" + nome, valor); } catch (e) { /* sem storage */ } },
    };
  }

  return { dadosDemo, criarRepositorioDemo, HOJE_PADRAO, PAPEL_USUARIO };
});
