/* =====================================================================================
   FÉRIAS DA EQUIPE NO SERVIDOR — as datas já reservadas, sem nomes (protótipo do RH, 06/11/2026)
   -------------------------------------------------------------------------------------
   Regra: duas pessoas da mesma equipe (mesma liderança direta) não tiram férias ao mesmo tempo, e a
   data fica com quem pediu primeiro. O membro só lê os próprios pedidos no CRM ("Próprios"), então
   o navegador dele não vê as datas da equipe. Esta rota lê pelo webhook e devolve só os períodos e a
   situação de cada um, como no protótipo ("Já reservado na sua equipe"): sem nome, tipo nem motivo.
   As regras são as mesmas do navegador (src/js/53-ferias.js, reservasDaEquipe).
   ===================================================================================== */
"use strict";
const dom = require("../src/js/50-dominio.js");
const F = require("../src/js/53-ferias.js");
const { abrirPortal, hojeSaoPaulo } = require("./bitrix-servidor.js");

/** o = { chamar, uid, agora } -> {ok, status, reservas: [{inicio, fim, situacao}], erro} */
async function reservasParaPessoa(o) {
  const uid = String(o.uid || "");
  if (!uid) return { ok: false, status: 401, erro: "sessão do Bitrix não reconhecida" };
  const portal = await abrirPortal(o.chamar, ["membros", "ferias"]);
  if (!portal.est.ferias) return { ok: false, status: 503, erro: "a tabela \"Férias e ausências\" ainda não existe no Bitrix" };
  const [usuarios, departamentos, membros, ferias] = await Promise.all([
    portal.usuarios(), portal.departamentos(), portal.est.membros ? portal.listar("membros") : [], portal.listar("ferias"),
  ]);
  const ctx = dom.indexar({ hoje: hojeSaoPaulo(o.agora), eu: { id: uid }, config: {}, usuarios, departamentos, registros: { membros, ferias } });
  // só o período e a situação: nada que identifique quem pediu
  const reservas = F.reservasDaEquipe(ctx, uid).filter((r) => r.fim >= ctx.hoje).map((r) => ({ inicio: r.inicio, fim: r.fim, situacao: r.situacao }));
  return { ok: true, status: 200, reservas };
}

module.exports = { reservasParaPessoa };
