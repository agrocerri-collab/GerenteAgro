// Fazenda Espora (Milton Lucio Batista Junior, Lagoa do Tocantins/TO) — cadastro + fertilidade do solo no AgroCR.
// Pedido do Daniel (30/09/2026): "não está lançada ainda, pode colocar lá no AgroCR; só considerar onde tem resultado".
// Fontes (Downloads): ILOEP_PONTOS_2026.kml (174 pontos), ILOEP_GRID_2026.kml (176 quadrículas), e os laudos do
// Laboratório Hoff Brait: Relatorio_SBAH26.63357_a_SBAH26.63508 (152 amostras) e Relatorio_SBAH26.73846 (ponto 118).
//  • Talhões: os 5 blocos contínuos formados pelas quadrículas ("Área 1…5") — o grid não traz nome de talhão.
//  • Pontos de coleta: só os que têm resultado; roxo (0–20 + 20–40) onde o laudo trouxe as duas profundidades.
//  • Análises: por ponto, 0–20 e 20–40 separadas por talhão; pH = CaCl₂; tudo em mmolc/dm³ (o avulso veio em cmolc → ×10);
//    argila/silte/areia em % (o laudo traz g/dm³ → ÷10). Extras guardados: pH água, pH SMP, C.O., Na, K mg/dm³ e relações.
//  • Leitura do PDF: `pdftotext -raw` (linhas inteiras por amostra), conferida por SB = Ca+Mg+K, T = SB+H+Al, V = SB/T.
// Ids fixos ("espora-…"): rodar de novo sobrescreve, não duplica.
// Uso:  node importar-espora-solo.js             → confere e mostra o que gravaria (e grava espora-local.json no scratchpad)
//       node importar-espora-solo.js --executar  → grava no agrocr-campo
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const EXECUTAR = process.argv.includes("--executar");
const DL = "C:/Users/DANIEL CERRI/Downloads/";
const PDFS = [DL + "Mobile Devices/Relatorio_SBAH26.63357_a_SBAH26.63508_MILTONLUCIOBATISTAJUNIOR_ESPORA-LAGOADOTOCANTINS_TO-MILTONLUCIOBATISTAJUNIOR_.pdf", DL + "Mobile Devices/Relatorio_SBAH26.73846_MILTONLUCIOBATISTAJUNIOR_ESPORA-LAGOADOTOCANTINS_TO-MILTONLUCIOBATISTAJUNIOR_.pdf"];
const FAZ = "espora-iloep", PROJ = "agrocr-campo";
const saida = process.env.ESPORA_SAIDA || path.join(require("os").tmpdir(), "espora-local.json");

