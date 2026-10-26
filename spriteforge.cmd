@echo off
setlocal EnableExtensions
set "SF_PY="
set "SF_DRYRUN="
set "SF_YES="
for %%A in (%*) do (
  if /I "%%~A"=="--dry-run" set "SF_DRYRUN=1"
  if /I "%%~A"=="--yes" set "SF_YES=1"
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)" >nul 2>nul
  if not errorlevel 1 set "SF_PY=py -3"
)

if not defined SF_PY (
  where python >nul 2>nul
  if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)" >nul 2>nul
    if not errorlevel 1 set "SF_PY=python"
  )
)

if not defined SF_PY (
  echo Lia Forge precisa de Python 3.8+ para preparar o ambiente.
  if defined SF_DRYRUN (
    echo Dry-run: nenhuma instalacao feita; instale Python manualmente para executar o plano completo.
    exit /b 0
  )
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Instale Python 3.8+ ou o Windows Package Manager (winget), depois rode lia-forge.cmd novamente.
    exit /b 1
  )
  echo Instalarei Python 3.12 pelo winget. O instalador pode pedir permissao do Windows.
  echo Se nao quiser instalar agora, pressione N.
  if not defined SF_YES choice /C SN /M "Instalar Python agora"
  if not defined SF_YES if errorlevel 2 exit /b 1
  winget install --id Python.Python.3.12 --exact --scope user --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo A instalacao do Python falhou. Instale Python manualmente e tente novamente.
    exit /b 1
  )
  where py >nul 2>nul
  if not errorlevel 1 set "SF_PY=py -3"
  if not defined SF_PY (
    for /d %%D in ("%LocalAppData%\Programs\Python\Python3*") do if exist "%%~fD\python.exe" set "SF_PY=%%~fD\python.exe"
  )
  if not defined SF_PY (
    echo Python foi instalado. Feche e reabra o terminal e execute lia-forge.cmd novamente.
    exit /b 1
  )
)

if "%SF_PY%"=="py -3" (
  py -3 "%~dp0scripts\spriteforge_launcher.py" %*
) else (
  "%SF_PY%" "%~dp0scripts\spriteforge_launcher.py" %*
)
exit /b %ERRORLEVEL%
