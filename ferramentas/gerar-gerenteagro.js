// Gera a versao GERENTEAGRO (produto comercial) a partir do AgroCR Campo.
// Mesmo motor, marca propria, projeto Firebase separado (gerenteagro).
// Uso: rode DEPOIS de "build.ps1 -Publicar" (usa a pasta publicar\ como base):
//   ferramentas\node\node.exe ferramentas\gerar-gerenteagro.js
const fs = require("fs");
const path = require("path");
const esbuild = require(path.join(__dirname, "cli", "node_modules", "esbuild"));

const raiz = path.dirname(__dirname);
const dirSaida = path.join(raiz, "gerenteagro");
const dirPub = path.join(dirSaida, "publicar");
const modelo = path.join(raiz, "publicar");

// ---------- logo (SVG horizontal) e icone (SVG quadrado) ----------
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 120">' +
  '<rect width="430" height="120" rx="14" fill="#ffffff"/>' +
  '<path d="M60 8 L104 24 V64 c0 26-20 40-44 48 C36 104 16 90 16 64 V24 Z" fill="#1B5E20"/>' +
  '<path d="M56 80 C56 60 46 52 32 50 c2 16 10 26 24 30 Z" fill="#8BC34A"/>' +
  '<path d="M62 80 C62 52 74 40 90 38 c-2 20-12 34-28 42 Z" fill="#7CB342"/>' +
  '<path d="M60 82 V54" stroke="#8BC34A" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M28 90 q34-16 66-4" stroke="#8BC34A" stroke-width="6" fill="none" stroke-linecap="round"/>' +
  '<circle cx="88" cy="72" r="15" fill="#ffffff"/>' +
  '<circle cx="88" cy="72" r="12" fill="#1B5E20"/>' +
  '<path d="M81 72 l5 5 9-10" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<text x="120" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="800" fill="#1E3A2A">Gerente<tspan fill="#2E7D32">Agro</tspan></text>' +
  "</svg>";
const LOGO_URI = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(LOGO_SVG);

const ICONE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
  '<rect width="120" height="120" rx="24" fill="#F4F6F1"/>' +
  '<path d="M60 10 L102 26 V64 c0 26-19 39-42 46 C37 103 18 90 18 64 V26 Z" fill="#1B5E20"/>' +
  '<path d="M56 80 C56 60 46 52 32 50 c2 16 10 26 24 30 Z" fill="#8BC34A"/>' +
  '<path d="M62 80 C62 52 74 40 90 38 c-2 20-12 34-28 42 Z" fill="#7CB342"/>' +
  '<path d="M60 82 V54" stroke="#8BC34A" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M30 90 q32-15 62-4" stroke="#8BC34A" stroke-width="6" fill="none" stroke-linecap="round"/>' +
  '<circle cx="86" cy="72" r="15" fill="#ffffff"/>' +
  '<circle cx="86" cy="72" r="12" fill="#1B5E20"/>' +
  '<path d="M79 72 l5 5 9-10" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

// ---------- configuracao do projeto Firebase gerenteagro ----------
const CONFIG = `// Configuracao do projeto Firebase do GerenteAgro.
// Estas chaves sao publicas por natureza: viajam dentro do aplicativo.
// A seguranca de verdade esta nas regras do Firestore.
self.AGROCR_FIREBASE = {
  apiKey: "AIzaSyAPH4az6HplLL9439V7hut1GZ59tv-l-kI",
  authDomain: "gerenteagro.firebaseapp.com",
  projectId: "gerenteagro",
  storageBucket: "gerenteagro.firebasestorage.app",
  messagingSenderId: "494122145826",
  appId: "1:494122145826:web:acfe2598d816a48bec927b",
};

// Avisos push: vazio por enquanto (gerar o par de chaves no console
// quando quiser ligar os avisos do GerenteAgro).
self.AGROCR_VAPID = "BDJ0rjQZr8F9V5_ocpyB_-rGINlWD7v-x6rZJQpDKf3KIjw5xqH2299cW2ACs1RRn8Z9ZLORMRj_y_2tNdEat3o";

// NDVI (Copernicus/Sentinel) — mesma instancia, o mapa funciona igual.
self.AGROCR_SENTINEL = "9733d083-389b-45ec-ba36-3af0191459b0";

// Multi-conta: cada comprador e uma "conta" isolada — so enxerga as
// fazendas, acessos e listas dele. Casa com multiConta() das regras.
self.AGROCR_MULTICONTA = true;

// App Check (reCAPTCHA Enterprise do projeto gerenteagro): so o app oficial
// fala com o banco e as funcoes. Modo observacao ate ligar o enforcement.
self.AGROCR_APPCHECK = "6LepeaotAAAAAAKOb0u7PfA0iUjtRtWCGDbneq0b";
`;

const marcar = (t) => t
  .replace(/AgroCR Campo/g, "GerenteAgro")
  .replace(/AgroCR/g, "GerenteAgro");

