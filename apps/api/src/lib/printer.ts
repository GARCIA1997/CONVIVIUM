import { eq, inArray, schema } from "@convivium/db";
import type { FastifyInstance } from "fastify";
import { Socket } from "node:net";
import { Ticket } from "./escpos.js";

type ItemRow = typeof schema.orderItems.$inferSelect;

/** Envía bytes a una impresora de red (puerto 9100 por defecto). */
function sendRaw(address: string, data: Buffer, timeoutMs = 4000): Promise<void> {
  const [host, port = "9100"] = address.split(":");
  return new Promise((resolve, reject) => {
    const sock = new Socket();
    sock.setTimeout(timeoutMs);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("timeout")); });
    sock.once("error", reject);
    sock.connect(Number(port), host!, () => sock.end(data, () => resolve()));
  });
}

/**
 * Cola de impresión por estación (E4-09, doc 02 §8):
 *  - salida "impresora" o "ambos" → siempre imprime
 *  - salida "pantalla" + respaldo → imprime solo si no hay pantalla conectada a esa estación
 * Reintenta con espera creciente; no bloquea la toma de comandas.
 */
export class PrintQueue {
  constructor(private app: FastifyInstance) {}

  async onItemsSent(items: ItemRow[]) {
    if (!items.length) return;
    const stationIds = [...new Set(items.map((i) => i.stationId))];
    const stations = await this.app.db.select().from(schema.stations).where(inArray(schema.stations.id, stationIds));
    for (const st of stations) {
      const screenOnline = this.app.hub.count(`station:${st.id}`) > 0;
      const shouldPrint = st.output !== "pantalla" || (st.printerFallback && !screenOnline);
      if (!shouldPrint || !st.printerAddress) continue;
      const mine = items.filter((i) => i.stationId === st.id);
      const ticket = await this.comanda(st.name, mine, !screenOnline && st.output === "pantalla");
      void this.send(st.printerAddress, ticket, st.name);
    }
  }

  private async comanda(station: string, items: ItemRow[], fallback: boolean) {
    const [check] = await this.app.db.select().from(schema.checks).where(eq(schema.checks.id, items[0]!.checkId));
    const [table] = check?.tableId ? await this.app.db.select().from(schema.tables).where(eq(schema.tables.id, check.tableId)) : [];
    const [waiter] = check ? await this.app.db.select().from(schema.users).where(eq(schema.users.id, check.waiterId)) : [];
    const t = new Ticket().align("center").bold(true).size(true).line(station.toUpperCase()).size(false);
    if (fallback) t.line("** RESPALDO: PANTALLA DESCONECTADA **");
    t.bold(false).line(`${table?.label ?? check?.name ?? ""} · ${waiter?.name ?? ""} · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`).align("left").rule();
    for (const i of items) {
      if (i.priority === "rehacer") t.bold(true).line(">> REHACER <<");
      t.bold(true).size(true).line(`${i.quantity}x ${i.productName}`).size(false).bold(false);
      for (const m of i.modifiers) t.line(`   * ${m.name}`);
      if (i.note) t.line(`   > ${i.note}`);
    }
    return t.rule().cut().buffer();
  }

  private async send(address: string, data: Buffer, label: string, attempt = 1): Promise<void> {
    try {
      await sendRaw(address, data);
      this.app.log.info(`impreso en ${label} (${address})`);
    } catch (err) {
      if (attempt >= 5) return void this.app.log.error(`impresora ${label} sin respuesta: ${(err as Error).message}`);
      setTimeout(() => void this.send(address, data, label, attempt + 1), 1000 * 2 ** attempt);
    }
  }
}
