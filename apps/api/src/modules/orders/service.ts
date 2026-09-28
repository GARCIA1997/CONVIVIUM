import type { orders } from "@convivium/contracts";
import { and, eq, inArray, schema, type Db } from "@convivium/db";
import { cancelRequirement, canTransition, type ItemState } from "@convivium/domain";
import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import { PrintQueue } from "../../lib/printer.js";
import type { Principal } from "../../plugins/auth.js";
import { AppError, conflict, notFound } from "../../plugins/errors.js";
import { lineTotal, toItemDto } from "./mapper.js";

type ItemRow = typeof schema.orderItems.$inferSelect;

export class OrdersService {
  private printer: PrintQueue;
  constructor(private app: FastifyInstance, private db: Db = app.db) {
    this.printer = new PrintQueue(app);
  }

  async getCheck(who: Principal, checkId: string) {
    const [check] = await this.db.select().from(schema.checks).where(and(eq(schema.checks.id, checkId), eq(schema.checks.branchId, who.branchId)));
    if (!check) throw notFound("Cuenta");
    const items = await this.db.select().from(schema.orderItems).where(eq(schema.orderItems.checkId, checkId));
    const discountRows = await this.db.select().from(schema.discounts).where(eq(schema.discounts.checkId, checkId));
    const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
    const discounts = discountRows.reduce((s, d) => s + d.amount, 0);
    const [table] = check.tableId ? await this.db.select().from(schema.tables).where(eq(schema.tables.id, check.tableId)) : [];
    const [waiter] = await this.db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, check.waiterId));
    return {
      ...check,
      tableLabel: table?.label ?? null,
      waiterName: waiter?.name ?? null,
      openedAt: check.openedAt.toISOString(),
      items: items.map(toItemDto),
      subtotal,
      discounts,
      total: Math.max(0, subtotal - discounts),
    };
  }

  /** Cuentas abiertas con mesa, mesero, total y artículos (lista de caja, E6-02). */
  async listOpen(who: Principal, statuses: ("abierta" | "pidio_cuenta" | "cobrada" | "cancelada")[]) {
    const checks = await this.db.select().from(schema.checks).where(and(eq(schema.checks.branchId, who.branchId), inArray(schema.checks.status, statuses)));
    if (!checks.length) return [];
    const ids = checks.map((c) => c.id);
    const tableIds = checks.map((c) => c.tableId).filter((x): x is string => !!x);
    const [items, discounts, tables, waiters] = await Promise.all([
      this.db.select().from(schema.orderItems).where(inArray(schema.orderItems.checkId, ids)),
      this.db.select().from(schema.discounts).where(inArray(schema.discounts.checkId, ids)),
      tableIds.length ? this.db.select().from(schema.tables).where(inArray(schema.tables.id, tableIds)) : [],
      this.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, checks.map((c) => c.waiterId))),
    ]);
    return checks
      .map((c) => {
        const mine = items.filter((i) => i.checkId === c.id);
        const sub = mine.reduce((s, i) => s + lineTotal(i), 0);
        const disc = discounts.filter((d) => d.checkId === c.id).reduce((s, d) => s + d.amount, 0);
        return {
          id: c.id,
          kind: c.kind,
          status: c.status,
          tableLabel: tables.find((t) => t.id === c.tableId)?.label ?? null,
          name: c.name,
          guests: c.guests,
          waiterName: waiters.find((w) => w.id === c.waiterId)?.name ?? null,
          total: Math.max(0, sub - disc),
          itemCount: mine.filter((i) => i.unitPrice > 0 && i.state !== "cancelado" && i.state !== "devuelto").reduce((s, i) => s + i.quantity, 0),
          openedAt: c.openedAt.toISOString(),
        };
      })
      .sort((a, b) => Number(b.status === "pidio_cuenta") - Number(a.status === "pidio_cuenta") || a.openedAt.localeCompare(b.openedAt));
  }

  async openCheck(who: Principal, body: z.infer<typeof orders.OpenCheckBody>) {
    if (body.kind === "mesa") {
      const [busy] = await this.db
        .select({ id: schema.checks.id })
        .from(schema.checks)
        .where(and(eq(schema.checks.tableId, body.tableId), inArray(schema.checks.status, ["abierta", "pidio_cuenta"])));
      if (busy) throw conflict("table_busy", "La mesa ya tiene una cuenta abierta");
    }
    const [check] = await this.db
      .insert(schema.checks)
      .values({
        tenantId: who.tenantId,
        branchId: who.branchId,
        kind: body.kind,
        tableId: body.kind === "mesa" ? body.tableId : null,
        guests: body.kind === "mesa" ? body.guests : null,
        name: body.kind === "barra" ? body.name : null,
        waiterId: who.userId,
      })
      .returning();
    await recordEvent(this.db, who, { type: "check.opened", entity: "check", entityId: check!.id, data: body });
    if (body.kind === "mesa") this.app.hub.publish(["floor"], { type: "table.status", tableId: body.tableId, status: "ocupada" });
    return check!;
  }

  /** E3-02 · Agrega productos; se rutea cada uno a su(s) estación(es) (E2-04). */
  async addItems(who: Principal, checkId: string, body: z.infer<typeof orders.AddItemsBody>) {
    const check = await this.getCheck(who, checkId);
    if (check.status !== "abierta") throw conflict("check_closed", "La cuenta no está abierta");
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const [products, routes, avail] = await Promise.all([
      this.db.select().from(schema.products).where(inArray(schema.products.id, productIds)),
      this.db.select().from(schema.productStations).where(inArray(schema.productStations.productId, productIds)),
      this.db.select().from(schema.productAvailability).where(and(inArray(schema.productAvailability.productId, productIds), eq(schema.productAvailability.branchId, who.branchId))),
    ]);
    const modIds = body.items.flatMap((i) => i.modifierIds);
    const mods = modIds.length ? await this.db.select().from(schema.modifiers).where(inArray(schema.modifiers.id, modIds)) : [];

    const now = new Date();
    const rows: (typeof schema.orderItems.$inferInsert)[] = [];
    for (const input of body.items) {
      const product = products.find((p) => p.id === input.productId);
      if (!product || !product.active) throw notFound("Producto");
      if (avail.find((a) => a.productId === product.id)?.soldOut) throw conflict("sold_out", `${product.name} está agotado`);
      const stationIds = routes.filter((r) => r.productId === product.id).map((r) => r.stationId);
      if (!stationIds.length) throw conflict("no_station", `${product.name} no tiene estación asignada`);
      const itemMods = mods.filter((m) => input.modifierIds.includes(m.id)).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta }));
      // Un renglón por estación; el precio va solo en la estación principal.
      stationIds.forEach((stationId, idx) =>
        rows.push({
          tenantId: who.tenantId,
          branchId: who.branchId,
          checkId,
          productId: product.id,
          productName: product.name,
          stationId,
          quantity: input.quantity,
          unitPrice: idx === 0 ? product.price : 0,
          modifiers: idx === 0 ? itemMods : itemMods.map((m) => ({ ...m, priceDelta: 0 })),
          note: input.note ?? null,
          guest: input.guest ?? null,
          course: input.course,
          targetPrepSec: product.targetPrepSec,
          createdBy: who.userId,
          state: input.fireNow ? "enviado" : "pendiente",
          sentAt: input.fireNow ? now : null,
        }),
      );
    }
    const inserted = await this.db.insert(schema.orderItems).values(rows).returning();
    await recordEvent(this.db, who, { type: "items.added", entity: "check", entityId: checkId, data: body });
    this.broadcastSent(inserted.filter((i) => i.state === "enviado"));
    return inserted.map(toItemDto);
  }

  /** E3-03 · "Marchar" un tiempo: envía a estación lo pendiente de ese tiempo. */
  async fireCourse(who: Principal, checkId: string, course: string) {
    await this.getCheck(who, checkId);
    const updated = await this.db
      .update(schema.orderItems)
      .set({ state: "enviado", sentAt: new Date() })
      .where(and(eq(schema.orderItems.checkId, checkId), eq(schema.orderItems.course, course as never), eq(schema.orderItems.state, "pendiente")))
      .returning();
    this.broadcastSent(updated);
    return updated.map(toItemDto);
  }

  /** E4-03 (listo, deshacer) y E3-05 (entregado). */
  async transition(who: Principal, itemId: string, to: ItemState) {
    const item = await this.getItem(who, itemId);
    if (!canTransition(item.state, to)) throw conflict("invalid_transition", `No se puede pasar de ${item.state} a ${to}`);
    const patch: Partial<ItemRow> = { state: to };
    if (to === "listo") Object.assign(patch, { readyAt: new Date(), readyBy: who.userId });
    if (to === "entregado") patch.deliveredAt = new Date();
    if (item.state === "listo" && to === "enviado") patch.readyAt = null; // deshacer
    const [updated] = await this.db.update(schema.orderItems).set(patch).where(eq(schema.orderItems.id, itemId)).returning();
    await recordEvent(this.db, who, { type: `item.${to}`, entity: "order_item", entityId: itemId, data: { from: item.state, to } });
    await this.notifyItem(updated!);
    return toItemDto(updated!);
  }

  /** E5-04 · Cancelación según estado (libre / motivo / autorización). */
  async cancel(who: Principal, itemId: string, body: z.infer<typeof orders.CancelItemBody>, authorizedBy?: string) {
    const item = await this.getItem(who, itemId);
    const req = cancelRequirement(item.state);
    if (req === "autorizacion" && !authorizedBy) return { status: "requires_approval" as const };
    if (!canTransition(item.state, "cancelado")) throw conflict("invalid_transition", "No se puede cancelar");
    const [updated] = await this.db.update(schema.orderItems).set({ state: "cancelado" }).where(eq(schema.orderItems.id, itemId)).returning();
    await recordEvent(this.db, who, { type: "item.cancelled", entity: "order_item", entityId: itemId, data: { ...body, fromState: item.state }, authorizedBy });
    await this.notifyItem(updated!);
    return { status: "cancelled" as const, item: toItemDto(updated!) };
  }

  /** E5-03 · Devolución: rehacer (vuelve con prioridad) o retirar (requiere autorización). */
  async returnItem(who: Principal, itemId: string, body: z.infer<typeof orders.ReturnItemBody>, authorizedBy?: string) {
    const item = await this.getItem(who, itemId);
    if (item.state !== "entregado") throw conflict("not_delivered", "Solo se devuelve lo entregado");
    if (body.resolution === "retirar_de_cuenta" && !authorizedBy) return { status: "requires_approval" as const };
    await this.db.update(schema.orderItems).set({ state: "devuelto" }).where(eq(schema.orderItems.id, itemId));
    await recordEvent(this.db, who, { type: "item.returned", entity: "order_item", entityId: itemId, data: body, authorizedBy });
    if (body.resolution === "rehacer") {
      const { id: _id, createdAt: _c, readyAt: _r, deliveredAt: _d, readyBy: _rb, ...rest } = item;
      const [redo] = await this.db
        .insert(schema.orderItems)
        // "Rehacer" conserva el cobro: el precio pasa al platillo rehecho y el original queda en cero (devuelto).
        .values({ ...rest, state: "enviado", priority: "rehacer", sentAt: new Date(), createdBy: who.userId })
        .returning();
      this.broadcastSent([redo!]);
      return { status: "remade" as const, item: toItemDto(redo!) };
    }
    return { status: "removed" as const };
  }

  async requestBill(who: Principal, checkId: string) {
    const check = await this.getCheck(who, checkId);
    await this.db.update(schema.checks).set({ status: "pidio_cuenta" }).where(eq(schema.checks.id, checkId));
    if (check.tableId) this.app.hub.publish(["floor"], { type: "table.status", tableId: check.tableId, status: "pidio_cuenta" });
    return { ok: true };
  }

  async moveItems(who: Principal, body: z.infer<typeof orders.MoveItemsBody>) {
    await this.getCheck(who, body.toCheckId);
    await this.db.update(schema.orderItems).set({ checkId: body.toCheckId }).where(and(inArray(schema.orderItems.id, body.itemIds), eq(schema.orderItems.branchId, who.branchId)));
    await recordEvent(this.db, who, { type: "items.moved", entity: "check", entityId: body.toCheckId, data: body });
    return { ok: true };
  }

  private async getItem(who: Principal, itemId: string) {
    const [item] = await this.db.select().from(schema.orderItems).where(and(eq(schema.orderItems.id, itemId), eq(schema.orderItems.branchId, who.branchId)));
    if (!item) throw notFound("Producto de comanda");
    return item;
  }

  private broadcastSent(items: ItemRow[]) {
    for (const i of items) this.app.hub.publish([`station:${i.stationId}`], { type: "item.sent", item: toItemDto(i) });
    void this.printer.onItemsSent(items).catch((err) => this.app.log.error(err));
  }

  private async notifyItem(item: ItemRow) {
    const dto = toItemDto(item);
    this.app.hub.publish([`station:${item.stationId}`], { type: "item.updated", item: dto });
    if (item.state === "listo") {
      const [check] = await this.db.select().from(schema.checks).where(eq(schema.checks.id, item.checkId));
      const [table] = check?.tableId ? await this.db.select().from(schema.tables).where(eq(schema.tables.id, check.tableId)) : [];
      this.app.hub.publish([`waiter:${check!.waiterId}`, "floor"], { type: "item.ready", item: dto, tableLabel: table?.label ?? check?.name ?? null, waiterId: check!.waiterId });
    }
  }
}

export { AppError };
