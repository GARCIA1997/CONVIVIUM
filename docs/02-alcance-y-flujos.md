# CONVIVIUM — Fase 1.1: Alcance definido y flujos operativos

> Bar‑restaurante (alimentos y bebidas) · Pequeños y medianos restaurantes · México
> Fecha: 2026-09-27 · Deriva de [01-levantamiento-requerimientos.md](01-levantamiento-requerimientos.md)

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tipo de negocio | Bar‑restaurante: cocina + coctelería/barra |
| Segmento | Pequeños y medianos (1–10 sucursales, 5–40 mesas aprox.) |
| Propiedad del software | Propio → libertad total para innovar |
| Procesamiento de pagos | **Fuera de alcance** (por ahora). Solo se *registra* la forma de pago |
| Delivery (Rappi, Uber, DiDi) | **Fuera de alcance** |
| Vistas principales | **Cocina**, **Coctelería/Barra**, **Caja**, **Administración** (+ Mesero) |

## 2. Alcance del MVP

**Dentro**
1. Toma de comandas (mesero) con mapa de mesas.
2. Ruteo automático: alimentos → Cocina, bebidas → Barra.
3. KDS en TV + terminal táctil de despacho en cocina y en barra.
4. Notificación al mesero cuando su comanda está lista.
5. Devoluciones, cancelaciones, cortesías y descuentos con autorización y motivo.
6. Caja: cuenta, división, cobro (registro), propina, corte de caja.
7. ~~Facturación CFDI 4.0~~ → pospuesta (ver §9).
8. Administración: menú, usuarios/roles, mesas, estaciones configurables, reportes.
9. Inventario: insumos, recetas estandarizadas, recepción de productos, conteos (ver §8.2).
10. Impresión de comandas configurable por estación.

**Fuera (por ahora)**: facturación CFDI 4.0, procesamiento de pagos, apps de delivery, lealtad, reservaciones.

**Arquitectura de operación**: *local‑first*. Un servidor local por sucursal (el mini‑PC táctil) mantiene comandas, KDS, notificaciones y caja funcionando por WiFi sin internet, y sincroniza con la nube al reconectar (ver §6.8 y NF‑01).

---

## 3. Vistas del sistema

### 3.1 Vista Mesero (celular / tablet)
- Mapa de mesas con estado por color: libre · ocupada · con platillos listos · pidió cuenta.
- Agregar productos con modificadores ("sin cebolla", "término medio", "sin hielo") y notas libres.
- **Tiempos / cursos**: enviar entradas ahora y "fuertes" después (botón *Marchar*).
- **Notificaciones**: vibración + sonido + badge cuando un platillo/bebida está listo, indicando mesa y producto.
- Solicitar devolución, cortesía o descuento (queda pendiente de autorización).

### 3.2 Vista Cocina — TV (solo lectura)
- Tarjetas de comanda en columnas, ordenadas por hora de llegada.
- Cada tarjeta: # comanda, mesa, mesero, hora, cronómetro, productos con modificadores resaltados.
- **Semáforo de tiempo**: verde < objetivo · amarillo cerca · rojo excedido (objetivo configurable por producto).
- Etiquetas visibles: **DEVOLUCIÓN / REHACER** (prioridad alta, arriba), **CANCELADO** (tachado), **ALÉRGENO**.
- Vista **consolidado** opcional: "Total en preparación: 7 tacos al pastor, 3 hamburguesas".
- Diseño legible a 3–4 m: tipografía grande, alto contraste, modo oscuro.

### 3.3 Vista Cocina — Terminal táctil de despacho
- Espejo de las comandas en tarjetas grandes aptas para dedos con grasa/guantes.
- Acciones: **tocar producto** → listo · **tocar comanda** → toda lista · **Deshacer** (10 s).
- Estados por producto: `Recibido → En preparación (opcional) → Listo → Entregado`.
- Al marcar *Listo* → notificación inmediata al mesero que tomó la comanda (y respaldo al capitán si no la confirma en X min).
- Historial de lo despachado en el turno para recuperar tarjetas cerradas por error.

### 3.4 Vista Coctelería / Barra
- Misma mecánica (TV opcional + táctil), solo con bebidas.
- Particularidades de bar:
  - **Cuentas abiertas de barra** (clientes sin mesa, por nombre/pulsera).
  - Rondas rápidas: "repetir ronda" en un toque desde el mesero.
  - Productos por **copa / botella / jarra / cubeta**; promociones tipo **2x1 / happy hour** por horario.
  - Control opcional de **copeo** (onzas por botella) → base para inventario de licor.

### 3.5 Vista Caja
- Lista de cuentas abiertas; pre‑cuenta impresa.
- Dividir cuenta: por partes iguales, por productos, por comensal; unir o mover mesas.
- Aplicar descuentos/cortesías autorizados; propina sugerida (10/15/20 % o monto).
- Registrar forma de pago (efectivo, tarjeta en terminal externa, transferencia, mixto) y cambio.
- Ticket de venta (sin QR de autofactura en el MVP; facturación CFDI pospuesta, ver §9).
- Apertura con fondo, retiros, **corte X (parcial) y Z (cierre)** con diferencias.

