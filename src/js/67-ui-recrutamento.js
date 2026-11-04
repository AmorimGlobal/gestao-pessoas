/* =====================================================================================
   TELAS — Recrutamento (3.1): solicitar vaga, acompanhar e avaliar finalistas
   -------------------------------------------------------------------------------------
   As vagas vêm do funil de negócios "HR | Requisição de Vagas" (categoria 77), criado em
   07/10/2026. Desde 04/11/2026 a Solicitação de Contratação é feita aqui no app (antes era
   o formulário CRM 259): as mesmas perguntas, e o card nasce em "Nova solicitação". A
   liderança vê as vagas que pediu (pelo e-mail do solicitante), a coordenação as do setor
   e o RH todas. O funil de R&S está em criação: quando existir, só a categoria muda em
   Configuração.
   ===================================================================================== */
(function (raiz) {
  "use strict";
  const GP = raiz.GP;
  const { esc, icone, plural } = GP.util;
  const calc = GP.calc, dom = GP.dominio, ui = GP.ui, c = GP.ui.c;
  const F = GP.formularios;
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
    const formal = dom.papeis(ctx, E().eu.id).enviaFormal;
    const erroVagas = ctx.vagas && ctx.vagas.erro;
    let h = c.cabecalho("recrutamento", "Recrutamento", "<span><b>" + abertas.length + "</b> vaga(s) em aberto</span><span><b>" + finPend.length + "</b> finalista(s) para avaliar</span>",
      '<button class="btn" data-acao="solicitar-vaga">' + icone("mais", 15) + " Solicitar vaga</button>");
    h += '<div class="aviso-info" style="margin-bottom:16px">A solicitação cria o card no funil HR | Requisição de Vagas, em "Nova solicitação", e avisa o RH. ' +
      (E().visao === "rh" ? "O RH também pode registrar um pedido por aqui." : formal ? "Como coordenação, a sua solicitação vai direto ao RH." : "Antes de enviar, alinhe com a sua coordenação a necessidade, o escopo, a senioridade, o perfil e a prioridade da vaga. Ela recebe um aviso quando você envia.") + "</div>";
    if (erroVagas) h += '<div class="aviso-atencao" style="margin-bottom:16px">Não foi possível ler o funil de vagas: ' + esc(erroVagas) + ". O TI precisa dar à função Liderança acesso de leitura ao funil \"HR | Requisição de Vagas\".</div>";
    // Alerta vermelho do RH: solicitações que ainda estão em "Nova solicitação" (reunião de 29/10/2026)
    const novas = E().visao === "rh" ? vagas.filter((v) => v.nova) : [];
    if (novas.length) h += '<div class="card acao vermelho"><h3>' + icone("alerta", 16) + " " + plural(novas.length, "solicitação de vaga nova aguarda o RH", "solicitações de vaga novas aguardam o RH") + '</h3><div class="lista">' +
      novas.map((v) => '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">' + (v.solicitante ? "pedida por " + esc(v.solicitante) : "") + (v.atualizadoEm ? " · em " + calc.fmtData(v.atualizadoEm) : "") + '</div></div><div class="lado">' + c.tag("Nova solicitação", "vermelho") + "</div></div>").join("") +
      '</div><p class="muted" style="font-size:12px;margin:10px 0 0">O alerta some quando o card sai de "Nova solicitação" no funil HR | Requisição de Vagas.</p></div>';
    if (finPend.length) {
      h += '<div class="card acao"><h3>Avaliar os finalistas<span class="extra muted">prazo de 5 dias úteis</span></h3><div class="lista">' + finPend.map((f) =>
        '<div class="item clicavel" data-rota="#/recrutamento/finalista/' + esc(f.id) + '"><div class="principal-item"><div class="t">' + esc(f.candidato || f.titulo) + '</div><div class="d">' + esc(f.titulo) + "</div></div><div class=\"lado\">" + c.prazo(f.prazo) + "</div></div>").join("") + "</div></div>";
    }
    h += '<div class="card"><h3>Vagas em andamento</h3>' + (abertas.length ? '<div class="lista">' + abertas.map((v) =>
      '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">' + (v.solicitante ? "pedida por " + esc(v.solicitante) + " · " : "") + (v.atualizadoEm ? "última atualização do RH em " + calc.fmtData(v.atualizadoEm) : "") + "</div>" +
      '<div class="barra" style="margin-top:8px;max-width:360px"><div class="preench" style="width:' + (v.posicao ? Math.round((v.posicao / v.totalEtapas) * 100) : 0) + '%"></div></div></div>' +
      '<div class="lado"><span class="tag azul">Etapa ' + (v.posicao || "?") + " de " + v.totalEtapas + " · " + esc(v.etapa) + "</span>" +
      (v.diasEmAberto !== null ? '<span class="prazo">' + plural(v.diasEmAberto, "dia", "dias") + " em aberto</span>" : '<span class="prazo">aguardando aprovação</span>') +
      (v.entradaDesejada ? '<span class="prazo">entrada desejada ' + calc.fmtData(v.entradaDesejada) + "</span>" : "") + "</div></div>").join("") + "</div>" : c.vazio("Nenhuma vaga em andamento.")) + "</div>";
    if (fechadas.length) h += '<div class="card"><h3>Vagas preenchidas</h3><div class="lista">' + fechadas.map((v) => '<div class="item clicavel" data-acao="abrir-negocio" data-id="' + esc(v.id) + '" title="Abrir o card na pipe"><div class="principal-item"><div class="t">' + esc(v.titulo) + '</div><div class="d">fechada em ' + calc.fmtData(v.fechadaEm) + "</div></div><div class=\"lado\">" +
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

  /* ---------------- Solicitação de Contratação (o antigo formulário CRM 259, agora no app) ---------------- */
  let inicial = {}; // respostas iniciais do formulário aberto: o aviso à coordenação só sai se ela não foi trocada
  ui.acoes["solicitar-vaga"] = function () {
    const ctx = E().ctx, eu = E().eu;
    inicial = F.inicialVaga(ctx, eu.id);
    // já lê os campos do funil enquanto a pessoa preenche (a leitura é grande: todos os campos de negócio do portal)
    if (E().repo.camposNegocio) E().repo.camposNegocio().catch((e) => console.warn("Campos do funil não lidos:", e));
    ui.abrirPainel({
      titulo: "Solicitar vaga", largo: true,
      sub: "Solicitação de Contratação. O card nasce no funil HR | Requisição de Vagas, em \"Nova solicitação\", e o RH recebe o aviso.",
      corpo: '<div id="form-vaga"><p class="desc-form">' + esc(F.VAGA.descricao) + "</p>" +
        '<div class="aviso-info" style="margin-bottom:14px">Enviada em nome de <b>' + esc(eu.nome) + "</b>" + (eu.email ? " (" + esc(eu.email) + ")" : "") + ". É por esse e-mail que a vaga aparece para você aqui no Recrutamento.</div>" +
        GP.ui.formulario.html(F.VAGA, inicial, { min: { UF_CRM_RV_DATA_ENT: ctx.hoje } }) + "</div>",
      rodape: '<button class="btn" data-acao="enviar-vaga">Enviar ao RH</button><button class="btn link" data-acao="fechar-painel">Cancelar</button>',
      aoAbrir: (el) => GP.ui.formulario.ligar(el.querySelector("#form-vaga"), F.VAGA),
    });
  };
  ui.acoes["enviar-vaga"] = function (el) {
    const FU = GP.ui.formulario;
    const f = document.getElementById("form-vaga");
    const r = FU.aplicar(f, F.VAGA);
    if (!FU.validar(f, F.VAGA, r)) return;
    const ctx = E().ctx, eu = E().eu;
    if (r.UF_CRM_RV_DATA_ENT < ctx.hoje) { ui.erroNoPainel("A data desejada de entrada não pode ficar no passado."); return; }
    const cfg = E().config || {};
    const categoria = Number((cfg.recrutamento || {}).categoria) || 77;
    const responsavel = FU.responsavelDoFunil("recrutamento");
    const campos = Object.assign(F.camposDoNegocio(F.VAGA, r), { UF_CRM_RV_EMAIL: eu.email || "" });
    const vaga = r.UF_CRM_RV_VAGA.trim();
    const titulo = vaga + " · " + (r.UF_CRM_RV_DEPTO || r.UF_CRM_RV_SETOR).trim();
    // a coordenação recebe o aviso se continua a da estrutura (se a pessoa trocou o nome, o app não sabe quem é)
    const coord = inicial.coordenacaoId && inicial.coordenacaoId !== String(eu.id) && r.UF_CRM_RV_COORD.trim() === inicial.UF_CRM_RV_COORD ? inicial.coordenacaoId : "";
    ui.salvar(el, async () => {
      const neg = await FU.enviarCard({ categoria, titulo, campos, responsavel, nomeFunil: "HR | Requisição de Vagas" });
      // a vaga entra em "Vagas em andamento" sem recarregar
      const vagas = ctx.vagas = ctx.vagas || { etapas: [], negocios: [], historico: [] };
      vagas.negocios = vagas.negocios || [];
      vagas.negocios.unshift(F.negocioLocal({ id: neg.id, titulo, estagio: neg.estagio || ((vagas.etapas || [])[0] || {}).id || "", agora: new Date().toISOString(), campos }));
      const link = FU.linkNoAviso(neg);
      await GP.app.avisarRH("Nova solicitação de vaga no funil HR | Requisição de Vagas: " + vaga + " (" + (r.UF_CRM_RV_SETOR || r.UF_CRM_RV_DEPTO).trim() + "), pedida por " + eu.nome + "." + link);
      if (coord && !dom.papeis(ctx, coord).rh) await GP.app.avisar([coord], eu.nome + " enviou ao RH a solicitação de vaga \"" + vaga + "\". Ela está no funil HR | Requisição de Vagas." + link);
      // quem pediu guarda o link nas notificações do Bitrix, para acompanhar
      await GP.app.avisar([eu.id], "Você enviou ao RH a solicitação de vaga \"" + vaga + "\". Acompanhe pelo card." + link);
      return neg;
    }, { rotuloOcupado: "Enviando..." }).then((neg) => {
      if (neg && neg.id) FU.mostrarEnviado({ neg, nomeFunil: "HR | Requisição de Vagas", titulo: "Vaga enviada ao RH", texto: "O card \"" + titulo + "\" está no funil HR | Requisição de Vagas, em \"Nova solicitação\". Ele também aparece em Vagas em andamento." });
    });
  };
})(window);
