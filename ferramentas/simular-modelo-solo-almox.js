// Fazenda Modelo do GerenteAgro (administrativo, modelo-s0s3hy6xebva): simulação de FERTILIDADE DO SOLO
// e de ALMOXARIFADO para demonstração (pedido do Daniel, 16/09/2026).
//  • Solo: pontos de coleta em grid de 30 ha em cada talhão (mesma distribuição do app), análise de
//    2024 (composta, 0-20) e de 2026 por ponto em 0-20 e 20-40, com variação no talhão para os mapas
//    interpolados de todos os atributos (pH, M.O., P resina, P Mehlich, K, Ca, Mg, Al, H+Al, SB, CTC,
//    V%, m%, S, B, Cu, Fe, Mn, Zn, argila). O talhão 03 ÁREA NOVA é o de fertilidade mais baixa.
//  • Almoxarifado: entradas de peças, filtros, óleos e graxa (com NF e valor), retiradas para as
//    máquinas com custo de Manutenção na safra atual (ciclo escolhido) e histórico de manutenção.
// Tudo com id "sim-…": rodar de novo sobrescreve os mesmos documentos, não duplica. NÃO apaga nada.
// Uso:  node simular-modelo-solo-almox.js            (só mostra o que faria)
//       node simular-modelo-solo-almox.js --executar  (grava)
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const EXECUTAR = process.argv.includes("--executar");
const PROJ = "gerenteagro", FAZ = "modelo-s0s3hy6xebva", GRID_HA = 30;
const BASE = `projects/${PROJ}/databases/(default)/documents`;
const URL = `https://firestore.googleapis.com/v1/${BASE}`;

