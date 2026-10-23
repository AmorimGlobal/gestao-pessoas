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

**Ver como outra pessoa.** Um administrador do Bitrix, ou quem está em Papéis → RH (desde 23/10/2026, a Luciele), tem no rodapé do menu o botão "Ver como outra pessoa". O app abre com a equipe, os papéis e as pendências de quem foi escolhido (uma liderança, a coordenação, o RH ou a CEO), para conferir o que cada um enxerga. Neste modo nada é gravado, e a faixa no topo leva de volta à própria visão. A visão de RH depende de a pessoa estar em Papéis → RH.

**O link só abre pelo Bitrix.** Quando o Bitrix abre o app, ele manda o token da sessão de quem está logado. Antes de entregar a página, a Vercel pergunta ao portal de quem é esse token (`lib/acesso.js`). Aberto direto no navegador, o link mostra "Acesso só pelo Bitrix24", e a versão publicada não tem demonstração.

- **Portal:** é o do `BITRIX_WEBHOOK_URL`, ou `GP_PORTAL` se for gravada. Sem nenhuma das duas, vale `amorimglobal.bitrix24.com.br`.
- **Endpoints:** as chamadas do app ao servidor (`/api/painel` e `/api/status`) também exigem o token.
- **Demonstração:** fica só no `dist/index.html` local.

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

- **9 processos inteligentes** com relação pai/filho com "Membros". A relação liga feedbacks, ciclos, planos, encerramentos, onboarding e leituras ao membro. As avaliações de finalistas ficam ligadas ao negócio da vaga.
  - **Abas no card nativo:** no portal, a relação foi gravada com "mostrar no card" desligado, mesmo com o app pedindo para ligar (`isChildrenListEnabled`). O app não depende disso, porque mostra tudo no card do membro dele. Para ver as abas também no CRM, ligue à mão:
    1. Abra CRM → Processos inteligentes → "Gestão de Pessoas · Membros" → Editar → Relações.
    2. Em cada processo filho, marque a opção de exibir a lista no card.
- **Estágios com cor**: amarelo espera ação, vermelho é atraso, azul é andamento, verde é concluído.
- **Os campos de cada processo**, com texto de ajuda.
- **A solução automatizada "Gestão de Pessoas"** no menu lateral.

Todo processo nasce **sem permissão aberta** (`isSetOpenPermissions = N`).

## 3. Sincronização com a estrutura da empresa

O processo Membros acompanha a estrutura do Bitrix sozinho:

- **Quem entra:** ganha o item com a liderança direta (o chefe do departamento) e a coordenação (o chefe do setor). Se o cadastro tem menos de 90 dias, ganha também o Onboarding.
- **Quem muda de departamento:** tem a liderança e a coordenação atualizadas.
- **Quem é desativado:** vai para Encerrado.

O RH recebe uma notificação com o resumo, e cada item ganha um comentário no histórico.

**Como o app lê a estrutura (conferido no portal em 21/10/2026).**

- **Liderança direta:** o chefe do departamento da pessoa. Departamento sem chefe (Relacionamento, Elaboração, SDR...) responde ao chefe logo acima.
- **Coordenação responsável:** o primeiro chefe de cima para baixo, abaixo da AMORIM.
  - Customer Services e Marketing têm chefe, então a coordenação é a chefe do setor.
  - Solutions e Gestão não têm chefe, então a coordenação é a chefe da área: Immigration, International Business, International Law, Administrativo & Financeiro, e assim por diante.
- **Supervisores adjuntos:** os do organograma (Taily, Rafaela e Livia em Solutions) aparecem na API lotados direto no setor. Como eles chefiam as áreas, a regra acima já os coloca no lugar certo.
- **Quem está em mais de um departamento:** vale o mais específico.
- **Sem chefe nenhum no caminho:** o app usa a liderança e a coordenação gravadas no item do Membros. O RH grava em **Configuração → Setores sem chefe no Bitrix** (o card só aparece nesse caso), e a sincronização não troca esses valores.
- **Contas genéricas:** Contato Amorim, Finance Amorim e Finance Recebimentos Amorim entram como membros se ficarem num departamento. Coloque-as em Papéis → Fora do app e em `GP_EXCECOES_IDS`.

