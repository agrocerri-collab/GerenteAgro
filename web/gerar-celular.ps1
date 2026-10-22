# ============================================================
# Gera o AgroCR-sozinho.html para o celular, JA TRADUZIDO.
# Sobe o servidor, abre a pagina que traduz, espera ficar pronto
# e monta o arquivo final. Nao precisa instalar nada.
# ============================================================

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$compilado = Join-Path $aqui "app-compilado.js"
$fonte = Join-Path (Split-Path -Parent $aqui) "agrocr-app.jsx"
$porta = 8765

$marcaAntes = if (Test-Path $compilado) { (Get-Item $compilado).LastWriteTimeUtc } else { [datetime]::MinValue }

# 1) servidor em segundo plano
$jaNoAr = $null -ne (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
$proc = $null
if (-not $jaNoAr) {
  Write-Host "  Ligando o servidor..." -ForegroundColor DarkGray
  $proc = Start-Process powershell -PassThru -WindowStyle Minimized `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $aqui "servidor.ps1"), "-SemAbrir")
  Start-Sleep -Seconds 2
}

# 2) pagina que traduz o app
Write-Host "  Abrindo a pagina que traduz o aplicativo..." -ForegroundColor DarkGray
Start-Process "http://localhost:$porta/compilar.html"

# 3) espera o arquivo traduzido chegar
Write-Host "  Aguardando a traducao (ate 90 segundos)..." -ForegroundColor DarkGray
$pronto = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $compilado) {
    $agora = (Get-Item $compilado).LastWriteTimeUtc
    if ($agora -gt $marcaAntes) { $pronto = $true; break }
  }
}

if (-not $pronto) {
  Write-Host ""
  Write-Host "  Nao recebi o aplicativo traduzido." -ForegroundColor Red
  Write-Host "  Veja se a aba do navegador abriu e o que ela diz." -ForegroundColor Yellow
  if ($proc) { try { Stop-Process -Id $proc.Id -Force } catch { } }
  Read-Host "  Enter para fechar"
  exit 1
}

Write-Host "  Traducao recebida." -ForegroundColor Green

# 4) monta os dois arquivos
& (Join-Path $aqui "build.ps1")
& (Join-Path $aqui "build.ps1") -Sozinho

if ($proc) { try { Stop-Process -Id $proc.Id -Force } catch { } }

$arq = Join-Path $aqui "AgroCR-sozinho.html"
Write-Host ""
Write-Host "  Pronto. Mande este arquivo para o celular:" -ForegroundColor Green
Write-Host "     $arq" -ForegroundColor Cyan
Write-Host ""
Start-Process explorer.exe "/select,`"$arq`""
Read-Host "  Enter para fechar"
