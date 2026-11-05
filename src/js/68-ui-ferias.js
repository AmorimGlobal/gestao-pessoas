/* =====================================================================================
   TELAS — Férias e ausências (Políticas de Férias e Ausências do RH, 04/11/2026)
   -------------------------------------------------------------------------------------
   Decisão do usuário (04/11/2026): o pedido e a resposta seguem por e-mail, como na
   política. No app:
   - quem pede (qualquer pessoa, inclusive o membro) lê as regras do tipo escolhido, marca
     que leu, e o app escreve o e-mail para hr@amorimlawfirm.com com cópia para a
     liderança direta (Gmail, e-mail do computador ou copiar). Nada é gravado;
   - o RH registra a ausência aprovada (membro, tipo, de/até, observação), edita ou exclui;
   - todos veem as ausências da sua visão, e a Agenda da equipe mostra quem está fora.
   Mora aqui também o "Meu aniversário" (perfil do Bitrix), que o day off de aniversário usa.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const F = GP.ferias;
  const E = () => ui.estado;
  const semEstrutura = () => !!(E().ctx.recursos && E().ctx.recursos.ferias === false);
  // só as registradas que a visão enxerga (o RH, todas; a liderança, as da equipe; o membro, as suas)
  const ausencia = (id) => F.visiveisPara(E().ctx, E().eu.id, E().visao).find((p) => p.id === String(id));
  const podeRegistrar = () => E().visao === "rh";

  /* ================================================================ TELA */
  function linha(p, comPessoa) {
    const quem = dom.pessoa(E().ctx, p.responsavel);
    const agora = p.inicio <= E().ctx.hoje;
    return '<div class="item clicavel" data-rota="#/ferias/' + esc(p.id) + '">' + (comPessoa ? c.avatar(quem, 30) : "") +
      '<div class="principal-item"><div class="t">' + (comPessoa ? esc(quem.nome) + " · " : "") + esc(p.tipo) + (p.motivoDayOff ? " (" + esc(p.motivoDayOff.toLowerCase()) + ")" : "") + "</div>" +
      '<div class="d">' + esc(F.periodo(p)) + "</div></div>" +
      '<div class="lado">' + (agora ? c.tag("fora agora", "ambar") : "") + "</div></div>";
  }
  function lista(itens, comPessoa, vazio) { return itens.length ? '<div class="lista">' + itens.map((p) => linha(p, comPessoa)).join("") + "</div>" : c.vazio(vazio); }

  /** A política inteira (o fluxo, os três tipos e os feriados), para consultar a qualquer hora */
  function politicaHtml(aberta) {
    const P = F.POLITICA;
    const sec = (t, itens) => "<h4>" + esc(t) + "</h4><ul>" + itens.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    return '<details class="card politica"' + (aberta ? " open" : "") + '><summary>' + icone("manual", 15) + " Políticas de Férias e Ausências</summary>" +
      '<div class="corpo-politica"><h4>Fluxo de solicitação</h4><ol>' + P.fluxo.map((x) => "<li><b>" + esc(x[0]) + ".</b> " + esc(x[1]) + "</li>").join("") + "</ol>" +
      sec("Férias", P["Férias"]) + sec("Day off", P["Day off"]) + sec("Pausa contratual", P["Pausa contratual"]) + sec("Feriados", P.feriados) +
      '<p class="muted" style="font-size:12px">Dúvidas: ' + esc(F.EMAIL_RH) + ".</p></div></details>";
  }

  ui.rotas.ferias = function (partes) {
    if (partes[0]) return telaAusencia(partes[0]);
    const ctx = E().ctx, eu = E().eu;
    const visao = E().visao;
    const todas = F.visiveisPara(ctx, eu.id, visao);
    const proximas = F.proximas(todas, ctx.hoje);
    const minhas = proximas.filter((p) => String(p.responsavel) === String(eu.id));
    const outras = proximas.filter((p) => String(p.responsavel) !== String(eu.id));
    const u = dom.pessoa(ctx, eu.id);
    let h = c.cabecalho("ferias", "Férias e ausências", "<span><b>" + proximas.length + "</b> " + (proximas.length === 1 ? "ausência registrada" : "ausências registradas") + " daqui em diante</span>",
      (podeRegistrar() && !semEstrutura() ? '<button class="btn" data-acao="registrar-ausencia">' + icone("mais", 15) + " Registrar ausência</button>" : "") +
      '<button class="btn' + (podeRegistrar() ? " sec" : "") + '" data-acao="pedir-por-email">' + icone("email", 15) + " Pedir férias ou ausência</button>");
    if (semEstrutura()) {
      h += '<div class="aviso-atencao" style="margin-bottom:16px"><b>A tabela "Férias e ausências" ainda não existe no CRM do Bitrix.</b> ' +
        (eu.admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura".' : "Avise o TI: falta criar a estrutura no Bitrix.") + "</div>";
    }
    h += '<div class="aviso-info" style="margin-bottom:16px">O pedido e a resposta seguem por e-mail, como pede a política: em "Pedir férias ou ausência" você lê as regras e o app escreve o e-mail para ' + esc(F.EMAIL_RH) +
      ", com cópia para a sua liderança. Quando o pedido é aprovado, o RH registra a ausência aqui, e ela aparece na Agenda da equipe.</div>";
    if (visao !== "membro") h += '<div class="card"><h3>' + (visao === "rh" ? "Próximas ausências" : "Próximas ausências da equipe") + '<span class="extra muted">' + plural(outras.length, "ausência", "ausências") + "</span></h3>" +
      lista(outras, true, visao === "rh" ? "Nenhuma ausência registrada daqui em diante." : "Ninguém da equipe com ausência registrada daqui em diante.") + "</div>";
    // o aniversário fica junto das suas ausências: o day off de aniversário usa o mês dele
    const aniv = (u.aniversario ? "Seu aniversário: <b>" + calc.fmtData("2000-" + u.aniversario) + "</b> · day off no mês de " + calc.MESES_LONGOS[Number(u.aniversario.slice(0, 2)) - 1] + "."
      : "Seu aniversário não está cadastrado: o day off de aniversário usa o mês dele.") +
      (E().verComo ? "" : ' <a href="#" data-acao="meu-aniversario">' + (u.aniversario ? "Atualizar" : "Cadastrar") + "</a>");
    h += '<div class="card"><h3>Suas ausências</h3><p class="muted" style="margin-top:0;font-size:12.5px">' + aniv + "</p>" + lista(minhas, false, "Nenhuma ausência sua registrada daqui em diante.") + "</div>";
    h += politicaHtml(false);
    return h;
  };

  /* ================================================================ UMA AUSÊNCIA */
  function telaAusencia(id) {
    const ctx = E().ctx;
    const p = ausencia(id);
    if (!p) return c.voltar("#/ferias", "Férias e ausências") + '<div class="card">' + c.vazio("Ausência não encontrada ou fora da sua visão.") + "</div>";
    const quem = dom.pessoa(ctx, p.responsavel);
    const acoes = podeRegistrar() ? '<button class="btn sec" data-acao="registrar-ausencia" data-id="' + esc(p.id) + '">Editar</button>' +
      '<button class="btn link excluir" data-acao="excluir-ausencia" data-id="' + esc(p.id) + '">' + icone("lixeira", 14) + " Excluir</button>" : "";
    const fer = dom.feriadosDe(ctx, F.dadosDaPessoa(ctx, p.responsavel).sigla);
    const fim = p.tipo === "Day off" ? p.inicio : p.fim || p.inicio;
    return c.voltar("#/ferias", "Férias e ausências") + c.cabecalho("ferias", p.tipo + " · " + quem.nome, "<span>" + esc(F.periodo(p)) + "</span>", acoes) +
      '<div class="card">' + c.dados([["Pessoa", quem.nome], ["Tipo", p.tipo + (p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : "")], ["Período", F.periodo(p)],
        ["Volta em", calc.fmtDiaSemana(calc.voltaEm(fim, fer)) + ", " + calc.fmtDataAno(calc.voltaEm(fim, fer))], ["Liderança direta", p.lideranca ? dom.pessoa(ctx, p.lideranca).nome : ""],
        ["Registrada por", dom.pessoa(ctx, p.autor || p.criadoPor).nome + (p.criadoEm ? " em " + calc.fmtDataAno(p.criadoEm) : "")]]) +
      '<div class="sci" style="margin-top:14px">' + c.textoRegistro("Observação", p.justificativa) + "</div></div>";
  }

  /* ================================================================ REGISTRAR (o RH) */
  function formAusencia(p) {
    const ctx = E().ctx;
    const v = p || {};
    // todas as pessoas da empresa (com setor no Bitrix), lideranças incluídas: nem todas têm item em Membros
    const pessoas = (ctx.usuarios || []).filter((u) => (u.departamentos || []).length && (!u.tipo || u.tipo === "employee"))
      .slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.id, rotulo: u.nome }));
    return '<div id="form-ausencia">' +
      (p ? '<input type="hidden" name="pessoa" value="' + esc(p.responsavel) + '">' : c.campo({ nome: "pessoa", rotulo: "Quem fica ausente", tipo: "lista", opcoes: pessoas })) +
      c.campo({ nome: "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: F.TIPOS, valor: v.tipo || "Férias" }) +
      '<div data-so="Day off">' + c.campo({ nome: "motivoDayOff", rotulo: "Motivo do day off", tipo: "escolha", opcoes: GP.schema.OPCOES.motivoDayOff, valor: v.motivoDayOff, opcional: true }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Primeiro dia", tipo: "data", valor: v.inicio }) +
      '<div data-nao="Day off">' + c.campo({ nome: "fim", rotulo: "Último dia", tipo: "data", valor: v.fim }) + "</div></div>" +
      c.campo({ nome: "justificativa", rotulo: "Observação", tipo: "textoLongo", valor: v.justificativa, opcional: true, ajuda: "O que vale lembrar (por exemplo, a cobertura combinada). O motivo nunca aparece na agenda da equipe." }) +
      '<div id="aviso-ausencia"></div></div>';
  }
  function ligarFormAusencia(el, id) {
    const f = el.querySelector("#form-ausencia");
    const atualizar = function () {
      const d = ui.lerForm(f);
      f.querySelectorAll("[data-so]").forEach((x) => { x.hidden = d.tipo !== x.dataset.so; });
      f.querySelectorAll("[data-nao]").forEach((x) => { x.hidden = d.tipo === x.dataset.nao; });
      // outra ausência da mesma pessoa no período: só avisa (pode ser de propósito, como um day off depois das férias)
      const fim = d.tipo === "Day off" ? d.inicio : d.fim;
      const junto = d.pessoa && d.inicio && fim ? F.pedidosDe(E().ctx, d.pessoa, id).find((x) => x.inicio <= fim && (x.tipo === "Day off" ? x.inicio : x.fim || x.inicio) >= d.inicio) : null;
      f.querySelector("#aviso-ausencia").innerHTML = junto ? '<div class="aviso-atencao">Já há uma ausência registrada para essa pessoa no período: ' + esc(junto.tipo + ", " + F.periodoCurto(junto)) + ".</div>" : "";
    };
    f.addEventListener("change", atualizar);
    atualizar();
  }
  ui.acoes["registrar-ausencia"] = function (el) {
    if (!podeRegistrar()) return;
    const p = el && el.dataset.id ? ausencia(el.dataset.id) : null;
    ui.abrirPainel({
      titulo: p ? "Editar a ausência" : "Registrar ausência",
      sub: "Depois da aprovação por e-mail. A ausência aparece na Agenda da equipe, e a pessoa e a liderança direta recebem o aviso.",
      corpo: formAusencia(p),
      rodape: '<button class="btn" data-acao="salvar-ausencia"' + (p ? ' data-id="' + esc(p.id) + '"' : "") + ">" + (p ? "Salvar" : "Registrar") + '</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: (painel) => ligarFormAusencia(painel, p ? p.id : ""),
    });
  };
  ui.acoes["salvar-ausencia"] = function (el) {
    const f = document.getElementById("form-ausencia");
    if (!ui.validar(f, ["pessoa", "tipo", "inicio"])) return;
    const d = ui.lerForm(f);
    const fim = d.tipo === "Day off" ? d.inicio : d.fim;
    if (!fim) { ui.validar(f, ["pessoa", "tipo", "inicio", "fim"]); return; }
    if (fim < d.inicio) { ui.erroNoPainel("O último dia vem antes do primeiro."); return; }
    const ctx = E().ctx;
    const pessoa = F.dadosDaPessoa(ctx, d.pessoa);
    const id = el.dataset.id;
    const dados = {
      tipo: d.tipo, motivoDayOff: d.tipo === "Day off" ? d.motivoDayOff || "" : "", inicio: d.inicio, fim, dias: F.diasCorridos(d.inicio, fim),
      justificativa: String(d.justificativa || "").trim(),
    };
    const oque = F.NOME_TIPO[d.tipo] + " (" + F.periodoCurto(Object.assign({}, dados)) + ")";
    ui.salvar(el, async () => {
      if (id) return ui.atualizar("ferias", id, dados);
      // registrada já aprovada: a decisão foi por e-mail
      const novo = await ui.criar("ferias", Object.assign({
        titulo: d.tipo + " · " + pessoa.nome, responsavel: d.pessoa, lideranca: pessoa.lideranca || "", autor: E().eu.id,
        estagio: "SUCCESS", rhDecisao: "Aprovada", rhEm: new Date().toISOString(),
      }, dados));
      // a liderança direta e a própria pessoa (o mesmo que o sino mostra), nunca quem registrou
      const eu = String(E().eu.id);
      if (pessoa.lideranca && pessoa.lideranca !== eu) await GP.app.avisar([pessoa.lideranca], "O RH registrou a ausência de " + pessoa.nome + ": " + oque + ". Ela já aparece na Agenda da equipe.");
      if (String(d.pessoa) !== eu) await GP.app.avisar([d.pessoa], "O RH registrou a sua ausência: " + oque + ". Ela já aparece na Agenda da equipe.");
      return novo;
    }, { mensagem: id ? "Ausência atualizada." : "Ausência registrada: " + pessoa.nome + ", " + oque + "." });
  };
  ui.acoes["excluir-ausencia"] = function (el) {
    const p = ausencia(el.dataset.id);
    if (!p) return;
    const nome = dom.pessoa(E().ctx, p.responsavel).nome;
    if (!window.confirm("Excluir a ausência de " + nome + " (" + F.periodoCurto(p) + ")? Ela sai da agenda e vai para a lixeira do CRM.")) return;
    ui.salvar(el, async () => {
      await ui.excluir("ferias", p.id);
      const eu = String(E().eu.id), oque = F.NOME_TIPO[p.tipo] + ", " + F.periodoCurto(p);
      if (p.lideranca && String(p.lideranca) !== eu) await GP.app.avisar([p.lideranca], "O RH tirou da agenda a ausência de " + nome + " (" + oque + ").");
      if (String(p.responsavel) !== eu) await GP.app.avisar([p.responsavel], "O RH tirou da agenda a sua ausência (" + oque + ").");
      ui.navegar("#/ferias");
    }, { mensagem: "Ausência excluída." });
  };

  /* ================================================================ PEDIR POR E-MAIL (qualquer pessoa) */
  const CONTRATOS = ["Associado", "PJ", "Estágio", "CLT"];
  function regrasHtml(tipo) {
    if (!tipo) return "";
    return '<div class="regras"><div class="rotulo">Regras de ' + esc(F.NOME_TIPO[tipo]) + "</div><ul>" + F.POLITICA[tipo].map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
      '<div class="rotulo">Como o pedido anda</div><ol>' + F.POLITICA.fluxo.map((x) => "<li><b>" + esc(x[0]) + ".</b> " + esc(x[1]) + "</li>").join("") + "</ol>" +
      '<label class="escolha li-regras"><input type="checkbox" name="lido"><span>Li as regras de ' + esc(F.NOME_TIPO[tipo]) + " e o fluxo do pedido</span></label></div>";
  }
  function camposHtml(pessoa) {
    const so = (tipos) => ' data-tipos="' + tipos + '"';
    const ctx = E().ctx;
    return '<div id="campos-ferias" hidden>' +
      '<div' + so("Day off") + ">" + c.campo({ nome: "motivoDayOff", rotulo: "Motivo do day off", tipo: "escolha", opcoes: GP.schema.OPCOES.motivoDayOff }) + "</div>" +
      (pessoa.contrato ? "" : c.campo({ nome: "contrato", rotulo: "Seu modelo de contrato", tipo: "lista", opcoes: CONTRATOS, opcional: true, ajuda: "O app não achou o seu contrato no cadastro. As regras mudam para estágio e CLT." })) +
      '<div class="linha-campos">' + c.campo({ nome: "inicio", rotulo: "Primeiro dia", tipo: "data", min: ctx.hoje }) +
      '<div' + so("Férias") + ">" + c.campo({ nome: "duracao", rotulo: "Duração", tipo: "lista", opcoes: [{ valor: "23", rotulo: "23 dias (de uma vez)" }, { valor: "15", rotulo: "15 dias (uma das partes)" }, { valor: "8", rotulo: "8 dias (uma das partes)" }, { valor: "outra", rotulo: "Outra duração" }] }) + "</div>" +
      '<div' + so("Pausa contratual,Férias-outra") + ">" + c.campo({ nome: "fim", rotulo: "Último dia", tipo: "data", min: ctx.hoje }) + "</div></div>" +
      '<div id="periodo-ferias" class="muted" style="font-size:12.5px;margin:-6px 0 14px"></div>' +
      '<div' + so("Férias,Pausa contratual") + ">" + c.campo({ nome: "cobertura", rotulo: "Como as suas atividades ficam cobertas no período?", tipo: "textoLongo", ajuda: "A política pede cobertura do time no período: quem assume o quê." }) + "</div>" +
      c.campo({ nome: "justificativa", rotulo: "Justificativa", tipo: "textoLongo", opcional: true, ajuda: "Obrigatória na pausa contratual e quando o pedido tem pontos fora da política." }) +
      '<div class="grupo-form"><div class="rotulo-grupo">Conferência com a política</div><div id="conferencia-ferias" class="muted">Preencha o período.</div></div></div>';
  }
  /** O pedido como está no formulário */
  function lerPedido(f) {
    const d = ui.lerForm(f);
    // o campo escondido guarda o que foi digitado antes da troca de tipo: o day off não leva cobertura
    const p = { tipo: d.tipo || "", motivoDayOff: d.tipo === "Day off" ? d.motivoDayOff || "" : "", inicio: d.inicio || "", cobertura: d.tipo === "Day off" ? "" : d.cobertura || "", justificativa: d.justificativa || "" };
    if (d.tipo === "Day off") p.fim = p.inicio;
    else if (d.tipo === "Férias" && d.duracao && d.duracao !== "outra") p.fim = p.inicio ? calc.addDias(p.inicio, Number(d.duracao) - 1) : "";
    else p.fim = d.fim || "";
    return { p, d };
  }
  function pessoaDoForm(d) {
    const pessoa = F.dadosDaPessoa(E().ctx, E().eu.id);
    if (!pessoa.contrato && d.contrato) pessoa.contrato = d.contrato;
    return pessoa;
  }
  function ligarFormFerias(el) {
    const f = el.querySelector("#form-ferias");
    const btn = el.querySelector('[data-acao="escrever-email"]');
    let tipoAtual = "";
    const atualizar = function () {
      const { p, d } = lerPedido(f);
      // tipo novo: as regras dele, e é preciso marcar de novo que leu
      if (d.tipo !== tipoAtual) {
        tipoAtual = d.tipo;
        f.querySelector("#regras-ferias").innerHTML = regrasHtml(d.tipo);
      }
      const lido = !!(f.querySelector('[name="lido"]') || {}).checked;
      f.querySelector("#campos-ferias").hidden = !lido;
      btn.disabled = !lido;
      f.querySelectorAll("[data-tipos]").forEach((x) => {
        const tipos = x.dataset.tipos.split(",");
        x.hidden = !(tipos.indexOf(d.tipo) >= 0 || (d.tipo === "Férias" && d.duracao === "outra" && tipos.indexOf("Férias-outra") >= 0));
      });
      const volta = p.fim ? calc.voltaEm(p.fim, dom.feriadosDe(E().ctx, pessoaDoForm(d).sigla)) : "";
      f.querySelector("#periodo-ferias").textContent = p.inicio && p.fim && p.fim >= p.inicio ? F.periodo(p) + (p.tipo !== "Day off" ? " · volta em " + calc.fmtDiaSemana(volta) + ", " + calc.fmtData(volta) : "") : "";
      const alvo = f.querySelector("#conferencia-ferias");
      if (!lido || !d.tipo) return;
      const conf = F.conferirPedido(E().ctx, p, pessoaDoForm(d));
      alvo.innerHTML = '<div class="checagem">' + conf.ok.map((x) => '<div class="ok"><span class="s">✓</span><span>' + esc(x) + "</span></div>").join("") +
        conf.fora.map((x) => '<div class="falta"><span class="s">!</span><span>' + esc(x) + "</span></div>").join("") + "</div>" +
        (conf.fora.length ? '<div class="aviso-atencao" style="margin-top:8px">O pedido pode seguir com pontos fora da política, com a justificativa. Quem decide é o RH.</div>' : "") +
        (conf.erros.length ? '<div class="muted" style="margin-top:8px">Falta: ' + esc(conf.erros.join(" ")) + "</div>" : "");
    };
    f.addEventListener("change", atualizar);
    f.addEventListener("input", (ev) => { if (ev.target.tagName === "TEXTAREA") return; atualizar(); });
    atualizar();
  }
  ui.acoes["pedir-por-email"] = function () {
    const pessoa = F.dadosDaPessoa(E().ctx, E().eu.id);
    const lid = pessoa.lideranca ? dom.pessoa(E().ctx, pessoa.lideranca).nome : "";
    ui.abrirPainel({
      titulo: "Pedir férias ou ausência", largo: true,
      sub: "Escolha o tipo, leia as regras e marque que leu. Depois, o app escreve o e-mail para o RH" + (lid ? ", com cópia para a sua liderança (" + esc(lid) + ")" : "") + ". O pedido vale pelo e-mail.",
      corpo: '<div id="form-ferias">' + c.campo({ nome: "tipo", rotulo: "O que você quer pedir?", tipo: "escolha", opcoes: F.TIPOS }) +
        '<div id="regras-ferias"></div>' + camposHtml(pessoa) + "</div>",
      rodape: '<button class="btn" data-acao="escrever-email" disabled>' + icone("email", 14) + ' Escrever o e-mail</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: ligarFormFerias,
    });
  };
  ui.acoes["escrever-email"] = function () {
    const f = document.getElementById("form-ferias");
    const { p, d } = lerPedido(f);
    if (!d.lido) { ui.erroNoPainel("Leia as regras e marque que leu."); return; }
    const ctx = E().ctx;
    const pessoa = pessoaDoForm(d);
    const conf = F.conferirPedido(ctx, p, pessoa);
    if (conf.erros.length) { ui.erroNoPainel(conf.erros.join(" ")); return; }
    const e = F.emailDoPedido(ctx, Object.assign({}, p, { foraDaPolitica: conf.fora.join("\n") }), pessoa);
    ui.fecharPainel(true); // o que foi digitado segue no e-mail: sem o "fechar sem salvar?"
    abrirEmail(e);
  };

  /* ================================================================ O E-MAIL PRONTO, PELA CAIXA DO BITRIX */
  // A Amorim usa o e-mail do Bitrix (04/11/2026): o app envia pela caixa de quem pede (mail.message.send, escopo
  // mail), e o e-mail fica nos enviados dela. A mensagem pode ser ajustada antes. Sem a permissão de e-mail no app,
  // "Abrir o e-mail do Bitrix" copia o texto e abre a tela de escrever do Bitrix sobre o app.
  let emailAberto = null;
  function abrirEmail(e) {
    emailAberto = e;
    ui.abrirPainel({
      titulo: "Enviar o e-mail ao RH", largo: true,
      sub: "A política pede o pedido por e-mail para " + esc(F.EMAIL_RH) + ", com cópia para a sua liderança direta. O e-mail sai pela sua caixa do Bitrix e fica nos seus enviados. O RH responde por e-mail e, aprovado, registra a ausência no app.",
      corpo: '<div class="email-pronto">' + c.dados([["Para", e.para], ["Cópia", e.cc.join(", ") || "—"], ["Assunto", e.assunto]]) +
        c.campo({ nome: "corpoEmail", rotulo: "Mensagem", tipo: "textoLongo", valor: e.corpo, linhas: 14, ajuda: "Pode ajustar o texto antes de enviar." }) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-email-bitrix">' + icone("email", 14) + " Enviar pelo e-mail do Bitrix</button>" +
        '<button class="btn sec" data-acao="abrir-email-bitrix">Abrir o e-mail do Bitrix</button>' +
        '<button class="btn sec" data-acao="copiar-email">Copiar</button><button class="btn link" data-acao="fechar-painel">Fechar</button>',
      // o texto já veio pronto: fechar sem enviar não pergunta "fechar sem salvar?"
      aoAbrir: (painel) => { const corpo = painel.querySelector("#painel-corpo"); if (corpo) corpo.dataset.limpo = "1"; },
    });
  }
  /** O e-mail como está no painel (a mensagem pode ter sido ajustada) */
  function emailAtual() {
    if (!emailAberto) return null;
    const t = document.querySelector('#painel [name="corpoEmail"]');
    return Object.assign({}, emailAberto, { corpo: t ? t.value : emailAberto.corpo });
  }
  function erroNoEnvio(texto) {
    const el = document.querySelector("#painel-rodape .erro-envio");
    if (el) el.innerHTML = '<div class="aviso-erro"><b>Não foi enviado.</b> ' + esc(texto) + "</div>";
  }
  /** Copia para a área de transferência. Dentro do Bitrix (iframe) o navigator.clipboard pode ser bloqueado, então
      tenta antes o comando de copiar, ainda no clique; se nada der certo, seleciona a mensagem para o Ctrl+C. */
  function copiarTexto(texto, depois) {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(t);
    if (ok) { depois(true); return; }
    let feito = false;
    const fim = (copiou) => {
      if (feito) return;
      feito = true;
      if (!copiou) { const m = document.querySelector('#painel [name="corpoEmail"]'); if (m) { m.focus(); m.select(); } }
      depois(copiou);
    };
    if (!(navigator.clipboard && navigator.clipboard.writeText)) { fim(false); return; }
    // sem a permissão do iframe, a promessa pode ficar parada: depois de 1,5 s vale como não copiado
    navigator.clipboard.writeText(texto).then(() => fim(true), () => fim(false));
    setTimeout(() => fim(false), 1500);
  }
  ui.acoes["enviar-email-bitrix"] = async function (el) {
    const e = emailAtual();
    if (!e || E().ocupado) return;
    if (!String(e.corpo || "").trim()) { erroNoEnvio("A mensagem está vazia."); return; }
    if (E().verComo) { erroNoEnvio("Em \"Ver como\", o e-mail sairia pela sua caixa, e não pela da pessoa."); return; }
    const repo = E().repo;
    const rotulo = el.innerHTML;
    E().ocupado = true;
    el.disabled = true;
    el.textContent = "Enviando...";
    try {
      const r = await repo.enviarEmail(e, E().eu.email);
      ui.fecharPainel(true);
      ui.avisar("E-mail enviado pela sua caixa do Bitrix" + (r && r.de ? " (" + r.de + ")" : "") + " para o RH" + (e.cc.length ? ", com cópia para a sua liderança" : "") + ". Ele fica nos seus enviados.");
    } catch (err) {
      console.warn("E-mail pelo Bitrix:", err);
      erroNoEnvio(err && err.semEscopo ? "O app ainda não tem a permissão de e-mail do Bitrix (falta o escopo \"mail\" no aplicativo; avise o TI). Por enquanto, use \"Abrir o e-mail do Bitrix\": o texto vai copiado."
        : err && err.codigo === "SEM_CAIXA" ? "Você não tem uma caixa de e-mail conectada no Bitrix. Conecte em Bitrix → E-mail, ou copie o texto."
        : err && err.semAcesso ? "O Bitrix não deixou enviar pela sua caixa (" + repo.mensagemErro(err) + "). Use \"Abrir o e-mail do Bitrix\": o texto vai copiado."
        : repo.mensagemErro(err) + ". Use \"Abrir o e-mail do Bitrix\": o texto vai copiado.");
    } finally {
      E().ocupado = false;
      if (document.body.contains(el)) { el.disabled = false; el.innerHTML = rotulo; }
    }
  };
  ui.acoes["abrir-email-bitrix"] = function () {
    const e = emailAtual();
    if (!e) return;
    // copia ainda no clique (o comando de copiar só vale nele) e abre a tela de escrever do Bitrix sem esperar
    copiarTexto(F.textoDoEmail(e), function (ok) {
      ui.avisar(ok ? "Texto copiado. No e-mail do Bitrix, cole (Ctrl+V) e confira o destinatário, a cópia e o assunto." : "Não consegui copiar sozinho: a mensagem está selecionada aqui no app, use Ctrl+C.", ok ? "" : "erro");
    });
    if (E().repo.abrirEmailBitrix) E().repo.abrirEmailBitrix();
  };
  ui.acoes["copiar-email"] = function () {
    const e = emailAtual();
    if (!e) return;
    copiarTexto(F.textoDoEmail(e), (ok) => ui.avisar(ok ? "E-mail copiado: cole no seu e-mail e envie." : "Não consegui copiar sozinho: a mensagem está selecionada, use Ctrl+C.", ok ? "" : "erro"));
  };

  /* ================================================================ MEU ANIVERSÁRIO */
  /** Grava no perfil do Bitrix (o lugar de onde a agenda já lê); a data vem preenchida quando o perfil já tem */
  ui.acoes["meu-aniversario"] = function () {
    if (E().verComo) { ui.avisar("Em \"Ver como\", o aniversário só pode ser cadastrado pela própria pessoa.", "erro"); return; }
    const eu = E().eu;
    ui.abrirPainel({
      titulo: "Meu aniversário", sub: "Fica no seu perfil do Bitrix. No app aparecem só o dia e o mês: na agenda da equipe e no day off do mês do aniversário.",
      corpo: '<div id="form-aniversario">' + c.campo({ nome: "nascimento", rotulo: "Data de nascimento", tipo: "data", valor: eu.nascimento || "", max: E().ctx.hoje,
        ajuda: eu.nascimento ? "Preenchida com a data que já está no seu perfil do Bitrix." : "O seu perfil do Bitrix ainda não tem a data." }) + "</div>",
      rodape: '<button class="btn" data-acao="salvar-aniversario">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["salvar-aniversario"] = function (el) {
    const f = document.getElementById("form-aniversario");
    if (!ui.validar(f, ["nascimento"])) return;
    const data = ui.lerForm(f).nascimento;
    if (data > E().ctx.hoje) { ui.erroNoPainel("A data de nascimento não pode ficar no futuro."); return; }
    ui.salvar(el, async () => {
      await E().repo.salvarAniversario(E().eu.id, data);
      E().eu.nascimento = data;
      const u = E().ctx.idx.usuario[String(E().eu.id)];
      if (u) u.aniversario = data.slice(5, 10);
      dom.indexar(E().ctx);
    }, { mensagem: "Aniversário salvo no seu perfil do Bitrix: " + calc.fmtData(data) + "." });
  };

  GP.telas = GP.telas || {};
  GP.telas.ferias = { abrirEmail, politicaHtml };
})(window);
