# CONVIVIUM — Estructura del código y APIs

> Deriva de [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) · Fecha: 2026-09-27

## 1. Monorepo (pnpm workspaces, TypeScript)

```
CONVIVIUM/
├── apps/                      ← lo que se despliega
│   ├── api/                   API Fastify · un código, dos modos: edge (mini-PC) | cloud (Hostinger)
│   ├── mesero/                PWA celular · plano de mesas, comanda, avisos
│   ├── estacion/              PWA KDS · TV (?modo=tv, solo lectura) y táctil de despacho
│   ├── caja/                  PWA caja · apertura, cuentas, cobro mixto, propina
│   └── admin/                 PWA administración + dashboard del dueño (login remoto)
├── packages/                  ← lo que se comparte
│   ├── domain/                reglas de negocio puras (roles, estados, impuestos, topes) + pruebas
│   ├── contracts/             esquemas Zod de requests/responses y eventos en tiempo real
│   ├── db/                    esquema PostgreSQL (Drizzle), migraciones y seed
│   ├── api-client/            cliente tipado + sesión + WebSocket con reconexión
│   ├── ui/                    hoja de estilos única (convivium.css) + preset Tailwind generados desde Stitch
│   └── app-shell/             vinculación de dispositivo + login PIN + hooks compartidos
├── design/stitch/             HTML original de las 28 pantallas de Stitch (fuente de verdad visual)
├── scripts/                   stitch-tokens.mjs (tokens/CSS) · stitch-to-jsx.mjs (HTML → TSX)
├── infra/
│   ├── cloud/                 docker-compose + Caddy para Hostinger VPS
│   └── node/                  docker-compose + Caddy para el mini-PC preinstalado
└── docs/                      requerimientos, diseño, arquitectura, openapi.json
```

### Reglas de dependencia (para que escale limpio)

```
apps/*  ──►  app-shell ──► api-client ──► contracts ──► domain
   │            └──────► ui                               ▲
   └── api ─────────────► db, contracts ──────────────────┘
```

- `domain` no depende de nada: la misma regla (p. ej. "¿puede cancelar?") se evalúa en front (UX) y en API (autoridad).
- `contracts` es la **fuente única** de la forma de los datos: la API valida con ellos y genera OpenAPI; los fronts los usan como tipos.
- Los fronts **nunca** importan `db` ni `api`.
- Cada app está organizada por **features** (`src/features/<feature>/`), no por tipo de archivo.

## 2. API

- Prefijo `/v1/<módulo>`; un módulo = una carpeta en `apps/api/src/modules/` con `routes.ts` (+ `service.ts` cuando hay lógica). Se registra en `modules/index.ts`.
- Autenticación: JWT. Tres tipos de entrada: **dispositivo vinculado** (código 6 dígitos), **PIN** en dispositivo, **correo** para acceso remoto.
- Autorización: `app.guard("permiso")` sobre la jerarquía de roles de `domain` (Dueño ⊇ Gerente ⊇ …).
- Tiempo real: WebSocket `/v1/realtime?channels=station:<id>,waiter:<id>,floor,approvals,menu`.
- Bitácora: todo cambio de negocio llama a `recordEvent` → tabla `events` **inmutable** (trigger en PostgreSQL). Es también el log de sincronización nodo → nube.
- Documentación interactiva: `http://localhost:4000/docs` · especificación: [openapi.json](openapi.json) (`pnpm --filter @convivium/api openapi`).

### Estado de endpoints

| Módulo | Implementados | Definidos (501, pendientes) |
|---|---|---|
| `auth` | vincular dispositivo, usuarios del dispositivo, login PIN, login correo, `me` | — |
| `catalog` | menú, alta/edición de producto, agotado (tiempo real), motivos, estaciones (alta/edición con impresora y respaldo) | — |
| `floor` | plano con estado calculado | editor de plano |
| `orders` | abrir cuenta (mesa/barra), agregar productos con ruteo por estación, marchar tiempo, transiciones (listo/deshacer/entregado), cancelar por estado, devolver (rehacer/retirar), pedir cuenta, mover productos | — |
| `stations` | cola KDS (rehacer primero), historial del turno, consolidado | — |
| `approvals` | crear, listar, resolver (remoto o PIN de gerente) con aplicación del efecto | — |
| `cash` | abrir caja, caja actual, retiros/entradas, cobro mixto + propina (cambio descontado del efectivo), dividir (iguales / por comensal / por producto), corte X/Z con conteo ciego, reabrir | — |
| `inventory` | insumos, almacenes | alta de insumo, existencias, movimientos, recetas, costo, producción, conteos, aprobación de ajustes, sugerencia de compra |
| `purchasing` | proveedores | alta proveedor, OC, aprobación, PDF, recepción, lectura XML CFDI, CxP, pagos |
| `reports` | dashboard en vivo | ventas, excepciones, tiempos, ingeniería de menú, propinas |
| `audit` | bitácora paginada con filtros | — |
| `sync` (solo nube) | ingesta idempotente de eventos del nodo | configuración versionada nube → nodo |

## 3. Fronts (diseño Stitch)

Las pantallas se construyen **desde el HTML de Stitch** (`design/stitch/*.html`), conservando marcado y clases; solo se sustituyen datos de ejemplo por datos reales y se conectan acciones.

- Estilos: una sola hoja `packages/ui/src/convivium.css` (Tailwind + estilos propios de Stitch) y un preset `packages/ui/tailwind.preset.cjs` con los 163 tokens de color unificados.
- Pantalla nueva de Stitch: descargar el HTML a `design/stitch/`, correr `node scripts/stitch-tokens.mjs` y `node scripts/stitch-to-jsx.mjs <pantalla> <salida.tsx> <Componente>`, y conectar datos.
- Textos de diseño que Stitch deja visibles (p. ej. "HU E6-01") y funciones fuera del MVP (factura CFDI, envío por correo) se omiten.

