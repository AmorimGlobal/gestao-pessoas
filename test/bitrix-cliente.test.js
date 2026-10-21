// Repositório do navegador (src/js/40-bitrix.js) com um BX24 falso por cima do Bitrix falso:
// descobre a estrutura pelo título, lê os campos e grava/lê um item com listas, pessoas e datas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { provisionar } = require("../src/js/30-provision.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

/** BX24 mínimo: callMethod com paginação (more/next) e callBatch, respondendo pelo Bitrix falso */
function bx24Falso(chamar) {
  function resposta(metodo, params, cb) {
    chamar(metodo, params).then((r) => {
      cb({
        error: () => null, data: () => r.dados, answer: { next: r.proximo === null ? undefined : r.proximo },
        more: () => r.proximo !== null && r.proximo !== undefined,
        next: (cb2) => resposta(metodo, Object.assign({}, params, { start: r.proximo }), cb2),
      });
    }, (e) => {
      cb({ error: () => ({ ex: { error: "ERRO", error_description: e.message } }), data: () => null, more: () => false, answer: {} });
    });
  }
  return {
    init: (cb) => cb(), installFinish() {},
    appOption: { get: () => null, set: (k, v, cb) => cb && cb() },
    callMethod: (m, p, cb) => resposta(m, p, cb),
    callBatch(lote, cb) {
      const chaves = Object.keys(lote), saida = {};
      let faltam = chaves.length;
      chaves.forEach((k) => resposta(lote[k][0], lote[k][1], (r) => { saida[k] = r; if (--faltam === 0) cb(saida); }));
    },
  };
}

function carregarApp(chamar) {
  const janela = { console };
  janela.window = janela;
  janela.BX24 = bx24Falso(chamar);
  const ctx = vm.createContext(janela);
  for (const f of ["00-util.js", "10-calc.js", "20-schema.js", "30-provision.js", "35-registros.js", "40-bitrix.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "js", f), "utf8"), ctx, { filename: f });
  }
  return janela.GP;
}

test("navegador: descobre os processos, grava e lê um item com lista, pessoa, data e vínculo ao membro", async () => {
  const bx = criarBitrixFalso({ tiposIniciais: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }] });
  await provisionar({ chamar: bx.chamar });
  const GP = carregarApp(bx.chamar);
  const repo = GP.bitrix.criarRepositorio();
  const { origem, ausentes } = await repo.lerConfig();
  assert.equal(origem, "descoberta");
  assert.equal(ausentes.length, 0, ausentes.join(", ")); // (array de outro contexto do vm: deepEqual estrito compara o protótipo)

  const m = await repo.criar("membros", { titulo: "Ana Souza", responsavel: "100", estagio: "ATIVO", lideranca: "3", cidade: "Salvador (BA)", ingresso: "2026-01-12" });
  assert.equal(m.estagio, "ATIVO");
  assert.equal(m.cidade, "Salvador (BA)");
  assert.equal(m.lideranca, "3");
  assert.equal(m.ingresso, "2026-01-12");
  const f = await repo.criar("feedbacks", { titulo: "Reconhecimento", membroId: m.id, responsavel: "100", tipo: "Reconhecimento", data: "2026-10-01", retroativo: false });
  assert.equal(f.membroId, m.id);
  assert.equal(f.tipo, "Reconhecimento");
  assert.equal(f.retroativo, false);
  await repo.atualizar("membros", m.id, { cidade: "São Paulo (SP)" });
  const lista = await repo.listar("membros");
  assert.equal(lista.length, 1);
  assert.equal(lista[0].cidade, "São Paulo (SP)");
  assert.equal(lista[0].estagioNome, "Ativo");
  // campos com número no nome: o Bitrix devolve ufCrm_<id>_DATA_1A1, e o app usa esse nome (upperName)
  const c = await repo.criar("ciclo", { titulo: "1:1", membroId: m.id, responsavel: "100", trimestre: "2026-T4", data1a1: "2026-10-22", comb1Texto: "Revisar o parecer", anterior1: "Cumprido" });
  assert.equal(c.data1a1, "2026-10-22");
  assert.equal(c.comb1Texto, "Revisar o parecer");
  assert.equal(c.anterior1, "Cumprido");
  assert.ok(repo.estrutura().ciclo.campos.data1a1.indexOf("ufCrm_") === 0, repo.estrutura().ciclo.campos.data1a1);
});
