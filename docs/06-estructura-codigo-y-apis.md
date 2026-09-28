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
│   ├── ui/                    design tokens CONVIVIUM + componentes base
│   └── app-shell/             vinculación de dispositivo + login PIN + hooks compartidos
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
| `catalog` | menú, alta/edición de producto, agotado (tiempo real), motivos, estaciones | — |
| `floor` | plano con estado calculado | editor de plano |
| `orders` | abrir cuenta (mesa/barra), agregar productos con ruteo por estación, marchar tiempo, transiciones (listo/deshacer/entregado), cancelar por estado, devolver (rehacer/retirar), pedir cuenta, mover productos | — |
| `stations` | cola KDS (rehacer primero), historial del turno, consolidado | — |
| `approvals` | crear, listar, resolver (remoto o PIN de gerente) con aplicación del efecto | — |
| `cash` | abrir caja, caja actual, retiros/entradas, cobro mixto + propina | dividir cuenta, corte X/Z, reabrir |
| `inventory` | insumos, almacenes | alta de insumo, existencias, movimientos, recetas, costo, producción, conteos, aprobación de ajustes, sugerencia de compra |
| `purchasing` | proveedores | alta proveedor, OC, aprobación, PDF, recepción, lectura XML CFDI, CxP, pagos |
| `reports` | dashboard en vivo | ventas, excepciones, tiempos, ingeniería de menú, propinas |
| `audit` | bitácora paginada con filtros | — |
| `sync` (solo nube) | — | ingesta de eventos, configuración versionada |

## 3. Fronts

| App | Puerto dev | Dispositivo | Entrada | Estado |
|---|---|---|---|---|
| `mesero` | 5101 | Celular del restaurante | Dispositivo + PIN | Plano, abrir mesa/barra, comanda con modificadores, envío, avisos "listo", entregado, pedir cuenta |
| `estacion` | 5102 | TV / táctil | Dispositivo + PIN | Tarjetas por cuenta, semáforo, REHACER, cancelado, tocar = listo, "toda lista", deshacer 10 s, consolidado |
| `caja` | 5103 | PC / tablet | Dispositivo + PIN | Apertura, cuentas abiertas, detalle con IVA, propina, pagos mixtos, cambio |
| `admin` | 5104 | Web / PWA | Correo + contraseña | Menú lateral según permisos, dashboard en vivo, aprobaciones, menú con agotado; resto de secciones como marcadores |

## 4. Cómo correrlo en local

```bash
pnpm install
cp .env.example .env            # ajustar DATABASE_URL
pnpm db:migrate && pnpm db:seed
pnpm dev:api                     # http://localhost:4000/docs
pnpm --filter @convivium/mesero dev
```

Usuarios de prueba, PINs y código de vinculación: ver comentario al inicio de `packages/db/src/seed.ts`.

## 5. Siguientes incrementos sugeridos

1. Servir las PWA desde la API en modo edge + worker de sincronización nodo → nube.
2. Impresión ESC/POS por estación con respaldo automático (E4-09).
3. Caja: dividir cuenta, corte X/Z con conteo ciego.
4. Inventario: recetas y descuento automático por venta.
5. Pruebas de integración de la API contra PostgreSQL en CI.
