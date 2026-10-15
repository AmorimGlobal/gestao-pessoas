# Configuração no Bitrix24 — Gestão de Pessoas

Para o TI. Este guia cobre o que o app cria sozinho e o que precisa ser configurado à mão no Bitrix, porque a API REST não alcança. Faça tudo primeiro no **ambiente de teste** (especificação 5.2), com os 6 casos do protótipo.

## 0. Pré-requisito bloqueante: a estrutura da empresa (1.1)

O app descobre "quem é da equipe de quem" pela estrutura da empresa:

- **Liderança:** é chefe (`UF_HEAD`) de um departamento ou subdepartamento que tem **só** os membros que ela lidera.
- **Coordenação:** é chefe do departamento do setor. Os subdepartamentos são as áreas.
- **Membros:** cada um fica no departamento da sua liderança direta.

Sem isso, "Minha equipe" fica vazia. O próprio app avisa na tela.

## 1. Instalar o app local

Configure o app em Bitrix24 → Recursos para desenvolvedores → Outros → Aplicativo local:

| Item | Valor |
|---|---|
| Tipo | Aplicativo com interface, no menu principal |
| Caminho do manipulador | `https://<projeto>.vercel.app/` |
| Caminho de instalação | o mesmo |
| Nome no menu | Gestão de Pessoas |
| Escopos | `crm`, `user`, `department`, `userfieldconfig`, `im`, `calendar`. O `task` entra quando as entregas forem lidas direto das tarefas. |

O app chama `BX24.installFinish()` na primeira abertura.

## 2. Criar a estrutura (o app faz)

Há duas formas, e as duas usam o mesmo código (`src/js/30-provision.js`). As duas são idempotentes: rodar de novo só cria o que faltar.

- **Pelo app:** um administrador abre **Configuração → Simular** e depois **Criar ou completar a estrutura**. A configuração resultante fica gravada em `BX24.appOption("gp_config")`.
- **Pelo terminal:** use um webhook de administrador com os escopos `crm` e `userfieldconfig`:
  ```
  node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --simular
  node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --saida config.json
  ```
  Depois, em Configuração → "Importar configuração", cole o `config.json`. Sem isso, o app ainda acha os processos pelo nome.

O que é criado:

- **9 processos inteligentes** com relação pai/filho com "Membros". A relação faz feedbacks, ciclos, planos, encerramentos, onboarding e leituras aparecerem como abas no card nativo do membro. As avaliações de finalistas ficam ligadas ao negócio da vaga.
- **Estágios com cor**: amarelo espera ação, vermelho é atraso, azul é andamento, verde é concluído.
- **Os campos de cada processo**, com texto de ajuda.
- **A solução automatizada "Gestão de Pessoas"** no menu lateral.

Todo processo nasce **sem permissão aberta** (`isSetOpenPermissions = N`).

## 3. Funções de acesso (2.4) — à mão

Configure em CRM → Configurações → Permissões. Para cada um dos 9 processos:

| Função | Ler | Criar e editar | Observação |
|---|---|---|---|
| Liderança | Do departamento | Do departamento | Em "Encerramentos de contrato", só leitura a partir de "Enviada ao RH" (permissão por estágio) |
| Coordenação | Departamento e subdepartamentos | Departamento e subdepartamentos | — |
| RH | Todos | Todos | Administra estágios |
| Membros e demais usuários | Nenhum | Nenhum | O membro não vê os próprios registros |

Mais duas permissões:

- **Funil 77 (HR \| Requisição de Vagas):** a Liderança precisa de **leitura** para a aba Recrutamento mostrar as vagas que ela pediu. O app filtra pelo e-mail do solicitante (`UF_CRM_RV_EMAIL`).
- **CEO:** veja o ponto de atenção 3 em `tabela-2.7-e-validacoes.md`. O app calcula os números no navegador da CEO, então ela precisa de leitura. Se ela não puder abrir os registros, o painel dela tem de vir do BI Builder ou de um resumo calculado no servidor.

## 4. Campos obrigatórios por estágio — à mão

O app já valida nos formulários, mas a especificação pede a trava também no Bitrix. Marque no editor do card de cada processo, em "obrigatório a partir do estágio":

- **Ciclo trimestral:**
  - Data do 1:1 em "1:1 agendado".
  - Campos do 1:1 em "1:1 realizado".
  - Resultados, Crescimento e Classificação em "Evidências registradas".
- **Planos:**
  - Feedback de abertura, início, término, resultados, evidências e apoio em "Em andamento".
  - Check-in em "Check-in realizado".
  - Feedback de encerramento e situação final nos estágios finais.
- **Encerramentos:**
  - Motivo e coordenação em "Rascunho".
  - Descrição, data desejada, reposição e apoio do RH em "Aguardando coordenação".
  - Data da conversa em "Conversa realizada".

## 5. Regras de automação (robôs) — à mão

O app move os estágios quando a pessoa age pela tela: agendar, registrar, aprovar. Os robôs abaixo cuidam do **tempo**, isto é, do que acontece quando ninguém age. O "supervisor do responsável" é o destinatário nativo que segue a estrutura.