// ---------- 1) laudos ----------
const n = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));
const amostras = {};   // "ponto|prof" → {ponto, prof, linhas:[[..]], cmolc}
for (const pdf of PDFS) {
  const txt = execFileSync("pdftotext", ["-raw", "-enc", "UTF-8", pdf, "-"], { encoding: "utf8", maxBuffer: 64e6 });
  let unidadeCarga = null;
  for (const linha of txt.split(/\r?\n/)) {
    const u = linha.match(/^Un\s+(cmolc|mmolc)\/dm/); if (u) unidadeCarga = u[1];
    const m = linha.match(/^(SBAH26\.\d+)\s+PONTO\s+(\d+)\s+(\d+-\d+)\s+(.+)$/); if (!m) continue;
    const k = `${Number(m[2])}|${m[3]}`;
    const a = amostras[k] || (amostras[k] = { amostra: m[1], ponto: Number(m[2]), prof: m[3], linhas: [], cmolc: false, pdf: path.basename(pdf) });
    if (a.linhas.length === 0 && unidadeCarga === "cmolc") a.cmolc = true;
    a.linhas.push(m[4].trim().split(/\s+/).map(n));
  }
}
const lista = Object.values(amostras);
const erros = [];
for (const a of lista) {
  const L = a.linhas;
  if (L.length !== 5 || L.slice(0, 4).some((l) => l.length !== 8) || L[4].length !== 4 || L.flat().some((v) => !isFinite(v))) { erros.push(`ponto ${a.ponto} ${a.prof}: tabela incompleta (${L.map((l) => l.length).join("/")})`); continue; }
  const f = a.cmolc ? 10 : 1;   // tudo para mmolc/dm³
  const [phCa, phAgua, phSmp, caMgSoma, ca, mg, al, hAl] = L[0], [k, kMg, pMeh, pRes, s, mo, co, b] = L[1], [cu, fe, mn, zn, na, argila, silte, areia] = L[2], [T, V, m, caCtc, mgCtc, kCtc, hAlCtc, caMg] = L[3], [caK, mgK, caMgK, sb] = L[4];
  const r2 = (x) => Math.round(x * 100) / 100;
  a.valores = { ph: phCa, mo, pRes, pMeh, k: r2(k * f), ca: r2(ca * f), mg: r2(mg * f), al: r2(al * f), hAl: r2(hAl * f), sb: r2(sb * f), ctc: r2(T * f), v: V, m, s, b, cu, fe, mn, zn, argila: r2(argila / 10), silte: r2(silte / 10), areia: r2(areia / 10) };
  a.extras = { phAgua, phSmp, co, na, kMgDm3: kMg, caMg, caK, mgK, caCtc, mgCtc, kCtc, hAlCtc };
  // conferência: SB = Ca+Mg+K; T = SB + H+Al; V = SB/T
  const v = a.valores, sbCalc = v.ca + v.mg + v.k, tCalc = v.sb + v.hAl, vCalc = v.ctc > 0 ? (v.sb / v.ctc) * 100 : 0;
  if (Math.abs(sbCalc - v.sb) > Math.max(0.6, v.sb * 0.03)) erros.push(`ponto ${a.ponto} ${a.prof}: SB ${v.sb} ≠ Ca+Mg+K ${r2(sbCalc)}`);
  if (Math.abs(tCalc - v.ctc) > Math.max(0.6, v.ctc * 0.03)) erros.push(`ponto ${a.ponto} ${a.prof}: T ${v.ctc} ≠ SB+H+Al ${r2(tCalc)}`);
  if (Math.abs(vCalc - v.v) > 1.5) erros.push(`ponto ${a.ponto} ${a.prof}: V ${v.v} ≠ SB/T ${r2(vCalc)}`);
  if (!(v.ph > 3 && v.ph < 8.5)) erros.push(`ponto ${a.ponto} ${a.prof}: pH ${v.ph} fora do razoável`);
  if (Math.abs(v.argila + v.silte + v.areia - 100) > 1.5) erros.push(`ponto ${a.ponto} ${a.prof}: textura soma ${r2(v.argila + v.silte + v.areia)}%`);
}
console.log(`Laudos: ${lista.length} amostras (${lista.filter((a) => a.prof === "0-20").length} em 0-20, ${lista.filter((a) => a.prof === "20-40").length} em 20-40), ${lista.filter((a) => a.cmolc).length} em cmolc convertida(s). Conferências com erro: ${erros.length}`);
if (erros.length) { console.log(erros.slice(0, 20).join("\n")); console.log("PARADO: a leitura não fechou — nada será gravado."); process.exit(1); }