// ---------- 1) codigo-fonte com a marca ----------
let jsx = fs.readFileSync(path.join(raiz, "agrocr-app.jsx"), "utf8");
jsx = jsx.replace(/const LOGO = "data:image[^"]+";/, "const LOGO = " + JSON.stringify(LOGO_URI) + ";");
jsx = jsx.replace(/const ADMINS = \[[^\]]*\];/, 'const ADMINS = ["administrativo@gerenteagro.com", "agrocerri@gmail.com"];');
jsx = jsx.replace(/const MARCA_VENDA = false;/, "const MARCA_VENDA = true;");
// nem o endereco do site da consultoria viaja no produto de venda
jsx = jsx.replace(/https:\/\/agrocr-campo\.web\.app/g, "https://gerenteagro.web.app");
jsx = marcar(jsx);
jsx = jsx.replace(/import\s*\{[^}]*\}\s*from\s*"react";\s*/, "");
jsx = jsx.replace(/export default function App/, "function App");
const completo =
  'const { useState, useEffect, useRef } = React;\n' + jsx +
  '\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));\n';
const compilado = esbuild.transformSync(completo, {
  loader: "jsx", jsx: "transform", minify: true, format: "iife", charset: "ascii", target: "es2018",
}).code;

// ---------- 2) copia a pasta publicar (modelo) ----------
fs.rmSync(dirPub, { recursive: true, force: true });
fs.mkdirSync(dirPub, { recursive: true });
const copiar = (de, para) => {
  for (const nome of fs.readdirSync(de)) {
    const o = path.join(de, nome), d = path.join(para, nome);
    if (fs.statSync(o).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copiar(o, d); }
    else fs.copyFileSync(o, d);
  }
};
copiar(modelo, dirPub);

// ---------- 3) sobrescreve e ajusta ----------
fs.writeFileSync(path.join(dirPub, "app-compilado.js"), compilado, "utf8");
fs.writeFileSync(path.join(dirPub, "firebase-config.js"), CONFIG, "utf8");
fs.writeFileSync(path.join(dirPub, "icone-ga.svg"), ICONE_SVG, "utf8");
// pagina de apresentacao/vendas (link da bio): fonte fixa em gerenteagro\conheca.html
const conheca = path.join(dirSaida, "conheca.html");
if (fs.existsSync(conheca)) fs.copyFileSync(conheca, path.join(dirPub, "conheca.html"));
// atalho gerenteagro.web.app/teste -> abre o app na tela "Criar minha conta" (#teste)
const teste = path.join(dirSaida, "teste.html");
if (fs.existsSync(teste)) fs.copyFileSync(teste, path.join(dirPub, "teste.html"));
// filme de divulgacao (animacao 9:16 para gravar a tela): gerenteagro\filme.html
// termos de uso e política de privacidade: gerenteagro\termos.html e privacidade.html
for (const nomePag of ["termos.html", "privacidade.html"]) {
  const orig = path.join(dirSaida, nomePag);
  if (fs.existsSync(orig)) fs.copyFileSync(orig, path.join(dirPub, nomePag));
}
const filme = path.join(dirSaida, "filme.html");
if (fs.existsSync(filme)) fs.copyFileSync(filme, path.join(dirPub, "filme.html"));

const patch = (arq, fn) => {
  const p = path.join(dirPub, arq);
  if (!fs.existsSync(p)) return;
  fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8")), "utf8");
};
patch("index.html", (t) => marcar(t).replace(/icone-192\.png/g, "icone-ga.svg"));
patch("socorro.html", (t) => marcar(t).replace(/"agrocr-"/g, '"gerenteagro-"'));
// nuvem.js tem o titulo e o icone dos avisos de celular — troca a marca
patch("nuvem.js", (t) => marcar(t)
  .replace(/icone-192\.png/g, "icone-ga.svg")
  .replace(/projeto: "agrocr-campo"/, 'projeto: "gerenteagro"'));
patch("sw.js", (t) => marcar(t)
  .replace(/const VERSAO = "[^"]+"/, (m) => m.replace("agrocr", "gerenteagro"))
  .replace(/"\.\/icone-192\.png",\s*"\.\/icone-512\.png",\s*"\.\/icone-maskable\.png",/, '"./icone-ga.svg",')
  .replace(/icone-192\.png/g, "icone-ga.svg"));
