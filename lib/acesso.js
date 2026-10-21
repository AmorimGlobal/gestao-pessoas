/* =====================================================================================
   ACESSO — a página do app só sai para quem abriu pelo Bitrix24 da Amorim
   -------------------------------------------------------------------------------------
   O Bitrix abre o app local com POST, mandando o token da sessão de quem está logado
   (AUTH_ID). Antes de entregar a página, o servidor pergunta ao portal quem é o dono do
   token (user.current). Sem token, com token de outro portal ou vencido: tela de acesso
   negado. Abrir o link direto no navegador (GET) também cai nela.

   O portal vem de GP_PORTAL ou do webhook de entrada (BITRIX_WEBHOOK_URL), nunca de um
   dado que chega na requisição.
   ===================================================================================== */
"use strict";
const { lerCorpo, usuarioDoToken } = require("./bitrix-servidor.js");

const PORTAL_PADRAO = "amorimglobal.bitrix24.com.br";
const VALIDADE_MS = 5 * 60 * 1000;
const sessoes = new Map(); // token -> { id, ate }: evita perguntar ao portal a cada recarga

function portalDe(env) {
  if (env.GP_PORTAL) return String(env.GP_PORTAL).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  try { if (env.BITRIX_WEBHOOK_URL) return new URL(env.BITRIX_WEBHOOK_URL).host; } catch (e) { /* URL inválida: usa o padrão */ }
  return PORTAL_PADRAO;
}

/** Dono do token, conferido no portal. Lança erro com codigo "sessao" (token recusado) ou "rede". */
async function conferirSessao(token, env, inj) {
  const agora = Date.now();
  const guardada = sessoes.get(token);
  if (guardada && guardada.ate > agora) return guardada.id;
  let id;
  try {
    id = await ((inj && inj.usuarioDoToken) || usuarioDoToken)("https://" + portalDe(env) + "/", token, inj && inj.fetch);
  } catch (e) {
    const erro = new Error(String((e && e.message) || e));
    erro.codigo = /sessão|token|expirou/i.test(erro.message) ? "sessao" : "rede";
    throw erro;
  }
  if (sessoes.size > 500) sessoes.clear();
  sessoes.set(token, { id, ate: agora + VALIDADE_MS });
  return id;
}

/** Token da sessão: AUTH_ID no POST com que o Bitrix abre o app, ou "auth" nas chamadas do próprio app */
async function tokenDaRequisicao(req) {
  if (req.method !== "POST") return "";
  const corpo = await lerCorpo(req);
  const t = (corpo && (corpo.AUTH_ID || corpo.auth)) || "";
  return typeof t === "string" ? t : "";
}

function paginaNegada(portal, titulo, texto) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Gestão de Pessoas</title><style>body{margin:0;font-family:Poppins,system-ui,sans-serif;background:#000c33;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;box-sizing:border-box}" +
    "main{max-width:460px}h1{font-size:22px;margin:0 0 12px}p{color:#c9d1e6;line-height:1.5}a{color:#00ff5f}</style></head><body><main>" +
    "<h1>" + esc(titulo) + "</h1><p>" + esc(texto) + '</p><p><a href="https://' + esc(portal) + '/">Entrar no Bitrix24</a></p></main></body></html>';
}

/** Handler da página (api/app.js, gerado pelo build.js) */
async function atenderPagina(req, res, html, injetado) {
  const env = (injetado && injetado.env) || process.env;
  const portal = portalDe(env);
  const enviar = (status, corpo) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(corpo);
  };
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "GET" && req.method !== "POST") { res.statusCode = 405; res.end(); return; }
  const negado = () => enviar(403, paginaNegada(portal, "Acesso só pelo Bitrix24", "O Gestão de Pessoas abre só dentro do Bitrix24 da Amorim, com o seu login. Entre no Bitrix e abra o app pelo menu."));
  const token = await tokenDaRequisicao(req);
  if (!token) return negado();
  try {
    await conferirSessao(token, env, injetado);
  } catch (e) {
    if (e.codigo === "rede") return enviar(503, paginaNegada(portal, "Não deu para confirmar a sua sessão", "O Bitrix não respondeu agora. Recarregue a página em alguns segundos."));
    return negado();
  }
  if (typeof res.removeHeader === "function") res.removeHeader("X-Frame-Options");
  return enviar(200, html);
}

module.exports = { atenderPagina, conferirSessao, tokenDaRequisicao, portalDe, paginaNegada, _sessoes: sessoes };
