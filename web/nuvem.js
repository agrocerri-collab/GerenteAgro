// ============================================================
// AgroCR Campo — camada de nuvem
//
// Guarda os dados no Firestore, com cópia no aparelho. O app
// continua funcionando sem sinal: escreve na cópia local e sobe
// sozinho quando a internet volta.
//
// Fazenda = um documento por fazenda. É isso que permite duas
// pessoas mexerem em fazendas diferentes ao mesmo tempo sem uma
// apagar o trabalho da outra.
// ============================================================

window.Nuvem = (function () {
  let app = null, db = null, pronta = false, persistenciaOk = null;

  // ---------------- fila de gravações: NADA se perde ----------------
  // Toda gravação é guardada no aparelho ANTES de ir para a nuvem e só sai
  // da fila quando a nuvem confirma. Sem sinal, fica e sobe sozinha (na
  // volta do sinal, no próximo minuto ou na próxima abertura do app, mesmo
  // que o celular tenha fechado o app no meio). Recusa da nuvem (permissão,
  // dado inválido) fica marcada com o motivo — a pessoa vê e nada some.
  const CHAVE_FILA = "agrocr:fila-nuvem";
  const ERRO_PERMANENTE = ["permission-denied", "invalid-argument", "failed-precondition", "out-of-range"];
  let ouvintesFila = [], reprocessando = false, filaLigada = false;
  function lerFila() { try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || "[]"); } catch (e) { return []; } }
  function guardarFila(l) { try { localStorage.setItem(CHAVE_FILA, JSON.stringify(l)); } catch (e) { console.warn("fila: sem espaço no aparelho", e); } avisarFila(); }
  function aoMudarFila(cb) { ouvintesFila.push(cb); try { cb(lerFila()); } catch (e) {} return () => { ouvintesFila = ouvintesFila.filter((f) => f !== cb); }; }
  function avisarFila() { const l = lerFila(); ouvintesFila.forEach((f) => { try { f(l); } catch (e) {} }); }
  const codigoDe = (e) => String((e && e.code) || "").replace(/^firestore\//, "");
  function explicarErro(e) {
    const c = codigoDe(e);
    if (c === "permission-denied") return "A nuvem recusou: este acesso não tem permissão para gravar isto (peça ao administrador para liberar). O lançamento ficou guardado neste aparelho e sobe sozinho quando a permissão for liberada.";
    if (c === "invalid-argument" || /maximum size|nested/i.test((e && e.message) || "")) return "A nuvem recusou este dado (grande demais ou formato inválido). Ele ficou guardado neste aparelho — tire uma foto desta tela e avise a consultoria.";
    if (c === "unauthenticated") return "Sua entrada expirou. O lançamento ficou guardado neste aparelho; entre de novo e ele sobe sozinho.";
    if (c === "resource-exhausted") return "A nuvem está no limite agora. O lançamento ficou guardado neste aparelho e sobe sozinho em instantes.";
    return "Sem sinal agora. O lançamento ficou guardado neste aparelho e sobe sozinho quando a internet voltar — pode fechar o app.";
  }
  // Grava em lotes de até 400 operações (o Firestore recusa lote com mais de 500 — e recusa o
  // lote INTEIRO, o que fazia um lançamento grande sumir da tela sem explicação).
  const TAMANHO_LOTE = 400;
  // ---------- fotos grandes: encolher até o registro caber em 1 MB ----------
  // A nuvem recusa registro acima de 1 MB (fotos em base64 pesam). Em vez de recusar e perder a visita,
  // as fotos do registro são reduzidas (480 px, depois 360, depois 280) até caber.
  const LIMITE_REGISTRO = 960 * 1024;
  const tamanhoDe = (dados) => { try { return JSON.stringify(dados).length; } catch (e) { return 0; } };
  function recomprimirImagem(dataUrl, max, q) {
    return new Promise((ok) => {
      try {
        const img = new Image();
        img.onload = () => { try { let w = img.width, h = img.height; if (w > max) { h = Math.round((h * max) / w); w = max; } const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h); ok(cv.toDataURL("image/jpeg", q)); } catch (e) { ok(dataUrl); } };
        img.onerror = () => ok(dataUrl);
        img.src = dataUrl;
      } catch (e) { ok(dataUrl); }
    });
  }
  async function encolherFotos(valor, max, q) {
    if (typeof valor === "string") return /^data:image\//.test(valor) ? await recomprimirImagem(valor, max, q) : valor;
    if (Array.isArray(valor)) { const out = []; for (const x of valor) out.push(await encolherFotos(x, max, q)); return out; }
    if (valor && typeof valor === "object") { const out = {}; for (const k of Object.keys(valor)) out[k] = await encolherFotos(valor[k], max, q); return out; }
    return valor;
  }
  async function caberNaNuvem(dados) {
    if (!dados || typeof dados !== "object" || tamanhoDe(dados) <= LIMITE_REGISTRO) return dados;
    let d = dados;
    for (const [max, q] of [[480, 0.5], [360, 0.45], [280, 0.4]]) { d = await encolherFotos(d, max, q); if (tamanhoDe(d) <= LIMITE_REGISTRO) break; }
    return d;
  }
  // O Firestore recusa qualquer campo com valor undefined ("invalid-argument" — e o lançamento ficava preso na
  // fila). Aqui todo registro perde as chaves undefined antes de ir (dentro de listas vira null).
  function limparIndefinidos(v) {
    if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : limparIndefinidos(x)));
    if (v && typeof v === "object" && !(v instanceof Date) && !(v.constructor && v.constructor.name && /Timestamp|FieldValue|GeoPoint|DocumentReference/.test(v.constructor.name))) {
      const o = {}; for (const k of Object.keys(v)) { if (v[k] !== undefined) o[k] = limparIndefinidos(v[k]); } return o;
    }
    return v;
  }
  async function caberOps(ops) { const out = []; for (const op of ops) out.push(op.dados && typeof op.dados === "object" ? { ...op, dados: await caberNaNuvem(op.dados) } : op); return out; }
  async function commitOps(ops) {
    for (let i = 0; i < ops.length; i += TAMANHO_LOTE) {
      const lote = db.batch();
      for (const op of ops.slice(i, i + TAMANHO_LOTE)) { const ref = db.doc(op.caminho); if (op.dados === null || op.dados === undefined) lote.delete(ref); else lote.set(ref, op.dados, { merge: !!op.merge }); }
      await lote.commit();
    }
  }
  // ---------- escuta que não morre ----------
  // Uma escuta (onSnapshot) que dá erro PARA para sempre: a lista fica vazia na tela até a pessoa
  // fechar o app, e ninguém fica sabendo — era o "sumiu tudo" com os dados intactos no servidor.
  // Aqui a escuta avisa quem estiver ouvindo (o app mostra na tela) e tenta de novo sozinha,
  // com intervalo crescente, até conseguir ou até ser desligada.
  let ouvintesLeitura = [];
  function aoFalharLeitura(cb) { ouvintesLeitura.push(cb); return () => { ouvintesLeitura = ouvintesLeitura.filter((f) => f !== cb); }; }
  function avisarLeitura(ev) { ouvintesLeitura.forEach((f) => { try { f(ev); } catch (e) {} }); }
  function explicarLeitura(codigo) {
    if (codigo === "permission-denied") return "a nuvem não deixou este acesso ler isto (avise a consultoria)";
    if (codigo === "unauthenticated") return "sua entrada expirou — saia e entre de novo";
    if (codigo === "unavailable" || codigo === "deadline-exceeded") return "sem sinal";
    if (codigo === "resource-exhausted") return "a nuvem está no limite agora";
    if (codigo === "failed-precondition") return "a nuvem pediu um ajuste interno (avise a consultoria)";
    return codigo || "erro";
  }
  const ESPERAS_LEITURA = [3000, 8000, 20000, 45000, 90000];
  function escutar(rotulo, montar) {
    let soltar = null, vivo = true, tentativa = 0, comFalha = false, timer = null;
    const ligar = () => {
      if (!vivo) return;
      try {
        soltar = montar(
          () => { if (comFalha) { comFalha = false; tentativa = 0; avisarLeitura({ rotulo, ok: true }); } },
          (erro) => {
            const codigo = String((erro && erro.code) || "").replace(/^firestore\//, "");
            console.warn("escuta " + rotulo + ":", codigo || erro);
            if (soltar) { try { soltar(); } catch (e) {} soltar = null; }
            comFalha = true;
            avisarLeitura({ rotulo, codigo, motivo: explicarLeitura(codigo), tentativa: tentativa + 1 });
            const espera = ESPERAS_LEITURA[Math.min(tentativa, ESPERAS_LEITURA.length - 1)]; tentativa++;
            timer = setTimeout(ligar, espera);
          }
        );
      } catch (e) { console.warn("escuta " + rotulo + " não montou:", e); }
    };
    ligar();
    return () => { vivo = false; clearTimeout(timer); if (soltar) { try { soltar(); } catch (e) {} } };
  }
  const uidAtual = () => { try { const u = firebase.auth && firebase.auth().currentUser; return u ? u.uid : null; } catch (e) { return null; } };
  // resumo legível de um lote, para a pessoa saber O QUE ficou guardado (fazenda, lista, item)
  function resumirOps(ops) {
    try {
      const p = ops[0], m = String(p.caminho || "").match(/^fazendas\/([^/]+)(?:\/([^/]+))?/);
      const d = p.dados || {};
      const texto = d.acao || d.produto || d.nome || d.descricao || d.tipo || (d.mm != null ? `${d.mm} mm${d.data ? " em " + String(d.data).slice(0, 10).split("-").reverse().join("/") : ""}` : "") || "";
      return { fid: m ? m[1] : null, col: m ? (m[2] || "fazenda") : String(p.caminho || "").split("/")[0], texto: String(texto).slice(0, 80), n: ops.length, apagar: p.dados === null || p.dados === undefined };
    } catch (e) { return null; }
  }
  // "Recusado" de mentira: o lançamento feito sem sinal sobe duas vezes quando o sinal volta (a memória
  // offline do Firestore e esta fila). O 2º envio é recusado onde só a consultoria altera — mas o dado
  // JÁ ESTÁ lá. Antes de alarmar a pessoa, confere: se tudo do lote já está na nuvem igual, está salvo.
  const ordenado = (v) => (Array.isArray(v) ? v.map(ordenado) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = ordenado(v[k]); return o; }, {}) : v);
  async function jaEstaNaNuvem(ops) {
    try {
      for (const op of ops) {
        if (op.dados === null || op.dados === undefined || op.merge) return false;
        // o registro de alterações quem é da fazenda não lê: é só um diário — nunca vira aviso de recusa
        if (/^fazendas\/[^/]+\/historico\//.test(String(op.caminho))) continue;
        const d = await db.doc(op.caminho).get({ source: "server" });
        if (!d.exists || JSON.stringify(ordenado(d.data())) !== JSON.stringify(ordenado(op.dados))) return false;
      }
      return true;
    } catch (e) { return false; }
  }
  // grava com garantia: entra na fila, sobe, sai da fila. Erro permanente fica marcado; os outros tentam de novo.
  async function executarOps(ops, rotulo) {
    if (!ops.length) return;
    try { ops = await caberOps(ops); } catch (e) {}
    try { ops = ops.map((op) => (op.dados && typeof op.dados === "object" ? { ...op, dados: limparIndefinidos(op.dados) } : op)); } catch (e) {}
    const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rotulo: rotulo || "", ops, em: new Date().toISOString(), tentativas: 0, erro: null, uid: uidAtual(), resumo: resumirOps(ops) };
    guardarFila([...lerFila(), item]);
    try {
      await commitOps(ops);
      guardarFila(lerFila().filter((x) => x.id !== item.id));
    } catch (e) {
      const c = codigoDe(e);
      if (c === "permission-denied" && await jaEstaNaNuvem(ops)) { guardarFila(lerFila().filter((x) => x.id !== item.id)); return; }
      guardarFila(lerFila().map((x) => (x.id === item.id ? { ...x, tentativas: 1, erro: c || "erro", motivo: explicarErro(e), permanente: ERRO_PERMANENTE.includes(c) } : x)));
      throw e;
    }
  }
  async function reprocessarFila(forcar) {
    if (!pronta || reprocessando) return;
    if (!(firebase.auth && firebase.auth().currentUser)) return;   // sem login não adianta tentar
    // só o que foi lançado por QUEM está logado agora: item de outro acesso fica guardado até a pessoa
    // entrar de novo (aparelho compartilhado) — nunca sobe com a sessão de outra pessoa
    const eu = uidAtual();
    const fila = lerFila().filter((x) => (forcar || !x.permanente) && (!x.uid || x.uid === eu));
    if (!fila.length) return;
    reprocessando = true;
    try {
      for (const item of fila) {
        try {
          // recusado por tamanho: encolhe as fotos antes de tentar de novo
          if (item.erro === "invalid-argument") { try { item.ops = await caberOps(item.ops); guardarFila(lerFila().map((x) => (x.id === item.id ? { ...x, ops: item.ops } : x))); } catch (e) {} }
          await commitOps(item.ops);
          guardarFila(lerFila().filter((x) => x.id !== item.id));
        } catch (e) {
          const c = codigoDe(e);
          if (c === "permission-denied" && await jaEstaNaNuvem(item.ops)) { guardarFila(lerFila().filter((x) => x.id !== item.id)); continue; }
          guardarFila(lerFila().map((x) => (x.id === item.id ? { ...x, tentativas: (x.tentativas || 0) + 1, erro: c || "erro", motivo: explicarErro(e), permanente: ERRO_PERMANENTE.includes(c) } : x)));
          if (!ERRO_PERMANENTE.includes(c)) break;   // sem sinal: para por aqui, tenta de novo depois
        }
      }
    } finally { reprocessando = false; }
  }
  function tentarFilaDeNovo(id) { guardarFila(lerFila().map((x) => (x.id === id ? { ...x, permanente: false, erro: x.erro === "invalid-argument" ? "invalid-argument" : null, motivo: null } : x))); return reprocessarFila(true); }
  function descartarDaFila(id) { guardarFila(lerFila().filter((x) => x.id !== id)); }
  function ligarFila() {
    if (filaLigada) return; filaLigada = true;
    try { window.addEventListener("online", () => reprocessarFila()); } catch (e) {}
    try { setInterval(() => reprocessarFila(), 60000); } catch (e) {}
    let jaForcou = false;
    try { firebase.auth().onAuthStateChanged((u) => { if (u) setTimeout(() => { const f = !jaForcou; jaForcou = true; reprocessarFila(f); }, 1500); }); } catch (e) {}
  }
  const memoriaOffline = () => persistenciaOk;

  function iniciar() {
    if (pronta) return true;
    if (typeof firebase === "undefined" || !window.AGROCR_FIREBASE) return false;
    try {
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(window.AGROCR_FIREBASE);
      // App Check: prova ao Google que quem fala com o banco/funções é o
      // aplicativo oficial (reCAPTCHA Enterprise, invisível para o usuário).
      // Falha aqui NÃO pode derrubar o app: fica sem token e segue normal.
      try {
        if (self.AGROCR_APPCHECK && firebase.appCheck) {
          firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(self.AGROCR_APPCHECK), true);
        }
      } catch (e) { console.warn("app check:", e); }
      db = firebase.firestore();
      // Precisa vir antes de qualquer leitura, senão o Firestore já subiu
      // e recusa ligar a memória offline. A promessa era ignorada: se a
      // memória falhasse (iPhone, aba anônima, outra aba aberta) ninguém
      // ficava sabendo — agora fica registrado e a fila do aparelho cobre.
      try {
        db.enablePersistence({ synchronizeTabs: true })
          .then(() => { persistenciaOk = true; })
          .catch((e) => { persistenciaOk = false; console.warn("memória offline do Firestore indisponível:", e && e.code); });
      } catch (e) { persistenciaOk = false; }
      pronta = true;
      ligarFila();
      return true;
    } catch (e) {
      console.warn("Nuvem não iniciou:", e);
      return false;
    }
  }

  const disponivel = () => iniciar();

  // ---------------- conta (multi-inquilino: só na versão de venda) ----------------
  // Na versão de venda cada comprador é uma "conta": as fazendas, os acessos
  // e as listas dele ficam isolados dos outros compradores. No AgroCR a marca
  // AGROCR_MULTICONTA não existe e tudo se comporta exatamente como sempre.
  const multiConta = () => !!self.AGROCR_MULTICONTA;
  let contaCache = { uid: null, conta: null };
  async function minhaConta() {
    if (!multiConta() || !iniciar()) return null;
    const u = firebase.auth().currentUser;
    if (!u) return null;
    if (contaCache.uid === u.uid) return contaCache.conta;
    try {
      const d = await db.collection("usuarios").doc(u.uid).get();
      // sem "conta" no cadastro (caso do dono da plataforma), a conta é a própria pessoa —
      // assim o dono vê só as fazendas dele, e não a de todo cliente (a lista viraria bagunça)
      contaCache = { uid: u.uid, conta: (d.exists && d.data().conta) || u.uid };
    } catch (e) { return null; }
    return contaCache.conta;
  }
  // Ouvintes que precisam saber a conta antes de abrir a escuta.
  function observarComConta(montar) {
    let soltar = null, vivo = true;
    minhaConta().then((conta) => { if (vivo) soltar = montar(conta); });
    return () => { vivo = false; if (soltar) try { soltar(); } catch (e) {} };
  }

  // ---------------- entrar e sair ----------------
  async function entrar(email, senha) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const cred = await firebase.auth().signInWithEmailAndPassword(email, senha);
    return cred.user;
  }
  async function sair() { if (iniciar()) await firebase.auth().signOut(); }
  function usuarioAtual() { return iniciar() ? firebase.auth().currentUser : null; }
  function aoMudarUsuario(cb) {
    if (!iniciar()) { cb(null); return () => {}; }
    return firebase.auth().onAuthStateChanged(cb);
  }
  // troca a senha de quem está logado: o Firebase exige confirmar a senha atual antes
  async function trocarSenha(senhaAtual, senhaNova) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const eu = firebase.auth().currentUser;
    if (!eu || !eu.email) throw new Error("sem login");
    await eu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(eu.email, senhaAtual));
    await eu.updatePassword(senhaNova);
  }
  async function redefinirSenha(email) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await firebase.auth().sendPasswordResetEmail(email);
  }

  // Cria o login de uma pessoa da fazenda SEM derrubar a sessão de quem está
  // criando: o Firebase troca de usuário ao criar uma conta, então a criação
  // acontece numa ligação separada, que é descartada em seguida.
  async function criarUsuario(email, senha) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const aparte = firebase.initializeApp(window.AGROCR_FIREBASE, "criar-acesso-" + Math.random().toString(36).slice(2));
    try {
      const cred = await aparte.auth().createUserWithEmailAndPassword(email, senha);
      const uid = cred.user.uid;
      await aparte.auth().signOut();
      return uid;
    } finally {
      try { await aparte.delete(); } catch (e) {}
    }
  }

  // Pré-cadastro da versão de venda: a própria pessoa cria a conta dela e
  // nasce administradora da PRÓPRIA conta (inquilino). O acesso de verdade
  // só abre quando a licença do e-mail é ativada, depois do pagamento.
  // CPF e endereço ficam no cadastro para a emissão da cobrança (boleto,
  // cartão ou Pix).
  async function criarContaPropria(dados, email, senha) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const d = dados || {};
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, senha);
    const uid = cred.user.uid;
    await db.collection("usuarios").doc(uid).set({
      nome: d.nome || (email || "").split("@")[0],
      email: cred.user.email || email,
      telefone: d.telefone || "",
      cpf: d.cpf || "", cep: d.cep || "",
      endereco: d.endereco || "", cidade: d.cidade || "", uf: d.uf || "",
      formaPagamento: d.formaPagamento || "",
      planoEscolhido: d.planoEscolhido || "",
      ondeConheceu: d.ondeConheceu || "",
      ondeDetalhe: d.ondeDetalhe || "",
      aceite: d.aceite || null,   // versão, data/hora e e-mail do "Li e aceito" (vale como assinatura)
      papel: "consultoria", admin: true, conta: uid,
      criadoEm: new Date().toISOString(),
    });
    contaCache = { uid: uid, conta: uid };
    // 7 dias grátis: as regras só deixam CRIAR esta licença (uma vez, para
    // o próprio e-mail, plano de teste). Se o e-mail já teve licença antes,
    // a nuvem recusa e a pessoa cai na tela de pagamento — sem teste duplo.
    let teste = false;
    try {
      await db.collection("licencas").doc((cred.user.email || email).toLowerCase()).set({
        plano: "teste7",
        conta: uid,
        validaAte: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "pré-cadastro (7 dias grátis)",
      });
      teste = true;
    } catch (e) { /* já existiu licença: sem novo teste */ }
    return { uid: uid, email: cred.user.email, teste: teste };
  }

  // Acessos (pessoas) ligados a uma fazenda — só a consultoria enxerga
  function observarUsuarios(fazendaId, cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => {
      let q = db.collection("usuarios").where("fazendas", "array-contains", fazendaId);
      if (conta) q = q.where("conta", "==", conta);
      return q.onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (erro) => console.warn("usuarios:", erro)
      );
    });
  }
  // Todas as pessoas do lado da fazenda (produtor, gerente, operador, monitor),
  // para a consultoria gerir os acessos num lugar só
  function observarPessoasFazendas(cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => {
      let q = db.collection("usuarios").where("papel", "==", "fazenda");
      if (conta) q = q.where("conta", "==", conta);
      return q.onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (erro) => console.warn("pessoas das fazendas:", erro)
      );
    });
  }
  // Acessos da própria consultoria (enxergam todas as fazendas)
  function observarEquipeConsultoria(cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => {
      let q = db.collection("usuarios").where("papel", "==", "consultoria");
      if (conta) q = q.where("conta", "==", conta);
      return q.onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (erro) => console.warn("equipe consultoria:", erro)
      );
    });
  }
  // Enquanto o administrador está no teste grátis, os 2 primeiros acessos
  // que ele criar também entram de graça — e vencem JUNTO com o teste dele
  // ("cancelado tudo" no 7º dia, se não pagar).
  // Dono da plataforma criou um acesso extra na conta de um cliente: licença "incluso" vencendo junto com a
  // licença mais longa daquela conta (a do titular). Sem licença o acesso não abriria o app.
  async function concederLicencaDoDono(email, conta) {
    try {
      const daConta = await db.collection("licencas").where("conta", "==", conta).get();
      let ref = null;
      for (const d of daConta.docs) { const x = d.data(); if (x.validaAte && (!ref || x.validaAte.toDate() > ref.validaAte.toDate())) ref = x; }
      await db.collection("licencas").doc(String(email).toLowerCase()).set({
        plano: "incluso", conta: conta,
        validaAte: ref ? ref.validaAte : firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 86400000)),
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "dono da plataforma (acesso extra do cliente)",
      }, { merge: true });
    } catch (e) { console.warn("licença do acesso extra do cliente:", e); }
  }
  async function concederTesteSeCouber(email) {
    if (!multiConta() || !email) return;
    try {
      const eu = firebase.auth().currentUser;
      if (!eu || !eu.email) return;
      const minha = await db.collection("licencas").doc(eu.email.toLowerCase()).get();
      if (!minha.exists) return;
      const m = minha.data();
      if (m.plano !== "teste7" || !m.validaAte || m.validaAte.toDate() <= new Date()) return;
      const conta = await minhaConta();
      if (!conta) return;
      const daConta = await db.collection("licencas").where("conta", "==", conta).get();
      const emTeste = daConta.docs.filter((d) => d.id !== eu.email.toLowerCase() && d.data().plano === "teste7").length;
      if (emTeste >= 2) return;
      await db.collection("licencas").doc(String(email).toLowerCase()).set({
        plano: "teste7", conta: conta,
        validaAte: m.validaAte,
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "teste do administrador",
      });
    } catch (e) { /* sem teste: o acesso fica aguardando pagamento */ }
  }

  // Titular PAGANDO: o 1º acesso extra que ele cria entra na hora, incluso no plano, e vence junto com o
  // titular. A licença do titular guarda qual e-mail recebeu o incluso (inclusoEmail) — as regras só deixam
  // criar a licença "incluso" para esse e-mail, uma vez por titular. Do 2º extra em diante: aguarda liberação.
  async function concederInclusoSeCouber(email) {
    if (!multiConta() || !email) return false;
    try {
      const eu = firebase.auth().currentUser;
      if (!eu || !eu.email) return false;
      const ref = db.collection("licencas").doc(eu.email.toLowerCase());
      const minha = await ref.get({ source: "server" });
      if (!minha.exists) return false;
      const m = minha.data();
      if (!m.validaAte || m.validaAte.toDate() <= new Date() || ["teste7", "suspenso", "incluso"].includes(m.plano)) return false;
      if (m.inclusoEmail) return false;   // já usou o incluso
      const conta = await minhaConta();
      if (!conta) return false;
      const alvo = String(email).toLowerCase();
      await ref.update({ inclusoEmail: alvo });
      await db.collection("licencas").doc(alvo).set({
        plano: "incluso", conta: conta, validaAte: m.validaAte,
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "incluso no plano do titular",
      });
      return true;
    } catch (e) { return false; }
  }
  // Titular PAGANDO: o 1º acesso extra que ele cria entra na hora, incluso no plano, e vence junto com o
  // titular. A licença do titular guarda qual e-mail recebeu o incluso (inclusoEmail) — as regras só deixam
  // criar a licença "incluso" para esse e-mail, uma vez por titular. Do 2º extra em diante: aguarda liberação.
  async function concederInclusoSeCouber(email) {
    if (!multiConta() || !email) return false;
    try {
      const eu = firebase.auth().currentUser;
      if (!eu || !eu.email) return false;
      const ref = db.collection("licencas").doc(eu.email.toLowerCase());
      const minha = await ref.get({ source: "server" });
      if (!minha.exists) return false;
      const m = minha.data();
      if (!m.validaAte || m.validaAte.toDate() <= new Date() || ["teste7", "suspenso", "incluso"].includes(m.plano)) return false;
      if (m.inclusoEmail) return false;   // já usou o incluso
      const conta = await minhaConta();
      if (!conta) return false;
      const alvo = String(email).toLowerCase();
      await ref.update({ inclusoEmail: alvo });
      await db.collection("licencas").doc(alvo).set({
        plano: "incluso", conta: conta, validaAte: m.validaAte,
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "incluso no plano do titular",
      });
      return true;
    } catch (e) { return false; }
  }
  async function gravarUsuario(uid, dados) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    // na versão de venda todo cadastro de pessoa carrega a conta do criador
    let contaDeCliente = null;   // dono da plataforma criando acesso na conta de um CLIENTE (modo suporte)
    if (dados && dados.papel) {
      const minha = await minhaConta();
      const conta = dados.conta || minha;
      if (dados.conta && minha && dados.conta !== minha) contaDeCliente = dados.conta;
      if (conta) dados = { ...dados, conta: conta };
    }
    await db.collection("usuarios").doc(uid).set(dados, { merge: true });
    if (dados && dados.papel && dados.email) {
      if (contaDeCliente) await concederLicencaDoDono(dados.email, contaDeCliente);
      else { await concederTesteSeCouber(dados.email); await concederInclusoSeCouber(dados.email); }
    }
  }
  async function apagarUsuario(uid) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("usuarios").doc(uid).delete();
  }
  // TODOS os cadastros (só o dono da plataforma consegue): é a lista de
  // pré-cadastros aguardando pagamento no painel de licenças da versão
  // de venda, com os dados de cobrança (CPF, endereço, telefone).
  function observarTodosUsuarios(cb) {
    if (!iniciar()) return () => {};
    return db.collection("usuarios").onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
      (erro) => console.warn("todos usuarios:", erro)
    );
  }
  // Todas as pessoas da MINHA conta (versão de venda): é a lista que o
  // titular usa para ver a assinatura de cada acesso que ele criou.
  function observarUsuariosDaConta(cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => {
      if (!conta) { cb([]); return () => {}; }
      return db.collection("usuarios").where("conta", "==", conta).onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (erro) => console.warn("usuarios da conta:", erro)
      );
    });
  }

  // ---------------- avisos no celular (Web Push) ----------------
  // O aparelho ganha um "endereço de entrega" (token) que fica no cadastro
  // da pessoa. Quem manda o aviso é o servidor (Funções), nunca outro
  // aparelho. Precisa de https, permissão da pessoa e da chave AGROCR_VAPID.
  function avisosDisponiveis() {
    return !!(self.AGROCR_VAPID && "Notification" in window && "serviceWorker" in navigator &&
      window.isSecureContext && typeof firebase !== "undefined");
  }
  // A biblioteca de mensagens só entra quando o aparelho suporta avisos.
  // Carregada junto com o resto, ela derrubava o Safari do iPhone inteiro.
  let promessaMessaging = null;
  function carregarMessaging() {
    if (typeof firebase !== "undefined" && firebase.messaging) return Promise.resolve();
    if (promessaMessaging) return promessaMessaging;
    promessaMessaging = new Promise(function (certo, errado) {
      const s = document.createElement("script");
      s.src = "vendor/firebase-messaging-compat.js";
      s.onload = function () { certo(); };
      s.onerror = function () { promessaMessaging = null; errado(new Error("não carregou a biblioteca de avisos")); };
      document.head.appendChild(s);
    });
    return promessaMessaging;
  }
  async function ativarAvisos() {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = usuarioAtual();
    if (!u) throw new Error("entre na sua conta primeiro");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("permissão de avisos negada no aparelho");
    await carregarMessaging();
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ vapidKey: self.AGROCR_VAPID, serviceWorkerRegistration: reg });
    if (!token) throw new Error("o aparelho não devolveu o endereço de avisos");
    await db.collection("usuarios").doc(u.uid).set(
      { fcmTokens: firebase.firestore.FieldValue.arrayUnion(token) }, { merge: true });
    return token;
  }
  // Diagnóstico: este aparelho está cadastrado para receber? (sem pedir
  // permissão de novo — só funciona quando já foi concedida)
  async function estadoAvisos() {
    const saida = { permissao: ("Notification" in window) ? Notification.permission : "unsupported", registrado: false };
    try {
      if (!iniciar() || saida.permissao !== "granted" || !avisosDisponiveis()) return saida;
      const u = usuarioAtual(); if (!u) return saida;
      await carregarMessaging();
      const reg = await navigator.serviceWorker.ready;
      const token = await firebase.messaging().getToken({ vapidKey: self.AGROCR_VAPID, serviceWorkerRegistration: reg });
      const doc = await db.collection("usuarios").doc(u.uid).get();
      const lista = (doc.exists && doc.data().fcmTokens) || [];
      saida.registrado = !!token && lista.includes(token);
      // token novo (o Firebase troca de tempos em tempos): registra de novo
      if (token && !saida.registrado) {
        await db.collection("usuarios").doc(u.uid).set({ fcmTokens: firebase.firestore.FieldValue.arrayUnion(token) }, { merge: true });
        saida.registrado = true;
      }
    } catch (e) { saida.erro = e.code || e.message; }
    return saida;
  }
  // Pede ao servidor um aviso de teste só para os aparelhos desta pessoa
  async function pedirTesteAviso() {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = usuarioAtual(); if (!u) throw new Error("entre na sua conta primeiro");
    await db.collection("usuarios").doc(u.uid).collection("testes").add({ em: new Date().toISOString() });
  }

  // Com o app ABERTO o aviso não passa pelo service worker — mostramos aqui.
  async function ouvirAvisosEmPrimeiroPlano() {
    if (!avisosDisponiveis()) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") return;
    try {
      await carregarMessaging();
      firebase.messaging().onMessage(async (m) => {
        const d = (m && m.data) || {};
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(d.titulo || "AgroCR Campo", { body: d.corpo || "", icon: "./icone-192.png", data: { url: d.abrir ? "./#" + d.abrir : "./", abrir: d.abrir || "" } });
      });
    } catch (e) {}
  }

  // Perfil da pessoa: papel e a quais fazendas ela tem acesso.
  async function meuPerfil() {
    const u = usuarioAtual();
    if (!u) return null;
    const doc = await db.collection("usuarios").doc(u.uid).get();
    if (doc.exists) return { uid: u.uid, email: u.email, ...doc.data() };
    // sem cadastro: há um convite para este e-mail? (acesso criado por quem administra enquanto o login já existia)
    try {
      const em = String(u.email || "").toLowerCase();
      const conv = em ? await db.collection("convites").doc(em).get() : null;
      if (conv && conv.exists) {
        const c = conv.data();
        const dados = { nome: c.nome || "", email: em, funcao: c.funcao || "Operador", papel: c.papel || "fazenda", fazendas: c.fazendas || [], permissoes: c.permissoes || {}, criadoEm: new Date().toISOString(), deConvite: true, ...(c.conta ? { conta: c.conta } : {}) };
        await db.collection("usuarios").doc(u.uid).set(dados);
        try { await db.collection("convites").doc(em).delete(); } catch (e) {}
        return { uid: u.uid, email: u.email, ...dados };
      }
    } catch (e) { console.warn("convite:", e); }
    return { uid: u.uid, email: u.email, papel: null };
  }
  // Quem administra cria o acesso, mas o e-mail JÁ tem login (sem cadastro): guarda o cadastro num convite,
  // já dá a licença, e o cadastro nasce sozinho quando a pessoa entrar. Pessoa já cadastrada → erro (é editar).
  async function criarConvite(dados) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const em = String(dados.email || "").toLowerCase();
    if (!em) throw new Error("sem e-mail");
    try {
      const ja = await db.collection("usuarios").where("email", "==", em).limit(1).get();
      if (!ja.empty) throw new Error("esta pessoa já está cadastrada — toque em editar e marque as fazendas");
    } catch (e) { if (/cadastrada/.test(String(e.message || ""))) throw e; }
    const minha = await minhaConta();
    const conta = dados.conta || minha || null;
    const eu = usuarioAtual();
    await db.collection("convites").doc(em).set({ ...dados, email: em, ...(conta ? { conta } : {}), criadoEm: new Date().toISOString(), criadoPor: eu ? eu.uid : "" });
    if (conta && minha && conta !== minha) await concederLicencaDoDono(em, conta);
    else { await concederTesteSeCouber(em); await concederInclusoSeCouber(em); }
    return true;
  }

  // ---------------- estado de sincronização ----------------
  // Quantos lançamentos ainda não subiram. É o número que vira o aviso
  // "x aguardando sinal" na tela do operador.
  let ouvintesPendencia = [];
  function aoMudarPendencia(cb) { ouvintesPendencia.push(cb); return () => { ouvintesPendencia = ouvintesPendencia.filter((f) => f !== cb); }; }
  function avisarPendencia(n, doCache) { ouvintesPendencia.forEach((f) => { try { f(n, doCache); } catch (e) {} }); }

  // ---------------- fazendas ----------------
  function observarFazendas(cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => {
      let q = db.collection("fazendas");
      if (conta) q = q.where("conta", "==", conta);
      return escutar("lista de fazendas", (chegou, falhou) => q.onSnapshot(
        { includeMetadataChanges: true },
        (snap) => {
          chegou();
          const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const pendentes = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
          avisarPendencia(pendentes, snap.metadata.fromCache);
          cb(lista);
        },
        falhou
      ));
    });
  }

  // Grava só o que mudou. Comparar antes de escrever evita subir a fazenda
  // inteira quando alguém mexeu num talhão só.
  async function gravarFazendas(antes, depois) {
    if (!iniciar()) return;
    const conta = await minhaConta();
    const porId = {};
    (antes || []).forEach((f) => { porId[f.id] = f; });
    const ops = [];
    for (const f of depois || []) {
      const anterior = porId[f.id];
      if (!anterior || JSON.stringify(anterior) !== JSON.stringify(f)) {
        const { id, ...dados } = f;
        // versão de venda: a fazenda nasce carimbada com a conta do comprador
        if (conta && !dados.conta) dados.conta = conta;
        ops.push({ caminho: "fazendas/" + id, dados });
      }
      delete porId[f.id];
    }
    // o que sobrou em porId foi excluído
    for (const id of Object.keys(porId)) ops.push({ caminho: "fazendas/" + id, dados: null });
    await executarOps(ops, "fazenda");
  }

  // A pessoa da fazenda não pode listar TODAS as fazendas (as regras negam,
  // de propósito). Ela escuta uma a uma, só as que o perfil dela permite.
  // Todas as fazendas da plataforma, para o painel do dono (as regras só deixam o dono ler
  // fazenda de outra conta). Uma leitura só, sem escuta: é para achar e abrir.
  async function listarTodasFazendas() {
    if (!iniciar()) return [];
    const snap = await db.collection("fazendas").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  function observarFazendasDaLista(ids, cb) {
    if (!iniciar()) return () => {};
    const mapa = {};
    const lista = Array.isArray(ids) ? ids : [];
    const avisar = () => cb(lista.map((i) => mapa[i]).filter(Boolean));
    const soltas = lista.map((id) =>
      escutar("fazenda", (chegou, falhou) => db.collection("fazendas").doc(id).onSnapshot(
        { includeMetadataChanges: true },
        (d) => {
          chegou();
          if (d.exists) mapa[id] = { id: d.id, ...d.data() }; else delete mapa[id];
          avisarPendencia(d.metadata.hasPendingWrites ? 1 : 0, d.metadata.fromCache);
          avisar();
        },
        falhou
      ))
    );
    if (lista.length === 0) cb([]);
    return () => soltas.forEach((s) => { try { s(); } catch (e) {} });
  }

  // ---------------- cotações regionais ----------------
  // Diferente das listas de config: TODO usuário logado pode ler (o produtor
  // quer ver o preço), mas só a consultoria lança.
  function observarCotacoes(cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => db.collection("cotacoes").doc(conta ? "regional__" + conta : "regional").onSnapshot(
      (d) => cb(d.exists && Array.isArray(d.data().lista) ? d.data().lista : []),
      (erro) => console.warn("cotacoes:", erro)
    ));
  }
  async function gravarCotacoes(lista) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const conta = await minhaConta();
    await db.collection("cotacoes").doc(conta ? "regional__" + conta : "regional").set({ lista });
  }

  // ---------------- listas pequenas do app (grupos, equipe) ----------------
  // Na versão de venda cada conta tem as SUAS listas: o nome do documento
  // ganha o sufixo da conta (ex.: "equipe__abc123").
  function observarConfig(nome, cb) {
    if (!iniciar()) return () => {};
    return observarComConta((conta) => db.collection("config").doc(conta ? nome + "__" + conta : nome).onSnapshot(
      (doc) => cb(doc.exists && Array.isArray(doc.data().lista) ? doc.data().lista : null),
      (erro) => console.warn("config " + nome + ":", erro)
    ));
  }
  async function gravarConfig(nome, lista) {
    if (!iniciar()) return;
    const conta = await minhaConta();
    await executarOps([{ caminho: "config/" + (conta ? nome + "__" + conta : nome), dados: { lista } }], nome);
  }

  // ---------------- licenças (versão de venda: um acesso pago por e-mail) ----------------
  function observarLicenca(email, cb) {
    if (!iniciar()) return () => {};
    return db.collection("licencas").doc(String(email || "").toLowerCase()).onSnapshot(
      (doc) => cb(doc.exists ? doc.data() : null),
      () => cb(null)
    );
  }
  function observarLicencas(cb) {
    if (!iniciar()) return () => {};
    return db.collection("licencas").onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ email: d.id, ...d.data() }))),
      (e) => console.warn("licencas:", e)
    );
  }
  async function gravarLicenca(email, dados) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("licencas").doc(String(email).toLowerCase()).set(dados, { merge: true });
  }
  async function apagarLicenca(email) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("licencas").doc(String(email).toLowerCase()).delete();
  }
  // Rede de segurança do teste grátis: se a gravação da licença falhou na
  // hora do cadastro (corrida com a criação do perfil), o app tenta de novo
  // aqui. Só cria se o e-mail NUNCA teve licença — quem já teve (vencida,
  // suspensa) não ganha teste de novo.
  async function garantirMeuTeste() {
    if (!multiConta() || !iniciar()) return false;
    const eu = firebase.auth().currentUser;
    if (!eu || !eu.email) return false;
    const ref = db.collection("licencas").doc(eu.email.toLowerCase());
    try {
      const d = await ref.get({ source: "server" });
      if (d.exists) return false;
      await ref.set({
        plano: "teste7", conta: (await minhaConta()) || eu.uid,
        validaAte: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
        atualizadoEm: firebase.firestore.Timestamp.fromDate(new Date()),
        quem: "pré-cadastro (7 dias grátis)",
      });
      return true;
    } catch (e) { return false; }
  }
  function carimboData(data) { return firebase.firestore.Timestamp.fromDate(data); }
  // ---------------- leitura de nota por foto (IA) ----------------
  // Manda a foto para a função na nuvem e recebe os itens estruturados.
  // Exige login (a leitura tem custo por chamada).
  // Aceita a foto direto (texto antigo) ou um objeto {foto|pdf|texto, modo, contexto}
  async function lerNota(entrada) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("entre na sua conta para usar a leitura por IA");
    const token = await u.getIdToken();
    const corpo = typeof entrada === "string" ? { foto: entrada } : (entrada || {});
    const r = await fetch("https://southamerica-east1-agrocr-campo.cloudfunctions.net/lernota", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ("falha na leitura (" + r.status + ")"));
    return j;
  }
  // SEFAZ: certificado digital do produtor e busca das notas (acao: status |
  // guardar | configurar | remover | buscar | ciencia). O .pfx e a senha vão
  // direto para a função, que guarda cifrado — nada fica no aparelho.
  async function chamarSefaz(corpo) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("entre na sua conta para usar a SEFAZ");
    const token = await u.getIdToken();
    const r = await fetch("https://southamerica-east1-agrocr-campo.cloudfunctions.net/sefaz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(corpo || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ("falha na SEFAZ (" + r.status + ")"));
    return j;
  }
  // Emissão de NF-e (função nfe): emitir · consultar · cancelar
  async function chamarNfe(corpo) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("entre na sua conta para emitir nota");
    const token = await u.getIdToken();
    const r = await fetch("https://southamerica-east1-agrocr-campo.cloudfunctions.net/nfe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(corpo || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ("falha na emissão (" + r.status + ")"));
    return j;
  }
  // Manda a cópia de segurança para o e-mail da PRÓPRIA pessoa logada
  // (o servidor tira o destino do login — não dá para mandar para outro).
  async function enviarBackupEmail(nome, conteudo, resumo) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("entre na sua conta para enviar por e-mail");
    const token = await u.getIdToken();
    const r = await fetch("https://southamerica-east1-agrocr-campo.cloudfunctions.net/enviarbackup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ nome, conteudo, resumo: resumo || "", app: document.title || "" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ("falha no envio (" + r.status + ")"));
    return j;
  }
  // Transcreve um áudio gravado no campo (data URI webm/ogg) em texto pt-BR.
  // Usado pela visita técnica: grava offline, transcreve quando o sinal volta.
  // Safari/iPhone grava em mp4 (AAC), que o transcritor não entende: converte no aparelho para WAV 16 kHz mono.
  // webm/ogg (Chrome/Android) vão como estão. forcar=true converte qualquer formato (teste).
  async function paraWav16k(dataURL, forcar) {
    const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(String(dataURL || ""));
    if (!m) return dataURL;
    if (!forcar && /webm|ogg|wav/i.test(m[1])) return dataURL;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || typeof OfflineAudioContext === "undefined") return dataURL;
    const bin = atob(m[2]); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ctx = new AC();
    let dec;
    try { dec = await new Promise((ok, err) => { try { const p = ctx.decodeAudioData(bytes.buffer.slice(0), ok, err); if (p && p.then) p.then(ok, err); } catch (e) { err(e); } }); }
    finally { try { ctx.close(); } catch (e) {} }
    const taxa = 16000, n = Math.max(1, Math.ceil(dec.duration * taxa));
    const off = new OfflineAudioContext(1, n, taxa);
    const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start(0);
    const out = await off.startRendering();
    const pcm = out.getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0, o = 44; i < pcm.length; i++, o += 2) { const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    const u8 = new Uint8Array(buf); let b64 = "";
    for (let i = 0; i < u8.length; i += 0x8000) b64 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return "data:audio/wav;base64," + btoa(b64);
  }
  async function transcreverAudio(audioOriginal, dicas) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("entre na sua conta para transcrever");
    let audio = audioOriginal;
    try { audio = await paraWav16k(audioOriginal); } catch (e) { throw new Error("não consegui ler o áudio gravado neste aparelho (" + (e && e.message || e) + ")"); }
    const token = await u.getIdToken();
    const r = await fetch("https://southamerica-east1-agrocr-campo.cloudfunctions.net/transcrever", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ audio, dicas: dicas || [] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || ("falha na transcrição (" + r.status + ")"));
    return j.texto;
  }
  // ---------------- dados da plataforma (versão de venda) ----------------
  // Links de pagamento e chave Pix que o dono cadastra: a tela de assinatura
  // mostra o botão "Pagar" apontando para eles.
  function observarPagamento(cb) {
    if (!iniciar()) return () => {};
    return db.collection("plataforma").doc("pagamento").onSnapshot(
      (d) => cb(d.exists ? d.data() : null), () => cb(null));
  }
  async function gravarPagamento(dados) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("plataforma").doc("pagamento").set(dados, { merge: true });
  }
  // Financeiro do DONO (contratos, recebimentos, contas a pagar): coleção
  // que só o dono lê/escreve — as regras negam para qualquer outro login.
  function observarFinanceiroDono(cb) {
    if (!iniciar()) return () => {};
    return db.collection("financeiroDono").onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn("financeiroDono:", e));
  }
  async function gravarFinanceiroDono(item) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const { id, ...dados } = item;
    await db.collection("financeiroDono").doc(id).set(dados, { merge: true });
  }
  async function apagarFinanceiroDono(id) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("financeiroDono").doc(id).delete();
  }
  // ---- despesas da consultoria (frota): abastecimentos, despesas e trajetos — cada um vê os seus; o admin, todos ----
  function observarFrota(uid, cb) {
    if (!iniciar()) return () => {};
    return escutar("despesas da consultoria", (ok, falhou) => {
      const base = db.collection("frota");
      return (uid ? base.where("uid", "==", uid) : base).onSnapshot(
        (snap) => { ok(); cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); }, falhou);
    });
  }
  async function gravarFrota(item) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const { id, ...dados } = item;
    await executarOps([{ caminho: "frota/" + id, dados }], "despesas da consultoria");
  }
  async function apagarFrota(id) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await executarOps([{ caminho: "frota/" + id, dados: null }], "despesas da consultoria");
  }
  // Dados do suporte técnico: WhatsApp da equipe e vídeos de treinamento
  // que o dono cadastra; todo usuário logado lê.
  function observarSuporte(cb) {
    if (!iniciar()) return () => {};
    return db.collection("plataforma").doc("suporte").onSnapshot(
      (d) => cb(d.exists ? d.data() : null), () => cb(null));
  }
  async function gravarSuporte(dados) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("plataforma").doc("suporte").set(dados, { merge: true });
  }
  // ---- comunidade: mural por estado, entre todo mundo que usa o app ----
  function observarComunidade(uf, cb) {
    if (!iniciar()) return () => {};
    return db.collection("comunidade").doc(String(uf || "TO")).collection("mensagens").orderBy("data", "desc").limit(200).onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (erro) => { console.warn("comunidade:", erro); cb([]); });
  }
  async function enviarComunidade(uf, msg) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = usuarioAtual();
    if (!u) throw new Error("entre na sua conta");
    await db.collection("comunidade").doc(String(uf || "TO")).collection("mensagens").add({ ...msg, uid: u.uid, uf: String(uf || "TO"), data: new Date().toISOString() });
  }
  async function apagarComunidade(uf, id) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    await db.collection("comunidade").doc(String(uf || "TO")).collection("mensagens").doc(id).delete();
  }
  // observa o próprio cadastro (para o controle de "um aparelho por vez")
  function observarMeuUsuario(cb) {
    if (!iniciar()) return () => {};
    const u = usuarioAtual();
    if (!u) return () => {};
    return db.collection("usuarios").doc(u.uid).onSnapshot((d) => cb(d.exists ? d.data() : null), () => {});
  }

  // ---- guia de campo: fotos da equipe. "guia" = lista leve (item, quem, data); "guiaFotos" = a imagem ----
  async function guiaFotosListar() {
    if (!iniciar()) return [];
    let q = firebase.firestore().collection("guia");
    if (multiConta()) { const c = await minhaConta(); if (!c) return []; q = q.where("conta", "==", c); }
    const s = await q.get();
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => f.item).sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
  }
  async function guiaFotoLer(id) { if (!iniciar()) return null; const s = await firebase.firestore().collection("guiaFotos").doc(id).get(); return s.exists ? (s.data().dados || null) : null; }
  async function guiaFotoGravar(f) {
    if (!iniciar()) throw new Error("nuvem indisponível");
    const u = firebase.auth().currentUser; if (!u) throw new Error("entre na sua conta");
    const conta = (multiConta() ? await minhaConta() : null) || "agrocr";
    const meta = { item: f.item, cultura: f.cultura || "", quem: f.quem || "", fazendaNome: f.fazendaNome || "", data: f.data || new Date().toISOString().slice(0, 10), uid: u.uid, conta, criadaEm: new Date().toISOString() };
    await executarOps([{ caminho: "guiaFotos/" + f.id, dados: { dados: f.dados, uid: u.uid, conta, item: f.item } }, { caminho: "guia/" + f.id, dados: meta }], "foto do guia");
  }
  async function guiaFotoApagar(id) { if (!iniciar()) throw new Error("nuvem indisponível"); await executarOps([{ caminho: "guia/" + id, dados: null }, { caminho: "guiaFotos/" + id, dados: null }], "foto do guia"); }

  return {
    disponivel, entrar, sair, usuarioAtual, guiaFotosListar, guiaFotoLer, guiaFotoGravar, guiaFotoApagar, aoMudarUsuario, redefinirSenha, trocarSenha, meuPerfil,
    avisosDisponiveis, ativarAvisos, ouvirAvisosEmPrimeiroPlano, estadoAvisos, pedirTesteAviso,
    criarUsuario, criarConvite, criarContaPropria, observarUsuarios, observarEquipeConsultoria, gravarUsuario, apagarUsuario, observarTodosUsuarios, observarUsuariosDaConta,
    observarFazendas, observarFazendasDaLista, listarTodasFazendas, gravarFazendas, observarConfig, gravarConfig, aoMudarPendencia,
    executarOps, aoMudarFila, reprocessarFila, tentarFilaDeNovo, descartarDaFila, explicarErro, memoriaOffline, escutar, aoFalharLeitura, avisarLeitura,
    observarLicenca, observarLicencas, gravarLicenca, apagarLicenca, garantirMeuTeste, concederInclusoSeCouber, observarFrota, gravarFrota, apagarFrota, concederInclusoSeCouber, carimboData, observarMeuUsuario,
    observarPagamento, gravarPagamento, observarSuporte, gravarSuporte, lerNota, transcreverAudio, paraWav16k, caberNaNuvem, chamarSefaz, observarPessoasFazendas, enviarBackupEmail, observarComunidade, enviarComunidade, apagarComunidade, chamarNfe,
    observarFinanceiroDono, gravarFinanceiroDono, apagarFinanceiroDono,
    observarCotacoes, gravarCotacoes,
  };
})();

