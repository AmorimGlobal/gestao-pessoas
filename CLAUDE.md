# CLAUDE.md

Guia para o Claude Code (e para quem mantiver) o app **Gestão de Pessoas** da Amorim.

## O que é

App local do Bitrix24 (`amorimglobal.bitrix24.com.br`) onde cada liderança executa as rotinas de gestão da equipe: Minha equipe, Agenda, Recrutamento, Onboarding, Rotinas (1:1 e feedbacks SCI), Desempenho e Offboarding, além do Painel. A especificação do RH está em `../Gestão de Pessoas · Especificação para TI.docx` (08/10/2026, revisão de arquitetura de 13/10). Telas, campos e textos seguem o glossário da seção 1.4: "membro", "liderança", "encerramento de contrato", "feedback de reconhecimento/desenvolvimento". Nunca "colaborador", "líder", "desligamento", "faltas" ou linguagem impositiva.

## Arquitetura: o servidor só entrega a página

- **Dados:** 9 processos inteligentes nativos ("Gestão de Pessoas · Membros", "· Feedbacks SCI", "· Ciclo trimestral", "· Planos de alinhamento de resultados", "· Encerramentos de contrato", "· Onboarding", "· Leituras de entrega", "· Planejamento da função", "· Avaliações de finalistas"), agrupados na solução automatizada "Gestão de Pessoas". As vagas vêm do funil de negócios **HR | Requisição de Vagas (categoria 77)**.
- **Interface:** uma página única (HTML, CSS e JS sem framework), servida por uma função da Vercel. Toda chamada ao Bitrix sai do **navegador** por `BX24.callMethod`, com o login de quem abriu o app. Por isso as funções de acesso do CRM (2.4) valem sozinhas: a liderança só recebe os itens do departamento que chefia. É o mesmo padrão do `widget-rotina-contabil`.
- **Servidor (só o que o navegador não pode fazer), em `api/` + `lib/`, pelo webhook de entrada:**
  - `api/sincronizar.js` (cron 6h): Membros acompanha a estrutura da empresa.
  - `api/avisos.js` (cron 8h): avisos da 4.4.
  - `api/eventos.js`: webhook de saída do Bitrix, para a trava do encerramento (4.1).
  - `api/painel.js`: números da CEO, que não tem leitura nos processos.
  
  Todos calculam com as mesmas regras do navegador (`src/js/50-dominio.js`, `35-registros.js`). Variáveis e passo a passo: `docs/configuracao-bitrix.md`.
- **Fora do Bitrix** (página aberta direto no navegador, ou `?demo=1`) o app roda em **demonstração**, com os 6 casos do protótipo e hoje = 08/10/2026. Os parâmetros são `?papel=lideranca|coordenacao|rh|ceo`, `?hoje=AAAA-MM-DD` e `?tour=0`.

## Estrutura

```
src/index.html        casca (marcadores /*__CSS__*/ e /*__JS__*/)
src/styles.css        visual (navy #000c33, azul #0044ff, neon #00ff5f, Poppins)
src/js/00-util.js     esc(), ícones, nomes
src/js/05-marca.js    logos da Amorim em base64 (copiados do app Inovação). Não leia o arquivo inteiro.
src/js/10-calc.js     regras de cálculo da 4.5 (datas, Dia N, dia útil, %, notas, situação)  [Node + navegador]
src/js/20-schema.js   ESQUEMA: processos, estágios (com cor) e campos — fonte única           [Node + navegador]
src/js/30-provision.js cria/completa a estrutura no Bitrix (idempotente, com simulação)      [Node + navegador]
src/js/35-registros.js conversão item do Bitrix (ufCrm<id>…, stageId, parentId) <-> objeto do app; descoberta pelo título [Node + navegador]
src/js/40-bitrix.js   repositório Bitrix (BX24): paginação, lote, pessoas, agenda, vagas, painel da CEO (fetch /api/painel)
src/js/45-demo.js     repositório de demonstração (mesma interface) + dados dos 6 casos     [Node + navegador]
src/js/55-sync.js     sincronização com a estrutura da empresa: entradas, mudanças de liderança e saídas  [Node + navegador]
lib/bitrix-servidor.js  webhook de entrada: chamar/paginar, abrirPortal (listar/obter/criar/atualizar/comentar/notificar), vagas, token da sessão
lib/contexto-servidor.js o mesmo ctx da tela, montado no servidor
lib/sincronizacao-servidor.js  a sincronização no servidor
lib/trava-encerramento.js  trava do encerramento (4.1): decidir() puro + tratar()
lib/avisos.js         avisos da 4.4: planejar() puro (marcos cruzados desde o dia útil anterior) + enviar()
api/sincronizar.js, api/avisos.js, api/eventos.js, api/painel.js  funções da Vercel (escritas à mão; crons em vercel.json)
src/js/50-dominio.js  regras de negócio puras: papéis, equipe, pendências, indicadores, verificação do encerramento, agenda, dicas  [Node + navegador]
src/js/60-ui-base.js  estado, rotas (hash), layout, componentes, painel lateral, eventos
src/js/61..70-ui-*.js telas: início/painel, equipe/card do membro, rotinas, desempenho, onboarding, offboarding, recrutamento, agenda, configuração
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
node --test test/*.test.js            # 78 testes; os exemplos da 4.5 são casos de teste
node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --simular
```

