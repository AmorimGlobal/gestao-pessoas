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
| Escopos | `crm`, `user`, `department`, `userfieldconfig`, `im` e `mail` (desde 04/11/2026: o pedido de férias sai pela caixa de e-mail do Bitrix de quem pede, seção 11). O `calendar` não é mais usado (04/11/2026: a empresa não usa o calendário do Bitrix). O `task` entra quando as entregas forem lidas direto das tarefas. |

O app chama `BX24.installFinish()` na primeira abertura.

**Ver como outra pessoa.** Um administrador do Bitrix, ou quem está em Papéis → RH (desde 23/10/2026, a Luciele), tem no rodapé do menu o botão "Ver como outra pessoa". O app abre com a equipe, os papéis e as pendências de quem foi escolhido (uma liderança, a coordenação, o RH ou a CEO), para conferir o que cada um enxerga. Neste modo dá para registrar em nome da pessoa: o registro fica em nome dela, o histórico do Bitrix mostra quem gravou de fato e os adendos dizem "registrado por". A faixa no topo leva de volta à própria visão. A visão de RH depende de a pessoa estar em Papéis → RH.

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
- **E-mail:** os avisos saem como notificação do Bitrix (`im.notify.system.add`). O Bitrix manda por e-mail as notificações não lidas conforme a configuração de notificações de cada pessoa. Confirme no portal se isso atende ao "e-mail de lembrete" da 4.4. Desde 29/10/2026 o servidor tem envio por SMTP (seção 9), usado na ficha do onboarding e nos funis de vagas e de offboarding; os avisos da 4.4 continuam como notificação.
- **Rodar de novo no mesmo dia reenvia:** um "Run" manual no painel da Vercel manda de novo os avisos do dia (a rotina não guarda o que já enviou). Para testar, use o `?simular=1` abaixo.
- **Parâmetros:** o servidor usa os padrões (7 dias para agendar o 1:1, 7 dias para a leitura), porque a Configuração do app fica no Bitrix e só o navegador lê. Se o RH mudar esses números na Configuração, os avisos e o painel da CEO podem divergir da tela em um ou dois dias.
- **Feriados:** o servidor conhece os feriados nacionais. Os de SP e Salvador ficam na Configuração do app, que só o navegador lê. Por isso, um prazo que cai num feriado local pode gerar o aviso um dia antes da tela.
- **Para conferir sem enviar:**

  ```
  curl -H "Authorization: Bearer <CRON_SECRET>" "https://gestao-pessoas-bice.vercel.app/api/avisos?simular=1"
  ```

  A resposta lista as mensagens do dia sem enviar nenhuma.

## 4. Funções de acesso (2.4) — à mão

Configure em CRM → Configurações → Permissões. Para cada um dos 11 processos de registros da equipe (o "1:1 mensais" entrou em 29/10/2026, e as "Revisões semanais" em 04/11/2026, seção 12). Os dois de 04/11/2026, "Férias e ausências" e "Feriados", têm regras próprias, logo abaixo da tabela:

| Função | Ler | Criar e editar | Observação |
|---|---|---|---|
| Liderança | Do departamento | Do departamento | Em "Encerramentos de contrato", só leitura a partir de "Enviada ao RH" (permissão por estágio) |
| Coordenação | Departamento e subdepartamentos | Departamento e subdepartamentos | — |
| RH | Todos | Todos | Administra estágios |
| Membros e demais usuários | Nenhum | Nenhum | O membro não vê os próprios registros |

**Férias e ausências e Feriados (04/11/2026).** Desde essa data todo funcionário entra no app: quem não lidera ninguém vê só "Férias e ausências" e o Perfil. Só o RH grava nessas duas tabelas do CRM: registra as ausências aprovadas por e-mail e cadastra os feriados (seção 11). Os outros só leem:

| Tabela do CRM | Membros (todos, opcional) | Liderança | Coordenação | RH |
|---|---|---|---|---|
| Férias e ausências | Ler, Adicionar e Editar: Próprios | Ler e Editar: Departamento e subdepartamentos | Ler: Departamento e subdepartamentos | Todos |
| Feriados | Ler: Todos | Ler: Todos | Ler: Todos | Todos (o RH cadastra) |

