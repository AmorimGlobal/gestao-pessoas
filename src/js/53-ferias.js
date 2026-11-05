/* =====================================================================================
   FÉRIAS E AUSÊNCIAS — "Políticas de Férias e Ausências Programadas" do RH (04/11/2026):
   o texto que a pessoa lê antes de pedir, a conferência do pedido com as regras, o e-mail
   para o RH com cópia à liderança e as ausências que o RH registra
   -------------------------------------------------------------------------------------
   Fluxo da política: pedido ao RH com cópia para a liderança direta → o RH analisa → a
   liderança confirma. Desde 05/11/2026 (pedido do usuário: "não apenas no e-mail, mas no
   app, principalmente para a liderança e o RH aprovarem e ficar registrado para o RH quem
   estará ausente"), o pedido fica na tabela "Férias e ausências": "Aguardando o RH" →
   "Aguardando a liderança" → "Aprovada", e só a aprovada entra na Agenda. O e-mail da
   política sai pronto, pela caixa do Bitrix, como complemento. O RH também registra direto
   uma ausência combinada fora do app (já em "Aprovada").
   Regra não atendida não trava o pedido: vira "ponto fora da política", quem pede
   justifica, e o RH decide. Sem saldo de dias por pessoa (o direito muda por contrato e o
   RH confere): o app confere cada pedido, não a soma do ano.
   Funções puras (Node + navegador): test/ferias.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"),
    raiz.GP && raiz.GP.dominio ? raiz.GP.dominio : require("./50-dominio.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.ferias = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc, dom) {
  "use strict";

  const EMAIL_RH = "hr@amorimlawfirm.com";
  const TIPOS = ["Férias", "Day off", "Pausa contratual"];
  // antecedência mínima (dias corridos) e prazos de resposta (dias úteis): o RH, depois a liderança
  const PRAZOS = {
    "Férias": { antecedencia: 60, rh: 3, lideranca: 2 },
    "Day off": { antecedencia: 30, rh: 3, lideranca: 2 },
    "Pausa contratual": { antecedencia: 30, rh: 5, lideranca: 5 },
  };
  const FERIAS_ANO = 23; // 30 dias por ano, menos a semana de férias coletivas entre o Natal e o Ano Novo
  const PARCELAS = [23, 15, 8];
  const PAUSA_MAX = 7;

  /** A política, como o RH escreveu (a pessoa lê antes de pedir) */
  const POLITICA = {
    fluxo: [
      ["Abrir a solicitação", "Peça aqui no app, com o tipo de solicitação, o período desejado e a justificativa, quando necessário. O pedido vai para o RH e para a sua liderança direta. O e-mail para " + EMAIL_RH + " com cópia para a liderança, que a política pede, sai pronto para enviar pela sua caixa do Bitrix."],
      ["O RH analisa", "O RH verifica se você tem direito ao período solicitado e se o time tem cobertura para essa data."],
      ["A liderança avalia", "A sua liderança considera o impacto nas entregas e nos prazos do time."],
      ["Você recebe o retorno", "O RH e a liderança decidem no app, e você recebe o aviso no Bitrix. Aprovado, o período entra na Agenda da equipe."],
    ],
    "Férias": [
      "Contratos PJ e de associação têm 30 dias corridos de pausa remunerada por ano. Membros CLT e estagiários seguem a legislação brasileira.",
      "Para pedir: pelo menos 12 meses de contrato, aprovação do RH e da sua liderança, e as atividades do time com cobertura no período.",
      "Todo ano há uma semana de férias coletivas entre o Natal e o Ano Novo, descontada dos 30 dias.",
      "Ficam 23 dias para usar quando quiser: de uma vez ou em até duas partes, uma de pelo menos 15 dias corridos e outra de 8 dias corridos. Outras divisões não são permitidas.",
      "As férias começam sempre às segundas-feiras.",
      "Peça com pelo menos 60 dias de antecedência. O RH responde em até 3 dias úteis, e a liderança confirma em até 2 dias úteis depois da aprovação do RH.",
    ],
    "Day off": [
      "Um dia de folga remunerada: no mês do seu aniversário, por desempenho (metas superadas ou contribuições de alto impacto, validadas pelo RH depois da avaliação anual) ou em campanhas institucionais.",
      "Não pode ser no dia anterior nem no dia seguinte a um feriado, nem logo antes ou logo depois das suas férias.",
      "O de aniversário vale durante o mês do aniversário e expira no último dia do mês. O de desempenho vale por até 3 meses a partir do anúncio.",
      "A aprovação do RH e da sua liderança é obrigatória antes de usar.",
      "Peça com pelo menos 30 dias de antecedência. O RH responde em até 3 dias úteis, e a liderança confirma em até 2 dias úteis depois da aprovação do RH.",
    ],
    "Pausa contratual": [
      "Afastamento temporário, sem remuneração, para contratos PJ e de associação: para quando você precisa se ausentar por pouco tempo sem encerrar o contrato.",
      "Peça com pelo menos 30 dias de antecedência, por escrito e com justificativa nas situações críticas. Precisa da aprovação da sua liderança e do RH.",
      "O máximo é de 7 dias corridos. Acima disso, a liderança e o RH avaliam caso a caso.",
      "A avaliação considera o impacto nas entregas e na continuidade do time, a cobertura do período e o histórico de performance. A liderança e o RH podem negar mesmo com os critérios atendidos.",
      "Durante a pausa não há remuneração, pagamento proporcional ou compensação futura, e o período não conta para os benefícios anuais.",
      "Antes de pedir: as suas entregas ficam paradas, o time absorve as suas demandas e você perde exposição a projetos. Use as férias sempre que possível: a pausa é a última opção.",
      "O RH responde em até 5 dias úteis, e a liderança confirma em até 5 dias úteis depois da aprovação do RH.",
    ],
    feriados: [
      "Os feriados nacionais valem para todos. Pontos facultativos não se aplicam.",
      "Estaduais e municipais: quem trabalha de São Paulo, ou é remoto fora da Bahia, segue São Paulo; quem trabalha de Salvador, ou é remoto na Bahia, segue Salvador. Feriados de outras cidades não valem.",
      "O RH divulga o calendário anual até 30 dias antes do início de cada ano.",
    ],
  };

  const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const diasCorridos = (inicio, fim) => calc.diffDias(inicio, fim) + 1;
  const fimDe = (p) => (p.tipo === "Day off" ? p.inicio : p.fim || p.inicio);
  const fimDeSemana = (d) => calc.diaSemana(d) === 0 || calc.diaSemana(d) === 6;
  function diaUtilAnterior(d) { let x = calc.addDias(d, -1); while (fimDeSemana(x)) x = calc.addDias(x, -1); return x; }
  function diaUtilSeguinte(d) { let x = calc.addDias(d, 1); while (fimDeSemana(x)) x = calc.addDias(x, 1); return x; }
  /** "de segunda, 04/01/2027 a terça, 26/01/2027 (23 dias corridos)" ou "sexta, 13/11/2026" */
  function periodo(p) {
    const fim = fimDe(p);
    if (!p.inicio) return "";
    if (fim === p.inicio) return calc.fmtDiaSemana(p.inicio) + ", " + calc.fmtDataAno(p.inicio);
    return "de " + calc.fmtDiaSemana(p.inicio) + ", " + calc.fmtDataAno(p.inicio) + " a " + calc.fmtDiaSemana(fim) + ", " + calc.fmtDataAno(fim) + " (" + diasCorridos(p.inicio, fim) + " dias corridos)";
  }
  function periodoCurto(p) { const fim = fimDe(p); return fim === p.inicio ? calc.fmtData(p.inicio) : calc.fmtData(p.inicio) + " a " + calc.fmtData(fim); }
  const NOME_TIPO = { "Férias": "férias", "Day off": "day off", "Pausa contratual": "pausa contratual" };

  /** Os pedidos e as ausências que contam de uma pessoa (aguardando ou aprovados), menos o que está sendo conferido ou editado */
  function pedidosDe(ctx, uid, excetoId) {
    return ((ctx.registros && ctx.registros.ferias) || []).filter((p) => String(p.responsavel) === String(uid) && p.estagio !== "FAIL" && p.inicio && p.id !== excetoId);
  }

  /** Quem pede: contrato, ingresso e cidade pelo Membros (quando o login lê), e o resto pelo perfil e pela estrutura do Bitrix */
  function dadosDaPessoa(ctx, uid) {
    const id = String(uid);
    const u = dom.pessoa(ctx, id);
    const m = ctx.idx.membroPorUsuario[id] || null;
    const lid = m ? dom.liderancaEfetiva(ctx, m) : dom.liderancaNaEstrutura(ctx.idx.depto, id, u.departamentos || []).id;
    const sigla = m ? (/BA/.test(m.cidade || "") ? "BA" : "SP") : (/\b(BA|Bahia|Salvador)\b/i.test((u.estado || "") + " " + (u.cidade || "")) ? "BA" : "SP");
    return {
      id, nome: u.nome, email: u.email || "", contrato: (m && m.contrato) || "", ingresso: (m && m.ingresso) || "", registro: u.registro || "",
      sigla, aniversario: u.aniversario || "", lideranca: lid && lid !== id ? String(lid) : "",
    };
  }

  /** Confere o pedido com a política. p = {tipo, motivoDayOff, inicio, fim, cobertura, justificativa}; pessoa = dadosDaPessoa().
      erros: o que falta ou não fecha (trava o envio); fora: regras não atendidas (pedem justificativa, e o RH decide); ok: o que bate. */
  function conferirPedido(ctx, p, pessoa, opcoes) {
    const o = opcoes || {};
    const erros = [], fora = [], ok = [];
    const prazos = PRAZOS[p.tipo];
    if (!prazos) return { erros: ["Escolha o tipo de pedido."], fora, ok, dias: 0 };
    const inicio = p.inicio || "";
    const fim = p.tipo === "Day off" ? inicio : (p.fim || "");
    const texto = (v) => String(v || "").trim();
    if (!inicio) erros.push(p.tipo === "Day off" ? "Escolha o dia." : "Escolha o primeiro dia.");
    if (p.tipo !== "Day off" && !fim) erros.push("Escolha o último dia.");
    if (inicio && fim && fim < inicio) erros.push("O último dia vem antes do primeiro.");
    if (inicio && inicio < ctx.hoje) erros.push("O período não pode começar no passado.");
    if (p.tipo === "Day off" && !p.motivoDayOff) erros.push("Escolha o motivo do day off.");
    if (p.tipo !== "Day off" && !texto(p.cobertura)) erros.push("Conte como as suas atividades ficam cobertas no período.");
    if (p.tipo === "Pausa contratual" && !texto(p.justificativa)) erros.push("A pausa contratual pede justificativa por escrito.");
    const dias = inicio && fim && fim >= inicio ? diasCorridos(inicio, fim) : 0;
    if (erros.length) return { erros, fora, ok, dias };

    const outros = pedidosDe(ctx, pessoa.id, o.excetoId);
    const contrato = pessoa.contrato || "";
    const estagio = /est[áa]gi/i.test(contrato);
    const ano = inicio.slice(0, 4);
    const antecedencia = calc.diffDias(ctx.hoje, inicio);
    if (antecedencia >= prazos.antecedencia) ok.push("Pedido com " + antecedencia + " dias de antecedência (o mínimo é " + prazos.antecedencia + ").");
    else fora.push("Pedido com " + antecedencia + (antecedencia === 1 ? " dia" : " dias") + " de antecedência: a política pede pelo menos " + prazos.antecedencia + ".");

    if (p.tipo === "Férias") {
      if (estagio) ok.push("Estágio: vale a legislação (recesso de 30 dias por ano), sem a divisão em 15 e 8 dias.");
      else {
        if (calc.diaSemana(inicio) === 1) ok.push("Começa numa segunda-feira.");
        else fora.push("As férias começam sempre às segundas-feiras, e " + calc.fmtDataAno(inicio) + " é " + calc.fmtDiaSemana(inicio) + ".");
        if (PARCELAS.indexOf(dias) >= 0) ok.push(dias + " dias corridos: " + (dias === FERIAS_ANO ? "os 23 dias de uma vez." : "uma das duas partes (15 e 8 dias)."));
        else fora.push(dias + " dias corridos: a política aceita os 23 dias de uma vez ou duas partes, de 15 e de 8 dias.");
        const ref = pessoa.ingresso || pessoa.registro;
        if (ref) {
          if (calc.diffDias(ref, inicio) >= 365) ok.push("Mais de 12 meses de contrato no início das férias.");
          else fora.push("Menos de 12 meses de contrato em " + calc.fmtDataAno(inicio) + " (desde " + calc.fmtDataAno(ref) + (pessoa.ingresso ? "" : ", pelo cadastro no Bitrix") + ").");
        }
      }
      // a semana de férias coletivas (Natal ao Ano Novo) já é de férias para todos
      [Number(ano) - 1, Number(ano)].forEach((y) => {
        const natal = y + "-12-25", anoNovo = (y + 1) + "-01-01";
        if (inicio <= anoNovo && fim >= natal) fora.push("O período cruza a semana de férias coletivas entre o Natal de " + y + " e o Ano Novo, que já é de férias para todos.");
      });
    }

    if (p.tipo === "Day off") {
      const fer = dom.feriadosDe(ctx, pessoa.sigla);
      const vizinhos = [calc.addDias(inicio, -1), calc.addDias(inicio, 1), diaUtilAnterior(inicio), diaUtilSeguinte(inicio)];
      const feriado = vizinhos.find((d) => fer.has(d));
      if (feriado) fora.push("O day off não pode ser no dia anterior nem no seguinte a um feriado (" + calc.fmtDataAno(feriado) + ").");
      else ok.push("Não fica colado a um feriado.");
      const colado = outros.find((x) => x.tipo === "Férias" && x.inicio && (fimDe(x) === diaUtilAnterior(inicio) || fimDe(x) === calc.addDias(inicio, -1) || x.inicio === diaUtilSeguinte(inicio) || x.inicio === calc.addDias(inicio, 1)));
      if (colado) fora.push("O day off não pode ser logo antes ou logo depois das férias (" + periodoCurto(colado) + ").");
      if (p.motivoDayOff === "Aniversário") {
        if (!pessoa.aniversario) fora.push("O seu aniversário não está cadastrado no Bitrix, então o app não confere o mês. Cadastre em Perfil.");
        else if (inicio.slice(5, 7) === pessoa.aniversario.slice(0, 2)) ok.push("No mês do seu aniversário.");
        else fora.push("O day off de aniversário vale só no mês do aniversário (" + calc.MESES_LONGOS[Number(pessoa.aniversario.slice(0, 2)) - 1] + ").");
        const outro = outros.find((x) => x.tipo === "Day off" && x.motivoDayOff === "Aniversário" && String(x.inicio || "").slice(0, 4) === ano);
        if (outro) fora.push("Já há um day off de aniversário em " + ano + " (" + calc.fmtDataAno(outro.inicio) + ").");
      }
      if (p.motivoDayOff === "Desempenho") ok.push("O de desempenho vale por até 3 meses a partir do anúncio: o RH confere a data.");
    }

    if (p.tipo === "Pausa contratual") {
      if (estagio || /clt/i.test(contrato)) fora.push("A pausa contratual é só para contratos PJ e de associação (o seu: " + contrato + ").");
      if (dias <= PAUSA_MAX) ok.push(dias + (dias === 1 ? " dia corrido" : " dias corridos") + " (o máximo é 7).");
      else fora.push(dias + " dias corridos: o máximo é 7. Acima disso, a liderança e o RH avaliam caso a caso.");
    }

    const junto = outros.find((x) => x.inicio && x.inicio <= fim && fimDe(x) >= inicio);
    if (junto) fora.push("Já há " + (junto.estagio === "SUCCESS" ? "uma ausência sua aprovada" : "um pedido seu em andamento") + " nesse período (" + NOME_TIPO[junto.tipo] + ", " + periodoCurto(junto) + ").");
    if (fora.length && !texto(p.justificativa)) erros.push("Explique na justificativa os pontos fora da política.");
    return { erros, fora, ok, dias };
  }

  /* ---------------- ausências aprovadas (as da agenda) ---------------- */
  /** As ausências aprovadas, da mais próxima à mais distante: só as da etapa "Aprovada", as mesmas da agenda
      (dom.ausenciasAprovadas). Pedido em andamento, recusado ou cancelado não conta. */
  function registradas(ctx) {
    return ((ctx.registros && ctx.registros.ferias) || []).filter((p) => p.estagio === "SUCCESS" && p.inicio)
      .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  }
  /** As que a pessoa enxerga: o RH, todas; a liderança e a coordenação, as da equipe e as suas; o membro, as suas */
  function visiveisPara(ctx, uid, visao) {
    const id = String(uid);
    if (visao === "rh") return registradas(ctx);
    const equipe = {};
    if (visao !== "membro") dom.membrosVisiveis(ctx, id).forEach((m) => { equipe[String(m.responsavel)] = true; });
    return registradas(ctx).filter((p) => String(p.responsavel) === id || String(p.lideranca) === id || equipe[String(p.responsavel)]);
  }
  /** Ainda por vir ou em curso */
  function proximas(lista, hoje) { return lista.filter((p) => fimDe(p) >= hoje); }

  /* ---------------- pedidos no app: prazos, situação e quem decide (05/11/2026) ---------------- */
  /** Pedido feito pela própria pessoa no app (ela leu as regras); sem isso, é ausência que o RH registrou direto */
  const ehPedido = (p) => !!(p && p.regrasLidasEm);
  /** Quando a liderança direta é a própria pessoa do RH que aprova, a confirmação sai junto, com este comentário */
  const CONFIRMADO_PELO_RH = "Confirmado junto com a aprovação do RH (a liderança direta é do RH).";
  const dataDe = (v) => String(v || "").slice(0, 10);
  /** O RH responde em até 3 dias úteis (5 na pausa contratual), contados do pedido */
  function prazoRH(ctx, p) { return calc.addDiasUteis(dataDe(p.criadoEm) || ctx.hoje, (PRAZOS[p.tipo] || PRAZOS["Férias"]).rh, dom.feriadosDe(ctx, "SP")); }
  /** A liderança confirma em até 2 dias úteis (5 na pausa) depois da aprovação do RH */
  function prazoLideranca(ctx, p) { return p.rhEm ? calc.addDiasUteis(dataDe(p.rhEm), (PRAZOS[p.tipo] || PRAZOS["Férias"]).lideranca, dom.feriadosDe(ctx, "SP")) : ""; }
  /** A situação para a tela: texto, cor e, enquanto aguarda, o prazo de quem decide */
  function situacao(ctx, p) {
    if (p.estagio === "SUCCESS") return { texto: ehPedido(p) ? "Aprovado" : "Registrada pelo RH", cor: "verde" };
    if (p.estagio === "FAIL") return p.canceladaEm ? { texto: "Cancelado", cor: "cinza" } : { texto: p.liderancaDecisao === "Recusada" ? "Recusado pela liderança" : "Recusado pelo RH", cor: "cinza" };
    if (p.estagio === "AG_LIDERANCA") { const pz = prazoLideranca(ctx, p); return { texto: "Aguardando a liderança", cor: pz && calc.atrasado(pz, ctx.hoje) ? "vermelho" : "ambar", prazo: pz }; }
    const pz = prazoRH(ctx, p);
    return { texto: "Aguardando o RH", cor: calc.atrasado(pz, ctx.hoje) ? "vermelho" : "azul", prazo: pz };
  }
  const recentes = (lista) => lista.slice().sort((a, b) => (String(a.criadoEm) < String(b.criadoEm) ? 1 : -1));
  const doApp = (ctx) => (ctx.registros && ctx.registros.ferias) || [];
  /** Aguardando o RH, do mais antigo (o prazo vence antes) ao mais novo */
  function paraRH(ctx) { return recentes(doApp(ctx).filter((p) => p.estagio === "NEW")).reverse(); }
  /** Aguardando a confirmação desta liderança */
  function paraLideranca(ctx, uid) { return recentes(doApp(ctx).filter((p) => p.estagio === "AG_LIDERANCA" && String(p.lideranca) === String(uid))).reverse(); }
  /** Os pedidos e as ausências que a pessoa enxerga, em qualquer etapa: o RH, todos; a liderança e a coordenação, os da
      equipe, os em que é a liderança direta e os seus; o membro, os seus */
  function pedidosVisiveis(ctx, uid, visao) {
    const id = String(uid);
    if (visao === "rh") return doApp(ctx).slice();
    const equipe = {};
    if (visao !== "membro") dom.membrosVisiveis(ctx, id).forEach((m) => { equipe[String(m.responsavel)] = true; });
    return doApp(ctx).filter((p) => String(p.responsavel) === id || String(p.lideranca) === id || equipe[String(p.responsavel)]);
  }
  /** Quem decide este pedido agora: "rh" (aguardando o RH, e quem vê é do RH), "lideranca" (aguardando a liderança direta)
      ou "". Ninguém decide o próprio pedido. */
  function decisorDoPedido(ctx, uid, rh, p) {
    const id = String(uid);
    if (!p || String(p.responsavel) === id) return "";
    if (p.estagio === "NEW" && rh) return "rh";
    if (p.estagio === "AG_LIDERANCA" && String(p.lideranca) === id) return "lideranca";
    return "";
  }

  /* ---------------- e-mails ---------------- */
  /** O e-mail que abre a solicitação: para o RH, com cópia para a liderança direta (fluxo da política) */
  function emailDoPedido(ctx, p, pessoa, opcoes) {
    const lid = pessoa.lideranca ? dom.pessoa(ctx, pessoa.lideranca) : null;
    const corpo = [
      "Olá, RH" + (lid ? " e " + primeiroNome(lid.nome) : "") + ",", "",
      "Solicito " + { "Férias": "férias", "Day off": "um day off", "Pausa contratual": "uma pausa contratual" }[p.tipo] + ", conforme as Políticas de Férias e Ausências.", "",
      "Tipo: " + p.tipo + (p.tipo === "Day off" && p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : ""),
      "Período: " + periodo(p),
    ];
    if (String(p.cobertura || "").trim()) corpo.push("Cobertura das atividades: " + String(p.cobertura).trim());
    if (String(p.justificativa || "").trim()) corpo.push("Justificativa: " + String(p.justificativa).trim());
    const fora = String(p.foraDaPolitica || "").split("\n").filter(Boolean);
    if (fora.length) corpo.push("", "Pontos fora da política, apontados pelo app:", ...fora.map((f) => "- " + f));
    // o pedido gravado no app (05/11/2026): o e-mail avisa que dá para decidir por lá
    if (opcoes && opcoes.registrado) corpo.push("", "O pedido também está registrado no app Gestão de Pessoas, onde o RH e a liderança aprovam.");
    corpo.push("", "Obrigado(a),", pessoa.nome);
    return { para: EMAIL_RH, cc: lid && lid.email ? [lid.email] : [], assunto: "Solicitação de " + NOME_TIPO[p.tipo] + " · " + pessoa.nome + " · " + periodoCurto(p), corpo: corpo.join("\n") };
  }
  function textoDoEmail(e) { return "Para: " + e.para + (e.cc.length ? "\nCópia: " + e.cc.join(", ") : "") + "\nAssunto: " + e.assunto + "\n\n" + e.corpo; }

  /* ---------- envio pela caixa de e-mail do Bitrix (a Amorim usa o e-mail do Bitrix, 04/11/2026) ---------- */
  /** O corpo em HTML simples para o mail.message.send: o texto escapado, e cada quebra de linha vira <br> */
  function corpoHtml(texto) {
    return String(texto || "").replace(/\r\n?/g, "\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").split("\n").join("<br>");
  }
  /** O remetente: a caixa com o e-mail da própria pessoa, senão a primeira que o Bitrix oferece (mail.mailbox.senders) */
  function escolherRemetente(itens, emailDaPessoa) {
    const lista = (itens || []).filter((x) => x && x.email);
    const meu = String(emailDaPessoa || "").trim().toLowerCase();
    return lista.find((x) => String(x.email).toLowerCase() === meu) || lista[0] || null;
  }

  return {
    EMAIL_RH, TIPOS, PRAZOS, FERIAS_ANO, PARCELAS, PAUSA_MAX, POLITICA, NOME_TIPO,
    diasCorridos, periodo, periodoCurto, pedidosDe, dadosDaPessoa, conferirPedido,
    registradas, visiveisPara, proximas,
    ehPedido, CONFIRMADO_PELO_RH, prazoRH, prazoLideranca, situacao, paraRH, paraLideranca, pedidosVisiveis, decisorDoPedido,
    emailDoPedido, textoDoEmail, corpoHtml, escolherRemetente,
  };
});