Produção: **https://gestao-pessoas-bice.vercel.app** (Vercel, conta `amorims-projects-ee19b0fd`, deploy a cada push na `main`). Esse é o endereço do app local no Bitrix. `gestao-pessoas.vercel.app` é OUTRO app, de outra conta. Os endereços de deploy com letras aleatórias pedem login da Vercel e não servem para o Bitrix.

`api/app.js` é **gerado**: não edite à mão. Ele embute a página como string porque o Bitrix abre o app local com **POST**, e a hospedagem estática só responde GET. O `vercel.json` manda toda rota para `/api/app`. Se a conta da Vercel for Hobby, o commit precisa ser do autor da conta (veja a nota do `widget-rotina-contabil` sobre `staff@amorimglobal.com`).

Teste no navegador: rode `node build.js` e abra `dist/index.html` (é a demonstração; `dist/` não é versionado, `api/app.js` é). Os testes de interface usados até aqui rodaram com o Edge headless (`--dump-dom`), com um script de driver injetado antes do `</body>`.

## Convenções e armadilhas

- **Modelo de render:** cada tela é uma função que devolve uma string de HTML, e `render()` redesenha a área principal. Formulários abrem no **painel lateral** (`#painel`), que o `render()` não toca, então o que foi digitado sobrevive. Interação por delegação (`data-acao`, `data-rota`, `data-mudar`, `data-filtro`). Todo dado externo passa por `esc()`.
- **Gravação:** `ui.salvar(botao, async () => { await ui.criar/atualizar(...) })`. A tarefa atualiza o registro no contexto, reindexa e redesenha. Erros aparecem no rodapé do painel, nunca são engolidos.
- **Campos:** o código do campo é `UF_CRM_<typeId>_<SUFIXO>`, e na API `crm.item.*` vira camelCase: `ufCrm41DataIngresso`. Listas gravam o ID do item da lista (vem de `crm.item.fields`). Sim/não grava 1/0. Arquivo grava `[{id}, …, [nome, base64]]`. Lista vazia não atravessa o `callMethod`, então para limpar se manda `""`. Esse formato vem do widget-rotina-contabil, que foi testado.
- **Vínculos:** com o Membro, pela relação nativa pai/filho (`parentId<entityTypeId>`, abas no card nativo). Entre outros processos, por campo texto "(ID)".
- **Paginação:** `crm.item.list` devolve 50 por página e `bxTudo` percorre todas. Não troque por `bx` em listas.
- **Datas:** strings ISO `AAAA-MM-DD`, cálculo em UTC (`GP.calc`). Dia N = início + (N − 1). Prazo em dia não útil passa para o próximo dia útil (feriados nacionais mais os de SP/BA pela cidade de referência).
- **Bloqueio de 48 h** (4.1): a tela respeita o prazo (`dom.editavel`). Depois dele, só adendo, com data, autor e justificativa. O bloqueio "de verdade" é o robô e a permissão por estágio no Bitrix (docs).
- **Leitura de entrega** (4.8): só onboarding, plano e "marcada como relevante". Não é indicador. A nota do trimestre é a classificação da liderança em 4 níveis.
- **Equipe = liderança direta pela estrutura** (`dom.liderancaPelaEstrutura`): é o chefe do departamento da pessoa ou, se ela mesma é a chefe, o primeiro chefe acima. Por isso a liderança de uma área está na equipe da coordenação. A sincronização (`55-sync.js`) usa a mesma regra para preencher "Liderança direta" e "Coordenação responsável".
- **`build.js` compila o JS (`new Function`) antes de gravar**: um erro de sintaxe derruba o build, e a Vercel mantém a versão anterior no ar.
- **Mudou o esquema?** Altere `20-schema.js`, rode os testes, rode o provisionamento (simulação primeiro) e reconstrua.

## Estado (20/10/2026)

- **Portal:** a estrutura foi criada no portal (9 processos, solução automatizada id 3). A 1ª execução recusou 10 estágios e 1 campo. A correção (`895d35c`) está no ar e falta rodar de novo: **Configuração → Simular** (deve mostrar cerca de `crm.status.add` 10 e `userfieldconfig.add` 1) e depois **Criar ou completar**.
- **Feito e testado em demonstração e no Bitrix falso:**
  - sincronização com a estrutura;
  - trava do encerramento no servidor;
  - avisos da 4.4;
  - painel da CEO pelo servidor.
- **Falta ligar na Vercel:** as variáveis da seção 3 de `docs/configuracao-bitrix.md` (`BITRIX_WEBHOOK_URL`, `CRON_SECRET`, `GP_AVISAR_IDS`, `GP_EXCECOES_IDS`, `GP_CEO_IDS`, `BITRIX_EVENTO_TOKEN`, `GP_LINK_APP`) e o webhook de saída. Sem elas, `/api/*` responde 503.
- **Aguardando o RH (Luciele):** a confirmação da arquitetura, as decisões da 6.1 (níveis, feriados locais, links, modelos SCI, critérios de situação) e a pergunta da 6.3 para Operações.
- **Pendências e riscos:** `docs/tabela-2.7-e-validacoes.md`.
