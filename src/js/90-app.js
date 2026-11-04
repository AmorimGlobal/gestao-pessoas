/* =====================================================================================
   INICIALIZAÇÃO
   -------------------------------------------------------------------------------------
   Dentro do Bitrix (página em iframe): carrega o SDK BX24 e usa o repositório Bitrix.
   Fora (aberto direto no navegador) ou com ?demo=1: usa a demonstração em memória.
   Ordem: SDK -> usuário -> configuração/estrutura -> pessoas, departamentos e registros
   (em paralelo) -> vagas e esteira -> contexto -> render. O calendário do Bitrix não é lido (a empresa
   não usa): feriados pela lei e pelo processo Feriados, ausências pelos pedidos aprovados (04/11/2026).
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
    },
    parametros: { carencia1a1: 7, prazoLeitura: 7 },
    // os formulários de vaga e de encerramento são do app (04/11/2026). responsavel: quem fica com o card novo
    // (vazio: a primeira pessoa do RH em Papéis)
    recrutamento: { categoria: 77, responsavel: "" },
    // esteira "HR | Offboarding", criada em 29/10/2026 por amorim-api/offboarding-bitrix
    offboarding: { categoria: 79, responsavel: "" },
    // glossário de competências comportamentais do RH (Configuração → Cadastros)
    competencias: [],
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
    c.offboarding = Object.assign({}, CONFIG_PADRAO.offboarding, (cfg && cfg.offboarding) || {});
    c.competencias = Array.isArray(cfg && cfg.competencias) ? cfg.competencias : [];
    c.feriadosLocais = Object.assign({}, CONFIG_PADRAO.feriadosLocais, (cfg && cfg.feriadosLocais) || {});
    return c;
  }

  /** Agindo como outra pessoa: grava normalmente (pedido do RH em 27/10/2026), só não mexe nas
      preferências pessoais de quem está sendo representado (tour, dicas) */
  function emNomeDe(repo) {
    const r = Object.create(repo);
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
      if (repo.modo === "bitrix") ui.modoBitrix();
      const eu = await repo.eu();
      const est = await repo.lerConfig();
      const config = mesclarConfig(est.config);
      const hoje = repo.modo === "demo" ? repo.hoje : calc.hojeISO();
      const [usuarios, departamentos, registros] = await Promise.all([repo.usuarios(), repo.departamentos(), repo.listarTodos()]);
      const vagas = await repo.vagas(config.recrutamento.categoria).catch((e) => ({ etapas: [], negocios: [], historico: [], erro: repo.mensagemErro(e) }));
      // A esteira de offboarding só é lida por quem pode: o RH e o administrador (as lideranças não têm leitura no funil)
      const ehRH = eu.admin || ((config.papeis && config.papeis.rh) || []).some((p) => String(p.id) === String(eu.id));
      const catOff = Number(config.offboarding.categoria) || 0;
      const offboarding = Object.assign({ etapas: [], negocios: [] }, ehRH && catOff && repo.offboarding ? await repo.offboarding(catOff).catch((e) => ({ etapas: [], negocios: [], erro: repo.mensagemErro(e) })) : {}, { categoria: catOff });
      const ctx = dom.indexar({
        hoje, eu, config, usuarios, departamentos, registros, vagas, offboarding,
        // processo novo que ainda não foi criado no portal: a tela avisa em vez de falhar
        recursos: {
          mensal: repo.temProcesso ? repo.temProcesso("mensal") : true,
          ferias: repo.temProcesso ? repo.temProcesso("ferias") : true,
          feriados: repo.temProcesso ? repo.temProcesso("feriados") : true,
        },
      });
      const papeis = dom.papeis(ctx, eu.id);

      Object.assign(E, { eu, config, ctx, estrutura: { origem: est.origem, ausentes: est.ausentes || [], processosFaltando: est.processosFaltando || [] }, acessoNegado: repo.acessoNegado || [] });
      if (papeis.ceo) carregarResumoCEO(repo, ctx);
      E.visoes = ui.visoesDisponiveis(papeis);
      let guardada = null;
      try { guardada = localStorage.getItem("gp_visao_" + eu.id); } catch (e) { /* sem storage */ }
      E.visao = E.visoes.indexOf(guardada) >= 0 ? guardada : (E.visoes[0] || "lideranca");
      // Membro não acessa o app (1.2). Administrador entra para configurar.
      E.semAcesso = !E.visoes.length && !eu.admin;
      if (!E.visoes.length) E.visoes = ["lideranca"];
      try { E.dispensadas = JSON.parse(localStorage.getItem("gp_dicas_" + eu.id) || "{}"); } catch (e) { E.dispensadas = {}; }
      // o sino: o que chegou depois da última vez que a pessoa abriu fica como novo
      E.notifVisto = repo.lerPreferencia("gp_notif_visto") || "";
      E.carregando = false;
      const visto = repo.lerPreferencia("gp_tour_visto");
      // o tour mostra as telas da liderança: o membro, que só pede férias, não vê
      if (!visto && q.get("tour") !== "0" && E.visao !== "membro") E.tourPasso = 0;
      ui.render();
      // RH e administrador: confere no servidor se a permissão do CRM esconde registros (aviso no topo)
      if (repo.modo === "bitrix" && ui.podeVerComo() && repo.contagemServidor) {
        repo.contagemServidor().then((t) => { if (t) { E.contagem = t; ui.render(); } }, (e) => console.warn("Contagem no servidor indisponível:", e));
      }
    } catch (e) {
      console.error(e);
      E.carregando = false;
      E.erro = (E.repo && E.repo.mensagemErro ? E.repo.mensagemErro(e) : "") || e.message || String(e);
      ui.render();
    }
  }

  /** Administrador ou RH abre o app como outra pessoa (uid), com as permissões dela no app, ou volta para a
      própria visão (uid vazio). O que for gravado sai em nome da pessoa; o histórico do Bitrix registra quem gravou
      de fato (o login é sempre o de quem está usando), e os adendos dizem "registrado por". */
  async function verComo(uid) {
    const real = E.euReal || E.eu;
    if (!real || !ui.podeVerComo()) return;
    const ctx = E.ctx;
    const repoReal = E.repoReal || E.repo;
    let eu;
    if (!uid || String(uid) === String(real.id)) {
      eu = real;
      Object.assign(E, { eu, euReal: null, verComo: null, repo: repoReal, repoReal: null });
    } else {
      const p = dom.pessoa(ctx, uid);
      eu = { id: String(uid), nome: p.nome, foto: p.foto, email: p.email, admin: false };
      Object.assign(E, { eu, euReal: real, verComo: eu, repo: emNomeDe(repoReal), repoReal });
    }
    ctx.eu = eu;
    const papeis = dom.papeis(ctx, eu.id);
    E.visoes = ui.visoesDisponiveis(papeis);
    E.visao = E.visoes[0] || "lideranca";
    E.semAcesso = !E.visoes.length && !eu.admin;
    if (!E.visoes.length) E.visoes = ["lideranca"];
    location.hash = "#/inicio";
    if (papeis.ceo) carregarResumoCEO(repoReal, ctx);
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
