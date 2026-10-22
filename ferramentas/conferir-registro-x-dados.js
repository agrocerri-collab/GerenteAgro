// Só leitura: para cada fazenda do GerenteAgro (e do AgroCR), o que o Registro de alterações diz
// que foi lançado nos últimos N dias × o que existe hoje em cada lista. Serve para achar
// "lançou e sumiu": registro de lançamento sem o documento correspondente.
const raiz = "C:/Users/DANIEL CERRI/Desktop/app agrocr/ferramentas/cli/node_modules/firebase-tools";
const { configstore } = require(raiz + "/lib/configstore"); const auth = require(raiz + "/lib/auth");
const DIAS = Number(process.argv[2] || 12);
const PROJ = process.argv[3] || "gerenteagro";
const COLS = ["compras", "recomendacoes", "execucoes", "chuvas", "lavoura", "visitas", "colheita", "custos", "ajustes", "entregas", "notas", "maquinas", "combustivel", "manutencoes", "funcionarios", "arquivos"];
const v = (f) => { if (!f) return undefined; const k = Object.keys(f)[0]; const x = f[k]; if (k === "integerValue" || k === "doubleValue") return Number(x); if (k === "arrayValue") return (x.values || []).map(v); if (k === "mapValue") return Object.fromEntries(Object.entries(x.fields || {}).map(([a, b]) => [a, v(b)])); return x; };
(async () => {
  const t = await auth.getAccessToken(configstore.get("tokens").refresh_token, []);
  const H = { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
  async function listar(caminho) {
    let out = [], tok = "";
    do {
      const r = await (await fetch(`${base}/${caminho}?pageSize=300${tok ? "&pageToken=" + tok : ""}`, { headers: H })).json();
      if (r.error) { console.log("erro", caminho, r.error.message); break; }
      out = out.concat((r.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([a, b]) => [a, v(b)])) })));
      tok = r.nextPageToken || "";
    } while (tok);
    return out;
  }
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();
  const fazendas = await listar("fazendas");
  const usuarios = await listar("usuarios");
  const nomeConta = (c) => { const u = usuarios.find((x) => x.id === c); return u ? (u.nome || u.nomeUsuario || u.email || c) : c; };
  console.log(`${PROJ}: ${fazendas.length} fazendas, ${usuarios.length} usuários; registros desde ${desde.slice(0, 10)}\n`);
  for (const f of fazendas) {
    const hist = (await listar(`fazendas/${f.id}/historico`)).filter((h) => (h.data || "") >= desde).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    const contagens = {};
    for (const c of COLS) { const l = await listar(`fazendas/${f.id}/${c}`); if (l.length) contagens[c] = l.length; }
    const lancamentos = hist.filter((h) => !/^Entrou no aplicativo/.test(h.acao || ""));
    if (!lancamentos.length && !Object.keys(contagens).length) continue;
    console.log(`## ${f.nome || f.id} (${f.id}) · conta ${nomeConta(f.conta)} · talhões ${(f.talhoes || []).length} · modelo ${!!f.modelo}`);
    console.log("   hoje:", Object.entries(contagens).map(([k, n]) => `${k}=${n}`).join(" ") || "(vazio)");
    for (const h of lancamentos) console.log(`   ${(h.data || "").slice(0, 16).replace("T", " ")} ${h.quem || "?"} · ${h.acao} — ${String(h.detalhe || "").slice(0, 90)}`);
    const entradas = hist.filter((h) => /^Entrou no aplicativo/.test(h.acao || "")).map((h) => (h.data || "").slice(5, 10) + " " + (h.quem || ""));
    if (entradas.length) console.log("   entradas:", [...new Set(entradas)].join(", "));
    console.log("");
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