// ---------- 2) geometria: quadrículas → blocos ----------
const lerPlacemarks = (arq) => (fs.readFileSync(arq, "utf8").match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []);
const celulas = lerPlacemarks(DL + "ILOEP_GRID_2026.kml").map((b) => (b.match(/<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/)[1].trim().split(/\s+/).map((s) => s.split(",").map(Number)).filter((p) => isFinite(p[0]) && isFinite(p[1])).map((p) => [p[0], p[1]])));
const pontosKml = lerPlacemarks(DL + "ILOEP_PONTOS_2026.kml").map((b) => { const c = b.match(/<coordinates>([^<]+)/)[1].trim().split(",").map(Number); return { n: Number(b.match(/<description>(\d+)/)[1]), lng: c[0], lat: c[1] }; });
const lat0 = celulas[0][0][1], kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
const areaHa = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky); } return Math.abs(s) / 2 / 10000; };
const dentro = (x, y, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
// Douglas-Peucker em metros
function simplificar(pts, tol) {
  if (pts.length <= 4) return pts.slice();
  const P = pts.map((p) => [p[0] * kx, p[1] * ky]), manter = new Array(pts.length).fill(false); manter[0] = manter[pts.length - 1] = true;
  const pilha = [[0, pts.length - 1]];
  while (pilha.length) { const [a, b] = pilha.pop(); let dm = 0, im = -1; const [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (P[i][0] - ax) - dx * (P[i][1] - ay)) / L; if (d > dm) { dm = d; im = i; } }
    if (dm > tol && im > 0) { manter[im] = true; pilha.push([a, im], [im, b]); } }
  return pts.filter((_, i) => manter[i]);
}
const arred = (pts) => pts.map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);
// "só considerar onde tem resultado": entram as quadrículas cujo ponto tem laudo (a quadrícula sem ponto
// segue o ponto mais próximo do seu centro)
const comResultado = new Set(lista.map((a) => a.ponto));
const centro = (c) => [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
const pontoDaCelula = (c) => { const d = pontosKml.filter((q) => dentro(q.lng, q.lat, c)); if (d.length) return d; const [cx, cy] = centro(c); return [pontosKml.slice().sort((a, b) => Math.hypot((a.lng - cx) * kx, (a.lat - cy) * ky) - Math.hypot((b.lng - cx) * kx, (b.lat - cy) * ky))[0]]; };
const celulasUsadas = celulas.filter((c) => pontoDaCelula(c).some((q) => comResultado.has(q.n)));
// contorno da união: arestas que aparecem uma vez só
const R = (v) => v.toFixed(6), cont = new Map();
for (const p of celulasUsadas) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], ka = R(a[0]) + "," + R(a[1]), kb = R(b[0]) + "," + R(b[1]); if (ka === kb) continue; const k = ka < kb ? ka + "|" + kb : kb + "|" + ka; cont.set(k, (cont.get(k) || 0) + 1); }
const adj = new Map(); for (const [k, q] of cont) { if (q !== 1) continue; const [a, b] = k.split("|"); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
const vis = new Set(), aneis = [];
for (const ini of adj.keys()) { if (vis.has(ini)) continue; const anel = [ini]; vis.add(ini); let at = ini, ant = null; for (;;) { const prox = (adj.get(at) || []).find((x) => x !== ant && !vis.has(x)); if (!prox) break; anel.push(prox); vis.add(prox); ant = at; at = prox; } aneis.push(anel.map((k) => k.split(",").map(Number))); }
// anel dentro de outro maior = buraco (área não amostrada no meio do bloco); o resto são os blocos
const grandes = aneis.filter((a) => areaHa(a) >= 1).sort((a, b) => areaHa(b) - areaHa(a));
const externos = [], buracos = [];
for (const a of grandes) { const pai = externos.find((e) => dentro(a[0][0], a[0][1], e)); if (pai) buracos.push({ pai, anel: a }); else externos.push(a); }
const blocos = externos.map((anel) => ({ anel, buracos: buracos.filter((b) => b.pai === anel).map((b) => b.anel), pontos: pontosKml.filter((p) => comResultado.has(p.n) && dentro(p.lng, p.lat, anel)) }));
const semBloco = pontosKml.filter((p) => comResultado.has(p.n) && !blocos.some((b) => b.pontos.includes(p)));
if (semBloco.length) { console.log("pontos com resultado fora dos blocos:", semBloco.map((p) => p.n).join(",")); process.exit(1); }
// só blocos com resultado; nome pela ordem do menor número de ponto
const usados = blocos.filter((b) => b.pontos.some((p) => comResultado.has(p.n))).sort((a, b) => Math.min(...a.pontos.map((p) => p.n)) - Math.min(...b.pontos.map((p) => p.n)));
const talhoes = usados.map((b, i) => ({ id: `espora-t${i + 1}`, nome: `Área ${i + 1}`, areaHa: Math.round((areaHa(b.anel) - b.buracos.reduce((s, h) => s + areaHa(h), 0)) * 100) / 100, cultura: "" }));
console.log(`Geometria: ${celulas.length} quadrículas (${celulasUsadas.length} com resultado), ${blocos.length} blocos contínuos amostrados, ${buracos.length} buraco(s):`);
usados.forEach((b, i) => { const ns = b.pontos.map((p) => p.n).sort((x, y) => x - y), com = ns.filter((x) => comResultado.has(x)); console.log(`  ${talhoes[i].nome}: ${talhoes[i].areaHa} ha · pontos ${ns[0]}–${ns[ns.length - 1]} (${ns.length}) · com resultado ${com.length} · contorno ${b.anel.length} → ${simplificar(b.anel, 6).length} vértices${b.buracos.length ? ` · ${b.buracos.length} buraco(s)` : ""}`); });

// ---------- 3) documentos ----------
const agora = new Date().toISOString(), quem = "Daniel Cerri", DATA = "2026-05-15";
const UNIDADES = { ph: "CaCl₂", mo: "g/dm³", pRes: "mg/dm³", pMeh: "mg/dm³", k: "mmolc/dm³", ca: "mmolc/dm³", mg: "mmolc/dm³", al: "mmolc/dm³", hAl: "mmolc/dm³", sb: "mmolc/dm³", ctc: "mmolc/dm³", v: "%", m: "%", s: "mg/dm³", b: "mg/dm³", cu: "mg/dm³", fe: "mg/dm³", mn: "mg/dm³", zn: "mg/dm³", argila: "%", silte: "%", areia: "%" };
const media = (objs) => { const s = {}, c = {}; for (const o of objs) for (const [k, v] of Object.entries(o)) if (isFinite(v)) { s[k] = (s[k] || 0) + v; c[k] = (c[k] || 0) + 1; } const m = {}; for (const k of Object.keys(s)) m[k] = Math.round((s[k] / c[k]) * 100) / 100; return m; };
const faixa = (pts, k) => { const v = pts.map((p) => p.valores[k]).filter(isFinite); return `${Math.min(...v).toLocaleString("pt-BR")}–${Math.max(...v).toLocaleString("pt-BR")}`; };
const docs = [];   // {caminho (relativo à fazenda), dados}
const poligonos = [], gridCelulas = [];
usados.forEach((b, i) => {
  const t = talhoes[i], anelS = arred(simplificar(b.anel, 6));
  poligonos.push({ nome: t.nome, talhaoId: t.id, aneis: [anelS, ...b.buracos.map((h) => arred(simplificar(h, 6)))], areaHa: t.areaHa });
  const pts = b.pontos.filter((p) => comResultado.has(p.n)).sort((x, y) => x.n - y.n);
  docs.push({ caminho: `solo/espora-coleta-${t.id}`, dados: { tipo: "coleta", talhaoId: t.id, data: "2026-05-10T12:00:00.000Z", atualizadoEm: agora, origem: "kml", arquivo: "ILOEP_PONTOS_2026.kml", gridHa: null, gridHa2040: null, fixado: true, fixadoEm: agora, quem, safra: null,
    pontos: pts.map((p) => ({ n: p.n, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)), rotulo: `ILOEP_${String(p.n).padStart(2, "0")}`, origem: "kml", profundo: !!amostras[`${p.n}|20-40`] })) } });
  for (const prof of ["0-20", "20-40"]) {
    const ap = pts.map((p) => ({ p, a: amostras[`${p.n}|${prof}`] })).filter((x) => x.a);
    if (!ap.length) continue;
    const pontos = ap.map(({ p, a }) => ({ n: p.n, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)), amostra: a.amostra, valores: a.valores, extras: a.extras }));
    const v = media(pontos.map((p) => p.valores)), ex = media(pontos.map((p) => p.extras));
    const alertas = [];
    if (v.v < 50) alertas.push(`V% médio ${v.v.toLocaleString("pt-BR")} — abaixo de 50 (variação ${faixa(pontos, "v")} entre os pontos)`);
    if (v.k < 1.5) alertas.push(`Potássio baixo: média ${v.k.toLocaleString("pt-BR")} mmolc/dm³`);
    if (v.m > 20) alertas.push(`Saturação por alumínio média ${v.m.toLocaleString("pt-BR")}%`);
    if (v.mg < 5) alertas.push(`Magnésio baixo: média ${v.mg.toLocaleString("pt-BR")} mmolc/dm³`);
    if (v.ca < 15) alertas.push(`Cálcio baixo: média ${v.ca.toLocaleString("pt-BR")} mmolc/dm³`);
    const resumo = `Média de ${pontos.length} ponto${pontos.length > 1 ? "s" : ""} (${prof.replace("-", "–")} cm), laudo do laboratório. pH CaCl₂ ${v.ph.toLocaleString("pt-BR")} (${faixa(pontos, "ph")}); V% ${v.v.toLocaleString("pt-BR")} (${faixa(pontos, "v")}); CTC ${v.ctc.toLocaleString("pt-BR")} mmolc/dm³; M.O. ${v.mo.toLocaleString("pt-BR")} g/dm³; P Mehlich ${v.pMeh.toLocaleString("pt-BR")} e P resina ${v.pRes.toLocaleString("pt-BR")} mg/dm³; K ${v.k.toLocaleString("pt-BR")}, Ca ${v.ca.toLocaleString("pt-BR")}, Mg ${v.mg.toLocaleString("pt-BR")} mmolc/dm³; argila ${v.argila.toLocaleString("pt-BR")}% (solo ${v.argila < 15 ? "arenoso" : v.argila < 35 ? "de textura média" : "argiloso"}).`;
    docs.push({ caminho: `solo/espora-2026-${prof.replace("-", "")}-${t.id}`, dados: { tipo: "analise", talhaoId: t.id, data: DATA, laboratorio: "Laboratório Hoff Brait (Exata Brasil) — LEM/BA", profundidade: prof, valores: v, extras: ex, unidades: UNIDADES, pontos, resumo, alertas, fonte: "Relatórios de Ensaio 9077.2026 e 9937.2026 (PDF)", quem, lidoPor: "importação do laudo (PDF)", nAmostras: pontos.length, safra: null } });
  }
  // quadrículas do bloco com ponto e resultado (para o mapa por célula)
  for (const c of celulasUsadas) { if (!dentro(centro(c)[0], centro(c)[1], b.anel)) continue; const p = pontoDaCelula(c).find((q) => comResultado.has(q.n)); if (p) gridCelulas.push({ n: p.n, talhaoId: t.id, areaHa: Math.round(areaHa(c) * 100) / 100, anel: arred(simplificar(c, 4)) }); }
});
const kml = { poligonos, pontosAntes: usados.reduce((s, b) => s + b.anel.length, 0), pontosDepois: poligonos.reduce((s, p) => s + p.aneis[0].length, 0), tolerancia: 6 };
// cada célula vira um item com o anel como TEXTO (o Firestore não aceita lista dentro de lista)
const gridSolo = { origem: "ILOEP_GRID_2026.kml", celulas: gridCelulas };
const fazenda = { nome: "Fazenda Espora", produtor: "Milton Lucio Batista Junior", municipio: "Lagoa do Tocantins - TO", talhoes, pluviometros: [], grupoId: null };
console.log(`Documentos: fazenda (${talhoes.length} talhões, ${talhoes.reduce((s, t) => s + t.areaHa, 0).toFixed(1)} ha) + mapa (${kml.pontosDepois} vértices) + ${docs.filter((d) => d.dados.tipo === "coleta").length} coletas (${docs.filter((d) => d.dados.tipo === "coleta").reduce((s, d) => s + d.dados.pontos.length, 0)} pontos, ${docs.filter((d) => d.dados.tipo === "coleta").reduce((s, d) => s + d.dados.pontos.filter((p) => p.profundo).length, 0)} com 20–40) + ${docs.filter((d) => d.dados.tipo === "analise").length} análises + ${gridCelulas.length} quadrículas (${JSON.stringify(gridSolo).length} bytes)`);
for (const d of docs.filter((x) => x.dados.tipo === "analise")) console.log(`  ${d.caminho}: ${d.dados.nAmostras} pontos · pH ${d.dados.valores.ph} · V% ${d.dados.valores.v} · K ${d.dados.valores.k} · argila ${d.dados.valores.argila}%${d.dados.alertas.length ? " · ⚠ " + d.dados.alertas.length : ""}`);
fs.writeFileSync(saida, JSON.stringify({ fazenda: { id: FAZ, ...fazenda }, kml, solo: docs.map((d) => ({ id: d.caminho.split("/")[1], ...d.dados })), gridSolo }));
console.log("cópia para teste local:", saida);
if (!EXECUTAR) { console.log("SIMULAÇÃO — nada gravado. Rode com --executar para gravar no AgroCR."); process.exit(0); }

