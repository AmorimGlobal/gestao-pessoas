# CLAUDE.md

Guia para o Claude Code (e para quem mantiver) o app **Gestão de Pessoas** da Amorim.

## O que é

App local do Bitrix24 (`amorimglobal.bitrix24.com.br`) onde cada liderança executa as rotinas de gestão da equipe: Minha equipe, Agenda, Recrutamento, Onboarding, Feedbacks (feedbacks SCI, 1:1 mensal, O2O trimestral e plano de melhoria) e Offboarding, além do Painel. Desde 04/11/2026 todo funcionário entra: quem não lidera ninguém vê só Férias e ausências e o Perfil (visão "membro"). A aba Desempenho saiu em 29/10/2026 e volta em 2027 (`dom.DESEMPENHO_ATIVO = false`; o código continua no app). A especificação do RH está em `../Gestão de Pessoas · Especificação para TI.docx` (08/10/2026, revisão de arquitetura de 13/10). Telas, campos e textos seguem o glossário da seção 1.4: "membro", "liderança", "encerramento de contrato", "feedback de reconhecimento/desenvolvimento". Nunca "colaborador", "líder", "desligamento", "faltas" ou linguagem impositiva.

## Arquitetura: o servidor só entrega a página

- **Dados:** 12 processos inteligentes nativos: os 10 de registros da equipe ("Gestão de Pessoas · Membros", "· Feedbacks SCI", "· 1:1 mensais", "· Ciclo trimestral", "· Planos de alinhamento de resultados", "· Encerramentos de contrato", "· Onboarding", "· Leituras de entrega", "· Planejamento da função", "· Avaliações de finalistas"), mais "· Férias e ausências" e "· Feriados" (04/11/2026), agrupados na solução automatizada "Gestão de Pessoas". Dois funis de negócios são lidos, e desde 04/11/2026 também recebem os cards dos formulários do app:
  - **HR | Requisição de Vagas (categoria 77):** as vagas. O "Solicitar vaga" do Recrutamento cria o card.
  - **HR | Offboarding (categoria 79, 29/10/2026):** a esteira das solicitações de encerramento, criada por `amorim-api/offboarding-bitrix`. Só o RH lê. O "Solicitar encerramento" do Offboarding cria o card e grava na timeline dele o histórico do membro (feedbacks SCI, 1:1 mensais e planos de melhoria).
- **Formulários de vaga e de encerramento (04/11/2026):** são os antigos formulários CRM do Bitrix (o 259 e o da Luciele), com as mesmas perguntas, feitos no app (`52-formularios.js` + `60-ui-formulario.js`). O card nasce com quem pede como responsável, recebe o histórico e passa ao responsável do funil (Configuração → Parâmetros; vazio, o primeiro do RH). Por isso a liderança precisa de Ler, Adicionar e Editar "Próprios" nos funis 77 e 79 (docs, seção 4). Listas vão pelo texto da opção, que o repositório troca pelo ID lido do `crm.item.fields` do negócio (entityTypeId 2).
- **Nomes que mudaram na tela (29/10/2026), sem mudar os nomes dos processos:**
  - "1:1 do trimestre" virou **O2O**, e continua no "Ciclo trimestral".
  - O plano de alinhamento virou **plano de melhoria**, e foi para o módulo Feedbacks.
  - "Padrões" virou **competências comportamentais**, e o sufixo continua `PADROES`.
  - Os alinhamentos do onboarding viraram **avaliações do 1º, 2º e 3º mês**.
  - O título do processo é a chave da descoberta (`descobrirEstrutura`): renomear um processo quebra o app.
  - **Título repetido no portal** (10/11/2026): em 05/11 nasceram duas "Revisões semanais" no mesmo minuto (1150 e 1154). A configuração gravada apontava a 1154, vazia, e o servidor guardava as respostas na 1150. Por isso o card ficava vazio e o RH via "Revisões semanais: 0 de 25". Agora todos escolhem pelo `schema.tipoPorTitulo`, que fica com o mais antigo (menor entityTypeId): o servidor, o provisionamento e o navegador, que troca a configuração gravada se ela apontar um repetido ou um processo apagado. O RH e o administrador veem o aviso da tabela repetida (`processosRepetidos`), e o "Criar ou completar" roda uma vez por vez e confere o título de novo antes de criar.
