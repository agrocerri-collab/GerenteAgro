// ============================================================
// SEFAZ — notas fiscais do produtor direto do Ambiente Nacional da NF-e
//
// O produtor guarda o certificado digital (A1, arquivo .pfx + senha) e o
// servidor passa a buscar, de tempo em tempo, todas as NF-e emitidas contra
// o CPF/CNPJ dele (serviço NFeDistribuicaoDFe). Cada nota entra na fazenda
// certa (pela inscrição estadual do destinatário) como PENDENTE, e a pessoa
// só destina no aplicativo.
//
// Segurança: o .pfx e a senha nunca ficam legíveis no banco — são cifrados
// com AES-256-GCM usando a chave secreta CERT_KEY (Firebase Secret). A
// coleção certificados/{uid} é proibida para o aplicativo pelas regras;
// só este código lê.
//
// Como a SEFAZ funciona (NT 2014.002): a distribuição devolve primeiro um
// RESUMO da nota (resNFe: emitente, valor, data). A nota COMPLETA (procNFe,
// com os itens) só vem depois que o destinatário registra o evento
// "Ciência da Operação" (210210). Por isso existe a ação "ciencia".
// ============================================================
const https = require("https");
const zlib = require("zlib");
const crypto = require("crypto");
const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const CERT_KEY = defineSecret("CERT_KEY");
const URL_DIST = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const URL_EVENTO = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
// Consulta cadastro (CadConsultaCadastro4): dado o CPF/CNPJ, a SEFAZ devolve
// todas as inscrições estaduais da pessoa naquela UF. Tocantins e várias UFs
// usam o SVRS; as outras têm o próprio endereço.
const URL_CAD_SVRS = "https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx";
const URL_CADASTRO = {
  AC: URL_CAD_SVRS, AL: URL_CAD_SVRS, AP: URL_CAD_SVRS, CE: URL_CAD_SVRS, DF: URL_CAD_SVRS, ES: URL_CAD_SVRS, PB: URL_CAD_SVRS, PI: URL_CAD_SVRS,
  RJ: URL_CAD_SVRS, RN: URL_CAD_SVRS, RO: URL_CAD_SVRS, RR: URL_CAD_SVRS, RS: URL_CAD_SVRS, SC: URL_CAD_SVRS, SE: URL_CAD_SVRS, TO: URL_CAD_SVRS,
  GO: "https://nfe.sefaz.go.gov.br/nfe/services/CadConsultaCadastro4",
  MT: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/CadConsultaCadastro4",
  MS: "https://nfe.sefaz.ms.gov.br/ws/CadConsultaCadastro4",
  BA: "https://nfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx",
  MG: "https://nfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4",
  PR: "https://nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4",
  SP: "https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx",
  PE: "https://nfe.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4",
  MA: "https://sistemas.sefaz.ma.gov.br/wscadastro/CadConsultaCadastro4",
};
const UF_PADRAO = "17";   // Tocantins

