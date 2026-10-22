// Fazenda de DEMONSTRAÇÃO com pivôs no GerenteAgro (conta administrativo) — pedido do Daniel, 17/09/2026.
// 4 pivôs (mapa real de pivôs), safra 2025/2026 completa:
//  • SOJA (safra): compras, dessecação → colheita, chuvas, colheita com romaneio, vendas, custos
//  • FEIJÃO MUNGO PRETO (safrinha irrigada): plantio 10/07/2026, emergência 15/07, operações até hoje
//    (uma fungicida ainda pendente), energia do pivô, venda travada
//  • CHUVA: um pluviômetro no centro de cada pivô; julho 70 mm, agosto 100 mm, setembro até 17 = 80 mm
//  • FERTILIDADE: pontos em grid de 30 ha por pivô, análise 2025 (0-20) e 2026 por ponto (0-20 e 20-40)
//  • MÁQUINAS, DIESEL, ALMOXARIFADO (com peças do pivô) e VISITAS TÉCNICAS
// Ids fixos ("dp-…"): rodar de novo sobrescreve a mesma fazenda, não duplica. Não mexe na Fazenda Modelo.
// Uso: node criar-demonstracao-pivos.js [--executar]
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const fs = require("fs");
const EXECUTAR = process.argv.includes("--executar");
const PROJ = "gerenteagro", CONTA = "AEChKtFa9rVa7VwTRAGw2KvumO53", FID = "dp-fazenda-pivos";
const BASE = `projects/${PROJ}/databases/(default)/documents`;
const PIVOS_ARQ = process.argv.find((a) => a.endsWith(".json")) || "pivos-talisma.json";
const S = "2025/2026", HOJE = "2026-09-17", GRID_HA = 30;
const quem = "Zé Operador (demonstração)", agr = "Agrônomo (demonstração)";

