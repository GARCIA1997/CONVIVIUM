# Despliegue de CONVIVIUM

Una sola imagen Docker (`apps/api/Dockerfile`) contiene la API, las 4 PWA compiladas y el manual del cliente.
El modo se elige con `CONVIVIUM_MODE`: `edge` en el mini-PC del local, `cloud` en el servidor.
Al arrancar, la API **aplica sola las migraciones pendientes** (`AUTO_MIGRATE=true`), así que instalar y actualizar
son el mismo comando.

## 1. Nube (VPS)

Requisitos: Docker con Compose, puertos 80/443 abiertos, dos registros DNS tipo A apuntando al servidor
(por ejemplo `app.convivium.mx` y `menu.convivium.mx`).

```bash
git clone <repo> convivium && cd convivium/infra/cloud
cp .env.example .env        # llenar POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32), dominios
docker compose up -d --build
docker compose logs -f api   # esperar "CONVIVIUM API en modo cloud"
```

Alta de la primera empresa (una vez):

```bash
docker compose exec api sh -c 'cd /repo/packages/db && pnpm exec tsx src/setup.ts \
  --empresa "Mi Restaurante" --sucursal "Centro" --nombre "Nombre del Dueño" \
  --email dueno@mirestaurante.mx --password "********" --pin 4821'
```

Imprime el código de vinculación (24 h). Otra sucursal: `--agregar-sucursal "Polanco" --email dueno@…`.

Qué queda publicado:

| Dirección | Contenido |
|---|---|
| `https://APP_DOMAIN/admin/` | Administración remota (dueño y gerente) |
| `https://APP_DOMAIN/ayuda/` | Manual de uso para el cliente |
| `https://APP_DOMAIN/docs` | Documentación de la API (OpenAPI) |
| `https://MENU_DOMAIN/m/<sucursal>` | Menú digital público (el QR apunta aquí) |

## 2. Nodo del local (mini-PC)

```bash
cd convivium/infra/node
cp .env.example .env         # POSTGRES_PASSWORD y JWT_SECRET propios del nodo
docker compose up -d --build
```

Vincular con la nube (opcional; sin esto el local opera 100 % aislado):

1. En la nube, Administración → Estaciones y dispositivos → **Generar código**.
2. `curl -X POST https://APP_DOMAIN/v1/auth/devices/pair -H 'content-type: application/json' -d '{"code":"123456","name":"Nodo Centro","kind":"nodo"}'`
3. Copiar `deviceToken` → `NODE_TOKEN` y `branchId` → `BRANCH_ID` en `.env`; `docker compose up -d`.
   En el primer ciclo el nodo baja la configuración completa de la sucursal.

El nodo debe arrancar con base **vacía** si se vincula a una sucursal que ya tiene datos en la nube.

Los dispositivos del local abren `https://convivium.local/<mesero|estacion|caja|admin>/` y se vinculan con un
código generado en el propio nodo.

## 3. Actualizar

```bash
git pull && docker compose up -d --build   # migraciones automáticas al arrancar
```

## 4. Respaldo

```bash
docker compose exec postgres pg_dump -U convivium convivium | gzip > respaldo-$(date +%F).sql.gz
```

## 5. Verificación antes de salir

```bash
pnpm install && pnpm -r typecheck && pnpm -r test   # reglas + integración contra Postgres real
docker build -f apps/api/Dockerfile -t convivium/api:local .
```

## Variables

| Variable | Dónde | Descripción |
|---|---|---|
| `CONVIVIUM_MODE` | ambos | `edge` o `cloud` |
| `DATABASE_URL`, `JWT_SECRET` | ambos | Conexión y secreto de sesiones (distinto por instalación) |
| `AUTO_MIGRATE` | ambos | `true` por omisión |
| `CLOUD_URL`, `NODE_TOKEN`, `BRANCH_ID` | nodo | Sincronización con la nube |
| `SYNC_INTERVAL_MS` | nodo | Ciclo de sincronización (10 000 por omisión) |
| `PUBLIC_MENU_URL` | ambos | Base del menú digital para el QR |
| `WEB_ROOT` | imagen | `/srv/web` (PWA compiladas) |