// ---------- 4) grava ----------
(async () => {
  const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
  const tk = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + tk.access_token, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
  const para = (x) => { if (x === null || x === undefined) return { nullValue: null }; if (typeof x === "boolean") return { booleanValue: x }; if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }; if (typeof x === "string") return { stringValue: x }; if (Array.isArray(x)) return { arrayValue: { values: x.map(para) } }; return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, para(v)])) } }; };
  const put = async (caminho, obj) => { const r = await (await fetch(`${base}/${caminho}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: para(obj).mapValue.fields }) })).json(); if (r.error) throw new Error(caminho + ": " + r.error.message); };
  // mantém o código de acesso se a fazenda já existir
  const ja = await (await fetch(`${base}/fazendas/${FAZ}`, { headers: H })).json();
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let cod = ""; for (let i = 0; i < 6; i++) cod += letras[Math.floor(Math.random() * letras.length)];
  const codigo = ja.fields && ja.fields.codigo ? ja.fields.codigo.stringValue : cod;
  await put(`fazendas/${FAZ}`, { ...fazenda, codigo });
  await put(`fazendas/${FAZ}/arquivos/kml`, { valor: JSON.stringify(kml), formato: "json" });
  await put(`fazendas/${FAZ}/arquivos/gridSolo`, { valor: JSON.stringify(gridSolo), formato: "json" });
  for (const d of docs) await put(`fazendas/${FAZ}/${d.caminho}`, d.dados);
  console.log(`OK: Fazenda Espora gravada no AgroCR (fazendas/${FAZ}, código ${codigo}) — ${docs.length} documentos de solo, mapa e quadrículas.`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
