/* =====================================================================================
   REPOSITÓRIO BITRIX — toda leitura e escrita do app passa por aqui
   -------------------------------------------------------------------------------------
   Todas as chamadas saem do NAVEGADOR, por BX24.callMethod, com o login de quem abriu o
   app. Isso faz as funções de acesso do CRM (2.4) valerem sozinhas: a liderança só
   recebe os itens do departamento que chefia, sem filtro nenhum no app.
   (Mesmo motivo do widget-rotina-contabil: o servidor só entrega a página.)

   O app conversa com um objeto "normalizado" por registro: { id, titulo, estagio,
   membroId, criadoEm, ...campos pela chave do esquema }. Esta camada converte de/para
   os códigos ufCrm<id>... e os IDs das listas.

   A mesma interface é implementada em 45-demo.js (dados em memória).
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const schema = GP.schema;
  const CHAVE_CONFIG = "gp_config";

  function ErroBx(res, metodo) {
    const e = res && res.error ? res.error() : null;
    const ex = (e && e.ex) || {};
    this.codigo = String(ex.error || (e && e.error) || "");
    this.descricao = String(ex.error_description || (e && e.error_description) || (typeof e === "string" ? e : "") || "");
    this.metodo = metodo;
  }

  function mensagemErro(err) {
    if (!err) return "erro desconhecido";
    const c = err.codigo || "", d = err.descricao || err.message || "";
    if (c === "expired_token" || c === "invalid_token" || c === "NO_AUTH_FOUND") return "a sessão do Bitrix expirou (" + c + "). Recarregue a página.";
    if (c === "insufficient_scope") return "o aplicativo não tem permissão para esta operação (" + c + "). O TI precisa conferir os escopos do app.";
    if (c === "ACCESS_DENIED" || /access denied|not allowed|permission/i.test(d)) return "seu usuário não tem acesso a isto no Bitrix (" + (c || "ACCESS_DENIED") + ")" + (d ? ": " + d : "");
    if (d && c) return d + " (" + c + ")";
    return d || c || "erro desconhecido";
  }

  function bx(metodo, params) {
    return new Promise(function (ok, falha) {
      try {
        BX24.callMethod(metodo, params || {}, function (res) {
          if (res.error()) falha(new ErroBx(res, metodo)); else ok(res.data());
        });
      } catch (e) { falha({ codigo: "", descricao: String((e && e.message) || e), metodo }); }
    });
  }
  /** Percorre as páginas de 50. Sem isto, a partir do 51º item os registros somem em silêncio. */
  function bxTudo(metodo, params, chave, limite) {
    const max = limite || 5000;
    return new Promise(function (ok, falha) {
      let acc = [];
      try {
        BX24.callMethod(metodo, params || {}, function tratar(res) {
          if (res.error()) { falha(new ErroBx(res, metodo)); return; }
          const d = res.data();
          acc = acc.concat(chave ? ((d && d[chave]) || []) : (d || []));
          if (res.more() && acc.length < max) res.next(tratar); else ok(acc);
        });
      } catch (e) { falha({ codigo: "", descricao: String((e && e.message) || e), metodo }); }
    });
  }
  /** Até 50 comandos por chamada. Devolve { chave: {ok, dados, erro} } */
  function bxLote(comandos) {
    const chaves = Object.keys(comandos);
    const partes = [];
    for (let i = 0; i < chaves.length; i += 50) partes.push(chaves.slice(i, i + 50));
    return partes.reduce(function (p, parte) {
      return p.then(function (acc) {
        return new Promise(function (ok) {
          const lote = {};
          parte.forEach(function (k) { lote[k] = comandos[k]; });
          BX24.callBatch(lote, function (res) {
            parte.forEach(function (k) {
              const r = res && res[k];
              if (!r) acc[k] = { ok: false, erro: { codigo: "", descricao: "sem resposta" } };
              else if (r.error()) acc[k] = { ok: false, erro: new ErroBx(r, comandos[k][0]) };
              else acc[k] = { ok: true, dados: r.data() };
            });
            ok(acc);
          }, false);
        });
      });
    }, Promise.resolve({}));
  }
  /** Adaptador para o provisionamento: {dados, proximo} */
  function chamarParaProvisionar(metodo, params) {
    return new Promise(function (ok, falha) {
      BX24.callMethod(metodo, params || {}, function (res) {
        if (res.error()) { const e = new ErroBx(res, metodo); falha(new Error(metodo + ": " + mensagemErro(e))); return; }
        const ans = res.answer || {};
        ok({ dados: res.data(), proximo: ans.next === undefined ? null : ans.next });
      });
    });
  }

  const reg = GP.registros;
  const dataBitrix = reg.dataBitrix;

  function semPermissao(e) {
    return !!e && (e.codigo === "ACCESS_DENIED" || /access denied|not allowed|permission|acesso negado/i.test(String(e.descricao || e.message || "")));
  }

  function lerJSON(txt, padrao) {
    if (txt && typeof txt === "object") return txt;
    try { return txt ? JSON.parse(txt) : padrao; } catch (e) { return padrao; }
  }

  function criarRepositorio() {
    const estrutura = {}; // chave -> { eti, typeId, campoPai, estagios, estagioPorId, nomes, campos, defs, enums, presentes }
    let config = null;

    function montarEstrutura(cfg) {
      schema.PROCESSOS.forEach(function (p) {
        const c = cfg.processos && cfg.processos[p.chave];
        if (c) estrutura[p.chave] = reg.estruturaDoProcesso(p, c);
      });
    }

    /** Sem configuração gravada: acha os processos pelo título (depois do CLI tools/provisionar.js) */
    function descobrirEstrutura() { return reg.descobrirEstrutura(bxTudo); }

    /** Lê os campos de cada processo: IDs das listas e quais campos existem de fato */
    async function carregarMetadados() {
      const cmds = {};
      Object.keys(estrutura).forEach(function (k) { cmds[k] = ["crm.item.fields", { entityTypeId: estrutura[k].eti }]; });
      const r = await bxLote(cmds);
      const ausentes = [];
      Object.keys(estrutura).forEach(function (k) {
        const flds = (r[k] && r[k].ok && r[k].dados && r[k].dados.fields) || {};
        reg.aplicarMetadados(estrutura[k], flds).forEach(function (ch) { ausentes.push(k + "." + ch); });
      });
      return ausentes;
    }

    function normalizar(chave, it) { return reg.normalizar(estrutura[chave], it); }
    function montarCampos(chave, dados) {
      return reg.montarCampos(estrutura[chave], dados, function (ch) { console.warn("Campo ausente no Bitrix, não gravado:", chave + "." + ch); });
    }

    const repo = {
      modo: "bitrix",
      bx, bxTudo, bxLote, mensagemErro, chamarParaProvisionar,

      iniciar: function () {
        return new Promise(function (ok) {
          BX24.init(function () {
            try { if (BX24.installFinish) BX24.installFinish(); } catch (e) { /* já instalado */ }
            ok();
          });
        });
      },

      /* ---------- configuração (BX24.appOption, só administrador grava) ---------- */
      lerConfig: async function () {
        config = lerJSON(BX24.appOption.get(CHAVE_CONFIG), null);
        let origem = "gravada";
        if (!config || !config.processos || !Object.keys(config.processos).length) {
          const descoberta = await descobrirEstrutura();
          config = Object.assign({}, config || {}, { processos: descoberta.processos });
          origem = Object.keys(descoberta.processos).length ? "descoberta" : "ausente";
        }
        montarEstrutura(config);
        const ausentes = Object.keys(estrutura).length ? await carregarMetadados() : [];
        return { config, origem, ausentes };
      },
      salvarConfig: function (cfg) {
        return new Promise(function (ok) {
          BX24.appOption.set(CHAVE_CONFIG, JSON.stringify(cfg), function () { config = cfg; montarEstrutura(cfg); ok(); });
        });
      },
      estrutura: function () { return estrutura; },
      provisionar: function (simular, log) {
        return GP.provision.provisionar({ chamar: chamarParaProvisionar, simular, log, configAtual: config || {} });
      },

      /* ---------- pessoas e estrutura da empresa ---------- */
      eu: async function () {
        const r = await bxLote({ u: ["user.current", {}], a: ["user.admin", {}] });
        const u = (r.u && r.u.dados) || {};
        return {
          id: String(u.ID || ""), nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || u.EMAIL || "",
          foto: u.PERSONAL_PHOTO || "", email: u.EMAIL || "", admin: !!(r.a && r.a.ok && r.a.dados === true),
        };
      },
      usuarios: async function () {
        const lista = await bxTudo("user.get", { FILTER: { ACTIVE: true }, ADMIN_MODE: false });
        return lista.map(function (u) {
          const nasc = String(u.PERSONAL_BIRTHDAY || "");
          return {
            id: String(u.ID), nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || u.EMAIL || ("Usuário " + u.ID),
            foto: u.PERSONAL_PHOTO || "", email: u.EMAIL || "", cargo: u.WORK_POSITION || "",
            departamentos: (u.UF_DEPARTMENT || []).map(String),
            aniversario: nasc ? nasc.slice(5, 10) : "", // só mês e dia (3.6: nunca o ano)
            // para a sincronização com a estrutura (55-sync.js)
            registro: dataBitrix(u.DATE_REGISTER), tipo: u.USER_TYPE || "",
            estado: [u.PERSONAL_STATE, u.WORK_STATE].filter(Boolean).join(" "), cidade: [u.PERSONAL_CITY, u.WORK_CITY].filter(Boolean).join(" "),
          };
        });
      },
      departamentos: async function () {
        const lista = await bxTudo("department.get", {});
        return lista.map(function (d) {
          return { id: String(d.ID), nome: d.NAME, pai: d.PARENT ? String(d.PARENT) : "", chefe: d.UF_HEAD ? String(d.UF_HEAD) : "" };
        });
      },
      selecionarUsuarios: function (multiplo) {
        return new Promise(function (ok) {
          const cb = function (r) { ok((Array.isArray(r) ? r : (r ? [r] : [])).map(function (u) { return { id: String(u.id), nome: u.name || u.sub || "" }; })); };
          if (multiplo) BX24.selectUsers(cb); else BX24.selectUser(cb);
        });
      },

      /* ---------- registros do app ---------- */
      listar: async function (chave) {
        const e = estrutura[chave];
        if (!e) return [];
        const itens = await bxTudo("crm.item.list", {
          entityTypeId: e.eti, select: ["*", "ufCrm*"], order: { id: "ASC" },
        }, "items");
        return itens.map(function (it) { return normalizar(chave, it); });
      },
      /** Um processo sem permissão de leitura (ex.: a CEO, ou a liderança em Finalistas) vem vazio
          em vez de derrubar o app inteiro */
      listarTodos: async function () {
        const r = {};
        for (const p of schema.PROCESSOS) {
          try { r[p.chave] = await repo.listar(p.chave); } catch (e) { if (!semPermissao(e)) throw e; r[p.chave] = []; }
        }
        return r;
      },
      criar: async function (chave, dados) {
        const e = estrutura[chave];
        const d = await bx("crm.item.add", { entityTypeId: e.eti, fields: montarCampos(chave, dados) });
        return normalizar(chave, d.item);
      },
      atualizar: async function (chave, id, dados) {
        const e = estrutura[chave];
        const d = await bx("crm.item.update", { entityTypeId: e.eti, id: Number(id), fields: montarCampos(chave, dados) });
        return normalizar(chave, d.item);
      },
      buscar: async function (chave, id) {
        const e = estrutura[chave];
        const d = await bx("crm.item.get", { entityTypeId: e.eti, id: Number(id) });
        return normalizar(chave, d.item);
      },
      /** Abre o card nativo do item (para o RH, o histórico de alterações e os anexos) */
      abrirCard: function (chave, id) {
        const e = estrutura[chave];
        if (e && BX24.openPath) BX24.openPath("/crm/type/" + e.eti + "/details/" + id + "/");
      },

      /* ---------- feriados, ausências e agenda ---------- */
      /** Feriados nacionais pelas configurações do calendário do Bitrix ("1.01,21.04,...").
          Sem acesso, cai para a lista calculada (GP.calc.feriadosNacionais). */
      feriadosNacionais: async function (ano) {
        try {
          const s = await bx("calendar.settings.get", {});
          const txt = s && (s.year_holidays || s.YEAR_HOLIDAYS);
          if (txt) {
            return String(txt).split(",").map(function (x) {
              const [d, m] = x.trim().split(".");
              return d && m ? { data: ano + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0"), nome: "Feriado", abrangencia: "nacional", fonte: "bitrix" } : null;
            }).filter(Boolean);
          }
        } catch (e) { /* sem escopo calendar: usa a lista calculada */ }
        return GP.calc.feriadosNacionais(ano);
      },
      /** Ausências confirmadas: eventos "Ausente" na agenda de cada pessoa (calendar.accessibility.get).
          A especificação pede o gráfico de ausências nativo; a leitura dele é validação pendente do TI (6.2). */
      ausencias: async function (userIds, inicio, fim) {
        if (!userIds.length) return [];
        try {
          const r = await bx("calendar.accessibility.get", { users: userIds.map(Number), from: inicio, to: fim });
          const lista = [];
          Object.keys(r || {}).forEach(function (uid) {
            (r[uid] || []).forEach(function (ev) {
              if (String(ev.ACCESSIBILITY || "").toLowerCase() !== "absent") return;
              lista.push({ pessoa: String(uid), inicio: dataBitrix(ev.DATE_FROM), fim: dataBitrix(ev.DATE_TO) });
            });
          });
          return lista.filter(function (a) { return a.inicio && a.fim; });
        } catch (e) { return []; }
      },
      /** "Agendar na agenda" (4.4): compromisso na agenda da própria pessoa, com lembrete de 15 minutos */
      agendarPendencia: async function (eu, p) {
        const secoes = await bx("calendar.section.get", { type: "user", ownerId: Number(eu.id) });
        const secao = (secoes || [])[0];
        if (!secao) throw { codigo: "", descricao: "não encontrei a sua agenda no Bitrix" };
        return bx("calendar.event.add", {
          type: "user", ownerId: Number(eu.id), section: Number(secao.ID), name: p.titulo,
          from: p.inicio, to: p.fim, skip_time: "N",
          description: p.descricao || "", remind: [{ type: "min", count: 15 }],
          accessibility: "busy", private_event: "Y",
        });
      },

      /* ---------- avisos, registro de dossiê e preferências por pessoa ---------- */
      /** Notificação do Bitrix (escopo im). Nunca leva conteúdo de feedback, leitura ou plano (4.4). */
      notificar: async function (userIds, mensagem) {
        const ids = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
        if (!ids.length) return;
        const cmds = {};
        ids.forEach(function (id) { cmds["n" + id] = ["im.notify.system.add", { USER_ID: Number(id), MESSAGE: "[Gestão de Pessoas] " + mensagem }]; });
        await bxLote(cmds);
      },
      /** Painel da CEO: só números, calculados no servidor (api/painel.js). O servidor confere quem
          pediu pelo token do Bitrix desta sessão, sem precisar de leitura da CEO nos processos. */
      painelServidor: async function () {
        const auth = BX24.getAuth ? BX24.getAuth() : null;
        if (!auth || !auth.access_token) throw new Error("o Bitrix não entregou o token de acesso desta sessão");
        const r = await fetch("/api/painel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auth: auth.access_token }) });
        const j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.ok) throw new Error(j.erro || "o servidor respondeu " + r.status);
        return j.resumo;
      },
      /** Rotinas do servidor ligadas na Vercel (api/status.js): só sim/não, nunca os valores */
      statusServidor: async function () {
        const auth = BX24.getAuth ? BX24.getAuth() : null;
        const r = await fetch("/api/status", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auth: (auth && auth.access_token) || "" }) });
        if (!r.ok) throw new Error("o servidor respondeu " + r.status);
        return r.json();
      },
      /** O download do dossiê fica registrado: comentário na timeline do item Membros (4.4) */
      registrarDossie: async function (membroId, eu) {
        const e = estrutura.membros;
        if (!e) return;
        const agora = new Date();
        await bx("crm.timeline.comment.add", { fields: {
          ENTITY_ID: Number(membroId), ENTITY_TYPE: "DYNAMIC_" + e.eti,
          COMMENT: "Dossiê exportado por " + eu.nome + " em " + agora.toLocaleDateString("pt-BR") + " às " + agora.toLocaleTimeString("pt-BR").slice(0, 5) + ".",
        } });
      },
      /** Comentário na timeline de um registro do app (histórico de quem, quando e por quê) */
      comentar: async function (chave, id, texto) {
        const e = estrutura[chave];
        if (!e) return;
        await bx("crm.timeline.comment.add", { fields: { ENTITY_ID: Number(id), ENTITY_TYPE: "DYNAMIC_" + e.eti, COMMENT: texto } });
      },
      /** Preferência da pessoa (ex.: tour já visto), guardada no Bitrix por usuário */
      lerPreferencia: function (nome) { try { return BX24.userOption.get(nome); } catch (e) { return null; } },
      gravarPreferencia: function (nome, valor) { try { BX24.userOption.set(nome, valor); } catch (e) { /* sem userOption */ } },

      /* ---------- recrutamento: funil "HR | Requisição de Vagas" ---------- */
      vagas: async function (categoria) {
        const cat = Number(categoria || 77);
        const [etapas, negocios, historico] = await Promise.all([
          bx("crm.dealcategory.stage.list", { id: cat }),
          bxTudo("crm.deal.list", {
            filter: { CATEGORY_ID: cat }, order: { ID: "DESC" },
            select: ["ID", "TITLE", "STAGE_ID", "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE", "CLOSED", "ASSIGNED_BY_ID",
              "UF_CRM_RV_VAGA", "UF_CRM_RV_EMAIL", "UF_CRM_RV_LIDER", "UF_CRM_RV_COORD", "UF_CRM_RV_SETOR", "UF_CRM_RV_DEPTO", "UF_CRM_RV_DATA_ENT"],
          }),
          bxTudo("crm.stagehistory.list", { entityTypeId: 2, filter: { CATEGORY_ID: cat }, order: { ID: "ASC" } }, "items").catch(function () { return []; }),
        ]);
        return { etapas: reg.etapasDoFunil(etapas), negocios, historico };
      },
    };
    return repo;
  }

  GP.bitrix = { criarRepositorio, mensagemErro, lerValor: reg.lerValor, escreverValor: reg.escreverValor, CHAVE_CONFIG };
})(window);
