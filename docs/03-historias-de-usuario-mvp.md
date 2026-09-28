# CONVIVIUM — Historias de usuario del MVP

> Priorización MoSCoW: **M** = Must (indispensable) · **S** = Should (importante) · **C** = Could (deseable) · **W** = Won't (no en MVP)
> Deriva de [02-alcance-y-flujos.md](02-alcance-y-flujos.md) · Fecha: 2026-09-27

Formato: *Como [perfil], quiero [acción], para [beneficio].* Criterios de aceptación (CA) resumidos.

---

## E1. Acceso, usuarios y dispositivos

| ID | Historia | P | CA clave |
|---|---|---|---|
| E1-01 | Como **dueño**, quiero registrar mi restaurante y sucursales, para operar en la plataforma. | M | Alta de empresa, sucursal, zona horaria, moneda MXN. |
| E1-02 | Como **gerente**, quiero crear usuarios con rol y PIN, para controlar accesos. | M | Roles: dueño, gerente, capitán, mesero, cajero, cocina, barra, almacén. |
| E1-03 | Como **mesero**, quiero entrar con PIN de 4 dígitos en el celular del restaurante, para empezar a atender en segundos. | M | Login < 3 s; cierre de sesión automático por inactividad configurable. |
| E1-04 | Como **gerente**, quiero registrar dispositivos del restaurante (celulares, táctiles, TVs), para que solo equipos autorizados operen. | M | Vinculación por código; revocación. |
| E1-05 | Como **dueño**, quiero definir permisos y topes por rol, para controlar descuentos y cancelaciones. | M | Matriz de permisos editable; topes % y monto. |
| E1-06 | Como **dueño**, quiero una bitácora de auditoría, para saber quién hizo qué. | M | Inmutable; filtro por usuario, acción, fecha. |
| E1-07 | Como **sistema**, los roles son jerárquicos: Dueño ⊇ Gerente ⊇ Almacenista; Gerente ⊇ Capitán ⊇ Mesero. | M | El rol superior ve todas las pantallas del inferior; sin pantallas duplicadas. Almacenista no paga a proveedores ni aprueba sus propios ajustes. |
| E1-08 | Como **dueño**, quiero crear roles personalizados (copiando uno existente) y asignar más de un rol a un usuario. | S | Vista previa "ver como este rol". |

## E2. Configuración: menú, mesas y estaciones

| ID | Historia | P | CA clave |
|---|---|---|---|
| E2-01 | Como **gerente**, quiero crear categorías y productos con precio, foto e impuesto incluido, para armar mi menú. | M | Precio con impuestos incluidos; IVA 16 % u 8 % (región fronteriza) por sucursal; IEPS por producto (bebidas alcohólicas/azucaradas); activo/inactivo. |
| E2-02 | Como **gerente**, quiero definir modificadores (obligatorios/opcionales, con o sin costo), para capturar preferencias. | M | Grupos con mín./máx. selección. |
| E2-03 | Como **gerente**, quiero crear estaciones (cocina/barra) y asignar a cada una sus dispositivos e impresora, para adaptarlo a mi operación. | M | N estaciones; modo pantalla/impresora/ambos. |
| E2-04 | Como **gerente**, quiero asignar cada producto a una o varias estaciones y su tiempo objetivo, para rutear las comandas. | M | Ruteo automático al enviar. |
| E2-05 | Como **gerente**, quiero configurar áreas y mesas en un plano, para que el mesero las ubique. | M | Arrastrar y soltar; capacidad. |
| E2-06 | Como **gerente**, quiero promociones por horario (happy hour, 2x1), para aplicarlas sin intervención. | S | Días/horas; aplica automáticamente. |
| E2-07 | Como **gerente**, quiero marcar un producto como agotado manualmente, para que no se venda. | M | Refleja en meseros en < 2 s. |
| E2-08 | Como **gerente**, quiero catálogos de motivos (devolución, cortesía, cancelación, merma), para estandarizar reportes. | M | Editables. |

