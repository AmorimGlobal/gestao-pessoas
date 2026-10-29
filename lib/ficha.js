/* =====================================================================================
   FICHA DA FUNÇÃO POR E-MAIL — o que o novo membro recebe (reunião de 29/10/2026)
   -------------------------------------------------------------------------------------
   Monta o e-mail com as expectativas da função: escopo, competências comportamentais,
   indicadores, as entregas de cada fase com a data dos alinhamentos (Dias 30, 60 e 90) e
   quem acompanha o membro. Função pura (sem rede), testada em test/ficha.test.js.

   NUNCA entram notas, avaliações, leituras de entrega nem justificativas: o membro recebe a
   ficha, e os resultados ficam só para a liderança e o RH (decisão da reunião).
   ===================================================================================== */
"use strict";
const calc = require("../src/js/10-calc.js");

const NAVY = "#000c33";
const AZUL = "#0044ff";

const esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";
/** Uma linha por item; tira marcadores digitados ("-", "•", "*", "1.") */
function linhas(txt) {
  return String(txt || "").split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}

/* ---------- blocos em HTML e em texto ---------- */
function blocoHtml(titulo, conteudo) {
  return '<h2 style="color:' + NAVY + ';font-size:17px;margin:26px 0 8px;">' + esc(titulo) + "</h2>" + conteudo;
}
function textoHtml(txt, vazio) {
  const ls = linhas(txt);
  if (!ls.length) return '<p style="margin:0;color:#5b6478;">' + esc(vazio) + "</p>";
  if (ls.length === 1) return '<p style="margin:0;">' + esc(ls[0]) + "</p>";
  return '<ul style="margin:0;padding-left:20px;">' + ls.map((l) => '<li style="margin:2px 0;">' + esc(l) + "</li>").join("") + "</ul>";
}
function textoPlano(txt, vazio) {
  const ls = linhas(txt);
  if (!ls.length) return vazio;
  if (ls.length === 1) return ls[0];
  return ls.map((l) => "- " + l).join("\n");
}

const FASES = [
  { chave: "entregasAncoragem", fase: "Ancoragem", periodo: "do Dia 1 ao Dia 30", nota: "Nas semanas 1 e 2, exercícios práticos para conhecer o trabalho. Nas semanas 3 e 4, as primeiras entregas:" },
  { chave: "entregasImersao", fase: "Imersão", periodo: "do Dia 31 ao Dia 60", nota: "Entregas de casos reais, com o apoio da supervisão:" },
  { chave: "entregasMarAberto", fase: "Mar Aberto", periodo: "do Dia 61 ao Dia 90", nota: "O escopo completo da função:" },
];
const SEM_ENTREGAS = "A sua liderança combina as entregas desta fase com você.";

/** dados = { membro: {nome, email, funcao}, lideranca: {nome}, supervisao: {nome}, colega: {nome}, enviadoPor: {nome},
              onboarding: {fichaEscopo, fichaPadroes, fichaIndicadores, entregasAncoragem, entregasImersao, entregasMarAberto, ingresso},
              alinhamentos: [{numero, rotulo, fase, dia, data}] }  ->  { assunto, html, texto } */
