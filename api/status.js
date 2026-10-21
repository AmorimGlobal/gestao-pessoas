// Quais rotinas do servidor estão ligadas: só sim/não e o NOME das variáveis que faltam, nunca
// os valores. Usado pela tela de Configuração. Escrito à mão (não é gerado pelo build.js).
"use strict";
const { conferirSessao, tokenDaRequisicao } = require("../lib/acesso.js");

// GP_CEO_IDS é obrigatória em todas: é o que garante que a CEO não ganhe item nem receba aviso
const ROTINAS = {
  sincronizacao: ["BITRIX_WEBHOOK_URL", "CRON_SECRET", "GP_AVISAR_IDS", "GP_CEO_IDS"],
  avisos: ["BITRIX_WEBHOOK_URL", "CRON_SECRET", "GP_AVISAR_IDS", "GP_CEO_IDS"],
  trava: ["BITRIX_WEBHOOK_URL", "BITRIX_EVENTO_TOKEN", "GP_CEO_IDS"],
  painelCEO: ["BITRIX_WEBHOOK_URL", "GP_CEO_IDS"],
};
const OPCIONAIS = ["GP_EXCECOES_IDS", "GP_LINK_APP", "GP_CATEGORIA_VAGAS"];

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

// Só para quem está no Bitrix: o app manda o token da sessão (BX24.getAuth), conferido no portal
module.exports = async function handler(req, res, injetado) {
  const env = (injetado && injetado.env) || process.env;
  const token = await tokenDaRequisicao(req);
  if (!token) return responder(res, 401, { ok: false, erro: "abra pelo Bitrix" });
  try { await conferirSessao(token, env, injetado); } catch (e) { return responder(res, e.codigo === "rede" ? 503 : 401, { ok: false, erro: e.message }); }
  const tem = (v) => !!String(env[v] || "").trim();
  const corpo = { ok: true, rotinas: {}, opcionais: {} };
  Object.keys(ROTINAS).forEach((r) => {
    const falta = ROTINAS[r].filter((v) => !tem(v));
    corpo.rotinas[r] = { ligada: !falta.length, falta };
  });
  OPCIONAIS.forEach((v) => { corpo.opcionais[v] = tem(v); });
  return responder(res, 200, corpo);
};
