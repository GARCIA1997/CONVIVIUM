import type { orders } from "@convivium/contracts";
import { and, arrayOverlaps, eq, gte, inArray, ne, or, schema, sql, type Db } from "@convivium/db";
import { applyPromotions as computePromotions, cancelRequirement, canTransition, type ItemState } from "@convivium/domain";
import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import { PrintQueue } from "../../lib/printer.js";
import { InventoryService } from "../inventory/service.js";
import type { Principal } from "../../plugins/auth.js";
import { AppError, conflict, notFound } from "../../plugins/errors.js";
import { lineTotal, toItemDto } from "./mapper.js";

type ItemRow = typeof schema.orderItems.$inferSelect;

/** L-007 */
export const takeoutFolio = (n: number | null) => `L-${String(n ?? 0).padStart(3, "0")}`;

export class OrdersService {
  private printer: PrintQueue;
  constructor(private app: FastifyInstance, private db: Db = app.db) {
    this.printer = new PrintQueue(app);
    this.inventory = new InventoryService(app);
  }
  private inventory: InventoryService;

  async getCheck(who: Principal, checkId: string) {
    const [check] = await this.db.select().from(schema.checks).where(and(eq(schema.checks.id, checkId), eq(schema.checks.branchId, who.branchId)));
    if (!check) throw notFound("Cuenta");
    const items = await this.db.select().from(schema.orderItems).where(eq(schema.orderItems.checkId, checkId));
    const discountRows = await this.db.select().from(schema.discounts).where(eq(schema.discounts.checkId, checkId));
    const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
    const discounts = discountRows.reduce((s, d) => s + d.amount, 0);
    const [table] = check.tableId ? await this.db.select().from(schema.tables).where(eq(schema.tables.id, check.tableId)) : [];
    const joinedTables = check.joinedTableIds.length ? await this.db.select({ id: schema.tables.id, label: schema.tables.label, capacity: schema.tables.capacity }).from(schema.tables).where(inArray(schema.tables.id, check.joinedTableIds)) : [];
    const [waiter] = await this.db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, check.waiterId));
    const promoIds = [...new Set(items.map((i) => i.promotionId).filter((x): x is string => !!x))];
    const promos = promoIds.length ? await this.db.select({ id: schema.promotions.id, name: schema.promotions.name }).from(schema.promotions).where(inArray(schema.promotions.id, promoIds)) : [];
    const promoName = (id: string | null) => promos.find((p) => p.id === id)?.name ?? null;
    return {
      ...check,
      // M5 + M6 + M7 cuando hay mesas unidas.
      tableLabel: table ? [table.label, ...joinedTables.map((t) => t.label)].join(" + ") : check.kind === "llevar" ? `Llevar ${takeoutFolio(check.folio)}` : null,
      joinedTables,
      capacity: table ? table.capacity + joinedTables.reduce((n, t) => n + t.capacity, 0) : null,
      waiterName: waiter?.name ?? null,
      openedAt: check.openedAt.toISOString(),
      pickupAt: check.pickupAt?.toISOString() ?? null,
      handedOverAt: check.handedOverAt?.toISOString() ?? null,
      closedAt: check.closedAt?.toISOString() ?? null,
      items: items.map((i) => ({ ...toItemDto(i), promotionName: promoName(i.promotionId) })),
      promotions: promos.map((p) => ({ name: p.name, amount: items.filter((i) => i.promotionId === p.id && lineTotal(i) >= 0 && i.state !== "cancelado" && i.state !== "devuelto").reduce((n, i) => n + i.promoDiscount, 0) })).filter((p) => p.amount > 0),
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
          folio: c.folio,
          pickupAt: c.pickupAt?.toISOString() ?? null,
          status: c.status,
          tableLabel: tables.find((t) => t.id === c.tableId)?.label ?? null,
          name: c.kind === "llevar" ? `Llevar ${takeoutFolio(c.folio)} · ${c.customerName ?? ""}` : c.name,
          guests: c.guests,
          waiterName: waiters.find((w) => w.id === c.waiterId)?.name ?? null,
          total: Math.max(0, sub - disc),
          itemCount: mine.filter((i) => i.unitPrice > 0 && i.state !== "cancelado" && i.state !== "devuelto").reduce((s, i) => s + i.quantity, 0),
          openedAt: c.openedAt.toISOString(),
        };
      })
      .sort((a, b) => Number(b.status === "pidio_cuenta") - Number(a.status === "pidio_cuenta") || a.openedAt.localeCompare(b.openedAt));
  }

  /** E4-10 · Supervisión del piso para capitán: demoras en pase, carga por mesero y cuentas de barra. */
  async floorOverview(who: Principal, delayMin = 5) {
    const checks = await this.db.select().from(schema.checks).where(and(eq(schema.checks.branchId, who.branchId), inArray(schema.checks.status, ["abierta", "pidio_cuenta"])));
    const ids = checks.map((c) => c.id);
    const [items, tables, waiters, allTables] = await Promise.all([
      ids.length ? this.db.select().from(schema.orderItems).where(inArray(schema.orderItems.checkId, ids)) : [],
      this.db.select().from(schema.tables).where(eq(schema.tables.branchId, who.branchId)),
      checks.length ? this.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, [...new Set(checks.map((c) => c.waiterId))])) : [],
      this.db.select({ id: schema.tables.id }).from(schema.tables).where(and(eq(schema.tables.branchId, who.branchId), eq(schema.tables.active, true))),
    ]);
    const label = (c: (typeof checks)[number]) => tables.find((t) => t.id === c.tableId)?.label ?? (c.name ? `Barra · ${c.name}` : "");
    const now = Date.now();
    const delays = items
      .filter((i) => i.state === "listo" && i.readyAt && now - i.readyAt.getTime() > delayMin * 60e3)
      .map((i) => {
        const c = checks.find((x) => x.id === i.checkId)!;
        return { itemId: i.id, product: i.productName, quantity: i.quantity, where: label(c), waiterId: c.waiterId, waiterName: waiters.find((w) => w.id === c.waiterId)?.name ?? "", minutes: Math.floor((now - i.readyAt!.getTime()) / 60e3), readyAt: i.readyAt!.toISOString() };
      })
      .sort((a, b) => b.minutes - a.minutes);
    const byWaiter = waiters.map((w) => {
      const mine = checks.filter((c) => c.waiterId === w.id);
      const mineItems = items.filter((i) => mine.some((c) => c.id === i.checkId));
      return {
        id: w.id,
        name: w.name,
        tables: mine.filter((c) => c.kind === "mesa").map(label),
        checks: mine.length,
        pendingDelivery: mineItems.filter((i) => i.state === "listo").length,
        inKitchen: mineItems.filter((i) => i.state === "enviado" || i.state === "en_preparacion").length,
        billRequested: mine.filter((c) => c.status === "pidio_cuenta").length,
      };
    }).sort((a, b) => b.checks - a.checks);
    const bar = checks.filter((c) => c.kind === "barra").map((c) => {
      const mine = items.filter((i) => i.checkId === c.id && i.unitPrice > 0 && i.state !== "cancelado" && i.state !== "devuelto");
      return { checkId: c.id, name: c.name ?? "", total: mine.reduce((s, i) => s + lineTotal(i), 0), summary: mine.map((i) => `${i.quantity}x ${i.productName}`).join(", "), minutes: Math.floor((now - c.openedAt.getTime()) / 60e3) };
    });
    const occupied = new Set(checks.map((c) => c.tableId).filter(Boolean)).size;
    return { delayMin, delays, waiters: byWaiter, bar, occupancy: { occupied, total: allTables.length, billRequested: checks.filter((c) => c.status === "pidio_cuenta").length } };
  }

  /** Vuelve a avisar al mesero que un producto sigue listo en el pase. */
  async nudge(who: Principal, itemId: string) {
    const item = await this.getItem(who, itemId);
    if (item.state !== "listo") throw conflict("not_ready", "El producto ya no está en el pase");
    await this.notifyItem(item);
    return { ok: true };
  }

  async openCheck(who: Principal, body: z.infer<typeof orders.OpenCheckBody>) {
    const joined = body.kind === "mesa" ? [...new Set(body.joinTableIds ?? [])].filter((id) => id !== body.tableId) : [];
    if (body.kind === "mesa") await this.assertJoinable(who, body.tableId, joined);
    const [check] = await this.db
      .insert(schema.checks)
      .values({
        tenantId: who.tenantId,
        branchId: who.branchId,
        kind: body.kind,
        tableId: body.kind === "mesa" ? body.tableId : null,
        joinedTableIds: joined,
        guests: body.kind === "mesa" ? body.guests : null,
        name: body.kind === "barra" ? body.name : body.kind === "llevar" ? body.customerName : null,
        ...(body.kind === "llevar"
          ? { folio: await this.nextTakeoutFolio(who.branchId), customerName: body.customerName, customerPhone: body.customerPhone, pickupAt: body.pickupAt ? new Date(body.pickupAt) : null, channel: body.channel, disposables: body.disposables, note: body.note }
          : {}),
        waiterId: who.userId,
      })
      .returning();
    await recordEvent(this.db, who, { type: "check.opened", entity: "check", entityId: check!.id, data: body });
    if (body.kind === "mesa") for (const tableId of [body.tableId, ...joined]) this.app.hub.publish(["floor"], { type: "table.status", tableId, status: "ocupada" });
    if (body.kind === "llevar") this.app.hub.publish(["floor"], { type: "takeout.updated", checkId: check!.id });
    return check!;
  }

  /**
   * E3-10 · Mesas unidas para grupos grandes. Cualquier mesa activa y libre del mismo área que la principal
   * se puede unir (así se juntan en la vida real); las configuradas como unibles en el plano solo se sugieren primero.
   * `ownCheckId`: la cuenta que ya ocupa esas mesas (al unir más), que no cuenta como "otra cuenta".
   */
  private async assertJoinable(who: Principal, mainId: string, joinIds: string[], ownCheckId?: string) {
    if (joinIds.length > 8) throw conflict("too_many", "Máximo 8 mesas unidas en una cuenta");
    const ids = [mainId, ...joinIds];
    const tables = await this.db.select().from(schema.tables).where(and(inArray(schema.tables.id, ids), eq(schema.tables.branchId, who.branchId), eq(schema.tables.active, true)));
    const main = tables.find((t) => t.id === mainId);
    if (!main || tables.length !== new Set(ids).size) throw notFound("Mesa");
    if (tables.some((t) => t.areaId !== main.areaId)) throw conflict("other_area", "Solo se unen mesas de la misma área");
    const busy = await this.db
      .select({ id: schema.checks.id })
      .from(schema.checks)
      .where(and(
        eq(schema.checks.branchId, who.branchId),
        inArray(schema.checks.status, ["abierta", "pidio_cuenta"]),
        or(inArray(schema.checks.tableId, ids), arrayOverlaps(schema.checks.joinedTableIds, ids)),
      ));
    if (busy.some((c) => c.id !== ownCheckId)) throw conflict("table_busy", joinIds.length ? "Alguna de las mesas ya tiene una cuenta abierta" : "La mesa ya tiene una cuenta abierta");
  }

  /** Une más mesas a una cuenta abierta (la familia llegó en dos grupos). */
  async joinTables(who: Principal, checkId: string, tableIds: string[]) {
    const check = await this.getCheck(who, checkId);
    if (check.kind !== "mesa" || !check.tableId) throw conflict("not_table", "Solo las cuentas de mesa se unen");
    if (check.status !== "abierta" && check.status !== "pidio_cuenta") throw conflict("check_closed", "La cuenta ya está cerrada");
    const next = [...new Set([...check.joinedTableIds, ...tableIds])].filter((id) => id !== check.tableId);
    await this.assertJoinable(who, check.tableId, next, checkId);
    await this.db.update(schema.checks).set({ joinedTableIds: next }).where(eq(schema.checks.id, checkId));
    await recordEvent(this.db, who, { type: "check.tables_joined", entity: "check", entityId: checkId, data: { added: tableIds } });
    for (const tableId of tableIds) this.app.hub.publish(["floor"], { type: "table.status", tableId, status: "ocupada" });
    return this.getCheck(who, checkId);
  }

  /** Suelta una mesa unida (el grupo se acomodó en menos mesas). La mesa principal no se suelta. */
  async unjoinTable(who: Principal, checkId: string, tableId: string) {
    const check = await this.getCheck(who, checkId);
    if (!check.joinedTableIds.includes(tableId)) throw conflict("not_joined", "Esa mesa no está unida a la cuenta");
    await this.db.update(schema.checks).set({ joinedTableIds: check.joinedTableIds.filter((id) => id !== tableId) }).where(eq(schema.checks.id, checkId));
    await recordEvent(this.db, who, { type: "check.table_released", entity: "check", entityId: checkId, data: { tableId } });
    this.app.hub.publish(["floor"], { type: "table.status", tableId, status: "libre" });
    return this.getCheck(who, checkId);
  }

  /** E3-02 · Agrega productos; se rutea cada uno a su(s) estación(es) (E2-04). */
  async addItems(who: Principal, checkId: string, body: z.infer<typeof orders.AddItemsBody>) {
    const check = await this.getCheck(who, checkId);
    if (check.status !== "abierta") throw conflict("check_closed", "La cuenta no está abierta");
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const [products, routes, avail] = await Promise.all([
      this.db.select().from(schema.products).where(and(inArray(schema.products.id, productIds), eq(schema.products.tenantId, who.tenantId))),
      this.db.select().from(schema.productStations).where(inArray(schema.productStations.productId, productIds)),
      this.db.select().from(schema.productAvailability).where(and(inArray(schema.productAvailability.productId, productIds), eq(schema.productAvailability.branchId, who.branchId))),
    ]);
    const modIds = body.items.flatMap((i) => i.modifierIds);
    // Solo modificadores de un grupo ligado al producto (y por ende del mismo restaurante).
    const mods = modIds.length
      ? await this.db
          .select({ id: schema.modifiers.id, name: schema.modifiers.name, priceDelta: schema.modifiers.priceDelta, productId: schema.productModifierGroups.productId })
          .from(schema.modifiers)
          .innerJoin(schema.productModifierGroups, eq(schema.productModifierGroups.groupId, schema.modifiers.groupId))
          .where(and(inArray(schema.modifiers.id, modIds), inArray(schema.productModifierGroups.productId, productIds)))
      : [];

    const now = new Date();
    const rows: (typeof schema.orderItems.$inferInsert)[] = [];
    for (const input of body.items) {
      const product = products.find((p) => p.id === input.productId);
      if (!product || !product.active) throw notFound("Producto");
      if (avail.find((a) => a.productId === product.id)?.soldOut) throw conflict("sold_out", `${product.name} está agotado`);
      const stationIds = routes.filter((r) => r.productId === product.id).map((r) => r.stationId);
      if (!stationIds.length) throw conflict("no_station", `${product.name} no tiene estación asignada`);
      const itemMods = mods.filter((m) => m.productId === product.id && input.modifierIds.includes(m.id)).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta }));
      if (itemMods.length !== new Set(input.modifierIds).size) throw new AppError(400, "bad_modifier", `Modificador no válido para ${product.name}`);
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
    await this.applyPromotions(checkId);
    await recordEvent(this.db, who, { type: "items.added", entity: "check", entityId: checkId, data: body });
    this.broadcastSent(inserted.filter((i) => i.state === "enviado"));
    this.stock(who, inserted.filter((i) => i.state === "enviado"), 1);
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
    this.stock(who, updated, 1);
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
    // Enviado sin preparar → regresa al inventario; ya preparado → queda como merma.
    if (item.state === "enviado") this.stock(who, [item], -1);
    await this.applyPromotions(item.checkId);
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
      this.stock(who, [redo!], 1);
      await this.applyPromotions(item.checkId);
      return { status: "remade" as const, item: toItemDto(redo!) };
    }
    await this.applyPromotions(item.checkId);
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
    const from = await this.db.selectDistinct({ checkId: schema.orderItems.checkId }).from(schema.orderItems).where(inArray(schema.orderItems.id, body.itemIds));
    await this.db.update(schema.orderItems).set({ checkId: body.toCheckId }).where(and(inArray(schema.orderItems.id, body.itemIds), eq(schema.orderItems.branchId, who.branchId)));
    await recordEvent(this.db, who, { type: "items.moved", entity: "check", entityId: body.toCheckId, data: body });
    for (const c of new Set([body.toCheckId, ...from.map((f) => f.checkId)])) await this.applyPromotions(c);
    return { ok: true };
  }

  /** Folio consecutivo del día para pedidos para llevar (se reinicia cada día, por sucursal). */
  private async nextTakeoutFolio(branchId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [r] = await this.db.select({ max: sql<number | null>`max(${schema.checks.folio})` }).from(schema.checks)
      .where(and(eq(schema.checks.branchId, branchId), eq(schema.checks.kind, "llevar"), gte(schema.checks.openedAt, start)));
    return (r?.max ?? 0) + 1;
  }

  /** E3-11 · Tablero de pedidos para llevar: activos y entregados hoy. */
  async takeoutBoard(who: Principal) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const checks = await this.db.select().from(schema.checks).where(and(eq(schema.checks.branchId, who.branchId), eq(schema.checks.kind, "llevar"), gte(schema.checks.openedAt, start), ne(schema.checks.status, "cancelada")));
    const ids = checks.map((c) => c.id);
    const items = ids.length ? await this.db.select().from(schema.orderItems).where(inArray(schema.orderItems.checkId, ids)) : [];
    return checks.map((c) => {
      const mine = items.filter((i) => i.checkId === c.id && i.state !== "cancelado" && i.state !== "devuelto");
      const priced = mine.filter((i) => i.unitPrice > 0);
      // Listo cuando todo lo enviado ya salió de cocina/barra.
      const ready = mine.length > 0 && mine.every((i) => ["listo", "entregado"].includes(i.state));
      const stage = c.handedOverAt ? "entregado" : ready ? "listo" : "preparacion";
      return {
        id: c.id, folio: c.folio, label: takeoutFolio(c.folio), customerName: c.customerName, customerPhone: c.customerPhone, channel: c.channel,
        pickupAt: c.pickupAt?.toISOString() ?? null, openedAt: c.openedAt.toISOString(), handedOverAt: c.handedOverAt?.toISOString() ?? null,
        disposables: c.disposables, note: c.note, stage, paid: c.status === "cobrada",
        total: priced.reduce((n, i) => n + lineTotal(i), 0),
        summary: priced.map((i) => `${i.quantity} ${i.productName}`).join(", "),
        itemCount: priced.reduce((n, i) => n + i.quantity, 0),
      };
    }).sort((a, b) => (a.pickupAt ?? a.openedAt).localeCompare(b.pickupAt ?? b.openedAt));
  }

  /** Entrega al cliente: exige que la cuenta esté cobrada. */
  async handOver(who: Principal, checkId: string) {
    const check = await this.getCheck(who, checkId);
    if (check.kind !== "llevar") throw conflict("not_takeout", "No es un pedido para llevar");
    if (check.status !== "cobrada") throw conflict("not_paid", "Cobra el pedido antes de entregarlo");
    await this.db.update(schema.checks).set({ handedOverAt: new Date() }).where(eq(schema.checks.id, checkId));
    // Lo listo en el pase pasa a entregado.
    await this.db.update(schema.orderItems).set({ state: "entregado", deliveredAt: new Date() }).where(and(eq(schema.orderItems.checkId, checkId), eq(schema.orderItems.state, "listo")));
    await recordEvent(this.db, who, { type: "takeout.handed_over", entity: "check", entityId: checkId, data: {} });
    this.app.hub.publish(["floor"], { type: "takeout.updated", checkId });
    return { ok: true };
  }

  /** E4-07 · Recalcula las promociones de la cuenta (se llama tras cualquier cambio de renglones). */
  async applyPromotions(checkId: string) {
    const [check] = await this.db.select().from(schema.checks).where(eq(schema.checks.id, checkId));
    if (!check || check.status === "cobrada" || check.status === "cancelada") return;
    const promos = await this.db.select().from(schema.promotions).where(and(eq(schema.promotions.tenantId, check.tenantId), eq(schema.promotions.status, "activa")));
    const items = await this.db.select().from(schema.orderItems).where(eq(schema.orderItems.checkId, checkId));
    if (!items.length) return;
    const products = await this.db.select({ id: schema.products.id, categoryId: schema.products.categoryId, price: schema.products.price }).from(schema.products).where(inArray(schema.products.id, [...new Set(items.map((i) => i.productId))]));
    const [branch] = await this.db.select({ tz: schema.branches.timezone }).from(schema.branches).where(eq(schema.branches.id, check.branchId));
    const [table] = check.tableId ? await this.db.select({ areaId: schema.tables.areaId }).from(schema.tables).where(eq(schema.tables.id, check.tableId)) : [];
    const result = promos.length
      ? computePromotions(
          items.map((i) => ({
            id: i.id,
            productId: i.productId,
            categoryId: products.find((p) => p.id === i.productId)?.categoryId ?? "",
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            // Solo el renglón con precio (estación principal) participa; lo cancelado/devuelto no.
            chargeable: i.unitPrice > 0 && i.state !== "cancelado" && i.state !== "devuelto",
            orderedAt: i.createdAt,
          })),
          promos.map((p) => ({ ...p, active: true })),
          { zone: table?.areaId ?? "barra", checkOpenedAt: check.openedAt, timezone: branch?.tz ?? "America/Mexico_City" },
        )
      : new Map<string, { discount: number; promotionId: string | null }>();
    for (const i of items) {
      const r = result.get(i.id) ?? { discount: 0, promotionId: null };
      if (r.discount !== i.promoDiscount || r.promotionId !== i.promotionId)
        await this.db.update(schema.orderItems).set({ promoDiscount: r.discount, promotionId: r.promotionId }).where(eq(schema.orderItems.id, i.id));
    }
  }

  private async getItem(who: Principal, itemId: string) {
    const [item] = await this.db.select().from(schema.orderItems).where(and(eq(schema.orderItems.id, itemId), eq(schema.orderItems.branchId, who.branchId)));
    if (!item) throw notFound("Producto de comanda");
    return item;
  }

  /** E7-06 · Descuento de inventario por receta; nunca bloquea la operación de piso. */
  private stock(who: Principal, items: ItemRow[], sign: 1 | -1) {
    void this.inventory.applySale(who, items, sign).catch((err) => this.app.log.error(err, "descuento de inventario"));
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