### 3.6 Vista Administración
- Menú: categorías, productos, modificadores, precios, estación destino (cocina/barra), tiempo objetivo, disponibilidad ("agotado" se refleja en tiempo real al mesero).
- Mesas y áreas (terraza, salón, barra).
- Usuarios, roles, PINs y **políticas de autorización** (topes de descuento por rol).
- Motivos catalogados de devolución/cortesía/cancelación.
- Reportes y dashboard en vivo.

---

## 4. Flujos clave

### 4.1 Comanda → cocina → mesero
```
Mesero crea comanda ─► Sistema separa por estación
                         ├─► Cocina (TV + táctil)
                         └─► Barra  (TV + táctil)
Estación marca "Listo" ─► Notificación al mesero (mesa, producto)
Mesero confirma "Entregado" ─► Se registra tiempo total
```
Métricas obtenidas gratis: tiempo de preparación por producto, por cocinero/estación, y tiempo de entrega del mesero.

### 4.2 Devolución de platillo
1. Mesero selecciona producto entregado → **Devolver**, elige motivo (frío, mal término, equivocado, objeto extraño, cliente cambió de opinión…).
2. Decide: **Rehacer** (vuelve a cocina con etiqueta prioritaria) o **Retirar de cuenta**.
3. Retirar de cuenta exige **autorización de gerente** (PIN o aprobación remota desde su celular).
4. Se registra merma (costo) y responsable; aparece en reporte de devoluciones.

### 4.3 Cancelación
- **Antes de enviar a cocina**: libre.
- **Enviado pero no preparado**: requiere motivo; cocina ve la tarjeta tachada.
- **Ya preparado**: requiere autorización y se registra como merma.

### 4.4 Cortesías y descuentos
- Tipos: cortesía total de producto, descuento % o monto por producto o por cuenta, promociones automáticas (happy hour, 2x1).
- Reglas: tope por rol (mesero 0 %, capitán 10 %, gerente ilimitado), motivo obligatorio, límite diario por usuario.
- **Aprobación remota**: la solicitud llega al celular del gerente → aprueba/rechaza sin ir a la mesa.
- Todo queda en **bitácora de auditoría** (quién pidió, quién autorizó, monto, hora).

---

## 5. Perfiles para este alcance

| Perfil | Vistas |
|---|---|
| Dueño | **Incluye todo lo del Gerente** (y por tanto del Almacenista), además: dashboard móvil, comparativo de sucursales, definición de roles, permisos y topes, bitácora de auditoría y alertas de fraude |
| Gerente | Administración (operativa), Caja, aprobaciones. **Incluye todo lo del Almacenista** (insumos, traspasos, producción, conteos, recepción, órdenes de compra), además aprueba órdenes de compra y ajustes de conteo y gestiona pagos a proveedores. En restaurantes sin almacenista, el gerente cubre esta función |
| Almacenista / Compras | Inventario (insumos, traspasos, producción, conteos), recepción de mercancía, propuesta de órdenes de compra. Sin acceso a pagos a proveedores (separación de funciones) |
| Capitán | Mesero + autorizaciones limitadas |
| Mesero | Mesero |
| Cajero | Caja |
| Cocinero / Jefe de cocina | Cocina |
| Bartender | Barra (+ cuentas abiertas de barra) |
| Contador | Reportes, compras y cuentas por pagar (solo lectura); facturación cuando se habilite CFDI |
| Comensal | Ticket de venta (autofactura por QR en fase posterior) |

---

## 6. Ideas de innovación (aprovechando que el software es propio)

1. **Aprobación remota con un toque** para descuentos/devoluciones → elimina que el gerente ande buscando la caja.
2. **Reloj inteligente / vibración por patrón** para el mesero (distingue cocina de barra).
3. **Consolidado inteligente en cocina**: agrupa productos iguales de distintas mesas para cocinarlos juntos.
4. **Sincronización de cursos**: la barra y la cocina ven cuándo "marchar" para que bebidas y platillos salgan juntos.
5. **Alerta de mesa olvidada**: platillo listo sin entregar > N min → alerta al capitán.
6. **Radar de fraude**: patrones anómalos de cortesías/cancelaciones por empleado.
7. **Tiempos objetivo que aprenden**: el sistema ajusta el tiempo esperado por producto según historial y carga.
8. **Funciona sin internet**: servidor local (el mismo mini‑PC táctil) mantiene cocina, barra y meseros comunicados por WiFi aunque se caiga el internet.

---

## 7. Hardware de referencia por sucursal

