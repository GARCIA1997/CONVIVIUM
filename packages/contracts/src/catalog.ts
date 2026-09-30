import { z } from "zod";
import { Cents, Id } from "./common.js";

export const Category = z.object({ id: Id, name: z.string(), sortOrder: z.number().int(), active: z.boolean() });

export const Modifier = z.object({ id: Id, name: z.string(), priceDelta: Cents });
export const ModifierGroup = z.object({
  id: Id,
  name: z.string(),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(1),
  modifiers: z.array(Modifier),
});

export const Product = z.object({
  id: Id,
  categoryId: Id,
  name: z.string(),
  description: z.string().max(160).nullable().default(null),
  sku: z.string().max(24).nullable().default(null),
  badges: z.array(z.enum(["nuevo", "picante", "vegetariano", "recomendado"])).max(4).default([]),
  price: Cents.describe("Precio con impuestos incluidos"),
  iepsPct: z.number().min(0).max(200).default(0),
  targetPrepSec: z.number().int().positive(),
  stationIds: z.array(Id).min(1),
  modifierGroups: z.array(ModifierGroup),
  /** Foto subida (/media/…) o URL externa. */
  photoUrl: z.string().max(500).refine((s) => s.startsWith("/media/") || /^https?:\/\//.test(s), "URL de foto inválida").nullable(),
  active: z.boolean(),
  soldOut: z.boolean(),
});
export type Product = z.infer<typeof Product>;

export const ProductUpsert = Product.omit({ id: true, modifierGroups: true }).extend({
  modifierGroupIds: z.array(Id).default([]),
});

/** Foto del platillo como data URL (JPG, PNG o WebP, máx. 5 MB). */
export const ProductPhotoBody = z.object({ dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Formato no soportado: usa JPG, PNG o WebP") });

export const SetSoldOutBody = z.object({ soldOut: z.boolean() });

export const Menu = z.object({ version: z.number().int(), ivaPct: z.number().int().default(16), categories: z.array(Category), products: z.array(Product) });

export const ModifierGroupUpsert = z.object({
  name: z.string().trim().min(2).max(60),
  minSelect: z.number().int().min(0).max(10),
  maxSelect: z.number().int().min(1).max(20),
  modifiers: z.array(z.object({ id: Id.optional(), name: z.string().trim().min(1).max(60), priceDelta: z.number().int().min(0) })).min(1).max(30),
}).refine((g) => g.minSelect <= g.maxSelect, { message: "El mínimo no puede ser mayor al máximo", path: ["minSelect"] });
export const CategoryUpsert = z.object({ name: z.string().trim().min(2).max(40), active: z.boolean().default(true) });
