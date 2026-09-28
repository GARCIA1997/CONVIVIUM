# CONVIVIUM — Fase 1: Investigación y Levantamiento de Requerimientos

> Software de gestión para restaurantes · Mercado principal: **México**
> Fecha: 2026-09-27 · Estado: borrador para validación

---

## 1. Panorama competitivo

### 1.1 Líderes globales

| Producto | Fortaleza principal | Qué lo hace ser el mejor | Debilidad / oportunidad |
|---|---|---|---|
| **Toast** (EE.UU.) | Plataforma todo‑en‑uno | Hardware propio robusto, KDS, nómina, marketing, pagos integrados, handhelds para mesero | No opera en México; caro; amarra al cliente a su procesador de pagos |
| **Square for Restaurants** | Facilidad de uso | Arranque en minutos, plan gratuito, ecosistema de apps | Débil en operación compleja (inventario por receta, multi‑sucursal) |
| **Lightspeed Restaurant** | Multi‑sucursal y analítica | Reportes avanzados, menús por ubicación, integraciones abiertas | Curva de aprendizaje, precio |
| **TouchBistro** | UX en iPad | Plano de mesas visual, muy intuitivo para meseros | Arquitectura iPad‑only, local |
| **Oracle MICROS Simphony** | Cadenas y hoteles | Escala enterprise, estabilidad, control central | Costoso, lento de implementar, UX anticuada |
| **NCR Voyix Aloha** | Cadenas grandes | Confiabilidad offline, estándar en franquicias | Legado, caro, poco flexible |

### 1.2 Jugadores en México

| Producto | Posicionamiento | Qué hace bien | Oportunidad para CONVIVIUM |
|---|---|---|---|
| **Soft Restaurant** (National Soft) | Líder histórico en MX | Facturación CFDI, gran red de distribuidores, funciona sin internet, muy completo | Instalación local/Windows, UX antigua, licencias y soporte vía distribuidor, nube como añadido |
| **Parrot** | POS nube moderno MX | UX moderna, integración delivery, analítica en tiempo real | Menos profundidad en inventario/costeo y contabilidad |
| **Wansoft** | Cadenas y franquicias MX | Control multi‑sucursal, inventarios | Interfaz y precio orientados a corporativo |
| **Poster POS / Loyverse / Fudo** | Pequeños negocios | Baratos o gratis, fáciles | Facturación MX limitada, poca profundidad operativa |
| **Terminales (Clip, Mercado Pago, Getnet/Santander, BBVA)** | Cobro | Aceptación de tarjeta barata y rápida | Son pagos, no gestión: se integran, no compiten |

### 1.3 Factores comunes de éxito (lo que hace "mejores" a los mejores)

1. **Velocidad en piso**: tomar una orden en < 10 s; cero fricción en hora pico.
2. **Funciona sin internet** (modo offline con sincronización posterior) — crítico en México.
3. **Todo‑en‑uno**: POS + cocina + inventario + reportes + pagos en una sola plataforma.
4. **Datos en tiempo real** desde el celular del dueño.
5. **Integraciones**: delivery, pagos, contabilidad, facturación.
6. **Hardware flexible**: tablet, celular, terminal, impresora térmica, KDS.
7. **Onboarding y soporte rápidos** (WhatsApp, en español, 24/7).
8. **Precio transparente** por suscripción, sin amarres.

---

## 2. Requerimientos específicos de México (diferenciadores obligatorios)

- **Facturación electrónica CFDI 4.0** integrada (vía PAC): autofacturación del comensal por QR/portal en ticket, **factura global** diaria/mensual al público en general, cancelaciones, complementos de pago, notas de crédito.
- **Impuestos**: IVA 16 % (y 8 % en región fronteriza), IEPS para bebidas alcohólicas y azucaradas, precios con impuestos incluidos.
- **Propinas**: sugeridas, en tarjeta/efectivo, reparto entre personal y su tratamiento fiscal.
- **Pagos**: efectivo (pesos y dólares con tipo de cambio), tarjeta vía terminales integradas (Clip, Mercado Pago Point, bancos), transferencia **SPEI / CoDi**, vales de despensa, cuenta dividida.
- **Delivery**: agregador de pedidos de **Rappi, Uber Eats, DiDi Food** en una sola bandeja y sincronización de menú/disponibilidad.
- **WhatsApp** como canal de pedidos, reservas y notificaciones.
- **Conectividad inestable** → modo offline obligatorio.
- **Nómina/personal**: asistencia, turnos; integración con software de nómina (IMSS) en lugar de reemplazarlo.
- **Protección de datos**: LFPDPPP (aviso de privacidad, derechos ARCO).
- **Contabilidad**: exportación a CONTPAQi, Aspel u otros; XML de facturas.

---

## 3. Perfiles de usuario (roles)

