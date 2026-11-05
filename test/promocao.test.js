// Solicitação de promoção (05/11/2026): a liderança direta ou a coordenação pede, a coordenação e o RH aprovam,
// e o card cai no funil de vagas (77). Campos do negócio e layout do card (provisionamento), regras de quem vê e
// quem decide, o formulário, o texto que vai para a timeline e o sino. Dados de demonstração, hoje = 08/10/2026.
const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../src/js/20-schema.js");
const { provisionar, layoutComPromocao } = require("../src/js/30-provision.js");
const dom = require("../src/js/50-dominio.js");
const F = require("../src/js/52-formularios.js");
const N = require("../src/js/54-notificacoes.js");
const { dadosDemo } = require("../src/js/45-demo.js");
const { criarBitrixFalso } = require("./fake-bitrix.js");

/** mudar(d): mexe nos dados de demonstração antes de indexar (ex.: decidir uma promoção) */
function contexto(euId, mudar) {
  const d = dadosDemo();
  if (mudar) mudar(d);
  return dom.indexar({
    hoje: "2026-10-08", eu: { id: euId || "3", admin: false }, config: d.config, usuarios: d.usuarios, departamentos: d.departamentos,
    registros: d.registros, vagas: d.vagas, offboarding: d.offboarding,
  });
}
const card = (d, id) => d.vagas.negocios.find((n) => n.ID === id);
const SENIORIDADES = schema.OPCOES.senioridade;

/** Uma Solicitação de Promoção completa do Bruno (Analista I), pedida pela Carla */
function pedidoBruno() {
  return {
    membroId: "2", UF_CRM_PR_ATUAL: "Imigração · Analista", UF_CRM_PR_NIVEL_ATU: "Analista I", UF_CRM_PR_NIVEL: "Analista II", UF_CRM_PR_SENIOR: "Pleno", UF_CRM_PR_CARGO: "",
    UF_CRM_PR_DATA: "2026-11-01", UF_CRM_PR_REMUN: "Não", UF_CRM_PR_REAJUSTE: "10%", // digitado antes de trocar para "Não"
    UF_CRM_PR_MOTIVO: "Conduz a carteira de vistos de estudante sozinho desde julho.", UF_CRM_PR_RESULT: "38 processos no trimestre, sem retrabalho.",
    UF_CRM_PR_RESPONS: "Revisa os dossiês dos estagiários.", UF_CRM_PR_COMPET: ["Organização", "Autonomia"], UF_CRM_PR_DESENV: "Atendimento direto a clientes corporativos.",
    UF_CRM_PR_IMPACTO: "Continuam com a pessoa", UF_CRM_PR_IMPAC_DSC: "", UF_CRM_PR_CIENTE: "Sim, já conversamos", UF_CRM_PR_OBS: "",
  };
}

/* ---------------------------------------------------------------- campos do negócio */
test("campos do negócio: códigos de até 20 caracteres, sem repetir, todos numa seção do card e usados pelo formulário", () => {
  const cods = schema.CAMPOS_PROMOCAO.map((c) => c.codigo);
  assert.equal(new Set(cods).size, cods.length);
  cods.forEach((c) => { assert.ok(c.length <= 20, c); assert.match(c, /^UF_CRM_PR_[A-Z_]+$/); });
  schema.CAMPOS_PROMOCAO.forEach((c) => assert.ok(["linha", "texto", "data", "pessoa"].includes(c.tipo), c.codigo));
  const nasSecoes = schema.SECOES_PROMOCAO.reduce((a, s) => a.concat(s.campos), []);
  assert.deepEqual(nasSecoes.slice().sort(), cods.slice().sort());
  const def = F.formPromocao({});
  F.campos(def).filter((c) => /^UF_CRM_/.test(c.codigo)).forEach((c) => assert.ok(cods.includes(c.codigo), c.codigo));
});

/* ---------------------------------------------------------------- provisionamento */
const LAYOUT_77 = [
  { name: "main", title: "Solicitação", type: "section", elements: [{ name: "TITLE", optionFlags: "1" }, { name: "UF_CRM_RV_VAGA", optionFlags: "1" }] },
  { name: "user_rvstatus", title: "Andamento", type: "section", elements: [{ name: "STAGE_ID", optionFlags: "1" }, { name: "UF_CRM_RV_FIT", optionFlags: "1" }] },
];

