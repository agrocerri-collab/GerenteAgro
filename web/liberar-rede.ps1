# ============================================================
# Libera o AgroCR Campo para o celular na MESMA rede Wi-Fi.
# Rode UMA VEZ, com o botao direito > "Executar como administrador".
# Faz duas coisas: permite o Windows escutar na rede e abre a porta no Firewall.
# Para desfazer:  .\liberar-rede.ps1 -Remover
# ============================================================

param([int]$Porta = 8765, [switch]$Remover)

$ErrorActionPreference = "Continue"

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host ""
  Write-Host "  Precisa ser administrador." -ForegroundColor Red
  Write-Host "  Feche, clique com o botao direito neste arquivo e escolha" -ForegroundColor Yellow
  Write-Host "  'Executar com o PowerShell' como administrador." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "Enter para sair"
  exit 1
}

$regra = "AgroCR Campo ($Porta)"
$url   = "http://+:$Porta/"

if ($Remover) {
  netsh http delete urlacl url=$url | Out-Null
  netsh advfirewall firewall delete rule name="$regra" | Out-Null
  Write-Host "  Acesso pelo celular removido." -ForegroundColor Green
  Read-Host "Enter para sair"
  exit 0
}

# 1) permitir que o servidor escute em toda a rede, sem precisar de admin depois
netsh http delete urlacl url=$url | Out-Null
$usuario = "$env:USERDOMAIN\$env:USERNAME"
netsh http add urlacl url=$url user="$usuario" | Out-Null

# 2) abrir a porta no Firewall apenas para redes Particular/Dominio (nunca rede publica)
netsh advfirewall firewall delete rule name="$regra" | Out-Null
netsh advfirewall firewall add rule name="$regra" dir=in action=allow `
  protocol=TCP localport=$Porta profile=private,domain | Out-Null

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
       Sort-Object -Property SkipAsSource, InterfaceMetric |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  Liberado." -ForegroundColor Green
Write-Host "  Agora rode (janela normal, sem admin):" -ForegroundColor White
Write-Host "     .\servidor.ps1 -Rede" -ForegroundColor Cyan
if ($ip) { Write-Host "  E no celular abra:  http://${ip}:$Porta/" -ForegroundColor Cyan }
Write-Host ""
Read-Host "Enter para sair"
