/* =====================================================================================
   REVISÕES SEMANAIS — o alinhamento semanal pelo WhatsApp (app-gestao-semanal) no card
   do membro (pedido do usuário, 04/11/2026)
   -------------------------------------------------------------------------------------
   O app semanal (Flask + Supabase, repositório AmorimGlobal/app-gestao-semanal) manda as
   perguntas pelo WhatsApp: os liderados respondem de sexta até segunda 07h, as lideranças
   na segunda. Ele guarda só o ciclo atual: ao começar o ciclo seguinte, apaga as respostas.
   Por isso a rotina das 6h (api/sincronizar.js) e o botão "Buscar agora" (api/semanal.js)
   copiam as respostas para a tabela do CRM "Revisões semanais", filha de Membros: um item
   por pessoa e por semana, que fica no card do membro (aba Semanal).
   - Quem respondeu vira a pessoa do Bitrix pelo telefone (DDD + os 8 últimos dígitos), senão
     pelo nome. O telefone nunca é gravado no Bitrix.
   - A semana é a sexta-feira da semana de trabalho a que as respostas se referem.
   - A pergunta 2 é "Casos sensíveis": a tabela segue as mesmas permissões dos outros
     registros da equipe (liderança, coordenação e RH; o membro não vê).
   Funções puras (Node + navegador): test/semanal.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica(raiz.GP && raiz.GP.calc ? raiz.GP.calc : require("./10-calc.js"));
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.semanal = m; }
})(typeof window !== "undefined" ? window : globalThis, function (calc) {
  "use strict";

  const PAPEL = { liderado: "Membro", lider: "Liderança" };
  const HORA_CICLO = 8; // o app semanal começa o ciclo às 8h de sexta (liderados) e de segunda (lideranças), pelos crons dele (11h UTC)

  /* ---------------- quem respondeu ---------------- */
  const digitos = (s) => String(s || "").replace(/\D/g, "");
  /** DDD + os 8 últimos dígitos: o WhatsApp de celulares do Brasil às vezes vem sem o 9 da frente */
  function chaveFone(s) {
    let d = digitos(s);
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length < 10) return "";
    return d.slice(0, 2) + d.slice(-8);
  }
  function chaveNome(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  const primeiroUltimo = (s) => { const p = chaveNome(s).split(" ").filter(Boolean); return p.length > 1 ? p[0] + " " + p[p.length - 1] : p[0] || ""; };

  /** usuarios: [{id, nome, fones: []}] -> {usuario, como: "telefone" | "nome" | ""} */
  function casarPessoa(p, usuarios) {
    const fone = chaveFone(p.whatsapp);
    if (fone) {
      const porFone = usuarios.filter((u) => (u.fones || []).some((f) => chaveFone(f) === fone));
      if (porFone.length === 1) return { usuario: porFone[0], como: "telefone" };
    }
    const nome = chaveNome(p.nome);
    const exato = usuarios.filter((u) => chaveNome(u.nome) === nome);
    if (exato.length === 1) return { usuario: exato[0], como: "nome" };
    const pu = primeiroUltimo(p.nome);
    const parecido = pu && pu.indexOf(" ") > 0 ? usuarios.filter((u) => primeiroUltimo(u.nome) === pu) : [];
    if (parecido.length === 1) return { usuario: parecido[0], como: "nome" };
    return { usuario: null, como: "" };
  }

  /* ---------------- a semana ---------------- */
  /** A sexta-feira (AAAA-MM-DD) da semana de trabalho das respostas guardadas agora. agora = "AAAA-MM-DDTHH:MM" em São Paulo.
      O app semanal não informa a data de cada resposta, então vale o calendário dele: as respostas que estão lá são as do
      ciclo mais recente. Liderados: o ciclo começa na sexta (sobre a semana que termina nela). Lideranças: na segunda (sobre a
      semana anterior, que terminou na sexta de 3 dias antes). Antes das 8h do dia do ciclo, vale o ciclo anterior. */
  function semanaDasRespostas(agora, papel) {
    const dia = String(agora).slice(0, 10);
    const hora = Number(String(agora).slice(11, 13) || 0);
    const ds = calc.diaSemana(dia);
    if (papel === "lider") {
      let seg = calc.addDias(dia, -((ds - 1 + 7) % 7));
      if (ds === 1 && hora < HORA_CICLO) seg = calc.addDias(seg, -7);
      return calc.addDias(seg, -3);
    }
    let sexta = calc.addDias(dia, -((ds - 5 + 7) % 7));
    if (ds === 5 && hora < HORA_CICLO) sexta = calc.addDias(sexta, -7);
    return sexta;
  }
  /** "26/10 a 30/10": de segunda a sexta da semana */
  function rotuloSemana(sexta) { return sexta ? calc.fmtData(calc.addDias(sexta, -4)) + " a " + calc.fmtData(sexta) : ""; }

  /* ---------------- o texto guardado ---------------- */
  const SEP = " — ";
  /** itens: [{pergunta, resposta}] -> "1. Sua semana — Como foi a sua semana? ...\nResposta\n\n2. ..."
      A pergunta do app semanal vem com o título na primeira linha ("Sua semana") e o texto depois: os dois ficam no cabeçalho. */
  function formatarRespostas(itens) {
    return (itens || []).filter((r) => String(r.resposta || "").trim()).map((r, i) => {
      const linhas = String(r.pergunta || "Pergunta").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[*_]/g, "").trim()).filter(Boolean);
      const cab = linhas.length > 1 ? linhas[0] + SEP + linhas.slice(1).join(" ") : (linhas[0] || "Pergunta");
      return (i + 1) + ". " + cab.replace(/\s+/g, " ") + "\n" + String(r.resposta).trim();
    }).join("\n\n");
  }
  /** O inverso, para a tela: [{titulo, pergunta, resposta}] */
  function lerRespostas(texto) {
    return String(texto || "").replace(/\r\n?/g, "\n").split(/\n\n(?=\d+\. )/).map((bloco) => {
      const i = bloco.indexOf("\n");
      const cab = (i < 0 ? bloco : bloco.slice(0, i)).replace(/^\d+\.\s*/, "").trim();
      const j = cab.indexOf(SEP);
      return { titulo: j > 0 ? cab.slice(0, j) : "", pergunta: j > 0 ? cab.slice(j + SEP.length) : cab, resposta: i < 0 ? "" : bloco.slice(i + 1).trim() };
    }).filter((x) => x.pergunta || x.resposta);
  }
  const chaveOrigem = (papel, id, sexta) => papel + ":" + id + ":" + sexta;

  /* ---------------- o plano da gravação ---------------- */
  /** o = { pessoas: [{id, papel: "liderado"|"lider", nome, whatsapp, respostas: [{pergunta, resposta}]}],
           usuarios: [{id, nome, fones}], membros: [{id, responsavel, estagio}], existentes: [itens da tabela],
           agora: "AAAA-MM-DDTHH:MM" (São Paulo), agoraIso: data e hora do registro }
      -> { criar: [dados], atualizar: [{id, dados}], semMudanca, semResposta, naoEncontradas: [{nome, papel}], semMembro: [{nome, papel}] } */
  function planejar(o) {
    const membroDe = {};
    (o.membros || []).filter((m) => ["SUCCESS", "FAIL"].indexOf(m.estagio) < 0).forEach((m) => { membroDe[String(m.responsavel)] = m; });
    const porOrigem = {};
    const doMembro = {};
    (o.existentes || []).forEach((it) => {
      if (it.origem) porOrigem[it.origem] = it;
      (doMembro[it.membroId] = doMembro[it.membroId] || []).push(it);
    });
    const r = { criar: [], atualizar: [], semMudanca: 0, semResposta: 0, naoEncontradas: [], semMembro: [] };
    (o.pessoas || []).forEach((p) => {
      const texto = formatarRespostas(p.respostas);
      if (!texto) { r.semResposta++; return; }
      const casou = casarPessoa(p, o.usuarios || []);
      if (!casou.usuario) { r.naoEncontradas.push({ nome: p.nome, papel: PAPEL[p.papel] }); return; }
      const m = membroDe[String(casou.usuario.id)];
      if (!m) { r.semMembro.push({ nome: casou.usuario.nome, papel: PAPEL[p.papel] }); return; }
      const sexta = semanaDasRespostas(o.agora, p.papel);
      const origem = chaveOrigem(p.papel, p.id, sexta);
      const respondidas = (p.respostas || []).filter((x) => String(x.resposta || "").trim()).length;
      const ja = porOrigem[origem];
      if (ja) {
        if (String(ja.respostas || "").trim() === texto) r.semMudanca++;
        else r.atualizar.push({ id: ja.id, dados: { respostas: texto, respondidas, guardadaEm: o.agoraIso } });
        return;
      }
      // o mesmo texto da semana anterior: o ciclo novo ainda não começou (não duplica a semana passada)
      const anterior = (doMembro[m.id] || []).filter((x) => x.papel === PAPEL[p.papel] && x.semana && x.semana < sexta).sort((a, b) => (a.semana < b.semana ? 1 : -1))[0];
      if (anterior && String(anterior.respostas || "").trim() === texto) { r.semMudanca++; return; }
      r.criar.push({
        titulo: "Revisão semanal · " + casou.usuario.nome + " · " + rotuloSemana(sexta), membroId: m.id, responsavel: String(casou.usuario.id),
        estagio: "NEW", semana: sexta, papel: PAPEL[p.papel], respostas: texto, respondidas, guardadaEm: o.agoraIso, origem,
      });
    });
    return r;
  }

  /** As revisões de um membro, da semana mais recente para a mais antiga */
  function doMembro(ctx, membroId) {
    return ((ctx.registros && ctx.registros.semanal) || []).filter((x) => x.membroId === String(membroId) && x.estagio !== "FAIL")
      .sort((a, b) => (a.semana < b.semana ? 1 : a.semana > b.semana ? -1 : 0));
  }

  return { PAPEL, chaveFone, chaveNome, casarPessoa, semanaDasRespostas, rotuloSemana, formatarRespostas, lerRespostas, chaveOrigem, planejar, doMembro };
});
