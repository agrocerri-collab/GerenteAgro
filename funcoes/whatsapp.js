// ============================================================
// SUPORTE PELO WHATSAPP — o produtor manda a dúvida (texto ou áudio) para o
// número do aplicativo e a IA (Claude) responde na hora, ensinando a usar.
//
// Caminho: WhatsApp Business Platform (API oficial da Meta, "Cloud API").
//   Meta → POST neste webhook → Claude → resposta pela API da Meta.
// Precisa, no Secret Manager do projeto agrocr-campo:
//   WHATSAPP_TOKEN     token permanente do app da Meta (usuário de sistema)
//   WHATSAPP_PHONE_ID  o "ID do número de telefone" do WhatsApp Business
//   WHATSAPP_VERIFY    palavra de verificação que se digita no painel da Meta
//   ANTHROPIC_API_KEY  já existe (mesma da leitura de notas)
// Enquanto WHATSAPP_TOKEN estiver "pendente", o webhook só confirma a
// verificação e registra as mensagens sem responder.
//
// Memória: as últimas mensagens de cada número ficam em whatsapp/{telefone}
// (agrocr-campo) para a conversa ter contexto. Limite por número e por dia
// para o custo não fugir se alguém automatizar mensagens.
// ============================================================
const https = require("https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");
const WHATSAPP_VERIFY = defineSecret("WHATSAPP_VERIFY");
const CHAVE_IA = defineSecret("ANTHROPIC_API_KEY");
const LIMITE_DIA = 60;          // mensagens respondidas por número por dia
const MEMORIA = 12;             // quantas mensagens anteriores entram no contexto
const limpo = (s) => String(s || "").replace(/^﻿/, "").trim();

