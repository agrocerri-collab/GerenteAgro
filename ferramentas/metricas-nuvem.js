// Só leitura: rótulos completos das avaliações de regras (para separar leitura de gravação)
// e se existem logs de auditoria de acesso a dados do Firestore.
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const fim = new Date(), ini = new Date(Date.now() - 14 * 86400000);
  for (const proj of ["agrocr-campo", "gerenteagro"]) {
    console.log("\n==== " + proj);
    const p = new URLSearchParams({
      filter: `metric.type="firestore.googleapis.com/rules/evaluation_count" AND metric.label.result!="ALLOW"`,
      "interval.startTime": ini.toISOString(), "interval.endTime": fim.toISOString(),
      "aggregation.alignmentPeriod": "86400s", "aggregation.perSeriesAligner": "ALIGN_DELTA",
    });
    const r = await (await fetch(`https://monitoring.googleapis.com/v3/projects/${proj}/timeSeries?${p}`, { headers: H })).json();
    if (r.error) console.log("erro:", r.error.message);
    for (const s of r.timeSeries || []) {
      const rot = Object.entries({ ...(s.metric.labels || {}), ...(s.resource.labels || {}) }).filter(([k]) => !["project_id", "database_id"].includes(k)).map(([k, v]) => `${k}=${v}`).join(" ");
      const pts = (s.points || []).slice().reverse().map((x) => `${x.interval.endTime.slice(5, 10)}:${x.value.int64Value ?? x.value.doubleValue}`);
      console.log("  " + rot + " → " + pts.join("  "));
    }
    // descritor da métrica: quais rótulos existem
    const d = await (await fetch(`https://monitoring.googleapis.com/v3/projects/${proj}/metricDescriptors/firestore.googleapis.com/rules/evaluation_count`, { headers: H })).json();
    console.log("  rótulos da métrica:", (d.labels || []).map((l) => l.key + " (" + (l.description || "").slice(0, 60) + ")").join(" | "));
    // logs de auditoria de acesso a dados (gravações) — existem?
    const lg = await (await fetch("https://logging.googleapis.com/v2/entries:list", { method: "POST", headers: H, body: JSON.stringify({ resourceNames: ["projects/" + proj], filter: `protoPayload.serviceName="firestore.googleapis.com" AND (protoPayload.methodName:"Commit" OR protoPayload.methodName:"Write")`, orderBy: "timestamp desc", pageSize: 3 }) })).json();
    console.log("  logs de auditoria de gravação:", (lg.entries || []).length ? lg.entries.map((e) => e.timestamp + " " + e.protoPayload.methodName).join("; ") : "NENHUM (auditoria de acesso a dados desligada)", lg.error ? lg.error.message : "");
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
