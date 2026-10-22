# ============================================================
# AgroCR Campo - publicar na internet (Firebase Hosting)
#
# O que este script faz, em ordem:
#   1. Se o aplicativo mudou, traduz de novo (abre o navegador sozinho)
#   2. Monta a pasta publicar\ com a versao de internet
#   3. Na primeira vez, pede para voce entrar com a conta Google
#   4. Sobe tudo para https://agrocr-campo.web.app
#
# Nao instala nada no Windows: o Node e o Firebase moram na
# pasta ferramentas\ deste projeto.
# ============================================================

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path      # ...\web
$raiz = Split-Path -Parent $aqui                              # ...\app agrocr
$ferramentas = Join-Path $raiz "ferramentas"
$firebase = Join-Path $ferramentas "cli\node_modules\.bin\firebase.cmd"
$compilado = Join-Path $aqui "app-compilado.js"
$fonte = Join-Path $raiz "agrocr-app.jsx"
$porta = 8765

if (-not (Test-Path $firebase)) {
  Write-Host ""
  Write-Host "  Nao achei o Firebase na pasta ferramentas\." -ForegroundColor Red
  Write-Host "  Essa pasta foi apagada? Peca ajuda para reinstalar." -ForegroundColor Yellow
  Read-Host "  Enter para fechar"
  exit 1
}
$env:PATH = (Join-Path $ferramentas "node") + ";" + $env:PATH

# ---- 1) traducao em dia? ----
$precisaTraduzir = -not (Test-Path $compilado) -or
  ((Get-Item $compilado).LastWriteTime -lt (Get-Item $fonte).LastWriteTime)

if ($precisaTraduzir) {
  Write-Host "  O aplicativo mudou - traduzindo de novo..." -ForegroundColor DarkGray
  & (Join-Path $ferramentas "node\node.exe") (Join-Path $ferramentas "traduzir.js")
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  A traducao falhou. Tire uma foto desta tela e mande para a consultoria." -ForegroundColor Red
    Read-Host "  Enter para fechar"
    exit 1
  }
  Write-Host "  Traducao pronta." -ForegroundColor Green
}

# ---- 2) montar a pasta publicar\ ----
& (Join-Path $aqui "build.ps1") -Publicar

# ---- 3) ja esta logado no Google? ----
$contas = & $firebase login:list 2>&1 | Out-String
if ($contas -notmatch "@") {
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host "   PRIMEIRA VEZ: entre com a conta Google do projeto" -ForegroundColor Yellow
  Write-Host "   (a mesma que abre o console do Firebase)" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "   O navegador vai abrir. Escolha a conta e clique em Permitir." -ForegroundColor White
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host ""
  & $firebase login
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  O login nao foi concluido." -ForegroundColor Red
    Read-Host "  Enter para fechar"
    exit 1
  }
}

# ---- 4) subir ----
Write-Host ""
Write-Host "  Publicando..." -ForegroundColor DarkGray
# sobe o site e tambem as regras de seguranca do banco (firestore.rules):
# assim nunca ficam desatualizadas em relacao ao aplicativo
& $firebase deploy --only hosting,firestore:rules --project agrocr-campo

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "     NO AR. Abra em qualquer celular, de qualquer lugar:" -ForegroundColor White
  Write-Host ""
  Write-Host "            https://agrocr-campo.web.app" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "  A publicacao falhou. Tire uma foto desta tela e mande para a consultoria." -ForegroundColor Red
}
Write-Host ""
Read-Host "  Enter para fechar"