// ---------- utilidades ----------
const de = (f) => { if (!f) return undefined; const k = Object.keys(f)[0]; const x = f[k]; if (k === "integerValue" || k === "doubleValue") return Number(x); if (k === "arrayValue") return (x.values || []).map(de); if (k === "mapValue") return Object.fromEntries(Object.entries(x.fields || {}).map(([a, b]) => [a, de(b)])); if (k === "nullValue") return null; return x; };
const para = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "string") return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(para) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, para(v)])) } };
};
let semente = 20260916;
const aleat = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const ruido = (amp) => (aleat() * 2 - 1) * amp;
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, r0 = (v) => Math.round(v);
function escalasLocais(latGraus) {
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), rad = Math.PI / 180;
  const s = Math.sin(latGraus * rad), den = 1 - e2 * s * s;
  return { kx: (a / Math.sqrt(den)) * Math.cos(latGraus * rad) * rad, ky: (a * (1 - e2) / Math.pow(den, 1.5)) * rad };
}
function pontoNoAnel(lon, lat, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) { const [xi, yi] = anel[i], [xj, yj] = anel[j]; if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) dentro = !dentro; }
  return dentro;
}
// igual ao distribuirPontos do app (zigue-zague dentro do talhão)
function distribuirPontos(anel, n) {
  const lats = anel.map((p) => p[1]), lngs = anel.map((p) => p[0]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const { kx, ky } = escalasLocais((minLat + maxLat) / 2);
  const W = (maxLng - minLng) * kx, H = (maxLat - minLat) * ky;
  let passo = Math.sqrt((W * H) / n);
  for (let tent = 0; tent < 40; tent++) {
    const linhas = []; let fila = 0;
    for (let y = passo / 2; y < H; y += passo, fila++) {
      const linha = [];
      for (let x = passo / 2; x < W; x += passo) { const lng = minLng + x / kx, lat = minLat + y / ky; if (pontoNoAnel(lng, lat, anel)) linha.push({ lat, lng }); }
      linhas.push(fila % 2 ? linha.reverse() : linha);
    }
    const dentro = linhas.flat();
    if (dentro.length >= n) { const sel = []; for (let i = 0; i < n; i++) sel.push(dentro[Math.floor((i * dentro.length) / n)]); return sel.map((p, i) => ({ n: i + 1, lat: Number(p.lat.toFixed(7)), lng: Number(p.lng.toFixed(7)), origem: "grade" })); }
    passo *= 0.85;
  }
  return [];
}

// ---------- química do solo ----------
const UNIDADES = { ph: "CaCl2", mo: "g/dm³", pRes: "mg/dm³", pMeh: "mg/dm³", k: "mmolc/dm³", ca: "mmolc/dm³", mg: "mmolc/dm³", al: "mmolc/dm³", hAl: "mmolc/dm³", sb: "mmolc/dm³", ctc: "mmolc/dm³", v: "%", m: "%", s: "mg/dm³", b: "mg/dm³", cu: "mg/dm³", fe: "mg/dm³", mn: "mg/dm³", zn: "mg/dm³", argila: "%", silte: "%", areia: "%" };
// perfil de cada talhão: nível médio (0 = pobre, 1 = bem corrigido) e textura
const PERFIL = { "01": { nivel: 0.8, argila: 42 }, "02": { nivel: 0.65, argila: 35 }, "03 ÁREA NOVA": { nivel: 0.25, argila: 28 } };
// f = fertilidade local (0–1) no ponto; prof = "0-20" | "20-40"
function amostra(f, prof, argila) {
  const sub = prof === "20-40";
  const ph = 4.3 + f * 1.3 - (sub ? 0.35 : 0) + ruido(0.12);
  const mo = (sub ? 12 : 18) + f * (sub ? 6 : 12) + argila * 0.08 + ruido(1.5);
  const pRes = Math.max(2, (sub ? 4 : 7) + f * (sub ? 10 : 28) + ruido(3));
  const pMeh = Math.max(1, pRes * (0.45 + argila * 0.002) + ruido(1.2));
  const k = Math.max(0.4, (sub ? 0.6 : 0.9) + f * (sub ? 1.2 : 2.6) + ruido(0.25));
  const ca = Math.max(3, (sub ? 5 : 8) + f * (sub ? 12 : 26) + ruido(2));
  const mg = Math.max(1, (sub ? 2 : 3) + f * (sub ? 5 : 10) + ruido(0.8));
  const al = Math.max(0, (sub ? 7 : 5) - f * (sub ? 6 : 5.2) + ruido(0.6));
  const hAl = Math.max(12, 58 - f * 30 + argila * 0.25 + (sub ? 6 : 0) + ruido(3));
  const sb = k + ca + mg, ctc = sb + hAl;
  const v = (sb / ctc) * 100, m = (al / (sb + al || 1)) * 100;
  const s = Math.max(2, (sub ? 9 : 6) + f * 6 + ruido(1.5));
  const b = Math.max(0.1, 0.18 + f * 0.35 - (sub ? 0.08 : 0) + ruido(0.05));
  const cu = Math.max(0.2, 0.5 + f * 1.1 + ruido(0.15));
  const fe = Math.max(8, 55 - f * 20 + ruido(6));
  const mn = Math.max(1, 3 + f * 9 - (sub ? 2 : 0) + ruido(1));
  const zn = Math.max(0.3, 0.6 + f * 2.8 - (sub ? 0.4 : 0) + ruido(0.3));
  return { ph: r1(ph), mo: r1(mo), pRes: r1(pRes), pMeh: r1(pMeh), k: r2(k), ca: r1(ca), mg: r1(mg), al: r1(al), hAl: r1(hAl), sb: r1(sb), ctc: r1(ctc), v: r0(v), m: r0(m), s: r1(s), b: r2(b), cu: r2(cu), fe: r0(fe), mn: r1(mn), zn: r2(zn), argila: r0(argila + ruido(3)), silte: r0(12 + ruido(2)), areia: r0(100 - argila - 12) };
}
const media = (pts) => { const soma = {}, n = {}; for (const p of pts) for (const [k, v] of Object.entries(p.valores)) { soma[k] = (soma[k] || 0) + v; n[k] = (n[k] || 0) + 1; } return Object.fromEntries(Object.keys(soma).map((k) => [k, Math.round((soma[k] / n[k]) * 100) / 100])); };
function alertasDe(v) {
  const a = [];
  if (v.ph < 5) a.push(`pH baixo (${String(v.ph).replace(".", ",")})`);
  if (v.v < 50) a.push(`Saturação por bases baixa (${v.v}%)`);
  if (v.m > 20) a.push(`Alumínio alto (m ${v.m}%)`);
  if (v.pRes < 15) a.push(`Fósforo resina baixo (${String(v.pRes).replace(".", ",")} mg/dm³)`);
  if (v.k < 1.5) a.push(`Potássio baixo (${String(v.k).replace(".", ",")} mmolc/dm³)`);
  if (v.b < 0.3) a.push(`Boro baixo (${String(v.b).replace(".", ",")} mg/dm³)`);
  return a.slice(0, 4);
}
function resumoDe(v, prof, pts) {
  const faixa = (k) => { const vs = pts.map((p) => p.valores[k]); return `${String(Math.min(...vs)).replace(".", ",")} a ${String(Math.max(...vs)).replace(".", ",")}`; };
  const acidez = v.ph >= 5 && v.v >= 50 ? "acidez corrigida" : "solo ainda ácido, com saturação por bases abaixo de 50%";
  const pTxt = v.pRes >= 20 ? "fósforo em bom nível" : v.pRes >= 15 ? "fósforo médio" : "fósforo baixo";
  const kTxt = v.k >= 1.5 ? "potássio adequado" : "potássio baixo";
  const pede = [];
  if (v.v < 50 || v.m > 20) pede.push(prof === "20-40" ? "gessagem para levar cálcio e reduzir o alumínio em profundidade" : "calagem");
  if (v.pRes < 15) pede.push("adubação de correção de fósforo");
  if (v.k < 1.5) pede.push("reposição de potássio");
  if (v.b < 0.3) pede.push("boro");
  return `Média de ${pts.length} pontos (grid de ${GRID_HA} ha), ${prof} cm: ${acidez}; ${pTxt} (resina ${faixa("pRes")} mg/dm³ entre os pontos) e ${kTxt}. ` +
    `V% varia de ${faixa("v")}% no talhão — veja o mapa por atributo para onde está cada mancha. ${pede.length ? `Pede ${pede.join(", ")}.` : "Manter adubação de manutenção."} (dados simulados para demonstração)`;
}

(async () => {
  const tok = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + tok.access_token, "Content-Type": "application/json" };
  const ler = async (c) => { const r = await (await fetch(`${URL}/fazendas/${FAZ}${c}`, { headers: H })).json(); return r.fields ? Object.fromEntries(Object.entries(r.fields).map(([a, b]) => [a, de(b)])) : null; };
  const fz = await ler("");
  if (!fz || fz.conta !== "AEChKtFa9rVa7VwTRAGw2KvumO53") throw new Error("fazenda modelo não encontrada ou de outra conta");
  const kmlDoc = await ler("/arquivos/kml"); const kml = JSON.parse(kmlDoc.valor);
  const safra = fz.safraAtual || "2025/2026";
  const escritas = [];   // {caminho, dados}
  const quem = "Consultoria (simulação)";

  // ---------- SOLO ----------
  for (const t of fz.talhoes || []) {
    const pg = kml.poligonos.find((p) => p.talhaoId === t.id);
    if (!pg) { console.log("talhão sem mapa, pulado:", t.nome); continue; }
    const perfil = PERFIL[t.nome] || { nivel: 0.5, argila: 35 };
    const nPts = Math.max(1, Math.round(Number(t.areaHa) / GRID_HA));
    const pontos = distribuirPontos(pg.aneis[0], nPts);
    // gradiente de fertilidade no talhão (um lado melhor que o outro) para o mapa ter o que mostrar
    const lats = pontos.map((p) => p.lat), lngs = pontos.map((p) => p.lng);
    const nx = (p) => (Math.max(...lngs) > Math.min(...lngs) ? (p.lng - Math.min(...lngs)) / (Math.max(...lngs) - Math.min(...lngs)) : 0.5);
    const ny = (p) => (Math.max(...lats) > Math.min(...lats) ? (p.lat - Math.min(...lats)) / (Math.max(...lats) - Math.min(...lats)) : 0.5);
    const fLocal = (p) => Math.min(1, Math.max(0, perfil.nivel + (nx(p) - 0.5) * 0.45 + (ny(p) - 0.5) * 0.25 + ruido(0.08)));
    const idT = t.id.replace(/[^a-z0-9]/gi, "");
    escritas.push({ caminho: `solo/sim-coleta-${idT}`, dados: { tipo: "coleta", talhaoId: t.id, data: "2026-08-05T11:00:00.000Z", atualizadoEm: "2026-08-05T11:00:00.000Z", pontos, origem: "grade", gridHa: GRID_HA, quem, safra: null } });
    // 2024: amostra composta 0-20 (sem pontos), um pouco pior que hoje
    const v24 = amostra(Math.max(0, perfil.nivel - 0.2), "0-20", perfil.argila);
    escritas.push({ caminho: `solo/sim-2024-020-${idT}`, dados: { tipo: "analise", talhaoId: t.id, data: "2024-08-12", laboratorio: "Laboratório Solo Cerrado (simulação)", profundidade: "0-20", valores: v24, unidades: UNIDADES, resumo: `Amostra composta do talhão, 0-20 cm. ${v24.v < 50 ? "Solo ácido, pedindo calagem." : "Acidez razoável."} ${v24.pRes < 15 ? "Fósforo baixo." : "Fósforo médio."} (dados simulados para demonstração)`, alertas: alertasDe(v24), fonte: "simulação", quem, lidoPor: "simulação", safra: null } });
    // 2026: por ponto, 0-20 e 20-40
    for (const prof of ["0-20", "20-40"]) {
      const pts = pontos.map((p) => ({ n: p.n, lat: p.lat, lng: p.lng, valores: amostra(fLocal(p), prof, perfil.argila) }));
      const v = media(pts);
      escritas.push({ caminho: `solo/sim-2026-${prof.replace("-", "")}-${idT}`, dados: { tipo: "analise", talhaoId: t.id, data: "2026-08-20", laboratorio: "Laboratório Solo Cerrado (simulação)", profundidade: prof, valores: v, unidades: UNIDADES, pontos: pts, resumo: resumoDe(v, prof, pts), alertas: alertasDe(v), fonte: "simulação", quem, lidoPor: "simulação", nAmostras: pts.length, safra: null } });
    }
    console.log(`solo · talhão ${t.nome}: ${t.areaHa} ha → grid ${GRID_HA} ha = ${pontos.length} pontos · análises 2024 (0-20) e 2026 (0-20 e 20-40 por ponto)`);
  }

  // ---------- ALMOXARIFADO ----------
  const ENT = [
    ["filtro-oleo-jd", "Filtro de óleo do motor JD RE504836", "Filtros", "un", 8, 118.9, "RE504836", "A1", "2026-07-08", "045.112", "TRATORFERTIL MAQUINAS AGRICOLAS LTDA"],
    ["filtro-comb-jd", "Filtro de combustível JD RE62418", "Filtros", "un", 6, 96.5, "RE62418", "A1", "2026-07-08", "045.112", "TRATORFERTIL MAQUINAS AGRICOLAS LTDA"],
    ["filtro-ar-prim", "Filtro de ar primário JD RE283286", "Filtros", "un", 3, 245, "RE283286", "A2", "2026-07-08", "045.112", "TRATORFERTIL MAQUINAS AGRICOLAS LTDA"],
    ["filtro-hid-case", "Filtro hidráulico Case 84475513", "Filtros", "un", 4, 312, "84475513", "A2", "2026-07-22", "018.930", "AGROVALE PEÇAS CASE IH"],
    ["oleo-15w40", "Óleo motor 15W40 Lubrax Top Turbo", "Óleos e lubrificantes", "L", 200, 21.4, "", "Tambor 1", "2026-07-15", "026.996", "P. A. S - COMERCIO DE LUBRIFICANTES LTDA"],
    ["oleo-hygard", "Óleo transmissão/hidráulico Hy-Gard", "Óleos e lubrificantes", "L", 120, 34.9, "", "Tambor 2", "2026-07-15", "026.996", "P. A. S - COMERCIO DE LUBRIFICANTES LTDA"],
    ["graxa", "Graxa de lítio azul", "Óleos e lubrificantes", "kg", 40, 29.8, "", "B1", "2026-07-15", "026.996", "P. A. S - COMERCIO DE LUBRIFICANTES LTDA"],
    ["bico-jacto", "Bico de pulverização Jacto JSF 11002", "Peças", "un", 60, 18.5, "JSF11002", "C1", "2026-08-02", "007.441", "JACTO REVENDA PEIXE"],
    ["correia-b52", "Correia B-52 plantadeira", "Correias e rolamentos", "un", 6, 64, "B52", "C2", "2026-08-10", "003.208", "ROLAMENTOS TOCANTINS LTDA"],
    ["rolamento-6205", "Rolamento 6205 2RS", "Correias e rolamentos", "un", 12, 27.9, "6205-2RS", "C2", "2026-08-10", "003.208", "ROLAMENTOS TOCANTINS LTDA"],
    ["bateria-150", "Bateria 150 Ah Moura", "Elétrica e baterias", "un", 2, 1180, "M150BD", "D1", "2026-08-18", "012.775", "MOURA BATERIAS GURUPI"],
    ["lampada-h4", "Lâmpada farol H4 24V", "Elétrica e baterias", "un", 10, 22, "H4-24V", "D1", "2026-08-18", "012.775", "MOURA BATERIAS GURUPI"],
  ];
  const nomeDe = Object.fromEntries(ENT.map((e) => [e[0], e]));
  for (const [id, nome, categoria, unidade, qtd, valorUnit, codigo, local, data, nf, fornecedor] of ENT)
    escritas.push({ caminho: `almoxarifado/sim-ent-${id}`, dados: { tipo: "entrada", nome, categoria, unidade, qtd, valorUnit, codigo, local, data, nf, fornecedor, origem: "manual", custoNaRetirada: true, quem, safra: null } });
  // retiradas: [id, peça, qtd, máquina, data, horímetro, serviço, ciclo]
  const SAI = [
    ["01", "filtro-oleo-jd", 1, "mm1", "2026-07-20", 2480, "Troca de óleo 250 h", "Ambas"], ["02", "oleo-15w40", 16, "mm1", "2026-07-20", 2480, "Troca de óleo 250 h", "Ambas"],
    ["03", "filtro-comb-jd", 1, "mm1", "2026-07-20", 2480, "Troca de óleo 250 h", "Ambas"],
    ["04", "filtro-hid-case", 2, "mm4", "2026-07-25", 1810, "Revisão pré-colheita", "Safra"], ["05", "oleo-hygard", 40, "mm4", "2026-07-25", 1810, "Revisão pré-colheita", "Safra"],
    ["06", "graxa", 6, "mm4", "2026-07-25", 1810, "Revisão pré-colheita", "Safra"],
    ["07", "bico-jacto", 36, "mm2", "2026-08-05", 3120, "Troca da barra inteira de bicos", "Safra"], ["08", "graxa", 3, "mm2", "2026-08-05", 3120, "Troca da barra inteira de bicos", "Safra"],
    ["09", "correia-b52", 3, "mm3", "2026-08-15", 960, "Preparo da plantadeira", "Safra"], ["10", "rolamento-6205", 8, "mm3", "2026-08-15", 960, "Preparo da plantadeira", "Safra"],
    ["11", "bateria-150", 1, "mm5", "2026-08-25", null, "Bateria do caminhão", "Ambas"], ["12", "lampada-h4", 2, "mm5", "2026-08-25", null, "Bateria do caminhão", "Ambas"],
    ["13", "filtro-oleo-jd", 1, "mm1", "2026-09-05", 2730, "Troca de óleo 500 h", "Ambas"], ["14", "oleo-15w40", 16, "mm1", "2026-09-05", 2730, "Troca de óleo 500 h", "Ambas"],
    ["15", "filtro-ar-prim", 1, "mm1", "2026-09-05", 2730, "Troca de óleo 500 h", "Ambas"],
  ];
  const NOME_MAQ = { mm1: "John Deere 6110J", mm2: "Jacto Uniport 3030", mm3: "Stara Absoluta 35", mm4: "Case IH 8250", mm5: "Mercedes-Benz Atego 2426" };
  const porServico = {};
  for (const [id, peca, qtd, maq, data, hor, servico, ciclo] of SAI) {
    const e = nomeDe[peca]; const saidaId = `sim-sai-${id}`;
    const valor = Math.round(e[5] * qtd * 100) / 100;
    escritas.push({ caminho: `almoxarifado/${saidaId}`, dados: { tipo: "saida", nome: e[1], unidade: e[3], categoria: e[2], qtd, maquinaId: maq, data, horimetro: hor, servico, ciclo, safra, valor, quem, custoPendente: false } });
    escritas.push({ caminho: `custos/almox-${saidaId}`, dados: { descricao: `Almoxarifado — ${e[1]} ${String(qtd).replace(".", ",")} ${e[3]} → ${NOME_MAQ[maq]}`, categoria: "Manutenção", valor, data, ciclo, talhaoId: null, maquinaId: maq, pago: true, origem: "almoxarifado", almoxId: saidaId, ehConsumoAlmox: true, quem, safra } });
    const k = `${maq}|${data}|${servico}`;
    (porServico[k] = porServico[k] || { maq, data, hor, servico, itens: [], ids: [], valor: 0 });
    porServico[k].itens.push(`${e[1]} (${String(qtd).replace(".", ",")} ${e[3]})`); porServico[k].ids.push(saidaId); porServico[k].valor += valor;
  }
  let i = 0;
  for (const s of Object.values(porServico)) {
    i++;
    escritas.push({ caminho: `manutencoes/sim-manut-${String(i).padStart(2, "0")}`, dados: { maquinaId: s.maq, data: s.data, horimetro: s.hor || "", servico: `${s.servico} — ${s.itens.join(", ")} do almoxarifado`, oleos: "", proximoHorimetro: /troca de óleo/i.test(s.servico) && s.hor ? s.hor + 250 : "", proximaData: "", valor: Math.round(s.valor * 100) / 100, origem: "almoxarifado", almoxIds: s.ids, almoxId: s.ids[0], quem, safra: null } });
  }
  // estoque mínimo (alguns ficam abaixo, para aparecer o aviso)
  for (const [peca, minimo] of [["filtro-oleo-jd", 6], ["filtro-comb-jd", 3], ["oleo-15w40", 180], ["bico-jacto", 30], ["bateria-150", 1]]) {
    const e = nomeDe[peca]; const chave = `${e[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ")}|${e[3].toLowerCase()}`;
    escritas.push({ caminho: `almoxarifado/sim-min-${peca}`, dados: { tipo: "minimo", chave, nome: e[1], unidade: e[3], minimo, quem, safra: null } });
  }
  const custoTotal = SAI.reduce((s, [, peca, qtd]) => s + nomeDe[peca][5] * qtd, 0);
  console.log(`almoxarifado: ${ENT.length} entradas, ${SAI.length} retiradas para ${new Set(SAI.map((s) => s[3])).size} máquinas, ${Object.keys(porServico).length} manutenções, custo de Manutenção R$ ${custoTotal.toFixed(2)} na safra ${safra}`);
  console.log(`total de documentos: ${escritas.length} (solo ${escritas.filter((e) => e.caminho.startsWith("solo/")).length}, almoxarifado ${escritas.filter((e) => e.caminho.startsWith("almoxarifado/")).length}, custos ${escritas.filter((e) => e.caminho.startsWith("custos/")).length}, manutenções ${escritas.filter((e) => e.caminho.startsWith("manutencoes/")).length})`);
  const ex = escritas.find((e) => e.caminho.includes("sim-2026-020"));
  console.log("exemplo (1º talhão, 0-20, 2026):", JSON.stringify({ media: ex.dados.valores, ponto1: ex.dados.pontos[0] }).slice(0, 600));

  if (!EXECUTAR) { console.log("\nSIMULAÇÃO — nada foi gravado. Para gravar: --executar"); return; }
  for (let k = 0; k < escritas.length; k += 300) {
    const writes = escritas.slice(k, k + 300).map((e) => ({ update: { name: `${BASE}/fazendas/${FAZ}/${e.caminho}`, fields: para(e.dados).mapValue.fields } }));
    const r = await (await fetch(`https://firestore.googleapis.com/v1/${BASE}:commit`, { method: "POST", headers: H, body: JSON.stringify({ writes }) })).json();
    if (r.error) throw new Error("commit: " + r.error.message);
    console.log(`gravados ${Math.min(k + 300, escritas.length)}/${escritas.length}`);
  }
  console.log("✓ pronto");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
