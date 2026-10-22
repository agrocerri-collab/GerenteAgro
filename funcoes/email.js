// ============================================================
// E-MAIL — envio da cópia de segurança para o e-mail de quem a gerou.
//
// O aplicativo manda o backup (JSON) para esta função; ela confere o login,
// pega o e-mail da própria pessoa (do token — ninguém escolhe outro destino)
// e envia como anexo por SMTP. Credenciais no Secret Manager:
//   SMTP_USER  e-mail remetente (ex.: agrocrcampo@gmail.com)
//   SMTP_PASS  senha de aplicativo do Gmail (não é a senha da conta)
// Enquanto estiverem "pendente", a função responde 503 e o app avisa.
// ============================================================
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const LIMITE_BYTES = 20 * 1024 * 1024;   // Gmail aceita 25 MB de anexo
const limpo = (s) => String(s || "").replace(/^﻿/, "").trim();

function registrar(appGerenteAgro) {
  const enviarbackup = onRequest({ cors: true, secrets: [SMTP_USER, SMTP_PASS], timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
    try {
      if (req.method !== "POST") { res.status(405).json({ erro: "use POST" }); return; }
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) { res.status(401).json({ erro: "entre na sua conta" }); return; }
      let quem = null, db = getFirestore(), projeto = "agrocr";
      try { quem = await getAuth().verifyIdToken(token); } catch (e) {}
      if (!quem) { try { quem = await getAuth(appGerenteAgro).verifyIdToken(token); db = getFirestore(appGerenteAgro); projeto = "gerenteagro"; } catch (e) {} }
      if (!quem) { res.status(401).json({ erro: "login inválido" }); return; }
      const para = String(quem.email || "").trim().toLowerCase();
      if (!para) { res.status(400).json({ erro: "a sua conta não tem e-mail cadastrado" }); return; }

      const usuario = limpo(SMTP_USER.value()), senha = limpo(SMTP_PASS.value());
      if (!usuario || usuario === "pendente" || !senha || senha === "pendente") {
        res.status(503).json({ erro: "O envio por e-mail ainda não foi ativado pela administração. Baixe o arquivo por enquanto." });
        return;
      }
      const corpo = req.body || {};
      const conteudo = String(corpo.conteudo || "");
      if (!conteudo) { res.status(400).json({ erro: "backup vazio" }); return; }
      if (Buffer.byteLength(conteudo) > LIMITE_BYTES) { res.status(413).json({ erro: "a cópia passou de 20 MB — baixe o arquivo em vez de enviar por e-mail" }); return; }
      const nomeArq = String(corpo.nome || "backup.json").replace(/[^A-Za-z0-9._-]/g, "_");
      const app = String(corpo.app || (projeto === "gerenteagro" ? "GerenteAgro" : "AgroCR Campo")).slice(0, 40);
      const resumo = String(corpo.resumo || "").slice(0, 400);
      const quando = new Date(Date.now() - 3 * 3600 * 1000);   // horário de Brasília
      const carimbo = quando.toISOString().slice(0, 16).replace("T", " às ");

      const nodemailer = require("nodemailer");
      const transporte = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: usuario, pass: senha } });
      await transporte.sendMail({
        from: `"${app}" <${usuario}>`,
        to: para,
        subject: `${app} — cópia de segurança de ${carimbo.slice(0, 10).split("-").reverse().join("/")}`,
        text: `Olá!\n\nSegue em anexo a cópia de segurança dos dados do ${app}, gerada em ${carimbo} por ${quem.name || para}.\n${resumo ? "\n" + resumo + "\n" : ""}\nGuarde este e-mail: a partir deste arquivo a consultoria consegue restaurar tudo.\nO arquivo é só para restaurar no aplicativo — não precisa abrir.\n\n${app}`,
        attachments: [{ filename: nomeArq, content: conteudo, contentType: "application/json" }],
      });
      // registro simples de quem mandou backup (sem o conteúdo)
      try { await db.collection("backupsEnviados").add({ uid: quem.uid, para, nome: nomeArq, bytes: Buffer.byteLength(conteudo), quando: new Date().toISOString(), app }); } catch (e) {}
      res.json({ ok: true, para });
    } catch (e) {
      console.error("enviarbackup:", e);
      res.status(500).json({ erro: /Invalid login|Username and Password/i.test(String(e.message)) ? "o servidor de e-mail recusou a senha de aplicativo — avise a administração" : (e.message || String(e)) });
    }
  });
  return { enviarbackup };
}

module.exports = { registrar };