Quem tem mais de uma função soma as permissões, então a liderança continua com as dela nas outras tabelas.

**Desde 05/11/2026, a função "Membros" é necessária para todos os funcionários** (ligada ao departamento raiz), porque o pedido de férias e ausências volta a ser gravado no app:
- Com "Adicionar", a pessoa cria o próprio pedido.
- Com "Editar: Próprios", ela cancela o pedido enquanto ele está em andamento.
- Com "Ler", ela acompanha os próprios pedidos. "Próprios" funciona porque a pessoa é a responsável pelo pedido.
- Sem a função, o app avisa que falta a permissão e oferece mandar o pedido só por e-mail.
- Em "Feriados", a leitura mostra o calendário do RH; sem ela, a pessoa vê a lista oficial.

A Liderança confirma pedidos da equipe, por isso precisa de **Editar** nesta tabela, além de Ler. Use "Departamento e subdepartamentos" para cobrir quem chefia uma área com setores abaixo.

**O RH precisa de "Todos" mesmo.** O app lê os registros com o login de quem usa. Com "Do departamento", a pessoa do RH só enxerga o próprio setor, e em "Ver como outra pessoa" a equipe da liderança escolhida aparece vazia. Foi o que aconteceu em 28/10/2026. Desde 29/10/2026 o app avisa o RH e o administrador no topo da tela quando a permissão esconde registros: ele compara o que o login leu com o total do processo, contado no servidor por `api/contagem.js`, com o mesmo `BITRIX_WEBHOOK_URL` e `GP_AVISAR_IDS`.

Mais três permissões:

- **Funil 77 (HR \| Requisição de Vagas):** a Liderança e a Coordenação precisam de **Ler** para a aba Recrutamento mostrar as vagas que pediram (o app filtra pelo e-mail do solicitante, `UF_CRM_RV_EMAIL`), e de **Adicionar** e **Editar** com "Próprios" para o formulário de vaga do app criar o card (04/11/2026).
  - **Desde 05/11/2026 o funil 77 também recebe as solicitações de promoção (seção 13), que são sensíveis.** O card de promoção nasce restrito (fora de "disponível para todos"). Só o veem o responsável pelo card, os observadores (quem pediu, a coordenação e a liderança direta do membro) e quem tem "Todos". Por isso, no funil 77, a leitura da Liderança e da Coordenação deve ser no máximo **"Todos abertos"**, nunca "Todos". Assim elas continuam vendo as vagas, que nascem abertas, e não veem as promoções dos outros.
  - A Coordenação aprova a promoção pelo app, num card que está com ela como responsável: "Editar: Próprios" basta. O RH precisa de **"Todos"** (Ler e Editar) no funil 77 para decidir qualquer solicitação.
  - **Para a decisão final ficar com o RH:** enquanto o card está com a coordenação, o "Editar: Próprios" também deixaria a coordenação mover o card direto para "Vaga preenchida" no Bitrix, sem passar pelo RH. Use a permissão por etapa do funil 77 para que a Liderança e a Coordenação não movam cards para as etapas finais ("Vaga preenchida", "Reprovada" e "Cancelada"). As vagas não mudam com isso, porque é o RH quem conduz o funil.
- **Funil 79 (HR \| Offboarding):** o RH precisa de leitura e edição ("Todos"). A Liderança e a Coordenação recebem só **Ler, Adicionar e Editar com "Próprios"**: é o que o formulário de encerramento do app precisa para criar o card, gravar o histórico na timeline e passar o card ao RH. Depois disso o card não é mais "próprio" de quem pediu, e ela deixa de vê-lo. As solicitações são sensíveis: não dê "Todos" nem "Do departamento" às lideranças neste funil.
- **Como o formulário do app grava (04/11/2026):** o card nasce com quem pede como responsável (por isso o "Próprios" basta), recebe os comentários do histórico e passa para o responsável do funil (Configuração → Parâmetros; vazio, a primeira pessoa do RH em Papéis). Sem a permissão, o app mostra o que liberar e não perde o que foi digitado.
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
- **Calendário do Bitrix: não é usado** (04/11/2026, a empresa não usa). As ausências da Agenda são as férias, os day offs e as pausas contratuais que o RH registra em Férias e ausências (seção 11). Os feriados são os nacionais da lei, os de SP e Salvador da Configuração e o calendário que o RH cadastra (seção 11). O atalho "Agendar na agenda" das pendências e o compromisso do O2O na agenda saíram.
- **Painéis do BI Builder (RH e CEO):** o app já tem uma versão própria. O BI Builder entra se o RH quiser os gráficos nativos.
- **Base de Conhecimento:** guias, modelos SCI e o guia de offboarding. Cadastre os links em Configuração.

