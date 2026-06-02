@echo off
title Consentimientos Dhi
setlocal enabledelayedexpansion

set "PROYECTO_DIR=%~dp0"
set "PYTHON_EXE=%PROYECTO_DIR%venv\Scripts\python.exe"
set "REQS=%PROYECTO_DIR%requirements.txt"

cd /d "%PROYECTO_DIR%"

cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║             Consentimientos DHI  ║
echo  ║              Iniciando sistema...            ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Verificar entorno virtual
if not exist "%PYTHON_EXE%" (
    echo  [!] Creando entorno virtual...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo  [ERROR] No se pudo crear el entorno virtual.
        echo  Asegurate de tener Python 3.10+ instalado.
        pause & exit /b 1
    )
)

:: Instalar dependencias
if exist "%REQS%" (
    echo  [~] Verificando dependencias...
    "%PYTHON_EXE%" -m pip install -r "%REQS%" --quiet --disable-pip-version-check
)

echo  [✓] Iniciando servidor web...
echo  [✓] Abriendo navegador en http://127.0.0.1:5050
echo.

"%PYTHON_EXE%" main.py

if %errorlevel% neq 0 (
    echo.
    echo  [!] El sistema se cerró inesperadamente. Código: %errorlevel%
    pause
)