test("provisionamento: cria os campos da promoção e as seções no card do funil; a segunda vez não grava nada", async () => {
  const bx = criarBitrixFalso({ layouts: { 77: LAYOUT_77 }, camposDeNegocioIniciais: ["UF_CRM_RV_VAGA", "UF_CRM_PR_MEMBRO"] });
  const r = await provisionar({ chamar: bx.chamar, configAtual: { recrutamento: { categoria: 77 } } });
  assert.deepEqual(r.falhas, []);
  const pr = bx.estado.camposDeNegocio.filter((f) => /^UF_CRM_PR_/.test(f.FIELD_NAME));
  assert.equal(pr.length, schema.CAMPOS_PROMOCAO.length);
  // o que já existia não é recriado
  assert.equal(bx.estado.chamadas.filter((c) => c.metodo === "crm.deal.userfield.add").length, schema.CAMPOS_PROMOCAO.length - 1);
  const campo = (n) => pr.find((f) => f.FIELD_NAME === n);
  assert.equal(campo("UF_CRM_PR_SOLICIT").USER_TYPE_ID, "employee");
  assert.equal(campo("UF_CRM_PR_DATA").USER_TYPE_ID, "date");
  assert.equal(campo("UF_CRM_PR_MOTIVO").USER_TYPE_ID, "string");
  assert.equal(campo("UF_CRM_PR_MOTIVO").SETTINGS.ROWS, 5);
  assert.equal(campo("UF_CRM_PR_NIVEL").SETTINGS, undefined);
  const criados = bx.estado.chamadas.filter((c) => c.metodo === "crm.deal.userfield.add").map((c) => c.params.fields);
  assert.ok(criados.every((f) => f.MANDATORY === "N" && f.MULTIPLE === "N"), "campo de negócio vale para todos os funis: nunca obrigatório");
  assert.equal(campo("UF_CRM_PR_REAJUSTE").EDIT_FORM_LABEL.br, "Promoção: reajuste sugerido");
  // layout: as seções da promoção depois da primeira; os campos da vaga passam a aparecer só preenchidos
  const lay = bx.estado.layouts["77"];
  assert.deepEqual(lay.map((s) => s.name), ["main", "user_prpedido", "user_prjustif", "user_prdecisao", "user_rvstatus"]);
  assert.deepEqual(lay[0].elements, [{ name: "TITLE", optionFlags: "1" }, { name: "UF_CRM_RV_VAGA", optionFlags: "0" }]);
  assert.deepEqual(lay[4].elements, [{ name: "STAGE_ID", optionFlags: "1" }, { name: "UF_CRM_RV_FIT", optionFlags: "0" }]);
  assert.ok(lay.slice(1, 4).every((s) => s.elements.every((e) => e.optionFlags === "0" && /^UF_CRM_PR_/.test(e.name))));
  assert.equal(bx.estado.chamadas.filter((c) => c.metodo === "crm.deal.details.configuration.forceCommonScopeForAll").length, 1);
  // segunda execução: nada a gravar
  const r2 = await provisionar({ chamar: bx.chamar, configAtual: Object.assign({}, r.config, { recrutamento: { categoria: 77 } }) });
  assert.equal(r2.relatorio.filter((x) => !x.simulado).length, 0);
  assert.deepEqual(r2.falhas, []);
});

test("provisionamento: simular não grava; sem layout salvo não mexe no card; falha nos campos de negócio não para o resto", async () => {
  const bx = criarBitrixFalso({ layouts: { 77: LAYOUT_77 } });
  const r = await provisionar({ chamar: bx.chamar, simular: true });
  assert.deepEqual(JSON.parse(JSON.stringify(bx.estado.layouts["77"])), LAYOUT_77);
  assert.equal(bx.estado.camposDeNegocio.length, 0);
  assert.ok(r.relatorio.some((x) => x.metodo === "crm.deal.details.configuration.set" && x.simulado));
  assert.ok(r.relatorio.some((x) => x.metodo === "crm.deal.details.configuration.forceCommonScopeForAll" && x.simulado));
  assert.equal(r.relatorio.filter((x) => x.metodo === "crm.deal.userfield.add").length, schema.CAMPOS_PROMOCAO.length);

  const semLayout = criarBitrixFalso();
  await provisionar({ chamar: semLayout.chamar });
  assert.equal(semLayout.estado.chamadas.filter((c) => c.metodo === "crm.deal.details.configuration.set").length, 0);
  assert.equal(semLayout.estado.camposDeNegocio.length, schema.CAMPOS_PROMOCAO.length);

  // recusa (mesmo de permissão) fica registrada e o resto segue: a configuração dos processos volta para ser gravada
  const recusa = criarBitrixFalso({ falharSe: (m) => (m === "crm.deal.userfield.list" ? "ACCESS_DENIED" : "") });
  const r3 = await provisionar({ chamar: recusa.chamar });
  assert.equal(r3.falhas.length, 1);
  assert.match(r3.falhas[0], /campos de negócio/);
  assert.ok(r3.config.processos.membros && r3.config.processos.semanal);
});

