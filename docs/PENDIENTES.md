# CONVIVIUM · Pendientes para continuar

Documento de traspaso: todo lo que falta, con contexto suficiente para que otra sesión lo tome sin historial.
Estado al 4 de octubre de 2026 (rama `main`).

---

## 0. Cómo trabajar en este repo (leer primero)

### Reglas del proyecto
- **Diseño:** toda pantalla nueva o rediseñada parte del HTML que genera **Stitch** (proyecto "CONVIVIUM — MVP", id `12073236036115109766`, sistema de diseño `assets/7531721147782424560`).
  - Se guarda en `design/stitch/<pantalla>.html` y se usa **tal cual**: mismo marcado y mismas clases, solo con datos reales.
  - No se "adapta" una pantalla vieja con ideas del mockup; el cliente lo rechazó.
  - Se quita solo lo que no tiene respaldo real (botones sin función, idioma, número de mesa inventado, etc.).
- **Stitch MCP:** que `generate_screen_from_text` o `generate_variants` respondan *"operation timed out"* **no significa que fallaron**. La pantalla suele aparecer minutos después en `list_screens`: compara los títulos antes y después antes de reintentar.
  - El usuario también puede lanzar el prompt él mismo en Stitch; en ese caso pásale el texto.
- **Botones:** ningún botón visible puede quedar sin acción.
- **Git:**
  - Cada cambio va en una rama (`feat/…`, `fix/…`, `stitch/…`) y se integra a `main` con fast-forward.
  - Remoto: `git@github.com:GARCIA1997/CONVIVIUM.git`.
- **Sin despliegue a Hostinger** hasta que el cliente lo pida. Por ahora todo se trabaja en local.

### Estructura
- **Front end:** cuatro PWA hechas con Vite y React.
  - `apps/mesero`: comandero.
  - `apps/estacion`: KDS para TV y táctil.
  - `apps/caja`: caja.
  - `apps/admin`: administración.
- **API:** `apps/api`, en Fastify con PostgreSQL y Drizzle.
  - Corre en modo **edge** (equipo del restaurante, sirve las 4 apps) o **cloud** (sirve el admin y el menú público).
- **Paquetes:**
  - `packages/domain`: reglas puras como promociones, ingeniería de menú y jerarquía de roles.
  - `packages/contracts`: esquemas zod compartidos por la API y los clientes.
  - `packages/db`: esquema, migraciones y seeds.
  - `packages/api-client`, `packages/app-shell` y `packages/ui`.
- **Documentación:**
  - `docs/01`–`06`: requerimientos, flujos, historias de usuario, diseño, arquitectura y APIs.
  - `docs/DESPLIEGUE.md`: guía de despliegue.
  - `docs/sitio-cliente/index.html`: manual del cliente, servido en `/ayuda/`.

### Levantar en local
```bash
pnpm install
pnpm --filter @convivium/db migrate      # o AUTO_MIGRATE=true al arrancar la API
pnpm db:seed                             # datos base (usuarios, mesas, menú básico)
pnpm --filter @convivium/db seed:carta   # carta igual al diseño Stitch (platillos, fotos, happy hour)
pnpm --filter @convivium/db seed:ventas  # opcional: 35 días de ventas DEMO para reportes
for a in mesero estacion caja admin; do (cd apps/$a && NODE_ENV=production npx vite build); done
cd apps/api && npx tsx --env-file=../../.env src/index.ts   # sirve todo en :4000 (0.0.0.0)
```
- **Apps en `http://<IP-LAN>:4000/`:** `/mesero/`, `/estacion/`, `/caja/`, `/admin/`, `/m/<slug>` (menú público), `/ayuda/` y `/docs` (OpenAPI).
- **Usuarios de prueba:**
  - Admin: `dueno@demo.mx` / `demo12345`.
  - PIN por persona (antes hay que vincular el dispositivo con un código generado en Admin → Estaciones y dispositivos): Alejandra 1111 (dueña), Luis 2222 (gerente), Marco 3333 (capitán), Ana 4444 (mesero), Sofía 5555 (cajero), Pedro 6666 (cocina), Roberto 7777 (barra), Carmen 8888 (almacenista).
