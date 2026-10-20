// Teste automático das CONTAS do app — roda sem navegador, direto no Node
// da pasta ferramentas\. O build.ps1 -Publicar chama este arquivo antes de
// gerar a versão que vai para a internet: se uma conta sair errada, não publica.
//
//   ferramentas\node\node.exe ferramentas\testar-contas.js
//
// O app inteiro (agrocr-app.jsx) é traduzido com o esbuild e carregado numa
// "sala fechada" (vm) com React/ReactDOM/document de mentira; só as funções
// de conta são puxadas para fora e conferidas contra valores conhecidos.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const esbuild = require(path.join(__dirname, "cli", "node_modules", "esbuild"));

const raiz = path.dirname(__dirname);
const fonte = path.join(raiz, "agrocr-app.jsx");

// ---------- carrega o app numa sala fechada ----------
let jsx = fs.readFileSync(fonte, "utf8");
jsx = jsx.replace(/import\s*\{[^}]*\}\s*from\s*"react";\s*/, "");
jsx = jsx.replace(/export default function App/, "function App");

// funções de conta que queremos conferir (todas de nível de módulo no jsx)
const EXPORTAR = ["num", "safraDaData", "fichaDe", "DOENCAS_PADRAO", "doencasDe", "lavouraComEmergenciaDoPlantio", "DIAS_ATE_EMERGENCIA", "quadroPragas", "pragasAcima", "linhasDaRecomendacao", "partesDaLavoura", "parteDoPonto", "dividirAnelPorLinha", "resumoFungicidas", "quantidadesTesteCalda", "infoCaldaDe", "nomeComFormulacao", "PASSOS_TESTE_CALDA", "obsDosTalhoes", "distanciaAoAnel", "talhaoPeloGps", "perimetroDoTalhao", "areaBordadura", "CAMPO_VER", "padraoAreaFazenda", "agruparObsVisita", "linhaGrupoObs", "itensComResumo", "itensPorTalhao", "textoResumoVisita", "mmDoPeriodo", "centroidesDosTalhoes", "fatiaDasVariedades", "cargasDoDistribuidor", "ehDistribuidor", "planoDeVariedades", "consumoDaExecucao", "bagDoPasso", "consumoPorTalhao", "extrairFotosDasVisitas", "refsDeFotos", "MAX_FOTOS_VISITA", "resumoArmadilhas", "sequenciaDeTanques", "dicasDaCalda", "DICAS_CALDA", "OBS_CATALOGO", "OBS_CATALOGO_MAIS", "dicasVozDe", "montarItensVisita", "contextoDoTalhao", "LIMITE_FOTOS_DOC", "bytesFotos", "pedidosDaLinha", "fornecedoresDaLinha", "linhasCompletar", "listaBicos", "ehPulverizador", "ehPulverizadorSulco", "infoSementeDe", "doseSementePorHa", "ehNomeDeSemente", "sementeDaReceita", "comprasDuplicadas", "semDuplicadas", "compraIdenticaAoExistente", "dicaLoteDe", "pontosParaHa", "situacaoValidade", "lotesComSaldo", "desrepetirNomes", "normalizarFuncao", "proximo30Abril", "ordemDeMistura", "grupoMistura", "moverCompraEntreFazendas", "paresRepetidos", "fundirCompras", "distribuirPorArea", "linhasMapaVariedades", "coresDasVariedades", "resumoVariedades", "prepararItensArquivo", "modoDoArquivo", "aplicarCompras", "ehReembolsoFrota", "motoristaDe", "PAG_BOLSO", "leiturasDoVeiculo", "mesmaNf", "recebidoDaNota", "notasComChegada", "notaJaLancada", "pedidoDoItemDaNota", "DESTINO_INSUMO", "fasesDaCalda", "consumoDaExecucao", "fracaoContinuacao", "doseEquivalente", "concentracaoDoAtivo", "nomeDoAtivo", "casarItemNota", "kmDosBuracos", "conferenciaFrota", "resumoFrota", "aceitarPontoTrajeto", "codificarRota", "decodificarRota", "kmDaRota", "previsaoDeColheita", "linhasDaLavoura", "ajustesDaTransferencia", "interpretarPedidoFornecedor", "ehPedidoFornecedor", "dataDePlanilha", "MODELO_PEDIDO", "lerCSV", "ratearSacas", "permissoesDaFuncao", "funcaoDeCampo", "classeSolo", "FAIXAS_SOLO", "analiseDoMapa", "soloDaFazenda", "resumoAtributoFazenda", "interpretarLaudoLab", "gruposDoLaudoLab", "lerPontosKML", "repartirPontosKML", "alocarNotaEmPedidos", "candidatasDescarga", "notasDieselPendentes", "evolucaoPragasDe", "marcarProfundos", "distribuirPontos", "precoMedioDiesel", "resumoPlanoOperacional", "totalDaLinha", "categoriaDaOperacao", "areaDaLinha", "parteCiclo", "doseDoComprado", "planoDescarga", "trocasPossiveis", "posicoesNaFaixa", "cvDireto", "distribuicaoFaixa", "curvaFaixas", "posicoesBandejas", "gramasPorBandeja", "vazaoLancoKgMin", "mlPorBico", "gramasPorLinha", "coordOk", "ITENS_ACESSO", "podeFazenda", "podePermissao", "condicaoPulverizacao", "pontoDaFazenda", "custoDaRetirada", "acharPecaAlmox", "interpretarPlanilhaAlmox", "fluxoDeCaixa", "profundidadeChave", "estoqueAlmoxarifado", "consumoAlmoxPorMaquina", "categoriaAlmoxDe", "destinoSugerido", "DESTINO_ALMOX", "gerarKml", "deMundo", "paraMundo", "lerKML", "areaPoligonoHa", "resumoFinanceiroSemana", "tendenciaSolo", "pontosDoGrid", "mediaPontos", "interpretarPlanilhaSolo", "colunaSolo", "nutrientesPorHa", "NUTRIENTES_CULTURA", "sementesPorMetro", "espacamentoPadraoDe", "bytesFotos", "fotosDaObs", "LIMITE_FOTOS_DOC", "mediaChuva", "corChuva", "analisarSecas", "ativoDoProduto", "ativoTxt", "normalizar", "totalProduto", "unidadesDaBase", "calcularEstoqueDe", "diasEntreISO", "somarDias", "somarMeses",
  "resumoFungicidas", "FUNG_PRIMEIRA_DAE", "FUNG_INTERVALO", "FUNG_FIM_DAE", "necessidadeProgramaCompra", "consumoPorTalhao", "distribuirPontos",
  "quadroPragas", "fichaDe", "achouValor", "lerPlanilhaComoTexto", "areaLavoura", "talhoesLavoura", "fluxoDeCaixa", "lerOFX", "casarExtrato", "intervaloMonitoramento", "regraFungicida", "nivelDe", "pragasAcima", "distanciaM", "rumoTexto", "SEMENTES_POR_BAG", "normalizarPasso", "chaveProduto", "pontoNoAnel"];
const completo = 'const { useState, useEffect, useRef } = React;\n' + jsx +
  '\nglobalThis.__contas = { ' + EXPORTAR.map((n) => `${n}: (typeof ${n} !== "undefined" ? ${n} : undefined)`).join(", ") + ' };\n';

const js = esbuild.transformSync(completo, { loader: "jsx", jsx: "transform", minify: false, target: "es2020" }).code;

const nada = () => {};
const hookFalso = (v) => [typeof v === "function" ? v() : v, nada];
const React = { createElement: () => null, Fragment: "f", useState: hookFalso, useEffect: nada, useRef: (v) => ({ current: v }), useMemo: (f) => f(), useCallback: (f) => f() };
const elementoFalso = () => new Proxy({ style: {}, classList: { add: nada, remove: nada }, appendChild: nada, removeChild: nada, setAttribute: nada, addEventListener: nada, getContext: () => null }, { get: (o, k) => (k in o ? o[k] : nada) });
const storageFalso = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; }, key: () => null, get length() { return 0; } };
// banco Agrofit já "baixado" no aparelho: o app lê do localStorage sem fetch
storageFalso.setItem("agrocr:agrofit", JSON.stringify({ em: Date.now(), l: require("../publicar/insumos-agrofit.json") }));
const sandbox = {
  console, React, ReactDOM: { createRoot: () => ({ render: nada }) },
  document: { getElementById: elementoFalso, createElement: elementoFalso, querySelector: () => null, querySelectorAll: () => [], body: elementoFalso(), head: elementoFalso(), addEventListener: nada, removeEventListener: nada, documentElement: elementoFalso(), hidden: false },
  localStorage: storageFalso, sessionStorage: storageFalso,
  navigator: { onLine: true, userAgent: "teste", serviceWorker: { addEventListener: nada, removeEventListener: nada, ready: Promise.resolve({ showNotification: nada }) }, geolocation: null, language: "pt-BR", clipboard: null },
  location: { hash: "", href: "http://localhost/", pathname: "/", search: "", origin: "http://localhost", reload: nada },
  history: { replaceState: nada, pushState: nada },
  fetch: () => Promise.reject(new Error("sem internet no teste")),
  setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, URL, URLSearchParams, TextEncoder, TextDecoder, Intl,
  Notification: { permission: "default" }, Blob: class {}, FileReader: class {}, Image: class {}, Audio: class {},
  matchMedia: () => ({ matches: false, addEventListener: nada, addListener: nada }),
  addEventListener: nada, removeEventListener: nada, alert: nada, confirm: () => false, prompt: () => null, requestAnimationFrame: (f) => setTimeout(f, 0), speechSynthesis: null,
  DecompressionStream, Response, Uint8Array, DataView, ArrayBuffer,
  btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"), crypto: require("crypto").webcrypto, structuredClone,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.window.storage = { get: async (k) => { const v = storageFalso.getItem(k); return v === null ? null : { value: v }; }, set: async (k, v) => storageFalso.setItem(k, v), delete: async (k) => storageFalso.removeItem(k) };
vm.createContext(sandbox);
try {
  vm.runInContext(js, sandbox, { filename: "agrocr-app.js" });
} catch (e) {
  console.error("✗ O app não carregou na sala de teste: " + (e && e.stack || e));
  process.exit(2);
}
const C = sandbox.__contas;
for (const n of EXPORTAR) if (C[n] === undefined) { console.error("✗ Função de conta sumiu do app: " + n); process.exit(2); }

// ---------- utilitários do teste ----------
let ok = 0, falhas = [];
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function teste(nome, fn) {
  try { const r = fn(); if (r === false) throw new Error("condição falsa"); ok++; }
  catch (e) { falhas.push(nome + " → " + (e && e.message || e)); }
}
const igual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "") + " esperado " + JSON.stringify(b) + ", veio " + JSON.stringify(a)); return true; };
const aprox = (a, b, msg) => { if (!perto(a, b, 1e-6)) throw new Error((msg || "") + " esperado " + b + ", veio " + a); return true; };
const dia = (base, n) => C.somarDias(base, n);
const HOJE = "2026-09-10";

// ---------- unidades e totais ----------
teste("normalizar mL→L", () => igual(C.normalizar(500, "mL"), { v: 0.5, base: "L" }));
teste("normalizar g→kg", () => igual(C.normalizar(250, "g"), { v: 0.25, base: "kg" }));
teste("normalizar t→kg", () => igual(C.normalizar(2, "t"), { v: 2000, base: "kg" }));
teste("normalizar bag fica bag", () => igual(C.normalizar(3, "bag"), { v: 3, base: "bag" }));
teste("totalProduto 500 mL/ha × 100 ha = 50 L", () => igual(C.totalProduto(500, "mL", 100), { v: 50, un: "L" }));
teste("totalProduto 0,3 L/ha × 10 ha = 3 L", () => aprox(C.totalProduto("0,3", "L", 10).v, 3));
teste("totalProduto 20 g/ha × 10 ha fica em g", () => igual(C.totalProduto(20, "g", 10), { v: 200, un: "g" }));
teste("unidadesDaBase", () => igual(C.unidadesDaBase("L"), ["L", "mL"]) && igual(C.unidadesDaBase("kg"), ["kg", "g"]) && igual(C.unidadesDaBase("bag"), ["bag"]));
teste("num aceita vírgula", () => aprox(C.num("1,5"), 1.5) && C.num("abc") === 0);

// ---------- estoque: comprado − usado ± ajuste ----------
const fazenda = { id: "fz", nome: "Teste", talhoes: [{ id: "t1", nome: "T1", areaHa: 100, cultura: "Soja" }, { id: "t2", nome: "T2", areaHa: 50, cultura: "Soja" }] };
const prog = [{ id: "p1", produto: "Fox Xpro", qtd: 100, unidade: "L", ciclo: "Safra", categoria: "Fungicida" }, { id: "p2", produto: "Engeo", qtd: 20000, unidade: "mL", ciclo: "Safra" }];
const apls = [
  { id: "a1", modulo: "pulverizacao", tipo: "Fungicida", talhaoIds: ["t1", "t2"], produtos: [{ nome: "Fox Xpro", dose: 500, unidade: "mL" }], execucoes: { t1: { data: "2026-08-23" } } },
  { id: "a2", modulo: "pulverizacao", tipo: "Inseticida", talhaoIds: ["t2"], produtos: [{ nome: "Engeo", dose: 0.2, unidade: "L" }], execucoes: { t2: { data: "2026-09-01" } } },
];
const ajustes = [{ id: "j1", produto: "Fox Xpro", delta: -5, base: "L", ciclo: "Safra" }];
const estoque = C.calcularEstoqueDe(fazenda, prog, apls, ajustes, []);
const linhaFox = estoque.find((l) => C.chaveProduto(l.produto) === "fox xpro");
const linhaEngeo = estoque.find((l) => C.chaveProduto(l.produto) === "engeo");
teste("estoque Fox: comprado 100 L", () => aprox(linhaFox.comprado, 100));
teste("estoque Fox: usado 500 mL × 100 ha = 50 L (só o talhão executado)", () => aprox(linhaFox.usado, 50));
teste("estoque Fox: ajuste −5 L → saldo 45", () => aprox(linhaFox.comprado - linhaFox.usado + linhaFox.ajuste, 45));
teste("estoque Engeo: 20.000 mL vira 20 L, usou 0,2 × 50 = 10 L", () => aprox(linhaEngeo.comprado, 20) && aprox(linhaEngeo.usado, 10));

// ---------- datas ----------
teste("diasEntreISO 30 dias", () => C.diasEntreISO("2026-01-01", "2026-01-31") === 30);
teste("diasEntreISO negativo", () => C.diasEntreISO("2026-09-10", "2026-09-07") === -3);
teste("somarMeses: 31/01 + 1 = 28/02; + 12 = 31/01 do ano seguinte", () => C.somarMeses("2026-01-31", 1) === "2026-02-28" && C.somarMeses("2026-01-31", 12) === "2027-01-31" && C.somarMeses("2026-11-15", 3) === "2027-02-15");
teste("somarDias vira o mês", () => C.somarDias("2026-02-27", 2) === "2026-03-01");

// ---------- fungicidas: 1ª aos 25 DAE, depois a cada 15 dias ----------
teste("constantes do programa de fungicida", () => C.FUNG_PRIMEIRA_DAE === 25 && C.FUNG_INTERVALO === 15 && C.FUNG_FIM_DAE === 130);
const fzF = { id: "fz", talhoes: [{ id: "t1", nome: "T1", areaHa: 100 }, { id: "t2", nome: "T2", areaHa: 80 }, { id: "t3", nome: "T3", areaHa: 50 }, { id: "t4", nome: "T4", areaHa: 30 }] };
const lavF = [
  { talhaoId: "t1", cultura: "Soja", dataEmergencia: dia(HOJE, -35) },   // fungicida feita há 18 dias → venceu há 3
  { talhaoId: "t2", cultura: "Soja", dataEmergencia: dia(HOJE, -24) },   // nenhuma feita → 1ª aos 25 DAE = amanhã
  { talhaoId: "t3", cultura: "Milho", dataEmergencia: dia(HOJE, -140) }, // passou dos 130 DAE → encerrado
  { talhaoId: "t4", cultura: "Soja", dataEmergencia: dia(HOJE, -5) },    // 1ª só daqui a 20 dias → ok
];
const aplF = [{ id: "f1", modulo: "pulverizacao", tipo: "Fungicida", talhaoIds: ["t1"], produtos: [{ nome: "Fox Xpro" }], execucoes: { t1: { data: dia(HOJE, -18) } } },
  { id: "f2", modulo: "pulverizacao", tipo: "Inseticida", talhaoIds: ["t2"], produtos: [{ nome: "Engeo" }], execucoes: { t2: { data: dia(HOJE, -2) } } }];
const rf = C.resumoFungicidas(fzF, aplF, lavF, HOJE);
const porT = Object.fromEntries(rf.map((x) => [x.t.id, x]));
teste("fungicida T1: última há 18 dias, próxima venceu há 3", () => porT.t1.status === "vencida" && porT.t1.diasDesde === 18 && porT.t1.diasPara === -3 && porT.t1.feitas.length === 1);
teste("fungicida T2: sem aplicação, 1ª amanhã (25 DAE)", () => porT.t2.status === "proxima" && porT.t2.diasPara === 1 && porT.t2.ultima === null);
teste("fungicida T2: inseticida não conta como fungicida", () => porT.t2.feitas.length === 0);
teste("fungicida T3: 140 DAE encerrado", () => porT.t3.status === "fim" && porT.t3.encerrado === true);
teste("fungicida T4: 5 DAE, 1ª em 20 dias, ok", () => porT.t4.status === "ok" && porT.t4.diasPara === 20);
teste("fungicida: ordem pela urgência (vencida primeiro, encerrado por último)", () => rf[0].t.id === "t1" && rf[rf.length - 1].t.id === "t3");

// ---------- programa de compra → necessidade ----------
const fzP = { id: "fz", talhoes: [{ id: "t1", nome: "T1", areaHa: 100, cultura: "Soja" }, { id: "t2", nome: "T2", areaHa: 50, cultura: "Soja" }, { id: "t3", nome: "T3", areaHa: 40, cultura: "Milho" }] };
const programas = {
  "agrocr:programa:fz:Soja": [
    { modulo: "semeadura", ref: "dae", dias: 0, tipo: "Semeadura", populacao: 220000, produtos: [{ nome: "M8808", uso: "semente", unidade: "bag" }] },
    { modulo: "pulverizacao", ref: "dae", dias: 25, tipo: "Fungicida", produtos: [{ nome: "Fox Xpro", dose: 0.5, unidade: "L" }] },
    { modulo: "pulverizacao", ref: "dae", dias: 40, tipo: "Fungicida", produtos: [{ nome: "Fox Xpro", dose: 500, unidade: "mL" }] },
  ],
  "agrocr:programa-op:fz:Milho": [{ modulo: "pulverizacao", ref: "dae", dias: 20, tipo: "Herbicida", produtos: [{ nome: "Atrazina", dose: 2, unidade: "L" }] }],
};
const estoqueP = [{ produto: "Fox Xpro", ciclo: "Safra", comprado: 100, usado: 20, ajuste: 0 }];
const nec = C.necessidadeProgramaCompra(fzP, estoqueP, [], programas);
const itemFox = nec.itens.find((i) => C.chaveProduto(i.nome) === "fox xpro");
const itemSem = nec.itens.find((i) => C.chaveProduto(i.nome) === "m8808");
const itemAtr = nec.itens.find((i) => C.chaveProduto(i.nome) === "atrazina");
teste("necessidade Fox: (0,5 + 0,5) L/ha × 150 ha = 150 L, unidade L", () => aprox(itemFox.total, 150) && itemFox.base === "L");
teste("necessidade Fox: em estoque 80 → falta 70", () => aprox(itemFox.falta, 70));
teste("necessidade semente: 220 mil/ha × 150 ha ÷ 5 milhões = 6,6 bag", () => aprox(itemSem.total, 220000 * 150 / C.SEMENTES_POR_BAG) && itemSem.base === "bag");
teste("necessidade Milho cai no operacional quando a compra não tem dose", () => aprox(itemAtr.total, 80) && nec.usouOperacional.includes("Milho"));
teste("talhões com programa = 3", () => nec.talhoesComPrograma === 3);
{
  // consumo por talhão: T1 e T2 pelo programa da cultura (Soja), T3 pelo operacional (Milho); T2 com programa próprio manda no T2
  const cons = C.consumoPorTalhao(fzP, programas);
  const t1 = cons.find((u) => u.talhaoId === "t1"), t2 = cons.find((u) => u.talhaoId === "t2"), t3 = cons.find((u) => u.talhaoId === "t3");
  teste("consumoPorTalhao: T1 100 ha × 1 L/ha Fox = 100 L, origem programa da cultura", () => t1.origem === "cultura" && aprox(t1.produtos.find((x) => x.nome === "Fox Xpro").qtd, 100));
  teste("consumoPorTalhao: T3 usa o programa prévio da cultura (Milho) → 80 L de Atrazina", () => t3.origem === "opCultura" && aprox(t3.produtos[0].qtd, 80));
  teste("consumoPorTalhao: soma dos talhões = necessidade da fazenda (Fox 150 L)", () => aprox(t1.produtos.find((x) => x.nome === "Fox Xpro").qtd + t2.produtos.find((x) => x.nome === "Fox Xpro").qtd, itemFox.total));
  const cons2 = C.consumoPorTalhao(fzP, { ...programas, "agrocr:programa:fz:Soja:t2": [{ modulo: "pulverizacao", ref: "dae", dias: 25, tipo: "Fungicida", produtos: [{ nome: "Fox Xpro", dose: 2, unidade: "L" }] }] });
  const t2b = cons2.find((u) => u.talhaoId === "t2");
  teste("consumoPorTalhao: programa próprio do T2 vale mais que o da cultura (50 ha × 2 L = 100 L)", () => t2b.origem === "talhao" && aprox(t2b.produtos[0].qtd, 100));
  const semP = C.consumoPorTalhao({ id: "fz", talhoes: [{ id: "x", nome: "X", areaHa: 10, cultura: "Feijão" }] }, programas);
  teste("consumoPorTalhao: talhão sem programa fica marcado (passos null)", () => semP.length === 1 && semP[0].passos === null && semP[0].produtos.length === 0);
}