## E3. Mesero (PWA en celular)

| ID | Historia | P | CA clave |
|---|---|---|---|
| E3-01 | Como **mesero**, quiero ver el plano de mesas con su estado por color, para saber dónde atender. | M | Libre / ocupada / listo por entregar / pidió cuenta. |
| E3-02 | Como **mesero**, quiero abrir mesa con número de comensales y capturar productos con modificadores y notas, para tomar la orden rápido. | M | Búsqueda + favoritos; orden típica < 30 s. |
| E3-03 | Como **mesero**, quiero asignar productos a comensal y a tiempo (entrada/fuerte/postre), para ordenar el servicio. | S | Botón *Marchar* por tiempo. |
| E3-04 | Como **mesero**, quiero recibir notificación cuando mi comanda o producto esté listo, para llevarlo caliente. | M | Push + sonido + vibración; indica mesa, producto y estación. |
| E3-05 | Como **mesero**, quiero confirmar "entregado", para cerrar el ciclo. | M | Registra tiempo. |
| E3-06 | Como **mesero**, quiero "repetir ronda" en un toque, para agilizar la barra. | S | Duplica bebidas de la última ronda. |
| E3-07 | Como **mesero**, quiero mover productos o comensales entre mesas y unir mesas, para reacomodar clientes. | M | Queda en bitácora. |
| E3-08 | Como **mesero**, quiero solicitar devolución, cancelación, cortesía o descuento con motivo, para gestionarlo sin ir a caja. | M | Queda pendiente si excede mi permiso. |
| E3-09 | Como **mesero**, quiero pedir la cuenta desde el celular, para que caja la prepare. | M | Mesa cambia a "pidió cuenta". |
| E3-10 | Como **bartender/mesero**, quiero abrir cuentas de barra sin mesa (por nombre), para clientes de barra. | M | Lista de cuentas abiertas. |

## E4. Estaciones: Cocina y Barra (KDS)

| ID | Historia | P | CA clave |
|---|---|---|---|
| E4-01 | Como **cocinero**, quiero ver en la TV las comandas de mi estación ordenadas por llegada con cronómetro, para priorizar. | M | Legible a 3–4 m; actualiza en tiempo real. |
| E4-02 | Como **cocinero**, quiero semáforo por tiempo objetivo, para detectar retrasos. | M | Verde/amarillo/rojo configurable. |
| E4-03 | Como **cocinero**, quiero marcar en la táctil un producto o la comanda completa como listo, para notificar al mesero. | M | Notificación < 2 s; deshacer 10 s. |
| E4-04 | Como **cocinero**, quiero ver destacadas las devoluciones (REHACER) y las cancelaciones (tachado), para no perder tiempo. | M | Rehacer va arriba. |
| E4-05 | Como **cocinero**, quiero recuperar comandas ya despachadas del turno, para corregir errores. | M | Historial del turno. |
| E4-06 | Como **jefe de cocina**, quiero una vista consolidada de productos en preparación, para cocinar en lote. | S | Suma por producto. |
| E4-07 | Como **cocinero**, quiero ver la receta/procedimiento del producto al tocarlo, para mantener el estándar. | S | Foto + pasos + cantidades. |
| E4-08 | Como **expeditor**, quiero una vista que avise al mesero solo cuando todas las estaciones terminaron la mesa/tiempo, para entregar completo. | C | Opcional por sucursal. |
| E4-09 | Como **gerente**, quiero que si una pantalla se desconecta la comanda se imprima, para no perder órdenes. | M | Respaldo automático. |
| E4-10 | Como **capitán**, quiero alerta si un producto listo no se entrega en N min, para evitar platos fríos. | S | N configurable. |

## E5. Autorizaciones, devoluciones, cortesías y descuentos

