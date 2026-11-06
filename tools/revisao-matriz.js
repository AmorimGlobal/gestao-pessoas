#!/usr/bin/env node
/* =====================================================================================
   Gera src/js/57-revisao-matriz.js a partir do protótipo do RH "Revisão de Progresso"
   (Revisao_de_Progresso_Prototipo.html, matrizes v1.2 de 04/11/2026).
   -------------------------------------------------------------------------------------
   O protótipo traz a matriz inteira de cargos embutida: cada KPI e cada competência aparece
   para os 40 cargos (C01 a C40), e o CSS mostra só o do cargo do liderado. Os nomes dos
   cargos estão na planilha Template_Revisao_de_Progresso_v1.2.xlsx, que não veio junto: o
   protótipo só nomeia 3 (os liderados de exemplo). O RH dá nome aos outros em Configuração.
   Uso: node tools/revisao-matriz.js <caminho do protótipo .html>
   ===================================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const origem = process.argv[2];
if (!origem) { console.error("Uso: node tools/revisao-matriz.js <Revisao_de_Progresso_Prototipo.html>"); process.exit(1); }
const html = fs.readFileSync(origem, "utf8");

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ", "&middot;": "·", "&rarr;": "→", "&ndash;": "–", "&mdash;": "—" };
const texto = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, (e) => ENT[e] || e).replace(/\s+/g, " ").trim();

/** Os blocos <details class="item kr kN"> (KPIs) ou "item cr kN" (competências), na ordem do arquivo, só do formulário da liderança */
function blocos(prefixo) {
  const lista = [];
  const re = new RegExp('<details class="item ' + prefixo + ' k(\\d+)"', "g");
  let m;
  while ((m = re.exec(html))) {
    const fim = html.indexOf("</details>", m.index);
    lista.push({ n: Number(m[1]), corpo: html.slice(m.index, fim) });
  }
  return lista;
}
/** Os trechos <tag class="rv Cxx">…</tag> de um bloco, por cargo (o conteúdo não tem a mesma tag aninhada no nível de cima) */
function porCargo(corpo, tag) {
  const r = {};
  const re = new RegExp("<" + tag + ' class="rv (C\\d+)[^"]*">', "g");
  let m;
  while ((m = re.exec(corpo))) {
    // acha o fechamento equilibrando a mesma tag
    let prof = 1, i = re.lastIndex;
    const abre = new RegExp("<" + tag + "[\\s>]", "g"), fecha = new RegExp("</" + tag + ">", "g");
    while (prof > 0) {
      abre.lastIndex = i; fecha.lastIndex = i;
      const a = abre.exec(corpo), f = fecha.exec(corpo);
      if (!f) break;
      if (a && a.index < f.index) { prof++; i = a.index + 1; } else { prof--; i = f.index + f[0].length; }
    }
    r[m[1]] = corpo.slice(m.index, i);
  }
  return r;
}

const cargos = {};
const cargo = (c) => (cargos[c] = cargos[c] || { kpis: [], competencias: [] });

/* KPIs: <span> com <small>objetivo</small>indicador; <div> com meta, cálculo, peso e "tipo · frequência · fonte" */
blocos("kr").forEach((b) => {
  const spans = porCargo(b.corpo, "span"), divs = porCargo(b.corpo, "div");
  Object.keys(spans).forEach((c) => {
    const s = spans[c], d = divs[c] || "";
    const objetivo = texto((/<small[^>]*>([\s\S]*?)<\/small>/.exec(s) || [])[1]);
    const indicador = texto(s.replace(/<small[^>]*>[\s\S]*?<\/small>/, ""));
    const dd = (rot) => texto((new RegExp("<dt>" + rot + "</dt><dd>([\\s\\S]*?)</dd>").exec(d) || [])[1]);
    const peso = texto((/Peso sugerido ([^<]+)</.exec(d) || [])[1]);
    const partes = texto((/<span class="sub">([\s\S]*?)<\/span>/.exec(d) || [])[1]).split(" · ");
    cargo(c).kpis[b.n - 1] = { objetivo, indicador, meta: dd("Meta"), calculo: dd("Como é calculado"), peso, tipo: partes[0] || "", frequencia: partes[1] || "", fonte: partes.slice(2).join(" · ") };
  });
});

