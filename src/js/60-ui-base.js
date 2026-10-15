/* =====================================================================================
   INTERFACE — base: estado, rotas, layout, componentes, painel lateral, eventos
   -------------------------------------------------------------------------------------
   Modelo: cada tela é uma função que devolve uma STRING de HTML a partir do estado.
   render() redesenha a área principal inteira. Formulários abrem no painel lateral
   (#painel), que NÃO é redesenhado pelo render(): o que a pessoa digitou fica lá até
   salvar ou fechar. Interação por delegação de eventos (data-acao, data-rota).
   Todo dado vindo do Bitrix ou digitado passa por esc() antes de entrar no HTML.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, iniciais, corDoNome } = GP.util;
  const calc = GP.calc, dom = GP.dominio;

  const estado = {
    repo: null, carregando: true, erro: null, eu: null, config: null, ctx: null,
    visao: "lideranca", visoes: [], rota: { nome: "inicio", partes: [] },
    estrutura: null, filtros: {}, ocupado: false, dispensadas: {}, tourVisto: true, tourPasso: null,
  };
  const rotas = {};
  const acoes = {};
  GP.estado = estado;

  /* ---------------- escopo pela visão ---------------- */
  const VISOES = {
    lideranca: "Liderança", coordenacao: "Coordenação", rh: "RH", ceo: "CEO",
  };
  function visoesDisponiveis(p) {
    const v = [];
    if (p.coordenacao) v.push("coordenacao");
    if (p.rh) v.push("rh");
    if (p.lideranca && !p.coordenacao) v.push("lideranca");
    if (p.ceo) v.push("ceo");
    return v;
  }
  /** Membros que a visão atual enxerga */
  function membrosDaVisao() {
    const ctx = estado.ctx, uid = estado.eu.id;
    if (estado.visao === "rh" || estado.visao === "ceo") return dom.membrosAtivos(ctx.registros.membros || []);
    if (estado.visao === "coordenacao") return dom.membrosVisiveis(ctx, uid);
    return dom.equipeDe(ctx, uid);
  }
  /** Equipe direta (o que "depende de você") */
  function minhaEquipe() { return dom.equipeDe(estado.ctx, estado.eu.id); }
  const podeVerConteudo = () => estado.visao !== "ceo";

  /* ---------------- componentes ---------------- */
  const c = {};
  c.avatar = function (p, tam) {
    const t = tam || 32;
    const nome = (p && p.nome) || "?";
    const img = p && p.foto ? '<img src="' + esc(p.foto) + '" alt="" onerror="this.remove()">' : "";
    return '<span class="av" style="width:' + t + "px;height:" + t + "px;font-size:" + Math.round(t * 0.36) + "px;background:" + corDoNome(nome) + '">' + esc(iniciais(nome)) + img + "</span>";
  };
  c.pessoa = function (p, detalhe, tam) {
    return '<div class="pessoa">' + c.avatar(p, tam || 32) + '<div style="min-width:0"><div class="nome">' + esc(p.nome) + "</div>" +
      (detalhe ? '<div class="det">' + detalhe + "</div>" : "") + "</div></div>";
  };
  const ICONE_STATUS = { verde: "✓", ambar: "!", vermelho: "✕" };
  c.tag = function (texto, cor) {
    const ic = ICONE_STATUS[cor] ? '<span class="ic" aria-hidden="true">' + ICONE_STATUS[cor] + "</span>" : "";
    return '<span class="tag ' + (cor || "cinza") + '">' + ic + esc(texto) + "</span>";
  };
  c.prazo = function (prazo, hoje) {
    if (!prazo) return '<span class="prazo">sem prazo</span>';
    const atr = calc.diasAtraso(prazo, hoje || estado.ctx.hoje);
    if (atr > 0) return '<span class="prazo atrasado">' + (atr === 1 ? "1 dia" : atr + " dias") + " de atraso · prazo " + calc.fmtData(prazo) + "</span>";
    const falta = calc.diffDias(hoje || estado.ctx.hoje, prazo);
    return '<span class="prazo">' + (falta === 0 ? "hoje" : "até " + calc.fmtData(prazo) + " (" + calc.fmtDiaSemana(prazo) + ")") + "</span>";
  };
  /** Barra de progresso com o valor escrito (4.6: nunca só a cor) */
  c.barra = function (o) {
    const r = o.r;
    const pct = r.valor === null ? 0 : r.valor;
    const cor = o.cor || (o.atraso ? "vermelho" : (o.meta && r.valor !== null && r.valor < o.meta) ? "ambar" : "");
    return '<div class="barra-bloco"><div class="barra-topo"><span class="rot">' + esc(o.rotulo) + '</span><span class="val">' + esc(r.texto) + "</span></div>" +
      '<div class="barra" role="img" aria-label="' + esc(o.rotulo + ": " + r.texto) + '"><div class="preench ' + cor + '" style="width:' + pct + '%"></div>' +
      (o.meta ? '<div class="meta" style="left:' + o.meta + '%" title="Meta ' + o.meta + '%"></div>' : "") + "</div>" +
      (o.nota ? '<div class="barra-nota">' + o.nota + "</div>" : "") + "</div>";
  };
  c.cabecalho = function (ic, titulo, numeros, acoesHtml) {
    return '<div class="cab-modulo"><div class="icone-mod">' + icone(ic, 20) + '</div><div><h1 class="titulo-pagina">' + esc(titulo) + "</h1>" +
      (numeros ? '<div class="linha-numeros">' + numeros + "</div>" : "") + "</div>" + (acoesHtml ? '<div class="acoes">' + acoesHtml + "</div>" : "") + "</div>";
  };
  c.vazio = function (t) { return '<div class="vazio">' + t + "</div>"; };
  c.abas = function (lista, ativa) {
    return '<nav class="abas">' + lista.map((a) => '<a href="' + a.rota + '" class="' + (a.chave === ativa ? "ativo" : "") + '">' + esc(a.rotulo) +
      (a.qt !== undefined && a.qt !== null ? '<span class="qt">' + a.qt + "</span>" : "") + "</a>").join("") + "</nav>";
  };
  c.voltar = function (rota, texto) { return '<a class="voltar" href="' + rota + '">' + icone("voltar", 14) + esc(texto || "Voltar") + "</a>"; };
  c.dados = function (pares) {
    return '<div class="dados">' + pares.filter((p) => p).map((p) => '<div><div class="k">' + esc(p[0]) + '</div><div class="v">' + (p[2] ? p[1] : esc(p[1] || "—")) + "</div></div>").join("") + "</div>";
  };
  c.textoRegistro = function (rotulo, texto) {
    if (!texto) return "";
    return '<div><div class="k">' + esc(rotulo) + '</div><div class="texto-registro">' + esc(texto) + "</div></div>";
  };
  c.pendencia = function (p, comMembro) {
    return '<div class="item clicavel" data-rota="' + esc(p.rota) + '">' +
      (comMembro !== false && p.membro ? c.avatar(p.membro, 30) : '<span class="av" style="width:30px;height:30px;background:var(--sutil);color:var(--navy)">' + icone("calendario", 15) + "</span>") +
      '<div class="principal-item"><div class="t">' + esc(p.titulo) + '</div><div class="d">' + esc(p.tipo) + (p.destaque ? " · ligada a plano de alinhamento" : "") + "</div></div>" +
      '<div class="lado">' + c.prazo(p.prazo) + (p.prazo ? '<button class="btn peq sec nao-imprimir" data-acao="agendar-pendencia" data-id="' + esc(p.id) + '" title="Agendar na agenda">' + icone("calendario", 14) + "</button>" : "") + "</div></div>";
  };

  /* ---------------- campos de formulário ---------------- */
  /** campo({nome, rotulo, tipo: texto|textoLongo|data|lista|escolha|numero|arquivo, valor, opcoes, ajuda, opcional, placeholder, desabilitado}) */
  c.campo = function (o) {
    const id = "f-" + o.nome;
    const v = o.valor === null || o.valor === undefined ? "" : o.valor;
    const dis = o.desabilitado ? " disabled" : "";
    let entrada;
    if (o.tipo === "textoLongo") entrada = '<textarea class="entrada" id="' + id + '" name="' + o.nome + '" rows="' + (o.linhas || 3) + '" placeholder="' + esc(o.placeholder || "") + '"' + dis + ">" + esc(v) + "</textarea>";
    else if (o.tipo === "lista") entrada = '<select class="entrada" id="' + id + '" name="' + o.nome + '"' + dis + '><option value="">Selecione</option>' +
      o.opcoes.map((op) => { const val = typeof op === "object" ? op.valor : op, rot = typeof op === "object" ? op.rotulo : op; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + esc(rot) + "</option>"; }).join("") + "</select>";
    else if (o.tipo === "escolha") entrada = '<div class="escolhas">' + o.opcoes.map((op) => {
      const val = typeof op === "object" ? op.valor : op, rot = typeof op === "object" ? op.rotulo : op;
      return '<label class="escolha"><input type="radio" name="' + o.nome + '" value="' + esc(val) + '"' + (String(val) === String(v) ? " checked" : "") + dis + ">" + esc(rot) + "</label>";
    }).join("") + "</div>";
    else if (o.tipo === "simNao") entrada = '<label class="escolha" style="display:inline-flex"><input type="checkbox" name="' + o.nome + '"' + (v ? " checked" : "") + dis + ">" + esc(o.textoCheck || "Sim") + "</label>";
    else if (o.tipo === "arquivo") entrada = '<input class="entrada" type="file" id="' + id + '" name="' + o.nome + '"' + (o.multiplo ? " multiple" : "") + dis + ">";
    else entrada = '<input class="entrada" type="' + (o.tipo === "data" ? "date" : o.tipo === "numero" ? "number" : o.tipo === "hora" ? "time" : "text") + '" id="' + id + '" name="' + o.nome + '" value="' + esc(v) + '" placeholder="' + esc(o.placeholder || "") + '"' + dis + (o.min !== undefined ? ' min="' + o.min + '"' : "") + (o.max !== undefined ? ' max="' + o.max + '"' : "") + ">";
    return '<div class="campo" data-campo="' + o.nome + '"><label for="' + id + '">' + esc(o.rotulo) + (o.opcional ? ' <span class="opcional">(opcional)</span>' : "") + "</label>" +
      (o.ajuda ? '<div class="ajuda">' + esc(o.ajuda) + "</div>" : "") + entrada + "</div>";
  };
  /** Lê os campos [name] de um contêiner */
  function lerForm(raizEl) {
    const d = {};
    raizEl.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "radio") { if (el.checked) d[el.name] = el.value; else if (!(el.name in d)) d[el.name] = ""; }
      else if (el.type === "checkbox") d[el.name] = el.checked;
      else if (el.type === "file") d[el.name] = Array.prototype.slice.call(el.files || []);
      else d[el.name] = el.value;
    });
    return d;
  }
  /** Marca campos obrigatórios vazios; devolve true se tudo certo */
  function validar(raizEl, obrigatorios) {
    raizEl.querySelectorAll(".campo .erro").forEach((e) => e.remove());
    const d = lerForm(raizEl);
    let ok = true, primeiro = null;
    obrigatorios.forEach((nome) => {
      const v = d[nome];
      const vazio = v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length) || v === false;
      if (!vazio) return;
      ok = false;
      const campo = raizEl.querySelector('[data-campo="' + nome + '"]');
      if (campo) { campo.insertAdjacentHTML("beforeend", '<div class="erro">Campo obrigatório.</div>'); primeiro = primeiro || campo; }
    });
    if (primeiro) primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
    return ok;
  }

  /* ---------------- painel lateral (formulários) ---------------- */
  function abrirPainel(o) {
    fecharPainel();
    const el = document.getElementById("painel");
    el.innerHTML = '<div class="fundo-painel" data-acao="fechar-painel"></div>' +
      '<aside class="painel-lateral' + (o.largo ? " largo" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(o.titulo) + '">' +
      '<div class="topo"><div><div class="t">' + esc(o.titulo) + "</div>" + (o.sub ? '<div class="s">' + o.sub + "</div>" : "") + "</div>" +
      '<button type="button" data-acao="fechar-painel" aria-label="Fechar">' + icone("fechar", 20) + "</button></div>" +
      '<div class="corpo" id="painel-corpo">' + o.corpo + "</div>" +
      (o.rodape ? '<div class="rodape" id="painel-rodape">' + o.rodape + '<div class="erro-envio"></div></div>' : "") + "</aside>";
    const primeiro = el.querySelector(".corpo input:not([type=hidden]):not([disabled]), .corpo textarea, .corpo select");
    if (primeiro) setTimeout(() => primeiro.focus(), 50);
    if (o.aoAbrir) o.aoAbrir(el);
  }
  function fecharPainel(forcar) {
    const el = document.getElementById("painel");
    if (!el || !el.innerHTML) return true;
    if (!forcar && painelSujo()) {
      if (!window.confirm("Fechar sem salvar o que você digitou?")) return false;
    }
    el.innerHTML = "";
    return true;
  }
  function painelSujo() {
    const corpo = document.getElementById("painel-corpo");
    if (!corpo || corpo.dataset.limpo === "1") return false;
    let sujo = false;
    corpo.querySelectorAll("textarea, input[type=text]").forEach((x) => { if (x.value !== x.defaultValue) sujo = true; });
    return sujo;
  }
  function erroNoPainel(texto) {
    const el = document.querySelector("#painel-rodape .erro-envio");
    if (el) el.innerHTML = '<div class="aviso-erro"><b>Não foi salvo.</b> ' + esc(texto) + "</div>";
  }

  /* ---------------- aviso rápido ---------------- */
  let timerToast = null;
  function avisar(texto, tipo) {
    const el = document.getElementById("toast");
    el.innerHTML = '<div class="toast ' + (tipo === "erro" ? "erro" : "") + '" role="status">' + esc(texto) + "</div>";
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { el.innerHTML = ""; }, tipo === "erro" ? 7000 : 3500);
  }

  /* ---------------- gravação ---------------- */
  /** Atualiza o registro no contexto, reindexa e redesenha. */
  function aplicarNoContexto(chave, item) {
    const lista = estado.ctx.registros[chave] = estado.ctx.registros[chave] || [];
    const i = lista.findIndex((x) => x.id === item.id);
    if (i >= 0) lista[i] = item; else lista.push(item);
    dom.indexar(estado.ctx);
  }
  /** Executa uma sequência de gravações. botao: elemento a desabilitar enquanto grava. */
  async function salvar(botao, tarefa, opcoes) {
    const o = opcoes || {};
    if (estado.ocupado) return null;
    estado.ocupado = true;
    const rotuloOriginal = botao ? botao.innerHTML : "";
    if (botao) { botao.disabled = true; botao.textContent = o.rotuloOcupado || "Salvando..."; }
    try {
      const r = await tarefa();
      if (o.fechar !== false) fecharPainel(true);
      if (o.mensagem) avisar(o.mensagem);
      render();
      return r || true;
    } catch (e) {
      const msg = estado.repo.mensagemErro(e);
      console.error(e);
      if (document.querySelector("#painel-rodape")) erroNoPainel(msg); else avisar("Não foi salvo: " + msg, "erro");
      return null;
    } finally {
      estado.ocupado = false;
      if (botao && document.body.contains(botao)) { botao.disabled = false; botao.innerHTML = rotuloOriginal; }
    }
  }
  async function criar(chave, dados) { const it = await estado.repo.criar(chave, dados); aplicarNoContexto(chave, it); return it; }
  async function atualizar(chave, id, dados) { const it = await estado.repo.atualizar(chave, id, dados); aplicarNoContexto(chave, it); return it; }
  /** Texto do adendo: data, autor e justificativa automáticos (4.1) */
  function novoAdendo(atual, justificativa, texto) {
    const agora = new Date();
    const carimbo = calc.fmtDataAno(estado.ctx.hoje) + " " + String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0") + " · " + estado.eu.nome;
    return (atual ? atual + "\n\n" : "") + "[" + carimbo + "]\nJustificativa: " + justificativa.trim() + "\n" + texto.trim();
  }
  function agoraISO() { return new Date().toISOString(); }

  /* ---------------- rotas ---------------- */
  function lerRota() {
    const h = (location.hash || "#/inicio").replace(/^#\/?/, "");
    const partes = h.split("/").filter(Boolean).map(decodeURIComponent);
    return { nome: partes[0] || "inicio", partes: partes.slice(1) };
  }
  function navegar(rota) { if (location.hash === rota) render(); else location.hash = rota; }

  /* ---------------- layout ---------------- */
  function menu() {
    const r = estado.rota.nome;
    const item = (rota, ic, rotulo, contador) => '<a href="#/' + rota + '" class="' + (r === rota ? "ativo" : "") + '">' + icone(ic, 17) + "<span>" + rotulo + "</span>" +
      (contador ? '<span class="contador" title="Pendências atrasadas">' + contador + "</span>" : "") + "</a>";
    if (estado.visao === "ceo") return item("inicio", "inicio", "Início") + item("painel", "painel", "Painel geral");
    const atrasadas = dom.pendenciasDe(estado.ctx, minhaEquipe(), { uid: estado.eu.id }).filter((p) => p.atrasado).length;
    const links = (estado.config && estado.config.links) || {};
    let h = item("inicio", "inicio", "Início") + item("painel", "painel", "Painel", atrasadas) + item("equipe", "equipe", "Minha equipe") + item("agenda", "agenda", "Agenda da equipe") +
      '<div class="grupo">Módulos</div>' + item("recrutamento", "recrutamento", "Recrutamento") + item("onboarding", "onboarding", "Onboarding") +
      item("rotinas", "rotinas", "Rotinas") + item("desempenho", "desempenho", "Desempenho") + item("offboarding", "offboarding", "Offboarding") +
      '<div class="grupo">Para consultar</div>' +
      (links.manual ? '<a href="' + esc(links.manual) + '" target="_blank" rel="noopener">' + icone("manual", 17) + "<span>Manual da liderança</span></a>" : "") +
      item("perfil", "perfil", "Perfil");
    if (estado.eu.admin) h += item("config", "config", "Configuração");
    return h;
  }
  function layout(conteudo) {
    const demo = estado.repo.modo === "demo";
    const seletor = estado.visoes.length > 1 ? '<label>Ver como<select data-mudar="trocar-visao">' + estado.visoes.map((v) =>
      '<option value="' + v + '"' + (v === estado.visao ? " selected" : "") + ">" + VISOES[v] + "</option>").join("") + "</select></label>" : (VISOES[estado.visao] || "");
    return '<div class="gp"><aside class="lateral"><div class="marca">' +
      (GP.marca && GP.marca.logoBranco ? '<img src="' + GP.marca.logoBranco + '" alt="Amorim">' : "") +
      '<div class="app">Gestão de Pessoas</div></div><nav class="nav" aria-label="Menu">' + menu() + "</nav>" +
      '<div class="rodape">' + c.pessoa({ nome: estado.eu.nome, foto: estado.eu.foto }, "", 26).replace('class="nome"', 'class="nome" style="color:#fff"') +
      '<div style="margin-top:8px">' + seletor + "</div></div></aside>" +
      '<main class="principal">' + (demo ? faixaDemo() : "") + avisoEstrutura() + '<div class="conteudo">' + conteudo + "</div></main></div>";
  }
  function faixaDemo() {
    const papel = new URLSearchParams(location.search).get("papel") || "lideranca";
    return '<div class="faixa-demo nao-imprimir"><b>Demonstração</b> com os 6 casos do protótipo, hoje = ' + calc.fmtDataAno(estado.ctx.hoje) +
      '. Nada é gravado. <label>Entrar como <select data-mudar="demo-papel">' +
      [["lideranca", "Carla (liderança)"], ["coordenacao", "Livia (coordenação)"], ["rh", "Helena (RH)"], ["ceo", "Beatriz (CEO)"]].map((p) =>
        '<option value="' + p[0] + '"' + (p[0] === papel ? " selected" : "") + ">" + p[1] + "</option>").join("") + "</select></label></div>";
  }
  function avisoEstrutura() {
    const e = estado.estrutura;
    if (!e || estado.repo.modo === "demo") return "";
    if (e.origem === "ausente") {
      return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>O app ainda não foi configurado no Bitrix.</b> ' +
        (estado.eu.admin ? 'Abra <a href="#/config">Configuração</a> e crie a estrutura (processos inteligentes, estágios e campos).' : "Avise o TI: falta criar a estrutura do app no Bitrix.") + "</div></div>";
    }
    if (e.ausentes && e.ausentes.length && estado.eu.admin) {
      return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>' + e.ausentes.length + " campo(s) do app não existem no Bitrix.</b> " +
        'Rode a configuração de novo em <a href="#/config">Configuração</a>. Faltam: <code>' + esc(e.ausentes.slice(0, 6).join(", ")) + (e.ausentes.length > 6 ? "…" : "") + "</code></div></div>";
    }
    return "";
  }

  function render() {
    const app = document.getElementById("app");
    if (estado.carregando) { app.innerHTML = '<div class="carregando"><div class="spinner"></div>Carregando o Gestão de Pessoas…</div>'; return; }
    if (estado.erro) {
      app.innerHTML = '<div class="conteudo"><div class="card"><h3>Não foi possível abrir o app</h3><div class="aviso-erro">' + esc(estado.erro) +
        '</div><p class="muted">Recarregue a página. Se o erro continuar, mostre esta mensagem ao TI.</p></div></div>';
      return;
    }
    if (estado.semAcesso) {
      app.innerHTML = '<div class="conteudo"><div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">Gestão de Pessoas</h3>' +
        '<p class="muted">Este app é usado pelas lideranças, coordenações e pelo RH para as rotinas de gestão das equipes. Seu usuário não chefia um departamento no Bitrix nem tem um papel no app.</p>' +
        '<p class="muted">Se você lidera uma equipe, peça ao RH para atualizar a estrutura da empresa no Bitrix.</p></div></div>';
      return;
    }
    estado.rota = lerRota();
    if (estado.visao === "ceo" && ["inicio", "painel"].indexOf(estado.rota.nome) < 0) estado.rota = { nome: "painel", partes: [] };
    const fn = rotas[estado.rota.nome] || rotas.inicio;
    let html;
    try { html = fn(estado.rota.partes); } catch (e) {
      console.error(e);
      html = '<div class="aviso-erro">Erro ao montar esta tela: ' + esc(e.message) + "</div>";
    }
    const rolagem = window.scrollY;
    app.innerHTML = layout(html);
    if (estado.manterRolagem) window.scrollTo(0, rolagem);
    estado.manterRolagem = false;
    if (estado.tourPasso !== null && GP.ui.renderTour) GP.ui.renderTour();
    try { if (estado.repo.modo === "bitrix" && window.BX24 && BX24.fitWindow) BX24.fitWindow(); } catch (e) { /* fora do Bitrix */ }
  }

  /* ---------------- eventos ---------------- */
  document.addEventListener("click", function (ev) {
    const el = ev.target.closest("[data-acao], [data-rota]");
    if (!el) return;
    if (el.dataset.acao) {
      const fn = acoes[el.dataset.acao];
      if (fn) { ev.preventDefault(); fn(el, ev); }
      return;
    }
    if (el.dataset.rota && !ev.target.closest("a, button")) { navegar(el.dataset.rota); }
  });
  document.addEventListener("change", function (ev) {
    const el = ev.target.closest("[data-mudar]");
    if (el && acoes[el.dataset.mudar]) acoes[el.dataset.mudar](el, ev);
  });
  document.addEventListener("input", function (ev) {
    const el = ev.target;
    if (!el.dataset || !el.dataset.filtro) return;
    estado.filtros[el.dataset.filtro] = el.value;
    estado.manterRolagem = true;
    render();
    const novo = document.querySelector('[data-filtro="' + el.dataset.filtro + '"]');
    if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && document.getElementById("painel").innerHTML) fecharPainel(); });
  window.addEventListener("hashchange", function () {
    if (document.getElementById("painel").innerHTML && !fecharPainel()) return;
    window.scrollTo(0, 0);
    render();
  });
  window.addEventListener("beforeunload", function (ev) { if (painelSujo()) { ev.preventDefault(); ev.returnValue = ""; } });

  acoes["fechar-painel"] = function () { fecharPainel(); };
  acoes["trocar-visao"] = function (el) { estado.visao = el.value; try { localStorage.setItem("gp_visao_" + estado.eu.id, el.value); } catch (e) { /* sem storage */ } navegar("#/inicio"); };
  acoes["demo-papel"] = function (el) {
    const u = new URL(location.href);
    u.searchParams.set("papel", el.value);
    u.hash = "#/inicio";
    location.href = u.toString();
  };

  GP.ui = {
    estado, rotas, acoes, c, render, navegar, abrirPainel, fecharPainel, erroNoPainel, avisar, lerForm, validar,
    salvar, criar, atualizar, aplicarNoContexto, novoAdendo, agoraISO, visoesDisponiveis, membrosDaVisao, minhaEquipe, podeVerConteudo, VISOES,
  };
})(window);