| ID | Historia | P | CA clave |
|---|---|---|---|
| E5-01 | Como **gerente**, quiero aprobar o rechazar solicitudes desde mi celular (push), para no desplazarme. | M | Muestra mesa, producto, monto, motivo, solicitante. |
| E5-02 | Como **gerente**, quiero autorizar en el dispositivo del mesero con mi PIN, como alternativa. | M | — |
| E5-03 | Como **mesero**, quiero devolver un platillo eligiendo *Rehacer* o *Retirar de cuenta*, para resolver la queja. | M | Retirar requiere autorización; genera merma. |
| E5-04 | Como **sistema**, las cancelaciones siguen reglas por estado (no enviado / enviado / preparado). | M | Ver flujo §4.3 doc 02. |
| E5-05 | Como **gerente**, quiero aplicar cortesías y descuentos (% o monto, por producto o cuenta) dentro del tope de mi rol. | M | Motivo obligatorio. |
| E5-06 | Como **dueño**, quiero alertas de patrones anómalos de cortesías/cancelaciones por empleado, para prevenir fraude. | C | Umbral configurable. |

## E6. Caja

| ID | Historia | P | CA clave |
|---|---|---|---|
| E6-01 | Como **cajero**, quiero abrir caja con fondo inicial, para iniciar turno. | M | Una caja abierta por usuario/terminal. |
| E6-02 | Como **cajero**, quiero ver cuentas abiertas e imprimir pre‑cuenta, para entregarla al cliente. | M | Impresora térmica 80 mm. |
| E6-03 | Como **cajero**, quiero dividir la cuenta (iguales, por producto, por comensal), para cobrar a cada quien. | M | — |
| E6-04 | Como **cajero**, quiero registrar pagos mixtos (efectivo MXN/USD, tarjeta en terminal externa, transferencia) y calcular cambio. | M | Tipo de cambio configurable. |
| E6-05 | Como **cajero**, quiero registrar propina (sugerida % o monto) y su forma de pago. | M | Reporte de propinas por mesero. |
| E6-06 | Como **cajero**, quiero registrar retiros y entradas de efectivo, para cuadrar. | M | Motivo obligatorio. |
| E6-07 | Como **gerente**, quiero corte X (parcial) y Z (cierre) con diferencias por forma de pago. | M | Conteo ciego opcional. |
| E6-08 | Como **cajero**, quiero reabrir una cuenta cobrada con autorización, para corregir errores. | S | Queda en bitácora. |

## E7. Inventario y recetas

| ID | Historia | P | CA clave |
|---|---|---|---|
| E7-01 | Como **almacenista**, quiero dar de alta insumos con unidad de compra, unidad de uso y conversión. | M | Ej. botella 750 ml → ml. |
| E7-02 | Como **gerente**, quiero almacenes (general, cocina, barra) y traspasos entre ellos. | M | — |
| E7-03 | Como **chef**, quiero recetas estandarizadas por producto y modificador, con porciones y merma. | M | — |
| E7-04 | Como **chef**, quiero subrecetas con rendimiento y registrar su producción. | M | Producción descuenta insumos y suma preparado. |
| E7-05 | Como **dueño**, quiero ver el costo teórico y % de costo de cada producto con alerta si supera objetivo. | M | Recalcula al cambiar precios de compra. |
| E7-06 | Como **sistema**, quiero descontar inventario automáticamente por cada venta según receta. | M | Incluye modificadores. |
| E7-07 | Como **sistema**, quiero marcar productos como agotados cuando falte un insumo. | S | Configurable por insumo crítico. |
| E7-08 | Como **almacenista**, quiero registrar mermas con motivo. | M | Devoluciones generan merma automática. |
| E7-09 | Como **almacenista**, quiero hacer conteos físicos desde el celular y ver diferencias valorizadas. | M | Conteo por almacén/categoría. |
| E7-10 | Como **almacenista**, quiero activar lotes y caducidades por insumo. | S | Opcional; alerta de próximos a caducar. |
| E7-11 | Como **bartender**, quiero recetas de coctelería en ml/oz y conteo de botellas abiertas. | M | — |
| E7-12 | Como **gerente**, quiero sugerencia de compra según mínimos y consumo. | S | Genera orden de compra. |