// ---------- cifra do certificado ----------
function chaveCifra() {
  const bruto = String(CERT_KEY.value() || "").replace(/^﻿/, "").trim();
  if (!bruto) throw new Error("CERT_KEY não configurada");
  return crypto.createHash("sha256").update(bruto).digest();
}
function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chaveCifra(), iv);
  const dados = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(":");
}
function decifrar(pacote) {
  const [iv, tag, dados] = String(pacote).split(":").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", chaveCifra(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

// ---------- certificado .pfx → chave, cert, CPF/CNPJ, validade ----------
function abrirPfx(pfxBase64, senha) {
  const der = forge.util.decode64(String(pfxBase64).replace(/^data:[^,]*,/, ""));
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, senha);
  let cert = null, chave = null;
  for (const safe of p12.safeContents) {
    for (const bag of safe.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert && !cert) cert = bag.cert;
      if ((bag.type === forge.pki.oids.pkcs8ShroudedKeyBag || bag.type === forge.pki.oids.keyBag) && bag.key && !chave) chave = bag.key;
    }
  }
  // quando há uma cadeia, o certificado do titular é o que tem chave privada correspondente
  if (!cert || !chave) throw new Error("não achei certificado e chave privada dentro do arquivo");
  const cn = (cert.subject.getField("CN") || {}).value || "";
  // e-CPF/e-CNPJ trazem o documento no CN ("NOME:12345678901") ou no otherName
  let doc = (cn.match(/:(\d{11}|\d{14})\s*$/) || [])[1] || "";
  if (!doc) {
    try {
      const san = cert.getExtension("subjectAltName");
      for (const alt of (san && san.altNames) || []) {
        const s = String(alt.value || "");
        const m = s.match(/(\d{8})(\d{11})/);      // otherName ICP-Brasil: data de nascimento + CPF
        if (alt.typeId === "2.16.76.1.3.1" && m) { doc = m[2]; break; }
        const m2 = s.match(/(\d{14})/);
        if (alt.typeId === "2.16.76.1.3.3" && m2) { doc = m2[1]; break; }
      }
    } catch (e) { /* segue sem documento; a pessoa informa */ }
  }
  return {
    nome: cn.split(":")[0].trim(), doc,
    validade: cert.validity.notAfter.toISOString().slice(0, 10),
    certPem: forge.pki.certificateToPem(cert),
    chavePem: forge.pki.privateKeyToPem(chave),
  };
}

// ---------- chamada SOAP com o certificado do produtor ----------
// Os servidores das SEFAZ estaduais (SVRS etc.) usam certificado da cadeia
// ICP-Brasil, que o Node não conhece de fábrica ("unable to get local issuer
// certificate"). As raízes v10 e v5 vão junto com a função (icp-brasil.pem).
const fs = require("fs");
const tls = require("tls");
const path = require("path");
const CA_ICP = (() => { try { return fs.readFileSync(path.join(__dirname, "icp-brasil.pem"), "utf8").split(/(?=-----BEGIN CERTIFICATE-----)/).filter((x) => x.trim()); } catch (e) { return []; } })();
const CAS = [...tls.rootCertificates, ...CA_ICP];
function soap(url, corpoXml, pfxBuffer, senha) {
  return new Promise((ok, erro) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: "POST", pfx: pfxBuffer, passphrase: senha, minVersion: "TLSv1.2", ca: CAS,
      headers: { "Content-Type": "application/soap+xml; charset=utf-8", "Content-Length": Buffer.byteLength(corpoXml) },
      timeout: 60000,
    }, (res) => {
      const partes = [];
      res.on("data", (d) => partes.push(d));
      res.on("end", () => ok({ status: res.statusCode, corpo: Buffer.concat(partes).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("a SEFAZ não respondeu em 60 s")));
    req.on("error", erro);
    req.write(corpoXml);
    req.end();
  });
}
const tag = (xml, nome) => { const m = String(xml || "").match(new RegExp("<" + nome + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + nome + ">")); return m ? m[1].trim() : ""; };
const numero = (s) => { const v = parseFloat(String(s || "").replace(",", ".")); return isFinite(v) ? v : 0; };
const UNIDADES = { LT: "L", L: "L", LTS: "L", LITRO: "L", KG: "kg", KGS: "kg", TN: "t", TON: "t", T: "t", UN: "un", UND: "un", UNID: "un", PC: "un", PCS: "un", FR: "un", BD: "un", SC: "sc", SAC: "sc", SACO: "sc", SACA: "sc", CX: "cx", BG: "bag", BAG: "bag", GL: "gal", ML: "mL", G: "g", M: "m", PAR: "par" };
const unidade = (u) => UNIDADES[String(u || "").trim().toUpperCase()] || (String(u || "").trim().toLowerCase() || "un");