test("layoutComPromocao: já com as seções da promoção, ou sem layout salvo, não há o que mudar", () => {
  assert.equal(layoutComPromocao([]), null);
  assert.equal(layoutComPromocao(null), null);
  const comPromocao = layoutComPromocao(LAYOUT_77);
  assert.equal(layoutComPromocao(comPromocao), null);
  // seção sem optionFlags no elemento: fica "sempre visível", como o Bitrix trata
  const r = layoutComPromocao([{ name: "main", title: "x", elements: [{ name: "TITLE" }] }]);
  assert.deepEqual(r[0].elements, [{ name: "TITLE", optionFlags: "1" }]);
  assert.equal(r[0].type, "section");
});

/* ---------------------------------------------------------------- regras */
test("domínio: as promoções dividem o funil com as vagas, mas não contam como vagas", () => {
  const ctx = contexto("6");
  assert.deepEqual(dom.vagasDe(ctx, null).map((v) => v.id), ["9001", "9002", "9003"]);
  const p = dom.promocoes(ctx);
  assert.deepEqual(p.map((x) => [x.id, x.nome, x.situacao, x.membroId, x.coordenacao, x.lideranca, x.solicitante]),
    [["9011", "Ana Ribeiro", "coordenacao", "1", "2", "3", "3"], ["9012", "Júlia Freitas", "rh", "8", "2", "4", "4"]]);
  assert.equal(p[1].coordDecisao, "Aprovada");
  assert.equal(p[1].coordEm, "2026-10-06");
  // alerta do RH: só a que já passou pela coordenação
  assert.equal(dom.demandasRH(ctx).recrutamento, 1);
});

test("domínio: quem acompanha, quem decide e para quem cada pessoa pode pedir", () => {
  const ctx = contexto("3");
  const ve = (u) => dom.promocoesDe(ctx, u).map((x) => x.id);
  assert.deepEqual(ve("6"), ["9011", "9012"]); // RH: todas
  assert.deepEqual(ve("1"), ["9011", "9012"]); // CEO: todas
  assert.deepEqual(ve("2"), ["9011", "9012"]); // coordenação das duas
  assert.deepEqual(ve("3"), ["9011"]); // pediu a da Ana
  assert.deepEqual(ve("4"), ["9012"]); // pediu a da Júlia
  assert.deepEqual(ve("5"), []); // outra liderança
  assert.deepEqual(ve("100"), []); // a própria Ana não vê
  const [ana, julia] = dom.promocoes(ctx);
  assert.equal(dom.decisorDaPromocao(ctx, "2", ana), "coordenacao");
  assert.equal(dom.decisorDaPromocao(ctx, "6", ana), "", "o RH só decide depois da coordenação");
  assert.equal(dom.decisorDaPromocao(ctx, "6", julia), "rh");
  assert.equal(dom.decisorDaPromocao(ctx, "2", julia), "", "a coordenação já decidiu");
  assert.equal(dom.decisorDaPromocao(ctx, "3", ana), "", "quem pediu não decide");
  assert.deepEqual(dom.promocoesAguardando(ctx, "2").map((x) => x.id), ["9011"]);
  assert.deepEqual(dom.promocoesAguardando(ctx, "6").map((x) => x.id), ["9012"]);
  // a Carla pede para a equipe direta, menos a Fernanda (em encerramento); a Livia, para todo o setor; o RH, para ninguém
  assert.deepEqual(dom.membrosParaPromover(ctx, "3").map((m) => m.id).sort(), ["1", "2", "3", "4", "6"]);
  assert.equal(dom.membrosParaPromover(ctx, "2").length, 12);
  assert.deepEqual(dom.membrosParaPromover(ctx, "6"), []);
  assert.deepEqual(dom.membrosParaPromover(ctx, ""), []);
  assert.equal(dom.papelNaPromocao(ctx, "3", ctx.idx.membro["1"]), "Liderança direta");
  assert.equal(dom.papelNaPromocao(ctx, "2", ctx.idx.membro["1"]), "Coordenação");
  assert.equal(dom.papelNaPromocao(ctx, "5", ctx.idx.membro["1"]), "");
});

