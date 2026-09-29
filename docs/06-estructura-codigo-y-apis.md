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

## 6. Siguientes incrementos sugeridos

1. Configuración versionada nube → nodo y proyección de eventos para reportes consolidados.
2. Inventario: recetas, descuento automático por venta, conteos.
3. Compras y cuentas por pagar.
4. Corte Z autorizado por PIN de gerente sobre la caja del cajero; zona horaria de la sucursal en tickets.
5. Pruebas de integración de la API en CI.
