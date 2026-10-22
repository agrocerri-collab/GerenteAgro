// ============================================================
// Cópia de segurança AUTOMÁTICA, todo fim de dia (23:30 no Tocantins).
//
// Lê tudo o que está na nuvem dos DOIS aplicativos (AgroCR Campo e
// GerenteAgro), monta o mesmo arquivo .json que o botão "Cópia de
// segurança" do app gera, comprime (.gz) e manda por e-mail para a
// administração — uma cópia guardada FORA do Google, todo dia.
//
// Fotos, áudios e documentos anexados ficam de fora do e-mail (senão o
// arquivo passa do limite do Gmail): eles seguem protegidos pelo backup
// diário do próprio Firestore (7 a 14 dias) e pela recuperação por ponto
// no tempo. O e-mail traz todos os DADOS: fazendas, talhões, compras,
// recomendações, execuções, chuvas, colheita, custos, lavoura, visitas,
// programas, cadastros e licenças.
//
// Credenciais: as mesmas do envio manual (SMTP_USER / SMTP_PASS).
// Só existe no projeto agrocr-campo (é quem guarda os segredos).
// ============================================================
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const zlib = require("zlib");

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
// quem recebe a cópia de todo dia (pode ter mais de um, separados por vírgula)
const DESTINO = ["agrocerri@yahoo.com.br"];   // pedido do Daniel (15/09/2026): a cópia vai para o Yahoo, fora do Google
const LIMITE_ANEXO = 20 * 1024 * 1024;   // 20 MB — o Gmail para em 25

const SUBCOLECOES = ["talhoes", "compras", "recomendacoes", "execucoes", "chuvas",
  "colheita", "ajustes", "entregas", "historico", "lavoura", "visitas", "mapa", "documentos", "arquivos",
  "monitoramentos", "notas", "custos", "funcionarios", "diesel", "maquinas", "solo", "combustivel", "manutencoes", "almoxarifado", "nfe"];
// campos pesados (imagem/áudio em base64) que NÃO vão no e-mail
const PESADOS = new Set(["fotos", "img", "imagem", "foto", "audioB64", "fotosReais", "imagens"]);

// tira as fotos/áudios de qualquer profundidade; um documento "fotosMapa" ou
// "documentos" (arquivos anexados) vira só a contagem
function enxugar(v, chave) {
  if (v == null) return v;
  if (typeof v === "string") {
    if (v.startsWith("data:") && v.length > 200) return `[arquivo omitido no e-mail: ${Math.round(v.length * 0.75 / 1024)} KB]`;
    return v;
  }
  if (Array.isArray(v)) {
    if (PESADOS.has(chave)) return `[${v.length} foto(s)/arquivo(s) omitidos no e-mail]`;
    return v.map((x) => enxugar(x, chave));
  }
  if (typeof v === "object") {
    if (typeof v.toDate === "function") return v.toDate().toISOString();   // Timestamp do Firestore
    const o = {};
    for (const k of Object.keys(v)) o[k] = PESADOS.has(k) && typeof v[k] === "string" && v[k].length > 200 ? "[omitido no e-mail]" : enxugar(v[k], k);
    return o;
  }
  return v;
}

