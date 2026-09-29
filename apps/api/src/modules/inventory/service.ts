import { and, eq, inArray, schema, sql, type Db } from "@convivium/db";
import { breakdownIncludedTaxes, costPct, explode, purchaseSuggestion, recipeCost, weightedAvgCost, type RecipeInput } from "@convivium/domain";
import type { FastifyInstance } from "fastify";
import { recordEvent } from "../../lib/audit.js";
import type { Principal } from "../../plugins/auth.js";
import { conflict, notFound } from "../../plugins/errors.js";

type ItemRow = typeof schema.orderItems.$inferSelect;
const num = (v: string | number | null | undefined) => Number(v ?? 0);

/**
 * Inventario y recetas (E7). Cantidades en unidad de uso; costos en centavos por unidad de uso.
 * Toda existencia cambia únicamente a través de `move()`, que registra el movimiento.
 */
export class InventoryService {
  constructor(private app: FastifyInstance, private db: Db = app.db) {}

  // ---------- Insumos y existencias ----------

  async ingredients(who: Principal, warehouseId?: string) {
    const [ings, stock, lines, whs] = await Promise.all([
      this.db.select().from(schema.ingredients).where(eq(schema.ingredients.tenantId, who.tenantId)),
      this.db.select().from(schema.stock).where(eq(schema.stock.tenantId, who.tenantId)),
      this.db.select({ ingredientId: schema.recipeLines.ingredientId, productId: schema.recipes.productId }).from(schema.recipeLines).innerJoin(schema.recipes, eq(schema.recipes.id, schema.recipeLines.recipeId)),
      this.db.select().from(schema.warehouses).where(eq(schema.warehouses.branchId, who.branchId)),
    ]);
    return ings.map((i) => {
      const byWh = Object.fromEntries(whs.map((w) => [w.id, num(stock.find((s) => s.ingredientId === i.id && s.warehouseId === w.id)?.quantity)]));
      const total = Object.values(byWh).reduce((a, b) => a + b, 0);
      const qty = warehouseId ? (byWh[warehouseId] ?? 0) : total;
      return {
        id: i.id,
        name: i.name,
        category: i.category,
        purchaseUnit: i.purchaseUnit,
        useUnit: i.useUnit,
        conversion: num(i.conversion),
        minStock: num(i.minStock),
        maxStock: num(i.maxStock),
        critical: i.critical,
        lotTracking: i.lotTracking,
        avgCost: i.avgCost,
        stock: qty,
        stockByWarehouse: byWh,
        belowMin: total < num(i.minStock),
        affectsProducts: new Set(lines.filter((l) => l.ingredientId === i.id && l.productId).map((l) => l.productId)).size,
      };
    });
  }

  async upsertIngredient(who: Principal, body: Record<string, unknown> & { conversion: number; minStock: number; maxStock: number }, id?: string) {
    const values = { ...body, conversion: String(body.conversion), minStock: String(body.minStock), maxStock: String(body.maxStock) } as never;
    if (id) {
      const [r] = await this.db.update(schema.ingredients).set(values).where(and(eq(schema.ingredients.id, id), eq(schema.ingredients.tenantId, who.tenantId))).returning();
      if (!r) throw notFound("Insumo");
      await recordEvent(this.db, who, { type: "ingredient.updated", entity: "ingredient", entityId: id, data: body });
      return r;
    }
    const [r] = await this.db.insert(schema.ingredients).values({ ...(values as object), tenantId: who.tenantId } as never).returning();
    await recordEvent(this.db, who, { type: "ingredient.created", entity: "ingredient", entityId: r!.id, data: body });
    return r!;
  }

  /** Único punto que modifica existencias. qty positivo = entrada, negativo = salida. */
  async move(who: Principal, m: { type: "venta" | "merma" | "traspaso" | "ajuste" | "produccion" | "recepcion"; ingredientId: string; warehouseId: string; qty: number; unitCost?: number; referenceId?: string; reasonId?: string }) {
    await this.db
      .insert(schema.stock)
      .values({ tenantId: who.tenantId, warehouseId: m.warehouseId, ingredientId: m.ingredientId, quantity: String(m.qty) })
      .onConflictDoUpdate({ target: [schema.stock.warehouseId, schema.stock.ingredientId], set: { quantity: sql`${schema.stock.quantity} + ${m.qty}` } });
    await this.db.insert(schema.stockMovements).values({
      tenantId: who.tenantId,
      branchId: who.branchId,
      type: m.type,
      ingredientId: m.ingredientId,
      warehouseId: m.warehouseId,
      quantity: String(m.qty),
      unitCost: m.unitCost ?? null,
      referenceId: m.referenceId,
      reasonId: m.reasonId,
      createdBy: who.userId,
    });
  }

