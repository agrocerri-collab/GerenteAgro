// Exclui a Fazenda Araguacema do AgroCR (agrocr-campo/fazendas/mt97bx5gx3jyz) DEPOIS de conferir que a cópia
// existe no GerenteAgro (ga-araguacema). Pedido do Daniel, 25/09/2026: "já pode excluir do AgroCR e deixar só no GerenteAgro".
// Uso: node excluir-araguacema-agrocr.js            → confere e lista o que seria apagado
//      node excluir-araguacema-agrocr.js --executar → apaga
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const ID = "mt97bx5gx3jyz", EXECUTAR = process.argv.includes("--executar");
const val = (v) => v == null ? v : v.stringValue ?? (v.arrayValue ? (v.arrayValue.values || []).map(val) : null);
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const base = (p) => `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents`;
  const lista = async (p, col) => { let out = [], tok = ""; do { const r = await (await fetch(`${base(p)}/${col}?pageSize=300${tok ? "&pageToken=" + tok : ""}`, { headers: H })).json(); out = out.concat(r.documents || []); tok = r.nextPageToken || ""; } while (tok); return out; };
  // 1) a cópia existe e está inteira?
  const ga = await (await fetch(`${base("gerenteagro")}/fazendas/ga-araguacema`, { headers: H })).json();
  const gaKml = await (await fetch(`${base("gerenteagro")}/fazendas/ga-araguacema/arquivos/kml`, { headers: H })).json();
  const nTalGa = ga.fields ? (val(ga.fields.talhoes) || []).length : 0, kmlGa = gaKml.fields ? (gaKml.fields.valor.stringValue || "").length : 0;
  const orig = await (await fetch(`${base("agrocr-campo")}/fazendas/${ID}`, { headers: H })).json();
  if (!orig.fields) { console.log("A Araguacema já não existe no AgroCR."); return; }
  const nTalOrig = (val(orig.fields.talhoes) || []).length;
  console.log(`Cópia no GerenteAgro: ${ga.fields ? val(ga.fields.nome) : "NÃO EXISTE"} · ${nTalGa} talhões · KML ${kmlGa} bytes | original: ${nTalOrig} talhões`);
  if (!ga.fields || nTalGa !== nTalOrig || kmlGa < 1000) throw new Error("cópia incompleta — NÃO apago a original");
  // 2) quem tem acesso a ela no AgroCR (pessoas da fazenda / consultores limitados)
  const us = await lista("agrocr-campo", "usuarios");
  const refs = us.filter((d) => (val((d.fields || {}).fazendas) || []).includes(ID) || (val((d.fields || {}).fazendasLimitadas) || []).includes(ID));
  console.log("Acessos no AgroCR que apontam para ela:", refs.length ? refs.map((d) => `${val(d.fields.nome)} (${val(d.fields.email) || "sem e-mail"})`).join(" · ") : "nenhum");
  // 3) o que vai ser apagado
  const subs = ["compras", "recomendacoes", "execucoes", "visitas", "ajustes", "entregas", "custos", "maquinas", "combustivel", "manutencoes", "almoxarifado", "funcionarios", "notas", "chuvas", "colheita", "lavoura", "solo", "historico", "arquivos", "mapa", "documentos", "avisos", "nfe"];
  const docs = [];
  for (const s of subs) for (const d of await lista("agrocr-campo", `fazendas/${ID}/${s}`)) docs.push(d.name);
  console.log(`${EXECUTAR ? "APAGANDO" : "SIMULAÇÃO"}: ${docs.length} documentos das subcoleções + o documento da fazenda`);
  if (!EXECUTAR) { console.log("Nada apagado. Rode com --executar."); return; }
  let n = 0;
  for (const name of docs) { const r = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: "DELETE", headers: H }); if (r.ok) n++; else console.log("falhou", name, r.status); }
  const r = await fetch(`${base("agrocr-campo")}/fazendas/${ID}`, { method: "DELETE", headers: H });
  console.log(`OK: ${n} documentos apagados; fazenda ${r.ok ? "apagada" : "FALHOU " + r.status}.`);
  // acessos: tira o id da lista de cada pessoa (a pessoa continua existindo)
  for (const d of refs) {
    const f = d.fields, faz = (val(f.fazendas) || []).filter((x) => x !== ID), lim = f.fazendasLimitadas && f.fazendasLimitadas.arrayValue ? (val(f.fazendasLimitadas) || []).filter((x) => x !== ID) : null;
    const fields = {}; const mask = [];
    if (f.fazendas) { fields.fazendas = { arrayValue: { values: faz.map((x) => ({ stringValue: x })) } }; mask.push("fazendas"); }
    if (lim) { fields.fazendasLimitadas = { arrayValue: { values: lim.map((x) => ({ stringValue: x })) } }; mask.push("fazendasLimitadas"); }
    const rr = await fetch(`https://firestore.googleapis.com/v1/${d.name}?${mask.map((m) => "updateMask.fieldPaths=" + m).join("&")}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) });
    console.log("acesso ajustado:", val(f.nome), rr.ok ? "ok" : "FALHOU " + rr.status);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
