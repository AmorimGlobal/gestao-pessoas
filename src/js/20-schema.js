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
    // Políticas de Férias e Ausências do RH (04/11/2026)
    tipoAusencia: ["Férias", "Day off", "Pausa contratual"],
    motivoDayOff: ["Aniversário", "Desempenho", "Campanha institucional"],
    decisao: ["Aprovada", "Recusada"],
    abrangenciaFeriado: ["Todos", "São Paulo (SP)", "Salvador (BA)"],
    // Revisões semanais (alinhamento pelo WhatsApp, 04/11/2026)
    papelSemanal: ["Membro", "Liderança"],
    // Revisão de Progresso (protótipo do RH, 05/11/2026)
    relacao360: ["Superior", "Par"],
    modo360: ["Anônima", "Identificada"],
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
        // CIDADE_FER, e não CIDADE_REF: a 1ª tentativa no portal (21/10/2026) falhou no meio e deixou o nome
        // UF_CRM_57_CIDADE_REF preso no Bitrix (qualquer outro nome é aceito com o mesmo conteúdo)
        c("cidade", "CIDADE_FER", "lista", "Cidade de referência para feriados", { opcoes: OPCOES.cidade, ajuda: "Salvador (BA) para quem mora na Bahia. São Paulo (SP) para todos os outros." }),
        c("ocultarAniversario", "OCULTAR_ANIV", "simNao", "Ocultar aniversário na Agenda da equipe", { ajuda: "Marcado pelo RH quando a pessoa pede." }),
        c("planejamentoId", "PLANEJAMENTO_ID", "texto", "Planejamento da função (ID)"),
        c("carreira", "CARREIRA", "textoLongo", "Histórico de movimentações (Carreira)", { ajuda: "Uma linha por movimentação: data · de um nível para outro. Registrado pelo RH depois da calibração." }),
        c("cargoMatriz", "CARGO_MATRIZ", "texto", "Cargo na matriz da Revisão de Progresso", { ajuda: "Código do cargo (C01 a C40) na matriz de KPIs e competências. O nome de cada cargo fica em Configuração → Revisão de Progresso." }),
      ],
    },
    /* ---------------- 3.3.2 Feedbacks SCI ---------------- */
    {
      chave: "feedbacks", nome: "Feedbacks SCI", modulo: "Feedbacks", pai: "membros",
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
    /* ---------------- 1:1 mensal (reunião de 29/10/2026) ---------------- */
    {
      chave: "mensal", nome: "1:1 mensais", modulo: "Feedbacks", pai: "membros",
      descricao: "Conversa breve do mês, de cerca de 20 minutos: como o membro está, se precisa de apoio e o que foi combinado. Registra o que aconteceu, sem agendamento.",
      estagios: [
        { codigo: "NEW", nome: "Registrado", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Concluído", cor: COR.verde },
        { codigo: "FAIL", nome: "Anulado", cor: COR.cinza },
      ],
      campos: [
        c("data", "DATA", "data", "Data em que aconteceu"),
        c("comoEsta", "COMO_ESTA", "textoLongo", "Como o membro está"),
        c("apoio", "APOIO", "textoLongo", "Precisa de apoio em algo?"),
        c("pontos", "PONTOS", "textoLongo", "Principais pontos da conversa"),
        c("combinados", "COMBINADOS", "textoLongo", "Combinados"),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.3 Ciclo trimestral (O2O; as evidências ficaram para 2027) ---------------- */
    {
      chave: "ciclo", nome: "Ciclo trimestral", modulo: "Feedbacks (O2O)", pai: "membros",
      descricao: "Um item por membro ativo por trimestre, criado pelo RH no primeiro dia útil do trimestre. Guarda o O2O, a sessão de desenvolvimento do início do trimestre.",
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
      chave: "planos", nome: "Planos de alinhamento de resultados", modulo: "Feedbacks (plano de melhoria)", pai: "membros",
      descricao: "O plano de melhoria: aberto pela liderança no módulo Feedbacks, com 2 resultados esperados. Check-in no Dia 30 e término no Dia 60.",
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
        // o sufixo continua PADROES: desde 29/10/2026 o conteúdo são as competências comportamentais
        c("fichaPadroes", "FICHA_PADROES", "textoLongo", "Ficha · competências comportamentais"),
        c("fichaIndicadores", "FICHA_INDICADORES", "textoLongo", "Ficha · indicadores"),
        c("entregasAncoragem", "ENTREGAS_ANC", "textoLongo", "Entregas da Ancoragem (semanas 3 e 4)"),
        c("entregasImersao", "ENTREGAS_IME", "textoLongo", "Entregas da Imersão"),
        c("entregasMarAberto", "ENTREGAS_MAR", "textoLongo", "Entregas do Mar Aberto"),
        c("fichaEm", "FICHA_EM", "data", "Ficha preenchida em"),
        c("fichaEnviadaEm", "FICHA_ENVIADA_EM", "dataHora", "Ficha enviada ao membro em", { ajuda: "O membro recebe a Ficha por e-mail. As notas e as justificativas das avaliações nunca vão para ele." }),
        c("entregasPlanejadasEm", "ENTREGAS_PLAN_EM", "data", "Entregas das semanas 3 e 4 planejadas em"),
        // Avaliações do 1º, 2º e 3º mês (Ancoragem, Imersão e Mar Aberto). Desde 29/10/2026 o "retorno"
        // guarda a justificativa da nota: fica com a liderança e o RH, nunca vai para o membro.
        ...[1, 2, 3].flatMap((n) => {
          const nome = n === 3 ? "Alinhamento final" : "Alinhamento " + n;
          return [
            c("al" + n + "Data", "AL" + n + "_DATA", "data", nome + " · data"),
            c("al" + n + "Nota", "AL" + n + "_NOTA", "numero", nome + " · nota da fase"),
            c("al" + n + "Resultado", "AL" + n + "_RESULTADO", "lista", nome + " · resultado da fase", { opcoes: OPCOES.resultadoFase }),
            c("al" + n + "Retorno", "AL" + n + "_RETORNO", "textoLongo", nome + " · justificativa da nota"),
            c("al" + n + "Combinados", "AL" + n + "_COMBINADOS", "textoLongo", nome + " · combinados"),
          ];
        }),
        c("continuidade", "CONTINUIDADE", "lista", "Continuidade (Dia 90, decidida com o RH)", { opcoes: OPCOES.continuidade }),
        autor(), adendos(),
      ],
    },
    /* ---------------- 3.4 Leituras de entrega ---------------- */
    {
      chave: "leituras", nome: "Leituras de entrega", modulo: "Onboarding", pai: "membros",
      descricao: "Entregas avaliadas na régua (Conforme 100, Com ajuste 70, Fora do padrão 30, Não entregue 0). Leitura interna: o membro não vê.",
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
        c("padroes", "PADROES", "textoLongo", "Competências comportamentais", { ajuda: "Uma por linha, escolhidas no glossário do RH ou acrescentadas pela liderança." }),
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
    /* ---------------- Férias e ausências (Políticas de Férias e Ausências, 04/11/2026) ---------------- */
    {
      chave: "ferias", nome: "Férias e ausências", modulo: "Férias e ausências", pai: null,
      descricao: "Pedidos de férias, day off e pausa contratual feitos no app pela própria pessoa, e ausências que o RH registra direto. Responsável = quem fica ausente. O RH analisa e depois a liderança direta confirma; cada item da etapa Aprovada aparece na Agenda da equipe.",
      // 05/11/2026: o pedido e a aprovação voltaram para o app (pedido do usuário). Pedido do app = tem "Regras lidas em";
      // sem ele, é ausência que o RH registrou direto, já em "Aprovada".
      estagios: [
        { codigo: "NEW", nome: "Aguardando o RH", cor: COR.azul },
        { codigo: "AG_LIDERANCA", nome: "Aguardando a liderança", cor: COR.amarelo },
        { codigo: "SUCCESS", nome: "Aprovada", cor: COR.verde },
        { codigo: "FAIL", nome: "Recusada ou cancelada", cor: COR.cinza },
      ],
      campos: [
        c("tipo", "TIPO", "lista", "Tipo", { opcoes: OPCOES.tipoAusencia }),
        c("motivoDayOff", "MOTIVO_DAYOFF", "lista", "Day off · motivo", { opcoes: OPCOES.motivoDayOff }),
        c("inicio", "INICIO", "data", "Primeiro dia"),
        c("fim", "FIM", "data", "Último dia"),
        c("dias", "DIAS", "numero", "Dias corridos"),
        // protótipo do RH (06/11/2026): cada pessoa escolhe uma das duas semanas de férias coletivas do fim de ano
        c("coletiva", "COLETIVA", "simNao", "Semana de férias coletivas", { ajuda: "A semana do fim de ano que a pessoa escolheu (a do Natal ou a do Ano Novo). Não conta nos 23 dias nem na regra da equipe." }),
        c("cobertura", "COBERTURA", "textoLongo", "Cobertura das atividades no período"),
        c("justificativa", "JUSTIFICATIVA", "textoLongo", "Justificativa"),
        c("foraDaPolitica", "FORA_POLITICA", "textoLongo", "Pontos fora da política", { ajuda: "O que o app apontou na hora do pedido. A justificativa de quem pediu explica cada um." }),
        c("regrasLidasEm", "REGRAS_LIDAS_EM", "dataHora", "Regras lidas em"),
        c("emailEnviadoEm", "EMAIL_EM", "dataHora", "E-mail ao RH enviado em", { ajuda: "Marcado por quem pediu depois de enviar o e-mail para hr@amorimlawfirm.com com cópia à liderança." }),
        c("lideranca", "LIDERANCA", "pessoa", "Liderança direta"),
        c("rhDecisao", "RH_DECISAO", "lista", "Decisão do RH", { opcoes: OPCOES.decisao }),
        c("rhEm", "RH_EM", "dataHora", "RH respondeu em"),
        c("rhComentario", "RH_COMENTARIO", "textoLongo", "Comentário do RH"),
        c("liderancaDecisao", "LID_DECISAO", "lista", "Decisão da liderança", { opcoes: OPCOES.decisao }),
        c("liderancaEm", "LID_EM", "dataHora", "Liderança respondeu em"),
        c("liderancaComentario", "LID_COMENTARIO", "textoLongo", "Comentário da liderança"),
        c("canceladaEm", "CANCELADA_EM", "dataHora", "Cancelada por quem pediu em"),
        autor(), adendos(),
      ],
    },
    /* ---------------- Feriados da empresa (o RH cadastra; Políticas, parte IV) ---------------- */
    {
      chave: "feriados", nome: "Feriados", modulo: "Agenda da equipe", pai: null,
      descricao: "Calendário de feriados da empresa, cadastrado pelo RH a cada ano: o que vale para todos e o que vale só para quem segue São Paulo ou Salvador. Um ano com itens aqui substitui a lista oficial que o app usa.",
      estagios: [
        { codigo: "NEW", nome: "Cadastrado", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Publicado", cor: COR.verde },
        { codigo: "FAIL", nome: "Descartado", cor: COR.cinza },
      ],
      campos: [
        c("data", "DATA", "data", "Data"),
        c("abrangencia", "ABRANGENCIA", "lista", "Vale para", { opcoes: OPCOES.abrangenciaFeriado }),
        c("considera", "CONSIDERA", "simNao", "A empresa considera", { ajuda: "Desmarcado: a data aparece no calendário, mas é dia útil na Amorim (por exemplo, um ponto facultativo)." }),
        c("observacao", "OBSERVACAO", "texto", "Observação"),
      ],
    },
    /* ---------------- Revisões semanais: o alinhamento pelo WhatsApp (app-gestao-semanal), 04/11/2026 ---------------- */
    {
      chave: "semanal", nome: "Revisões semanais", modulo: "Feedbacks", pai: "membros",
      descricao: "As respostas de cada pessoa ao alinhamento semanal pelo WhatsApp (app de gestão semanal), uma por semana. A rotina das 6h guarda as respostas, porque o app semanal apaga tudo a cada ciclo novo. Responsável = quem respondeu.",
      estagios: [
        { codigo: "NEW", nome: "Guardada", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Lida", cor: COR.verde },
        { codigo: "FAIL", nome: "Descartada", cor: COR.cinza },
      ],
      campos: [
        c("semana", "SEMANA", "data", "Semana (a sexta-feira)", { ajuda: "A sexta-feira da semana de trabalho a que as respostas se referem." }),
        c("papel", "PAPEL", "lista", "Respondeu como", { opcoes: OPCOES.papelSemanal }),
        c("respostas", "RESPOSTAS", "textoLongo", "Perguntas e respostas"),
        c("respondidas", "RESPONDIDAS", "numero", "Perguntas respondidas"),
        c("guardadaEm", "GUARDADA_EM", "dataHora", "Guardada em"),
        c("origem", "ORIGEM", "texto", "Chave no app semanal", { ajuda: "Quem respondeu e a semana: assim a rotina não guarda a mesma revisão duas vezes." }),
      ],
    },

    /* ================= Revisão de Progresso (protótipo do RH "Revisao_de_Progresso_Prototipo.html", 05/11/2026) =================
       Ciclos abertos pelo RH em junho e novembro. As respostas longas (KPIs, competências, ajustes, conclusão, PDI)
       ficam em JSON num campo de texto: o formulário muda com o cargo e não cabe em campos fixos. */
    {
      chave: "revCiclos", nome: "Revisão · Ciclos", modulo: "Revisão de Progresso", pai: null,
      descricao: "Os ciclos da Revisão de Progresso que o RH abre (junho e novembro): período avaliado, prazos de cada etapa, quem participa e as regras da 360° e do anonimato.",
      estagios: [
        { codigo: "NEW", nome: "Rascunho", cor: COR.cinza },
        { codigo: "ABERTO", nome: "Aberto", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Encerrado", cor: COR.verde },
        { codigo: "FAIL", nome: "Cancelado", cor: COR.cinza },
      ],
      campos: [
        c("ciclo", "CICLO", "texto", "Ciclo", { ajuda: "Ex.: Novembro 2026 · inaugural (anual)." }),
        c("periodoInicio", "PERIODO_INICIO", "data", "Início do período avaliado"),
        c("periodoFim", "PERIODO_FIM", "data", "Fim do período avaliado"),
        c("dataAbertura", "DATA_ABERTURA", "data", "Data de abertura"),
        c("prazoAuto", "PRAZO_AUTO", "data", "Autoavaliação do membro até"),
        c("prazoLideranca", "PRAZO_LIDERANCA", "data", "Avaliação da liderança até"),
        c("prazoCalibracao", "PRAZO_CALIBRACAO", "data", "Calibração até"),
        c("prazoDevolutiva", "PRAZO_DEVOLUTIVA", "data", "Devolutivas das lideranças até"),
        c("prazoRetornos", "PRAZO_RETORNOS", "data", "Retornos do RH até"),
        c("regras", "REGRAS", "textoLongo", "Regras do ciclo", { ajuda: "Gravado pelo app: público, exceções, 360° liberada, mínimos de respostas, regra abaixo do mínimo, retornos e conferências." }),
        c("mensagem", "MENSAGEM", "textoLongo", "Mensagem para as lideranças"),
        autor(),
      ],
    },
    {
      chave: "revAvaliacoes", nome: "Revisão · Avaliações da liderança", modulo: "Revisão de Progresso", pai: "membros",
      descricao: "A avaliação da liderança direta para cada liderado (KPIs e competências do cargo, conclusão, perguntas de decisão), a calibração do RH e o PDI. Responsável = a liderança que avalia (o membro nunca é dono do item). Fica com a liderança e o RH: o membro não lê.",
      estagios: [
        { codigo: "NEW", nome: "Rascunho", cor: COR.cinza },
        { codigo: "ENVIADA", nome: "Enviada ao RH", cor: COR.azul },
        { codigo: "CALIBRADA", nome: "Calibrada", cor: COR.amarelo },
        { codigo: "DEVOLUTIVA", nome: "Devolutiva feita", cor: COR.verde },
        { codigo: "SUCCESS", nome: "Concluída", cor: COR.verde },
        { codigo: "FAIL", nome: "Descartada", cor: COR.cinza },
      ],
      campos: [
        c("cicloId", "CICLO_ID", "texto", "Ciclo (ID)", { ajuda: "Vazio enquanto é rascunho fora do ciclo." }),
        c("cargo", "CARGO", "texto", "Cargo na matriz"),
        c("avaliador", "AVALIADOR", "pessoa", "Liderança que avalia"),
        c("avaliacao", "AVALIACAO", "textoLongo", "Avaliação da liderança", { ajuda: "Gravado pelo app: KPIs, competências, ajustes, itens novos, conclusão e perguntas de decisão." }),
        c("enviadaEm", "ENVIADA_EM", "dataHora", "Enviada ao RH em"),
        c("calibracao", "CALIBRACAO", "textoLongo", "Calibração (RH)", { ajuda: "Gravado pelo app: houve ajuste, data, detalhe." }),
        c("calibradaEm", "CALIBRADA_EM", "dataHora", "Calibrada em"),
        c("pdi", "PDI", "textoLongo", "PDI e promoção (só o RH)", { ajuda: "Gravado pelo app: até 3 ações do PDI e a indicação de elegibilidade para promoção." }),
        c("devolutivaEm", "DEVOLUTIVA_EM", "data", "Data da devolutiva"),
        autor(),
      ],
    },
    {
      chave: "revAutoavaliacoes", nome: "Revisão · Autoavaliações", modulo: "Revisão de Progresso", pai: "membros",
      descricao: "A autoavaliação do membro (5 perguntas). Responsável = o membro. Quem lê: a liderança direta (só depois de enviar a própria avaliação) e o RH. Depois de enviada, o membro não edita mais.",
      estagios: [
        { codigo: "NEW", nome: "Rascunho", cor: COR.cinza },
        { codigo: "SUCCESS", nome: "Enviada", cor: COR.verde },
        { codigo: "FAIL", nome: "Descartada", cor: COR.cinza },
      ],
      campos: [
        c("cicloId", "CICLO_ID", "texto", "Ciclo (ID)"),
        c("auto1", "AUTO_1", "textoLongo", "Quais foram minhas 3 principais entregas do período, com evidência?"),
        c("auto2", "AUTO_2", "textoLongo", "O que eu fiz melhor do que esperava?"),
        c("auto3", "AUTO_3", "textoLongo", "Onde eu fiquei abaixo do combinado e por quê?"),
        c("auto4", "AUTO_4", "textoLongo", "O que eu preciso da minha liderança ou da empresa para entregar mais?"),
        c("auto5", "AUTO_5", "textoLongo", "O que eu quero desenvolver no próximo semestre?"),
        c("enviadaEm", "ENVIADA_EM", "dataHora", "Enviada em"),
      ],
    },
    {
      chave: "rev360", nome: "Revisão · Respostas 360°", modulo: "Revisão de Progresso", pai: null,
      descricao: "Respostas da avaliação 360° (superiores e pares). Só o RH lê. A resposta anônima é gravada pelo servidor (webhook), sem autor; na identificada, quem respondeu fica no campo próprio, visível só para o RH. Sem vínculo com quem respondeu nem com o controle de quem já respondeu.",
      estagios: [
        { codigo: "NEW", nome: "Recebida", cor: COR.azul },
        { codigo: "FAIL", nome: "Descartada", cor: COR.cinza },
      ],
      campos: [
        c("cicloId", "CICLO_ID", "texto", "Ciclo (ID)"),
        c("avaliado", "AVALIADO", "pessoa", "Pessoa avaliada"),
        c("relacao", "RELACAO", "lista", "Quem respondeu é", { opcoes: OPCOES.relacao360, ajuda: "Superior: liderado avaliando a liderança. Par: mesma liderança direta." }),
        c("modo", "MODO", "lista", "Modo", { opcoes: OPCOES.modo360 }),
        c("identificadoPor", "IDENTIFICADO_POR", "pessoa", "Quem respondeu (só na identificada)"),
        c("area", "AREA", "texto", "Área da pessoa avaliada", { ajuda: "Para juntar grupos abaixo do mínimo de respostas." }),
        c("respostas", "RESPOSTAS", "textoLongo", "Respostas", { ajuda: "Gravado pelo servidor: as 8 afirmações e os textos (continuar, começar, exemplo)." }),
      ],
    },
    {
      chave: "revRetornos", nome: "Revisão · Retornos", modulo: "Revisão de Progresso", pai: "membros",
      descricao: "O que chega ao membro: a devolutiva da liderança (pontos em palavras e metas do próximo semestre), a ciência dele e o retorno do RH em temas. Responsável = o membro, que lê e confirma a ciência.",
      estagios: [
        { codigo: "NEW", nome: "Aguardando devolutiva", cor: COR.cinza },
        { codigo: "DEVOLUTIVA", nome: "Devolutiva registrada", cor: COR.azul },
        { codigo: "SUCCESS", nome: "Ciência confirmada", cor: COR.verde },
        { codigo: "FAIL", nome: "Descartado", cor: COR.cinza },
      ],
      campos: [
        c("cicloId", "CICLO_ID", "texto", "Ciclo (ID)"),
        c("devolutivaEm", "DEVOLUTIVA_EM", "data", "Data da devolutiva"),
        c("fortes", "FORTES", "textoLongo", "Pontos fortes combinados"),
        c("desenvolver", "DESENVOLVER", "textoLongo", "Pontos de desenvolvimento combinados"),
        c("metas", "METAS", "textoLongo", "Metas e entregas do próximo semestre", { ajuda: "Gravado pelo app: até 3 metas (tipo, descrição, prazo, indicador)." }),
        c("cienciaEm", "CIENCIA_EM", "dataHora", "Ciência confirmada em", { ajuda: "Ciência, não concordância." }),
        c("retornoPares", "RETORNO_PARES", "textoLongo", "Retorno do RH sobre os pares", { ajuda: "Resumo em temas, sem nomes e sem trechos literais. Só com respostas suficientes." }),
        c("retornoParesEm", "RETORNO_PARES_EM", "data", "Retorno dos pares em"),
        c("retornoLideradosEm", "RETORNO_LIDERADOS_EM", "data", "Conversa do RH sobre os liderados em"),
      ],
    },
  ];

  const ENTITY_TYPE_NEGOCIO = 2; // pai do processo de finalistas: o negócio da vaga

  /* ---------------- Solicitação de promoção (05/11/2026): campos do negócio no funil de vagas ----------------
     Pedido do usuário: a liderança direta ou a coordenação pede pelo app, a coordenação e o RH aprovam, e o card
     cai no mesmo funil da requisição de vagas (77). São campos de negócio, que valem para todos os funis: nenhum
     é obrigatório no Bitrix (a obrigatoriedade fica no formulário do app) e todos são texto, data ou pessoa, sem
     lista, para o app ler e gravar sem traduzir opções. FIELD_NAME tem no máximo 20 caracteres (UF_CRM_ incluído).
     tipo: linha | texto (várias linhas) | data | pessoa. O "Criar ou completar a estrutura" cria o que falta. */
  const CAMPOS_PROMOCAO = [
    ["UF_CRM_PR_MEMBRO", "Promoção: membro indicado", "pessoa"],
    ["UF_CRM_PR_SOLICIT", "Promoção: quem pediu", "pessoa"],
    ["UF_CRM_PR_COORD", "Promoção: coordenação que aprova", "pessoa", "Vazio quando a própria coordenação pediu ou quando o membro não tem coordenação na estrutura."],
    ["UF_CRM_PR_ATUAL", "Promoção: cargo e área atuais", "linha"],
    ["UF_CRM_PR_NIVEL_ATU", "Promoção: nível atual", "linha"],
    ["UF_CRM_PR_NIVEL", "Promoção: nível proposto", "linha"],
    ["UF_CRM_PR_SENIOR", "Promoção: senioridade proposta", "linha"],
    ["UF_CRM_PR_CARGO", "Promoção: novo cargo ou função", "linha"],
    ["UF_CRM_PR_DATA", "Promoção: data sugerida", "data"],
    ["UF_CRM_PR_REMUN", "Promoção: vem com reajuste salarial?", "linha"],
    ["UF_CRM_PR_REAJUSTE", "Promoção: reajuste sugerido", "linha"],
    ["UF_CRM_PR_MOTIVO", "Promoção: por que agora", "texto"],
    ["UF_CRM_PR_RESULT", "Promoção: resultados e entregas", "texto"],
    ["UF_CRM_PR_RESPONS", "Promoção: responsabilidades do novo nível que já assume", "texto"],
    ["UF_CRM_PR_COMPET", "Promoção: competências que se destacam", "texto"],
    ["UF_CRM_PR_DESENV", "Promoção: o que desenvolver e como apoiar", "texto"],
    ["UF_CRM_PR_IMPACTO", "Promoção: atividades atuais", "linha"],
    ["UF_CRM_PR_IMPAC_DSC", "Promoção: como fica a operação", "texto"],
    ["UF_CRM_PR_CIENTE", "Promoção: a pessoa já sabe?", "linha"],
    ["UF_CRM_PR_OBS", "Promoção: observações", "texto"],
    ["UF_CRM_PR_COORD_DEC", "Promoção: decisão da coordenação", "linha"],
    ["UF_CRM_PR_COORD_EM", "Promoção: data da decisão da coordenação", "data"],
    ["UF_CRM_PR_COORD_OBS", "Promoção: comentário da coordenação", "texto"],
    ["UF_CRM_PR_RH_DEC", "Promoção: decisão do RH", "linha"],
    ["UF_CRM_PR_RH_POR", "Promoção: quem decidiu no RH", "pessoa"],
    ["UF_CRM_PR_RH_EM", "Promoção: data da decisão do RH", "data"],
    ["UF_CRM_PR_RH_OBS", "Promoção: comentário do RH", "texto"],
    ["UF_CRM_PR_VIGENCIA", "Promoção: vale a partir de", "data"],
  ].map(([codigo, rotulo, tipo, ajuda]) => ({ codigo, rotulo, tipo, ajuda: ajuda || "" }));
  /** Seções do card do funil de vagas para as promoções (o layout do card só mostra o que está nele) */
  const SECOES_PROMOCAO = [
    { name: "user_prpedido", title: "Promoção: pedido e proposta", campos: ["UF_CRM_PR_MEMBRO", "UF_CRM_PR_SOLICIT", "UF_CRM_PR_COORD", "UF_CRM_PR_ATUAL", "UF_CRM_PR_NIVEL_ATU",
      "UF_CRM_PR_NIVEL", "UF_CRM_PR_SENIOR", "UF_CRM_PR_CARGO", "UF_CRM_PR_DATA", "UF_CRM_PR_REMUN", "UF_CRM_PR_REAJUSTE", "UF_CRM_PR_CIENTE"] },
    { name: "user_prjustif", title: "Promoção: justificativa", campos: ["UF_CRM_PR_MOTIVO", "UF_CRM_PR_RESULT", "UF_CRM_PR_RESPONS", "UF_CRM_PR_COMPET", "UF_CRM_PR_DESENV",
      "UF_CRM_PR_IMPACTO", "UF_CRM_PR_IMPAC_DSC", "UF_CRM_PR_OBS"] },
    { name: "user_prdecisao", title: "Promoção: aprovações", campos: ["UF_CRM_PR_COORD_DEC", "UF_CRM_PR_COORD_EM", "UF_CRM_PR_COORD_OBS", "UF_CRM_PR_RH_DEC", "UF_CRM_PR_RH_POR",
      "UF_CRM_PR_RH_EM", "UF_CRM_PR_RH_OBS", "UF_CRM_PR_VIGENCIA"] },
  ];

  /* ---------- códigos ---------- */
  function nomeCampo(typeId, sufixo) { return "UF_CRM_" + typeId + "_" + sufixo; }
  /** Nome do campo na API crm.item.* (como o portal devolveu em 21/10/2026):
        UF_CRM_57_DATA_INGRESSO -> ufCrm57DataIngresso
        UF_CRM_63_DATA_1A1      -> ufCrm_63_DATA_1A1   (sufixo com número: o Bitrix não converte)
        UF_CRM_13_1784744093102 -> ufCrm13_1784744093102 (campo criado na tela, nome só com número)
      É só a reserva: o app usa o nome que o próprio crm.item.fields devolve (upperName, 35-registros.js). */
  function camelDoCampo(nomeMaiusculo) {
    const nome = String(nomeMaiusculo);
    const so = /^UF_CRM_(\d+)_(\d+)$/.exec(nome);
    if (so) return "ufCrm" + so[1] + "_" + so[2];
    const m = /^UF_CRM_(\d+)_(.+)$/.exec(nome);
    if (m && /\d/.test(m[2])) return "ufCrm_" + m[1] + "_" + m[2];
    return nome.split("_").map((p, i) => {
      const l = p.toLowerCase();
      return i === 0 ? l : l.charAt(0).toUpperCase() + l.slice(1);
    }).join("");
  }
  function codigoCampo(typeId, sufixo) { return camelDoCampo(nomeCampo(typeId, sufixo)); }
  function processo(chave) { return PROCESSOS.find((p) => p.chave === chave); }
  function tituloProcesso(p) { return PREFIXO_TITULO + p.nome; }
  /** O processo inteligente de um título, na lista do crm.type.list. Com o título repetido no portal (em
      05/11/2026 nasceram duas "Revisões semanais" no mesmo minuto), vale sempre o mais antigo, o de menor
      entityTypeId: o navegador, o servidor e o "Criar ou completar a estrutura" escolhem o mesmo. */
  function tipoPorTitulo(tipos, titulo) {
    return (tipos || []).filter((t) => t && t.title === titulo)
      .sort((a, b) => Number(a.entityTypeId) - Number(b.entityTypeId))[0] || null;
  }
  /** Os processos do app com o título repetido no portal -> [{ chave, titulo, usado, outros: [entityTypeId] }] */
  function processosRepetidos(tipos) {
    const saida = [];
    PROCESSOS.forEach((p) => {
      const titulo = tituloProcesso(p);
      const iguais = (tipos || []).filter((t) => t && t.title === titulo);
      if (iguais.length < 2) return;
      const usado = tipoPorTitulo(tipos, titulo);
      saida.push({ chave: p.chave, titulo, usado: usado.entityTypeId, outros: iguais.filter((t) => t !== usado).map((t) => t.entityTypeId) });
    });
    return saida;
  }

  return {
    COR, PREFIXO_TITULO, SOLUCAO, OPCOES, PROCESSOS, ENTITY_TYPE_NEGOCIO, CAMPOS_PROMOCAO, SECOES_PROMOCAO,
    nomeCampo, camelDoCampo, codigoCampo, processo, tituloProcesso, tipoPorTitulo, processosRepetidos,
  };
});