  async manualMovement(who: Principal, b: { type: "merma" | "traspaso" | "ajuste"; ingredientId: string; quantity: number; warehouseId: string; toWarehouseId?: string; direction: "entrada" | "salida"; reasonId?: string }) {
    if (b.type === "traspaso") {
      if (!b.toWarehouseId || b.toWarehouseId === b.warehouseId) throw conflict("bad_transfer", "Elige un almacén destino distinto");
      await this.move(who, { type: "traspaso", ingredientId: b.ingredientId, warehouseId: b.warehouseId, qty: -b.quantity });
      await this.move(who, { type: "traspaso", ingredientId: b.ingredientId, warehouseId: b.toWarehouseId, qty: b.quantity });
    } else {
      const sign = b.type === "merma" || b.direction === "salida" ? -1 : 1;
      await this.move(who, { type: b.type, ingredientId: b.ingredientId, warehouseId: b.warehouseId, qty: sign * b.quantity, reasonId: b.reasonId });
    }
    await recordEvent(this.db, who, { type: `stock.${b.type}`, entity: "ingredient", entityId: b.ingredientId, data: b });
    await this.checkCritical(who, [b.ingredientId]);
    return { ok: true };
  }

  // ---------- Recetas ----------

  private async recipeMap(tenantId: string) {
    const [rs, ls] = await Promise.all([
      this.db.select().from(schema.recipes).where(eq(schema.recipes.tenantId, tenantId)),
      this.db.select().from(schema.recipeLines),
    ]);
    const map = new Map<string, RecipeInput & { row: typeof rs[number] }>();
    for (const r of rs)
      map.set(r.id, {
        id: r.id,
        yieldQty: r.yieldQty ? num(r.yieldQty) : null,
        row: r,
        lines: ls.filter((l) => l.recipeId === r.id).map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: num(l.quantity), wastePct: num(l.wastePct) })),
      });
    return map;
  }

  private async costMap(tenantId: string) {
    const ings = await this.db.select({ id: schema.ingredients.id, avgCost: schema.ingredients.avgCost }).from(schema.ingredients).where(eq(schema.ingredients.tenantId, tenantId));
    return new Map(ings.map((i) => [i.id, i.avgCost]));
  }

  /** Receta completa con costo por línea, costo teórico y % sobre precio (E7-05). */
  async recipeDetail(who: Principal, recipeId: string) {
    const [recipes, costs] = await Promise.all([this.recipeMap(who.tenantId), this.costMap(who.tenantId)]);
    const r = recipes.get(recipeId);
    if (!r) throw notFound("Receta");
    const ings = await this.db.select().from(schema.ingredients).where(eq(schema.ingredients.tenantId, who.tenantId));
    const lines = r.lines.map((l) => {
      const one: RecipeInput = { id: "x", yieldQty: null, lines: [l] };
      const ing = ings.find((i) => i.id === l.ingredientId);
      const sub = l.subRecipeId ? recipes.get(l.subRecipeId) : undefined;
      return { ...l, name: ing?.name ?? sub?.row.name ?? "", unit: ing?.useUnit ?? "ml", unitCost: ing ? ing.avgCost : sub ? recipeCost(sub, recipes, costs) / (sub.yieldQty || 1) : 0, cost: recipeCost(one, recipes, costs) };
    });
    const cost = recipeCost(r, recipes, costs);
    let product = null;
    if (r.row.productId) {
      const [p] = await this.db.select().from(schema.products).where(eq(schema.products.id, r.row.productId));
      const [br] = await this.db.select().from(schema.branches).where(eq(schema.branches.id, who.branchId));
      if (p) {
        const net = breakdownIncludedTaxes(p.price, { ivaPct: (br?.ivaPct ?? 16) as 16 | 8, iepsPct: num(p.iepsPct) }).base;
        product = { id: p.id, name: p.name, price: p.price, netPrice: net, costPct: costPct(cost, net) };
      }
    }
    const modifierRecipes = r.row.productId
      ? [...recipes.values()].filter((x) => x.row.modifierId && x.row.productId === r.row.productId).map((x) => ({ id: x.id, name: x.row.name, cost: recipeCost(x, recipes, costs) }))
      : [];
    return { id: r.id, name: r.row.name, isSubRecipe: r.row.isSubRecipe, yieldQty: r.yieldQty, steps: r.row.steps, productId: r.row.productId, lines, cost, product, modifierRecipes };
  }

  async recipes(who: Principal) {
    const [recipes, costs] = await Promise.all([this.recipeMap(who.tenantId), this.costMap(who.tenantId)]);
    return [...recipes.values()].map((r) => ({ id: r.id, name: r.row.name, isSubRecipe: r.row.isSubRecipe, productId: r.row.productId, modifierId: r.row.modifierId, cost: recipeCost(r, recipes, costs) }));
  }

  async upsertRecipe(who: Principal, body: { name: string; productId: string | null; modifierId: string | null; isSubRecipe: boolean; yieldQty: number | null; steps: string[]; lines: { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number }[] }, id?: string) {
    const values = { name: body.name, productId: body.productId, modifierId: body.modifierId, isSubRecipe: body.isSubRecipe, yieldQty: body.yieldQty === null ? null : String(body.yieldQty), steps: body.steps };
    let recipeId = id;
    if (id) {
      const [r] = await this.db.update(schema.recipes).set({ ...values, version: sql`${schema.recipes.version} + 1` }).where(and(eq(schema.recipes.id, id), eq(schema.recipes.tenantId, who.tenantId))).returning();
      if (!r) throw notFound("Receta");
      await this.db.delete(schema.recipeLines).where(eq(schema.recipeLines.recipeId, id));
    } else {
      const [r] = await this.db.insert(schema.recipes).values({ ...values, tenantId: who.tenantId }).returning();
      recipeId = r!.id;
    }
    await this.db.insert(schema.recipeLines).values(body.lines.map((l) => ({ recipeId: recipeId!, ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: String(l.quantity), wastePct: String(l.wastePct) })));
    await recordEvent(this.db, who, { type: id ? "recipe.updated" : "recipe.created", entity: "recipe", entityId: recipeId, data: body });
    return this.recipeDetail(who, recipeId!);
  }

  /** E7-04 · Producción de subreceta: descuenta insumos y suma el preparado como insumo "SR: <nombre>". */
  async produce(who: Principal, b: { recipeId: string; batches: number; warehouseId: string }) {
    const recipes = await this.recipeMap(who.tenantId);
    const r = recipes.get(b.recipeId);
    if (!r?.row.isSubRecipe) throw conflict("not_subrecipe", "Solo se producen subrecetas");
    const costs = await this.costMap(who.tenantId);
    for (const [ingredientId, qty] of explode(r, recipes, b.batches)) await this.move(who, { type: "produccion", ingredientId, warehouseId: b.warehouseId, qty: -qty, referenceId: r.id });
    // El preparado vive como insumo propio para poder contarse y usarse en recetas.
    const name = `SR: ${r.row.name}`;
    let [prep] = await this.db.select().from(schema.ingredients).where(and(eq(schema.ingredients.tenantId, who.tenantId), eq(schema.ingredients.name, name)));
    const unitCost = recipeCost(r, recipes, costs) / (r.yieldQty || 1);
    if (!prep) [prep] = await this.db.insert(schema.ingredients).values({ tenantId: who.tenantId, name, purchaseUnit: "lote", useUnit: "ml", conversion: String(r.yieldQty ?? 1), avgCost: unitCost, category: "Preparados" }).returning();
    await this.move(who, { type: "produccion", ingredientId: prep!.id, warehouseId: b.warehouseId, qty: (r.yieldQty ?? 1) * b.batches, unitCost, referenceId: r.id });
    await recordEvent(this.db, who, { type: "production", entity: "recipe", entityId: r.id, data: b });
    return { produced: (r.yieldQty ?? 1) * b.batches, unit: "ml", ingredientId: prep!.id };
  }

  // ---------- Descuento automático por venta (E7-06) ----------

  /** Almacén de salida según el tipo de estación: barra → "Barra", cocina → "Cocina"; si no existe, "General". */
  private async warehouseForStation(branchId: string, stationId: string) {
    const [[st], whs] = await Promise.all([
      this.db.select().from(schema.stations).where(eq(schema.stations.id, stationId)),
      this.db.select().from(schema.warehouses).where(eq(schema.warehouses.branchId, branchId)),
    ]);
    const want = st?.kind === "barra" ? "barra" : "cocina";
    return (whs.find((w) => w.name.toLowerCase() === want) ?? whs.find((w) => w.name.toLowerCase() === "general") ?? whs[0])?.id;
  }

  /** Aplica la receta del producto (y de sus modificadores) al enviar o revertir un producto. */
  async applySale(who: Principal, items: ItemRow[], sign: 1 | -1) {
    const priced = items.filter((i) => i.unitPrice > 0 || i.priority === "rehacer");
    if (!priced.length) return;
    const recipes = await this.recipeMap(who.tenantId);
    const byProduct = new Map<string, RecipeInput>();
    const byModifier = new Map<string, RecipeInput>();
    for (const r of recipes.values()) {
      if (r.row.modifierId) byModifier.set(r.row.modifierId, r);
      else if (r.row.productId && !r.row.isSubRecipe) byProduct.set(r.row.productId, r);
    }
    const touched = new Set<string>();
    for (const i of priced) {
      const wh = await this.warehouseForStation(who.branchId, i.stationId);
      if (!wh) continue;
      const parts = [byProduct.get(i.productId), ...i.modifiers.map((m) => byModifier.get(m.id))].filter(Boolean) as RecipeInput[];
      for (const r of parts)
        for (const [ingredientId, qty] of explode(r, recipes, i.quantity)) {
          await this.move(who, { type: "venta", ingredientId, warehouseId: wh, qty: -sign * qty, referenceId: i.id });
          touched.add(ingredientId);
        }
    }
    await this.checkCritical(who, [...touched]);
  }

  /** E7-07 · Si un insumo crítico queda en cero o menos, marca agotados los productos que lo usan. */
  async checkCritical(who: Principal, ingredientIds: string[]) {
    if (!ingredientIds.length) return;
    const crit = await this.db.select().from(schema.ingredients).where(and(inArray(schema.ingredients.id, ingredientIds), eq(schema.ingredients.critical, true)));
    if (!crit.length) return;
    const stock = await this.db.select().from(schema.stock).where(inArray(schema.stock.ingredientId, crit.map((c) => c.id)));
    const out = crit.filter((c) => stock.filter((s) => s.ingredientId === c.id).reduce((a, s) => a + num(s.quantity), 0) <= 0);
    if (!out.length) return;
    const recipes = await this.recipeMap(who.tenantId);
    const products = new Set<string>();
    for (const r of recipes.values()) {
      if (!r.row.productId || r.row.modifierId) continue;
      const used = explode(r, recipes);
      if (out.some((c) => used.has(c.id))) products.add(r.row.productId);
    }
    for (const productId of products) {
      await this.db
        .insert(schema.productAvailability)
        .values({ productId, branchId: who.branchId, soldOut: true })
        .onConflictDoUpdate({ target: [schema.productAvailability.productId, schema.productAvailability.branchId], set: { soldOut: true } });
      this.app.hub.publish(["menu"], { type: "product.sold_out", productId, soldOut: true });
    }
  }

  // ---------- Conteos físicos (E7-09) ----------

  async submitCount(who: Principal, b: { warehouseId: string; lines: { ingredientId: string; counted: number }[] }) {
    const ings = await this.ingredients(who, b.warehouseId);
    const [c] = await this.db.insert(schema.inventoryCounts).values({ tenantId: who.tenantId, branchId: who.branchId, warehouseId: b.warehouseId, countedBy: who.userId }).returning();
    await this.db.insert(schema.inventoryCountLines).values(
      b.lines.map((l) => {
        const ing = ings.find((i) => i.id === l.ingredientId);
        return { countId: c!.id, ingredientId: l.ingredientId, theoretical: String(ing?.stock ?? 0), counted: String(l.counted), unitCost: ing?.avgCost ?? 0 };
      }),
    );
    await recordEvent(this.db, who, { type: "count.submitted", entity: "inventory_count", entityId: c!.id, data: b });
    return this.countDetail(who, c!.id);
  }

  async countDetail(who: Principal, id: string) {
    const [c] = await this.db.select().from(schema.inventoryCounts).where(and(eq(schema.inventoryCounts.id, id), eq(schema.inventoryCounts.tenantId, who.tenantId)));
    if (!c) throw notFound("Conteo");
    const lines = await this.db
      .select({ ingredientId: schema.inventoryCountLines.ingredientId, theoretical: schema.inventoryCountLines.theoretical, counted: schema.inventoryCountLines.counted, unitCost: schema.inventoryCountLines.unitCost, name: schema.ingredients.name, unit: schema.ingredients.useUnit })
      .from(schema.inventoryCountLines)
      .innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.inventoryCountLines.ingredientId))
      .where(eq(schema.inventoryCountLines.countId, id));
    const out = lines.map((l) => ({ ...l, theoretical: num(l.theoretical), counted: num(l.counted), diff: num(l.counted) - num(l.theoretical), diffValue: Math.round((num(l.counted) - num(l.theoretical)) * l.unitCost) }));
    return { ...c, createdAt: c.createdAt.toISOString(), approvedAt: c.approvedAt?.toISOString() ?? null, lines: out, totalDiffValue: out.reduce((s, l) => s + l.diffValue, 0) };
  }

  async listCounts(who: Principal, status?: string) {
    const rows = await this.db.select().from(schema.inventoryCounts).where(and(eq(schema.inventoryCounts.branchId, who.branchId), ...(status ? [eq(schema.inventoryCounts.status, status as never)] : [])));
    return Promise.all(rows.map((r) => this.countDetail(who, r.id)));
  }

  /** El gerente aprueba (ajusta existencias a lo contado) o rechaza. Quien contó no puede aprobar su propio conteo. */
  async resolveCount(who: Principal, id: string, approve: boolean) {
    const c = await this.countDetail(who, id);
    if (c.status !== "pendiente_aprobacion") throw conflict("already_resolved", "El conteo ya fue resuelto");
    if (c.countedBy === who.userId) throw conflict("self_approval", "No puedes aprobar tu propio conteo");
    if (approve) for (const l of c.lines) if (l.diff !== 0) await this.move(who, { type: "ajuste", ingredientId: l.ingredientId, warehouseId: c.warehouseId, qty: l.diff, referenceId: id });
    await this.db.update(schema.inventoryCounts).set({ status: approve ? "aprobado" : "rechazado", approvedBy: who.userId, approvedAt: new Date() }).where(eq(schema.inventoryCounts.id, id));
    await recordEvent(this.db, who, { type: approve ? "count.approved" : "count.rejected", entity: "inventory_count", entityId: id, data: { totalDiffValue: c.totalDiffValue }, authorizedBy: who.userId });
    if (approve) await this.checkCritical(who, c.lines.map((l) => l.ingredientId));
    return this.countDetail(who, id);
  }

  // ---------- Sugerencia de compra (E7-12) ----------

  async purchaseSuggestions(who: Principal) {
    const [ings, prices, suppliers] = await Promise.all([
      this.ingredients(who),
      this.db.select().from(schema.supplierPrices),
      this.db.select().from(schema.suppliers).where(eq(schema.suppliers.tenantId, who.tenantId)),
    ]);
    return ings
      .map((i) => {
        const qty = purchaseSuggestion(i.stock, i.minStock, i.maxStock, i.conversion);
        const best = prices.filter((p) => p.ingredientId === i.id).sort((a, b) => a.unitPrice - b.unitPrice)[0];
        return { ingredientId: i.id, name: i.name, stock: i.stock, minStock: i.minStock, useUnit: i.useUnit, purchaseUnit: i.purchaseUnit, suggestedQty: qty, supplierId: best?.supplierId ?? null, supplierName: suppliers.find((s) => s.id === best?.supplierId)?.name ?? null, unitPrice: best?.unitPrice ?? null };
      })
      .filter((s) => s.suggestedQty > 0);
  }

  /** Recepción de mercancía (usada por compras): suma existencias y actualiza costo promedio. */
  async receive(who: Principal, warehouseId: string, ingredientId: string, purchaseQty: number, purchaseUnitPrice: number, referenceId?: string) {
    const [ing] = await this.db.select().from(schema.ingredients).where(eq(schema.ingredients.id, ingredientId));
    if (!ing) throw notFound("Insumo");
    const conv = num(ing.conversion) || 1;
    const useQty = purchaseQty * conv;
    const inCost = purchaseUnitPrice / conv;
    const stockRows = await this.db.select().from(schema.stock).where(eq(schema.stock.ingredientId, ingredientId));
    const current = stockRows.reduce((a, s) => a + num(s.quantity), 0);
    await this.db.update(schema.ingredients).set({ avgCost: weightedAvgCost(current, ing.avgCost, useQty, inCost) }).where(eq(schema.ingredients.id, ingredientId));
    await this.move(who, { type: "recepcion", ingredientId, warehouseId, qty: useQty, unitCost: inCost, referenceId });
  }
}
