@echo off
title AgroCR Campo - Passo 2 - abrir no celular
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Rede -SemAbrir
echo.
echo   O servidor parou. Se deu erro acima, rode antes o "Passo 1 - liberar celular.bat".
pause