function montarFicha(dados) {
  const d = dados || {};
  const m = d.membro || {};
  const o = d.onboarding || {};
  const nome = primeiroNome(m.nome);
  const lid = d.lideranca && d.lideranca.nome ? d.lideranca.nome : "";
  const alinh = {};
  (d.alinhamentos || []).forEach((a) => { if (a && a.fase) alinh[a.fase] = a; });
  const funcao = String(m.funcao || "").trim();
  const assunto = "Boas-vindas à Amorim: a Ficha da sua função" + (funcao ? " · " + funcao : "");
  const intro = "Esta é a Ficha da sua função: o que se espera do seu trabalho nos primeiros 90 dias, na Embarcação Amorim." +
    (lid ? " Ela foi preparada pela sua liderança, " + lid + ", e" : " Ela") + " guia as conversas de acompanhamento com a sua liderança nos Dias 30, 60 e 90.";
  const dataAl = (a) => (a && a.data ? calc.fmtDataAno(a.data) : "");
  // rótulo próprio, neutro: o do app ("Avaliação do 1º mês") é para a liderança e o RH, não para o membro
  const rotuloAl = (a) => (a ? "Conversa de acompanhamento com a sua liderança: Dia " + a.dia + (dataAl(a) ? ", " + dataAl(a) : "") + "." : "");

  const pessoas = [
    ["Sua liderança (o Leme)", lid || "a definir"],
    ["Supervisão (a Bússola)", (d.supervisao && d.supervisao.nome) || "a definir"],
    ["Colega de trabalho (o Mapa)", (d.colega && d.colega.nome) || "a definir"],
    ["RH e TI (o Porto)", "acesso, ferramentas, contrato e qualquer dúvida sobre a Amorim"],
  ];

  /* ---------- HTML ---------- */
  const fasesHtml = FASES.map((f) => {
    const a = alinh[f.fase];
    const ent = linhas(o[f.chave]);
    return '<div style="border-left:3px solid ' + AZUL + ';padding:4px 0 4px 14px;margin:0 0 16px;">' +
      '<div style="font-weight:700;color:' + NAVY + ';">' + esc(f.fase) + ' <span style="font-weight:400;color:#5b6478;">· ' + esc(f.periodo) + "</span></div>" +
      '<p style="margin:4px 0 6px;">' + esc(ent.length ? f.nota : SEM_ENTREGAS) + "</p>" +
      (ent.length ? '<ul style="margin:0 0 6px;padding-left:20px;">' + ent.map((l) => '<li style="margin:2px 0;">' + esc(l) + "</li>").join("") + "</ul>" : "") +
      (a ? '<div style="font-size:13px;color:#5b6478;">' + esc(rotuloAl(a)) + "</div>" : "") + "</div>";
  }).join("");
  const pessoasHtml = '<table role="presentation" style="border-collapse:collapse;width:100%;">' + pessoas.map((p) =>
    '<tr><td style="padding:6px 12px 6px 0;color:#5b6478;vertical-align:top;white-space:nowrap;">' + esc(p[0]) + '</td><td style="padding:6px 0;font-weight:600;color:' + NAVY + ';">' + esc(p[1]) + "</td></tr>").join("") + "</table>";
  const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(assunto) + "</title></head>" +
    '<body style="margin:0;padding:0;background:#f4f6fb;">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Poppins,Arial,Helvetica,sans-serif;color:#1d2433;font-size:15px;line-height:1.55;">' +
    '<div style="background:' + NAVY + ';color:#ffffff;border-radius:12px 12px 0 0;padding:22px 24px;">' +
    '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#00ff5f;">Embarcação Amorim</div>' +
    '<div style="font-size:22px;font-weight:700;margin-top:4px;">Ficha da função' + (funcao ? " · " + esc(funcao) : "") + "</div></div>" +
    '<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;">' +
    '<p style="margin:0 0 10px;">Olá' + (nome ? ", " + esc(nome) : "") + "! Boas-vindas à Amorim.</p>" +
    '<p style="margin:0 0 4px;">' + esc(intro) + "</p>" +
    (o.ingresso ? '<p style="margin:0;color:#5b6478;font-size:13px;">Dia 1: ' + esc(calc.fmtDataAno(o.ingresso)) + "</p>" : "") +
    blocoHtml("Sua função", textoHtml(o.fichaEscopo, "A sua liderança apresenta o escopo da função no primeiro dia.")) +
    blocoHtml("Competências comportamentais", textoHtml(o.fichaPadroes, "A sua liderança apresenta as competências esperadas no primeiro dia.")) +
    blocoHtml("Indicadores", textoHtml(o.fichaIndicadores, "A sua liderança apresenta os indicadores da função no primeiro dia.")) +
    blocoHtml("O que se espera em cada fase", fasesHtml) +
    blocoHtml("Quem acompanha você", pessoasHtml) +
    '<p style="margin:26px 0 0;color:#5b6478;font-size:13px;">Dúvidas sobre a Ficha? Responda este e-mail' + (d.enviadoPor && d.enviadoPor.nome ? ": a resposta vai para " + esc(d.enviadoPor.nome) + "." : " ou fale com a sua liderança.") + "</p>" +
    "</div></div></body></html>";

  /* ---------- texto puro ---------- */
  const t = [];
  t.push("Olá" + (nome ? ", " + nome : "") + "! Boas-vindas à Amorim.", "", intro);
  if (o.ingresso) t.push("Dia 1: " + calc.fmtDataAno(o.ingresso));
  t.push("", "SUA FUNÇÃO" + (funcao ? " · " + funcao : ""), textoPlano(o.fichaEscopo, "A sua liderança apresenta o escopo da função no primeiro dia."));
  t.push("", "COMPETÊNCIAS COMPORTAMENTAIS", textoPlano(o.fichaPadroes, "A sua liderança apresenta as competências esperadas no primeiro dia."));
  t.push("", "INDICADORES", textoPlano(o.fichaIndicadores, "A sua liderança apresenta os indicadores da função no primeiro dia."));
  t.push("", "O QUE SE ESPERA EM CADA FASE");
  FASES.forEach((f) => {
    const a = alinh[f.fase];
    const ent = linhas(o[f.chave]);
    t.push("", f.fase + " · " + f.periodo, ent.length ? f.nota : SEM_ENTREGAS);
    ent.forEach((l) => t.push("- " + l));
    if (a) t.push(rotuloAl(a));
  });
  t.push("", "QUEM ACOMPANHA VOCÊ");
  pessoas.forEach((p) => t.push(p[0] + ": " + p[1]));
  t.push("", "Dúvidas sobre a Ficha? Responda este e-mail" + (d.enviadoPor && d.enviadoPor.nome ? ": a resposta vai para " + d.enviadoPor.nome + "." : " ou fale com a sua liderança."));

  return { assunto, html, texto: t.join("\n") };
}

module.exports = { montarFicha, linhas };