- **Desarrollo con recarga en vivo:** `.claude/launch.json` levanta las apps en los puertos 5101–5104, con proxy de `/v1`, `/m/` y `/media/` a `:4000`.

### Pruebas
- `cd apps/api && npx vitest run`: 31 pruebas de integración, en bases desechables `convivium_test*`.
- `pnpm --filter @convivium/domain test`.
- `npx tsc -p apps/<app> --noEmit` por cada app.
- Si se cambian clases del menú digital: `pnpm --filter @convivium/api menu-css` (regenera `apps/api/src/modules/menus/menu-styles.ts`).

---

## 1. Identidad del restaurante (marca blanca) — hecho, con pendientes

**Requerimiento del cliente:** CONVIVIUM es el software, pero el menú debe verse con la imagen y colores del restaurante que lo compró, con "Powered by CONVIVIUM" al pie.

**Hecho:**
- Admin → **Identidad del restaurante** (`/identidad`, diseño `design/stitch/admin-identidad-restaurante.html`): logo, nombre comercial, eslogan, 4 colores (principal, acento, fondo, texto), tipografía de títulos y de texto, revisión de contraste AA y vista previa del menú digital y del encabezado del PDF.
- API `/v1/branding`: GET, PUT y `PUT`/`DELETE /logo`. Lo editan quienes tienen `sucursal.configurar`.
  - Se guarda en `tenants.branding` (migración `0017`) y se sincroniza al nodo con la configuración.
- Menú digital (`/m/:slug`): colores y tipografías por variables CSS (`--brand-*`), logo en encabezado, tarjeta y pie, y "Powered by CONVIVIUM".
- PDF: logo, nombre, eslogan y colores del restaurante, con "Powered by CONVIVIUM" al pie de cada página.
- Generador de menú: la vista previa "Digital" muestra la página real dentro del marco de celular, y la marca se edita en Identidad.

**Falta:**
1. **Tipografías en el PDF:** hoy se usan Times y Helvetica. Para usar la fuente de la marca hay que descargar el TTF de Google Fonts al guardar la identidad, guardarlo en `MEDIA_DIR` y usar `doc.registerFont`.
2. **Logo en el nodo del restaurante:** el archivo vive en `MEDIA_DIR` de la nube y no se sincroniza (mismo pendiente que las fotos, sección 4.3).
3. **Logo en SVG:** no se acepta porque puede contener scripts. Si el cliente lo pide, sanearlo con DOMPurify en el servidor o convertirlo a PNG.
4. **Identidad por sucursal:** hoy es por restaurante. Si una sucursal necesita otra marca, agregar `branches.branding` que sobreescriba la del restaurante.
5. **Marca en la tarjeta del QR para mesa:** el QR descargable es solo el código. Falta una "tarjeta de mesa" imprimible con logo, nombre y QR.
6. **PWA instalable con la marca:** el `manifest` del comandero y la caja siguen siendo de CONVIVIUM. Decidir con el cliente si el personal debe ver la marca del restaurante o la de CONVIVIUM.

## 2. Recetas (reportado por el cliente) — estado y lo que falta

**Resuelto** (commit `016df16`):
- Lista lateral con todos los platillos (con costo o "Sin receta") y subrecetas, con búsqueda.
- Crear receta para un platillo sin receta y crear subrecetas nuevas.
- En Menú, "Capturar receta" o "Ver receta completa" abre la receta **del platillo de origen** (`/recetas?producto=<id>`).
- Cada receta tiene su propia dirección: `?receta=<id>`, `?producto=<id>` o `?nueva=subreceta`.
- La ficha muestra el nombre actual del platillo.

