/* =====================================================================================
   REGRAS DE CÁLCULO (especificação, seção 4.5)
   -------------------------------------------------------------------------------------
   Funções puras, sem DOM e sem Bitrix: rodam no navegador (GP.calc) e no Node (testes).
   Datas são sempre strings ISO "AAAA-MM-DD", tratadas em UTC para não sofrer com fuso.
   Os exemplos da coluna "Exemplo" da 4.5 estão em test/calc.test.js.
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica();
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.calc = m; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DIA_MS = 86400000;

  /* ---------- datas ---------- */
  function paraData(iso) {
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, d));
  }
  function paraISO(data) { return data.toISOString().slice(0, 10); }
  function hojeISO(agora) {
    const d = agora || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDias(iso, n) { return paraISO(new Date(paraData(iso).getTime() + n * DIA_MS)); }
  /** b − a, em dias corridos */
  function diffDias(a, b) { return Math.round((paraData(b) - paraData(a)) / DIA_MS); }
  function diaSemana(iso) { return paraData(iso).getUTCDay(); } // 0 = domingo
  function dataValida(iso) { return /^\d{4}-\d{2}-\d{2}/.test(String(iso || "")); }

  const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function fmtData(iso) { if (!dataValida(iso)) return ""; const [, m, d] = iso.slice(0, 10).split("-"); return d + "/" + m; }
  function fmtDataAno(iso) { if (!dataValida(iso)) return ""; const [a, m, d] = iso.slice(0, 10).split("-"); return d + "/" + m + "/" + a; }
  function fmtDiaSemana(iso) { return DIAS_SEMANA[diaSemana(iso)]; }

  /* ---------- regra 1: Dia N ---------- */
  /** Dia do onboarding ou do plano: hoje − início + 1 */
  function diaN(inicio, hoje) { return diffDias(inicio, hoje) + 1; }
  /** Data do Dia N: início + (N − 1) */
  function dataDoDia(inicio, n) { return addDias(inicio, n - 1); }
  /** Plano termina no Dia 60 (início + 59 dias) */
  function terminoPlano(inicio) { return dataDoDia(inicio, 60); }

  /* ---------- regra 4: trimestres civis ---------- */
  function trimestreDe(iso) {
    const ano = Number(iso.slice(0, 4));
    const tri = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
    return trimestre(ano, tri);
  }
  function trimestre(ano, tri) {
    const mesIni = (tri - 1) * 3 + 1;
    const inicio = ano + "-" + String(mesIni).padStart(2, "0") + "-01";
    const fim = addDias(paraISO(new Date(Date.UTC(ano, mesIni + 2, 1))), -1);
    return { ano, tri, chave: ano + "-T" + tri, rotulo: tri + "º trimestre de " + ano, curto: tri + "º tri", inicio, fim };
  }
  function trimestreAnterior(t) { return t.tri === 1 ? trimestre(t.ano - 1, 4) : trimestre(t.ano, t.tri - 1); }
  function trimestrePorChave(chave) {
    const m = /^(\d{4})-T([1-4])$/.exec(String(chave || ""));
    return m ? trimestre(Number(m[1]), Number(m[2])) : null;
  }
  /** Prazo das evidências: fim do trimestre + 15 dias */
  function prazoEvidencias(t) { return addDias(t.fim, 15); }

  /* ---------- feriados e dia útil (regra 2) ---------- */
  /** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) */
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return ano + "-" + String(mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
  }
  /** Feriados nacionais (lei federal). Reserva para quando os avisos de feriado do Bitrix
      não estiverem disponíveis — ver GP.bitrix.carregarFeriadosBitrix. */
  function feriadosNacionais(ano) {
    const fixos = [
      ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"],
      ["09-07", "Independência do Brasil"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
      ["11-15", "Proclamação da República"], ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
      ["12-25", "Natal"],
    ].map(([md, nome]) => ({ data: ano + "-" + md, nome, abrangencia: "nacional" }));
    fixos.push({ data: addDias(pascoa(ano), -2), nome: "Sexta-feira Santa", abrangencia: "nacional" });
    return fixos.sort((x, y) => (x.data < y.data ? -1 : 1));
  }
  /** Conjunto de datas não úteis de uma pessoa: nacionais + locais da cidade de referência */
  function conjuntoFeriados(listas) {
    const s = new Set();
    (listas || []).forEach((l) => (l || []).forEach((f) => s.add(typeof f === "string" ? f : f.data)));
    return s;
  }
  function ehDiaUtil(iso, feriados) {
    const ds = diaSemana(iso);
    return ds !== 0 && ds !== 6 && !(feriados && feriados.has(iso));
  }
  /** Prazo que cai em dia não útil passa para o próximo dia útil */
  function ajustarPrazo(iso, feriados) {
    let d = iso;
    for (let i = 0; i < 30 && !ehDiaUtil(d, feriados); i++) d = addDias(d, 1);
    return d;
  }
  /** "Volta em": primeiro dia útil depois do fim da ausência */
  function voltaEm(fimAusencia, feriados) { return ajustarPrazo(addDias(fimAusencia, 1), feriados); }
  /** Soma N dias úteis a uma data (ex.: prazo de 5 dias úteis para o parecer do finalista) */
  function addDiasUteis(iso, n, feriados) {
    let d = iso, cont = 0;
    while (cont < n) { d = addDias(d, 1); if (ehDiaUtil(d, feriados)) cont++; }
    return d;
  }

  /* ---------- regra 3: atraso ---------- */
  /** O atraso conta a partir do dia seguinte ao prazo */
  function diasAtraso(prazo, hoje) { return Math.max(0, diffDias(prazo, hoje)); }
  function atrasado(prazo, hoje) { return dataValida(prazo) && diasAtraso(prazo, hoje) > 0; }
  /** Avisos: aviso no dia do atraso, e-mail com 7 dias, coordenação com 14 */
  function dataAviso(prazo, dias) { return addDias(prazo, dias); }
  function pertoDoAvisoDe14(prazo, hoje) { const a = diasAtraso(prazo, hoje); return a >= 7 && a <= 13; }

  /* ---------- regras 5 e 6: percentuais ---------- */
  function arredondar(x) { return Math.floor(x + 0.5); }
  /** "71% · 5 de 7"; denominador zero mostra "sem dado", nunca 0% nem 100% */
  function percentual(n, d) {
    if (!d) return { n, d, valor: null, texto: "sem dado", curto: "sem dado" };
    const valor = arredondar((n / d) * 100);
    return { n, d, valor, texto: valor + "% · " + n + " de " + d, curto: valor + "%" };
  }
  function media(nums) {
    const v = (nums || []).filter((x) => typeof x === "number" && !isNaN(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }
  function mediana(nums) {
    const v = (nums || []).filter((x) => typeof x === "number" && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* ---------- leituras de entrega e onboarding (3.2 e 3.4) ---------- */
  const LEITURAS = ["Conforme", "Com ajuste", "Fora do padrão", "Não entregue"];
  const NOTA_LEITURA = { "Conforme": 100, "Com ajuste": 70, "Fora do padrão": 30, "Não entregue": 0 };
  /** Média simples das leituras; sem leitura = null ("sem nota", nunca zero) */
  function notaDasLeituras(leituras) {
    const notas = (leituras || []).map((l) => NOTA_LEITURA[l]).filter((n) => typeof n === "number");
    const m = media(notas);
    return m === null ? null : arredondar(m);
  }
  const FASES_ONBOARDING = ["Preparação", "Ancoragem", "Imersão", "Mar Aberto"];
  const SENIORIDADES = ["Estagiário", "Júnior", "Pleno", "Sênior"];
  /** Patamar da nota por senioridade e fase (tabela da 3.2) */
  const PATAMAR = {
    "Estagiário": { "Ancoragem": 55, "Imersão": 65, "Mar Aberto": 75 },
    "Júnior": { "Ancoragem": 60, "Imersão": 70, "Mar Aberto": 80 },
    "Pleno": { "Ancoragem": 65, "Imersão": 75, "Mar Aberto": 85 },
    "Sênior": { "Ancoragem": 70, "Imersão": 80, "Mar Aberto": 90 },
  };
  const REVISAO_ESPERADA = {
    "Estagiário": "Toda entrega revisada antes de seguir",
    "Júnior": "Toda entrega revisada antes de seguir",
    "Pleno": "Por amostragem a partir da 3ª semana",
    "Sênior": "Só no fechamento da entrega",
  };
  /** Resultado da fase, testado nesta ordem: Abaixo → Atenção → Dentro */
  function resultadoFase(nota, patamar, foraDoPadrao) {
    const fora = foraDoPadrao || 0;
    if (nota === null || nota === undefined || patamar === undefined) return null;
    if (nota < patamar - 15 || fora >= 2) return "Abaixo do esperado";
    if (nota < patamar || fora === 1) return "Atenção";
    return "Dentro do esperado";
  }
  /** Fase do onboarding pelo Dia N (Preparação antes do Dia 1) */
  function faseDoDia(n) {
    if (n < 1) return "Preparação";
    if (n <= 30) return "Ancoragem";
    if (n <= 60) return "Imersão";
    return "Mar Aberto";
  }
  /** Alinhamentos do onboarding: Dias 30, 60 e 90, com a regra do dia útil */
  function datasAlinhamentos(ingresso, feriados) {
    return [30, 60, 90].map((n, i) => ({
      numero: i + 1, dia: n, rotulo: i === 2 ? "Alinhamento final" : "Alinhamento " + (i + 1),
      fase: ["Ancoragem", "Imersão", "Mar Aberto"][i],
      data: ajustarPrazo(dataDoDia(ingresso, n), feriados),
    }));
  }

  /* ---------- situação da liderança (6.1) ---------- */
  const SITUACOES = {
    "em-dia": { rotulo: "Em dia", icone: "✓", cor: "verde" },
    "atencao": { rotulo: "Atenção", icone: "!", cor: "ambar" },
    "apoio": { rotulo: "Precisa de apoio", icone: "✕", cor: "vermelho" },
  };
  /** Precisa de apoio: < 60% ou 3+ atrasos. Atenção: 60–84% ou 2 atrasos. Em dia: 85%+ e até 1. */
  function situacaoLideranca(pct, atrasadas) {
    const p = pct === null || pct === undefined ? null : pct;
    let chave;
    if ((p !== null && p < 60) || atrasadas >= 3) chave = "apoio";
    else if ((p !== null && p < 85) || atrasadas === 2) chave = "atencao";
    else chave = "em-dia";
    return Object.assign({ chave }, SITUACOES[chave]);
  }

  /* ---------- equilíbrio dos feedbacks (4.5) ---------- */
  /** Reconhecimento : desenvolvimento. Amarelo abaixo de 1:1, vermelho abaixo de 1:3,
      verde sem nenhum feedback de desenvolvimento. */
  function equilibrioFeedbacks(rec, dev) {
    const texto = rec + " : " + dev;
    if (!dev) return { texto, cor: "verde" };
    const r = rec / dev;
    if (r < 1 / 3) return { texto, cor: "vermelho" };
    if (r < 1) return { texto, cor: "ambar" };
    return { texto, cor: "verde" };
  }
  /** Abertura e encerramento de plano contam como desenvolvimento */
  function ehFeedbackDesenvolvimento(tipo) { return tipo !== "Reconhecimento"; }

  /* ---------- ausências: pico de pessoas fora (3.6 e 4.5) ---------- */
  /** ausencias: [{pessoa, inicio, fim}]; devolve o dia com mais gente fora no intervalo */
  function picoAusencias(ausencias, inicio, fim) {
    let melhor = { data: null, pessoas: [] };
    for (let d = inicio; d <= fim; d = addDias(d, 1)) {
      const fora = Array.from(new Set((ausencias || []).filter((a) => a.inicio <= d && a.fim >= d).map((a) => a.pessoa)));
      if (fora.length > melhor.pessoas.length) melhor = { data: d, pessoas: fora };
    }
    return melhor;
  }
  /** Aviso "Para planejar": 30% ou mais da equipe fora, ou a liderança e mais alguém */
  function avisoParaPlanejar(pessoasFora, tamanhoEquipe, liderancaId) {
    const n = pessoasFora.length;
    const comLideranca = liderancaId && pessoasFora.indexOf(liderancaId) >= 0 && n >= 2;
    const pct = tamanhoEquipe ? n / tamanhoEquipe : 0;
    return { avisar: n > 0 && (pct >= 0.3 || comLideranca), comLideranca: !!comLideranca, pct: percentual(n, tamanhoEquipe) };
  }

  return {
    paraData, paraISO, hojeISO, addDias, diffDias, diaSemana, dataValida,
    fmtData, fmtDataAno, fmtDiaSemana, MESES, DIAS_SEMANA,
    diaN, dataDoDia, terminoPlano,
    trimestreDe, trimestre, trimestreAnterior, trimestrePorChave, prazoEvidencias,
    pascoa, feriadosNacionais, conjuntoFeriados, ehDiaUtil, ajustarPrazo, voltaEm, addDiasUteis,
    diasAtraso, atrasado, dataAviso, pertoDoAvisoDe14,
    arredondar, percentual, media, mediana,
    LEITURAS, NOTA_LEITURA, notaDasLeituras, FASES_ONBOARDING, SENIORIDADES, PATAMAR, REVISAO_ESPERADA,
    resultadoFase, faseDoDia, datasAlinhamentos,
    SITUACOES, situacaoLideranca, equilibrioFeedbacks, ehFeedbackDesenvolvimento,
    picoAusencias, avisoParaPlanejar,
  };
});
