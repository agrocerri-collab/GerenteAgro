# ============================================================
# AgroCR Campo - empacotador do prototipo
# Le ..\agrocr-app.jsx e gera AgroCR.html (abre com dois cliques)
# Rode este script sempre que mexer no agrocr-app.jsx
#
#   .\build.ps1             -> AgroCR.html (usa a pasta vendor\)
#   .\build.ps1 -Sozinho    -> AgroCR-sozinho.html, arquivo unico de ~3 MB
#                              para mandar por WhatsApp e abrir no celular
#   .\build.ps1 -Publicar   -> ..\publicar\index.html, versao que vai para a
#                              internet (Firebase Hosting). Exige o app ja
#                              traduzido, para o celular abrir na hora.
# ============================================================

param([switch]$Sozinho, [switch]$Publicar)

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$fonte = Join-Path (Split-Path -Parent $aqui) "agrocr-app.jsx"
$pastaPublicar = Join-Path (Split-Path -Parent $aqui) "publicar"

if ($Publicar) {
  if (-not (Test-Path $pastaPublicar)) { New-Item -ItemType Directory -Path $pastaPublicar | Out-Null }
  $saida = Join-Path $pastaPublicar "index.html"
} elseif ($Sozinho) {
  $saida = Join-Path $aqui "AgroCR-sozinho.html"
} else {
  $saida = Join-Path $aqui "AgroCR.html"
}

if (-not (Test-Path $fonte)) { throw "Nao encontrei o prototipo em: $fonte" }

$jsx = Get-Content $fonte -Raw -Encoding UTF8

# 1) O React vem por <script>, entao o import vira desestruturacao do global
$jsx = $jsx -replace 'import\s*\{[^}]*\}\s*from\s*"react";\s*', ''
# 2) Sem bundler nao ha export default
$jsx = $jsx -replace 'export default function App', 'function App'

if ($jsx -match '</script>') { throw "O prototipo contem </script> e quebraria o HTML gerado." }

$vendor = Join-Path $aqui "vendor"
$compilado = Join-Path $aqui "app-compilado.js"

# O celular de campo nao aguenta carregar o Babel (2,8 MB) e traduzir o app
# a cada abertura. Quando existe a versao ja traduzida, o arquivo do celular
# sai sem Babel nenhum: ~10x menor e abre na hora.
$usarCompilado = $false
if (($Sozinho -or $Publicar) -and (Test-Path $compilado)) {
  $usarCompilado = (Get-Item $compilado).LastWriteTime -ge (Get-Item $fonte).LastWriteTime
  if (-not $usarCompilado) {
    Write-Host "  app-compilado.js esta mais velho que o prototipo - vou usar o Babel." -ForegroundColor Yellow
    Write-Host "  Rode 'Gerar arquivo do celular.bat' para atualizar." -ForegroundColor Yellow
  }
}

# O que vai para a internet nao pode depender do Babel: seria 2,8 MB baixados
# no 4G da lavoura toda vez que o celular buscasse versao nova.
if ($Publicar -and -not $usarCompilado) {
  throw "Para publicar, o app precisa estar traduzido e atualizado. Rode antes: Gerar arquivo do celular.bat"
}

# Antes de publicar, as contas do app (estoque, fungicidas, programa de compra,
# monitoramento, NF-e) sao conferidas sem navegador. Conta errada = nao publica.
if ($Publicar) {
  $nodeExe = Join-Path (Split-Path -Parent $aqui) "ferramentas\node\node.exe"
  $testeContas = Join-Path (Split-Path -Parent $aqui) "ferramentas\testar-contas.js"
  if ((Test-Path $nodeExe) -and (Test-Path $testeContas)) {
    Write-Host "  Conferindo as contas do app..." -ForegroundColor Cyan
    & $nodeExe $testeContas
    if ($LASTEXITCODE -ne 0) { throw "As contas do app nao bateram - publicacao cancelada. Veja acima qual conta falhou." }
  } else {
    Write-Host "  (teste das contas pulado: node ou testar-contas.js nao encontrado)" -ForegroundColor Yellow
  }
}

