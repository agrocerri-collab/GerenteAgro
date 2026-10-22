// Dá às funções do app (projeto agrocr-campo) permissão de ler/gravar no banco
// do GerenteAgro (projeto gerenteagro), para clientes do GerenteAgro usarem a
// busca de notas na SEFAZ. Papel concedido: Cloud Datastore User.
// Rode uma vez: ferramentas\node\node.exe ferramentas\liberar-gerenteagro-sefaz.js
const raiz = __dirname + "/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore");
const auth = require(raiz + "/lib/auth");
const SA = "serviceAccount:997034245509-compute@developer.gserviceaccount.com";
const ROLE = "roles/datastore.user";
(async () => {
  const tokens = configstore.get("tokens");
  if (!tokens) { console.log("Firebase CLI não está logado."); return; }
  const t = await auth.getAccessToken(tokens.refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const pol = await (await fetch("https://cloudresourcemanager.googleapis.com/v1/projects/gerenteagro:getIamPolicy", { method: "POST", headers: H, body: "{}" })).json();
  if (!pol.bindings) { console.log("Não consegui ler as permissões:", JSON.stringify(pol).slice(0, 300)); return; }
  let b = pol.bindings.find((x) => x.role === ROLE);
  if (!b) { b = { role: ROLE, members: [] }; pol.bindings.push(b); }
  if (b.members.includes(SA)) { console.log("Já estava liberado."); return; }
  b.members.push(SA);
  const r = await fetch("https://cloudresourcemanager.googleapis.com/v1/projects/gerenteagro:setIamPolicy", { method: "POST", headers: H, body: JSON.stringify({ policy: pol }) });
  const j = await r.json();
  console.log(r.status === 200 ? "PRONTO: funções do app liberadas no banco do GerenteAgro (Cloud Datastore User)." : "ERRO: " + JSON.stringify(j.error || j).slice(0, 400));
})().catch((e) => console.log("ERRO:", e.message));
