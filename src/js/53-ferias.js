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
  // Protótipo do RH "Solicitacao_Ferias_Amorim.html" (06/11/2026, aprovado pelo usuário): 23 dias de uma vez, 7 + 16 ou 8 + 15
  const MODALIDADES = [
    { id: "23", partes: [23], rotulo: "23 dias de uma vez" },
    { id: "7+16", partes: [7, 16], rotulo: "7 + 16 dias, em dois períodos" },
    { id: "8+15", partes: [8, 15], rotulo: "8 + 15 dias, em dois períodos" },
  ];
  const PARCELAS = [23, 16, 15, 8, 7];
  const MESES_PARA_PEDIR = 10; // a solicitação abre com 10 meses de contrato...
  const MESES_PARA_SAIR = 12;  // ...para sair depois dos 12 (o que a política pede)
  const PAUSA_MAX = 7;

  /** A política, como o RH escreveu (a pessoa lê antes de pedir) */
  const POLITICA = {
    fluxo: [
      ["Abrir a solicitação", "Peça aqui no app, com o tipo de solicitação, o período desejado e a justificativa, quando necessário. O pedido vai para o RH e para a sua liderança direta. O e-mail para " + EMAIL_RH + " com cópia para a liderança, que a política pede, sai pronto para enviar pela sua caixa do Bitrix."],
      ["O RH autoriza", "O RH verifica se você tem direito ao período solicitado e se o time tem cobertura para essa data."],
      ["A liderança valida", "A sua liderança considera o impacto nas entregas e nos prazos do time."],
      ["Você recebe o retorno", "O RH e a liderança decidem no app, e você recebe o aviso no Bitrix. Validado, o período entra na Agenda da equipe. Devolvido, a data volta a ficar livre."],
    ],
    "Férias": [
      "Contratos PJ e de associação têm 30 dias corridos de pausa remunerada por ciclo, de novembro a outubro. Membros CLT e estagiários seguem a legislação brasileira: para eles, o RH confere a duração e a divisão.",
      "Você solicita a partir de 10 meses de contrato, para sair depois de completar 12 meses. Precisa da autorização do RH e da validação da sua liderança.",
      "Todo ano há uma semana de férias coletivas entre o Natal e o Ano Novo, descontada dos 30 dias. Metade da equipe tira a semana do Natal e metade a do Ano Novo: você escolhe a sua no pedido.",
      "Ficam 23 dias: de uma vez ou em dois períodos, de 7 + 16 ou de 8 + 15 dias corridos. Outras divisões não são permitidas. Os períodos podem começar em qualquer dia da semana.",
      "Duas pessoas da mesma equipe (mesma liderança direta) não tiram férias ao mesmo tempo: a data fica com quem pediu primeiro. Pedido devolvido ou cancelado libera a data. A semana de férias coletivas é exceção.",
      "Peça com pelo menos 60 dias de antecedência. O RH autoriza em até 3 dias úteis, e a liderança valida em até 2 dias úteis depois da autorização do RH.",
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
  /** A semana de férias coletivas que a pessoa escolheu (fora dos 23 dias e da regra da equipe) */
  const ehColetiva = (p) => !!(p && p.coletiva);
  /** "férias", "day off", "semana de férias coletivas"... */
  const nomeDoPedido = (p) => (ehColetiva(p) ? "semana de férias coletivas" : NOME_TIPO[p.tipo] || String(p.tipo || "").toLowerCase());

  /* ---------------- o ciclo de férias e as regras do protótipo do RH (06/11/2026) ---------------- */
  /** O ciclo de férias que contém a data: de 1º de novembro a 31 de outubro */
  function cicloDe(data) {
    const a = Number(String(data).slice(0, 4)), m = Number(String(data).slice(5, 7));
    const ano = m >= 11 ? a : a - 1;
    return { ano, inicio: ano + "-11-01", fim: (ano + 1) + "-10-31", rotulo: "nov/" + ano + " a out/" + (ano + 1) };
  }
  const proximoCiclo = (c) => cicloDe((c.ano + 1) + "-11-01");
  /** As duas semanas de férias coletivas do ciclo, de segunda a sexta: a do Natal e a seguinte, a do Ano Novo.
      Cada pessoa tira uma das duas (o usuário, 06/11/2026: "tem pessoas que tiram de 21 até 25, outras 28 a 01"). */
  function semanasColetivas(ciclo) {
    const natal = ciclo.ano + "-12-25";
    const seg = calc.addDias(natal, -((calc.diaSemana(natal) + 6) % 7));
    return [{ n: 1, inicio: seg, fim: calc.addDias(seg, 4), rotulo: "a do Natal" }, { n: 2, inicio: calc.addDias(seg, 7), fim: calc.addDias(seg, 11), rotulo: "a do Ano Novo" }];
  }
  /** Soma meses a uma data (o dia 31 vira o último dia do mês, quando falta) */
  function addMeses(iso, n) {
    const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
    const ano = a + Math.floor(m / 12), mes = ((m % 12) + 12) % 12;
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    return ano + "-" + String(mes + 1).padStart(2, "0") + "-" + String(Math.min(d, ultimo)).padStart(2, "0");
  }
  /** CLT e estágio seguem a lei (o RH confere a duração e a divisão); PJ, associação e contrato não informado seguem a política */
  const segueALei = (pessoa) => /clt|est[áa]gi/i.test(String((pessoa && pessoa.contrato) || ""));
  /** Quando a pessoa pode pedir e a primeira data possível: o pedido abre com 10 meses de contrato; o início vem
      depois dos 12 meses e com 60 dias de antecedência. Sem a data do contrato, só a antecedência vale. */
  function liberacao(pessoa, hoje) {
    const minimo = calc.addDias(hoje, PRAZOS["Férias"].antecedencia);
    const ref = (pessoa && (pessoa.ingresso || pessoa.registro)) || "";
    if (!ref) return { ref: "", abreEm: "", completa12: "", primeiraData: minimo, aberta: true, pelo: "" };
    const abreEm = addMeses(ref, MESES_PARA_PEDIR), completa12 = addMeses(ref, MESES_PARA_SAIR);
    const depois12 = calc.addDias(completa12, 1);
    return { ref, abreEm, completa12, primeiraData: depois12 > minimo ? depois12 : minimo, aberta: hoje >= abreEm, pelo: pessoa.ingresso ? "ingresso" : "cadastro" };
  }
  const dentroDoCiclo = (ciclo) => (p) => p.inicio >= ciclo.inicio && p.inicio <= ciclo.fim;
  /** As partes dos 23 dias que a pessoa já pediu no ciclo (em andamento ou aprovadas) */
  function partesDoCiclo(ctx, uid, ciclo, excetoId) {
    return pedidosDe(ctx, uid, excetoId).filter((p) => p.tipo === "Férias" && !ehColetiva(p)).filter(dentroDoCiclo(ciclo));
  }
  /** A semana de férias coletivas que a pessoa escolheu no ciclo, se já escolheu */
  function coletivaDoCiclo(ctx, uid, ciclo, excetoId) {
    return pedidosDe(ctx, uid, excetoId).filter((p) => p.tipo === "Férias" && ehColetiva(p)).find(dentroDoCiclo(ciclo)) || null;
  }
  const diasDe = (p) => Number(p.dias) || (p.inicio ? diasCorridos(p.inicio, fimDe(p)) : 0);
  /** O que ainda dá para pedir no ciclo pelas partes já pedidas: as modalidades (nada pedido), a parte que falta
      (pediu 7, faltam 16) ou nada (os 23 já pedidos, ou partes fora da regra, que o RH confere) */
  function restanteDoCiclo(partes) {
    const dias = partes.map(diasDe).sort((a, b) => a - b);
    if (!dias.length) return { modalidades: MODALIDADES, falta: 0, completo: false, dias };
    if (dias.length === 1) {
      const m = MODALIDADES.find((x) => x.partes.length === 2 && x.partes.indexOf(dias[0]) >= 0);
      if (m) return { modalidades: [], falta: m.partes.find((x) => x !== dias[0]), modalidade: m, completo: false, dias };
    }
    const fecha = MODALIDADES.some((x) => x.partes.slice().sort((a, b) => a - b).join("+") === dias.join("+"));
    return { modalidades: [], falta: 0, completo: true, foraDaRegra: !fecha, dias };
  }
  const SITUACAO_CURTA = { NEW: "Aguardando o RH", AG_LIDERANCA: "Aguardando a liderança", SUCCESS: "Aprovada" };
  const minuscula = (s) => { const t = String(s || ""); return t.charAt(0).toLowerCase() + t.slice(1); };
  /** As férias da equipe que ocupam datas: pedidos em andamento e aprovados de quem tem a mesma liderança direta.
      A semana de férias coletivas fica de fora (metade da equipe sai junto). Sem nomes, a não ser com comNomes (RH e liderança). */
  function reservasDaEquipe(ctx, uid, opcoes) {
    const o = opcoes || {};
    const lid = dadosDaPessoa(ctx, uid).lideranca;
    if (!lid) return [];
    return ((ctx.registros && ctx.registros.ferias) || [])
      .filter((p) => p.tipo === "Férias" && !ehColetiva(p) && p.estagio !== "FAIL" && p.inicio && String(p.responsavel) !== String(uid) && String(p.lideranca) === String(lid))
      .map((p) => Object.assign({ inicio: p.inicio, fim: fimDe(p), situacao: SITUACAO_CURTA[p.estagio] || p.estagio }, o.comNomes ? { id: p.id, responsavel: String(p.responsavel), criadoEm: p.criadoEm } : {}))
      .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  }
  const cruzam = (a, b) => a.inicio <= b.fim && b.inicio <= a.fim;
  /** As datas de início de um período de N dias no ciclo, cada uma com o fim e, quando não dá, o motivo (como no protótipo).
      o = { pessoa, reservas, coletiva: {inicio, fim} (a semana da pessoa), outros: os pedidos dela, evitar: [{inicio, fim}] (o outro período do mesmo pedido) } */
  function opcoesDeInicio(ctx, ciclo, dias, o) {
    const lib = liberacao(o.pessoa, ctx.hoje);
    const lista = [];
    const ultimo = calc.addDias(ciclo.fim, -(dias - 1));
    for (let d = lib.primeiraData > ciclo.inicio ? lib.primeiraData : ciclo.inicio; d <= ultimo; d = calc.addDias(d, 1)) {
      const per = { inicio: d, fim: calc.addDias(d, dias - 1) };
      let bloqueio = "";
      if (o.coletiva && cruzam(per, o.coletiva)) bloqueio = "sua semana de férias coletivas";
      else if ((o.outros || []).some((x) => cruzam(per, { inicio: x.inicio, fim: fimDe(x) }))) bloqueio = "você já tem um pedido nesse período";
      else if ((o.evitar || []).some((x) => cruzam(per, x))) bloqueio = "cruza o outro período";
      else if ((o.reservas || []).some((x) => cruzam(per, x))) bloqueio = "já reservado na equipe";
      lista.push(Object.assign(per, { bloqueio }));
    }
    return lista;
  }

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
    // férias pela política (PJ e associação): a regra da equipe cobre o período, e a cobertura vira observação opcional
    const pelaPolitica = p.tipo === "Férias" && !segueALei(pessoa);
    if (p.tipo !== "Day off" && !pelaPolitica && !ehColetiva(p) && !texto(p.cobertura)) erros.push("Conte como as suas atividades ficam cobertas no período.");
    if (p.tipo === "Pausa contratual" && !texto(p.justificativa)) erros.push("A pausa contratual pede justificativa por escrito.");
    const dias = inicio && fim && fim >= inicio ? diasCorridos(inicio, fim) : 0;
    if (erros.length) return { erros, fora, ok, dias };

    const outros = pedidosDe(ctx, pessoa.id, o.excetoId);
    const contrato = pessoa.contrato || "";
    const estagio = /est[áa]gi/i.test(contrato);
    const ano = inicio.slice(0, 4);
    const antecedencia = calc.diffDias(ctx.hoje, inicio);
    const per = { inicio, fim };

    if (p.tipo === "Férias" && ehColetiva(p)) {
      // a semana de férias coletivas: uma das duas do ciclo, uma vez por ciclo; fora dos 23 dias, da antecedência e da regra da equipe
      const ciclo = cicloDe(inicio);
      const semanas = semanasColetivas(ciclo);
      if (!semanas.some((s) => s.inicio === inicio && s.fim === fim)) erros.push("A semana de férias coletivas é de " + periodoCurto(semanas[0]) + " ou de " + periodoCurto(semanas[1]) + ".");
      else ok.push("Semana de férias coletivas (" + periodoCurto(per) + "): fora dos 23 dias e da regra da equipe.");
      const ja = coletivaDoCiclo(ctx, pessoa.id, ciclo, o.excetoId);
      if (ja) erros.push("Você já escolheu a sua semana de férias coletivas deste ciclo (" + periodoCurto(ja) + ").");
      const cruza = outros.find((x) => !ehColetiva(x) && cruzam(per, { inicio: x.inicio, fim: fimDe(x) })) || (o.junto || []).find((x) => cruzam(per, x));
      if (cruza) erros.push("Essa semana cai num período de férias seu (" + periodoCurto(cruza) + ").");
      return { erros, fora, ok, dias };
    }

    if (pelaPolitica) {
      // as regras do protótipo do RH (06/11/2026): travam o pedido, em vez de virar ponto a justificar
      const lib = liberacao(pessoa, ctx.hoje);
      const ciclo = cicloDe(inicio);
      if (lib.ref) ok.push("Contrato desde " + calc.fmtDataAno(lib.ref) + (lib.pelo === "cadastro" ? " (pelo cadastro no Bitrix)" : "") + ".");
      if (!lib.aberta) erros.push("A sua solicitação de férias abre em " + calc.fmtDataAno(lib.abreEm) + ", quando você completa 10 meses de contrato.");
      else if (inicio < lib.primeiraData) {
        erros.push(lib.completa12 && inicio <= lib.completa12 ? "As férias começam depois de completar 12 meses de contrato (" + calc.fmtDataAno(lib.completa12) + "): a primeira data possível é " + calc.fmtDataAno(lib.primeiraData) + "."
          : "Peça com pelo menos 60 dias de antecedência: a primeira data possível é " + calc.fmtDataAno(lib.primeiraData) + ".");
      } else ok.push("Início depois dos 12 meses de contrato e com " + antecedencia + " dias de antecedência.");
      if (fim > ciclo.fim) erros.push("O período passa do fim do ciclo (" + calc.fmtDataAno(ciclo.fim) + "): cada período fica dentro de um ciclo, de novembro a outubro.");
      // a parte dentro do que falta no ciclo (as outras partes já pedidas e a do mesmo pedido)
      const rest = restanteDoCiclo(partesDoCiclo(ctx, pessoa.id, ciclo, o.excetoId).concat((o.junto || []).filter((x) => !x.coletiva)));
      if (rest.completo) erros.push("Você já pediu os 23 dias deste ciclo (" + rest.dias.join(" + ") + " dias).");
      else if (rest.falta && dias !== rest.falta) erros.push("Neste ciclo falta o período de " + rest.falta + " dias (você já pediu " + rest.dias[0] + ").");
      else if (!rest.falta && PARCELAS.indexOf(dias) < 0) erros.push(dias + " dias corridos: a política aceita 23 dias de uma vez, ou 7 + 16, ou 8 + 15.");
      else ok.push(dias + " dias corridos: " + (dias === FERIAS_ANO ? "os 23 dias de uma vez." : rest.falta ? "a parte que faltava do ciclo." : "uma das partes (7 + 16 ou 8 + 15)."));
      // a semana coletiva da pessoa (a já escolhida ou a deste pedido)
      const col = coletivaDoCiclo(ctx, pessoa.id, ciclo) || (o.junto || []).find((x) => x.coletiva) || null;
      if (col && cruzam(per, { inicio: col.inicio, fim: fimDe(col) })) erros.push("O período cai na sua semana de férias coletivas (" + periodoCurto(col) + ").");
      // a equipe: quem pediu primeiro fica com a data
      const reservas = o.reservas || reservasDaEquipe(ctx, pessoa.id);
      const choque = reservas.find((x) => cruzam(per, x));
      if (choque) erros.push("Já reservado na sua equipe: " + periodoCurto(choque) + " (" + minuscula(choque.situacao) + "). A data fica com quem pediu primeiro.");
      else ok.push("Sem conflito na equipe.");
      const meu = outros.find((x) => cruzam(per, { inicio: x.inicio, fim: fimDe(x) }));
      if (meu) erros.push("Você já tem " + (meu.estagio === "SUCCESS" ? "uma ausência aprovada" : "um pedido em andamento") + " nesse período (" + nomeDoPedido(meu) + ", " + periodoCurto(meu) + ").");
      return { erros, fora, ok, dias };
    }

    if (antecedencia >= prazos.antecedencia) ok.push("Pedido com " + antecedencia + " dias de antecedência (o mínimo é " + prazos.antecedencia + ").");
    else fora.push("Pedido com " + antecedencia + (antecedencia === 1 ? " dia" : " dias") + " de antecedência: a política pede pelo menos " + prazos.antecedencia + ".");

    if (p.tipo === "Férias") {
      // CLT e estágio: a lei vale para a duração e a divisão; o app confere só os 12 meses e as datas
      ok.push((estagio ? "Estágio" : "CLT") + ": vale a legislação para a duração e a divisão, e o RH confere.");
      const ref = pessoa.ingresso || pessoa.registro;
      if (ref) {
        if (calc.diffDias(ref, inicio) >= 365) ok.push("Mais de 12 meses de contrato no início das férias.");
        else fora.push("Menos de 12 meses de contrato em " + calc.fmtDataAno(inicio) + " (desde " + calc.fmtDataAno(ref) + (pessoa.ingresso ? "" : ", pelo cadastro no Bitrix") + ").");
      }
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
    if (junto) fora.push("Já há " + (junto.estagio === "SUCCESS" ? "uma ausência sua aprovada" : "um pedido seu em andamento") + " nesse período (" + nomeDoPedido(junto) + ", " + periodoCurto(junto) + ").");
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
    if (p.estagio === "FAIL") return p.canceladaEm ? { texto: "Cancelado", cor: "cinza" } : { texto: p.liderancaDecisao === "Recusada" ? "Devolvido pela liderança" : "Devolvido pelo RH", cor: "cinza" };
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

  /** A conferência que o RH e a liderança veem no pedido de férias (como no protótipo): contrato, 12 meses, equipe e
      a autorização do RH. Os conflitos trazem o nome e quem pediu antes: só quem decide vê. [{ok, texto}] */
  function conferenciaParaDecidir(ctx, p) {
    const itens = [];
    if (!p || p.tipo !== "Férias") return itens;
    const pessoa = dadosDaPessoa(ctx, p.responsavel);
    const ref = pessoa.ingresso || pessoa.registro;
    if (ref) itens.push({ ok: true, texto: "Contrato desde " + calc.fmtDataAno(ref) + (pessoa.ingresso ? "" : " (cadastro no Bitrix)") });
    if (ehColetiva(p)) {
      itens.push({ ok: true, texto: "Semana de férias coletivas: fora dos 23 dias e da regra da equipe" });
    } else {
      if (segueALei(pessoa)) itens.push({ ok: true, texto: pessoa.contrato + ": vale a legislação; o RH confere a duração e a divisão" });
      if (ref) {
        const c12 = addMeses(ref, MESES_PARA_SAIR);
        itens.push(p.inicio > c12 ? { ok: true, texto: "Início após 12 meses de contrato" } : { ok: false, texto: "Início antes de completar 12 meses de contrato (" + calc.fmtDataAno(c12) + ")" });
      }
      const conflitos = ((ctx.registros && ctx.registros.ferias) || []).filter((x) => x.id !== p.id && x.tipo === "Férias" && !ehColetiva(x) && x.estagio !== "FAIL" && x.inicio &&
        String(x.responsavel) !== String(p.responsavel) && p.lideranca && String(x.lideranca) === String(p.lideranca) && cruzam({ inicio: p.inicio, fim: fimDe(p) }, { inicio: x.inicio, fim: fimDe(x) }));
      if (!conflitos.length) itens.push({ ok: true, texto: "Sem conflito na equipe" });
      conflitos.forEach((x) => {
        const antes = String(x.criadoEm || "") < String(p.criadoEm || "");
        itens.push({ ok: false, texto: "Cruza com " + dom.pessoa(ctx, x.responsavel).nome + " (" + periodoCurto(x) + ", " + minuscula(SITUACAO_CURTA[x.estagio] || x.estagio) + "), pedido " + (antes ? "antes deste: a data fica com essa pessoa" : "depois deste: a data fica com este pedido") });
      });
    }
    if (p.rhDecisao === "Aprovada") itens.push({ ok: true, texto: "Autorizada pelo RH" });
    return itens;
  }

  /* ---------------- e-mails ---------------- */
  /** O e-mail que abre a solicitação: para o RH, com cópia para a liderança direta (fluxo da política) */
  function emailDoPedido(ctx, p, pessoa, opcoes) {
    const lid = pessoa.lideranca ? dom.pessoa(ctx, pessoa.lideranca) : null;
    const corpo = [
      "Olá, RH" + (lid ? " e " + primeiroNome(lid.nome) : "") + ",", "",
      "Solicito " + { "Férias": "férias", "Day off": "um day off", "Pausa contratual": "uma pausa contratual" }[p.tipo] + ", conforme as Políticas de Férias e Ausências.", "",
      "Tipo: " + p.tipo + (p.tipo === "Day off" && p.motivoDayOff ? " (" + p.motivoDayOff.toLowerCase() + ")" : ""),
    ];
    // o pedido de férias pode levar a semana de férias coletivas e os dois períodos juntos (06/11/2026)
    const todos = [p].concat((opcoes && opcoes.junto) || []);
    if (todos.length === 1) corpo.push("Período: " + periodo(p) + (ehColetiva(p) ? " (semana de férias coletivas)" : ""));
    else { corpo.push("Períodos:"); todos.forEach((x) => corpo.push("- " + periodo(x) + (ehColetiva(x) ? " (semana de férias coletivas)" : ""))); }
    if (String(p.cobertura || "").trim()) corpo.push("Cobertura das atividades: " + String(p.cobertura).trim());
    if (String(p.justificativa || "").trim()) corpo.push("Justificativa: " + String(p.justificativa).trim());
    const fora = String(p.foraDaPolitica || "").split("\n").filter(Boolean);
    if (fora.length) corpo.push("", "Pontos fora da política, apontados pelo app:", ...fora.map((f) => "- " + f));
    // o pedido gravado no app (05/11/2026): o e-mail avisa que dá para decidir por lá
    if (opcoes && opcoes.registrado) corpo.push("", "O pedido também está registrado no app Gestão de Pessoas, onde o RH autoriza e a liderança valida.");
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
    EMAIL_RH, TIPOS, PRAZOS, FERIAS_ANO, PARCELAS, MODALIDADES, MESES_PARA_PEDIR, MESES_PARA_SAIR, PAUSA_MAX, POLITICA, NOME_TIPO, SITUACAO_CURTA,
    diasCorridos, periodo, periodoCurto, pedidosDe, dadosDaPessoa, conferirPedido, ehColetiva, nomeDoPedido,
    cicloDe, proximoCiclo, semanasColetivas, addMeses, segueALei, liberacao, partesDoCiclo, coletivaDoCiclo, restanteDoCiclo,
    reservasDaEquipe, opcoesDeInicio, conferenciaParaDecidir, fimDe,
    registradas, visiveisPara, proximas,
    ehPedido, CONFIRMADO_PELO_RH, prazoRH, prazoLideranca, situacao, paraRH, paraLideranca, pedidosVisiveis, decisorDoPedido,
    emailDoPedido, textoDoEmail, corpoHtml, escolherRemetente,
  };
});
