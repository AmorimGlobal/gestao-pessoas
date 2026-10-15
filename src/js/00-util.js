/* =====================================================================================
   UTILITÁRIOS — escape de HTML, nomes, ícones
   ===================================================================================== */
(function (raiz, fabrica) {
  const m = fabrica();
  if (typeof module === "object" && module.exports) module.exports = m;
  else { raiz.GP = raiz.GP || {}; raiz.GP.util = m; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /** Todo dado do Bitrix ou digitado passa por aqui antes de entrar no HTML */
  function esc(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escMultilinha(v) { return esc(v).replace(/\r?\n/g, "<br>"); }

  function iniciais(nome) {
    const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  function primeiroNome(nome) { return String(nome || "").trim().split(/\s+/)[0] || ""; }
  const PALETA = ["#0044ff", "#000c33", "#3d5afe", "#2a3a8f", "#5b6cff"];
  function corDoNome(nome) {
    let h = 0;
    const s = String(nome || "?");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETA[h % PALETA.length];
  }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  function normalizar(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function porNome(a, b) { return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"); }
  function agrupar(lista, chave) {
    const m = {};
    (lista || []).forEach((x) => { const k = typeof chave === "function" ? chave(x) : x[chave]; (m[k] = m[k] || []).push(x); });
    return m;
  }

  /* Ícones (traço, 24×24). Cada módulo tem o seu (regra de interface 4 da 4.6). */
  const P = {
    inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 1.8 5.3 4.9"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    recrutamento: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21"/><path d="M10 7.5v5M7.5 10h5"/>',
    onboarding: '<path d="M12 3v13"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M8 6h8"/><circle cx="12" cy="4" r="1.2"/>',
    rotinas: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    desempenho: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    offboarding: '<path d="M14 4h5v16h-5"/><path d="M10 12h10"/><path d="M6 8l-4 4 4 4"/><path d="M2 12h8"/>',
    manual: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a2 2 0 0 0-2 2"/><path d="M20 4v14h-6"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.3-6.5 8-6.5s7 2 8 6.5"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3v3H8z"/>',
    seta: '<path d="M9 6l6 6-6 6"/>',
    voltar: '<path d="M15 6l-6 6 6 6"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    externo: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    amora: '<circle cx="9" cy="13" r="3"/><circle cx="15" cy="13" r="3"/><circle cx="12" cy="17.5" r="3"/><circle cx="12" cy="9" r="3"/><path d="M12 6c0-2 1.5-3 3-3"/>',
    clipe: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  };
  function icone(nome, tamanho, extraClasse) {
    const t = tamanho || 18;
    return '<svg class="ico ' + (extraClasse || "") + '" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[nome] || "") + "</svg>";
  }

  return { esc, escMultilinha, iniciais, primeiroNome, corDoNome, plural, normalizar, porNome, agrupar, icone };
});
