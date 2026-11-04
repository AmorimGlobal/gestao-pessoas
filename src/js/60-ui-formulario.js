/* =====================================================================================
   INTERFACE — formulários de vaga e de encerramento a partir das definições de
   52-formularios.js (04/11/2026)
   -------------------------------------------------------------------------------------
   Seções, perguntas que só aparecem quando se aplicam, escolha única com descrição, várias
   escolhas (com a opção exclusiva "Nenhum desses pontos"), a grade de níveis do risco e o
   bloco que a tela preenche. Cada pergunta tem name = o código do campo (UF_CRM_...).
   enviarCard() cria o card no funil: quem pede fica como responsável enquanto o histórico
   entra na timeline, e depois o card passa para o responsável do funil (o RH).
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc } = GP.util;
  const F = GP.formularios, ui = GP.ui, dom = GP.dominio;

  const idDe = (codigo) => "q-" + String(codigo).replace(/[^A-Za-z0-9_-]/g, "");
  /** "Baixa (Pode aguardar...)" e "Executores — ativos..." viram título e descrição na opção */
  function partesDaOpcao(texto) {
    const m = /^([^()]+?) \((.+)\)$/.exec(texto) || /^(.+?) — (.+)$/.exec(texto);
    return m ? { t: m[1], d: m[2] } : { t: texto, d: "" };
  }

  function campoHtml(c, r, o) {
    const id = idDe(c.codigo), v = r[c.codigo];
    const atrs = ' data-campo="' + esc(c.codigo) + '"' + (F.visivel(c, r) ? "" : " hidden");
    if (c.tipo === "bloco") return '<div class="campo-bloco" id="' + id + '"' + atrs + ">" + ((o.blocos || {})[c.codigo] || "") + "</div>";
    const nome = ' name="' + esc(c.codigo) + '"';
    let entrada;
    if (c.tipo === "textoLongo") entrada = '<textarea class="entrada" id="' + id + '"' + nome + ' rows="' + (c.linhas || 3) + '">' + esc(v || "") + "</textarea>";
    else if (c.tipo === "data") entrada = '<input class="entrada" type="date" id="' + id + '"' + nome + ' value="' + esc(v || "") + '"' + ((o.min || {})[c.codigo] ? ' min="' + esc(o.min[c.codigo]) + '"' : "") + ">";
    else if (c.tipo === "lista") entrada = '<select class="entrada" id="' + id + '"' + nome + '><option value="">Selecione</option>' + ((o.opcoes || {})[c.codigo] || c.opcoes || []).map((op) => {
      const val = typeof op === "object" ? op.valor : op, rot = typeof op === "object" ? op.rotulo : op;
      return '<option value="' + esc(val) + '"' + (String(val) === String(v || "") ? " selected" : "") + ">" + esc(rot) + "</option>";
    }).join("") + "</select>";
    else if (c.tipo === "escolha" || c.tipo === "multi") {
      const tipo = c.tipo === "multi" ? "checkbox" : "radio";
      const marcados = c.tipo === "multi" ? (Array.isArray(v) ? v : []) : [v];
      entrada = '<div class="escolhas' + (c.empilhado ? " empilhadas" : "") + '" role="' + (tipo === "radio" ? "radiogroup" : "group") + '" aria-labelledby="' + id + '-r">' + c.opcoes.map((op) => {
        const p = c.empilhado ? partesDaOpcao(op) : { t: op, d: "" };
        return '<label class="escolha"><input type="' + tipo + '"' + nome + ' value="' + esc(op) + '"' + (marcados.indexOf(op) >= 0 ? " checked" : "") + "><span>" +
          (p.d ? "<b>" + esc(p.t) + '</b><span class="op-d">' + esc(p.d) + "</span>" : esc(p.t)) + "</span></label>";
      }).join("") + "</div>";
    } else if (c.tipo === "arquivo") entrada = '<input class="entrada" type="file" id="' + id + '"' + nome + (c.multiplo ? " multiple" : "") + ">";
    else entrada = '<input class="entrada" type="text" id="' + id + '"' + nome + ' value="' + esc(v || "") + '">';
    const grupo = c.tipo === "escolha" || c.tipo === "multi";
    const rotulo = esc(c.rotulo) + (c.obrigatorio ? "" : ' <span class="opcional">(opcional)</span>');
    return '<div class="campo"' + atrs + ">" + (grupo ? '<div class="rotulo" id="' + id + '-r">' + rotulo + "</div>" : '<label for="' + id + '">' + rotulo + "</label>") +
      (c.ajuda ? '<div class="ajuda">' + esc(c.ajuda) + "</div>" : "") + entrada + "</div>";
  }
  /** Grade de níveis (riscos da vaga): uma linha por pergunta. Linha opcional ganha "limpar", porque rádio marcado não desmarca. */
  function gradeHtml(g, r) {
    return '<div class="campo grade-niveis" data-campo="' + esc(g.codigo) + '"><div class="tabela-wrap"><table class="tabela"><thead><tr><th></th>' +
      g.colunas.map((x) => '<th class="c">' + esc(x) + "</th>").join("") + "<th></th></tr></thead><tbody>" +
      g.linhas.map((l) => '<tr data-campo="' + esc(l.codigo) + '"><td>' + esc(l.rotulo) + (l.obrigatorio ? "" : ' <span class="opcional">(opcional)</span>') + "</td>" +
        g.colunas.map((x) => '<td class="c"><input type="radio" name="' + esc(l.codigo) + '" value="' + esc(x) + '"' + (r[l.codigo] === x ? " checked" : "") + ' aria-label="' + esc(l.rotulo + ": " + x) + '"></td>').join("") +
        '<td class="c">' + (l.obrigatorio ? "" : '<button type="button" class="btn link peq" data-limpar="' + esc(l.codigo) + '">limpar</button>') + "</td></tr>").join("") +
      "</tbody></table></div></div>";
  }
  /** O formulário inteiro. r = respostas iniciais; o = { opcoes: {codigo: [{valor, rotulo}]}, min: {codigo: data}, blocos: {codigo: html} } */
  function html(def, r, o) {
    const resp = r || {}, op = o || {};
    return def.secoes.map((s) => '<div class="grupo-form"><div class="rotulo-grupo">' + esc(s.titulo) + "</div>" + (s.texto ? '<p class="texto-secao">' + esc(s.texto) + "</p>" : "") +
      s.campos.map((c) => (c.tipo === "grade" ? gradeHtml(c, resp) : campoHtml(c, resp, op))).join("") + "</div>").join("");
  }

  /** Lê as respostas pelo name de cada pergunta */
  function ler(el, def) {
    const r = {};
    F.campos(def).forEach((c) => {
      if (c.tipo === "bloco") return;
      const nos = Array.prototype.slice.call(el.querySelectorAll('[name="' + c.codigo + '"]'));
      if (c.tipo === "escolha") { const x = nos.find((n) => n.checked); r[c.codigo] = x ? x.value : ""; }
      else if (c.tipo === "multi") r[c.codigo] = nos.filter((n) => n.checked).map((n) => n.value);
      else if (c.tipo === "arquivo") r[c.codigo] = nos[0] ? Array.prototype.slice.call(nos[0].files || []) : [];
      else r[c.codigo] = nos[0] ? nos[0].value : "";
    });
    return r;
  }
  /** Mostra e esconde as perguntas condicionais; devolve as respostas */
  function aplicar(el, def) {
    const r = ler(el, def);
    F.campos(def).forEach((c) => {
      if (!c.se) return;
      const no = el.querySelector('[data-campo="' + c.codigo + '"]');
      if (no) no.hidden = !F.visivel(c, r);
    });
    return r;
  }
  /** Marca as obrigatórias sem resposta (só as que aparecem) e as de "extras" (códigos que a tela reprova) */
  function validar(el, def, r, extras) {
    el.querySelectorAll(".erro").forEach((x) => x.remove());
    el.querySelectorAll("tr.falta").forEach((x) => x.classList.remove("falta"));
    const faltam = F.faltando(def, r).concat(extras || []);
    let primeiro = null;
    faltam.forEach((cod) => {
      const no = el.querySelector('[data-campo="' + cod + '"]');
      if (!no) return;
      if (no.tagName === "TR") {
        no.classList.add("falta");
        const g = no.closest(".grade-niveis");
        if (g && !g.querySelector(".erro")) g.insertAdjacentHTML("beforeend", '<div class="erro">Marque um nível em cada linha obrigatória.</div>');
        primeiro = primeiro || g;
      } else {
        no.insertAdjacentHTML("beforeend", '<div class="erro">Campo obrigatório.</div>');
        primeiro = primeiro || no;
      }
    });
    if (primeiro) primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
    return !faltam.length;
  }
  /** Liga as perguntas condicionais, a opção exclusiva e o "limpar" da grade. aoMudar(r, evento) roda a cada mudança. */
  function ligar(el, def, aoMudar) {
    const lista = F.campos(def);
    const atualizar = function (ev) {
      const alvo = ev && ev.target;
      if (alvo && alvo.type === "checkbox" && alvo.checked) {
        const c = lista.find((x) => x.codigo === alvo.name);
        if (c && c.exclusivo) el.querySelectorAll('[name="' + c.codigo + '"]').forEach((n) => { if (n !== alvo && (alvo.value === c.exclusivo || n.value === c.exclusivo)) n.checked = false; });
      }
      const r = aplicar(el, def);
      if (aoMudar) aoMudar(r, ev);
    };
    el.addEventListener("change", atualizar);
    el.addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-limpar]");
      if (!b) return;
      ev.preventDefault();
      el.querySelectorAll('[name="' + b.dataset.limpar + '"]').forEach((n) => { n.checked = false; });
      atualizar();
    });
    atualizar();
  }

  /* ---------------- o card no funil ---------------- */
  /** Quem fica com os cards novos de um funil (Configuração → Parâmetros); sem escolha, a primeira pessoa do RH */
  function responsavelDoFunil(chave) {
    const cfg = ui.estado.config || {};
    if ((cfg[chave] || {}).responsavel) return String(cfg[chave].responsavel);
    const rh = ((cfg.papeis || {}).rh || [])[0];
    return rh ? String(rh.id) : "";
  }
  /** Recusa do Bitrix por permissão vira a instrução do que liberar no funil */
  function erroDoFunil(e, nomeFunil) {
    const semPermissao = e && (e.codigo === "ACCESS_DENIED" || /access denied|not allowed|permission|acesso negado|permiss/i.test(String(e.descricao || e.message || "")));
    if (!semPermissao) return e;
    return { codigo: e.codigo || "ACCESS_DENIED", descricao: "o Bitrix não deixou o seu usuário criar o card no funil " + nomeFunil + ". Um administrador libera em CRM → Configurações → Permissões de acesso: na função de quem pede, em Negócios → " + nomeFunil + ", \"Ler\", \"Adicionar\" e \"Editar\" com pelo menos \"Próprios\"" };
  }
  /** Cria o card com quem pede como responsável, grava os comentários na timeline e passa o card ao responsável do funil.
      Assim quem pede só precisa de "Adicionar" e "Editar: próprios" no funil, e deixa de ver o card quando ele passa ao RH.
      o = { categoria, titulo, campos, origem, restrito, comentarios, responsavel, nomeFunil }.
      Devolve { id, estagio, avisos }: o que não deu certo depois de o card existir vai em avisos, sem desfazer o envio. */
  async function enviarCard(o) {
    const E = ui.estado;
    let neg;
    try {
      neg = await E.repo.criarNegocio({ categoria: o.categoria, titulo: o.titulo, responsavel: E.eu.id, campos: o.campos, origem: o.origem, restrito: o.restrito, observadores: [E.eu.id] });
    } catch (e) { throw erroDoFunil(e, o.nomeFunil); }
    const avisos = [];
    for (const texto of o.comentarios || []) {
      try { await E.repo.comentarNegocio(neg.id, texto); } catch (e) { avisos.push("o histórico não entrou na timeline do card (" + E.repo.mensagemErro(e) + ")"); break; }
    }
    if (o.responsavel && String(o.responsavel) !== String(E.eu.id)) {
      try { await E.repo.passarNegocio(neg.id, o.responsavel); } catch (e) { avisos.push("o card ficou com você como responsável, e não com " + dom.pessoa(E.ctx, o.responsavel).nome + " (" + E.repo.mensagemErro(e) + ")"); }
    }
    return Object.assign({ avisos, link: E.repo.linkNegocio ? E.repo.linkNegocio(neg.id) : "" }, neg);
  }
  /** Depois de enviar: o link do card na pipe, para quem pediu acompanhar (pedido de 04/11/2026). O mesmo link vai no aviso do
      Bitrix para quem pediu, para o RH e para a coordenação. o = { titulo, texto, neg, nomeFunil } */
  function mostrarEnviado(o) {
    const neg = o.neg;
    ui.abrirPainel({
      titulo: o.titulo, sub: esc(o.texto),
      corpo: '<div id="enviado">' + (neg.avisos.length ? '<div class="aviso-atencao" style="margin-bottom:14px"><b>Atenção:</b> ' + esc(neg.avisos.join("; ")) + ".</div>" : "") +
        '<div class="campo"><label for="link-card">Link do card na pipe ' + esc(o.nomeFunil) + '</label><input class="entrada" id="link-card" readonly value="' + esc(neg.link) + '"></div>' +
        '<p class="muted" style="font-size:12.5px">Você entra entre os observadores do card e acompanha cada etapa por ele. O link também está nas suas notificações do Bitrix.</p></div>',
      rodape: '<button class="btn" data-acao="abrir-negocio" data-id="' + esc(neg.id) + '">Abrir o card na pipe</button><button class="btn sec" data-acao="copiar-link-card">Copiar o link</button><button class="btn link" data-acao="fechar-painel">Fechar</button>',
    });
  }
  ui.acoes["copiar-link-card"] = function () {
    const campo = document.getElementById("link-card");
    if (!campo) return;
    const feito = () => ui.avisar("Link copiado.");
    const reserva = () => { campo.select(); try { if (document.execCommand("copy")) { feito(); return; } } catch (e) { /* segue */ } ui.avisar("O link está selecionado: use Ctrl+C.", "erro"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(campo.value).then(feito, reserva); else reserva();
  };
  /** O link no aviso do Bitrix (o aviso aceita BB code) */
  const linkNoAviso = (neg) => (neg.link ? " [URL=" + neg.link + "]Abrir o card na pipe[/URL]" : "");

  GP.ui.formulario = { html, ler, aplicar, validar, ligar, partesDaOpcao, responsavelDoFunil, enviarCard, mostrarEnviado, linkNoAviso };
})(window);
