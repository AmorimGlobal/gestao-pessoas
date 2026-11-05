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

  /* ---------------- tema claro/escuro e logo ---------------- */
  // O <head> (src/index.html) já aplicou o tema antes do primeiro desenho. Começa no claro, como o Bitrix em
  // volta (não segue o sistema: um Windows escuro com o Bitrix claro deixaria o app destoando); o botão ao
  // lado da logo troca e a escolha fica salva em gp_tema.
  let tema = "claro";
  try { if (localStorage.getItem("gp_tema") === "escuro") tema = "escuro"; } catch (e) { /* sem storage */ }
  function aplicarTema() { document.documentElement.setAttribute("data-tema", tema); }
  aplicarTema();
  // Impressão sempre no claro: no escuro, o texto claro sumiria no papel
  window.addEventListener("beforeprint", () => document.documentElement.setAttribute("data-tema", "claro"));
  window.addEventListener("afterprint", aplicarTema);
  acoes["trocar-tema"] = function () {
    tema = tema === "escuro" ? "claro" : "escuro";
    try { localStorage.setItem("gp_tema", tema); } catch (e) { /* sem storage: vale até recarregar */ }
    aplicarTema();
  };
  // A logo branca vira máscara (.logo no CSS), então a cor vem do tema. Fica no :root uma vez, e não a cada render.
  if (GP.marca && GP.marca.logoBranco) document.documentElement.style.setProperty("--logo", 'url("' + GP.marca.logoBranco + '")');

  /* ---------------- escopo pela visão ---------------- */
  const VISOES = {
    lideranca: "Liderança", coordenacao: "Coordenação", rh: "RH", ceo: "CEO", membro: "Membro",
  };
  // Quem não lidera ninguém entra como membro (04/11/2026): só Férias e ausências e o Perfil
  const ROTAS_MEMBRO = ["ferias", "perfil", "config"];
  function visoesDisponiveis(p) {
    const v = [];
    if (p.coordenacao) v.push("coordenacao");
    if (p.rh) v.push("rh");
    if (p.lideranca && !p.coordenacao) v.push("lideranca");
    if (p.ceo) v.push("ceo");
    if (!v.length) v.push("membro");
    return v;
  }
  /** Membros que a visão atual enxerga */
  function membrosDaVisao() {
    const ctx = estado.ctx, uid = estado.eu.id;
    if (estado.visao === "membro") return [];
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
  /** Linha de cima do título: hoje por extenso ("sexta-feira, 30 de outubro de 2026"), o "hoje" da demonstração inclusive */
  c.sobre = function () {
    return '<div class="sobre">' + esc(calc.fmtDataLonga(estado.ctx ? estado.ctx.hoje : calc.hojeISO())) + "</div>";
  };
  /** Quadro de números: [{ valor, rotulo, tom: azul|ambar|roxo|vermelho|verde|cinza, rota?, nota? }].
      O número e o rótulo saem na cor do tom; zero fica esmaecido e "sem dado" vira "—". */
  c.kpis = function (lista) {
    return '<div class="kpis">' + lista.map((k) => {
      const v = k.valor === null || k.valor === undefined || k.valor === "" ? "—" : String(k.valor);
      const jeito = v === "—" ? " vazio" : v === "0" ? " zero" : v.length > 7 ? " longo" : "";
      const corpo = '<div class="n num' + jeito + '">' + esc(v) + '</div><div class="r">' + esc(k.rotulo) + "</div>" + (k.nota ? '<div class="nota">' + k.nota + "</div>" : "");
      const cls = "kpi " + (k.tom || "azul");
      return k.rota ? '<a class="' + cls + '" href="' + esc(k.rota) + '">' + corpo + "</a>" : '<div class="' + cls + '">' + corpo + "</div>";
    }).join("") + "</div>";
  };
  /** Topo das telas dos módulos. O ícone do módulo (ic) fica só no menu desde o visual de 30/10/2026. */
  c.cabecalho = function (ic, titulo, numeros, acoesHtml) {
    return '<header class="topo-tela"><div class="texto">' + c.sobre() + '<h1 class="titulo-pagina">' + esc(titulo) + "</h1>" +
      (numeros ? '<div class="linha-numeros">' + numeros + "</div>" : "") + "</div>" + (acoesHtml ? '<div class="acoes">' + acoesHtml + "</div>" : "") + "</header>";
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
      '<div class="principal-item"><div class="t">' + esc(p.titulo) + '</div><div class="d">' + esc(p.tipo) + (p.destaque ? " · ligada a plano de melhoria" : "") + "</div></div>" +
      '<div class="lado">' + c.prazo(p.prazo) + "</div></div>";
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
    if (primeiro) setTimeout(() => primeiro.focus({ preventScroll: true }), 50);
    if (o.aoAbrir) o.aoAbrir(el);
    if (noBitrix()) { try { BX24.scrollParentWindow(0); } catch (e) { /* sem SDK */ } ajustarAltura(); }
  }
  function fecharPainel(forcar) {
    const el = document.getElementById("painel");
    if (!el || !el.innerHTML) return true;
    if (!forcar && painelSujo()) {
      if (!window.confirm("Fechar sem salvar o que você digitou?")) return false;
    }
    el.innerHTML = "";
    ajustarAltura();
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
    if (noBitrix()) document.documentElement.style.setProperty("--toast-top", Math.max(16, ultimoClique - 70) + "px");
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
  /** Exclui no Bitrix (lixeira do CRM) e tira do contexto */
  async function excluir(chave, id) {
    await estado.repo.excluir(chave, id);
    const lista = estado.ctx.registros[chave] || [];
    const i = lista.findIndex((x) => x.id === String(id));
    if (i >= 0) lista.splice(i, 1);
    dom.indexar(estado.ctx);
  }

  /* ---------------- excluir (pedido de 29/10/2026) ---------------- */
  /** Botão "Excluir" de um registro, só para quem pode (dom.podeExcluir). o = { volta: rota depois de excluir, descricao } */
  c.botaoExcluir = function (chave, item, o) {
    if (!item || !estado.ctx || !dom.podeExcluir(estado.ctx, chave, item, estado.eu.id, agoraISO())) return "";
    const op = o || {};
    return '<button type="button" class="btn link excluir nao-imprimir" data-acao="excluir-registro" data-chave="' + esc(chave) + '" data-id="' + esc(item.id) + '"' +
      (op.volta ? ' data-volta="' + esc(op.volta) + '"' : "") + (op.descricao ? ' data-descricao="' + esc(op.descricao) + '"' : "") + ">" + icone("lixeira", 14) + " " + esc(op.rotulo || "Excluir") + "</button>";
  };
  acoes["excluir-registro"] = function (el) {
    const chave = el.dataset.chave, id = el.dataset.id;
    const item = estado.ctx.idx.porId[chave] && estado.ctx.idx.porId[chave][id];
    if (!item) return;
    if (!dom.podeExcluir(estado.ctx, chave, item, estado.eu.id, agoraISO())) { avisar("Você não pode excluir este registro.", "erro"); return; }
    const desc = el.dataset.descricao || item.titulo || "este registro";
    if (!window.confirm("Excluir " + desc + "?\n\nO item vai para a lixeira do CRM do Bitrix, de onde um administrador consegue restaurar. O card do membro guarda quem excluiu e quando.")) return;
    const membroId = item.membroId;
    salvar(el, async () => {
      await excluir(chave, id);
      // o rastro fica no histórico do item do Membros, sem o conteúdo do registro
      if (membroId && estado.ctx.idx.membro[membroId]) {
        const quem = estado.eu.nome + (estado.verComo && estado.euReal ? " (registrado por " + estado.euReal.nome + ")" : "");
        try { await estado.repo.comentar("membros", membroId, "Excluído no app Gestão de Pessoas: " + desc + ". Por " + quem + " em " + calc.fmtDataAno(estado.ctx.hoje) + "."); } catch (e) { /* o comentário não impede a exclusão */ }
      }
      if (el.dataset.volta) navegar(el.dataset.volta);
    }, { mensagem: "Excluído. O item está na lixeira do CRM." });
  };
  /** Texto do adendo: data, autor e justificativa automáticos (4.1) */
  function novoAdendo(atual, justificativa, texto) {
    const agora = new Date();
    const carimbo = calc.fmtDataAno(estado.ctx.hoje) + " " + String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0") + " · " + estado.eu.nome +
      (estado.verComo && estado.euReal ? " (registrado por " + estado.euReal.nome + ")" : "");
    return (atual ? atual + "\n\n" : "") + "[" + carimbo + "]\nJustificativa: " + justificativa.trim() + "\n" + texto.trim();
  }
  /** Agora, para o prazo de 48 horas. Na demonstração, o dia é o "hoje" dela (08/10/2026), como as datas
      que o repositório de demonstração grava: senão nada criado ali seria editável. */
  function agoraISO() {
    if (estado.repo && estado.repo.modo === "demo" && estado.ctx) return estado.ctx.hoje + "T" + new Date().toTimeString().slice(0, 8) + "-03:00";
    return new Date().toISOString();
  }

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
    const item = (rota, ic, rotulo, contador, dica) => '<a href="#/' + rota + '" class="' + (r === rota ? "ativo" : "") + '">' + icone(ic, 17) + "<span>" + rotulo + "</span>" +
      (contador ? '<span class="contador' + (dica ? " novo" : "") + '" title="' + esc(dica || "Pendências atrasadas") + '">' + contador + "</span>" : "") + "</a>";
    if (estado.visao === "ceo") return item("inicio", "inicio", "Início") + item("painel", "painel", "Painel geral");
    // Férias e ausências: sem contador, porque o pedido e a decisão ficam no e-mail (04/11/2026)
    const itemFerias = item("ferias", "ferias", "Férias e ausências");
    if (estado.visao === "membro") return itemFerias + item("perfil", "perfil", "Perfil") + (estado.eu.admin ? item("config", "config", "Configuração") : "");
    const atrasadas = dom.pendenciasDe(estado.ctx, minhaEquipe(), { uid: estado.eu.id }).filter((p) => p.atrasado).length;
    const links = (estado.config && estado.config.links) || {};
    // Alerta vermelho nos módulos em que o RH recebe demandas novas (reunião de 29/10/2026)
    const dem = estado.visao === "rh" ? dom.demandasRH(estado.ctx) : {};
    const novas = "Solicitações novas aguardando o RH";
    let h = item("inicio", "inicio", "Início") + item("painel", "painel", "Painel", atrasadas) + item("equipe", "equipe", "Minha equipe") + item("agenda", "agenda", "Agenda da equipe") +
      '<div class="grupo">Módulos</div>' + item("recrutamento", "recrutamento", "Recrutamento", dem.recrutamento, novas) + item("onboarding", "onboarding", "Onboarding") +
      item("rotinas", "rotinas", "Feedbacks") + (dom.DESEMPENHO_ATIVO ? item("desempenho", "desempenho", "Desempenho") : "") + item("offboarding", "offboarding", "Offboarding", dem.offboarding, novas) +
      itemFerias +
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
    const nNotif = estado.visao === "ceo" ? 0 : notificacoes().filter((n) => n.nova).length;
    return '<div class="gp"><aside class="lateral"><div class="marca">' +
      (GP.marca && GP.marca.logoBranco ? '<span class="logo" role="img" aria-label="Amorim"></span>' : "<b>Amorim</b>") +
      '<button type="button" class="tema" data-acao="trocar-tema" title="Modo claro ou escuro" aria-label="Alternar entre o modo claro e o escuro">' +
      icone("lua", 16, "so-claro") + icone("sol", 16, "so-escuro") + "</button>" +
      // o sino fica na linha do nome do app, à direita
      '<div class="app">Gestão de Pessoas</div>' +
      (estado.visao === "ceo" ? "" : '<button type="button" class="tema sino" data-acao="abrir-notificacoes" title="Notificações" aria-label="Notificações' + (nNotif ? ": " + nNotif + " novas" : "") + '">' + icone("sino", 16) +
        (nNotif ? '<span class="bolha">' + (nNotif > 9 ? "9+" : nNotif) + "</span>" : "") + "</button>") +
      '</div><nav class="nav" aria-label="Menu">' + menu() + "</nav>" +
      '<div class="rodape">' + c.pessoa({ nome: estado.eu.nome, foto: estado.eu.foto }, "", 26) +
      '<div style="margin-top:8px">' + seletor + "</div>" +
      (podeVerComo() ? '<button class="btn peq sec" style="margin-top:10px;width:100%" data-acao="abrir-ver-como">' + icone("equipe", 13) + " Ver como outra pessoa</button>" : "") +
      "</div></aside>" +
      '<main class="principal">' + faixaVerComo() + (demo ? faixaDemo() : "") + avisoEstrutura() + avisoAcesso() + '<div class="conteudo">' + conteudo + "</div></main></div>";
  }
  /** RH e administrador: avisa quando a função de acesso do CRM esconde registros do app. Sem isto, uma
      equipe vazia em "Ver como" parece defeito do app (o caso do RH em 28/10/2026). Compara o que o
      login leu com o total do processo no servidor (api/contagem.js) e com os processos negados. */
  function avisoAcesso() {
    if (!podeVerComo() || !estado.repo || estado.repo.modo === "demo" || !estado.ctx) return "";
    const negados = estado.acessoNegado || [];
    const total = estado.contagem || {};
    const faltas = [];
    GP.schema.PROCESSOS.forEach((p) => {
      if (negados.indexOf(p.chave) >= 0) { faltas.push(p.nome + ": sem leitura"); return; }
      const vistos = (estado.ctx.registros[p.chave] || []).length;
      if (typeof total[p.chave] === "number" && total[p.chave] > vistos) faltas.push(p.nome + ": " + vistos + " de " + total[p.chave]);
    });
    if (!faltas.length) return "";
    return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>O Bitrix não deixa o seu usuário ler todos os registros do app</b> (' + esc(faltas.join(" · ")) + "). " +
      "Por isso equipes, membros e registros podem aparecer vazios, inclusive em \"Ver como\". Um administrador do Bitrix resolve em CRM → Configurações → Permissões de acesso: a função do RH precisa de \"Todos\" em Ler e em Editar nos processos \"Gestão de Pessoas · …\". Depois, recarregue o app.</div></div>";
  }
  /* ---------------- notificações (54-notificacoes.js, 04/11/2026) ---------------- */
  /** As notificações de quem está na tela. O "lido" é da pessoa real: em "Ver como" ele não muda. */
  function notificacoes() {
    if (!estado.ctx || !GP.notificacoes || !estado.eu) return [];
    try { return GP.notificacoes.notificacoesDe(estado.ctx, estado.eu.id, { visto: estado.notifVisto || "" }); } catch (e) { console.warn("Notificações:", e); return []; }
  }
  function quandoFoi(v) {
    const d = String(v || "").slice(0, 10);
    if (!calc.dataValida(d) || !estado.ctx) return "";
    const n = calc.diffDias(d, estado.ctx.hoje);
    return n <= 0 ? "hoje" : n === 1 ? "ontem" : n < 7 ? "há " + n + " dias" : calc.fmtData(d);
  }
  acoes["abrir-notificacoes"] = function () {
    const lista = notificacoes();
    abrirPainel({
      titulo: "Notificações", sub: "Pedidos e registros dos últimos 30 dias para você. Cada um também chega como aviso no Bitrix.",
      corpo: lista.length ? '<div class="lista notificacoes">' + lista.map((n) => '<a class="item notif' + (n.nova ? " nova" : "") + '" href="' + esc(n.rota) + '" data-acao="ir-notificacao">' +
        '<div class="principal-item"><div class="t">' + esc(n.titulo) + '</div><div class="d">' + esc([n.area, quandoFoi(n.quando), n.texto].filter(Boolean).join(" · ")) + "</div></div>" +
        '<div class="lado">' + (n.acao ? c.tag("Pede ação", "ambar") : "") + "</div></a>").join("") + "</div>" : c.vazio("Nada nos últimos 30 dias."),
    });
    // o sino aberto: o que estava nele passa a lido
    estado.notifVisto = new Date().toISOString();
    if (estado.repo && !estado.verComo) estado.repo.gravarPreferencia("gp_notif_visto", estado.notifVisto);
    render();
  };
  acoes["ir-notificacao"] = function (el) { fecharPainel(true); navegar(el.getAttribute("href")); };

  /* ---------------- ver como outra pessoa (administrador ou RH; somente leitura) ---------------- */
  /** Administrador do Bitrix ou quem está em Papéis -> RH (o RH já vê todas as equipes; o modo não grava nada) */
  function podeVerComo() {
    const real = estado.euReal || estado.eu || {};
    return !!(real.admin || (estado.ctx && real.id && dom.papeis(estado.ctx, real.id).rh));
  }
  function faixaVerComo() {
    if (!estado.verComo) return "";
    return '<div class="faixa-demo ver-como nao-imprimir"><b>Vendo como ' + esc(estado.verComo.nome) + "</b> (" + esc(VISOES[estado.visao] || "sem papel no app") +
      "). O que você registrar fica em nome dela; o histórico do Bitrix mostra que foi você. " + '<button class="btn peq" data-acao="sair-ver-como">Voltar para a minha visão</button></div>';
  }
  acoes["abrir-ver-como"] = function () {
    const ctx = estado.ctx;
    const cfg = (estado.config && estado.config.papeis) || {};
    const lista = (l) => (l || []).map((p) => String(p.id));
    const rh = lista(cfg.rh), coord = lista(cfg.coordenacao), ceo = lista(cfg.ceo);
    const chefes = {};
    (ctx.departamentos || []).forEach((d) => { if (d.chefe) chefes[d.chefe] = true; });
    const papel = (id) => [rh.indexOf(id) >= 0 && "RH", coord.indexOf(id) >= 0 && "coordenação", ceo.indexOf(id) >= 0 && "CEO", chefes[id] && "liderança"].filter(Boolean).join(", ");
    const real = (estado.euReal || estado.eu).id;
    const opcoes = (ctx.usuarios || []).filter((u) => u.id !== real && ((u.departamentos || []).length || papel(u.id)) && (!u.tipo || u.tipo === "employee"))
      .sort((a, b) => (!!papel(b.id) - !!papel(a.id)) || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((u) => ({ valor: u.id, rotulo: u.nome + (papel(u.id) ? " · " + papel(u.id) : "") }));
    abrirPainel({
      titulo: "Ver como outra pessoa", sub: "O app abre como a pessoa escolhida, com a equipe, os papéis e as pendências dela, e você pode registrar em nome dela. O histórico do Bitrix mostra que foi você.",
      corpo: '<div id="form-ver-como">' + c.campo({ nome: "uid", rotulo: "Pessoa", tipo: "lista", opcoes, valor: estado.verComo ? estado.verComo.id : "" }) + "</div>",
      rodape: '<button class="btn" data-acao="aplicar-ver-como">Ver como esta pessoa</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  acoes["aplicar-ver-como"] = async function () {
    const f = document.getElementById("form-ver-como");
    if (!validar(f, ["uid"])) return;
    const uid = lerForm(f).uid;
    fecharPainel(true);
    await GP.app.verComo(uid);
  };
  acoes["sair-ver-como"] = async function () { await GP.app.verComo(""); };

  function faixaDemo() {
    const papel = new URLSearchParams(location.search).get("papel") || "lideranca";
    return '<div class="faixa-demo nao-imprimir"><b>Demonstração</b> com os 6 casos do protótipo, hoje = ' + calc.fmtDataAno(estado.ctx.hoje) +
      '. Nada é gravado. <label>Entrar como <select data-mudar="demo-papel">' +
      [["lideranca", "Carla (liderança)"], ["coordenacao", "Livia (coordenação)"], ["rh", "Helena (RH)"], ["ceo", "Beatriz (CEO)"], ["membro", "Ana (membro)"]].map((p) =>
        '<option value="' + p[0] + '"' + (p[0] === papel ? " selected" : "") + ">" + p[1] + "</option>").join("") + "</select></label></div>";
  }
  function avisoEstrutura() {
    const e = estado.estrutura;
    if (!e || estado.repo.modo === "demo") return "";
    if (e.origem === "ausente") {
      return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>O app ainda não foi configurado no Bitrix.</b> ' +
        (estado.eu.admin ? 'Abra <a href="#/config">Configuração</a> e crie a estrutura (processos inteligentes, estágios e campos).' : "Avise o TI: falta criar a estrutura do app no Bitrix.") + "</div></div>";
    }
    const faltaProc = (e.processosFaltando || []).map((k) => GP.schema.processo(k)).filter(Boolean);
    if (faltaProc.length && (estado.eu.admin || podeVerComo())) {
      return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>' + (faltaProc.length === 1 ? "Um processo novo do app ainda não existe" : faltaProc.length + " processos novos do app ainda não existem") + " no Bitrix</b> (" + esc(faltaProc.map((p) => p.nome).join(", ")) + "). " +
        (estado.eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura". Depois, dê à função do RH e às lideranças o acesso a ele no CRM, como nos outros processos.' : "Um administrador do Bitrix precisa abrir Configuração no app e criar a estrutura.") + "</div></div>";
    }
    if (e.ausentes && e.ausentes.length && estado.eu.admin) {
      return '<div class="conteudo" style="padding-bottom:0"><div class="aviso-atencao"><b>' + e.ausentes.length + " campo(s) do app não existem no Bitrix.</b> " +
        'Rode a configuração de novo em <a href="#/config">Configuração</a>. Faltam: <code>' + esc(e.ausentes.slice(0, 6).join(", ")) + (e.ausentes.length > 6 ? "…" : "") + "</code></div></div>";
    }
    return "";
  }

  function render() {
    const app = document.getElementById("app");
    // o símbolo da Amorim pulsando (pedido de 05/11/2026); sem a logo, o círculo girando
    if (estado.carregando) { app.innerHTML = '<div class="carregando">' + (GP.marca && GP.marca.logoBranco ? '<span class="simbolo-carregando" role="img" aria-label="Amorim"></span>' : '<div class="spinner"></div>') + "Carregando o Gestão de Pessoas…</div>"; return; }
    if (estado.erro) {
      app.innerHTML = '<div class="conteudo"><div class="card"><h3>Não foi possível abrir o app</h3><div class="aviso-erro">' + esc(estado.erro) +
        '</div><p class="muted">Recarregue a página. Se o erro continuar, mostre esta mensagem ao TI.</p></div></div>';
      return;
    }
    if (estado.foraDoBitrix) {
      app.innerHTML = '<div class="conteudo"><div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">Acesso só pelo Bitrix24</h3>' +
        '<p class="muted">O Gestão de Pessoas abre só dentro do Bitrix24 da Amorim, com o seu login. Entre no Bitrix e abra o app pelo menu.</p></div></div>';
      return;
    }
    if (estado.semAcesso) {
      app.innerHTML = faixaVerComo() + '<div class="conteudo"><div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">Gestão de Pessoas</h3>' +
        '<p class="muted">Este app é usado pelas lideranças, coordenações e pelo RH para as rotinas de gestão das equipes. Seu usuário não chefia um departamento no Bitrix nem tem um papel no app.</p>' +
        '<p class="muted">Se você lidera uma equipe, peça ao RH para atualizar a estrutura da empresa no Bitrix.</p></div></div>';
      return;
    }
    estado.rota = lerRota();
    if (estado.visao === "ceo" && ["inicio", "painel"].indexOf(estado.rota.nome) < 0) estado.rota = { nome: "painel", partes: [] };
    if (estado.visao === "membro" && ROTAS_MEMBRO.indexOf(estado.rota.nome) < 0) estado.rota = { nome: "ferias", partes: [] };
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
    ajustarAltura();
  }

  /* ---------------- dentro do Bitrix: a altura do app (queixa de 04/11/2026: "o app está muito comprido") ---------------- */
  // O Bitrix mostra o app num iframe que cresce até a altura do conteúdo, e quem rola é a página do Bitrix. Nada aqui
  // pode medir 100vh: a janela nunca encolheria (o BX24.fitWindow só cresce), e o rodapé do menu iria para o fim da
  // página mais longa já aberta. Com data-bitrix no <html>, o CSS deixa o menu na altura dele, e ajustarAltura() mede o
  // conteúdo. O painel lateral ocupa a área visível estimada pela tela, e o aviso rápido aparece perto do último clique.
  //
  // Queixa de 05/11/2026 ("janela de onboarding está mal formatada"): o app não ocupava a largura toda (faixa branca à
  // direita, painel solto no meio) e o painel lateral parava antes do fim da tela.
  // - Largura: o BX24.resizeWindow do SDK converte a largura em número, e o Bitrix fixa o iframe nesses pixels
  //   (bitrix/js/rest/applayout.js: f.style.width = largura + "px"); a largura medida aqui dentro é a do próprio
  //   iframe, então uma vez fixada menor (slider ainda abrindo, janela que cresceu) ela nunca mais crescia. Só o
  //   BX24.fitWindow manda "100%": ele vai primeiro, e a resposta dele traz a largura real, usada no resizeWindow
  //   que acerta a altura medida (o fitWindow sozinho põe a altura do scroll, que nunca encolhe).
  // - Altura do painel: o IntersectionObserver, dentro de um iframe de outro domínio, devolve a parte do iframe que
  //   aparece na janela do navegador (conferido no Edge em 05/11/2026). Uma sonda do tamanho do iframe dá a altura
  //   visível de verdade; a estimativa pela tela fica só até a primeira medida.
  let ultimoClique = 0, agendada = false;
  const noBitrix = () => !!(estado.repo && estado.repo.modo === "bitrix" && window.BX24);
  const telaDisponivel = () => (window.screen && window.screen.availHeight) || 900;
  /** Estimativa da área visível do app (a tela menos o navegador e o topo do Bitrix), até a medida chegar */
  function alturaVisivel() { return Math.max(520, telaDisponivel() - 250); }
  function ajustarAltura() {
    if (!noBitrix() || agendada) return;
    agendada = true;
    requestAnimationFrame(function () {
      agendada = false;
      try {
        const app = document.getElementById("app");
        const sobreposto = !!(document.getElementById("painel").innerHTML || document.getElementById("tour").innerHTML);
        // com o painel aberto, o iframe passa da altura da janela: a medida da sonda recorta o painel no que aparece
        const altura = Math.max(app ? app.offsetHeight : 0, sobreposto ? Math.max(520, telaDisponivel() - 60) : 0, 480);
        const larguraAtual = (BX24.getScrollSize && BX24.getScrollSize().scrollWidth) || document.documentElement.scrollWidth;
        if (BX24.fitWindow) BX24.fitWindow(function (r) { BX24.resizeWindow((r && r.width) || larguraAtual, altura); });
        else BX24.resizeWindow(larguraAtual, altura);
      } catch (e) { /* SDK sem resizeWindow */ }
    });
  }
  /** A altura do iframe que aparece na tela, em --altura-visivel (o painel lateral e o tour usam) */
  function medirAreaVisivel() {
    if (!window.IntersectionObserver || document.getElementById("sonda-visivel")) return;
    const sonda = document.createElement("div");
    sonda.id = "sonda-visivel";
    sonda.setAttribute("aria-hidden", "true");
    sonda.style.cssText = "position:fixed;top:0;left:0;bottom:0;width:1px;visibility:hidden;pointer-events:none";
    document.body.appendChild(sonda);
    const limiares = [];
    for (let i = 0; i <= 100; i++) limiares.push(i / 100);
    const io = new IntersectionObserver(function (entradas) {
      const r = entradas[entradas.length - 1].intersectionRect;
      // fora da tela, ou quase: fica a última medida
      if (r && r.height >= 300) document.documentElement.style.setProperty("--altura-visivel", Math.round(r.height) + "px");
    }, { threshold: limiares });
    io.observe(sonda);
    // o observador só avisa quando a fração visível muda: com o iframe inteiro na tela, ela fica em 100% enquanto a
    // altura muda. Quando o Bitrix redimensiona o iframe, observar de novo traz a medida na hora.
    window.addEventListener("resize", function () { io.unobserve(sonda); io.observe(sonda); });
  }
  function modoBitrix() {
    document.documentElement.setAttribute("data-bitrix", "1");
    document.documentElement.style.setProperty("--altura-visivel", alturaVisivel() + "px");
    medirAreaVisivel();
    // mudou o tamanho do conteúdo (tela nova, pergunta que aparece, detalhe aberto): mede de novo
    if (window.ResizeObserver) new ResizeObserver(ajustarAltura).observe(document.getElementById("app"));
  }

  /* ---------------- eventos ---------------- */
  document.addEventListener("click", function (ev) {
    ultimoClique = ev.pageY || ultimoClique;
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
    estado, rotas, acoes, c, render, podeVerComo, navegar, abrirPainel, fecharPainel, erroNoPainel, avisar, lerForm, validar,
    salvar, criar, atualizar, excluir, aplicarNoContexto, novoAdendo, agoraISO, visoesDisponiveis, membrosDaVisao, minhaEquipe, podeVerConteudo, VISOES,
    notificacoes, modoBitrix, ajustarAltura,
  };
})(window);
