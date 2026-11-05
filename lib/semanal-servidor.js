/* =====================================================================================
   REVISÕES SEMANAIS NO SERVIDOR — busca as respostas no app semanal e guarda no Bitrix
   -------------------------------------------------------------------------------------
   Usada pela rotina das 6h (api/sincronizar.js) e pelo botão "Buscar agora" (api/semanal.js).
   O app semanal (SEMANAL_URL, padrão https://app-gestao-semanal.vercel.app) responde pelas
   rotas que o painel dele usa: /api/status (quem está no ciclo) e, por liderança,
   /api/respostas (as dela) e /api/respostas-liderados (as da equipe). Com SEMANAL_TOKEN na
   Vercel, as chamadas levam "Authorization: Bearer", para quando o app semanal pedir senha.
   Primeiro confere a tabela "Revisões semanais" no Bitrix; sem ela, nem chama o app semanal.
   Grava pelo webhook de entrada (escopo crm), com a mesma conversão do navegador.
   ===================================================================================== */
"use strict";
const calc = require("../src/js/10-calc.js");
const S = require("../src/js/56-semanal.js");
const { abrirPortal, listarTudo } = require("./bitrix-servidor.js");

const URL_PADRAO = "https://app-gestao-semanal.vercel.app";
const TEMPO_MAX_MS = 15000;

/** "AAAA-MM-DDTHH:MM" no fuso de São Paulo */
function agoraSaoPaulo(d) {
  const p = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d || new Date()).forEach((x) => { p[x.type] = x.value; });
  return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute;
}

const lista = (v) => (Array.isArray(v) ? v : []);

/** Lê o ciclo atual do app semanal -> { pessoas: [{id, papel, nome, whatsapp, respostas: [{pergunta, resposta}]}], cicloAtivo } */
async function lerAppSemanal(o) {
  const f = o.fetch || fetch;
  const base = String(o.url || URL_PADRAO).replace(/\/+$/, "");
  const cab = { Accept: "application/json" };
  if (o.token) cab.Authorization = "Bearer " + o.token;
  async function get(caminho) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), TEMPO_MAX_MS) : null;
    try {
      const r = await f(base + caminho, { headers: cab, signal: ctrl ? ctrl.signal : undefined });
      if (!r.ok) throw new Error("o app semanal respondeu " + r.status + " em " + caminho.split("?")[0]);
      return await r.json();
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("o app semanal não respondeu em " + TEMPO_MAX_MS / 1000 + " segundos (" + caminho.split("?")[0] + ")");
      throw e;
    } finally { if (t) clearTimeout(t); }
  }
  const st = await get("/api/status");
  const lideres = lista(st.lideres_all || st.lideres).filter((l) => l && l.ativo);
  const liderados = lista(st.liderados_all || st.liderados).filter((l) => l && l.ativo);
  const respondeu = (x) => Number(x.pergunta_atual || 0) > 0;
  const pessoas = [];
  for (const l of lideres) {
    const equipe = liderados.filter((x) => String(x.lider_id) === String(l.id));
    const [proprias, daEquipe] = await Promise.all([
      respondeu(l) ? get("/api/respostas?lider_id=" + encodeURIComponent(l.id)) : [],
      equipe.some(respondeu) ? get("/api/respostas-liderados?lider_id=" + encodeURIComponent(l.id)) : [],
    ]);
    pessoas.push({ id: String(l.id), papel: "lider", nome: l.nome || "", whatsapp: l.whatsapp || "", respostas: lista(proprias).map((r) => ({ pergunta: r.pergunta, resposta: r.resposta })) });
    // a rota da equipe devolve o nome do liderado (não o id): dentro da equipe de uma liderança, o nome identifica
    const porNome = {};
    lista(daEquipe).forEach((r) => { (porNome[r.liderado] = porNome[r.liderado] || []).push({ pergunta: r.pergunta, resposta: r.resposta }); });
    equipe.forEach((x) => pessoas.push({ id: String(x.id), papel: "liderado", nome: x.nome || "", whatsapp: x.whatsapp || "", respostas: porNome[x.nome] || [] }));
  }
  return { pessoas, cicloAtivo: !!st.ciclo_ativo };
}

/** o = { chamar, env, agora (Date), fetch } -> relatório: {ok, agora, pessoas, guardadas, atualizadas, semMudanca, semResposta, naoEncontradas, semMembro, falhas} */
async function importarSemanal(o) {
  const env = o.env || {};
  const quando = o.agora || new Date();
  const portal = await abrirPortal(o.chamar, ["membros", "semanal"]);
  if (!portal.est.semanal) {
    return { ok: false, semTabela: true, erro: "a tabela \"Revisões semanais\" ainda não existe no Bitrix: um administrador cria em Configuração → Criar ou completar a estrutura" };
  }
  const lido = await lerAppSemanal({ url: env.SEMANAL_URL, token: env.SEMANAL_TOKEN, fetch: o.fetch });
  // os telefones só servem para achar a pessoa: nunca vão para o Bitrix nem para a tela
  const usuarios = (await listarTudo(o.chamar, "user.get", { FILTER: { ACTIVE: true } })).map((u) => ({
    id: String(u.ID), nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || String(u.EMAIL || ""),
    fones: [u.PERSONAL_MOBILE, u.WORK_PHONE, u.PERSONAL_PHONE].filter(Boolean),
  }));
  const membros = await portal.listar("membros");
  const agora = agoraSaoPaulo(quando);
  // as revisões das últimas semanas, para não guardar duas vezes
  const filtro = {};
  filtro[">=" + portal.est.semanal.campos.semana] = calc.addDias(agora.slice(0, 10), -70);
  const existentes = await portal.listar("semanal", filtro);
  const plano = S.planejar({ pessoas: lido.pessoas, usuarios, membros, existentes, agora, agoraIso: quando.toISOString() });
  const falhas = [];
  let guardadas = 0, atualizadas = 0;
  for (const d of plano.criar) {
    try { await portal.criar("semanal", d); guardadas++; } catch (e) { falhas.push(d.titulo + ": " + String((e && e.message) || e)); }
  }
  for (const a of plano.atualizar) {
    try { await portal.atualizar("semanal", a.id, a.dados); atualizadas++; } catch (e) { falhas.push("revisão " + a.id + ": " + String((e && e.message) || e)); }
  }
  const semanas = Array.from(new Set(plano.criar.map((d) => d.semana))).sort();
  return {
    ok: !falhas.length, agora, cicloAtivo: lido.cicloAtivo, pessoas: lido.pessoas.length, guardadas, atualizadas, semMudanca: plano.semMudanca,
    semResposta: plano.semResposta, naoEncontradas: plano.naoEncontradas, semMembro: plano.semMembro, semanas, falhas,
  };
}

module.exports = { URL_PADRAO, agoraSaoPaulo, lerAppSemanal, importarSemanal };