- **Interface:** uma página única (HTML, CSS e JS sem framework), servida por uma função da Vercel. Toda chamada ao Bitrix sai do **navegador** por `BX24.callMethod`, com o login de quem abriu o app. Por isso as funções de acesso do CRM (2.4) valem sozinhas: a liderança só recebe os itens do departamento que chefia. É o mesmo padrão do `widget-rotina-contabil`.
- **Servidor (só o que o navegador não pode fazer), em `api/` + `lib/`, pelo webhook de entrada:**
  - `api/sincronizar.js` (cron 6h): Membros acompanha a estrutura da empresa.
  - `api/avisos.js` (cron 8h): avisos da 4.4.
  - `api/eventos.js`: webhook de saída do Bitrix, para a trava do encerramento (4.1).
  - `api/painel.js`: números da CEO, que não tem leitura nos processos.
  - `api/contagem.js`: total de itens de cada processo, para o aviso do RH quando a permissão do CRM esconde registros.
  - `api/ficha.js`: manda a Ficha do onboarding ao membro por e-mail (SMTP, `lib/email.js`).
  - `api/semanal.js` (e a rotina das 6h): copia as respostas do alinhamento semanal pelo WhatsApp (app-gestao-semanal) para a tabela "Revisões semanais" (`lib/semanal-servidor.js`).
  - `api/revisao360.js`: grava a resposta da avaliação 360° da Revisão de Progresso pelo webhook, sem ligar a quem respondeu (`lib/revisao360.js`). É a única gravação do app que não sai do navegador.
  - `api/ferias-equipe.js`: as datas de férias já reservadas pela equipe de quem pede, sem nomes (`lib/ferias-equipe.js`). O membro só lê os próprios pedidos no CRM.
  - São 11 funções em `api/`, e o plano Hobby da Vercel aceita até 12. Antes de criar outra, junte numa que já exista.
  - Os e-mails a quem pede nos funis 77 e 79 saíram do app em 30/10/2026: são regras de automação de cada funil no Bitrix.
  
  Todos calculam com as mesmas regras do navegador (`src/js/50-dominio.js`, `35-registros.js`). Variáveis e passo a passo: `docs/configuracao-bitrix.md`.
- **Acesso:** a versão publicada (`api/app.js`) só sai para um POST do Bitrix com sessão confirmada no portal (`lib/acesso.js`). Ela é marcada com `window.GP_SO_BITRIX` pelo `build.js` e nunca cai na demonstração.
- **Fora do Bitrix, só no `dist/index.html` local** (aberto direto no navegador, ou `?demo=1`), o app roda em **demonstração**, com os 6 casos do protótipo e hoje = 08/10/2026. Os parâmetros são `?papel=lideranca|coordenacao|rh|ceo`, `?hoje=AAAA-MM-DD` e `?tour=0`.

## Estrutura