if ($Publicar) {
  $ligacoes = @'
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone-192.png">
<link rel="apple-touch-icon" href="icone-192.png">
'@
  $scripts = @'
<script>window.__scriptsErro = [];</script>
<script src="vendor/react.js" onerror="__scriptsErro.push('react')"></script>
<script src="vendor/react-dom.js" onerror="__scriptsErro.push('react-dom')"></script>
<script src="vendor/firebase-app-compat.js" onerror="__scriptsErro.push('firebase-app')"></script>
<script src="vendor/firebase-auth-compat.js" onerror="__scriptsErro.push('firebase-auth')"></script>
<script src="vendor/firebase-firestore-compat.js" onerror="__scriptsErro.push('firebase-firestore')"></script>
<script src="vendor/firebase-app-check-compat.js"></script>
<script src="vendor/html2canvas.min.js"></script>
<script src="vendor/jspdf.umd.min.js"></script>
<script src="firebase-config.js" onerror="__scriptsErro.push('config')"></script>
<script src="nuvem.js" onerror="__scriptsErro.push('nuvem')"></script>
'@
} elseif ($Sozinho) {
  # arquivo unico: nao ha pasta, entao tudo vai dentro do HTML e nao existe
  # manifest nem service worker
  $ligacoes = ""
  $scripts = ""
  $libs = if ($usarCompilado) { @("react.js", "react-dom.js") } else { @("react.js", "react-dom.js", "babel.js") }
  foreach ($lib in $libs) {
    $codigo = Get-Content (Join-Path $vendor $lib) -Raw
    $scripts += "<script>`r`n" + $codigo + "`r`n</script>`r`n"
  }
} else {
  $ligacoes = @'
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone-192.png">
<link rel="apple-touch-icon" href="icone-192.png">
'@
  $scripts = @'
<script src="vendor/react.js"></script>
<script src="vendor/react-dom.js"></script>
<script src="vendor/babel.js"></script>
<script src="vendor/html2canvas.min.js"></script>
<script src="vendor/jspdf.umd.min.js"></script>
<script src="vendor/firebase-app-compat.js"></script>
<script src="vendor/firebase-auth-compat.js"></script>
<script src="vendor/firebase-firestore-compat.js"></script>
<script src="vendor/firebase-messaging-compat.js"></script>
<script src="vendor/firebase-app-check-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="nuvem.js"></script>
'@
}

$registroSW = if ($Sozinho) { "" } else { @'
// ---- Service worker: guarda o app no celular para abrir sem sinal ----
// So funciona em https:// ou http://localhost (regra do navegador).
// Em http://192.168.x.x ele e ignorado, e o app continua funcionando normal.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      // O navegador nem sempre confere sozinho se ha versao nova - alguns
      // celulares ficavam presos em versao velha por dias. Aqui a conferencia
      // e FORCADA em toda aberta, e de hora em hora com o app aberto.
      // Sem internet o update() FALHA (nao consegue baixar o sw.js) e isso e
      // normal - o catch engole, senao a falha viraria tela de erro em cima
      // de um app funcionando offline.
      var conferir = function () { try { reg.update().catch(function () {}); } catch (e) {} };
      conferir();
      setInterval(conferir, 60 * 60 * 1000);
    }).catch(function () {});
  });
  // Quando uma versao nova do app termina de baixar, ela assume o controle
  // e a pagina recarrega UMA vez. Sem isto, o operador so veria a novidade
  // na segunda aberta - e "fechar" no Android nem sempre fecha de verdade.
  var jaRecarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (jaRecarregou) return;
    jaRecarregou = true;
    window.location.reload();
  });
}
'@ }

$cabecalho = @"
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>AgroCR Campo</title>
<meta name="theme-color" content="#17335F">
$ligacoes<meta name="mobile-web-app-capable" content="yes">
$scripts<style>
  html, body { margin: 0; background: #F4F6F3; }
  #carregando { font-family: system-ui, "Segoe UI", sans-serif; color: #17335F;
    display: flex; align-items: center; justify-content: center; height: 100vh; font-weight: 700; }
</style>
</head>
<body>
<div id="root"><div id="carregando">Abrindo o AgroCR Campo...</div></div>

<script>
// ---- Armazenamento local: substitui o window.storage do ambiente de prototipo ----
// Tudo fica gravado no proprio aparelho (localStorage) => funciona 100% offline.
window.storage = {
  get: async function (chave) {
    var v = localStorage.getItem(chave);
    return v === null ? null : { value: v };
  },
  set: async function (chave, valor) { localStorage.setItem(chave, valor); },
  delete: async function (chave) { localStorage.removeItem(chave); }
};