// ---------- monitoramento: pontos e quadro de pragas ----------
// quadrado de ~1 km de lado perto de Peixe-TO (lng, lat)
const anel = [[-48.55, -12.02], [-48.54, -12.02], [-48.54, -12.01], [-48.55, -12.01], [-48.55, -12.02]];
const pontos = C.distribuirPontos(anel, 10);
teste("distribuirPontos: 10 pontos numerados dentro do talhão", () => pontos.length === 10 && pontos.every((p, i) => p.n === i + 1 && C.pontoNoAnel(p.lng, p.lat, anel)));
teste("distribuirPontos: talhão inválido devolve vazio", () => C.distribuirPontos([[0, 0]], 5).length === 0);
teste("distanciaM: 1 grau de latitude ≈ 111 km", () => perto(C.distanciaM(0, 0, 1, 0), 111195, 200));
teste("rumoTexto norte/leste", () => C.rumoTexto(-12, -48, -11, -48) === "norte" && C.rumoTexto(-12, -48, -12, -47) === "leste");
const mon = { metodo: "pano", pragas: ["Lagarta", "Percevejo"], pontos: [{ pragas: { Lagarta: 2, Percevejo: 0 } }, { pragas: { Lagarta: 4, Percevejo: "1" } }, { pragas: { Lagarta: 0 } }, { pragas: {} }] };
const q = Object.fromEntries(C.quadroPragas(mon).map((x) => [x.chave, x]));
teste("quadroPragas pano: média por metro e % de pontos", () => aprox(q.Lagarta.media, 1.5) && aprox(q.Lagarta.pct, 50) && q.Lagarta.max === 4 && aprox(q.Percevejo.pct, 25));
const monP = { metodo: "presenca", pragas: ["Pulgão"], pontos: [{ pragas: { "Pulgão": true } }, { pragas: { "Pulgão": false } }, { pragas: {} }] };
teste("quadroPragas presença: 1 de 3 pontos = 33%", () => perto(C.quadroPragas(monP)[0].pct, 33.333, 0.01));
teste("achouValor", () => C.achouValor(true) && C.achouValor(3) && C.achouValor("ponteiro") && !C.achouValor(0) && !C.achouValor("") && !C.achouValor(false) && !C.achouValor("0"));
teste("intervalo de monitoramento: algodão 7, soja/milho 10", () => C.intervaloMonitoramento("Algodão") === 7 && C.intervaloMonitoramento("Soja") === 10 && C.intervaloMonitoramento("Milho") === 10 && C.intervaloMonitoramento("") === 10);
teste("regraFungicida: padrão da soja 25/15/130, algodão 30/14/180, ajuste da fazenda vence", () => { const r = C.regraFungicida({}, "Soja"), a = C.regraFungicida({}, "Algodão"), p = C.regraFungicida({ fungicidas: { Soja: { intervalo: 12 } } }, "Soja"); return r.primeira === 25 && r.intervalo === 15 && r.fim === 130 && a.primeira === 30 && a.intervalo === 14 && p.intervalo === 12 && p.primeira === 25; });
teste("resumoFungicidas usa o programa da cultura (algodão 30 DAE)", () => { const r = C.resumoFungicidas({ id: "f", talhoes: [{ id: "t", nome: "T", areaHa: 10 }] }, [], [{ talhaoId: "t", cultura: "Algodão", dataEmergencia: dia(HOJE, -28) }], HOJE); return r.length === 1 && r[0].diasPara === 2 && r[0].regra.intervalo === 14; });
teste("nivelDe: soja percevejo 2/m por padrão; fazenda pode mudar; sem nível = null", () => C.nivelDe({}, "Soja", "Percevejo-marrom (adulto)") === 2 && C.nivelDe({ niveis: { Soja: { "Percevejo-marrom (adulto)": 1 } } }, "Soja", "Percevejo-marrom (adulto)") === 1 && C.nivelDe({}, "Milho", "Pulgão") === null);
teste("pragasAcima: pano 2,5 percevejos/m passa do nível 2; lagarta 5/m não passa de 20", () => { const a = C.pragasAcima({}, { cultura: "Soja", metodo: "pano", pragas: ["Percevejo-marrom (adulto)", "Lagarta-da-soja"], pontos: [{ pragas: { "Percevejo-marrom (adulto)": 3, "Lagarta-da-soja": 5 } }, { pragas: { "Percevejo-marrom (adulto)": 2, "Lagarta-da-soja": 5 } }] }); return a.length === 1 && a[0].nome === "Percevejo-marrom (adulto)" && perto(a[0].valor, 2.5) && a[0].unidade === "/m"; });
{
  const fx = C.fluxoDeCaixa({ hoje: "2026-09-11",
    custos: [{ id: 1, ehVenda: true, cultura: "Soja", descricao: "Coop", sacas: 1000, preco: 120, moeda: "R$", data: "2026-08-01", vencimento: "2026-10-05" },
      { id: 2, descricao: "Prestação (1/2)", categoria: "Máquinas", valor: 5000, pago: false, vencimento: "2026-09-15", data: "2026-09-11" },
      { id: 3, descricao: "Prestação (2/2)", categoria: "Máquinas", valor: 5000, pago: false, vencimento: "2026-10-15", data: "2026-09-11" },
      { id: 4, descricao: "Diesel", categoria: "Combustível", valor: 800, data: "2026-09-02" },
      { id: 5, descricao: "Da nota", categoria: "Insumos", valor: 999, data: "2026-09-02", notaId: "n1" },
      { id: 6, ehBarter: true, sacas: 100 }],
    notas: [{ id: "n1", emitente: "Revenda", numero: "1", valorTotal: 3000, vencimento: "2026-09-20", pago: false }],
    prog: [{ id: "p1", produto: "Fox", qtd: 10, unidade: "L", preco: 100, data: "2026-08-10", vencimento: "2026-11-10" }] });
  const m = Object.fromEntries(fx.meses.map((x) => [x.mes, x]));
  teste("fluxo de caixa: setembro sai 5000 + 800 + 3000 (custo da nota não repete)", () => aprox(m["2026-09"].saidas, 8800) && aprox(m["2026-09"].entradas, 0));
  teste("fluxo de caixa: outubro entra 120.000 da venda e sai 5000; acumulado", () => aprox(m["2026-10"].entradas, 120000) && aprox(m["2026-10"].saidas, 5000) && aprox(m["2026-10"].acumulado, 120000 - 8800 - 5000));
  teste("fluxo de caixa: compra a prazo cai em novembro; barter fica fora", () => aprox(m["2026-11"].saidas, 1000) && fx.meses.length === 3);
  const ofx = C.lerOFX("<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260916120000[-3:BRT]<TRNAMT>-5000.00<FITID>abc1<MEMO>PAGTO BOLETO TRATOR</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260917<TRNAMT>1500,50<FITID>abc2<MEMO>PIX RECEBIDO</STMTTRN></OFX>");
  teste("lerOFX: 2 lançamentos, data e valor com vírgula", () => ofx.length === 2 && ofx[0].data === "2026-09-16" && ofx[0].valor === -5000 && ofx[1].valor === 1500.5 && ofx[0].memo === "PAGTO BOLETO TRATOR");
  const casado = C.casarExtrato(ofx, [{ id: "c2", valor: 5000, vencimento: "2026-09-15" }, { id: "c9", valor: 5000, vencimento: "2026-12-15" }]);
  teste("casarExtrato: débito de 5000 em 16/09 casa com a conta que vence 15/09 (não com a de dezembro)", () => casado.length === 1 && casado[0].conta && casado[0].conta.id === "c2");
}
teste("areaLavoura: pastagem e talhão sem cultura ficam fora (Varjão: 600 de 903 ha)", () => { const fz = { talhoes: [{ id: "a", areaHa: 600, cultura: "Soja" }, { id: "b", areaHa: 303, cultura: "Pastagem" }, { id: "c", areaHa: 50 }] }; return C.areaLavoura(fz, "Safra") === 600 && C.talhoesLavoura(fz, "Safra").length === 1 && C.areaLavoura(fz, "Safrinha") === 0; });
teste("ficha do algodão tem itens; soja cai no pano", () => C.fichaDe("Algodão", "presenca").length > 5 && C.fichaDe("Soja", "pano").filter((i) => !i.doenca).every((i) => i.tipo === "numero") && C.fichaDe("Soja", "pano").some((i) => i.doenca));

