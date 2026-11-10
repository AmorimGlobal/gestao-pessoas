// Processo com o título repetido no portal (10/11/2026): em 05/11 nasceram duas "Revisões semanais" no mesmo
// minuto. A configuração gravada apontava a mais nova (vazia), e o servidor guardava as respostas na mais
// antiga. O navegador, o servidor e o provisionamento passam a usar sempre a mais antiga.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const schema = require("../src/js/20-schema.js");
const reg = require("../src/js/35-registros.js");
const { provisionar } = require("../src/js/30-provision.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

const TITULO = schema.tituloProcesso(schema.processo("semanal"));

/** Portal provisionado + uma segunda "Revisões semanais" criada depois (a repetida) */
async function portalComRepetida() {
  const bx = criarBitrixFalso({});
  const r1 = await provisionar({ chamar: bx.chamar, log: () => {} });
  const antiga = r1.config.processos.semanal.entityTypeId;
  const nova = (await bx.chamar("crm.type.add", { fields: { title: TITULO, relations: { parent: [] } } })).dados.type.entityTypeId;
  // a configuração gravada aponta a nova, como no portal
  const cfg = JSON.parse(JSON.stringify(r1.config));
  cfg.processos.semanal = Object.assign({}, cfg.processos.semanal, { entityTypeId: nova });
  return { bx, antiga, nova, cfg };
}

test("título repetido: tipoPorTitulo e processosRepetidos escolhem o mais antigo", () => {
  const tipos = [{ id: 85, entityTypeId: 1154, title: TITULO }, { id: 83, entityTypeId: 1150, title: TITULO }, { id: 57, entityTypeId: 1114, title: "Gestão de Pessoas · Membros" }];
  assert.equal(schema.tipoPorTitulo(tipos, TITULO).entityTypeId, 1150);
  assert.equal(schema.tipoPorTitulo(tipos, "Outro"), null);
  const rep = schema.processosRepetidos(tipos);
  assert.equal(rep.length, 1);
  assert.equal(rep[0].chave, "semanal");
  assert.equal(rep[0].usado, 1150);
  assert.deepEqual(rep[0].outros, [1154]);
});

test("título repetido: a descoberta (servidor) e o provisionamento usam o mais antigo, mesmo com a configuração na outra", async () => {
  const { bx, antiga, nova, cfg } = await portalComRepetida();
  const listar = async (m, p, k) => {
    const r = await bx.chamar(m, p || {});
    return k ? r.dados[k] : r.dados;
  };
  const d = await reg.descobrirEstrutura(listar, ["semanal"]);
  assert.equal(d.processos.semanal.entityTypeId, antiga);

  const log = [];
  const r2 = await provisionar({ chamar: bx.chamar, log: (m) => log.push(m), configAtual: cfg });
  assert.equal(r2.config.processos.semanal.entityTypeId, antiga);
  assert.ok(log.some((m) => /ATENÇÃO: há mais de um processo/.test(m) && m.indexOf(String(nova)) >= 0), log.join("\n"));
  // não criou uma terceira
  assert.equal(bx.estado.tipos.filter((t) => t.title === TITULO).length, 2);
});

/** O repositório do navegador com o BX24 falso, lendo a configuração gravada que se passa */
function bx24Falso(chamar, configGravada) {
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
    appOption: { get: () => JSON.stringify(configGravada), set: (k, v, cb) => cb && cb() },
    callMethod: (m, p, cb) => resposta(m, p, cb),
    callBatch(lote, cb) {
      const chaves = Object.keys(lote), saida = {};
      let faltam = chaves.length;
      chaves.forEach((k) => resposta(lote[k][0], lote[k][1], (r) => { saida[k] = r; if (--faltam === 0) cb(saida); }));
    },
  };
}
function carregarApp(chamar, configGravada) {
  const janela = { console };
  janela.window = janela;
  janela.BX24 = bx24Falso(chamar, configGravada);
  const ctx = vm.createContext(janela);
  for (const f of ["00-util.js", "10-calc.js", "20-schema.js", "30-provision.js", "35-registros.js", "40-bitrix.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "js", f), "utf8"), ctx, { filename: f });
  }
  return janela.GP;
}

test("título repetido: o navegador troca a configuração gravada pelo mais antigo e avisa que a outra está vazia", async () => {
  const { bx, antiga, nova, cfg } = await portalComRepetida();
  const repo = carregarApp(bx.chamar, cfg).bitrix.criarRepositorio();
  const est = await repo.lerConfig();
  assert.equal(repo.estrutura().semanal.eti, antiga);
  assert.equal(est.origem, "gravada");
  assert.equal(est.repetidos.length, 1);
  assert.equal(est.repetidos[0].usado, antiga);
  assert.equal(est.repetidos[0].outros[0], nova);
  assert.equal(est.repetidos[0].vazios[0], true);
  // os outros processos continuam como gravados
  assert.equal(repo.estrutura().membros.eti, cfg.processos.membros.entityTypeId);
});

test("configuração apontando um processo apagado: o navegador acha pelo título", async () => {
  const bx = criarBitrixFalso({});
  const r1 = await provisionar({ chamar: bx.chamar, log: () => {} });
  const cfg = JSON.parse(JSON.stringify(r1.config));
  cfg.processos.semanal = Object.assign({}, cfg.processos.semanal, { entityTypeId: 9999 });
  const repo = carregarApp(bx.chamar, cfg).bitrix.criarRepositorio();
  const est = await repo.lerConfig();
  assert.equal(repo.estrutura().semanal.eti, r1.config.processos.semanal.entityTypeId);
  assert.equal(est.repetidos.length, 0);
});
