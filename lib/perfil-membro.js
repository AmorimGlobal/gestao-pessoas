/* =====================================================================================
   PERFIL DO MEMBRO NO SERVIDOR — os próprios feedbacks e o próprio alinhamento semanal (18/11/2026)
   -------------------------------------------------------------------------------------
   Pedido do usuário: o membro vê no Perfil os feedbacks que recebeu e as respostas que deu ao
   alinhamento semanal pelo WhatsApp (até aqui só a liderança via o card semanal). Pela seção 4 dos
   docs, a função "Membros" do CRM não lê essas tabelas, então quem lê é o servidor, pelo webhook,
   e só devolve os itens em que a pessoa da sessão é a responsável (nos dois, responsável = o membro).
   - Feedbacks SCI: data, tipo, situação, comportamento, impacto, combinados, adendos e autor. Sem a
     evidência anexada e sem o vínculo com plano. Os anulados ficam de fora.
   - Revisões semanais: a semana, como respondeu e as perguntas com as respostas. As descartadas ficam de fora.
   ===================================================================================== */
"use strict";
const { abrirPortal } = require("./bitrix-servidor.js");

const recentes = (campo) => (a, b) => (String(a[campo] || "") < String(b[campo] || "") ? 1 : String(a[campo] || "") > String(b[campo] || "") ? -1 : Number(b.id) - Number(a.id));

/** o = { chamar, uid } -> {ok, status, feedbacks, semanal, existe: {feedbacks, semanal}, erro} */
async function perfilDoMembro(o) {
  const uid = String(o.uid || "");
  if (!uid) return { ok: false, status: 401, erro: "sessão do Bitrix não reconhecida" };
  const portal = await abrirPortal(o.chamar, ["membros", "feedbacks", "semanal"]);
  const filtro = { assignedById: Number(uid) };
  const [feedbacks, semanal] = await Promise.all([
    portal.est.feedbacks ? portal.listar("feedbacks", filtro) : [],
    portal.est.semanal ? portal.listar("semanal", filtro) : [],
  ]);
  // o filtro do Bitrix já é por responsável; a conferência aqui garante que nada de outra pessoa sai
  const meu = (x) => String(x.responsavel) === uid && x.estagio !== "FAIL";
  return {
    ok: true, status: 200,
    existe: { feedbacks: !!portal.est.feedbacks, semanal: !!portal.est.semanal },
    feedbacks: feedbacks.filter(meu).sort(recentes("data")).map((f) => ({
      id: String(f.id), data: f.data || "", tipo: f.tipo || "", situacao: f.situacao || "", comportamento: f.comportamento || "",
      impacto: f.impacto || "", combinados: f.combinados || "", adendos: f.adendos || "", autor: String(f.autor || f.criadoPor || ""),
      retroativo: !!f.retroativo, estagio: f.estagio,
    })),
    semanal: semanal.filter(meu).sort(recentes("semana")).map((s) => ({
      id: String(s.id), semana: s.semana || "", papel: s.papel || "", respostas: s.respostas || "", respondidas: Number(s.respondidas) || 0,
    })),
  };
}

module.exports = { perfilDoMembro };