// ============================================================
// Coleções por fazenda
//
// Cada item vira um documento próprio. É o que impede o caso mais
// perigoso: o consultor lançar uma recomendação enquanto o operador
// marca uma execução, e um apagar o trabalho do outro por estarem
// gravando a mesma lista inteira.
// ============================================================
window.NuvemDados = (function () {
  const db = () => firebase.firestore();
  const col = (fazendaId, nome) => db().collection("fazendas").doc(fazendaId).collection(nome);

  const ROTULO_LISTA = { compras: "compras", recomendacoes: "recomendações", execucoes: "execuções", visitas: "visitas técnicas", fotos: "fotos das visitas", ajustes: "ajustes de estoque", entregas: "entregas", custos: "custos", maquinas: "máquinas", combustivel: "diesel", manutencoes: "manutenções", almoxarifado: "almoxarifado", funcionarios: "funcionários", notas: "notas fiscais", chuvas: "chuvas", colheita: "colheita", lavoura: "dados da lavoura", solo: "análises de solo", historico: "registro de alterações", nfe: "NF-e emitidas" };
  function observarColecao(fazendaId, nome, filtroSafra, cb) {
    let q = col(fazendaId, nome);
    if (filtroSafra) q = q.where("safra", "==", filtroSafra);
    return Nuvem.escutar(ROTULO_LISTA[nome] || nome, (chegou, falhou) => q.onSnapshot(
      (snap) => { chegou(); cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
      falhou
    ));
  }

  // Grava só o que mudou, comparando com o estado anterior
  async function gravarColecao(fazendaId, nome, safra, antes, depois) {
    const porId = {};
    (antes || []).forEach((x) => { porId[x.id] = x; });
    const ops = [];
    for (const item of depois || []) {
      // item sem id (cadastro antigo ou tela que esqueceu): ganha um agora — senão todos iriam
      // para o documento "undefined" e um lançamento apagava o outro (caso da lavoura da Arapuá)
      if (item.id == null || item.id === "" || item.id === "undefined") item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const anterior = porId[item.id];
      if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) {
        const { id, ...dados } = item;
        ops.push({ caminho: `fazendas/${fazendaId}/${nome}/${id}`, dados: { ...dados, safra } });
      }
      delete porId[item.id];
    }
    for (const id of Object.keys(porId)) ops.push({ caminho: `fazendas/${fazendaId}/${nome}/${id}`, dados: null });
    await Nuvem.executarOps(ops, nome);
  }

  // ---- fotos das visitas: um registro por foto (a visita guarda só "foto:ID") ----
  async function gravarFotos(fazendaId, safra, novas, apagarIds) {
    const ops = (novas || []).map((f) => ({ caminho: `fazendas/${fazendaId}/fotos/${f.id}`, dados: { visitaId: f.visitaId || "", dados: f.dados, safra: safra || "", criadaEm: new Date().toISOString() } }));
    for (const id of apagarIds || []) ops.push({ caminho: `fazendas/${fazendaId}/fotos/${id}`, dados: null });
    if (ops.length) await Nuvem.executarOps(ops, "fotos");
  }
  async function lerFoto(fazendaId, id) {
    const s = await db().collection("fazendas").doc(fazendaId).collection("fotos").doc(id).get();
    return s.exists ? (s.data().dados || null) : null;
  }

  // ---- recomendações + execuções ----
  // Ficam separadas na nuvem e voltam juntas para o app, no formato que
  // ele já entende. A execução é documento próprio porque quem a cria é
  // a fazenda, e ela nunca pode sobrescrever a receita da consultoria.
  const idExec = (recId, talhaoId) => recId + "__" + talhaoId;

  // ---- FAZENDA MODELO ----
  // Uma fazenda de exemplo com a SAFRA 2025/2026 COMPLETA — da dessecação à
  // colheita com romaneio, chuvas do ciclo, compras, custos, vendas, diesel,
  // máquinas e visitas — para quem acaba de criar a conta ver o aplicativo
  // funcionando e o resultado de uma safra inteira. Talhões e mapa (KML)
  // vêm de plataforma/modelo (copiados da Fazendinha). Marcada modelo:true.
  // "safraNova" (a atual) entra vazia, pronta para a pessoa começar a dela.
  async function criarFazendaModelo(conta, safraNova) {
    const S = "2025/2026";
    const novoId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    const fid = "modelo-" + novoId();
    const ts = (d, h) => d + "T" + (h || "09") + ":30:00.000Z";
    // soja na safra e MILHO na safrinha — a mesma terra, duas culturas no ano
    let T = [
      { id: "mt1", nome: "Pivô 1", areaHa: 120, cultura: "Soja", culturaSafrinha: "Milho" },
      { id: "mt2", nome: "Talhão 2", areaHa: 85, cultura: "Soja", culturaSafrinha: "Milho" },
      { id: "mt3", nome: "Talhão 3", areaHa: 95, cultura: "Soja", culturaSafrinha: "Milho" },
    ];
    let kmlModelo = null;
    try {
      const m = await db().collection("plataforma").doc("modelo").get();
      if (m.exists) {
        const md = m.data();
        const tl = md.talhoes ? JSON.parse(md.talhoes) : null;
        if (Array.isArray(tl) && tl.length) T = tl.map((x) => ({ id: x.id, nome: x.nome, areaHa: Number(x.areaHa) || 0, cultura: "Soja", culturaSafrinha: "Milho" }));
        if (md.kml) kmlModelo = md.kml;
      }
    } catch (e) { /* segue com os talhões genéricos */ }
    const areaTotal = T.reduce((s, t) => s + t.areaHa, 0);
    const quem = "Zé Operador (exemplo)";
    const agr = "Agrônomo (exemplo)";
    // um pluviômetro NO CENTRO de cada talhão, pela posição dos polígonos do
    // KML — é o que faz o mapa de chuva funcionar no exemplo
    let pluvs = [{ id: "mp1", nome: "Sede" }, { id: "mp2", nome: "Pivô" }];
    try {
      const k = kmlModelo ? JSON.parse(kmlModelo) : null;
      if (k && Array.isArray(k.poligonos)) {
        const centro = (anel) => { let sx = 0, sy = 0, n = 0; for (const p of anel) { if (Array.isArray(p) && p.length >= 2) { sx += Number(p[0]); sy += Number(p[1]); n++; } } return n ? [sx / n, sy / n] : null; };
        const chaveN = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
        const feitos = T.map((t, i) => {
          const pg = k.poligonos.find((g) => g.talhaoId === t.id)
            || k.poligonos.find((g) => chaveN(g.nome) === chaveN(t.nome))
            || k.poligonos.find((g) => g.nome && chaveN(g.nome).includes(chaveN(t.nome)));
          const c = pg && pg.aneis && pg.aneis[0] ? centro(pg.aneis[0]) : null;
          return c ? { id: "mp" + (i + 1), nome: "Pluviômetro " + t.nome, lat: c[1], lng: c[0] } : null;
        }).filter(Boolean);
        if (feitos.length) pluvs = feitos;
      }
    } catch (e) { /* sem posição: segue com os pluviômetros genéricos */ }
    const fazenda = {
      nome: "Fazenda Modelo (exemplo)", produtor: "Seu João (exemplo)", municipio: "Peixe/TO",
      codigo: Math.random().toString(36).slice(2, 8).toUpperCase(), modelo: true,
      safras: [S, safraNova].filter((x, i, a) => x && a.indexOf(x) === i), safraAtual: S,
      produtividade: { [S]: 65, [S + "|Milho"]: 105 },
      talhoes: T, pluviometros: pluvs,
    };
    if (conta) fazenda.conta = conta;
    await db().collection("fazendas").doc(fid).set(fazenda);

    const lote = db().batch();
    const add = (nome, dados, id) => lote.set(col(fid, nome).doc(id || novoId()), { ...dados, safra: S });
    const addSemSafra = (nome, dados, id) => lote.set(col(fid, nome).doc(id || novoId()), dados);

    // lavoura da safra: plantio 05/11/2025, emergência 11/11/2025
    const variedades = ["M8210 IPRO", "BMX Bônus IPRO", "TMG 7063 IPRO", "M8210 IPRO"];
    T.forEach((t, i) => add("lavoura", { talhaoId: t.id, cultura: "Soja", variedade: variedades[i % variedades.length], dataPlantio: "2025-11-05", dataEmergencia: "2025-11-11" }));

    // compras com preço (set–out/2025) — daqui saem estoque e custo de insumos
    const compras = [
      ["Glifosato 480 SL", "Herbicida", 1800, "L", 18.5, "2025-09-20"], ["2,4-D 806", "Herbicida", 500, "L", 29, "2025-09-20"],
      // semente comprada em kg (60 kg/ha), na MESMA unidade da dose — comprar em
      // sacas e dosar em kg faz o custo aplicado sair multiplicado
      ["Semente Soja M8210 IPRO", "Sementes", Math.round(areaTotal * 60), "kg", 8.75, "2025-09-25"], ["Inoculante Bradyrhizobium", "Biológico", Math.round(areaTotal), "dose", 4.5, "2025-10-01"],
      ["MAP 11-52-00", "Fertilizante / Adubo", Math.round(areaTotal * 200), "kg", 3.2, "2025-09-15"], ["Cloreto de Potássio", "Fertilizante / Adubo", Math.round(areaTotal * 150), "kg", 2.4, "2025-09-15"],
      ["Fox Xpro", "Fungicida", Math.round(areaTotal * 0.5 * 3), "L", 210, "2025-10-10"], ["Óleo mineral Nimbus", "Adjuvante", Math.round(areaTotal * 0.5 * 5), "L", 12, "2025-10-10"],
      ["Engeo Pleno S", "Inseticida", Math.round(areaTotal * 0.25 * 2), "L", 95, "2025-10-10"], ["Diquat 200", "Herbicida", Math.round(areaTotal * 1.5), "L", 42, "2026-01-30"],
      // ---- safrinha de MILHO (ciclo Safrinha, cultura Milho) ----
      ["Semente Milho DKB 390 PRO4", "Sementes", Math.round(areaTotal * 20), "kg", 68, "2026-02-20", "Safrinha", "Milho"],
      ["MAP 11-52-00 (safrinha)", "Fertilizante / Adubo", Math.round(areaTotal * 150), "kg", 3.3, "2026-02-20", "Safrinha", "Milho"],
      ["Ureia 45%", "Fertilizante / Adubo", Math.round(areaTotal * 200), "kg", 2.9, "2026-03-05", "Safrinha", "Milho"],
      ["Atrazina 500 SC", "Herbicida", Math.round(areaTotal * 3), "L", 21, "2026-03-05", "Safrinha", "Milho"],
      ["Engeo Pleno S (safrinha)", "Inseticida", Math.round(areaTotal * 0.2 * 2), "L", 95, "2026-03-05", "Safrinha", "Milho"],
      ["Priori Xtra", "Fungicida", Math.round(areaTotal * 0.3), "L", 160, "2026-03-05", "Safrinha", "Milho"],
    ];
    compras.forEach(([produto, categoria, qtd, unidade, preco, data, ciclo, cultura]) =>
      add("compras", { produto, categoria, qtd, unidade, preco, ciclo: ciclo || "Safra", cultura: cultura || "Soja", data, origem: "compra", fornecedorId: "", obs: "Revenda Exemplo", pagamento: "Pagamento na safra", vencimento: ciclo === "Safrinha" ? "2026-09-30" : "2026-04-30", barter: false }));

    // recomendações + execuções: o ciclo inteiro
    const todos = T.map((t) => t.id);
    const pulv = (id, tipo, alvo, data, produtos, execData, ciclo) => ({ id, modulo: "pulverizacao", tipo, alvo, dataRecomendada: data, vazao: "120", bico: "TT 110-02", capacidadeTanque: "3000", produtos, talhaoIds: todos, execData, ciclo: ciclo || "Safra" });
    const oleo = { nome: "Óleo mineral Nimbus", dose: 0.5, unidade: "L" };
    const recs = [
      pulv("mr1", "Herbicida", "Dessecação pré-plantio", "2025-10-24", [{ nome: "Glifosato 480 SL", dose: 2.5, unidade: "L" }, { nome: "2,4-D 806", dose: 1, unidade: "L" }, oleo], "2025-10-26"),
      { id: "mr2", modulo: "adubacao", tipo: "Adubação de base", alvo: "Fósforo e potássio", dataRecomendada: "2025-10-28", produtos: [{ nome: "MAP 11-52-00", dose: 200, unidade: "kg" }, { nome: "Cloreto de Potássio", dose: 150, unidade: "kg" }], talhaoIds: todos, execData: "2025-10-30" },
      { id: "mr3", modulo: "semeadura", tipo: "Semeadura", alvo: "Soja M8210 IPRO", dataRecomendada: "2025-11-03", espacamento: "50", populacao: "280000", produtos: [{ nome: "Semente Soja M8210 IPRO", dose: 60, unidade: "kg" }, { nome: "Inoculante Bradyrhizobium", dose: 1, unidade: "dose" }], talhaoIds: todos, execData: "2025-11-05" },
      pulv("mr4", "Herbicida", "Pós-emergente — buva e capim", "2025-11-28", [{ nome: "Glifosato 480 SL", dose: 2, unidade: "L" }, oleo], "2025-11-30"),
      pulv("mr5", "Fungicida", "1ª fungicida — ferrugem (preventivo)", "2025-12-14", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2025-12-16"),
      pulv("mr6", "Fungicida", "2ª fungicida — ferrugem", "2025-12-29", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2025-12-31"),
      pulv("mr7", "Inseticida", "Percevejo-marrom (2/m)", "2026-01-06", [{ nome: "Engeo Pleno S", dose: 0.25, unidade: "L" }, oleo], "2026-01-08"),
      pulv("mr8", "Fungicida", "3ª fungicida — ferrugem e mancha-alvo", "2026-01-13", [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }, oleo], "2026-01-15"),
      pulv("mr9", "Inseticida", "Percevejo-marrom (enchimento de grãos)", "2026-01-27", [{ nome: "Engeo Pleno S", dose: 0.25, unidade: "L" }, oleo], "2026-01-29"),
      pulv("mr10", "Herbicida", "Dessecação pré-colheita", "2026-02-18", [{ nome: "Diquat 200", dose: 1.5, unidade: "L" }, oleo], "2026-02-20"),
      // ---- safrinha de MILHO: plantio logo depois da colheita da soja ----
      { id: "mr11", modulo: "adubacao", tipo: "Adubação de base (milho)", alvo: "Fósforo no sulco", dataRecomendada: "2026-03-16", produtos: [{ nome: "MAP 11-52-00 (safrinha)", dose: 150, unidade: "kg" }], talhaoIds: todos, execData: "2026-03-18", ciclo: "Safrinha" },
      { id: "mr12", modulo: "semeadura", tipo: "Semeadura", alvo: "Milho DKB 390 PRO4", dataRecomendada: "2026-03-16", espacamento: "50", populacao: "60000", produtos: [{ nome: "Semente Milho DKB 390 PRO4", dose: 20, unidade: "kg" }], talhaoIds: todos, execData: "2026-03-18", ciclo: "Safrinha" },
      pulv("mr13", "Herbicida", "Pós-emergente do milho (folhas largas e estreitas)", "2026-04-05", [{ nome: "Atrazina 500 SC", dose: 3, unidade: "L" }, oleo], "2026-04-07", "Safrinha"),
      { id: "mr14", modulo: "adubacao", tipo: "Adubação de cobertura", alvo: "Nitrogênio (V4–V6)", dataRecomendada: "2026-04-10", produtos: [{ nome: "Ureia 45%", dose: 200, unidade: "kg" }], talhaoIds: todos, execData: "2026-04-12", ciclo: "Safrinha" },
      pulv("mr15", "Inseticida", "Cigarrinha-do-milho e lagarta-do-cartucho", "2026-04-14", [{ nome: "Engeo Pleno S (safrinha)", dose: 0.2, unidade: "L" }, oleo], "2026-04-16", "Safrinha"),
      pulv("mr16", "Fungicida", "Manchas foliares do milho (pré-pendoamento)", "2026-05-05", [{ nome: "Priori Xtra", dose: 0.3, unidade: "L" }, oleo], "2026-05-07", "Safrinha"),
    ];
    for (const r of recs) {
      const { execData, ...rec } = r;
      add("recomendacoes", { ...rec, ciclo: rec.ciclo || "Safra", observacao: rec.ciclo === "Safrinha" ? "Recomendação de exemplo — safrinha de milho 2026." : "Recomendação de exemplo — safra 2025/2026.", recomendadoPor: agr }, rec.id);
      if (execData) T.forEach((t, i) => {
        const d = new Date(execData + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + Math.floor(i / 2));
        lote.set(col(fid, "execucoes").doc(idExec(rec.id, t.id)),
          { data: ts(d.toISOString().slice(0, 10), "07"), operador: quem, obs: "", fotos: [], produtosReais: null, areaExecutada: null, recomendacaoId: rec.id, talhaoId: t.id, safra: S });
      });
    }

    // chuvas do ciclo (out/2025 -> mar/2026), dois pluviômetros
    const chuvas = [
      ["2025-10-12", 18], ["2025-10-19", 26], ["2025-10-27", 34], ["2025-11-02", 22], ["2025-11-08", 41], ["2025-11-14", 15], ["2025-11-21", 38], ["2025-11-27", 29],
      ["2025-12-03", 47], ["2025-12-09", 22], ["2025-12-15", 55], ["2025-12-21", 31], ["2025-12-27", 44], ["2026-01-04", 62], ["2026-01-10", 28], ["2026-01-17", 39],
      ["2026-01-23", 71], ["2026-01-30", 25], ["2026-02-05", 48], ["2026-02-12", 33], ["2026-02-19", 12], ["2026-02-26", 27], ["2026-03-06", 19], ["2026-03-15", 9],
      // chuvas da safrinha (o fim do período chuvoso)
      ["2026-03-22", 31], ["2026-03-29", 24], ["2026-04-04", 26], ["2026-04-13", 18], ["2026-04-21", 14], ["2026-04-30", 9], ["2026-05-12", 6],
    ];
    // cada pluviômetro registra a mesma chuva com pequena variação — assim o
    // mapa de chuva mostra diferença entre os talhões
    chuvas.forEach(([data, mm], i) => {
      pluvs.forEach((p, j) => add("chuvas", { data, mm: Math.max(0, mm + (((i + j) % 3) - 1) * 4), local: p.nome, pluviometroId: p.id, quem }));
    });

    // colheita da soja (mar/2026) com romaneio do armazém — média ~65 sc/ha
    addSemSafra("colheita", { tipo: "caminhao", caminhao: "ABC-1D23", motorista: "Carlos", quem, safra: S });
    addSemSafra("colheita", { tipo: "caminhao", caminhao: "DEF-2E45", motorista: "Marcos", quem, safra: S });
    let colhidoKg = 0;
    T.forEach((t, k) => {
      const kgTotal = t.areaHa * 65 * 60;
      const n = Math.max(3, Math.round(kgTotal / 36000));
      const porCarga = Math.round(kgTotal / n);
      for (let i = 0; i < n; i++) {
        const d = new Date("2026-03-02T12:00:00Z"); d.setUTCDate(d.getUTCDate() + k * 4 + Math.floor(i / 4));
        const data = d.toISOString().slice(0, 10);
        const bruto = porCarga + 700;
        const umid = 13 + ((i % 3) * 0.7);
        const descU = Math.round(bruto * ((umid - 14) > 0 ? (umid - 14) / 86 : 0));
        const descI = 300;
        const liquido = bruto - descU - descI;
        colhidoKg += liquido;
        add("colheita", { tipo: "carga", cultura: "Soja", talhaoId: t.id, data, caminhao: i % 2 ? "DEF-2E45" : "ABC-1D23", pesoKg: porCarga, status: "descarregado",
          pesoDescarga: liquido, dataBaixa: data, quemBaixa: quem, quem, pesoBrutoRom: bruto, umidadePct: Number(umid.toFixed(1)), impurezaPct: 1, descUmidadeKg: descU || null, descImpurezaKg: descI, deposito: "Cerealista Exemplo" });
      }
      add("colheita", { tipo: "area", cultura: "Soja", talhaoId: t.id, data: "2026-03-14", areaHa: t.areaHa, quem });
    });
    const sacas = Math.round(colhidoKg / 60);

    // colheita do MILHO safrinha (ago/2026) — média ~105 sc/ha
    T.forEach((t, k) => {
      const kgTotal = t.areaHa * 105 * 60;
      const n = Math.max(3, Math.round(kgTotal / 40000));
      const porCarga = Math.round(kgTotal / n);
      for (let i = 0; i < n; i++) {
        const d = new Date("2026-08-03T12:00:00Z"); d.setUTCDate(d.getUTCDate() + k * 5 + Math.floor(i / 5));
        const data = d.toISOString().slice(0, 10);
        const bruto = porCarga + 500;
        const umid = 14 + ((i % 4) * 0.5);
        const descU = Math.round(bruto * ((umid - 14) > 0 ? (umid - 14) / 86 : 0));
        add("colheita", { tipo: "carga", cultura: "Milho", talhaoId: t.id, data, caminhao: i % 2 ? "DEF-2E45" : "ABC-1D23", pesoKg: porCarga, status: "descarregado",
          pesoDescarga: bruto - descU - 250, dataBaixa: data, quemBaixa: quem, quem, pesoBrutoRom: bruto, umidadePct: Number(umid.toFixed(1)), impurezaPct: 0.8, descUmidadeKg: descU || null, descImpurezaKg: 250, deposito: "Cerealista Exemplo" });
      }
      add("colheita", { tipo: "area", cultura: "Milho", talhaoId: t.id, data: "2026-08-20", areaHa: t.areaHa, quem });
    });

    // custos, vendas e barter da safra
    [["Diesel out-dez", "Combustível", Math.round(areaTotal * 95), "2025-12-20"], ["Diesel jan-mar (colheita)", "Combustível", Math.round(areaTotal * 70), "2026-03-15"],
      ["Folha dos operadores (6 meses)", "Mão de obra", Math.round(areaTotal * 210), "2026-03-31"], ["Manutenção do pulverizador", "Manutenção", 6800, "2025-12-02"],
      ["Manutenção da colheitadeira", "Manutenção", 14500, "2026-02-25"], ["Frete das sementes", "Frete", 3200, "2025-09-30"], ["Arrendamento (parte)", "Arrendamento", Math.round(areaTotal * 180), "2026-03-31"],
      // custos da SAFRINHA de milho
      ["Diesel abr–jun (safrinha)", "Combustível", Math.round(areaTotal * 55), "2026-06-30", "Safrinha"], ["Diesel colheita do milho", "Combustível", Math.round(areaTotal * 60), "2026-08-20", "Safrinha"],
      ["Folha dos operadores (safrinha)", "Mão de obra", Math.round(areaTotal * 140), "2026-08-31", "Safrinha"], ["Secagem e armazenagem do milho", "Serviços", Math.round(areaTotal * 105 * 1.8), "2026-08-25", "Safrinha"],
      ["Frete do milho para o armazém", "Frete", Math.round(areaTotal * 105 * 2.2), "2026-08-25", "Safrinha"]]
      .forEach(([descricao, categoria, valor, data, ciclo]) => add("custos", { descricao, categoria, valor, ciclo: ciclo || "Ambas", data, talhaoId: null, quem: agr }));
    add("custos", { ehVenda: true, cultura: "Soja", descricao: "Trade Exemplo — travamento dez/2025", sacas: Math.round(sacas * 0.4), preco: 118, moeda: "R$", ciclo: "Ambas", data: "2025-12-10", vencimento: "2026-04-15", quem: agr });
    add("custos", { ehVenda: true, cultura: "Soja", descricao: "Trade Exemplo — venda na colheita", sacas: Math.round(sacas * 0.45), preco: 124, moeda: "R$", ciclo: "Ambas", data: "2026-03-18", vencimento: "2026-04-30", quem: agr });
    add("custos", { ehBarter: true, cultura: "Soja", descricao: "Pacote barter Revenda Exemplo", sacas: Math.round(sacas * 0.15), precoSaca: 115, moeda: "R$", ciclo: "Safra", data: "2025-09-15", quem: agr });

    const sacasMilho = Math.round(areaTotal * 105);
    add("custos", { ehVenda: true, cultura: "Milho", descricao: "Cerealista Exemplo — travamento do milho", sacas: Math.round(sacasMilho * 0.6), preco: 52, moeda: "R$", ciclo: "Safrinha", data: "2026-05-20", vencimento: "2026-09-10", quem: agr });

    // máquinas, tanque, entradas e abastecimentos de diesel
    const maqs = [["mm1", "Trator", "John Deere 6110J", "John Deere", "2021"], ["mm2", "Pulverizador", "Jacto Uniport 3030", "Jacto", "2019"], ["mm3", "Plantadeira", "Stara Absoluta 35", "Stara", "2020"], ["mm4", "Colheitadeira", "Case IH 8250", "Case IH", "2023"], ["mm5", "Caminhão", "Mercedes-Benz Atego 2426", "Mercedes-Benz", "2018"]];
    maqs.forEach(([id, tipo, nome, marca, ano]) => addSemSafra("maquinas", { tipo, nome, marca, ano, obs: "", terceirizada: false }, id));
    addSemSafra("combustivel", { tipo: "tanque", nome: "Tanque da sede", capacidade: 15000, quem }, "mtq1");
    [["2025-10-15", 12000, 75600, "88231"], ["2026-01-20", 10000, 64000, "90114"]].forEach(([data, litros, valor, nf]) =>
      addSemSafra("combustivel", { tipo: "entrada", litros, valor, data, tanqueId: "mtq1", nf, origem: "Distribuidora Exemplo", quem }));
    [["mm1", 380, "2025-10-26"], ["mm3", 420, "2025-11-05"], ["mm1", 350, "2025-11-06"], ["mm2", 240, "2025-11-30"], ["mm2", 260, "2025-12-16"], ["mm2", 250, "2025-12-31"],
      ["mm2", 230, "2026-01-08"], ["mm2", 255, "2026-01-15"], ["mm2", 240, "2026-01-29"], ["mm2", 300, "2026-02-20"], ["mm4", 900, "2026-03-03"], ["mm4", 950, "2026-03-07"], ["mm5", 600, "2026-03-05"], ["mm4", 880, "2026-03-11"],
      // safrinha de milho
      ["mm3", 450, "2026-03-18"], ["mm1", 360, "2026-03-18"], ["mm2", 240, "2026-04-07"], ["mm1", 380, "2026-04-12"], ["mm2", 235, "2026-04-16"], ["mm2", 245, "2026-05-07"], ["mm4", 1100, "2026-08-04"], ["mm4", 1050, "2026-08-10"], ["mm5", 700, "2026-08-08"], ["mm4", 980, "2026-08-16"]]
      .forEach(([maquinaId, litros, data]) => addSemSafra("combustivel", { tipo: "abastecimento", maquinaId, litros, data, tanqueId: "mtq1", horimetro: null, quem }));

    // visitas técnicas do ciclo, já no formato novo do relatório
    const nomeT = (i) => (T[i] || T[0]).nome;
    add("visitas", { data: "2025-12-12", tecnico: agr, obsCampo: [], itens: [
      { titulo: "Resumo da visita", texto: "Programar aplicação: 1ª fungicida — ferrugem (todos os talhões).", fotos: [] },
      { titulo: "Talhões visitados", texto: T.map((t, i) => "• " + t.nome + " — " + t.areaHa + " ha · Soja · " + variedades[i % variedades.length] + " · 31 DAE").join("\n"), fotos: [] },
      { titulo: "🌱 Fisiologia e estádio da lavoura", texto: "• " + nomeT(0) + ": Lavoura vigorosa, sem problemas.\n• " + nomeT(1) + ": Fechamento de ruas.", fotos: [] },
      { titulo: "🌿 Plantas daninhas", texto: "• " + nomeT(2) + ": Buva — pressão BAIXA · Só monitorar (na beirada do carreador).", fotos: [] },
      { titulo: "🦠 Doenças", texto: "• " + nomeT(0) + ": Ferrugem-asiática — pressão BAIXA · Programar aplicação (primeiras pústulas no baixeiro).", fotos: [] },
    ] });
    add("visitas", { data: "2026-01-05", tecnico: agr, obsCampo: [], itens: [
      { titulo: "Resumo da visita", texto: "⚠️ AÇÃO URGENTE: Percevejo-marrom (" + nomeT(1) + ").\nProgramar aplicação: Percevejo-marrom (" + nomeT(0) + ").", fotos: [] },
      { titulo: "Talhões visitados", texto: T.map((t, i) => "• " + t.nome + " — " + t.areaHa + " ha · Soja · " + variedades[i % variedades.length] + " · 55 DAE").join("\n"), fotos: [] },
      { titulo: "🌱 Fisiologia e estádio da lavoura", texto: "• " + nomeT(0) + ": Floração.\n• " + nomeT(1) + ": Floração.", fotos: [] },
      { titulo: "🐛 Pragas e insetos", texto: "• " + nomeT(1) + ": Percevejo-marrom — pressão ALTA · Ação urgente (3 por metro).\n• " + nomeT(0) + ": Percevejo-marrom — pressão MÉDIA · Programar aplicação.", fotos: [] },
    ] });

    add("visitas", { data: "2026-04-20", tecnico: agr, obsCampo: [], itens: [
      { titulo: "Resumo da visita", texto: "Programar aplicação: Cigarrinha-do-milho (" + nomeT(0) + ", " + nomeT(1) + ").", fotos: [] },
      { titulo: "Talhões visitados", texto: T.map((t) => "• " + t.nome + " — " + t.areaHa + " ha · Milho · DKB 390 PRO4 · 31 DAE").join("\n"), fotos: [] },
      { titulo: "🌱 Fisiologia e estádio da lavoura", texto: "• " + nomeT(0) + ": Lavoura vigorosa, sem problemas (V6).\n• " + nomeT(2) + ": Estande abaixo do esperado (falhas na cabeceira).", fotos: [] },
      { titulo: "🐛 Pragas e insetos", texto: "• " + nomeT(0) + ": Cigarrinha-do-milho — pressão MÉDIA · Programar aplicação.\n• " + nomeT(1) + ": Lagarta-do-cartucho — pressão BAIXA · Só monitorar.", fotos: [] },
    ] });

    // o mapa real (KML) copiado da fazenda de referência
    if (kmlModelo) lote.set(col(fid, "arquivos").doc("kml"), { valor: kmlModelo, formato: "json" });

    await lote.commit();

    // cotações regionais de exemplo (soja e milho), só se a conta ainda não tem nenhuma
    try {
      const refCot = db().collection("cotacoes").doc(conta ? "regional__" + conta : "regional");
      const atual = await refCot.get();
      const lista = (atual.exists && Array.isArray(atual.data().lista)) ? atual.data().lista : [];
      if (!lista.length) {
        const cot = (produto, preco, data) => ({ id: novoId(), produto, preco, moeda: "R$", modalidade: "Disponível", referencia: "", unidade: "sc 60 kg", praca: "Peixe/TO", data, quem: agr });
        await refCot.set({ lista: [cot("Soja", 116, "2025-11-10"), cot("Soja", 122, "2026-03-10"), cot("Soja", 125, "2026-08-28"), cot("Milho", 48, "2026-06-15"), cot("Milho", 54, "2026-08-28")] });
      }
    } catch (e) { console.warn("cotações modelo:", e); }
    return fid;
  }

  function observarRecomendacoes(fazendaId, safra, cb) {
    let recs = null, execs = null;
    const juntar = () => {
      if (!recs || !execs) return;
      const porRec = {};
      execs.forEach((e) => {
        if (!porRec[e.recomendacaoId]) porRec[e.recomendacaoId] = {};
        const { id, recomendacaoId, talhaoId, safra: _s, ...resto } = e;
        porRec[e.recomendacaoId][e.talhaoId] = resto;
      });
      cb(recs.map((r) => ({ ...r, execucoes: porRec[r.id] || {} })));
    };
    const s1 = observarColecao(fazendaId, "recomendacoes", safra, (l) => { recs = l; juntar(); });
    const s2 = observarColecao(fazendaId, "execucoes", safra, (l) => { execs = l; juntar(); });
    return () => { s1(); s2(); };
  }

  async function gravarRecomendacoes(fazendaId, safra, antes, depois) {
    const antesPorId = {};
    (antes || []).forEach((a) => { antesPorId[a.id] = a; });
    const ops = [];
    const cam = (nome, id) => `fazendas/${fazendaId}/${nome}/${id}`;
    for (const a of depois || []) {
      const anterior = antesPorId[a.id];
      const { execucoes, ...receita } = a;
      const receitaAntes = anterior ? (({ execucoes: _e, ...r }) => r)(anterior) : null;
      if (!receitaAntes || JSON.stringify(receitaAntes) !== JSON.stringify(receita)) {
        const { id, ...dados } = receita;
        ops.push({ caminho: cam("recomendacoes", id), dados: { ...dados, safra } });
      }
      const execAntes = (anterior && anterior.execucoes) || {};
      for (const tid of Object.keys(execucoes || {})) {
        if (JSON.stringify(execAntes[tid]) !== JSON.stringify(execucoes[tid])) {
          ops.push({ caminho: cam("execucoes", idExec(a.id, tid)), dados: { ...execucoes[tid], recomendacaoId: a.id, talhaoId: tid, safra } });
        }
      }
      // execução desfeita (saiu do mapa da recomendação): apaga o documento dela
      for (const tid of Object.keys(execAntes)) if (!(execucoes || {})[tid]) ops.push({ caminho: cam("execucoes", idExec(a.id, tid)), dados: null });
      delete antesPorId[a.id];
    }
    // recomendação apagada leva junto as execuções dela
    for (const id of Object.keys(antesPorId)) {
      ops.push({ caminho: cam("recomendacoes", id), dados: null });
      for (const tid of Object.keys(antesPorId[id].execucoes || {})) ops.push({ caminho: cam("execucoes", idExec(id, tid)), dados: null });
    }
    await Nuvem.executarOps(ops, "recomendações");
  }

  // ---- documentos únicos (mapa, fotos do mapa, documentos da fazenda) ----
  // O valor vai EMPACOTADO como texto. Motivo: o Firestore recusa lista
  // dentro de lista, e o mapa KML é exatamente isso (polígonos > anéis >
  // pontos). Empacotado, qualquer formato passa. Documentos antigos, que
  // foram gravados sem empacotar, continuam sendo lidos normalmente.
  const ROTULO_DOC = { kml: "mapa dos talhões", fotosMapa: "imagens do mapa", documentos: "documentos", programas: "programas de insumos" };
  function observarDoc(fazendaId, nome, cb) {
    return Nuvem.escutar(ROTULO_DOC[nome] || nome, (chegou, falhou) => col(fazendaId, "arquivos").doc(nome).onSnapshot(
      (d) => {
        chegou();
        // meta: de onde veio esta versão (cache do aparelho ou servidor) — quem precisa
        // decidir algo a partir do dado espera a versão do servidor
        const meta = { fromCache: !!(d.metadata && d.metadata.fromCache), pendente: !!(d.metadata && d.metadata.hasPendingWrites) };
        if (!d.exists) { cb(undefined, meta); return; }
        const dados = d.data();
        if (dados.formato === "json") {
          try { cb(JSON.parse(dados.valor), meta); } catch (e) { cb(undefined, meta); }
        } else {
          cb(dados.valor, meta);
        }
      },
      falhou
    ));
  }
  async function gravarDoc(fazendaId, nome, valor) {
    await Nuvem.executarOps([{ caminho: `fazendas/${fazendaId}/arquivos/${nome}`, dados: { valor: JSON.stringify(valor === undefined ? null : valor), formato: "json" } }], nome);
  }
  // Documento-mapa (ex.: programas): grava SÓ as chaves informadas, lendo antes a versão do
  // servidor numa transação — duas pessoas (ou dois aparelhos) mexendo em chaves diferentes
  // não se apagam. valor null = tirar a chave. Sem internet a transação falha: quem chama cai
  // no gravarDoc do mapa inteiro (fila do aparelho), que era o comportamento antigo.
  async function mesclarDocJson(fazendaId, nome, mudancas) {
    const ref = col(fazendaId, "arquivos").doc(nome);
    await db().runTransaction(async (tx) => {
      const d = await tx.get(ref);
      let atual = {};
      if (d.exists) { try { atual = JSON.parse(d.data().valor || "{}") || {}; } catch (e) { atual = {}; } }
      if (Array.isArray(atual) || typeof atual !== "object") atual = {};
      for (const k of Object.keys(mudancas || {})) {
        if (mudancas[k] === null || mudancas[k] === undefined) delete atual[k]; else atual[k] = mudancas[k];
      }
      tx.set(ref, { valor: JSON.stringify(atual), formato: "json" });
    });
  }

  // ---- cópia de segurança: baixa TUDO num objeto só ----
  // Lê cada fazenda com todas as suas coleções, de todas as safras.
  // Vira o arquivo .json que o administrador guarda fora da nuvem.
  async function baixarTudo() {
    const db2 = db();
    const SUBCOLECOES = ["talhoes", "compras", "recomendacoes", "execucoes", "chuvas",
      "colheita", "ajustes", "entregas", "historico", "lavoura", "visitas", "fotos", "mapa", "documentos", "arquivos", "cotacoesPecas", "ponto"];
    const fazendas = [];
    const snapF = await db2.collection("fazendas").get();
    for (const f of snapF.docs) {
      const item = { id: f.id, ...f.data(), _colecoes: {} };
      for (const nome of SUBCOLECOES) {
        const snap = await db2.collection("fazendas").doc(f.id).collection(nome).get();
        if (!snap.empty) item._colecoes[nome] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      fazendas.push(item);
    }
    const usuarios = (await db2.collection("usuarios").get()).docs.map((d) => {
      const { fcmTokens, ...resto } = d.data();   // endereços de aviso não servem em restauração
      return { uid: d.id, ...resto };
    });
    const config = {};
    for (const nome of ["grupos", "equipe", "fornecedores", "produtos"]) {
      try {
        const doc = await db2.collection("config").doc(nome).get();
        if (doc.exists) config[nome] = doc.data().lista || [];
      } catch (e) {}
    }
    return { geradoEm: new Date().toISOString(), projeto: "agrocr-campo", fazendas, usuarios, config };
  }

  // ---- exclusão completa de uma fazenda ----
  // Apagar só o documento da fazenda deixaria tudo o que é dela (talhões,
  // compras, execuções, histórico...) órfão e invisível no banco, ocupando
  // espaço para sempre. Aqui varremos cada subcoleção antes.
  async function apagarFazendaInteira(fazendaId) {
    const SUBCOLECOES = ["talhoes", "compras", "recomendacoes", "execucoes", "chuvas",
      "ajustes", "historico", "lavoura", "visitas", "fotos", "mapa", "documentos", "arquivos", "solo", "almoxarifado", "combustivel", "manutencoes", "cotacoesPecas", "ponto"];
    for (const nome of SUBCOLECOES) {
      const snap = await col(fazendaId, nome).get();
      // lotes de 400: o Firestore recusa lotes acima de 500 operações
      for (let i = 0; i < snap.docs.length; i += 400) {
        const lote = db().batch();
        snap.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
        await lote.commit();
      }
    }
    await db().collection("fazendas").doc(fazendaId).delete();
  }

  return { observarColecao, gravarColecao, criarFazendaModelo, observarRecomendacoes, gravarRecomendacoes, observarDoc, gravarDoc, mesclarDocJson, apagarFazendaInteira, baixarTudo, gravarFotos, lerFoto };
})();
