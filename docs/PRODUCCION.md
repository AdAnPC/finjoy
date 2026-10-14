# Lista de preparación para producción

Este documento permite descargar y revisar FinJoy sin escoger ahora un proveedor de nube. Las rutas y comandos de Replit describen el entorno actual; no significan que el backend sea independiente de Replit.

## Componentes que se deben desplegar

1. **Panel web** — aplicación React/Vite, generada en `artifacts/admin-panel/dist/public`. En producción se sirve como archivos estáticos bajo `/admin-panel/`.
2. **API** — servicio Node/Express en `artifacts/api-server`, normalmente en el puerto 8080. Las rutas públicas del panel deben enviar `/api/*` al API.
3. **PostgreSQL** — la app usa `DATABASE_URL`; el modelo de datos es PostgreSQL/Drizzle.
4. **APK Android** — compilación local con el asistente de `BUILD_APK_LOCAL.md`. La variante generada es debug, no la firma de producción.

En cualquier hosting, configura HTTPS, persistencia para PostgreSQL y archivos, copias de seguridad, monitoreo y un proxy que enrute `/api` al backend y `/admin-panel/` al frontend.

## Dependencias actuales de Replit

- **Base de datos:** usa PostgreSQL estándar mediante `DATABASE_URL`; se puede conectar a un PostgreSQL compatible cuando se seleccione un destino. El esquema actual está en `lib/db/src/schema/`.
- **Archivos APK:** `artifacts/api-server/src/lib/objectStorage.ts` usa el sidecar autenticado de App Storage de Replit (`127.0.0.1:1106`). Fuera de Replit, los endpoints de subida, validación, activación y descarga no están listos hasta adaptar esa integración a un almacenamiento persistente elegido.
- **Web móvil estática:** `artifacts/device-lock/scripts/build.js` usa dominios e identificadores de Replit. No es el proceso para generar la APK; para APK usa el asistente de compilación local.
- **Configuración de servicios:** los `.replit-artifact/artifact.toml` describen el proxy/workflows de Replit. Un hosting distinto necesitará su propia configuración de procesos y rutas.

## Bloqueos antes de aceptar clientes reales

- **Autenticación y autorización:** el panel y la API administrativa no tienen inicio de sesión ni roles. No exponer `/api/admin/*` ni el panel a Internet antes de implementar protección para administradores.
- **Datos móviles:** el estado de crédito y los pagos de la app se guardan localmente con AsyncStorage; no están sincronizados con los registros PostgreSQL del panel. Diseñar y probar la API/autenticación móvil antes de usarla con clientes.
- **Control de bloqueo:** validar en dispositivos Android reales y definir cómo se reciben y verifican los estados de pago. El bloqueo nativo no reemplaza controles del servidor ni un proceso de recuperación.
- **Almacenamiento de APK:** elegir el proveedor, configurar credenciales exclusivamente como variables/secretos de despliegue y adaptar el servicio. Nunca almacenar la clave privada de firma en el repositorio.
- **Firma Android:** generar una clave de release propia y guardarla fuera del proyecto con respaldo seguro. La APK debug local no es la compilación final para clientes.
- **CORS y dominio:** ajustar los orígenes permitidos al dominio real del panel; no asumir que el proxy de Replit existe en otra plataforma.
- **Migraciones y recuperación:** definir el procedimiento de migración y copias de seguridad para PostgreSQL. No ejecutar `push-force` ni cambios destructivos en una base de producción.

## Datos de entorno

`.env.example` es solo una plantilla de desarrollo. En producción, crea las variables desde el panel seguro del proveedor seleccionado. No subir `.env`, contraseñas, tokens, claves de almacenamiento ni claves de firma al repositorio o a un archivo ZIP compartido.

Las variables actuales mínimas incluyen:

- `DATABASE_URL`: conexión a PostgreSQL.
- `PORT`: puerto que debe escuchar el servicio API.
- `NODE_ENV=production`: modo del backend.
- App Storage actual: `PRIVATE_OBJECT_DIR` y la autenticación lateral de Replit, disponibles solo en el entorno Replit correspondiente.

## Antes de publicar

- [ ] Elegir destino, dominio y proveedor de PostgreSQL.
- [ ] Elegir almacenamiento persistente para los APK y adaptar el backend.
- [ ] Implementar autenticación administrativa, autorización y auditoría de cambios.
- [ ] Integrar la app móvil con el backend y verificar pagos/bloqueos.
- [ ] Preparar claves de firma Android de producción fuera del repositorio.
- [ ] Configurar HTTPS, CORS, secretos, copias de seguridad, límites de carga y monitoreo.
- [ ] Probar una restauración de base de datos y una actualización de APK en dispositivos de prueba.
- [ ] Ejecutar `pnpm run typecheck` y crear una compilación candidata antes de abrir el servicio a clientes.
