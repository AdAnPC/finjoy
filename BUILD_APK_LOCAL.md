# Generar una APK de FinJoy en tu PC

Este proyecto incluye un asistente local para crear una APK Android instalable. La primera compilación descarga dependencias y puede tardar varios minutos.

## Requisitos (solo la primera vez)

1. Instala **Node.js LTS**.
2. Instala **Android Studio** y, desde **SDK Manager**, instala Android SDK Platform 36, Android SDK Build-Tools y Android SDK Platform-Tools.
3. En Android Studio, acepta las licencias del Android SDK y termina la configuración inicial. Android Studio incluye el Java Development Kit que necesita la compilación.
4. Descomprime el proyecto completo; no ejecutes el archivo desde una copia parcial.

## Crear la APK

- **Windows:** haz doble clic en `GENERAR_APK_WINDOWS.bat`.
- **macOS/Linux:** abre una terminal en la carpeta del proyecto y ejecuta `bash GENERAR_APK_MAC_LINUX.sh`.

El asistente instala las dependencias, genera el proyecto Android de Expo si todavía no existe y compila la variante instalable. Al terminar, encontrarás `FinJoy-debug.apk` dentro de `generated-apk/`.

## Instalar en Android

Copia `generated-apk/FinJoy-debug.apk` al teléfono y ábrelo. Android puede pedir permiso para instalar aplicaciones desde esa fuente y solicitar que FinJoy se active como Administrador del dispositivo. La APK no se instala silenciosamente.

La APK contiene el código y los recursos de la app; no necesita Expo Go, Metro ni un dominio de Replit para arrancar. Las funciones actuales y los datos de crédito funcionan en el dispositivo y se guardan localmente. No hay sincronización con el panel/API todavía.

## Notas importantes

- La primera versión generada es una **APK debug**, firmada automáticamente con la clave de depuración local de Android. Sirve para instalar y probar la app; no es una compilación firmada para publicación comercial.
- Conserva el mismo PC y su clave de depuración para compilar futuras actualizaciones compatibles. No compartas esa clave.
- Para compilar en otro equipo o publicar una versión de producción se necesita una clave de firma de producción propia y protegida.
- Si modificas `app.json` o el plugin nativo y ya existe `artifacts/device-lock/android/`, ese proyecto nativo generado no se reemplaza automáticamente. Solo si quieres regenerarlo, elimina esa carpeta y vuelve a ejecutar el asistente; guarda antes cualquier cambio nativo local que quieras conservar.
- Si el asistente indica que no encuentra Android SDK, abre Android Studio → **SDK Manager** y confirma que Platform 36 y Build-Tools estén instalados. Si no detecta Java, vuelve a completar la instalación inicial de Android Studio.
