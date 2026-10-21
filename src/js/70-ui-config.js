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
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
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
  const PAPEIS = [["coordenacao", "Coordenação e acima", "Enviam solicitações formais direto ao RH e aprovam as da equipe (1.2)."], ["rh", "RH", "Veem todas as equipes, a fila do RH e recebem os avisos."], ["ceo", "CEO", "Painel geral, só números (sem o conteúdo dos registros)."], ["excecoes", "Fora do app", "Não ganham item no processo Membros nem entram nas equipes. A CEO já fica de fora sozinha."]];

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
      '<p class="muted" style="font-size:12px">Robôs, permissões por departamento e campos obrigatórios por estágio são configurados à mão no Bitrix: veja docs/configuracao-bitrix.md no repositório.</p></div>';
    // Papéis
    h += '<div class="card"><h3>Papéis no app</h3>' + PAPEIS.map((p) => {
      const lista = ((cfg.papeis || {})[p[0]]) || [];
      return '<div class="grupo-form" style="margin-top:0;margin-bottom:14px"><div class="rotulo-grupo">' + esc(p[1]) + '</div><div class="muted" style="font-size:12px;margin:-6px 0 8px">' + esc(p[2]) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        lista.map((u) => '<span class="tag azul">' + esc(u.nome || "ID " + u.id) + ' <a href="#" data-acao="remover-papel" data-papel="' + p[0] + '" data-id="' + esc(u.id) + '" aria-label="Remover">✕</a></span>').join("") +
        '<button class="btn peq sec" data-acao="adicionar-papel" data-papel="' + p[0] + '">' + icone("mais", 13) + " Adicionar</button></div></div>";
    }).join("") + '<p class="muted" style="font-size:12px;margin:0">Liderança não precisa de cadastro: é quem chefia um departamento na estrutura da empresa (1.1).</p></div>';
    h += semChefeHtml(cfg);
    // Sincronização com a estrutura da empresa (55-sync.js)
    h += '<div class="card"><h3>Sincronização com a estrutura da empresa</h3>' +
      '<p class="muted" style="margin-top:0">Mantém o processo Membros igual à estrutura do Bitrix. Quem entra ganha o item (e o onboarding, se entrou há menos de 90 dias). Quem muda de departamento tem a liderança e a coordenação atualizadas. Quem é desativado vai para Encerrado. O RH recebe um aviso com o resumo, e cada item ganha um comentário no histórico.</p>' +
      '<p class="muted" style="font-size:12px">Roda sozinha todo dia de manhã quando a rotina da Vercel estiver configurada (docs/configuracao-bitrix.md). A primeira carga, com todo mundo, é melhor fazer por aqui.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" data-acao="sync-previa">Ver o que mudaria</button><button class="btn" data-acao="sync-executar">Sincronizar agora</button></div>' +
      '<div id="sync-resultado" style="margin-top:14px"></div></div>';
    h += checagemHtml();
    h += servidorHtml(cfg);
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

  /* ---------------- setores sem chefe no Bitrix (1.1) ---------------- */
  function semChefeHtml(cfg) {
    const ctx = E().ctx;
    const setores = dom.setoresSemChefe(ctx);
    if (!setores.length) return "";
    const coord = ((cfg.papeis || {}).coordenacao || []).map((p) => String(p.id));
    const usuarios = (ctx.usuarios || []).slice().sort((a, b) => {
      const ca = coord.indexOf(a.id) >= 0, cb = coord.indexOf(b.id) >= 0;
      return ca !== cb ? (ca ? -1 : 1) : a.nome.localeCompare(b.nome, "pt-BR");
    }).map((u) => ({ valor: u.id, rotulo: u.nome + (coord.indexOf(u.id) >= 0 ? " · coordenação" : "") }));
    return '<div class="card"><h3>Setores sem chefe no Bitrix</h3>' +
      '<p class="muted" style="margin-top:0">Estes departamentos não têm chefe na estrutura da empresa. É o caso de um setor coordenado por supervisores adjuntos, que a API do Bitrix não informa. Escolha a coordenação responsável de cada área. O app grava a coordenação dos membros e a liderança direta de quem chefia a área e de quem está direto no setor. A sincronização diária mantém esses valores e repete o mesmo para quem entrar depois na área.</p>' +
      setores.map((s, i) => '<div class="grupo-form" id="semchefe-' + i + '"><div class="rotulo-grupo">' + esc(s.depto.nome) + "</div>" +
        '<div class="tabela-wrap"><table class="tabela"><tbody>' + s.grupos.map((g, j) =>
          "<tr><td><b>" + esc(g.direto ? "Direto em " + s.depto.nome : g.depto.nome) + '</b><div class="muted" style="font-size:12px">' + plural(g.membros.length, "membro", "membros") +
          (g.chefe ? " · chefe " + esc(dom.pessoa(ctx, g.chefe).nome) : "") + (g.incertos.length ? " · " + g.incertos.length + " sem coordenação pela estrutura" : "") + "</div></td>" +
          '<td style="min-width:260px">' + c.campo({ nome: "g" + j, rotulo: "Coordenação responsável", tipo: "lista", opcoes: usuarios, valor: g.coordenacao, opcional: true }) + "</td></tr>").join("") +
        "</tbody></table></div>" +
        '<button class="btn" data-acao="aplicar-semchefe" data-setor="' + i + '">Gravar em ' + esc(s.depto.nome) + "</button></div>").join("") + "</div>";
  }
  ui.acoes["aplicar-semchefe"] = function (el) {
    const ctx = E().ctx;
    const s = dom.setoresSemChefe(ctx)[Number(el.dataset.setor)];
    if (!s) return;
    const d = ui.lerForm(document.getElementById("semchefe-" + el.dataset.setor));
    const mudancas = [];
    s.grupos.forEach((g, j) => { dom.mudancasSetorSemChefe(ctx, g, d["g" + j]).forEach((x) => mudancas.push(x)); });
    if (!mudancas.length) { ui.avisar("Nada a gravar: os itens do Membros já estão assim."); return; }
    if (!window.confirm("Gravar a coordenação de " + s.depto.nome + " em " + plural(mudancas.length, "item", "itens") + " do Membros?")) return;
    const quando = calc.fmtDataAno(ctx.hoje);
    ui.salvar(el, async () => {
      for (const x of mudancas) {
        await ui.atualizar("membros", x.membro.id, x.dados);
        const partes = [];
        if (x.dados.coordenacao) partes.push("coordenação: " + dom.pessoa(ctx, x.dados.coordenacao).nome);
        if (x.dados.lideranca) partes.push("liderança direta: " + dom.pessoa(ctx, x.dados.lideranca).nome);
        try { await E().repo.comentar("membros", x.membro.id, "Definido em Configuração → Setores sem chefe no Bitrix (" + s.depto.nome + ") por " + E().eu.nome + " em " + quando + ": " + partes.join("; ") + "."); } catch (e) { /* o comentário não impede a gravação */ }
      }
    }, { mensagem: plural(mudancas.length, "item atualizado", "itens atualizados") + " no Membros.", fechar: false });
  };

  /* ---------------- checagem antes de ligar o app (5.3) ---------------- */
  function checagemHtml() {
    const lista = dom.checagemImplantacao(E().ctx);
    const ok = lista.filter((x) => x.ok).length;
    return '<div class="card"><h3>Checagem antes de ligar o app<span class="extra">' + c.tag(ok + " de " + lista.length + " ok", ok === lista.length ? "verde" : "ambar") + "</span></h3>" +
      '<p class="muted" style="margin-top:0">Os testes da seção 5.3, com os dados que o app leu agora. Só libere para as lideranças quando todos passarem. Recarregue a página depois de corrigir no Bitrix.</p>' +
      '<div class="lista">' + lista.map((x) => '<div class="item"><div class="principal-item"><div class="t">' + (x.ok ? "✓ " : "✗ ") + esc(x.titulo) + "</div>" +
        (x.ok ? "" : '<div class="d">' + esc(x.problemas.slice(0, 8).join(" · ")) + (x.problemas.length > 8 ? " · e mais " + (x.problemas.length - 8) : "") + "</div>") +
        '</div><div class="lado">' + c.tag(x.ok ? "ok" : plural(x.problemas.length, "ponto", "pontos"), x.ok ? "verde" : "vermelho") + "</div></div>").join("") +
      '<div class="item"><div class="principal-item"><div class="t">Os exemplos da 4.5 dão o mesmo resultado</div><div class="d">Os exemplos são testes automáticos do código (test/calc.test.js). No ambiente de teste, confira também os 6 casos do protótipo na tela.</div></div><div class="lado">' + c.tag("conferir à mão", "cinza") + "</div></div>" +
      "</div></div>";
  }

  /* ---------------- rotinas do servidor (Vercel) ---------------- */
  const ROTINAS = [
    ["sincronizacao", "Sincronização diária com a estrutura", "Todo dia às 6h."],
    ["avisos", "Avisos da 4.4", "Resumo semanal, dia do atraso, 7 e 14 dias. Todo dia às 8h."],
    ["trava", "Trava do encerramento no servidor", "Precisa também do webhook de saída no Bitrix, com o endereço abaixo."],
    ["painelCEO", "Painel da CEO", "Números calculados no servidor; a CEO não precisa de leitura nos processos."],
  ];
  const idsDoPapel = (cfg, papel) => ((cfg.papeis || {})[papel] || []).map((p) => p.id).filter(Boolean);
  function carregarStatus() {
    if (E().statusServidor !== undefined || E().statusServidorCarregando) return;
    E().statusServidorCarregando = true;
    E().repo.statusServidor().then((r) => { E().statusServidor = r; }, (e) => { E().statusServidor = { erro: (e && e.message) || String(e) }; })
      .then(() => { E().statusServidorCarregando = false; if (E().rota.nome === "config") ui.render(); });
  }
  function servidorHtml(cfg) {
    carregarStatus();
    const st = E().statusServidor;
    const linhaStatus = (r) => {
      if (st === undefined) return '<span class="muted">conferindo…</span>';
      if (st === null) return '<span class="muted">só no Bitrix</span>';
      if (st.erro || !st.rotinas) return c.tag("sem resposta", "vermelho");
      const x = st.rotinas[r];
      return x && x.ligada ? c.tag("ligada", "verde") : c.tag("falta " + ((x && x.falta) || []).join(", "), "ambar");
    };
    const rh = idsDoPapel(cfg, "rh");
    const ceo = idsDoPapel(cfg, "ceo");
    const fora = Array.from(new Set(ceo.concat(idsDoPapel(cfg, "excecoes"))));
    let ref = "";
    try { ref = /\/marketplace\/app\/\d+\/?/.test(document.referrer) ? document.referrer.replace(/[?#].*$/, "") : ""; } catch (e) { /* sem referrer */ }
    const valores = [
      ["GP_AVISAR_IDS", rh.join(","), "o RH, de Papéis no app"],
      ["GP_CEO_IDS", ceo.join(","), "a CEO, de Papéis no app (obrigatória: ela nunca ganha item nem aviso)"],
      ["GP_EXCECOES_IDS", fora.join(","), "CEO e Fora do app: nunca recebem aviso"],
      ["GP_LINK_APP", ref, "endereço deste app no Bitrix, no fim de cada aviso"],
    ];
    return '<div class="card"><h3>Rotinas no servidor (Vercel)</h3>' +
      '<p class="muted" style="margin-top:0">O que precisa rodar fora da tela. Cada rotina liga quando as variáveis dela estão gravadas na Vercel (Settings → Environment Variables, seguido de Redeploy). O webhook de entrada (BITRIX_WEBHOOK_URL), o CRON_SECRET e o BITRIX_EVENTO_TOKEN são segredos: grave direto na Vercel e não mande para ninguém.</p>' +
      '<div class="tabela-wrap"><table class="tabela"><tbody>' + ROTINAS.map((r) => "<tr><td><b>" + esc(r[1]) + '</b><div class="muted" style="font-size:12px">' + esc(r[2]) + "</div></td><td>" + linhaStatus(r[0]) + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="grupo-form"><div class="rotulo-grupo">Valores para copiar na Vercel</div><div class="tabela-wrap"><table class="tabela"><tbody>' +
      valores.map((v) => '<tr><td class="num"><b>' + esc(v[0]) + '</b></td><td class="num">' + (v[1] ? esc(v[1]) : '<span class="muted">—</span>') + '</td><td class="muted" style="font-size:12px">' + esc(v[2]) + "</td></tr>").join("") +
      "</tbody></table></div>" +
      '<p class="muted" style="font-size:12px">Webhook de saída (Bitrix → Desenvolvedores → Outros → Webhook de saída), com os eventos ONCRMDYNAMICITEMADD e ONCRMDYNAMICITEMUPDATE: <b class="num">' + esc((/^https?:/.test(location.origin) ? location.origin : "https://gestao-pessoas-bice.vercel.app") + "/api/eventos") + "</b></p></div></div>";
  }

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
      log.textContent += "\n" + (simular ? "Seria feito: " : "Gravações enviadas: ") + (Object.keys(porMetodo).length ? JSON.stringify(porMetodo) : "nada (estrutura completa)") + "\n";
      const falhas = r.falhas || [];
      if (falhas.length) {
        log.textContent += "\nATENÇÃO: " + falhas.length + " item(ns) não foram criados:\n- " + falhas.join("\n- ") +
          "\nClique em \"Criar ou completar a estrutura\" de novo: o que já existe não é recriado. Se repetir, mande este texto ao TI.\n";
      }
      if (!simular) {
        const cfg = Object.assign({}, E().config || {}, { processos: r.config.processos, solucaoId: r.config.solucaoId, provisionadoEm: r.config.provisionadoEm });
        await E().repo.salvarConfig(cfg);
        log.textContent += (falhas.length ? "Configuração gravada com o que foi criado. " : "Estrutura completa e configuração gravada. ") + "Recarregue o app (F5).\n";
      }
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      log.textContent += "\nFALHOU: " + (e.message || E().repo.mensagemErro(e)) + "\n";
    } finally { el.disabled = false; }
  };
  /* ---------------- sincronização com a estrutura ---------------- */
  function entradaSync() {
    const ctx = E().ctx, cfg = E().config || {};
    const ids = (lista) => (lista || []).map((p) => String(p.id));
    return {
      hoje: ctx.hoje, usuarios: ctx.usuarios || [], departamentos: ctx.departamentos || [], membros: ctx.registros.membros || [],
      excecoes: ids((cfg.papeis || {}).excecoes), ceos: ids((cfg.papeis || {}).ceo),
    };
  }
  function planoHtml(p) {
    const ctx = E().ctx;
    const nomeId = (id) => (id ? dom.pessoa(ctx, id).nome : "—");
    const bloco = (titulo, itens) => '<div style="margin-bottom:12px"><b style="color:var(--navy)">' + esc(titulo) + "</b>" +
      (itens.length ? '<ul style="margin:6px 0 0;padding-left:18px">' + itens.map((t) => "<li>" + t + "</li>").join("") + "</ul>" : '<div class="muted">nenhuma</div>') + "</div>";
    return (p.alerta ? '<div class="aviso-atencao" style="margin-bottom:12px">' + esc(p.alerta) + "</div>" : "") +
      bloco("Entradas (" + p.criar.length + ")", p.criar.map((c) => esc(c.usuario.nome) + ' <span class="muted">· liderança ' + esc(nomeId(c.lideranca)) + " · coordenação " + esc(nomeId(c.coordenacao)) + " · " + (c.onboarding ? "onboarding a partir de " + calc.fmtData(c.ingresso) : "Ativo") + "</span>")) +
      bloco("Mudanças de liderança (" + p.atualizar.length + ")", p.atualizar.map((a) => esc(a.usuario.nome) + ' <span class="muted">· ' + Object.keys(a.mudancas).map((k) => (k === "lideranca" ? "liderança " : "coordenação ") + esc(nomeId(a.antes[k])) + " → " + esc(nomeId(a.mudancas[k]))).join(" · ") + "</span>")) +
      bloco("Saídas, vão para Encerrado (" + (p.encerrar.length + (p.saidasRetidas || []).length) + ")", p.encerrar.concat(p.saidasRetidas || []).map((e) => esc(e.membro.titulo || dom.pessoa(ctx, e.membro.responsavel).nome))) +
      (p.conferir.length ? bloco("Para o RH conferir (" + p.conferir.length + ")", p.conferir.map((x) => esc(x.usuario.nome) + ' <span class="muted">· ' + esc(x.motivo) + "</span>")) : "");
  }
  ui.acoes["sync-previa"] = function () {
    const p = GP.sync.planejar(entradaSync());
    document.getElementById("sync-resultado").innerHTML = '<div class="aviso-info" style="margin-bottom:12px">Prévia: nada foi gravado.</div>' + planoHtml(p);
  };
  ui.acoes["sync-executar"] = async function (el) {
    const p = GP.sync.planejar(entradaSync());
    const total = p.criar.length + p.atualizar.length + p.encerrar.length + (p.saidasRetidas || []).length;
    const alvo = document.getElementById("sync-resultado");
    if (!total) { alvo.innerHTML = '<div class="aviso-info">✓ O processo Membros já está igual à estrutura da empresa.</div>' + (p.conferir.length ? planoHtml(p) : ""); return; }
    if (!window.confirm("Aplicar " + total + " mudança(s) no processo Membros?\n\n" + p.criar.length + " entrada(s), " + p.atualizar.length + " mudança(s) de liderança, " + (p.encerrar.length + (p.saidasRetidas || []).length) + " saída(s).")) return;
    const forcar = !!(p.saidasRetidas && p.saidasRetidas.length) && window.confirm(p.alerta + "\n\nConfirma mover essas " + p.saidasRetidas.length + " pessoas para Encerrado mesmo assim?");
    const ctx = E().ctx;
    const ops = {
      criarMembro: (d) => ui.criar("membros", d),
      criarOnboarding: (d) => ui.criar("onboarding", Object.assign({ autor: E().eu.id }, d)),
      atualizarMembro: (id, d) => ui.atualizar("membros", id, d),
      comentar: (id, t) => E().repo.comentar("membros", id, t),
      notificar: (ids, t) => E().repo.notificar(ids, t),
      nomeDe: (id) => dom.pessoa(ctx, id).nome,
    };
    const avisarIds = (((E().config || {}).papeis || {}).rh || []).map((x) => String(x.id));
    el.disabled = true; el.textContent = "Sincronizando…";
    try {
      const r = await GP.sync.executar(p, ops, { hoje: ctx.hoje, avisarIds, forcarSaidas: forcar });
      ui.render();
      const novo = document.getElementById("sync-resultado");
      if (novo) novo.innerHTML = '<div class="' + (r.falhas.length ? "aviso-atencao" : "aviso-info") + '">' + (r.texto ? esc(r.texto).replace(/\n/g, "<br>") : "Nada a mudar.") + (avisarIds.length ? "" : "<br>Nenhum RH cadastrado em Papéis: o aviso não foi enviado.") + "</div>";
    } catch (e) {
      alvo.innerHTML = '<div class="aviso-erro">Não foi possível sincronizar: ' + esc(E().repo.mensagemErro(e)) + "</div>";
    } finally { if (document.body.contains(el)) { el.disabled = false; el.textContent = "Sincronizar agora"; } }
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
