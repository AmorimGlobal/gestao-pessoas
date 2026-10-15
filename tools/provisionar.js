#!/usr/bin/env node
/* Cria no Bitrix24 a estrutura do app (processos inteligentes, estágios, campos e a
   solução automatizada "Gestão de Pessoas"), a partir de src/js/20-schema.js.

   Uso:
     node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --simular
     node tools/provisionar.js --webhook https://<portal>/rest/<user>/<token>/ --saida config.json

   --simular  só lê o portal e lista o que seria criado. Comece sempre por ele.
   --saida    grava a configuração resultante (IDs dos processos, estágios e campos).

   O webhook precisa dos escopos crm e userfieldconfig, e de um usuário administrador.
   Rode primeiro no ambiente de teste (especificação, 5.2). É idempotente: rodar de novo
   só cria o que faltar. */
"use strict";
const fs = require("fs");
const path = require("path");
const { provisionar } = require(path.join(__dirname, "..", "src", "js", "30-provision.js"));

function argumentos(argv) {
  const a = { simular: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--simular") a.simular = true;
    else if (argv[i] === "--webhook") a.webhook = argv[++i];
    else if (argv[i] === "--saida") a.saida = argv[++i];
    else if (argv[i] === "--config") a.config = argv[++i];
  }
  return a;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function criarChamada(webhook) {
  const base = webhook.replace(/\/+$/, "") + "/";
  return async function chamar(metodo, params) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await espera(260); // limite do Bitrix: ~2 chamadas por segundo
      const resp = await fetch(base + metodo + ".json", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}),
      });
      const json = await resp.json().catch(() => ({ error: "HTTP " + resp.status }));
      if (json.error === "QUERY_LIMIT_EXCEEDED") { await espera(1500 * (tentativa + 1)); continue; }
      if (json.error) throw new Error(metodo + ": " + json.error + (json.error_description ? " — " + json.error_description : ""));
      return { dados: json.result, proximo: json.next === undefined ? null : json.next };
    }
    throw new Error(metodo + ": limite de chamadas excedido repetidas vezes");
  };
}

(async function () {
  const a = argumentos(process.argv);
  if (!a.webhook) {
    console.error("Informe --webhook https://<portal>/rest/<user>/<token>/ (escopos crm e userfieldconfig).");
    process.exit(2);
  }
  const configAtual = a.config ? JSON.parse(fs.readFileSync(a.config, "utf8")) : undefined;
  console.log(a.simular ? "SIMULAÇÃO — nada será gravado no portal.\n" : "Gravando no portal.\n");
  try {
    const { config, relatorio } = await provisionar({
      chamar: criarChamada(a.webhook), simular: a.simular, configAtual, log: (m) => console.log(m),
    });
    const porMetodo = {};
    relatorio.forEach((r) => { porMetodo[r.metodo] = (porMetodo[r.metodo] || 0) + 1; });
    console.log("\nAlterações " + (a.simular ? "que seriam feitas" : "feitas") + ":", Object.keys(porMetodo).length ? porMetodo : "nenhuma");
    if (a.saida) {
      fs.writeFileSync(a.saida, JSON.stringify(config, null, 2));
      console.log("Configuração gravada em " + a.saida + ". Importe-a na tela Configuração do app.");
    }
  } catch (e) {
    console.error("\nFALHOU: " + e.message);
    if (/insufficient_scope|ACCESS_DENIED/i.test(e.message)) {
      console.error("O webhook precisa dos escopos crm e userfieldconfig, criado por um administrador.");
    }
    process.exit(1);
  }
})();
