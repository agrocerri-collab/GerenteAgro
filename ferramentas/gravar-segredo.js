// Grava um segredo no cofre do servidor (Secret Manager do projeto agrocr-campo)
// sem passar pelo chat. Uso:
//   ferramentas\node\node.exe ferramentas\gravar-segredo.js NOME "valor"
// Ex.: ... gravar-segredo.js SMTP_PASS "abcd efgh ijkl mnop"  (espaços são removidos)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const [nome, ...resto] = process.argv.slice(2);
const valor = resto.join(" ").replace(/\s+/g, "").trim();
if (!nome || !valor) { console.log("Uso: gravar-segredo.js NOME \"valor\""); process.exit(1); }
const arq = path.join(os.tmpdir(), "segredo-" + Date.now() + ".txt");
fs.writeFileSync(arq, valor, { encoding: "utf8" });
try {
  const r = spawnSync(process.execPath, [path.join(__dirname, "cli/node_modules/firebase-tools/lib/bin/firebase.js"), "functions:secrets:set", nome, "--data-file", arq, "--project", "agrocr-campo", "--non-interactive"], { encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  console.log(/Created a new secret version/.test(saida) ? `PRONTO: segredo ${nome} gravado (${valor.length} caracteres).` : "Resposta: " + saida.slice(-600));
} finally {
  try { fs.unlinkSync(arq); } catch (e) {}
}