test("domínio: a situação sai da etapa do funil e da decisão gravada", () => {
  const situacao = (mudar) => dom.promocoes(contexto("6", (d) => mudar(card(d, "9012")))).find((x) => x.id === "9012");
  let x = situacao((n) => Object.assign(n, { STAGE_ID: "C77:WON", UF_CRM_PR_RH_DEC: "Aprovada", UF_CRM_PR_RH_POR: "6", UF_CRM_PR_VIGENCIA: "2026-11-01T03:00:00+03:00" }));
  assert.equal(x.situacao, "aprovada");
  assert.equal(x.vigencia, "2026-11-01");
  x = situacao((n) => Object.assign(n, { STAGE_ID: "C77:LOSE", UF_CRM_PR_COORD_DEC: "Não aprovada" }));
  assert.deepEqual([x.situacao, x.naoAprovadaPor], ["naoAprovada", "coordenacao"]);
  x = situacao((n) => Object.assign(n, { STAGE_ID: "C77:LOSE", UF_CRM_PR_RH_DEC: "Não aprovada" }));
  assert.deepEqual([x.situacao, x.naoAprovadaPor], ["naoAprovada", "rh"]);
  x = situacao((n) => Object.assign(n, { STAGE_ID: "C77:APOLOGY" }));
  assert.equal(x.situacao, "cancelada");
  // movida à mão no funil para uma etapa aberta depois de "Em análise": continua com o RH
  x = situacao((n) => Object.assign(n, { STAGE_ID: "C77:EXECUTING" }));
  assert.equal(x.situacao, "rh");
  // card sem o campo do membro (vaga) não é promoção; "0" também não
  assert.equal(dom.ehPromocao({ UF_CRM_RV_VAGA: "x" }), false);
  assert.equal(dom.ehPromocao({ UF_CRM_PR_MEMBRO: "0" }), false);
  assert.equal(dom.ehPromocao({ UF_CRM_PR_MEMBRO: 100 }), true);
});

test("domínio: as etapas do funil saem pelo nome e, sem ele, pela posição", () => {
  const ctx = contexto("6");
  assert.deepEqual(dom.etapasPromocao(ctx.vagas.etapas, 77), { coordenacao: "C77:NEW", rh: "C77:PREPARATION", aprovada: "C77:WON", naoAprovada: "C77:LOSE" });
  const renomeadas = [
    { id: "C90:NEW", nome: "Entrada", semantica: "" }, { id: "C90:UC_1", nome: "Triagem", semantica: "" }, { id: "C90:UC_2", nome: "Em análise (RH)", semantica: "" },
    { id: "C90:WON", nome: "Concluída", semantica: "S" }, { id: "C90:UC_9", nome: "Cancelada", semantica: "F" }, { id: "C90:LOSE", nome: "Reprovada", semantica: "F" },
  ];
  assert.deepEqual(dom.etapasPromocao(renomeadas, 90), { coordenacao: "C90:NEW", rh: "C90:UC_2", aprovada: "C90:WON", naoAprovada: "C90:LOSE" });
  assert.deepEqual(dom.etapasPromocao([], 77), { coordenacao: "C77:NEW", rh: "C77:PREPARATION", aprovada: "C77:WON", naoAprovada: "C77:LOSE" });
});

