// ============================================================
// AgroCR Campo - avisos no celular (roda no servidor do Firebase)
//
// Dispara sozinho quando alguem grava no banco:
//   recomendacao nova  -> avisa o pessoal DAQUELA fazenda + toda a consultoria
//   execucao registrada -> avisa a consultoria
//
// O aviso vai para os aparelhos que ativaram o sininho no aplicativo
// (os "enderecos" ficam em usuarios/{uid}.fcmTokens).
// ============================================================
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
// so para CONFERIR logins do GerenteAgro (mesma funcao serve os dois apps)
const appGerenteAgro = initializeApp({ projectId: "gerenteagro" }, "gerenteagro");
// O mesmo codigo sobe nos dois projetos. No gerenteagro entram SO os avisos
// (push): SEFAZ, NF-e, IA, WhatsApp e backup ficam no agrocr-campo, que e
// quem guarda os segredos (certificados, chaves) — la o GerenteAgro chama por HTTP.
const PROJETO = (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId || process.env.GCLOUD_PROJECT || ""; } catch (e) { return process.env.GCLOUD_PROJECT || ""; } })();
const SO_AVISOS = PROJETO === "gerenteagro";
setGlobalOptions({ region: "southamerica-east1", maxInstances: 20 });
const db = getFirestore();

// SEFAZ: certificado digital do produtor + busca automática das NF-e (ver sefaz.js)
// Fazenda cadastrada por um consultor LIMITADO a certas fazendas: a nova entra na
// lista dele na hora (sem isto ele não a enxergaria de novo depois de fechar o app)
exports.aoCriarFazenda = onDocumentCreated("fazendas/{fazendaId}", async (evento) => {
  const dados = evento.data ? evento.data.data() : null;
  const uid = dados && dados.criadoPor;
  if (!uid) return;
  const ref = db.collection("usuarios").doc(String(uid));
  const u = (await ref.get()).data();
  if (!u || !Array.isArray(u.fazendasLimitadas) || u.fazendasLimitadas.includes(evento.params.fazendaId)) return;
  await ref.update({ fazendasLimitadas: FieldValue.arrayUnion(evento.params.fazendaId) });
});

// Cobrança automática do GerenteAgro (webhook do Asaas): só no projeto gerenteagro
if (SO_AVISOS) exports.asaas = require("./asaas").registrar({ avisarDonos: (titulo, corpo) => avisarDonos(titulo, corpo) }).asaas;
// GerenteAgro: um titular criou um acesso extra que NÃO entrou sozinho (não é o 1º incluso nem teste)
// → avisa o dono da plataforma no celular para liberar em Conta → Licenças
const DONOS_PLATAFORMA = ["administrativo@gerenteagro.com", "agrocerri@gmail.com"];
exports.avisoNovoAcesso = onDocumentCreated("usuarios/{uid}", async (evento) => {
  if (!SO_AVISOS) return;
  const u = evento.data ? evento.data.data() : null;
  if (!u || !u.email) return;
  const email0 = String(u.email).toLowerCase();
  if (DONOS_PLATAFORMA.includes(email0)) return;
  if (!u.conta || u.conta === evento.params.uid) {
    // CADASTRO NOVO (titular: conta == uid): avisa o dono da plataforma no celular
    await avisarDonos("Cadastro novo no GerenteAgro", `${u.nome || email0}${u.nome ? ` · ${email0}` : ""}${u.planoEscolhido ? ` · plano ${u.planoEscolhido}` : ""}${u.formaPagamento ? ` · ${u.formaPagamento}` : ""}${u.telefone || u.whats ? ` · ${u.telefone || u.whats}` : ""}`);
    return;
  }
  await new Promise((r) => setTimeout(r, 8000));   // tempo para o app gravar a licença "incluso"/teste, se couber
  const email = String(u.email).toLowerCase();
  const lic = await db.collection("licencas").doc(email).get();
  if (lic.exists) return;
  const [titular, donos] = await Promise.all([
    db.collection("usuarios").doc(String(u.conta)).get().catch(() => null),
    db.collection("usuarios").where("email", "in", DONOS_PLATAFORMA).get(),
  ]);
  const nomeTit = titular && titular.exists ? (titular.data().nome || titular.data().email || "") : "";
  await mandar(tokensDe(donos.docs), "Acesso aguardando liberação", `${u.nome || email}${nomeTit ? ` · conta de ${nomeTit}` : ""} — libere em Conta → Licenças`);
});
if (!SO_AVISOS) {
  const sefazModulo = require("./sefaz").registrar(appGerenteAgro);
  exports.sefaz = sefazModulo.sefaz;
  exports.sefazAgendado = sefazModulo.sefazAgendado;
  // NF-e: o produtor emite a nota de venda (milho, soja, algodão…) com o próprio certificado (ver nfe.js)
  exports.nfe = require("./nfe").registrar(appGerenteAgro).nfe;

  // Suporte pelo WhatsApp: dúvidas por texto/áudio respondidas pela IA (ver whatsapp.js)
  exports.whatsapp = require("./whatsapp").registrar().whatsapp;

  // Cópia de segurança por e-mail para quem gerou (ver email.js)
  exports.enviarbackup = require("./email").registrar(appGerenteAgro).enviarbackup;
  // Cópia de segurança AUTOMÁTICA dos dois aplicativos, todo fim de dia, por e-mail (ver backup.js)
  exports.backupDiario = require("./backup").registrar(appGerenteAgro).backupDiario;
}

// Limite de uso da IA por USUARIO e por DIA: protege o custo se um login
// for abusado (script, senha vazada). Conta em usoIA/{uid}_{dia}.
async function dentroDoLimite(uid, tipo, limite, res) {
  const dia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = db.collection("usoIA").doc(uid + "_" + dia);
  try {
    const doc = await ref.get();
    const usado = (doc.exists && Number(doc.data()[tipo])) || 0;
    if (usado >= limite) {
      res.status(429).json({ erro: "Limite diário de " + limite + " usos da IA atingido nesta conta. Volta a funcionar amanhã — se precisar de mais, fale com o suporte." });
      return false;
    }
    await ref.set({ [tipo]: FieldValue.increment(1), dia, uid }, { merge: true });
  } catch (e) { /* contador indisponivel nao pode derrubar o servico */ }
  return true;
}

// junta os tokens de uma lista de documentos de usuarios
function tokensDe(docs) {
  const lista = [];
  for (const d of docs) {
    for (const t of (d.data().fcmTokens || [])) lista.push({ uid: d.id, token: t });
  }
  return lista;
}
// GerenteAgro: quem recebe os avisos de UMA fazenda — o pessoal com acesso a ela + a consultoria DA MESMA CONTA.
// O dono da plataforma (administrativo) fica de fora: ele só recebe cadastro novo, acesso novo e pagamento.
function filtrarDestinatarios(docs, contaDaFazenda) {
  return docs.filter((d) => {
    const u = d.data() || {};
    if (!SO_AVISOS) return true;
    if (DONOS_PLATAFORMA.includes(String(u.email || "").toLowerCase())) return false;
    if (contaDaFazenda && u.papel === "consultoria" && u.conta && String(u.conta) !== String(contaDaFazenda)) return false;
    return true;
  });
}
async function contaDaFazenda(fazendaId) {
  if (!SO_AVISOS) return null;
  try { const d = await db.collection("fazendas").doc(fazendaId).get(); return d.exists ? (d.data().conta || null) : null; } catch (e) { return null; }
}
// aviso só para o dono da plataforma (celular do administrativo)
async function avisarDonos(titulo, corpo) {
  try { const donos = await db.collection("usuarios").where("email", "in", DONOS_PLATAFORMA).get(); await mandar(tokensDe(donos.docs), titulo, corpo); }
  catch (e) { console.warn("avisarDonos:", e && e.message); }
}

