/* =====================================================================================
   TELA — Configuração (só administrador do Bitrix: BX24.appOption exige admin)
   -------------------------------------------------------------------------------------
   Estrutura no Bitrix (provisionamento), papéis do app, níveis da Arquitetura de Cargos,
   feriados de SP e Salvador, links e parâmetros. Tudo fica em BX24.appOption "gp_config".
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;

  const LINKS = [
    ["manual", "Manual da liderança", "Faixa no topo do Início e item do menu."],
    ["formVaga", "Formulário de solicitação de vaga", "Solicitação de Contratação (formulário CRM 259, funil HR | Requisição de Vagas)."],
    ["formEncerramento", "Formulário de solicitação de encerramento", "Opcional: o app já tem a solicitação com verificação."],
    ["baseConhecimento", "Base de Conhecimento", "Guias de apoio às lideranças."],
    ["guiaOnboarding", "Guia do onboarding", "Link na aba Onboarding."],
    ["guiaOffboarding", "Guia de offboarding (versão 2)", "Card fechado no topo da aba Offboarding."],
    ["modelosSCI", "Modelos de feedback SCI", "Página com os 4 modelos revisados pelo RH."],
  ];
  const PAPEIS = [["coordenacao", "Coordenação e acima", "Enviam solicitações formais direto ao RH e aprovam as da equipe (1.2)."], ["rh", "RH", "Veem todas as equipes, a fila do RH e recebem os avisos."], ["ceo", "CEO", "Painel geral, só números (sem o conteúdo dos registros)."]];

  function linhasFeriados(lista) { return (lista || []).map((f) => f.data + " " + f.nome).join("\n"); }
  function lerFeriados(txt) {
    return String(txt || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/.exec(l) || /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/.exec(l);
      if (!m) return null;
      return m.length === 3 ? { data: m[1], nome: m[2] } : { data: m[3] + "-" + m[2] + "-" + m[1], nome: m[4] };
    }).filter(Boolean).sort((a, b) => (a.data < b.data ? -1 : 1));
  }

  ui.rotas.config = function () {
    if (!E().eu.admin) return '<div class="card">' + c.vazio("Só administradores do Bitrix acessam a Configuração.") + "</div>";
    const cfg = E().config || {};
    const est = E().estrutura || {};
    const procs = cfg.processos || {};
    const qt = Object.keys(procs).length;
    let h = c.cabecalho("config", "Configuração", "<span>só administradores do Bitrix</span>");
    // Estrutura
    h += '<div class="card"><h3>Estrutura no Bitrix<span class="extra">' + c.tag(est.origem === "gravada" ? "configuração gravada" : est.origem === "descoberta" ? "achada pelos nomes" : est.origem === "demo" ? "demonstração" : "não configurada", est.origem === "ausente" ? "vermelho" : "verde") + "</span></h3>" +
      '<p class="muted" style="margin-top:0">' + qt + " de " + GP.schema.PROCESSOS.length + " processos inteligentes ligados ao app" + (est.ausentes && est.ausentes.length ? " · " + plural(est.ausentes.length, "campo faltando", "campos faltando") : "") +
      '. A criação usa o seu login de administrador e precisa dos escopos crm e userfieldconfig no app. É segura para repetir: só cria o que falta.</p>' +
      (qt ? '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Processo</th><th class="n">entityTypeId</th><th class="n">id</th></tr></thead><tbody>' +
        GP.schema.PROCESSOS.map((p) => "<tr><td>" + esc(p.nome) + '</td><td class="n">' + esc((procs[p.chave] || {}).entityTypeId || "—") + '</td><td class="n">' + esc((procs[p.chave] || {}).typeId || "—") + "</td></tr>").join("") + "</tbody></table></div>" : "") +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn sec" data-acao="provisionar" data-simular="1">Simular (não grava)</button><button class="btn" data-acao="provisionar">Criar ou completar a estrutura</button><button class="btn link" data-acao="importar-config">Importar configuração (JSON do tools/provisionar.js)</button></div>' +
      '<pre id="log-provisao" style="display:none;margin-top:14px;background:var(--sutil);border-radius:10px;padding:12px;font-size:12px;max-height:280px;overflow:auto;white-space:pre-wrap"></pre>' +
      '<p class="muted" style="font-size:12px">Robôs, permissões por departamento, campos obrigatórios por estágio e o processo de negócio da trava são configurados à mão no Bitrix: veja docs/configuracao-bitrix.md no repositório.</p></div>';
    // Papéis
    h += '<div class="card"><h3>Papéis no app</h3>' + PAPEIS.map((p) => {
      const lista = ((cfg.papeis || {})[p[0]]) || [];
      return '<div class="grupo-form" style="margin-top:0;margin-bottom:14px"><div class="rotulo-grupo">' + esc(p[1]) + '</div><div class="muted" style="font-size:12px;margin:-6px 0 8px">' + esc(p[2]) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        lista.map((u) => '<span class="tag azul">' + esc(u.nome || "ID " + u.id) + ' <a href="#" data-acao="remover-papel" data-papel="' + p[0] + '" data-id="' + esc(u.id) + '" aria-label="Remover">✕</a></span>').join("") +
        '<button class="btn peq sec" data-acao="adicionar-papel" data-papel="' + p[0] + '">' + icone("mais", 13) + " Adicionar</button></div></div>";
    }).join("") + '<p class="muted" style="font-size:12px;margin:0">Liderança não precisa de cadastro: é quem chefia um departamento na estrutura da empresa (1.1).</p></div>';
    // Listas e textos
    const fl = cfg.feriadosLocais || {};
    h += '<div class="card"><h3>Cadastros</h3><div id="form-config">' +
      c.campo({ nome: "niveis", rotulo: "Níveis da Arquitetura de Cargos", tipo: "textoLongo", valor: (cfg.niveis || []).join("\n"), linhas: 5, ajuda: "Um nível por linha, do primeiro ao último. Usados no 1:1 (próximo nível) e no card do membro." }) +
      '<div class="linha-campos">' + c.campo({ nome: "feriadosSP", rotulo: "Feriados de São Paulo (estado e cidade)", tipo: "textoLongo", valor: linhasFeriados(fl.SP), linhas: 6, ajuda: "Um por linha: AAAA-MM-DD Nome. O RH atualiza todo dezembro." }) +
      c.campo({ nome: "feriadosBA", rotulo: "Feriados de Salvador (estado e cidade)", tipo: "textoLongo", valor: linhasFeriados(fl.BA), linhas: 6, ajuda: "Os nacionais vêm do Bitrix e não entram aqui." }) + "</div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">Links</div>' + LINKS.map((l) => c.campo({ nome: "link_" + l[0], rotulo: l[1], valor: (cfg.links || {})[l[0]], ajuda: l[2], opcional: true, placeholder: "https://" })).join("") + "</div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">Parâmetros</div><div class="linha-campos">' +
      c.campo({ nome: "carencia1a1", rotulo: "Dias para agendar o 1:1 antes do vermelho", tipo: "numero", valor: (cfg.parametros || {}).carencia1a1 || 7 }) +
      c.campo({ nome: "prazoLeitura", rotulo: "Prazo da leitura de entrega (dias)", tipo: "numero", valor: (cfg.parametros || {}).prazoLeitura || 7 }) + "</div>" +
      c.campo({ nome: "categoriaVagas", rotulo: "Funil de vagas (CATEGORY_ID dos negócios)", tipo: "numero", valor: (cfg.recrutamento || {}).categoria || 77, ajuda: "Hoje: HR | Requisição de Vagas (77). Troque quando o funil de R&S existir." }) + "</div>" +
      '<button class="btn" data-acao="salvar-config">Salvar os cadastros</button></div></div>';
    return h;
  };

  async function gravarConfig(novo, botao, mensagem) {
    return ui.salvar(botao, async () => {
      await E().repo.salvarConfig(novo);
      E().config = novo;
      E().ctx.config = novo;
    }, { mensagem: mensagem || "Configuração salva.", fechar: true });
  }
  ui.acoes["salvar-config"] = function (el) {
    const d = ui.lerForm(document.getElementById("form-config"));
    const cfg = JSON.parse(JSON.stringify(E().config || {}));
    cfg.niveis = String(d.niveis || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    cfg.feriadosLocais = { SP: lerFeriados(d.feriadosSP), BA: lerFeriados(d.feriadosBA) };
    cfg.links = cfg.links || {};
    LINKS.forEach((l) => { cfg.links[l[0]] = String(d["link_" + l[0]] || "").trim(); });
    cfg.parametros = { carencia1a1: Number(d.carencia1a1) || 7, prazoLeitura: Number(d.prazoLeitura) || 7 };
    cfg.recrutamento = { categoria: Number(d.categoriaVagas) || 77 };
    gravarConfig(cfg, el, "Cadastros salvos. Recarregue o app para aplicar o funil de vagas.");
  };
  ui.acoes["adicionar-papel"] = async function (el) {
    const escolhidos = await E().repo.selecionarUsuarios(true);
    if (!escolhidos.length) return;
    const cfg = JSON.parse(JSON.stringify(E().config || {}));
    cfg.papeis = cfg.papeis || {};
    const lista = cfg.papeis[el.dataset.papel] = cfg.papeis[el.dataset.papel] || [];
    escolhidos.forEach((u) => { if (!lista.some((x) => String(x.id) === String(u.id))) lista.push({ id: String(u.id), nome: u.nome }); });
    gravarConfig(cfg, null, "Papel atualizado. Recarregue o app para ver as novas visões.");
  };
  ui.acoes["remover-papel"] = function (el) {
    const cfg = JSON.parse(JSON.stringify(E().config || {}));
    cfg.papeis[el.dataset.papel] = (cfg.papeis[el.dataset.papel] || []).filter((x) => String(x.id) !== String(el.dataset.id));
    gravarConfig(cfg, null, "Papel atualizado.");
  };
  ui.acoes["provisionar"] = async function (el) {
    const simular = !!el.dataset.simular;
    if (!simular && !window.confirm("Criar ou completar no Bitrix os processos inteligentes, estágios e campos do app? Recomendado: rodar primeiro no ambiente de teste.")) return;
    const log = document.getElementById("log-provisao");
    log.style.display = "block";
    log.textContent = (simular ? "SIMULAÇÃO — nada será gravado.\n" : "Gravando no Bitrix…\n");
    el.disabled = true;
    try {
      const r = await E().repo.provisionar(simular, (m) => { log.textContent += m + "\n"; log.scrollTop = log.scrollHeight; });
      const porMetodo = {};
      r.relatorio.forEach((x) => { porMetodo[x.metodo] = (porMetodo[x.metodo] || 0) + 1; });
      log.textContent += "\n" + (simular ? "Seria feito: " : "Feito: ") + (Object.keys(porMetodo).length ? JSON.stringify(porMetodo) : "nada (estrutura completa)") + "\n";
      if (!simular) {
        const cfg = Object.assign({}, E().config || {}, { processos: r.config.processos, solucaoId: r.config.solucaoId, provisionadoEm: r.config.provisionadoEm });
        await E().repo.salvarConfig(cfg);
        log.textContent += "Configuração gravada. Recarregue o app.\n";
      }
    } catch (e) {
      log.textContent += "\nFALHOU: " + (e.message || E().repo.mensagemErro(e)) + "\n";
    } finally { el.disabled = false; }
  };
  ui.acoes["importar-config"] = function () {
    ui.abrirPainel({
      titulo: "Importar configuração", sub: "Cole o JSON gravado por tools/provisionar.js --saida.",
      corpo: '<div id="form-import">' + c.campo({ nome: "json", rotulo: "Configuração (JSON)", tipo: "textoLongo", linhas: 14 }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-import">Importar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-import"] = function (el) {
    let novo;
    try { novo = JSON.parse(ui.lerForm(document.getElementById("form-import")).json); } catch (e) { ui.erroNoPainel("JSON inválido: " + e.message); return; }
    if (!novo || !novo.processos) { ui.erroNoPainel("O JSON precisa ter a chave \"processos\"."); return; }
    const cfg = Object.assign({}, E().config || {}, { processos: novo.processos, solucaoId: novo.solucaoId, provisionadoEm: novo.provisionadoEm });
    gravarConfig(cfg, el, "Configuração importada. Recarregue o app.");
  };
})(window);
