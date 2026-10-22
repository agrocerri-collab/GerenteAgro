@echo off
title AgroCR Campo - publicar na internet
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publicar-internet.ps1"