// os icones do AgroCR nao viajam no produto de venda
for (const f of ["icone-192.png", "icone-512.png", "icone-maskable.png"]) {
  try { fs.rmSync(path.join(dirPub, f)); } catch (e) {}
}
patch("manifest.webmanifest", (t) => {
  const m = JSON.parse(t);
  m.name = "GerenteAgro"; m.short_name = "GerenteAgro";
  m.icons = [{ src: "icone-ga.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
             { src: "icone-ga.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }];
  return JSON.stringify(m, null, 2);
});

// ---------- 4) regras e firebase.json do projeto ----------
// uid(s) da conta do dono da plataforma no GerenteAgro (administrativo@gerenteagro.com): as fazendas
// dessa conta (demonstracao) nao tem licenca, porque o dono nao paga — o funcionario do ponto entra por aqui
const UIDS_DONO_GA = ["AEChKtFa9rVa7VwTRAGw2KvumO53"];
let regras = fs.readFileSync(path.join(raiz, "firestore.rules"), "utf8");
regras = regras.replace(/'agrocerri@yahoo\.com\.br',\s*\n\s*'agrocerri@gmail\.com'/,
  "'administrativo@gerenteagro.com',\n        'agrocerri@gmail.com'");
// versao de venda: licenca por e-mail obrigatoria (o dono nao precisa)
regras = regras.replace(/function licencaOk\(\) \{\s*return true;\s*\}/,
  "function licencaOk() {\n" +
  "      return ehDono() ||\n" +
  "        (exists(/databases/$(database)/documents/licencas/$(request.auth.token.email)) &&\n" +
  "         get(/databases/$(database)/documents/licencas/$(request.auth.token.email)).data.validaAte > request.time) ||\n" +
  "        pontoPelaContaPaga();\n" +
  "    }\n" +
  "    // acesso SO DO PONTO (funcionario do RH): nao gasta licenca — vale enquanto a do dono da conta valer\n" +
  "    function pontoPelaContaPaga() {\n" +
  "      return logado() && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) &&\n" +
  "        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.get('soPonto', false) == true &&\n" +
  "        (contaDoDonoDaPlataforma(get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.get('conta', 'x')) ||\n" +
  "         (exists(/databases/$(database)/documents/usuarios/$(get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.get('conta', 'x'))) &&\n" +
  "          licencaDoEmailValida(string(get(/databases/$(database)/documents/usuarios/$(get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.get('conta', 'x'))).data.get('email', 'x')).lower())));\n" +
  "    }\n" +
  "    // a conta do dono da plataforma (fazendas dele e de demonstracao) nao tem licenca: o dono nao paga\n" +
  "    function contaDoDonoDaPlataforma(conta) {\n" +
  "      return conta in " + JSON.stringify(UIDS_DONO_GA).replace(/"/g, "'") + ";\n" +
  "    }\n" +
  "    function licencaDoEmailValida(email) {\n" +
  "      return exists(/databases/$(database)/documents/licencas/$(email)) &&\n" +
  "        get(/databases/$(database)/documents/licencas/$(email)).data.validaAte > request.time;\n" +
  "    }");
// versao de venda: liga o isolamento por conta (multi-inquilino)
regras = regras.replace(/function multiConta\(\) \{\s*return false;\s*\}/,
  "function multiConta() {\n      return true;\n    }");
if (!/return true;\s*\}\s*\n\s*function minhaConta/.test(regras)) {
  throw new Error("nao consegui ligar multiConta() nas regras — confira firestore.rules");
}
fs.writeFileSync(path.join(dirSaida, "firestore.rules"), regras, "utf8");
// indices compostos que as consultas com filtro de conta exigem
fs.writeFileSync(path.join(dirSaida, "firestore.indexes.json"), JSON.stringify({
  indexes: [
    { collectionGroup: "usuarios", queryScope: "COLLECTION", fields: [
      { fieldPath: "conta", order: "ASCENDING" },
      { fieldPath: "fazendas", arrayConfig: "CONTAINS" } ] },
    { collectionGroup: "usuarios", queryScope: "COLLECTION", fields: [
      { fieldPath: "conta", order: "ASCENDING" },
      { fieldPath: "papel", order: "ASCENDING" } ] },
  ],
  fieldOverrides: [],
}, null, 2), "utf8");
fs.writeFileSync(path.join(dirSaida, "firebase.json"), JSON.stringify({
  hosting: {
    public: "publicar",
    ignore: ["**/.*"],
    // cabeçalhos de proteção (relatório externo de 28/09/2026): não pode ser posto em moldura por outro site,
    // sem adivinhação de tipo de arquivo, referer curto; CSP só de enquadramento/objetos (scripts ficam livres)
    headers: [{ source: "**", headers: [{ key: "Cache-Control", value: "no-cache" }, ...[{"key":"X-Frame-Options","value":"DENY"},{"key":"X-Content-Type-Options","value":"nosniff"},{"key":"Referrer-Policy","value":"strict-origin-when-cross-origin"},{"key":"Content-Security-Policy","value":"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},{"key":"Permissions-Policy","value":"camera=(self), geolocation=(self), microphone=(self)"}]] }],
    // link curto de divulgação: gerenteagro.web.app/teste abre direto no "Criar minha conta"
    rewrites: [{ source: "/teste", destination: "/teste.html" }],
  },
  firestore: { rules: "firestore.rules", indexes: "firestore.indexes.json" },
}, null, 2), "utf8");

console.log("GerenteAgro gerado em gerenteagro\\publicar (" + Math.round(compilado.length / 1024) + " KB de app)");

// teste de fumaça: a página do GerenteAgro precisa abrir (mesma checagem do build.ps1 -Publicar)
{
  const { execFileSync } = require("child_process");
  const path = require("path");
  try {
    execFileSync(process.execPath, [path.join(__dirname, "testar-abertura.js"), path.join(path.dirname(__dirname), "gerenteagro", "publicar", "index.html")], { stdio: "inherit" });
  } catch (e) { console.error("✗ GerenteAgro gerado, mas a página NÃO abre — não publique."); process.exit(1); }
}
