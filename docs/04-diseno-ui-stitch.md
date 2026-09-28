# CONVIVIUM — Diseño UI en Stitch (por historia de usuario)

> Proyecto Stitch: **CONVIVIUM — MVP** (`12073236036115109766`) · Design system: `assets/7531721147782424560`
> Deriva de [03-historias-de-usuario-mvp.md](03-historias-de-usuario-mvp.md) · Fecha: 2026-09-27

## Design system (branding)

| Token | Color | Uso |
|---|---|---|
| Verde Olivo | `#1E2F28` | Primario, barras, botones principales |
| Marfil | `#EAE6DD` | Fondo principal |
| Arena | `#C9B89F` | Bordes, divisores |
| Terracota | `#B45A3C` | Acento, alertas, "pidió cuenta", excedido |
| Carbón | `#1A1A1A` | Texto; fondo de KDS en TV |
| Dorado | `#D4AF7C` | Destacados, "listo por entregar" |

Tipografía: **Playfair Display** (títulos/marca) + **Inter** (UI). Radio 8 px, iconos de línea fina.
Tagline: *Donde todo sucede en la mesa.*

## Avance por HU

| HU | Pantalla | Dispositivo | Estado |
|---|---|---|---|
| E1-03 | Login rápido por PIN (kiosco) | Móvil | ✅ Generada |
| E3-01 | Plano de mesas con estado por color | Móvil | ✅ Generada |
| E3-02 / E3-03 | Captura de comanda (modificadores, comensal, tiempos, *Marchar*) | Móvil | ✅ Generada |
| E4-01 / 02 / 04 | KDS Cocina en TV (semáforo, REHACER, cancelado, alérgeno, consolidado) | TV / escritorio | ✅ Generada |
| E4-03 / E4-05 | Terminal táctil de despacho · Barra | Tablet | ✅ Generada |
| E5-01 | Aprobaciones remotas del gerente | Móvil | ✅ Generada |
| E6-02 / 03 / 04 / 05 | Caja: cuenta, dividir, pagos mixtos, propina | Escritorio | ✅ Generada |
| E6-06 / E6-07 | Corte Z con conteo ciego | Escritorio | ✅ Generada |
| E2-01 / 02 / 04 / 07 | Editor de producto (IVA/IEPS, estaciones, modificadores, agotado) | Escritorio | ✅ Generada |
| E7-03 / 04 / 05 / 11 | Receta estandarizada (subreceta, costo teórico, coctelería en ml) | Escritorio | ✅ Generada |
| E9-01 | Dashboard en vivo del dueño | Escritorio | ✅ Generada |
| E8-03 / E8-04 | Recepción contra OC + XML CFDI | Tablet | ✅ Generada |
| E1-02 / E1-05 | Usuarios, roles, matriz de permisos y topes | Escritorio | ✅ Generada |
| E2-03 / E4-09 / E1-04 | Estaciones, dispositivos e impresión de respaldo | Escritorio | ✅ Generada |
| E3-08 / E5-03 | Devolución de platillo (Rehacer / Retirar) | Móvil | ✅ Generada |
| E7-09 | Conteo físico de barra | Móvil | ✅ Generada |
| E8-05 / 06 / 07 | Cuentas por pagar y pagos a proveedor | Escritorio | ✅ Generada |
| E1-07 / E1-08 | Jerarquía de roles, rol personalizado, multi-rol | Escritorio | ✅ Generada |
| E4-03 / E4-07 | Táctil de despacho de Cocina con receta | Tablet | ✅ Generada |
| E4-10 / E3-10 | Capitán: supervisión de piso y cuentas de barra | Móvil | ✅ Generada |
| E9-02 / E9-03 | Reportes: devoluciones, cortesías y radar de fraude | Escritorio | ✅ Generada |
| E6-01 | Apertura de caja | Escritorio | ✅ Generada |
| E1-06 | Bitácora de auditoría | Escritorio | ⏳ En generación |
| E2-05 | Editor del plano de mesas | Escritorio | ⏳ En generación |
| E2-06 | Promociones por horario | Escritorio | ⏳ En generación |
| E7-01 / 02 / 07 | Insumos y almacenes | Escritorio | ⏳ En generación |
| E7-12 / E8-01 / E8-02 | Sugerencia de compra y orden de compra | Escritorio | ⏳ En generación |
| E9-05 | Ingeniería de menú y costo real vs teórico | Escritorio | ⏳ En generación |

## Pendientes (siguiente bloque)
E4-06 consolidado (incluido en KDS) · E4-08 vista de expedición (Could) · E5-06 alertas de fraude (incluido en reportes) · E6-08 reabrir cuenta · E9-04 tiempos de preparación · E9-06 comparativo de sucursales.

## Jerarquía de roles (E1-07)
Dueño ⊇ Gerente ⊇ Almacenista · Gerente ⊇ Capitán ⊇ Mesero. Las pantallas se diseñan por tarea, no por rol; el rol solo define permisos.
