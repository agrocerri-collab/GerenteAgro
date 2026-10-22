# ============================================================
# Gera os icones do app (tela inicial do Android) a partir da
# logo AgroCR que ja esta dentro do agrocr-app.jsx.
# Rode uma vez; so precisa repetir se a logo mudar.
# ============================================================

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$fonte = Join-Path (Split-Path -Parent $aqui) "agrocr-app.jsx"
$jsx = Get-Content $fonte -Raw -Encoding UTF8

if ($jsx -notmatch 'const LOGO = "data:image/jpeg;base64,([^"]+)"') {
  throw "Nao achei a logo (const LOGO) dentro do agrocr-app.jsx"
}
$bytes = [System.Convert]::FromBase64String($Matches[1])

$ms = New-Object System.IO.MemoryStream(,$bytes)
$logo = [System.Drawing.Image]::FromStream($ms)

$navy = [System.Drawing.ColorTranslator]::FromHtml("#17335F")

function Novo-Icone($lado, $ocupacao, $arquivo) {
  $bmp = New-Object System.Drawing.Bitmap($lado, $lado)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.InterpolationMode = "HighQualityBicubic"
  $g.Clear($navy)

  # cartao branco arredondado com a logo dentro, igual ao cabecalho do app
  $larg = [int]($lado * $ocupacao)
  $alt  = [int]($larg * $logo.Height / $logo.Width)
  $x    = [int](($lado - $larg) / 2)
  $y    = [int](($lado - $alt) / 2)

  $margem = [int]($lado * 0.03)
  $fundo = New-Object System.Drawing.Rectangle(($x - $margem), ($y - $margem), ($larg + 2*$margem), ($alt + 2*$margem))
  $g.FillRectangle([System.Drawing.Brushes]::White, $fundo)
  $g.DrawImage($logo, $x, $y, $larg, $alt)

  $destino = Join-Path $aqui $arquivo
  $bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host ("  " + $arquivo + "  " + $lado + "x" + $lado)
}

Novo-Icone 192 0.80 "icone-192.png"
Novo-Icone 512 0.80 "icone-512.png"
# "maskable": o Android recorta as bordas, entao a logo fica menor e centralizada
Novo-Icone 512 0.58 "icone-maskable.png"

$logo.Dispose(); $ms.Dispose()
Write-Host "Icones gerados." -ForegroundColor Green
