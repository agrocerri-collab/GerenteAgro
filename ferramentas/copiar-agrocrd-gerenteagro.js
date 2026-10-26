// Cópia do GRUPO AgroCRD (AgroCR Campo) para o GerenteAgro, na conta administrativa do Daniel
// (administrativo@gerenteagro.com, uid AEChKtFa9rVa7VwTRAGw2KvumO53), para fazer vídeos explicativos.
// Pedido de 26/10/2026: "cópia separada para vídeo" — o GerenteAgro recebe as fazendas do grupo e o
// Daniel pede para atualizar quando quiser. NADA volta para o AgroCR: a original nunca é tocada.
//
// - Mesmos ids de fazenda nos dois projetos (rodar de novo SOBRESCREVE a cópia, nunca duplica).
// - Copia a fazenda e todas as listas dela; na cópia, o que não existe mais na original é apagado.
// - NÃO copia dados de pessoas: funcionários (salários), ponto e arquivos da contratação.
// - Leva o grupo e os fornecedores usados para as listas da conta administrativa.
//
// Uso: node copiar-agrocrd-gerenteagro.js            → simulação (mostra o que faria)
//      node copiar-agrocrd-gerenteagro.js --executar → grava no GerenteAgro
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const GRUPO = "mt2v3wcmqqu2v";                       // Grupo AgroCRD no AgroCR
const CONTA = "AEChKtFa9rVa7VwTRAGw2KvumO53";       // conta administrativa no GerenteAgro
const FORA = ["funcionarios", "ponto", "rhAnexos"];  // dados de pessoas não vão para o vídeo
const EXECUTAR = process.argv.includes("--executar");
const base = (p) => `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents`;
const val = (v) => v == null ? v : v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? (v.arrayValue ? (v.arrayValue.values || []).map(val) : v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)])) : null);
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const req = async (url, opt) => { const r = await (await fetch(url, { headers: H, ...(opt || {}) })).json(); if (r && r.error) throw new Error(url.split("/documents")[1] + ": " + r.error.message); return r; };
  const lista = async (p, col) => { let out = [], tok = ""; do { const r = await req(`${base(p)}/${col}?pageSize=300${tok ? "&pageToken=" + tok : ""}`); out = out.concat(r.documents || []); tok = r.nextPageToken || ""; } while (tok); return out; };
  const colecoes = async (p, doc) => { const r = await req(`${base(p)}/${doc}:listCollectionIds`, { method: "POST", body: JSON.stringify({ pageSize: 100 }) }); return r.collectionIds || []; };
  const rel = (name) => name.split("/documents/")[1];

  // 1) as fazendas do grupo no AgroCR
  const todas = await lista("agrocr-campo", "fazendas");
  const noGrupo = (f) => [val(f.grupo), val(f.grupoId), ...[].concat(val(f.grupos) || [])].includes(GRUPO);
  const doGrupo = todas.filter((d) => noGrupo(d.fields || {}));
  if (!doGrupo.length) throw new Error("nenhuma fazenda do grupo " + GRUPO);
  const escritas = []; const apagar = [];
  const fornIds = new Set();
  for (const fz of doGrupo) {
    const id = fz.name.split("/").pop();
    const campos = { ...fz.fields, conta: { stringValue: CONTA }, criadoPor: { stringValue: CONTA }, copiaParaVideo: { booleanValue: true }, copiadoDe: { stringValue: `agrocr-campo/${id}` }, copiadoEm: { stringValue: new Date().toISOString() } };
    escritas.push({ path: `fazendas/${id}`, fields: campos });
    const cols = (await colecoes("agrocr-campo", `fazendas/${id}`)).filter((c) => !FORA.includes(c));
    const resumo = [];
    for (const c of cols) {
      const docs = await lista("agrocr-campo", `fazendas/${id}/${c}`);
      for (const d of docs) {
        escritas.push({ path: rel(d.name), fields: d.fields || {} });
        const fid = val((d.fields || {}).fornecedorId); if (fid) fornIds.add(fid);
      }
      // o que sobrou na cópia e não existe mais na original sai
      const naCopia = await lista("gerenteagro", `fazendas/${id}/${c}`).catch(() => []);
      const ids = new Set(docs.map((d) => d.name.split("/").pop()));
      for (const d of naCopia) if (!ids.has(d.name.split("/").pop())) apagar.push(rel(d.name));
      resumo.push(`${c} ${docs.length}`);
    }
    console.log(`• ${val(fz.fields.nome)} [${id}] — ${resumo.join(" · ") || "sem listas"}`);
  }

  // 2) grupo e fornecedores na lista da conta administrativa
  const lerConfig = async (p, nome) => { try { const d = await req(`${base(p)}/config/${nome}`); return (val({ mapValue: { fields: d.fields || {} } }).lista) || []; } catch (e) { return []; } };
  const gruposAgro = await lerConfig("agrocr-campo", "grupos");
  const grupo = gruposAgro.find((g) => g && g.id === GRUPO);
  const fornAgro = await lerConfig("agrocr-campo", "fornecedores");
  const gruposGA = await lerConfig("gerenteagro", `grupos__${CONTA}`);
  const fornGA = await lerConfig("gerenteagro", `fornecedores__${CONTA}`);
  const mesclar = (atuais, novos) => [...atuais.filter((x) => !novos.some((n) => n.id === x.id)), ...novos];
  const novosForn = fornAgro.filter((f) => f && fornIds.has(f.id));
  const paraValor = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(paraValor) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraValor(x)])) } };
  if (grupo) escritas.push({ path: `config/grupos__${CONTA}`, fields: { lista: paraValor(mesclar(gruposGA, [grupo])) } });
  if (novosForn.length) escritas.push({ path: `config/fornecedores__${CONTA}`, fields: { lista: paraValor(mesclar(fornGA, novosForn)) } });
  console.log(`grupo: ${grupo ? grupo.nome : "NÃO ACHEI no AgroCR"} · fornecedores usados: ${novosForn.length}`);
  console.log(`${EXECUTAR ? "GRAVANDO" : "SIMULAÇÃO"}: ${escritas.length} documentos para gravar, ${apagar.length} para apagar na cópia (de fora: ${FORA.join(", ")})`);
  if (!EXECUTAR) { console.log("Nada gravado. Rode com --executar."); return; }

  // 3) grava em lotes (commit de até 400 escritas)
  const raizGA = "projects/gerenteagro/databases/(default)/documents/";
  const ops = [...escritas.map((e) => ({ update: { name: raizGA + e.path, fields: e.fields } })), ...apagar.map((p) => ({ delete: raizGA + p }))];
  let feitos = 0;
  for (let i = 0; i < ops.length; i += 400) {
    await req(`https://firestore.googleapis.com/v1/projects/gerenteagro/databases/(default)/documents:commit`, { method: "POST", body: JSON.stringify({ writes: ops.slice(i, i + 400) }) });
    feitos += Math.min(400, ops.length - i);
  }
  console.log(`OK: ${feitos} operações gravadas no GerenteAgro.`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
