// Avisos da 4.4 (lib/avisos.js e api/avisos.js): resumo semanal, dia do atraso, 7 e 14 dias.
const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../src/js/10-calc.js");
const dom = require("../src/js/50-dominio.js");
const avisos = require("../lib/avisos.js");
const { dadosDemo } = require("../src/js/45-demo.js");
const { provisionar } = require("../src/js/30-provision.js");
const { abrirPortal } = require("../lib/bitrix-servidor.js");
const handler = require("../api/avisos.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

function planoDo(hoje, mexer) {
  const d = dadosDemo();
  if (mexer) mexer(d);
  const ctx = dom.indexar({ hoje, eu: { id: "" }, config: {}, usuarios: d.usuarios, departamentos: d.departamentos, registros: d.registros, feriados: { nacionais: calc.feriadosNacionais(2026) } });
  return avisos.planejar({ ctx, rhIds: ["6", "1"], naoAvisar: ["1"], link: "https://portal/app/" });
}
const de = (plano, tipo) => plano.mensagens.filter((m) => m.tipo === tipo);

test("dia em que atrasa: uma mensagem por liderança, com tudo o que venceu", () => {
  const p = planoDo("2026-10-08"); // quinta: os 1:1 com prazo 07/10 venceram ontem
  assert.equal(p.semanal, false);
  assert.deepEqual(de(p, "venceu").map((m) => m.para), ["3", "4"]);
  assert.match(de(p, "venceu")[1].texto, /Venceu o prazo de 2 pendências:\n• Agendar o 1:1 de Júlia/);
  assert.match(de(p, "venceu")[1].texto, /Abra o app Gestão de Pessoas: https:\/\/portal\/app\/$/);
});

test("fim de semana e feriado não avisam; o resumo sai no primeiro dia útil da semana (terça, depois do feriado de 12/10)", () => {
  assert.equal(planoDo("2026-10-11").mensagens.length, 0); // domingo
  assert.equal(planoDo("2026-10-12").mensagens.length, 0); // Nossa Senhora Aparecida
  const p = planoDo("2026-10-13");
  assert.equal(p.semanal, true);
  const semanais = de(p, "semanal");
  // uma mensagem por pessoa, nunca uma por pendência
  assert.deepEqual(semanais.map((m) => m.para).sort(), ["3", "4", "6"]);
  assert.match(semanais.find((m) => m.para === "3").texto, /^Resumo da semana: 6 pendências, 3 atrasadas\./);
  assert.match(semanais.find((m) => m.para === "6").texto, /Para o RH: 1 solicitação de encerramento aguardando o RH/);
  assert.equal(planoDo("2026-10-14").semanal, false);
});

test("liderança com 5 pendências em dia recebe 1 mensagem por semana, não 5", () => {
  const p = planoDo("2026-10-05"); // segunda: nada atrasado ainda
  const carla = p.mensagens.filter((m) => m.para === "3");
  assert.equal(carla.length, 1);
  assert.equal(carla[0].tipo, "semanal");
});

test("7 e 14 dias: cada marco sai uma única vez, mesmo rodando todos os dias", () => {
  const vistos = {};
  for (let dia = "2026-10-06"; dia <= "2026-11-15"; dia = calc.addDias(dia, 1)) {
    planoDo(dia).mensagens.filter((m) => m.tipo === "lembrete7" || m.tipo === "aviso14").forEach((m) => {
      m.texto.split("\n").filter((l) => /"/.test(l)).forEach((l) => {
        const chave = m.para + "|" + m.tipo + "|" + l.replace(/está com \d+ dias/, "");
        assert.ok(!vistos[chave], "repetido em " + dia + ": " + chave);
        vistos[chave] = dia;
      });
    });
  }
  // o 1:1 do Bruno (prazo 07/10): lembrete à Carla em 14/10 e aviso à coordenação (Livia) em 21/10
  const chaves = Object.keys(vistos);
  assert.equal(vistos[chaves.find((k) => k.startsWith("3|lembrete7|") && /Bruno/.test(k))], "2026-10-14");
  assert.equal(vistos[chaves.find((k) => k.startsWith("2|aviso14|") && /Bruno/.test(k))], "2026-10-21");
  assert.ok(!chaves.some((k) => k.startsWith("1|")), "a CEO nunca recebe aviso");
});