```
src/index.html        casca (marcadores /*__CSS__*/ e /*__JS__*/)
src/styles.css        visual de 30/10/2026 (referência "Quadro de Dependências": índigo #4154ee, Poppins), claro e escuro por tokens
src/js/00-util.js     esc(), ícones, nomes
src/js/05-marca.js    logo da Amorim (PNG branco em base64, copiada do app Inovação), usada como máscara na cor do tema. Não leia o arquivo inteiro.
src/js/10-calc.js     regras de cálculo da 4.5 (datas, Dia N, dia útil, %, notas, situação)  [Node + navegador]
src/js/20-schema.js   ESQUEMA: processos, estágios (com cor) e campos — fonte única           [Node + navegador]
src/js/30-provision.js cria/completa a estrutura no Bitrix (idempotente, com simulação)      [Node + navegador]
src/js/35-registros.js conversão item do Bitrix (ufCrm<id>…, stageId, parentId) <-> objeto do app; descoberta pelo título [Node + navegador]
src/js/40-bitrix.js   repositório Bitrix (BX24): paginação, lote, pessoas, agenda, vagas, painel da CEO (fetch /api/painel)
src/js/45-demo.js     repositório de demonstração (mesma interface) + dados dos 6 casos     [Node + navegador]
src/js/55-sync.js     sincronização com a estrutura da empresa: entradas, mudanças de liderança e saídas  [Node + navegador]
lib/acesso.js         a página e as chamadas do app só saem com a sessão do Bitrix confirmada no portal
lib/bitrix-servidor.js  webhook de entrada: chamar/paginar, abrirPortal (listar/obter/criar/atualizar/comentar/notificar), vagas, token da sessão
lib/contexto-servidor.js o mesmo ctx da tela, montado no servidor
lib/sincronizacao-servidor.js  a sincronização no servidor
lib/trava-encerramento.js  trava do encerramento (4.1): decidir() puro + tratar()
lib/avisos.js         avisos da 4.4: planejar() puro (marcos cruzados desde o dia útil anterior) + enviar()
lib/semanal-servidor.js  revisões semanais: lê o app semanal (rotas do painel dele) e grava no Bitrix pelo webhook
api/sincronizar.js, api/avisos.js, api/eventos.js, api/painel.js  funções da Vercel (escritas à mão; crons em vercel.json)
src/js/50-dominio.js  regras de negócio puras: papéis, equipe, pendências, indicadores, verificação do encerramento, agenda, dicas  [Node + navegador]
src/js/52-formularios.js as perguntas da Solicitação de Contratação, da Solicitação de Encerramento e da Solicitação de Promoção, condições, regra dos 2 registros, conferência da promoção, histórico para a timeline  [Node + navegador]
src/js/53-ferias.js  Políticas de Férias e Ausências: texto das regras, conferência de cada pedido (sem saldo por pessoa), e-mail pronto para a caixa do Bitrix (corpoHtml, escolherRemetente), ausências registradas pelo RH e quem vê cada uma  [Node + navegador]
src/js/54-notificacoes.js o sino: notificações calculadas dos registros (pedidos e registros), lido por pessoa  [Node + navegador]
src/js/56-semanal.js  revisões semanais do WhatsApp: quem é quem (telefone, nome), a semana pelo calendário do app semanal, o texto guardado e o plano (criar/atualizar sem duplicar)  [Node + navegador]
src/js/57-revisao-matriz.js  GERADO por tools/revisao-matriz.js a partir do protótipo do RH: 40 cargos (KPIs e competências) e o glossário. Não edite à mão; não leia inteiro (179 KB)  [Node + navegador]
src/js/58-revisao.js  Revisão de Progresso: ciclo e regras, quem participa, o que falta no formulário, mínimo das competências, ajustes, quem avalia quem na 360°, relatório com os mínimos, avisos do sino  [Node + navegador]
src/js/69-ui-revisao.js telas da Revisão de Progresso (#/revisao…): início, abertura do ciclo, revisão de um membro (avaliação, calibração, devolutiva), autoavaliação, 360°, retornos, relatório 360°, matrizes
lib/revisao360.js     a 360° no servidor: confere ciclo, liberação, relação e escala, e grava pelo webhook sem autor
lib/ferias-equipe.js  as datas de férias reservadas pela equipe de quem pede, sem nomes (a regra "quem pediu primeiro fica com a data")
tools/revisao-matriz.js gera 57-revisao-matriz.js do HTML do protótipo
src/js/60-ui-base.js  estado, rotas (hash), layout, componentes, painel lateral, eventos
src/js/60-ui-formulario.js formulário a partir da definição (seções, condicionais, grade de níveis) e enviarCard (cria o card, histórico, passa ao RH)
src/js/61..70-ui-*.js telas: início/painel, equipe/card do membro, feedbacks (63-ui-rotinas: SCI, 1:1 mensal, O2O), plano de melhoria (63-ui-planos), desempenho (fora até 2027), onboarding, offboarding, recrutamento, agenda (e o calendário de feriados do RH), férias e ausências (68-ui-ferias, com o "Meu aniversário"), exportar CSV do RH (69), configuração
src/js/90-app.js      inicialização (Bitrix ou demonstração)
build.js              junta tudo em dist/index.html e gera api/app.js
tools/provisionar.js  CLI de provisionamento por webhook (crm + userfieldconfig)
test/                 node --test: calc, provisionamento, domínio, sincronização, trava, avisos, painel, repositório do navegador (vm + BX24 falso).
                      test/fake-bitrix.js é o portal em memória: provisiona e depois guarda itens, comentários, avisos e usuários
docs/                 configuração manual no Bitrix e tabela 2.7 / validações 6.2
```

## Comandos

