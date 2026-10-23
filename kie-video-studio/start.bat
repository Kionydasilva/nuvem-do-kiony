@echo off
chcp 65001 >nul
title Kie Video Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 ( echo [ERRO] npm install falhou. & pause & exit /b 1 )
)

if not exist .env if exist .env.example copy .env.example .env >nul

echo Compilando a interface...
call npm run build
if errorlevel 1 ( echo [ERRO] Build falhou. & pause & exit /b 1 )

echo Abrindo http://localhost:3001 ...
start "" http://localhost:3001
node server\index.js
pause