// resumo (resNFe) → nota pendente sem itens
function notaDoResumo(xml) {
  return {
    chave: tag(xml, "chNFe"), numero: tag(xml, "chNFe").slice(25, 34).replace(/^0+/, ""), serie: tag(xml, "chNFe").slice(22, 25).replace(/^0+/, ""),
    data: (tag(xml, "dhEmi") || "").slice(0, 10), emitente: tag(xml, "xNome"), cnpjEmitente: tag(xml, "CNPJ") || tag(xml, "CPF"),
    valorTotal: numero(tag(xml, "vNF")), situacao: tag(xml, "cSitNFe"), tipo: tag(xml, "tpNF"), itens: [], duplicatas: [], completa: false, origem: "sefaz",
  };
}
// nota completa (procNFe / NFe) → itens, destinatário e duplicatas (vencimentos)
function notaCompleta(xml) {
  const inf = tag(xml, "infNFe") || xml;
  const idm = String(xml).match(/<infNFe[^>]*Id="NFe(\d{44})"/);
  const ide = tag(inf, "ide"), emit = tag(inf, "emit"), dest = tag(inf, "dest"), cobr = tag(inf, "cobr");
  const itens = [];
  const re = /<det\s[^>]*>([\s\S]*?)<\/det>/g; let m; let i = 0;
  while ((m = re.exec(inf))) {
    const p = tag(m[1], "prod"); i++;
    itens.push({ n: i, descricao: tag(p, "xProd"), qtd: numero(tag(p, "qCom")), unidade: unidade(tag(p, "uCom")), valorUnit: numero(tag(p, "vUnCom")), valorTotal: numero(tag(p, "vProd")), ncm: tag(p, "NCM"), cfop: tag(p, "CFOP"), destino: "", categoriaInsumo: "" });
  }
  const duplicatas = [];
  const rd = /<dup>([\s\S]*?)<\/dup>/g;
  while ((m = rd.exec(cobr))) duplicatas.push({ n: tag(m[1], "nDup"), venc: tag(m[1], "dVenc"), valor: numero(tag(m[1], "vDup")) });
  return {
    chave: idm ? idm[1] : "", numero: tag(ide, "nNF"), serie: tag(ide, "serie"), data: (tag(ide, "dhEmi") || tag(ide, "dEmi")).slice(0, 10),
    emitente: tag(emit, "xNome"), cnpjEmitente: tag(emit, "CNPJ") || tag(emit, "CPF"),
    destinatario: tag(dest, "xNome"), docDest: tag(dest, "CNPJ") || tag(dest, "CPF"), ieDest: tag(dest, "IE"),
    valorTotal: numero(tag(tag(inf, "total"), "vNF")) || itens.reduce((s, x) => s + x.valorTotal, 0),
    vencimento: duplicatas.length ? duplicatas.map((d) => d.venc).filter(Boolean).sort()[0] || null : null,
    itens, duplicatas, completa: true, origem: "sefaz",
  };
}

// ---------- quem chama (AgroCR ou GerenteAgro) ----------
async function quemChama(req, appGerenteAgro) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try { const q = await getAuth().verifyIdToken(token); return { uid: q.uid, db: getFirestore(), projeto: "agrocr" }; } catch (e) {}
  try { const q = await getAuth(appGerenteAgro).verifyIdToken(token); return { uid: q.uid, db: getFirestore(appGerenteAgro), projeto: "gerenteagro" }; } catch (e) {}
  return null;
}
const publico = (c) => ({ apelido: c.apelido || "", nome: c.nome || "", doc: c.doc || "", validade: c.validade || "", fazendaPadrao: c.fazendaPadrao || "", ultimaBusca: c.ultimaBusca || null, ultimoStatus: c.ultimoStatus || "", totalNotas: c.totalNotas || 0, ultNSU: c.ultNSU || "0", proximaBuscaApos: c.proximaBuscaApos || null, uf: c.uf || UF_PADRAO });

