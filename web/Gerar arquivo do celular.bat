@echo off
title AgroCR Campo - gerar arquivo do celular
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gerar-celular.ps1"