/* ---------------------------------------------------------------- formulário */
test("formulário: níveis e competências da Configuração; perguntas que só valem quando aparecem", () => {
  const cfg = dadosDemo().config;
  const def = F.formPromocao({ niveis: cfg.niveis, senioridades: SENIORIDADES, competencias: cfg.competencias.map((c) => c.nome) });
  const campo = (d, cod) => F.campos(d).find((c) => c.codigo === cod);
  assert.equal(campo(def, "UF_CRM_PR_NIVEL").tipo, "lista");
  assert.deepEqual(campo(def, "UF_CRM_PR_NIVEL").opcoes, cfg.niveis);
  assert.deepEqual(campo(def, "UF_CRM_PR_COMPET").opcoes, cfg.competencias.map((c) => c.nome));
  // sem a Configuração: o nível vira texto e as competências são as da Solicitação de Contratação
  const semCfg = F.formPromocao({});
  assert.equal(campo(semCfg, "UF_CRM_PR_NIVEL").tipo, "texto");
  assert.deepEqual(campo(semCfg, "UF_CRM_PR_COMPET").opcoes, F.COMPETENCIAS_PADRAO);

  const falta = F.faltando(def, {});
  ["membroId", "UF_CRM_PR_ATUAL", "UF_CRM_PR_NIVEL", "UF_CRM_PR_DATA", "UF_CRM_PR_REMUN", "UF_CRM_PR_MOTIVO", "UF_CRM_PR_RESULT", "UF_CRM_PR_RESPONS",
    "UF_CRM_PR_DESENV", "UF_CRM_PR_IMPACTO", "UF_CRM_PR_CIENTE"].forEach((k) => assert.ok(falta.includes(k), k));
  ["UF_CRM_PR_NIVEL_ATU", "UF_CRM_PR_SENIOR", "UF_CRM_PR_CARGO", "UF_CRM_PR_REAJUSTE", "UF_CRM_PR_COMPET", "UF_CRM_PR_IMPAC_DSC", "UF_CRM_PR_OBS"].forEach((k) => assert.ok(!falta.includes(k), k));
  assert.deepEqual(F.faltando(def, pedidoBruno()), []);
  // atividades redistribuídas ou contratação: conte como fica a operação
  assert.deepEqual(F.faltando(def, Object.assign(pedidoBruno(), { UF_CRM_PR_IMPACTO: "Serão redistribuídas no time" })), ["UF_CRM_PR_IMPAC_DSC"]);
  assert.deepEqual(F.faltando(def, Object.assign(pedidoBruno(), { UF_CRM_PR_IMPACTO: "Será preciso contratar alguém" })), ["UF_CRM_PR_IMPAC_DSC"]);
});

test("formulário: o que vai para o card (o reajuste só com \"Sim\"; várias escolhas viram texto)", () => {
  const def = F.formPromocao({ niveis: dadosDemo().config.niveis, senioridades: SENIORIDADES });
  const campos = F.camposDaPromocao(def, pedidoBruno());
  assert.equal(campos.UF_CRM_PR_REAJUSTE, undefined, "escondido quando não há reajuste");
  assert.equal(campos.UF_CRM_PR_COMPET, "Organização; Autonomia");
  assert.equal(campos.UF_CRM_PR_NIVEL, "Analista II");
  assert.equal(campos.UF_CRM_PR_CARGO, undefined, "vazio não vai");
  assert.equal(campos.membroId, undefined, "o membro vai como pessoa (UF_CRM_PR_MEMBRO), pela tela");
  const comReajuste = F.camposDaPromocao(def, Object.assign(pedidoBruno(), { UF_CRM_PR_REMUN: "Sim" }));
  assert.equal(comReajuste.UF_CRM_PR_REAJUSTE, "10%");
});

