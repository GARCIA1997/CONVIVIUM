import websocket from "@fastify/websocket";
import type { Channel, RealtimeEvent } from "@convivium/contracts";
import fp from "fastify-plugin";
import type { WebSocket } from "ws";

/**
 * Hub de tiempo real de la sucursal. Los dispositivos se conectan a /v1/realtime?token=…&channels=a,b
 * y reciben eventos de sus canales (estación, mesero, piso, aprobaciones, menú).
 */
class Hub {
  private subs = new Map<string, Set<WebSocket>>();
  subscribe(channel: string, ws: WebSocket) {
    if (!this.subs.has(channel)) this.subs.set(channel, new Set());
    this.subs.get(channel)!.add(ws);
    ws.on("close", () => this.subs.get(channel)?.delete(ws));
  }
  publish(channels: Channel[], event: RealtimeEvent) {
    const msg = JSON.stringify(event);
    const sent = new Set<WebSocket>();
    for (const ch of channels)
      for (const ws of this.subs.get(ch) ?? [])
        if (!sent.has(ws) && ws.readyState === ws.OPEN) {
          ws.send(msg);
          sent.add(ws);
        }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    hub: Hub;
  }
}

export default fp(async (app) => {
  await app.register(websocket);
  const hub = new Hub();
  app.decorate("hub", hub);

  app.get("/v1/realtime", { websocket: true, schema: { hide: true } }, (socket, req) => {
    const { token, channels } = req.query as { token?: string; channels?: string };
    try {
      app.jwt.verify(token ?? "");
    } catch {
      socket.close(4401, "unauthorized");
      return;
    }
    for (const ch of (channels ?? "").split(",").filter(Boolean)) hub.subscribe(ch, socket);
    socket.send(JSON.stringify({ type: "hello" }));
  });
});
