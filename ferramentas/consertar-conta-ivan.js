// GerenteAgro: o acesso do Ivan (ivan@focoagronegocios.com.br) foi criado em 06/09/2026 sem o
// campo "conta". A regra do servidor compara a conta da fazenda com a conta do usuário, então
// ele não via nada e nada que ele lançava ficava gravado. Este script carimba a conta do
// administrativo (dono da fazenda modelo a que ele tem acesso) no cadastro e na licença dele.
// Muda SÓ o campo "conta" desses dois documentos. Rodar uma vez:
//   ferramentas\node\node.exe ferramentas\consertar-conta-ivan.js
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const base = "https://firestore.googleapis.com/v1/projects/gerenteagro/databases/(default)/documents";
  const CONTA = "AEChKtFa9rVa7VwTRAGw2KvumO53";   // uid do administrativo@gerenteagro.com
  const fz = await (await fetch(`${base}/fazendas/modelo-s0s3hy6xebva?mask.fieldPaths=conta`, { headers: H })).json();
  if (!fz.fields || fz.fields.conta.stringValue !== CONTA) throw new Error("conta da fazenda modelo diferente do esperado: " + JSON.stringify(fz.fields));
  for (const cam of ["usuarios/oCufdMUadfQ4Qj2jkaQAdBqjYAY2", "licencas/ivan@focoagronegocios.com.br"]) {
    const r = await (await fetch(`${base}/${cam}?updateMask.fieldPaths=conta&currentDocument.exists=true`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { conta: { stringValue: CONTA } } }) })).json();
    console.log(cam, r.error ? "ERRO " + r.error.message : "conta gravada · atualizado " + r.updateTime);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
