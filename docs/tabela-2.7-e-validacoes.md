# Gestão de Pessoas · Tabela 2.7, validações da 6.2 e decisões do TI

Retorno do TI para o RH, como pedem os "primeiros 3 passos" da especificação de 08/10/2026. Situação em 15/10/2026.

## 1. A decisão de arquitetura

A especificação recomenda uma primeira versão só com recursos nativos (2.7) e deixa um app próprio, ligado pela API do Bitrix, para uma segunda versão. O TI propõe **juntar as duas coisas já na primeira versão**:

- **Os dados são 100% nativos.** São processos inteligentes com estágios coloridos, kanban, card com histórico de alterações, abas de itens ligados e funções de acesso por departamento. O RH e a coordenação continuam podendo trabalhar no kanban do Bitrix.
- **As telas do protótipo viram um app próprio dentro do Bitrix**, que lê e grava nesses mesmos processos com o login de quem está usando. Por isso as permissões do CRM continuam valendo.

**Por quê:** várias telas e regras do protótipo não existem no nativo. Exemplos:

- o "O que depende de você" com os atrasados primeiro;
- a verificação de registros antes de solicitar o encerramento;
- a pauta automática do 1:1;
- o mapa de calor da coordenação;
- a Agenda com feriados por cidade;
- as dicas da semana e o tour.

Com o app, a liderança vê o que o protótipo mostra, e as regras de cálculo da 4.5 rodam igual em todos os módulos. Elas são testadas automaticamente com os exemplos da própria especificação.

**O que isso muda para o RH:** nenhuma regra nem cálculo muda. Muda só a forma de entregar as telas: elas ficam mais próximas do protótipo do que o nativo permitiria. O custo é manter um código, e o TI assume isso. Como a especificação pede alinhamento quando a escolha muda "o que a liderança vê", **o RH precisa confirmar esta decisão.**

## 2. Tabela 2.7 marcada

| Tela do protótipo | Classificação | Como ficou |
|---|---|---|
| Início e Painel geral | Não dá no nativo | Feito no app. Faixa navy com os 3 números do dia, os 9 destinos, os próximos 14 dias e os painéis por visão (liderança, coordenação, RH e CEO). O BI Builder fica opcional para o RH. |
| Minha equipe e card do membro | Nativo com ajuste | Os dados são nativos (Membros com abas de itens ligados). No app: lista com "Precisa de atenção" em cima, card com histórico, abas e dossiê em PDF. |
| O que fazer agora (todas as abas) | Não dá no nativo | O app calcula as pendências a partir das datas, com os atrasados primeiro e o atalho "Agendar na agenda". As tarefas de robô continuam valendo para os avisos. |
| Recrutamento | Nativo com ajuste | Lê o funil 77 já existente: etapa X de N, dias em aberto e tempo para fechar. O parecer do finalista fica no processo "Avaliações de finalistas". |
| Onboarding Embarcação | Nativo com ajuste | Processo com as 4 fases. No app: Dia N, Ficha a partir do Planejamento da função, nota da fase contra o patamar e Dia 90 movendo o membro para Ativo. |
| Rotinas (1:1 e SCI) | Nativo com ajuste | Processos nativos. No app: pauta automática, combinados anteriores, 4 modelos SCI, revisão do texto e bloqueio de 48 h com adendo. |
| Leitura de entregas | Nativo com ajuste | Processo "Leituras de entrega", fora do alcance do membro. Falta ligar a criação automática ao concluir a tarefa "Entrega". |
| Desempenho anual | Nativo com ajuste | Os 4 itens do Ciclo do ano mais os feedbacks, com a classificação em 4 níveis (4.8). |
| Offboarding e trava | Nativo com ajuste | A verificação roda no app antes de enviar e de novo a cada envio. A trava no servidor fica com um processo de negócio (configuração manual). |

## 3. Validações da 6.2

