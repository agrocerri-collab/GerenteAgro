// GerenteAgro: lê e grava os campos de plataforma/pagamento (links e chave Pix que a tela de assinatura mostra).
// Campos: linkMensal (titular cartão), linkAnual (titular Pix/boleto), linkAdicionalMensal, linkAdicionalAnual, chavePix.
// Só ler:   ferramentas\node\node.exe ferramentas\pagamento-gerenteagro.js
// Gravar:   ferramentas\node\node.exe ferramentas\pagamento-gerenteagro.js <campo> <valor>
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const CAMPOS = ["linkMensal", "linkAnual", "linkAdicionalMensal", "linkAdicionalAnual", "chavePix"];
(async () => {
  const [campo, valor] = process.argv.slice(2);
  if (campo && !CAMPOS.includes(campo)) throw new Error("campo desconhecido: " + campo);
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const url = "https://firestore.googleapis.com/v1/projects/gerenteagro/databases/(default)/documents/plataforma/pagamento";
  const mostra = (f) => CAMPOS.forEach((k) => console.log("  " + k.padEnd(20) + " = " + ((f[k] && f[k].stringValue) || "(vazio)")));
  const atual = await (await fetch(url, { headers: H })).json();
  console.log("ANTES:"); mostra(atual.fields || {});
  if (!campo) return;
  const r = await (await fetch(url + "?updateMask.fieldPaths=" + campo, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { [campo]: { stringValue: String(valor || "").trim() } } }) })).json();
  if (r.error) throw new Error(r.error.message);
  console.log("DEPOIS:"); mostra(r.fields);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
