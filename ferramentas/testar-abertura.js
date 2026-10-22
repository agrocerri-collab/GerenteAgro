// Teste de FUMAÇA: abre a página publicada num Chrome sem janela e confere se o
// app desenhou a tela de entrada — sem tela de erro, sem ficar em "Abrindo…".
// Pega o caso clássico: uma constante no topo do app que quebra tudo na abertura.
//
//   ferramentas\node\node.exe ferramentas\testar-abertura.js [pasta\index.html]
//
// Sem argumento, testa publicar\index.html (AgroCR). O gerar-gerenteagro.js chama
// com gerenteagro\publicar\index.html.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const raiz = path.dirname(__dirname);
const pagina = path.resolve(process.argv[2] || path.join(raiz, "publicar", "index.html"));
if (!fs.existsSync(pagina)) { console.error("✗ Página não encontrada: " + pagina); process.exit(2); }

const CANDIDATOS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chrome = CANDIDATOS.find((c) => c && fs.existsSync(c));
if (!chrome) { console.log("(teste de abertura pulado: Chrome/Edge não encontrado)"); process.exit(0); }

const url = "file:///" + pagina.replace(/\\/g, "/");
let dom = "";
try {
  dom = execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--disable-extensions",
    "--virtual-time-budget=20000", "--timeout=40000", "--window-size=412,915",
    "--user-data-dir=" + path.join(require("os").tmpdir(), "agrocr-fumaca"),
    "--dump-dom", url,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
} catch (e) {
  console.error("✗ O Chrome não conseguiu abrir a página: " + (e.message || e));
  process.exit(1);
}

// só o que está DESENHADO conta: tira scripts e estilos
const visivel = dom.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const texto = visivel.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const raizHtml = (visivel.match(/<div id="root">([\s\S]*)$/) || ["", ""])[1];
const problemas = [];
if (/nao conseguiu abrir|não conseguiu abrir/i.test(texto)) problemas.push("a tela de erro apareceu (" + (texto.match(/(Uncaught|Error|ReferenceError|TypeError)[^.]{0,160}/) || ["sem detalhe"])[0] + ")");
if (/id="carregando"/.test(visivel)) problemas.push("ficou em \"Abrindo…\" — o app não chegou a desenhar");
if (raizHtml.replace(/\s+/g, "").length < 400) problemas.push("a raiz do app está vazia");
if (problemas.length) {
  console.error("✗ Teste de abertura falhou em " + path.basename(path.dirname(pagina)) + "\\" + path.basename(pagina) + ":");
  for (const p of problemas) console.error("   - " + p);
  console.error("   Texto visível: " + texto.slice(0, 300));
  process.exit(1);
}
console.log("✓ Página abre e desenha a tela (" + texto.slice(0, 60).trim() + "…)");
