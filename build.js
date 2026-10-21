#!/usr/bin/env node
/* Junta src/ numa página única e gera o handler da Vercel.
     dist/index.html  — a página inteira (abra no navegador para a demonstração)
     api/app.js       — função serverless que devolve a página (o Bitrix chama por POST)
     public/robots.txt — saída estática da Vercel (sem index.html, ver abaixo)
   Rode depois de qualquer mudança em src/:  node build.js */
"use strict";
const fs = require("fs");
const path = require("path");

const raiz = __dirname;
const src = path.join(raiz, "src");
const arquivosJs = fs.readdirSync(path.join(src, "js")).filter((f) => f.endsWith(".js")).sort();
const js = arquivosJs.map((f) => "/* ---- " + f + " ---- */\n" + fs.readFileSync(path.join(src, "js", f), "utf8")).join("\n");
const css = fs.readFileSync(path.join(src, "styles.css"), "utf8");
let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
if (js.indexOf("</script") >= 0) throw new Error("O JS não pode conter </script> (quebra a página).");
// Só compila (não executa): erro de sintaxe derruba o build, e a Vercel mantém a versão anterior no ar
try { new Function(js); } catch (e) { throw new Error("Erro de sintaxe no JS do app: " + e.message); }
html = html.replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => js);

fs.mkdirSync(path.join(raiz, "dist"), { recursive: true });
fs.writeFileSync(path.join(raiz, "dist", "index.html"), html);

// Versão publicada: só abre dentro do Bitrix (sem a demonstração). A dist/ local continua com a demonstração.
const marcaProducao = "<script>window.GP_SO_BITRIX = true;</script>";
if (html.indexOf("<head>") < 0) throw new Error("src/index.html sem <head>: não dá para marcar a versão publicada.");
const htmlProducao = html.replace("<head>", () => "<head>\n" + marcaProducao);
const handler = "// GERADO por build.js a partir de src/. Não edite à mão.\n" +
  "// O Bitrix24 abre o app local com POST; a página só sai depois de o portal confirmar a sessão (lib/acesso.js).\n" +
  "const { atenderPagina } = require(\"../lib/acesso.js\");\n" +
  "const HTML = " + JSON.stringify(htmlProducao) + ";\n\n" +
  "module.exports = function handler(req, res) { return atenderPagina(req, res, HTML); };\n";
fs.mkdirSync(path.join(raiz, "api"), { recursive: true });
fs.writeFileSync(path.join(raiz, "api", "app.js"), handler);

// Pasta de saída estática da Vercel: de propósito SEM index.html. A página precisa
// sair da função (o Bitrix abre com POST, e arquivo estático recusa POST), então
// toda rota cai no rewrite para /api/app (vercel.json).
fs.mkdirSync(path.join(raiz, "public"), { recursive: true });
fs.writeFileSync(path.join(raiz, "public", "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("dist/index.html e api/app.js gerados (" + arquivosJs.length + " módulos, " + Math.round(html.length / 1024) + " KB).");
