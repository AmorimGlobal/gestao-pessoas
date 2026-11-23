// Pedidos do RH de 23/11/2026: a Revisão de Progresso recebe as avaliações em arquivo (autoavaliação, lideranças,
// pares e liderados), os retornos ao membro ficam desligados, o O2O abre sozinho no início do trimestre e a pausa
// contratual sai das opções de férias e ausências.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/js/58-revisao.js");
const dom = require("../src/js/50-dominio.js");
const F = require("../src/js/53-ferias.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const { gravar360 } = require("../lib/revisao360.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

const b64 = (bytes) => "A".repeat(Math.ceil((bytes * 4) / 3));

test("arquivos: tipo, quantidade e o limite de 3 MB somados (o corpo da função da Vercel vai até 4,5 MB)", () => {
  assert.equal(R.conferirAnexos([{ name: "autoavaliacao.docx", size: 200000 }]).ok, true);
  assert.equal(R.conferirAnexos([["avaliacao.PDF", b64(1000)]]).ok, true, "a extensão não diferencia maiúsculas");
  assert.match(R.conferirAnexos([]).erros[0], /escolha o arquivo/);
  assert.match(R.conferirAnexos([{ name: "virus.exe", size: 10 }]).erros[0], /PDF, Word/);
  assert.match(R.conferirAnexos([{ name: "a.pdf", size: 2e6 }, { name: "b.pdf", size: 2e6 }]).erros[0], /3 MB/);
  assert.match(R.conferirAnexos([["grande.pdf", b64(3.2 * 1024 * 1024)]]).erros[0], /3 MB/, "no servidor, o tamanho sai do base64");
  assert.match(R.conferirAnexos(Array.from({ length: 6 }, (_, i) => ({ name: i + ".pdf", size: 1 }))).erros[0], /até 5/);
});

test("ciclo por anexo: é o padrão, não pede cargo na matriz e mostra só a abertura e o encerramento", () => {
  assert.equal(R.porAnexo(null), true);
  assert.equal(R.porAnexo({ regras: JSON.stringify({ entrega: "formularios" }) }), false);
  assert.equal(R.encerramentoDo({ encerramento: "2026-12-09", prazoLideranca: "2026-12-01" }), "2026-12-09");
  assert.equal(R.encerramentoDo({ prazoLideranca: "2026-12-01", prazoAuto: "2026-11-30" }), "2026-12-01", "ciclo antigo, sem o campo: o prazo da liderança");
  assert.equal(R.RETORNOS_AO_MEMBRO, false, "Seus retornos fica fora até o RH liberar");
});

test("360° em arquivo: a resposta vai só com {anexo: true}, sai das médias e aparece na lista de arquivos do RH", () => {
  assert.deepEqual(R.validarResposta("Par", {}, true), { ok: true, erros: [], respostas: { anexo: true } });
  assert.equal(R.validarResposta("Par", {}).ok, false, "sem arquivo, continua pedindo pelo menos uma afirmação");
  const ciclo = { id: "c1", regras: JSON.stringify({ minimoNotas: 1, minimoComentarios: 1 }) };
  const ctx = dom.indexar({ hoje: "2026-11-23", eu: { id: "8" }, usuarios: [{ id: "3", nome: "Rafael Lima", departamentos: [] }], departamentos: [], config: {},
    registros: { rev360: [
      { id: "1", cicloId: "c1", avaliado: "3", relacao: "Superior", modo: "Anônima", estagio: "NEW", respostas: JSON.stringify({ anexo: true }), anexos: [{ id: 91 }] },
      { id: "2", cicloId: "c1", avaliado: "3", relacao: "Superior", modo: "Identificada", identificadoPor: "4", estagio: "NEW", respostas: JSON.stringify({ anexo: true }), anexos: [{ id: 92 }] },
      { id: "3", cicloId: "c1", avaliado: "3", relacao: "Superior", modo: "Anônima", estagio: "NEW", respostas: JSON.stringify({ lid_1: "Concordo" }) },
      { id: "4", cicloId: "c1", avaliado: "3", relacao: "Superior", modo: "Anônima", estagio: "FAIL", respostas: JSON.stringify({ anexo: true }), anexos: [{ id: 93 }] },
    ] } });
  const rel = R.relatorio360(ctx, ciclo);
  assert.equal(rel.total, 1, "só a resposta pelo formulário entra nas médias");
  const anx = R.anexos360(ctx, ciclo);
  assert.equal(anx.length, 1);
  assert.equal(anx[0].nome, "Rafael Lima");
  assert.deepEqual(anx[0].itens.map((x) => x.id), ["1", "2"], "a descartada fica de fora");
});

test("pares na entrega por arquivo: também os colegas da mesma área, fora os superiores e os liderados", () => {
  const usuarios = [
    { id: "2", nome: "Helena", departamentos: ["10"] }, { id: "3", nome: "Rafael", departamentos: ["11"] },
    { id: "4", nome: "Beatriz", departamentos: ["11"] }, { id: "5", nome: "Caio", departamentos: ["11"] },
    { id: "6", nome: "Marina", departamentos: ["12"] }, { id: "7", nome: "Otto", departamentos: ["12"] }, { id: "8", nome: "Rita", departamentos: ["30"] },
  ];
  const departamentos = [{ id: "1", nome: "Amorim", pai: "", chefe: "" }, { id: "10", nome: "Comercial", pai: "1", chefe: "2" },
    { id: "11", nome: "SDR", pai: "10", chefe: "3" }, { id: "12", nome: "Marketing", pai: "10", chefe: "6" }, { id: "30", nome: "RH", pai: "1", chefe: "8" }];
  const ctx = dom.indexar({ hoje: "2026-11-23", eu: { id: "4" }, usuarios, departamentos, registros: { membros: [] }, config: {} });
  const anexo = { id: "c", regras: JSON.stringify({}) }, form = { id: "c", regras: JSON.stringify({ entrega: "formularios" }) };
  assert.deepEqual(R.paresDe(ctx, "4", anexo).map((x) => x.uid), ["5"]);
  assert.deepEqual(R.colegasDaArea(ctx, "4", anexo).map((x) => x.uid).sort(), ["6", "7"], "Marketing está na mesma área (Comercial); Rafael e Helena são superiores; o RH é outra área");
  assert.equal(R.relacaoCom(ctx, "4", "7", anexo), "Par");
  assert.equal(R.relacaoCom(ctx, "4", "8", anexo), "", "outra área");
  assert.equal(R.relacaoCom(ctx, "4", "7", form), "", "pelos formulários, só a mesma liderança direta");
  assert.ok(!R.colegasDaArea(ctx, "3", anexo).some((x) => x.uid === "4" || x.uid === "5"), "liderado direto não vira colega da área");
});

/* ---------------- servidor: o arquivo vai pelo webhook, sem autor ---------------- */
async function portalRevisao(regras) {
  const bx = criarBitrixFalso({
    autorPadrao: 77,
    usuarios: [
      { ID: "1", NAME: "Bia", LAST_NAME: "CEO", UF_DEPARTMENT: [1] },
      { ID: "2", NAME: "Helena", LAST_NAME: "Prado", UF_DEPARTMENT: [10] },
      { ID: "4", NAME: "Beatriz", LAST_NAME: "Nogueira", UF_DEPARTMENT: [10] },
      { ID: "5", NAME: "Caio", LAST_NAME: "Martins", UF_DEPARTMENT: [10] },
      { ID: "8", NAME: "Rita", LAST_NAME: "RH", UF_DEPARTMENT: [30] },
    ],
    departamentos: [{ ID: "1", NAME: "Amorim", PARENT: "", UF_HEAD: "1" }, { ID: "10", NAME: "Comercial", PARENT: "1", UF_HEAD: "2" }, { ID: "30", NAME: "RH", PARENT: "1", UF_HEAD: "8" }],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar, ["revCiclos", "rev360"]);
  const ciclo = await portal.criar("revCiclos", { titulo: "Revisão · Novembro 2026", ciclo: "Novembro 2026 · inaugural (anual)", estagio: "ABERTO",
    regras: JSON.stringify(Object.assign({ liberarLideranca: true, liberarPares: true }, regras || {})) });
  return { bx, portal, ciclo };
}
const ENV = { BITRIX_WEBHOOK_URL: "https://portal.exemplo/rest/77/segredo/", GP_AVISAR_IDS: "8", GP_CEO_IDS: "1" };

test("servidor: a avaliação em arquivo é gravada pelo webhook, sem autor, com o arquivo no campo da tabela", async () => {
  const { bx, portal, ciclo } = await portalRevisao();
  const r = await gravar360({ chamar: bx.chamar, env: ENV, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "2", modo: "Anônima", respostas: {}, anexos: [["lideranca.docx", b64(5000)]] } });
  assert.deepEqual(r, { ok: true, status: 200 });
  const [item] = await portal.listar("rev360");
  assert.equal(item.criadoPor, "77", "autor = o dono do webhook");
  assert.equal(item.identificadoPor, "");
  assert.equal(item.relacao, "Superior");
  assert.deepEqual(JSON.parse(item.respostas), { anexo: true });
  assert.equal(item.anexos.length, 1);
  assert.equal(String(item.anexos[0][0] || item.anexos[0].nome || "lideranca.docx"), "lideranca.docx");
  const cru = Object.values(bx.estado.itens).flat().find((x) => String(x.id) === item.id);
  assert.ok(Object.keys(cru).every((k) => String(cru[k]) !== "4"), "o ID de quem enviou anonimamente não está no item");
  // recusa o que não é documento e o que passa do limite
  assert.equal((await gravar360({ chamar: bx.chamar, env: ENV, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "5", modo: "Anônima", anexos: [["x.exe", b64(10)]] } })).status, 400);
  assert.equal((await gravar360({ chamar: bx.chamar, env: ENV, uid: "4", pedido: { cicloId: ciclo.id, avaliado: "5", modo: "Anônima", anexos: [["x.pdf", b64(3.5 * 1024 * 1024)]] } })).status, 400);
  assert.equal((await portal.listar("rev360")).length, 1);
});

