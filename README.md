# Gestão de Pessoas · Amorim

App do Bitrix24 em que cada liderança cuida das rotinas da sua equipe. Os módulos são Minha equipe, Agenda, Recrutamento, Onboarding, Rotinas (1:1 e feedbacks SCI), Desempenho e Offboarding, além do Painel. O app segue a especificação do RH de 08/10/2026, com a revisão de arquitetura de 13/10.

- **Dados:** ficam em processos inteligentes nativos do Bitrix, agrupados no menu "Gestão de Pessoas".
- **Acesso:** o app roda dentro do Bitrix com o login de quem abre, então as permissões do CRM valem sozinhas.
- **Fora do Bitrix:** abre em **demonstração**, com os 6 casos do protótipo (Ana, Bruno, Daniela, Eduardo, Fernanda e Gustavo).

## Ver a demonstração

```
node build.js
```

Depois abra `dist/index.html` no navegador. Na faixa amarela do topo dá para entrar como liderança, coordenação, RH ou CEO. Nada é gravado.

## Desenvolver

| Comando | O que faz |
|---|---|
| `node build.js` | Junta `src/` em `dist/index.html` e gera `api/app.js`. Rode depois de qualquer mudança em `src/`. |
| `node --test test/*.test.js` | Testes das regras de cálculo, do provisionamento, das regras de negócio e das rotinas do servidor, contra um Bitrix simulado. |
| `node tools/provisionar.js --webhook <url> --simular` | Mostra o que seria criado no Bitrix. Sem `--simular`, cria. |

Não há dependências para instalar.

## Publicar

A Vercel publica a cada push na `main`, em **https://gestao-pessoas-bice.vercel.app** (conta `amorims-projects-ee19b0fd`). Atenção: `gestao-pessoas.vercel.app`, sem o "-bice", é outro app, de outra conta. O Bitrix abre o app com POST, por isso a página sai da função `api/app.js`, e não de um arquivo estático (ver `vercel.json`).

No Bitrix, o app é cadastrado como aplicativo local, com a URL da Vercel e os escopos `crm`, `user`, `department`, `userfieldconfig`, `im` e `calendar`. Depois, um administrador abre o app, vai em **Configuração** e clica em **Criar ou completar a estrutura**.

### Rotinas no servidor

O que não pode rodar no navegador de quem abre o app fica em funções da Vercel, que falam com o Bitrix pelo webhook de entrada:

| Função | Quando roda | O que faz |
|---|---|---|
| `api/sincronizar.js` | Todo dia às 6h | Mantém o processo Membros igual à estrutura da empresa (entradas, mudanças de área e saídas) |
| `api/avisos.js` | Todo dia às 8h | Avisos da 4.4: resumo semanal, dia do atraso, lembrete de 7 dias e aviso de 14 dias à coordenação |
| `api/eventos.js` | A cada item criado ou alterado (webhook de saída) | Trava do encerramento no servidor (4.1), qualquer que seja a origem da solicitação |
| `api/painel.js` | Quando a CEO abre o app | Números do painel geral, sem ela ter leitura nos processos |
| `api/status.js` | Tela de Configuração | Diz quais rotinas estão ligadas, sem mostrar valores |

Cada uma liga quando as variáveis dela estão gravadas na Vercel. Sem elas, responde 503. A lista das variáveis e o passo a passo estão em [docs/configuracao-bitrix.md](docs/configuracao-bitrix.md). No app, **Configuração → Rotinas no servidor** mostra o que já está ligado.

## Documentação

- [CLAUDE.md](CLAUDE.md): arquitetura, convenções e armadilhas do código.
- [docs/configuracao-bitrix.md](docs/configuracao-bitrix.md): o que configurar no Bitrix e na Vercel (permissões, robôs, rotinas do servidor, trava do encerramento).
- [docs/tabela-2.7-e-validacoes.md](docs/tabela-2.7-e-validacoes.md): o retorno do TI para o RH (tabela 2.7, validações da 6.2 e pontos de atenção).