test("formulário: a conferência antes de enviar", () => {
  const ctx = contexto("3");
  const niveis = dadosDemo().config.niveis;
  const conferir = (mudar) => F.conferirPromocao(ctx, Object.assign(pedidoBruno(), mudar || {}), { niveis, promocoes: dom.promocoes(ctx) });
  assert.deepEqual(conferir(), { ok: true, mensagem: "" });
  // a Ana já tem uma solicitação aguardando a coordenação
  assert.match(conferir({ membroId: "1", UF_CRM_PR_NIVEL_ATU: "Analista II", UF_CRM_PR_NIVEL: "Analista III" }).mensagem, /Já há uma solicitação de promoção de Ana Ribeiro em andamento \(aguarda a coordenação\)/);
  assert.match(conferir({ UF_CRM_PR_DATA: "2026-10-07" }).mensagem, /passado/);
  assert.match(conferir({ UF_CRM_PR_NIVEL: "Assistente" }).mensagem, /abaixo do atual/);
  assert.match(conferir({ UF_CRM_PR_NIVEL: "Analista I", UF_CRM_PR_SENIOR: "Júnior" }).mensagem, /Nada muda/);
  // mesmo nível com nova senioridade ou novo cargo: vale
  assert.equal(conferir({ UF_CRM_PR_NIVEL: "Analista I", UF_CRM_PR_SENIOR: "Pleno" }).ok, true);
  assert.equal(conferir({ UF_CRM_PR_NIVEL: "Analista I", UF_CRM_PR_SENIOR: "", UF_CRM_PR_CARGO: "Analista de vistos" }).ok, true);
  // a solicitação encerrada não impede uma nova
  const ctx2 = contexto("3", (d) => Object.assign(card(d, "9011"), { STAGE_ID: "C77:LOSE", UF_CRM_PR_COORD_DEC: "Não aprovada" }));
  assert.equal(F.conferirPromocao(ctx2, Object.assign(pedidoBruno(), { membroId: "1", UF_CRM_PR_NIVEL_ATU: "Analista II", UF_CRM_PR_NIVEL: "Analista III" }), { niveis, promocoes: dom.promocoes(ctx2) }).ok, true);
});

test("formulário: o que o app já sabe do membro e o resumo mostrado no formulário", () => {
  const ctx = contexto("3");
  assert.deepEqual(F.inicialPromocao(ctx, "2"), { UF_CRM_PR_ATUAL: "Imigração · Analista", UF_CRM_PR_NIVEL_ATU: "Analista I", nome: "Bruno Teixeira", senioridadeAtual: "Júnior", liderancaId: "3", coordenacaoId: "2" });
  assert.deepEqual(F.inicialPromocao(ctx, "999"), {});
  const s = F.resumoPromocao(ctx, "1");
  assert.equal(s.tempoDeCasa, "2 anos e 6 meses");
  assert.equal(s.ultimaMovimentacao, "2025-12-15 · de Analista I para Analista II");
  assert.equal(s.proximoNivel, "Analista III");
  assert.deepEqual([s.feedbacks, s.reconhecimento, s.mensais, s.o2o, s.planoAtivo], [2, 1, 2, 3, false]);
  assert.equal(F.duracao(F.mesesEntre("2026-10-01", "2026-10-08")), "menos de 1 mês");
  assert.equal(F.duracao(F.mesesEntre("2025-09-08", "2026-10-08")), "1 ano e 1 mês");
  assert.equal(F.duracao(F.mesesEntre("2024-10-09", "2026-10-08")), "1 ano e 11 meses");
});

test("timeline do card: o pedido inteiro e o histórico do membro, com os O2O", () => {
  const ctx = contexto("3");
  const def = F.formPromocao({ niveis: dadosDemo().config.niveis, senioridades: SENIORIDADES });
  const t = F.textoPedidoPromocao(def, pedidoBruno(), { nome: "Bruno Teixeira", quem: "Carla Mendes", papel: "Liderança direta", data: "2026-10-08", aprovacao: "a coordenação (Livia Prado) e depois o RH" });
  assert.match(t, /^\[B\]Solicitação de promoção de Bruno Teixeira\[\/B\]\nEnviada por Carla Mendes \(liderança direta\) em 08\/10\/2026, pelo app Gestão de Pessoas\.\nAprovação: a coordenação \(Livia Prado\) e depois o RH\./);
  assert.match(t, /\[B\]2\. Proposta\[\/B\]\nNível proposto: Analista II\nSenioridade proposta: Pleno\nA partir de quando a promoção deve valer\? 01\/11\/2026\nA promoção vem com reajuste salarial\? Não/);
  assert.match(t, /Por que esta pessoa está pronta para a promoção agora\?\nConduz a carteira/);
  assert.match(t, /Competências comportamentais que se destacam: Organização; Autonomia/);
  assert.ok(!/10%/.test(t), "o reajuste escondido não vai");
  assert.ok(!/Observações/.test(t), "pergunta em branco não vai");
  const comRegistro = F.textoPedidoPromocao(def, pedidoBruno(), { nome: "Bruno Teixeira", quem: "Carla Mendes", papel: "Liderança direta", registradoPor: "Helena Costa", data: "2026-10-08" });
  assert.match(comRegistro, /pelo app Gestão de Pessoas \(registrado por Helena Costa\)\.\n\n/);

  const h = F.historicoPromocao(ctx, "1", { quem: "Carla Mendes", data: "2026-10-08" });
  assert.deepEqual(h.map((x) => x.split("\n")[0]), ["[B]O2O de Ana Ribeiro[/B]", "[B]1:1 mensais de Ana Ribeiro[/B]", "[B]Feedbacks SCI de Ana Ribeiro[/B]"]);
  assert.match(h[0], /Copiado do app Gestão de Pessoas na solicitação de promoção, enviada por Carla Mendes em 08\/10\/2026\. 3 registros/);
  assert.match(h[0], /Próximo nível: Analista III/);
  // o encerramento continua sem os O2O e com o texto dele
  const enc = F.historicoEncerramento(ctx, "1", { quem: "Carla Mendes", data: "2026-10-08" });
  assert.ok(!enc.some((x) => /^[B]O2O de/.test(x)));
  assert.match(enc[0], /na solicitação de encerramento de contrato/);
});

