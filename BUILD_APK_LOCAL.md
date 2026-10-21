# Generar una APK de FinJoy en tu PC

Este proyecto incluye un asistente local para crear una APK Android instalable. La primera compilación descarga dependencias y puede tardar varios minutos.

## Requisitos (solo la primera vez)

1. Instala **Node.js LTS**.
2. Instala **Android Studio** y, desde **SDK Manager**, instala Android SDK Platform 36, Android SDK Build-Tools y Android SDK Platform-Tools.
3. En Android Studio, acepta las licencias del Android SDK y termina la configuración inicial. Android Studio incluye el Java Development Kit que necesita la compilación.
4. Descomprime el proyecto completo; no ejecutes el archivo desde una copia parcial.

## Crear la APK

Antes de compilar una APK conectada al sistema real, define `EXPO_PUBLIC_API_URL` con la URL HTTPS pública del servicio API (por ejemplo, la URL de Railway). La URL se incorpora al compilar la app. Sin ella, la app no podrá iniciar sesión ni enlazar el teléfono.

- **Windows:** haz doble clic en `GENERAR_APK_WINDOWS.bat`.
- **macOS/Linux:** abre una terminal en la carpeta del proyecto y ejecuta `bash GENERAR_APK_MAC_LINUX.sh`.

El asistente instala las dependencias, genera el proyecto Android de Expo si todavía no existe y compila la variante instalable. Al terminar, encontrarás `FinJoy-debug.apk` dentro de `generated-apk/`.

## Enlazar e instalar en Android

La APK se puede instalar por USB sin restablecer el teléfono. Con la depuración USB activada y el dispositivo autorizado, ejecuta desde la raíz del proyecto:

```powershell
adb install -r .\generated-apk\FinJoy-debug.apk
```

Después abre FinJoy y activa la cuenta o inicia sesión. En ese momento la app registra en el servidor una huella SHA-256 del identificador Android junto con el modelo, versión de Android y permisos de administración detectados. El panel muestra esos datos en el detalle del préstamo. No se envía ni almacena el IMEI como identificador de la instalación.

Antes de instalar esta versión, aplica una vez `lib/db/migrations/0001_customer_devices.sql` a la base PostgreSQL de Railway. La app necesita que el API y esa tabla estén publicados para completar el enlace.

Android solicitará consentimiento para activar FinJoy como Administrador del dispositivo y para la superposición. Con una instalación USB normal estos permisos ofrecen controles limitados: no hacen a FinJoy Device Owner y no impiden de forma fiable que el usuario desinstale la app o restablezca el teléfono. Para esos controles se requiere aprovisionamiento administrado durante la configuración inicial del equipo.

La app ya no ofrece el modo Demo. Requiere una cuenta real del servidor para mostrar crédito y registrar pagos.

## Notas importantes

- La primera versión generada es una **APK debug**, firmada automáticamente con la clave de depuración local de Android. Sirve para instalar y probar la app; no es una compilación firmada para publicación comercial.
- Conserva el mismo PC y su clave de depuración para compilar futuras actualizaciones compatibles. No compartas esa clave.
- Para compilar en otro equipo o publicar una versión de producción se necesita una clave de firma de producción propia y protegida.
- Si modificas `app.json` o el plugin nativo y ya existe `artifacts/device-lock/android/`, ese proyecto nativo generado no se reemplaza automáticamente. Solo si quieres regenerarlo, elimina esa carpeta y vuelve a ejecutar el asistente; guarda antes cualquier cambio nativo local que quieras conservar.
- Si el asistente indica que no encuentra Android SDK, abre Android Studio → **SDK Manager** y confirma que Platform 36 y Build-Tools estén instalados. Si no detecta Java, vuelve a completar la instalación inicial de Android Studio.