// O que o aplicativo tem — é daqui que a IA tira as respostas. Não inventa tela.
const CONHECIMENTO = `
O aplicativo (AgroCR Campo; vendido também como GerenteAgro — é o mesmo programa) é um app de
gestão de fazenda de grãos que funciona SEM INTERNET: o que a pessoa lança fica no celular e sobe
sozinho quando o sinal volta (o aviso "Salvo no aparelho" fica no topo). Abre no navegador do
celular e pode ser instalado na tela inicial ("Adicionar à tela inicial"). Login por e-mail e
senha; "esqueci a senha" manda um e-mail para trocar. Cada pessoa vê só as fazendas liberadas
para ela; o que ela lança fica assinado com o nome dela.

TELA DA FAZENDA (menu em três blocos):
FAZENDA E LAVOURA
- 📋 Dados da fazenda: fazenda, talhões (nome e área), pluviômetros (com posição no mapa),
  KML do mapa, acessos das pessoas (só consultoria). Talhões em lote por foto/PDF/voz.
- 🌿 Dados da lavoura: cultura, variedade, plantio e emergência (DAE) por talhão e safra;
  cultura da safrinha (ex.: milho) por talhão.
- 🚜 Operações no talhão: pulverização, semeadura, adubação. A consultoria lança a RECOMENDAÇÃO
  (produtos, dose/ha, talhões, data); o operador marca a EXECUÇÃO informando dia, área executada
  e produtos usados de fato. Pendências aparecem com número amarelo no cartão.
- 📦 Estoque atualizado: automático = comprado − aplicado (dose/ha × área executada) ± ajustes
  manuais e entregas da revenda; separado por ciclo (safra/safrinha); mostra a cultura do insumo.
- 🛰️ Mapa NDVI: talhões do KML com imagem de satélite (Sentinel-2) e vigor por data; GPS
  "onde estou".
- 🌧️ Pluviometria: lançar chuva por pluviômetro (mm e data), importar planilha Excel/CSV
  (colunas Data, mm, Pluviômetro), mapa de chuva por pluviômetro, previsão do tempo no ponto da
  fazenda, radar/satélite ao vivo, período (últimos dias, ano-safra jul→jun, ano civil, de/até);
  com vários pluviômetros o acumulado é a média entre eles.
- 🌾 Colheita: cada carga sai do talhão "na estrada" e recebe BAIXA no armazém com o peso da
  balança; romaneio por foto (IA lê umidade/impureza e descontos); área colhida; média sc/ha por
  talhão; caminhões; separado por cultura (soja, milho...).
DINHEIRO E MÁQUINAS (só quem tem permissão de dinheiro: produtor e gerente por padrão)
- 💹 Cotações: dólar, soja/milho (B3/Chicago), cotações regionais lançadas pela consultoria.
- 💰 Financeiro: Resultado da safra (DRE) por cultura; Custos (R$ da safra por talhão e
  categoria, custo em sacas); Planejamento de custos; Venda e travamento (por cultura, sacas
  comprometidas x livres, barter); Planejamento de insumos (o que falta comprar, pedido de
  cotação); Funcionários (salário, encargos, INSS/IR, comissão mensal ou anual, custo real do
  produtor, simulador); Notas fiscais (XML da NF-e, foto/PDF lido por IA, ou direto da SEFAZ
  com certificado digital; cada item destinado a uma categoria de custo ou a insumo/estoque;
  forma de pagamento e vencimento obrigatórios; avisos de vencidas); Compras de insumos (lista
  do que foi comprado, leitura de nota por foto/PDF, rateio pelo grupo); Inventário de máquinas
  (cadastro por foto/PDF/voz); Relatórios financeiros em PDF.
- ⛽ Diesel e manutenção: tanque, entradas de diesel, abastecimentos por máquina (horímetro),
  trocas de óleo e manutenções.
ACOMPANHAMENTO E AJUDA
- 🧑‍🌾 Visitas técnicas (só consultoria): diário falado da visita; grava áudio até offline e a
  IA resume por categoria (fisiologia, daninhas, pragas, doenças) quando o sinal volta.
- 📊 Relatórios: geral, pulverização, semeadura, adubação, chuva, colheita, mapa, dados,
  estoque, compras, máquinas — em PDF (botão 🖨 PDF), filtro por talhão e ciclo.
- 📁 Documentos: mapas, pedidos, contratos anexados.
- 🗄️ Histórico de safras: trocar a safra em uso; safras encerradas ficam para consulta.
- 🆘 Suporte técnico: assistente de IA que ensina o app, vídeos e WhatsApp da equipe.
- 🌱 Assistente da fazenda (botão verde flutuante): por texto, abre telas, responde com os dados
  da fazenda, gera relatórios em PDF, lança chuva, carga de colheita, área colhida e abastecimento.

TELA INICIAL DA CONSULTORIA: lista de fazendas e grupos (visão geral do grupo: custos, estoque e
colheita somados; panorama: culturas, DAE, chuva, veranico, alerta de fungicida, pendências),
simulações da consultoria, Acessos das fazendas (quem entra em cada fazenda, o que cada pessoa
vê), Acessos da consultoria, Financeiro do dono.

VERSÃO DE VENDA (GerenteAgro): pré-cadastro com 7 dias grátis e uma fazenda modelo para conhecer
o app; titular R$ 149,99/mês no cartão (até 12x) ou R$ 1.200/ano no Pix com 1 acesso extra
incluso; acesso adicional R$ 80/mês ou R$ 800/ano; Licenças e Minhas assinaturas no menu.

REGRAS DE OURO: execuções e chuvas nunca se apagam sozinhas (são acréscimos); cadastros valem
a última edição; dinheiro só aparece para quem tem permissão; se estiver sem sinal, o app
funciona e sincroniza depois — não precisa lançar de novo.
`;

function promptSistema(suporte) {
  const equipe = suporte && suporte.whatsapp ? `\nSe a dúvida for de cadastro, senha, pagamento ou algo que a IA não resolve, indique falar com a equipe no WhatsApp ${suporte.whatsapp}.` : "";
  return `Você é o suporte do aplicativo, respondendo pelo WhatsApp. Quem escreve é gente do campo
(produtor, gerente, operador, monitor ou consultor), muitas vezes com pouca familiaridade com
tecnologia, digitando no celular. Responda SEMPRE em português simples do Brasil, curto (máximo
~12 linhas), direto, sem enrolação, com passos numerados quando for "como fazer" e com os nomes
exatos dos botões/telas. Nunca invente tela, botão ou recurso que não esteja no conhecimento
abaixo — se não existir, diga que não existe e sugira o caminho mais próximo. Não use markdown
pesado (nada de tabelas ou títulos); pode usar *negrito* do WhatsApp e emojis com moderação.
Se a mensagem for só um cumprimento, responda cordialmente e pergunte em que ajuda.${equipe}

CONHECIMENTO DO APLICATIVO:
${CONHECIMENTO}`;
}

