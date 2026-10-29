// Envia ao novo membro, por e-mail, a Ficha da função do onboarding (reunião de 29/10/2026).
// Escrito à mão (não é gerado pelo build.js).
//
// O app chama com POST { auth: <token da sessão do Bitrix (BX24.getAuth)>, onboardingId }.
// Quem pode enviar é quem o PRÓPRIO Bitrix deixa ler aquele onboarding: o servidor pergunta ao
// portal com o token de quem pediu (as funções de acesso do CRM valem sozinhas, como na tela).
// O membro recebe a ficha (escopo, competências, indicadores, entregas e datas das fases), nunca
// notas, leituras nem avaliações. O item ganha a data do envio e um comentário no histórico.
//
// Variáveis de ambiente na Vercel:
//   BITRIX_WEBHOOK_URL   webhook de entrada (o mesmo das rotinas), para ler o onboarding e gravar o envio
//   SMTP_HOST, SMTP_PORTA (opcional, 465), SMTP_USUARIO, SMTP_SENHA, EMAIL_REMETENTE (opcional): lib/email.js
"use strict";
const calc = require("../src/js/10-calc.js");
const { criarChamadaWebhook, abrirPortal, lerCorpo, usuarioDoToken, usuarioDoBitrix } = require("../lib/bitrix-servidor.js");
const { emailConfigurado, criarEmail, emailValido } = require("../lib/email.js");
const { montarFicha } = require("../lib/ficha.js");

const REENVIO_MIN_MS = 2 * 60 * 1000; // dois cliques seguidos não mandam dois e-mails

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

/** Chamada ao portal com o token de quem está no app (não o webhook). Sempre no MESMO portal do
    webhook de entrada, nunca num endereço vindo do navegador. -> { ok, dados } ou { ok: false, erro } */
async function chamarComToken(webhookUrl, token, metodo, params, fetchImpl) {
  const f = fetchImpl || fetch;
  const corpo = new URLSearchParams({ auth: token });
  Object.keys(params || {}).forEach((k) => corpo.append(k, String(params[k])));
  const resp = await f(new URL(webhookUrl).origin + "/rest/" + metodo + ".json", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: corpo.toString() });
  const json = await resp.json().catch(() => ({ error: "HTTP " + resp.status }));
  if (json.error) return { ok: false, erro: String(json.error) };
  return { ok: true, dados: json.result };
}

/** 29/10/2026 15:30, no fuso de São Paulo */
function dataHoraSP(d) {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}