## 9. E-mail da Ficha do onboarding

Decisão da reunião de 29/10/2026: o novo membro recebe por e-mail a Ficha da função. O Bitrix não tem um método REST que mande e-mail para um endereço qualquer, então o servidor envia pelo SMTP de uma caixa da Amorim (`lib/email.js`). Sem a caixa, o app mostra a Ficha em texto para mandar à mão e o botão "Marcar como enviada".

- **Ficha do onboarding** (`api/ficha.js`): botão no onboarding do membro. Só envia quem o próprio Bitrix deixa ler aquele onboarding (o servidor pergunta ao portal com o login de quem clicou), e nunca o próprio membro.
  - O e-mail leva o escopo, as competências comportamentais, os indicadores, as entregas de cada fase com as datas das conversas dos Dias 30, 60 e 90 e quem acompanha o membro.
  - Nunca leva notas, leituras, resultados ou justificativas.
  - A resposta ao e-mail vai para quem enviou.
  - O item ganha "Ficha enviada ao membro em" e um comentário no histórico.
  - As datas usam os feriados nacionais. Os de SP e Salvador ficam na Configuração do app, que só o navegador lê.

| Variável (Vercel) | Valor |
|---|---|
| `SMTP_HOST` | Servidor SMTP da caixa. Na HostGator, `mail.<domínio>`. No Google Workspace, `smtp.gmail.com` |
| `SMTP_PORTA` | Opcional, padrão 465 (SSL). Use 587 se o provedor pedir STARTTLS |
| `SMTP_USUARIO` | O e-mail completo da caixa que envia |
| `SMTP_SENHA` | A senha da caixa. No Google, uma senha de app, que exige a verificação em duas etapas. É segredo: grave direto na Vercel |
| `EMAIL_REMETENTE` | Opcional: outro endereço de remetente. Muitos servidores só aceitam o próprio login |

Depois de gravar, faça um Redeploy e confira a linha "E-mail: Ficha do onboarding" em Configuração → Rotinas no servidor.

**E-mails dos funis de vagas (77) e de offboarding (79):** saíram do app em 30/10/2026. O usuário configura nas regras de automação de cada funil, no próprio Bitrix: um robô "Enviar e-mail" para o e-mail de quem pediu (`UF_CRM_RV_EMAIL` / `UF_CRM_OFF_EMAIL`) na etapa de entrada e em cada etapa que deve avisar, e um robô "Notificação" para o RH na entrada. Desde 04/11/2026 o formulário do app já avisa o RH e a coordenação quando cria o card, e o próprio Bitrix avisa o RH quando o card passa para ele: o robô de notificação na entrada ficou opcional. Os campos `UF_CRM_RV_ULT_AVISO` e `UF_CRM_OFF_ULT_AVISO`, que serviam de controle aos e-mails do app, não são mais usados: podem ficar ou ser apagados. Em 03/11/2026 as listas "Justificativa" (`UF_CRM_OFF_MOTIVO`) e "Será necessária nova contratação?" (`UF_CRM_OFF_REPOSICAO`) trocaram de opções: robô com condição numa opção antiga precisa ser refeito. O webhook de saída da seção 7 não precisa dos eventos de negócio (ONCRMDEAL*): se chegarem, são ignorados.

## 10. Reunião de 29/10/2026: o que muda no Bitrix

O relatório da reunião (`Relatório.docx`) mudou o escopo do app. O que precisa de configuração no portal:

