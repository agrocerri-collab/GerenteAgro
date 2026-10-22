// Cobrança automática do GerenteAgro: webhook do Asaas.
// O Asaas chama esta função quando um pagamento é confirmado (boleto, Pix ou
// cartão). A função acha a licença pelo e-mail do pagador e estende a validade:
// valor de plano anual → +365 dias; mensal (ou parcela do 12x) → +30 dias.
//
// Configuração (painel 🔑 Licenças → Cobrança automática): o dono grava em
// financeiroDono/asaas o token do webhook (o mesmo que digita no Asaas) e a
// chave da API (para descobrir o e-mail do cliente). Só o dono lê esse documento.
// Cada evento é guardado uma vez (financeiroDono/asaas/eventos/{id}) — se o
// Asaas reenviar, não renova duas vezes. Pagamento sem e-mail conhecido vira
// financeiroDono/asaasPendente_{id}, que o dono resolve no painel.
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function registrar() {
  const db = getFirestore();
  const asaas = onRequest({ cors: false, timeoutSeconds: 60 }, async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("use POST"); return; }
    const cfg = ((await db.collection("financeiroDono").doc("asaas").get()).data()) || {};
    const token = String(req.get("asaas-access-token") || "");
    if (!cfg.webhookToken || token !== String(cfg.webhookToken)) { res.status(401).send("token do webhook inválido"); return; }

    const ev = req.body || {};
    const pag = ev.payment || {};
    const evId = String(ev.id || `${pag.id || "sem-id"}:${ev.event || "evento"}`).replace(/[\/#?]/g, "_");
    const refEv = db.collection("financeiroDono").doc("asaas").collection("eventos").doc(evId);
    if ((await refEv.get()).exists) { res.status(200).send("já processado"); return; }
    await refEv.set({ evento: ev.event || "", pagamento: pag.id || "", valor: Number(pag.value || 0), em: Timestamp.now(), bruto: JSON.stringify(ev).slice(0, 6000) });

    if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(ev.event)) { res.status(200).send("evento ignorado"); return; }
    const valor = Number(pag.value || 0);
    if (!(valor > 0)) { res.status(200).send("sem valor"); return; }

    // e-mail do pagador: externalReference (link gerado com o e-mail) ou o cadastro do cliente no Asaas
    let email = String(pag.externalReference || "").trim().toLowerCase();
    let nomeCliente = "";
    if (!email.includes("@") && pag.customer && cfg.apiKey) {
      try {
        const base = cfg.sandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
        const r = await fetch(`${base}/customers/${encodeURIComponent(pag.customer)}`, { headers: { access_token: String(cfg.apiKey), "User-Agent": "GerenteAgro" } });
        if (r.ok) { const c = await r.json(); email = String(c.email || "").trim().toLowerCase(); nomeCliente = c.name || ""; }
      } catch (e) { /* sem e-mail: cai em pendente */ }
    }
    // plano pelo valor: anual (R$ 800 / R$ 1.500) → 365 dias; mensal ou parcela → 30 dias
    const dias = valor >= 500 ? 365 : 30;
    const pendente = async (motivo) => {
      await db.collection("financeiroDono").doc(`asaasPendente_${String(pag.id || evId).replace(/[\/#?]/g, "_")}`).set({
        tipo: "asaasPendente", motivo, email: email || "", nome: nomeCliente || (pag.customer || ""), valor, dias, pagamentoId: pag.id || "",
        pagoEm: pag.paymentDate || pag.confirmedDate || pag.clientPaymentDate || null, descricao: pag.description || "", em: Timestamp.now(),
      });
      res.status(200).send("pendente: " + motivo);
    };
    if (!email.includes("@")) { await pendente("pagamento sem e-mail do pagador"); return; }

    const refLic = db.collection("licencas").doc(email);
    const lic = (await refLic.get()).data();
    if (!lic) { await pendente(`e-mail sem licença no app: ${email}`); return; }
    const agora = new Date();
    const baseData = lic.validaAte && lic.validaAte.toDate && lic.validaAte.toDate() > agora ? lic.validaAte.toDate() : agora;
    const nova = new Date(baseData.getTime() + dias * 86400000);
    await refLic.set({
      plano: dias === 365 ? "anual" : "mensal", validaAte: Timestamp.fromDate(nova), atualizadoEm: Timestamp.now(),
      quem: `Asaas · pagamento ${pag.id || ""} · ${valor.toFixed(2)}`, suspensa: false,
      ultimoPagamento: { id: pag.id || "", valor, em: pag.paymentDate || pag.confirmedDate || null, forma: pag.billingType || "" },
    }, { merge: true });
    res.status(200).send(`ok: ${email} até ${nova.toISOString().slice(0, 10)}`);
  });
  return { asaas };
}

module.exports = { registrar };