async function nomeDaFazenda(fazendaId) {
  try {
    const doc = await db.collection("fazendas").doc(fazendaId).get();
    return (doc.exists && doc.data().nome) || "a fazenda";
  } catch (e) { return "a fazenda"; }
}

// manda o aviso e apaga do cadastro os enderecos que ja morreram
// (aparelho trocado, aplicativo removido)
// "abrir" = destino dentro do app, no formato do link: f=<fazenda>&s=<seção>&m=<módulo>&a=<aba>
// r = id da recomendação: o app rola até ela e destaca
const destino = (fazendaId, secao, modulo, aba, rec) => `f=${fazendaId}&s=${secao || "inicio"}${modulo ? "&m=" + modulo : ""}${aba ? "&a=" + aba : ""}${rec ? "&r=" + rec : ""}`;
// intervalo do monitoramento de pragas por cultura (Daniel): algodão 7 dias, soja/milho/demais 10
const intervaloMon = (cultura) => (/algod/i.test(String(cultura || "")) ? 7 : 10);
// programa de fungicida por cultura (igual ao app): padrão + ajuste guardado em fazenda.fungicidas
const FUNG_PADRAO = { Soja: { primeira: 25, intervalo: 15, fim: 130 }, Milho: { primeira: 25, intervalo: 15, fim: 110 }, "Algodão": { primeira: 30, intervalo: 14, fim: 180 } };
const regraFungicida = (dadosFazenda, cultura) => {
  const base = FUNG_PADRAO[cultura] || FUNG_PADRAO.Soja;
  const propria = ((dadosFazenda && dadosFazenda.fungicidas) || {})[cultura] || {};
  const n = (v, p) => (Number(v) > 0 ? Number(v) : p);
  return { primeira: n(propria.primeira, base.primeira), intervalo: n(propria.intervalo, base.intervalo), fim: n(propria.fim, base.fim) };
};
async function mandar(destinos, titulo, corpo, abrir) {
  const unicos = [...new Map(destinos.map((d) => [d.token, d])).values()];
  if (unicos.length === 0) return;
  const resposta = await getMessaging().sendEachForMulticast({
    tokens: unicos.map((d) => d.token),
    data: { titulo, corpo, abrir: abrir || "" },
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  });
  const mortos = [];
  resposta.responses.forEach((r, i) => {
    if (!r.success && r.error && /registration-token-not-registered|invalid-argument/.test(r.error.code || "")) {
      mortos.push(unicos[i]);
    }
  });
  await Promise.all(mortos.map((m) =>
    db.collection("usuarios").doc(m.uid).update({
      fcmTokens: FieldValue.arrayRemove(m.token),
    }).catch(() => {})
  ));
}

exports.avisoRecomendacao = onDocumentCreated("fazendas/{fazendaId}/recomendacoes/{recId}", async (evento) => {
  const rec = evento.data ? evento.data.data() : null;
  if (!rec) return;
  const fazendaId = evento.params.fazendaId;
  const [fazenda, daFazenda, consultoria] = await Promise.all([
    nomeDaFazenda(fazendaId),
    db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get(),
    db.collection("usuarios").where("papel", "==", "consultoria").get(),
  ]);
  const ciclo = rec.ciclo === "Safrinha" ? " (safrinha)" : "";
  await mandar(
    tokensDe(filtrarDestinatarios([...daFazenda.docs, ...consultoria.docs], await contaDaFazenda(fazendaId))),
    `Nova recomendação — ${fazenda}`,
    `${rec.tipo || "Operação"}${rec.alvo ? ` · ${rec.alvo}` : ""}${ciclo}${rec.recomendadoPor ? ` · por ${rec.recomendadoPor}` : ""}`,
    destino(fazendaId, "apl", rec.modulo || "pulverizacao", null, evento.params.recId)
  );
});

// chuva lancada -> avisa o pessoal daquela fazenda + toda a consultoria
exports.avisoChuva = onDocumentCreated("fazendas/{fazendaId}/chuvas/{chuvaId}", async (evento) => {
  const ch = evento.data ? evento.data.data() : null;
  if (!ch) return;
  const fazendaId = evento.params.fazendaId;
  const [fazenda, daFazenda, consultoria] = await Promise.all([
    nomeDaFazenda(fazendaId),
    db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get(),
    db.collection("usuarios").where("papel", "==", "consultoria").get(),
  ]);
  const mm = Number(ch.mm) || 0;
  const dia = ch.data ? `${String(ch.data).slice(8, 10)}/${String(ch.data).slice(5, 7)}` : "";
  await mandar(
    tokensDe(filtrarDestinatarios([...daFazenda.docs, ...consultoria.docs], await contaDaFazenda(fazendaId))),
    `Chuva — ${fazenda}`,
    `${mm.toLocaleString("pt-BR")} mm${ch.local ? ` no ${ch.local}` : ""}${dia ? ` em ${dia}` : ""}${ch.quem ? ` · por ${ch.quem}` : ""}`,
    destino(fazendaId, "chuva")
  );
});

exports.avisoExecucao = onDocumentCreated("fazendas/{fazendaId}/execucoes/{execId}", async (evento) => {
  const ex = evento.data ? evento.data.data() : null;
  if (!ex) return;
  const fazendaId = evento.params.fazendaId;
  // a execução guarda só o id da recomendação e do talhão: busca os nomes para o aviso dizer O QUE e ONDE
  const [fazenda, consultoria, recDoc, talhaoDoc] = await Promise.all([
    nomeDaFazenda(fazendaId),
    db.collection("usuarios").where("papel", "==", "consultoria").get(),
    ex.recomendacaoId ? db.collection("fazendas").doc(fazendaId).collection("recomendacoes").doc(String(ex.recomendacaoId)).get().catch(() => null) : Promise.resolve(null),
    ex.talhaoId ? db.collection("fazendas").doc(fazendaId).collection("talhoes").doc(String(ex.talhaoId)).get().catch(() => null) : Promise.resolve(null),
  ]);
  const rec = recDoc && recDoc.exists ? recDoc.data() : {};
  const talhao = talhaoDoc && talhaoDoc.exists ? talhaoDoc.data() : {};
  const oque = `${rec.tipo || "Operação"}${rec.alvo ? ` · ${rec.alvo}` : ""}`;
  const onde = talhao.nome ? ` em ${talhao.nome}${ex.areaExecutada ? ` (${ex.areaExecutada} ha)` : ""}` : "";
  const quando = ex.data ? ` em ${String(ex.data).slice(8, 10)}/${String(ex.data).slice(5, 7)}` : "";
  await mandar(
    tokensDe(filtrarDestinatarios(consultoria.docs, await contaDaFazenda(fazendaId))),
    `Execução registrada — ${fazenda}`,
    `${oque}${onde}${ex.operador ? ` · por ${ex.operador}` : ""}${quando}`,
    destino(fazendaId, "apl", rec.modulo || "pulverizacao", null, ex.recomendacaoId || null)
  );
});

