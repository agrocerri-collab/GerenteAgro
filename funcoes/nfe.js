// ============================================================
// Emissão de NF-e (modelo 55) pelo produtor, com o certificado A1 dele.
//   emitir   → monta o XML 4.00, assina infNFe, manda para o autorizador
//              da UF (síncrono), guarda em fazendas/{fid}/nfe/{chave}
//   consultar→ situação da nota na SEFAZ
//   cancelar → evento 110111 (precisa do protocolo e justificativa ≥ 15 letras)
// Homologação (tpAmb 2) e produção (tpAmb 1) pelo campo "ambiente".
// O certificado é o do usuário logado (certificados/{uid}); o emitente da
// nota TEM que ser o titular do certificado — a SEFAZ recusa se não for.
// Impostos: o app oferece presets (produtor rural pessoa física: ICMS
// diferido / isento / tributado; PIS-COFINS sem incidência). O contador do
// produtor confirma o CST/CFOP — a função não inventa regra fiscal.
// ============================================================
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { SignedXml } = require("xml-crypto");
const S = require("./sefaz");

const CUF = { RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53" };
// autorizador de cada UF (SVRS atende Tocantins e várias outras)
const SVRS = (h) => ({
  aut: `https://${h}/ws/NfeAutorizacao/NFeAutorizacao4.asmx`,
  ret: `https://${h}/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx`,
  cons: `https://${h}/ws/NfeConsulta/NfeConsulta4.asmx`,
  evento: `https://${h}/ws/recepcaoevento/recepcaoevento4.asmx`,
});
const WS = {
  SVRS: { prod: SVRS("nfe.svrs.rs.gov.br"), hom: SVRS("nfe-homologacao.svrs.rs.gov.br") },
  GO: {
    prod: { aut: "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4", ret: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4", cons: "https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4", evento: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4" },
    hom: { aut: "https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4", ret: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4", cons: "https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4", evento: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4" },
  },
  MT: {
    prod: { aut: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4", ret: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4", cons: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4", evento: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4" },
    hom: { aut: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4", ret: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4", cons: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4", evento: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4" },
  },
};
const AUTORIZADOR = { AC: "SVRS", AL: "SVRS", AP: "SVRS", CE: "SVRS", DF: "SVRS", ES: "SVRS", PA: "SVRS", PB: "SVRS", PI: "SVRS", RJ: "SVRS", RN: "SVRS", RO: "SVRS", RR: "SVRS", RS: "SVRS", SC: "SVRS", SE: "SVRS", TO: "SVRS", GO: "GO", MT: "MT" };
const wsDe = (uf, ambiente) => {
  const a = AUTORIZADOR[uf];
  if (!a) throw new Error(`ainda não emito NF-e para ${uf} — me avise a UF`);
  return WS[a][ambiente === "prod" ? "prod" : "hom"];
};

// ---------- utilidades ----------
const so = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
// texto SEM acento/caracteres especiais e sem espaços duplos — a SEFAZ rejeita
const txt = (v, max) => esc(String(v == null ? "" : v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim().slice(0, max || 60));
const dec = (n, casas) => (Math.round(Number(n || 0) * Math.pow(10, casas)) / Math.pow(10, casas)).toFixed(casas);
const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; };
const t = (nome, valor) => (valor === "" || valor == null ? "" : `<${nome}>${valor}</${nome}>`);
function dvMod11(chave43) {
  let peso = 2, soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) { soma += Number(chave43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
const agoraBrasil = () => {
  const fuso = -3, d = new Date(new Date().getTime() + fuso * 3600 * 1000);
  return d.toISOString().slice(0, 19) + "-03:00";
};

// ---------- monta o XML da NF-e ----------
function montarNFe(d) {
  const emit = d.emit || {}, dest = d.dest || {};
  const ufEmit = String(emit.uf || "TO").toUpperCase(), ufDest = String(dest.uf || ufEmit).toUpperCase();
  const cUF = CUF[ufEmit]; if (!cUF) throw new Error("UF do emitente inválida");
  const docEmit = so(emit.doc); if (!(docEmit.length === 11 || docEmit.length === 14)) throw new Error("CPF/CNPJ do emitente inválido");
  if (!so(emit.ie)) throw new Error("informe a inscrição estadual do emitente (Dados fiscais)");
  if (!so(emit.cMun) || so(emit.cMun).length !== 7) throw new Error("informe o município do emitente (código IBGE de 7 dígitos)");
  const docDest = so(dest.doc);
  const hom = d.ambiente !== "prod";
  const tpAmb = hom ? "2" : "1";
  const serie = String(Math.max(1, Math.min(999, Math.round(num(d.serie) || 1))));
  const nNF = String(Math.round(num(d.numero))); if (!(num(d.numero) >= 1)) throw new Error("número da nota inválido");
  const dhEmi = agoraBrasil();
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const chave43 = cUF + aamm + docEmit.padStart(14, "0") + "55" + serie.padStart(3, "0") + nNF.padStart(9, "0") + "1" + cNF;
  const chave = chave43 + dvMod11(chave43);
  const idDest = ufDest === ufEmit ? "1" : "2";
  const itens = (d.itens || []).filter((i) => i && (i.descricao || "").trim() && num(i.qtd) > 0);
  if (!itens.length) throw new Error("a nota precisa de pelo menos um item com quantidade");
  const icms = d.icms || {}; const cst = String(icms.cst || "41"); const pIcms = num(icms.aliq);
  const pisCst = String((d.pis && d.pis.cst) || "08");
  let vProdT = 0, vBCT = 0, vICMST = 0, vPIST = 0, vCOFINST = 0, vDescT = 0, vFreteT = 0;
  const det = itens.map((i, k) => {
    const q = num(i.qtd), vu = num(i.valorUnit), vDesc = num(i.desconto);
    const vProd = Math.round(q * vu * 100) / 100;
    vProdT += vProd; vDescT += vDesc;
    const base = Math.max(0, vProd - vDesc);
    let icmsXml = "";
    if (cst === "00") { const v = Math.round(base * pIcms) / 100; vBCT += base; vICMST += v; icmsXml = `<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${dec(base, 2)}</vBC><pICMS>${dec(pIcms, 2)}</pICMS><vICMS>${dec(v, 2)}</vICMS></ICMS00>`; }
    else if (cst === "51") { const vOp = Math.round(base * pIcms) / 100; vBCT += base; icmsXml = `<ICMS51><orig>0</orig><CST>51</CST><modBC>3</modBC><vBC>${dec(base, 2)}</vBC><pICMS>${dec(pIcms, 2)}</pICMS><vICMSOp>${dec(vOp, 2)}</vICMSOp><pDif>100.0000</pDif><vICMSDif>${dec(vOp, 2)}</vICMSDif><vICMS>0.00</vICMS></ICMS51>`; }
    else if (cst === "40" || cst === "41" || cst === "50") icmsXml = `<ICMS40><orig>0</orig><CST>${cst}</CST></ICMS40>`;
    else if (cst === "60") icmsXml = `<ICMS60><orig>0</orig><CST>60</CST></ICMS60>`;
    else icmsXml = `<ICMS90><orig>0</orig><CST>90</CST></ICMS90>`;
    let pisXml, cofXml;
    if (pisCst === "01") { const vp = Math.round(base * 0.65) / 100, vc = Math.round(base * 3) / 100; vPIST += vp; vCOFINST += vc; pisXml = `<PISAliq><CST>01</CST><vBC>${dec(base, 2)}</vBC><pPIS>0.65</pPIS><vPIS>${dec(vp, 2)}</vPIS></PISAliq>`; cofXml = `<COFINSAliq><CST>01</CST><vBC>${dec(base, 2)}</vBC><pCOFINS>3.00</pCOFINS><vCOFINS>${dec(vc, 2)}</vCOFINS></COFINSAliq>`; }
    else if (["04", "05", "06", "07", "08", "09"].includes(pisCst)) { pisXml = `<PISNT><CST>${pisCst}</CST></PISNT>`; cofXml = `<COFINSNT><CST>${pisCst}</CST></COFINSNT>`; }
    else { pisXml = `<PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr>`; cofXml = `<COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr>`; }
    const un = txt(i.unidade || "KG", 6).toUpperCase();
    return `<det nItem="${k + 1}"><prod><cProd>${txt(i.codigo || String(k + 1), 60)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${txt(i.descricao, 120)}</xProd><NCM>${so(i.ncm).padStart(8, "0").slice(0, 8)}</NCM><CFOP>${so(i.cfop || d.cfop || (idDest === "1" ? "5101" : "6101")).slice(0, 4)}</CFOP><uCom>${un}</uCom><qCom>${dec(q, 4)}</qCom><vUnCom>${dec(vu, 4)}</vUnCom><vProd>${dec(vProd, 2)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${un}</uTrib><qTrib>${dec(q, 4)}</qTrib><vUnTrib>${dec(vu, 4)}</vUnTrib>${vDesc > 0 ? `<vDesc>${dec(vDesc, 2)}</vDesc>` : ""}<indTot>1</indTot>${i.infAd ? `<infAdProd>${txt(i.infAd, 500)}</infAdProd>` : ""}</prod><imposto><ICMS>${icmsXml}</ICMS><PIS>${pisXml}</PIS><COFINS>${cofXml}</COFINS></imposto></det>`;
  }).join("");
  const frete = d.frete || {};
  vFreteT = num(frete.valor);
  const vNF = Math.round((vProdT - vDescT + vFreteT) * 100) / 100;
  const ender = (e) => `<xLgr>${txt(e.lgr || "ZONA RURAL", 60)}</xLgr><nro>${txt(e.nro || "S/N", 60)}</nro>${e.cpl ? `<xCpl>${txt(e.cpl, 60)}</xCpl>` : ""}<xBairro>${txt(e.bairro || "ZONA RURAL", 60)}</xBairro><cMun>${so(e.cMun)}</cMun><xMun>${txt(e.xMun, 60)}</xMun><UF>${String(e.uf || "").toUpperCase()}</UF>${so(e.cep) ? `<CEP>${so(e.cep).padStart(8, "0").slice(0, 8)}</CEP>` : ""}<cPais>1058</cPais><xPais>BRASIL</xPais>${so(e.fone).length >= 10 ? `<fone>${so(e.fone).slice(0, 14)}</fone>` : ""}`;
  const emitXml = `<emit>${docEmit.length === 14 ? `<CNPJ>${docEmit}</CNPJ>` : `<CPF>${docEmit}</CPF>`}<xNome>${txt(emit.nome, 60)}</xNome><enderEmit>${ender(emit)}</enderEmit><IE>${so(emit.ie)}</IE><CRT>${emit.crt || "3"}</CRT></emit>`;
  const indIEDest = so(dest.ie) ? "1" : (dest.indIEDest === "2" ? "2" : "9");
  const nomeDest = hom ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : txt(dest.nome, 60);
  const destXml = docDest ? `<dest>${docDest.length === 14 ? `<CNPJ>${docDest}</CNPJ>` : `<CPF>${docDest}</CPF>`}<xNome>${nomeDest}</xNome>${so(dest.cMun) ? `<enderDest>${ender(dest)}</enderDest>` : ""}<indIEDest>${indIEDest}</indIEDest>${so(dest.ie) ? `<IE>${so(dest.ie)}</IE>` : ""}${dest.email ? `<email>${txt(dest.email, 60)}</email>` : ""}</dest>` : "";
  if (!docDest) throw new Error("informe o CPF/CNPJ do destinatário (comprador)");
  const indFinal = indIEDest === "9" ? "1" : "0";
  const ide = `<ide><cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>${txt(d.natOp || "VENDA DE PRODUCAO DO ESTABELECIMENTO", 60)}</natOp><mod>55</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>${dhEmi}</dhEmi>${d.dhSaiEnt ? `<dhSaiEnt>${d.dhSaiEnt}</dhSaiEnt>` : ""}<tpNF>1</tpNF><idDest>${idDest}</idDest><cMunFG>${so(emit.cMun)}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave.slice(-1)}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>${indFinal}</indFinal><indPres>0</indPres><procEmi>0</procEmi><verProc>AgroCR Campo 1.0</verProc></ide>`;
  const total = `<total><ICMSTot><vBC>${dec(vBCT, 2)}</vBC><vICMS>${dec(vICMST, 2)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${dec(vProdT, 2)}</vProd><vFrete>${dec(vFreteT, 2)}</vFrete><vSeg>0.00</vSeg><vDesc>${dec(vDescT, 2)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>${dec(vPIST, 2)}</vPIS><vCOFINS>${dec(vCOFINST, 2)}</vCOFINS><vOutro>0.00</vOutro><vNF>${dec(vNF, 2)}</vNF></ICMSTot></total>`;
  let transp = `<transp><modFrete>${["0", "1", "2", "3", "4", "9"].includes(String(frete.mod)) ? frete.mod : "9"}</modFrete>`;
  if (frete.transpNome || so(frete.transpDoc)) transp += `<transporta>${so(frete.transpDoc).length === 14 ? `<CNPJ>${so(frete.transpDoc)}</CNPJ>` : so(frete.transpDoc).length === 11 ? `<CPF>${so(frete.transpDoc)}</CPF>` : ""}${frete.transpNome ? `<xNome>${txt(frete.transpNome, 60)}</xNome>` : ""}${so(frete.transpIe) ? `<IE>${so(frete.transpIe)}</IE>` : ""}${frete.transpEnd ? `<xEnder>${txt(frete.transpEnd, 60)}</xEnder>` : ""}${frete.transpMun ? `<xMun>${txt(frete.transpMun, 60)}</xMun>` : ""}${frete.transpUf ? `<UF>${String(frete.transpUf).toUpperCase()}</UF>` : ""}</transporta>`;
  const placa = String(frete.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa) transp += `<veicTransp><placa>${placa.slice(0, 7)}</placa><UF>${String(frete.ufPlaca || ufEmit).toUpperCase()}</UF></veicTransp>`;
  if (num(frete.qVol) > 0 || num(frete.pesoB) > 0) transp += `<vol>${num(frete.qVol) > 0 ? `<qVol>${Math.round(num(frete.qVol))}</qVol>` : ""}${frete.esp ? `<esp>${txt(frete.esp, 60)}</esp>` : ""}${num(frete.pesoL) > 0 ? `<pesoL>${dec(frete.pesoL, 3)}</pesoL>` : ""}${num(frete.pesoB) > 0 ? `<pesoB>${dec(frete.pesoB, 3)}</pesoB>` : ""}</vol>`;
  transp += `</transp>`;
  const pg = d.pagamento || {};
  const tPag = String(pg.tPag || "99").padStart(2, "0");
  const pag = `<pag><detPag>${["0", "1"].includes(String(pg.indPag)) ? `<indPag>${pg.indPag}</indPag>` : ""}<tPag>${tPag}</tPag>${tPag === "90" ? `<vPag>0.00</vPag>` : `<vPag>${dec(vNF, 2)}</vPag>`}</detPag></pag>`;
  const infAdic = d.infCpl || d.infFisco ? `<infAdic>${d.infFisco ? `<infAdFisco>${txt(d.infFisco, 2000)}</infAdFisco>` : ""}${d.infCpl ? `<infCpl>${txt(d.infCpl, 5000)}</infCpl>` : ""}</infAdic>` : "";
  const infNFe = `<infNFe Id="NFe${chave}" versao="4.00">${ide}${emitXml}${destXml}${det}${total}${transp}${pag}${infAdic}</infNFe>`;
  return { chave, nNF, serie, dhEmi, vNF, vProd: vProdT, xml: `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>` };
}

function assinar(xml, referencia, certPem, chavePem) {
  const sig = new SignedXml({
    privateKey: chavePem, publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${referencia}']`,
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${referencia}']`, action: "after" } });
  return sig.getSignedXml();
}
const envelope = (servico, dados) => `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">${dados}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ---------- emitir ----------
async function emitir(db, certDoc, d) {
  const c = certDoc.data();
  const pfxB64 = S.decifrar(c.pfx), senha = S.decifrar(c.senha);
  const pfx = Buffer.from(pfxB64, "base64");
  const { certPem, chavePem } = S.abrirPfx(pfxB64, senha);
  const docCert = so(c.doc);
  const docEmit = so((d.emit || {}).doc);
  // o certificado tem que ser do emitente (CNPJ pode ser da mesma raiz)
  if (docCert && docEmit && !(docCert === docEmit || (docCert.length === 14 && docEmit.length === 14 && docCert.slice(0, 8) === docEmit.slice(0, 8)))) {
    throw new Error(`o certificado guardado é de ${c.nome || docCert}; a nota tem que ser emitida por ele (emitente ${docEmit}). Guarde o certificado do emitente.`);
  }
  const m = montarNFe(d);
  const assinado = assinar(m.xml, "infNFe", certPem, chavePem);
  const ws = wsDe(String((d.emit || {}).uf || "TO").toUpperCase(), d.ambiente);
  const lote = String(Date.now()).slice(-15);
  const envi = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lote}</idLote><indSinc>1</indSinc>${assinado}</enviNFe>`;
  const r = await S.soap(ws.aut, envelope("NFeAutorizacao4", envi), pfx, senha);
  if (r.status !== 200) throw new Error(`SEFAZ respondeu HTTP ${r.status}: ${r.corpo.slice(0, 300)}`);
  let ret = S.tag(r.corpo, "retEnviNFe");
  let cStat = S.tag(ret, "cStat"), xMotivo = S.tag(ret, "xMotivo");
  let prot = S.tag(ret, "protNFe");
  // lote recebido para processar depois (autorizador sem síncrono): consulta o recibo
  if ((cStat === "103" || cStat === "105") && !prot) {
    const nRec = S.tag(ret, "nRec");
    for (let i = 0; i < 6 && !prot; i++) {
      await dormir(1500);
      const cons = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${d.ambiente === "prod" ? 1 : 2}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`;
      const rr = await S.soap(ws.ret, envelope("NFeRetAutorizacao4", cons), pfx, senha);
      const rc = S.tag(rr.corpo, "retConsReciNFe");
      cStat = S.tag(rc, "cStat"); xMotivo = S.tag(rc, "xMotivo");
      if (cStat === "104") prot = S.tag(rc, "protNFe");
    }
  }
  if (!prot) return { ok: false, cStat, xMotivo: xMotivo || "sem resposta do autorizador", chave: m.chave, xmlEnviado: assinado };
  const inf = S.tag(prot, "infProt");
  const cStatNota = S.tag(inf, "cStat"), motivoNota = S.tag(inf, "xMotivo"), nProt = S.tag(inf, "nProt"), dhRecbto = S.tag(inf, "dhRecbto");
  const autorizada = cStatNota === "100";
  const denegada = ["110", "301", "302", "303"].includes(cStatNota);
  const protXml = `<protNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${prot}</protNFe>`;
  const nfeProc = `<?xml version="1.0" encoding="utf-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${assinado}${protXml}</nfeProc>`;
  const registro = {
    chave: m.chave, numero: Number(m.nNF), serie: Number(m.serie), ambiente: d.ambiente === "prod" ? "prod" : "hom", dhEmi: m.dhEmi, emitidaEm: new Date().toISOString(),
    emitente: (d.emit || {}).nome || "", docEmitente: docEmit, destinatario: (d.dest || {}).nome || "", docDestinatario: so((d.dest || {}).doc), ufDestino: (d.dest || {}).uf || "",
    itens: (d.itens || []).map((i) => ({ descricao: i.descricao, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade, qtd: num(i.qtd), valorUnit: num(i.valorUnit), valorTotal: Math.round(num(i.qtd) * num(i.valorUnit) * 100) / 100 })),
    valorTotal: m.vNF, natOp: d.natOp || "", icmsCst: (d.icms || {}).cst || "", cStat: cStatNota, xMotivo: motivoNota, nProt, dhRecbto,
    status: autorizada ? "autorizada" : denegada ? "denegada" : "rejeitada", xml: autorizada || denegada ? nfeProc : assinado, quem: d.quem || "", cultura: d.cultura || "", safra: d.safra || "",
  };
  if (autorizada || denegada) {
    await db.collection("fazendas").doc(String(d.fazendaId)).collection("nfe").doc(m.chave).set(registro);
    // próximo número (autorizada e denegada consomem a numeração)
    await db.collection("fazendas").doc(String(d.fazendaId)).set({ fiscal: { nfe: { [`proximo_${registro.ambiente}_${m.serie}`]: Number(m.nNF) + 1 } } }, { merge: true }).catch(() => {});
  }
  return { ok: autorizada, cStat: cStatNota, xMotivo: motivoNota, nProt, chave: m.chave, numero: Number(m.nNF), serie: Number(m.serie), valorTotal: m.vNF, status: registro.status, ambiente: registro.ambiente };
}

// ---------- consultar situação ----------
async function consultar(certDoc, chave, uf, ambiente) {
  const c = certDoc.data();
  const pfxB64 = S.decifrar(c.pfx), senha = S.decifrar(c.senha);
  const ws = wsDe(String(uf || "TO").toUpperCase(), ambiente);
  const cons = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente === "prod" ? 1 : 2}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${so(chave)}</chNFe></consSitNFe>`;
  const r = await S.soap(ws.cons, envelope("NFeConsultaProtocolo4", cons), Buffer.from(pfxB64, "base64"), senha);
  const ret = S.tag(r.corpo, "retConsSitNFe");
  return { cStat: S.tag(ret, "cStat"), xMotivo: S.tag(ret, "xMotivo"), nProt: S.tag(S.tag(ret, "infProt"), "nProt") };
}

// ---------- cancelar (evento 110111) ----------
async function cancelar(db, certDoc, d) {
  const c = certDoc.data();
  const pfxB64 = S.decifrar(c.pfx), senha = S.decifrar(c.senha);
  const { certPem, chavePem } = S.abrirPfx(pfxB64, senha);
  const chave = so(d.chave); if (chave.length !== 44) throw new Error("chave inválida");
  const just = String(d.justificativa || "").trim(); if (just.length < 15) throw new Error("a justificativa precisa ter pelo menos 15 letras");
  const ref = db.collection("fazendas").doc(String(d.fazendaId)).collection("nfe").doc(chave);
  const doc = await ref.get(); if (!doc.exists) throw new Error("nota não encontrada");
  const n = doc.data();
  const ws = wsDe(String(d.uf || "TO").toUpperCase(), n.ambiente);
  const docEmit = so(n.docEmitente || c.doc);
  const id = `ID110111${chave}01`;
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${id}"><cOrgao>${chave.slice(0, 2)}</cOrgao><tpAmb>${n.ambiente === "prod" ? 1 : 2}</tpAmb>${docEmit.length === 14 ? `<CNPJ>${docEmit}</CNPJ>` : `<CPF>${docEmit}</CPF>`}<chNFe>${chave}</chNFe><dhEvento>${agoraBrasil()}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${n.nProt}</nProt><xJust>${txt(just, 255)}</xJust></detEvento></infEvento></evento>`;
  const assinado = assinar(evento, "infEvento", certPem, chavePem);
  const lote = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${String(Date.now()).slice(-15)}</idLote>${assinado}</envEvento>`;
  const r = await S.soap(ws.evento, envelope("NFeRecepcaoEvento4", lote), Buffer.from(pfxB64, "base64"), senha);
  const inf = S.tag(S.tag(r.corpo, "retEvento"), "infEvento") || S.tag(r.corpo, "retEnvEvento");
  const cStat = S.tag(inf, "cStat"), xMotivo = S.tag(inf, "xMotivo");
  if (!["135", "155"].includes(cStat)) throw new Error(`SEFAZ ${cStat}: ${xMotivo}`);
  await ref.set({ status: "cancelada", canceladaEm: new Date().toISOString(), justificativa: just, protCancelamento: S.tag(inf, "nProt"), xmlCancelamento: `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${assinado}<retEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${S.tag(r.corpo, "retEvento")}</retEvento></procEventoNFe>` }, { merge: true });
  return { cStat, xMotivo };
}

function registrar(appGerenteAgro) {
  const nfe = onRequest({ cors: true, secrets: [S.CERT_KEY], timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
    try {
      if (req.method !== "POST") { res.status(405).json({ erro: "use POST" }); return; }
      const quem = await S.quemChama(req, appGerenteAgro);
      if (!quem) { res.status(401).json({ erro: "entre na sua conta" }); return; }
      const corpo = req.body || {};
      const certDoc = await quem.db.collection("certificados").doc(quem.uid).get();
      if (!certDoc.exists) { res.status(400).json({ erro: "guarde o certificado digital do emitente primeiro (Notas fiscais → Certificado digital)" }); return; }
      if (!corpo.fazendaId) { res.status(400).json({ erro: "fazenda não informada" }); return; }
      const acao = String(corpo.acao || "");
      if (acao === "emitir") { res.json(await emitir(quem.db, certDoc, corpo)); return; }
      if (acao === "consultar") { res.json({ ok: true, ...(await consultar(certDoc, corpo.chave, corpo.uf, corpo.ambiente)) }); return; }
      if (acao === "cancelar") { res.json({ ok: true, ...(await cancelar(quem.db, certDoc, corpo)) }); return; }
      res.status(400).json({ erro: "ação desconhecida" });
    } catch (e) {
      console.error("nfe:", e);
      res.status(500).json({ erro: e.message || String(e) });
    }
  });
  return { nfe };
}
module.exports = { registrar, montarNFe, dvMod11 };
