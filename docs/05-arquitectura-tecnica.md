# CONVIVIUM — Fase 2: Arquitectura técnica (propuesta)

> Deriva de [02-alcance-y-flujos.md](02-alcance-y-flujos.md), [03-historias-de-usuario-mvp.md](03-historias-de-usuario-mvp.md) y [04-diseno-ui-stitch.md](04-diseno-ui-stitch.md)
> Fecha: 2026-09-27 · Estado: borrador para validación

---

## 1. Principios

1. **Local‑first**: la sucursal opera completa sin internet (NF‑01). La nube es para respaldo, consolidación, dashboard remoto y administración.
2. **Una sola base de código PWA** para todas las vistas (NF‑02): mesero, KDS, táctil, caja, admin, dashboard.
3. **Tiempo real en LAN**: comanda → estación < 1 s (NF‑03); aviso al mesero < 2 s.
4. **Multi‑tenant**: Empresa → Sucursales, aislamiento por `tenant_id` (NF‑05).
5. **Auditoría inmutable** por diseño: los hechos de negocio se registran como eventos (append‑only).

## 2. Vista general

```
                    ┌──────────────────── NUBE ────────────────────┐
                    │  API central · Postgres multi‑tenant          │
                    │  Sync service · Push web · Reportes · Admin   │
                    └───────────────▲──────────────────────────────┘
                                    │ HTTPS (sync bidireccional cuando hay internet)
┌──────────────── SUCURSAL (red WiFi local) ────────▼─────────────────────────┐
│  NODO LOCAL (mini‑PC táctil de cocina o PC de caja)                           │
│   · Servidor Node.js + SQLite/Postgres local                                  │
│   · WebSocket hub (tiempo real)  · Cola de impresión ESC/POS                   │
│   · Sirve la PWA en LAN (https://convivium.local)                             │
│        ▲            ▲             ▲              ▲             ▲              │
│   Celulares     TV KDS       Táctil         Caja + impresora   Impresoras      │
│   meseros       (lectura)    despacho       80 mm + cajón      térmicas red/USB│
└──────────────────────────────────────────────────────────────────────────────┘
Dueño / gerente fuera del local → PWA contra la NUBE (dashboard, aprobaciones push).
```

### Por qué nodo local y no solo PWA offline
Una PWA offline aislada no puede avisar a otro dispositivo (cocina → mesero) sin servidor. El nodo local es el “cerebro” de la sucursal: si cae internet, todo sigue; si cae el nodo, cada dispositivo guarda en su IndexedDB y reintenta, y las estaciones con impresora pasan a **modo impresión** (E4‑09).

## 3. Stack propuesto

| Capa | Tecnología | Motivo |
|---|---|---|
| Front (todas las vistas) | **React + TypeScript + Vite**, PWA (Workbox), Tailwind con tokens del design system | Un solo código, instalable, offline |
| Estado offline en dispositivo | IndexedDB (Dexie) + cola de operaciones | Captura aunque el nodo no responda |
| Nodo local | **Node.js (Fastify) + PostgreSQL** + WebSocket | Mismo motor y esquema que la nube |
| Nube | Node.js (Fastify) + **PostgreSQL** (RLS por tenant) | Mismo lenguaje y modelos que el nodo |
| Sincronización | Log de eventos con IDs ULID + reloj híbrido (HLC) | Orden causal y reintentos idempotentes |
| Tiempo real nube | WebSocket / SSE; **Web Push** para aprobaciones y alertas | Gerente fuera del local |
| Impresión | ESC/POS por TCP 9100 o USB desde el nodo | Sin drivers en los dispositivos |
| Auth | PIN por usuario + dispositivo registrado (token de dispositivo); dueño/gerente remoto con correo + contraseña + 2FA | E1‑03, E1‑04 |
| Infra nube | **Hostinger VPS** con Docker (API, Postgres, Caddy/TLS); almacenamiento de objetos para fotos, XML y PDFs | |

Código compartido (monorepo): `packages/domain` (reglas: cancelaciones por estado, topes, recetas, impuestos IVA/IEPS), usado igual en nodo, nube y front.

## 4. Modelo de datos (núcleo)

