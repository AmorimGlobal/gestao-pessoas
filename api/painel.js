// Painel da CEO calculado no servidor (ponto de atenção 3 de docs/tabela-2.7-e-validacoes.md).
// Escrito à mão (não é gerado pelo build.js).
//
// A CEO não tem leitura nos processos do app, então o navegador dela não consegue calcular os
// números. O app manda o token da sessão do Bitrix (BX24.getAuth) para cá; esta função pergunta
// ao portal quem é a pessoa, confere que ela está em GP_CEO_IDS e devolve SÓ o resumo de números
// (dom.resumoPainel): sem nomes de membros e sem conteúdo escrito dos registros.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada (o mesmo das rotinas), para ler os registros
//   GP_CEO_IDS          IDs de usuário que podem ver o painel geral (a CEO)
//   GP_CATEGORIA_VAGAS  opcional: funil "HR | Requisição de Vagas" (padrão 77)
"use strict";
const dom = require("../src/js/50-dominio.js");
const { criarChamadaWebhook, hojeSaoPaulo, idsDe, lerCorpo, usuarioDoToken } = require("../lib/bitrix-servidor.js");
const { montarContexto } = require("../lib/contexto-servidor.js");

const VALIDADE_CACHE_MS = 10 * 60 * 1000;
let cache = null; // { hoje, em, resumo } entre chamadas da mesma instância

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.BITRIX_WEBHOOK_URL || !env.GP_CEO_IDS) return responder(res, 503, { ok: false, erro: "o painel da CEO ainda não foi ligado na Vercel (BITRIX_WEBHOOK_URL e GP_CEO_IDS)" });
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  const corpo = await lerCorpo(req);
  const token = corpo && typeof corpo.auth === "string" ? corpo.auth : "";
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix" });

  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }
  if (idsDe(env.GP_CEO_IDS).indexOf(uid) < 0) return responder(res, 403, { ok: false, erro: "o painel geral calculado no servidor é só da CEO" });

  try {
    const hoje = inj.hoje || hojeSaoPaulo();
    const agora = Date.now();
    if (inj.semCache) cache = null;
    if (!cache || cache.hoje !== hoje || agora - cache.em > VALIDADE_CACHE_MS) {
      const { ctx } = await montarContexto(inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL), hoje, { vagas: Number(env.GP_CATEGORIA_VAGAS || 77) });
      cache = { hoje, em: agora, resumo: dom.resumoPainel(dom.painelGeral(ctx)) };
    }
    return responder(res, 200, { ok: true, hoje, calculadoEm: new Date(cache.em).toISOString(), resumo: cache.resumo });
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
};
