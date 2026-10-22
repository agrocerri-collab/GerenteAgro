@echo off
title AgroCR Campo - verificacao
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnostico.ps1"
