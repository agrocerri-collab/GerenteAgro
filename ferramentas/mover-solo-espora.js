// A Fazenda Espora JÁ existia no AgroCR (mt978yshki8hz, criada em 25/08/2026) e o Daniel cadastrou nela os talhões
// 01–05 e o mapa em 30/09/2026. Eu tinha criado uma segunda "Fazenda Espora" (espora-iloep) com o solo — duplicada.
// Este script põe os pontos e as análises na fazenda DELE, nos talhões DELE (cada ponto no polígono em que cai),
// e apaga a duplicada (que só tinha o que eu mesmo gravei). Não mexe nos talhões nem no mapa dele.
// Usa a leitura já conferida dos laudos (espora-local.json, gerado por importar-espora-solo.js).
// Uso:  node mover-solo-espora.js <espora-local.json> <espora-daniel-kml.json>             → mostra o que faria
//       node mover-solo-espora.js <espora-local.json> <espora-daniel-kml.json> --executar  → grava e apaga a duplicada
const fs = require("fs");
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const EXECUTAR = process.argv.includes("--executar");
const local = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), alvo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const DESTINO = "mt978yshki8hz", DUPLICADA = "espora-iloep", PROJ = "agrocr-campo";
const dentro = (x, y, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
const talhaoDe = (lng, lat) => { const p = alvo.kml.poligonos.find((g) => g.talhaoId && dentro(lng, lat, g.aneis[0])); return p ? p.talhaoId : null; };
const nomeT = (id) => (alvo.talhoes.find((t) => t.id === id) || {}).nome || id;

// pontos de coleta e resultados por ponto, já conferidos
const pontosColeta = local.solo.filter((d) => d.tipo === "coleta").flatMap((d) => d.pontos);
const resultados = {};   // prof → [{n, lat, lng, amostra, valores, extras}]
for (const d of local.solo.filter((x) => x.tipo === "analise")) (resultados[d.profundidade] = resultados[d.profundidade] || []).push(...d.pontos);
const modelo = local.solo.find((x) => x.tipo === "analise");
const media = (objs) => { const s = {}, c = {}; for (const o of objs) for (const [k, v] of Object.entries(o)) if (isFinite(v)) { s[k] = (s[k] || 0) + v; c[k] = (c[k] || 0) + 1; } const m = {}; for (const k of Object.keys(s)) m[k] = Math.round((s[k] / c[k]) * 100) / 100; return m; };
const faixa = (pts, k) => { const v = pts.map((p) => p.valores[k]).filter(isFinite); return `${Math.min(...v).toLocaleString("pt-BR")}–${Math.max(...v).toLocaleString("pt-BR")}`; };
const br = (x) => x.toLocaleString("pt-BR");
const agora = new Date().toISOString(), quem = "Daniel Cerri";
const docs = [];
const porTalhao = {};
for (const p of pontosColeta) { const tid = talhaoDe(p.lng, p.lat); if (!tid) { console.log("ponto sem talhão:", p.n); process.exit(1); } (porTalhao[tid] = porTalhao[tid] || []).push(p); }
for (const tid of Object.keys(porTalhao)) {
  const pts = porTalhao[tid].sort((a, b) => a.n - b.n);
  docs.push({ id: `espora-coleta-${tid}`, dados: { tipo: "coleta", talhaoId: tid, data: "2026-05-10T12:00:00.000Z", atualizadoEm: agora, origem: "kml", arquivo: "ILOEP_PONTOS_2026.kml", gridHa: null, gridHa2040: null, fixado: true, fixadoEm: agora, quem, safra: null, pontos: pts } });
  for (const prof of ["0-20", "20-40"]) {
    const pontos = (resultados[prof] || []).filter((r) => pts.some((p) => p.n === r.n)).sort((a, b) => a.n - b.n);
    if (!pontos.length) continue;
    const v = media(pontos.map((p) => p.valores)), ex = media(pontos.map((p) => p.extras));
    const alertas = [];
    if (v.v < 50) alertas.push(`V% médio ${br(v.v)} — abaixo de 50 (variação ${faixa(pontos, "v")} entre os pontos)`);
    if (v.k < 1.5) alertas.push(`Potássio baixo: média ${br(v.k)} mmolc/dm³`);
    if (v.m > 20) alertas.push(`Saturação por alumínio média ${br(v.m)}%`);
    if (v.mg < 5) alertas.push(`Magnésio baixo: média ${br(v.mg)} mmolc/dm³`);
    if (v.ca < 15) alertas.push(`Cálcio baixo: média ${br(v.ca)} mmolc/dm³`);
    const resumo = `Média de ${pontos.length} ponto${pontos.length > 1 ? "s" : ""} (${prof.replace("-", "–")} cm), laudo do laboratório. pH CaCl₂ ${br(v.ph)} (${faixa(pontos, "ph")}); V% ${br(v.v)} (${faixa(pontos, "v")}); CTC ${br(v.ctc)} mmolc/dm³; M.O. ${br(v.mo)} g/dm³; P Mehlich ${br(v.pMeh)} e P resina ${br(v.pRes)} mg/dm³; K ${br(v.k)}, Ca ${br(v.ca)}, Mg ${br(v.mg)} mmolc/dm³; argila ${br(v.argila)}% (solo ${v.argila < 15 ? "arenoso" : v.argila < 35 ? "de textura média" : "argiloso"}).`;
    docs.push({ id: `espora-2026-${prof.replace("-", "")}-${tid}`, dados: { tipo: "analise", talhaoId: tid, data: modelo.data, laboratorio: modelo.laboratorio, profundidade: prof, valores: v, extras: ex, unidades: modelo.unidades, pontos, resumo, alertas, fonte: modelo.fonte, quem, lidoPor: modelo.lidoPor, nAmostras: pontos.length, safra: null } });
  }
}
const gridSolo = { origem: local.gridSolo.origem, celulas: local.gridSolo.celulas.map((c) => { const p = pontosColeta.find((q) => q.n === c.n); return { ...c, talhaoId: p ? talhaoDe(p.lng, p.lat) : null }; }) };
console.log(`Destino: fazendas/${DESTINO} (a do Daniel). ${docs.length} documentos de solo + quadrículas (${gridSolo.celulas.length}):`);
for (const d of docs) console.log(`  ${d.id}: talhão ${nomeT(d.dados.talhaoId)} · ${d.dados.tipo}${d.dados.tipo === "analise" ? ` ${d.dados.profundidade} · ${d.dados.nAmostras} pontos · pH ${d.dados.valores.ph} · V% ${d.dados.valores.v} · K ${d.dados.valores.k}` : ` · ${d.dados.pontos.length} pontos (${d.dados.pontos.filter((p) => p.profundo).length} com 20–40)`}`);
console.log(`Depois: apagar a duplicada fazendas/${DUPLICADA} (fazenda + solo + arquivos que eu gravei).`);
if (!EXECUTAR) { console.log("SIMULAÇÃO — nada gravado."); process.exit(0); }

(async () => {
  const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
  const tk = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + tk.access_token, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
  const para = (x) => { if (x === null || x === undefined) return { nullValue: null }; if (typeof x === "boolean") return { booleanValue: x }; if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }; if (typeof x === "string") return { stringValue: x }; if (Array.isArray(x)) return { arrayValue: { values: x.map(para) } }; return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, para(v)])) } }; };
  const put = async (caminho, obj) => { const r = await (await fetch(`${base}/${caminho}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: para(obj).mapValue.fields }) })).json(); if (r.error) throw new Error(caminho + ": " + r.error.message); };
  for (const d of docs) await put(`fazendas/${DESTINO}/solo/${d.id}`, d.dados);
  await put(`fazendas/${DESTINO}/arquivos/gridSolo`, { valor: JSON.stringify(gridSolo), formato: "json" });
  console.log("OK: solo gravado na fazenda do Daniel.");
  // apaga a duplicada — só depois de gravar no destino
  const lista = async (col) => { const r = await (await fetch(`${base}/${col}?pageSize=300`, { headers: H })).json(); return r.documents || []; };
  let n = 0;
  for (const s of ["solo", "arquivos", "historico"]) for (const d of await lista(`fazendas/${DUPLICADA}/${s}`)) { const r = await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: "DELETE", headers: H }); if (r.ok) n++; }
  const r = await fetch(`${base}/fazendas/${DUPLICADA}`, { method: "DELETE", headers: H });
  console.log(`OK: duplicada apagada (${n} documentos + fazenda ${r.ok ? "ok" : "FALHOU " + r.status}).`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
