# FinJoy

FinJoy es un workspace pnpm con tres partes: app Android (Expo/React Native), panel administrativo (React/Vite) y API (Express/PostgreSQL). Incluye la configuración nativa de Android para solicitar el permiso de Administrador del dispositivo.

## Descargar y preparar en tu PC

Descarga el **proyecto completo**, incluyendo `pnpm-workspace.yaml` y `pnpm-lock.yaml`; no descargues solamente la carpeta de la app. Instala Node.js 22 LTS.

### Generar la APK

Sigue [`BUILD_APK_LOCAL.md`](BUILD_APK_LOCAL.md):

- Windows: abre `GENERAR_APK_WINDOWS.bat`.
- macOS/Linux: ejecuta `bash GENERAR_APK_MAC_LINUX.sh`.

La APK debug se guarda en `generated-apk/FinJoy-debug.apk`.

### Ejecutar el panel y la API localmente

Necesitas PostgreSQL de desarrollo, Node.js y conexión a internet para descargar dependencias.

1. Copia `.env.example` como `.env` y cambia `DATABASE_URL` por la conexión de una base PostgreSQL de **desarrollo**.
2. Desde la raíz del proyecto, instala dependencias:

   ```sh
   npx --yes pnpm@10.26.1 install --frozen-lockfile
   ```

3. Aplica el esquema únicamente a esa base de desarrollo:

   ```sh
   npx --yes pnpm@10.26.1 db:push:local
   ```

   Este comando rechaza direcciones de base de datos remotas para reducir el riesgo de modificar producción por accidente.

4. Arranca el API y el panel:

   ```sh
   npx --yes pnpm@10.26.1 dev:local
   ```

   Abre `http://localhost:5173`. El panel usa un proxy de desarrollo hacia el API local en el puerto 8080.

El modo local es para desarrollo. La subida y descarga de APKs desde el panel usa actualmente App Storage de Replit y no funcionará fuera de Replit hasta configurar otro proveedor de archivos.

## Preparación para producción

Consulta [`docs/PRODUCCION.md`](docs/PRODUCCION.md) antes de desplegar. El destino aún no está fijado; por eso el proyecto conserva PostgreSQL y App Storage actuales, y documenta los requisitos pendientes sin crear recursos ni credenciales en un proveedor no elegido.

**No publiques el panel/API tal como están:** falta autenticación administrativa, la app móvil conserva el estado de crédito localmente y el almacenamiento de APK depende de Replit. El checklist explica estos bloqueos y los pasos que deben completarse.

## Estructura

- `artifacts/device-lock/`: app Android y compilación APK local.
- `artifacts/admin-panel/`: panel web.
- `artifacts/api-server/`: API Express.
- `lib/db/`: esquema PostgreSQL y configuración Drizzle.
- `lib/api-spec/`: contrato OpenAPI y codegen.