test("14 dias quando a liderança é a própria coordenação: o aviso vai para o RH", () => {
  const p = planoDo("2026-10-21", (d) => {
    d.registros.membros.forEach((m) => { if (m.lideranca === "4") m.coordenacao = "4"; }); // equipe do Marcos: ele mesmo é a coordenação
  });
  const rh = de(p, "aviso14").find((m) => m.para === "6");
  assert.ok(rh, "RH recebe");
  assert.match(rh.texto, /Júlia/);
  assert.ok(!de(p, "aviso14").some((m) => m.para === "4"), "a liderança não recebe o aviso de 14 dias sobre ela mesma");
  assert.ok(!de(p, "aviso14").some((m) => m.para === "1"));
});

test("nenhum aviso vai para o membro dono da pendência", () => {
  // os membros da demonstração que não são lideranças (as lideranças recebem pelo papel de liderança)
  const soMembros = new Set(dadosDemo().registros.membros.map((m) => m.responsavel).filter((id) => ["2", "3", "4", "5", "6"].indexOf(id) < 0));
  assert.ok(soMembros.size >= 10);
  for (let dia = "2026-10-05"; dia <= "2026-11-10"; dia = calc.addDias(dia, 1)) {
    planoDo(dia).mensagens.forEach((m) => assert.ok(!soMembros.has(m.para), dia + " " + m.para));
  }
});

/* ---------- a função da Vercel, contra o Bitrix falso ---------- */
const ENV = { CRON_SECRET: "s3gredo", BITRIX_WEBHOOK_URL: "https://x/rest/1/abc/", GP_AVISAR_IDS: "6", GP_EXCECOES_IDS: "1" };
function resposta() {
  const r = { statusCode: 0, headers: {}, corpo: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.corpo = JSON.parse(b); };
  return r;
}
async function portalComAna() {
  const bx = criarBitrixFalso({
    tiposIniciais: [{ id: 13, entityTypeId: 1046, title: "Tickets - Amorim" }],
    usuarios: [
      { ID: "1", NAME: "Giselle", UF_DEPARTMENT: [1] }, { ID: "2", NAME: "Livia", LAST_NAME: "Prado", UF_DEPARTMENT: [10] },
      { ID: "3", NAME: "Carla", LAST_NAME: "Mendes", UF_DEPARTMENT: [11] }, { ID: "6", NAME: "Helena", UF_DEPARTMENT: [12] },
      { ID: "100", NAME: "Ana", LAST_NAME: "Souza", UF_DEPARTMENT: [11] },
    ],
    departamentos: [
      { ID: "1", NAME: "Amorim", UF_HEAD: "1" }, { ID: "10", NAME: "Operações", PARENT: "1", UF_HEAD: "2" },
      { ID: "11", NAME: "Imigração", PARENT: "10", UF_HEAD: "3" }, { ID: "12", NAME: "RH", PARENT: "1", UF_HEAD: "6" },
    ],
  });
  await provisionar({ chamar: bx.chamar });
  const portal = await abrirPortal(bx.chamar);
  const ana = await portal.criar("membros", { titulo: "Ana Souza", responsavel: "100", estagio: "NEW", lideranca: "3", coordenacao: "2", ingresso: "2026-10-21" });
  await portal.criar("onboarding", { titulo: "Onboarding · Ana", membroId: ana.id, responsavel: "100", estagio: "NEW", ingresso: "2026-10-21" });
  return bx;
}

test("rotina: segredo, simulação sem enviar e envio pelo Bitrix", async () => {
  const r0 = resposta();
  await handler({ headers: { authorization: "Bearer x" }, url: "/api/avisos" }, r0, { env: ENV });
  assert.equal(r0.statusCode, 401);
  const r00 = resposta();
  await handler({ headers: {}, url: "/api/avisos" }, r00, { env: {} });
  assert.equal(r00.statusCode, 503);

  const bx = await portalComAna(); // Ficha da Ana: prazo 20/10 (véspera do Dia 1)
  const r1 = resposta();
  await handler({ headers: { authorization: "Bearer s3gredo" }, url: "/api/avisos?simular=1" }, r1, { env: ENV, chamar: bx.chamar, hoje: "2026-10-21" });
  assert.equal(r1.statusCode, 200, JSON.stringify(r1.corpo));
  assert.equal(r1.corpo.simulado, true);
  assert.deepEqual(r1.corpo.porTipo, { venceu: 1 });
  assert.equal(r1.corpo.detalhe[0].para, "3");
  assert.match(r1.corpo.detalhe[0].texto, /Completar a Ficha de Ana/);
  assert.equal(bx.estado.avisos.length, 0, "simulação não envia");

  const r2 = resposta();
  await handler({ headers: { authorization: "Bearer s3gredo" }, url: "/api/avisos" }, r2, { env: ENV, chamar: bx.chamar, hoje: "2026-10-21" });
  assert.equal(r2.statusCode, 200, JSON.stringify(r2.corpo));
  assert.deepEqual(r2.corpo.falhas, []);
  assert.deepEqual(bx.estado.avisos.map((a) => a.USER_ID), [3]);
  assert.match(bx.estado.avisos[0].MESSAGE, /^\[Gestão de Pessoas\] Venceu o prazo de uma pendência:\n• Completar a Ficha de Ana \(prazo 20\/10, 1 dia de atraso\)/);
});

