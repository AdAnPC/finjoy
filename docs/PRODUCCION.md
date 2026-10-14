# Lista de preparación para producción

Este documento permite descargar y revisar FinJoy sin escoger ahora un proveedor de nube. El panel/API pueden usar un almacenamiento compatible con S3 para los archivos APK fuera de Replit. La base de datos, el despliegue y la seguridad aún requieren configuración específica del proveedor elegido.

## Componentes que se deben desplegar

1. **Panel web** — aplicación React/Vite, generada en `artifacts/admin-panel/dist/public`. En producción se sirve como archivos estáticos bajo `/admin-panel/`.
2. **API** — servicio Node/Express en `artifacts/api-server`, normalmente en el puerto 8080. Las rutas públicas del panel deben enviar `/api/*` al API.
3. **PostgreSQL** — la app usa `DATABASE_URL`; el modelo de datos es PostgreSQL/Drizzle.
4. **APK Android** — compilación local con el asistente de `BUILD_APK_LOCAL.md`. La variante generada es debug, no la firma de producción.

En cualquier hosting, configura HTTPS, persistencia para PostgreSQL y archivos, copias de seguridad, monitoreo y un proxy que enrute `/api` al backend y `/admin-panel/` al frontend.

## Dependencias actuales y alternativas

- **Base de datos:** usa PostgreSQL estándar mediante `DATABASE_URL`; se puede conectar a un PostgreSQL compatible cuando se seleccione un destino. El esquema actual está en `lib/db/src/schema/`.
- **Archivos APK:** en Replit, el API usa App Storage. Fuera de Replit, selecciona `APK_STORAGE_PROVIDER=s3` y configura un servicio compatible con S3, por ejemplo AWS S3, Cloudflare R2 o MinIO. El API genera URL temporal de subida directa al almacenamiento, valida la APK y la descarga desde el bucket privado; los archivos no se hacen públicos.
- **APK instalada:** el asistente de compilación empaqueta la app en el APK; no necesita un servidor de Replit para iniciarse. Sus datos de crédito se guardan localmente y no se sincronizan con el PostgreSQL del panel.
- **Web móvil estática:** `artifacts/device-lock/scripts/build.js` usa dominios e identificadores de Replit. No es el proceso para generar la APK; para APK usa el asistente de compilación local.
- **Configuración de servicios:** los `.replit-artifact/artifact.toml` describen el proxy/workflows de Replit. Un hosting distinto necesitará su propia configuración de procesos y rutas.

### Almacenamiento APK fuera de Replit

En el entorno del API, establece:

- `APK_STORAGE_PROVIDER=s3`
- `S3_BUCKET`: nombre del bucket privado.
- `S3_REGION`: región configurada para el bucket.
- `S3_ENDPOINT`: opcional en AWS; requerido por muchos servicios compatibles, como R2 o MinIO.
- `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`: configura ambos como secretos si el hosting no proporciona credenciales IAM automáticamente.
- `S3_FORCE_PATH_STYLE`: opcional; `true` para instalaciones como MinIO que requieren URLs estilo ruta, `false` para el formato virtual-hosted habitual.

El bucket y las credenciales deben permitir al API leer, escribir y borrar objetos. Configura además CORS en el bucket para permitir `PUT` desde el dominio del panel y el encabezado `Content-Type`; no es necesario permitir lectura pública. El navegador sube la APK directamente usando una URL firmada de corta duración; limita el bucket y esas credenciales al mínimo necesario. No guardes estas variables en el repositorio ni en el `.env.example`.

## Bloqueos antes de aceptar clientes reales

- **Autenticación y autorización:** el panel y la API administrativa no tienen inicio de sesión ni roles. No exponer `/api/admin/*` ni el panel a Internet antes de implementar protección para administradores.
- **Datos móviles:** el estado de crédito y los pagos de la app se guardan localmente con AsyncStorage; no están sincronizados con los registros PostgreSQL del panel. Diseñar y probar la API/autenticación móvil antes de usarla con clientes.
- **Control de bloqueo:** validar en dispositivos Android reales y definir cómo se reciben y verifican los estados de pago. El bloqueo nativo no reemplaza controles del servidor ni un proceso de recuperación.
- **Almacenamiento de APK:** elegir el servicio compatible con S3 y configurar variables/secretos de despliegue. Nunca almacenar la clave privada de firma en el repositorio.
- **Firma Android:** generar una clave de release propia y guardarla fuera del proyecto con respaldo seguro. La APK debug local no es la compilación final para clientes.
- **CORS y dominio:** ajustar los orígenes permitidos al dominio real del panel; no asumir que el proxy de Replit existe en otra plataforma.
- **Migraciones y recuperación:** definir el procedimiento de migración y copias de seguridad para PostgreSQL. No ejecutar `push-force` ni cambios destructivos en una base de producción.

## Datos de entorno

`.env.example` es solo una plantilla de desarrollo. En producción, crea las variables desde el panel seguro del proveedor seleccionado. No subir `.env`, contraseñas, tokens, claves de almacenamiento ni claves de firma al repositorio o a un archivo ZIP compartido.

Las variables actuales mínimas incluyen:

- `DATABASE_URL`: conexión a PostgreSQL.
- `PORT`: puerto que debe escuchar el servicio API.
- `NODE_ENV=production`: modo del backend.
- Almacenamiento de APK en Replit: `APK_STORAGE_PROVIDER=replit`, `PRIVATE_OBJECT_DIR` y la autenticación lateral de Replit.
- Almacenamiento de APK externo: `APK_STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION` y `S3_ENDPOINT` cuando aplique; credenciales S3 como secretos.

## Antes de publicar

- [ ] Elegir destino, dominio y proveedor de PostgreSQL.
- [ ] Elegir almacenamiento persistente para los APK y configurar el proveedor S3 compatible si el API estará fuera de Replit.
- [ ] Implementar autenticación administrativa, autorización y auditoría de cambios.
- [ ] Integrar la app móvil con el backend y verificar pagos/bloqueos.
- [ ] Preparar claves de firma Android de producción fuera del repositorio.
- [ ] Configurar HTTPS, CORS, secretos, copias de seguridad, límites de carga y monitoreo.
- [ ] Probar una restauración de base de datos y una actualización de APK en dispositivos de prueba.
- [ ] Ejecutar `pnpm run typecheck` y crear una compilación candidata antes de abrir el servicio a clientes.