**Falta:**
1. ~~**Eliminar receta o subreceta.**~~ Hecho: `DELETE /v1/inventory/recipes/:id` (permiso `menu.editar`), 409 `recipe_in_use` con los nombres de las recetas que usan la subreceta, evento `recipe.deleted` en bitácora y botón "Eliminar" en la ficha. Se acotó además la carga de `recipe_lines` al restaurante (antes leía las de todos los tenants).
2. **Recetas de modificadores (E7-03).**
   - El contrato acepta `modifierId` y la ficha muestra `modifierRecipes`, pero no hay forma de crearlas desde la pantalla.
   - Agregar en la ficha del platillo, por cada modificador ligado, "Capturar receta del modificador": un editor igual con `modifierId` y sin `productId`.
3. **Unidad del rendimiento de subrecetas.**
   - Está fija en "ml" (`RecipesPage.tsx`, en el texto "ml por lote").
   - Debe permitir g, ml o pz, para lo que hace falta una columna `yield_unit` en `recipes` (migración).
   - El costo por unidad y la producción deben usar esa unidad.
4. **Receta visible en la estación (E4-07).** En el KDS táctil (`apps/estacion/src/features/kds/KdsTactil.tsx`), al tocar un producto mostrar foto, pasos y cantidades de su receta. Leer de `GET /v1/inventory/recipes/:id` (requiere permiso de lectura para cocina y barra) o crear un endpoint ligero `GET /v1/stations/recipe/:productId`.
5. **Duplicar receta** (atajo útil para variantes): botón "Duplicar" que abra un borrador con las mismas líneas.
6. **Nombre de la receta vs. producto.** Hoy la receta guarda su propio `name`. Al renombrar un producto debería actualizarse el nombre de su receta en el `PUT /catalog/products/:id`, o bien dejar de guardarlo y derivarlo siempre.

---

## 3. Historias de usuario del MVP sin implementar o incompletas

Referencia: `docs/03-historias-de-usuario-mvp.md`. M = must, S = should, C = could.