/* Competências: <span> com <small class="dim">dimensão</small>nome; <div> com a prática, o mínimo esperado e como avaliar */
blocos("cr").forEach((b) => {
  const spans = porCargo(b.corpo, "span"), divs = porCargo(b.corpo, "div");
  Object.keys(spans).forEach((c) => {
    const s = spans[c], d = divs[c] || "";
    const dimensao = texto((/<small[^>]*>([\s\S]*?)<\/small>/.exec(s) || [])[1]);
    const nome = texto(s.replace(/<small[^>]*>[\s\S]*?<\/small>/, ""));
    const minimo = /Mínimo esperado: (\d)/.exec(d);
    const comoAvaliar = texto((/<span class="sub">([\s\S]*?)<\/span>/.exec(d) || [])[1]);
    cargo(c).competencias[b.n - 1] = { dimensao, nome, pratica: texto((/<p class="prat">([\s\S]*?)<\/p>/.exec(d) || [])[1]), minimo: minimo ? Number(minimo[1]) : 3, comoAvaliar };
  });
});
Object.keys(cargos).forEach((c) => { cargos[c].kpis = cargos[c].kpis.filter(Boolean); cargos[c].competencias = cargos[c].competencias.filter(Boolean); });

/* Glossário: <h3 class="gh">Dimensão <span>n</span></h3> e as competências dela */
const glossario = [];
const g0 = html.indexOf("Glossário de competências");
const gfim = html.indexOf("</details></div></details>", g0) > 0 ? html.indexOf("<button", g0) : html.length;
const trechoG = html.slice(g0, gfim);
const reDim = /<h3 class="gh">([^<]+)<span>\d+<\/span><\/h3>([\s\S]*?)(?=<h3 class="gh">|$)/g;
let md;
while ((md = reDim.exec(trechoG))) {
  const dim = texto(md[1]);
  const reC = /<details class="gi"><summary>([\s\S]*?)<span class="car">[\s\S]*?<\/summary><p>([\s\S]*?)<\/p><p class="sub"><b>Como avaliar:<\/b>([\s\S]*?)<\/p><\/details>/g;
  let mc;
  while ((mc = reC.exec(md[2]))) glossario.push({ dimensao: dim, nome: texto(mc[1]), descricao: texto(mc[2]), comoAvaliar: texto(mc[3]) });
}

/* Os liderados de exemplo do protótipo: o cargo de cada um (CSS) e o nome do cargo (perfil) */
const conhecidos = {};
const reEx = /body:has\(#m-(M\d+):checked\) \.rv\.(C\d+)/g;
let me;
while ((me = reEx.exec(html))) {
  const perfil = new RegExp('class="pm ' + me[1] + '"[\\s\\S]{0,1200}?<h2[^>]*>([^<]+)</h2>\\s*<p[^>]*>([^<·]+)·').exec(html);
  if (perfil) conhecidos[me[2]] = texto(perfil[2]);
}

const codigos = Object.keys(cargos).sort();
const saida = path.join(__dirname, "..", "src", "js", "57-revisao-matriz.js");
const conteudo = `/* =====================================================================================
   REVISÃO DE PROGRESSO — matriz dos cargos (KPIs e competências) e glossário de competências
   -------------------------------------------------------------------------------------
   GERADO por tools/revisao-matriz.js a partir do protótipo do RH (Revisao_de_Progresso_Prototipo.html,
   matrizes v1.2 de 04/11/2026). Não edite à mão: rode o gerador de novo quando a matriz mudar.
   ${codigos.length} cargos (C01 a C${String(codigos.length).padStart(2, "0")}), ${glossario.length} competências no glossário.
   Os nomes dos cargos ficam na Configuração (o RH dá nome a cada um); NOMES_DO_PROTOTIPO traz só os
   que o protótipo nomeia.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica();
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.revisaoMatriz = m; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSAO = "matrizes v1.2 de 04/11/2026";
  const NOMES_DO_PROTOTIPO = ${JSON.stringify(conhecidos)};
  const GLOSSARIO = ${JSON.stringify(glossario)};
  const CARGOS = ${JSON.stringify(cargos)};
  return { VERSAO, NOMES_DO_PROTOTIPO, GLOSSARIO, CARGOS };
});
`;
fs.writeFileSync(saida, conteudo);
const tam = (c) => cargos[c].kpis.length + " KPIs · " + cargos[c].competencias.length + " comp.";
console.log("gerado:", path.relative(process.cwd(), saida), Math.round(conteudo.length / 1024) + " KB");
console.log(codigos.length + " cargos; glossário: " + glossario.length + " competências; nomeados no protótipo: " + JSON.stringify(conhecidos));
console.log(codigos.map((c) => c + " " + tam(c)).join(" | "));
