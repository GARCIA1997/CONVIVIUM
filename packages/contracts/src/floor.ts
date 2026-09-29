import { z } from "zod";
import { Id } from "./common.js";

export const TableStatus = z.enum(["libre", "ocupada", "listo_por_entregar", "pidio_cuenta"]);
export const Area = z.object({ id: Id, name: z.string(), sortOrder: z.number().int() });
export const Table = z.object({
  id: Id,
  areaId: Id,
  label: z.string(),
  capacity: z.number().int().positive(),
  shape: z.enum(["redonda", "cuadrada", "rectangular", "periquera"]),
  x: z.number(),
  y: z.number(),
  rotation: z.number().int(),
  mergeableWith: z.array(Id),
  assignedUserId: Id.nullable(),
  assignedName: z.string().nullable(),
  /** Si la mesa está unida a otra: la clave de la mesa principal. */
  joinedTo: z.string().nullable(),
  status: TableStatus,
  openCheckId: Id.nullable(),
  guests: z.number().int().nullable(),
  openedAt: z.string().nullable(),
  total: z.number().int().nullable(),
  itemCount: z.number().int().nullable(),
  readyStation: z.string().nullable(),
});
export const Fixture = z.object({
  id: Id,
  areaId: Id,
  kind: z.enum(["muro", "barra", "puerta", "estacion_servicio", "ventanal", "cocina"]),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number().int(),
});
export const FloorPlan = z.object({ areas: z.array(Area), tables: z.array(Table), fixtures: z.array(Fixture) });

export const Station = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(["cocina", "barra"]),
  output: z.enum(["pantalla", "impresora", "ambos"]),
  printerFallback: z.boolean(),
  defaultTargetSec: z.number().int().positive(),
});