| HU | Prioridad | Qué falta | Dónde |
|---|---|---|---|
| E1-01 | M | Alta de restaurante y sucursales **desde la interfaz**. Hoy solo existe el CLI `packages/db/src/setup.ts`. Falta una pantalla de onboarding para el dueño (empresa, sucursal, zona horaria, IVA 16/8, primera estación y mesas) o un flujo de alta en la nube. | `apps/admin` (nueva ruta pública), `apps/api/src/modules/auth` o un módulo `onboarding` nuevo |
| E1-03 | M | **Cierre de sesión automático por inactividad** configurable en mesero, caja y estación. Agregar el ajuste por sucursal (minutos) en `/v1/branch` y un temporizador en `packages/app-shell` que regrese a la pantalla de PIN. | `packages/app-shell`, `apps/admin/src/features/branch/BranchPage.tsx` |
| E1-08 | S | **"Ver como este rol"**: vista previa de permisos al editar un rol personalizado. | `apps/admin/src/features/users/RolesPage.tsx` |
| E3-02 | M | **Favoritos** en el comandero: los más vendidos del día o fijados por gerente, arriba del catálogo. Sale de `/reports/sales` por producto o de un campo `favorite` en el producto. | `apps/mesero/src/features/check/CheckPage.tsx` |
| E3-04 | M | **Push real con la app cerrada.** Hoy `ReadyNotifications.tsx` usa `Notification` y `vibrate` solo con la app abierta. Falta Web Push (VAPID): service worker con `push`, endpoint `POST /v1/push/subscribe` y envío al marcar listo. Requiere HTTPS. | `apps/mesero`, `apps/api` (módulo `push` nuevo) |
| E3-06 | S | **Repetir ronda**: un botón en la cuenta que duplique las bebidas (estación de barra) de la última ronda enviada. | `CheckPage.tsx` + `POST /orders/checks/:id/items` (ya existe) |
| E4-07 | S | Receta en la estación (ver sección 2, punto 4). | `apps/estacion` |
| E4-08 | C | **Vista de expeditor**: avisar al mesero solo cuando todas las estaciones terminaron la mesa o el tiempo; opcional por sucursal. | `apps/estacion` (vista nueva), `apps/api/src/modules/stations` |
| E5-01 / E8-07 | M | Aprobaciones y alertas de pagos por vencer **por push**. Hoy se ven dentro de la app (`ApprovalsPage`, `PayablesPage`); falta Web Push (mismo trabajo que E3-04). | `apps/admin`, `apps/api` |
| E5-06 | C | **Alertas de patrones anómalos** de cortesías y cancelaciones por empleado, con umbral configurable. Un job diario sobre `audit_events` que compare contra el promedio. | `apps/api/src/modules/reports` + `audit` |
| ~~E7-07~~ | S | **Hecho.** Ya existía (`checkCritical`, llamado en venta, merma/ajuste y aprobación de conteo). Corregido: ahora solo cuenta existencias de los almacenes **de la sucursal** (antes sumaba todas y una sucursal con stock impedía el agotado en otra), no reescribe/publica productos ya agotados y registra `product.auto_sold_out` en bitácora. Falta decidir si se reactiva solo al reabastecer (hoy es manual). | `apps/api/src/modules/inventory/service.ts` |
| E7-10 | S | **Lotes y caducidades**: el esquema tiene `lot` y `expires_at` en `packages/db/src/schema/inventory.ts`. Faltan captura en recepción, alerta de próximos a caducar y consumo FIFO. | `ReceptionPage.tsx`, `InventoryPage.tsx` |
| E7-11 | M | **Conteo de botellas abiertas** en barra (botella completa más fracción en ml u oz). Verificar si `CountPage` lo soporta; si no, agregar captura por fracción. | `apps/admin/src/features/inventory/CountPage.tsx` |
| ~~E8-02~~ | M | **Hecho.** `GET /v1/purchasing/purchase-orders/:id/pdf` (pdfkit, marca del restaurante, partidas paginadas con encabezado repetido, total y "Powered by CONVIVIUM"). 409 si la OC está en borrador; descargarlo no cambia el estado. Botón "Descargar PDF" en `PurchasesPage` (antes `window.print()`). Pendiente menor: el folio se calcula con `count(*)+1`, que puede duplicarse con dos OC simultáneas; conviene una secuencia o un índice único `(tenant_id, folio)`. | `apps/api/src/modules/purchasing/pdf.ts` |
| E9-02 | M | Exportar **a Excel**: hoy hay CSV en `ReportsPage`. Confirmar con el cliente si CSV basta; si no, agregar xlsx con `exceljs`. | `ReportsPage.tsx` |

**Por verificar** (hay código, pero no se ha probado de punta a punta en el navegador):
- E4-09: impresión de respaldo si se desconecta la pantalla.
- E4-10: alerta de producto listo no entregado.
- E6-03: dividir cuenta por producto y por comensal.
- E6-07: conteo ciego.
- E6-08: reabrir cuenta con autorización.
- E8-04: XML CFDI con un archivo real de proveedor.

---

## 4. Menú digital, PDF y generador
1. **Identidad del restaurante:** hecha; sus pendientes están en la sección 1.
2. **Varias cartas por sucursal** (Carta principal, Bebidas, Desayunos con horario). El diseño Stitch `design/stitch/admin-menus-publicacion.html` las muestra; hoy hay una sola carta por sucursal en `menu_publications`.
   - Cambio de modelo: `menus(id, branch_id, name, slug, schedule, status)` con N por sucursal.
   - Ajustar `/v1/menus/*`, `/m/:slug`, el QR y el PDF.
   - Pedir confirmación al cliente antes de hacerlo.