// ---------- API da Meta ----------
function pedirMeta(caminho, metodo, corpo, token, binario) {
  return new Promise((ok, erro) => {
    const dados = corpo ? JSON.stringify(corpo) : null;
    const u = new URL(caminho.startsWith("http") ? caminho : "https://graph.facebook.com/v21.0/" + caminho);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: metodo, headers: { Authorization: "Bearer " + token, ...(dados ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) } : {}) }, timeout: 30000 }, (res) => {
      const partes = [];
      res.on("data", (d) => partes.push(d));
      res.on("end", () => { const buf = Buffer.concat(partes); ok({ status: res.statusCode, corpo: binario ? buf : buf.toString("utf8") }); });
    });
    req.on("timeout", () => req.destroy(new Error("Meta não respondeu")));
    req.on("error", erro);
    if (dados) req.write(dados);
    req.end();
  });
}
async function enviarTexto(token, phoneId, para, texto) {
  // o WhatsApp aceita até 4096 caracteres por mensagem
  const partes = [];
  let resto = String(texto || "").trim() || "…";
  while (resto.length > 3800) { let corte = resto.lastIndexOf("\n", 3800); if (corte < 2000) corte = 3800; partes.push(resto.slice(0, corte)); resto = resto.slice(corte).trim(); }
  partes.push(resto);
  for (const p of partes) {
    const r = await pedirMeta(`${phoneId}/messages`, "POST", { messaging_product: "whatsapp", to: para, type: "text", text: { body: p } }, token);
    if (r.status >= 300) console.warn("whatsapp envio:", r.status, String(r.corpo).slice(0, 300));
  }
}
async function marcarLida(token, phoneId, idMsg) {
  try { await pedirMeta(`${phoneId}/messages`, "POST", { messaging_product: "whatsapp", status: "read", message_id: idMsg }, token); } catch (e) {}
}
// áudio do WhatsApp (ogg/opus) → texto, com o Google Speech já usado pela visita técnica
async function transcreverAudio(token, mediaId) {
  const meta = await pedirMeta(mediaId, "GET", null, token);
  if (meta.status !== 200) throw new Error("não consegui pegar o áudio");
  const info = JSON.parse(meta.corpo);
  const bin = await pedirMeta(info.url, "GET", null, token, true);
  if (bin.status !== 200) throw new Error("não consegui baixar o áudio");
  const { SpeechClient } = require("@google-cloud/speech");
  const cliente = new SpeechClient();
  const [r] = await cliente.recognize({
    audio: { content: bin.corpo.toString("base64") },
    config: { encoding: "OGG_OPUS", sampleRateHertz: 48000, languageCode: "pt-BR", enableAutomaticPunctuation: true, model: "latest_long" },
  });
  return (r.results || []).map((x) => (x.alternatives && x.alternatives[0] ? x.alternatives[0].transcript : "")).join(" ").trim();
}

// ---------- a resposta da IA ----------
async function responder(db, chave, telefone, pergunta, suporte) {
  const ref = db.collection("whatsapp").doc(telefone);
  const doc = await ref.get();
  const dados = doc.exists ? doc.data() : {};
  const dia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const usadoHoje = dados.dia === dia ? Number(dados.usosDia || 0) : 0;
  if (usadoHoje >= LIMITE_DIA) return "Hoje você já usou o suporte automático muitas vezes. Amanhã ele volta — se for urgente, fale com a equipe.";
  const historico = (dados.historico || []).slice(-MEMORIA);
  const Anthropic = require("@anthropic-ai/sdk");
  const cliente = new Anthropic({ apiKey: chave });
  const resposta = await cliente.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 1200,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: promptSistema(suporte),
    messages: [...historico.map((h) => ({ role: h.papel, content: h.texto })), { role: "user", content: pergunta }],
  });
  const texto = (resposta.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim() || "Não entendi bem. Pode escrever de outro jeito?";
  await ref.set({
    dia, usosDia: usadoHoje + 1, total: FieldValue.increment(1), ultimaMensagem: new Date().toISOString(),
    historico: [...historico, { papel: "user", texto: pergunta.slice(0, 2000) }, { papel: "assistant", texto: texto.slice(0, 4000) }].slice(-MEMORIA),
  }, { merge: true });
  return texto;
}