// ============================================================
// Lembretes diarios (06:30, horario do Tocantins)
//   - 10 dias sem chuva na fazenda        -> fazenda + consultoria
//   - talhao entrando na janela da 1a fungicida (25-30 DAE), 2 dias antes -> consultoria
//   - 15 dias da ultima fungicida vencendo, 2 dias antes                -> consultoria
// Cada aviso e mandado UMA vez (marca em fazendas/{f}/avisos).
// ============================================================
function hojeNoTocantins() {
  const agora = new Date(Date.now() - 3 * 3600 * 1000); // UTC-3
  return agora.toISOString().slice(0, 10);
}
function diasEntre(deISO, ateISO) {
  return Math.round((new Date(ateISO + "T12:00:00Z") - new Date(deISO + "T12:00:00Z")) / 86400000);
}
async function jaAvisou(fazendaId, chave) {
  const ref = db.collection("fazendas").doc(fazendaId).collection("avisos").doc(chave);
  const doc = await ref.get();
  if (doc.exists) return true;
  await ref.set({ em: new Date().toISOString() });
  return false;
}

exports.lembretesDiarios = onSchedule({ schedule: "every day 06:30", timeZone: "America/Araguaina" }, async () => {
  const hoje = hojeNoTocantins();
  const consultoria = await db.collection("usuarios").where("papel", "==", "consultoria").get();
  const fazendas = await db.collection("fazendas").get();

  for (const fz of fazendas.docs) {
    const fazendaId = fz.id;
    const dados = fz.data() || {};
    const contaFz = dados.conta || null;   // GerenteAgro: só a consultoria desta conta recebe
    const nome = dados.nome || "a fazenda";
    const nomeTalhao = (tid) => ((dados.talhoes || []).find((t) => t.id === tid) || {}).nome || "talhão";
    const base = db.collection("fazendas").doc(fazendaId);

    try {
      // ---- 10 dias sem chuva: POR PLUVIOMETRO ----
      // Cada aparelho vigia a propria area: o aviso diz QUAL pluviometro
      // secou. Fazenda sem pluviometro cadastrado e vigiada por inteiro.
      // SO avisa se ha LAVOURA NO CAMPO (plantio/emergencia nos ultimos
      // 150 dias) - solo vazio nao precisa de alarme de seca.
      const lavouraDocs = await base.collection("lavoura").get();
      let lavouraAtiva = false;
      lavouraDocs.forEach((d) => {
        const l = d.data();
        for (const campo of [l.dataEmergencia, l.dataPlantio]) {
          if (campo) {
            const dias = diasEntre(String(campo).slice(0, 10), hoje);
            if (dias >= 0 && dias <= 150) lavouraAtiva = true;
          }
        }
      });
      const chuvas = await base.collection("chuvas").get();
      const pluvs = dados.pluviometros || [];
      if (!lavouraAtiva) {
        // nada plantado: pula o alarme de seca desta fazenda
      } else if (pluvs.length > 0) {
        for (const m of pluvs) {
          let ultimaM = null;
          chuvas.forEach((d) => {
            const c = d.data();
            if (c.pluviometroId === m.id && (Number(c.mm) || 0) > 0 && c.data && (!ultimaM || c.data > ultimaM)) ultimaM = c.data;
          });
          if (ultimaM && diasEntre(ultimaM, hoje) === 10 && !(await jaAvisou(fazendaId, `seca-${m.id}-${ultimaM}`))) {
            const daFazenda = await db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get();
            await mandar(tokensDe(filtrarDestinatarios([...daFazenda.docs, ...consultoria.docs], contaFz)),
              `⚠ 10 dias sem chuva no ${m.nome} — ${nome}`,
              `A área do pluviômetro ${m.nome} não vê chuva desde ${ultimaM.slice(8, 10)}/${ultimaM.slice(5, 7)}. Ponto de atenção na lavoura.`);
          }
        }
      } else {
        let ultima = null;
        chuvas.forEach((d) => { const c = d.data(); if ((Number(c.mm) || 0) > 0 && c.data && (!ultima || c.data > ultima)) ultima = c.data; });
        if (ultima && diasEntre(ultima, hoje) === 10 && !(await jaAvisou(fazendaId, "seca-" + ultima))) {
          const daFazenda = await db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get();
          await mandar(tokensDe(filtrarDestinatarios([...daFazenda.docs, ...consultoria.docs], contaFz)),
            `10 dias sem chuva — ${nome}`,
            `Última chuva registrada em ${ultima.slice(8, 10)}/${ultima.slice(5, 7)}. Vale conferir a lavoura.`);
        }
      }

      // ---- emergência prevista (4 dias depois do plantio): avisa no dia ----
      const emergHoje = [];
      lavouraDocs.forEach((d) => {
        const l = d.data() || {};
        const tn = nomeTalhao(l.talhaoId);
        const partes = Array.isArray(l.partes) && l.partes.length >= 2 ? l.partes : null;
        if (partes) partes.forEach((p, k) => { if (p && p.emergenciaAuto && String(p.dataEmergencia || "").slice(0, 10) === hoje) emergHoje.push({ chave: `emerg-${d.id}-${p.nome || k}-${hoje}`, texto: `${tn} (parte ${p.nome || k + 1})` }); });
        else if (l.emergenciaAuto && String(l.dataEmergencia || "").slice(0, 10) === hoje) emergHoje.push({ chave: `emerg-${d.id}-${hoje}`, texto: tn });
      });
      const emergNovas = [];
      for (const e of emergHoje) if (!(await jaAvisou(fazendaId, e.chave))) emergNovas.push(e.texto);
      if (emergNovas.length) {
        const daFaz = await db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get();
        await mandar(tokensDe(filtrarDestinatarios([...daFaz.docs, ...consultoria.docs], contaFz)),
          `🌱 Provável emergência hoje — ${nome}`,
          `${emergNovas.join(", ")}: meio do plantio + 4 dias. Confira no campo; se for outro dia, corrija em Dados da lavoura.`,
          destino(fazendaId, "lavoura"));
      }

      // ---- fungicida pelo DAE ----
      const lavoura = lavouraDocs;
      const recs = await base.collection("recomendacoes").get();
      const recsFung = new Set();
      recs.forEach((d) => { const r = d.data(); if ((r.tipo || "").trim().toLowerCase() === "fungicida") recsFung.add(d.id); });
      const execs = await base.collection("execucoes").get();
      const ultimaFungPorTalhao = {};
      execs.forEach((d) => {
        const e = d.data();
        if (!recsFung.has(e.recomendacaoId) || !e.talhaoId || !e.data) return;
        const dia = String(e.data).slice(0, 10);
        if (!ultimaFungPorTalhao[e.talhaoId] || dia > ultimaFungPorTalhao[e.talhaoId]) ultimaFungPorTalhao[e.talhaoId] = dia;
      });

      const daFazendaDocs = (await db.collection("usuarios").where("fazendas", "array-contains", fazendaId).get()).docs;
      const todos = tokensDe(filtrarDestinatarios([...daFazendaDocs, ...consultoria.docs], contaFz));
      // quem mexe com dinheiro na fazenda (produtor/gerente) + consultoria
      const financeiro = tokensDe(filtrarDestinatarios([...daFazendaDocs.filter((d) => !/operador|monitor/i.test(String(d.data().funcao || ""))), ...consultoria.docs], contaFz));
      const irFung = destino(fazendaId, "fungicidas");
      const vencidasFung = [];
      for (const d of lavoura.docs) {
        const l = d.data();
        if (!l.talhaoId || !l.dataEmergencia) continue;
        const dae = diasEntre(l.dataEmergencia, hoje);
        const regra = regraFungicida(dados, l.cultura || "Soja");
        if (dae < 0 || dae > regra.fim + 30) continue;
        const ultimaFung = ultimaFungPorTalhao[l.talhaoId];
        if (!ultimaFung && dae === regra.primeira - 2 && !(await jaAvisou(fazendaId, `fung1-${l.talhaoId}-${l.dataEmergencia}`))) {
          await mandar(todos, `1ª fungicida se aproxima — ${nome}`,
            `${nomeTalhao(l.talhaoId)} (${l.cultura || "lavoura"}) está com ${dae} DAE: entra na janela de ${regra.primeira} dias em 2 dias.`, irFung);
        }
        if (ultimaFung && diasEntre(ultimaFung, hoje) === regra.intervalo - 2 && dae <= regra.fim && !(await jaAvisou(fazendaId, `fungN-${l.talhaoId}-${ultimaFung}`))) {
          await mandar(todos, `Próxima fungicida em 2 dias — ${nome}`,
            `${nomeTalhao(l.talhaoId)}: última fungicida em ${ultimaFung.slice(8, 10)}/${ultimaFung.slice(5, 7)}, o intervalo de ${regra.intervalo} dias vence em 2 dias.`, irFung);
        }
        if (dae > regra.fim) continue;   // ciclo de fungicida encerrado: sem aviso de vencida
        // venceu e não foi feita: um aviso por talhão a cada 3 dias de atraso
        const prevista = ultimaFung ? diasEntre(ultimaFung, hoje) - regra.intervalo : dae - regra.primeira;
        if (prevista >= 0 && prevista % 3 === 0 && !(await jaAvisou(fazendaId, `fungV-${l.talhaoId}-${ultimaFung || l.dataEmergencia}-${prevista}`))) vencidasFung.push(`${nomeTalhao(l.talhaoId)}${prevista ? ` (${prevista} d)` : ""}`);
      }
      if (vencidasFung.length) await mandar(todos, `Fungicida vencida — ${nome}`, `Sem fungicida executada no prazo: ${vencidasFung.join(", ")}. Toque para ver por talhão.`, irFung);

      // ---- monitoramento de pragas: toda semana, da emergência à colheita ----
      const visitas = await base.collection("visitas").get();
      const ultMon = {};
      visitas.forEach((d) => { const v = d.data(); if (v.ehMonitoramento && v.talhaoId && v.data && (!ultMon[v.talhaoId] || v.data > ultMon[v.talhaoId])) ultMon[v.talhaoId] = v.data; });
      const atrasados = [];
      for (const d of lavoura.docs) {
        const l = d.data();
        if (!l.talhaoId || !l.dataEmergencia) continue;
        const dae = diasEntre(l.dataEmergencia, hoje);
        if (dae < 7 || dae > 240) continue;
        const dias = ultMon[l.talhaoId] ? diasEntre(ultMon[l.talhaoId], hoje) : null;
        if (dias === null || dias >= intervaloMon(l.cultura)) atrasados.push(`${nomeTalhao(l.talhaoId)}${dias === null ? "" : ` (${dias} d)`}`);
      }
      // uma vez por semana por fazenda (segunda) ou quando entra em atraso
      const semana = `${hoje.slice(0, 4)}-${Math.floor((new Date(hoje + "T12:00:00Z") - new Date(hoje.slice(0, 4) + "-01-01T12:00:00Z")) / (7 * 86400000))}`;
      if (atrasados.length && !(await jaAvisou(fazendaId, `mon-${semana}`))) {
        await mandar(todos, `Monitoramento de pragas — ${nome}`, `Talhões para monitorar: ${atrasados.join(", ")}. Algodão a cada 7 dias, demais culturas a cada 10.`, destino(fazendaId, "visitas"));
      }

      // ---- recomendação parada há 3 dias (não prévia, sem execução em algum talhão) ----
      const execPorRec = {};
      execs.forEach((d) => { const e = d.data(); if (e.recomendacaoId && e.talhaoId) (execPorRec[e.recomendacaoId] = execPorRec[e.recomendacaoId] || new Set()).add(e.talhaoId); });
      const paradas = [];
      recs.forEach((d) => {
        const r = d.data();
        if (r.prevista || !r.dataRecomendada) return;
        const dias = diasEntre(String(r.dataRecomendada).slice(0, 10), hoje);
        const falta = (r.talhaoIds || []).filter((tid) => !(execPorRec[d.id] || new Set()).has(tid));
        if (dias >= 3 && dias <= 30 && falta.length) paradas.push({ id: d.id, r, dias, falta });
      });
      for (const p of paradas.slice(0, 5)) {
        if (await jaAvisou(fazendaId, `rec-${p.id}-${Math.floor(p.dias / 3)}`)) continue;
        await mandar(todos, `Recomendação parada há ${p.dias} dias — ${nome}`,
          `${p.r.tipo || "Operação"}${p.r.alvo ? ` · ${p.r.alvo}` : ""} em ${p.falta.map(nomeTalhao).join(", ")} ainda sem execução.`, destino(fazendaId, "apl", p.r.modulo || "pulverizacao", null, p.id));
      }

      // ---- contas: nota vence amanhã ou venceu ----
      const [notas, custosDocs] = await Promise.all([base.collection("notas").get(), base.collection("custos").get()]);
      const amanha = new Date(new Date(hoje + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10);
      const vencemAmanha = [], vencidasNotas = [];
      const classificar = (n) => { if (n.pago || !n.vencimento) return; if (n.vencimento === amanha) vencemAmanha.push(n); else if (n.vencimento < hoje && diasEntre(n.vencimento, hoje) % 3 === 1) vencidasNotas.push(n); };
      notas.forEach((d) => classificar(d.data()));
      // contas sem nota: custo lançado como "vou pagar" (pago === false)
      custosDocs.forEach((d) => { const c = d.data(); if (c.pago === false && c.vencimento && !c.ehBarter) classificar({ emitente: c.descricao, valorTotal: c.valor, vencimento: c.vencimento, pago: false }); });
      const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (vencemAmanha.length && !(await jaAvisou(fazendaId, `nota-amanha-${amanha}`))) {
        await mandar(financeiro, `Vence amanhã — ${nome}`, `${vencemAmanha.length} conta${vencemAmanha.length > 1 ? "s" : ""}: ${vencemAmanha.slice(0, 3).map((n) => `${n.emitente || "nota"} ${dinheiro(n.valorTotal)}`).join(" · ")}`, destino(fazendaId, "fin", null, "notas"));
      }
      if (vencidasNotas.length && !(await jaAvisou(fazendaId, `nota-vencida-${hoje}`))) {
        await mandar(financeiro, `Conta vencida — ${nome}`, `${vencidasNotas.length} conta${vencidasNotas.length > 1 ? "s" : ""} sem baixa: ${vencidasNotas.slice(0, 3).map((n) => `${n.emitente || "nota"} ${dinheiro(n.valorTotal)} (${n.vencimento.slice(8, 10)}/${n.vencimento.slice(5, 7)})`).join(" · ")}`, destino(fazendaId, "fin", null, "notas"));
      }
    } catch (e) {
      console.error("lembretes em " + nome + ":", e);
    }
  }
});

// Teste de aviso: a pessoa toca em "Testar" no app, o app grava um
// documento em usuarios/{uid}/testes, e este gatilho manda um aviso so
// para os aparelhos DELA. Prova na hora se o celular esta recebendo.
exports.testeDeAviso = onDocumentCreated("usuarios/{uid}/testes/{id}", async (evento) => {
  const uid = evento.params.uid;
  const doc = await db.collection("usuarios").doc(uid).get();
  if (!doc.exists) return;
  await mandar(tokensDe([doc]), "Teste de aviso ✓", "Os avisos do AgroCR Campo estão chegando neste aparelho.");
  try { await evento.data.ref.delete(); } catch (e) {}
});

// ============================================================
// Cotacoes online DENTRO do app: soja e milho (CBOT, via Yahoo Finance)
// convertidos para US$/saca e R$/saca com o dolar do momento.
// O aplicativo chama este endereco e desenha os numeros direto na tela.
// ============================================================
const { onRequest } = require("firebase-functions/v2/https");
let cacheCot = null;

exports.cotacoesonline = onRequest({ cors: true }, async (req, res) => {
  try {
    if (cacheCot && Date.now() - cacheCot.em < 10 * 60 * 1000) { res.json(cacheCot.dados); return; }
    const cab = { headers: { "User-Agent": "Mozilla/5.0 (AgroCRCampo)" } };
    const pega = async (simbolo) => {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?interval=1d&range=6mo`, cab);
      const j = await r.json();
      const res0 = j.chart && j.chart.result && j.chart.result[0];
      const meta = res0 && res0.meta;
      if (!meta) return null;
      // serie diaria dos ultimos 6 meses, para o grafico dentro do app
      const ts = (res0.timestamp || []);
      const closes = (res0.indicators && res0.indicators.quote && res0.indicators.quote[0] && res0.indicators.quote[0].close) || [];
      const serie = [];
      for (let i = 0; i < ts.length; i++) {
        if (closes[i] != null) serie.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), v: closes[i] });
      }
      // Variacao do dia: a OFICIAL do Yahoo (mesmo contrato). Calcular na mao
      // pela serie enganava em dia de rolagem de contrato (ex.: set -> dez):
      // o salto entre contratos aparecia como alta gigante que nao existiu.
      const varOficial = typeof meta.regularMarketChangePercent === "number"
        ? meta.regularMarketChangePercent : null;
      const anterior = serie.length > 1 ? serie[serie.length - 2].v : null;
      return { preco: meta.regularMarketPrice, anterior, varOficial, serie };
    };
    // milho da B3 (contrato CCM, R$/saca 60 kg) via TradingView — dado com
    // atraso de ~15 min, suficiente para referencia de campo
    const pegaMilhoB3 = async () => {
      try {
        const r = await fetch("https://scanner.tradingview.com/symbol?symbol=BMFBOVESPA%3ACCM1!&fields=close,change&no_404=true", cab);
        const j = await r.json();
        if (!j || j.close == null) return null;
        return { brlSaca: j.close, varPct: j.change != null ? j.change : null };
      } catch (e) { return null; }
    };
    // milho FUTURO da B3: a B3 nao tem vencimento de junho (contratos sao
    // jan/mar/mai/jul/ago/set/nov) — o mais perto de 30/06 e o de JULHO
    // (letra N). Pegamos sempre o proximo julho.
    const pegaMilhoFuturo = async () => {
      const agora = new Date();
      const ano = agora.getUTCFullYear() + (agora.getUTCMonth() + 1 >= 7 ? 1 : 0);
      try {
        const r = await fetch(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(`BMFBOVESPA:CCMN${ano}`)}&fields=close,change&no_404=true`, cab);
        const j = await r.json();
        if (!j || j.close == null) return null;
        return { venc: `jul/${ano}`, brlSaca: j.close, varPct: j.change != null ? j.change : null };
      } catch (e) { return null; }
    };
    // dolar futuro da B3 (contrato DOL, cotado em R$ por US$ 1.000):
    // sempre o PROXIMO marco e o PROXIMO abril — epoca da colheita da soja
    const pegaDolarFuturo = async () => {
      const agora = new Date();
      const anoDe = (mes) => agora.getUTCFullYear() + (agora.getUTCMonth() + 1 >= mes ? 1 : 0);
      const contratos = [
        { letra: "H", mes: 3, rotulo: "mar", ano: anoDe(3) },
        { letra: "J", mes: 4, rotulo: "abr", ano: anoDe(4) },
      ];
      const sai = [];
      for (const ct of contratos) {
        try {
          const r = await fetch(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(`BMFBOVESPA:DOL${ct.letra}${ct.ano}`)}&fields=close,change&no_404=true`, cab);
          const j = await r.json();
          if (j && j.close != null) sai.push({ venc: `${ct.rotulo}/${ct.ano}`, valor: j.close / 1000, varPct: j.change != null ? j.change : null });
        } catch (e) {}
      }
      return sai.length ? sai : null;
    };
    const [soja, milho, algodao, milhoB3, milhoFuturo, dolarFuturo, dolarR] = await Promise.all([
      pega("ZS=F"), pega("ZC=F"), pega("CT=F"), pegaMilhoB3(), pegaMilhoFuturo(), pegaDolarFuturo(),
      fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL").then((r) => r.json()).catch(() => null),
    ]);
    const dolar = dolarR && dolarR.USDBRL ? Number(dolarR.USDBRL.bid) : null;
    // cents/bushel -> US$/saca 60 kg  (soja: 27,2155 kg/bu · milho: 25,4012 kg/bu)
    const converte = (c, kgPorBushel) => (c ? (c.preco / 100) * (60 / kgPorBushel) : null);
    const varPct = (c) => (c && c.varOficial != null ? c.varOficial
      : c && c.anterior ? ((c.preco - c.anterior) / c.anterior) * 100 : null);
    const dados = {
      em: new Date().toISOString(),
      dolar,
      soja: soja ? { centsBushel: soja.preco, usdSaca: converte(soja, 27.2155), brlSaca: dolar ? converte(soja, 27.2155) * dolar : null, varPct: varPct(soja), serie: soja.serie.map((p) => ({ d: p.d, v: (p.v / 100) * (60 / 27.2155) })) } : null,
      milho: milho ? { centsBushel: milho.preco, usdSaca: converte(milho, 25.4012), brlSaca: dolar ? converte(milho, 25.4012) * dolar : null, varPct: varPct(milho), serie: milho.serie.map((p) => ({ d: p.d, v: (p.v / 100) * (60 / 25.4012) })) } : null,
      // algodao (ICE): cents/libra -> US$/arroba de 15 kg (33,069 lb)
      algodao: algodao ? { centsLibra: algodao.preco, usdArroba: (algodao.preco / 100) * 33.069, brlArroba: dolar ? (algodao.preco / 100) * 33.069 * dolar : null, varPct: varPct(algodao), serie: algodao.serie.map((p) => ({ d: p.d, v: (p.v / 100) * 33.069 })) } : null,
      milhoB3,
      milhoFuturo,
      dolarFuturo,
    };
    cacheCot = { em: Date.now(), dados };
    res.json(dados);
  } catch (e) {
    res.status(500).json({ erro: String(e && e.message || e) });
  }
});

// ============================================================
// Leitura de nota/pedido por FOTO com IA (fase 1 da Caixa de Notas)
//
// O aplicativo manda a foto (ja comprimida) e recebe os dados
// estruturados: fornecedor, numero, data, valor e a lista de itens
// com o TIPO sugerido (insumo, diesel, peca, servico) para a
// destinacao. So funciona LOGADO (AgroCR ou GerenteAgro) e depende
// da chave da Anthropic guardada como segredo ANTHROPIC_API_KEY.
// ============================================================
const CHAVE_IA = SO_AVISOS ? null : defineSecret("ANTHROPIC_API_KEY");

// Lê o JSON da IA mesmo se a resposta veio cortada no meio (nota muito
// longa): recua até o último item completo e fecha os colchetes.
function analisarJson(bruto) {
  try { return JSON.parse(bruto); } catch (e) {}
  for (let i = bruto.length; i > 0; i--) {
    if (bruto[i - 1] !== "}") continue;
    const parte = bruto.slice(0, i);
    for (const fecho of ["", "]", "]}", "}]}", "}"]) {
      try { return JSON.parse(parte + fecho); } catch (e) {}
    }
  }
  return null;
}

const PROMPT_MAQUINAS = `Você está lendo o MAQUINÁRIO de uma fazenda brasileira — uma FOTO ou PDF
(lista, planilha, inventário, apólice de seguro, ou a foto da própria máquina com a plaqueta/modelo
visível) OU uma FALA DITADA pelo usuário (transcrição com possíveis erros: interprete pelo som,
ex.: "trator jondir seis mil cento e dez jota" = Trator John Deere 6110J). Extraia as máquinas e implementos.
Responda SOMENTE com JSON válido exatamente neste formato:
{"maquinas":[{"tipo":"Trator|Pulverizador|Plantadeira|Colheitadeira|Caminhão|Implemento|Outro",
"nome":"marca e modelo, ex.: John Deere 6110J","marca":"só a marca, ou null","ano":"ano, ou null",
"obs":"detalhes úteis (horímetro, placa, série) ou null"}]}
Regras: use o tipo MAIS PRÓXIMO da lista (grade, arado, carreta = Implemento). Não invente
máquinas que não estão no documento. Se for a foto de uma máquina só, retorne essa única.`;

const PROMPT_ROMANEIO = `Você está lendo a FOTO (ou PDF) de um ROMANEIO / ticket de pesagem / nota de
entrada de grãos de um armazém, silo ou cerealista brasileiro. O caminhão chegou carregado, foi pesado
e classificado (umidade, impureza, avariados) e o papel mostra os descontos e o peso líquido final.
Responda SOMENTE com JSON válido exatamente neste formato (use null para o que não aparecer):
{"data":"AAAA-MM-DD ou null","placa":"placa do caminhão ou null","produto":"Soja|Milho|Sorgo|Algodão|Arroz|Feijão ou null",
"pesoBrutoKg":0,"umidadePct":0,"impurezaPct":0,"avariadosPct":0,
"descontoUmidadeKg":0,"descontoImpurezaKg":0,"descontoOutrosKg":0,
"pesoLiquidoKg":0,"numeroRomaneio":"número ou null","deposito":"nome do armazém/cerealista ou null"}
Regras:
- Pesos SEMPRE em kg (se o papel mostrar sacas, converta: 1 saca = 60 kg).
- pesoBrutoKg = peso da carga ANTES dos descontos de classificação (peso bruto − tara da balança,
  às vezes chamado "peso líquido de balança" ou "peso sujo").
- pesoLiquidoKg = o líquido FINAL creditado ao produtor, depois de todos os descontos.
- Se o papel mostrar só os percentuais e os pesos, calcule os kg descontados de cada um
  (desconto = diferença que o próprio papel aplica; não invente tabela própria).
- Se não houver desconto discriminado mas houver bruto e líquido, deixe os descontos em null.`;

const PROMPT_NOTA = `Você está lendo a FOTO de uma nota fiscal, pedido ou orçamento agrícola brasileiro.
Extraia os dados e responda SOMENTE com um JSON válido, sem comentários, neste formato:
{
 "fornecedor": "nome de quem emitiu (ou null)",
 "numeroNota": "número da NF/pedido (ou null)",
 "data": "AAAA-MM-DD (ou null)",
 "valorTotal": 0.0,
 "itens": [
   {"descricao": "nome do produto como está escrito", "quantidade": 0.0,
    "unidade": "L|kg|t|un|cx|sc|m|par|jogo",
    "valorUnitario": 0.0, "valorTotal": 0.0,
    "tipo": "insumo|diesel|peca|servico|outro"}
 ]
}
Regras:
- "tipo": defensivos, sementes, adubos e fertilizantes = "insumo"; diesel/combustível = "diesel";
  peças, filtros, óleos lubrificantes, correias, rolamentos, pneus = "peca";
  frete, mão de obra, serviços = "servico"; o resto = "outro".
- Números no padrão brasileiro (1.234,56) viram números de verdade (1234.56).
- Se um campo não aparecer na foto, use null (não invente).
- Quantidade em mililitros vire litros (L); gramas vire kg.`;

// Talhoes: foto/PDF de uma planilha ou lista vira o cadastro em lote
const PROMPT_TALHOES = `Você está lendo uma lista/planilha/mapa de TALHÕES de uma fazenda brasileira
(pode ser foto, PDF ou texto — inclusive uma FALA DITADA pelo usuário, com possíveis erros de
transcrição: interprete pelo som, ex.: "pivô dois com cento e vinte hectare" = Pivô 2, 120 ha).
Extraia os talhões e responda SOMENTE com JSON válido:
{"talhoes":[{"nome":"nome do talhão como está escrito","areaHa":0.0,"cultura":"Soja|Milho|Algodão|... ou null"}]}
Regras: números brasileiros (1.234,56) viram números (1234.56); área sempre em hectares
(alqueire paulista ×2,42; alqueire goiano/mineiro ×4,84); se não houver área, use null; não invente talhões.`;

// Laudo de ANÁLISE DE SOLO (foto ou PDF do laboratório) → valores por amostra + resumo
// em linguagem simples. Um laudo pode trazer vários talhões: sai uma amostra por talhão.
const PROMPT_SOLO = `Você está lendo o LAUDO de uma ANÁLISE DE SOLO de um laboratório brasileiro (foto, PDF ou
texto). Pode haver VÁRIAS amostras/talhões no mesmo laudo — devolva uma por linha de resultado.
Responda SOMENTE com JSON válido, neste formato:
{"resumoGeral":"se houver mais de uma amostra: 3 a 5 frases sobre o CONJUNTO (média, variação entre pontos, o que se destaca); senão null",
"analises":[{"talhao":"identificação da amostra/talhão como está escrita ou null","data":"AAAA-MM-DD ou null",
"laboratorio":"nome do laboratório ou null","profundidade":"ex.: 0-20 ou null",
"valores":{"ph":0,"mo":0,"pRes":0,"pMeh":0,"p":0,"k":0,"ca":0,"mg":0,"al":0,"hAl":0,"sb":0,"ctc":0,"v":0,"m":0,"s":0,"b":0,"cu":0,"fe":0,"mn":0,"zn":0,"argila":0,"silte":0,"areia":0},
"unidades":{"ph":"CaCl2 ou H2O","mo":"g/dm³","pRes":"mg/dm³","pMeh":"mg/dm³","p":"mg/dm³","k":"mmolc/dm³","ca":"mmolc/dm³","mg":"mmolc/dm³","al":"mmolc/dm³","hAl":"mmolc/dm³","sb":"mmolc/dm³","ctc":"mmolc/dm³","v":"%","m":"%","s":"mg/dm³","b":"mg/dm³","cu":"mg/dm³","fe":"mg/dm³","mn":"mg/dm³","zn":"mg/dm³","argila":"%","silte":"%","areia":"%"},
"resumo":"3 a 5 frases em português simples do Brasil, para produtor rural: como está a fertilidade (acidez, matéria orgânica, fósforo, potássio, cálcio/magnésio, saturação por bases, micronutrientes), o que está baixo ou alto e o que isso pede (calagem, gessagem, adubação de correção) — sem recomendar dose exata",
"alertas":["até 4 avisos curtos do que está fora da faixa adequada para culturas anuais, ex.: 'Fósforo baixo (4 mg/dm³)'"]}]}
Regras: FÓSFORO: se o laudo diz o método, use "pRes" para resina e "pMeh" para Mehlich (Mehlich-1); se traz os dois, preencha os dois; "p" só quando o método não aparece. PROFUNDIDADE: 0-20 e 20-40 do mesmo talhão são amostras DIFERENTES — devolva uma análise para cada profundidade, com "profundidade" preenchida.
Copie os números como estão no laudo, convertendo vírgula decimal (5,2 → 5.2); use null para o que
não aparece (não invente); mantenha as unidades escritas no laudo em "unidades" (se o laudo usa cmolc/dm³,
escreva cmolc/dm³ e não converta); "k" em mg/dm³ fica em mg/dm³ com a unidade certa; se o laudo traz
apenas uma amostra sem nome, "talhao" é null. A data é a da coleta ou a do laudo. Faixas de referência
para o resumo (culturas anuais no Cerrado): pH CaCl2 adequado 5,0–5,5 (H2O 5,5–6,0); V% adequado 50–60%;
m% acima de 20% é problema; MO abaixo de 15 g/dm³ é baixa; P Mehlich abaixo de 8 mg/dm³ (argiloso) é baixo; P resina abaixo de 15 mg/dm³ é baixo;
K abaixo de 1,5 mmolc/dm³ (60 mg/dm³) é baixo; Ca abaixo de 15 e Mg abaixo de 5 mmolc/dm³ são baixos;
S abaixo de 5, B abaixo de 0,3, Cu abaixo de 0,8, Mn abaixo de 5 e Zn abaixo de 1,5 mg/dm³ são baixos.`;

// Lista de peças do almoxarifado (foto/PDF de nota, romaneio, pedido ou requisição de retirada)
const PROMPT_ALMOX = `Você está lendo uma LISTA DE PEÇAS / MATERIAIS de almoxarifado de fazenda brasileira (foto ou PDF:
nota fiscal, romaneio, pedido, orçamento ou requisição de retirada escrita à mão). Extraia cada item e responda
SOMENTE com JSON válido:
{"nf":"número da nota ou null","fornecedor":"emitente/loja ou null","maquina":"máquina escrita na requisição (ex.: Trator 7230J) ou null",
"itens":[{"nome":"descrição da peça como está escrita","codigo":"código/referência da peça ou null","qtd":0,"unidade":"un|L|kg|m|par|jogo|cx","valorUnit":0}]}
Regras: números brasileiros (1.234,56) viram números (1234.56); valorUnit é o preço de UMA unidade (null se não houver);
não invente itens; ignore totais, impostos e frete.`;

exports.lernota = onRequest({ cors: true, secrets: CHAVE_IA ? [CHAVE_IA] : [], timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
  try {
    if (req.method !== "POST") { res.status(405).json({ erro: "use POST" }); return; }
    // 1) so gente logada usa (a leitura custa dinheiro por chamada)
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) { res.status(401).json({ erro: "entre na sua conta para usar a leitura por IA" }); return; }
    let quem = null;
    try { quem = await getAuth().verifyIdToken(token); } catch (e) {}
    if (!quem) { try { quem = await getAuth(appGerenteAgro).verifyIdToken(token); } catch (e) {} }
    if (!quem) { res.status(401).json({ erro: "login inválido" }); return; }
    if (!(await dentroDoLimite(quem.uid, "leituras", 150, res))) return;

    // 2) chave da IA configurada? (tira BOM/espacos que vem de colar no terminal)
    const chave = String(CHAVE_IA.value() || "").replace(/^﻿/, "").trim();
    if (!chave || chave === "pendente") {
      res.status(503).json({ erro: "A leitura por IA ainda não foi ativada pela administração." });
      return;
    }

    // 3) entrada: foto (data URI), PDF (data URI) ou texto (fala transcrita)
    const corpo = req.body || {};
    const modo = String(corpo.modo || "nota");
    const conteudo = [];
    const foto = String(corpo.foto || "");
    const pdf = String(corpo.pdf || "");
    const texto = String(corpo.texto || "");
    const mFoto = foto.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    const mPdf = pdf.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
    if (mFoto) conteudo.push({ type: "image", source: { type: "base64", media_type: mFoto[1], data: mFoto[2] } });
    else if (mPdf) conteudo.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: mPdf[1] } });
    else if (!texto) { res.status(400).json({ erro: "mande uma foto, um PDF ou um texto" }); return; }

    // 4) a instrucao muda conforme o que esta sendo preenchido
    let prompt;
    if (modo === "ajuda") {
      const ctx = corpo.contexto || {};
      const app = String(ctx.app || "o aplicativo").slice(0, 40);
      prompt = `Você é o SUPORTE TÉCNICO do ${app}, um aplicativo brasileiro de gestão de fazenda
que funciona até sem internet (o que for lançado sobe quando o sinal volta). O usuário é gente do
campo, com pouca familiaridade com tecnologia. Responda SEMPRE em português simples do Brasil,
curto, com passos numerados quando for um "como fazer". Nunca invente telas que não existem.

O QUE O APLICATIVO TEM (menu de cada fazenda):
- 📋 Dados da fazenda: cadastro da fazenda e dos talhões (nome e área em ha). Dá para cadastrar
  todos os talhões de uma vez tirando foto ou mandando PDF da lista (botão de IA).
- 🌿 Dados da lavoura: cultura, variedade, data de plantio e de emergência por talhão, por safra.
- 🧪 Fertilidade do solo: manda foto ou PDF do laudo de análise de solo, o app resume por talhão e
  guarda o histórico com comparativo entre anos; gera os pontos de coleta de solo no mapa do talhão.
- 🚜 Operações no talhão: o consultor/gerente lança a RECOMENDAÇÃO (produtos, dose/ha, talhões,
  data) e o operador marca a EXECUÇÃO com a data em que aplicou. Tem botão de falar a receita.
- 📦 Estoque: automático — saldo = comprado − usado (dose/ha × área executada) ± ajustes manuais.
  Converte unidades (mL→L, g e t→kg).
- 🛰️ Mapa NDVI: talhões sobre imagem de satélite (precisa do arquivo KML dos talhões).
- 🌧️ Pluviometria: cadastra pluviômetros e lança chuvas (dá para falar: "choveu 20 milímetros
  ontem no retiro"). Chuvas somam, nunca se apagam sozinhas.
- 🌦️ Previsão do tempo: chuva prevista por talhão (hoje, amanhã, 7, 15 e 30 dias), previsão de 7 dias
  no ponto da fazenda e mapa ao vivo (radar, satélite, chuva prevista). O que já choveu fica na Pluviometria.
- 🌾 Colheita: escolhe a cultura, lança as cargas por caminhão (com placa), dá baixa quando o
  caminhão descarrega, mostra sacas colhidas, média sc/ha, % da área colhida e o que está na estrada.
- 💹 Cotações: dólar, soja, milho B3, algodão, com preço regional.
- 💰 Financeiro: custos por talhão e categoria, funcionários, COMPRAS (dá para tirar foto ou mandar
  PDF da nota/pedido que a IA lê os itens) e inventário de máquinas.
- ⛽ Diesel e manutenção: vários tanques (inclusive comboio), abastecimento por máquina ou caminhão
  (inclusive frota terceirizada), entrada de diesel por foto da nota, consumo por máquina.
- 🧑‍🌾 Visitas técnicas: modo campo por toques (o GPS acha o talhão pelo KML) e o botão
  "🎙 Falar o que estou vendo" — grava a fala andando no talhão; sem internet o áudio fica guardado
  e vira resumo sozinho quando o sinal volta. Ao finalizar, gera o relatório da visita.
- 📊 Relatórios: aplicações em PDF, chuvas, relatório geral. 📁 Documentos: mapas, pedidos,
  contratos. 🗄️ Histórico de safras: muda a safra atual e consulta as antigas.
- Perfis: consultoria/gerente (lança recomendações, vê tudo) e fazenda/operador (marca execuções,
  lança chuvas, colheita, diesel). Acessos são criados no painel "👥 Acessos de usuários" do
  administrador; assinaturas e pagamento ficam em "📄 Minhas assinaturas".
- A voz e a leitura por IA precisam de internet; todo o resto funciona offline.

REGRAS: responda só sobre o aplicativo. Se a dúvida for de pagamento, licença, erro que não
resolve, ou algo que você não sabe, diga para tocar no botão verde do WhatsApp na tela de
Suporte e falar com a equipe. Não responda em JSON — responda em texto corrido simples,
SEM formatação markdown (nada de asteriscos, cerquilhas ou negrito).
${String(ctx.historico || "") ? `\nConversa até agora:\n${String(ctx.historico).slice(0, 3000)}` : ""}
Pergunta do usuário: "${texto}"`;
    } else if (modo === "maquinas") prompt = PROMPT_MAQUINAS + (texto ? `\n\nTexto informado:\n${texto}` : "");
    else if (modo === "romaneio") prompt = PROMPT_ROMANEIO + (texto ? `\n\nTexto informado:\n${texto}` : "");
    else if (modo === "talhoes") prompt = PROMPT_TALHOES + (texto ? `\n\nTexto informado:\n${texto}` : "");
    else if (modo === "almox") prompt = PROMPT_ALMOX + (texto ? `\n\nTexto informado:\n${texto}` : "");
    else if (modo === "solo") prompt = PROMPT_SOLO + (texto ? `\n\nTexto informado:\n${texto}` : "");
    else if (modo === "voz") {
      const ctx = corpo.contexto || {};
      prompt = `Um usuário de aplicativo rural brasileiro FALOU um lançamento (transcrição automática,
pode ter erros de ditado — interprete pelo sentido). Hoje é ${new Date().toISOString().slice(0, 10)}.
Contexto da tela: ${String(ctx.descricao || "")}
Fala transcrita: "${texto}"
Responda SOMENTE com JSON válido exatamente neste formato (use null para o que não foi dito):
${String(ctx.formato || "{}")}`;
    } else prompt = PROMPT_NOTA + (texto ? `\n\nTexto informado:\n${texto}` : "");
    conteudo.push({ type: "text", text: prompt });

    const Anthropic = require("@anthropic-ai/sdk");
    const cliente = new Anthropic({ apiKey: chave });
    const resposta = await cliente.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: conteudo }],
    });
    if (resposta.stop_reason === "refusal") {
      res.status(422).json({ erro: "a IA não conseguiu ler esta imagem — tente outra foto" });
      return;
    }
    const saida = (resposta.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (modo === "ajuda") { res.json({ resposta: saida.trim(), lidoPor: "ia" }); return; }
    const j = saida.match(/\{[\s\S]*\}/) || saida.match(/\{[\s\S]*/);
    if (!j) { res.status(422).json({ erro: "não consegui estruturar a nota — tente uma foto mais nítida" }); return; }
    const dados = analisarJson(j[0]);
    if (!dados) { res.status(422).json({ erro: "não consegui estruturar a nota — tente uma foto mais nítida" }); return; }
    dados.lidoPor = "ia";
    res.json(dados);
  } catch (e) {
    res.status(500).json({ erro: "falha na leitura: " + String(e && e.message || e).slice(0, 200) });
  }
});

// ============================================================
// Transcricao de AUDIO (diario de campo da visita tecnica)
//
// O tecnico grava a observacao falada no aparelho (funciona offline);
// quando o sinal volta o app manda o audio para ca, o Google
// Speech-to-Text transcreve em pt-BR e o texto segue para a IA
// estruturar. Roda no MESMO projeto (Blaze) — sem conta extra.
// ============================================================
let clienteFala = null;
exports.transcrever = onRequest({ cors: true, timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
  try {
    if (req.method !== "POST") { res.status(405).json({ erro: "use POST" }); return; }
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) { res.status(401).json({ erro: "entre na sua conta para transcrever" }); return; }
    let quem = null;
    try { quem = await getAuth().verifyIdToken(token); } catch (e) {}
    if (!quem) { try { quem = await getAuth(appGerenteAgro).verifyIdToken(token); } catch (e) {} }
    if (!quem) { res.status(401).json({ erro: "login inválido" }); return; }
    if (!(await dentroDoLimite(quem.uid, "transcricoes", 300, res))) return;

    const audio = String((req.body && req.body.audio) || "");
    const m = audio.match(/^data:(audio\/(?:webm|ogg|mp4|mpeg|wav|x-wav|wave))(?:;codecs=[^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) { res.status(400).json({ erro: "mande o áudio como data URI (webm/ogg/wav)" }); return; }

    const speech = require("@google-cloud/speech");
    if (!clienteFala) clienteFala = new speech.SpeechClient();
    const encoding = m[1] === "audio/ogg" ? "OGG_OPUS" : m[1] === "audio/webm" ? "WEBM_OPUS" : /wav/.test(m[1]) ? "LINEAR16" : "ENCODING_UNSPECIFIED";
    // dicionário do app (pragas, daninhas, doenças, talhões…): o transcritor
    // dá preferência a essas palavras — sem isso ele erra os nomes técnicos
    const dicas = Array.isArray(req.body.dicas)
      ? req.body.dicas.map((d) => String(d).slice(0, 100)).filter(Boolean).slice(0, 400)
      : [];
    const [resp] = await clienteFala.recognize({
      config: {
        encoding, languageCode: "pt-BR", enableAutomaticPunctuation: true, model: "latest_long",
        // o formato ogg não declara a taxa no cabeçalho; o webm declara
        ...(encoding === "OGG_OPUS" ? { sampleRateHertz: 48000 } : encoding === "LINEAR16" ? { sampleRateHertz: 16000 } : {}),
        ...(dicas.length ? { speechContexts: [{ phrases: dicas, boost: 14 }] } : {}),
      },
      audio: { content: m[2] },
    });
    const texto = (resp.results || []).map((r) => (r.alternatives && r.alternatives[0] && r.alternatives[0].transcript) || "").join(" ").trim();
    if (!texto) { res.status(422).json({ erro: "não consegui entender o áudio — grave de novo mais perto do aparelho" }); return; }
    res.json({ texto });
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/SERVICE_DISABLED|has not been used|PERMISSION_DENIED/i.test(msg)) {
      res.status(503).json({ erro: "A transcrição ainda não foi ativada: ligue a API Speech-to-Text no console do Google Cloud (projeto agrocr-campo)." });
      return;
    }
    res.status(500).json({ erro: "falha na transcrição: " + msg.slice(0, 180) });
  }
});

// No projeto gerenteagro ficam so as funcoes de aviso (ver SO_AVISOS acima)
if (SO_AVISOS) for (const k of Object.keys(exports)) if (!["avisoRecomendacao", "avisoChuva", "avisoExecucao", "lembretesDiarios", "testeDeAviso", "asaas", "aoCriarFazenda", "avisoNovoAcesso"].includes(k)) delete exports[k];
