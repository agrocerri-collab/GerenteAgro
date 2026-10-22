// Gera web\insumos-agrofit.json a partir do CSV de produtos formulados do
// Agrofit (dados abertos do MAPA). Guarda so o que o app precisa: nome
// comercial, ingrediente ativo, categoria e unidade — um registro por marca.
// Uso: ferramentas\node\node.exe ferramentas\gerar-agrofit.js <caminho do csv>
const fs = require("fs");
const path = require("path");

const entrada = process.argv[2];
if (!entrada || !fs.existsSync(entrada)) { console.error("Passe o caminho do CSV do Agrofit."); process.exit(1); }
const saida = path.join(path.dirname(__dirname), "web", "insumos-agrofit.json");

// tenta UTF-8; se aparecer muito caractere de substituicao, cai para latin1
let texto = fs.readFileSync(entrada, "utf8");
if ((texto.slice(0, 200000).match(/�/g) || []).length > 20) texto = fs.readFileSync(entrada, "latin1");

const linhas = texto.split(/\r?\n/);
const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
// separa respeitando aspas
function partir(l) {
  const cols = []; let atual = "", dentro = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (dentro && l[i + 1] === '"') { atual += '"'; i++; } else dentro = !dentro; }
    else if (ch === sep && !dentro) { cols.push(atual); atual = ""; }
    else atual += ch;
  }
  cols.push(atual);
  return cols;
}
const cab = partir(linhas[0]).map((c) => c.toUpperCase());
const achar = (frag) => cab.findIndex((c) => c.includes(frag));
const iMarca = achar("MARCA");
const iAtivo = achar("INGREDIENTE");
const iClasse = achar("CLASSE");
const iForm = achar("FORMULA");
console.log("colunas:", JSON.stringify(cab.slice(0, 20)));
console.log("indices -> marca:", iMarca, "ativo:", iAtivo, "classe:", iClasse, "formulacao:", iForm);
if (iMarca < 0) { console.error("Nao achei a coluna da marca comercial."); process.exit(1); }

const limpar = (s) => String(s || "").replace(/^"|"$/g, "").replace(/\s+/g, " ").trim();
function categoriaDe(classe) {
  const c = (classe || "").toLowerCase();
  if (c.includes("herbicida")) return "Herbicida";
  if (c.includes("fungicida")) return "Fungicida";
  if (c.includes("inseticida") || c.includes("acaricida") || c.includes("nematicida") || c.includes("formicida") || c.includes("cupinicida")) return "Inseticida";
  if (c.includes("adjuvante") || c.includes("espalhante")) return "Adjuvante";
  if (c.includes("biol") || c.includes("microbiol") || c.includes("inoculante") || c.includes("feromonio") || c.includes("feromônio")) return "Biológico";
  if (c.includes("regulador") || c.includes("maturador")) return "Outro";
  return "Outro";
}
function unidadeDe(form) {
  const f = (form || "").toLowerCase();
  if (f.includes("granulado") || f.includes("gránulo") || f.includes("granulo") || f.includes("pó ") || f.startsWith("pó") || f.includes("(wg)") || f.includes("(wp)") || f.includes("(gr)") || f.includes("(sp)") || f.includes("(gr d")) return "kg";
  return "L";
}

const mapa = new Map();
for (let i = 1; i < linhas.length; i++) {
  if (!linhas[i]) continue;
  const cols = partir(linhas[i]);
  const marcaBruta = limpar(cols[iMarca]);
  if (!marcaBruta) continue;
  const ativoBruto = iAtivo >= 0 ? limpar(cols[iAtivo]) : "";
  // o campo do ativo costuma vir com concentracao entre parenteses — mantemos curto
  const ativo = ativoBruto.length > 90 ? ativoBruto.slice(0, 87) + "…" : ativoBruto;
  // um registro pode ter varias marcas ("Eforia; Engeo Pleno Zeon"):
  // cada marca vira um item proprio
  for (const nomeParte of marcaBruta.split(";")) {
    const nome = limpar(nomeParte);
    if (!nome || nome.length < 2 || nome.length > 80) continue;
    const chave = nome.toLowerCase();
    if (mapa.has(chave)) continue;
    mapa.set(chave, {
      n: nome,
      a: ativo || undefined,
      c: categoriaDe(iClasse >= 0 ? cols[iClasse] : ""),
      u: unidadeDe(iForm >= 0 ? cols[iForm] : ""),
    });
  }
}
const lista = [...mapa.values()].sort((a, b) => a.n.localeCompare(b.n));
fs.writeFileSync(saida, JSON.stringify(lista), "utf8");
console.log("insumos-agrofit.json gravado:", lista.length, "produtos,", Math.round(fs.statSync(saida).size / 1024), "KB");
