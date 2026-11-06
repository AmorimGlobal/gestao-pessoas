// Avaliação 360° da Revisão de Progresso: grava a resposta pelo webhook, sem ligar a quem respondeu
// (lib/revisao360.js). Escrito à mão (não é gerado pelo build.js).
//
// O app chama com POST { auth: <token da sessão do Bitrix (BX24.getAuth)>, cicloId, avaliado, modo, respostas }.
// O token só serve para saber quem responde e conferir a relação com a pessoa avaliada; ele não é gravado.
// De propósito, nada aqui escreve nos logs quem respondeu, nem quando dá erro.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL  webhook de entrada (o mesmo das rotinas), escopos crm, user e department
//   GP_AVISAR_IDS       IDs do RH (o primeiro fica como responsável pelas respostas)
//   GP_CEO_IDS, GP_EXCECOES_IDS  quem não entra na 360° (a CEO e quem está fora do app)
"use strict";
const { criarChamadaWebhook, lerCorpo, usuarioDoToken } = require("../lib/bitrix-servidor.js");
const { gravar360 } = require("../lib/revisao360.js");

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

module.exports = async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { ok: false, erro: "a 360° ainda não foi ligada na Vercel (falta BITRIX_WEBHOOK_URL)" });
  const corpo = (await lerCorpo(req)) || {};
  const token = typeof corpo.auth === "string" ? corpo.auth : "";
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix: abra pelo Bitrix" });
  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }
  try {
    const r = await gravar360({ chamar: inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL), env, uid, agora: inj.agora,
      pedido: { cicloId: corpo.cicloId, avaliado: corpo.avaliado, modo: corpo.modo, respostas: corpo.respostas } });
    return responder(res, r.status, r.ok ? { ok: true } : { ok: false, erro: r.erro });
  } catch (e) {
    // só a mensagem do Bitrix, sem quem respondeu nem o conteúdo
    console.error("[revisao360] falha ao gravar uma resposta:", String((e && e.message) || e).slice(0, 300));
    return responder(res, 502, { ok: false, erro: "o Bitrix não gravou a resposta. Tente de novo em alguns minutos." });
  }
};