1. **Processo novo "1:1 mensais"** (o 1:1 do mês, a conversa breve) e o campo "Ficha enviada ao membro em" no Onboarding. **Criados em 03/11/2026** por `tools/provisionar.js`, com um webhook de administrador que tem o escopo `userfieldconfig` (o do servidor não tem). O processo é o `entityTypeId 1134`, filho do Membros e incluído na solução "Gestão de Pessoas". O app acha o processo pelo título, sem reimportar a configuração. **Falta dar as permissões da seção 4 ao processo novo**: até lá, só administradores leem e gravam nele.
2. **Esteira "HR \| Offboarding" (funil de negócios 79)**, criada em 29/10/2026 por `amorim-api/offboarding-bitrix/criar-funil.js`:
   - etapas: Nova solicitação, Aguardando coordenação, Em análise (RH), Aprovada, Conversa realizada, Pós-encerramento, Concluída (ganho) e Cancelada (perda);
   - os campos `UF_CRM_OFF_*` seguem, desde 03/11/2026, o formulário "Solicitação de Encerramento de Contrato" da Luciele. São as perguntas dela, um campo por pergunta (justificativa, feedbacks formais e anexos, sucessor, nova contratação, riscos), mais a data efetiva e o motivo de saída, que só o RH preenche. Os campos da primeira versão sem pergunta no formulário (`OFF_PAPEL`, `OFF_CONTRATO`, `OFF_PLANO`, `OFF_APOIO_RH`, `OFF_ULT_AVISO`) ficaram no portal, fora do formulário e do card;
   - os negócios novos ficam com o RH como responsável.
3. **Formulários de vaga e de encerramento no próprio app (04/11/2026).** Pedido do usuário: os dois formulários saíram do Bitrix e são feitos dentro do app, com as mesmas perguntas (`src/js/52-formularios.js`):
   - **Recrutamento → "Solicitar vaga"**: a Solicitação de Contratação (o antigo formulário CRM 259). O card nasce no funil 77, em "Nova solicitação". O app preenche quem pede pelo login (e-mail, nome, departamento, setor e coordenação).
   - **Offboarding → "Solicitar encerramento"**: a Solicitação de Encerramento de Contrato da Luciele. O card nasce na esteira (funil 79), e o app copia para a **timeline do card** o histórico do membro: os feedbacks SCI, os 1:1 mensais e os planos de melhoria (quando há). O membro é escolhido na equipe, e a área, a coordenação, a liderança e o cargo vêm preenchidos.
   - **A regra dos 2 registros** (desempenho abaixo da média ou incompatibilidade com a função) conta os feedbacks SCI de desenvolvimento do app mais os arquivos anexados. A liderança não envia sem os registros; o RH pode enviar mesmo assim, com confirmação. Na esteira, os cards criados pelo app (origem `gestao-pessoas`, com o item do Membros em `ORIGIN_ID`) contam os feedbacks SCI do membro.
   - **Diferenças em relação aos formulários do Bitrix:** a pergunta "sem sucessor nem previsão de nova contratação" aparece com as duas condições (o Bitrix só aceitava uma); "Riscos" ganhou a opção "Nenhum desses pontos", que deixa o campo vazio no card (a pergunta da Luciele é obrigatória e não tinha essa saída).
   - **Não precisa mais:** o script do console (`amorim-api/offboarding-bitrix/form-console.txt`) e os links em Configuração → Links. O formulário CRM 259 pode ser desativado em CRM → Formulários, para não haver duas entradas.
   - **Permissões:** seção 4 (funis 77 e 79).

   As solicitações do fluxo anterior do app (processo "Encerramentos de contrato") ficam na aba Offboarding só para consulta; um rascunho antigo é enviado pelo formulário novo.