| App | Puerto dev | Pantallas Stitch conectadas |
|---|---|---|
| `mesero` | 5101 | acceso PIN, plano de mesas, comanda (modificadores, marchar), aviso de listo |
| `estacion` | 5102 | KDS TV (`?modo=tv`), táctil de despacho (listo, toda lista, deshacer, despachadas) |
| `caja` | 5103 | acceso PIN, cuentas y cobro, apertura por denominaciones, corte X/Z con arqueo ciego y PIN de gerente |
| `admin` | 5104 | dashboard en vivo, aprobaciones; menú con agotado. Resto de secciones: diseño listo, pendiente de datos |

## 4. Cómo correrlo en local

```bash
pnpm install
cp .env.example .env            # ajustar DATABASE_URL
pnpm db:migrate && pnpm db:seed
pnpm dev:api                     # http://localhost:4000/docs
pnpm --filter @convivium/mesero dev
```

Usuarios de prueba, PINs y código de vinculación: ver comentario al inicio de `packages/db/src/seed.ts`.

## 5. Incremento 3 (hecho)

- **Nodo sirve las PWA**: `/mesero/`, `/estacion/`, `/caja/`, `/admin/` con fallback SPA (en la nube solo `/admin/`).
- **Sync nodo → nube**: worker cada 10 s sube eventos no sincronizados en lotes de 500; la nube los ingiere sin duplicar. Requiere `CLOUD_URL`, `NODE_TOKEN` (vincular el nodo como dispositivo `nodo`) y `BRANCH_ID`.
- **Impresión ESC/POS** (E4-09): por estación, salida `pantalla | impresora | ambos`; si es `pantalla` con respaldo y no hay pantalla conectada, imprime con leyenda "RESPALDO". Reintentos con espera creciente.
- **Caja**: dividir, corte X/Z con conteo ciego (Z solo gerente), reabrir con permiso.
- **Seguridad**: los tokens se redactan en los logs.

## 6. Sincronización de configuración nube ↔ nodo (hecho)

- **Registro por trigger**: cada tabla de configuración (empresa, sucursal, usuarios y roles, categorías, productos, estaciones,
  modificadores, disponibilidad, promociones, motivos, áreas, mesas, estructura del plano, almacenes, insumos y recetas)
  tiene un trigger que anota el cambio en `config_changes`. No importa si lo hizo la API, un script o SQL directo.
- **Nube → nodo** (`GET /v1/sync/config?since=N`): la primera vez (`since=0`) entrega la foto completa de la sucursal
  en orden de dependencias; después, solo cambios nuevos de la empresa o de esa sucursal. El nodo los aplica con
  `apply_config_change(..., silent = true)` (sin volver a registrarlos: no hay eco) y avisa en tiempo real
  (`menu.updated`, `floor.updated`, recarga de permisos).
- **Nodo → nube** (`POST /v1/sync/config`): lo editado en el admin del nodo (p. ej. sin internet) sube en el siguiente ciclo.
  La nube aplica *last-writer-wins* por registro: si ya tiene un cambio más reciente, descarta el del nodo (`stale`).
  Lo registra con el nodo de origen para propagarlo a otras sucursales sin regresárselo.
- **Orden del ciclo**: eventos ↑ → configuración ↑ → configuración ↓ (evita pisar cambios locales aún no subidos).
- **Seguridad**: solo tokens de dispositivos tipo `nodo`, vigentes y de esa sucursal; se valida que cada fila (y la que
  reemplaza) sea de la misma empresa; solo tablas de la lista blanca (`packages/db/src/sync.ts`).

- **Operación nodo → nube (reportes consolidados, E9-06)**: `checks`, `order_items`, `payments`, `tips`, `discounts`,
  `approvals`, `cash_sessions`, `cash_counts`, `cash_movements`, `stock` y `stock_movements` usan el mismo registro con
  `kind = 'ops'`. Solo suben (el nodo es la autoridad); la nube valida empresa y sucursal y nunca los regresa. Así los
  reportes corren igual en la nube por sucursal (`?branch=<id>`), consolidados (`?branch=todas`) o comparados
  (`GET /v1/reports/branches`). Solo el Dueño sale de su sucursal. El historial anterior a la migración 0013 no se replica.

**Vincular un nodo nuevo** (base vacía con migraciones aplicadas):

1. En el admin de la nube → Estaciones y dispositivos → *Generar código*.
2. `POST {nube}/v1/auth/devices/pair` con `{ "code": "…", "name": "Nodo Roma Norte", "kind": "nodo" }` → `deviceToken`, `branchId`.
3. Arrancar el nodo con `CONVIVIUM_MODE=edge`, `CLOUD_URL`, `NODE_TOKEN=<deviceToken>`, `BRANCH_ID=<branchId>`.
   En el primer ciclo baja la foto completa; revocar el dispositivo corta la sincronización.

## 7. Siguientes incrementos sugeridos

1. Replicar compras y cuentas por pagar (hoy se capturan en nodo o nube indistintamente).
2. Depurar en el nodo el registro de cambios ya subidos.
3. Instalador del mini-PC (Docker Compose con nodo, Postgres y PWA) y despliegue de la nube en Hostinger.

## 8. Pruebas

- `pnpm -r test`: reglas puras de `domain` y pruebas de integración de la API (`apps/api/test`).
- Las de la API recrean `convivium_test` (con seed) y `convivium_test_node` en cada corrida y levantan la API en memoria.
  Con `LOG_LEVEL=error pnpm --filter @convivium/api test` se ven los errores del servidor.
- CI: `.github/workflows/ci.yml` (Postgres 16, typecheck y pruebas).