- **Primeira carga e quando quiser:** Configuração → **Ver o que mudaria** (prévia) e depois **Sincronizar agora** (usa o login do administrador).
- **Todo dia às 6h:** a rotina `api/sincronizar.js` na Vercel. Ela só liga depois que estas variáveis forem configuradas em Vercel → Settings → Environment Variables, seguidas de um Redeploy:

| Variável | Valor |
|---|---|
| `BITRIX_WEBHOOK_URL` | Webhook de entrada (Aplicativos → Recursos para desenvolvedores → Outros → Webhook de entrada), criado por um administrador, com as permissões CRM, Usuários, Estrutura da empresa e Chat e notificações |
| `CRON_SECRET` | Uma senha longa qualquer. A Vercel a envia nas chamadas do agendamento e a rotina recusa chamadas sem ela |
| `GP_AVISAR_IDS` | IDs de usuário do RH que recebem o resumo, separados por vírgula. O ID aparece na URL do perfil: `/company/personal/user/<ID>/` |
| `GP_CEO_IDS` | ID de usuário da CEO. Obrigatória: é o que garante que ela não ganhe item no Membros nem receba aviso, e que só ela abra o painel calculado no servidor |
| `GP_EXCECOES_IDS` | IDs de quem fica fora do app (hoje, só a Giselle) |

No app, **Configuração → Rotinas no servidor** mostra quais rotinas já estão ligadas (pergunta a `/api/status`, que só diz sim ou não e o nome do que falta). Mostra também os valores de `GP_AVISAR_IDS`, `GP_CEO_IDS`, `GP_EXCECOES_IDS` e `GP_LINK_APP`, tirados dos Papéis, para copiar.

Para testar sem esperar o dia seguinte: Vercel → projeto → Settings → Cron Jobs → **Run**. A resposta mostra quantos itens foram criados, atualizados e encerrados.

### Avisos da 4.4 (rotina das 8h)

A rotina `api/avisos.js` roda todo dia às 8h (horário de Brasília, com a margem de até 59 minutos do plano Hobby). Ela usa as mesmas variáveis da sincronização e calcula as pendências com a mesma regra da tela "O que depende de você":

| Aviso | Quando | Para quem |
|---|---|---|
| Resumo semanal | Primeiro dia útil da semana (segunda, ou terça se a segunda for feriado) | Cada liderança e coordenação com pendências, em **uma** mensagem. O RH recebe também a fila do RH e o total de atrasadas |
| Venceu o prazo | No dia útil em que a pendência atrasa | Quem responde por ela, numa mensagem só com tudo o que venceu |
| Lembrete de 7 dias | No dia útil em que o atraso chega a 7 dias | Quem responde, um lembrete por pendência, com o nome, a data original e o link |
| Aviso de 14 dias | No dia útil em que o atraso chega a 14 dias | A coordenação do membro. Se a coordenação é quem responde, ou não há coordenação, vai para o RH |

