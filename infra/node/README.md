# Nodo local (mini-PC preinstalado)

Imagen de fábrica que CONVIVIUM instala en cada mini-PC antes de enviarlo:

1. SO Linux mínimo (Debian/Ubuntu Server) con arranque automático en modo kiosco para la pantalla táctil de cocina.
2. Docker + `docker-compose.yml` de esta carpeta; servicios con `restart: always`.
3. mDNS (`avahi`) para anunciar `convivium.local` en la WiFi del restaurante.
4. Primer arranque: asistente en la táctil → código de vinculación de la sucursal (desde la nube) → descarga configuración inicial.
5. Actualizaciones: el nodo consulta la versión en la nube y hace `docker compose pull && up -d` fuera de horario de servicio.

Los celulares, TVs y cajas **no instalan nada**: abren `https://convivium.local/<app>/` y la instalan como PWA desde el navegador.

Pendiente: servir los `dist/` de las PWA desde la API (`@fastify/static`) en modo edge y worker de sincronización.