| Validação | Situação |
|---|---|
| Solução automatizada no plano Enterprise | **Disponível.** O portal já tem uma ("Cadastro de Produtos"). O app cria a "Gestão de Pessoas". |
| Regra de espera relativa a um campo de data | A validar no ambiente de teste (robô "esperar até a data do campo"). Os prazos também aparecem calculados na tela. |
| Regra que cria item em outro processo já com vínculos | **Não é mais necessária para o encerramento:** o app cria o rascunho, já vinculado, quando a liderança decide seguir. |
| Aprovação atribuída a um campo Funcionário | **Feita no app** (Aprovar ou Devolver, e ninguém aprova o próprio pedido). A aprovação nativa fica como alternativa. |
| Permissão por estágio (liderança só lê a partir de "Enviada ao RH") | A configurar. A tela já bloqueia a edição. |
| Data de término = início + 59 | **Feito no app.** |
| BI Builder lendo os processos | A validar. Não bloqueia: os painéis já estão no app. |
| Permissão por departamento com Responsável = membro | A validar no ambiente de teste. É o ponto mais sensível (veja os pontos de atenção 1 e 2). |
| Destinatário "supervisor do responsável" | A validar com os robôs. |
| Importação em lote do Ciclo trimestral | **Feito no app**: Painel do RH → Processos e cadastros → "Abrir o trimestre" cria o item para cada membro Ativo sem item. A planilha continua possível. |
| Registro de quem consultou | Não é nativo. O app registra **quem baixou o dossiê** num comentário da timeline do membro. |
| Modelo de tarefa "Entrega" | A configurar. A entrega concluída fora do modelo já pode ser incluída pela liderança (4.2). |
| Sincronizar indicadores sem código | Aguardando a lista de Operações (6.3). |
| Delegação ao substituto da liderança | A validar. O app já sugere indicar substituto quando a liderança tem ausência confirmada. |
| Aviso automático ao Responsável | A validar e desligar (veja o ponto de atenção 2). |
| Bloqueio de 48 h | Na tela: feito, com adendo. No Bitrix: robô de 48 h e estágio só de leitura (configuração manual). |
| Robô "Não entregue" quando o prazo vence sem conclusão | Depende do modelo "Entrega". |
| Resumo semanal e e-mails de 7 e 14 dias | **Não feito.** Precisa de uma rotina agendada fora da tela (proposta: uma função agendada na Vercel com webhook). |
| Dossiê em PDF | **Feito** ("Salvar em PDF" no card do membro, com o registro de quem baixou). |
| Agendar pendência na agenda do Bitrix | **Feito.** Compromisso na agenda da pessoa, com lembrete de 15 minutos. O prazo não muda. |
| Ausências e aniversários na Agenda | **Feito**, com ocultar o aniversário por pessoa. A leitura do gráfico de ausências nativo ainda precisa ser validada. |
| Feriados nacionais do Bitrix e locais de SP e Salvador | **Feito.** Os nacionais vêm do calendário do Bitrix, com reserva calculada; os locais ficam em Configuração. |
| Tarefa ao membro pedindo temas, e a pauta | **Pauta feita.** A tarefa ao membro é um robô (configuração manual). |
| Calendário do ano no Painel | **Feito**: marcos fixos do ciclo e datas da equipe dos próximos 3 meses. |

## 4. Pontos de atenção

1. **Responsável = membro.** É o que faz a visibilidade por departamento funcionar (2.4). O Bitrix, porém, costuma avisar o Responsável quando um item é criado. Se não for possível desligar esse aviso só para estes processos, a alternativa é Responsável = liderança e o vínculo com o Membro pela relação. Nesse caso, a troca de liderança exigiria reatribuir os itens, coisa que o app pode fazer.
2. **Membro sem acesso.** A função "Membros e demais usuários" precisa estar sem nenhuma permissão nesses 9 processos. Do contrário, o membro abre os próprios registros pelo CRM.
3. **CEO.** O app calcula os números no navegador de quem está usando. Para a CEO ver o painel geral, ela precisa de leitura nos processos, e com essa leitura conseguiria abrir os registros escritos pelo CRM. Há duas opções:
   - montar o painel dela no BI Builder;
   - uma rotina no servidor que grava um resumo diário só com números.
   **Até decidir, não dê leitura à CEO.** A visão de CEO funciona na demonstração.
4. **Nada foi testado contra o portal real.** Os testes rodam com dados de demonstração e com um Bitrix simulado. Antes de liberar, rodar no ambiente de teste:
   - a criação de campos (`userfieldconfig.add`);
   - os estágios novos (`crm.status.add`);
   - a gravação de listas, sim/não e anexos;
   - os avisos (`im.notify.system.add`);
   - as ausências (`calendar.accessibility.get`);
   - o compromisso na agenda (`calendar.event.add`).
5. **Componentes da revisão de 13/10 que ainda não estão no app:** autoavaliação anual, calibração, pulso trimestral e motivos de saída em gráfico. Todos dependem da aprovação da CEO (4.8). O campo "Motivo de saída" já existe.
6. **A Amora (4.7).** As "dicas da semana" de hoje são as dicas-modelo da primeira fase, calculadas por regra: usam só datas, tipos e situações, nunca o texto dos registros. Também há uma revisão do feedback SCI por regras (julgamentos, generalizações e temas pessoais). A integração com a Amora por API entra quando o RH aprovar.

## 5. Interpretações do TI onde a especificação deixava margem

- **1:1 do trimestre em dia:** são elegíveis os membros no estágio Ativo que têm item do Ciclo no trimestre. O RH só cria itens para quem estava Ativo no 1º dia do trimestre.
- **Atraso do agendamento do 1:1:** o prazo é o Dia 7 da abertura. Assim o 1:1 do Bruno fica vermelho em 08/10, como no exemplo.
- **Evidências registradas:** o painel mostra o trimestre que acabou, porque o atual ainda não fechou. Isso bate com o exemplo "3 de 4 no 3º trimestre".
- **Rotinas no prazo (situação da área):** é a soma dos quatro itens: 1:1 agendados, evidências registradas, membros com feedback em 90 dias e etapas de onboarding no prazo. Os cortes são os da 6.1.
- **Encerramento:** foi criada a origem "Solicitação da liderança direta", que segue para a coordenação aprovar. O "Formulário da coordenação" vai direto ao RH (1.2).
- **Prazo da leitura de entrega:** 7 dias (recomendação da 6.1). Pode ser alterado em Configuração.
- **Rotatividade:** é calculada com os encerramentos concluídos nos últimos 12 meses. Ela fica exata quando houver a foto mensal de membros ativos (4.6).