test("aba Carreira: a linha da movimentação aprovada pelo RH", () => {
  assert.equal(F.linhaCarreira({ vigencia: "2026-11-01", de: "Analista I", para: "Analista II" }), "2026-11-01 · de Analista I para Analista II · promoção aprovada pelo RH");
  assert.equal(F.linhaCarreira({ vigencia: "2026-11-01", de: "", para: "Especialista", cargo: "Especialista em vistos" }),
    "2026-11-01 · de nível não registrado para Especialista (Especialista em vistos) · promoção aprovada pelo RH");
});

/* ---------------------------------------------------------------- sino */
test("sino: quem decide recebe o pedido; quem pediu, a liderança e a coordenação recebem as decisões; o membro nunca", () => {
  const titulos = (ctx, u) => N.notificacoesDe(ctx, u, { visto: "" }).filter((n) => /romoção/.test(n.titulo)).map((n) => n.titulo);
  let ctx = contexto("3");
  assert.deepEqual(titulos(ctx, "2"), ["Promoção aguardando a sua aprovação: Ana Ribeiro"]);
  assert.deepEqual(titulos(ctx, "6"), ["Promoção aguardando a sua aprovação: Júlia Freitas"]);
  assert.deepEqual(titulos(ctx, "4"), ["A coordenação aprovou a promoção de Júlia Freitas"]);
  assert.deepEqual(titulos(ctx, "3"), [], "a da Ana ainda não teve decisão");
  ["100", "111", "5"].forEach((u) => assert.deepEqual(titulos(ctx, u), [], u));
  const aguardando = N.notificacoesDe(ctx, "2", { visto: "" }).find((n) => /Ana Ribeiro/.test(n.titulo));
  assert.equal(aguardando.acao, true);
  assert.equal(aguardando.rota, "#/recrutamento/promocao/9011");

  // o RH aprova a da Júlia
  ctx = contexto("3", (d) => Object.assign(card(d, "9012"), { STAGE_ID: "C77:WON", UF_CRM_PR_RH_DEC: "Aprovada", UF_CRM_PR_RH_POR: "6", UF_CRM_PR_RH_EM: "2026-10-08", UF_CRM_PR_VIGENCIA: "2026-11-01" }));
  assert.deepEqual(titulos(ctx, "4"), ["O RH aprovou a promoção de Júlia Freitas", "A coordenação aprovou a promoção de Júlia Freitas"]);
  // a mais nova primeiro: a decisão do RH (08/10) vem antes do pedido da Ana (07/10)
  assert.deepEqual(titulos(ctx, "2"), ["O RH aprovou a promoção de Júlia Freitas", "Promoção aguardando a sua aprovação: Ana Ribeiro"]);
  assert.deepEqual(titulos(ctx, "6"), [], "quem decidiu não recebe a própria decisão");
  assert.deepEqual(titulos(ctx, "111"), []);
  const aprovada = N.notificacoesDe(ctx, "4", { visto: "" }).find((n) => /O RH aprovou/.test(n.titulo));
  assert.equal(aprovada.texto, "Analista II a partir de 01/11/2026. A conversa com a pessoa fica com a liderança.");
});
