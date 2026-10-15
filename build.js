#!/usr/bin/env node
/* Junta src/ numa página única e gera o handler da Vercel.
     dist/index.html  — a página inteira (abra no navegador para a demonstração)
     api/app.js       — função serverless que devolve a página (o Bitrix chama por POST)
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
html = html.replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => js);

fs.mkdirSync(path.join(raiz, "dist"), { recursive: true });
fs.writeFileSync(path.join(raiz, "dist", "index.html"), html);

const handler = "// GERADO por build.js a partir de src/. Não edite à mão.\n" +
  "// O Bitrix24 abre o app local com POST; hospedagem estática só responde GET.\n" +
  "const HTML = " + JSON.stringify(html) + ";\n\n" +
  "module.exports = function handler(req, res) {\n" +
  "  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }\n" +
  "  if (req.method !== 'GET' && req.method !== 'POST') { res.statusCode = 405; res.end(); return; }\n" +
  "  res.setHeader('Content-Type', 'text/html; charset=utf-8');\n" +
  "  res.setHeader('Cache-Control', 'no-store');\n" +
  "  res.removeHeader('X-Frame-Options');\n" +
  "  res.statusCode = 200;\n" +
  "  res.end(HTML);\n" +
  "};\n";
fs.mkdirSync(path.join(raiz, "api"), { recursive: true });
fs.writeFileSync(path.join(raiz, "api", "app.js"), handler);
console.log("dist/index.html e api/app.js gerados (" + arquivosJs.length + " módulos, " + Math.round(html.length / 1024) + " KB).");