4. **Alerta vermelho do RH:** o menu mostra quantas solicitações novas aguardam o RH no Recrutamento (vagas em "Nova solicitação" no funil 77) e no Offboarding (cards em "Nova solicitação" no funil 79 e solicitações do fluxo anterior do app em "Enviada ao RH"). O alerta some quando o card sai da primeira etapa.
5. **Robôs da seção 6 que deixaram de valer:**
   - "Planejar as 2 entregas" (Dia 15 do onboarding): o onboarding não cria mais tarefas;
   - os de "Evidências" do Ciclo: a avaliação de desempenho saiu do app até 2027;
   - "Leituras · Aguardando leitura": as entregas do onboarding são avaliadas direto na avaliação do mês.

   O Ciclo trimestral continua: é nele que fica o O2O (o antigo "1:1 do trimestre").

## 11. Férias e ausências, feriados do RH, notificações e aniversário (04/11/2026)

Pedidos do usuário de 04/11/2026, com base no PDF "Políticas de Férias e Ausências Programadas" do RH. As regras ficam em `src/js/53-ferias.js`.

1. **Estrutura:** dois processos novos, "Gestão de Pessoas · Férias e ausências" e "Gestão de Pessoas · Feriados". Um administrador cria pelo app: Configuração → "Criar ou completar a estrutura". Até lá, o app mostra o aviso no topo e a tela de férias diz o que falta. Depois, dê as permissões da seção 4. A função "Membros" para todos os funcionários é opcional.
2. **Férias e ausências:** desde 05/11/2026, o pedido e a aprovação ficam no app. O usuário pediu: "não apenas no e-mail, mas no app, principalmente para a liderança e o RH aprovarem e ficar registrado para o RH quais colaboradores estarão ausentes". De 04/11 a 05/11 tudo ficava no e-mail, e o RH registrava a ausência aprovada.
   - **Pedir (qualquer pessoa):** em "Pedir férias ou ausência", a pessoa escolhe o tipo, lê as regras e marca que leu. O app confere o pedido com a política: antecedência, segunda-feira, partes de 23, 15 ou 8 dias, 12 meses de contrato, day off no mês do aniversário e longe de feriado e das férias, pausa de até 7 dias. O que não bate não trava: vira "ponto fora da política", e a pessoa justifica.
   - **"Enviar o pedido"** grava o pedido na tabela "Férias e ausências", na etapa "Aguardando o RH", com a pessoa como responsável. O pedido leva a liderança direta, as regras lidas, a cobertura, a justificativa e os pontos fora da política. O RH e a liderança direta recebem o aviso no Bitrix e no sino.
   - **A ordem é a da política: o RH analisa primeiro, e depois a liderança confirma.**
     - O RH aprova ou recusa em até 3 dias úteis (5 na pausa contratual). Aprovado, o pedido vai para "Aguardando a liderança".
     - A liderança confirma ou recusa em até 2 dias úteis (5 na pausa). Confirmado, o pedido vai para "Aprovada" e entra na Agenda da equipe.
     - Na recusa, o comentário é obrigatório e vai para quem pediu.
     - Sem liderança direta, ou quando a liderança direta é a própria pessoa do RH que aprova, a aprovação do RH já fecha o pedido.
     - O prazo vencido fica em vermelho.
     - O número no menu "Férias e ausências" é o que espera quem está vendo: os pedidos aguardando o RH, para o RH, e os aguardando a confirmação, para a liderança. A fila do RH, no Início, também lista os pedidos.
   - Quem pediu cancela enquanto o pedido está em andamento, e o RH e a liderança recebem o aviso.
   - Depois de gravar, o app mostra o e-mail que a política pede (para hr@amorimlawfirm.com, com cópia para a liderança direta), já com a frase de que o pedido está no app. É um complemento: a pessoa pode ajustar o texto, enviar e fechar.
     - **"Enviar pelo e-mail do Bitrix"** manda pela caixa do Bitrix de quem pede (a Amorim usa o e-mail do Bitrix, pedido do usuário de 04/11/2026). O e-mail fica nos enviados dela, e o pedido guarda "E-mail ao RH enviado em".
     - Sem a permissão de gravar na tabela (função "Membros", seção 4), o app explica e oferece mandar o pedido só por e-mail.
   - O envio usa o REST 3.0 (`mail.mailbox.senders` e `mail.message.send`, chamados por `fetch` em `/rest/api/` com o token da sessão; o portal responde com CORS aberto). **O aplicativo precisa do escopo `mail`**: em Desenvolvedores → Outros → aplicativo local Gestão de Pessoas, marque "E-mail (mail)" e salve. Sem o escopo, sem caixa conectada ou com recusa do Bitrix, o app explica, e **"Abrir o e-mail do Bitrix"** copia o texto e abre a tela de escrever do Bitrix (`/mail/message/new`) sobre o app. "Copiar" continua como reserva. O Gmail e o e-mail do computador saíram.
   - **Registrar direto (o RH):** para uma ausência combinada fora do app, o RH usa "Registrar ausência" (pessoa, tipo, primeiro e último dia, observação).
     - O item nasce direto na etapa "Aprovada", com a pessoa como responsável, e a pessoa e a liderança direta recebem o aviso.
     - O RH também edita esse registro.
     - O RH exclui qualquer item, pedido ou registro, e a exclusão avisa as duas.
     - O app separa o pedido do registro direto pelo campo "Regras lidas em": só o pedido feito no app tem esse campo.
   - **Acompanhar:**
     - O RH vê todos os pedidos e todas as ausências.
     - A liderança e a coordenação veem os da equipe.
     - O membro vê os seus.
     - Só a etapa "Aprovada" entra na Agenda da equipe.
   - Não há saldo de dias por pessoa: o direito muda por contrato, e quem confere é o RH.
   - O Gmail, o e-mail do computador e o "Já enviei" não voltaram: o e-mail sai pela caixa do Bitrix e o envio fica anotado sozinho.
