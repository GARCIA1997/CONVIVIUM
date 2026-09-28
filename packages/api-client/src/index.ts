import type { approvals, auth, catalog, floor, orders, RealtimeEvent } from "@convivium/contracts";
import type { z } from "zod";

type Infer<T extends z.ZodTypeAny> = z.infer<T>;
export type Session = Infer<typeof auth.Session>;
export type Menu = Infer<typeof catalog.Menu>;
export type Product = Infer<typeof catalog.Product>;
export type FloorPlan = Infer<typeof floor.FloorPlan>;
export type Check = Infer<typeof orders.Check>;
export type OrderItem = Infer<typeof orders.OrderItem>;
export type CheckSummary = Infer<typeof orders.CheckSummary>;
export type Approval = Infer<typeof approvals.Approval>;
export type { RealtimeEvent };

export interface CashSummary {
  sessionId: string;
  cashierName: string;
  openedAt: string;
  openingFloat: number;
  movements: { at: string; type: "entrada" | "retiro" | "proveedor"; amount: number; reason: string }[];
  sales: number;
  discounts: number;
  courtesies: number;
  tipsByWaiter: { name: string; amount: number }[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const KEYS = { device: "cv.deviceToken", session: "cv.session" } as const;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin storage */ } },
};

/**
 * Cliente de la API de CONVIVIUM. Mismo cliente para todas las apps; el base URL es
 * relativo (/v1) porque cada PWA la sirve el nodo local o la nube.
 */
export function createClient(baseUrl = "/v1") {
  let session: Session | null = JSON.parse(store.get(KEYS.session) ?? "null");

  async function request<T>(method: string, path: string, body?: unknown, token = session?.accessToken ?? store.get(KEYS.device)): Promise<T> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "error", data?.message ?? res.statusText);
    return data as T;
  }

  const setSession = (s: Session | null) => {
    session = s;
    store.set(KEYS.session, s ? JSON.stringify(s) : null);
  };

  return {
    get session() { return session; },
    get deviceToken() { return store.get(KEYS.device); },
    can: (perm: string) => !!session?.permissions.includes(perm),
    logout: () => setSession(null),

    auth: {
      pair: async (body: Infer<typeof auth.PairDeviceBody>) => {
        const r = await request<Infer<typeof auth.PairDeviceResponse>>("POST", "/auth/devices/pair", body, null);
        store.set(KEYS.device, r.deviceToken);
        return r;
      },
      deviceUsers: () => request<{ id: string; name: string }[]>("GET", "/auth/devices/users", undefined, store.get(KEYS.device)),
      pin: async (userId: string, pin: string) => {
        const s = await request<Session>("POST", "/auth/pin", { userId, pin }, store.get(KEYS.device));
        setSession(s);
        return s;
      },
      login: async (email: string, password: string) => {
        const s = await request<Session>("POST", "/auth/login", { email, password }, null);
        setSession(s);
        return s;
      },
    },
    catalog: {
      menu: () => request<Menu>("GET", "/catalog/menu"),
      stations: () => request<{ id: string; name: string; kind: "cocina" | "barra" }[]>("GET", "/catalog/stations"),
      reasons: (kind?: string) => request<{ id: string; label: string; kind: string }[]>("GET", `/catalog/reasons${kind ? `?kind=${kind}` : ""}`),
      setSoldOut: (productId: string, soldOut: boolean) => request("PUT", `/catalog/products/${productId}/sold-out`, { soldOut }),
    },
    floor: { get: () => request<FloorPlan>("GET", "/floor") },
    orders: {
      openChecks: () => request<CheckSummary[]>("GET", "/orders/checks"),
      open: (body: Infer<typeof orders.OpenCheckBody>) => request<{ id: string }>("POST", "/orders/checks", body),
      get: (checkId: string) => request<Check>("GET", `/orders/checks/${checkId}`),
      addItems: (checkId: string, items: Infer<typeof orders.AddItemsBody>["items"]) => request<OrderItem[]>("POST", `/orders/checks/${checkId}/items`, { items }),
      fire: (checkId: string, course: string) => request("POST", `/orders/checks/${checkId}/fire`, { course }),
      requestBill: (checkId: string) => request("POST", `/orders/checks/${checkId}/request-bill`, {}),
      transition: (itemId: string, to: OrderItem["state"]) => request<OrderItem>("POST", `/orders/items/${itemId}/transition`, { to }),
      cancel: (itemId: string, reasonId: string) => request<{ status: string }>("POST", `/orders/items/${itemId}/cancel`, { reasonId }),
      returnItem: (itemId: string, body: Infer<typeof orders.ReturnItemBody>) => request<{ status: string }>("POST", `/orders/items/${itemId}/return`, body),
    },
    stations: {
      queue: (stationId: string) => request<(OrderItem & { targetPrepSec: number; tableLabel: string | null; waiterName: string | null; folio: string })[]>("GET", `/stations/${stationId}/queue`),
      history: (stationId: string) => request<OrderItem[]>("GET", `/stations/${stationId}/history`),
      consolidated: (stationId: string) => request<{ product: string; quantity: number }[]>("GET", `/stations/${stationId}/consolidated`),
    },
    approvals: {
      list: () => request<Approval[]>("GET", "/approvals"),
      create: (body: Record<string, unknown>) => request<Approval>("POST", "/approvals", body),
      resolve: (id: string, decision: "aprobar" | "rechazar", approver?: { approverId: string; approverPin: string }) =>
        request<{ status: string }>("POST", `/approvals/${id}/resolve`, { decision, ...approver }),
    },
    cash: {
      current: () => request<{ id: string; openingFloat: number } | null>("GET", "/cash/sessions/current"),
      open: (registerId: string, openingFloat: number) => request("POST", "/cash/sessions", { registerId, openingFloat }),
      split: (checkId: string, body: { mode: "iguales"; parts: number } | { mode: "por_comensal" } | { mode: "por_producto"; groups: string[][] }) =>
        request<{ mode: string; parts: { checkId: string; amount: number }[] }>("POST", `/cash/checks/${checkId}/split`, body),
      summary: () => request<CashSummary>("GET", "/cash/sessions/current/summary"),
      count: (kind: "X" | "Z", counted: Record<string, number>, approverPin?: string) =>
        request<{ kind: string; expected: Record<string, number>; counted: Record<string, number>; differences: Record<string, number>; sales: number; tips: number; closed: boolean }>("POST", "/cash/sessions/current/counts", { kind, counted, approverPin }),
      pay: (checkId: string, body: unknown) => request<{ paid: number; change: number; checkStatus: string }>("POST", `/cash/checks/${checkId}/pay`, body),
    },
    reports: {
      live: () => request<{ salesToday: number; tickets: number; avgTicket: number; openChecks: number; guests: number }>("GET", "/reports/live"),
    },

    /** Suscripción en tiempo real con reconexión automática. Devuelve función para cerrar. */
    subscribe(channels: string[], onEvent: (e: RealtimeEvent) => void): () => void {
      let ws: WebSocket | null = null;
      let closed = false;
      let retry = 500;
      const connect = () => {
        if (!session) return;
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}${baseUrl}/realtime?token=${session.accessToken}&channels=${channels.join(",")}`);
        ws.onopen = () => { retry = 500; };
        ws.onmessage = (m) => { const e = JSON.parse(m.data); if (e.type !== "hello") onEvent(e); };
        ws.onclose = () => { if (!closed) setTimeout(connect, (retry = Math.min(retry * 2, 10_000))); };
      };
      connect();
      return () => { closed = true; ws?.close(); };
    },
  };
}

export type Client = ReturnType<typeof createClient>;
