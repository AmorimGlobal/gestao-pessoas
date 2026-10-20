/* =====================================================================================
   AVISOS DA 4.4 — rotina diária na Vercel (api/avisos.js)
   -------------------------------------------------------------------------------------
   - Resumo semanal: no primeiro dia útil da semana, UMA mensagem por pessoa com as
     pendências dela (uma liderança com 5 pendências em dia recebe 1 mensagem, não 5).
   - No dia em que algo atrasa: um aviso por pessoa, com tudo o que venceu.
   - Com 7 dias de atraso: um lembrete por pendência a quem é responsável, com o nome da
     tarefa, a data original e o link para resolver.
   - Com 14 dias de atraso: a coordenação do membro também é avisada. Quando a liderança é a
     própria coordenação (ou não há coordenação), o aviso vai para o RH.

   "Uma única vez" sem guardar estado: cada marco é avisado no dia útil em que é cruzado,
   comparando o atraso de hoje com o do dia útil anterior. Fim de semana e feriado não
   avisam; o que cruzou nesses dias sai no dia útil seguinte. Por isso a rotina precisa
   rodar todo dia.

   As pendências são as mesmas da tela "O que depende de você" (dom.pendenciasDe). Nenhum
   aviso vai para o membro nem para a CEO, e nenhum leva conteúdo de feedback, leitura ou plano.
   ===================================================================================== */
"use strict";
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");

const MAX_ITENS = 5;

function diaUtilAnterior(hoje, feriados) {
  let d = calc.addDias(hoje, -1);
  for (let i = 0; i < 30 && !calc.ehDiaUtil(d, feriados); i++) d = calc.addDias(d, -1);
  return d;
}
/** Primeiro dia útil da semana (segunda, ou terça se a segunda for feriado...) */
function primeiroDiaUtilDaSemana(hoje, feriados) {
  if (!calc.ehDiaUtil(hoje, feriados)) return false;
  const segunda = calc.addDias(hoje, -((calc.diaSemana(hoje) + 6) % 7));
  return diaUtilAnterior(hoje, feriados) < segunda;
}
/** O atraso chegou a n dias entre o dia útil anterior (exclusive) e hoje (inclusive) */
function cruzou(prazo, hoje, antes, n) {
  return !!prazo && calc.diasAtraso(prazo, hoje) >= n && calc.diasAtraso(prazo, antes) < n;
}

/** Quem responde por quais pendências: lideranças (equipe) e coordenações (aprovações) */
function responsaveis(ctx) {
  const ids = new Set();
  (ctx.departamentos || []).forEach((d) => { if (d.chefe) ids.add(d.chefe); });
  (ctx.registros.membros || []).forEach((m) => { if (m.lideranca) ids.add(m.lideranca); if (m.coordenacao) ids.add(m.coordenacao); });
  const lista = [];
  ids.forEach((uid) => {
    const pend = dom.pendenciasDe(ctx, dom.equipeDe(ctx, uid), { uid });
    dom.aprovacoesPendentes(ctx, uid).forEach((a) => {
      const nome = a.membro ? a.membro.nome.split(" ")[0] : "membro";
      pend.push({ id: "aprov-" + a.item.id, tipo: "Offboarding", titulo: "Aprovar a solicitação de encerramento de " + nome, membro: a.membro, prazo: a.prazo,
        atrasoDias: a.prazo ? calc.diasAtraso(a.prazo, ctx.hoje) : 0, atrasado: !!a.prazo && calc.diasAtraso(a.prazo, ctx.hoje) > 0 });
    });
    if (pend.length) lista.push({ uid, pend });
  });
  return lista;
}

const linhaPend = (p) => "• " + p.titulo + (p.prazo ? " (prazo " + calc.fmtData(p.prazo) + (p.atrasado ? ", " + p.atrasoDias + (p.atrasoDias === 1 ? " dia" : " dias") + " de atraso" : "") + ")" : "");
function lista(itens) {
  return itens.slice(0, MAX_ITENS).map(linhaPend).join("\n") + (itens.length > MAX_ITENS ? "\n• e mais " + (itens.length - MAX_ITENS) : "");
}
const comLink = (texto, link) => texto + (link ? "\nAbra o app Gestão de Pessoas: " + link : "\nAbra o app Gestão de Pessoas no Bitrix.");

/** Planeja as mensagens do dia. Puro.
    op = { ctx (já indexado, com feriados), rhIds, naoAvisar, link }
    -> { diaUtil, semanal, mensagens: [{ para, tipo: "semanal"|"venceu"|"lembrete7"|"aviso14", texto }] } */