function registrar() {
  const whatsapp = onRequest({ cors: false, secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY, CHAVE_IA], timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
    const db = getFirestore();
    // 1) verificação do webhook (a Meta chama por GET ao cadastrar a URL)
    if (req.method === "GET") {
      const modo = req.query["hub.mode"], token = req.query["hub.verify_token"], desafio = req.query["hub.challenge"];
      if (modo === "subscribe" && token && token === limpo(WHATSAPP_VERIFY.value())) { res.status(200).send(String(desafio || "")); return; }
      res.status(403).send("verificação inválida");
      return;
    }
    if (req.method !== "POST") { res.status(405).send("use POST"); return; }
    // No Cloud Run a função perde CPU depois de responder, então o trabalho
    // vem ANTES do 200. A Meta reenvia se demorar: mensagens já vistas
    // (whatsappVistos/{id}) são ignoradas para não responder duas vezes.
    try {
      const corpo = req.body || {};
      const token = limpo(WHATSAPP_TOKEN.value());
      const phoneIdCfg = limpo(WHATSAPP_PHONE_ID.value());
      const chave = limpo(CHAVE_IA.value());
      let suporte = null;
      try { const s = await db.collection("plataforma").doc("suporte").get(); suporte = s.exists ? s.data() : null; } catch (e) {}
      for (const entrada of corpo.entry || []) {
        for (const mud of entrada.changes || []) {
          const v = mud.value || {};
          const phoneId = (v.metadata && v.metadata.phone_number_id) || phoneIdCfg;
          for (const m of v.messages || []) {
            const de = m.from;
            if (!de) continue;
            if (m.id) {
              const visto = db.collection("whatsappVistos").doc(String(m.id).replace(/[^A-Za-z0-9_=.-]/g, "_"));
              const ja = await visto.get();
              if (ja.exists) continue;
              await visto.set({ de, quando: new Date().toISOString() });
            }
            let pergunta = "";
            if (m.type === "text") pergunta = String((m.text && m.text.body) || "").trim();
            else if (m.type === "audio" && token && token !== "pendente") {
              try { pergunta = await transcreverAudio(token, m.audio.id); } catch (e) { console.warn("áudio:", e.message); }
              if (!pergunta) { await enviarTexto(token, phoneId, de, "Não consegui entender o áudio. Pode escrever a dúvida?"); continue; }
            } else if (["image", "document", "video", "sticker"].includes(m.type)) {
              if (token && token !== "pendente") await enviarTexto(token, phoneId, de, "Por aqui eu respondo dúvidas por texto ou áudio. Para ler uma nota fiscal ou foto, use o botão de IA dentro do aplicativo (Compras ou Notas fiscais).");
              continue;
            } else continue;
            if (!pergunta) continue;
            await db.collection("whatsappLog").add({ de, tipo: m.type, texto: pergunta.slice(0, 1000), quando: new Date().toISOString(), respondido: !!(token && token !== "pendente" && chave && chave !== "pendente") }).catch(() => {});
            if (!token || token === "pendente") { console.log("whatsapp sem token — mensagem só registrada:", de, pergunta.slice(0, 80)); continue; }
            if (!chave || chave === "pendente") { await enviarTexto(token, phoneId, de, "O suporte automático ainda não foi ativado. Fale com a equipe."); continue; }
            await marcarLida(token, phoneId, m.id);
            let texto;
            try { texto = await responder(db, chave, de, pergunta, suporte); }
            catch (e) { console.error("whatsapp IA:", e); texto = "Tive um problema para responder agora. Tente de novo em um minuto ou fale com a equipe."; }
            await enviarTexto(token, phoneId, de, texto);
          }
        }
      }
    } catch (e) { console.error("whatsapp webhook:", e); }
    res.status(200).send("ok");
  });
  return { whatsapp };
}

module.exports = { registrar, CONHECIMENTO };