```
node build.js                         # SEMPRE depois de mexer em src/ (gera dist/ e api/app.js)
node --test test/*.test.js            # 189 testes; os exemplos da 4.5 são casos de teste
node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --simular
```

Produção: **https://gestao-pessoas-bice.vercel.app** (Vercel, conta `amorims-projects-ee19b0fd`, deploy a cada push na `main`). Esse é o endereço do app local no Bitrix. `gestao-pessoas.vercel.app` é OUTRO app, de outra conta. Os endereços de deploy com letras aleatórias pedem login da Vercel e não servem para o Bitrix.

`api/app.js` é **gerado**: não edite à mão. Ele embute a página como string porque o Bitrix abre o app local com **POST**, e a hospedagem estática só responde GET. O `vercel.json` manda toda rota para `/api/app`. Se a conta da Vercel for Hobby, o commit precisa ser do autor da conta (veja a nota do `widget-rotina-contabil` sobre `staff@amorimglobal.com`).

Teste no navegador: rode `node build.js` e abra `dist/index.html` (é a demonstração; `dist/` não é versionado, `api/app.js` é). Os testes de interface usados até aqui rodaram com o Edge headless (`--dump-dom`), com um script de driver injetado antes do `</body>`.

## Convenções e armadilhas

- **Visual (30/10/2026), pela referência do "Quadro de Dependências" que o usuário mandou:**
  - **Topo das telas:** a data por extenso, o título e as ações em pílula. Os módulos usam `c.cabecalho`. As telas de entrada (Início, Painéis, Meu setor) usam `faixa()` em `61-ui-inicio.js`, que soma o "ao vivo" ("Demonstração" na demo) e o quadro de números `c.kpis` (`tom`: azul, ambar, roxo, vermelho, verde; zero fica esmaecido).
  - **Claro e escuro:** toda cor é token em `styles.css`, com `<html data-tema="claro|escuro">`. Não ponha cor fixa no JS, senão o modo escuro quebra.
  - **Tema inicial:** começa no claro, como o Bitrix em volta, e não segue o sistema. O botão ao lado da logo troca o tema e salva `gp_tema` no `localStorage`. O `<head>` aplica o tema antes do primeiro desenho, e a impressão sai sempre no claro.
- **Modelo de render:** cada tela é uma função que devolve uma string de HTML, e `render()` redesenha a área principal. Formulários abrem no **painel lateral** (`#painel`), que o `render()` não toca, então o que foi digitado sobrevive. Interação por delegação (`data-acao`, `data-rota`, `data-mudar`, `data-filtro`). Todo dado externo passa por `esc()`.
- **Gravação:** `ui.salvar(botao, async () => { await ui.criar/atualizar(...) })`. A tarefa atualiza o registro no contexto, reindexa e redesenha. Erros aparecem no rodapé do painel, nunca são engolidos.
- **Campos:** o código do campo é `UF_CRM_<typeId>_<SUFIXO>`, e na API `crm.item.*` vira camelCase: `ufCrm41DataIngresso`. Listas gravam o ID do item da lista (vem de `crm.item.fields`). Sim/não grava 1/0. Arquivo grava `[{id}, …, [nome, base64]]`. Lista vazia não atravessa o `callMethod`, então para limpar se manda `""`. Esse formato vem do widget-rotina-contabil, que foi testado.
- **Vínculos:** com o Membro, pela relação nativa pai/filho (`parentId<entityTypeId>`, abas no card nativo). Entre outros processos, por campo texto "(ID)".
- **Paginação:** `crm.item.list` devolve 50 por página e `bxTudo` percorre todas. Não troque por `bx` em listas.
- **Datas:** strings ISO `AAAA-MM-DD`, cálculo em UTC (`GP.calc`). Dia N = início + (N − 1). Prazo em dia não útil passa para o próximo dia útil (feriados nacionais mais os de SP/BA pela cidade de referência).
- **Bloqueio de 48 h** (4.1): a tela respeita o prazo (`dom.editavel`). Depois dele, só adendo, com data, autor e justificativa. O bloqueio "de verdade" é o robô e a permissão por estágio no Bitrix (docs).
- **Leitura de entrega** (4.8): só onboarding, plano e "marcada como relevante". Não é indicador. A nota do trimestre é a classificação da liderança em 4 níveis.
- **Equipe e coordenação vêm da estrutura do Bitrix** (`dom.liderancaNaEstrutura`/`coordenacaoNaEstrutura`), conferidas contra o portal em 21/10/2026:
  - **Liderança direta:** o chefe do departamento da pessoa. Se o departamento não tem chefe (Relacionamento, SDR...) ou a pessoa é a chefe, sobe até o primeiro chefe acima.
  - **Coordenação:** o primeiro chefe de cima para baixo no caminho, abaixo da raiz. Em setor com chefe (Customer Services, Marketing) é a chefe do setor. Em setor sem chefe (Solutions, Gestão) é a chefe da área (Immigration, International Law, Administrativo...). Para a própria coordenação, a liderança acima.
  - **Mais de um departamento:** vale o mais específico, o mais fundo na árvore (`dom.deptoPrincipal`).
  - **Os "supervisores adjuntos" do organograma** aparecem na API lotados direto no setor, e na prática chefiam as áreas.
  - **Sem chefe nenhum no caminho:** vale o item do Membros, a sincronização não troca e manda para o RH conferir (Configuração → Setores sem chefe no Bitrix, que só aparece nesse caso).
