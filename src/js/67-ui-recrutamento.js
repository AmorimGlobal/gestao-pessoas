/* =====================================================================================
   TELAS — Recrutamento (3.1): solicitar vaga, acompanhar e avaliar finalistas
   -------------------------------------------------------------------------------------
   As vagas vêm do funil de negócios "HR | Requisição de Vagas" (categoria 77), criado em
   07/10/2026 com o formulário CRM 259. A liderança vê as vagas que pediu (pelo e-mail do
   solicitante), a coordenação as do setor e o RH todas. O funil de R&S está em criação:
   quando existir, só a categoria muda em Configuração.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const E = () => ui.estado;
  const op = GP.schema.OPCOES;

  ui.rotas.recrutamento = function (partes) {
    if (partes[0] === "finalista" && partes[1]) return telaFinalista(partes[1]);
    const ctx = E().ctx;
    const uid = E().visao === "rh" ? null : E().eu.id;
    const vagas = dom.vagasDe(ctx, uid);
    const abertas = vagas.filter((v) => !v.semantica);
    const fechadas = vagas.filter((v) => v.fechada);
    const fin = (ctx.registros.finalistas || []).filter((f) => E().visao === "rh" || f.lideranca === E().eu.id);
    const finPend = fin.filter((f) => ["NEW", "ATRASADO"].indexOf(f.estagio) >= 0);
    const links = (E().config && E().config.links) || {};
    const formal = dom.papeis(ctx, E().eu.id).enviaFormal;
    const erroVagas = ctx.vagas && ctx.vagas.erro;
    let h = c.cabecalho("recrutamento", "Recrutamento", "<span><b>" + abertas.length + "</b> vaga(s) em aberto</span><span><b>" + finPend.length + "</b> finalista(s) para avaliar</span>",
      links.formVaga ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(links.formVaga) + '">' + icone("mais", 15) + " Solicitar vaga</a>" : "");
    h += '<div class="aviso-info" style="margin-bottom:16px">' + (E().visao === "rh" ? "Pedidos do RH entram direto no funil de vagas." : formal ? "Como coordenação, a sua solicitação vai direto ao RH." : "A solicitação de uma liderança direta vai primeiro para a coordenação, que aprova e envia ao RH.") +
      " O formulário abre dentro do Bitrix, com você identificada pelo login.</div>";
    if (erroVagas) h += '<div class="aviso-atencao" style="margin-bottom:16px">Não foi possível ler o funil de vagas: ' + esc(erroVagas) + ". O TI precisa dar à função Liderança acesso de leitura ao funil \"HR | Requisição de Vagas\".</div>";
    if (finPend.length) {
      h += '<div class="card acao"><h3>Avaliar os finalistas<span class="extra muted">prazo de 5 dias úteis</span></h3><div class="lista">' + finPend.map((f) =>
        '<div class="item clicavel" data-rota="#/recrutamento/finalista/' + esc(f.id) + '"><div class="principal-item"><div class="t">' + esc(f.candidato || f.titulo) + '</div><div class="d">' + esc(f.titulo) + "</div></div><div class=\"lado\">" + c.prazo(f.prazo) + "</div></div>").join("") + "</div></div>";
    }
    h += '<div class="card"><h3>Vagas em andamento</h3>' + (abertas.length ? '<div class="lista">' + abertas.map((v) =>
      '<div class="item"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">' + (v.solicitante ? "pedida por " + esc(v.solicitante) + " · " : "") + (v.atualizadoEm ? "última atualização do RH em " + calc.fmtData(v.atualizadoEm) : "") + "</div>" +
      '<div class="barra" style="margin-top:8px;max-width:360px"><div class="preench" style="width:' + (v.posicao ? Math.round((v.posicao / v.totalEtapas) * 100) : 0) + '%"></div></div></div>' +
      '<div class="lado"><span class="tag azul">Etapa ' + (v.posicao || "?") + " de " + v.totalEtapas + " · " + esc(v.etapa) + "</span>" +
      (v.diasEmAberto !== null ? '<span class="prazo">' + plural(v.diasEmAberto, "dia", "dias") + " em aberto</span>" : '<span class="prazo">aguardando aprovação</span>') +
      (v.entradaDesejada ? '<span class="prazo">entrada desejada ' + calc.fmtData(v.entradaDesejada) + "</span>" : "") + "</div></div>").join("") + "</div>" : c.vazio("Nenhuma vaga em andamento.")) + "</div>";
    if (fechadas.length) h += '<div class="card"><h3>Vagas preenchidas</h3><div class="lista">' + fechadas.map((v) => '<div class="item"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">fechada em ' + calc.fmtData(v.fechadaEm) + "</div></div><div class=\"lado\">" +
      (v.tempoParaFechar !== null ? c.tag(v.tempoParaFechar + " dias para fechar", "verde") : "") + "</div></div>").join("") + "</div></div>";
    return h;
  };

  function telaFinalista(id) {
    const ctx = E().ctx;
    const f = ctx.idx.porId.finalistas[id];
    if (!f) return c.voltar("#/recrutamento", "Recrutamento") + '<div class="card">' + c.vazio("Avaliação não encontrada.") + "</div>";
    const registrado = f.estagio === "SUCCESS";
    return c.voltar("#/recrutamento", "Recrutamento") + c.cabecalho("recrutamento", "Finalista: " + (f.candidato || f.titulo), "<span>" + esc(f.titulo) + "</span>" + (registrado ? "" : "<span>" + c.prazo(f.prazo) + "</span>")) +
      '<div class="card"><h3>Parecer do RH</h3><div class="texto-registro">' + esc(f.parecerRH || "O RH ainda não registrou o parecer.") + "</div></div>" +
      (registrado ? '<div class="card"><h3>Seu parecer</h3>' + c.dados([["Parecer", f.parecer]]) + '<div class="sci" style="margin-top:12px">' + c.textoRegistro("Pontos fortes e pontos de atenção", f.pontos) + "</div></div>"
        : '<div class="card acao"><h3>Seu parecer</h3><div id="form-finalista">' + c.campo({ nome: "parecer", rotulo: "Parecer da liderança", tipo: "escolha", opcoes: op.parecerFinalista }) +
          c.campo({ nome: "pontos", rotulo: "Pontos fortes e pontos de atenção", tipo: "textoLongo", ajuda: "O que você viu na entrevista." }) +
          '<button class="btn" data-acao="salvar-finalista" data-id="' + esc(f.id) + '">Registrar o parecer</button></div></div>');
  }
  ui.acoes["salvar-finalista"] = function (el) {
    const f = document.getElementById("form-finalista");
    if (!ui.validar(f, ["parecer", "pontos"])) return;
    const d = ui.lerForm(f);
    const item = E().ctx.idx.porId.finalistas[el.dataset.id];
    ui.salvar(el, async () => {
      await ui.atualizar("finalistas", item.id, { parecer: d.parecer, pontos: d.pontos, estagio: "SUCCESS" });
      // "Quero conversar com o RH antes" pede ao RH que agende a conversa
      if (d.parecer === "Quero conversar com o RH antes") await GP.app.avisarRH("A liderança quer conversar antes de seguir com a finalista " + (item.candidato || "") + ". Agende a conversa.");
      else await GP.app.avisarRH("Parecer da liderança registrado para a finalista " + (item.candidato || "") + ".");
    }, { mensagem: "Parecer registrado. O RH segue com a próxima etapa." });
  };
})(window);