// Alguns aparelhos bloqueiam a gravacao (arquivo aberto de um jeito estranho,
// aba anonima, pouco espaco). Sem isto, o operador digitaria a manha inteira
// e perderia tudo ao fechar, sem nenhum aviso.
(function () {
  var grava = true;
  try { localStorage.setItem("__agrocr_teste", "1"); localStorage.removeItem("__agrocr_teste"); }
  catch (e) { grava = false; }
  if (grava) return;
  window.addEventListener("load", function () {
    var aviso = document.createElement("div");
    aviso.style.cssText = "background:#B3402A;color:#fff;padding:10px 14px;text-align:center;" +
      "font-family:system-ui,sans-serif;font-size:13px;font-weight:700;line-height:1.4";
    aviso.textContent = "ATENCAO: este aparelho nao esta deixando o aplicativo gravar. " +
      "O que voce digitar sera perdido ao fechar. Abra o arquivo pelo app Arquivos, na pasta Download.";
    document.body.insertBefore(aviso, document.body.firstChild);
  });
})();

$registroSW
</script>
"@

# Quem abre isto e operador no meio da lavoura, sem como ver o console.
# Se algo quebrar, a falha aparece escrita na tela para ele fotografar.
$avisoDeErro = @'
<script>
(function () {
  // raio-x para quando um aparelho estranho quebrar: o que carregou, o que nao
  function raioX() {
    try {
      return "\n\n--- para a consultoria ---\n" +
        "aparelho: " + (navigator.userAgent || "?") + "\n" +
        "falharam: " + ((window.__scriptsErro || []).join(", ") || "nenhum script") + "\n" +
        "React " + (typeof React) + " | ReactDOM " + (typeof ReactDOM) +
        " | firebase " + (typeof firebase) + " | Nuvem " + (typeof Nuvem);
    } catch (e) { return ""; }
  }
  // O Firestore as vezes corrompe a memoria local do aparelho e trava com
  // "INTERNAL ASSERTION FAILED". A cura e apagar essa memoria (os dados
  // continuam na nuvem) e abrir de novo — feito aqui sozinho, no maximo
  // 2 vezes seguidas para nao entrar em roda-viva.
  function curarFirestore(msg) {
    if (!/INTERNAL ASSERTION FAILED/i.test(msg || "")) return false;
    var n = 0;
    try { n = +(localStorage.getItem("agrocr:curas") || 0); } catch (e) {}
    if (n >= 2) return false;
    try { localStorage.setItem("agrocr:curas", String(n + 1)); } catch (e) {}
    var recarregar = function () { try { location.reload(); } catch (e) {} };
    try {
      if (typeof firebase !== "undefined" && firebase.firestore) {
        firebase.firestore().terminate()
          .then(function () { return firebase.firestore().clearPersistence(); })
          .then(recarregar, recarregar);
        setTimeout(recarregar, 4000);
        return true;
      }
    } catch (e) {}
    try {
      if (indexedDB && indexedDB.databases) {
        indexedDB.databases().then(function (ds) {
          (ds || []).forEach(function (d) {
            if (d.name && d.name.indexOf("firestore") === 0) { try { indexedDB.deleteDatabase(d.name); } catch (e) {} }
          });
          setTimeout(recarregar, 800);
        }, recarregar);
        return true;
      }
    } catch (e) {}
    return false;
  }
  // ficou de pe por 30 segundos: zera o contador de curas
  setTimeout(function () {
    try { if (!document.getElementById("carregando")) localStorage.removeItem("agrocr:curas"); } catch (e) {}
  }, 30000);
  function mostrar(texto) {
    texto = texto + raioX();
    var raiz = document.getElementById("root");
    if (!raiz) return;
    raiz.innerHTML = '<div style="font-family:system-ui,sans-serif;padding:22px;max-width:620px;margin:0 auto">'
      + '<div style="background:#B3402A;color:#fff;border-radius:12px;padding:14px 16px;font-weight:800">'
      + 'O AgroCR Campo nao conseguiu abrir</div>'
      + '<p style="color:#5B6675;font-size:14px">Tire uma foto desta tela e mande para a consultoria.</p>'
      + '<pre style="background:#F4F6F3;border:1px solid #D9E1D6;border-radius:10px;padding:12px;'
      + 'font-size:12px;white-space:pre-wrap;word-break:break-word">' + texto + '</pre></div>';
  }
  window.addEventListener("error", function (e) {
    // "Script error." sem arquivo nem linha = erro mascarado vindo de FORA do
    // app (extensoes, o compartilhar do iPhone, scripts injetados). Nao e
    // nosso e nao derruba nada — ignorar. So mostramos erro identificavel.
    if (!e.filename && (!e.message || /^Script error\.?$/.test(e.message || ""))) return;
    if (curarFirestore(e.message)) return;
    mostrar((e.message || "erro") + "\n" + (e.filename || "") + " linha " + (e.lineno || "?"));
  });
  window.addEventListener("unhandledrejection", function (e) {
    if (!e.reason) return;
    var m = (e.reason && e.reason.message) || String(e.reason);
    // Sem internet, a conferencia do service worker falha ao baixar o sw.js.
    // E inofensivo (o app roda da copia do aparelho) - nunca virar tela de erro.
    if (/ServiceWorker|Service Worker|Failed to fetch|fetching the script/i.test(m)) return;
    if (curarFirestore(m)) return;
    // com o app ja aberto e funcionando, uma promessa perdida nao derruba a
    // tela; so mostramos erro se ele quebrou ANTES de abrir
    if (!document.getElementById("carregando")) return;
    mostrar("Falha: " + (m || "desconhecida"));
  });
  // se em 20 segundos nada apareceu, o aparelho travou no meio do caminho
  setTimeout(function () {
    var c = document.getElementById("carregando");
    if (c) mostrar("O aplicativo demorou demais para abrir neste aparelho.");
  }, 20000);
})();
</script>
'@