3. **Feriados:** o RH cadastra o calendário de cada ano em Agenda da equipe → Editar feriados. O cadastro começa pela lista oficial (nacionais da lei, mais os locais de SP e Salvador da Configuração). Depois o RH marca o que não vale ("não considerar", vira dia útil), exclui ou acrescenta (recesso, por exemplo), para todos ou só para quem segue SP ou Salvador. Um ano cadastrado substitui a lista oficial naquele ano, nos prazos do app, nos pedidos de day off e na agenda. O calendário do Bitrix não é lido.
4. **Notificações:** o sino no topo do menu mostra os pedidos e os registros dos últimos 30 dias para quem vê:
   - os pedidos de férias e ausências e cada decisão: o pedido avisa o RH e a liderança direta; a aprovação do RH avisa a liderança (que confirma) e quem pediu; a confirmação avisa o RH e quem pediu (05/11/2026);
   - as ausências registradas direto pelo RH (a própria pessoa e a liderança direta);
   - solicitações de vaga (RH e coordenação do setor) e de encerramento de contrato (RH);
   - finalistas para avaliar e o calendário de feriados atualizado.

   As notificações saem dos próprios registros, sem nada guardado à parte, e o "lido" é de cada pessoa (`gp_notif_visto` no BX24.userOption). Cada evento também sai como aviso do Bitrix (im.notify).
5. **Link do card depois de enviar (vaga e encerramento):** quem pede entra como observador do card. Ao enviar, o app mostra o link do card na pipe (abrir ou copiar), e o mesmo link vai no aviso do Bitrix para quem pediu, para o RH e para a coordenação. Na aba Recrutamento, cada vaga da lista abre o card. Com "Ler: Próprios" no funil, o observador abre o card mesmo depois que ele passa ao RH (a ajuda do Bitrix diz que o observador vê o card quando a função tem leitura); confira no primeiro envio real.
6. **Altura do app dentro do Bitrix:** o app cresce até a altura do conteúdo e encolhe quando a página é menor. O menu termina logo depois dos itens, o painel lateral ocupa a área visível da tela, com os botões à vista, e o aviso rápido aparece perto do clique (`modoBitrix` e `ajustarAltura` em `60-ui-base.js`).
7. **Aniversário:** cada pessoa cadastra o seu em Perfil, na Agenda ou na tela de férias. A data vem preenchida quando o perfil do Bitrix já tem. Ela é gravada no próprio perfil do Bitrix (`user.update`, escopo `user`), de onde a agenda já lia. O app mostra só o dia e o mês.


## 12. Revisões semanais: o alinhamento pelo WhatsApp no card do membro (04/11/2026)