## E8. Proveedores, compras y cuentas por pagar

| ID | Historia | P | CA clave |
|---|---|---|---|
| E8-01 | Como **gerente**, quiero un catálogo de proveedores con datos, crédito e insumos que surten. | M | Historial de precios. |
| E8-02 | Como **gerente**, quiero crear órdenes de compra y enviarlas por WhatsApp/correo en PDF. | M | Enlace compartir (sin API de WhatsApp). |
| E8-03 | Como **almacenista**, quiero recibir mercancía contra la orden, registrando diferencias y precio real. | M | Actualiza existencias y costo promedio. |
| E8-04 | Como **almacenista**, quiero adjuntar foto de factura o cargar su XML para prellenar la recepción. | S | Lectura de XML CFDI de proveedor. |
| E8-05 | Como **sistema**, cada recepción facturada genera una cuenta por pagar con vencimiento. | M | Según días de crédito. |
| E8-06 | Como **gerente**, quiero registrar pagos parciales/totales a proveedores con comprobante. | M | Pago en efectivo desde caja afecta corte. |
| E8-07 | Como **dueño**, quiero antigüedad de saldos y alertas de pagos por vencer. | M | Push/PWA. |

## E9. Reportes y dashboard (PWA)

| ID | Historia | P | CA clave |
|---|---|---|---|
| E9-01 | Como **dueño**, quiero un dashboard en vivo (ventas, ticket promedio, mesas abiertas, comensales). | M | Refresco en tiempo real. |
| E9-02 | Como **gerente**, quiero ventas por producto, categoría, mesero, estación, forma de pago y hora. | M | Exportar a Excel/CSV. |
| E9-03 | Como **dueño**, quiero reporte de devoluciones, cortesías, descuentos y cancelaciones por empleado y motivo. | M | — |
| E9-04 | Como **jefe de cocina**, quiero tiempos de preparación por producto y estación. | S | Promedio y percentiles. |
| E9-05 | Como **dueño**, quiero costo real vs. teórico y ingeniería de menú (popularidad vs. margen). | S | Matriz estrellas/vacas/incógnitas/perros. |
| E9-06 | Como **dueño**, quiero comparar sucursales. | S | — |

## E10. No funcionales (transversales)

| ID | Requerimiento | P |
|---|---|---|
| NF-01 | Operación **sin internet** en la red local (comandas, KDS, notificaciones, caja) con sincronización posterior. | M |
| NF-02 | Toda la plataforma es **PWA** instalable (mesero, KDS, caja, admin, dashboard). | M |
| NF-03 | Tiempo comanda → pantalla de estación < 1 s en red local. | M |
| NF-04 | Impresión ESC/POS en impresoras térmicas de red/USB. | M |
| NF-05 | Multi‑tenant (restaurante → sucursales) con aislamiento de datos. | M |
| NF-06 | Modelo de datos preparado para CFDI 4.0 (facturación futura). | S |
| NF-07 | Español MX; formatos de moneda y fecha locales. | M |
| NF-08 | Aviso de privacidad conforme a LFPDPPP. | M |

## Won't (fuera del MVP)
Facturación CFDI a clientes · procesamiento de pagos · integración Rappi/Uber/DiDi · reservaciones · lealtad/CRM · menú QR para comensal · nómina.

---

## Resumen de volumen

| Épica | M | S | C |
|---|---|---|---|
| E1 Acceso | 7 | 1 | 0 |
| E2 Configuración | 7 | 1 | 0 |
| E3 Mesero | 8 | 2 | 0 |
| E4 KDS | 6 | 3 | 1 |
| E5 Autorizaciones | 5 | 0 | 1 |
| E6 Caja | 7 | 1 | 0 |
| E7 Inventario | 9 | 3 | 0 |
| E8 Proveedores/CxP | 6 | 1 | 0 |
| E9 Reportes | 3 | 3 | 0 |
| **Total** | **58** | **15** | **2** |
