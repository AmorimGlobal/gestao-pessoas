/* =====================================================================================
   CONTEXTO NO SERVIDOR — o mesmo `ctx` que a tela monta no navegador (90-app.js), lido
   pelo webhook de entrada, para as rotinas que calculam com as regras do domínio
   (avisos da 4.4 e painel da CEO).
   ===================================================================================== */
"use strict";
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const schema = require("../src/js/20-schema.js");
const { abrirPortal } = require("./bitrix-servidor.js");

/** op.vagas: categoria do funil de vagas (sem ela, as vagas não são lidas) */
async function montarContexto(chamar, hoje, op) {
  const o = op || {};
  const portal = await abrirPortal(chamar);
  const registros = {};
  for (const p of schema.PROCESSOS) registros[p.chave] = portal.est[p.chave] ? await portal.listar(p.chave) : [];
  const usuarios = await portal.usuarios();
  const departamentos = await portal.departamentos();
  const vagas = o.vagas ? await portal.vagas(o.vagas).catch(() => ({ etapas: [], negocios: [], historico: [] })) : undefined;
  const ano = Number(hoje.slice(0, 4));
  const nacionais = [ano - 1, ano, ano + 1].reduce((acc, a) => acc.concat(calc.feriadosNacionais(a)), []);
  const ctx = dom.indexar({ hoje, eu: { id: "" }, config: {}, usuarios, departamentos, registros, vagas, feriados: { nacionais } });
  return { ctx, portal };
}

module.exports = { montarContexto };
