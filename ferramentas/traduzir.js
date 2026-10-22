// Traduz o agrocr-app.jsx para JavaScript puro (web\app-compilado.js),
// sem precisar de navegador: roda direto no Node da pasta ferramentas\.
// Faz as MESMAS trocas que o build.ps1 e o compilar.html fazem.
//
// A saida e MINIFICADA (comprimida e com nomes embaralhados): o arquivo
// fica menor para o 4G da lavoura e muito mais dificil de copiar.
const fs = require("fs");
const path = require("path");
const esbuild = require(path.join(__dirname, "cli", "node_modules", "esbuild"));

const fonte = path.join(path.dirname(__dirname), "agrocr-app.jsx");
const saida = path.join(path.dirname(__dirname), "web", "app-compilado.js");

let jsx = fs.readFileSync(fonte, "utf8");
jsx = jsx.replace(/import\s*\{[^}]*\}\s*from\s*"react";\s*/, "");
jsx = jsx.replace(/export default function App/, "function App");

// O comeco e o fim entram ANTES da traducao: assim o minificador enxerga o
// programa inteiro e pode embaralhar os nomes internos com seguranca.
const completoFonte =
  'const { useState, useEffect, useRef } = React;\n' +
  jsx +
  '\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));\n';

const resultado = esbuild.transformSync(completoFonte, {
  loader: "jsx",
  jsx: "transform",          // vira React.createElement, como o Babel fazia
  minify: true,              // comprime e embaralha os nomes internos
  format: "iife",            // embrulha tudo: nada vaza, nada entra pelo console
  charset: "ascii",          // acentos viram \xE7 etc.: nunca quebra por codificacao
  target: "es2018",          // celulares de campo com Chrome antigo
});

fs.writeFileSync(saida, resultado.code, "utf8");
console.log("app-compilado.js gravado: " + Math.round(resultado.code.length / 1024) + " KB (minificado)");