- **Ver como outra pessoa** (`GP.app.verComo`, para administrador do Bitrix ou papel RH, `ui.podeVerComo`): troca `E.eu` e as visões pela pessoa escolhida. Desde 27/10/2026 **grava normalmente** (pedido do RH): o registro sai em nome da pessoa, o histórico do Bitrix mostra quem gravou de fato (o login é de quem usa), e o adendo diz "registrado por". O original fica em `E.euReal` e `E.repoReal`. A CEO, nesse modo, tem o resumo calculado no navegador.
- **Excluir** (pedido de 29/10/2026), pelo `c.botaoExcluir` e pela regra `dom.podeExcluir`:
  - **Quem exclui:** o RH e o administrador excluem qualquer registro. Quem registrou exclui nas primeiras 48 horas. Um encerramento em rascunho ou bloqueado, quem pediu. Um planejamento da função, quem criou.
  - **Para onde vai:** o item vai para a lixeira do CRM, e o card do membro ganha um comentário dizendo quem excluiu.
  - **O Membros não se exclui:** o RH "tira do app", que manda o item para "Arquivado". A sincronização deixa os itens arquivados como estão, sem mandar conferir.
- **Onboarding (29/10/2026):**
  - **Ficha:** o envio ao membro é um passo separado do salvar. Sem a caixa de e-mail na Vercel, o app mostra a Ficha em texto para mandar à mão e o botão "Marcar como enviada".
  - **Avaliações do mês:** as entregas viram itens de "Leituras de entrega" (origem Onboarding), avaliados na régua 100, 70, 30 e 0. Uma entrega tirada da lista vai para "Cancelada".
  - **Classificação:** o resultado usa a regra do patamar por senioridade da 3.2 até o RH mandar a fórmula final.
  - **Privacidade:** notas e justificativas nunca vão para o membro.
- **`build.js` compila o JS (`new Function`) antes de gravar**: um erro de sintaxe derruba o build, e a Vercel mantém a versão anterior no ar.
- **Mudou o esquema?** Altere `20-schema.js`, rode os testes, rode o provisionamento (simulação primeiro) e reconstrua.

## Estado (29/10/2026)

- **Reunião de RH e TI em 29/10/2026** (`Relatório.docx`, fora do Git):
  - Feito no app:
    - "Rotinas" virou "Feedbacks", com o 1:1 mensal, o O2O e o plano de melhoria;
    - a aba Desempenho saiu até 2027;
    - o onboarding foi simplificado (Ficha com competências e envio por e-mail, avaliações do 1º, 2º e 3º mês na régua, painel da evolução);
    - o offboarding passa a ter esteira, alerta vermelho e histórico por trimestre, semestre e ano;
    - entraram o exportar CSV do RH, os botões de excluir e o "tirar do app";
    - o app avisa quando a permissão do CRM esconde registros.
  - Esperando o RH:
    - o glossário de competências (Configuração → Cadastros);
    - os campos e a fórmula das avaliações do onboarding;
    - a estrutura do plano de melhoria;
    - as especificações do 1:1 e do O2O.