async function handler(req, res, injetado) {
  const inj = injetado || {};
  const env = inj.env || process.env;
  if (!env.BITRIX_WEBHOOK_URL) return responder(res, 503, { ok: false, erro: "o envio da ficha ainda não foi ligado na Vercel (falta BITRIX_WEBHOOK_URL)" });
  const falta = emailConfigurado(env);
  if (falta.length && !inj.email) return responder(res, 503, { ok: false, erro: "o envio de e-mail ainda não foi configurado na Vercel: falta " + falta.join(", ") });
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "use POST" });
  const corpo = (await lerCorpo(req)) || {};
  const token = typeof corpo.auth === "string" ? corpo.auth : "";
  const onboardingId = String(corpo.onboardingId || "").trim();
  if (!token) return responder(res, 401, { ok: false, erro: "sem o token do Bitrix: abra pelo Bitrix" });
  if (!/^\d+$/.test(onboardingId)) return responder(res, 400, { ok: false, erro: "onboarding não informado" });

  let uid;
  try {
    uid = await (inj.usuarioDoToken || usuarioDoToken)(env.BITRIX_WEBHOOK_URL, token);
  } catch (e) {
    return responder(res, 401, { ok: false, erro: String((e && e.message) || e) });
  }

  try {
    const chamar = inj.chamar || criarChamadaWebhook(env.BITRIX_WEBHOOK_URL);
    const portal = await abrirPortal(chamar, ["membros", "onboarding"]);
    const eti = portal.eti("onboarding");
    if (!eti) return responder(res, 503, { ok: false, erro: "o processo Onboarding não foi encontrado no Bitrix" });

    // permissão: o Bitrix deixa esta pessoa ler este onboarding?
    let acesso;
    try {
      acesso = await (inj.chamarComToken || chamarComToken)(env.BITRIX_WEBHOOK_URL, token, "crm.item.get", { entityTypeId: eti, id: Number(onboardingId) });
    } catch (e) {
      return responder(res, 503, { ok: false, erro: "o Bitrix não respondeu agora; tente de novo em alguns segundos" });
    }
    if (!acesso.ok) return responder(res, 403, { ok: false, erro: "sem acesso a este onboarding" });

    const ob = await portal.obter("onboarding", onboardingId);
    if (!ob.membroId) return responder(res, 400, { ok: false, erro: "este onboarding não está ligado a um membro" });
    const membro = await portal.obter("membros", ob.membroId);
    const usuario = async (id) => {
      if (!id) return null;
      const r = await chamar("user.get", { FILTER: { ID: String(id) } });
      const u = (r.dados || [])[0];
      return u ? usuarioDoBitrix(u) : null;
    };
    const uMembro = await usuario(membro.responsavel || ob.responsavel);
    if (uMembro && uMembro.id === String(uid)) return responder(res, 403, { ok: false, erro: "a ficha é enviada pela liderança ou pelo RH" });
    const para = uMembro && uMembro.email ? uMembro.email.trim() : "";
    if (!emailValido(para)) return responder(res, 400, { ok: false, erro: "o membro não tem e-mail válido no cadastro do Bitrix" });

    const agora = inj.agora || new Date();
    if (ob.fichaEnviadaEm && !corpo.reenviar && agora.getTime() - Date.parse(ob.fichaEnviadaEm) < REENVIO_MIN_MS) {
      return responder(res, 409, { ok: false, erro: "a ficha acabou de ser enviada (" + dataHoraSP(new Date(ob.fichaEnviadaEm)) + ")" });
    }

    const solicitante = (await usuario(uid)) || { id: String(uid), nome: "Usuário " + uid, email: "" };
    const lideranca = await usuario(membro.lideranca);
    const supervisao = await usuario(ob.supervisao);
    const colega = await usuario(ob.colega);
    // datas dos alinhamentos com os feriados nacionais (os de SP e Salvador ficam na Configuração do app, que só o navegador lê)
    const ingresso = ob.ingresso || membro.ingresso || "";
    let alinhamentos = [];
    if (calc.dataValida(ingresso)) {
      const ano = Number(ingresso.slice(0, 4));
      const feriados = calc.conjuntoFeriados([calc.feriadosNacionais(ano), calc.feriadosNacionais(ano + 1)]);
      alinhamentos = calc.datasAlinhamentos(ingresso, feriados);
    }
    const ficha = montarFicha({
      membro: { nome: uMembro.nome, email: para, funcao: membro.funcao }, lideranca, supervisao, colega,
      enviadoPor: solicitante, onboarding: Object.assign({}, ob, { ingresso }), alinhamentos,
    });
    const email = inj.email || criarEmail(env);
    const resposta = await email.enviar({ para, assunto: ficha.assunto, html: ficha.html, texto: ficha.texto, responderPara: solicitante.email });
    console.log("[gestao-pessoas] ficha do onboarding " + ob.id + " enviada para " + para + " a pedido de " + uid + " · servidor: " + resposta);

    // o e-mail já saiu: uma falha ao registrar não vira erro para quem enviou, mas fica no log e na resposta
    const enviadaEm = agora.toISOString();
    const pendencias = [];
    try { await portal.atualizar("onboarding", ob.id, { fichaEnviadaEm: enviadaEm }); } catch (e) { console.error(e); pendencias.push("a data do envio não foi gravada no item"); }
    try {
      await portal.comentar("onboarding", ob.id, "Ficha enviada por e-mail para " + para + " por " + solicitante.nome + " em " + dataHoraSP(agora) + ".");
    } catch (e) { console.error(e); pendencias.push("o comentário do histórico não foi gravado"); }
    return responder(res, 200, Object.assign({ ok: true, para, enviadaEm }, pendencias.length ? { aviso: "E-mail enviado, mas " + pendencias.join(" e ") + "." } : {}));
  } catch (e) {
    console.error(e);
    return responder(res, 500, { ok: false, erro: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.chamarComToken = chamarComToken;