// ---------- NF-e: dígito verificador e XML ----------
try {
  const nfe = require(path.join(raiz, "funcoes", "nfe.js"));
  const mod11 = (c) => { let s = 0, p = 2; for (let i = c.length - 1; i >= 0; i--) { s += Number(c[i]) * p; p = p === 9 ? 2 : p + 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const c43 = "1720260931226672800000550010000001231000000123";
  teste("nfe dvMod11 bate com o cálculo independente", () => Number(nfe.dvMod11(c43.slice(0, 43))) === mod11(c43.slice(0, 43)));
  const x = nfe.montarNFe({ ambiente: "hom", uf: "TO", serie: 1, numero: 123, dhEmi: "2026-09-10T10:00:00-03:00", natOp: "Venda de produção", cfop: "5101",
    emit: { nome: "Produtor Teste", doc: "31226672825", ie: "294894438", lgr: "Fazenda", nro: "s/n", bairro: "Zona Rural", cMun: "1716505", xMun: "Peixe", uf: "TO", cep: "77460000", crt: "3" },
    dest: { nome: "Comprador", doc: "12345678000195", ie: "ISENTO", lgr: "Rua", nro: "1", bairro: "Centro", cMun: "5208707", xMun: "Goiânia", uf: "GO", cep: "74000000", indIEDest: "9" },
    itens: [{ descricao: "Milho em grãos", ncm: "10059010", cfop: "5101", unidade: "KG", qtd: 30000, valorUnit: 1.05 }],
    icms: { cst: "51", pRed: 100 }, pis: { cst: "08" }, cofins: { cst: "08" }, pag: { tPag: "15" }, transp: { modFrete: "9" } });
  const xml = typeof x === "string" ? x : (x && (x.xml || x.xmlNFe || x.XML)) || JSON.stringify(x);
  const chave = typeof x === "object" && x && x.chave ? x.chave : ((xml.match(/Id="NFe(\d{44})"/) || [])[1] || "");
  teste("nfe: chave com 44 dígitos e DV correto", () => chave.length === 44 && Number(chave[43]) === mod11(chave.slice(0, 43)));
  teste("nfe: XML traz ICMS51, PIS 08 e total 31.500", () => xml.includes("<ICMS51>") && xml.includes("<PISNT>") && xml.includes("<vNF>31500.00</vNF>"));
} catch (e) { falhas.push("nfe.js → " + (e && e.message || e)); }

// ---------- chuva: média entre pluviômetros, não soma ----------
{
  const L = [
    { data: "2026-08-01", mm: 20, pluviometroId: "a" }, { data: "2026-08-01", mm: 30, pluviometroId: "b" },
    { data: "2026-08-10", mm: 10, pluviometroId: "a" }, { data: "2026-08-10", mm: "12,5", pluviometroId: "b" },
  ];
  teste("mediaChuva: 2 pluviômetros (30 e 42,5) → média 36,25, não a soma 72,5", () => Math.abs(C.mediaChuva(L) - 36.25) < 1e-9);
  teste("mediaChuva: um pluviômetro só → soma dos lançamentos", () => C.mediaChuva(L.filter((c) => c.pluviometroId === "a")) === 30);
  teste("mediaChuva: sem pluviômetro cadastrado (só local) agrupa pelo nome", () => C.mediaChuva([{ mm: 10, local: "Sede" }, { mm: 20, local: "Sede" }, { mm: 40, local: "Retiro" }]) === 35);
  teste("mediaChuva: lista vazia → 0", () => C.mediaChuva([]) === 0 && C.mediaChuva(null) === 0);
}

// ---------- mapa de chuva: escala do mais seco ao mais molhado ----------
teste("corChuva: mais seco = palha, mais molhado = roxo, sem diferença = cor do meio", () =>
  C.corChuva(166, 166, 216) === "rgb(247,240,200)" && C.corChuva(216, 166, 216) === "rgb(96,32,128)" && C.corChuva(200, 200, 200) === "rgb(46,196,214)");
teste("corChuva: 166 e 216 mm ficam com cores bem diferentes (não quase o mesmo azul)", () => C.corChuva(166, 166, 216) !== C.corChuva(216, 166, 216) && C.corChuva(191, 166, 216) === "rgb(46,196,214)");

// ---------- veranico: o período seco em curso também conta ----------
{
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const L = [{ data: d(20), mm: 10 }, { data: d(14), mm: 8 }, { data: d(11), mm: 12 }];   // 5 dias secos fechados; 11 dias sem chuva até hoje
  const r = C.analisarSecas(L);
  teste("analisarSecas: 11 dias sem chuva hoje > 5 dias fechados → maior veranico 11 (em curso)", () => r.atual >= 10 && r.maior === r.atual && r.emCurso === true && r.intervalos.length === 1 && r.intervalos[0].dias === 5);
  const r2 = C.analisarSecas([{ data: d(14), mm: 10 }, { data: d(4), mm: 8 }, { data: d(2), mm: 12 }]);
  teste("analisarSecas: choveu há 2 dias → maior veranico é o fechado (9), não em curso", () => r2.atual <= 2 && r2.maior === 9 && r2.emCurso === false);
}

// ---------- fotos no campo ----------
teste("bytesFotos: conta o TEXTO da foto (é o que a nuvem guarda) e lista vazia dá 0", () => C.bytesFotos(["a".repeat(4000), "b".repeat(1000)]) === 5000 && C.bytesFotos([]) === 0 && C.bytesFotos(null) === 0);
teste("LIMITE_FOTOS_DOC fica abaixo do 1 MB do documento da nuvem", () => C.LIMITE_FOTOS_DOC < 1024 * 1024 && C.LIMITE_FOTOS_DOC >= 500 * 1024);
teste("fotosDaObs: observação antiga (img) e nova (fotos) dão a mesma lista", () => JSON.stringify(C.fotosDaObs({ img: "x" })) === '["x"]' && JSON.stringify(C.fotosDaObs({ img: "x", fotos: ["a", "b"] })) === '["a","b"]' && C.fotosDaObs({}).length === 0);

// ---------- fertilidade do solo ----------
teste("tendenciaSolo: fósforo subiu de 8 para 12 = ↑ 50%, melhora", () => { const r = C.tendenciaSolo("p", 12, 8); return r.seta === "↑" && Math.round(r.pct) === 50 && r.melhora === true; });
teste("tendenciaSolo: alumínio caiu de 4 para 2 = ↓, melhora; pH não tem lado; sem valor anterior dá null", () => { const a = C.tendenciaSolo("al", 2, 4), p = C.tendenciaSolo("ph", 5.6, 5.1); return a.seta === "↓" && a.melhora === true && p.melhora === null && C.tendenciaSolo("k", 3, null) === null; });

teste("pontosDoGrid: 200 ha com grid de 20 ha = 10 pontos; 15 ha com grid 10 = 2; sem grid = 0", () => C.pontosDoGrid(200, 20) === 10 && C.pontosDoGrid(15, 10) === 2 && C.pontosDoGrid(50, 0) === 0);

teste("mediaPontos: média por atributo ignorando vazios", () => { const m = C.mediaPontos([{ valores: { p: 10, k: 2 } }, { valores: { p: 14, k: "" } }, { valores: { p: null, k: 4 } }]); return m.p === 12 && m.k === 3; });

teste("nutrientesPorHa: soja a 3,6 t/ha exporta 183,6 kg N e 72 kg K2O; toda cultura tem exportação ≤ extração", () => { const r = C.nutrientesPorHa("Soja", 3.6); const n = r.linhas.find((l) => l.nutriente === "N"), k = r.linhas.find((l) => l.nutriente === "K2O"); const ok = Object.values(C.NUTRIENTES_CULTURA).every((c) => Object.keys(c.extracao).every((x) => c.exportacao[x] <= c.extracao[x])); return n.exportacaoHa === 183.6 && k.exportacaoHa === 72 && ok && C.nutrientesPorHa("Soja", 0) === null; });

teste("planilha de solo: casa talhão e ponto, lê vírgula decimal, unidade do cabeçalho e posição do grid", () => {
  const talhoes = [{ id: "t1", nome: "01" }, { id: "t2", nome: "02" }];
  const coletas = [{ talhaoId: "t1", pontos: [{ n: 1, lat: -11.7, lng: -49.1 }, { n: 2, lat: -11.71, lng: -49.1 }, { n: 3, lat: -11.72, lng: -49.1 }] }];
  const achar = (nome) => (talhoes.find((t) => t.nome === String(nome).trim()) || {}).id || null;
  const linhas = [["Talhão", "Ponto", "Latitude", "Longitude", "pH", "M.O. (g/dm³)", "P (mg/dm³)", "K", "Mg", "m (%)"],
    ["01", "1", "", "", "5,2", "21", "8,5", "1,2", "6", "12"], ["01", "2", "", "", "4,9", "19", "6", "1,0", "5", "20"], ["01", "3", "", "", "5,5", "23", "11", "1,5", "7", "5"],
    ["02", "1", "-11,73", "-49,09", "5,0", "18", "7", "1,1", "4", "15"], ["99", "1", "", "", "5,0", "18", "7", "1", "4", "1"]];
  const r = C.interpretarPlanilhaSolo(linhas, talhoes, coletas, achar, null);
  const g1 = r.grupos.find((g) => g.talhaoId === "t1"), g2 = r.grupos.find((g) => g.talhaoId === "t2");
  return r.grupos.length === 2 && g1.pontos.length === 3 && g1.comPosicao === 3 && g1.pontos[0].valores.ph === 5.2 && g1.pontos[0].valores.mo === 21 && g1.pontos[0].valores.p === 8.5 && g1.pontos[0].valores.m === 12 && g1.pontos[0].valores.mg === 6
    && g1.unidades.mo === "g/dm³" && g2.pontos[0].lat === -11.73 && g2.comPosicao === 1 && r.avisos.some((a) => /sem talhão/.test(a))
    && C.colunaSolo("H+Al (mmolc/dm³)").chave === "hAl" && C.colunaSolo("Mn").chave === "mn" && C.colunaSolo("V (%)").chave === "v" && C.colunaSolo("CTC").chave === "ctc";
});

teste("extração e exportação: toda cultura tem referência bibliográfica", () => Object.values(C.NUTRIENTES_CULTURA).every((c) => Array.isArray(c.fontes) && c.fontes.length >= 2));

teste("resumoFinanceiroSemana: separa vencidas, semana e vendas a receber; ignora pagas e barter", () => {
  const notas = [{ emitente: "A", vencimento: "2026-09-10", valorTotal: 100 }, { emitente: "B", vencimento: "2026-09-18", valorTotal: 50 }, { emitente: "C", vencimento: "2026-09-18", valorTotal: 70, pago: true }, { emitente: "D", vencimento: "2026-10-30", valorTotal: 9 }];
  const custos = [{ descricao: "Frete", pago: false, vencimento: "2026-09-20", valor: 30 }, { descricao: "Barter", pago: false, ehBarter: true, vencimento: "2026-09-17", valor: 999 }, { ehVenda: true, cultura: "Soja", descricao: "Cargill", vencimento: "2026-10-01", sacas: 1000, preco: 120 }];
  const r = C.resumoFinanceiroSemana(notas, custos, "2026-09-16", 7);
  return r.totalVencidas === 100 && r.totalSemana === 80 && r.semana.length === 2 && r.receber.length === 1 && r.receber[0].sacas === 1000;
});

teste("mapeamento: satélite ida e volta, KML gerado lê de volta com o mesmo nome e a mesma área", () => {
  const [x, y] = C.paraMundo(-49.1, -11.7, 17); const [lng, lat] = C.deMundo(x, y, 17);
  const anel = [[-49.1, -11.7], [-49.09, -11.7], [-49.09, -11.71], [-49.1, -11.71]];
  const area = C.areaPoligonoHa([anel]);
  const texto = C.gerarKml("Fazenda & Cia", [{ nome: "01 <sede>", aneis: [anel], areaHa: area }]);
  if (typeof DOMParser === "undefined") return Math.abs(lng + 49.1) < 1e-9 && Math.abs(lat + 11.7) < 1e-9 && /<Placemark>/.test(texto) && /01 &lt;sede&gt;/.test(texto) && area > 100 && area < 130;
  const lido = C.lerKML(texto);
  return Math.abs(lng + 49.1) < 1e-9 && Math.abs(lat + 11.7) < 1e-9 && lido.poligonos.length === 1 && Math.abs(lido.poligonos[0].areaHa - area) < 0.01;
});

teste("extração: micros de toda cultura com extração e exportação (exportação ≤ extração); soja 3,6 t exporta 144 g de Zn/ha", () => {
  const ok = Object.values(C.NUTRIENTES_CULTURA).every((c) => c.micros && ["B", "Cu", "Fe", "Mn", "Zn"].every((k) => c.micros.extracao[k] > 0 && c.micros.exportacao[k] <= c.micros.extracao[k]));
  const zn = C.nutrientesPorHa("Soja", 3.6).micros.find((m) => m.nutriente === "Zn");
  return ok && zn.exportacaoHa === 144 && zn.extracaoHa === 219.6;
});

teste("almoxarifado: saldo = entradas − retiradas ± ajuste, custo médio ponderado, mínimo e consumo por máquina", () => {
  const movs = [
    { id: "1", tipo: "entrada", nome: "Filtro de óleo RE504836", unidade: "un", qtd: 4, valorUnit: 100, data: "2026-09-01" },
    { id: "2", tipo: "entrada", nome: "filtro de oleo re504836", unidade: "un", qtd: 6, valorUnit: 150, data: "2026-09-05" },
    { id: "3", tipo: "saida", nome: "Filtro de óleo RE504836", unidade: "un", qtd: 3, maquinaId: "m1", data: "2026-09-06" },
    { id: "4", tipo: "ajuste", nome: "Filtro de óleo RE504836", unidade: "un", qtd: -1, data: "2026-09-07" },
    { id: "5", tipo: "entrada", nome: "Óleo 15W40", unidade: "L", qtd: 200, valorUnit: 20, data: "2026-09-01" },
    { id: "6", tipo: "saida", nome: "Óleo 15W40", unidade: "L", qtd: 20, maquinaId: "m1", data: "2026-09-06" },
    { id: "7", tipo: "saida", nome: "Óleo 15W40", unidade: "L", qtd: 10, maquinaId: "m2", data: "2026-09-06" },
    { tipo: "minimo", chave: "filtro de oleo re504836|un", minimo: 6 },
  ];
  const e = C.estoqueAlmoxarifado(movs);
  const f = e.find((x) => x.unidade === "un"), o = e.find((x) => x.unidade === "L");
  const maq = C.consumoAlmoxPorMaquina(movs);
  return e.length === 2 && f.saldo === 6 && f.custoMedio === 130 && f.abaixo === true && o.saldo === 170 && o.categoria === "Óleos e lubrificantes"
    && maq[0].maquinaId === "m1" && maq[0].valor === 3 * 130 + 20 * 20 && maq[1].valor === 200
    && C.categoriaAlmoxDe("Filtro de ar") === "Filtros" && C.destinoSugerido("FILTRO COMBUSTIVEL", null) === C.DESTINO_ALMOX && C.destinoSugerido("Serviço de manutenção", null) !== C.DESTINO_ALMOX;
});

teste("solo: profundidade normalizada e planilha separa 0-20 de 20-40; fósforo resina e Mehlich em colunas próprias", () => {
  const pk = C.profundidadeChave;
  const talhoes = [{ id: "t1", nome: "01" }];
  const achar = (nome) => (talhoes.find((t) => t.nome === String(nome).trim()) || {}).id || null;
  const linhas = [["Talhão", "Ponto", "Latitude", "Longitude", "Profundidade", "pH", "P resina (mg/dm³)", "P Mehlich (mg/dm³)", "P (resina)", "m (%)", "Mg"],
    ["01", "1", "-11,70", "-49,10", "0-20", "5,2", "18", "9", "", "10", "6"], ["01", "2", "-11,71", "-49,10", "0 a 20 cm", "5,0", "14", "7", "", "12", "5"],
    ["01", "1", "-11,70", "-49,10", "20-40", "4,8", "6", "3", "", "25", "3"]];
  const r = C.interpretarPlanilhaSolo(linhas, talhoes, [], achar, null);
  const g020 = r.grupos.find((g) => g.profundidade === "0-20"), g2040 = r.grupos.find((g) => g.profundidade === "20-40");
  return pk("0 a 20 cm") === "0-20" && pk("00-20") === "0-20" && pk("20–40") === "20-40" && pk("") === "" && r.grupos.length === 2 && g020.pontos.length === 2 && g2040.pontos.length === 1
    && g020.pontos[0].valores.pRes === 18 && g020.pontos[0].valores.pMeh === 9 && g020.pontos[0].valores.m === 10 && g020.pontos[0].valores.mg === 6
    && C.colunaSolo("P (resina)").chave === "pRes" && C.colunaSolo("P (Mehlich)").chave === "pMeh" && C.colunaSolo("Fósforo Mehlich").chave === "pMeh" && C.colunaSolo("P").chave === "p" && C.colunaSolo("Mehlich").chave === "pMeh" && C.colunaSolo("MO").chave === "mo";
});

teste("almoxarifado: custo na retirada (nota nova), nunca em entrada antiga já custeada; caixa ignora consumo; acha peça pela foto e lê planilha", () => {
  const movs = [{ tipo: "entrada", nome: "Filtro RE504836", unidade: "un", qtd: 4, valorUnit: 120, origem: "nota", custoNaRetirada: true, data: "2026-09-01" },
    { tipo: "entrada", nome: "Correia B-52", unidade: "un", qtd: 2, valorUnit: 80, origem: "nota", data: "2026-09-01" }];
  const c1 = C.custoDaRetirada(movs, { nome: "filtro re504836", unidade: "un", qtd: 2 });
  const c2 = C.custoDaRetirada(movs, { nome: "Correia B-52", unidade: "un", qtd: 1 });
  const caixa = C.fluxoDeCaixa({ custos: [{ id: "a", descricao: "x", valor: 240, data: "2026-09-10", pago: true, ehConsumoAlmox: true }], prog: [], notas: [], hoje: "2026-09-16" });
  const est = [{ chave: "a", nome: "Filtro de óleo motor", codigo: "RE504836" }, { chave: "b", nome: "Óleo 15W40 Lubrax", codigo: "" }];
  const plan = C.interpretarPlanilhaAlmox([["Peça", "Qtd", "Unid.", "Valor unit.", "Código"], ["Filtro de ar", "3", "PC", "85,50", "AR1"], ["", "", "", "", ""]]);
  return c1 === 240 && c2 === 0 && caixa.meses.length === 0 && C.acharPecaAlmox(est, "FILTRO OLEO", "re-504836").chave === "a" && C.acharPecaAlmox(est, "oleo 15w40 lubrax", null).chave === "b" && C.acharPecaAlmox(est, "pneu dianteiro", null) === null
    && plan.length === 1 && plan[0].qtd === "3" && plan[0].unidade === "un" && plan[0].valorUnit === "85.5" && plan[0].codigo === "AR1";
});

teste("pulverização: umidade < 50% ou temperatura > 32 °C = parar; vento > 10 km/h = atenção; ponto da fazenda pelo KML", () => {
  const c = C.condicaoPulverizacao;
  const p = C.pontoDaFazenda({}, { poligonos: [{ aneis: [[[-49, -11], [-48, -11], [-48, -12], [-49, -12]]] }] });
  return c({ temp: 28, umidade: 65, vento: 6 }).nivel === "ok" && c({ temp: 30, umidade: 45, vento: 5 }).nivel === "parar" && c({ temp: 33, umidade: 70, vento: 5 }).nivel === "parar"
    && c({ temp: 34, umidade: 40, vento: 12 }).motivos.length === 3 && c({ temp: 25, umidade: 60, vento: 14 }).nivel === "atencao" && c({ temp: 32, umidade: 50, vento: 10 }).nivel === "ok"
    && Math.abs(p.lat + 11.5) < 1e-9 && Math.abs(p.lng + 48.5) < 1e-9 && C.pontoDaFazenda({ pluviometros: [{ lat: -10, lng: -48 }] }, null).lat === -10;
});

teste("acessos: lista completa com chaves únicas; operador sem financeiro por padrão; marcação explícita vale; equipe só perde o que marcou Não pode", () => {
  const chaves = C.ITENS_ACESSO.map((i) => i[0]);
  const op = { funcao: "Operador" }, opLib = { funcao: "Operador", permissoes: { financeiro: true, solo: false } };
  const eq = { email: "x@y.com", permissoes: { solo: false } };
  return new Set(chaves).size === chaves.length && ["solo", "operacoes", "almoxarifado", "estoque", "lavoura", "financeiro", "recomendar"].every((k) => chaves.includes(k))
    && C.podeFazenda(op, "financeiro") === false && C.podeFazenda(op, "solo") === true && C.podeFazenda(opLib, "financeiro") === true && C.podeFazenda(opLib, "solo") === false
    && C.podePermissao(eq, "solo") === false && C.podePermissao(eq, "almoxarifado") === true;
});

teste("coordenada: null, vazio e texto não são posição (pluviômetro sem posição derrubava a Pluviometria)", () => C.coordOk(-10.2) && C.coordOk(0) && !C.coordOk(null) && !C.coordOk(undefined) && !C.coordOk("") && !C.coordOk(NaN) && !C.coordOk("abc") && !C.coordOk(true)
  && C.pontoDaFazenda({ pluviometros: [{ lat: null, lng: null }, { lat: -11, lng: -49 }] }, null).lat === -11 && C.pontoDaFazenda({ pluviometros: [{ lat: null, lng: null }] }, null) === null);

teste("regulagem de faixa: alvo por bandeja, vazão, sobreposição uniforme dá CV ~0 e dose certa; faixa larga demais piora o CV", () => {
  const pos = C.posicoesBandejas(11, 2);   // -10 a +10 m
  const tri = pos.map((x) => Math.max(0, 50 * (1 - Math.abs(x) / 10)));   // perfil triangular de 20 m
  const boa = C.distribuicaoFaixa(pos, tri, 10, "continuo"), ruim = C.distribuicaoFaixa(pos, tri, 16, "continuo"), alt = C.distribuicaoFaixa(pos, tri, 10, "alternado");
  const curva = C.curvaFaixas(pos, tri, "continuo", 0.25);
  return pos[0] === -10 && pos[10] === 10 && Math.abs(C.gramasPorBandeja(200, 0.25) - 5) < 1e-9 && Math.abs(C.vazaoLancoKgMin(200, 18, 10) - 60) < 1e-9
    && boa.cv < 3 && Math.abs(boa.media - 50) < 3 && ruim.cv > boa.cv + 5 && alt.cv < 3 && curva.length > 3 && curva.every((c) => c.dose >= 0)
    && Math.abs(C.mlPorBico(100, 6, 0.5, 60) - 500) < 1e-9 && Math.abs(C.gramasPorLinha(300, 0.5, 50) - 750) < 1e-9;
});

teste("3 tiros: bandejas da divisa para o centro, só na faixa do meio, e CV direto do que caiu nelas", () => {
  const p = C.posicoesNaFaixa(9, 18), q = C.posicoesNaFaixa(10, 18);   // 1ª e última NA DIVISA (±9 m), de fora para dentro
  const igual = C.cvDireto([5, 5, 5, 5]), varia = C.cvDireto([4, 6, 4, 6]);
  return p.length === 9 && p[0] === -9 && p[4] === 0 && p[8] === 9 && p[1] === -6.75 && q[0] === -9 && q[1] === -7 && q[9] === 9
    && igual.cv === 0 && igual.media === 5 && Math.abs(varia.media - 5) < 1e-9 && Math.abs(varia.cv - 23.094) < 0.01;
});

teste("plantadeira: a troca de engrenagem sugerida sai SÓ do conjunto cadastrado", () => {
  const eng = { motoras: [15, 18, 22, 26], movidas: [20, 24, 30] };
  const r = C.trocasPossiveis(eng, 18, 24, 240, 300);   // precisa de +25%: relação 0,75 → 0,9375
  const so = r.todas.every((c) => eng.motoras.includes(c.mo) && eng.movidas.includes(c.mv));
  return so && r.todas.length === 12 && r.soMotora.mo === 22 && r.soMotora.mv === 24 && Math.abs(r.soMotora.dose - 293.33) < 0.1
    && r.soMovida.mo === 18 && r.soMovida.mv === 20 && Math.abs(r.soMovida.dose - 288) < 1e-6
    && r.todas[0].erro <= r.soMotora.erro && C.trocasPossiveis(eng, "", 24, 240, 300).todas.length === 0;
});

teste("logística de descarga: dose × área por talhão, viagens, ha por carga e confronto com a compra", () => {
  const fz = { talhoes: [{ id: "t1", nome: "1", areaHa: 100 }, { id: "t2", nome: "2", areaHa: 50 }] };
  const apls = [
    { id: "a", modulo: "adubacao", ciclo: "Safra", tipo: "Calagem / gessagem", talhaoIds: ["t1", "t2"], produtos: [{ nome: "Calcário", dose: 2, unidade: "t" }], execucoes: { t2: { data: "x" } } },
    { id: "b", modulo: "pulverizacao", talhaoIds: ["t1"], produtos: [{ nome: "Glifosato", dose: 2, unidade: "L" }] },
  ];
  const est = [{ produto: "Calcário", ciclo: "Safra", base: "kg", comprado: 250000, entregue: 120000, usado: 0, ajuste: 0 }];
  const p = C.planoDescarga(fz, apls, est, 30, false), q = C.planoDescarga(fz, apls, est, 30, true);
  const c = p.produtos[0];
  return p.produtos.length === 1 && c.nome === "Calcário" && c.necessario === 200000 && c.linhas.length === 1 && c.linhas[0].viagens === 7
    && Math.abs(c.linhas[0].haPorCarga - 15) < 1e-9 && c.comprado === 250000 && c.faltaComprar === 0 && c.faltaEntregar === 80000 && c.viagens === 7
    && q.produtos[0].necessario === 300000 && q.produtos[0].pendente === 200000 && q.produtos[0].linhas.length === 2 && q.produtos[0].faltaComprar === 0
    && C.planoDescarga(fz, apls, [{ ...est[0], usado: 60000 }], 30, false).produtos[0].faltaComprar === 10000;
});

teste("lista de compras: comprado ÷ área da cultura (ou da fazenda) vira dose por hectare", () => {
  const tal = [{ id: "a", areaHa: 120, cultura: "Soja", culturaSafrinha: "Milho" }, { id: "b", areaHa: 80, cultura: "Soja" }, { id: "c", areaHa: 50, cultura: "Algodão" }];
  const r = C.doseDoComprado([{ produto: "Glifosato", qtd: 600, unidade: "L", ciclo: "Safra", cultura: "Soja" }, { produto: "MAP", qtd: 50, unidade: "t", ciclo: "Safra" }, { produto: "Ureia", qtd: 24, unidade: "t", ciclo: "Safrinha", cultura: "Milho" }, { produto: "Trigo X", qtd: 1, unidade: "t", ciclo: "Safra", cultura: "Trigo" }], tal);
  const g = r.find((x) => x.produto === "Glifosato"), m = r.find((x) => x.produto === "MAP"), u = r.find((x) => x.produto === "Ureia"), tr = r.find((x) => x.produto === "Trigo X");
  return Math.abs(g.porHa - 3) < 1e-9 && g.base === "L" && Math.abs(m.porHa - 200) < 1e-9 && m.base === "kg" && Math.abs(u.porHa - 200) < 1e-9 && tr.porHa === null;
});

teste("planejamento operacional: área × vezes × R$/ha, categoria por quem faz, real vinculado e execuções do campo", () => {
  const fz = { talhoes: [{ id: "t1", nome: "1", areaHa: 100 }, { id: "t2", nome: "2", areaHa: 50 }] };
  const linhas = [{ id: "L1", operacao: "Pulverização (defensivos)", execucao: "propria", areaHa: 150, vezes: 8, custoHa: 40 }, { id: "L2", operacao: "Subsolagem", execucao: "terceirizada", areaHa: 100, vezes: 1, custoHa: 350 }, { id: "L3", operacao: "Dessecação", execucao: "propria", areaHa: 150, vezes: 1, custoHa: 40 }];
  const custos = [{ id: "c1", categoria: "Serviços / terceiros", valor: 30000, planoOpId: "L2" }, { id: "c2", ehBarter: true, sacas: 100, precoSaca: 120, planoOpId: "L2" }, { id: "c3", valor: 999, planoOpId: "L9" }, { id: "p", ehPlano: true, operacional: linhas }];
  const apls = [{ id: "a", modulo: "pulverizacao", tipo: "Fungicida", talhaoIds: ["t1", "t2"], execucoes: { t1: { data: "x" } } }, { id: "b", modulo: "pulverizacao", tipo: "Dessecação", talhaoIds: ["t1", "t2"], execucoes: { t1: { data: "x" }, t2: { data: "x" } } }];
  const r = C.resumoPlanoOperacional(linhas, custos, apls, fz);
  const [p, sub, des] = r.linhas;
  return C.totalDaLinha(linhas[0]) === 48000 && C.categoriaDaOperacao(linhas[1]) === "Serviços / terceiros" && C.categoriaDaOperacao(linhas[0]) === "Operações com máquinas"
    && p.planejado === 48000 && p.execs === 1 && p.haFeito === 100 && p.haPlanejado === 1200 && p.realizado === 0
    && sub.planejado === 35000 && sub.realizado === 42000 && sub.nLanc === 2 && sub.temCampo === false
    && des.execs === 2 && des.haFeito === 150 && r.planejado === 89000 && r.realizado === 42000
    && r.porCategoria["Serviços / terceiros"] === 35000 && r.porCategoria["Operações com máquinas"] === 54000;
});

teste("planejamento operacional v2: área por %, por talhões, custo dividido safra/safrinha e real da fazenda por grupo", () => {
  const fz = { talhoes: [{ id: "t1", areaHa: 100 }, { id: "t2", areaHa: 50 }, { id: "t3", areaHa: 50 }] };
  const pct = { operacao: "Gradagem", execucao: "propria", areaModo: "pct", areaPct: 40, vezes: 1, custoHa: 100, ciclo: "Ambas", pctSafra: 60 };
  const tal = { operacao: "Subsolagem", execucao: "terceirizada", areaModo: "talhoes", talhaoIds: ["t1", "t3"], vezes: 1, custoHa: 300, ciclo: "Safrinha" };
  const custos = [{ id: "d", categoria: "Combustível", valor: 5000 }, { id: "m", categoria: "Mão de obra", valor: 3000 }, { id: "s", categoria: "Serviços / terceiros", valor: 20000 }, { id: "i", categoria: "Arrendamento", valor: 99999 }];
  const r = C.resumoPlanoOperacional([pct, tal], custos, [], fz);
  return C.areaDaLinha(pct, fz) === 80 && C.areaDaLinha(tal, fz) === 150 && C.parteCiclo(pct).Safra === 60 && C.parteCiclo(tal).Safrinha === 100 && C.parteCiclo({ ciclo: "Ambas" }).Safra === 50
    && r.linhas[0].planejado === 8000 && r.linhas[0].planejadoSafra === 4800 && r.linhas[0].planejadoSafrinha === 3200 && r.linhas[1].planejado === 45000
    && r.planejadoSafra === 4800 && r.planejadoSafrinha === 48200 && r.grupos.proprio.planejado === 8000 && r.grupos.proprio.real === 8000 && r.grupos.terceirizado.real === 20000 && r.realFazenda === 28000;
});

teste("abastecimento com serviço: o diesel de cada operação planejada vira litros e R$ pelo preço médio", () => {
  const comb = [{ tipo: "entrada", litros: 1000, valor: 6000 }, { tipo: "entrada", litros: 1000, valor: 6400 }, { tipo: "entrada", litros: 500 },
    { tipo: "abastecimento", litros: 180, planoOpId: "L1" }, { tipo: "abastecimento", litros: 120, planoOpId: "L1" }, { tipo: "abastecimento", litros: 90 }];
  const r = C.resumoPlanoOperacional([{ id: "L1", operacao: "Gradagem", execucao: "propria", areaHa: 100, vezes: 1, custoHa: 100 }], [], [], { talhoes: [] }, comb);
  return Math.abs(C.precoMedioDiesel(comb) - 6.2) < 1e-9 && r.linhas[0].dieselL === 300 && Math.abs(r.linhas[0].dieselRS - 1860) < 1e-9 && r.linhas[0].nAbast === 2 && r.dieselSemServico === 90 && r.dieselComServico === 300;
});

teste("grid duplo de solo: os pontos de 20–40 são sempre alguns dos pontos de 0–20, na quantidade do grid largo", () => {
  const anel = [[-48.54, -12.02], [-48.531, -12.02], [-48.531, -12.029], [-48.54, -12.029], [-48.54, -12.02]];
  const pts = C.distribuirPontos(anel, 30);
  const r = C.marcarProfundos(pts, anel, 6);
  const prof = r.filter((p) => p.profundo);
  const mesmos = prof.every((p) => pts.some((q) => q.n === p.n && q.lat === p.lat && q.lng === p.lng));
  const todos = C.marcarProfundos(pts, anel, 30).every((p) => p.profundo), nenhum = C.marcarProfundos(pts, anel, 0).every((p) => !p.profundo);
  const semDesenho = C.marcarProfundos(pts, null, 5).filter((p) => p.profundo).length;
  return pts.length === 30 && r.length === 30 && prof.length === 6 && mesmos && new Set(prof.map((p) => p.n)).size === 6 && todos && nenhum && semDesenho === 5;
});

teste("evolução das pragas: série por praga, pulverizações do talhão e antes × depois de cada aplicação", () => {
  const fz = { talhoes: [{ id: "t1", nome: "1" }], niveis: { Soja: { "Lagarta-da-soja": 2 } } };
  const mon = (data, v) => ({ ehMonitoramento: true, talhaoId: "t1", data, cultura: "Soja", metodo: "pano", pragas: ["Lagarta-da-soja"], pontos: [{ n: 1, pragas: { "Lagarta-da-soja": v } }, { n: 2, pragas: { "Lagarta-da-soja": v } }] });
  const mons = [mon("2026-09-01", 1), mon("2026-09-08", 4), mon("2026-09-16", 1), mon("2026-09-24", 0.5), { ehMonitoramento: true, talhaoId: "t2", data: "2026-09-10", metodo: "pano", pragas: ["X"], pontos: [] }];
  const apls = [{ id: "a", modulo: "pulverizacao", tipo: "Inseticida", alvo: "Lagartas", talhaoIds: ["t1"], produtos: [{ nome: "Prod A" }], execucoes: { t1: { data: "2026-09-10T10:00:00Z" } } }, { id: "b", modulo: "pulverizacao", tipo: "Fungicida", talhaoIds: ["t1"], execucoes: {} }];
  const e = C.evolucaoPragasDe(mons, apls, "t1", fz);
  const p = e.pragas[0], av = e.avaliacoes[0];
  return e.mons.length === 4 && e.pragas.length === 1 && p.unidade === "/m" && p.nivel === 2 && p.valores.map((v) => v.valor).join(",") === "1,4,1,0.5"
    && e.aplicacoes.length === 1 && e.aplicacoes[0].data === "2026-09-10" && e.avaliacoes.length === 1 && av.antes === 4 && av.depois === 1 && Math.abs(av.variacao + 75) < 1e-9 && av.veredito === "controlou";
});

teste("nota × descarga de diesel: acha a descarga pela NF ou pelos litros na quinzena; lista as notas sem descarga", () => {
  const comb = [
    { id: "e1", tipo: "entrada", litros: 5000, data: "2026-09-25", nf: "" },
    { id: "e2", tipo: "entrada", litros: 3000, data: "2026-09-20", nf: "000123" },
    { id: "e3", tipo: "entrada", litros: 5000, data: "2026-07-01" },
    { id: "e4", tipo: "entrada", litros: 4900, data: "2026-09-26", notaId: "nX" },
  ];
  const item = { destino: "Combustível", unidade: "LT", qtd: 5000, valorTotal: 31000 };
  const c1 = C.candidatasDescarga(comb, item, { numero: "123", data: "2026-09-27" });
  const c2 = C.candidatasDescarga(comb, { ...item, qtd: 5050 }, { numero: "999", data: "2026-09-27" });
  const notas = [{ id: "n1", status: "destinada", numero: "555", data: "2026-09-27", itens: [item] }, { id: "nX", status: "destinada", numero: "1", itens: [item] }, { id: "n2", status: "pendente", itens: [item] }, { id: "n3", status: "destinada", itens: [{ destino: "Frete", unidade: "un", qtd: 1 }] }];
  const p = C.notasDieselPendentes(notas, comb);
  return c1[0].id === "e2" && c1[0].score >= 3 && c2.length === 1 && c2[0].id === "e1" && !c2.some((x) => x.id === "e3" || x.id === "e4")
    && p.length === 1 && p[0].id === "n1" && p[0].litros === 5000 && p[0].valor === 31000;
});

teste("nota × pedido: a nota dá baixa no pedido do mesmo produto (FIFO, unidade convertida) e só a sobra vira compra nova", () => {
  const prog = [
    { id: "p1", produto: "Fox Xpro", qtd: 200, unidade: "L", ciclo: "Safra", data: "2026-08-01", faturadoQtd: 150 },
    { id: "p2", produto: "Fox Xpro", qtd: 100, unidade: "L", ciclo: "Safra", data: "2026-08-15" },
    { id: "p3", produto: "Fox Xpro", qtd: 50, unidade: "L", ciclo: "Safrinha", data: "2026-08-20" },
    { id: "p4", produto: "Fox Xpro", qtd: 30, unidade: "L", ciclo: "Safra", origem: "anterior" },
    { id: "p5", produto: "Ureia", qtd: 10, unidade: "t", ciclo: "Safra" },
  ];
  const a = C.alocarNotaEmPedidos(prog, { descricao: "FOX XPRO", qtd: 120, unidade: "LT" }, { ciclo: "Safra" });
  const b = C.alocarNotaEmPedidos(prog, { descricao: "fox xpro", qtd: 200, unidade: "L" }, { ciclo: "Safra" });
  const c = C.alocarNotaEmPedidos(prog, { descricao: "UREIA", qtd: 4000, unidade: "KG" }, { ciclo: "Safra" });
  const d = C.alocarNotaEmPedidos(prog, { descricao: "Glifosato", qtd: 10, unidade: "L" }, { ciclo: "Safra" });
  return a.baixas.map((x) => x.id + ":" + x.qtd).join(",") === "p1:50,p2:70" && a.sobra === 0
    && b.baixas.map((x) => x.id + ":" + x.qtd).join(",") === "p1:50,p2:100" && b.sobra === 50
    && c.baixas.length === 1 && c.baixas[0].id === "p5" && c.baixas[0].qtd === 4 && c.sobra === 0
    && d.baixas.length === 0 && d.sobra === 10;
});

teste("planilha padrão do fornecedor: cabeçalho (barter, dólar, vencimento) e itens já preenchidos", () => {
  const L = (txt) => txt.split("\n").map((l) => l.split(";"));
  const barter = C.interpretarPedidoFornecedor(L("PEDIDO\nFornecedor;Revenda Boa Safra\nNúmero do pedido;778\nData do pedido (dd/mm/aaaa);15/09/2026\nForma de pagamento;Barter\nBarter - total de sacas de soja;4480\nBarter - preço da saca travado;118,50\nCiclo;Safra\nCultura;soja\n\nproduto;categoria;quantidade;unidade;preco unitario;observacao\nGlifosato 480;Herbicida;500;L;22,50;\nMAP;Fertilizante / Adubo;60;t;;"));
  const dolar = C.interpretarPedidoFornecedor(L("Fornecedor;AgroX\nForma de pagamento;a prazo 30 dias\nVencimento;30/04/2027\nMoeda;US$\nDólar do negócio;5,40\n\nproduto;categoria;quantidade;unidade;preco unitario\nFox Xpro;Fungicida;200;L;40"));
  const modelo = C.interpretarPedidoFornecedor(C.lerCSV(C.MODELO_PEDIDO));
  const planilhaNova = C.interpretarPedidoFornecedor(L("PEDIDO / COTAÇÃO DE INSUMOS\nPreencha\n\n1. FORNECEDOR\nFornecedor (empresa);Agro Norte\nNome do vendedor;João\nWhatsApp / telefone (com DDD);(63) 99999-0000\nCNPJ (opcional);12.345.678/0001-90\n\n2. PEDIDO\nNúmero do pedido;55\nData do pedido;46300\nCiclo;Safrinha\nCultura;Milho\n\n3. PAGAMENTO\nForma de pagamento;Na safra\nVencimento;46500\nMoeda;R$\n\n4. ITENS — um produto por linha\nProduto;Categoria;Quantidade;Unidade;Preço unitário;Ciclo (opcional);Cultura (opcional);Observação\nAtrazina;Herbicida;300;L;18;;;\nUreia;Fertilizante / Adubo;40;t;3200;Safra;Soja;cobertura"));
  const pn = planilhaNova.cabecalho;
  if (!(pn.fornecedor === "Agro Norte" && pn.contato === "João" && pn.whats === "63999990000" && pn.cnpj === "12.345.678/0001-90" && pn.numero === "55" && pn.pagamento === "Pagamento na safra" && pn.vencimento === "2027-04-23" && pn.data === "2026-10-05"
    && planilhaNova.itens.length === 2 && planilhaNova.itens[0].ciclo === "Safrinha" && planilhaNova.itens[0].cultura === "Milho" && planilhaNova.itens[1].ciclo === "Safra" && planilhaNova.itens[1].cultura === "Soja" && planilhaNova.itens[0].vencimento === "2027-04-23")) return false;
  const b = barter.cabecalho, i0 = barter.itens[0], d0 = dolar.itens[0];
  return C.ehPedidoFornecedor(L("Fornecedor;X")) && !C.ehPedidoFornecedor(L("produto;categoria;quantidade")) && C.dataDePlanilha("5/3/27") === "2027-03-05" && C.dataDePlanilha("46000") === "2025-12-09"
    && b.fornecedor === "Revenda Boa Safra" && b.numero === "778" && b.data === "2026-09-15" && b.barter === true && b.sacas === 4480 && b.precoSaca === 118.5
    && barter.itens.length === 2 && i0.barter === true && i0.pagamento === "Barter (soja)" && i0.preco === "" && i0.vencimento === "" && i0.cultura === "Soja" && i0.data === "2026-09-15" && /pedido 778/.test(i0.obs)
    && dolar.cabecalho.pagamento === "Boleto / prazo" && d0.vencimento === "2027-04-30" && d0.moeda === "US$" && d0.precoMoeda === 40 && d0.dolar === 5.4 && d0.preco === 216 && d0.barter === false
    && modelo.itens.length === 0 && modelo.cabecalho.moeda === "R$";
});

teste("transferência entre fazendas: sai de uma, entra na outra, e o estoque das duas fecha", () => {
  const fazA = { talhoes: [] }, progA = [{ produto: "Glifosato 480", categoria: "Herbicida", qtd: 500, unidade: "L", ciclo: "Safra", cultura: "Soja" }];
  const linha = C.calcularEstoqueDe(fazA, progA, [], [], [])[0];
  const { saida, entrada } = C.ajustesDaTransferencia(linha, 120, "Fazenda A", "Fazenda B", "Daniel", "caminhão", "tr1", "2026-10-02T10:00:00Z");
  const a = C.calcularEstoqueDe(fazA, progA, [], [{ id: "1", ...saida }], [])[0], b = C.calcularEstoqueDe({ talhoes: [] }, [], [], [{ id: "2", ...entrada }], [])[0];
  return saida.delta === -120 && entrada.delta === 120 && saida.transferenciaId === "tr1" && entrada.transferenciaId === "tr1" && /para Fazenda B/.test(saida.motivo) && /de Fazenda A/.test(entrada.motivo)
    && a.comprado - a.usado + a.ajuste === 380 && b.comprado - b.usado + b.ajuste === 120 && b.categoria === "Herbicida" && b.base === "L" && b.cultura === "Soja";
});

teste("ciclo da variedade: previsão de colheita por talhão e por parte, ordenada pela mais próxima", () => {
  const p = C.previsaoDeColheita("2026-11-10", "2026-11-05", 110, "2026-12-10"), semEm = C.previsaoDeColheita("", "2026-11-05", 110, "2026-12-10");
  const talhoes = [{ id: "a", nome: "01", areaHa: 100, cultura: "Soja" }, { id: "b", nome: "02", areaHa: 80, cultura: "Soja" }, { id: "c", nome: "03", areaHa: 50, cultura: "Soja" }];
  const lav = [{ talhaoId: "a", cultura: "Soja", variedade: "M8808", dataEmergencia: "2026-11-20", cicloDias: 120 },
    { talhaoId: "b", cultura: "Soja", variedade: "X + Y", dataEmergencia: "2026-11-10", partes: [{ variedade: "X", areaHa: 50, dataEmergencia: "2026-11-10", cicloDias: 105 }, { variedade: "Y", areaHa: 30, dataEmergencia: "2026-11-15" }] }];
  const L = C.linhasDaLavoura(talhoes, lav, "2026-12-10");
  return p.data === "2027-02-28" && p.faltam === 80 && p.peloPlantio === false && semEm.data === "2027-02-23" && semEm.peloPlantio === true
    && C.previsaoDeColheita("2026-11-10", "", 0, "2026-12-10") === null && C.previsaoDeColheita("", "", 110) === null
    && L.length === 4 && L[0].variedade === "X" && L[0].previsao.data === "2027-02-23" && L[0].dae === 30 && L[0].areaHa === 50
    && L[1].talhao === "01" && L[1].previsao.data === "2027-03-20" && L[1].cicloDias === 120
    && L.filter((x) => !x.previsao).length === 2 && L.find((x) => x.talhao === "03").semLavoura === true && L.find((x) => x.variedade === "Y").cicloDias === null;
});

teste("conferência painel × GPS: de um abastecimento ao seguinte, com tolerância e alertas", () => {
  const ab = (data, km, litros) => ({ tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data, km, litros, criadoEm: data + "T18:00:00.000Z" });
  const tj = (data, km, v) => ({ tipo: "trajeto", veiculoId: v || "v1", data, inicio: data + "T08:00:00.000Z", km });
  const itens = [ab("2026-10-01", 10000, 50), tj("2026-10-02", 200), tj("2026-10-03", 180), ab("2026-10-04", 10400, 40),   // 400 painel × 380 GPS: bate
    tj("2026-10-05", 100), tj("2026-10-05", 999, "v2"), ab("2026-10-08", 10900, 50),                                         // 500 × 100: 400 sem trajeto
    tj("2026-10-09", 300), ab("2026-10-10", 11000, 20),                                                                        // 100 × 300: GPS maior
    ab("2026-10-12", 10950, 10)];                                                                                              // KM menor que o anterior
  const c = C.conferenciaFrota(itens, [{ id: "v1", modelo: "Hilux", placa: "" }]);
  const de = (d) => c.find((x) => x.ate === d);
  return c.length === 4 && c[0].ate === "2026-10-12" && de("2026-10-04").situacao === "ok" && de("2026-10-04").kmPainel === 400 && de("2026-10-04").kmGps === 380 && de("2026-10-04").kmL === 10 && de("2026-10-04").nTrajetos === 2
    && de("2026-10-08").situacao === "semGps" && de("2026-10-08").dif === 400 && de("2026-10-08").kmGps === 100
    && de("2026-10-10").situacao === "gpsMaior" && de("2026-10-12").situacao === "painelMenor" && de("2026-10-04").nome === "Hilux";
});

teste("despesas da consultoria: pontos do trajeto, rota guardada e resumo do mês por veículo", () => {
  const p0 = { lat: -10.2, lng: -48.3, acc: 8, t: 0 };
  const perto = C.aceitarPontoTrajeto(p0, { lat: -10.2001, lng: -48.3, acc: 8, t: 5000 });            // ~11 m: parado
  const anda = C.aceitarPontoTrajeto(p0, { lat: -10.201, lng: -48.3, acc: 8, t: 10000 });             // ~110 m em 10 s
  const salto = C.aceitarPontoTrajeto(p0, { lat: -10.3, lng: -48.3, acc: 8, t: 10000 });              // 11 km em 10 s
  const ruim = C.aceitarPontoTrajeto(p0, { lat: -10.201, lng: -48.3, acc: 120, t: 10000 });
  const pts = [{ lat: -10.2, lng: -48.3 }, { lat: -10.21, lng: -48.3 }, { lat: -10.21, lng: -48.31 }];
  const comBuraco = [{ lat: -10.2, lng: -48.3 }, { lat: -10.21, lng: -48.3 }, { lat: -10.3, lng: -48.3, q: true }, { lat: -10.31, lng: -48.3 }];
  const rb = C.decodificarRota(C.codificarRota(comBuraco));
  if (!(rb.length === 4 && rb[2].q === true && !rb[1].q && Math.abs(C.kmDaRota(comBuraco) - 2.2) < 0.1 && Math.abs(C.kmDosBuracos(comBuraco) - 9.95) < 0.2)) return false;
  const volta = C.decodificarRota(C.codificarRota(pts));
  const muitos = Array.from({ length: 5000 }, (_, i) => ({ lat: -10.2 - i * 0.0001, lng: -48.3 }));
  const itens = [
    { tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data: "2026-10-02", litros: 50, valor: 300, km: 10000 },
    { tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data: "2026-10-20", litros: 40, valor: 250, km: 10480 },
    { tipo: "despesa", veiculoId: "v1", quem: "Beto", data: "2026-10-10", valor: 30 },
    { tipo: "trajeto", veiculoId: "v1", quem: "Ana", data: "2026-10-03", km: 123.4 },
    { tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data: "2026-09-28", litros: 45, valor: 270, km: 9500 },
  ];
  const r = C.resumoFrota(itens, [{ id: "v1", modelo: "Hilux", placa: "ABC1D23" }], "2026-10"), v = r.porVeiculo[0];
  return !perto.aceita && anda.aceita && Math.abs(anda.metros - 110) < 5 && !salto.aceita && !ruim.aceita && C.aceitarPontoTrajeto(null, p0).aceita
    && volta.length === 3 && volta[1].lat === -10.21 && Math.abs(C.kmDaRota(pts) - 2.2) < 0.1 && C.decodificarRota(C.codificarRota(muitos)).length <= 1502
    && r.n === 4 && r.total === 580 && v.nome === "Hilux · ABC1D23" && v.litros === 90 && v.kmPainel === 480 && v.kmL === 12 && v.kmGps === 123.4 && v.outras === 30
    && Math.abs(v.custoKm - 1.21) < 0.01 && r.porPessoa.length === 2 && r.porPessoa[0].quem === "Ana" && r.porPessoa[0].total === 550;
});

teste("KM inicial da frota: leitura avulsa entra no km do mês, no 'desde o início' e na conferência", () => {
  const V = [{ id: "v1", modelo: "Hilux", placa: "" }];
  const itens = [
    { id: "k0", tipo: "km", veiculoId: "v1", quem: "Ana", data: "2026-10-01", km: 10000, motivo: "Peguei o veículo", criadoEm: "2026-10-01T07:00:00.000Z" },
    { id: "t1", tipo: "trajeto", veiculoId: "v1", quem: "Ana", data: "2026-10-01", inicio: "2026-10-01T08:00:00.000Z", km: 190 },
    { id: "a1", tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data: "2026-10-01", km: 10200, litros: 20, valor: 120, criadoEm: "2026-10-01T18:00:00.000Z" },
    { id: "a2", tipo: "abastecimento", veiculoId: "v1", quem: "Ana", data: "2026-10-10", km: 10600, litros: 40, valor: 240, criadoEm: "2026-10-10T18:00:00.000Z" },
    { id: "k1", tipo: "km", veiculoId: "v1", quem: "Ana", data: "2026-11-02", km: 10900, motivo: "Começo do dia", criadoEm: "2026-11-02T07:00:00.000Z" },
  ];
  const l = C.leiturasDoVeiculo(itens, "v1");
  const r = C.resumoFrota(itens, V, "2026-10"), v = r.porVeiculo[0];
  const c = C.conferenciaFrota(itens, V);
  const p = c.find((x) => x.ate === "2026-10-01"), q = c.find((x) => x.ate === "2026-10-10"), u = c.find((x) => x.ate === "2026-11-02");
  return l.length === 4 && l[0].id === "k0" && l[1].id === "a1" && l[3].id === "k1"
    && v.kmPainel === 600 && v.kmL === 10 && r.kmPainel === 600 && v.kmInicial === 10000 && v.kmInicialData === "2026-10-01" && v.kmUltimo === 10900 && v.kmDesdeInicio === 900 && v.kmLGeral === 15
    && c.length === 3 && p.kmPainel === 200 && p.kmGps === 190 && p.situacao === "ok" && p.kmL === null && p.tipoDe === "km" && p.motivoDe === "Peguei o veículo"
    && q.kmPainel === 400 && q.kmL === 10 && u.kmPainel === 300 && u.kmL === null && u.tipoAte === "km";
});

teste("frota por motorista: mesmo carro, custo de cada um, forma de pagamento e reembolso", () => {
  const V = [{ id: "v1", modelo: "Hilux", placa: "" }];
  const itens = [
    { id: "k0", tipo: "km", veiculoId: "v1", quem: "Ana", motorista: "Ana", data: "2026-10-01", km: 1000, criadoEm: "2026-10-01T07:00:00.000Z" },
    { id: "a1", tipo: "abastecimento", veiculoId: "v1", quem: "Ana", motorista: "Ana", data: "2026-10-02", km: 1300, litros: 30, valor: 180, pagamento: "Cartão da consultoria", criadoEm: "2026-10-02T18:00:00.000Z" },
    { id: "a2", tipo: "abastecimento", veiculoId: "v1", quem: "Ana", motorista: "Beto", data: "2026-10-05", km: 1500, litros: 20, valor: 120, pagamento: C.PAG_BOLSO, criadoEm: "2026-10-05T18:00:00.000Z" },
    { id: "d1", tipo: "despesa", veiculoId: "v1", quem: "Beto", motorista: "Beto", data: "2026-10-06", valor: 40, pagamento: C.PAG_BOLSO, reembolsadoEm: "2026-10-07T10:00:00.000Z" },
    { id: "d2", tipo: "despesa", veiculoId: "v1", quem: "Beto", motorista: "Beto", data: "2026-10-06", valor: 25, pagamento: "Dinheiro da consultoria" },
    { id: "t1", tipo: "trajeto", veiculoId: "v1", quem: "Beto", motorista: "Beto", data: "2026-10-04", inicio: "2026-10-04T08:00:00.000Z", km: 190 },
  ];
  const r = C.resumoFrota(itens, V, "2026-10");
  const ana = r.porPessoa.find((p) => p.quem === "Ana"), beto = r.porPessoa.find((p) => p.quem === "Beto");
  return r.porPessoa.length === 2 && ana.total === 180 && ana.kmPainel === 300 && ana.aReembolsar === 0 && ana.porPagamento["Cartão da consultoria"] === 180
    && beto.total === 185 && beto.combustivel === 120 && beto.outras === 65 && beto.kmPainel === 200 && beto.kmGps === 190
    && beto.aReembolsar === 120 && beto.reembolsado === 40 && beto.idsReembolso.length === 1 && beto.idsReembolso[0] === "a2" && beto.porPagamento["Dinheiro da consultoria"] === 25
    && r.aReembolsar === 120 && r.porVeiculo[0].total === 365 && C.ehReembolsoFrota(itens[2]) && !C.ehReembolsoFrota(itens[4]) && C.motoristaDe({ quem: "X" }) === "X" && C.motoristaDe(itens[2]) === "Beto";
});

teste("assistente: muda cultura/ciclo de várias compras de uma vez", () => {
  const prog = [{ id: 1, produto: "Glifosato", cultura: "", ciclo: "Safra" }, { id: 2, produto: "Óleo", ciclo: "Safra" }, { id: 3, produto: "MAP", cultura: "Milho", ciclo: "Safrinha" }, { id: 4, produto: "Semente soja", cultura: "Soja", ciclo: "Safra" }];
  const a = C.aplicarCompras(prog, { cultura: "soja", soSemCultura: true });
  const b = C.aplicarCompras(prog, { cultura: "Soja" });
  const c = C.aplicarCompras(prog, { ciclo: "safrinha", produto: "glifo" });
  const d = C.aplicarCompras(prog, {});
  return a.n === 2 && a.cultura === "Soja" && a.lista[0].cultura === "Soja" && a.lista[1].cultura === "Soja" && a.lista[2].cultura === "Milho" && a.lista[3] === prog[3]
    && b.n === 3 && b.lista[2].cultura === "Soja" && c.n === 1 && c.lista[0].ciclo === "Safrinha" && c.lista[0].cultura === "" && c.lista[1] === prog[1] && d.n === 0;
});

teste("assistente: itens do arquivo casam com catálogo e estoque; modo compra × entrega", () => {
  const r = { fornecedor: "Agro Revenda", numeroNota: "123", itens: [{ descricao: "GLIFOSATO NORTOX 480 SL 20L", quantidade: 10, unidade: "LT", valorUnitario: 25, tipo: "insumo" }, { descricao: "FRETE", quantidade: 1, unidade: "un", valorUnitario: 300, tipo: "servico" }, { descricao: "MAP 11-52-00", quantidade: 2, unidade: "t", tipo: "insumo" }] };
  const linhas = [{ produto: "Glifosato Nortox 480 SL", ciclo: "Safra", base: "L", comprado: 200 }, { produto: "MAP", ciclo: "Safra", base: "kg", comprado: 5000 }];
  const it = C.prepararItensArquivo(r, [], linhas);
  return it.length === 3 && it[0].incluir && it[0].linha && it[0].linha.produto === "Glifosato Nortox 480 SL" && it[0].qtdEntrega === 10 && it[0].preco === 25 && it[0].unidade === "L" && it[2].unidade === "t"
    && !it[1].incluir && it[2].linha && it[2].linha.produto === "MAP" && it[2].qtdEntrega === 2000 && it[2].qtd === 2
    && C.modoDoArquivo("lança esse pedido", false) === "compras" && C.modoDoArquivo("chegou essa nota", false) === "entrega" && C.modoDoArquivo("", true) === "entrega" && C.modoDoArquivo("lança a compra", true) === "compras" && C.modoDoArquivo("", false) === "compras";
});

teste("mapa de variedades: programado (recomendação) × real (dados da lavoura), sementes por metro", () => {
  const talhoes = [{ id: "t1", nome: "T1", areaHa: 100, cultura: "Soja" }, { id: "t2", nome: "T2", areaHa: 50, cultura: "Soja" }];
  const apls = [{ modulo: "semeadura", talhaoIds: ["t1", "t2"], dataRecomendada: "2026-10-01", populacao: "300000", espacamento: "45", produtos: [{ nome: "M8808 I2X", dose: "1", unidade: "bag" }, { nome: "Standak Top", dose: "100", unidade: "mL", uso: "ts" }, { nome: "Trichoderma BR", dose: "0.5", unidade: "L", uso: "sulco" }], execucoes: { t1: { data: "2026-10-05" } } },
    { modulo: "semeadura", talhaoIds: ["t2"], dataRecomendada: "2026-10-03", populacao: "280000", espacamento: "50", produtos: [{ nome: "TMG 7262", dose: "1", unidade: "bag" }] }];
  const lavoura = [{ talhaoId: "t1", cultura: "Soja", variedade: "M8808 I2X", dataPlantio: "2026-10-05", dataEmergencia: "2026-10-11", populacaoSemeada: "310000", espacamento: "45" }, { talhaoId: "t2", cultura: "Soja", variedade: "TMG 7262", dataPlantio: "2026-10-06" }];
  const p = C.linhasMapaVariedades(talhoes, lavoura, apls, "programado"), r = C.linhasMapaVariedades(talhoes, lavoura, apls, "real");
  const cores = C.coresDasVariedades(p), res = C.resumoVariedades(p);
  return p.length === 2 && p[0].variedade === "M8808 I2X" && Math.abs(p[0].semPorMetro - 13.5) < 0.01 && p[0].feito && p[1].variedade === "TMG 7262" && p[1].populacao === 280000 && Math.abs(p[1].semPorMetro - 14) < 0.01 && !p[1].feito
    && r.length === 2 && r[0].variedade === "M8808 I2X" && r[0].populacao === 310000 && Math.abs(r[0].semPorMetro - 13.95) < 0.01 && r[0].data === "2026-10-05" && r[0].feito && r[1].variedade === "" && r[1].planejada === "TMG 7262" && !r[1].feito && r[1].semPorMetro === 0
    && cores["M8808 I2X"] && cores["TMG 7262"] && cores["M8808 I2X"] !== cores["TMG 7262"] && res[0].variedade === "M8808 I2X" && res[0].areaHa === 100 && res[1].areaHa === 50;
});

teste("rateio item por item: pela área, tirando fazenda, sobra do arredondamento na última", () => {
  const F = [{ key: "aqui", areaHa: 100 }, { key: "b", areaHa: 50 }, { key: "c", areaHa: 50 }];
  const a = C.distribuirPorArea(1000, F), b = C.distribuirPorArea(1000, F.map((f) => ({ ...f, incluir: f.key !== "c" }))), c = C.distribuirPorArea(10, [{ key: "aqui", areaHa: 1 }, { key: "b", areaHa: 1 }, { key: "c", areaHa: 1 }]);
  const soma = (o) => Math.round(Object.values(o).reduce((s, v) => s + v, 0) * 100) / 100;
  return a.aqui === 500 && a.b === 250 && a.c === 250 && b.aqui === 666.67 && b.b === 333.33 && b.c === 0 && soma(b) === 1000 && soma(c) === 10 && c.c === 3.34
    && C.distribuirPorArea(0, F).aqui === 0 && soma(C.distribuirPorArea(100, F.map((f) => ({ ...f, incluir: false })))) === 0;
});

teste("compras repetidas: acha o mesmo produto e soma (unidade convertida, preço médio) ou lança separado", () => {
  const prog = [{ id: "a", produto: "Glifosato Nortox 480 SL", ciclo: "Safra", qtd: 200, unidade: "L", preco: 20, obs: "NF 1" }, { id: "b", produto: "MAP", ciclo: "Safrinha", qtd: 2, unidade: "t", preco: 3000 }, { id: "c", produto: "Semente X", ciclo: "Safra", qtd: 10, unidade: "bag", origem: "anterior" }];
  const novos = [{ id: "n1", produto: "glifosato nortox 480 sl", ciclo: "Safra", qtd: 100, unidade: "L", preco: 26, obs: "NF 2", data: "2026-10-07" }, { id: "n2", produto: "MAP", ciclo: "Safra", qtd: 1, unidade: "t" }, { id: "n3", produto: "MAP", ciclo: "Safrinha", qtd: 500, unidade: "kg", preco: 3.5 }, { id: "n4", produto: "Semente X", ciclo: "Safra", qtd: 5, unidade: "bag" }];
  const pares = C.paresRepetidos(prog, novos);
  const r = C.fundirCompras(prog, novos, { 0: "somar", 2: "somar" });
  const gl = r.find((p) => p.id === "a"), map = r.find((p) => p.id === "b");
  return pares.length === 2 && pares[0].i === 0 && pares[0].existente.id === "a" && pares[1].i === 2 && pares[1].existente.id === "b"
    && r.length === 5 && gl.qtd === 300 && gl.preco === 22 && /NF 1 · \+ 100 L em 07\/10\/2026 \(NF 2\)/.test(gl.obs) && gl.somadoEm.length === 1
    && map.qtd === 2.5 && map.preco === 3100 && r.some((p) => p.id === "n2") && r.some((p) => p.id === "n4") && !r.some((p) => p.id === "n1") && !r.some((p) => p.id === "n3")
    && C.fundirCompras(prog, novos, {}).length === 7;
});

teste("mover compra entre fazendas do grupo: tira da origem, soma ou copia no destino", () => {
  const A = [{ id: "a1", produto: "NEO 821 I2X", ciclo: "Safra", qtd: 32, unidade: "bag", preco: 900, fornecedorId: "f1", obs: "NF 1", faturadoQtd: 10, notasIds: ["n1"] }, { id: "a2", produto: "Óleo", ciclo: "Safra", qtd: 50, unidade: "L" }];
  const B = [{ id: "b1", produto: "Óleo", ciclo: "Safra", qtd: 20, unidade: "L" }];
  const r1 = C.moverCompraEntreFazendas(A, B, "NEO 821 I2X", "", 12, "A", "B", "2026-10-07");
  const r2 = C.moverCompraEntreFazendas(A, B, "NEO 821 I2X", "", 32, "A", "B", "2026-10-07");
  const r3 = C.moverCompraEntreFazendas(A, B, "Óleo", "", 10, "A", "B", "2026-10-07");
  const r4 = C.moverCompraEntreFazendas(A, B, "NEO 821 I2X", "", 40, "A", "B", "2026-10-07");
  const novaB = r1.destino.find((p) => p.produto === "NEO 821 I2X");
  return r1.ok && r1.origem.find((p) => p.id === "a1").qtd === 20 && novaB && novaB.qtd === 12 && novaB.preco === 900 && novaB.fornecedorId === "f1" && novaB.id !== "a1" && !("faturadoQtd" in novaB) && /movido de A/.test(novaB.obs)
    && r2.ok && !r2.origem.some((p) => p.id === "a1") && r2.destino.find((p) => p.produto === "NEO 821 I2X").qtd === 32
    && r3.ok && r3.origem.find((p) => p.id === "a2").qtd === 40 && r3.destino.find((p) => p.id === "b1").qtd === 30 && r3.destino.length === 1
    && !r4.ok && /32/.test(r4.erro);
});

teste("pagamento na safra vence no próximo 30/04; ordem de mistura e avisos de incompatibilidade", () => {
  const info = (n) => ({ "Glifosato Nortox 480 SL": { categoria: "Herbicida", unidade: "L", ativo: "glifosato (480 g/L)" }, "Óleo mineral": { categoria: "Adjuvante", unidade: "L", ativo: "" }, "Fox Xpro": { categoria: "Fungicida", unidade: "L", ativo: "bixafem + protioconazol + trifloxistrobina" },
    "Nomolt 150 SC": { categoria: "Inseticida", unidade: "L", ativo: "teflubenzurom" }, "Roundup WG": { categoria: "Herbicida", unidade: "kg", ativo: "glifosato (720 g/kg)" }, "Sulfato de zinco": { categoria: "Foliar", unidade: "kg", ativo: "" }, "Trichoderma BR": { categoria: "Biológico", unidade: "L", ativo: "Trichoderma harzianum" } }[n] || {});
  const om = C.ordemDeMistura([{ nome: "Óleo mineral" }, { nome: "Glifosato Nortox 480 SL" }, { nome: "Roundup WG" }, { nome: "Nomolt 150 SC" }, { nome: "Sulfato de zinco" }, { nome: "Trichoderma BR" }, { nome: "Fox Xpro" }], info);
  const nomes = om.ordenados.map((p) => p.nome);
  const ok2 = C.ordemDeMistura([{ nome: "Nomolt 150 SC" }, { nome: "Óleo mineral" }], info);
  return C.proximo30Abril("2026-10-07") === "2027-04-30" && C.proximo30Abril("2027-02-10") === "2027-04-30" && C.proximo30Abril("2027-04-30") === "2027-04-30" && C.proximo30Abril("2027-05-01") === "2028-04-30"
    && nomes.join("|") === "Roundup WG|Nomolt 150 SC|Fox Xpro|Glifosato Nortox 480 SL|Sulfato de zinco|Óleo mineral|Trichoderma BR" && !om.jaCerta
    && om.avisos.some((a) => /Biológico/.test(a)) && om.avisos.some((a) => /Glifosato com Sulfato de zinco/.test(a)) && om.avisos.some((a) => /WG\/WP/.test(a)) && om.avisos.some((a) => /teste do jarro/.test(a))
    && ok2.jaCerta && ok2.avisos.length === 0 && C.grupoMistura("Produto X", { unidade: "kg" }) === 1 && C.grupoMistura("Produto Y", { unidade: "L" }) === 3.5;
});

teste("nomes repetidos do KML ganham (2), (3)", () => {
  const l = C.desrepetirNomes([{ nome: "Polígono 4" }, { nome: "Pivô 1" }, { nome: "Polígono 4" }, { nome: "Polígono 4" }]);
  return l.map((p) => p.nome).join("|") === "Polígono 4|Pivô 1|Polígono 4 (2)|Polígono 4 (3)";
});

teste("validade do produto: vencido / perto (60 dias) / ok, e a mais próxima vai para o estoque", () => {
  const h = "2026-10-10";
  const a = C.situacaoValidade("2026-10-01", h), b = C.situacaoValidade("2026-11-20", h), c = C.situacaoValidade("2027-06-01", h);
  const fz = { talhoes: [] };
  const l = C.calcularEstoqueDe(fz, [{ produto: "Glifosato", qtd: 100, unidade: "L", validade: "2027-03-01" }], [], [{ produto: "Glifosato", delta: 10, base: "L", validade: "2026-12-01" }], [{ produto: "Glifosato", qtd: 50, base: "L", validade: "2027-01-15" }])[0];
  return a.nivel === "vencido" && a.dias === -9 && b.nivel === "perto" && c.nivel === "ok" && C.situacaoValidade("", h) === null && l.validade === "2026-12-01";
});

teste("lotes: o usado sai primeiro do lote que vence antes; resta por lote e validade da linha", () => {
  const fz = { talhoes: [{ id: "t1", nome: "T1", areaHa: 10 }] };
  const prog = [{ produto: "Glifosato", qtd: 300, unidade: "L" }];
  const entregas = [{ produto: "Glifosato", qtd: 100, base: "L", lote: "B", validade: "2027-03-01" }, { produto: "Glifosato", qtd: 100, base: "L", lote: "A", validade: "2026-12-01" }, { produto: "Glifosato", qtd: 100, base: "L", lote: "C" }];
  const apls = [{ talhaoIds: ["t1"], produtos: [{ nome: "Glifosato", dose: 12, unidade: "L" }], execucoes: { t1: { data: "2026-10-01", operador: "x" } } }];   // 120 L usados
  const l = C.calcularEstoqueDe(fz, prog, apls, [{ produto: "Glifosato", delta: -30, base: "L" }], entregas)[0];   // 150 consumidos
  const ls = C.lotesComSaldo(l);
  return ls.map((x) => x.lote + ":" + x.resta).join("|") === "A:0|B:50|C:100" && l.validade === "2027-03-01";
});

teste("fazenda: recomendar e pedidos começam em Não pode; liberado por pessoa", () => {
  return C.podeFazenda({ funcao: "Gerente" }, "pedidos") === false && C.podeFazenda({ funcao: "Produtor" }, "recomendacoes") === false &&
    C.podeFazenda({ funcao: "Gerente", permissoes: { pedidos: true } }, "pedidos") === true && C.podeFazenda({ funcao: "Gerente" }, "financeiro") === true &&
    C.podeFazenda({ funcao: "Operador de máquinas" }, "financeiro") === false;
});

teste("fazenda: apagar vem liberado para Produtor e Gerente, não para operador; marcação vale", () => {
  return C.podeFazenda({ funcao: "Gerente" }, "apagar") === true && C.podeFazenda({ funcao: "Produtor" }, "apagar") === true &&
    C.podeFazenda({ funcao: "Operador de máquinas" }, "apagar") === false && C.podeFazenda({ funcao: "Operador de máquinas", permissoes: { apagar: true } }, "apagar") === true &&
    C.podeFazenda({ funcao: "Gerente", permissoes: { apagar: false } }, "apagar") === false;
});

teste("medição pelo GPS: quadrado de ~100 m dá ~1 ha", () => {
  const lat = -10.2, dLat = 100 / 111320, dLng = 100 / (111320 * Math.cos(lat * Math.PI / 180));
  const ha = C.pontosParaHa([{ lat, lng: -48.5 }, { lat, lng: -48.5 + dLng }, { lat: lat + dLat, lng: -48.5 + dLng }, { lat: lat + dLat, lng: -48.5 }]);
  return Math.abs(ha - 1) < 0.03 && C.pontosParaHa([{ lat, lng: -48.5 }, { lat, lng: -48.4 }]) === 0;
});

teste("entrega sem lote herda o lote da compra, na ordem das compras; dica aponta o que vence antes", () => {
  const fz = { talhoes: [] };
  const prog = [{ produto: "Mancozebe", qtd: 100, unidade: "kg", data: "2026-09-02", lote: "B", validade: "2027-06-01" }, { produto: "Mancozebe", qtd: 50, unidade: "kg", data: "2026-09-01", lote: "A", validade: "2026-12-01" }];
  const entregas = [{ produto: "Mancozebe", qtd: 120, base: "kg" }, { produto: "Mancozebe", qtd: 50, base: "kg" }];
  const est = C.calcularEstoqueDe(fz, prog, [], [], entregas);
  const ls = C.lotesComSaldo(est[0]);
  const d = C.dicaLoteDe(est, "mancozebe");
  return ls.map((x) => x.lote + ":" + x.qtd).join("|") === "A:50|B:70|B:30|:20" && d && d.lote === "A" && /use primeiro: lote A/.test(d.texto) && C.dicaLoteDe(est, "Outro") === null;
});

teste("compras duplicadas: acha cópias idênticas, mantém uma; 'não adicionar' não lança de novo", () => {
  const a = { id: "1", produto: "Exalt", qtd: 65, unidade: "L", preco: null, data: "2026-10-10", obs: "NF 1" }, b = { ...a, id: "2" }, c = { ...a, id: "3", qtd: 70 }, d = { id: "4", produto: "KS", qtd: 120, unidade: "L", data: "2026-10-10" };
  const dup = C.comprasDuplicadas([a, b, c, d]);
  const limpo = C.semDuplicadas([a, b, c, d]).map((x) => x.id).join(",");
  const par = { novo: { qtd: 65, unidade: "L" }, existente: { qtd: 65, unidade: "L" } };
  const fund = C.fundirCompras([a], [{ ...b, id: "9" }, d], { 0: "nao" });
  return dup.length === 1 && dup[0].apagar.length === 1 && dup[0].apagar[0].id === "2" && limpo === "1,3,4" && C.compraIdenticaAoExistente(par) === true && !C.compraIdenticaAoExistente({ novo: { qtd: 60, unidade: "L" }, existente: { qtd: 65, unidade: "L" } }) && fund.length === 2 && fund.map((x) => x.id).join(",") === "1,4";
});

teste("plantio em etapas: semente sai por etapa, da variedade plantada; o resto da receita pela área total", () => {
  const produtos = [{ nome: "Soja M8808", dose: 1, unidade: "bag", uso: "semente" }, { nome: "Standak Top", dose: 0.2, unidade: "L" }];
  const ex = { etapas: [{ inicio: "2026-10-05", fim: "2026-10-07", areaHa: 40, variedade: "Soja M8808" }, { inicio: "2026-10-20", fim: "2026-10-21", areaHa: 60, variedade: "Soja BRS 7380" }], areaExecutada: 100 };
  const c = C.consumoDaExecucao(produtos, ex, 100);
  const por = Object.fromEntries(c.map((x) => [x.nome, x.v]));
  return C.sementeDaReceita({ produtos }).nome === "Soja M8808" && por["Soja M8808"] === 40 && por["Soja BRS 7380"] === 60 && Math.abs(por["Standak Top"] - 20) < 1e-9 && c.length === 3;
});

teste("semente: bag de 4 ou 5 milhões e kg pelo PMS, com a informação vinda da compra", () => {
  const prog = [{ produto: "Soja Lenda", categoria: "Sementes", qtd: 40, unidade: "bag", sementesPorBag: 4000000 }, { produto: "Soja M8808", categoria: "Sementes", qtd: 2000, unidade: "kg", pms: 180 }];
  const lenda = C.infoSementeDe("soja lenda", prog), m8 = C.infoSementeDe("Soja M8808", prog), outra = C.infoSementeDe("Soja X", prog);
  const est = C.calcularEstoqueDe({ talhoes: [] }, prog, [], [], []);
  const lm8 = est.find((l) => l.produto === "Soja M8808");
  return lenda.porBag === 4000000 && m8.pms === 180 && outra.porBag === 5000000 && outra.pms === 0
    && Math.abs(C.doseSementePorHa(300000, "bag", lenda) - 0.075) < 1e-9 && Math.abs(C.doseSementePorHa(300000, "kg", m8) - 54) < 1e-9 && C.doseSementePorHa(300000, "kg", outra) === 0
    && Math.abs(C.doseSementePorHa(220000, "bag", null) - 0.044) < 1e-9 && lm8.pms === 180 && C.ehNomeDeSemente("Standak", "Tratamento de sementes") === false && C.ehNomeDeSemente("x", "Sementes") === true;
});

teste("máquinas: lista de bicos limpa e tipos de pulverizador", () => {
  return C.listaBicos("AD-IA 110.02, TT 110.03;  AD-IA 110.02\nAXI 110.015").join("|") === "AD-IA 110.02|TT 110.03|AXI 110.015" && C.listaBicos("").length === 0
    && C.ehPulverizador({ tipo: "Pulverizador" }) && !C.ehPulverizador({ tipo: "Pulverizador de sulco" }) && C.ehPulverizadorSulco({ tipo: "Pulverizador de sulco" }) && !C.ehPulverizadorSulco({ tipo: "Trator" });
});

teste("tabela para completar o tanque do sulco: de 100 em 100 L, produto = dose × litros ÷ vazão", () => {
  const l = C.linhasCompletar([{ nome: "Inoculante", dose: 2, unidade: "L" }, { nome: "Micro", dose: 500, unidade: "mL" }], 40, 1200, 100);
  const l800 = l.find((x) => x.litros === 800), ult = l[l.length - 1];
  const grande = C.linhasCompletar([{ nome: "A", dose: 1, unidade: "L" }], 50, 10000, 100);
  return l.length === 12 && l[0].litros === 100 && l[0].itens[0].qtd === 5 && l[0].itens[0].un === "L" && l[0].itens[1].qtd === 1.25 && l[0].itens[1].un === "L"
    && l800.itens[0].qtd === 40 && ult.litros === 1200 && ult.itens[0].qtd === 60 && grande.length <= 25 && grande[grande.length - 1].litros === 10000 && C.linhasCompletar([], 0, 1000, 100).length === 0;
});

teste("entrega por fornecedor: pedidos da linha, entrega ligada abate no pedido, solta abate na ordem da data", () => {
  const forn = [{ id: "f1", nome: "Abaday" }, { id: "f2", nome: "Lavoro" }, { id: "f3", nome: "Agrosul" }];
  const prog = [{ id: "c2", produto: "Glifosato", qtd: 100, unidade: "L", fornecedorId: "f2", data: "2026-09-10" }, { id: "c1", produto: "Glifosato", qtd: 200, unidade: "L", fornecedorId: "f1", data: "2026-09-01" }, { id: "c3", produto: "Glifosato", qtd: 50, unidade: "L", fornecedorId: "f3", data: "2026-09-20", ciclo: "Safra" }, { id: "x", produto: "Outro", qtd: 1, unidade: "L" }];
  const entregas = [{ produto: "Glifosato", qtd: 100, base: "L", compraId: "c2" }, { produto: "Glifosato", qtd: 150, base: "L" }];
  const linha = { produto: "glifosato", ciclo: "Safra" };
  const ps = C.pedidosDaLinha(prog, entregas, linha, forn);
  return ps.map((p) => p.fornecedor + ":" + p.falta).join("|") === "Abaday:50|Lavoro:0|Agrosul:50" && C.fornecedoresDaLinha(prog, entregas, linha, forn).join(",") === "Abaday,Lavoro,Agrosul" && C.pedidosDaLinha(prog, entregas, { produto: "Nada" }, forn).length === 0;
});

teste("visita: itens do relatório montados das observações; limite de fotos conta o texto", () => {
  const talhoes = [{ id: "t1", nome: "T1", areaHa: 50, cultura: "Soja" }];
  const obs = [{ id: "1", talhaoId: "t1", talhaoNome: "T1", cat: "🐛 Pragas", item: "Lagarta", pressao: "Alta", acao: "Ação urgente" }, { id: "2", talhaoId: "t1", talhaoNome: "T1", cat: "📝 Anotação", item: "Falha de estande", porTexto: true }];
  const itens = C.montarItensVisita(obs, talhoes, [{ talhaoId: "t1", cultura: "Soja", variedade: "M8808" }]);
  return itens[0].titulo === "Resumo da visita" && /AÇÃO URGENTE: Lagarta \(T1\)/.test(itens[0].texto) && itens[1].titulo === "Talhões visitados" && /T1 — 50 ha · Soja · M8808/.test(itens[1].texto)
    && itens.some((i) => i.titulo === "🐛 Pragas e insetos") && itens.some((i) => i.titulo === "📝 Anotações") && C.bytesFotos(["abcd", "ef"]) === 6 && C.LIMITE_FOTOS_DOC < 900 * 1024;
});

teste("visita: talhões na mesma situação viram uma linha só; resumo da IA troca só o item Resumo; visão por talhão; texto do WhatsApp", () => {
  const obs = [
    { id: "1", talhaoId: "t1", talhaoNome: "T1", cat: "🌿 Daninha", item: "Buva", pressao: "Alta", acao: "Programar aplicação", nota: "3 por metro" },
    { id: "2", talhaoId: "t3", talhaoNome: "T3", cat: "🌿 Daninha", item: "Buva", pressao: "Alta", acao: "Programar aplicação" },
    { id: "3", talhaoId: "t5", talhaoNome: "T5", cat: "🌿 Daninha", item: "buva", pressao: "Alta", acao: "Programar aplicação" },
    { id: "4", talhaoId: "t2", talhaoNome: "T2", cat: "🌿 Daninha", item: "Buva", pressao: "Baixa", acao: "Só monitorar" },
    { id: "5", talhaoId: null, talhaoNome: null, cat: "🐛 Praga", item: "Percevejo", pressao: "Alta", acao: "Ação urgente" },
  ];
  const talhoes = [{ id: "t1", nome: "T1", areaHa: 10 }];
  const g = C.agruparObsVisita(obs);
  const itens = C.montarItensVisita(obs, talhoes, []);
  const sec = itens.find((i) => i.titulo === "🌿 Plantas daninhas");
  const porT = C.itensPorTalhao({ obsCampo: obs }, talhoes, []);
  const comIA = C.itensComResumo(itens, "Texto da IA.");
  const txt = C.textoResumoVisita({ nome: "Gisata" }, { data: "2026-10-19", tecnico: "Daniel", itens: comIA });
  return g.length === 3 && g[0].talhoes.join(",") === "T1,T3,T5" && sec.texto.split("\n").length === 2
    && sec.texto.split("\n")[0] === "• Buva — pressão ALTA · Programar aplicação — Talhões T1, T3 e T5 (T1: 3 por metro)."
    && /AÇÃO URGENTE: Percevejo\./.test(itens[0].texto) && /Programar aplicação: Buva \(T1, T3 e T5\)\./.test(itens[0].texto)
    && itens.find((i) => i.titulo === "🐛 Pragas e insetos").texto === "• Percevejo — pressão ALTA · Ação urgente — Geral."
    && porT.length === 5 && porT[0].titulo === "T1 — 10 ha" && /^• 🌿 Buva — pressão ALTA/.test(porT[0].texto) && porT[4].titulo === "Geral"
    && comIA.length === itens.length && comIA[0].texto === "Texto da IA." && comIA[1].titulo === "Talhões visitados"
    && /^\*Visita técnica — Gisata\*\n19\/10\/2026 · Daniel\n\n\*Resumo da visita\*\nTexto da IA\./.test(txt) && !/undefined/.test(txt);
});

teste("previsão do tempo tem tela própria: chave de acesso, vista por padrão pelo pessoal de campo", () => {
  return C.ITENS_ACESSO.some((i) => i[0] === "previsao" && i[2] === "Campo") && C.CAMPO_VER.includes("previsao")
    && C.podeFazenda({ funcao: "Operador de máquinas" }, "previsao") && C.podeFazenda({ funcao: "Produtor" }, "previsao") && !C.podeFazenda({ funcao: "Produtor", permissoes: { previsao: false } }, "previsao")
    && C.podeFazenda({ funcao: "Operador de máquinas" }, "pluviometria") && !C.padraoAreaFazenda("Operador de máquinas", "financeiro");
});

teste("bordadura: contorno do talhão pelo KML (quadrado de 100 m ≈ 400 m) × barra × voltas vira área", () => {
  const lat = -10, dLat = 100 / 110574, dLon = 100 / (111320 * Math.cos(lat * Math.PI / 180));
  const q = [[-48, lat], [-48 + dLon, lat], [-48 + dLon, lat + dLat], [-48, lat + dLat]];
  const kml = { poligonos: [{ talhaoId: "t5", aneis: [q] }, { talhaoId: "t1", aneis: [[[-48, -10], [-47.99, -10], [-47.99, -9.99], [-48, -9.99], [-48, -10]]] }] };
  const p = C.perimetroDoTalhao(kml, "t5");
  return Math.abs(p - 400) < 8 && C.perimetroDoTalhao(kml, "x") === 0 && C.areaBordadura(400, 24, 1) === 0.96 && C.areaBordadura(400, 24, 2) === 1.92 && C.areaBordadura(400, 24, 0) === 0.96 && C.areaBordadura(2340, 24, "1") === 5.62;
});

teste("GPS da visita não pula de talhão na divisa: fica no atual, só troca bem dentro do outro e com leitura boa", () => {
  const lat = -10, dLat = 1000 / 110574, dLon = 1000 / (111320 * Math.cos(lat * Math.PI / 180));
  // dois quadrados de 1 km lado a lado: t4 à esquerda, t5 à direita, divisa em lon = -48 + dLon
  const q = (x0) => [[x0, lat], [x0 + dLon, lat], [x0 + dLon, lat + dLat], [x0, lat + dLat], [x0, lat]];
  const kml = { poligonos: [{ talhaoId: "t4", aneis: [q(-48)] }, { talhaoId: "t5", aneis: [q(-48 + dLon)] }] };
  const meio = lat + dLat / 2, divisa = -48 + dLon;
  const d = C.distanciaAoAnel(divisa + dLon / 2, meio, kml.poligonos[1].aneis[0]);
  return Math.abs(d - 500) < 5
    && C.talhaoPeloGps(kml, divisa + 5 / 111320 / Math.cos(lat * Math.PI / 180), meio, 8, "t4") === null   // 5 m dentro do t5: divisa, não mexe
    && C.talhaoPeloGps(kml, divisa + dLon / 2, meio, 8, "t4") === "t5"                                       // no meio do t5: troca
    && C.talhaoPeloGps(kml, divisa + dLon / 2, meio, 8, "t5") === "t5"                                       // já está nele
    && C.talhaoPeloGps(kml, divisa - dLon / 4, meio, 8, "t5") === "t4"                                       // 250 m dentro do t4
    && C.talhaoPeloGps(kml, divisa + dLon / 2, meio, 120, "t4") === null                                     // leitura ruim não conta
    && C.talhaoPeloGps(kml, divisa + 30 / 111320 / Math.cos(lat * Math.PI / 180), meio, 40, "t4") === null   // 30 m dentro mas erro de 40 m
    && C.talhaoPeloGps(kml, -47, meio, 8, "t4") === null;                                                    // fora de tudo
});

teste("relatório de parte dos talhões: filtra as observações pelos nomes escolhidos (Geral = sem talhão)", () => {
  const obs = [{ id: "1", talhaoNome: "T1", item: "a" }, { id: "2", talhaoNome: "T3", item: "b" }, { id: "3", talhaoNome: null, item: "c" }, { id: "4", talhaoNome: "T1", item: "d" }];
  const so1 = C.obsDosTalhoes(obs, ["T1"]), geral = C.obsDosTalhoes(obs, ["Geral", "T3"]);
  const itens = C.montarItensVisita(so1, [{ id: "t1", nome: "T1", areaHa: 10 }], []);
  return so1.map((o) => o.id).join() === "1,4" && geral.map((o) => o.id).join() === "2,3" && C.obsDosTalhoes(obs, []).length === 0 && C.obsDosTalhoes(null, ["T1"]).length === 0
    && itens.some((i) => /• T1: a|a — T1/.test(i.texto) || /a — T1/.test(i.texto)) && !itens.some((i) => /T3/.test(i.texto));
});

teste("teste de calda: quantidade no jarro = dose × volume ÷ vazão (mL ou g), pré-diluição quando é pouco, ordem de mistura pela formulação", () => {
  const prods = [{ nome: "Herbicida", formulacao: "SL", dose: 0.5, unidade: "L/ha" }, { nome: "Fungicida", formulacao: "WG", dose: 100, unidade: "g/ha" }, { nome: "Inseticida", formulacao: "EC", dose: 20, unidade: "mL/ha" }, { nome: "Óleo", formulacao: "adjuvante", dose: 0.5, unidade: "L/ha" }];
  const q = C.quantidadesTesteCalda(prods, 100, 1);
  const kg = C.quantidadesTesteCalda([{ nome: "Pó", dose: 1.5, unidade: "kg/ha" }], 150, 2)[0];
  const ordem = C.ordemDeMistura(prods.map((p) => ({ ...p, nome: C.nomeComFormulacao(p) })), (n) => C.infoCaldaDe(prods.find((p) => C.nomeComFormulacao(p) === n)));
  return q.length === 4 && q[0].qtd === 5 && q[0].un === "mL" && !q[0].preDiluicao
    && q[1].qtd === 1 && q[1].un === "g" && q[1].preDiluicao.solucaoMl === 100
    && q[2].qtd === 0.2 && q[2].un === "mL" && q[2].preDiluicao.solucaoMl === 20
    && kg.qtd === 20 && kg.un === "g" && !kg.preDiluicao
    && ordem.ordenados.map((p) => p.nome).join("|") === "Fungicida WG|Inseticida EC|Herbicida SL|Óleo" && !ordem.jaCerta
    && C.quantidadesTesteCalda(prods, 0, 1).length === 0 && C.PASSOS_TESTE_CALDA.length === 6;
});

teste("partes do talhão (A/B): corte do contorno por uma reta, áreas dos lados, DAE por parte, parte pelo GPS, fungicida por parte", () => {
  const lat = -10, dLat = 1000 / 110574, dLon = 1000 / (111320 * Math.cos(lat * Math.PI / 180));
  const q = [[-48, lat], [-48 + dLon, lat], [-48 + dLon, lat + dLat], [-48, lat + dLat], [-48, lat]];
  const x30 = -48 + dLon * 0.3;
  const lados = C.dividirAnelPorLinha(q, [x30, lat - 0.001], [x30, lat + dLat + 0.001]);
  const aE = C.areaPoligonoHa([lados[0]]), aD = C.areaPoligonoHa([lados[1]]);
  const l = { talhaoId: "t2", cultura: "Soja", partes: [{ areaHa: 30, dataEmergencia: "2026-10-11", anel: lados[0].map(([x, y]) => ({ x, y })) }, { areaHa: 70, dataEmergencia: "2026-10-17", anel: lados[1] }] };
  const t2 = { id: "t2", nome: "02", areaHa: 100 };
  const pl = C.partesDaLavoura(l, t2, "2026-10-19");
  const fz = { talhoes: [t2] };
  const apls = [{ id: "a1", tipo: "Fungicida", modulo: "pulverizacao", talhaoIds: ["t2"], partesAlvo: { t2: "A" }, produtos: [{ nome: "Fox" }], execucoes: { t2: { data: "2026-10-18" } } }];
  const fg = C.resumoFungicidas(fz, apls, [l], "2026-10-19");
  const fA = fg.find((x) => x.parte === "A"), fB = fg.find((x) => x.parte === "B");
  return Math.abs(aE - 30) < 0.6 && Math.abs(aD - 70) < 0.6 && Math.abs(aE + aD - 100) < 0.2
    && pl.length === 2 && pl[0].nome === "A" && pl[1].nome === "B" && pl[0].dae === 8 && pl[1].dae === 2 && Array.isArray(pl[0].anel[0]) && Array.isArray(pl[1].anel[0])
    && C.parteDoPonto(pl, -48 + dLon * 0.1, lat + dLat / 2).nome === "A" && C.parteDoPonto(pl, -48 + dLon * 0.9, lat + dLat / 2).nome === "B" && C.parteDoPonto(pl, -47, lat) === null
    && C.partesDaLavoura({ partes: [{ areaHa: 10 }] }, {}).length === 0 && C.dividirAnelPorLinha(q, [x30, lat], [x30, lat]) === null
    && fg.length === 2 && fA.dae === 8 && fB.dae === 2 && fA.feitas.length === 1 && fB.feitas.length === 0 && fA.areaHa === 30;
});

teste("teste de calda: produtos da recomendação viram linhas com dose/ha, unidade e formulação pela sigla (dose → mL pelo mL/dose)", () => {
  const a = { produtos: [{ nome: "Fox Xpro 200 SC", dose: 0.5, unidade: "L" }, { nome: "Engeo Pleno S", dose: 200, unidade: "mL" }, { nome: "Unizeb Gold WG", dose: 1.5, unidade: "kg" }, { nome: "Boro", dose: 300, unidade: "g" }, { nome: "Inoculante", dose: 2, unidade: "dose", mlPorDose: 100 }, { nome: "", dose: 1 }, { nome: "Sem dose", dose: 0 }] };
  const l = C.linhasDaRecomendacao(a);
  return l.length === 5 && l[0].formulacao === "SC" && l[0].dose === "0.5" && l[0].unidade === "L/ha" && l[1].formulacao === "" && l[1].unidade === "mL/ha" && l[2].formulacao === "WG" && l[2].unidade === "kg/ha"
    && l[3].unidade === "g/ha" && l[4].dose === "200" && l[4].unidade === "mL/ha" && C.linhasDaRecomendacao(null).length === 0;
});

teste("monitoramento: doenças da cultura entram na ficha por presença (pano e presença), sem repetir as do algodão; no pano a doença sai em %", () => {
  const soja = C.fichaDe("Soja", "pano"), alg = C.fichaDe("Algodão", "presenca"), milho = C.fichaDe("Milho", "presenca");
  const d = soja.filter((i) => i.doenca);
  const mon = { metodo: "pano", cultura: "Soja", itens: soja, pontos: [{ pragas: { "Lagarta-da-soja": 3, "Doença · Ferrugem-asiática": true } }, { pragas: { "Lagarta-da-soja": 1 } }] };
  const q = C.quadroPragas(mon); const fer = q.find((x) => x.chave === "Doença · Ferrugem-asiática"), lag = q.find((x) => x.chave === "Lagarta-da-soja");
  const acima = C.pragasAcima({ niveis: { Soja: { "Doença · Ferrugem-asiática": 30 } } }, mon);
  return d.length === C.DOENCAS_PADRAO.Soja.length && d.every((i) => i.tipo === "toggle" && i.grupo === "Doenças") && soja[0].tipo === "numero"
    && alg.filter((i) => i.doenca).length === C.DOENCAS_PADRAO.Algodão.length - 3 && !alg.some((i) => i.doenca && /Ramul|Mirot|Mofo/.test(i.nome)) && alg.some((i) => i.grupo === "Ramulária")
    && milho.some((i) => i.nome === "Mancha-branca" && i.tipo === "toggle") && C.doencasDe("Outra").length > 0
    && fer.pct === 50 && lag.media === 2 && acima.length === 1 && acima[0].unidade === "%" && acima[0].valor === 50;
});

teste("plantio feito → emergência prevista 4 dias após o fim do plantio; etapas viram partes com emergência própria; não mexe no que já estava", () => {
  const t2 = { id: "t2", nome: "02", areaHa: 100, cultura: "Soja" };
  const apl = { modulo: "semeadura", cultura: "Soja", produtos: [{ nome: "M8808", uso: "semente", dose: 1, unidade: "bag" }] };
  const r1 = C.lavouraComEmergenciaDoPlantio([], t2, apl, { data: "2026-10-05T15:00:00.000Z", areaExecutada: 100 }, "l-novo");
  const ex2 = { data: "2026-10-05T15:00:00.000Z", dataFim: "2026-10-13", etapas: [{ inicio: "2026-10-05", fim: "2026-10-06", areaHa: 92 }, { inicio: "2026-10-12", fim: "2026-10-13", areaHa: 8, variedade: "BRS 7380" }], areaExecutada: 100 };
  const r2 = C.lavouraComEmergenciaDoPlantio([{ id: "l1", talhaoId: "t2", cultura: "Soja", variedade: "M8808" }], t2, apl, ex2, "x");
  const r3 = C.lavouraComEmergenciaDoPlantio([{ id: "l1", talhaoId: "t2", cultura: "Soja", variedade: "M8808", dataPlantio: "2026-10-05", dataPlantioFim: "2026-10-05", dataEmergencia: "2026-10-12" }], t2, apl, { data: "2026-10-05T15:00:00.000Z" }, "x");
  const r4 = C.lavouraComEmergenciaDoPlantio([], t2, { modulo: "pulverizacao" }, { data: "2026-10-05T15:00:00.000Z" }, "x");
  return r1 && r1.registro.id === "l-novo" && r1.registro.dataEmergencia === "2026-10-09" && r1.registro.emergenciaAuto === true && r1.registro.dataPlantio === "2026-10-05" && r1.registro.variedade === "M8808" && r1.lista.length === 1
    && r2 && r2.partes === 2 && r2.registro.partes[0].dataEmergencia === "2026-10-10" && r2.registro.partes[1].dataEmergencia === "2026-10-17" && r2.registro.partes[1].variedade === "BRS 7380" && r2.registro.partes[0].areaHa === 92 && r2.registro.dataEmergencia === "2026-10-10" && r2.registro.dataPlantioFim === "2026-10-13"
    && r3 === null && r4 === null && C.DIAS_ATE_EMERGENCIA === 4;
});

teste("visita: 'mais opções' tem daninhas do cerrado e entra no dicionário da transcrição", () => {
  const mais = C.OBS_CATALOGO_MAIS["🌿 Daninha"];
  const d = C.dicasVozDe([{ nome: "T1" }]);
  return mais.includes("Capim-andropogon") && mais.includes("Fedegoso") && Object.keys(C.OBS_CATALOGO_MAIS).every((k) => k in C.OBS_CATALOGO)
    && d.includes("Capim andropogon") && d.includes("Fedegoso") && d.includes("Capim braquiária") && d.includes("T1");
});

teste("dicas de preparo da calda pela formulação (WG pré-dissolver, óleo por último, biológico com tanque cheio)", () => {
  const info = (n) => (/oleo/i.test(n) ? { categoria: "Adjuvante" } : /inoculante/i.test(n) ? { categoria: "Biológico" } : { categoria: "Fungicida" });
  const d = C.dicasDaCalda([{ nome: "Mancozebe WG" }, { nome: "Fox Xpro SC" }, { nome: "Óleo mineral" }, { nome: "Inoculante" }], info);
  const nada = C.dicasDaCalda([], info);
  return d[0] === C.DICAS_CALDA.po && d.includes(C.DICAS_CALDA.sc) && d.includes(C.DICAS_CALDA.oleo) && d[d.length - 1] === C.DICAS_CALDA.bio && !d.includes(C.DICAS_CALDA.ec) && nada.length === 0;
});

teste("tanques em sequência: sobra do tanque segue para o próximo talhão; só o último tem tanque parcial", () => {
  const a = C.sequenciaDeTanques([120, 80], 100, 2500);     // 12.000 L + 8.000 L
  const b = C.sequenciaDeTanques([100, 70], 100, 2500);     // 10.000 L (4 cheios) + 7.000 L (2 cheios + 2.000 parcial)
  const c = C.sequenciaDeTanques([200, 150], 100, 2500);    // fecha certinho
  return a[0].cheios === 5 && a[0].carryOut === 500 && a[0].parcial === 0 && a[1].carryIn === 500 && a[1].cheios === 3 && a[1].parcial === 0 && a[1].ultimo
    && b[0].cheios === 4 && b[0].carryOut === 0 && b[1].cheios === 2 && b[1].parcial === 2000 && Math.abs(b[1].areaParcial - 20) < 1e-9
    && c[0].cheios === 8 && c[1].cheios === 6 && c[1].parcial === 0 && C.sequenciaDeTanques([10], 0, 2500).length === 0;
});

teste("armadilhas: última contagem por armadilha e nível relativo (alto perto da maior, zero verde, sem contagem cinza)", () => {
  const arm = [{ id: "a", nome: "A1" }, { id: "b", nome: "A2" }, { id: "c", nome: "A3" }, { id: "d", nome: "A4" }];
  const le = [{ armadilhaId: "a", data: "2026-10-01", qtd: 30 }, { armadilhaId: "a", data: "2026-10-10", qtd: 12 }, { armadilhaId: "b", data: "2026-10-10", qtd: 2 }, { armadilhaId: "c", data: "2026-10-10", qtd: 0 }];
  const r = C.resumoArmadilhas(arm, le);
  return r[0].qtd === 12 && r[0].nivel === "alto" && r[0].leituras.length === 2 && r[1].nivel === "baixo" && r[2].nivel === "zero" && r[3].nivel === "sem" && r[3].qtd === null;
});

teste("fotos das visitas viram registros próprios: data:image → foto:ID (repetida = mesma ref), refs listadas, visita sem a foto", () => {
  const foto = "data:image/jpeg;base64,AAAA", foto2 = "data:image/jpeg;base64,BBBB";
  const vis = [{ id: "v1", obsCampo: [{ img: foto, fotos: [foto] }], itens: [{ titulo: "x", fotos: [foto, foto2] }] }, { id: "v2", itens: [{ titulo: "y", fotos: [] }], texto: "sem foto" }];
  const r = C.extrairFotosDasVisitas(vis);
  const refs = C.refsDeFotos(r.lista[0]);
  return r.fotos.length === 2 && r.fotos.every((f) => f.visitaId === "v1" && f.dados.startsWith("data:image/")) && r.lista[0].obsCampo[0].img === "foto:" + r.fotos[0].id
    && r.lista[0].itens[0].fotos[1] === "foto:" + r.fotos[1].id && refs.length === 4 && new Set(refs).size === 2 && !JSON.stringify(r.lista).includes("data:image")
    && r.lista[1].texto === "sem foto" && vis[0].itens[0].fotos[0] === foto && C.MAX_FOTOS_VISITA >= 60;
});

teste("programa de compra: bag de 4 milhões no passo de semeadura muda a quantidade de bags (população ÷ sementes do bag)", () => {
  const fz = { id: "f", talhoes: [{ id: "t1", nome: "T1", areaHa: 100, cultura: "Soja" }] };
  const passo = (bag) => [{ modulo: "semeadura", ref: "plantio", dias: 0, tipo: "Semeadura", populacao: 300000, sementesPorBag: bag, produtos: [{ nome: "Lenda", uso: "semente", unidade: "bag" }] }];
  const q = (bag) => C.consumoPorTalhao(fz, { "agrocr:programa:f:Soja": passo(bag) })[0].produtos[0];
  return C.bagDoPasso({ sementesPorBag: 4000000 }) === 4000000 && C.bagDoPasso({}) === 5000000
    && Math.abs(q(null).qtd - 6) < 1e-9 && Math.abs(q(4000000).qtd - 7.5) < 1e-9 && q(4000000).sementesPorBag === 4000000 && q(4000000).base === "bag";
});

teste("variedades em cadeia: cada uma cobre o que o saldo dá na população; a última fecha e avisa o que falta; estoque baixa por variedade", () => {
  // 100 ha a 300 mil/ha, bag de 5 milhões → 0,06 bag/ha. A: 3 bags cobre 50 ha; B: 1,2 bags cobre 20 ha; C fecha 30 ha (precisa 1,8, tem 1 → falta 0,8)
  const pl = C.planoDeVariedades([{ nome: "A", saldo: 3, unidade: "bag", porBag: 5000000 }, { nome: "B", saldo: 1.2, unidade: "bag", porBag: 5000000 }, { nome: "C", saldo: 1, unidade: "bag", porBag: 5000000 }], 300000, 100);
  const okPlano = pl.length === 3 && pl[0].areaHa === 50 && pl[1].areaHa === 20 && pl[2].areaHa === 30 && Math.abs(pl[2].falta - 0.8) < 1e-6 && pl[0].falta === 0;
  // bag de 4 milhões na B: dose 0,075 → 1,2 bags cobre 16 ha
  const pl2 = C.planoDeVariedades([{ nome: "A", saldo: 3, unidade: "bag", porBag: 5000000 }, { nome: "B", saldo: 1.2, unidade: "bag", porBag: 4000000 }], 300000, 100);
  const okBag = pl2[1].areaHa === 50 && Math.abs(pl2[1].dose - 0.075) < 1e-9 && pl2[1].cobre === 16;
  const sai = C.consumoDaExecucao([{ nome: "A", dose: "0.06", unidade: "bag", uso: "semente", variedades: pl }], {}, 100);
  const okSai = sai.length === 3 && sai.map((x) => x.nome).join() === "A,B,C" && Math.abs(sai[0].v - 3) < 1e-9 && Math.abs(sai[1].v - 1.2) < 1e-9 && Math.abs(sai[2].v - 1.8) < 1e-9 && sai[2].variedadeTrocada === "A";
  const sai2 = C.consumoDaExecucao([{ nome: "A", dose: "0.06", unidade: "bag", uso: "semente", variedades: pl }], {}, 50);   // executou metade: proporcional
  return okPlano && okBag && okSai && Math.abs(sai2[0].v - 1.5) < 1e-9 && C.planoDeVariedades([], 300000, 100).length === 0;
});

teste("variedade com população própria: dose e hectares cobertos pela população dela", () => {
  // A 300 mil (0,06 bag/ha), B 240 mil (0,048): 1,2 bag cobre 25 ha
  const pl = C.planoDeVariedades([{ nome: "A", saldo: 3, unidade: "bag", porBag: 5000000 }, { nome: "B", saldo: 1.2, unidade: "bag", porBag: 5000000, populacao: 240000 }, { nome: "C", saldo: 5, unidade: "bag", porBag: 5000000 }], 300000, 100);
  return pl[1].areaHa === 25 && Math.abs(pl[1].dose - 0.048) < 1e-9 && pl[1].populacao === 240000 && pl[0].populacao === 300000 && pl[2].areaHa === 25 && pl[2].falta === 0;
});

teste("adubo a lanço: carga de 1.500 kg a 200 kg/ha = 7,5 ha por carga; 100 ha = 13 cheias + 1 parcial de 2,5 ha (500 kg)", () => {
  const c = C.cargasDoDistribuidor(200, 1500, 100);
  return c && Math.abs(c.haPorCarga - 7.5) < 1e-9 && c.cheias === 13 && Math.abs(c.sobraHa - 2.5) < 1e-9 && Math.abs(c.sobraKg - 500) < 1e-6 && c.cargas === 14 && c.totalKg === 20000
    && C.cargasDoDistribuidor(200, 1500, 0) === null && C.ehDistribuidor({ tipo: "Distribuidor a lanço" }) && !C.ehDistribuidor({ tipo: "Pulverizador" });
});

teste("mapa de variedades programado: sem recomendação, o talhão vem do Planejamento de insumos (talhão marcado, ou único item sem talhão)", () => {
  const talhoes = [{ id: "t1", nome: "T1", areaHa: 100, cultura: "Soja" }, { id: "t2", nome: "T2", areaHa: 50, cultura: "Soja" }, { id: "t3", nome: "T3", areaHa: 30, cultura: "Soja" }];
  const plano = [{ produto: "M8808", categoria: "Sementes", unidade: "bag", qtd: 6, talhaoIds: ["t1"], populacao: 300000 }, { produto: "Lenda", categoria: "Sementes", unidade: "bag", qtd: 3, talhaoIds: ["t2"] }, { produto: "Glifosato", categoria: "Herbicida", unidade: "L", qtd: 100 }];
  const apls = [{ modulo: "semeadura", talhaoIds: ["t3"], populacao: 280000, espacamento: 45, produtos: [{ nome: "BRS 7380", uso: "semente", unidade: "bag", dose: "0.056" }] }];
  const l = C.linhasMapaVariedades(talhoes, [], apls, "programado", null, plano);
  const t1 = l.find((x) => x.talhaoId === "t1"), t2 = l.find((x) => x.talhaoId === "t2"), t3 = l.find((x) => x.talhaoId === "t3");
  const unico = C.linhasMapaVariedades([talhoes[0]], [], [], "programado", null, [{ produto: "Lenda", categoria: "Sementes", unidade: "bag", qtd: 3 }]);
  return t1.variedade === "M8808" && t1.origem === "planejamento" && t1.populacao === 300000 && t2.variedade === "Lenda" && t3.variedade === "BRS 7380" && t3.origem === "recomendacao" && unico[0].variedade === "Lenda";
});

teste("produto em dose com mL por dose: 10 doses/ha × 300 mL em 25 ha = 75 L (250 doses); sem mL fica em doses", () => {
  const a = C.totalProduto(10, "dose", 25, 300), b = C.totalProduto(10, "dose", 25), c = C.totalProduto(1, "dose", 2, 300);
  return a.v === 75 && a.un === "L" && a.doses === 250 && b.v === 250 && b.un === "dose" && !b.doses && c.v === 600 && c.un === "mL" && c.doses === 2;
});

teste("variedades em cadeia por talhão: Guepardo 250 ha depois Olimpo 198,92; talhão 1 de 201,47 ha e talhão 2 de 247,45 ha", () => {
  const vs = [{ nome: "Guepardo", dose: 0.064, unidade: "bag", areaHa: 250 }, { nome: "Olimpo", dose: 0.0471, unidade: "bag", areaHa: 198.92 }];
  const t1 = C.fatiaDasVariedades(vs, 0, 201.47), t2 = C.fatiaDasVariedades(vs, 201.47, 247.45);
  return t1.length === 1 && t1[0].nome === "Guepardo" && t1[0].ha === 201.47 && t2.length === 2 && t2[0].nome === "Guepardo" && t2[0].ha === 48.53 && t2[1].nome === "Olimpo" && t2[1].ha === 198.92;
});

teste("previsão no mapa: soma do período usa a previsão até o 16º dia e a tendência sazonal depois; centro do talhão pelo KML", () => {
  const dias = []; for (let i = 0; i < 16; i++) dias.push(C.somarDias("2026-10-19", i));
  const p = { dias, mm: dias.map((_, i) => (i < 3 ? 10 : 0)), prob: dias.map(() => 50) };
  const saz = { dias: Array.from({ length: 45 }, (_, i) => C.somarDias("2026-10-19", i)), mm: Array.from({ length: 45 }, (_, i) => (i >= 16 ? 2 : 99)) };
  const a = C.mmDoPeriodo(p, saz, 0, 1), b = C.mmDoPeriodo(p, saz, 0, 7), c = C.mmDoPeriodo(p, saz, 0, 30), d = C.mmDoPeriodo(p, null, 0, 30);
  const cen = C.centroidesDosTalhoes({ poligonos: [{ talhaoId: "t1", aneis: [[[-48, -9], [-48.02, -9], [-48.02, -9.02], [-48, -9.02]]] }, { talhaoId: "x", aneis: [[[0, 0]]] }] }, [{ id: "t1", nome: "T1", areaHa: 40 }]);
  return a.mm === 10 && !a.tendencia && b.mm === 30 && c.mm === 30 + 14 * 2 && c.tendencia && d.mm === 30 && !d.tendencia && cen.length === 1 && Math.abs(cen[0].lat + 9.01) < 1e-9 && Math.abs(cen[0].lng + 48.01) < 1e-9;
});

teste("safra provável pela data da nota: julho a junho", () => {
  return C.safraDaData("2026-03-15") === "2025/2026" && C.safraDaData("2026-07-01") === "2026/2027" && C.safraDaData("2026-12-31") === "2026/2027" && C.safraDaData("2027-06-30") === "2026/2027" && C.safraDaData("") === "" && C.safraDaData("x") === "";
});

teste("função antiga vira nome atual da lista", () => {
  return C.normalizarFuncao("Monitor") === "Monitor de campo" && C.normalizarFuncao("Operador") === "Operador de máquinas" && C.normalizarFuncao("Gerente") === "Gerente" && C.normalizarFuncao("Agrônomo") === "Engenheiro agrônomo" && C.normalizarFuncao("") === "Produtor" && C.normalizarFuncao("Escritório") === "Escritório";
});

teste("entrega pela nota: casa a descrição da nota com o produto comprado", () => {
  const L = [{ produto: "Glifosato 480", base: "L" }, { produto: "Óleo mineral", base: "L" }, { produto: "Fox Xpro", base: "L" }, { produto: "MAP", base: "kg" }, { produto: "Semente soja M8808", base: "kg" }];
  const c = (d) => { const l = C.casarItemNota(d, L); return l ? l.produto : null; };
  return c("GLIFOSATO 480 SL 20L") === "Glifosato 480" && c("Oleo Mineral Assist 20 LT") === "Óleo mineral" && c("FOX XPRO 5L") === "Fox Xpro" && c("MAP 11-52-00 BB 1000KG") === "MAP"
    && c("SEMENTE DE SOJA M 8808 I2X BAG 500KG") === "Semente soja M8808" && c("FRETE") === null && c("") === null;
});

teste("continuação de produto: fases da calda em tanques cheios, dose equivalente e baixa proporcional", () => {
  // tanque 2000 L a 100 L/ha = 20 ha por tanque; A tem 150 L em estoque a 2 L/ha = 40 L por tanque → 3 tanques cheios = 60 ha
  const produtos = [{ nome: "Glifosato 480", dose: "2", unidade: "L", continuacao: { nome: "Zapp QI 620", dose: "1.55", unidade: "L", saldoBase: 150 } }, { nome: "Óleo", dose: "0.5", unidade: "L" }];
  const f = C.fasesDaCalda(produtos, 100, 2000, 100);
  const sem = C.fasesDaCalda([{ nome: "X", dose: "1", unidade: "L" }], 100, 2000, 100);
  const sobra = C.fasesDaCalda([{ nome: "A", dose: "1", unidade: "L", continuacao: { nome: "B", dose: "1", unidade: "L", saldoBase: 1000 } }], 100, 2000, 50);
  const estoque = C.calcularEstoqueDe({ talhoes: [{ id: "t", areaHa: 100 }] }, [{ produto: "Glifosato 480", categoria: "Herbicida", qtd: 150, unidade: "L" }, { produto: "Zapp QI 620", categoria: "Herbicida", qtd: 500, unidade: "L" }],
    [{ talhaoIds: ["t"], execucoes: { t: { data: "2026-10-06" } }, produtos: [{ nome: "Glifosato 480", dose: "2", unidade: "L", continuacao: { nome: "Zapp QI 620", dose: "1.55", unidade: "L", fracao: 0.6 } }] }], [], []);
  const gl = estoque.find((l) => l.produto === "Glifosato 480"), zp = estoque.find((l) => l.produto === "Zapp QI 620");
  return f.length === 2 && f[0].area === 60 && f[0].tanques === 3 && f[1].area === 40 && f[1].produtos[0].nome === "Zapp QI 620" && f[1].produtos[1].nome === "Óleo"
    && Math.abs(C.fracaoContinuacao(produtos, 100, 2000, 100) - 0.6) < 1e-9 && sem.length === 1 && sobra.length === 1
    && C.doseEquivalente(2, "Glifosato (480 g/L)", "Glifosato (620 g/L)") === 1.548 && C.doseEquivalente(2, "Glifosato (480 g/L)", "2,4-D (806 g/L)") === null && C.doseEquivalente(2, "Glifosato (480 g/L)", "Glifosato") === null
    && C.concentracaoDoAtivo("Glifosato (720 g/kg)") === 720 && C.nomeDoAtivo("Glifosato (480 g/L)") === "glifosato" && C.nomeDoAtivo("glifosato-sal de potássio (glicina substituída) (620 g/L)") === "glifosato" && C.nomeDoAtivo("glifosato-sal de isopropilamina (glicina substituída) (480 g/L)") === "glifosato" && C.nomeDoAtivo("2,4-D-trietanolamina (ácido ariloxialcanóico) (402 g/L) + picloram-trietanolamina (x) (103 g/L)") === "2,4-d + picloram"
    && C.doseEquivalente(2, "glifosato-sal de isopropilamina (glicina substituída) (480 g/L)", "glifosato-sal de potássio (glicina substituída) (620 g/L)") === 1.548
    && Math.abs(gl.usado - 120) < 1e-9 && Math.abs(zp.usado - 62) < 1e-9
    && (() => { const c = C.consumoDaExecucao([{ nome: "A", dose: "2", unidade: "L", continuacao: { nome: "B", dose: "1", unidade: "L", fracao: 0.5 } }], { produtosReais: [{ nome: "A", qtd: "90", unidade: "L" }, { nome: "B", qtd: "55", unidade: "L" }] }, 100); return c.length === 2 && c[0].v === 90 && c[1].v === 55 && c[1].real && c[1].continuacaoDe === "A"; })()
    && (() => { const c = C.consumoDaExecucao([{ nome: "A", dose: "2", unidade: "L", continuacao: { nome: "B", dose: "1", unidade: "L", fracao: 0.5 } }], { produtosReais: [{ nome: "A", qtd: "90", unidade: "L" }] }, 100); return c.length === 2 && c[0].v === 90 && c[1].v === 50 && !c[1].real; })();
});

teste("nota do escritório × chegada: liga a entrega, desconta o já recebido e não deixa duplicar", () => {
  const nota = { id: "n1", numero: "000123", emitente: "Agro Revenda", data: "2026-10-01", status: "destinada", ciclo: "Safra",
    itens: [{ descricao: "GLIFOSATO NORTOX 480 SL", qtd: 200, unidade: "LT", destino: C.DESTINO_INSUMO }, { descricao: "OLEO MINERAL", qtd: 50, unidade: "L", destino: C.DESTINO_INSUMO }, { descricao: "FRETE", qtd: 1, unidade: "un", destino: "Frete" }] };
  const prog = [{ id: "p1", produto: "Glifosato Nortox 480 SL", ciclo: "Safra", qtd: 200, unidade: "L", notasIds: ["n1"] }, { id: "p2", produto: "Óleo mineral", ciclo: "Safra", qtd: 50, unidade: "L" }];
  const a = C.notasComChegada([nota], [], prog);
  const b = C.notasComChegada([nota], [{ produto: "Glifosato Nortox 480 SL", qtd: 200, notaId: "n1", dataEntrega: "2026-10-05", quem: "Zé" }], prog);
  const c = C.notasComChegada([nota], [{ produto: "Glifosato Nortox 480 SL", qtd: 200, notaId: "n1", dataEntrega: "2026-10-05", quem: "Zé" }, { produto: "Óleo mineral", qtd: 50, nf: "123", dataEntrega: "2026-10-06", quem: "Zé" }], prog);
  return C.mesmaNf("000123", "123") && !C.mesmaNf("", "") && !C.mesmaNf("124", "123")
    && a.length === 1 && a[0].aguardando && a[0].itens.length === 2 && a[0].itens[0].produto === "Glifosato Nortox 480 SL" && a[0].itens[0].resta === 200 && a[0].itens[1].produto === "Óleo mineral" && a[0].itens[1].resta === 50
    && b[0].aguardando && b[0].itens[0].resta === 0 && b[0].itens[0].recebido === 200 && b[0].itens[1].resta === 50
    && !c[0].aguardando && c[0].chegouEm === "2026-10-06" && c[0].recebidoPor === "Zé"
    && C.notaJaLancada("123", [nota], []).onde === "escritorio" && C.notaJaLancada("123", [], [{ obs: "NF 000123 · Agro Revenda", data: "2026-10-01", produto: "X" }]).onde === "programacao" && C.notaJaLancada("999", [nota], prog) === null && C.notaJaLancada("", [nota], prog) === null;
});

teste("barter do grupo: rateio pela área, correção à mão e a soma sempre fecha no total", () => {
  const irmas = [{ id: "b", areaHa: 300 }, { id: "c", areaHa: 200 }];
  const r = C.ratearSacas(10000, 500, irmas, {}), m = C.ratearSacas(10000, 500, irmas, { b: "2500" }), z = C.ratearSacas(1000, 0, [], null);
  return r.partes[0].sacas === 3000 && r.partes[1].sacas === 2000 && r.aqui === 5000
    && m.partes[0].sacas === 2500 && m.partes[1].sacas === 2000 && m.aqui === 5500 && z.aqui === 1000 && z.partes.length === 0
    && Math.abs(C.ratearSacas(1000, 100, [{ id: "x", areaHa: 200 }], {}).aqui + C.ratearSacas(1000, 100, [{ id: "x", areaHa: 200 }], {}).partes[0].sacas - 1000) < 0.001;
});

teste("funções: padrão de permissões por função e quem é de campo", () => {
  const prod = C.permissoesDaFuncao("Produtor"), ger = C.permissoesDaFuncao("Gerente"), eng = C.permissoesDaFuncao("Engenheiro agrônomo"), mon = C.permissoesDaFuncao("Monitor de campo"), esc = C.permissoesDaFuncao("Escritório"), op = C.permissoesDaFuncao("Operador de máquinas");
  return Object.values(prod).every(Boolean) && ger.acessos === false && ger.excluir === true && eng.recomendar === true && eng.excluir === false && eng.custos === false
    && mon.financeiro === false && mon.operacoes === true && mon.recomendar === false && esc.financeiro === true && esc.custos === true && esc.operacoes === false && esc.cadastrar === true
    && op.diesel === true && op.financeiro === false && Object.keys(C.permissoesDaFuncao("qualquer")).length === 0
    && C.funcaoDeCampo("Operador de máquinas") && C.funcaoDeCampo("Monitor") && C.funcaoDeCampo("Operador") && !C.funcaoDeCampo("Engenheiro agrônomo") && !C.funcaoDeCampo("Escritório")
    && C.podeFazenda({ funcao: "Escritório" }, "financeiro") && !C.podeFazenda({ funcao: "Monitor de campo" }, "financeiro");
});

teste("faixas de fertilidade: pH, K em cmolc, m% invertido, argila em g/kg e atributo sem tabela", () => {
  const ph = C.classeSolo("ph", 5.68, "CaCl₂"), baixo = C.classeSolo("ph", 4.4), alto = C.classeSolo("ph", 6.0), k = C.classeSolo("k", 0.12, "cmolc/dm³");   // 0,12 cmolc = 1,2 mmolc → Médio
  const m = C.classeSolo("m", 50, "%"), arg = C.classeSolo("argila", 400, "g/kg");
  return ph.nome === "Alto" && baixo.nome === "Baixo" && alto.nome === "Muito alto" && k.nome === "Médio" && m.nome === "Muito alto" && m.cor === "#D64541"
    && arg.nome === "Argilosa" && C.classeSolo("sb", 20) === null && C.classeSolo("ph", "") === null && C.FAIXAS_SOLO.pRes[2] === 40;
});

teste("solo: laudo avulso mais novo sem pontos não esconde o mapa; fazenda inteira junta os talhões com resultado", () => {
  const pt = (n, ph) => ({ n, lat: -10 - n / 1000, lng: -48 - n / 1000, valores: { ph } });
  const porPonto = { id: "a", tipo: "analise", talhaoId: "t5", profundidade: "0-20", data: "2026-05-15", pontos: [pt(1, 5), pt(2, 6), pt(3, 5.5)] };
  const avulsa = { id: "b", tipo: "analise", talhaoId: "t5", profundidade: "0 a 20 cm", data: "2026-05-30", valores: { ph: 5.96 } };
  const t1 = { id: "c", tipo: "analise", talhaoId: "t1", profundidade: "0-20", data: "2026-05-15", pontos: [pt(4, 4), pt(5, 4.4), pt(6, 4.2)] };
  const fundo = { id: "d", tipo: "analise", talhaoId: "t1", profundidade: "20-40", data: "2026-05-15", pontos: [pt(4, 4), pt(5, 4)] };
  const semPos = { id: "e", tipo: "analise", talhaoId: "t2", profundidade: "0-20", data: "2026-05-15", valores: { ph: 6 } };
  const g = C.soloDaFazenda([porPonto, avulsa, t1, fundo, semPos, { tipo: "coleta", talhaoId: "t5", pontos: [] }], "0-20");
  const r = C.resumoAtributoFazenda(g, "ph");
  return C.analiseDoMapa([porPonto, avulsa]).id === "a" && C.analiseDoMapa([avulsa]) === null
    && g.length === 2 && g.find((x) => x.talhaoId === "t5").analise.id === "a" && C.soloDaFazenda([fundo], "20-40").length === 1 && C.soloDaFazenda([semPos], "0-20").length === 0
    && r.fazenda.n === 6 && r.fazenda.min === 4 && r.fazenda.max === 6 && r.porTalhao.find((x) => x.talhaoId === "t1").media === 4.2 && C.resumoAtributoFazenda(g, "k").fazenda === null;
});

teste("pontos de coleta por KML: lê os marcadores, cai no talhão do desenho e usa o número do nome", () => {
  const kmlTxt = '<kml><Document><Placemark><name>P2</name><Point><coordinates>-48.535,-12.025,0</coordinates></Point></Placemark>' +
    '<Placemark><name><![CDATA[Ponto 1]]></name><Point><coordinates> -48.537,-12.022 </coordinates></Point></Placemark>' +
    '<Placemark><name>contorno</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-48.54,-12.02 -48.53,-12.02 -48.53,-12.03 -48.54,-12.02</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>' +
    '<Placemark><name>longe</name><Point><coordinates>-47.0,-10.0,0</coordinates></Point></Placemark></Document></kml>';
  const pts = C.lerPontosKML(kmlTxt);
  const mapa = { poligonos: [{ talhaoId: "t1", aneis: [[[-48.54, -12.02], [-48.531, -12.02], [-48.531, -12.029], [-48.54, -12.029], [-48.54, -12.02]]] }] };
  const r = C.repartirPontosKML(pts, mapa, null), r2 = C.repartirPontosKML(pts, mapa, "t9");
  const semNum = C.repartirPontosKML([{ nome: "a", lat: -12.022, lng: -48.537 }, { nome: "b", lat: -12.025, lng: -48.535 }], mapa, null);
  return pts.length === 3 && pts[0].nome === "P2" && pts[1].nome === "Ponto 1" && pts[1].lat === -12.022
    && r.porTalhao.t1.length === 2 && r.porTalhao.t1[0].n === 1 && r.porTalhao.t1[1].n === 2 && r.porTalhao.t1[0].origem === "kml" && r.fora.length === 1
    && r2.porTalhao.t9.length === 1 && r2.fora.length === 0 && semNum.porTalhao.t1.map((p) => p.n).join(",") === "1,2";
});

teste("laudo de laboratório (PDF com texto): 5 tabelas por amostra, conversão de unidade, conferência e ponto pelo número", () => {
  const linhas = ["Laboratório: LAB TESTE", "Data Conclusão Amostra: 15/05/2026 15:40:53", "Un mmolc/dm³",
    "SBAH26.63357 PONTO 01 0-20 5,72 6,35 7,13 28,50 16,20 12,30 0,00 16,72", "SBAH26.63364 PONTO 07 20-40 4,92 5,76 7,12 5,40 3,00 2,40 1,00 16,72",
    "SBAH26.63357 PONTO 01 0-20 0,21 8,06 9,41 2,50 2,67 17,10 9,92 0,17", "SBAH26.63364 PONTO 07 20-40 0,20 7,80 3,40 1,00 4,60 7,58 4,40 0,16",
    "SBAH26.63357 PONTO 01 0-20 0,10 30,00 1,50 0,30 1,00 70,0 30,00 900,0", "SBAH26.63364 PONTO 07 20-40 0,10 30,00 1,50 0,30 1,00 80,0 20,00 900,0",
    "SBAH26.63357 PONTO 01 0-20 45,43 63,20 0,00 35,66 27,07 0,46 36,80 1,32", "SBAH26.63364 PONTO 07 20-40 22,32 25,09 15,15 13,44 10,75 0,90 74,91 1,25",
    "Un cmolc/dm³ mmolc/dm³", "SBAH26.63357 PONTO 01 0-20 77,14 58,57 135,71 28,71", "SBAH26.63364 PONTO 07 20-40 15,00 12,00 27,00 5,60"];
  const lab = C.interpretarLaudoLab(linhas);
  const a = lab.amostras[0], b = lab.amostras[1];
  const cm = C.interpretarLaudoLab(["Un cmolc/dm³", "XX26.10001 PONTO 118 0-20 5,96 6,53 7,09 3,04 1,66 1,38 0,00 1,12", "XX26.10001 PONTO 118 0-20 0,07 26,86 5,70 3,00 1,20 22,09 12,81 0,17", "XX26.10001 PONTO 118 0-20 0,10 52,00 4,26 0,25 1,00 95,0 55,00 850,0", "XX26.10001 PONTO 118 0-20 4,23 73,52 0,00 39,24 32,62 1,65 26,48 1,20", "XX26.10001 PONTO 118 0-20 23,71 19,71 43,43 3,11"]);
  const coletas = [{ talhaoId: "t1", pontos: [{ n: 1, lat: -10.1, lng: -47.1 }] }, { talhaoId: "t2", pontos: [{ n: 7, lat: -10.2, lng: -47.2 }] }];
  const g = C.gruposDoLaudoLab(lab, [{ id: "t1", nome: "A" }, { id: "t2", nome: "B" }], coletas, null);
  const semMapa = C.gruposDoLaudoLab(lab, [{ id: "t1", nome: "A" }], [], null);
  return lab.amostras.length === 2 && lab.data === "2026-05-15" && lab.laboratorio === "LAB TESTE" && !lab.cmolc && lab.avisos.length === 0
    && a.ponto === 1 && a.prof === "0-20" && a.valores.ph === 5.72 && a.valores.ca === 16.2 && a.valores.sb === 28.71 && a.valores.ctc === 45.43 && a.valores.argila === 7 && a.valores.areia === 90 && a.extras.phAgua === 6.35
    && b.ponto === 7 && b.prof === "20-40" && cm.cmolc && cm.amostras[0].valores.ca === 16.6 && cm.amostras[0].valores.ctc === 42.3 && cm.amostras[0].valores.argila === 9.5 && cm.amostras[0].ponto === 118
    && C.interpretarLaudoLab(["texto qualquer", "NF 123 produto 10,00"]) === null
    && g.grupos.length === 2 && g.grupos[0].talhaoId === "t1" && g.grupos[0].pontos[0].lat === -10.1 && g.grupos[1].talhaoId === "t2" && g.grupos[1].profundidade === "20-40" && g.avisos.length === 0
    && semMapa.grupos.length === 0 && /KML dos pontos/.test(semMapa.avisos[0]);
});

// ---------- sementes por metro ----------
teste("sementesPorMetro: 100.000 sementes/ha a 76 cm = 7,6 por metro", () => Math.abs(C.sementesPorMetro(100000, 76) - 7.6) < 1e-9);
teste("sementesPorMetro: 300.000 sementes/ha a 45 cm = 13,5 por metro; sem espaçamento dá 0", () => Math.abs(C.sementesPorMetro(300000, 45) - 13.5) < 1e-9 && C.sementesPorMetro(300000, 0) === 0);
teste("espacamentoPadraoDe: algodão 76, milho 50, soja 45", () => C.espacamentoPadraoDe("Algodão") === 76 && C.espacamentoPadraoDe("Milho") === 50 && C.espacamentoPadraoDe("Soja") === 45);

// ---------- ingrediente ativo nas listas ----------
teste("ativoDoProduto: produto do banco embutido tem ativo e concentração", () => /\d/.test(C.ativoDoProduto("Roundup WG")) && C.ativoDoProduto("Roundup WG").toLowerCase().includes("glifosato"));
teste("ativoDoProduto: o que foi guardado no item vale mais que o catálogo; desconhecido dá vazio", () => C.ativoDoProduto("Roundup WG", "teste 1 g/L") === "teste 1 g/L" && C.ativoDoProduto("Produto Inventado XYZ") === "" && C.ativoTxt("Produto Inventado XYZ") === "");
teste("ativoTxt: vem entre parênteses para relatórios e mensagens", () => C.ativoTxt("Roundup WG") === " (" + C.ativoDoProduto("Roundup WG") + ")");

// ---------- planilha .xlsx montada em memória ----------
const testesAssincronos = [];
{
  const zlib = require("zlib");
  const crc32 = (b) => { let c, crc = 0xFFFFFFFF; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; };
  const zipar = (entradas) => {
    const locais = [], centrais = []; let off = 0;
    for (const [nome, txt] of entradas) {
      const dados = Buffer.from(txt, "utf8"), comp = zlib.deflateRawSync(dados), n = Buffer.from(nome);
      const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0, 6); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(0, 10); loc.writeUInt32LE(crc32(dados), 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dados.length, 22); loc.writeUInt16LE(n.length, 26); loc.writeUInt16LE(0, 28);
      const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc32(dados), 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32); cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36); cen.writeUInt32LE(0, 38); cen.writeUInt32LE(off, 42);
      locais.push(loc, n, comp); centrais.push(cen, n); off += 30 + n.length + comp.length;
    }
    const cd = Buffer.concat(centrais);
    const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...locais, cd, eocd]);
  };
  const xlsx = zipar([
    ["xl/sharedStrings.xml", '<sst><si><t>Produto</t></si><si><t>Qtd</t></si><si><t>Unid</t></si><si><t>Fox Xpro</t></si><si><t>L</t></si><si><t>Roundup WG</t></si><si><t>kg</t></si></sst>'],
    ["xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>100</v></c><c r="C2" t="s"><v>4</v></c></row><row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3"><v>250</v></c><c r="C3" t="s"><v>6</v></c></row><row r="4"><c r="A4"/></row></sheetData></worksheet>'],
  ]);
  const arquivo = { name: "pedido.xlsx", type: "", arrayBuffer: async () => xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength), text: async () => "" };
  testesAssincronos.push((async () => {
    const txt = await C.lerPlanilhaComoTexto(arquivo);
    teste("lerPlanilhaComoTexto: .xlsx vira linhas 'Produto | Qtd | Unid'", () => txt === "Produto | Qtd | Unid\nFox Xpro | 100 | L\nRoundup WG | 250 | kg");
    const csv = await C.lerPlanilhaComoTexto({ name: "pedido.csv", type: "text/csv", text: async () => "Produto;Qtd\nFox;10" });
    teste("lerPlanilhaComoTexto: CSV passa direto", () => csv === "Produto;Qtd\nFox;10");
  })().catch((e) => falhas.push("planilha → " + (e && e.message || e))));
}

// ---------- resultado ----------
Promise.all(testesAssincronos).then(() => {
if (falhas.length) {
  console.error(`✗ ${falhas.length} conta(s) erradas (${ok} certas):`);
  for (const f of falhas) console.error("   - " + f);
  process.exit(1);
}
console.log(`✓ ${ok} contas conferidas — tudo certo`);
});