| Processo · estágio | Robô |
|---|---|
| Ciclo · 1:1 a agendar | Ao entrar: notificar o supervisor do responsável. Esperar 7 dias e mover para "1:1 sem agendamento" |
| Ciclo · 1:1 sem agendamento | Ao entrar: notificar a liderança e o RH |
| Ciclo · 1:1 agendado | 7 dias antes da "Data do 1:1": tarefa ao membro pedindo 2 ou 3 temas (a resposta vai para "Temas trazidos pelo membro"). 1 dia depois da data: lembrete à liderança |
| Ciclo · 1:1 realizado | No "Fim do trimestre": lembrete das evidências. No "Prazo das evidências": mover para "Evidências atrasadas" |
| Ciclo · Evidências atrasadas | Ao entrar: notificar a liderança e o RH |
| Feedbacks SCI · Editável | Esperar 48 horas e mover para "Registrado" (estágio só de leitura) |
| Planos · Em andamento | Ao entrar: notificar coordenação e RH. "Data de início" + 24 dias: lembrete do check-in. + 30 dias: mover para "Check-in atrasado" |
| Planos · Check-in realizado | 5 dias antes do término: lembrete. Na data de término: mover para "Encerramento pendente" |
| Planos · Encerramento pendente | 1 dia depois: mover para "Encerramento atrasado" (com notificação) |
| Encerramentos · Enviada ao RH | Notificar o RH e criar a tarefa "Analisar solicitação de encerramento" |
| Encerramentos · Aprovada | Tarefas à liderança: "Conduzir a conversa de encerramento" (prazo = data desejada) e "Comunicar o time" (mesmo dia). Se a reposição for "Substituição de membro", notificar o RH |
| Encerramentos · Conversa realizada | Tarefas das semanas 1, 2 e 4 (clima) e notificar o RH (distrato e acessos) |
| Encerramentos · Acompanhamento | Esperar 28 dias e notificar o RH para concluir |
| Onboarding · Preparação | Tarefa "Completar a Ficha do membro", com prazo no dia anterior ao Dia 1 |
| Onboarding · Ancoragem | No Dia 15: cobrar o planejamento das 2 entregas. No Dia 30: tarefa do Alinhamento 1 |
| Onboarding · Imersão / Mar Aberto | No Dia 60 / Dia 90: tarefa do alinhamento |
| Leituras · Aguardando leitura | No "Prazo da leitura": mover para "Leitura atrasada" |
| Finalistas · Aguardando parecer | No "Prazo do parecer": mover para "Parecer atrasado" |

Algumas decisões do app que diferem do texto da especificação:

- **Plano terminado sem os resultados:** o item de encerramento **não** é criado por robô. O app mostra a sugestão, e o item nasce em Rascunho só se a liderança decidir seguir (3.5). Com isso, nenhum rascunho fica parado sem dono.
- **Membro e onboarding:** quando o RH cadastra o membro pelo app, o item de Onboarding em Preparação já é criado junto.
- **Dia 90:** quando o alinhamento final é registrado com continuidade confirmada, o app move o membro para Ativo.

Ainda sem robô nem código, a decidir:

- **Avisos da 4.4:** resumo semanal às segundas, e-mail com 7 dias de atraso e aviso à coordenação com 14 dias.
- **Criação da leitura ao concluir a tarefa "Entrega":** precisa do modelo de tarefa e de um processo de negócio nas tarefas.

## 6. Trava do encerramento no servidor (4.1) — processo de negócio

A tela confere os registros antes de enviar (`dominio.verificarRegistros`). A especificação exige que o **Bitrix** confira de novo, para cobrir uma solicitação criada por outro caminho.

Crie em "Encerramentos de contrato" um processo de negócio que roda ao **criar** e ao **mudar para "Aguardando coordenação" ou "Enviada ao RH"**:

1. Se o Motivo for "Resultados abaixo do acordado" ou "Desalinhamento de perfil":
   - Leia o item de Planos pelo campo "Plano vinculado (ID)" e confira que o estágio é "Resultados não atingidos".
   - Confira que os campos "Feedback de abertura (ID)" e "Feedback de encerramento (ID)" do plano estão preenchidos, e que os dois feedbacks existem e não são retroativos sem anexo.
   - Se faltar qualquer um: mover para "Bloqueada" e gravar em "Motivo do bloqueio" a mensagem *"Este motivo exige 2 feedbacks SCI e um plano de alinhamento de 60 dias encerrado."*
2. Se o Motivo for "Reestruturação da área" ou "Fim do prazo previsto no contrato" e a "Justificativa do fluxo abreviado" estiver vazia: bloquear com *"Registre a justificativa do fluxo abreviado."*
3. Se o Motivo for "Situação grave ou urgente": mover para "Enviada ao RH" e criar uma tarefa ao RH.

A aprovação da coordenação pode ser feita de duas formas:

- **Pelo app:** botões "Aprovar" e "Devolver" na solicitação. Quem pediu nunca aprova o próprio pedido: quando a coordenação é a liderança direta, a aprovação vai para o RH.
- **Pela aprovação nativa:** a ação "Aprovar documento" atribuída ao campo "Coordenação responsável".

## 7. Outros itens nativos

- **Avisos ao membro (4.1):** como o Responsável de todo registro é o membro, desligue para ele as notificações de CRM desses processos. Esta é uma validação pendente (veja a tabela 2.7).
- **Modelo de tarefa "Entrega" (3.4):** a liderança é a criadora, o "controle após a conclusão" fica ligado e há o campo "Complexidade".
- **Ausências (3.6):** a Agenda lê os eventos "Ausente" da agenda de cada pessoa (`calendar.accessibility.get`). Se o gráfico de ausências nativo não aparecer ali, combine com o RH como lançar.
- **Feriados:** os nacionais vêm de `calendar.settings.get` ("year_holidays"). Se o portal não tiver essa lista, o app usa os feriados federais calculados. Os de SP e Salvador ficam em Configuração.
- **Painéis do BI Builder (RH e CEO):** o app já tem uma versão própria. O BI Builder entra se o RH quiser os gráficos nativos.
- **Base de Conhecimento:** guias, modelos SCI e o guia de offboarding. Cadastre os links em Configuração.
