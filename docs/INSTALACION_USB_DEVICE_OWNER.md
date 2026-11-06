# Instalar FinJoy por USB como Device Owner

Este procedimiento prepara un teléfono de prueba o un equipo propiedad de la financiera. **El restablecimiento borra las cuentas, fotos, archivos y aplicaciones del teléfono.** Haz copia de seguridad y confirma que tienes autorización para administrarlo.

## 1. Compila la APK

Desde la raíz del proyecto:

```powershell
node artifacts/device-lock/scripts/build-apk-local.js
```

El archivo queda en `generated-apk/FinJoy-debug.apk`.

## 2. Borra el teléfono desde Recuperación

Conecta un solo teléfono por USB, activa la depuración USB y autoriza esta computadora. Ejecuta:

```powershell
.\artifacts\device-lock\scripts\provision-usb.ps1 -Action reset
```

El script reinicia el teléfono en Recuperación, pero Android exige confirmar **Wipe data/factory reset** físicamente en el propio equipo. El PC no puede forzar ese borrado mediante ADB normal.

## 3. Termina la configuración inicial sin cuentas

Después del borrado, completa el asistente de Android sin añadir cuentas Google ni cuentas de trabajo. Activa Opciones de desarrollador y Depuración USB, vuelve a conectar el cable y autoriza la computadora.

## 4. Instala y asigna Device Owner

```powershell
.\artifacts\device-lock\scripts\provision-usb.ps1 -Action enroll
```

El script instala la APK, ejecuta `dpm set-device-owner` y comprueba que Android la registre como Device Owner. Para indicar un equipo concreto cuando hay varios conectados, usa `-Serial NUMERO_DE_SERIE`. Para otra APK, indica `-ApkPath RUTA\FinJoy.apk`.

Si Android rechaza `set-device-owner`, revisa que el teléfono esté recién restablecido, que no se haya añadido ninguna cuenta y que no exista otro propietario o perfil de trabajo. El soporte puede variar según la versión de Android y el fabricante. Esta modalidad USB sirve para preparación y pruebas; el despliegue a clientes debe usar QR de aprovisionamiento o Zero-touch cuando corresponda.