// ---------- a busca em si ----------
async function buscarNotas(db, uid, certDoc, opcoes) {
  const c = certDoc.data();
  const pfx = Buffer.from(decifrar(c.pfx), "base64");
  const senha = decifrar(c.senha);
  const doc = String(c.doc || "").replace(/\D/g, "");
  if (!(doc.length === 11 || doc.length === 14)) throw new Error("CPF/CNPJ do certificado não identificado — informe no cadastro");
  // A SEFAZ devolve 656 (consumo indevido) se a mesma consulta se repetir em
  // menos de 1 hora sem documento novo — por isso o intervalo vale até para o
  // botão "buscar agora"; a busca automática de 3 em 3 horas cobre o resto.
  if (c.proximaBuscaApos && c.proximaBuscaApos > new Date().toISOString()) {
    const local = new Date(new Date(c.proximaBuscaApos).getTime() - 3 * 3600 * 1000);
    return { pulou: true, proximaBuscaApos: c.proximaBuscaApos, motivo: "A SEFAZ só aceita uma nova busca 1 hora depois da anterior sem novidade. A próxima pode ser feita a partir das " + local.toISOString().slice(11, 16) + " (horário de Brasília); a busca automática também tenta de 3 em 3 horas." };
  }
  // fazendas do produtor: para onde vai cada nota (pela IE do destinatário)
  const mapaIe = c.mapaIe || {};
  const fazendaPadrao = c.fazendaPadrao;
  if (!fazendaPadrao) throw new Error("escolha a fazenda padrão das notas");
  const cacheFazenda = {};
  const safraDe = async (fid) => {
    if (cacheFazenda[fid]) return cacheFazenda[fid];
    const f = await db.collection("fazendas").doc(fid).get();
    // mesma regra do aplicativo: safraAtual, senão a última das safras, senão a safra padrão
    // (fazenda antiga sem o campo). Sem isso a nota ficava com safra vazia e não aparecia.
    const SAFRA_PADRAO = "2026/2027";
    cacheFazenda[fid] = (f.exists && (f.data().safraAtual || (f.data().safras || []).slice(-1)[0])) || SAFRA_PADRAO;
    return cacheFazenda[fid];
  };
  let ultNSU = String(c.ultNSU || "0").padStart(15, "0");
  let novas = 0, atualizadas = 0, completas = 0, resumos = 0, voltas = 0, ultimoStat = "", ultimoMotivo = "";
  let esperar = null;
  while (voltas < 12) {
    voltas++;
    const docTag = doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`;
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${c.uf || UF_PADRAO}</cUFAutor>${docTag}<distNSU><ultNSU>${ultNSU}</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
    const r = await soap(URL_DIST, xml, pfx, senha);
    if (r.status !== 200) throw new Error(`SEFAZ respondeu HTTP ${r.status}: ${r.corpo.slice(0, 200)}`);
    const ret = tag(r.corpo, "retDistDFeInt");
    ultimoStat = tag(ret, "cStat"); ultimoMotivo = tag(ret, "xMotivo");
    if (ultimoStat === "656") {          // consumo indevido: espera 1 h
      esperar = new Date(Date.now() + 3600 * 1000).toISOString();
      break;
    }
    if (ultimoStat !== "138" && ultimoStat !== "137") throw new Error(`SEFAZ ${ultimoStat}: ${ultimoMotivo}`);
    const docs = [];
    const rz = /<docZip\s+NSU="(\d+)"\s+schema="([^"]+)">([\s\S]*?)<\/docZip>/g; let m;
    while ((m = rz.exec(ret))) docs.push({ nsu: m[1], schema: m[2], xml: zlib.gunzipSync(Buffer.from(m[3].trim(), "base64")).toString("utf8") });
    for (const d of docs) {
      let nota = null;
      if (/^resNFe/.test(d.schema)) nota = notaDoResumo(d.xml);
      else if (/^procNFe|^nfeProc/.test(d.schema)) nota = notaCompleta(d.xml);
      else continue;                    // eventos (cancelamento etc.) ficam para depois
      if (!nota.chave) continue;
      if (nota.tipo === "0") { /* entrada: nota de devolução/entrada emitida contra ele — entra igual */ }
      const ie = String(nota.ieDest || "").replace(/\D/g, "");
      const fid = (ie && mapaIe[ie]) || fazendaPadrao;
      const ref = db.collection("fazendas").doc(fid).collection("notas").doc(nota.chave);
      const atual = await ref.get();
      if (!atual.exists) {
        await ref.set({ ...nota, id: nota.chave, nsu: d.nsu, status: "pendente", ciclo: "Safra", pago: false, quem: "SEFAZ", criadoEm: new Date().toISOString(), safra: await safraDe(fid) });
        novas++; if (nota.completa) completas++; else resumos++;
      } else if (nota.completa && !atual.data().completa) {
        // resumo vira nota completa: entram os itens, sem mexer no que a pessoa já destinou
        const mud = { itens: nota.itens, duplicatas: nota.duplicatas, vencimento: nota.vencimento || atual.data().vencimento || null, destinatario: nota.destinatario, docDest: nota.docDest, ieDest: nota.ieDest, numero: nota.numero, serie: nota.serie, completa: true, nsu: d.nsu };
        if (atual.data().status === "destinada") delete mud.itens;
        await ref.set(mud, { merge: true });
        atualizadas++; completas++;
      }
    }
    const novoUlt = tag(ret, "ultNSU").padStart(15, "0"), maxNSU = tag(ret, "maxNSU").padStart(15, "0");
    ultNSU = novoUlt;
    if (ultimoStat === "137" || !docs.length || novoUlt >= maxNSU) break;
  }
  const ultimoStatus = esperar ? "656 · a SEFAZ pediu 1 hora de intervalo (consulta repetida)" : ultimoStat === "137" ? "137 · nenhuma NF-e nova para este CPF/CNPJ na SEFAZ" : `${ultimoStat} · ${ultimoMotivo} · ${novas} nova${novas === 1 ? "" : "s"}${atualizadas ? `, ${atualizadas} completada${atualizadas === 1 ? "" : "s"}` : ""}`;
  await certDoc.ref.set({ ultNSU: ultNSU.replace(/^0+/, "") || "0", ultimaBusca: new Date().toISOString(), ultimoStatus, proximaBuscaApos: esperar || (ultimoStat === "137" ? new Date(Date.now() + 3600 * 1000).toISOString() : null), totalNotas: FieldValue.increment(novas) }, { merge: true });
  return { novas, atualizadas, completas, resumos, cStat: ultimoStat, xMotivo: ultimoMotivo, esperar };
}

// ---------- ciência da operação (libera a nota completa) ----------
async function darCiencia(certDoc, chave) {
  const c = certDoc.data();
  const pfxB64 = decifrar(c.pfx), senha = decifrar(c.senha);
  const { certPem, chavePem } = abrirPfx(pfxB64, senha);
  const doc = String(c.doc || "").replace(/\D/g, "");
  const docTag = doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`;
  const agora = new Date();
  const fuso = -3;   // Brasília/Araguaína
  const local = new Date(agora.getTime() + fuso * 3600 * 1000);
  const dh = local.toISOString().slice(0, 19) + (fuso < 0 ? "-" : "+") + String(Math.abs(fuso)).padStart(2, "0") + ":00";
  const id = `ID210210${chave}01`;
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${id}"><cOrgao>91</cOrgao><tpAmb>1</tpAmb>${docTag}<chNFe>${chave}</chNFe><dhEvento>${dh}</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento>`;
  const sig = new SignedXml({
    privateKey: chavePem, publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });
  sig.computeSignature(evento, { location: { reference: "//*[local-name(.)='infEvento']", action: "after" } });
  const assinado = sig.getSignedXml();
  const lote = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${String(Date.now()).slice(-15)}</idLote>${assinado}</envEvento>`;
  const xml = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${lote}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const r = await soap(URL_EVENTO, xml, Buffer.from(pfxB64, "base64"), senha);
  if (r.status !== 200) throw new Error(`SEFAZ respondeu HTTP ${r.status}: ${r.corpo.slice(0, 200)}`);
  const inf = tag(tag(r.corpo, "retEvento"), "infEvento") || tag(r.corpo, "retEnvEvento");
  const cStat = tag(inf, "cStat"), xMotivo = tag(inf, "xMotivo");
  // 135 = registrado; 573 = já havia ciência (também serve)
  if (!["135", "136", "573"].includes(cStat)) throw new Error(`SEFAZ ${cStat}: ${xMotivo}`);
  return { cStat, xMotivo };
}

// ---------- consulta cadastro: CPF/CNPJ → inscrições estaduais na UF ----------
async function consultarCadastro(certDoc, docConsulta, uf) {
  const c = certDoc.data();
  const pfx = Buffer.from(decifrar(c.pfx), "base64");
  const senha = decifrar(c.senha);
  const doc = String(docConsulta || c.doc || "").replace(/\D/g, "");
  if (!(doc.length === 11 || doc.length === 14)) throw new Error("informe um CPF (11 dígitos) ou CNPJ (14)");
  const UF = String(uf || c.uf || "TO").toUpperCase();
  const url = URL_CADASTRO[UF];
  if (!url) throw new Error(`ainda não sei consultar o cadastro de ${UF} — me avise a UF`);
  const docTag = doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`;
  const xml = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4"><ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="2.00"><infCons><xServ>CONS-CAD</xServ><UF>${UF}</UF>${docTag}</infCons></ConsCad></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const r = await soap(url, xml, pfx, senha);
  if (r.status !== 200) throw new Error(`SEFAZ ${UF} respondeu HTTP ${r.status}: ${r.corpo.slice(0, 200)}`);
  const ret = tag(r.corpo, "retConsCad") || r.corpo;
  const cStat = tag(ret, "cStat"), xMotivo = tag(ret, "xMotivo");
  // 111 = uma inscrição, 112 = mais de uma; qualquer outra coisa é aviso/erro da SEFAZ
  const inscricoes = [];
  const re = /<infCad>([\s\S]*?)<\/infCad>/g; let m;
  while ((m = re.exec(ret))) {
    const x = m[1]; const ender = tag(x, "ender");
    const sit = tag(x, "cSit");
    inscricoes.push({
      ie: tag(x, "IE"), doc: tag(x, "CNPJ") || tag(x, "CPF"), nome: tag(x, "xNome"), fantasia: tag(x, "xFant"),
      situacao: sit === "1" ? "habilitada" : sit === "0" ? "não habilitada" : sit, uf: tag(x, "UF") || UF,
      municipio: tag(ender, "xMun"), endereco: [tag(ender, "xLgr"), tag(ender, "nro"), tag(ender, "xBairro")].filter(Boolean).join(", "),
      cnae: tag(x, "CNAE"), regime: tag(x, "xRegApur"), inicio: tag(x, "dIniAtiv"),
    });
  }
  return { cStat, xMotivo, uf: UF, doc, inscricoes };
}

// ---------- ponto de entrada HTTP: acao = guardar | status | remover | buscar | ciencia | configurar | cadastro ----------
function registrar(appGerenteAgro) {
  const sefaz = onRequest({ cors: true, secrets: [CERT_KEY], timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
    try {
      if (req.method !== "POST") { res.status(405).json({ erro: "use POST" }); return; }
      const quem = await quemChama(req, appGerenteAgro);
      if (!quem) { res.status(401).json({ erro: "entre na sua conta" }); return; }
      const corpo = req.body || {};
      const acao = String(corpo.acao || "status");
      const ref = quem.db.collection("certificados").doc(quem.uid);
      const certDoc = await ref.get();

      if (acao === "status") { res.json({ certificado: certDoc.exists ? publico(certDoc.data()) : null }); return; }

      if (acao === "guardar") {
        const pfx = String(corpo.pfx || "").replace(/^data:[^,]*,/, "");
        const senha = String(corpo.senha || "");
        if (!pfx || !senha) { res.status(400).json({ erro: "mande o arquivo .pfx e a senha" }); return; }
        let info;
        try { info = abrirPfx(pfx, senha); }
        catch (e) { res.status(400).json({ erro: "não consegui abrir o certificado: senha errada ou arquivo inválido (" + (e.message || e) + ")" }); return; }
        if (info.validade < new Date().toISOString().slice(0, 10)) { res.status(400).json({ erro: `este certificado venceu em ${info.validade}` }); return; }
        const docInformado = String(corpo.doc || "").replace(/\D/g, "");
        const dados = {
          apelido: String(corpo.apelido || info.nome || "").slice(0, 80), nome: info.nome, doc: info.doc || docInformado, validade: info.validade,
          pfx: cifrar(pfx), senha: cifrar(senha), fazendaPadrao: String(corpo.fazendaPadrao || (certDoc.exists && certDoc.data().fazendaPadrao) || ""),
          mapaIe: corpo.mapaIe && typeof corpo.mapaIe === "object" ? corpo.mapaIe : ((certDoc.exists && certDoc.data().mapaIe) || {}),
          uf: String(corpo.uf || UF_PADRAO), ultNSU: certDoc.exists ? certDoc.data().ultNSU || "0" : "0", projeto: quem.projeto, atualizadoEm: new Date().toISOString(),
        };
        await ref.set(dados, { merge: true });
        res.json({ ok: true, certificado: publico(dados) });
        return;
      }

      if (!certDoc.exists) { res.status(404).json({ erro: "nenhum certificado guardado nesta conta" }); return; }

      if (acao === "configurar") {   // fazenda padrão, mapa de IEs, UF, documento — sem mexer no certificado
        const mud = {};
        if (corpo.fazendaPadrao) mud.fazendaPadrao = String(corpo.fazendaPadrao);
        if (corpo.mapaIe && typeof corpo.mapaIe === "object") mud.mapaIe = corpo.mapaIe;
        if (corpo.uf) mud.uf = String(corpo.uf);
        if (corpo.doc) mud.doc = String(corpo.doc).replace(/\D/g, "");
        if (corpo.zerarNSU) { mud.ultNSU = "0"; mud.proximaBuscaApos = null; }
        await ref.set(mud, { merge: true });
        res.json({ ok: true, certificado: publico({ ...certDoc.data(), ...mud }) });
        return;
      }
      if (acao === "remover") { await ref.delete(); res.json({ ok: true }); return; }
      if (acao === "buscar") {
        const r = await buscarNotas(quem.db, quem.uid, certDoc, { forcar: !!corpo.forcar });
        res.json({ ok: true, ...r });
        return;
      }
      if (acao === "cadastro") {
        if (!certDoc.exists) { res.status(400).json({ erro: "guarde o certificado primeiro" }); return; }
        const r = await consultarCadastro(certDoc, corpo.doc, corpo.uf);
        res.json({ ok: true, ...r });
        return;
      }
      if (acao === "ciencia") {
        const chave = String(corpo.chave || "").replace(/\D/g, "");
        if (chave.length !== 44) { res.status(400).json({ erro: "chave da nota inválida" }); return; }
        const r = await darCiencia(certDoc, chave);
        // marca na nota, para a tela mostrar que a SEFAZ vai liberar os itens
        if (corpo.fazendaId) await quem.db.collection("fazendas").doc(String(corpo.fazendaId)).collection("notas").doc(chave).set({ ciencia: new Date().toISOString() }, { merge: true }).catch(() => {});
        // libera a próxima busca já (a nota completa costuma vir em seguida)
        await ref.set({ proximaBuscaApos: null }, { merge: true });
        res.json({ ok: true, ...r });
        return;
      }
      res.status(400).json({ erro: "ação desconhecida" });
    } catch (e) {
      console.error("sefaz:", e);
      res.status(500).json({ erro: e.message || String(e) });
    }
  });

  // de 3 em 3 horas, busca para todo mundo que guardou certificado (nos dois apps)
  const sefazAgendado = onSchedule({ schedule: "every 3 hours", timeZone: "America/Araguaina", secrets: [CERT_KEY], timeoutSeconds: 540, memory: "512MiB" }, async () => {
    for (const db of [getFirestore(), getFirestore(appGerenteAgro)]) {
      let certs;
      try { certs = await db.collection("certificados").get(); } catch (e) { continue; }
      for (const d of certs.docs) {
        try { const r = await buscarNotas(db, d.id, d, { forcar: false }); console.log("sefaz agendado", d.id, JSON.stringify(r)); }
        catch (e) { console.warn("sefaz agendado", d.id, e.message); await d.ref.set({ ultimoStatus: "erro: " + (e.message || e), ultimaBusca: new Date().toISOString() }, { merge: true }).catch(() => {}); }
      }
    }
  });
  return { sefaz, sefazAgendado };
}

module.exports = { registrar, lerXmlCompleto: notaCompleta, quemChama, abrirPfx, decifrar, soap, tag, CERT_KEY };
