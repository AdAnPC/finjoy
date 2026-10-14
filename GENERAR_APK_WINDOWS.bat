@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js LTS y vuelve a ejecutar este archivo.
  goto failed
)

node artifacts\device-lock\scripts\build-apk-local.js
if errorlevel 1 goto failed

echo.
echo Proceso terminado. Revisa la carpeta generated-apk.
pause
exit /b 0

:failed
echo.
echo No se pudo generar la APK. Revisa el mensaje anterior y BUILD_APK_LOCAL.md.
pause
exit /b 1
