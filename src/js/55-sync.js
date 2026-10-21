/* =====================================================================================
   SINCRONIZAÇÃO COM A ESTRUTURA DA EMPRESA — entradas, mudanças de liderança e saídas
   -------------------------------------------------------------------------------------
   Compara os usuários ativos do Bitrix (e os seus departamentos) com o processo Membros:
   - pessoa nova num departamento: cria o item Membros (e o Onboarding, se entrou há
     menos de 90 dias), com liderança direta e coordenação tiradas da estrutura;
   - mudou de departamento: atualiza "Liderança direta" e "Coordenação responsável";
   - usuário desativado: move o item para "Encerrado" e avisa o RH.
   Ficam de fora a CEO e quem estiver em "Fora do app" (Configuração).

   Roda em dois lugares, com o mesmo código: o botão "Sincronizar agora" (navegador, login
   do administrador) e a rotina diária da Vercel (api/sincronizar.js, com webhook).
   planejar() é pura; executar() recebe as operações de gravação de quem chamou.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"),
    raiz.GP && raiz.GP.dominio ? raiz.GP.dominio : require("./50-dominio.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.sync = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc, dom) {
  "use strict";

  const FINAIS = ["SUCCESS", "FAIL"]; // Encerrado e Arquivado
  const DIAS_ONBOARDING = 90;
  // Proteção: se a lista de usuários vier incompleta, não encerra meia empresa de uma vez
  const LIMITE_SAIDAS = { minimo: 3, fracao: 0.3 };

  function cidadeDoUsuario(u) {
    const t = [u.estado, u.cidade].join(" ").toLowerCase();
    return /\b(ba|bahia|salvador)\b/.test(t) ? "Salvador (BA)" : "São Paulo (SP)";
  }

  /**
   * entrada = { hoje, usuarios (ATIVOS), departamentos, membros (todos os itens Membros),
   *             excecoes: [ids], ceos: [ids] }
   */
  function planejar(entrada) {
    const hoje = entrada.hoje;
    const deptoPorId = {};
    (entrada.departamentos || []).forEach((d) => { deptoPorId[d.id] = d; });
    const fora = new Set((entrada.excecoes || []).concat(entrada.ceos || []).map(String));
    const ativos = {};
    (entrada.usuarios || []).forEach((u) => { ativos[u.id] = u; });
    const membros = entrada.membros || [];
    const itemDe = {};
    membros.forEach((m) => {
      const atual = itemDe[m.responsavel];
      // mais de um item para a mesma pessoa: vale o que não está encerrado
      if (!atual || (FINAIS.indexOf(atual.estagio) >= 0 && FINAIS.indexOf(m.estagio) < 0)) itemDe[m.responsavel] = m;
    });
    const elegivel = (u) => (u.departamentos || []).length > 0 && !fora.has(String(u.id)) && (!u.tipo || u.tipo === "employee");
    // Quem está fora do app (CEO e exceções) também não recebe avisos (4.4: a CEO nunca recebe)
    const plano = { criar: [], atualizar: [], encerrar: [], conferir: [], alerta: "", naoAvisar: Array.from(fora) };

    // Setor sem chefe no Bitrix (coordenado por supervisores adjuntos, que a API não informa):
    // a estrutura não diz a coordenação nem a liderança de quem chefia uma área. Aí vale o que
    // está no item do Membros, e uma pessoa nova herda a coordenação que as outras do mesmo
    // departamento têm. A liderança nunca é herdada: sem estrutura clara, vai para o RH conferir.
    const deptoDe = (id) => { const u = ativos[id]; return (u && dom.deptoPrincipal(deptoPorId, u.departamentos)) || ""; };
    function herdar(u, campo) {
      const d = dom.deptoPrincipal(deptoPorId, u.departamentos);
      if (!d) return "";
      const conta = {};
      membros.forEach((m) => {
        if (FINAIS.indexOf(m.estagio) >= 0 || m.responsavel === String(u.id) || deptoDe(m.responsavel) !== String(d) || !m[campo]) return;
        if (deptoPorId[d] && deptoPorId[d].chefe === m.responsavel) return;
        conta[m[campo]] = (conta[m[campo]] || 0) + 1;
      });
      return Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] || "";
    }

    (entrada.usuarios || []).forEach((u) => {
      if (!elegivel(u)) return;
      const m = itemDe[u.id];
      const lid = dom.liderancaNaEstrutura(deptoPorId, u.id, u.departamentos);
      const coo = dom.coordenacaoNaEstrutura(deptoPorId, u.id, u.departamentos);
      const lideranca = lid.certa ? lid.id : String((m && m.lideranca) || "");
      const coordenacao = coo.certa ? coo.id : String((m && m.coordenacao) || "") || herdar(u, "coordenacao");
      const faltas = [];
      if (!lid.certa && !lideranca) faltas.push("a liderança direta");
      if (!coo.certa && !coordenacao) faltas.push("a coordenação");
      const semChefe = lid.semChefe || coo.semChefe;
      if (faltas.length && (!m || FINAIS.indexOf(m.estagio) < 0)) {
        plano.conferir.push({ usuario: u, membro: m || null, motivo: (semChefe ? semChefe.nome : "o departamento") + " não tem chefe no Bitrix: defina " + faltas.join(" e ") + " em Configuração → Setores sem chefe no Bitrix" });
      }
      if (!m) {
        const ingresso = calc.dataValida(u.registro) ? String(u.registro).slice(0, 10) : hoje;
        const novo = calc.diffDias(ingresso, hoje) < DIAS_ONBOARDING;
        plano.criar.push({ usuario: u, lideranca, coordenacao, ingresso, estagio: novo ? "NEW" : "ATIVO", cidade: cidadeDoUsuario(u), onboarding: novo });
        return;
      }
      if (FINAIS.indexOf(m.estagio) >= 0) {
        plano.conferir.push({ usuario: u, membro: m, motivo: "usuário ativo no Bitrix com o item Membros em \"" + (m.estagioNome || m.estagio) + "\"" });
        return;
      }
      // incerto (setor sem chefe): nunca troca o que está gravado; só preenche o vazio herdado
      const mudancas = {};
      if (lideranca && lideranca !== String(m.lideranca || "") && (lid.certa || !m.lideranca)) mudancas.lideranca = lideranca;
      if (coordenacao && coordenacao !== String(m.coordenacao || "") && (coo.certa || !m.coordenacao)) mudancas.coordenacao = coordenacao;
      if (Object.keys(mudancas).length) plano.atualizar.push({ usuario: u, membro: m, mudancas, antes: { lideranca: m.lideranca, coordenacao: m.coordenacao } });
    });

    membros.forEach((m) => {
      if (FINAIS.indexOf(m.estagio) >= 0 || itemDe[m.responsavel] !== m) return;
      if (!ativos[m.responsavel]) plano.encerrar.push({ membro: m });
    });

    const vivos = membros.filter((m) => FINAIS.indexOf(m.estagio) < 0).length;
    const limite = Math.max(LIMITE_SAIDAS.minimo, Math.ceil(vivos * LIMITE_SAIDAS.fracao));
    if (!(entrada.usuarios || []).length) {
      plano.alerta = "A lista de usuários do Bitrix veio vazia. Nenhuma saída foi aplicada.";
      plano.encerrar = [];
    } else if (plano.encerrar.length > limite) {
      plano.alerta = plano.encerrar.length + " saídas de uma vez (limite de segurança: " + limite + "). Nenhuma saída foi aplicada: confira a lista de usuários e rode \"Sincronizar agora\" pelo app, que permite confirmar.";
      plano.saidasRetidas = plano.encerrar;
      plano.encerrar = [];
    }
    return plano;
  }

  /**
   * ops = { criarMembro(dados) -> item, criarOnboarding(dados), atualizarMembro(id, dados),
   *         comentar(membroId, texto), notificar(ids, texto), nomeDe(userId) }
   * opcoes = { hoje, avisarIds: [...], forcarSaidas: bool, limite: n }
   */
  async function executar(plano, ops, opcoes) {
    const o = opcoes || {};
    const resumo = { criados: [], atualizados: [], encerrados: [], falhas: [], pendentes: 0 };
    const nome = (u) => (u && u.nome) || ("Usuário " + (u && u.id));
    const nomeId = (id) => (ops.nomeDe ? ops.nomeDe(id) : "") || ("usuário " + id);
    const data = calc.fmtDataAno(o.hoje);
    let feitos = 0;
    const limite = o.limite || Infinity;
    async function passo(desc, fn) {
      if (feitos >= limite) { resumo.pendentes++; return false; }
      try { await fn(); feitos++; return true; } catch (e) { resumo.falhas.push(desc + ": " + ((e && (e.message || e.descricao)) || e)); return false; }
    }

    for (const c of plano.criar) {
      await passo("entrada de " + nome(c.usuario), async () => {
        const item = await ops.criarMembro({
          titulo: nome(c.usuario), responsavel: c.usuario.id, lideranca: c.lideranca, coordenacao: c.coordenacao,
          ingresso: c.ingresso, estagio: c.estagio, cidade: c.cidade,
        });
        if (c.onboarding) {
          await ops.criarOnboarding({ titulo: "Onboarding · " + nome(c.usuario), membroId: item.id, responsavel: c.usuario.id, ingresso: c.ingresso, estagio: "NEW" });
        }
        if (ops.comentar) await ops.comentar(item.id, "Item criado pela sincronização com a estrutura da empresa em " + data + ". Confira a data de ingresso, o nível, a senioridade e o modelo de contrato.");
        resumo.criados.push(c);
      });
    }
    for (const a of plano.atualizar) {
      await passo("mudança de liderança de " + nome(a.usuario), async () => {
        await ops.atualizarMembro(a.membro.id, a.mudancas);
        const partes = [];
        if (a.mudancas.lideranca) partes.push("liderança direta: " + nomeId(a.antes.lideranca) + " → " + nomeId(a.mudancas.lideranca));
        if (a.mudancas.coordenacao) partes.push("coordenação: " + nomeId(a.antes.coordenacao) + " → " + nomeId(a.mudancas.coordenacao));
        if (ops.comentar) await ops.comentar(a.membro.id, "Atualizado pela sincronização em " + data + " (mudança na estrutura da empresa): " + partes.join("; ") + ".");
        resumo.atualizados.push(a);
      });
    }
    const saidas = plano.encerrar.concat(o.forcarSaidas && plano.saidasRetidas ? plano.saidasRetidas : []);
    for (const e of saidas) {
      await passo("saída de " + (e.membro.titulo || e.membro.id), async () => {
        await ops.atualizarMembro(e.membro.id, { estagio: "SUCCESS" });
        if (ops.comentar) await ops.comentar(e.membro.id, "Movido para Encerrado pela sincronização em " + data + ": o usuário foi desativado no Bitrix.");
        resumo.encerrados.push(e);
      });
    }

    // Avisos: ao RH, um resumo; a cada liderança, quem entrou na equipe. Sem conteúdo de registros (4.4).
    const linhas = [];
    if (resumo.criados.length) linhas.push(resumo.criados.length + " entrada(s): " + resumo.criados.map((c) => nome(c.usuario)).join(", "));
    if (resumo.encerrados.length) linhas.push(resumo.encerrados.length + " saída(s), movida(s) para Encerrado: " + resumo.encerrados.map((e) => e.membro.titulo).join(", "));
    if (resumo.atualizados.length) linhas.push(resumo.atualizados.length + " mudança(s) de liderança: " + resumo.atualizados.map((a) => nome(a.usuario)).join(", "));
    if (plano.alerta) linhas.push("ATENÇÃO: " + plano.alerta);
    if (resumo.falhas.length) linhas.push(resumo.falhas.length + " falha(s): " + resumo.falhas.slice(0, 3).join("; "));
    if (resumo.pendentes) linhas.push(resumo.pendentes + " mudança(s) ficaram para a próxima execução.");
    const naoAvisar = new Set((plano.naoAvisar || []).map(String));
    const avisarRH = (o.avisarIds || []).map(String).filter((id) => !naoAvisar.has(id));
    if (linhas.length && ops.notificar && avisarRH.length) {
      try { await ops.notificar(avisarRH, "Sincronização com a estrutura da empresa (" + data + "). " + linhas.join(" · ")); } catch (e) { resumo.falhas.push("aviso ao RH: " + (e.message || e)); }
    }
    if (ops.notificar) {
      const porLideranca = {};
      resumo.criados.forEach((c) => { if (c.lideranca) (porLideranca[c.lideranca] = porLideranca[c.lideranca] || []).push(nome(c.usuario)); });
      for (const lid of Object.keys(porLideranca).filter((id) => !naoAvisar.has(id))) {
        try { await ops.notificar([lid], "Entrou na sua equipe: " + porLideranca[lid].join(", ") + ". O card já está em Gestão de Pessoas → Minha equipe."); } catch (e) { /* aviso não bloqueia */ }
      }
    }
    resumo.texto = linhas.join("\n");
    return resumo;
  }

  return { planejar, executar, cidadeDoUsuario, DIAS_ONBOARDING, LIMITE_SAIDAS };
});