// ---------- utilidades ----------
const para = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "string") return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(para) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, para(v)])) } };
};
let semente = 17092026;
const aleat = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const ruido = (a) => (aleat() * 2 - 1) * a;
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, r0 = (v) => Math.round(v);
function escalasLocais(latGraus) { const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), rad = Math.PI / 180; const s = Math.sin(latGraus * rad), den = 1 - e2 * s * s; return { kx: (a / Math.sqrt(den)) * Math.cos(latGraus * rad) * rad, ky: (a * (1 - e2) / Math.pow(den, 1.5)) * rad }; }
function areaHa(anel) { const lat = anel.reduce((s, p) => s + p[1], 0) / anel.length; const { kx, ky } = escalasLocais(lat); let s = 0; for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) s += (anel[j][0] * kx + anel[i][0] * kx) * (anel[j][1] * ky - anel[i][1] * ky); return Math.abs(s / 2) / 10000; }
function pontoNoAnel(lon, lat, anel) { let d = false; for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) { const [xi, yi] = anel[i], [xj, yj] = anel[j]; if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) d = !d; } return d; }
function distribuirPontos(anel, n) {
  const lats = anel.map((p) => p[1]), lngs = anel.map((p) => p[0]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const { kx, ky } = escalasLocais((minLat + maxLat) / 2); const W = (maxLng - minLng) * kx, H = (maxLat - minLat) * ky;
  let passo = Math.sqrt((W * H) / n);
  for (let t = 0; t < 40; t++) {
    const linhas = []; let fila = 0;
    for (let y = passo / 2; y < H; y += passo, fila++) { const l = []; for (let x = passo / 2; x < W; x += passo) { const lng = minLng + x / kx, lat = minLat + y / ky; if (pontoNoAnel(lng, lat, anel)) l.push({ lat, lng }); } linhas.push(fila % 2 ? l.reverse() : l); }
    const dentro = linhas.flat();
    if (dentro.length >= n) { const sel = []; for (let i = 0; i < n; i++) sel.push(dentro[Math.floor((i * dentro.length) / n)]); return sel.map((p, i) => ({ n: i + 1, lat: Number(p.lat.toFixed(7)), lng: Number(p.lng.toFixed(7)), origem: "grade" })); }
    passo *= 0.85;
  }
  return [];
}
const somarDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- solo ----------
const UNID = { ph: "CaCl2", mo: "g/dm³", pRes: "mg/dm³", pMeh: "mg/dm³", k: "mmolc/dm³", ca: "mmolc/dm³", mg: "mmolc/dm³", al: "mmolc/dm³", hAl: "mmolc/dm³", sb: "mmolc/dm³", ctc: "mmolc/dm³", v: "%", m: "%", s: "mg/dm³", b: "mg/dm³", cu: "mg/dm³", fe: "mg/dm³", mn: "mg/dm³", zn: "mg/dm³", argila: "%", silte: "%", areia: "%" };
function amostra(f, prof, argila) {
  const sub = prof === "20-40";
  const ph = 4.4 + f * 1.3 - (sub ? 0.35 : 0) + ruido(0.1), mo = (sub ? 12 : 18) + f * (sub ? 6 : 12) + argila * 0.08 + ruido(1.5);
  const pRes = Math.max(2, (sub ? 4 : 8) + f * (sub ? 10 : 30) + ruido(3)), pMeh = Math.max(1, pRes * (0.45 + argila * 0.002) + ruido(1.2));
  const k = Math.max(0.4, (sub ? 0.6 : 0.9) + f * (sub ? 1.2 : 2.6) + ruido(0.25)), ca = Math.max(3, (sub ? 5 : 8) + f * (sub ? 12 : 26) + ruido(2)), mg = Math.max(1, (sub ? 2 : 3) + f * (sub ? 5 : 10) + ruido(0.8));
  const al = Math.max(0, (sub ? 7 : 5) - f * (sub ? 6 : 5.2) + ruido(0.6)), hAl = Math.max(12, 58 - f * 30 + argila * 0.25 + (sub ? 6 : 0) + ruido(3));
  const sb = k + ca + mg, ctc = sb + hAl;
  return { ph: r1(ph), mo: r1(mo), pRes: r1(pRes), pMeh: r1(pMeh), k: r2(k), ca: r1(ca), mg: r1(mg), al: r1(al), hAl: r1(hAl), sb: r1(sb), ctc: r1(ctc), v: r0((sb / ctc) * 100), m: r0((al / (sb + al || 1)) * 100),
    s: r1(Math.max(2, (sub ? 9 : 6) + f * 6 + ruido(1.5))), b: r2(Math.max(0.1, 0.18 + f * 0.35 - (sub ? 0.08 : 0) + ruido(0.05))), cu: r2(Math.max(0.2, 0.5 + f * 1.1 + ruido(0.15))), fe: r0(Math.max(8, 55 - f * 20 + ruido(6))),
    mn: r1(Math.max(1, 3 + f * 9 - (sub ? 2 : 0) + ruido(1))), zn: r2(Math.max(0.3, 0.6 + f * 2.8 - (sub ? 0.4 : 0) + ruido(0.3))), argila: r0(argila + ruido(3)), silte: r0(12 + ruido(2)), areia: r0(100 - argila - 12) };
}
const media = (pts) => { const s = {}, n = {}; for (const p of pts) for (const [k, v] of Object.entries(p.valores)) { s[k] = (s[k] || 0) + v; n[k] = (n[k] || 0) + 1; } return Object.fromEntries(Object.keys(s).map((k) => [k, r2(s[k] / n[k])])); };
const br = (v) => String(v).replace(".", ",");
function alertasDe(v) { const a = []; if (v.ph < 5) a.push(`pH baixo (${br(v.ph)})`); if (v.v < 50) a.push(`Saturação por bases baixa (${v.v}%)`); if (v.m > 20) a.push(`Alumínio alto (m ${v.m}%)`); if (v.pRes < 15) a.push(`Fósforo resina baixo (${br(v.pRes)} mg/dm³)`); if (v.k < 1.5) a.push(`Potássio baixo (${br(v.k)} mmolc/dm³)`); if (v.b < 0.3) a.push(`Boro baixo (${br(v.b)} mg/dm³)`); return a.slice(0, 4); }
function resumoDe(v, prof, pts) {
  const fx = (k) => { const vs = pts.map((p) => p.valores[k]); return `${br(Math.min(...vs))} a ${br(Math.max(...vs))}`; };
  const pede = []; if (v.v < 50 || v.m > 20) pede.push(prof === "20-40" ? "gessagem" : "calagem"); if (v.pRes < 15) pede.push("correção de fósforo"); if (v.k < 1.5) pede.push("reposição de potássio"); if (v.b < 0.3) pede.push("boro");
  return `Média de ${pts.length} pontos (grid de ${GRID_HA} ha), ${prof} cm: ${v.ph >= 5 && v.v >= 50 ? "acidez corrigida" : "solo ainda ácido"}; fósforo resina ${fx("pRes")} mg/dm³ e V% ${fx("v")}% entre os pontos. ${pede.length ? `Pede ${pede.join(", ")}.` : "Manter adubação de manutenção."} (dados de demonstração)`;
}

(async () => {
  const pivosTalisma = JSON.parse(fs.readFileSync(PIVOS_ARQ, "utf8"));
  const escolha = ["Polygon 2", "Polygon 6", "Polygon 9", "Polygon 10"];
  const T = escolha.map((nome, i) => {
    const p = pivosTalisma.find((x) => x.nome === nome); if (!p) throw new Error("pivô não achado: " + nome);
    const anel = p.aneis[0];
    return { id: `dp-t${i + 1}`, nome: `Pivô ${i + 1}`, areaHa: r2(areaHa(anel)), cultura: "Soja", culturaSafrinha: "Mungo Preto", anel };
  });
  const areaTotal = T.reduce((s, t) => s + t.areaHa, 0);
  const W = [];   // {caminho, dados}
  const add = (col, id, dados) => W.push({ caminho: `${col}/${id}`, dados: { ...dados, safra: S } });
  const addSem = (col, id, dados) => W.push({ caminho: `${col}/${id}`, dados: { ...dados, safra: null } });
  const centro = (anel) => [anel.reduce((s, p) => s + p[1], 0) / anel.length, anel.reduce((s, p) => s + p[0], 0) / anel.length];
  const pluvs = T.map((t, i) => { const [lat, lng] = centro(t.anel); return { id: `dp-p${i + 1}`, nome: `Pluviômetro ${t.nome}`, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }; });
  const todos = T.map((t) => t.id);

  // ---------- fazenda e mapa ----------
  const fazenda = {
    nome: "Fazenda Pivôs (demonstração)", produtor: "Grupo Exemplo (demonstração)", municipio: "Peixe/TO", conta: CONTA, criadoPor: CONTA, codigo: "PIVO26",
    safras: [S, "2026/2027"], safraAtual: S, produtividade: { [S]: 72, [S + "|Mungo Preto"]: 18 },
    talhoes: T.map(({ anel, ...t }) => t), pluviometros: pluvs,
  };
  const kml = { poligonos: T.map((t) => ({ nome: t.nome, talhaoId: t.id, areaHa: t.areaHa, aneis: [t.anel.map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))])] })) };
  W.push({ caminho: "arquivos/kml", dados: { valor: JSON.stringify(kml), formato: "json" } });

  // ---------- lavoura atual: mungo preto no pivô, depois da soja ----------
  const varSoja = ["M8210 IPRO", "BMX Bônus IPRO", "TMG 7063 IPRO", "M8210 IPRO"];
  T.forEach((t, i) => add("lavoura", `dp-lav-${i + 1}`, { talhaoId: t.id, cultura: "Mungo Preto", variedade: "Mungo preto (semente certificada)", dataPlantio: "2026-07-10", dataEmergencia: "2026-07-15", espacamento: 50, estandeFinal: 240000, culturaAnterior: "Soja", variedadeAnterior: varSoja[i], irrigado: true }));

  // ---------- compras ----------
  const A = areaTotal;
  const compras = [
    ["Glifosato 480 SL", "Herbicida", Math.round(A * 7.5), "L", 18.5, "2025-09-20"], ["2,4-D 806", "Herbicida", Math.round(A), "L", 29, "2025-09-20"],
    ["Semente Soja M8210 IPRO", "Sementes", Math.round(A * 60), "kg", 8.75, "2025-09-25"], ["Inoculante Bradyrhizobium", "Biológico", Math.round(A), "dose", 4.5, "2025-10-01"],
    ["MAP 11-52-00", "Fertilizante / Adubo", Math.round(A * 200), "kg", 3.2, "2025-09-15"], ["Cloreto de Potássio", "Fertilizante / Adubo", Math.round(A * 150), "kg", 2.4, "2025-09-15"],
    ["Fox Xpro", "Fungicida", Math.round(A * 1.5), "L", 210, "2025-10-10"], ["Óleo mineral Nimbus", "Adjuvante", Math.round(A * 6), "L", 12, "2025-10-10"],
    ["Engeo Pleno S", "Inseticida", Math.round(A * 0.5), "L", 95, "2025-10-10"], ["Diquat 200", "Herbicida", Math.round(A * 1.5), "L", 42, "2026-01-30"],
    // mungo preto irrigado (safrinha)
    ["Semente Mungo Preto certificada", "Sementes", Math.round(A * 22), "kg", 14, "2026-06-25", "Safrinha", "Mungo Preto"],
    ["MAP 11-52-00 (mungo)", "Fertilizante / Adubo", Math.round(A * 120), "kg", 3.4, "2026-06-25", "Safrinha", "Mungo Preto"],
    ["Cloreto de Potássio (mungo)", "Fertilizante / Adubo", Math.round(A * 80), "kg", 2.5, "2026-06-25", "Safrinha", "Mungo Preto"],
    ["Glifosato 480 SL (mungo)", "Herbicida", Math.round(A * 2.5), "L", 19, "2026-06-25", "Safrinha", "Mungo Preto"],
    ["Cletodim 240 EC", "Herbicida", Math.round(A * 0.45), "L", 58, "2026-07-20", "Safrinha", "Mungo Preto"],
    ["Engeo Pleno S (mungo)", "Inseticida", Math.round(A * 0.2), "L", 96, "2026-07-20", "Safrinha", "Mungo Preto"],
    ["Premio 200 SC", "Inseticida", Math.round(A * 0.1), "L", 520, "2026-07-20", "Safrinha", "Mungo Preto"],
    ["Priori Xtra", "Fungicida", Math.round(A * 0.3), "L", 160, "2026-07-20", "Safrinha", "Mungo Preto"],
    ["Fox Xpro (mungo)", "Fungicida", Math.round(A * 0.8), "L", 212, "2026-07-20", "Safrinha", "Mungo Preto"],
    ["Óleo mineral Nimbus (mungo)", "Adjuvante", Math.round(A * 2.5), "L", 12.5, "2026-07-20", "Safrinha", "Mungo Preto"],
  ];
  compras.forEach(([produto, categoria, qtd, unidade, preco, data, ciclo, cultura], i) => add("compras", `dp-c${i + 1}`, { produto, categoria, qtd, unidade, preco, ciclo: ciclo || "Safra", cultura: cultura || "Soja", data, origem: "compra", fornecedorId: "", obs: "Revenda Exemplo", pagamento: "Pagamento na safra", vencimento: ciclo === "Safrinha" ? "2026-11-30" : "2026-04-30", barter: false }));

  // ---------- recomendações + execuções ----------
  const oleo = { nome: "Óleo mineral Nimbus", dose: 0.5, unidade: "L" }, oleoM = { nome: "Óleo mineral Nimbus (mungo)", dose: 0.5, unidade: "L" };
  const pulv = (id, tipo, alvo, data, produtos, execData, ciclo) => ({ id, modulo: "pulverizacao", tipo, alvo, dataRecomendada: data, vazao: "120", bico: "TT 110-02", capacidadeTanque: "3000", produtos, talhaoIds: todos, execData, ciclo: ciclo || "Safra" });
  const recs = [
    pulv("dp-r1", "Herbicida", "Dessecação pré-plantio", "2025-10-24", [{ nome: "Glifosato 480 SL", dose: 2.5, unidade: "L" }, { nome: "2,4-D 806", dose: 1, unidade: "L" }, oleo], "2025-10-26"),
    { id: "dp-r2", modulo: "adubacao", tipo: "Adubação de base", alvo: "Fósforo e potássio", dataRecomendada: "2025-10-28", produtos: [{ nome: "MAP 11-52-00", dose: 200, unidade: "kg" }, { nome: "Cloreto de Potássio", dose: 150, unidade: "kg" }], talhaoIds: todos, execData: "2025-10-30" },
    { id: "dp-r3", modulo: "semeadura", tipo: "Semeadura", alvo: "Soja M8210 IPRO", dataRecomendada: "2025-11-03", espacamento: "50", populacao: "280000", produtos: [{ nome: "Semente Soja M8210 IPRO", dose: 60, unidade: "kg" }, { nome: "Inoculante Bradyrhizobium", dose: 1, unidade: "dose" }], talhaoIds: todos, execData: "2025-11-05" },
    pulv("dp-r4", "Herbicida", "Pós-emergente — buva e capim", "2025-11-28", [{ nome: "Glifosato 480 SL", dose: 2, unidade: "L" }, oleo], "2025-11-30"),
    pulv("dp-r5", "Fungicida", "1ª fungicida — ferrugem (preventivo)", "2025-12-14", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2025-12-16"),
    pulv("dp-r6", "Fungicida", "2ª fungicida — ferrugem", "2025-12-29", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2025-12-31"),
    pulv("dp-r7", "Inseticida", "Percevejo-marrom (2/m)", "2026-01-06", [{ nome: "Engeo Pleno S", dose: 0.25, unidade: "L" }, oleo], "2026-01-08"),
    pulv("dp-r8", "Fungicida", "3ª fungicida — ferrugem e mancha-alvo", "2026-01-13", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2026-01-15"),
    pulv("dp-r9", "Inseticida", "Percevejo-marrom (enchimento de grãos)", "2026-01-27", [{ nome: "Engeo Pleno S", dose: 0.25, unidade: "L" }, oleo], "2026-01-29"),
    pulv("dp-r10", "Herbicida", "Dessecação pré-colheita", "2026-02-18", [{ nome: "Diquat 200", dose: 1.5, unidade: "L" }, oleo], "2026-02-20"),
    // ---- mungo preto irrigado ----
    pulv("dp-m1", "Herbicida", "Dessecação antes do mungo", "2026-07-02", [{ nome: "Glifosato 480 SL (mungo)", dose: 2.5, unidade: "L" }, oleoM], "2026-07-04", "Safrinha"),
    { id: "dp-m2", modulo: "adubacao", tipo: "Adubação de base", alvo: "Fósforo e potássio (mungo)", dataRecomendada: "2026-07-07", produtos: [{ nome: "MAP 11-52-00 (mungo)", dose: 120, unidade: "kg" }, { nome: "Cloreto de Potássio (mungo)", dose: 80, unidade: "kg" }], talhaoIds: todos, execData: "2026-07-09", ciclo: "Safrinha" },
    { id: "dp-m3", modulo: "semeadura", tipo: "Semeadura", alvo: "Mungo preto irrigado", dataRecomendada: "2026-07-10", espacamento: "50", populacao: "260000", produtos: [{ nome: "Semente Mungo Preto certificada", dose: 22, unidade: "kg" }], talhaoIds: todos, execData: "2026-07-10", ciclo: "Safrinha" },
    pulv("dp-m4", "Herbicida", "Pós-emergente — capim (folha estreita)", "2026-07-30", [{ nome: "Cletodim 240 EC", dose: 0.45, unidade: "L" }, oleoM], "2026-08-01", "Safrinha"),
    pulv("dp-m5", "Inseticida", "Mosca-branca e vaquinha", "2026-08-08", [{ nome: "Engeo Pleno S (mungo)", dose: 0.2, unidade: "L" }, oleoM], "2026-08-10", "Safrinha"),
    pulv("dp-m6", "Fungicida", "1ª fungicida — oídio e cercospora", "2026-08-18", [{ nome: "Priori Xtra", dose: 0.3, unidade: "L" }, oleoM], "2026-08-20", "Safrinha"),
    pulv("dp-m7", "Inseticida", "Lagarta-das-vagens", "2026-08-28", [{ nome: "Premio 200 SC", dose: 0.1, unidade: "L" }, oleoM], "2026-08-30", "Safrinha"),
    pulv("dp-m8", "Fungicida", "2ª fungicida — oídio e mancha-angular", "2026-09-03", [{ nome: "Fox Xpro (mungo)", dose: 0.4, unidade: "L" }, oleoM], "2026-09-05", "Safrinha"),
    pulv("dp-m9", "Fungicida", "3ª fungicida — enchimento de vagens", "2026-09-19", [{ nome: "Fox Xpro (mungo)", dose: 0.4, unidade: "L" }, oleoM], null, "Safrinha"),
  ];
  for (const r of recs) {
    const { execData, ...rec } = r;
    add("recomendacoes", rec.id, { ...rec, ciclo: rec.ciclo || "Safra", observacao: rec.ciclo === "Safrinha" ? "Mungo preto irrigado no pivô (demonstração)." : "Soja safra 2025/2026 (demonstração).", recomendadoPor: agr });
    if (execData) T.forEach((t, i) => { const d = somarDias(execData, Math.floor(i / 2)); if (d <= HOJE) W.push({ caminho: `execucoes/${rec.id}__${t.id}`, dados: { data: d + "T07:30:00.000Z", operador: quem, obs: "", fotos: [], produtosReais: null, areaExecutada: null, recomendacaoId: rec.id, talhaoId: t.id, safra: S } }); });
  }

  // ---------- chuvas: soja + julho/agosto/setembro no mungo ----------
  const chSoja = [["2025-10-12", 18], ["2025-10-19", 26], ["2025-10-27", 34], ["2025-11-02", 22], ["2025-11-08", 41], ["2025-11-14", 15], ["2025-11-21", 38], ["2025-11-27", 29], ["2025-12-03", 47], ["2025-12-09", 22], ["2025-12-15", 55], ["2025-12-21", 31], ["2025-12-27", 44],
    ["2026-01-04", 62], ["2026-01-10", 28], ["2026-01-17", 39], ["2026-01-23", 71], ["2026-01-30", 25], ["2026-02-05", 48], ["2026-02-12", 33], ["2026-02-19", 12], ["2026-02-26", 27], ["2026-03-06", 19], ["2026-03-15", 9], ["2026-03-22", 31], ["2026-04-04", 26], ["2026-04-21", 14], ["2026-05-12", 6]];
  const chJul = [["2026-07-04", 8], ["2026-07-09", 12], ["2026-07-15", 10], ["2026-07-19", 15], ["2026-07-24", 9], ["2026-07-29", 16]];            // 70 mm
  const chAgo = [["2026-08-03", 12], ["2026-08-07", 18], ["2026-08-12", 9], ["2026-08-16", 15], ["2026-08-21", 11], ["2026-08-25", 20], ["2026-08-30", 15]]; // 100 mm
  const chSet = [["2026-09-02", 14], ["2026-09-05", 18], ["2026-09-08", 12], ["2026-09-11", 20], ["2026-09-14", 16]];                            // 80 mm até 17/09
  const desvio = [-0.12, 0.06, 0.12, -0.06];   // cada pivô com um pouco mais ou menos; a média fica igual
  let nch = 0;
  for (const [data, mm] of [...chSoja, ...chJul, ...chAgo, ...chSet]) pluvs.forEach((p, j) => add("chuvas", `dp-ch${++nch}`, { data, mm: r1(mm * (1 + desvio[j])), local: p.nome, pluviometroId: p.id, quem }));

  // ---------- colheita da soja (fev/mar 2026) ~72 sc/ha ----------
  addSem("colheita", "dp-cam1", { tipo: "caminhao", caminhao: "ABC-1D23", motorista: "Carlos", quem }); addSem("colheita", "dp-cam2", { tipo: "caminhao", caminhao: "DEF-2E45", motorista: "Marcos", quem });
  let colhidoKg = 0, nc = 0;
  T.forEach((t, k) => {
    const kg = t.areaHa * (72 + (k - 1.5) * 2) * 60, n = Math.max(3, Math.round(kg / 36000)), porCarga = Math.round(kg / n);
    for (let i = 0; i < n; i++) {
      const data = somarDias("2026-02-24", k * 3 + Math.floor(i / 4)), bruto = porCarga + 700, umid = 13 + ((i % 3) * 0.7), descU = Math.round(bruto * Math.max(0, umid - 14) / 86), liquido = bruto - descU - 300;
      colhidoKg += liquido;
      add("colheita", `dp-ca${++nc}`, { tipo: "carga", cultura: "Soja", talhaoId: t.id, data, caminhao: i % 2 ? "DEF-2E45" : "ABC-1D23", pesoKg: porCarga, status: "descarregado", pesoDescarga: liquido, dataBaixa: data, quemBaixa: quem, quem, pesoBrutoRom: bruto, umidadePct: r1(umid), impurezaPct: 1, descUmidadeKg: descU || null, descImpurezaKg: 300, deposito: "Cerealista Exemplo" });
    }
    add("colheita", `dp-ar${k + 1}`, { tipo: "area", cultura: "Soja", talhaoId: t.id, data: somarDias("2026-03-02", k * 3), areaHa: t.areaHa, quem });
  });
  const sacas = Math.round(colhidoKg / 60);

  // ---------- custos, vendas e barter ----------
  const custos = [
    ["Diesel out–dez (soja)", "Combustível", A * 90, "2025-12-20", "Safra"], ["Diesel jan–mar (colheita da soja)", "Combustível", A * 70, "2026-03-15", "Safra"],
    ["Folha dos operadores (soja)", "Mão de obra", A * 210, "2026-03-31", "Safra"], ["Energia do pivô (soja, complementar)", "Irrigação — energia elétrica", A * 95, "2026-02-28", "Safra"],
    ["Manutenção da colheitadeira", "Manutenção", 14500, "2026-02-18", "Safra"], ["Frete das sementes", "Frete", 3200, "2025-09-30", "Safra"], ["Arrendamento da área irrigada", "Arrendamento", A * 1450, "2026-03-31", "Ambas"], ["Operações com máquinas próprias (depreciação e hora-máquina)", "Operações com máquinas", A * 450, "2026-03-31", "Safra"], ["Assistência técnica", "Serviços / terceiros", A * 80, "2026-03-31", "Ambas"],
    ["Energia do pivô — julho", "Irrigação — energia elétrica", A * 165, "2026-07-31", "Safrinha"], ["Energia do pivô — agosto", "Irrigação — energia elétrica", A * 190, "2026-08-31", "Safrinha"],
    ["Revisão das torres e bombas dos pivôs", "Irrigação — manutenção (pivô, bombas)", 18600, "2026-06-28", "Safrinha"], ["Outorga de água (anual)", "Irrigação — água / outorga", 4200, "2026-06-15", "Ambas"],
    ["Diesel jul–set (mungo)", "Combustível", A * 38, "2026-09-10", "Safrinha"], ["Folha dos operadores (mungo)", "Mão de obra", A * 95, "2026-08-31", "Safrinha"],
  ];
  custos.forEach(([descricao, categoria, valor, data, ciclo], i) => add("custos", `dp-cu${i + 1}`, { descricao, categoria, valor: Math.round(valor), ciclo, data, talhaoId: null, quem: agr }));
  // energia de setembro ainda a pagar (aparece no Financeiro hoje)
  add("custos", "dp-cu-set", { descricao: "Energia do pivô — setembro (fatura)", categoria: "Irrigação — energia elétrica", valor: Math.round(A * 120), ciclo: "Safrinha", data: "2026-09-15", vencimento: "2026-09-22", pago: false, talhaoId: null, quem: agr });
  add("custos", "dp-v1", { ehVenda: true, cultura: "Soja", descricao: "Trade Exemplo — travamento dez/2025", sacas: Math.round(sacas * 0.4), preco: 118, moeda: "R$", ciclo: "Ambas", data: "2025-12-10", vencimento: "2026-04-15", quem: agr });
  add("custos", "dp-v2", { ehVenda: true, cultura: "Soja", descricao: "Trade Exemplo — venda na colheita", sacas: Math.round(sacas * 0.5), preco: 124, moeda: "R$", ciclo: "Ambas", data: "2026-03-10", vencimento: "2026-04-30", quem: agr });
  add("custos", "dp-v3", { ehVenda: true, cultura: "Mungo Preto", descricao: "Cerealista Exemplo — mungo preto travado", sacas: Math.round(A * 18 * 0.5), preco: 300, moeda: "R$", ciclo: "Safrinha", data: "2026-07-20", vencimento: "2026-10-30", quem: agr });
  add("custos", "dp-b1", { ehBarter: true, cultura: "Soja", descricao: "Pacote barter Revenda Exemplo", sacas: Math.round(sacas * 0.1), precoSaca: 115, moeda: "R$", ciclo: "Safra", data: "2025-09-15", quem: agr });

  // ---------- máquinas, pivôs, diesel ----------
  const maqs = [["dp-mm1", "Trator", "John Deere 6110J", "John Deere", "2021"], ["dp-mm2", "Pulverizador", "Jacto Uniport 3030", "Jacto", "2019"], ["dp-mm3", "Plantadeira", "Stara Absoluta 35", "Stara", "2020"], ["dp-mm4", "Colheitadeira", "Case IH 8250", "Case IH", "2023"], ["dp-mm5", "Caminhão", "Mercedes-Benz Atego 2426", "Mercedes-Benz", "2018"],
    ...T.map((t, i) => [`dp-piv${i + 1}`, "Outro", `${t.nome} — Valley 8000`, "Valley", "2019"])];
  maqs.forEach(([id, tipo, nome, marca, ano]) => addSem("maquinas", id, { tipo, nome, marca, ano, obs: "", terceirizada: false }));
  addSem("combustivel", "dp-tq1", { tipo: "tanque", nome: "Tanque da sede", capacidade: 15000, quem });
  [["2025-10-15", 3000, 18900, "88231"], ["2026-01-20", 2500, 16000, "90114"], ["2026-07-01", 3500, 22050, "93377"]].forEach(([data, litros, valor, nf], i) => addSem("combustivel", `dp-en${i + 1}`, { tipo: "entrada", litros, valor, data, tanqueId: "dp-tq1", nf, origem: "Distribuidora Exemplo", quem }));
  [["dp-mm1", 380, "2025-10-26"], ["dp-mm3", 420, "2025-11-05"], ["dp-mm2", 240, "2025-11-30"], ["dp-mm2", 260, "2025-12-16"], ["dp-mm2", 250, "2025-12-31"], ["dp-mm2", 230, "2026-01-08"], ["dp-mm2", 255, "2026-01-15"], ["dp-mm2", 300, "2026-02-20"], ["dp-mm4", 900, "2026-02-25"], ["dp-mm4", 950, "2026-03-01"], ["dp-mm5", 600, "2026-02-27"],
    ["dp-mm2", 210, "2026-07-04"], ["dp-mm1", 320, "2026-07-09"], ["dp-mm3", 380, "2026-07-10"], ["dp-mm2", 200, "2026-08-01"], ["dp-mm2", 205, "2026-08-10"], ["dp-mm2", 210, "2026-08-20"], ["dp-mm2", 200, "2026-08-30"], ["dp-mm2", 215, "2026-09-05"]]
    .forEach(([maquinaId, litros, data], i) => addSem("combustivel", `dp-ab${i + 1}`, { tipo: "abastecimento", maquinaId, litros, data, tanqueId: "dp-tq1", horimetro: null, quem }));

  // ---------- almoxarifado (custo entra na retirada) ----------
  const ENT = [
    ["filtro-oleo", "Filtro de óleo do motor JD RE504836", "Filtros", "un", 6, 118.9, "RE504836", "A1", "2026-06-20", "045.901", "TRATORFERTIL"],
    ["oleo-15w40", "Óleo motor 15W40", "Óleos e lubrificantes", "L", 120, 21.4, "", "Tambor 1", "2026-06-20", "027.310", "LUBRIFICANTES EXEMPLO"],
    ["graxa", "Graxa de lítio azul", "Óleos e lubrificantes", "kg", 30, 29.8, "", "B1", "2026-06-20", "027.310", "LUBRIFICANTES EXEMPLO"],
    ["oleo-redutor", "Óleo do redutor do pivô 80W90", "Óleos e lubrificantes", "L", 60, 38.5, "", "Tambor 2", "2026-06-22", "011.542", "IRRIGAÇÃO EXEMPLO"],
    ["emissor", "Emissor/aspersor do pivô Senninger", "Peças", "un", 80, 34, "SEN-i-WOB", "C1", "2026-06-22", "011.542", "IRRIGAÇÃO EXEMPLO"],
    ["pneu-pivo", "Pneu da torre do pivô 14.9-24", "Pneus e câmaras", "un", 4, 1650, "14.9-24", "Galpão", "2026-06-22", "011.542", "IRRIGAÇÃO EXEMPLO"],
    ["bico", "Bico de pulverização Jacto JSF 11002", "Peças", "un", 40, 18.5, "JSF11002", "C2", "2026-07-01", "007.441", "JACTO REVENDA"],
    ["correia", "Correia B-52 plantadeira", "Correias e rolamentos", "un", 4, 64, "B52", "C3", "2026-07-01", "003.208", "ROLAMENTOS EXEMPLO"],
  ];
  const ent = Object.fromEntries(ENT.map((e) => [e[0], e]));
  ENT.forEach(([id, nome, categoria, unidade, qtd, valorUnit, codigo, local, data, nf, fornecedor]) => addSem("almoxarifado", `dp-ent-${id}`, { tipo: "entrada", nome, categoria, unidade, qtd, valorUnit, codigo, local, data, nf, fornecedor, origem: "manual", custoNaRetirada: true, quem }));
  const NOME_MAQ = Object.fromEntries(maqs.map((m) => [m[0], m[2]]));
  const SAI = [
    ["01", "oleo-redutor", 12, "dp-piv1", "2026-06-28", "Revisão dos redutores antes do mungo", "Safrinha"], ["02", "oleo-redutor", 12, "dp-piv2", "2026-06-28", "Revisão dos redutores antes do mungo", "Safrinha"],
    ["03", "emissor", 18, "dp-piv3", "2026-06-29", "Troca de emissores entupidos", "Safrinha"], ["04", "pneu-pivo", 2, "dp-piv4", "2026-06-30", "Pneus da última torre", "Safrinha"],
    ["05", "bico", 36, "dp-mm2", "2026-07-03", "Barra nova de bicos", "Safrinha"], ["06", "correia", 2, "dp-mm3", "2026-07-08", "Preparo da plantadeira para o mungo", "Safrinha"],
    ["07", "filtro-oleo", 1, "dp-mm1", "2026-08-15", "Troca de óleo 250 h", "Ambas"], ["08", "oleo-15w40", 16, "dp-mm1", "2026-08-15", "Troca de óleo 250 h", "Ambas"], ["09", "graxa", 4, "dp-mm2", "2026-08-15", "Engraxar pulverizador", "Safrinha"],
  ];
  SAI.forEach(([id, peca, qtd, maq, data, servico, ciclo]) => {
    const e = ent[peca]; const sid = `dp-sai-${id}`; const valor = r2(e[5] * qtd);
    addSem("almoxarifado", sid, { tipo: "saida", nome: e[1], unidade: e[3], categoria: e[2], qtd, maquinaId: maq, data, horimetro: null, servico, ciclo, valor, custoPendente: false, quem, safraRetirada: S });
    add("custos", `almox-${sid}`, { descricao: `Almoxarifado — ${e[1]} ${br(qtd)} ${e[3]} → ${NOME_MAQ[maq]}`, categoria: e[1].includes("pivô") ? "Irrigação — manutenção (pivô, bombas)" : "Manutenção", valor, data, ciclo, talhaoId: null, maquinaId: maq, pago: true, origem: "almoxarifado", almoxId: sid, ehConsumoAlmox: true, quem });
    addSem("manutencoes", `dp-man-${id}`, { maquinaId: maq, data, horimetro: "", servico: `${servico} — ${e[1]} (${br(qtd)} ${e[3]}) do almoxarifado`, oleos: "", proximoHorimetro: "", proximaData: "", valor, origem: "almoxarifado", almoxId: sid, almoxIds: [sid], quem });
  });

  // ---------- fertilidade ----------
  const nivel = [0.8, 0.62, 0.45, 0.7], argila = [40, 34, 28, 38];
  T.forEach((t, i) => {
    const pontos = distribuirPontos(t.anel, Math.max(3, Math.round(t.areaHa / GRID_HA)));
    const lats = pontos.map((p) => p.lat), lngs = pontos.map((p) => p.lng);
    const nx = (p) => (Math.max(...lngs) > Math.min(...lngs) ? (p.lng - Math.min(...lngs)) / (Math.max(...lngs) - Math.min(...lngs)) : 0.5);
    const ny = (p) => (Math.max(...lats) > Math.min(...lats) ? (p.lat - Math.min(...lats)) / (Math.max(...lats) - Math.min(...lats)) : 0.5);
    const fL = (p) => Math.min(1, Math.max(0, nivel[i] + (nx(p) - 0.5) * 0.4 + (ny(p) - 0.5) * 0.3 + ruido(0.06)));
    addSem("solo", `dp-coleta-${i + 1}`, { tipo: "coleta", talhaoId: t.id, data: "2026-05-10T11:00:00.000Z", atualizadoEm: "2026-05-10T11:00:00.000Z", pontos, origem: "grade", gridHa: GRID_HA, quem });
    const v25 = amostra(Math.max(0, nivel[i] - 0.15), "0-20", argila[i]);
    addSem("solo", `dp-solo-2025-${i + 1}`, { tipo: "analise", talhaoId: t.id, data: "2025-06-12", laboratorio: "Laboratório Solo Cerrado (demonstração)", profundidade: "0-20", valores: v25, unidades: UNID, resumo: `Amostra composta do ${t.nome}, 0-20 cm, antes da soja. ${v25.v < 50 ? "Solo ácido, pedindo calagem." : "Acidez razoável."} (dados de demonstração)`, alertas: alertasDe(v25), fonte: "demonstração", quem, lidoPor: "simulação" });
    for (const prof of ["0-20", "20-40"]) {
      const pts = pontos.map((p) => ({ n: p.n, lat: p.lat, lng: p.lng, valores: amostra(fL(p), prof, argila[i]) }));
      const v = media(pts);
      addSem("solo", `dp-solo-2026-${prof.replace("-", "")}-${i + 1}`, { tipo: "analise", talhaoId: t.id, data: "2026-05-20", laboratorio: "Laboratório Solo Cerrado (demonstração)", profundidade: prof, valores: v, unidades: UNID, pontos: pts, resumo: resumoDe(v, prof, pts), alertas: alertasDe(v), fonte: "demonstração", quem, lidoPor: "simulação", nAmostras: pts.length });
    }
  });

  // ---------- visitas técnicas ----------
  const nomes = T.map((t) => t.nome);
  add("visitas", "dp-vis1", { data: "2025-12-12", tecnico: agr, obsCampo: [], itens: [
    { titulo: "Resumo da visita", texto: "Programar aplicação: 1ª fungicida — ferrugem (todos os pivôs).", fotos: [] },
    { titulo: "Talhões visitados", texto: T.map((t, i) => `• ${t.nome} — ${t.areaHa} ha · Soja · ${varSoja[i]} · 31 DAE`).join("\n"), fotos: [] },
    { titulo: "🦠 Doenças", texto: `• ${nomes[0]}: Ferrugem-asiática — pressão BAIXA · Programar aplicação (primeiras pústulas no baixeiro).`, fotos: [] } ] });
  add("visitas", "dp-vis2", { data: "2026-08-12", tecnico: agr, obsCampo: [], itens: [
    { titulo: "Resumo da visita", texto: `Programar aplicação: 1ª fungicida — oídio (${nomes[2]}, ${nomes[3]}). Mosca-branca controlada.`, fotos: [] },
    { titulo: "Talhões visitados", texto: T.map((t) => `• ${t.nome} — ${t.areaHa} ha · Mungo Preto · 28 DAE · irrigado`).join("\n"), fotos: [] },
    { titulo: "🌱 Fisiologia e estádio da lavoura", texto: `• ${nomes[0]}: Estande uniforme, início de ramificação.\n• ${nomes[2]}: Falhas pontuais perto do centro do pivô.`, fotos: [] },
    { titulo: "🦠 Doenças", texto: `• ${nomes[2]}: Oídio — pressão BAIXA · Programar aplicação.`, fotos: [] } ] });
  add("visitas", "dp-vis3", { data: "2026-09-12", tecnico: agr, obsCampo: [], itens: [
    { titulo: "Resumo da visita", texto: `Programar 3ª fungicida para 19/09 (enchimento de vagens). Lâmina do pivô ok com as chuvas de setembro.`, fotos: [] },
    { titulo: "Talhões visitados", texto: T.map((t) => `• ${t.nome} — ${t.areaHa} ha · Mungo Preto · 59 DAE · irrigado`).join("\n"), fotos: [] },
    { titulo: "🌱 Fisiologia e estádio da lavoura", texto: `• ${nomes[0]}: Enchimento de vagens, boa carga.\n• ${nomes[1]}: Floração final e vagens formadas.`, fotos: [] },
    { titulo: "🐛 Pragas e insetos", texto: `• ${nomes[3]}: Lagarta-das-vagens — pressão BAIXA · Só monitorar.`, fotos: [] } ] });

  console.log(`fazenda: ${fazenda.nome} · ${T.length} pivôs (${T.map((t) => `${t.nome} ${t.areaHa} ha`).join(", ")}) · ${r2(areaTotal)} ha`);
  const conta = (p) => W.filter((w) => w.caminho.startsWith(p + "/")).length;
  console.log(`documentos: ${W.length + 1} — compras ${conta("compras")}, recomendações ${conta("recomendacoes")}, execuções ${conta("execucoes")}, chuvas ${conta("chuvas")}, colheita ${conta("colheita")}, custos ${conta("custos")}, máquinas ${conta("maquinas")}, diesel ${conta("combustivel")}, almoxarifado ${conta("almoxarifado")}, manutenções ${conta("manutencoes")}, solo ${conta("solo")}, visitas ${conta("visitas")}, lavoura ${conta("lavoura")}`);
  const somaMes = (lista) => lista.reduce((s, x) => s + x[1], 0);
  console.log(`chuva: jul ${somaMes(chJul)} mm, ago ${somaMes(chAgo)} mm, set ${somaMes(chSet)} mm · soja colhida ${sacas} sc (${r1(sacas / areaTotal)} sc/ha)`);
  const saidaLocal = process.argv.find((x) => x.startsWith("--local="));
  if (saidaLocal) { fs.writeFileSync(saidaLocal.slice(8), JSON.stringify({ fid: FID, fazenda, docs: W })); console.log("exportado para teste local"); }
  if (!EXECUTAR) { console.log("\nSIMULAÇÃO — nada gravado. Para gravar: --executar"); return; }

  const tok = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + tok.access_token, "Content-Type": "application/json" };
  const writes = [{ update: { name: `${BASE}/fazendas/${FID}`, fields: para(fazenda).mapValue.fields } }, ...W.map((w) => ({ update: { name: `${BASE}/fazendas/${FID}/${w.caminho}`, fields: para(w.dados).mapValue.fields } }))];
  for (let k = 0; k < writes.length; k += 300) {
    const r = await (await fetch(`https://firestore.googleapis.com/v1/${BASE}:commit`, { method: "POST", headers: H, body: JSON.stringify({ writes: writes.slice(k, k + 300) }) })).json();
    if (r.error) throw new Error("commit: " + r.error.message);
    console.log(`gravados ${Math.min(k + 300, writes.length)}/${writes.length}`);
  }
  console.log("✓ pronto");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