if ($Publicar) {
  # arquivo separado: o navegador guarda o app em cache e so baixa de novo
  # quando ele muda de verdade
  $corpo = "<script src=""app-compilado.js""></script>`r`n</body>"
} elseif ($usarCompilado) {
  $corpo = "<script>`r`n" + (Get-Content $compilado -Raw -Encoding UTF8) + "`r`n</script>`r`n</body>"
} else {
  $corpo = "<script type=""text/babel"" data-presets=""react"">`r`nconst { useState, useEffect, useRef } = React;`r`n`r`n" +
           $jsx +
           "`r`nReactDOM.createRoot(document.getElementById(""root"")).render(<App />);`r`n</script>`r`n</body>"
}

$html = "<!doctype html>`r`n<html lang=""pt-BR"">`r`n<head>`r`n" + $cabecalho + $avisoDeErro + $corpo + "`r`n</html>`r`n"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($saida, $html, $utf8)

if ($Publicar) {
  # tudo o que a pagina publicada usa vai junto na pasta
  New-Item -ItemType Directory -Path (Join-Path $pastaPublicar "vendor") -Force | Out-Null
  foreach ($v in @("react.js", "react-dom.js", "firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js", "firebase-messaging-compat.js", "firebase-app-check-compat.js", "html2canvas.min.js", "jspdf.umd.min.js")) {
    Copy-Item (Join-Path $vendor $v) (Join-Path $pastaPublicar "vendor\$v") -Force
  }
  foreach ($a in @("app-compilado.js", "firebase-config.js", "nuvem.js", "icone-192.png", "icone-512.png", "icone-maskable.png", "socorro.html", "insumos-agrofit.json", "entrada.jpg", "pedido-fornecedor.xlsx")) {
    Copy-Item (Join-Path $aqui $a) (Join-Path $pastaPublicar $a) -Force
  }
  # fontes da marca (Archivo e Instrument Sans), para o visual ser o mesmo sem internet
  # fotos de referência do guia de campo (pasta guia\ inteira)
  if (Test-Path (Join-Path $aqui "guia")) { Copy-Item (Join-Path $aqui "guia") $pastaPublicar -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $pastaPublicar "fontes") -Force | Out-Null
  foreach ($f in @("archivo.woff2", "instrument-sans.woff2")) {
    Copy-Item (Join-Path $aqui "fontes\$f") (Join-Path $pastaPublicar "fontes\$f") -Force
  }

  $utf8 = New-Object System.Text.UTF8Encoding($false)

  # manifest proprio: na internet a pagina inicial e "./", nao AgroCR.html
  $manifesto = (Get-Content (Join-Path $aqui "manifest.webmanifest") -Raw -Encoding UTF8) -replace '\./AgroCR\.html', './'
  [System.IO.File]::WriteAllText((Join-Path $pastaPublicar "manifest.webmanifest"), $manifesto, $utf8)

  # service worker proprio: nomes de arquivo diferentes e versao amarrada ao
  # conteudo do app - mexeu no app, o celular baixa a versao nova sozinho
  # a versao do service worker muda quando QUALQUER arquivo do app muda
  # (app, nuvem.js ou firebase-config.js) - senao um ajuste so na nuvem.js
  # ficaria preso no cache dos celulares ate o app compilado mudar
  $bytesVersao = [byte[]]@()
  foreach ($fv in @("app-compilado.js", "nuvem.js", "firebase-config.js")) { $bytesVersao += [IO.File]::ReadAllBytes((Join-Path $aqui $fv)) }
  $hash = ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytesVersao)) -replace "-", "").Substring(0, 10).ToLower()
  $swPub = @'
