# ============================================================
# AgroCR Campo - servidor local (nao precisa instalar nada)
# Publica a pasta web\ em http://localhost:8765
# Feche esta janela para desligar o servidor.
# ============================================================

param([int]$Porta = 8765, [switch]$SemAbrir, [switch]$Rede)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $raiz "AgroCR.html"))) {
  Write-Host "AgroCR.html nao existe ainda. Gerando..." -ForegroundColor Yellow
  & (Join-Path $raiz "build.ps1")
}

$tipos = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"; ".ico" = "image/x-icon"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

# IP desta maquina na rede Wi-Fi (para abrir no celular)
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
       Sort-Object -Property SkipAsSource, InterfaceMetric |
       Select-Object -First 1).IPAddress

# Depois que o "Passo 1 - liberar celular" reserva a porta para a rede toda
# (http://+:porta), o Windows passa a negar quem tenta abrir so o localhost.
# Por isso tentamos os dois formatos, na ordem que faz sentido para cada modo.
function Abrir-Ouvinte($prefixos) {
  foreach ($p in $prefixos) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add($p)
    try { $l.Start(); return @{ ouvinte = $l; prefixo = $p } }
    catch { try { $l.Close() } catch { } }
  }
  return $null
}

$tentativas = if ($Rede) { @("http://+:$Porta/") } else { @("http://localhost:$Porta/", "http://+:$Porta/") }
$aberto = Abrir-Ouvinte $tentativas
$ouvinte = if ($aberto) { $aberto.ouvinte } else { $null }

if (-not $ouvinte) {
  Write-Host ""
  if ($Rede) {
    Write-Host "  ================================================================" -ForegroundColor Yellow
    Write-Host "   FALTA LIBERAR O CELULAR" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Feche esta janela e clique duas vezes em:" -ForegroundColor White
    Write-Host "       Passo 1 - liberar celular.bat" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Diga SIM na janela de permissao do Windows." -ForegroundColor White
    Write-Host "   Depois volte e abra este arquivo de novo." -ForegroundColor White
    Write-Host "  ================================================================" -ForegroundColor Yellow
  } else {
    Write-Host "  Nao consegui abrir a porta $Porta." -ForegroundColor Red
    Write-Host "  Algum outro programa pode estar usando ela. Tente:" -ForegroundColor White
    Write-Host "     .\servidor.ps1 -Porta 8080" -ForegroundColor Cyan
  }
  Write-Host ""
  Read-Host "  Enter para fechar"
  exit 1
}

Write-Host ""
if ($Rede -and $ip) {
  Write-Host "  ================================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "     NO CELULAR, ABRA O CHROME E DIGITE:" -ForegroundColor White
  Write-Host ""
  Write-Host "            ${ip}:$Porta" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "     (o celular precisa estar no MESMO Wi-Fi deste computador)" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Neste computador:  http://localhost:$Porta/" -ForegroundColor DarkGray
} else {
  Write-Host "  AgroCR Campo rodando em  http://localhost:$Porta/" -ForegroundColor Green
  if ($ip) { Write-Host "  Para usar no celular, abra o 'Passo 2 - abrir no celular.bat'" -ForegroundColor DarkGray }
}
Write-Host "  Deixe esta janela aberta. Feche para desligar." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Pedidos recebidos:" -ForegroundColor DarkGray

if (-not $SemAbrir) { Start-Process "http://localhost:$Porta/" }

# Um pedido com problema (celular que desconectou, aba fechada no meio do download)
# nunca pode derrubar o servidor inteiro: cada volta do laco e protegida.
function Registrar($texto, $cor) { try { Write-Host $texto -ForegroundColor $cor } catch { } }

try {
  while ($ouvinte.IsListening) {
    $ctx = $null
    try {
      $ctx = $ouvinte.GetContext()

      $caminho = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($caminho)) { $caminho = "AgroCR.html" }

      # Recebe o app ja compilado pela pagina compilar.html.
      # So aceita deste proprio computador e so grava neste arquivo.
      if ($ctx.Request.HttpMethod -eq "POST" -and $caminho -eq "compilado") {
        if (-not $ctx.Request.IsLocal) {
          $ctx.Response.StatusCode = 403
        } else {
          $leitor = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
          $corpo = $leitor.ReadToEnd(); $leitor.Close()
          if ($corpo.Length -lt 200) {
            $ctx.Response.StatusCode = 400
            Registrar "  !! compilado veio vazio" Yellow
          } else {
            $utf8SemBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText((Join-Path $raiz "app-compilado.js"), $corpo, $utf8SemBom)
            $ctx.Response.ContentType = "text/plain; charset=utf-8"
            $ok = [System.Text.Encoding]::UTF8.GetBytes("gravado")
            $ctx.Response.OutputStream.Write($ok, 0, $ok.Length)
            Registrar ("  OK   app-compilado.js gravado (" + [math]::Round($corpo.Length/1KB) + " KB)") Green
          }
        }
        $ctx.Response.Close(); $ctx = $null
        continue
      }

      # "fonte.jsx" e um atalho para o prototipo, que mora na pasta de cima
      if ($caminho -eq "fonte.jsx") {
        $arquivo = Join-Path (Split-Path -Parent $raiz) "agrocr-app.jsx"
      } else {
        $arquivo = Join-Path $raiz $caminho
      }
      $completo = [System.IO.Path]::GetFullPath($arquivo)
      if ($caminho -eq "fonte.jsx") {
        $ctx.Response.ContentType = "text/plain; charset=utf-8"
        $bytes = [System.IO.File]::ReadAllBytes($completo)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        Registrar "  200  /fonte.jsx" DarkGray
        $ctx.Response.Close(); $ctx = $null
        continue
      }

      # nunca servir nada fora da pasta web\
      if (-not $completo.StartsWith([System.IO.Path]::GetFullPath($raiz), [StringComparison]::OrdinalIgnoreCase)) {
        $ctx.Response.StatusCode = 403
      }
      elseif (Test-Path $completo -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($completo).ToLower()
        $ctx.Response.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($completo)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        Registrar ("  200  /" + $caminho) DarkGray
      }
      else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Nao encontrado: $caminho")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        Registrar ("  404  /" + $caminho) Yellow
      }
    }
    catch { Registrar ("  !! pedido com erro: " + $_.Exception.Message) Yellow }
    finally { if ($ctx) { try { $ctx.Response.Close() } catch { } } }
  }
}
finally {
  try { $ouvinte.Stop(); $ouvinte.Close() } catch { }
}
