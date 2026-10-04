import { approvals } from "@convivium/contracts";
import { and, desc, eq, inArray, schema } from "@convivium/db";
import { can, discountNeedsApproval, pct, type Role } from "@convivium/domain";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError, conflict, forbidden, notFound } from "../../plugins/errors.js";
import { OrdersService } from "../orders/service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const orders = new OrdersService(app);
  const tags = ["aprobaciones"];

  /** Crea una solicitud (E3-08) y la notifica a quien puede aprobar (E5-01). */
  app.post("/", {
    onRequest: [app.guard()],
    schema: {
      tags,
      body: z.object({
        kind: approvals.ApprovalKind,
        checkId: z.string().uuid(),
        itemId: z.string().uuid().optional(),
        amount: z.number().int().default(0),
        pct: z.number().optional(),
        reasonId: z.string().uuid().optional(),
        note: z.string().optional(),
        payload: z.record(z.unknown()).optional(),
      }),
    },
  }, async (req, reply) => {
    const [a] = await db
      .insert(schema.approvals)
      .values({ ...req.body, pct: req.body.pct ?? null, tenantId: req.user.tenantId, branchId: req.user.branchId, requestedBy: req.user.userId })
      .returning();
    await recordEvent(db, req.user, { type: "approval.requested", entity: "approval", entityId: a!.id, data: req.body });
    app.hub.publish(["approvals"], { type: "approval.created", approvalId: a!.id });
    // TODO(push): Web Push al gerente/dueño fuera del local (vía nube).
    return reply.status(201).send(a);
  });

  /** Solicitudes con contexto para decidir: mesa, producto, motivo, solicitante y total de la cuenta. */
  app.get("/", { onRequest: [app.guard("aprobacion.resolver")], schema: { tags, querystring: z.object({ status: z.enum(["pendiente", "aprobada", "rechazada"]).default("pendiente") }) } }, async (req) => {
    const rows = await db.select().from(schema.approvals).where(and(eq(schema.approvals.branchId, req.user.branchId), eq(schema.approvals.status, req.query.status))).orderBy(desc(schema.approvals.createdAt)).limit(50);
    const out = [];
    for (const a of rows) {
      const check = await orders.getCheck(req.user, a.checkId).catch(() => null);
      const item = a.itemId ? check?.items.find((i) => i.id === a.itemId) : undefined;
      const [reason] = a.reasonId ? await db.select({ label: schema.reasons.label }).from(schema.reasons).where(eq(schema.reasons.id, a.reasonId)) : [];
      const people = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, [a.requestedBy, a.resolvedBy].filter((x): x is string => !!x)));
      out.push({
        ...a,
        createdAt: a.createdAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        tableLabel: check?.tableLabel ?? check?.name ?? null,
        guests: check?.guests ?? null,
        checkTotal: check?.total ?? 0,
        productName: item?.productName ?? null,
        itemAmount: item ? item.unitPrice * item.quantity - item.promoDiscount : null,
        reason: reason?.label ?? a.note ?? null,
        requestedByName: people.find((p) => p.id === a.requestedBy)?.name ?? null,
        resolvedByName: people.find((p) => p.id === a.resolvedBy)?.name ?? null,
      });
    }
    return out;
  });

  /** E5-01 (remoto) y E5-02 (PIN del gerente en el dispositivo del mesero). */
  app.post("/:id/resolve", { onRequest: [app.guard()], schema: { tags, params: IdParam, body: approvals.ResolveApprovalBody } }, async (req) => {
    let approver = { userId: req.user.userId, roles: req.user.roles };
    if (req.body.approverId && req.body.approverPin) {
      const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, req.body.approverId), eq(schema.users.tenantId, req.user.tenantId), eq(schema.users.active, true)));
      if (!u?.pinHash || !(await bcrypt.compare(req.body.approverPin, u.pinHash))) throw new AppError(401, "bad_pin", "PIN incorrecto");
      const roles = (await db.select().from(schema.userRoles).where(and(eq(schema.userRoles.userId, u.id), eq(schema.userRoles.branchId, req.user.branchId)))).map((r) => r.role as Role);
      approver = { userId: u.id, roles };
    }
    const pol = await app.policy.get(req.user.tenantId);
    if (!can(approver.roles, "aprobacion.resolver", pol.overrides)) throw forbidden("No puede aprobar");

    const [a] = await db.select().from(schema.approvals).where(and(eq(schema.approvals.id, req.params.id), eq(schema.approvals.branchId, req.user.branchId)));
    if (!a) throw notFound("Solicitud");
    if (a.status !== "pendiente") throw conflict("already_resolved", "Ya fue resuelta");
    if (a.kind === "descuento" && a.pct !== null && discountNeedsApproval(approver.roles, a.pct, pol.caps)) throw forbidden("Excede su tope de descuento");

    const status = req.body.decision === "aprobar" ? "aprobada" : "rechazada";
    await db.update(schema.approvals).set({ status, resolvedBy: approver.userId, resolvedAt: new Date() }).where(eq(schema.approvals.id, a.id));

    if (status === "aprobada") {
      const who = { ...req.user };
      if (a.kind === "cancelacion" && a.itemId) await orders.cancel(who, a.itemId, { reasonId: a.reasonId! }, approver.userId);
      if (a.kind === "devolucion_retiro" && a.itemId) await orders.returnItem(who, a.itemId, { reasonId: a.reasonId!, resolution: "retirar_de_cuenta" }, approver.userId);
      if (a.kind === "descuento" || a.kind === "cortesia") {
        const check = await orders.getCheck(who, a.checkId);
        const amount = a.amount || (a.pct ? pct(check.subtotal, a.pct) : 0);
        await db.insert(schema.discounts).values({ tenantId: a.tenantId, checkId: a.checkId, itemId: a.itemId, type: a.kind, amount, reasonId: a.reasonId, appliedBy: a.requestedBy, authorizedBy: approver.userId });
      }
    }
    await recordEvent(db, req.user, { type: `approval.${status}`, entity: "approval", entityId: a.id, data: { decision: req.body.decision }, authorizedBy: approver.userId });
    app.hub.publish(["approvals"], { type: "approval.resolved", approvalId: a.id, status });
    return { status };
  });
};

export const approvalsModule: ApiModule = { prefix: "approvals", plugin };
