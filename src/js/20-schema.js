/* =====================================================================================
   ESQUEMA NO BITRIX — processos inteligentes, estágios e campos (especificação, seções 2 e 3)
   -------------------------------------------------------------------------------------
   Fonte única da estrutura: o provisionamento (30-provision.js) cria a partir daqui, e a
   camada de dados (40-bitrix.js) monta os códigos dos campos a partir daqui.

   Código do campo no Bitrix: UF_CRM_<id do tipo>_<SUFIXO>; na API REST nova (crm.item.*)
   ele vira camelCase: UF_CRM_41_DATA_INGRESSO -> ufCrm41DataIngresso.

   Vínculos entre registros do app:
   - com o Membro: relação nativa pai/filho (campo parentId<entityTypeId>), que também faz
     os registros aparecerem como abas no card do Membro;
   - entre outros processos (plano -> feedback, encerramento -> plano): campo texto com o
     ID do item ("... (ID)"). O app mostra o vínculo; no card nativo aparece o número.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica();
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.schema = m; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Cores de estágio (2.1: estágios de atraso em vermelho fazem o papel do "alerta vermelho")
  const COR = {
    amarelo: "#FFC34D", vermelho: "#FF5752", azul: "#39A8EF", verde: "#7BD500", cinza: "#B8C0C6",
  };
  const PREFIXO_TITULO = "Gestão de Pessoas · ";
  const SOLUCAO = "Gestão de Pessoas";

  // tipos aceitos: texto (1 linha), textoLongo, data, dataHora, pessoa, lista, simNao, arquivo, numero
  const c = (chave, sufixo, tipo, rotulo, extra) => Object.assign({ chave, sufixo, tipo, rotulo }, extra || {});
  const autor = () => c("autor", "AUTOR", "pessoa", "Autor do registro", { ajuda: "Preenchido pelo app com quem registrou." });
  const adendos = () => c("adendos", "ADENDOS", "textoLongo", "Adendos", {
    ajuda: "Correções feitas depois do prazo de edição, com data, autor e justificativa. O registro original continua visível.",
  });

  const OPCOES = {
    contrato: ["Associado", "PJ", "Estágio"],
    senioridade: ["Estagiário", "Júnior", "Pleno", "Sênior"],
    cidade: ["São Paulo (SP)", "Salvador (BA)"],
    tipoFeedback: ["Reconhecimento", "Desenvolvimento", "Abertura de plano", "Encerramento de plano"],
    combinadoAnterior: ["Cumprido", "Em andamento", "Não aconteceu"],
    progresso: ["Não iniciado", "Em andamento", "Atingido"],
    responsavelCombinado: ["Membro", "Liderança"],
    classificacao: ["Acima do esperado", "Dentro do esperado", "Com ajuste", "Abaixo do esperado"],
    checkin: ["Atingido", "Em evolução", "Não atingido"],
    situacaoFinal: ["Atingido", "Não atingido"],
    motivoEncerramento: [
      "Resultados abaixo do acordado", "Desalinhamento de perfil", "Reestruturação da área",
      "Fim do prazo previsto no contrato", "Situação grave ou urgente",
    ],
    reposicao: ["Substituição de membro", "Remanejamento interno", "Sem reposição"],
    simNao: ["Sim", "Não"],
    // 1.2: a liderança direta preenche e encaminha à coordenação; o formulário da coordenação vai direto ao RH
    origemEncerramento: ["Formulário da coordenação", "Plano encerrado sem os resultados", "Solicitação da liderança direta"],
    primeiraVerificacao: ["Aceita na 1ª verificação", "Bloqueada na 1ª verificação"],
    resultadoFase: ["Dentro do esperado", "Atenção", "Abaixo do esperado"],
    continuidade: ["Continuidade confirmada", "Continuidade não confirmada"],
    leitura: ["Conforme", "Com ajuste", "Fora do padrão", "Não entregue"],
    complexidade: ["Baixa", "Média", "Alta"],
    origemLeitura: ["Plano de alinhamento", "Onboarding", "Marcada como relevante", "Prazo vencido sem conclusão"],
    fase: ["Ancoragem", "Imersão", "Mar Aberto"],
    parecerFinalista: ["Seguir com a proposta", "Não seguir", "Quero conversar com o RH antes"],
  };

  const PROCESSOS = [
    /* ---------------- 2.5 Membros ---------------- */
    {
      chave: "membros", nome: "Membros", modulo: "Minha equipe", pai: null,
      descricao: "Um item por membro, criado pelo RH no ingresso. Responsável do item = o próprio membro.",
      estagios: [
        { codigo: "NEW", nome: "Onboarding", cor: COR.azul },
        { codigo: "ATIVO", nome: "Ativo", cor: COR.verde },
        { codigo: "EM_ENCERRAMENTO", nome: "Em encerramento", cor: COR.amarelo },
        { codigo: "SUCCESS", nome: "Encerrado", cor: COR.cinza },
        { codigo: "FAIL", nome: "Arquivado", cor: COR.cinza },
      ],
      campos: [
        c("lideranca", "LIDERANCA", "pessoa", "Liderança direta", { ajuda: "Informativo. Quem vê o membro no app é definido pela estrutura da empresa no Bitrix." }),
        c("coordenacao", "COORDENACAO", "pessoa", "Coordenação responsável", { ajuda: "Usada nas aprovações de vagas e de encerramentos de contrato." }),
        c("funcao", "FUNCAO", "texto", "Departamento e função"),
        c("ingresso", "DATA_INGRESSO", "data", "Data de ingresso"),
        c("contrato", "CONTRATO", "lista", "Modelo de contrato", { opcoes: OPCOES.contrato }),
        c("nivel", "NIVEL", "texto", "Nível", { ajuda: "Nível atual na Arquitetura de Cargos." }),
        c("senioridade", "SENIORIDADE", "lista", "Senioridade", { opcoes: OPCOES.senioridade, ajuda: "Usada no patamar das fases do onboarding." }),
        c("cidade", "CIDADE_REF", "lista", "Cidade de referência para feriados", { opcoes: OPCOES.cidade, ajuda: "Salvador (BA) para quem mora na Bahia. São Paulo (SP) para todos os outros." }),
        c("ocultarAniversario", "OCULTAR_ANIV", "simNao", "Ocultar aniversário na Agenda da equipe", { ajuda: "Marcado pelo RH quando a pessoa pede." }),
        c("planejamentoId", "PLANEJAMENTO_ID", "texto", "Planejamento da função (ID)"),
        c("carreira", "CARREIRA", "textoLongo", "Histórico de movimentações (Carreira)", { ajuda: "Uma linha por movimentação: data · de um nível para outro. Registrado pelo RH depois da calibração." }),
      ],
    },
    /* ---------------- 3.3.2 Feedbacks SCI ---------------- */
    {
      chave: "feedbacks", nome: "Feedbacks SCI", modulo: "Rotinas", pai: "membros",
      descricao: "Responsável = o membro. Autor do registro = a liderança. Editável nas primeiras 48 horas.",
      estagios: [
        { codigo: "NEW", nome: "Editável", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Registrado", cor: COR.verde },
        { codigo: "FAIL", nome: "Anulado", cor: COR.cinza },
      ],
      campos: [
        c("data", "DATA", "data", "Data em que aconteceu"),
        c("tipo", "TIPO", "lista", "Tipo", { opcoes: OPCOES.tipoFeedback }),
        c("situacao", "SITUACAO", "textoLongo", "Situação", { ajuda: "Quando e onde aconteceu. Só os fatos." }),
        c("comportamento", "COMPORTAMENTO", "textoLongo", "Comportamento", { ajuda: "O que a pessoa fez ou disse, de um jeito que outra pessoa também observaria." }),
        c("impacto", "IMPACTO", "textoLongo", "Impacto", { ajuda: "O efeito no resultado, na equipe ou no cliente." }),
        c("combinados", "COMBINADOS", "textoLongo", "Combinados"),
        c("retroativo", "RETROATIVO", "simNao", "Registro retroativo", { ajuda: "Feedback dado antes do app. Lançado pelo RH, com a evidência original anexada." }),
        c("evidencia", "EVIDENCIA", "arquivo", "Evidência original (registro retroativo)", { multiplo: true }),
        c("planoId", "PLANO_ID", "texto", "Plano de alinhamento (ID)"),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.3 Ciclo trimestral (1:1 e evidências) ---------------- */
    {
      chave: "ciclo", nome: "Ciclo trimestral", modulo: "Rotinas e Desempenho", pai: "membros",
      descricao: "Um item por membro ativo por trimestre, importado pelo RH no primeiro dia útil do trimestre.",
      estagios: [
        { codigo: "NEW", nome: "1:1 a agendar", cor: COR.amarelo },
        { codigo: "SEM_AGENDA", nome: "1:1 sem agendamento", cor: COR.vermelho },
        { codigo: "AGENDADO", nome: "1:1 agendado", cor: COR.azul },
        { codigo: "REALIZADO", nome: "1:1 realizado", cor: COR.azul },
        { codigo: "EVID_ATRASO", nome: "Evidências atrasadas", cor: COR.vermelho },
        { codigo: "SUCCESS", nome: "Evidências registradas", cor: COR.verde },
        { codigo: "FAIL", nome: "Cancelado", cor: COR.cinza },
      ],
      campos: [
        c("trimestre", "TRIMESTRE", "texto", "Trimestre", { ajuda: "Formato AAAA-TN, por exemplo 2026-T4." }),
        c("fimTrimestre", "FIM_TRI", "data", "Fim do trimestre"),
        c("prazoEvidencias", "PRAZO_EVID", "data", "Prazo das evidências", { ajuda: "Fim do trimestre + 15 dias." }),
        c("data1a1", "DATA_1A1", "data", "Data do 1:1"),
        c("link1a1", "LINK_1A1", "texto", "Horário e link do 1:1"),
        c("realizadoEm", "REALIZADO_EM", "data", "1:1 · data em que aconteceu"),
        c("combinadosAnteriores", "ANT_COMBINADOS", "textoLongo", "Combinados do 1:1 anterior"),
        c("anterior1", "ANT_STATUS_1", "lista", "Combinado anterior 1 · situação", { opcoes: OPCOES.combinadoAnterior }),
        c("anterior2", "ANT_STATUS_2", "lista", "Combinado anterior 2 · situação", { opcoes: OPCOES.combinadoAnterior }),
        c("anterior3", "ANT_STATUS_3", "lista", "Combinado anterior 3 · situação", { opcoes: OPCOES.combinadoAnterior }),
        c("temas", "TEMAS", "textoLongo", "Temas trazidos pelo membro"),
        c("objetivo", "OBJETIVO", "textoLongo", "Objetivo de desenvolvimento"),
        c("proximoNivel", "PROX_NIVEL", "texto", "Próximo nível"),
        c("progresso", "PROGRESSO", "lista", "Progresso no objetivo", { opcoes: OPCOES.progresso }),
        c("retorno", "RETORNO", "textoLongo", "Retorno para a liderança", { ajuda: "O que o membro pediu para a liderança fazer diferente." }),
        c("comb1Texto", "COMB_1_TEXTO", "texto", "Combinado 1"),
        c("comb1Resp", "COMB_1_RESP", "lista", "Combinado 1 · responsável", { opcoes: OPCOES.responsavelCombinado }),
        c("comb1Prazo", "COMB_1_PRAZO", "data", "Combinado 1 · prazo"),
        c("comb2Texto", "COMB_2_TEXTO", "texto", "Combinado 2"),
        c("comb2Resp", "COMB_2_RESP", "lista", "Combinado 2 · responsável", { opcoes: OPCOES.responsavelCombinado }),
        c("comb2Prazo", "COMB_2_PRAZO", "data", "Combinado 2 · prazo"),
        c("comb3Texto", "COMB_3_TEXTO", "texto", "Combinado 3"),
        c("comb3Resp", "COMB_3_RESP", "lista", "Combinado 3 · responsável", { opcoes: OPCOES.responsavelCombinado }),
        c("comb3Prazo", "COMB_3_PRAZO", "data", "Combinado 3 · prazo"),
        c("registro1a1Em", "REG_1A1_EM", "dataHora", "1:1 registrado em", { ajuda: "Os campos do 1:1 ficam somente leitura 48 horas depois." }),
        c("resultados", "RESULTADOS", "textoLongo", "Resultados do trimestre"),
        c("crescimento", "CRESCIMENTO", "textoLongo", "Evidências de crescimento", { ajuda: "O que a pessoa passou a fazer que antes não fazia." }),
        c("percepcoes", "PERCEPCOES", "textoLongo", "Percepções da liderança"),
        c("pontosAtencao", "PONTOS_ATENCAO", "textoLongo", "Pontos de atenção para o próximo trimestre"),
        c("classificacao", "CLASSIFICACAO", "lista", "Classificação do trimestre", { opcoes: OPCOES.classificacao }),
        c("numeros", "NUMEROS", "textoLongo", "Números do trimestre (Bitrix)", { ajuda: "Gravados no prazo das evidências. Não mudam depois." }),
        c("registroEvidEm", "REG_EVID_EM", "dataHora", "Evidências registradas em"),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.5.2 Planos de alinhamento de resultados ---------------- */
    {
      chave: "planos", nome: "Planos de alinhamento de resultados", modulo: "Offboarding", pai: "membros",
      descricao: "Criado pela liderança a partir do card do membro, logo depois do feedback de abertura. Termina no Dia 60.",
      estagios: [
        { codigo: "NEW", nome: "Em andamento", cor: COR.azul },
        { codigo: "CHECKIN_ATRASO", nome: "Check-in atrasado", cor: COR.vermelho },
        { codigo: "CHECKIN_OK", nome: "Check-in realizado", cor: COR.azul },
        { codigo: "ENC_PENDENTE", nome: "Encerramento pendente", cor: COR.amarelo },
        { codigo: "ENC_ATRASO", nome: "Encerramento atrasado", cor: COR.vermelho },
        { codigo: "SUCCESS", nome: "Resultados atingidos", cor: COR.verde },
        { codigo: "FAIL", nome: "Resultados não atingidos", cor: COR.cinza },
      ],
      campos: [
        c("feedbackAberturaId", "FB_ABERTURA_ID", "texto", "Feedback de abertura (ID)"),
        c("inicio", "INICIO", "data", "Data de início"),
        c("termino", "TERMINO", "data", "Data de término (Dia 60)", { ajuda: "Início + 59 dias." }),
        c("resultado1", "RESULTADO_1", "textoLongo", "Resultado esperado 1"),
        c("evidencia1", "EVIDENCIA_1", "textoLongo", "Evidência de atingimento 1"),
        c("resultado2", "RESULTADO_2", "textoLongo", "Resultado esperado 2"),
        c("evidencia2", "EVIDENCIA_2", "textoLongo", "Evidência de atingimento 2"),
        c("apoio", "APOIO", "textoLongo", "Apoio oferecido"),
        c("checkin1", "CHECKIN_1", "lista", "Check-in · resultado 1", { opcoes: OPCOES.checkin }),
        c("checkin2", "CHECKIN_2", "lista", "Check-in · resultado 2", { opcoes: OPCOES.checkin }),
        c("checkinComentario", "CHECKIN_COMENT", "textoLongo", "Check-in · comentário"),
        c("checkinData", "CHECKIN_DATA", "data", "Check-in · data"),
        c("feedbackEncerramentoId", "FB_ENCERRAMENTO_ID", "texto", "Feedback de encerramento (ID)"),
        c("final1", "FINAL_1", "lista", "Situação final · resultado 1", { opcoes: OPCOES.situacaoFinal }),
        c("final2", "FINAL_2", "lista", "Situação final · resultado 2", { opcoes: OPCOES.situacaoFinal }),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.5.3 Encerramentos de contrato ---------------- */
    {
      chave: "encerramentos", nome: "Encerramentos de contrato", modulo: "Offboarding", pai: "membros",
      descricao: "Nasce pelo formulário da coordenação ou a partir de um plano encerrado sem os resultados.",
      estagios: [
        { codigo: "NEW", nome: "Rascunho", cor: COR.cinza },
        { codigo: "AG_COORD", nome: "Aguardando coordenação", cor: COR.amarelo },
        { codigo: "BLOQUEADA", nome: "Bloqueada", cor: COR.vermelho },
        { codigo: "ENVIADA_RH", nome: "Enviada ao RH", cor: COR.azul },
        { codigo: "EM_ANALISE", nome: "Em análise", cor: COR.azul },
        { codigo: "APROVADA", nome: "Aprovada", cor: COR.verde },
        { codigo: "CONVERSA_OK", nome: "Conversa realizada", cor: COR.verde },
        { codigo: "POS", nome: "Acompanhamento pós-encerramento", cor: COR.verde },
        { codigo: "SUCCESS", nome: "Concluída", cor: COR.verde },
        { codigo: "FAIL", nome: "Cancelada", cor: COR.cinza },
      ],
      campos: [
        c("motivo", "MOTIVO", "lista", "Motivo", { opcoes: OPCOES.motivoEncerramento }),
        c("coordenacao", "COORDENACAO", "pessoa", "Coordenação responsável"),
        c("descricao", "DESCRICAO", "textoLongo", "Descrição do motivo", { ajuda: "Descreva fatos e resultados, com datas." }),
        c("justificativa", "JUSTIFICATIVA", "textoLongo", "Justificativa do fluxo abreviado"),
        c("dataDesejada", "DATA_DESEJADA", "data", "Data desejada de encerramento", { ajuda: "Solicite com pelo menos 7 dias e evite sextas-feiras." }),
        c("reposicao", "REPOSICAO", "lista", "Reposição da posição", { opcoes: OPCOES.reposicao }),
        c("planoId", "PLANO_ID", "texto", "Plano vinculado (ID)"),
        c("feedbacksIds", "FEEDBACKS_IDS", "texto", "Feedbacks vinculados (IDs)"),
        c("apoioRH", "APOIO_RH", "lista", "Deseja apoio do RH na conversa?", { opcoes: OPCOES.simNao }),
        c("dataConversa", "DATA_CONVERSA", "data", "Data da conversa"),
        c("origem", "ORIGEM", "lista", "Origem da solicitação", { opcoes: OPCOES.origemEncerramento }),
        c("solicitante", "SOLICITANTE", "pessoa", "Quem solicitou"),
        c("bloqueio", "BLOQUEIO", "textoLongo", "Motivo do bloqueio"),
        c("primeiraVerificacao", "PRIMEIRA_VERIF", "lista", "Resultado da 1ª verificação", { opcoes: OPCOES.primeiraVerificacao }),
        c("liberacaoRH", "LIBERACAO_RH", "textoLongo", "Liberação excepcional do RH (justificativa)"),
        c("enviadaRHEm", "ENVIADA_RH_EM", "data", "Enviada ao RH em"),
        c("concluidaEm", "CONCLUIDA_EM", "data", "Concluída em"),
        c("motivoSaida", "MOTIVO_SAIDA", "texto", "Motivo de saída (conversa de saída)", { ajuda: "Preenchido pelo RH depois da conversa de saída." }),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.2 Onboarding Embarcação Amorim ---------------- */
    {
      chave: "onboarding", nome: "Onboarding", modulo: "Onboarding", pai: "membros",
      descricao: "Primeiros 90 dias do novo membro, em 4 fases e 3 alinhamentos.",
      estagios: [
        { codigo: "NEW", nome: "Preparação", cor: COR.cinza },
        { codigo: "ANCORAGEM", nome: "Ancoragem", cor: COR.azul },
        { codigo: "IMERSAO", nome: "Imersão", cor: COR.azul },
        { codigo: "MAR_ABERTO", nome: "Mar Aberto", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Concluído", cor: COR.verde },
        { codigo: "FAIL", nome: "Interrompido", cor: COR.cinza },
      ],
      campos: [
        c("ingresso", "INGRESSO", "data", "Dia 1 (data de ingresso)"),
        c("senioridade", "SENIORIDADE", "lista", "Senioridade", { opcoes: OPCOES.senioridade }),
        c("supervisao", "SUPERVISAO", "pessoa", "Supervisão (a Bússola)"),
        c("colega", "COLEGA", "pessoa", "Colega de trabalho (o Mapa)"),
        c("planejamentoId", "PLANEJAMENTO_ID", "texto", "Planejamento da função (ID)"),
        c("fichaEscopo", "FICHA_ESCOPO", "textoLongo", "Ficha · escopo da função"),
        c("fichaPadroes", "FICHA_PADROES", "textoLongo", "Ficha · padrões"),
        c("fichaIndicadores", "FICHA_INDICADORES", "textoLongo", "Ficha · indicadores"),
        c("entregasAncoragem", "ENTREGAS_ANC", "textoLongo", "Entregas da Ancoragem (semanas 3 e 4)"),
        c("entregasImersao", "ENTREGAS_IME", "textoLongo", "Entregas da Imersão"),
        c("entregasMarAberto", "ENTREGAS_MAR", "textoLongo", "Entregas do Mar Aberto"),
        c("fichaEm", "FICHA_EM", "data", "Ficha preenchida em"),
        c("entregasPlanejadasEm", "ENTREGAS_PLAN_EM", "data", "Entregas das semanas 3 e 4 planejadas em"),
        ...[1, 2, 3].flatMap((n) => {
          const nome = n === 3 ? "Alinhamento final" : "Alinhamento " + n;
          return [
            c("al" + n + "Data", "AL" + n + "_DATA", "data", nome + " · data"),
            c("al" + n + "Nota", "AL" + n + "_NOTA", "numero", nome + " · nota da fase"),
            c("al" + n + "Resultado", "AL" + n + "_RESULTADO", "lista", nome + " · resultado da fase", { opcoes: OPCOES.resultadoFase }),
            c("al" + n + "Retorno", "AL" + n + "_RETORNO", "textoLongo", nome + " · retorno em SCI"),
            c("al" + n + "Combinados", "AL" + n + "_COMBINADOS", "textoLongo", nome + " · combinados"),
          ];
        }),
        c("continuidade", "CONTINUIDADE", "lista", "Continuidade (Dia 90, decidida com o RH)", { opcoes: OPCOES.continuidade }),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.4 Leituras de entrega ---------------- */
    {
      chave: "leituras", nome: "Leituras de entrega", modulo: "Desempenho e Onboarding", pai: "membros",
      descricao: "Leitura interna da entrega. Fica fora do alcance do membro: nunca vai para o comentário da tarefa.",
      estagios: [
        { codigo: "NEW", nome: "Aguardando leitura", cor: COR.amarelo },
        { codigo: "ATRASADA", nome: "Leitura atrasada", cor: COR.vermelho },
        { codigo: "SUCCESS", nome: "Lida", cor: COR.verde },
        { codigo: "FAIL", nome: "Cancelada", cor: COR.cinza },
      ],
      campos: [
        c("tarefaId", "TAREFA_ID", "texto", "Tarefa (ID)"),
        c("tarefaLink", "TAREFA_LINK", "texto", "Link da tarefa"),
        c("prontaQuando", "PRONTA_QUANDO", "textoLongo", "Pronta quando"),
        c("prazoTarefa", "PRAZO_TAREFA", "data", "Prazo da tarefa"),
        c("concluidaEm", "CONCLUIDA_EM", "data", "Concluída em"),
        c("noPrazo", "NO_PRAZO", "lista", "No prazo", { opcoes: OPCOES.simNao }),
        c("ajustes", "AJUSTES", "numero", "Voltou para ajuste (vezes)"),
        c("complexidade", "COMPLEXIDADE", "lista", "Complexidade", { opcoes: OPCOES.complexidade }),
        c("origem", "ORIGEM", "lista", "Origem", { opcoes: OPCOES.origemLeitura }),
        c("fase", "FASE", "lista", "Fase do onboarding", { opcoes: OPCOES.fase }),
        c("planoId", "PLANO_ID", "texto", "Plano de alinhamento (ID)"),
        c("onboardingId", "ONBOARDING_ID", "texto", "Onboarding (ID)"),
        c("trimestre", "TRIMESTRE", "texto", "Trimestre", { ajuda: "Formato AAAA-TN." }),
        c("leitura", "LEITURA", "lista", "Leitura", { opcoes: OPCOES.leitura, ajuda: "Conforme 100 · Com ajuste 70 · Fora do padrão 30 · Não entregue 0." }),
        c("comentario", "COMENTARIO", "textoLongo", "Comentário interno"),
        c("prazoLeitura", "PRAZO_LEITURA", "data", "Prazo da leitura"),
        c("lidaEm", "LIDA_EM", "data", "Lida em"),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.2 Planejamento da função ---------------- */
    {
      chave: "planejamento", nome: "Planejamento da função", modulo: "Onboarding", pai: null,
      descricao: "Feito uma vez por função. Vira o modelo da Ficha do membro a cada nova contratação.",
      estagios: [
        { codigo: "NEW", nome: "Em elaboração", cor: COR.amarelo },
        { codigo: "SUCCESS", nome: "Publicado", cor: COR.verde },
        { codigo: "FAIL", nome: "Arquivado", cor: COR.cinza },
      ],
      campos: [
        c("funcao", "FUNCAO", "texto", "Função"),
        c("area", "AREA", "texto", "Setor e área"),
        c("escopo", "ESCOPO", "textoLongo", "Escopo"),
        c("padroes", "PADROES", "textoLongo", "Padrões"),
        c("indicadores", "INDICADORES", "textoLongo", "Indicadores"),
        c("entregasAncoragem", "ENTREGAS_ANC", "textoLongo", "Entregas da Ancoragem"),
        c("entregasImersao", "ENTREGAS_IME", "textoLongo", "Entregas da Imersão"),
        c("entregasMarAberto", "ENTREGAS_MAR", "textoLongo", "Entregas do Mar Aberto"),
      ],
    },
    /* ---------------- 3.1 Avaliação de finalistas (Recrutamento) ---------------- */
    {
      chave: "finalistas", nome: "Avaliações de finalistas", modulo: "Recrutamento", pai: "negocio",
      descricao: "Criada quando o RH move um candidato para Finalistas. Fica ligada ao negócio da vaga.",
      estagios: [
        { codigo: "NEW", nome: "Aguardando parecer", cor: COR.amarelo },
        { codigo: "ATRASADO", nome: "Parecer atrasado", cor: COR.vermelho },
        { codigo: "SUCCESS", nome: "Parecer registrado", cor: COR.verde },
        { codigo: "FAIL", nome: "Cancelada", cor: COR.cinza },
      ],
      campos: [
        c("candidato", "CANDIDATO", "texto", "Candidato"),
        c("lideranca", "LIDERANCA", "pessoa", "Liderança que avalia"),
        c("parecerRH", "PARECER_RH", "textoLongo", "Parecer do RH"),
        c("parecer", "PARECER", "lista", "Parecer da liderança", { opcoes: OPCOES.parecerFinalista }),
        c("pontos", "PONTOS", "textoLongo", "Pontos fortes e pontos de atenção", { ajuda: "O que a liderança viu na entrevista." }),
        c("prazo", "PRAZO", "data", "Prazo do parecer", { ajuda: "5 dias úteis depois da entrada em Finalistas." }),
      ],
    },
  ];

  const ENTITY_TYPE_NEGOCIO = 2; // pai do processo de finalistas: o negócio da vaga

  /* ---------- códigos ---------- */
  function nomeCampo(typeId, sufixo) { return "UF_CRM_" + typeId + "_" + sufixo; }
  /** UF_CRM_41_DATA_INGRESSO -> ufCrm41DataIngresso (formato da API crm.item.*) */
  function camelDoCampo(nomeMaiusculo) {
    return String(nomeMaiusculo).split("_").map((p, i) => {
      const l = p.toLowerCase();
      return i === 0 ? l : l.charAt(0).toUpperCase() + l.slice(1);
    }).join("");
  }
  function codigoCampo(typeId, sufixo) { return camelDoCampo(nomeCampo(typeId, sufixo)); }
  function processo(chave) { return PROCESSOS.find((p) => p.chave === chave); }
  function tituloProcesso(p) { return PREFIXO_TITULO + p.nome; }

  return {
    COR, PREFIXO_TITULO, SOLUCAO, OPCOES, PROCESSOS, ENTITY_TYPE_NEGOCIO,
    nomeCampo, camelDoCampo, codigoCampo, processo, tituloProcesso,
  };
});
