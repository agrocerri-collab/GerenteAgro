// Copia a Fazenda Araguacema (agrocr-campo, doc mt97bx5gx3jyz) para o GerenteAgro, na conta do Daniel
// (administrativo@gerenteagro.com, uid AEChKtFa9rVa7VwTRAGw2KvumO53). Pedido de 25/09/2026: "jogar os dados
// da Araguacema no GerenteAgro, pode usar o meu cadastro". A original no AgroCR NÃO é tocada.
// Uso: node copiar-araguacema-gerenteagro.js            → simulação (mostra o que gravaria)
//      node copiar-araguacema-gerenteagro.js --executar → grava
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const ORIGEM = { projeto: "agrocr-campo", id: "mt97bx5gx3jyz" };
const CONTA = "AEChKtFa9rVa7VwTRAGw2KvumO53";
const NOVO_ID = "ga-araguacema";                 // id fixo: rodar de novo sobrescreve, nunca duplica
const EXECUTAR = process.argv.includes("--executar");
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const base = (p) => `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents`;
  const ler = async (p, path) => { const r = await (await fetch(`${base(p)}/${path}`, { headers: H })).json(); if (r.error) throw new Error(path + ": " + r.error.message); return r; };
  const fz = await ler(ORIGEM.projeto, `fazendas/${ORIGEM.id}`);
  const kml = await ler(ORIGEM.projeto, `fazendas/${ORIGEM.id}/arquivos/kml`);
  const f = fz.fields;
  const nTal = ((f.talhoes.arrayValue || {}).values || []).length;
  // documento novo: mesmos campos, sem o grupo do AgroCR, carimbado com a conta do Daniel
  const novo = { nome: f.nome, produtor: f.produtor, municipio: f.municipio, codigo: f.codigo, talhoes: f.talhoes,
    conta: { stringValue: CONTA }, criadoPor: { stringValue: CONTA }, copiadoDe: { stringValue: `agrocr-campo/${ORIGEM.id}` }, copiadoEm: { stringValue: new Date().toISOString() } };
  console.log(`${EXECUTAR ? "GRAVANDO" : "SIMULAÇÃO"}: ${f.nome.stringValue} · ${f.produtor.stringValue} · ${(f.municipio || {}).stringValue} · ${nTal} talhões · KML ${(kml.fields.valor.stringValue || "").length} bytes → gerenteagro/fazendas/${NOVO_ID} (conta ${CONTA})`);
  if (!EXECUTAR) { console.log("Nada gravado. Rode com --executar para copiar."); return; }
  const existe = await (await fetch(`${base("gerenteagro")}/fazendas/${NOVO_ID}`, { headers: H })).json();
  if (existe.fields) console.log("já existia — vai sobrescrever o documento da fazenda e o KML");
  const put = async (path, fields) => { const r = await (await fetch(`${base("gerenteagro")}/${path}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) })).json(); if (r.error) throw new Error(path + ": " + r.error.message); return r; };
  await put(`fazendas/${NOVO_ID}`, novo);
  await put(`fazendas/${NOVO_ID}/arquivos/kml`, { valor: kml.fields.valor, formato: kml.fields.formato || { stringValue: "json" } });
  console.log("OK: fazenda e KML gravados no GerenteAgro.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
