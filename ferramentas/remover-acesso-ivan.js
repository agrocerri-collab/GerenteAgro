// GerenteAgro: remove o acesso do Ivan (ivan@focoagronegocios.com.br) — cadastro, licença e
// login — para ele se cadastrar de novo pelo link, normal (pedido do Daniel, 15/09/2026).
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const base = "https://firestore.googleapis.com/v1/projects/gerenteagro/databases/(default)/documents";
  const UID = "oCufdMUadfQ4Qj2jkaQAdBqjYAY2", EMAIL = "ivan@focoagronegocios.com.br";
  const u = await (await fetch(`${base}/usuarios/${UID}`, { headers: H })).json();
  if (!u.fields || (u.fields.email || {}).stringValue !== EMAIL) throw new Error("cadastro não é do Ivan: " + JSON.stringify(u).slice(0, 200));
  for (const cam of [`usuarios/${UID}`, `licencas/${EMAIL}`]) {
    const r = await fetch(`${base}/${cam}`, { method: "DELETE", headers: H });
    console.log(cam, r.ok ? "removido" : "ERRO " + r.status + " " + (await r.text()).slice(0, 200));
  }
  const a = await (await fetch("https://identitytoolkit.googleapis.com/v1/projects/gerenteagro/accounts:delete", { method: "POST", headers: H, body: JSON.stringify({ localId: UID }) })).json();
  console.log("login", a.error ? "ERRO " + a.error.message : "removido");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