Pedido do usuário: guardar a revisão semanal de cada membro, ligando o app de gestão semanal (repositório AmorimGlobal/app-gestao-semanal, `https://app-gestao-semanal.vercel.app`) ao Gestão de Pessoas.

1. **O que é guardado:** as respostas de cada pessoa ao alinhamento semanal pelo WhatsApp. Os liderados respondem de sexta até segunda 07h, e as lideranças na segunda. Fica um item por pessoa e por semana na tabela do CRM **"Gestão de Pessoas · Revisões semanais"**, filha de Membros, com estes campos:
   - a semana (a sexta-feira da semana de trabalho);
   - "Respondeu como" (membro ou liderança);
   - as perguntas e respostas;
   - quantas foram respondidas;
   - quando foi guardada;
   - a chave no app semanal.

   No app, aparece no card do membro, na aba **Semanal**.
2. **Por que todo dia:** o app semanal só guarda o ciclo atual e apaga as respostas quando começa o ciclo seguinte (às sextas, para os liderados). A rotina das 6h (`api/sincronizar.js`) guarda todo dia, antes do ciclo novo, e o botão **Configuração → Revisões semanais → Buscar agora** (`api/semanal.js`, só o RH e os administradores) faz o mesmo na hora.
3. **Como lê:** pelas rotas do painel do próprio app semanal (`/api/status` e, por liderança, `/api/respostas` e `/api/respostas-liderados`). O app semanal não foi alterado. Ele não informa a data de cada resposta, então a semana segue o calendário dele: as respostas que estão lá são as do ciclo mais recente, que começa às 8h de sexta (liderados) ou de segunda (lideranças). A mesma resposta da semana anterior não vira semana nova. A lógica está em `src/js/56-semanal.js` e `lib/semanal-servidor.js`.
4. **Quem é quem:** a pessoa do Bitrix é achada pelo celular do perfil (DDD e os 8 últimos dígitos, com ou sem o 9). Sem telefone, vale o nome completo e, depois, o primeiro e o último nome, quando só uma pessoa bate. Quem não for achado aparece no resultado do "Buscar agora", para o RH conferir o celular no perfil ou o nome no app semanal. O telefone nunca vai para o Bitrix.
5. **Quem vê:** a pergunta 2 é "Casos sensíveis". A tabela segue as permissões dos outros registros da equipe (seção 4): a liderança, a coordenação e o RH veem, e o membro não vê.
6. **Para ligar:**
   - um administrador cria a tabela em Configuração → "Criar ou completar a estrutura";
   - dá as permissões da seção 4;
   - clica em "Buscar agora" antes do ciclo novo de sexta.

   Na Vercel nada muda: o endereço padrão já é o do app semanal. `SEMANAL_URL` troca o endereço, e `SEMANAL_TOKEN` vai como "Authorization: Bearer" quando o app semanal pedir senha (ver o item 7).
7. **Atenção: o app semanal está aberto.** O painel e as rotas `/api/*` dele não pedem login nem senha. Quem tiver o endereço lê as respostas e os WhatsApps de todo mundo, e consegue começar um ciclo (que manda WhatsApp para todos) ou apagar as respostas (`/api/reset-semana`). Conferido no código e no endereço publicado em 04/11/2026. A correção é no app semanal: exigir um token nessas rotas e passar o mesmo valor em `SEMANAL_TOKEN` aqui.


## 13. Solicitação de promoção (05/11/2026)

Pedido do usuário: "aqui devia ter algo de solicitar promoção também, já que possui a aba Carreira no perfil de cada um". Pedem a **liderança direta e a coordenação**. **A coordenação e o RH aprovam.** O formulário foi elaborado no app, porque não havia modelo do RH, e **os cards caem no mesmo funil da requisição de vagas** (77).