| Equipo | Uso |
|---|---|
| TV 40–55" + mini‑PC / stick (o Smart TV con navegador) | KDS cocina |
| Mini‑PC o tablet táctil 10–15" (resistente) | Despacho cocina |
| Igual que el anterior, opcional TV | Barra |
| Celulares Android / tablets | Meseros |
| PC o tablet + impresora térmica 80 mm + cajón | Caja |
| Router WiFi dedicado | Red local operativa |

---

## 8. Decisiones adicionales (ronda 2)

| Tema | Decisión |
|---|---|
| Estaciones | **Configurables por restaurante**: N estaciones (ej. Caliente, Fría, Parrilla, Postres, Barra). Cada producto se asigna a una estación; una comanda se divide entre las estaciones que correspondan. Cada estación tiene su TV y/o táctil opcional. |
| Dispositivos de meseros | **Celulares del restaurante** → se pueden registrar como dispositivos confiables, modo kiosco (bloqueado a la app), inicio por PIN rápido. |
| Impresión de comandas | **Sí**, configurable por estación: solo pantalla · solo impresora · ambos (impresora como respaldo automático si la pantalla está desconectada). |
| Inventario | **Entra al MVP** completo, incluyendo estandarización de recetas y recepción de productos. |

### 8.1 Estaciones configurables
- Administración: crear/renombrar estaciones, asignar tipo (cocina / barra), dispositivos (TV, táctil, impresora) y tiempo objetivo por defecto.
- Un producto puede ir a **una o varias estaciones** (ej. hamburguesa → Parrilla; ensalada acompañante → Fría).
- **Vista de expedición (opcional)**: pantalla del "pasador" que ve la comanda completa y solo avisa al mesero cuando **todas** las estaciones terminaron esa mesa/curso.
- Restaurante pequeño = 1 cocina + 1 barra, sin configurar nada extra.

### 8.2 Módulo de Inventario (MVP)
**Insumos**: unidad de compra (caja, kg, botella 750 ml) y unidad de uso (g, ml, pieza) con conversión; categoría; almacén; stock mínimo/máximo; costo promedio.

**Almacenes**: almacén general, cocina, barra (traspasos entre ellos).

**Recetas estandarizadas**
- Receta por producto y por modificador (ej. "extra queso" +30 g queso).
- **Subrecetas / preparaciones** (salsas, jarabes, mezclas) con rendimiento.
- Porciones, % de merma/rendimiento, foto y **procedimiento paso a paso** (visible en la táctil de la estación).
- **Costo teórico automático** y % de costo sobre precio de venta; alerta si supera el objetivo.
- Coctelería: recetas en **onzas/ml**, control de copeo por botella.

**Recepción de productos**
1. Orden de compra (opcional) a proveedor.
2. Recepción: cantidades recibidas vs. pedidas, precio real, lote/caducidad, foto de la factura o carga de su **XML CFDI** (lee proveedor, productos y precios automáticamente).
3. Diferencias → nota al proveedor; actualiza costo promedio y existencias.

**Movimientos**: descuento automático por venta (según receta), mermas con motivo (incluye devoluciones de platillo), traspasos, producción de subrecetas, ajustes.

**Conteos físicos**: diarios de barra (botellas), semanales/mensuales generales; conteo desde celular; diferencia teórico vs. real valorizada.

**Reportes**: existencias, consumo, costo real vs. teórico, mermas por motivo/empleado, productos por agotarse → sugerencia de compra.

**Integración con la operación**: cuando un insumo se agota, los productos que lo usan se marcan **"Agotado"** para el mesero en tiempo real.

## 9. Decisiones adicionales (ronda 3)

| Tema | Decisión |
|---|---|
| Dashboard del dueño / plataforma | **Web responsive instalable como PWA** (sin app nativa). Notificaciones push web para aprobaciones y alertas. |
| Facturación CFDI | **Fuera del MVP** (se diseña el modelo de datos para agregarla después sin rehacer). El ticket no lleva QR por ahora. |
| Lotes y caducidades | **Opcionales**, activables por insumo. |
| Proveedores y cuentas por pagar | **Entran al MVP.** |

### 9.1 Proveedores y Cuentas por Pagar
- **Catálogo de proveedores**: datos fiscales y de contacto, días de crédito, días de entrega, insumos que surte con precio pactado e historial de precios.
- **Órdenes de compra**: generadas manualmente o desde la sugerencia de compra; envío por WhatsApp/correo (PDF).
- **Cuentas por pagar**: cada recepción con factura/nota genera un documento por pagar con vencimiento según crédito.
- **Pagos a proveedor**: registro de pagos parciales o totales, forma de pago, comprobante adjunto; pagos desde caja (efectivo) afectan el corte.
- **Reportes**: antigüedad de saldos, pagos próximos a vencer (alerta), compras por proveedor, variación de precios.

## 10. Preguntas pendientes

Ninguna bloqueante para historias de usuario.

## 11. Siguiente paso
Con estas respuestas: historias de usuario priorizadas (MoSCoW) y luego arquitectura técnica (local‑first + nube) y wireframes de las vistas Cocina, Barra, Mesero y Caja.