async function exportar(db, projeto) {
  const fazendas = [];
  const snapF = await db.collection("fazendas").get();
  for (const f of snapF.docs) {
    const item = { id: f.id, ...f.data(), _colecoes: {} };
    for (const nome of SUBCOLECOES) {
      const snap = await db.collection("fazendas").doc(f.id).collection(nome).get();
      if (!snap.empty) item._colecoes[nome] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    fazendas.push(item);
  }
  const usuarios = (await db.collection("usuarios").get()).docs.map((d) => { const { fcmTokens, ...resto } = d.data(); return { uid: d.id, ...resto }; });
  const config = {};
  for (const nome of ["grupos", "equipe", "fornecedores", "produtos", "adubos", "simulacoes", "trades", "cotacoes"]) {
    try { const doc = await db.collection("config").doc(nome).get(); if (doc.exists) config[nome] = doc.data().lista || doc.data(); } catch (e) {}
  }
  let licencas = [];
  try { licencas = (await db.collection("licencas").get()).docs.map((d) => ({ email: d.id, ...d.data() })); } catch (e) {}
  return enxugar({ geradoEm: new Date().toISOString(), projeto, automatico: true, semFotos: true, fazendas, usuarios, config, licencas });
}

function registrar(appGerenteAgro) {
  const backupDiario = onSchedule({ schedule: "every day 23:30", timeZone: "America/Araguaina", secrets: [SMTP_USER, SMTP_PASS], timeoutSeconds: 540, memory: "1GiB" }, async () => {
    const limpo = (s) => String(s || "").replace(/[\s"']/g, "");
    const usuario = limpo(SMTP_USER.value()), senha = limpo(SMTP_PASS.value());
    if (!usuario || usuario === "pendente" || !senha || senha === "pendente") { console.error("backupDiario: SMTP não configurado"); return; }
    const quando = new Date(Date.now() - 3 * 3600 * 1000);
    const dia = quando.toISOString().slice(0, 10);
    const diaBR = dia.split("-").reverse().join("/");
    const anexos = [], linhas = [];
    for (const [rotulo, db, projeto] of [["AgroCR Campo", getFirestore(), "agrocr-campo"], ["GerenteAgro", getFirestore(appGerenteAgro), "gerenteagro"]]) {
      try {
        const dados = await exportar(db, projeto);
        const json = JSON.stringify(dados);
        const gz = zlib.gzipSync(Buffer.from(json, "utf8"));
        const nF = dados.fazendas.length, nU = dados.usuarios.length;
        const nLanc = dados.fazendas.reduce((s, f) => s + Object.values(f._colecoes || {}).reduce((a, l) => a + l.length, 0), 0);
        linhas.push(`• ${rotulo}: ${nF} fazenda(s), ${nU} acesso(s), ${nLanc} lançamento(s) — ${Math.round(json.length / 1024)} KB (${Math.round(gz.length / 1024)} KB comprimido)`);
        if (gz.length > LIMITE_ANEXO) { linhas.push(`  ⚠ ${rotulo}: arquivo passou de 20 MB e não foi anexado`); continue; }
        anexos.push({ filename: `${projeto}-${dia}.json.gz`, content: gz, contentType: "application/gzip" });
        try { await db.collection("backupsEnviados").add({ uid: "automatico", para: DESTINO.join(","), nome: `${projeto}-${dia}.json.gz`, bytes: gz.length, quando: new Date().toISOString(), app: rotulo, automatico: true }); } catch (e) {}
      } catch (e) {
        console.error("backupDiario " + projeto + ":", e);
        linhas.push(`• ${rotulo}: FALHOU — ${e.message || e}`);
      }
    }
    const nodemailer = require("nodemailer");
    const transporte = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: usuario, pass: senha } });
    await transporte.sendMail({
      from: `"AgroCR Campo" <${usuario}>`,
      to: DESTINO.join(", "),
      subject: `Cópia de segurança automática — ${diaBR}`,
      text: `Cópia de segurança de todo fim de dia, gerada automaticamente em ${diaBR} às ${quando.toISOString().slice(11, 16)}.\n\n${linhas.join("\n")}\n\nCada anexo é o mesmo arquivo do botão "Cópia de segurança" do aplicativo, comprimido (.gz): para abrir, descompacte e o .json aparece. Fotos, áudios e documentos anexados não vão no e-mail (ficam no backup diário do próprio Firestore, com 14 dias de guarda, e na recuperação por ponto no tempo de 7 dias).\n\nGuarde estes e-mails: a partir deles a consultoria consegue restaurar os dados.`,
      attachments: anexos,
    });
    console.log("backupDiario enviado:", linhas.join(" | "));
  });
  return { backupDiario };
}

module.exports = { registrar, exportar, enxugar };