function planejar(op) {
  const ctx = op.ctx;
  const hoje = ctx.hoje;
  const feriados = calc.conjuntoFeriados([(ctx.feriados && ctx.feriados.nacionais) || []]);
  const diaUtil = calc.ehDiaUtil(hoje, feriados);
  const semanal = primeiroDiaUtilDaSemana(hoje, feriados);
  const nunca = new Set((op.naoAvisar || []).map(String));
  const rh = (op.rhIds || []).map(String).filter((id) => !nunca.has(id));
  const mensagens = [];
  if (!diaUtil) return { diaUtil, semanal, mensagens };
  const antes = diaUtilAnterior(hoje, feriados);
  const nomeDe = (uid) => dom.pessoa(ctx, uid).nome;
  const enviar = (para, tipo, texto) => {
    if (!para || nunca.has(String(para))) return;
    mensagens.push({ para: String(para), tipo, texto });
  };

  const resp = responsaveis(ctx).filter((r) => !nunca.has(String(r.uid)));
  const aviso14 = {}; // destinatário -> linhas

  resp.forEach(({ uid, pend }) => {
    // resumo semanal: 1 mensagem com tudo
    if (semanal) {
      const atrasadas = pend.filter((p) => p.atrasado);
      const emDia = pend.filter((p) => !p.atrasado);
      let t = "Resumo da semana: " + pend.length + (pend.length === 1 ? " pendência" : " pendências") +
        (atrasadas.length ? ", " + atrasadas.length + (atrasadas.length === 1 ? " atrasada" : " atrasadas") : ", todas em dia") + ".";
      if (atrasadas.length) t += "\nAtrasadas:\n" + lista(atrasadas);
      if (emDia.length) t += "\nPróximas:\n" + lista(emDia);
      enviar(uid, "semanal", t);
    }
    // venceu desde o último dia útil: 1 mensagem com tudo
    const venceu = pend.filter((p) => cruzou(p.prazo, hoje, antes, 1));
    if (venceu.length) enviar(uid, "venceu", (venceu.length === 1 ? "Venceu o prazo de uma pendência:\n" : "Venceu o prazo de " + venceu.length + " pendências:\n") + lista(venceu));
    // 7 dias: um lembrete por pendência
    pend.filter((p) => cruzou(p.prazo, hoje, antes, 7)).forEach((p) => {
      enviar(uid, "lembrete7", "Lembrete: \"" + p.titulo + "\" está com " + p.atrasoDias + " dias de atraso. Prazo original: " + calc.fmtDataAno(p.prazo) + ".");
    });
    // 14 dias: coordenação do membro, ou o RH quando a coordenação é quem responde
    pend.filter((p) => cruzou(p.prazo, hoje, antes, 14)).forEach((p) => {
      const coord = p.membro && p.membro.coordenacao ? String(p.membro.coordenacao) : "";
      const destinos = coord && coord !== String(uid) && !nunca.has(coord) ? [coord] : rh;
      const linha = "• \"" + p.titulo + "\", da equipe de " + nomeDe(uid) + " (prazo original " + calc.fmtDataAno(p.prazo) + ")";
      destinos.forEach((d) => { if (d !== String(uid)) (aviso14[d] = aviso14[d] || []).push(linha); });
    });
  });
  Object.keys(aviso14).forEach((d) => {
    const ls = aviso14[d];
    enviar(d, "aviso14", (ls.length === 1 ? "Uma pendência está" : ls.length + " pendências estão") + " com 14 dias ou mais de atraso:\n" + ls.join("\n"));
  });

  // RH: a fila do que aguarda o RH entra no resumo semanal
  if (semanal) {
    const fila = dom.filaRH(ctx).length;
    const atrasadas = resp.reduce((n, r) => n + r.pend.filter((p) => p.atrasado).length, 0);
    rh.forEach((id) => {
      const ja = mensagens.find((m) => m.para === id && m.tipo === "semanal");
      const t = "Para o RH: " + fila + (fila === 1 ? " solicitação de encerramento aguardando" : " solicitações de encerramento aguardando") + " o RH e " + atrasadas + (atrasadas === 1 ? " pendência atrasada" : " pendências atrasadas") + " nas equipes.";
      if (ja) ja.texto += "\n" + t;
      else enviar(id, "semanal", "Resumo da semana. " + t);
    });
  }
  mensagens.forEach((m) => { m.texto = comLink(m.texto, op.link); });
  return { diaUtil, semanal, mensagens };
}

/** Envia as mensagens planejadas. notificar(ids, texto). Falha num envio não para os outros. */
async function enviar(mensagens, notificar) {
  const falhas = [];
  for (const m of mensagens) {
    try { await notificar([m.para], m.texto); } catch (e) { falhas.push({ para: m.para, tipo: m.tipo, erro: String((e && e.message) || e) }); }
  }
  return falhas;
}

module.exports = { planejar, enviar, cruzou, diaUtilAnterior, primeiroDiaUtilDaSemana };