| Perfil | Objetivo | Necesidades clave | Dispositivo típico |
|---|---|---|---|
| **Dueño / Director** | Rentabilidad y control | Dashboard en vivo, ventas vs. costo, alertas de fraude, comparar sucursales | Celular |
| **Gerente de sucursal** | Operación diaria | Apertura/cierre de caja, autorizaciones (cancelaciones, descuentos), turnos, inventario | Tablet / PC |
| **Cajero** | Cobrar rápido y cuadrar | Cobro mixto, cuentas divididas, facturar, corte de caja | Terminal POS |
| **Mesero / Capitán** | Atender mesas | Mapa de mesas, comandas desde handheld, modificadores, enviar a cocina, dividir cuenta | Celular / handheld |
| **Hostess** | Flujo de comensales | Reservaciones, lista de espera, asignación de mesas | Tablet |
| **Cocinero / Jefe de cocina** | Preparar a tiempo | KDS por estación, tiempos, prioridades, alérgenos | Pantalla KDS |
| **Bartender** | Barra | Comandas de barra, control de botellas/copeo | KDS / tablet |
| **Almacenista / Compras** | Abasto y costo | Recepción, proveedores, órdenes de compra, mermas, conteos | Tablet / PC |
| **Repartidor** | Entregar | Pedidos asignados, ruta, cobro contra entrega | Celular |
| **Contador** | Cumplimiento | Facturas, factura global, reportes fiscales, exportaciones | PC |
| **Comensal** (externo) | Buena experiencia | Menú QR, pedir/pagar desde mesa, autofactura, lealtad, reservas | Su celular |
| **Administrador de la plataforma** (interno CONVIVIUM) | Operar el SaaS | Alta de clientes, planes, soporte, monitoreo | Web |

Permisos: modelo **RBAC** con permisos granulares (p. ej. "cancelar producto ya enviado a cocina" requiere PIN de gerente) y bitácora de auditoría.

---

## 4. Módulos propuestos

### Núcleo (MVP)
1. **POS / Punto de venta** — comedor, para llevar, mostrador; mapa de mesas; modificadores y combos; cuentas divididas; cortesías y descuentos con autorización; modo offline.
2. **Comandas y KDS** — ruteo por estación (cocina, barra, postres), tiempos, impresión térmica como alternativa.
3. **Menú y catálogo** — productos, categorías, modificadores, precios por canal/horario/sucursal, disponibilidad ("86").
4. **Caja y pagos** — apertura/cierre, arqueo, retiros, formas de pago mixtas, integración terminales, propinas.
5. **Facturación CFDI 4.0** — autofactura por QR, factura global, cancelaciones.
6. **Usuarios, roles y permisos** — RBAC, PIN rápido, auditoría.
7. **Reportes básicos** — ventas por día/producto/mesero/forma de pago, corte Z.

### Operación (fase 2)
8. **Inventario y recetas** — insumos, recetas/subrecetas, descuento automático por venta, costo teórico vs. real, mermas, conteos.
9. **Compras y proveedores** — órdenes de compra, recepción, cuentas por pagar.
10. **Delivery y pedidos en línea** — agregador Rappi/Uber/DiDi, tienda en línea propia, WhatsApp.
11. **Reservaciones y lista de espera.**
12. **Personal** — turnos, checador, reparto de propinas, exportación a nómina.

### Crecimiento (fase 3)
13. **Multi‑sucursal / franquicias** — menú central, precios por zona, consolidado.
14. **CRM y lealtad** — perfil del cliente, puntos, cupones, campañas.
15. **Autoservicio** — menú QR, pedir y pagar en mesa, kioscos.
16. **Analítica e IA** — pronóstico de demanda, sugerencia de compras, ingeniería de menú (estrellas/perros), detección de anomalías y fraude.
17. **Integraciones / API abierta** — contabilidad (CONTPAQi, Aspel), marketplace de apps.

---

## 5. Requerimientos no funcionales

- **Disponibilidad**: operación local sin internet, sincronización y resolución de conflictos.
- **Rendimiento**: respuesta de UI < 200 ms en POS; envío a cocina < 1 s en red local.
- **Multi‑tenant SaaS** con aislamiento por restaurante/sucursal.
- **Seguridad**: cifrado en tránsito y reposo; nunca almacenar datos de tarjeta (delegar a terminal/PCI); auditoría inmutable.
- **Multiplataforma**: web + tablets Android/iPad + celular; impresoras ESC/POS; cajón de dinero.
- **Escalabilidad**: de una fonda a cadenas de 100+ sucursales.
- **Usabilidad**: aprendizaje de mesero en < 15 min; español MX.

---

## 6. Propuesta de valor preliminar

> *"La potencia de Soft Restaurant con la experiencia de Toast, en la nube y funcionando sin internet, con facturación y delivery mexicanos integrados desde el día uno."*

Segmento inicial sugerido: **restaurantes independientes y pequeñas cadenas (1–10 sucursales)** en México, hoy atendidos por software local antiguo o soluciones demasiado básicas.

---

## 7. Preguntas abiertas para validar

1. ¿Segmento objetivo: fondas/cafeterías, casual dining, fine dining, bares, dark kitchens, cadenas?
2. ¿Hardware propio o traer‑tu‑propio‑dispositivo?
3. ¿Procesaremos pagos (ingreso por comisión) o solo integraremos terminales?
4. ¿Modelo de precio: por sucursal, por módulo, por dispositivo?
5. ¿PAC de facturación a utilizar?
6. ¿Qué módulos entran al MVP definitivo?
7. ¿Tenemos acceso a restaurantes piloto para entrevistas?

## 8. Siguientes pasos

1. Validar este documento y responder preguntas abiertas.
2. Entrevistas con 5–10 restaurantes (dueño, gerente, mesero, cocina).
3. Mapas de procesos (flujo de orden, cierre de caja, facturación).
4. Historias de usuario y priorización MoSCoW del MVP.
5. Fase 2: arquitectura técnica y UX/UI.