3. **Fotos en el equipo del restaurante.** Las fotos se guardan en `MEDIA_DIR` del servidor donde se suben (la nube) y **no se sincronizan** al nodo edge. El menú del QR se sirve desde la nube, así que funciona; pero si el comandero o el KDS mostraran fotos, habría que sincronizarlas, por ejemplo con un pull de `/media/*` en `apps/api/src/lib/sync-worker.ts`.
4. **Optimizar fotos al subirlas**: redimensionar a 1200 px y convertir a WebP con `sharp`. Hoy se guarda el archivo tal cual, hasta 5 MB.
5. **Pantalla "Generador de menú":**
   - Al lado de "Publicar" queda un segundo botón principal ("Descargar QR en alta calidad"). Revisar la jerarquía con Stitch.
   - El panel "Diseño" del generador se ve apretado a menos de 1100 px de ancho; revisarlo.

---

## 5. Plataforma y producción
1. **HTTPS en local y en el nodo.** Sin HTTPS las PWA no se instalan, no hay service worker (sin modo offline) ni Web Push.
   - El nodo usa Caddy (`infra/node/Caddyfile`), pero **Caddy no se ha probado**: la imagen no estaba disponible localmente.
   - Probar `docker compose -f infra/node/docker-compose.yml up` con certificado interno y documentar cómo confiar el certificado en los teléfonos.
2. **Acceso desde fuera de la red local.** Hoy se entra por `http://192.168.1.100:4000` en el mismo WiFi. Para demos remotas: túnel (Cloudflare Tunnel o ngrok) o el despliegue en la nube. **Pedir autorización al cliente antes de exponer el sistema a internet.**
3. **Despliegue en Hostinger:** pendiente por decisión del cliente. La guía está en `docs/DESPLIEGUE.md` y `infra/cloud/*`.
   - Al hacerlo, configurar `PUBLIC_MENU_URL`, `MENU_DOMAIN`, `APP_DOMAIN` y el volumen `media`.
4. **Respaldos:** documentar y automatizar `pg_dump` diario más el volumen `media`, en la nube y en el nodo.
5. **Expiración de sesión en admin:** al reiniciar la API las sesiones siguen válidas (JWT), pero el admin pide login seguido en el navegador. Revisar la duración del token y el refresh en `packages/app-shell`.

---

## 6. Calidad
1. **Pruebas de interfaz (E2E)** con Playwright para los flujos clave:
   - abrir mesa, capturar, enviar, marcar listo, entregar y cobrar;
   - pedido para llevar;
   - receta nueva desde Menú;
   - subir foto;
   - publicar el menú.

   Hoy solo hay pruebas de API.
2. **CI** (`.github/workflows/ci.yml`): confirmar que corre en GitHub tras el primer push y agregar el build de las 4 apps.
3. **Desbordes en pantallas angostas:** se corrigió la columna principal del admin (`AdminLayout`, `min-w-0`). Revisar el resto de pantallas del admin a 900–1100 px y las de caja en tablet.
4. **Revisión visual con capturas** de comandero, estaciones y caja contra sus HTML de Stitch (pendiente desde antes).

---

## 7. Datos de demostración
- `seed:carta` deja la carta igual al diseño Stitch.
  - Las fotos de Stitch están en `design/stitch/fotos/` y se copian a `apps/api/data/media/` (ignorada por git).
  - Las recetas de los platillos nuevos se capturan a mano: solo 6 tienen receta del seed básico, más el Carajillo creado en pruebas.
- **Recetas de demostración para todos los platillos de la carta:** extender `seed-carta.ts` para que la ingeniería de menú y el costeo se vean completos.

---

## 8. Documentación para el cliente
- **Manual `docs/sitio-cliente/index.html`:** agregar:
  - fotos de platillos;
  - nueva pantalla de Recetas (lista, nueva, desde Menú);
  - menú digital rediseñado;
  - identidad del restaurante (cuando se termine).
- **Volver a publicar el artifact** del manual (claude.ai, privado; el cliente decide si lo comparte).

---
