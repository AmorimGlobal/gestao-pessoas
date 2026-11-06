/* =====================================================================================
   TELAS — Revisão de Progresso (protótipo do RH "Revisao_de_Progresso_Prototipo.html", 05/11/2026)
   -------------------------------------------------------------------------------------
   As regras ficam em 58-revisao.js e a matriz dos cargos em 57-revisao-matriz.js.
   - RH: prepara e abre o ciclo (#/revisao/ciclo), confere quem participa, calibra cada avaliação
     enviada, lê o relatório 360° só com os mínimos (#/revisao/relatorio) e registra os retornos.
   - Liderança direta: avalia cada liderado (#/revisao/membro/<id>). Rascunho a qualquer hora; envio
     ao RH só com o ciclo aberto. Lê a autoavaliação depois do envio. Depois da calibração, registra a
     devolutiva (vai para o membro) com o PDI e a promoção (só o RH).
   - Quem participa: a autoavaliação (#/revisao/auto), a 360° dos superiores e pares (#/revisao/360)
     e os retornos do ciclo, com a ciência da devolutiva (#/revisao/retornos).
   Os formulários abrem no painel lateral, como no resto do app: o render() não apaga o que foi digitado.
   A 360° nunca é gravada pelo navegador: vai para o servidor (api/revisao360.js), que grava sem autor.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const R = GP.revisao, MZ = GP.revisaoMatriz;
  const E = () => ui.estado;
  const X = () => E().ctx;
  const eu = () => E().eu;
  const ehRH = () => E().visao === "rh";
  const semEstrutura = () => !!(X().recursos && X().recursos.revisao === false);
  const nomeDe = (uid) => dom.pessoa(X(), uid).nome;
  const nomeCargo = (codigo) => (codigo ? R.rotuloCargo(E().config, codigo) : "sem cargo na matriz");
  const fmt = (d) => (d ? calc.fmtDataAno(String(d).slice(0, 10)) : "—");
  const pad = (n) => String(n).padStart(2, "0");
  const voltar = () => c.voltar("#/revisao", "Revisão de Progresso");
  const cartao = (titulo, corpo, extra, cls) => '<div class="card' + (cls ? " " + cls : "") + '"><h3>' + esc(titulo) + (extra ? '<span class="extra muted">' + extra + "</span>" : "") + "</h3>" + corpo + "</div>";
  const secao = (titulo, sub, corpo) => '<div class="rv-secao"><div class="rv-secao-t">' + esc(titulo) + (sub ? ' <span class="muted">· ' + esc(sub) + "</span>" : "") + "</div>" + corpo + "</div>";
  const NIVEIS_KPI = R.NIVEIS_KPI.map((x) => x.valor);
  const NIVEIS_COMP = R.NIVEIS_COMP.map((y) => ({ valor: String(y.n), rotulo: y.n + " · " + y.rotulo }));
  const DIMENSOES = ["Colaboração", "Valor para o cliente", "Autonomia e organização", "Pensamento e aprendizado", "Liderança"];

  /** Só o que foi preenchido vai para o JSON do Bitrix */
  function soPreenchidos(d) {
    const o = {};
    Object.keys(d || {}).forEach((k) => {
      const v = d[k];
      if (v === "" || v === false || v === null || v === undefined || (Array.isArray(v) && !v.length)) return;
      o[k] = typeof v === "string" ? v.trim() : v;
    });
    return o;
  }
  /** Depois de salvar o rascunho, o painel deixa de contar como "com alterações" */
  function marcarLimpo() {
    const corpo = document.getElementById("painel-corpo");
    if (corpo) corpo.querySelectorAll("textarea, input[type=text]").forEach((x) => { x.defaultValue = x.value; });
  }
  function erroNoRodape(texto) {
    const el = document.querySelector("#painel-rodape .erro-envio");
    if (el) el.innerHTML = '<div class="aviso-erro">' + texto + "</div>";
  }
  const quem = () => eu().nome + (E().verComo && E().euReal ? " (registrado por " + E().euReal.nome + ")" : "");

  /** O que esta pessoa pode fazer com a revisão de um membro */
  function acessoAo(m) {
    const a = { avaliar: false, rh: false, ler: false };
    if (!m) return a;
    a.avaliar = dom.liderancaEfetiva(X(), m) === String(eu().id) && String(m.responsavel) !== String(eu().id);
    a.rh = ehRH();
    a.ler = a.avaliar || a.rh || (E().visao === "coordenacao" && ui.membrosDaVisao().some((x) => x.id === m.id));
    return a;
  }
  /** Eu participo do ciclo? Sem leitura do próprio item do Membros (permissão do CRM), deixa responder: a liderança acha pelo responsável */
  function minhaParticipacao(ciclo) {
    const pc = (E().config && E().config.papeis) || {};
    if ((pc.excecoes || []).concat(pc.ceo || []).some((p) => String(p.id) === String(eu().id))) return { ok: false, motivo: "fora do app (Configuração → Papéis)" };
    const m = X().idx.membroPorUsuario[String(eu().id)];
    if (!m) return { ok: true, semItem: true, motivo: "" };
    return R.participa(X(), ciclo, m);
  }
  function avisoSemEstrutura() {
    return '<div class="aviso-atencao" style="margin-bottom:16px"><b>As tabelas da Revisão de Progresso ainda não existem no CRM do Bitrix.</b> ' +
      (eu().admin ? 'Abra <a href="#/config">Configuração</a> e clique em "Criar ou completar a estrutura". Depois, dê as permissões da seção 14 do guia (docs/configuracao-bitrix.md).' : "Avise o TI: falta criar a estrutura no Bitrix.") + "</div>";
  }

  /* ================================================================ escalas, glossário e guia */
  function escalasHtml() {
    return '<details class="modelos rv-escalas"><summary>Como ler os níveis · entrega (KPIs) e competência (1 a 4)</summary><div class="modelo">' +
      R.NIVEIS_KPI.map((x) => "<div><b>" + esc(x.valor) + "</b> · " + esc(x.desc) + "</div>").join("") + '<div style="height:8px"></div>' +
      R.NIVEIS_COMP.map((x) => "<div><b>" + x.n + " · " + esc(x.rotulo) + "</b> · " + esc(x.desc) + "</div>").join("") + "</div></details>";
  }
  function glossarioHtml() {
    const porDim = {};
    MZ.GLOSSARIO.forEach((g) => { (porDim[g.dimensao] = porDim[g.dimensao] || []).push(g); });
    return '<details class="modelos"><summary>Glossário de competências · ' + MZ.GLOSSARIO.length + " competências padronizadas</summary>" +
      Object.keys(porDim).map((d) => '<div class="modelo"><b>' + esc(d) + "</b> (" + porDim[d].length + ")" + porDim[d].map((g) => '<div style="margin-top:6px"><b>' + esc(g.nome) + "</b>: " + esc(g.descricao) +
        (g.comoAvaliar ? ' <span class="muted">Como avaliar: ' + esc(g.comoAvaliar) + "</span>" : "") + "</div>").join("") + "</div>").join("") + "</details>";
  }
  function guiaHtml() {
    const membro = E().visao === "membro";
    const t = membro ? [
      ["Minha autoavaliação", "Quem lê: sua liderança direta e o RH. Mais ninguém. Sua liderança lê só depois de enviar a avaliação dela ao RH, para não ser influenciada. Responda com fatos, números e exemplos; depois de enviar, você não edita mais."],
      ["Avaliação 360°", "Você avalia seus superiores (o imediato e, quando houver supervisão, quem está acima dela) e seus pares (mesma liderança direta). Avalie só quem você acompanha de perto: se não for o caso, pule. Em cada afirmação existe \"Não sei avaliar\"."],
      ["Anônima ou identificada", "Anônima: seu nome não é gravado e nem o RH sabe quem escreveu; evite detalhes que só você viveu. Identificada: seu nome fica visível só para o RH, que pode te procurar para entender um ponto. Em grupos pequenos, sua resposta só é usada junto com as de outras pessoas da área."],
      ["Para onde vai", "Só para o RH. A pessoa avaliada não recebe o que você escreveu. Depois do ciclo, o RH leva a ela temas resumidos, sem identificar ninguém e sem trechos literais."],
    ] : [
      ["Como funciona o ciclo", "O RH abre os ciclos em junho e novembro. Fora do ciclo, você pode iniciar rascunhos e registrar evidências ao longo do semestre: nada vai ao RH e o membro não vê. Quando o RH abre o ciclo, o rascunho vira a avaliação do ciclo: você revisa e envia."],
      ["Passo a passo", "Clique no liderado e depois em Iniciar avaliação (ou Iniciar rascunho, fora do ciclo). Avalie cada KPI e cada competência, com evidência, e envie ao RH: o contador no rodapé mostra quantos itens faltam. Leia a autoavaliação do membro, liberada depois do seu envio. Depois da calibração do RH, faça a conversa de devolutiva e registre o que foi combinado."],
      ["Para onde vai cada coisa", "O formulário fica com você e o RH: o membro não recebe o formulário. Na devolutiva, você leva ao membro os pontos em palavras e as metas do próximo semestre. O PDI e a seção Promoção ficam só com o RH. Depois da conversa, o membro confirma a ciência no app dele."],
      ["Quando algo não faz sentido para a função", "Você tem autonomia: dentro de cada KPI e competência há a opção Ajustar (texto, meta ou nível mínimo) ou Não se aplica neste ciclo, e no fim de cada seção dá para incluir até 2 itens. O ajuste vale na hora, sem aprovação: o RH só recebe o registro do que mudou."],
      ["Como escrever a evidência", "Modelo SCI: Situação, Comportamento e Impacto. Fatos e dados, não impressões; entregas e resultados, não horas trabalhadas. Ex.: \"Na reunião de 12/09 com o lead [Situação], fez três perguntas antes de qualificar [Comportamento], e a oportunidade avançou sem devolução [Impacto].\""],
    ];
    return '<details class="card politica"><summary>Guia de preenchimento</summary><div class="corpo-politica">' + t.map((x) => "<h4>" + esc(x[0]) + "</h4><p>" + esc(x[1]) + "</p>").join("") + "</div></details>" +
      (membro ? "" : escalasHtml());
  }

  /* ================================================================ o ciclo (cabeçalho das telas) */
  function cicloHtml(ci) {
    const hoje = X().hoje;
    const prazos = [ci.prazoAuto, ci.prazoLideranca, ci.prazoCalibracao, ci.prazoDevolutiva, ci.prazoRetornos];
    const feito = (i) => ci.estagio === "SUCCESS" || (prazos[i] && prazos[i] < hoje);
    const atual = ci.estagio === "ABERTO" ? R.ETAPAS.findIndex((_, i) => !feito(i)) : -1;
    return '<div class="card"><h3>' + esc(ci.ciclo || "Ciclo") + '<span class="extra">' + c.tag(ci.estagioNome || ci.estagio, ci.estagio === "ABERTO" ? "verde" : ci.estagio === "NEW" ? "ambar" : "cinza") + "</span></h3>" +
      '<div class="passos">' + R.ETAPAS.map((t, i) => '<span class="p ' + (i === atual ? "atual" : feito(i) ? "feito" : "") + '">' + esc(t) + (prazos[i] ? " · até " + calc.fmtData(prazos[i]) : "") + "</span>").join("") + "</div>" +
      c.dados([["Período avaliado", fmt(ci.periodoInicio) + " a " + fmt(ci.periodoFim)], ["Abertura", fmt(ci.dataAbertura)]]) +
      (ci.mensagem && E().visao !== "membro" ? '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Mensagem do RH para as lideranças", ci.mensagem) + "</div>" : "") + "</div>";
  }
  /** Cor da situação da avaliação na lista */
  function tagSituacao(s, ciclo) {
    if (s.ciencia) return c.tag("Ciência confirmada", "verde");
    const cor = { NEW: ciclo ? "ambar" : "azul", ENVIADA: "azul", CALIBRADA: "ambar", DEVOLUTIVA: "verde", SUCCESS: "verde" }[s.avaliacaoEstagio] || "cinza";
    return c.tag(s.avaliacao, cor);
  }
  function linhaMembro(m, ciclo, comLider) {
    const ctx = X(), s = R.situacaoDo(ctx, ciclo, m), u = dom.pessoa(ctx, m.responsavel);
    return '<div class="item clicavel" data-rota="#/revisao/membro/' + esc(m.id) + '">' + c.avatar(u, 30) +
      '<div class="principal-item"><div class="t">' + esc(u.nome) + '</div><div class="d">' + esc(nomeCargo(R.cargoDo(m)) + (comLider ? " · liderança: " + nomeDe(dom.liderancaEfetiva(ctx, m)) : "")) + "</div></div>" +
      '<div class="lado">' + (ciclo && s.auto ? c.tag(s.auto, s.autoEnviada ? "verde" : "cinza") : "") + tagSituacao(s, ciclo) + "</div></div>";
  }

  /* ================================================================ INÍCIO DA REVISÃO */
  ui.rotas.revisao = function (partes) {
    const p = partes[0];
    if (p === "ciclo") return telaCiclo();
    if (p === "membro") return telaMembro(partes[1]);
    if (p === "auto") return telaAuto();
    if (p === "360") return tela360();
    if (p === "retornos") return telaRetornos();
    if (p === "relatorio") return telaRelatorio();
    if (p === "matriz") return telaMatriz(partes[1]);
    return telaInicio();
  };

  function telaInicio() {
    const ctx = X();
    const ciclo = R.cicloAberto(ctx), ultimo = ciclo || R.ultimoCiclo(ctx);
    const rasc = ehRH() ? R.cicloRascunho(ctx) : null;
    let acoes = "";
    if (ehRH() && !semEstrutura()) acoes += '<a class="btn" href="#/revisao/ciclo">' + (ciclo ? "O ciclo aberto" : rasc ? "Continuar a abertura do ciclo" : "Preparar a abertura do ciclo") + "</a>" +
      (ultimo ? '<a class="btn sec" href="#/revisao/relatorio">Relatório 360°</a>' : "");
    if (E().visao !== "membro") acoes += '<a class="btn sec" href="#/revisao/matriz">Matrizes dos cargos</a>';
    let h = c.cabecalho("desempenho", "Revisão de Progresso", ciclo ? "<span>" + c.tag("Ciclo aberto", "verde") + "</span><span>" + esc(ciclo.ciclo) + "</span>"
      : "<span>" + c.tag("Nenhum ciclo aberto", "cinza") + "</span><span>aberturas em junho e novembro</span>", acoes);
    if (semEstrutura()) return h + avisoSemEstrutura();
    if (ultimo) h += cicloHtml(ultimo);
    else h += '<div class="aviso-info" style="margin-bottom:16px">' + (ehRH() ? "Nenhum ciclo ainda. Prepare a abertura: período, prazos, quem participa e as regras da 360°."
      : "O RH abre os ciclos em junho e novembro." + (E().visao === "membro" ? " A autoavaliação e a 360° aparecem aqui quando o ciclo abrir." : " Fora do ciclo, você já pode iniciar rascunhos das avaliações da sua equipe.")) + "</div>";
    h += minhaParteHtml(ciclo, ultimo);
    if (E().visao !== "membro") h += equipeHtml(ciclo);
    if (ehRH() && ciclo) h += rhHtml(ciclo);
    h += guiaHtml();
    return h;
  }

  /** A parte de quem está na tela: autoavaliação, 360° e retornos */
  function minhaParteHtml(ciclo, ultimo) {
    const ctx = X(), id = String(eu().id);
    const linhas = [];
    if (ciclo) {
      const part = minhaParticipacao(ciclo);
      if (part.ok) {
        const a = R.autoavaliacaoDe(ctx, id, ciclo);
        linhas.push(['#/revisao/auto', "Minha autoavaliação", "5 perguntas sobre as suas entregas · até " + calc.fmtData(ciclo.prazoAuto),
          a && a.estagio === "SUCCESS" ? c.tag("Enviada", "verde") : a ? c.tag("Rascunho", "ambar") : c.tag("A responder", "ambar")]);
      } else linhas.push(["", "Minha autoavaliação", "Você não participa deste ciclo: " + part.motivo + ".", c.tag("Fora do ciclo", "cinza")]);
      const regras = R.regrasDo(ciclo);
      if (regras.liberarLideranca || regras.liberarPares) {
        const alvo = (regras.liberarLideranca ? R.superioresDe(ctx, id) : []).concat(regras.liberarPares ? R.paresDe(ctx, id) : []);
        const ctrl = controle360(ciclo);
        const feitos = alvo.filter((x) => ctrl.e.indexOf(x.uid) >= 0 || ctrl.p.indexOf(x.uid) >= 0).length;
        linhas.push(["#/revisao/360", "Avaliação 360°", alvo.length ? "Seus superiores e pares · " + feitos + " de " + alvo.length + " respondidas ou puladas" : "Ninguém para você avaliar pela estrutura do Bitrix",
          alvo.length && feitos < alvo.length ? c.tag("Pendente", "ambar") : c.tag(alvo.length ? "Concluída" : "—", alvo.length ? "verde" : "cinza")]);
      }
    }
    const cicloRet = ciclo || ultimo;
    const ret = cicloRet ? R.retornoDe(ctx, id, cicloRet) : null;
    if (ciclo || ret) linhas.push(["#/revisao/retornos", "Seus retornos", "Da sua liderança (devolutiva) e do RH, depois da calibração",
      ret && ret.devolutivaEm && !ret.cienciaEm ? c.tag("Confirme a ciência", "ambar") : ret && ret.cienciaEm ? c.tag("Ciência confirmada", "verde") : c.tag("Aguardando", "cinza")]);
    if (!linhas.length) return "";
    return cartao(ciclo ? "Sua parte neste ciclo" : "Seus retornos", '<div class="lista">' + linhas.map((l) => '<div class="item' + (l[0] ? " clicavel" : "") + '"' + (l[0] ? ' data-rota="' + l[0] + '"' : "") + '><div class="principal-item"><div class="t">' + esc(l[1]) +
      '</div><div class="d">' + esc(l[2]) + '</div></div><div class="lado">' + l[3] + "</div></div>").join("") + "</div>");
  }

  function equipeHtml(ciclo) {
    const ctx = X(), id = String(eu().id);
    const equipe = dom.equipeDe(ctx, id);
    let h = "";
    if (equipe.length) {
      const dentro = ciclo ? equipe.filter((m) => R.participa(ctx, ciclo, m).ok) : R.equipeNoCiclo(ctx, id, null);
      const ids = dentro.map((m) => m.id);
      const fora = equipe.filter((m) => ids.indexOf(m.id) < 0);
      h += cartao("Sua equipe direta", (dentro.length ? '<div class="lista">' + dentro.map((m) => linhaMembro(m, ciclo)).join("") + "</div>"
        : c.vazio(ciclo ? "Ninguém da sua equipe direta participa deste ciclo." : "Ninguém da sua equipe tem cargo na matriz ainda: o RH define no cadastro de cada membro.")) +
        (fora.length ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Fora ' + (ciclo ? "deste ciclo" : "da matriz") + ": " + esc(fora.map((m) => nomeDe(m.responsavel) + " (" + (ciclo ? R.participa(ctx, ciclo, m).motivo : "sem cargo na matriz") + ")").join("; ")) + ".</p>" : ""),
        ciclo ? "envio ao RH até " + calc.fmtData(ciclo.prazoLideranca) : "fora do ciclo: só rascunho");
    }
    // coordenação: as equipes das lideranças que ela coordena, para acompanhar (quem avalia é a liderança direta)
    if (E().visao === "coordenacao" && ciclo) {
      const ids = equipe.map((m) => m.id);
      const outros = ui.membrosDaVisao().filter((m) => ids.indexOf(m.id) < 0 && R.participa(ctx, ciclo, m).ok);
      if (outros.length) h += cartao("Equipes da sua coordenação", '<div class="lista">' + outros.map((m) => linhaMembro(m, ciclo, true)).join("") + "</div>", "para acompanhar · quem avalia é a liderança direta");
    }
    return h;
  }

  function rhHtml(ciclo) {
    const ctx = X();
    const part = R.participantes(ctx, ciclo);
    const dentro = part.filter((x) => x.ok), fora = part.filter((x) => !x.ok);
    const sit = dentro.map((x) => Object.assign({ m: x.m }, R.situacaoDo(ctx, ciclo, x.m)));
    const conta = (f) => sit.filter(f).length;
    const enviada = (s) => !!(s.item && s.item.cicloId && ["ENVIADA", "CALIBRADA", "DEVOLUTIVA", "SUCCESS"].indexOf(s.avaliacaoEstagio) >= 0);
    let h = c.kpis([
      { valor: dentro.length, rotulo: "participantes", tom: "azul" },
      { valor: conta((s) => s.autoEnviada), rotulo: "autoavaliações recebidas", tom: "roxo" },
      { valor: conta(enviada), rotulo: "avaliações enviadas", tom: "azul" },
      { valor: conta((s) => s.avaliacaoEstagio === "ENVIADA"), rotulo: "aguardando calibração", tom: "ambar" },
      { valor: conta((s) => s.ciencia), rotulo: "ciências confirmadas", tom: "verde" },
    ]);
    const aguardam = sit.filter((s) => s.avaliacaoEstagio === "ENVIADA");
    if (aguardam.length) h += cartao("Aguardando a calibração do RH", '<div class="lista">' + aguardam.map((s) => linhaMembro(s.m, ciclo, true)).join("") + "</div>", "até " + calc.fmtData(ciclo.prazoCalibracao), "acao");
    h += cartao("Todos os participantes", '<div class="lista">' + dentro.map((x) => linhaMembro(x.m, ciclo, true)).join("") + "</div>", plural(dentro.length, "pessoa", "pessoas"));
    if (fora.length) h += cartao("Fora deste ciclo", '<div class="lista">' + fora.map((x) => '<div class="item clicavel" data-rota="#/membro/' + esc(x.m.id) + '">' + c.avatar(dom.pessoa(ctx, x.m.responsavel), 30) +
      '<div class="principal-item"><div class="t">' + esc(nomeDe(x.m.responsavel)) + '</div><div class="d">' + esc(x.motivo) + "</div></div></div>").join("") + "</div>" +
      '<p class="muted" style="font-size:12px;margin:10px 0 0">O cargo na matriz fica no cadastro do membro (Minha equipe → membro → Editar cadastro). As exceções do ciclo ficam na abertura.</p>', plural(fora.length, "pessoa", "pessoas"));
    return h;
  }

  /* ================================================================ A REVISÃO DE UM MEMBRO */
  function telaMembro(id) {
    const ctx = X();
    const m = ctx.idx.membro[id];
    if (!m) return voltar() + '<div class="card">' + c.vazio("Membro não encontrado ou fora da sua visão.") + "</div>";
    const a = acessoAo(m);
    if (!a.ler) return voltar() + '<div class="card">' + c.vazio("A avaliação deste membro fica com a liderança direta e o RH.") + "</div>";
    const ciclo = R.cicloAberto(ctx);
    const u = dom.pessoa(ctx, m.responsavel);
    const codigo = R.cargoDo(m);
    const cargo = R.matrizDo(m);
    const av = R.avaliacaoDo(ctx, m.id, ciclo);
    const enviada = R.avaliacaoEnviada(av);
    const auto = R.autoavaliacaoDe(ctx, m.responsavel, ciclo);
    const ret = R.retornoDe(ctx, m.responsavel, ciclo);
    const s = R.situacaoDo(ctx, ciclo, m);
    const part = ciclo ? R.participa(ctx, ciclo, m) : { ok: !!codigo, motivo: codigo ? "" : "sem cargo na matriz (o RH define no cadastro do membro)" };
    let h = voltar() + c.cabecalho("desempenho", u.nome, "<span>" + esc(nomeCargo(codigo)) + "</span><span>" + tagSituacao(s, ciclo) + "</span>");
    if (semEstrutura()) return h + avisoSemEstrutura();
    h += '<div class="card">' + c.dados([["Ciclo", ciclo ? ciclo.ciclo : "Fora do ciclo · rascunho"], ["Período avaliado", ciclo ? fmt(ciclo.periodoInicio) + " a " + fmt(ciclo.periodoFim) : "definido pelo RH na abertura"],
      ["Matriz do cargo", cargo ? plural(cargo.kpis.length, "KPI", "KPIs") + " · " + plural(cargo.competencias.length, "competência", "competências") : "—"], ["Liderança direta", nomeDe(dom.liderancaEfetiva(ctx, m))]]) +
      (!part.ok ? '<div class="aviso-atencao" style="margin-top:14px">' + (ciclo ? "Fora deste ciclo: " : "") + esc(part.motivo) + ".</div>" : "") + "</div>";
    if (!cargo) return h;

    // as três etapas da liderança
    const passo = (n, titulo, texto, botoes, estado) => '<div class="rv-etapa ' + (estado || "") + '"><div class="rv-etapa-n">Etapa ' + n + '</div><div class="rv-etapa-c"><div class="t">' + esc(titulo) + '</div><div class="d">' + texto + "</div>" + (botoes ? '<div class="rv-etapa-b">' + botoes + "</div>" : "") + "</div></div>";
    let b1 = "";
    if (a.avaliar && part.ok && !enviada) b1 = '<button class="btn" data-acao="rev-avaliar" data-id="' + esc(m.id) + '">' + (av ? (ciclo ? "Continuar a avaliação" : "Continuar o rascunho") : (ciclo ? "Iniciar avaliação" : "Iniciar rascunho")) + "</button>";
    const t1 = enviada ? "Enviada ao RH em " + fmt(av.enviadaEm) + "." : av ? (ciclo ? "Rascunho em andamento. " : "Rascunho fora do ciclo: nada vai ao RH agora. ") + "Se houver rascunho, ele já vem preenchido." : ciclo ? "KPIs e competências do cargo, com evidência. Envio ao RH até " + calc.fmtData(ciclo.prazoLideranca) + "." : "Fora do ciclo você só salva o rascunho.";
    const t2 = !ciclo ? "A autoavaliação é liberada ao membro na abertura do ciclo." : !(enviada || a.rh) ? "Liberada depois que você enviar sua avaliação ao RH, para que ela não influencie a sua." : auto && auto.estagio === "SUCCESS" ? "Recebida em " + fmt(auto.enviadaEm) + ". Abaixo, ao lado da sua avaliação." : "O membro ainda não enviou a autoavaliação.";
    let b3 = "";
    if (a.avaliar && av && ["CALIBRADA", "DEVOLUTIVA"].indexOf(av.estagio) >= 0 && !(ret && ret.cienciaEm)) b3 = '<button class="btn' + (av.estagio === "DEVOLUTIVA" ? " sec" : "") + '" data-acao="rev-devolutiva" data-id="' + esc(m.id) + '">' + (av.estagio === "DEVOLUTIVA" ? "Editar a devolutiva" : "Registrar a devolutiva") + "</button>";
    const t3 = ret && ret.cienciaEm ? "Devolutiva em " + fmt(ret.devolutivaEm) + " · o membro confirmou a ciência em " + fmt(ret.cienciaEm) + "." : av && av.estagio === "DEVOLUTIVA" ? "Devolutiva registrada em " + fmt(av.devolutivaEm) + " · aguardando a ciência do membro." :
      av && av.estagio === "CALIBRADA" ? "Calibração concluída: converse com o membro e registre o que foi combinado" + (ciclo && ciclo.prazoDevolutiva ? " até " + calc.fmtData(ciclo.prazoDevolutiva) : "") + "." : "Depois da calibração do RH: a conversa com o membro, até 3 ações do PDI e as metas do próximo semestre.";
    h += cartao("Etapas", passo(1, "Avaliação da liderança", esc(t1), b1, enviada ? "feito" : "atual") + passo(2, "Autoavaliação do membro", esc(t2), "", auto && auto.estagio === "SUCCESS" && (enviada || a.rh) ? "feito" : "") +
      passo(3, "Devolutiva e PDI", esc(t3), b3, ret && ret.cienciaEm ? "feito" : av && av.estagio === "CALIBRADA" ? "atual" : ""));

    // RH: calibração e retornos
    if (a.rh && av && enviada) {
      const cal = R.lerJSON(av.calibracao);
      const bt = av.estagio === "ENVIADA" ? '<button class="btn" data-acao="rev-calibrar" data-id="' + esc(av.id) + '">Registrar a calibração</button><button class="btn link" data-acao="rev-devolver" data-id="' + esc(av.id) + '">Devolver à liderança</button>'
        : av.estagio === "CALIBRADA" ? '<button class="btn sec" data-acao="rev-calibrar" data-id="' + esc(av.id) + '">Editar a calibração</button>' : "";
      h += cartao("Calibração (RH)", (av.calibradaEm ? c.dados([["Houve ajuste de nível?", cal.calib_ajuste], ["Data da calibração", fmt(cal.calib_data)]]) + '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Ajuste, motivo e evidência", cal.calib_detalhe) + "</div>"
        : '<p class="muted" style="margin:0">Depois da reunião de calibração, registre se houve ajuste de nível, o motivo e a evidência. A liderança é avisada para fazer a devolutiva.</p>') +
        (bt ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' + bt + "</div>" : ""), av.estagio === "ENVIADA" ? "até " + calc.fmtData(ciclo && ciclo.prazoCalibracao) : "", av.estagio === "ENVIADA" ? "acao" : "");
    }
    if (av && (enviada || a.avaliar) && (a.avaliar || a.rh || enviada)) h += avaliacaoHtml(m, av, { decisao: a.avaliar || a.rh, calibracao: a.avaliar && !a.rh && av.calibradaEm, pdi: a.avaliar || a.rh });
    if (ciclo && (a.rh || (a.avaliar && enviada)) && auto && auto.estagio === "SUCCESS") h += autoavaliacaoHtml(auto);
    if (ret && (ret.devolutivaEm || a.rh)) h += devolutivaHtml(ret, a.rh);
    if (a.rh && ciclo) h += retornoRHHtml(m, ret);
    return h;
  }

  /** A avaliação da liderança, para ler (liderança, RH e coordenação) */
  function avaliacaoHtml(m, av, o) {
    const cargo = MZ.CARGOS[av.cargo] || R.matrizDo(m);
    const v = R.lerJSON(av.avaliacao);
    const bloco = (titulo, tags, texto, sub) => '<div class="rv-lido"><div class="rv-lido-t">' + titulo + '<span class="rv-lido-tags">' + tags + "</span></div>" + (sub ? '<div class="muted rv-sub">' + sub + "</div>" : "") + (texto ? '<div class="texto-registro">' + esc(texto) + "</div>" : "") + "</div>";
    const kpis = cargo.kpis.map((k, i) => {
      const p = "kpi_" + (i + 1) + "_";
      const ns = v[p + "ajuste"] === "nao_se_aplica";
      return bloco('<span class="rv-n">' + pad(i + 1) + "</span>" + esc(v[p + "ajuste"] === "ajustar" && v[p + "aj_indicador"] ? v[p + "aj_indicador"] : k.indicador),
        ns ? c.tag("não se aplica neste ciclo", "cinza") : (v[p + "nivel"] ? c.tag(v[p + "nivel"], v[p + "nivel"] === "Ainda não alcança" ? "ambar" : "azul") : c.tag("sem nível", "cinza")) + (v[p + "ajuste"] === "ajustar" ? " " + c.tag("ajustado", "cinza") : ""),
        ns ? "" : v[p + "evidencia"], ns ? "" : "Meta: " + esc(v[p + "aj_meta"] || k.meta) + (v[p + "resultado"] ? " · resultado: <b>" + esc(v[p + "resultado"]) + "</b>" : ""));
    }).join("") + [1, 2].filter((e) => v["kpi_extra_" + e + "_indicador"]).map((e) => {
      const p = "kpi_extra_" + e + "_";
      return bloco('<span class="rv-n">+' + e + "</span>" + esc(v[p + "indicador"]), (v[p + "entrega"] ? c.tag(v[p + "entrega"], "azul") : "") + " " + c.tag("KPI novo", "cinza"), v[p + "evidencia"], "Meta: " + esc(v[p + "meta"] || "—") + (v[p + "resultado"] ? " · resultado: <b>" + esc(v[p + "resultado"]) + "</b>" : ""));
    }).join("");
    const comps = cargo.competencias.map((x, i) => {
      const p = "comp_" + (i + 1) + "_";
      const ns = v[p + "ajuste"] === "nao_se_aplica";
      const min = v[p + "ajuste"] === "ajustar" && v[p + "minprop"] ? v[p + "minprop"] : x.minimo;
      const sm = R.situacaoMinimo(v[p + "nivel"], min);
      return bloco('<span class="rv-n">' + pad(i + 1) + "</span>" + esc(v[p + "ajuste"] === "ajustar" && v[p + "aj_descricao"] ? v[p + "aj_descricao"] : x.nome),
        ns ? c.tag("não se aplica neste ciclo", "cinza") : (v[p + "nivel"] ? c.tag(R.rotuloNivel(v[p + "nivel"]), "azul") : c.tag("sem nível", "cinza")) + (sm ? " " + c.tag(sm.texto, sm.cor) : "") + (v[p + "ajuste"] === "ajustar" ? " " + c.tag("ajustada", "cinza") : ""),
        ns ? "" : v[p + "evidencia"], esc(x.dimensao) + " · mínimo " + esc(R.rotuloNivel(min)));
    }).join("") + [1, 2].filter((e) => v["comp_extra_" + e + "_nome"]).map((e) => {
      const p = "comp_extra_" + e + "_";
      const sm = R.situacaoMinimo(v[p + "observado"], v[p + "minimo"]);
      return bloco('<span class="rv-n">+' + e + "</span>" + esc(v[p + "nome"]), (v[p + "observado"] ? c.tag(R.rotuloNivel(v[p + "observado"]), "azul") : "") + (sm ? " " + c.tag(sm.texto, sm.cor) : "") + " " + c.tag("competência nova", "cinza"), v[p + "evidencia"], esc(v[p + "dimensao"] || ""));
    }).join("");
    const aj = R.ajustes(cargo, v);
    const fortes = [v.ponto_forte_1, v.ponto_forte_2, v.ponto_forte_3].filter(Boolean), desenv = [v.ponto_desenv_1, v.ponto_desenv_2].filter(Boolean);
    let h = '<div class="card"><h3>Avaliação da liderança<span class="extra muted">' + esc(nomeDe(av.avaliador || av.responsavel)) + (av.enviadaEm ? " · enviada em " + fmt(av.enviadaEm) : " · rascunho") + "</span></h3>" +
      secao("1. Resultados (KPIs do cargo)", "o peso é informativo, sem nota final", kpis) + secao("2. Competências do cargo", "escala de 1 a 4", comps) +
      secao("3. Conclusão da liderança", "em palavras, sem nota", '<div class="sci">' + c.textoRegistro("Conclusão geral", v.conclusao_geral) + c.textoRegistro("Pontos fortes", fortes.join("\n")) + c.textoRegistro("Pontos de desenvolvimento", desenv.join("\n")) + "</div>");
    if (o.decisao) h += secao("4. Perguntas de decisão", "uso interno do RH", '<div class="sci">' + c.textoRegistro("Eu escolheria ter esta pessoa na minha equipe sempre.", [v.decisao_equipe, v.decisao_equipe_evidencia].filter(Boolean).join("\n")) +
      c.textoRegistro("Esta pessoa corre risco de baixo desempenho nos próximos meses.", [v.decisao_risco, v.decisao_risco_evidencia].filter(Boolean).join("\n")) + "</div>");
    if (aj.length) h += secao("Ajustes na matriz", "o registro do que mudou, para o RH", '<div class="lista">' + aj.map((x) => '<div class="item"><div class="principal-item"><div class="t">' + esc(x.item) + ": " + esc(x.ajustado) + '</div><div class="d">' +
      esc([x.original ? "original: " + x.original : "", x.motivo ? "motivo: " + x.motivo : ""].filter(Boolean).join(" · ")) + "</div></div></div>").join("") + "</div>");
    if (o.calibracao) { const cal = R.lerJSON(av.calibracao); h += secao("Calibração do RH", fmt(cal.calib_data), '<div class="sci">' + c.textoRegistro("Houve ajuste de nível? " + (cal.calib_ajuste || "—"), cal.calib_detalhe) + "</div>"); }
    if (o.pdi && av.pdi) {
      const pdi = R.lerJSON(av.pdi);
      const acoes = [1, 2, 3].filter((i) => pdi["pdi_" + i + "_acao"]);
      h += secao("PDI e promoção", "só o RH (e quem avaliou)", (acoes.length ? '<div class="lista">' + acoes.map((i) => { const p = "pdi_" + i + "_"; return '<div class="item"><div class="principal-item"><div class="t">' + esc(pdi[p + "acao"]) + '</div><div class="d">' +
        esc([pdi[p + "ligada"] ? "ligada a " + pdi[p + "ligada"] : "", pdi[p + "prazo"] ? "até " + fmt(pdi[p + "prazo"]) : "", pdi[p + "sucesso"] ? "sucesso: " + pdi[p + "sucesso"] : "", pdi[p + "apoio"] ? "apoio: " + pdi[p + "apoio"] : "", pdi[p + "resp"] ? "responsável: " + pdi[p + "resp"] : "", pdi[p + "obs"]].filter(Boolean).join(" · ")) + "</div></div></div>"; }).join("") + "</div>" : "") +
        '<div class="sci" style="margin-top:10px">' + c.textoRegistro("A Revisão indica elegibilidade para promoção? " + (pdi.promo_elegivel || "—"), pdi.promo_evidencias) + "</div>");
    }
    return h + "</div>";
  }
  function autoavaliacaoHtml(auto) {
    return cartao("Autoavaliação do membro", '<div class="sci">' + R.AUTO.map((q, i) => c.textoRegistro(pad(i + 1) + " · " + q.pergunta, auto[q.campo] || "—")).join("") + "</div>", "enviada em " + fmt(auto.enviadaEm));
  }
  function metasHtml(ret) {
    const mt = R.lerJSON(ret.metas);
    const lista = [1, 2, 3].filter((i) => mt["meta_" + i + "_descricao"]);
    if (!lista.length) return "";
    return '<div class="lista">' + lista.map((i) => { const p = "meta_" + i + "_"; return '<div class="item"><div class="principal-item"><div class="t">' + esc(mt[p + "descricao"]) + '</div><div class="d">' +
      esc([mt[p + "tipo"], mt[p + "prazo"] ? "até " + fmt(mt[p + "prazo"]) : "", mt[p + "indicador"] ? "indicador: " + mt[p + "indicador"] : "", mt[p + "combinada"] === "Sim" ? "combinada entre as partes" : mt[p + "combinada"] === "Não" ? "ainda não combinada" : "", mt[p + "obs"]].filter(Boolean).join(" · ")) + "</div></div></div>"; }).join("") + "</div>";
  }
  function devolutivaHtml(ret, rh) {
    return cartao("Devolutiva (vai para o membro)", (ret.devolutivaEm ? '<div class="sci">' + c.textoRegistro("Pontos fortes combinados", ret.fortes) + c.textoRegistro("Pontos de desenvolvimento combinados", ret.desenvolver) + "</div>" +
      (metasHtml(ret) ? '<div class="rv-secao-t" style="margin-top:14px">Metas e entregas do próximo semestre</div>' + metasHtml(ret) : "") : c.vazio("A liderança ainda não registrou a devolutiva.")) +
      (rh && ret.retornoPares ? '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Retorno do RH sobre os pares (" + fmt(ret.retornoParesEm) + ")", ret.retornoPares) + "</div>" : ""),
      ret.devolutivaEm ? "conversa em " + fmt(ret.devolutivaEm) + " · " + (ret.cienciaEm ? "ciência em " + fmt(ret.cienciaEm) : "aguardando a ciência") : "");
  }
  function retornoRHHtml(m, ret) {
    const lidera = R.lideradosDe(X(), m.responsavel).length > 0;
    return cartao("Retornos do RH", '<p class="muted" style="margin-top:0">Pares: resumo escrito com 2 ou 3 pontos fortes e 2 ou 3 de desenvolvimento, em temas, sem nomes e sem trechos literais. ' +
      (lidera ? "Liderados: conversa de cerca de 30 minutos, depois que a liderança concluir as devolutivas da equipe." : "") + "</p>" +
      c.dados([["Retorno dos pares", ret && ret.retornoParesEm ? "enviado em " + fmt(ret.retornoParesEm) : "não enviado"]].concat(lidera ? [["Conversa sobre os liderados", ret && ret.retornoLideradosEm ? fmt(ret.retornoLideradosEm) : "não registrada"]] : [])) +
      '<div style="margin-top:12px"><button class="btn sec" data-acao="rev-retorno-rh" data-id="' + esc(m.id) + '">Registrar os retornos do RH</button></div>', "só o RH");
  }

  /* ---------------- o formulário da liderança (painel largo) ---------------- */
  function kpiHtml(k, n, v) {
    const p = "kpi_" + n + "_";
    const aj = v[p + "ajuste"] || "manter";
    return '<details class="rv-item"><summary><span class="rv-n">' + pad(n) + '</span><span class="rv-tit"><small>' + esc(k.objetivo) + "</small>" + esc(k.indicador) + '</span><span class="rv-sit" data-sit="' + p + '"></span></summary><div class="rv-corpo">' +
      '<dl class="rv-def"><dt>Meta</dt><dd>' + esc(k.meta) + "</dd><dt>Como é calculado</dt><dd>" + esc(k.calculo) + "</dd></dl>" +
      '<p class="muted rv-sub">Peso sugerido ' + esc(k.peso) + " · " + esc([k.tipo, k.frequencia, k.fonte].filter(Boolean).join(" · ")) + "</p>" +
      c.campo({ nome: p + "resultado", rotulo: "Resultado alcançado", valor: v[p + "resultado"], placeholder: "Ex.: 87% ou 12 contratos", opcional: true }) +
      c.campo({ nome: p + "nivel", rotulo: "Nível de entrega", tipo: "escolha", opcoes: NIVEIS_KPI, valor: v[p + "nivel"] }) +
      c.campo({ nome: p + "evidencia", rotulo: "Evidência e comentário", tipo: "textoLongo", linhas: 2, valor: v[p + "evidencia"] }) +
      '<details class="rv-ajuste"' + (aj !== "manter" ? " open" : "") + "><summary>Ajustar este KPI para o membro</summary>" +
      c.campo({ nome: p + "ajuste", rotulo: "Este KPI", tipo: "escolha", valor: aj, opcoes: [{ valor: "manter", rotulo: "Manter como está" }, { valor: "ajustar", rotulo: "Ajustar para este membro" }, { valor: "nao_se_aplica", rotulo: "Não se aplica neste ciclo" }] }) +
      '<div class="linha-campos">' + c.campo({ nome: p + "aj_indicador", rotulo: "Indicador ajustado", valor: v[p + "aj_indicador"], placeholder: "Em branco: mantém o original", opcional: true }) +
      c.campo({ nome: p + "aj_meta", rotulo: "Meta ajustada", valor: v[p + "aj_meta"], placeholder: "Em branco: mantém o original", opcional: true }) + "</div>" +
      c.campo({ nome: p + "aj_calculo", rotulo: "Como calcular (ajustado)", valor: v[p + "aj_calculo"], placeholder: "Em branco: mantém o original", opcional: true }) +
      c.campo({ nome: p + "aj_motivo", rotulo: "Motivo", tipo: "textoLongo", linhas: 2, valor: v[p + "aj_motivo"], opcional: true }) + "</details></div></details>";
  }
  function compHtml(x, n, v) {
    const p = "comp_" + n + "_";
    const aj = v[p + "ajuste"] || "manter";
    return '<details class="rv-item"><summary><span class="rv-n">' + pad(n) + '</span><span class="rv-tit"><small>' + esc(x.dimensao) + "</small>" + esc(x.nome) + '</span><span class="rv-sit" data-sit="' + p + '"></span></summary><div class="rv-corpo">' +
      (x.pratica ? '<p class="rv-prat">' + esc(x.pratica) + "</p>" : "") +
      '<p class="muted rv-sub">Mínimo esperado: ' + esc(R.rotuloNivel(x.minimo)) + (x.comoAvaliar ? " · " + esc(x.comoAvaliar) : "") + "</p>" +
      c.campo({ nome: p + "nivel", rotulo: "Nível observado", tipo: "escolha", opcoes: NIVEIS_COMP, valor: v[p + "nivel"] }) +
      '<div class="rv-minimo" data-minimo="' + p + '"></div>' +
      c.campo({ nome: p + "evidencia", rotulo: "Evidência (Situação, Comportamento, Impacto)", tipo: "textoLongo", linhas: 3, valor: v[p + "evidencia"] }) +
      '<details class="rv-ajuste"' + (aj !== "manter" ? " open" : "") + "><summary>Ajustar esta competência para o membro</summary>" +
      c.campo({ nome: p + "ajuste", rotulo: "Esta competência", tipo: "escolha", valor: aj, opcoes: [{ valor: "manter", rotulo: "Manter como está" }, { valor: "ajustar", rotulo: "Ajustar para este membro" }, { valor: "nao_se_aplica", rotulo: "Não se aplica neste ciclo" }] }) +
      c.campo({ nome: p + "aj_descricao", rotulo: "Competência ou comportamento ajustado", valor: v[p + "aj_descricao"], placeholder: "Em branco: mantém o original", opcional: true }) +
      c.campo({ nome: p + "minprop", rotulo: "Nível mínimo proposto", tipo: "escolha", opcoes: NIVEIS_COMP, valor: v[p + "minprop"], opcional: true }) +
      c.campo({ nome: p + "aj_motivo", rotulo: "Motivo", tipo: "textoLongo", linhas: 2, valor: v[p + "aj_motivo"], opcional: true }) + "</details></div></details>";
  }
  function kpiExtraHtml(e, v) {
    const p = "kpi_extra_" + e + "_";
    return '<details class="rv-item extra"' + (v[p + "indicador"] ? " open" : "") + '><summary><span class="rv-n">+' + e + '</span><span class="rv-tit">Incluir KPI ' + e + '</span><span class="rv-sit" data-sit="' + p + '"></span></summary><div class="rv-corpo">' +
      '<div class="linha-campos">' + c.campo({ nome: p + "indicador", rotulo: "Indicador", valor: v[p + "indicador"], opcional: true }) + c.campo({ nome: p + "meta", rotulo: "Meta", valor: v[p + "meta"], opcional: true }) + "</div>" +
      c.campo({ nome: p + "calculo", rotulo: "Como é calculado", valor: v[p + "calculo"], opcional: true }) +
      c.campo({ nome: p + "motivo", rotulo: "Motivo da inclusão", tipo: "textoLongo", linhas: 2, valor: v[p + "motivo"], opcional: true }) +
      c.campo({ nome: p + "resultado", rotulo: "Resultado alcançado", valor: v[p + "resultado"], opcional: true }) +
      c.campo({ nome: p + "entrega", rotulo: "Nível de entrega", tipo: "escolha", opcoes: NIVEIS_KPI, valor: v[p + "entrega"] }) +
      c.campo({ nome: p + "evidencia", rotulo: "Evidência e comentário", tipo: "textoLongo", linhas: 2, valor: v[p + "evidencia"] }) + "</div></details>";
  }
  function compExtraHtml(e, v) {
    const p = "comp_extra_" + e + "_";
    return '<details class="rv-item extra"' + (v[p + "nome"] ? " open" : "") + '><summary><span class="rv-n">+' + e + '</span><span class="rv-tit">Incluir competência ' + e + '</span><span class="rv-sit" data-sit="' + p + '"></span></summary><div class="rv-corpo">' +
      '<div class="linha-campos">' + c.campo({ nome: p + "nome", rotulo: "Competência", valor: v[p + "nome"], opcional: true }) + c.campo({ nome: p + "dimensao", rotulo: "Dimensão", tipo: "lista", opcoes: DIMENSOES, valor: v[p + "dimensao"], opcional: true }) + "</div>" +
      c.campo({ nome: p + "pratica", rotulo: "O que significa na prática", tipo: "textoLongo", linhas: 2, valor: v[p + "pratica"], opcional: true }) +
      c.campo({ nome: p + "minimo", rotulo: "Nível mínimo esperado", tipo: "escolha", opcoes: NIVEIS_COMP, valor: v[p + "minimo"], opcional: true }) +
      c.campo({ nome: p + "motivo", rotulo: "Motivo da inclusão", tipo: "textoLongo", linhas: 2, valor: v[p + "motivo"], opcional: true }) +
      c.campo({ nome: p + "observado", rotulo: "Nível observado", tipo: "escolha", opcoes: NIVEIS_COMP, valor: v[p + "observado"] }) +
      c.campo({ nome: p + "evidencia", rotulo: "Evidência (Situação, Comportamento, Impacto)", tipo: "textoLongo", linhas: 3, valor: v[p + "evidencia"] }) + "</div></details>";
  }
  function formAvaliacao(cargo, v) {
    return '<div id="form-avaliacao" class="rv-form">' +
      '<div class="aviso-info" style="margin-bottom:14px">Evidência no modelo SCI: Situação, Comportamento e Impacto. Fatos e dados, não impressões. Se algo não faz sentido para a função, use Ajustar ou Não se aplica dentro do item: vale na hora, e o RH recebe o registro do que mudou.</div>' +
      secao("1. Resultados (KPIs do cargo)", "o peso é informativo, não há nota final calculada", cargo.kpis.map((k, i) => kpiHtml(k, i + 1, v)).join("") +
        '<p class="muted rv-sub" style="margin-top:12px">Falta algum KPI importante para este membro? Inclua até 2.</p>' + [1, 2].map((e) => kpiExtraHtml(e, v)).join("")) +
      secao("2. Competências do cargo", "escala de 1 a 4; a situação frente ao mínimo aparece sozinha", cargo.competencias.map((x, i) => compHtml(x, i + 1, v)).join("") +
        '<p class="muted rv-sub" style="margin-top:12px">Falta alguma competência importante para este membro? Inclua até 2.</p>' + [1, 2].map((e) => compExtraHtml(e, v)).join("")) +
      secao("3. Conclusão da liderança", "em palavras, sem nota", c.campo({ nome: "conclusao_geral", rotulo: "Conclusão geral", tipo: "textoLongo", linhas: 4, valor: v.conclusao_geral }) +
        '<div class="linha-campos">' + c.campo({ nome: "ponto_forte_1", rotulo: "Ponto forte 1", valor: v.ponto_forte_1 }) + c.campo({ nome: "ponto_desenv_1", rotulo: "Ponto de desenvolvimento 1", valor: v.ponto_desenv_1 }) + "</div>" +
        '<div class="linha-campos">' + c.campo({ nome: "ponto_forte_2", rotulo: "Ponto forte 2", valor: v.ponto_forte_2, opcional: true }) + c.campo({ nome: "ponto_desenv_2", rotulo: "Ponto de desenvolvimento 2", valor: v.ponto_desenv_2, opcional: true }) + "</div>" +
        c.campo({ nome: "ponto_forte_3", rotulo: "Ponto forte 3", valor: v.ponto_forte_3, opcional: true })) +
      secao("4. Perguntas de decisão", "uso interno do RH", c.campo({ nome: "decisao_equipe", rotulo: "Eu escolheria ter esta pessoa na minha equipe sempre.", tipo: "escolha", opcoes: R.ACORDO, valor: v.decisao_equipe }) +
        c.campo({ nome: "decisao_equipe_evidencia", rotulo: "Evidência (obrigatória quando há discordância)", tipo: "textoLongo", linhas: 2, valor: v.decisao_equipe_evidencia, opcional: true }) +
        c.campo({ nome: "decisao_risco", rotulo: "Esta pessoa corre risco de baixo desempenho nos próximos meses.", tipo: "escolha", opcoes: ["Sim", "Não"], valor: v.decisao_risco }) +
        c.campo({ nome: "decisao_risco_evidencia", rotulo: "Evidência (obrigatória quando a resposta é Sim)", tipo: "textoLongo", linhas: 2, valor: v.decisao_risco_evidencia, opcional: true })) +
      escalasHtml() + glossarioHtml() + "</div>";
  }
  /** O contador do rodapé e a situação de cada item, a cada mudança no formulário */
  function atualizarFormAvaliacao(cargo) {
    const f = document.getElementById("form-avaliacao");
    if (!f) return;
    const d = ui.lerForm(f);
    const faltam = R.faltando(cargo, d);
    const el = document.getElementById("rv-contador");
    if (el) el.innerHTML = faltam.length ? "Faltam <b>" + faltam.length + "</b> " + (faltam.length === 1 ? "item" : "itens") + " para enviar" : "Tudo preenchido para enviar";
    const sit = (p, html) => { const s = f.querySelector('[data-sit="' + p + '"]'); if (s) s.innerHTML = html; };
    cargo.kpis.forEach((k, i) => {
      const p = "kpi_" + (i + 1) + "_";
      sit(p, d[p + "ajuste"] === "nao_se_aplica" ? c.tag("não se aplica", "cinza") : d[p + "nivel"] && d[p + "evidencia"] ? c.tag(d[p + "nivel"], "azul") : c.tag("a preencher", "ambar"));
    });
    cargo.competencias.forEach((x, i) => {
      const p = "comp_" + (i + 1) + "_";
      const min = d[p + "ajuste"] === "ajustar" && d[p + "minprop"] ? d[p + "minprop"] : x.minimo;
      const sm = R.situacaoMinimo(d[p + "nivel"], min);
      sit(p, d[p + "ajuste"] === "nao_se_aplica" ? c.tag("não se aplica", "cinza") : d[p + "nivel"] && d[p + "evidencia"] ? c.tag(R.rotuloNivel(d[p + "nivel"]), "azul") + (sm ? " " + c.tag(sm.texto, sm.cor) : "") : c.tag("a preencher", "ambar"));
      const m = f.querySelector('[data-minimo="' + p + '"]');
      if (m) m.innerHTML = sm ? "Situação frente ao mínimo: " + c.tag(sm.texto, sm.cor) : "";
    });
    [1, 2].forEach((e) => {
      sit("kpi_extra_" + e + "_", d["kpi_extra_" + e + "_indicador"] ? (d["kpi_extra_" + e + "_entrega"] && d["kpi_extra_" + e + "_evidencia"] ? c.tag(d["kpi_extra_" + e + "_entrega"], "azul") : c.tag("a preencher", "ambar")) : "");
      sit("comp_extra_" + e + "_", d["comp_extra_" + e + "_nome"] ? (d["comp_extra_" + e + "_observado"] && d["comp_extra_" + e + "_evidencia"] ? c.tag(R.rotuloNivel(d["comp_extra_" + e + "_observado"]), "azul") : c.tag("a preencher", "ambar")) : "");
    });
  }
  ui.acoes["rev-avaliar"] = function (el) {
    const ctx = X(), m = ctx.idx.membro[el.dataset.id];
    if (!m || !acessoAo(m).avaliar) return;
    const ciclo = R.cicloAberto(ctx);
    const cargo = R.matrizDo(m);
    if (!cargo) { ui.avisar("O RH precisa definir antes o cargo na matriz, no cadastro do membro.", "erro"); return; }
    const av = R.avaliacaoDo(ctx, m.id, ciclo);
    ui.abrirPainel({
      titulo: (ciclo ? "Avaliação de " : "Rascunho da avaliação de ") + nomeDe(m.responsavel), largo: true,
      sub: esc(nomeCargo(R.cargoDo(m))) + " · " + (ciclo ? esc(ciclo.ciclo) + " · envio até " + calc.fmtData(ciclo.prazoLideranca) : "fora do ciclo: nada vai ao RH agora"),
      corpo: formAvaliacao(cargo, R.lerJSON(av && av.avaliacao)),
      rodape: '<span class="rv-contador" id="rv-contador"></span><button class="btn sec" data-acao="rev-salvar-avaliacao" data-id="' + esc(m.id) + '">Salvar rascunho</button>' +
        (ciclo ? '<button class="btn" data-acao="rev-enviar-avaliacao" data-id="' + esc(m.id) + '">Enviar ao RH</button>' : '<button class="btn" disabled title="O envio ao RH abre com o ciclo">Enviar ao RH · abre com o ciclo</button>'),
      aoAbrir: function (painel) {
        // no <aside> deste painel (recriado a cada abertura), e não no #painel, que fica: assim os ouvintes não se acumulam
        const alvo = painel.querySelector(".painel-lateral") || painel;
        const f = function () { atualizarFormAvaliacao(cargo); };
        alvo.addEventListener("input", f);
        alvo.addEventListener("change", f);
        f();
      },
    });
  };
  async function gravarAvaliacao(m, d, enviar) {
    const ctx = X(), ciclo = R.cicloAberto(ctx);
    const av = R.avaliacaoDo(ctx, m.id, ciclo);
    const dados = { avaliacao: JSON.stringify(soPreenchidos(d)), cargo: R.cargoDo(m), cicloId: ciclo ? String(ciclo.id) : (av && av.cicloId) || "" };
    if (enviar) Object.assign(dados, { estagio: "ENVIADA", enviadaEm: ui.agoraISO() });
    if (av) return ui.atualizar("revAvaliacoes", av.id, dados);
    // responsável = quem avalia: o membro nunca é dono do item (não lê o formulário, mesmo com "Próprios" no CRM)
    return ui.criar("revAvaliacoes", Object.assign(dados, { titulo: "Revisão · " + nomeDe(m.responsavel) + (ciclo ? " · " + ciclo.ciclo : " · rascunho"), membroId: m.id,
      responsavel: eu().id, avaliador: eu().id, autor: eu().id, estagio: enviar ? "ENVIADA" : "NEW" }));
  }
  ui.acoes["rev-salvar-avaliacao"] = function (el) {
    const m = X().idx.membro[el.dataset.id];
    const d = ui.lerForm(document.getElementById("form-avaliacao"));
    ui.salvar(el, async () => { await gravarAvaliacao(m, d, false); marcarLimpo(); }, { fechar: false, mensagem: "Rascunho salvo." });
  };
  ui.acoes["rev-enviar-avaliacao"] = function (el) {
    const m = X().idx.membro[el.dataset.id];
    const d = ui.lerForm(document.getElementById("form-avaliacao"));
    const faltam = R.faltando(R.matrizDo(m), d);
    if (faltam.length) { erroNoRodape("<b>Faltam " + faltam.length + " " + (faltam.length === 1 ? "item" : "itens") + " para enviar:</b> " + esc(faltam.slice(0, 8).join("; ")) + (faltam.length > 8 ? "…" : "") + ". Os itens marcados \"a preencher\" estão abertos para você."); abrirPendentes(); return; }
    const nome = nomeDe(m.responsavel);
    if (!window.confirm("Enviar a avaliação de " + nome + " ao RH?\n\nDepois do envio, ajustes passam pela calibração do RH. A autoavaliação do membro fica liberada para você ler.")) return;
    ui.salvar(el, async () => {
      await gravarAvaliacao(m, d, true);
      GP.app.avisarRH("Revisão de Progresso: " + quem() + " enviou ao RH a avaliação de " + nome + ".");
    }, { mensagem: "Avaliação enviada ao RH." });
  };
  /** Abre os itens que faltam preencher, para a liderança achar */
  function abrirPendentes() {
    document.querySelectorAll("#form-avaliacao details.rv-item").forEach((d) => { if (d.querySelector(".rv-sit .tag.ambar")) d.open = true; });
  }

  /* ---------------- RH: calibração, devolver, retornos ---------------- */
  ui.acoes["rev-calibrar"] = function (el) {
    const av = X().idx.porId.revAvaliacoes[el.dataset.id];
    if (!av || !ehRH()) return;
    const cal = R.lerJSON(av.calibracao);
    ui.abrirPainel({
      titulo: "Calibração · " + nomeDe((X().idx.membro[av.membroId] || {}).responsavel), sub: "Preenchida pelo RH depois da reunião de calibração. A liderança é avisada para fazer a devolutiva.",
      corpo: '<div id="form-calibracao">' + c.campo({ nome: "calib_ajuste", rotulo: "Houve ajuste de nível?", tipo: "escolha", opcoes: ["Sim", "Não"], valor: cal.calib_ajuste }) +
        c.campo({ nome: "calib_data", rotulo: "Data da calibração", tipo: "data", valor: cal.calib_data || X().hoje }) +
        c.campo({ nome: "calib_detalhe", rotulo: "Qual foi o ajuste, o motivo e a evidência?", tipo: "textoLongo", linhas: 5, valor: cal.calib_detalhe, opcional: true }) + "</div>",
      rodape: '<button class="btn" data-acao="rev-salvar-calibracao" data-id="' + esc(av.id) + '">Salvar a calibração</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["rev-salvar-calibracao"] = function (el) {
    const f = document.getElementById("form-calibracao");
    const d = ui.lerForm(f);
    if (!ui.validar(f, d.calib_ajuste === "Sim" ? ["calib_ajuste", "calib_data", "calib_detalhe"] : ["calib_ajuste", "calib_data"])) return;
    const av = X().idx.porId.revAvaliacoes[el.dataset.id];
    const m = X().idx.membro[av.membroId];
    const ciclo = R.cicloAberto(X());
    const primeira = av.estagio === "ENVIADA";
    ui.salvar(el, async () => {
      await ui.atualizar("revAvaliacoes", av.id, Object.assign({ calibracao: JSON.stringify(soPreenchidos(d)), calibradaEm: ui.agoraISO() }, primeira ? { estagio: "CALIBRADA" } : {}));
      if (primeira) GP.app.avisar([av.avaliador || av.responsavel], "Revisão de Progresso: o RH concluiu a calibração de " + nomeDe(m && m.responsavel) + ". Faça a devolutiva" + (ciclo && ciclo.prazoDevolutiva ? " até " + calc.fmtData(ciclo.prazoDevolutiva) : "") + " e registre no app.");
    }, { mensagem: "Calibração registrada." });
  };
  ui.acoes["rev-devolver"] = function (el) {
    const av = X().idx.porId.revAvaliacoes[el.dataset.id];
    if (!av || !ehRH()) return;
    const motivo = window.prompt("Devolver a avaliação à liderança para revisar. Ela volta a rascunho e a liderança é avisada.\n\nMotivo (vai no aviso):");
    if (motivo === null) return;
    const m = X().idx.membro[av.membroId];
    ui.salvar(el, async () => {
      await ui.atualizar("revAvaliacoes", av.id, { estagio: "NEW", enviadaEm: "" });
      try { await E().repo.comentar("revAvaliacoes", av.id, "Devolvida à liderança pelo RH (" + quem() + ")" + (motivo.trim() ? ": " + motivo.trim() : ".")); } catch (e) { /* o comentário não impede */ }
      GP.app.avisar([av.avaliador || av.responsavel], "Revisão de Progresso: o RH devolveu a avaliação de " + nomeDe(m && m.responsavel) + " para você revisar" + (motivo.trim() ? ": " + motivo.trim() : ".") );
    }, { mensagem: "Avaliação devolvida à liderança." });
  };
  ui.acoes["rev-retorno-rh"] = function (el) {
    const ctx = X(), m = ctx.idx.membro[el.dataset.id];
    const ciclo = R.cicloAberto(ctx);
    if (!m || !ciclo || !ehRH()) return;
    const ret = R.retornoDe(ctx, m.responsavel, ciclo) || {};
    const lidera = R.lideradosDe(ctx, m.responsavel).length > 0;
    ui.abrirPainel({
      titulo: "Retornos do RH · " + nomeDe(m.responsavel), sub: "Em temas, sem nomes e sem trechos literais. Só com respostas suficientes para proteger quem respondeu.",
      corpo: '<div id="form-retorno-rh">' + c.campo({ nome: "retornoPares", rotulo: "Retorno sobre os pares (2 ou 3 pontos fortes e 2 ou 3 de desenvolvimento)", tipo: "textoLongo", linhas: 7, valor: ret.retornoPares, opcional: true,
        ajuda: "O membro lê no app dele, em Seus retornos. Conversa com o RH só se ele pedir." }) +
        c.campo({ nome: "retornoParesEm", rotulo: "Retorno dos pares enviado em", tipo: "data", valor: ret.retornoParesEm || ctx.hoje, opcional: true }) +
        (lidera ? c.campo({ nome: "retornoLideradosEm", rotulo: "Conversa do RH sobre os liderados em", tipo: "data", valor: ret.retornoLideradosEm, opcional: true, ajuda: "Depois que a liderança concluir as devolutivas da equipe. Os temas alimentam o PDI da própria liderança." }) : "") + "</div>",
      rodape: '<button class="btn" data-acao="rev-salvar-retorno-rh" data-id="' + esc(m.id) + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["rev-salvar-retorno-rh"] = function (el) {
    const ctx = X(), m = ctx.idx.membro[el.dataset.id], ciclo = R.cicloAberto(ctx);
    const d = ui.lerForm(document.getElementById("form-retorno-rh"));
    const ret = R.retornoDe(ctx, m.responsavel, ciclo);
    const dados = { retornoPares: (d.retornoPares || "").trim(), retornoParesEm: d.retornoPares && d.retornoPares.trim() ? d.retornoParesEm || ctx.hoje : "" };
    if ("retornoLideradosEm" in d) dados.retornoLideradosEm = d.retornoLideradosEm;
    const novoPares = dados.retornoPares && !(ret && ret.retornoPares);
    ui.salvar(el, async () => {
      if (ret) await ui.atualizar("revRetornos", ret.id, dados);
      else await ui.criar("revRetornos", Object.assign(dados, { titulo: "Retornos · " + nomeDe(m.responsavel) + " · " + ciclo.ciclo, membroId: m.id, responsavel: m.responsavel, cicloId: String(ciclo.id), estagio: "NEW" }));
      if (novoPares) GP.app.avisar([m.responsavel], "Revisão de Progresso: o RH registrou o retorno sobre os seus pares. Veja em Revisão de Progresso → Seus retornos.");
    }, { mensagem: "Retornos do RH salvos." });
  };

  /* ---------------- liderança: devolutiva, PDI, metas e promoção (Etapa 3) ---------------- */
  ui.acoes["rev-devolutiva"] = function (el) {
    const ctx = X(), m = ctx.idx.membro[el.dataset.id];
    if (!m || !acessoAo(m).avaliar) return;
    const ciclo = R.cicloAberto(ctx);
    const av = R.avaliacaoDo(ctx, m.id, ciclo);
    const ret = R.retornoDe(ctx, m.responsavel, ciclo) || {};
    const pdi = R.lerJSON(av && av.pdi), mt = R.lerJSON(ret.metas);
    const acao = (i) => { const p = "pdi_" + i + "_"; return '<div class="rv-bloco"><div class="rv-bloco-t">' + pad(i) + " · Ação " + i + " do PDI</div>" +
      '<div class="linha-campos">' + c.campo({ nome: p + "ligada", rotulo: "Ligada a (competência ou KPI)", valor: pdi[p + "ligada"], opcional: true }) + c.campo({ nome: p + "acao", rotulo: "Ação concreta", valor: pdi[p + "acao"], opcional: true }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: p + "prazo", rotulo: "Prazo", tipo: "data", valor: pdi[p + "prazo"], opcional: true }) + c.campo({ nome: p + "sucesso", rotulo: "Como saberemos que deu certo", valor: pdi[p + "sucesso"], opcional: true }) + "</div>" +
      '<div class="linha-campos">' + c.campo({ nome: p + "apoio", rotulo: "Apoio necessário", valor: pdi[p + "apoio"], opcional: true }) + c.campo({ nome: p + "resp", rotulo: "Responsável", valor: pdi[p + "resp"], opcional: true }) + "</div>" +
      c.campo({ nome: p + "obs", rotulo: "Observações", valor: pdi[p + "obs"], opcional: true }) + "</div>"; };
    const meta = (i) => { const p = "meta_" + i + "_"; return '<div class="rv-bloco"><div class="rv-bloco-t">' + pad(i) + " · Meta ou entrega " + i + "</div>" +
      c.campo({ nome: p + "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: ["Resultado", "Aprendizado"], valor: mt[p + "tipo"], opcional: true }) +
      c.campo({ nome: p + "descricao", rotulo: "Meta ou entrega combinada", valor: mt[p + "descricao"], opcional: true }) +
      '<div class="linha-campos">' + c.campo({ nome: p + "prazo", rotulo: "Prazo", tipo: "data", valor: mt[p + "prazo"], opcional: true }) + c.campo({ nome: p + "indicador", rotulo: "Indicador", valor: mt[p + "indicador"], opcional: true }) + "</div>" +
      c.campo({ nome: p + "combinada", rotulo: "Combinada entre as partes?", tipo: "escolha", opcoes: ["Sim", "Não"], valor: mt[p + "combinada"], opcional: true }) +
      c.campo({ nome: p + "obs", rotulo: "Observações", valor: mt[p + "obs"], opcional: true }) + "</div>"; };
    ui.abrirPainel({
      titulo: "Devolutiva de " + nomeDe(m.responsavel), largo: true, sub: "Depois da calibração do RH. A conversa e as metas vão para o membro; o PDI e a promoção ficam só com o RH.",
      corpo: '<div id="form-devolutiva" class="rv-form">' +
        secao("1. A conversa", "exemplos no modelo SCI · vai para o membro", c.campo({ nome: "dev_data", rotulo: "Data da devolutiva", tipo: "data", valor: ret.devolutivaEm || (av && av.devolutivaEm) || ctx.hoje }) +
          c.campo({ nome: "dev_fortes", rotulo: "Pontos fortes combinados", tipo: "textoLongo", linhas: 4, valor: ret.fortes }) +
          c.campo({ nome: "dev_desenv", rotulo: "Pontos de desenvolvimento combinados", tipo: "textoLongo", linhas: 4, valor: ret.desenvolver })) +
        secao("2. Plano de desenvolvimento (PDI)", "no máximo 3 ações · só o RH", [1, 2, 3].map(acao).join("")) +
        secao("3. Metas e entregas do próximo semestre", "resultado ou aprendizado, combinado entre as partes · vai para o membro", [1, 2, 3].map(meta).join("")) +
        secao("4. Promoção", "liga ao pipeline do Plano de Carreira · decisão da CEO · só o RH", c.campo({ nome: "promo_elegivel", rotulo: "A Revisão indica elegibilidade para promoção?", tipo: "escolha", opcoes: ["Sim", "Não"], valor: pdi.promo_elegivel }) +
          c.campo({ nome: "promo_evidencias", rotulo: "Evidências anexadas ao pipeline", tipo: "textoLongo", linhas: 3, valor: pdi.promo_evidencias, opcional: true })) +
        '<p class="muted" style="font-size:12px">Depois da conversa, o membro confirma no app dele que a devolutiva aconteceu. É ciência, não concordância.</p></div>',
      rodape: '<button class="btn" data-acao="rev-salvar-devolutiva" data-id="' + esc(m.id) + '">Registrar a devolutiva</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
    });
  };
  ui.acoes["rev-salvar-devolutiva"] = function (el) {
    const ctx = X(), m = ctx.idx.membro[el.dataset.id], ciclo = R.cicloAberto(ctx);
    const f = document.getElementById("form-devolutiva");
    if (!ui.validar(f, ["dev_data", "dev_fortes", "dev_desenv", "promo_elegivel"])) return;
    const d = soPreenchidos(ui.lerForm(f));
    const av = R.avaliacaoDo(ctx, m.id, ciclo);
    const ret = R.retornoDe(ctx, m.responsavel, ciclo);
    const pdi = {}, metas = {};
    Object.keys(d).forEach((k) => { if (/^(pdi_|promo_)/.test(k)) pdi[k] = d[k]; if (/^meta_/.test(k)) metas[k] = d[k]; });
    const primeira = av.estagio === "CALIBRADA";
    ui.salvar(el, async () => {
      await ui.atualizar("revAvaliacoes", av.id, { pdi: JSON.stringify(pdi), devolutivaEm: d.dev_data, estagio: "DEVOLUTIVA" });
      const dados = { devolutivaEm: d.dev_data, fortes: d.dev_fortes, desenvolver: d.dev_desenv, metas: JSON.stringify(metas), estagio: "DEVOLUTIVA" };
      if (ret) await ui.atualizar("revRetornos", ret.id, dados);
      else await ui.criar("revRetornos", Object.assign(dados, { titulo: "Retornos · " + nomeDe(m.responsavel) + " · " + ciclo.ciclo, membroId: m.id, responsavel: m.responsavel, cicloId: String(ciclo.id) }));
      if (primeira) GP.app.avisar([m.responsavel], "Revisão de Progresso: sua liderança registrou a devolutiva. Confirme a ciência no app, em Revisão de Progresso → Seus retornos (ciência, não concordância).");
    }, { mensagem: "Devolutiva registrada. O membro foi avisado para confirmar a ciência." });
  };

  /* ================================================================ MINHA AUTOAVALIAÇÃO */
  function telaAuto() {
    const ctx = X(), id = String(eu().id);
    const ciclo = R.cicloAberto(ctx);
    let h = voltar() + c.cabecalho("desempenho", "Minha autoavaliação", ciclo ? "<span>" + esc(ciclo.ciclo) + "</span><span>até " + calc.fmtData(ciclo.prazoAuto) + "</span>" : "");
    if (semEstrutura()) return h + avisoSemEstrutura();
    if (!ciclo) return h + '<div class="card">' + c.vazio("A autoavaliação abre com o ciclo da Revisão de Progresso. O RH abre os ciclos em junho e novembro.") + "</div>";
    const part = minhaParticipacao(ciclo);
    if (!part.ok) return h + '<div class="card">' + c.vazio("Você não participa deste ciclo: " + esc(part.motivo) + ". Dúvidas, fale com o RH.") + "</div>";
    const a = R.autoavaliacaoDe(ctx, id, ciclo);
    const enviada = a && a.estagio === "SUCCESS";
    h += '<div class="aviso-info" style="margin-bottom:16px">5 perguntas sobre as suas entregas no período. Quem lê: sua liderança direta (só depois de enviar a avaliação dela ao RH, para não ser influenciada) e o RH. Mais ninguém. Responda com fatos, números e exemplos. Depois de enviar, você não edita mais.</div>';
    h += cartao("Suas respostas", '<div class="sci">' + R.AUTO.map((q, i) => '<div><div class="k">' + pad(i + 1) + " · " + esc(q.pergunta) + '</div><div class="texto-registro">' + (a && a[q.campo] ? esc(a[q.campo]) : '<span class="muted">a responder</span>') + "</div></div>").join("") + "</div>" +
      (enviada ? "" : '<div style="margin-top:14px"><button class="btn" data-acao="rev-auto">' + (a ? "Continuar" : "Responder") + "</button></div>"),
      enviada ? c.tag("Enviada em " + fmt(a.enviadaEm), "verde") : a ? c.tag("Rascunho", "ambar") : c.tag("A responder", "cinza"));
    return h + guiaHtml();
  }
  ui.acoes["rev-auto"] = function () {
    const ctx = X(), ciclo = R.cicloAberto(ctx);
    if (!ciclo) return;
    const a = R.autoavaliacaoDe(ctx, eu().id, ciclo) || {};
    if (a.estagio === "SUCCESS") return;
    ui.abrirPainel({
      titulo: "Minha autoavaliação", largo: true, sub: esc(ciclo.ciclo) + " · até " + calc.fmtData(ciclo.prazoAuto) + " · quem lê: sua liderança direta e o RH",
      corpo: '<div id="form-auto">' + R.AUTO.map((q, i) => c.campo({ nome: q.campo, rotulo: pad(i + 1) + " · " + q.pergunta, ajuda: q.dica, tipo: "textoLongo", linhas: 5, valor: a[q.campo] })).join("") + "</div>",
      rodape: '<button class="btn sec" data-acao="rev-salvar-auto">Salvar para depois</button><button class="btn" data-acao="rev-enviar-auto">Enviar autoavaliação</button>',
    });
  };
  async function gravarAuto(d, enviar) {
    const ctx = X(), ciclo = R.cicloAberto(ctx), id = String(eu().id);
    const a = R.autoavaliacaoDe(ctx, id, ciclo);
    const dados = {};
    R.AUTO.forEach((q) => { dados[q.campo] = String(d[q.campo] || "").trim(); });
    if (enviar) Object.assign(dados, { estagio: "SUCCESS", enviadaEm: ui.agoraISO() });
    if (a) return ui.atualizar("revAutoavaliacoes", a.id, dados);
    const m = ctx.idx.membroPorUsuario[id];
    return ui.criar("revAutoavaliacoes", Object.assign(dados, { titulo: "Autoavaliação · " + eu().nome + " · " + ciclo.ciclo, responsavel: id, membroId: m ? m.id : "", cicloId: String(ciclo.id), estagio: enviar ? "SUCCESS" : "NEW" }));
  }
  ui.acoes["rev-salvar-auto"] = function (el) {
    const d = ui.lerForm(document.getElementById("form-auto"));
    ui.salvar(el, async () => { await gravarAuto(d, false); marcarLimpo(); }, { fechar: false, mensagem: "Salvo. Você pode continuar depois." });
  };
  ui.acoes["rev-enviar-auto"] = function (el) {
    const f = document.getElementById("form-auto");
    if (!ui.validar(f, R.AUTO.map((q) => q.campo))) return;
    if (!window.confirm("Enviar a autoavaliação?\n\nDepois de enviar, você não edita mais as respostas. Sua liderança lê depois de enviar a avaliação dela ao RH.")) return;
    const d = ui.lerForm(f);
    ui.salvar(el, async () => {
      await gravarAuto(d, true);
      const lider = R.liderDe(X(), eu().id);
      if (lider) GP.app.avisar([lider], "Revisão de Progresso: " + eu().nome + " enviou a autoavaliação. Você lê depois de enviar a sua avaliação ao RH.");
    }, { mensagem: "Autoavaliação enviada." });
  };

  /* ================================================================ AVALIAÇÃO 360° */
  /** O "já respondi" fica só com a pessoa (BX24.userOption), sem o conteúdo e sem ligação com a resposta gravada */
  function controle360(ciclo) {
    let v = null;
    try { v = JSON.parse(E().repo.lerPreferencia("gp_360_" + ciclo.id) || "null"); } catch (e) { v = null; }
    return { e: (v && v.e) || [], p: (v && v.p) || [] };
  }
  function marcar360(ciclo, uid, tipo) {
    const ctrl = controle360(ciclo);
    ctrl.e = ctrl.e.filter((x) => x !== uid);
    ctrl.p = ctrl.p.filter((x) => x !== uid);
    ctrl[tipo].push(uid);
    E().repo.gravarPreferencia("gp_360_" + ciclo.id, JSON.stringify(ctrl));
  }
  // o rascunho da 360° fica só neste navegador (nunca no Bitrix), e some no envio
  const chaveRasc = (ciclo, uid) => "gp_360_rasc_" + eu().id + "_" + ciclo.id + "_" + uid;
  function lerRasc(ciclo, uid) { try { return JSON.parse(localStorage.getItem(chaveRasc(ciclo, uid)) || "{}"); } catch (e) { return {}; } }
  function gravarRasc(ciclo, uid, d) { try { localStorage.setItem(chaveRasc(ciclo, uid), JSON.stringify(d)); return true; } catch (e) { return false; } }
  function apagarRasc(ciclo, uid) { try { localStorage.removeItem(chaveRasc(ciclo, uid)); } catch (e) { /* sem storage */ } }

  function tela360() {
    const ctx = X(), id = String(eu().id);
    const ciclo = R.cicloAberto(ctx);
    let h = voltar() + c.cabecalho("desempenho", "Avaliação 360°", ciclo ? "<span>" + esc(ciclo.ciclo) + "</span><span>até " + calc.fmtData(ciclo.prazoLideranca) + "</span>" : "");
    if (semEstrutura()) return h + avisoSemEstrutura();
    if (!ciclo) return h + '<div class="card">' + c.vazio("A 360° abre com o ciclo da Revisão de Progresso.") + "</div>";
    const regras = R.regrasDo(ciclo);
    if (!regras.liberarLideranca && !regras.liberarPares) return h + '<div class="card">' + c.vazio("O RH não liberou a 360° neste ciclo.") + "</div>";
    if (E().verComo) return h + '<div class="aviso-atencao">A 360° só é respondida pela própria pessoa, com o login dela: em "Ver como", ela fica fechada.</div>';
    const ctrl = controle360(ciclo);
    const status = (uid) => ctrl.e.indexOf(uid) >= 0 ? c.tag("Enviada", "verde") : ctrl.p.indexOf(uid) >= 0 ? c.tag("Pulada", "cinza") : c.tag("Pendente", "ambar");
    const linha = (x) => {
      const u = dom.pessoa(ctx, x.uid);
      const feito = ctrl.e.indexOf(x.uid) >= 0;
      const pequeno = R.grupoPequeno(ctx, x.uid, x.relacao, regras);
      return '<div class="item' + (feito ? "" : " clicavel") + '"' + (feito ? "" : ' data-acao="rev-360" data-uid="' + esc(x.uid) + '"') + ">" + c.avatar(u, 30) + '<div class="principal-item"><div class="t">' + esc(u.nome) +
        '</div><div class="d">' + esc([u.cargo, x.papel].filter(Boolean).join(" · ")) + '</div></div><div class="lado">' + (pequeno ? c.tag("grupo pequeno", "cinza") : "") + status(x.uid) + "</div></div>";
    };
    h += '<div class="aviso-info" style="margin-bottom:16px">Você avalia seus superiores, seus pares e, se liderar alguém, seus liderados diretos (pela Revisão formal). Só o RH lê: a pessoa avaliada não recebe o que você escreveu. Depois do ciclo, o RH leva a ela temas resumidos, sem identificar ninguém e sem trechos literais.</div>';
    if (regras.liberarLideranca) {
      const sup = R.superioresDe(ctx, id);
      h += cartao("Seus superiores", sup.length ? '<div class="lista">' + sup.map(linha).join("") + "</div>" : c.vazio("Pela estrutura do Bitrix, você não tem superior para avaliar."), "o imediato e, quando houver supervisão, quem está acima dela");
    }
    if (regras.liberarPares) {
      const pares = R.paresDe(ctx, id);
      h += cartao("Seus pares", pares.length ? '<div class="lista">' + pares.map(linha).join("") + "</div>" : c.vazio("Pela estrutura do Bitrix, ninguém tem a mesma liderança direta que você."), "mesma liderança direta · avalie só quem você acompanha de perto");
    }
    const lid = R.lideradosDe(ctx, id);
    if (lid.length) h += cartao("Seus liderados diretos", '<div class="lista">' + lid.map((uid) => { const m = ctx.idx.membroPorUsuario[uid]; const u = dom.pessoa(ctx, uid);
      return '<div class="item' + (m ? " clicavel" : "") + '"' + (m ? ' data-rota="#/revisao/membro/' + esc(m.id) + '"' : "") + ">" + c.avatar(u, 30) + '<div class="principal-item"><div class="t">' + esc(u.nome) + '</div><div class="d">liderado direto · pela Revisão formal</div></div></div>'; }).join("") + "</div>",
      "a avaliação dos liderados é a Revisão de Progresso formal");
    return h + guiaHtml();
  }
  ui.acoes["rev-360"] = function (el) {
    const ctx = X(), ciclo = R.cicloAberto(ctx), uid = el.dataset.uid;
    if (!ciclo || E().verComo) return;
    const relacao = R.relacaoCom(ctx, eu().id, uid);
    if (!relacao) return;
    const regras = R.regrasDo(ciclo);
    const pequeno = R.grupoPequeno(ctx, uid, relacao, regras);
    const v = lerRasc(ciclo, uid);
    const pre = relacao === "Superior" ? "lid_" : "par_";
    const itens = relacao === "Superior" ? R.SOBRE_LIDERANCA.map((t) => ["", t]) : R.SOBRE_PAR;
    const papel = (R.superioresDe(ctx, eu().id).concat(R.paresDe(ctx, eu().id)).find((x) => x.uid === uid) || {}).papel || "";
    const u = dom.pessoa(ctx, uid);
    const modos = [["Anônima", "Seu nome não fica gravado com as respostas. O RH lê o conteúdo, mas não sabe quem escreveu e não consegue te procurar para entender melhor."],
      ["Identificada", "Seu nome vai junto, visível só para o RH. O RH pode te procurar para entender um ponto. A pessoa avaliada não recebe esta avaliação."]];
    ui.abrirPainel({
      titulo: "360° · " + u.nome, largo: true, sub: esc([u.cargo, papel].filter(Boolean).join(" · ")),
      corpo: '<div id="form-360" class="rv-form">' +
        (pequeno ? '<div class="aviso-atencao" style="margin-bottom:14px"><b>Grupo pequeno.</b> Esta pessoa tem menos avaliadores do que o mínimo para proteger o anonimato. Você pode responder normalmente: ' +
          (regras.abaixoMinimo === "nao_usar" ? "neste ciclo, o resultado de grupos pequenos não é usado" : "sua resposta só é usada junto com as de outras pessoas da área") + ", não gera retorno individual para essa pessoa e seus comentários nunca são repassados de forma literal.</div>" : "") +
        secao("Você convive com essa pessoa no trabalho?", "", '<p class="muted" style="margin:0 0 10px">Avalie só quem você acompanha de perto. Se não for o caso, pule. Isso não conta contra ninguém.</p><button class="btn sec peq" data-acao="rev-360-pular" data-uid="' + esc(uid) + '">Não convivo o bastante · pular esta pessoa</button>') +
        secao("Como você quer enviar?", "escolha antes de enviar; vale só para esta avaliação", '<div class="campo" data-campo="modo"><div class="escolhas empilhadas">' + modos.map((x) => '<label class="escolha"><input type="radio" name="modo" value="' + x[0] + '"' + (v.modo === x[0] ? " checked" : "") + "><span><b>" + x[0] + '</b><span class="op-d">' + esc(x[1]) + "</span></span></label>").join("") + "</div></div>") +
        secao("1. " + (relacao === "Superior" ? "Sobre esta liderança" : "Sobre este par"), relacao === "Superior" ? "8 afirmações" : "8 critérios de trabalho em equipe", itens.map((x, i) => '<div class="rv-afirm"><div class="rv-afirm-t"><span class="rv-n">' + pad(i + 1) + "</span><span>" + (x[0] ? "<b>" + esc(x[0]) + "</b> · " : "") + esc(x[1]) + "</span></div>" +
          '<div class="escolhas">' + R.ACORDO.concat([R.NAO_SEI]).map((op) => '<label class="escolha"><input type="radio" name="' + pre + (i + 1) + '" value="' + esc(op) + '"' + (v[pre + (i + 1)] === op ? " checked" : "") + ">" + esc(op) + "</label>").join("") + "</div></div>").join("")) +
        secao("2. Em palavras", "continuar, começar e um exemplo", '<p class="muted" style="margin:0 0 10px;font-size:12.5px">Na resposta anônima, evite citar datas, clientes ou situações que só você viveu: isso pode identificar quem escreveu. O RH não repassa trechos literais, só temas resumidos.</p>' +
          c.campo({ nome: "continuar", rotulo: "O que essa pessoa deveria continuar fazendo?", tipo: "textoLongo", linhas: 3, valor: v.continuar, opcional: true }) +
          c.campo({ nome: "comecar", rotulo: "O que poderia começar a fazer ou fazer de outro jeito?", tipo: "textoLongo", linhas: 3, valor: v.comecar, opcional: true }) +
          c.campo({ nome: "exemplo", rotulo: "Um exemplo concreto · Situação, Comportamento, Impacto", tipo: "textoLongo", linhas: 3, valor: v.exemplo, opcional: true })) + "</div>",
      rodape: '<button class="btn sec" data-acao="rev-360-rascunho" data-uid="' + esc(uid) + '">Salvar para depois</button><button class="btn" data-acao="rev-360-enviar" data-uid="' + esc(uid) + '">Enviar ao RH</button>',
    });
  };
  function lerForm360() {
    const d = ui.lerForm(document.getElementById("form-360"));
    const r = {};
    Object.keys(d).forEach((k) => { if (/^(lid|par)_\d$/.test(k) && d[k]) r[k] = d[k]; });
    ["continuar", "comecar", "exemplo"].forEach((k) => { if (String(d[k] || "").trim()) r[k] = String(d[k]).trim(); });
    return { modo: d.modo || "", respostas: r };
  }
  ui.acoes["rev-360-rascunho"] = function (el) {
    const ciclo = R.cicloAberto(X()), uid = el.dataset.uid;
    const f = lerForm360();
    if (!gravarRasc(ciclo, uid, Object.assign({ modo: f.modo }, f.respostas))) { ui.avisar("Este navegador não deixou guardar o rascunho.", "erro"); return; }
    marcarLimpo();
    ui.avisar("Guardado só neste navegador. Nada foi enviado.");
  };
  ui.acoes["rev-360-pular"] = function (el) {
    const ciclo = R.cicloAberto(X()), uid = el.dataset.uid;
    marcar360(ciclo, uid, "p");
    apagarRasc(ciclo, uid);
    ui.fecharPainel(true);
    ui.avisar("Pessoa pulada. Isso não conta contra ninguém.");
    ui.render();
  };
  ui.acoes["rev-360-enviar"] = function (el) {
    const ciclo = R.cicloAberto(X()), uid = el.dataset.uid;
    const form = document.getElementById("form-360");
    if (!ui.validar(form, ["modo"])) { erroNoRodape("Escolha anônima ou identificada para liberar o envio."); return; }
    const f = lerForm360();
    if (!Object.keys(f.respostas).some((k) => /^(lid|par)_/.test(k))) { erroNoRodape("Responda pelo menos uma afirmação (ou marque \"Não sei avaliar\")."); return; }
    ui.salvar(el, async () => {
      await E().repo.enviar360({ cicloId: ciclo.id, avaliado: uid, modo: f.modo, respostas: f.respostas });
      marcar360(ciclo, uid, "e");
      apagarRasc(ciclo, uid);
    }, { mensagem: "Resposta enviada ao RH. Obrigado!" });
  };

  /* ================================================================ SEUS RETORNOS */
  function telaRetornos() {
    const ctx = X(), id = String(eu().id);
    const ciclo = R.cicloAberto(ctx) || R.ultimoCiclo(ctx);
    let h = voltar() + c.cabecalho("desempenho", "Seus retornos", ciclo ? "<span>" + esc(ciclo.ciclo) + "</span>" : "");
    if (semEstrutura()) return h + avisoSemEstrutura();
    if (!ciclo) return h + '<div class="card">' + c.vazio("Os retornos chegam depois da calibração de cada ciclo.") + "</div>";
    const ret = R.retornoDe(ctx, id, ciclo);
    h += '<p class="muted" style="margin:0 0 14px">O que chega para você, de quem e quando. Nada chega antes da calibração.</p>';
    // 1. da liderança
    let c1;
    if (ret && ret.devolutivaEm) {
      c1 = c.dados([["Conversa de devolutiva", fmt(ret.devolutivaEm)], ["Com", nomeDe(R.liderDe(ctx, id))]]) +
        '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Pontos fortes combinados", ret.fortes) + c.textoRegistro("Pontos de desenvolvimento combinados", ret.desenvolver) + "</div>" +
        (metasHtml(ret) ? '<div class="rv-secao-t" style="margin-top:14px">Metas e entregas do próximo semestre</div>' + metasHtml(ret) : "") +
        (ret.cienciaEm ? '<div style="margin-top:14px">' + c.tag("Ciência confirmada em " + fmt(ret.cienciaEm), "verde") + "</div>"
          : E().verComo ? '<p class="muted" style="margin-top:14px">A ciência é confirmada pela própria pessoa.</p>'
          : '<div class="rv-ciencia" id="form-ciencia">' + c.campo({ nome: "ciencia", rotulo: "Ciência", tipo: "simNao", textoCheck: "Participei da conversa de devolutiva. (ciência, não concordância)" }) +
            '<button class="btn" data-acao="rev-ciencia" data-id="' + esc(ret.id) + '">Confirmar ciência</button></div>');
    } else c1 = '<p class="muted" style="margin:0">Conversa de devolutiva com pontos fortes e de desenvolvimento em palavras, e as metas do próximo semestre. Depois da conversa, elas aparecem aqui para você acompanhar.</p>';
    h += cartao("1 · Da sua liderança", c1, ret && ret.devolutivaEm && !ret.cienciaEm ? c.tag("Confirme a ciência", "ambar") : "", ret && ret.devolutivaEm && !ret.cienciaEm ? "acao" : "");
    // 2. do RH sobre os pares
    h += cartao("2 · Do RH, sobre seus pares", ret && ret.retornoPares ? '<div class="texto-registro">' + esc(ret.retornoPares) + '</div><p class="muted" style="font-size:12px;margin-bottom:0">Resumo em temas, sem nomes e sem trechos literais. Se quiser, peça uma conversa com o RH.</p>'
      : '<p class="muted" style="margin:0">Resumo em temas do que seus pares disseram, sem nomes e sem trechos literais. Só existe se houver respostas suficientes para proteger quem respondeu. Se quiser, peça uma conversa com o RH.</p>', ret && ret.retornoParesEm ? fmt(ret.retornoParesEm) : "");
    // 3. do RH sobre os liderados (só quem lidera)
    if (R.lideradosDe(ctx, id).length) h += cartao("3 · Do RH, sobre seus liderados", ret && ret.retornoLideradosEm ? '<p style="margin:0">Conversa com o RH em <b>' + fmt(ret.retornoLideradosEm) + "</b>. Os temas alimentam o seu PDI.</p>"
      : '<p class="muted" style="margin:0">Conversa com o RH depois que você concluir as devolutivas da sua equipe. Se você tiver menos liderados que o mínimo, o resultado entra só no diagnóstico da área.</p>');
    return h;
  }
  ui.acoes["rev-ciencia"] = function (el) {
    const f = document.getElementById("form-ciencia");
    if (!ui.validar(f, ["ciencia"])) return;
    const ret = X().idx.porId.revRetornos[el.dataset.id];
    if (!ret) return;
    ui.salvar(el, async () => {
      await ui.atualizar("revRetornos", ret.id, { cienciaEm: ui.agoraISO(), estagio: "SUCCESS" });
      const lider = R.liderDe(X(), eu().id);
      if (lider) GP.app.avisar([lider], "Revisão de Progresso: " + eu().nome + " confirmou a ciência da devolutiva.");
    }, { mensagem: "Ciência confirmada." });
  };

  /* ================================================================ RH: RELATÓRIO 360° */
  const acessosRegistrados = {};
  /** Cada abertura do relatório fica registrada no histórico do ciclo (quem e quando), uma vez por sessão */
  function registrarAcesso(ciclo) {
    if (acessosRegistrados[ciclo.id]) return;
    acessosRegistrados[ciclo.id] = true;
    const real = E().euReal || E().eu;
    const agora = new Date();
    Promise.resolve(E().repo.comentar("revCiclos", ciclo.id, "Relatório 360° aberto no app por " + real.nome + " em " + calc.fmtDataAno(X().hoje) + " às " + String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0") + "."))
      .catch((e) => console.warn("Acesso ao relatório não registrado:", e));
  }
  function grupoHtml(titulo, g, regras) {
    const itens = g.relacao === "Superior" ? R.SOBRE_LIDERANCA.map((t) => t) : R.SOBRE_PAR.map((x) => x[0] + ": " + x[1]);
    const barra = (x) => x.media === null ? '<span class="muted">sem notas</span>' : '<span class="rv-media"><span style="width:' + Math.round((x.media / 4) * 100) + '%"></span></span><b>' + String(x.media).replace(".", ",") + "</b> <span class=\"muted\">(" + x.n + ")</span>";
    const textos = g.textos;
    return '<div class="card"><h3>' + esc(titulo) + '<span class="extra muted">' + plural(g.n, "resposta", "respostas") + "</span></h3>" +
      '<div class="rv-notas">' + itens.map((t, i) => '<div class="rv-nota"><span class="rv-n">' + pad(i + 1) + "</span><span>" + esc(t) + '</span><span class="rv-nota-v">' + barra(g.itens[i]) + "</span></div>").join("") + "</div>" +
      '<p class="muted" style="font-size:12px">Média de 1 (Discordo totalmente) a 4 (Concordo totalmente), sem o "Não sei avaliar".</p>' +
      (textos ? '<details class="modelos"><summary>Comentários para o resumo em temas (' + g.comentarios + ")</summary>" + [["continuar", "Continuar fazendo"], ["comecar", "Começar ou fazer de outro jeito"], ["exemplo", "Exemplos"]].filter((k) => textos[k[0]].length)
        .map((k) => '<div class="modelo"><b>' + k[1] + "</b><ul>" + textos[k[0]].map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul></div>").join("") +
        '<div class="modelo muted">Em ordem alfabética, sem autor. Nunca repasse trechos literais: o retorno à pessoa é em temas.</div></details>'
        : '<p class="muted" style="font-size:12px;margin-bottom:0">Comentários só aparecem com ' + regras.minimoComentarios + " ou mais respostas.</p>") + "</div>";
  }
  function telaRelatorio() {
    const ctx = X();
    let h = voltar() + c.cabecalho("desempenho", "Relatório 360°", "<span>só o RH</span>");
    if (!ehRH()) return h + '<div class="card">' + c.vazio("O relatório da 360° é só do RH.") + "</div>";
    if (semEstrutura()) return h + avisoSemEstrutura();
    const ciclo = R.cicloAberto(ctx) || R.ultimoCiclo(ctx);
    if (!ciclo) return h + '<div class="card">' + c.vazio("Nenhum ciclo aberto ou encerrado ainda.") + "</div>";
    if (E().acessoNegado && E().acessoNegado.indexOf("rev360") >= 0) return h + '<div class="aviso-atencao">O seu usuário não tem leitura na tabela "Revisão · Respostas 360°" do CRM. Um administrador dá em CRM → Permissões (seção 14 do guia).</div>';
    registrarAcesso(ciclo);
    const rel = R.relatorio360(ctx, ciclo);
    const regras = R.regrasDo(ciclo);
    h += '<div class="aviso-info" style="margin-bottom:16px"><b>Regras fixas de anonimato.</b> A pessoa avaliada nunca recebe a avaliação, nem individual nem em resumo: o retorno é do RH, em temas. Resposta anônima é gravada sem autor. Grupos abaixo de ' + regras.minimoNotas +
      " respostas não aparecem sozinhos (" + (regras.abaixoMinimo === "nao_usar" ? "ficam fora deste ciclo" : "entram juntos na área") + "). Comentários só com " + regras.minimoComentarios + " ou mais respostas. Cada abertura deste relatório fica registrada no histórico do ciclo.</div>";
    h += c.kpis([{ valor: rel.total, rotulo: "respostas recebidas", tom: "azul" }, { valor: rel.pessoas.length, rotulo: "pessoas no relatório", tom: "verde" }, { valor: rel.areas.length, rotulo: "grupos por área", tom: "roxo" },
      { valor: rel.foraDoRelatorio, rotulo: "respostas abaixo do mínimo", tom: "cinza" }]);
    if (!rel.pessoas.length && !rel.areas.length) h += '<div class="card">' + c.vazio("Nenhum grupo atingiu o mínimo de " + regras.minimoNotas + " respostas ainda.") + "</div>";
    rel.pessoas.forEach((p) => { h += grupoHtml(p.nome + " · " + (p.relacao === "Superior" ? "como liderança" : "como par"), p, regras); });
    rel.areas.forEach((a) => { h += grupoHtml("Área " + a.area + " · " + (a.relacao === "Superior" ? "lideranças" : "pares") + " (grupos pequenos juntos)", a, regras); });
    return h;
  }

  /* ================================================================ RH: ABERTURA E ENCERRAMENTO DO CICLO */
  function regrasHtml(r) {
    const op = { todos: "Todos os membros ativos", sem_estagio: "Todos, exceto estágios", selecionar: "Áreas selecionadas" };
    const areas = R.areas(X());
    return cartao("Regras do ciclo", c.dados([["Público", op[r.publico] + (r.publico === "selecionar" ? ": " + areas.filter((a) => r.areas.indexOf(a.id) >= 0).map((a) => a.nome).join(", ") : "")],
      ["Membros fora deste ciclo", r.excluidos.length ? String(r.excluidos.length) : "nenhum"], ["360° de superiores", r.liberarLideranca ? "liberada" : "fechada"], ["360° de pares", r.liberarPares ? "liberada" : "fechada"],
      ["Mínimo para notas", String(r.minimoNotas)], ["Mínimo para comentários", String(r.minimoComentarios)], ["Abaixo do mínimo", r.abaixoMinimo === "nao_usar" ? "não usar neste ciclo" : "juntar com a área"],
      ["Liderança com poucos liderados", r.retornoLidPequeno === "nao_usar" ? "não usar neste ciclo" : "sem retorno individual · diagnóstico da área"],
      ["Retorno à CEO e ao RH", r.retornoTopo === "consultoria" ? "consultoria externa para os dois" : "CEO dá ao RH · consultoria dá à CEO"]]) +
      (r.excecoes ? '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Exceções", r.excecoes) + "</div>" : ""));
  }
  function telaCiclo() {
    const ctx = X();
    let h = voltar();
    if (!ehRH()) return h + '<div class="card">' + c.vazio("Só o RH abre e encerra os ciclos.") + "</div>";
    const aberto = R.cicloAberto(ctx), rasc = R.cicloRascunho(ctx);
    const ci = aberto || rasc;
    const acoes = aberto ? '<button class="btn sec" data-acao="rev-ciclo-form" data-id="' + esc(aberto.id) + '">Editar prazos e regras</button><button class="btn link" data-acao="rev-encerrar" data-id="' + esc(aberto.id) + '">Encerrar o ciclo</button>'
      : '<button class="btn" data-acao="rev-ciclo-form"' + (rasc ? ' data-id="' + esc(rasc.id) + '"' : "") + ">" + (rasc ? "Continuar a abertura" : "Preparar a abertura") + "</button>" +
        (rasc ? '<button class="btn link" data-acao="rev-descartar-ciclo" data-id="' + esc(rasc.id) + '">Descartar o rascunho</button>' : "");
    h += c.cabecalho("desempenho", "Abertura do ciclo", aberto ? "<span>" + c.tag("Ciclo aberto", "verde") + "</span>" : rasc ? "<span>" + c.tag("Rascunho", "ambar") + "</span>" : "<span>nenhum ciclo aberto · aberturas em junho e novembro</span>", semEstrutura() ? "" : acoes);
    if (semEstrutura()) return h + avisoSemEstrutura();
    if (ci) h += cicloHtml(ci) + regrasHtml(R.regrasDo(ci));
    else h += '<div class="aviso-info" style="margin-bottom:16px">Defina o ciclo e o período, os prazos de cada etapa, quem participa, as regras da 360° e dos retornos. Salve como rascunho quantas vezes precisar: o ciclo só abre depois das 3 conferências.</div>';
    // a lista para conferir a liderança direta de cada membro antes de abrir
    const part = R.participantes(ctx, ci);
    const dentro = part.filter((x) => x.ok);
    h += cartao("Quem participa" + (ci ? "" : " (com as regras padrão)"), '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Membro</th><th>Cargo na matriz</th><th>Liderança direta</th><th>Situação</th></tr></thead><tbody>' +
      part.map((x) => '<tr class="clicavel" data-rota="#/membro/' + esc(x.m.id) + '"><td>' + esc(nomeDe(x.m.responsavel)) + "</td><td>" + esc(R.cargoDo(x.m) ? nomeCargo(R.cargoDo(x.m)) : "—") + "</td><td>" + esc(nomeDe(dom.liderancaEfetiva(ctx, x.m))) + "</td><td>" +
        (x.ok ? c.tag("participa", "verde") : '<span class="muted">' + esc(x.motivo) + "</span>") + "</td></tr>").join("") + "</tbody></table></div>" +
      '<p class="muted" style="font-size:12px;margin-bottom:0">Confira no Bitrix a liderança direta de cada membro (Minha equipe → membro). O cargo na matriz fica no cadastro do membro.</p>', dentro.length + " de " + part.length + " participam");
    h += '<details class="card politica"><summary>Guia da abertura</summary><div class="corpo-politica">' + [
      ["Calendário", "Ciclos abertos pelo RH em junho e novembro. Ordem das etapas: autoavaliação, avaliação da liderança e 360°, calibração, devolutivas das lideranças e retornos do RH."],
      ["O que a abertura libera", "Lideranças: o envio ao RH (rascunhos feitos antes entram no ciclo). Membros: a autoavaliação e a avaliação 360° de superiores e pares. Todos recebem um aviso no Bitrix."],
      ["Destino e retornos", "Formulários chegam só ao RH. Lideranças dão a devolutiva aos membros. O RH dá o retorno de pares a cada membro e o de liderados a cada liderança, sempre em temas."],
      ["Anonimato", "Resposta anônima é gravada sem autor (pelo servidor do app, não pelo login de quem respondeu). Relatórios só com o mínimo de respostas, comentários nunca repassados de forma literal. Grupos abaixo do mínimo seguem a regra definida na seção 4."],
      ["Antes de abrir", "Confira a liderança direta de cada membro, as matrizes dos cargos e, com a 360° liberada, a demonstração técnica do anonimato pela TI. Esses itens liberam o botão Abrir ciclo."],
    ].map((x) => "<h4>" + esc(x[0]) + "</h4><p>" + esc(x[1]) + "</p>").join("") + "</div></details>";
    return h;
  }
  ui.acoes["rev-ciclo-form"] = function (el) {
    if (!ehRH()) return;
    const ctx = X();
    const ci = el.dataset.id ? ctx.idx.porId.revCiclos[el.dataset.id] : null;
    const r = R.regrasDo(ci);
    const v = ci || {};
    const aberto = ci && ci.estagio === "ABERTO";
    const membros = dom.membrosAtivos(ctx.registros.membros || []).filter((m) => m.estagio !== "EM_ENCERRAMENTO").sort((a, b) => nomeDe(a.responsavel).localeCompare(nomeDe(b.responsavel), "pt-BR"));
    const check = (nome, texto, marcado) => '<label class="escolha rv-check"><input type="checkbox" name="' + esc(nome) + '"' + (marcado ? " checked" : "") + "><span>" + esc(texto) + "</span></label>";
    const prazo = (nome, rot) => c.campo({ nome, rotulo: rot, tipo: "data", valor: v[nome] });
    ui.abrirPainel({
      titulo: aberto ? "Editar o ciclo aberto" : "Abertura do ciclo", largo: true, sub: "Revisão de Progresso · uso exclusivo do RH",
      corpo: '<div id="form-ciclo" class="rv-form">' +
        secao("1. Ciclo e período", "qual ciclo e qual período será avaliado", c.campo({ nome: "ciclo", rotulo: "Ciclo", tipo: "lista", opcoes: R.CICLOS.indexOf(v.ciclo) >= 0 || !v.ciclo ? R.CICLOS : [v.ciclo].concat(R.CICLOS), valor: v.ciclo }) +
          '<div class="linha-campos">' + prazo("periodoInicio", "Início do período avaliado") + prazo("periodoFim", "Fim do período avaliado") + "</div>" + prazo("dataAbertura", "Data de abertura")) +
        secao("2. Prazos de cada etapa", "aparecem para lideranças e membros", '<div class="linha-campos">' + prazo("prazoAuto", "Autoavaliação do membro até") + prazo("prazoLideranca", "Avaliação da liderança até") + "</div>" +
          '<div class="linha-campos">' + prazo("prazoCalibracao", "Calibração até") + prazo("prazoDevolutiva", "Devolutivas das lideranças até") + "</div>" + prazo("prazoRetornos", "Retornos do RH até") +
          '<p class="muted rv-sub">O retorno dos liderados chega à liderança só depois que ela conclui as devolutivas da equipe, para não influenciar a conversa.</p>') +
        secao("3. Quem participa", "por padrão, todos os membros ativos com cargo na matriz", c.campo({ nome: "publico", rotulo: "Público", tipo: "escolha", valor: r.publico,
          opcoes: [{ valor: "todos", rotulo: "Todos os membros ativos" }, { valor: "sem_estagio", rotulo: "Todos, exceto estágios" }, { valor: "selecionar", rotulo: "Selecionar áreas" }] }) +
          '<div class="campo"><label>Áreas (só com "Selecionar áreas")</label><div class="escolhas">' + R.areas(ctx).map((a) => check("area_" + a.id, a.nome, r.areas.indexOf(a.id) >= 0)).join("") + "</div></div>" +
          '<div class="campo"><label>Membros fora deste ciclo</label><div class="ajuda">Marque quem não participa (licença, desligamento combinado, entrada recente). O motivo vai em Exceções.</div><div class="rv-caixa">' +
            membros.map((m) => check("excl_" + m.id, nomeDe(m.responsavel) + (R.cargoDo(m) ? "" : " (sem cargo na matriz)"), r.excluidos.map(String).indexOf(String(m.id)) >= 0)).join("") + "</div></div>" +
          c.campo({ nome: "excecoes", rotulo: "Exceções (nomes ou áreas fora deste ciclo, com motivo)", tipo: "textoLongo", linhas: 3, valor: r.excecoes, opcional: true }) +
          '<p class="muted rv-sub">Estágios: o formato da avaliação segue pendente de validação jurídica (Lei 11.788/2008).</p>') +
        secao("4. Avaliação 360° e anonimato", "superiores e pares, no app de cada pessoa, anônima ou identificada",
          check("liberarLideranca", "Liberar para cada membro avaliar os superiores (superior imediato e, quando houver supervisão, quem está acima dela).", r.liberarLideranca) +
          check("liberarPares", "Liberar para cada membro avaliar os pares (mesma liderança direta, inclusive entre lideranças).", r.liberarPares) +
          '<p class="muted rv-sub">Liderados diretos são avaliados pela Revisão formal, no app Gestão de Pessoas.</p>' +
          '<div class="linha-campos">' + c.campo({ nome: "minimoNotas", rotulo: "Mínimo de respostas para usar notas em relatório", tipo: "lista", opcoes: ["3", "4", "5"], valor: String(r.minimoNotas) }) +
          c.campo({ nome: "minimoComentarios", rotulo: "Mínimo de respostas para usar comentários", tipo: "lista", opcoes: ["5", "7", "10"], valor: String(r.minimoComentarios) }) + "</div>" +
          c.campo({ nome: "abaixoMinimo", rotulo: "Quando um grupo não atinge o mínimo", tipo: "escolha", valor: r.abaixoMinimo, opcoes: [{ valor: "juntar_area", rotulo: "Juntar com a área até atingir o mínimo" }, { valor: "nao_usar", rotulo: "Não usar o resultado neste ciclo" }] }) +
          '<div class="rv-regras"><b>Regras fixas de anonimato</b><ul><li>O RH nunca repassa trechos literais de comentários. Nos relatórios entram só temas resumidos.</li><li>Filtros não podem ser combinados se o grupo resultante ficar abaixo do mínimo (área + cidade + tempo de casa, por exemplo).</li>' +
          "<li>Resposta anônima é gravada sem autor. Nem o RH nem a TI conseguem identificar quem escreveu.</li><li>A pessoa avaliada nunca recebe a avaliação, nem individual nem em resumo. Abaixo do mínimo, o grupo segue a regra escolhida acima e nunca aparece sozinho em relatório.</li></ul></div>") +
        secao("5. Retornos do RH", "pares para cada membro e liderados para cada liderança", '<p class="muted rv-sub">Pares: resumo escrito com 2 ou 3 pontos fortes e 2 ou 3 de desenvolvimento, em temas; conversa com o RH só se o membro pedir. Liderados: conversa de cerca de 30 minutos, depois que a liderança concluir as devolutivas; os temas alimentam o PDI da própria liderança.</p>' +
          c.campo({ nome: "retornoLidPequeno", rotulo: "Liderança com menos liderados do que o mínimo", tipo: "escolha", valor: r.retornoLidPequeno, opcoes: [{ valor: "diagnostico_area", rotulo: "Sem retorno individual · entra no diagnóstico da área" }, { valor: "nao_usar", rotulo: "Não usar neste ciclo" }] }) +
          c.campo({ nome: "retornoTopo", rotulo: "Quem dá o retorno à CEO e ao próprio RH", tipo: "escolha", valor: r.retornoTopo, opcoes: [{ valor: "consultoria", rotulo: "Consultoria externa para os dois" }, { valor: "ceo_rh_consultoria_ceo", rotulo: "CEO dá ao RH · consultoria dá à CEO" }] }) +
          '<p class="muted rv-sub">O RH não dá retorno sobre si mesmo. As regras de anonimato da seção 4 valem para todos os retornos.</p>') +
        secao("6. Conferência antes de abrir", "os itens marcados liberam o botão Abrir ciclo", check("ok_lista", "Conferi no Bitrix a liderança direta de cada membro.", r.conferencias.lista) +
          check("ok_matriz", "Conferi que todos os cargos participantes têm matriz validada.", r.conferencias.matriz) +
          check("ok_anonimato", "A TI demonstrou com uma resposta de teste que a avaliação anônima é gravada sem autor, que os acessos ficam registrados e que a exportação bruta está bloqueada.", r.conferencias.anonimato)) +
        c.campo({ nome: "mensagem", rotulo: "Mensagem para as lideranças", tipo: "textoLongo", linhas: 3, valor: v.mensagem, opcional: true }) + "</div>",
      rodape: aberto ? '<button class="btn" data-acao="rev-salvar-ciclo" data-id="' + esc(ci.id) + '">Salvar</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>'
        : '<button class="btn sec" data-acao="rev-salvar-ciclo"' + (ci ? ' data-id="' + esc(ci.id) + '"' : "") + '>Salvar rascunho</button><button class="btn" data-acao="rev-salvar-ciclo" data-abrir="1"' + (ci ? ' data-id="' + esc(ci.id) + '"' : "") + ">Abrir ciclo</button>",
    });
  };
  function lerCiclo() {
    const d = ui.lerForm(document.getElementById("form-ciclo"));
    const marcados = (pre) => Object.keys(d).filter((k) => k.indexOf(pre) === 0 && d[k] === true).map((k) => k.slice(pre.length));
    const regras = {
      publico: d.publico || "todos", areas: marcados("area_"), excluidos: marcados("excl_"), excecoes: String(d.excecoes || "").trim(),
      liberarLideranca: !!d.liberarLideranca, liberarPares: !!d.liberarPares, minimoNotas: Number(d.minimoNotas) || 3, minimoComentarios: Number(d.minimoComentarios) || 5,
      abaixoMinimo: d.abaixoMinimo || "juntar_area", retornoLidPequeno: d.retornoLidPequeno || "diagnostico_area", retornoTopo: d.retornoTopo || "consultoria",
      conferencias: { lista: !!d.ok_lista, matriz: !!d.ok_matriz, anonimato: !!d.ok_anonimato },
    };
    const dados = { ciclo: d.ciclo, regras: JSON.stringify(regras), mensagem: String(d.mensagem || "").trim() };
    ["periodoInicio", "periodoFim", "dataAbertura", "prazoAuto", "prazoLideranca", "prazoCalibracao", "prazoDevolutiva", "prazoRetornos"].forEach((k) => { dados[k] = d[k] || ""; });
    return { dados, regras };
  }
  ui.acoes["rev-salvar-ciclo"] = function (el) {
    if (!ehRH()) return;
    const ctx = X();
    const f = document.getElementById("form-ciclo");
    const ci = el.dataset.id ? ctx.idx.porId.revCiclos[el.dataset.id] : null;
    const abrir = el.dataset.abrir === "1";
    const jaAberto = ci && ci.estagio === "ABERTO";
    const { dados, regras } = lerCiclo();
    if (!ui.validar(f, abrir || jaAberto ? ["ciclo", "periodoInicio", "periodoFim", "dataAbertura", "prazoAuto", "prazoLideranca", "prazoCalibracao", "prazoDevolutiva", "prazoRetornos"] : ["ciclo"])) return;
    if (dados.periodoFim && dados.periodoInicio && dados.periodoFim < dados.periodoInicio) { erroNoRodape("O fim do período avaliado é antes do início."); return; }
    if (regras.publico === "selecionar" && !regras.areas.length) { erroNoRodape("Com \"Selecionar áreas\", marque pelo menos uma área."); return; }
    if (abrir) {
      const pode = R.podeAbrir(regras);
      if (!pode.ok) { erroNoRodape("<b>Para abrir, falta:</b> " + esc(pode.faltam.join("; ")) + "."); return; }
      const outro = R.cicloAberto(ctx);
      if (outro && (!ci || outro.id !== ci.id)) { erroNoRodape("Já existe um ciclo aberto (" + esc(outro.ciclo) + "). Encerre-o antes de abrir outro."); return; }
    }
    const titulo = "Revisão de Progresso · " + dados.ciclo;
    const participantes = abrir ? R.participantes(Object.assign({}, ctx), { regras: dados.regras }).filter((x) => x.ok).map((x) => x.m) : [];
    if (abrir && !window.confirm("Abrir o ciclo " + dados.ciclo + "?\n\n" + participantes.length + " pessoas participam. Lideranças passam a enviar as avaliações ao RH; membros recebem a autoavaliação" + (regras.liberarLideranca || regras.liberarPares ? " e a 360°" : "") + ". Todos recebem um aviso no Bitrix.")) return;
    ui.salvar(el, async () => {
      const base = Object.assign({ titulo }, dados, abrir ? { estagio: "ABERTO" } : {});
      if (ci) await ui.atualizar("revCiclos", ci.id, base);
      else await ui.criar("revCiclos", Object.assign(base, { autor: eu().id, responsavel: eu().id, estagio: abrir ? "ABERTO" : "NEW" }));
      if (abrir) {
        const ids = {};
        participantes.forEach((m) => { ids[m.responsavel] = true; const l = dom.liderancaEfetiva(X(), m); if (l) ids[l] = true; });
        GP.app.avisar(Object.keys(ids), "O RH abriu a Revisão de Progresso (" + dados.ciclo + "). Autoavaliação até " + calc.fmtData(dados.prazoAuto) + "; avaliação das lideranças e 360° até " + calc.fmtData(dados.prazoLideranca) + ". Abra o app Gestão de Pessoas → Revisão de Progresso.");
      }
    }, { mensagem: abrir ? "Ciclo aberto. Lideranças e membros foram avisados." : jaAberto ? "Ciclo atualizado." : "Rascunho do ciclo salvo." });
  };
  ui.acoes["rev-encerrar"] = function (el) {
    const ci = X().idx.porId.revCiclos[el.dataset.id];
    if (!ci || !ehRH()) return;
    if (!window.confirm("Encerrar o ciclo " + ci.ciclo + "?\n\nAs lideranças não enviam mais avaliações e a 360° fecha. Os registros continuam guardados, e os retornos seguem visíveis para cada pessoa.")) return;
    ui.salvar(el, async () => { await ui.atualizar("revCiclos", ci.id, { estagio: "SUCCESS" }); ui.navegar("#/revisao"); }, { mensagem: "Ciclo encerrado." });
  };
  ui.acoes["rev-descartar-ciclo"] = function (el) {
    const ci = X().idx.porId.revCiclos[el.dataset.id];
    if (!ci || !ehRH() || !window.confirm("Descartar o rascunho do ciclo?")) return;
    ui.salvar(el, async () => { await ui.atualizar("revCiclos", ci.id, { estagio: "FAIL" }); }, { mensagem: "Rascunho descartado." });
  };

  /* ================================================================ MATRIZES DOS CARGOS */
  function telaMatriz(codigo) {
    const ctx = X(), cfg = E().config;
    let h = voltar() + c.cabecalho("desempenho", "Matrizes dos cargos", "<span>" + esc(MZ.VERSAO) + "</span><span>" + R.CODIGOS.length + " cargos</span>", eu().admin ? '<a class="btn sec" href="#/config">Nomes dos cargos (Configuração)</a>' : "");
    const cg = codigo && MZ.CARGOS[codigo] ? codigo : "";
    if (cg) {
      const C = MZ.CARGOS[cg];
      h += cartao(cg + " · " + (R.nomeCargo(cfg, cg) || "sem nome"), secao("KPIs", plural(C.kpis.length, "KPI", "KPIs"), C.kpis.map((k, i) => '<div class="rv-lido"><div class="rv-lido-t"><span class="rv-n">' + pad(i + 1) + "</span>" + esc(k.indicador) + '</div><div class="muted rv-sub">' +
          esc(k.objetivo) + " · meta " + esc(k.meta) + " · " + esc(k.calculo) + " · peso sugerido " + esc(k.peso) + " · " + esc([k.tipo, k.frequencia, k.fonte].filter(Boolean).join(" · ")) + "</div></div>").join("")) +
        secao("Competências", plural(C.competencias.length, "competência", "competências"), C.competencias.map((x, i) => '<div class="rv-lido"><div class="rv-lido-t"><span class="rv-n">' + pad(i + 1) + "</span>" + esc(x.nome) + '<span class="rv-lido-tags">' + c.tag("mínimo " + R.rotuloNivel(x.minimo), "cinza") + "</span></div>" +
          '<div class="muted rv-sub">' + esc(x.dimensao) + (x.pratica ? " · " + esc(x.pratica) : "") + (x.comoAvaliar ? " · como avaliar: " + esc(x.comoAvaliar) : "") + "</div></div>").join("")), '<a href="#/revisao/matriz">todos os cargos</a>');
    }
    const usados = {};
    dom.membrosAtivos(ctx.registros.membros || []).forEach((m) => { const x = R.cargoDo(m); if (x) usados[x] = (usados[x] || 0) + 1; });
    h += cartao("Cargos", '<div class="lista">' + R.CODIGOS.map((x) => { const C = MZ.CARGOS[x]; const n = R.nomeCargo(cfg, x);
      return '<div class="item clicavel" data-rota="#/revisao/matriz/' + x + '"><div class="principal-item"><div class="t">' + x + " · " + (n ? esc(n) : '<span class="muted">sem nome</span>') + '</div><div class="d">' +
        esc(plural(C.kpis.length, "KPI", "KPIs") + " · " + plural(C.competencias.length, "competência", "competências") + (C.kpis[0] ? " · 1º objetivo: " + C.kpis[0].objetivo : "")) + '</div></div><div class="lado">' + (usados[x] ? c.tag(plural(usados[x], "membro", "membros"), "azul") : "") + "</div></div>"; }).join("") + "</div>",
      "os nomes ficam em Configuração; o cargo de cada membro, no cadastro dele");
    return h + glossarioHtml() + escalasHtml();
  }

  GP.telas = GP.telas || {};
  GP.telas.revisao = { linhaMembro, avaliacaoHtml };
})(window);
