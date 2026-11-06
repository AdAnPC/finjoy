# Preparación para producción

FinJoy aloja su panel, API y archivos APK en sus propios servicios. La interfaz no depende de Replit, un generador QR remoto, fuentes Google ni almacenamiento S3/GCS.

## Componentes

1. **Panel web:** React/Vite, generado en `artifacts/admin-panel/dist/public` y servido bajo `/admin-panel/`.
2. **API:** Node/Express en `artifacts/api-server`; enruta `/api/*`.
3. **Base de datos:** PostgreSQL configurado con `DATABASE_URL`.
4. **APK:** el API guarda los archivos localmente en `APK_STORAGE_DIR`.

En Railway, agrega un Volume al servicio API y configura `APK_STORAGE_DIR` con su ruta de montaje. Sin almacenamiento persistente, los APK cargados pueden perderse al reiniciar o desplegar. El servicio necesita permisos de lectura/escritura sobre esa ruta.

## Límites de integración

- El QR de aprovisionamiento se genera en el navegador mediante una biblioteca incluida en el panel; el contenido no se envía a un generador externo.
- Los APK se transfieren al API y se almacenan en el disco persistente del servicio.
- La configuración de Device Owner, FRP y Android Zero-touch depende de mecanismos del sistema Android y, cuando corresponde, de servicios de Google y del fabricante. No son servicios sustituibles por un servidor propio.
- La APK instalada aún mantiene datos de crédito localmente y no sincroniza créditos o pagos con PostgreSQL.

## Bloqueos antes de aceptar clientes reales

- **Autenticación y autorización:** implementar inicio de sesión administrativo, roles y auditoría. No exponer `/api/admin/*` ni el panel a Internet antes de protegerlos.
- **Datos móviles:** conectar el estado del crédito y pagos al backend con autenticación y validación del servidor.
- **Control de bloqueo:** validar en dispositivos Android reales y definir verificación de pagos y recuperación.
- **Firma Android:** generar una clave release propia, guardarla fuera del repositorio con respaldo seguro; la APK debug local no es la compilación para clientes.
- **Infraestructura:** configurar HTTPS, secretos, copias de seguridad para PostgreSQL y Volume, límites de carga, monitoreo y persistencia.
- **CORS y dominio:** permitir solo el dominio propio del panel y enrutar `/api` al backend.

## Variables de entorno

- `DATABASE_URL`: conexión PostgreSQL.
- `PORT`: puerto del servicio API.
- `NODE_ENV=production`: modo del backend.
- `APK_STORAGE_DIR`: directorio persistente para los archivos APK; en Railway, debe apuntar al Volume montado.
- `EXPO_PUBLIC_API_URL`: opcional para configurar la URL propia de la API en la app.

No subas `.env`, contraseñas, tokens ni claves de firma al repositorio.

## Antes de publicar

- [ ] Configurar dominio propio, HTTPS y PostgreSQL persistente.
- [ ] Montar Volume en el API y configurar `APK_STORAGE_DIR`.
- [ ] Implementar autenticación administrativa, autorización y auditoría.
- [ ] Integrar la app móvil con el backend y verificar pagos/bloqueos.
- [ ] Preparar clave de firma Android de producción fuera del repositorio.
- [ ] Configurar CORS, secretos, copias de seguridad y monitoreo.
- [ ] Probar restauración de base de datos y actualización de APK en dispositivos de prueba.
