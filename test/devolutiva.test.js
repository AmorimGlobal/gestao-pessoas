// 18/11/2026, pedido do usuário: a devolutiva da Revisão de Progresso só chega ao membro depois que a liderança
// confirma que a conversa aconteceu. Antes disso o registro é preparação da liderança: o item de retornos fica com
// ela como responsável (o membro não lê no CRM) e nada aparece em "Seus retornos" nem no sino do membro.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/js/58-revisao.js");
const dom = require("../src/js/50-dominio.js");

/* Rafael (3) lidera Beatriz (4); Helena (2) lidera Rafael. Ciclo de teste com os três. */
function contexto(retornos, opcoes) {
  const o = opcoes || {};
  const U = (id, nome, deptos, cargo) => ({ id, nome, departamentos: deptos, cargo: cargo || "", tipo: "employee" });
  const M = (id, resp, lid) => ({ id, responsavel: resp, lideranca: lid, coordenacao: lid, estagio: "ATIVO", cargoMatriz: "C05" });
  const ciclo = { id: "900", ciclo: "Teste · 18/11/2026", estagio: "ABERTO", dataAbertura: "2026-11-18", prazoAuto: "2026-11-19", prazoDevolutiva: "2026-11-22",
    regras: JSON.stringify({ publico: "pessoas", pessoas: ["m2", "m3", "m4"], teste: true, liberarLideranca: true, liberarPares: true }) };
  return dom.indexar({
    hoje: "2026-11-18", eu: { id: o.eu || "8" }, config: { papeis: { ceo: [{ id: "1" }], rh: [{ id: "8" }] } },
    usuarios: [U("1", "CEO", ["1"], "CEO"), U("2", "Helena Prado", ["10"], "Coordenação Comercial"), U("3", "Rafael Lima", ["11"], "Supervisão de SDR"),
      U("4", "Beatriz Nogueira", ["11"], "SDR"), U("8", "Rita RH", ["30"], "RH")],
    departamentos: [{ id: "1", nome: "Amorim", pai: "", chefe: "1" }, { id: "10", nome: "Comercial", pai: "1", chefe: "2" },
      { id: "11", nome: "SDR", pai: "10", chefe: "3" }, { id: "30", nome: "RH", pai: "1", chefe: "8" }],
    registros: {
      // o membro sem a função "Membros" do CRM não lê o próprio item: o.semMembros simula o login dele
      membros: o.semMembros ? [] : [M("m2", "2", "1"), M("m3", "3", "2"), M("m4", "4", "3")],
      revCiclos: [ciclo],
      revAvaliacoes: [{ id: "a4", membroId: "m4", responsavel: "3", avaliador: "3", cicloId: "900", cargo: "C05", estagio: o.estagioAv || "CALIBRADA", calibradaEm: "2026-11-18T10:00:00-03:00" }],
      revRetornos: retornos || [],
    },
  });
}
const preparada = { id: "r4", membroId: "m4", responsavel: "3", cicloId: "900", estagio: "NEW", fortes: "Organização da fila", desenvolver: "Autonomia", retornoPares: "Temas dos pares" };
const liberada = Object.assign({}, preparada, { responsavel: "4", estagio: "DEVOLUTIVA", devolutivaEm: "2026-11-18" });
const doRafael = { id: "r3", membroId: "m3", responsavel: "3", cicloId: "900", estagio: "DEVOLUTIVA", devolutivaEm: "2026-11-17", fortes: "Rafael" };

test("devolutiva preparada não está liberada; a data da conversa é o que libera", () => {
  assert.equal(R.devolutivaPreparada(preparada), true);
  assert.equal(R.devolutivaLiberada(preparada), false);
  assert.equal(R.devolutivaLiberada(liberada), true);
  assert.equal(R.devolutivaPreparada(liberada), false);
  assert.equal(R.devolutivaPreparada({ id: "x", retornoPares: "só o RH" }), false, "o retorno do RH sozinho não é devolutiva preparada");
  assert.equal(R.devolutivaLiberada(null), false);
});

test("antes da conversa o item fica com a liderança, e o retorno da liderança não se confunde com o do liderado", () => {
  const ctx = contexto([preparada, doRafael]);
  const ciclo = R.cicloAberto(ctx);
  assert.equal(R.donoAntesDaConversa(ctx, ctx.idx.membro.m4, ciclo, "8"), "3", "a liderança que avalia");
  assert.equal(R.retornoDe(ctx, "4", ciclo).id, "r4", "o da Beatriz pelo item do Membros");
  assert.equal(R.retornoDe(ctx, "3", ciclo).id, "r3", "o do Rafael é o dele, não o item da Beatriz que está com ele");
  const soPreparada = contexto([preparada]);
  assert.equal(R.retornoDe(soPreparada, "3", R.cicloAberto(soPreparada)), null, "sem retorno próprio, o Rafael não herda o da Beatriz");
  // o login da Beatriz, sem ler o Membros: acha pelo responsável, e só depois da liberação (antes o item nem chega a ela)
  const dela = contexto([liberada], { semMembros: true, eu: "4" });
  assert.equal(R.retornoDe(dela, "4", R.cicloAberto(dela)).id, "r4");
});

test("sino: o membro só é chamado a confirmar a ciência depois da conversa; a liderança vê o lembrete até liberar", () => {
  const t = (ctx, uid) => R.notificacoes(ctx, uid).map((n) => n.titulo);
  const antes = contexto([preparada]);
  assert.ok(!t(antes, "4").some((x) => /confirme a ciência/.test(x)), "preparada: nada para a Beatriz");
  assert.ok(t(antes, "3").includes("Calibração concluída: converse com Beatriz Nogueira e libere a devolutiva"));
  const depois = contexto([liberada], { estagioAv: "DEVOLUTIVA" });
  assert.ok(t(depois, "4").includes("Sua liderança registrou a devolutiva: confirme a ciência"));
  assert.ok(!t(depois, "3").some((x) => /Calibração concluída/.test(x)), "liberada: o lembrete da liderança sai");
});

test("lista da liderança e do RH: a devolutiva preparada aparece como falta a conversa", () => {
  const ctx = contexto([preparada]);
  const s = R.situacaoDo(ctx, R.cicloAberto(ctx), ctx.idx.membro.m4);
  assert.equal(s.avaliacao, "Devolutiva preparada · falta a conversa");
  const semNada = contexto([]);
  assert.equal(R.situacaoDo(semNada, R.cicloAberto(semNada), semNada.idx.membro.m4).avaliacao, "Calibrada");
});
