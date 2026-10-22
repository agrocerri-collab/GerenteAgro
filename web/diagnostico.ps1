# ============================================================
# AgroCR Campo - verificacao
# Diz o que esta pronto e o que falta para abrir no celular.
# ============================================================

param([int]$Porta = 8765)

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$problemas = @()

function Item($ok, $texto, $ajuda) {
  if ($ok) { Write-Host "  [ OK ]  $texto" -ForegroundColor Green }
  else {
    Write-Host "  [FALTA] $texto" -ForegroundColor Red
    if ($ajuda) { Write-Host "          -> $ajuda" -ForegroundColor Yellow }
    $script:problemas += $texto
  }
}

Write-Host ""
Write-Host "  VERIFICACAO DO AGROCR CAMPO" -ForegroundColor Cyan
Write-Host "  ---------------------------" -ForegroundColor Cyan
Write-Host ""

# 1) o app foi gerado?
$temHtml = Test-Path (Join-Path $aqui "AgroCR.html")
Item $temHtml "O app foi gerado (AgroCR.html)" "rode:  .\build.ps1"

# 2) as bibliotecas estao no lugar?
$vendor = Join-Path $aqui "vendor"
$temVendor = (Test-Path (Join-Path $vendor "react.js")) -and
             (Test-Path (Join-Path $vendor "react-dom.js")) -and
             (Test-Path (Join-Path $vendor "babel.js"))
Item $temVendor "As bibliotecas estao na pasta vendor\" "faltou baixar react.js, react-dom.js e babel.js"

# 3) este computador esta numa rede?
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
       Sort-Object -Property SkipAsSource, InterfaceMetric |
       Select-Object -First 1).IPAddress
Item ([bool]$ip) "Computador conectado na rede (IP $ip)" "conecte o computador no Wi-Fi"

# 4) o Wi-Fi esta marcado como Particular? (se estiver Publica, o Firewall bloqueia)
$perfis = @()
try { $perfis = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne "Disconnected" } } catch { }
$particular = $perfis | Where-Object { $_.NetworkCategory -eq "Private" -or $_.NetworkCategory -eq "DomainAuthenticated" }
$nomesRede = ($perfis | ForEach-Object { "$($_.Name) = $($_.NetworkCategory)" }) -join " | "
Item ([bool]$particular) "Rede marcada como Particular ($nomesRede)" `
  "Configuracoes > Rede e Internet > Wi-Fi > sua rede > marque 'Rede particular'"

# 5) permissao para escutar na rede
$urlacl = netsh http show urlacl 2>$null | Select-String -SimpleMatch ":$Porta/"
Item ([bool]$urlacl) "Windows liberado para receber o celular (porta $Porta)" `
  "clique duas vezes em 'Passo 1 - liberar celular.bat'"

# 6) regra do Firewall
$regra = $null
try { $regra = Get-NetFirewallRule -DisplayName "AgroCR Campo ($Porta)" -ErrorAction SilentlyContinue } catch { }
Item ([bool]$regra) "Firewall liberado para a porta $Porta" `
  "clique duas vezes em 'Passo 1 - liberar celular.bat'"

# 7) o servidor esta no ar agora?
$noAr = $false
try { $noAr = (Test-NetConnection -ComputerName localhost -Port $Porta -WarningAction SilentlyContinue).TcpTestSucceeded } catch { }
if ($noAr) { Write-Host "  [ OK ]  O servidor esta ligado agora" -ForegroundColor Green }
else { Write-Host "  [ -- ]  O servidor nao esta ligado (normal, se voce ainda nao abriu)" -ForegroundColor DarkGray }

Write-Host ""
if ($problemas.Count -eq 0) {
  Write-Host "  Tudo certo." -ForegroundColor Green
  if ($ip) {
    Write-Host ""
    Write-Host "  1) Abra:  Passo 2 - abrir no celular.bat" -ForegroundColor White
    Write-Host "  2) No celular, no mesmo Wi-Fi, digite no Chrome:" -ForegroundColor White
    Write-Host ""
    Write-Host "         ${ip}:$Porta" -ForegroundColor Cyan
    Write-Host ""
  }
} else {
  Write-Host "  Resolva os itens em vermelho acima e rode esta verificacao de novo." -ForegroundColor Yellow
}
Write-Host ""
Read-Host "  Enter para fechar"