// AgroCR Campo - service worker da versao publicada (gerado pelo build.ps1)
const VERSAO = "agrocr-@HASH@";
const ARQUIVOS = [
  "./", "./index.html", "./app-compilado.js", "./firebase-config.js", "./nuvem.js",
  "./manifest.webmanifest", "./icone-192.png", "./icone-512.png", "./icone-maskable.png",
  "./fontes/archivo.woff2", "./fontes/instrument-sans.woff2", "./entrada.jpg", "./pedido-fornecedor.xlsx",
  "./vendor/react.js", "./vendor/react-dom.js",
  "./vendor/firebase-app-compat.js", "./vendor/firebase-auth-compat.js", "./vendor/firebase-firestore-compat.js",
  "./vendor/firebase-messaging-compat.js", "./vendor/firebase-app-check-compat.js",
  "./vendor/html2canvas.min.js", "./vendor/jspdf.umd.min.js",
];

// ---- avisos com o app fechado ----
// O aviso chega como DADOS e o service worker desenha a notificacao.
try {
  importScripts("./vendor/firebase-app-compat.js", "./vendor/firebase-messaging-compat.js", "./firebase-config.js");
  firebase.initializeApp(self.AGROCR_FIREBASE);
  firebase.messaging().onBackgroundMessage((m) => {
    const d = (m && m.data) || {};
    self.registration.showNotification(d.titulo || "AgroCR Campo", {
      body: d.corpo || "", icon: "./icone-192.png", badge: "./icone-192.png",
      // "abrir" diz onde o aviso deve cair (f=fazenda&s=secao&m=modulo&a=aba)
      data: { url: d.abrir ? "./#" + d.abrir : "./", abrir: d.abrir || "" },
    });
  });
} catch (e) { /* sem messaging, o resto do service worker segue normal */ }

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = (e.notification && e.notification.data) || {};
  const abrir = d.abrir || "";
  const url = d.url || "./";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
    for (const aba of abas) {
      // app já aberto: avisa a página para ir direto ao lugar do aviso
      try { aba.postMessage({ tipo: "abrir", abrir }); } catch (err) {}
      if ("focus" in aba) return aba.focus();
    }
    return clients.openWindow(url);
  }));
});

self.addEventListener("install", (e) => {
  // "no-store": busca cada arquivo direto do servidor. Sem isto, o navegador
  // entrega copias guardadas e a "versao nova" nasce com arquivos velhos.
  e.waitUntil(
    caches.open(VERSAO).then((c) =>
      Promise.all(ARQUIVOS.map((a) =>
        fetch(a, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(a);
          return c.put(a, r);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Firebase e mapas seguem direto

  const ehPagina = e.request.mode === "navigate";
  if (ehPagina) {
    // pagina: rede primeiro SEM cache do navegador (pega versao nova de
    // verdade); se estiver sem sinal, cai na copia guardada
    e.respondWith(
      fetch(e.request.url, { cache: "no-store", credentials: "same-origin" })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  // resto: cache primeiro; o nome da versao muda quando o app muda
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
'@
  [System.IO.File]::WriteAllText((Join-Path $pastaPublicar "sw.js"), ($swPub -replace '@HASH@', $hash), $utf8)

  # o numero da versao aparece na tela de entrada do app: acaba a duvida
  # de "atualizou ou nao atualizou?"
  $indice = [System.IO.File]::ReadAllText($saida)
  $indice = $indice.Replace("</head>", "<script>window.AGROCR_VERSAO = '$hash';</script>`r`n</head>")
  [System.IO.File]::WriteAllText($saida, $indice, $utf8)

  # Teste de FUMACA: abre a pagina publicada num Chrome sem janela. Se a tela de
  # erro aparecer (ou ficar em "Abrindo..."), a publicacao para aqui.
  $testeAbertura = Join-Path (Split-Path -Parent $aqui) "ferramentas\testar-abertura.js"
  if ((Test-Path $nodeExe) -and (Test-Path $testeAbertura)) {
    Write-Host "  Abrindo a pagina publicada num Chrome sem janela..." -ForegroundColor Cyan
    & $nodeExe $testeAbertura $saida
    if ($LASTEXITCODE -ne 0) { throw "A pagina publicada nao abre - publicacao cancelada. Veja acima." }
  }
}

$kb = [math]::Round((Get-Item $saida).Length / 1KB)
$como = if ($Publicar) { " + pasta publicar\ completa (versao $hash)" }
        elseif ($Sozinho) { if ($usarCompilado) { " - sem Babel, abre na hora" } else { " - com Babel, pesado para o celular" } }
        else { "" }
Write-Host "Gerado: $saida ($kb KB)$como"
