@echo off
title AgroCR Campo - Passo 1 - liberar o celular
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo   Vou pedir permissao de administrador do Windows.
  echo   Clique em SIM na janela azul que vai aparecer.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberar-rede.ps1"