- **30/10/2026:**
  - **Visual novo:** feito pela referência que o usuário mandou, em lugar da referência visual que se esperava do RH.
  - **Offboarding:** os e-mails dos funis 77 e 79 saíram do app e viraram automação do Bitrix, feita pelo usuário. O pedido de encerramento continua no app até o formulário da Luciele existir. O alerta, a esteira, o histórico e o Exportar ficam.
  - **Vocabulário:** "processo" confundiu o usuário, que entendeu "Processos" do Bitrix (fluxos com grupos e tarefas). Fale em "tabela do CRM (processo inteligente)".
- **03/11/2026, formulário de offboarding:** a Luciele mandou o dela (Google Forms "Solicitação de Encerramento de Contrato"). Feito:
  - **Funil 79:** os campos `UF_CRM_OFF_*` foram acertados e criados por `criar-funil.js --gravar`, com o card em 5 seções. Os da v1 sem pergunta ficaram no portal, fora do formulário e do card.
  - **App:** a esteira lê os campos novos e avisa quando faltam os 2 registros de feedback. Também mostra os riscos e exporta as colunas novas.
- **04/11/2026, formulários no app (pedido do usuário):** a Solicitação de Contratação (aba Recrutamento) e a Solicitação de Encerramento de Contrato (aba Offboarding) passaram a ser formulários do próprio app, com as perguntas dos formulários CRM. Cada envio cria o card no funil (77 ou 79). No encerramento, o histórico de feedbacks SCI, 1:1 mensais e planos de melhoria do membro vai para a timeline do card. O script do console de 03/11 e os links de formulário em Configuração deixaram de ser usados. O fluxo anterior do app (processo "Encerramentos de contrato", com aprovação da coordenação) ficou só para consulta: o único item no portal estava cancelado. Testado na demonstração com o Edge headless (liderança, RH e coordenação); no portal, o primeiro envio real é o teste (falta a permissão da seção 4).
- **04/11/2026, férias, feriados, notificações e aniversário (pedido do usuário, docs seção 11):** fluxo de férias, day off e pausa contratual pela política do RH ("Políticas de Férias e Ausências Programadas", PDF de 04/11 em `amorim-api/`), com as regras lidas antes do pedido e o e-mail pronto para hr@amorimlawfirm.com com cópia à liderança. O RH cadastra o calendário de feriados de cada ano. O sino mostra pedidos e registros para o RH, as lideranças e quem pede. Cada pessoa grava o aniversário no próprio perfil do Bitrix. **Falta no portal:** as permissões de CRM das 2 tabelas novas (seção 4); a função "Membros" para todos é opcional.
- **04/11/2026, férias só por e-mail (decisão do usuário):** "a comunicação é feita majoritariamente por e-mail; o interessante é acompanhar quais membros estarão ausentes em quais dias". O pedido e a decisão ficam no e-mail; o app só conserva as regras, a conferência e o e-mail pronto, sem gravar nada. O RH registra a ausência aprovada ("Registrar ausência", direto na etapa "Aprovada", com a pessoa como responsável), edita e exclui. A pessoa e a liderança direta recebem o aviso. Só os itens em "Aprovada" contam (`ferias.registradas` e `dom.ausenciasAprovadas`). Saíram as aprovações, os prazos, o "Já enviei" e o contador do menu. A função "Membros" do CRM passou a ser opcional (só leitura dos próprios). O usuário achou a tabela Feriados desnecessária; foi mantida porque é só onde o app guarda o calendário que o RH edita na Agenda.
- **05/11/2026, férias e ausências de volta ao app (pedido do usuário, docs seção 11, item 2):** o pedido é gravado na tabela "Férias e ausências" e passa por "Aguardando o RH" → "Aguardando a liderança" → "Aprovada", na ordem da política: o RH analisa e a liderança confirma, cada um com o seu prazo.
  - O e-mail da política sai depois, como complemento, pela caixa do Bitrix, e o envio marca `emailEnviadoEm`.
  - O RH ainda registra direto, já em "Aprovada".
  - Pedido do app = tem `regrasLidasEm` (`ferias.ehPedido`); sem ele, é registro direto do RH. O sino e a tela usam isso.
  - A função "Membros" do CRM passou a ser necessária, para cada pessoa criar o próprio pedido. A Liderança precisa de Editar na tabela.