- **Organización**: `tenant`, `branch` (zona horaria, IVA 16/8 %), `device`, `user`, `role` (jerárquico, E1‑07), `permission`, `user_role`.
- **Configuración**: `area`, `table`, `station` (tipo cocina/barra, modo pantalla/impresora/ambos), `category`, `product` (precio con impuestos, IEPS, tiempo objetivo), `product_station`, `modifier_group`, `modifier`, `promotion`, `reason` (catálogos de motivos).
- **Operación**: `check` (cuenta: mesa o barra), `order` (comanda), `order_item` (estado `pendiente → enviado → en_preparación → listo → entregado`; `cancelado`, `devuelto`), `item_modifier`, `course` (tiempos/marchar), `approval_request`, `discount`, `payment` (forma, moneda, tipo de cambio), `tip`.
- **Caja**: `cash_session` (apertura, fondo), `cash_movement`, `cash_count` (corte X/Z, conteo ciego).
- **Inventario**: `ingredient` (unidad compra/uso, conversión, crítico, lotes), `warehouse`, `stock`, `recipe`/`recipe_line` (producto, modificador o subreceta, rendimiento, merma), `stock_movement` (venta, merma, traspaso, producción, ajuste, recepción), `lot`, `physical_count`.
- **Compras**: `supplier`, `supplier_price`, `purchase_order`, `receipt` (+ XML CFDI de proveedor), `payable`, `supplier_payment`.
- **Auditoría**: `audit_event` append‑only (quién, qué, antes/después, quién autorizó, dispositivo).
- **Preparado para CFDI (NF‑06)**: `product.sat_product_key`, `product.sat_unit_key`, `check.invoice_status`, datos fiscales en `branch`/`tenant`.

## 5. Sincronización y conflictos

- Cada cambio es un **evento** (`ItemAdded`, `ItemReady`, `PaymentRecorded`…) con ULID + HLC + `device_id`. El nodo es la **autoridad de la sucursal**; la nube es autoridad de **configuración** (menú, usuarios, precios) y de **consolidación**.
- Nube → nodo: configuración versionada (el nodo aplica al vuelo; “agotado” se propaga < 2 s en LAN).
- Nodo → nube: eventos operativos en lotes; idempotentes por ID.
- Conflictos: operaciones son mayormente *append* (sin conflicto). Para estados, gana la transición válida según la máquina de estados (ej. no se puede “listo” sobre “cancelado”). Cambios de configuración concurrentes: *last‑writer‑wins* por campo + auditoría.
- Aprobación remota sin internet: la solicitud cae a **PIN de gerente en sitio** (E5‑02).

## 6. Seguridad

- TLS en LAN con certificado del nodo (dominio `*.convivium.local` provisionado al vincular) y en nube.
- Dispositivos vinculados por código (E1‑04); revocables. Sesión por PIN con expiración por inactividad.
- RBAC evaluado en `packages/domain` tanto en front (UX) como en nodo/nube (autoridad).
- Nunca se almacenan datos de tarjeta (cobro en terminal externa).
- Datos personales mínimos; aviso de privacidad LFPDPPP (NF‑08).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Nodo local falla en hora pico | Colas en IndexedDB + impresión directa de respaldo; opción de nodo secundario (caja) en fase 2 |
| WiFi saturada | Router dedicado (hardware de referencia); mensajes WebSocket pequeños |
| PWA en iOS limita push/segundo plano | Meseros con Android (celulares del restaurante); gerente iOS usa Web Push (iOS 16.4+) |
| Descuento de inventario inexacto | Recetas versionadas; costo teórico vs real y conteos diarios de barra |

## 8. Plan de construcción sugerido (incrementos)

1. **Base**: monorepo, design system en código (tokens CONVIVIUM), auth PIN + dispositivos, tenant/sucursal, roles jerárquicos.
2. **Ciclo de servicio**: menú, mesas, comanda → estación (KDS + táctil) → aviso al mesero. *Demo de valor.*
3. **Excepciones**: cancelaciones, devoluciones, cortesías, aprobaciones remotas, bitácora.
4. **Caja**: cuentas, división, pagos, propinas, cortes X/Z; impresión ESC/POS.
5. **Nodo local + sync nube**, modo sin internet, dashboard remoto.
6. **Inventario y recetas**, descuento por venta, conteos.
7. **Compras y CxP**, reportes completos.

## 9. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Base de datos (nodo y nube) | **PostgreSQL** en ambos: un solo esquema y migraciones |
| Nube | **Hostinger VPS** (Docker) |
| Nodo local | **Mini‑PC con todo preinstalado** por CONVIVIUM (SO, Docker, Postgres, API, PWA); se vincula a la sucursal con un código |
| Dispositivos móviles | **Sin instalación**: abren la PWA servida por el nodo y la instalan desde el navegador |

## 10. Estructura del código

Ver [06-estructura-codigo-y-apis.md](06-estructura-codigo-y-apis.md).