- **Destinatários:** o membro e quem está em `GP_EXCECOES_IDS` (a CEO) nunca recebem. Os avisos não levam conteúdo de feedback, leitura ou plano, só o nome da pendência e as datas.
- **Uma vez só, sem guardar estado:** cada marco sai no dia útil em que é cruzado. O que cruzar no fim de semana ou num feriado sai no dia útil seguinte. Se a rotina falhar num dia, os marcos daquele dia não são reenviados (o resumo da semana seguinte mostra tudo de novo).
- **Link:** grave `GP_LINK_APP` com o endereço do app no Bitrix (abra o app e copie o endereço, algo como `https://amorimglobal.bitrix24.com.br/marketplace/app/<número>/`). Sem a variável, o aviso diz "Abra o app Gestão de Pessoas no Bitrix".
- **E-mail:** os avisos saem como notificação do Bitrix (`im.notify.system.add`). O Bitrix manda por e-mail as notificações não lidas conforme a configuração de notificações de cada pessoa. Confirme no portal se isso atende ao "e-mail de lembrete" da 4.4. Um e-mail próprio precisaria de um serviço de envio (SMTP), que o app ainda não tem.
- **Rodar de novo no mesmo dia reenvia:** um "Run" manual no painel da Vercel manda de novo os avisos do dia (a rotina não guarda o que já enviou). Para testar, use o `?simular=1` abaixo.
- **Parâmetros:** o servidor usa os padrões (7 dias para agendar o 1:1, 7 dias para a leitura), porque a Configuração do app fica no Bitrix e só o navegador lê. Se o RH mudar esses números na Configuração, os avisos e o painel da CEO podem divergir da tela em um ou dois dias.
- **Feriados:** o servidor conhece os feriados nacionais. Os de SP e Salvador ficam na Configuração do app, que só o navegador lê. Por isso, um prazo que cai num feriado local pode gerar o aviso um dia antes da tela.
- **Para conferir sem enviar:**

  ```
  curl -H "Authorization: Bearer <CRON_SECRET>" "https://gestao-pessoas-bice.vercel.app/api/avisos?simular=1"
  ```

  A resposta lista as mensagens do dia sem enviar nenhuma.

## 4. Funções de acesso (2.4) — à mão

Configure em CRM → Configurações → Permissões. Para cada um dos 9 processos:

| Função | Ler | Criar e editar | Observação |
|---|---|---|---|
| Liderança | Do departamento | Do departamento | Em "Encerramentos de contrato", só leitura a partir de "Enviada ao RH" (permissão por estágio) |
| Coordenação | Departamento e subdepartamentos | Departamento e subdepartamentos | — |
| RH | Todos | Todos | Administra estágios |
| Membros e demais usuários | Nenhum | Nenhum | O membro não vê os próprios registros |

Mais duas permissões:

- **Funil 77 (HR \| Requisição de Vagas):** a Liderança precisa de **leitura** para a aba Recrutamento mostrar as vagas que ela pediu. O app filtra pelo e-mail do solicitante (`UF_CRM_RV_EMAIL`).
- **CEO:** **nenhuma** permissão nos 9 processos. O painel dela é calculado no servidor (`api/painel.js`), que devolve só números. Para ligar, grave na Vercel:
  - `GP_CEO_IDS` com o ID de usuário da CEO;
  - `GP_CATEGORIA_VAGAS`, opcional (padrão 77), para o tempo de preenchimento de vaga.
  
  Use o mesmo `BITRIX_WEBHOOK_URL` da seção 3. Sem essas variáveis, a visão da CEO mostra o aviso "Os números do painel não puderam ser carregados".

## 5. Campos obrigatórios por estágio — à mão

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

## 6. Regras de automação (robôs) — à mão

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
| Encerramentos · Enviada ao RH | Criar a tarefa "Analisar solicitação de encerramento" (o aviso ao RH já sai do app e da trava no servidor, seção 7) |
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

- **Criação da leitura ao concluir a tarefa "Entrega":** precisa do modelo de tarefa e de um processo de negócio nas tarefas.

## 7. Trava do encerramento no servidor (4.1) — webhook de saída

A tela confere os registros antes de enviar (`dominio.verificarRegistros`). A especificação exige que o servidor confira de novo, para cobrir uma solicitação que chegue por outro caminho: o formulário do Bitrix, um item criado direto no kanban ou um item arrastado de estágio. Quem faz isso é a função `api/eventos.js` na Vercel (regra em `lib/trava-encerramento.js`), e não um processo de negócio, porque o designer de processos não consegue contar feedbacks ligados a um plano.

Como funciona:

- **Item novo vindo de fora do app** (em Rascunho e sem autor, como o formulário grava): a função preenche a origem ("Formulário da coordenação") e o solicitante (quem criou), e liga o item ao membro pelo Responsável. Depois confere os registros:
  - se passou, o item vai direto para "Enviada ao RH" e o RH é avisado;
  - se não passou, o item vai para "Bloqueada", com o motivo.
- **Item em "Aguardando coordenação", "Enviada ao RH" ou "Em análise"** sem "Liberação excepcional do RH": a função confere de novo. Se não passar, o item volta para "Bloqueada", com o motivo em "Motivo do bloqueio" e um comentário no histórico. Quem pediu recebe um aviso.
- **As regras são as da tela:**
  - "Resultados abaixo do acordado" e "Desalinhamento de perfil" exigem um plano em "Resultados não atingidos", com os feedbacks SCI de abertura e de encerramento.
  - "Reestruturação da área" e "Fim do prazo previsto no contrato" exigem a justificativa do fluxo abreviado.
  - "Situação grave ou urgente" segue sem bloqueio.
- **Avisos:** nunca vão para o membro nem para quem está em `GP_EXCECOES_IDS`, e nunca trazem o conteúdo dos registros.
- **Rascunhos:** os rascunhos do app e os itens a partir de "Aprovada" não são tocados.

Para ligar:

1. Em **Aplicativos → Recursos para desenvolvedores → Outros → Webhook de saída**, crie um webhook com:
   - o endereço `https://gestao-pessoas-bice.vercel.app/api/eventos`;
   - os eventos **ONCRMDYNAMICITEMADD** (item de processo inteligente criado) e **ONCRMDYNAMICITEMUPDATE** (item atualizado).
2. Copie o **token de aplicação** que o Bitrix mostra e grave na Vercel, em Settings → Environment Variables, como `BITRIX_EVENTO_TOKEN`. A função recusa chamadas sem esse token.
3. Confirme que `BITRIX_WEBHOOK_URL`, `GP_AVISAR_IDS` e `GP_EXCECOES_IDS` estão gravadas (são as mesmas da seção 3) e faça um Redeploy.
4. Para testar, crie no kanban de "Encerramentos de contrato" um item com Motivo "Reestruturação da área", sem justificativa, e mova para "Enviada ao RH". Em até um minuto, o item deve voltar para "Bloqueada" com *"Registre a justificativa do fluxo abreviado."*

O Bitrix manda o evento de qualquer processo inteligente do portal. A função ignora todos que não são de "Encerramentos de contrato", e a própria gravação dela não entra em repetição: depois que ela move o item, o evento seguinte já não tem nada a fazer.

A aprovação da coordenação pode ser feita de duas formas:

- **Pelo app:** botões "Aprovar" e "Devolver" na solicitação. Quem pediu nunca aprova o próprio pedido: quando a coordenação é a liderança direta, a aprovação vai para o RH.
- **Pela aprovação nativa:** a ação "Aprovar documento" atribuída ao campo "Coordenação responsável".

## 8. Outros itens nativos

- **Avisos ao membro (4.1):** como o Responsável de todo registro é o membro, desligue para ele as notificações de CRM desses processos. Esta é uma validação pendente (veja a tabela 2.7).
- **Modelo de tarefa "Entrega" (3.4):** a liderança é a criadora, o "controle após a conclusão" fica ligado e há o campo "Complexidade".
- **Ausências (3.6):** a Agenda lê os eventos "Ausente" da agenda de cada pessoa (`calendar.accessibility.get`). Se o gráfico de ausências nativo não aparecer ali, combine com o RH como lançar.
- **Feriados:** os nacionais vêm de `calendar.settings.get` ("year_holidays"). Se o portal não tiver essa lista, o app usa os feriados federais calculados. Os de SP e Salvador ficam em Configuração.
- **Painéis do BI Builder (RH e CEO):** o app já tem uma versão própria. O BI Builder entra se o RH quiser os gráficos nativos.
- **Base de Conhecimento:** guias, modelos SCI e o guia de offboarding. Cadastre os links em Configuração.