- **06/11/2026, férias pelo protótipo do RH (`Solicitacao_Ferias_Amorim.html`, docs seção 11, item 8):** o usuário aprovou o que muda o PDF: 7 + 16, início em qualquer dia e a semana de férias coletivas escolhida por pessoa, exceção à regra da equipe.
  - Para PJ e associação (`F.segueALei` separa CLT e estágio, que seguem a lei como antes):
    - ciclo de novembro a outubro (`cicloDe`);
    - o pedido abre com 10 meses de contrato; a primeira data é a mais tardia entre 12 meses + 1 dia e hoje + 60 (`liberacao`);
    - 23, 7 + 16 ou 8 + 15 por ciclo (`restanteDoCiclo`);
    - a regra da equipe (`reservasDaEquipe`, pelo campo `lideranca` do pedido).
  - Essas regras **travam** o pedido (erros), em vez de virar "ponto fora da política".
  - A semana coletiva é um item com `coletiva = true` (campo novo). `ehColetiva` a tira dos 23 dias e da regra da equipe.
  - O formulário redesenha o bloco a cada escolha, com o estado em `f._st`. As datas da equipe vêm de `repo.reservasEquipe()` (`api/ferias-equipe.js`, sem nomes).
  - Autorizar/Validar/Devolver são só palavras: o valor gravado continua "Aprovada" ou "Recusada".
  - A Agenda de férias é `#/ferias/agenda`.
- **05/11/2026, Revisão de Progresso (pedido do usuário: "implemente o Revisao_de_Progresso_Prototipo.html", docs seção 14):**
  - O usuário escolheu seguir sem a planilha dos nomes dos cargos e fazer as 3 visões de uma vez. O RH dá nome aos cargos em Configuração (`config.revisao.cargos`; `NOMES_DO_PROTOTIPO` cobre C04, C05 e C06). O cargo de cada membro é `cargoMatriz` no Membros.
  - São 5 tabelas (`revCiclos`, `revAvaliacoes`, `revAutoavaliacoes`, `rev360`, `revRetornos`). As respostas longas ficam em JSON, com as chaves dos `name` do protótipo.
  - Na avaliação, o responsável é **a liderança** (o membro nunca é dono). Na autoavaliação e nos retornos, o responsável é o membro. `autoavaliacaoDe` e `retornoDe` acham o item pelo responsável, porque o membro pode não ler o próprio item do Membros.
  - Anonimato: `rev360` só é gravada por `api/revisao360.js`, sem autor, e o RH é o responsável. O "já respondi" fica em `userOption gp_360_<ciclo>` e o rascunho, no localStorage.
    - `lib/contexto-servidor.js` não lê `rev360`.
    - O relatório só traz textos de grupos com o mínimo (`relatorio360` devolve `textos: null` abaixo dele).
    - A abertura do relatório vira comentário no item do ciclo.
  - O que o CRM não fecha, o app fecha na tela:
    - a liderança só lê a autoavaliação depois do envio (`avaliacaoEnviada`);
    - o RH não vê rascunho;
    - a coordenação não vê as perguntas de decisão nem o PDI.
  - A 360° tira a CEO e quem está fora do app (Papéis no navegador; `GP_CEO_IDS` e `GP_EXCECOES_IDS` no servidor), e quem está em encerramento. Superior: a liderança efetiva; se o cargo dela tem "supervis", também quem está acima.
  - A demonstração tem um ciclo aberto, com uma avaliação em cada etapa e 14 respostas 360°.
- **05/11/2026, solicitação de promoção (pedido do usuário, docs seção 13):**
  - A liderança direta e a coordenação pedem (Recrutamento → "Solicitar promoção" e aba Carreira do membro). A coordenação e o RH aprovam no app.
  - O card cai no funil 77, o mesmo das vagas, com os campos `UF_CRM_PR_*` (`20-schema.js`, `CAMPOS_PROMOCAO`: texto, data ou pessoa, sem lista).
  - Um card é promoção quando tem `UF_CRM_PR_MEMBRO` (`dom.ehPromocao`). `vagasDe` tira as promoções, então todo leitor do funil precisa selecionar esse campo, inclusive `lib/bitrix-servidor.js`.
  - As etapas viram o andamento (`dom.etapasPromocao`, pelo nome e pela posição): a 1ª é a coordenação, "Em análise" é o RH, a ganha é aprovada e "Reprovada" é não aprovada.
  - O card fica restrito e com quem decide agora como responsável. Quem pediu, a coordenação e a liderança são observadores.
  - A decisão (`repo.atualizarNegocio`) grava campos, etapa e responsável numa chamada. O comentário da timeline vai antes, enquanto quem decide ainda é responsável. Aprovada pelo RH, o app grava nível, senioridade e a linha na Carreira do Membros.
  - O provisionamento cria os campos de negócio (`crm.deal.userfield.add`, FIELD_NAME até 20 caracteres) e as seções no layout do card do funil (`crm.deal.details.configuration.set` + `forceCommonScopeForAll`). Os `UF_CRM_RV_*` passam a "só preenchidos". Falha nessa parte não para o resto.
  - O membro nunca é avisado.