1. **Onde se pede:** Recrutamento → **"Solicitar promoção"** (ao lado de "Solicitar vaga") ou a aba **Carreira** do card do membro. Cada pessoa vê os membros ativos de que é a liderança direta ou a coordenação. Membro em encerramento fica de fora, e cada membro tem no máximo uma solicitação em andamento.
2. **O formulário** (`52-formularios.js`, `formPromocao`), em 4 seções:
   - **Membro e posição atual:** o cargo e área e o nível vêm do card do membro. Abaixo do membro aparece um resumo:
     - o tempo de casa;
     - a última movimentação na Carreira;
     - o próximo nível do último O2O;
     - os registros no app;
     - o aviso de plano de melhoria em andamento.
   - **Proposta:**
     - o nível proposto, da lista da Arquitetura de Cargos da Configuração;
     - a senioridade e o cargo novos, se mudam;
     - a data sugerida;
     - se vem com reajuste salarial, e o reajuste sugerido.
   - **Justificativa e evidências:**
     - por que agora;
     - os resultados dos últimos 6 a 12 meses;
     - as responsabilidades do novo nível que a pessoa já assume;
     - as competências que se destacam, do glossário da Configuração;
     - o que desenvolver.
   - **Impacto e comunicação:**
     - como ficam as atividades atuais e, se forem redistribuídas ou for preciso contratar, como fica a operação;
     - se a pessoa já sabe;
     - observações.

   O app não deixa enviar nível abaixo do atual, proposta em que nada muda, nem data no passado.
3. **O card:** fica no funil 77, com o título "Promoção · Nome".
   - Tem os 28 campos `UF_CRM_PR_*` (`20-schema.js`, `CAMPOS_PROMOCAO`), todos texto, data ou pessoa, sem lista.
   - É restrito, e a origem é o item do Membros.
   - Na timeline entra o histórico do membro (planos de melhoria, O2O, 1:1 mensais e feedbacks SCI) e, por cima, o pedido inteiro.
   - **As promoções não contam como vagas:** ficam fora da lista de vagas, do tempo de preenchimento e do painel.
4. **A aprovação segue as etapas do funil:**

   | Etapa | Na promoção | Responsável pelo card |
   |---|---|---|
   | Nova solicitação | aguarda a coordenação | a coordenação do membro |
   | Em análise | aguarda o RH | o responsável do funil (Configuração → Parâmetros) |
   | Vaga preenchida (ganha) | aprovada | não muda |
   | Reprovada | não aprovada, pela coordenação ou pelo RH | não muda |
   | Cancelada | cancelada no funil | não muda |

   - A solicitação já nasce em "Em análise" quando a própria coordenação pede, ou quando o membro não tem coordenação na estrutura.
   - A decisão é dada no app, na tela da solicitação (Recrutamento → a solicitação). O comentário é obrigatório para não aprovar.
   - Cada decisão grava os campos de decisão, a etapa, o novo responsável e um comentário na timeline.
   - O app acha as etapas pelo nome ("Em análise", "Reprovada") e, sem ele, pela posição. Por isso dá para renomear "Vaga preenchida" para algo como "Concluída" sem mexer no app.
5. **Aprovada pelo RH:** o RH confirma a data em que a promoção vale. Com a caixa marcada (padrão), o app atualiza o card do membro: o nível, a senioridade e a linha "AAAA-MM-DD · de X para Y · promoção aprovada pelo RH" na aba Carreira. O cargo do perfil do Bitrix não muda sozinho.
6. **Avisos:** saem pelo Bitrix (com o link do card) e pelo sino.
   - Quem decide recebe o pedido.
   - Quem pediu, a liderança direta e a coordenação recebem cada decisão que não foi delas.
   - **O membro nunca é avisado pelo app:** a conversa fica com a liderança.
7. **Para ligar:**
   - Um administrador clica em Configuração → **"Criar ou completar a estrutura"**. Isso cria os 28 campos de negócio e põe as seções "Promoção: …" no layout do card do funil 77.
     - No mesmo layout, os campos da vaga (`UF_CRM_RV_*`) passam a aparecer só quando preenchidos, para o card de promoção não mostrar a vaga vazia.
     - Sem os campos, o formulário avisa e não envia.
   - Ajuste as permissões do funil 77 (seção 4).
   - Os robôs de e-mail do funil 77 usam `UF_CRM_RV_EMAIL`, que fica vazio no card de promoção, então não mandam e-mail sobre promoções. Já um robô de notificação ao RH na entrada avisa também das promoções.
