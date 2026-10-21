/* =====================================================================================
   INICIALIZAÇÃO
   -------------------------------------------------------------------------------------
   Dentro do Bitrix (página em iframe): carrega o SDK BX24 e usa o repositório Bitrix.
   Fora (aberto direto no navegador) ou com ?demo=1: usa a demonstração em memória.
   Ordem: SDK -> usuário -> configuração/estrutura -> pessoas, departamentos e registros
   (em paralelo) -> feriados, vagas e ausências -> contexto -> render.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui;
  const E = ui.estado;

  const CONFIG_PADRAO = {
    papeis: { coordenacao: [], rh: [], ceo: [] },
    niveis: [],
    feriadosLocais: { SP: [], BA: [] },
    links: {
      manual: "https://drive.google.com/file/d/1fZNxcYlnxcGshaoWlYZ9pjLljZOVkqcL/view",
      formVaga: "https://b24-ljukko.bitrix24.site/crm_form_4nlpe/",
    },
    parametros: { carencia1a1: 7, prazoLeitura: 7 },
    recrutamento: { categoria: 77 },
  };

  function emIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function dentroDoBitrix() {
    // versão publicada (window.GP_SO_BITRIX, marcada pelo build.js): nunca cai na demonstração
    if (window.GP_SO_BITRIX) return true;
    const q = new URLSearchParams(location.search);
    if (q.get("demo") === "1") return false;
    return emIframe();
  }
  function carregarSDK() {
    return new Promise(function (ok, falha) {
      if (window.BX24) { ok(); return; }
      const s = document.createElement("script");
      s.src = "https://api.bitrix24.com/api/v1/";
      s.onload = function () { window.BX24 ? ok() : falha(new Error("SDK do Bitrix carregou sem o objeto BX24")); };
      s.onerror = function () { falha(new Error("não foi possível carregar o SDK do Bitrix (api.bitrix24.com)")); };
      document.head.appendChild(s);
    });
  }
  function comPrazo(promessa, ms, msg) {
    return Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error(msg)), ms))]);
  }
  function mesclarConfig(cfg) {
    const c = Object.assign({}, CONFIG_PADRAO, cfg || {});
    c.papeis = Object.assign({}, CONFIG_PADRAO.papeis, (cfg && cfg.papeis) || {});
    c.links = Object.assign({}, CONFIG_PADRAO.links, (cfg && cfg.links) || {});
    c.parametros = Object.assign({}, CONFIG_PADRAO.parametros, (cfg && cfg.parametros) || {});
    c.recrutamento = Object.assign({}, CONFIG_PADRAO.recrutamento, (cfg && cfg.recrutamento) || {});
    c.feriadosLocais = Object.assign({}, CONFIG_PADRAO.feriadosLocais, (cfg && cfg.feriadosLocais) || {});
    return c;
  }

  /** Ausências das pessoas visíveis (e da própria pessoa), nas próximas 13 semanas */
  async function carregarAusencias(repo, ctx, uid) {
    const papeis = dom.papeis(ctx, uid);
    const visiveis = dom.membrosVisiveis(ctx, uid).map((m) => m.responsavel).concat([uid]);
    const ids = papeis.rh ? (ctx.usuarios || []).map((u) => u.id) : visiveis;
    ctx.ausencias = await repo.ausencias(ids.slice(0, 400), ctx.hoje, calc.addDias(ctx.hoje, 13 * 7 + 7)).catch(() => []);
  }

  /** Repositório que lê como o original e recusa toda gravação (ver como outra pessoa) */
  function somenteLeitura(repo) {
    const r = Object.create(repo);
    const recusa = async function () { throw { codigo: "", descricao: "você está vendo o app como outra pessoa, e neste modo nada é gravado" }; };
    ["criar", "atualizar", "notificar", "comentar", "agendarPendencia", "registrarDossie", "salvarConfig", "provisionar"].forEach((m) => { if (typeof repo[m] === "function") r[m] = recusa; });
    r.gravarPreferencia = function () {};
    return r;
  }

  /** Painel da CEO: números calculados no servidor (no Bitrix) ou aqui (demonstração). Não trava a abertura. */
  function carregarResumoCEO(repo, ctx) {
    E.resumoCEO = null;
    E.resumoCEOErro = "";
    // vendo como a CEO: quem vê é um administrador, que já lê os registros; o cálculo é feito aqui
    if (E.verComo) { E.resumoCEO = dom.resumoPainel(dom.painelGeral(ctx)); return; }
    repo.painelServidor(ctx).then(function (r) { E.resumoCEO = r; ui.render(); }, function (e) {
      console.error(e);
      E.resumoCEOErro = (repo.mensagemErro ? repo.mensagemErro(e) : "") || (e && e.message) || String(e);
      ui.render();
    });
  }

  async function iniciar() {
    // Fora do Bitrix, a versão publicada não abre (o servidor já barra; isto cobre a página salva ou copiada)
    if (window.GP_SO_BITRIX && !emIframe()) {
      Object.assign(E, { carregando: false, foraDoBitrix: true });
      ui.render();
      return;
    }
    ui.render();
    const q = new URLSearchParams(location.search);
    try {
      let repo;
      if (dentroDoBitrix()) {
        await comPrazo(carregarSDK(), 10000, "o SDK do Bitrix não respondeu");
        repo = GP.bitrix.criarRepositorio();
        await comPrazo(repo.iniciar(), 10000, "o Bitrix não respondeu à inicialização do app");
      } else {
        repo = GP.demo.criarRepositorioDemo({ papel: q.get("papel") || "lideranca", hoje: q.get("hoje") || undefined });
      }
      E.repo = repo;
      const eu = await repo.eu();
      const est = await repo.lerConfig();
      const config = mesclarConfig(est.config);
      const hoje = repo.modo === "demo" ? repo.hoje : calc.hojeISO();
      const ano = Number(hoje.slice(0, 4));
      const [usuarios, departamentos, registros, fer1, fer2] = await Promise.all([
        repo.usuarios(), repo.departamentos(), repo.listarTodos(), repo.feriadosNacionais(ano), repo.feriadosNacionais(ano + 1),
      ]);
      const vagas = await repo.vagas(config.recrutamento.categoria).catch((e) => ({ etapas: [], negocios: [], historico: [], erro: repo.mensagemErro(e) }));
      const ctx = dom.indexar({
        hoje, eu, config, usuarios, departamentos, registros, vagas, ausencias: [],
        feriados: { nacionais: fer1.concat(fer2) },
      });
      const papeis = dom.papeis(ctx, eu.id);
      await carregarAusencias(repo, ctx, eu.id);

      Object.assign(E, { eu, config, ctx, estrutura: { origem: est.origem, ausentes: est.ausentes || [] } });
      if (papeis.ceo) carregarResumoCEO(repo, ctx);
      E.visoes = ui.visoesDisponiveis(papeis);
      let guardada = null;
      try { guardada = localStorage.getItem("gp_visao_" + eu.id); } catch (e) { /* sem storage */ }
      E.visao = E.visoes.indexOf(guardada) >= 0 ? guardada : (E.visoes[0] || "lideranca");
      // Membro não acessa o app (1.2). Administrador entra para configurar.
      E.semAcesso = !E.visoes.length && !eu.admin;
      if (!E.visoes.length) E.visoes = ["lideranca"];
      try { E.dispensadas = JSON.parse(localStorage.getItem("gp_dicas_" + eu.id) || "{}"); } catch (e) { E.dispensadas = {}; }
      E.carregando = false;
      const visto = repo.lerPreferencia("gp_tour_visto");
      if (!visto && q.get("tour") !== "0") E.tourPasso = 0;
      ui.render();
    } catch (e) {
      console.error(e);
      E.carregando = false;
      E.erro = (E.repo && E.repo.mensagemErro ? E.repo.mensagemErro(e) : "") || e.message || String(e);
      ui.render();
    }
  }

  /** Administrador vê o app como outra pessoa (uid) ou volta para a própria visão (uid vazio). Somente leitura. */
  async function verComo(uid) {
    const real = E.euReal || E.eu;
    if (!real || !real.admin) return;
    const ctx = E.ctx;
    const repoReal = E.repoReal || E.repo;
    let eu;
    if (!uid || String(uid) === String(real.id)) {
      eu = real;
      Object.assign(E, { eu, euReal: null, verComo: null, repo: repoReal, repoReal: null });
    } else {
      const p = dom.pessoa(ctx, uid);
      eu = { id: String(uid), nome: p.nome, foto: p.foto, email: p.email, admin: false };
      Object.assign(E, { eu, euReal: real, verComo: eu, repo: somenteLeitura(repoReal), repoReal });
    }
    ctx.eu = eu;
    const papeis = dom.papeis(ctx, eu.id);
    E.visoes = ui.visoesDisponiveis(papeis);
    E.visao = E.visoes[0] || "lideranca";
    E.semAcesso = !E.visoes.length && !eu.admin;
    if (!E.visoes.length) E.visoes = ["lideranca"];
    location.hash = "#/inicio";
    E.carregando = true;
    ui.render();
    await carregarAusencias(repoReal, ctx, eu.id);
    if (papeis.ceo) carregarResumoCEO(repoReal, ctx);
    E.carregando = false;
    ui.render();
  }

  GP.app = {
    iniciar, verComo,
    marcarTourVisto: function () { if (E.repo) E.repo.gravarPreferencia("gp_tour_visto", "1"); },
    /** Aviso a pessoas específicas (nunca ao membro: quem chama passa lideranças, coordenações ou RH).
        Falha no aviso nunca impede a gravação. */
    avisar: async function (ids, mensagem) {
      try { await E.repo.notificar((ids || []).filter(Boolean), mensagem); } catch (e) { console.warn("Aviso não enviado:", e); }
    },
    /** Aviso ao RH (e a quem mais for passado). Falha no aviso nunca impede a gravação. */
    avisarRH: async function (mensagem, extras) {
      try {
        const rh = ((E.config && E.config.papeis && E.config.papeis.rh) || []).map((p) => p.id);
        await E.repo.notificar(rh.concat(extras || []), mensagem);
      } catch (e) { console.warn("Aviso não enviado:", e); }
    },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})(window);