- **04/11/2026, e-mail do Bitrix e revisões semanais (pedidos do usuário):**
  - O pedido de férias sai pela caixa do Bitrix de quem pede ("a Amorim usa o e-mail do Bitrix"). São métodos do REST 3.0 (`mail.mailbox.senders` e `mail.message.send`), que o BX24.callMethod não chama: `repo.v3` faz `fetch` em `https://<portal>/rest/api/<método>` com `auth` = token da sessão no corpo. O portal responde com CORS aberto (conferido). O app precisa do escopo `mail`, que o administrador marca no aplicativo local. Sem ele, "Abrir o e-mail do Bitrix" copia o texto e faz `BX24.openPath('/mail/message/new')`. Gmail e mailto saíram.
  - As revisões semanais do app-gestao-semanal ficam na tabela "Revisões semanais" (filha de Membros, aba Semanal do card), guardadas pela rotina das 6h e pelo "Buscar agora" (docs seção 12). O app semanal não foi alterado: a leitura usa as rotas do painel dele, que **não pedem senha** (risco anotado na seção 12, item 7). A semana sai do calendário do app semanal (ciclo às 8h de sexta e de segunda), porque ele não informa a data de cada resposta.
- **04/11/2026, ajustes pedidos depois do primeiro uso:** o calendário do Bitrix saiu do app (a empresa não usa): ausências pelos pedidos aprovados, feriados pela lei e pelo RH, sem o "Agendar na agenda". O saldo de férias saiu (cada pedido é conferido sozinho). Depois de enviar uma vaga ou um encerramento, o app mostra o link do card na pipe e manda o link nos avisos; quem pede vira observador do card. Dentro do Bitrix o app tem a altura do conteúdo (`modoBitrix`/`ajustarAltura` em 60-ui-base.js; nada mede 100vh, senão o iframe nunca encolhe). No encerramento, o quadro de registros lista todos os feedbacks SCI e marca os de reconhecimento como "não conta".
- **Portal:**
  - A estrutura está completa: os 10 processos e a primeira carga do Membros (59 itens, 21/10).
  - Em 03/11, com o ok do usuário, `tools/provisionar.js` criou o "1:1 mensais" (`entityTypeId 1134`) e o campo "Ficha enviada ao membro em" do Onboarding. Usou o webhook de administrador do Mathias, o único com `userfieldconfig`. Depois disso, a simulação não acha mais nada a criar.
  - Em 29/10 foi criado o funil de negócios **HR | Offboarding (79)**. Os campos `UF_CRM_OFF_*` seguem o formulário da Luciele desde 03/11.
  - **Falta o administrador:**
    - dar as permissões de CRM (docs, seção 4), com o RH em "Todos", inclusive no "1:1 mensais";
    - nos funis 77 e 79, dar à Liderança e à Coordenação Ler, Adicionar e Editar "Próprios" (no 77 o Ler continua como está), para os formulários do app criarem os cards;
    - escolher a caixa de e-mail do SMTP.
- **Vercel:**
  - As variáveis estão na seção 3 de `docs/configuracao-bitrix.md`, mais as da seção 9 (SMTP, opcional, só para a Ficha). O webhook de saída (`BITRIX_EVENTO_TOKEN`) ainda não existe.
  - Em 03/11/2026 a Vercel pausou a conta, que é Hobby. Os 4 projetos dela (este, `recebimentos-docs`, `webflow-btrix-api` e `widget-rotina-contabil`) passaram a responder `402 DEPLOYMENT_DISABLED`. A tela de Usage da Vercel mostra qual limite estourou, e a saída é o plano Pro ou o suporte.
- **Pendências e riscos:** `docs/tabela-2.7-e-validacoes.md`.