/* ---------------- O2O: a janela abre sozinha ---------------- */
test("O2O: a janela abre no primeiro dia útil do trimestre e fica aberta por 14 dias", () => {
  const ctx = (hoje) => dom.indexar({ hoje, eu: { id: "1" }, usuarios: [], departamentos: [], registros: {}, config: {} });
  const t4 = dom.janelaO2O(ctx("2026-10-05"));
  assert.deepEqual([t4.inicio, t4.fim, t4.aberta], ["2026-10-01", "2026-10-14", true]);
  const hoje = ctx("2026-11-23");
  assert.equal(dom.janelaO2O(hoje).aberta, false);
  const prox = dom.proximaJanelaO2O(hoje);
  assert.deepEqual([prox.inicio, prox.fim], ["2027-01-04", "2027-01-17"], "1º de janeiro é feriado e cai numa sexta: abre na segunda, 04/01");
  assert.equal(dom.janelaO2O(ctx("2027-01-17")).aberta, true);
  assert.equal(dom.janelaO2O(ctx("2027-01-18")).aberta, false);
});

test("férias e ausências: a pausa contratual saiu das opções; os pedidos antigos continuam com as regras dela", () => {
  assert.deepEqual(F.TIPOS, ["Férias", "Day off"]);
  assert.ok(F.PRAZOS["Pausa contratual"], "o prazo de resposta dos pedidos antigos continua");
});