test("ninguém recebe aviso sobre os próprios registros, nem quando é do RH ou aprova", () => {
  // a Júlia (111) está no RH e a equipe do Marcos tem ele mesmo como coordenação: o aviso de 14 dias iria ao RH
  const d0 = dadosDemo();
  const ctx = dom.indexar({
    hoje: "2026-10-21", eu: { id: "" }, config: {}, usuarios: d0.usuarios, departamentos: d0.departamentos,
    registros: Object.assign(d0.registros, { membros: d0.registros.membros.map((m) => (m.lideranca === "4" ? Object.assign(m, { coordenacao: "4" }) : m)) }),
    feriados: { nacionais: calc.feriadosNacionais(2026) },
  });
  const p = avisos.planejar({ ctx, rhIds: ["6", "111"], naoAvisar: ["1"] });
  const julia = p.mensagens.filter((m) => m.para === "111");
  assert.ok(julia.length >= 1, "a Júlia recebe como RH");
  julia.forEach((m) => assert.ok(!/Júlia/.test(m.texto), "a Júlia recebeu aviso sobre ela mesma: " + m.texto));
  assert.ok(p.mensagens.some((m) => m.para === "6" && /Júlia/.test(m.texto)), "o resto do RH recebe");
});

test("aprovação do próprio encerramento nunca vira aviso para a pessoa", () => {
  const d0 = dadosDemo();
  // pedido de encerramento da Carla (que também é membro), com ela mesma como coordenação responsável
  d0.registros.membros.push({ id: "70", titulo: "Carla Mendes", responsavel: "3", estagio: "ATIVO", lideranca: "2", coordenacao: "2" });
  d0.registros.encerramentos.push({ id: "900", membroId: "70", estagio: "AG_COORD", coordenacao: "3", solicitante: "2", movidoEm: "2026-09-20T10:00:00-03:00", criadoEm: "2026-09-20T10:00:00-03:00" });
  const ctx = dom.indexar({ hoje: "2026-10-13", eu: { id: "" }, config: {}, usuarios: d0.usuarios, departamentos: d0.departamentos, registros: d0.registros, feriados: { nacionais: calc.feriadosNacionais(2026) } });
  const p = avisos.planejar({ ctx, rhIds: ["6"], naoAvisar: ["1"] });
  p.mensagens.filter((m) => m.para === "3").forEach((m) => assert.ok(!/encerramento de Carla/.test(m.texto), m.texto));
});

test("rotina: a CEO só em GP_CEO_IDS (sem GP_EXCECOES_IDS) não recebe nada, mesmo chefiando a raiz com equipe", async () => {
  const bx = await portalComAna();
  const portal = await abrirPortal(bx.chamar);
  // como a sincronização faz em produção: a coordenação (Livia, 2) também tem item, na equipe da CEO
  await portal.criar("membros", { titulo: "Livia Prado", responsavel: "2", estagio: "ATIVO", lideranca: "1", coordenacao: "1" });
  await portal.criar("ciclo", { titulo: "1:1", membroId: (await portal.listar("membros", { assignedById: 2 }))[0].id, responsavel: "2", estagio: "NEW", trimestre: "2026-T4", fimTrimestre: "2026-12-31", prazoEvidencias: "2027-01-15" });
  const env = { CRON_SECRET: "s3gredo", BITRIX_WEBHOOK_URL: "https://x/rest/1/abc/", GP_AVISAR_IDS: "6,1", GP_CEO_IDS: "1" };
  for (const hoje of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-26"]) {
    const r = resposta();
    await handler({ headers: { authorization: "Bearer s3gredo" }, url: "/api/avisos" }, r, { env, chamar: bx.chamar, hoje });
    assert.equal(r.statusCode, 200, JSON.stringify(r.corpo));
  }
  assert.ok(bx.estado.avisos.length > 0);
  assert.ok(!bx.estado.avisos.some((a) => a.USER_ID === 1), "a CEO recebeu: " + JSON.stringify(bx.estado.avisos.filter((a) => a.USER_ID === 1)));
});