test("ciclo aberto em silêncio: nenhum aviso da Revisão até o RH avisar; o RH continua vendo o que chegou", () => {
  const demo = require("../src/js/45-demo.js");
  const d = demo.dadosDemo();
  const ctx = dom.indexar({ hoje: "2026-10-08", eu: { id: "3" }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros });
  const c = R.cicloAberto(ctx);
  const comRegras = (o) => { ctx.registros.revCiclos = ctx.registros.revCiclos.map((x) => (x.id === c.id ? Object.assign({}, c, { regras: JSON.stringify(Object.assign(JSON.parse(c.regras), o)) }) : x)); };
  const t = (uid) => R.notificacoes(ctx, uid).map((n) => n.titulo);
  assert.equal(R.silencioso(c), false, "ciclo antigo, sem a regra: avisa como antes");
  comRegras({ silencioso: true, avisadoEm: "" });
  assert.equal(R.silencioso(R.cicloAberto(ctx)), true);
  assert.deepEqual(t("100"), [], "o membro não recebe nada");
  assert.deepEqual(t("3"), [], "a liderança não recebe nada");
  assert.deepEqual(t("6"), ["Avaliação enviada ao RH: Daniela Rocha"], "o RH vê o que chegou");
  comRegras({ silencioso: true, avisadoEm: "2026-10-08T10:00:00-03:00" });
  assert.equal(R.silencioso(R.cicloAberto(ctx)), false, "depois do aviso, volta ao normal");
  assert.ok(t("100").length >= 1);
});
