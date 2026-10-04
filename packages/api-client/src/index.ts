import type { approvals, auth, catalog, floor, inventory, orders, RealtimeEvent } from "@convivium/contracts";
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

export type ApprovalView = Omit<Approval, "createdAt"> & {
  createdAt: string;
  resolvedAt: string | null;
  tableLabel: string | null;
  guests: number | null;
  checkTotal: number;
  productName: string | null;
  itemAmount: number | null;
  reason: string | null;
  requestedByName: string | null;
  resolvedByName: string | null;
};

export type Ingredient = Infer<typeof inventory.IngredientView>;
export type IngredientInput = Infer<typeof inventory.IngredientUpsert>;
export type RecipeInput = z.input<typeof inventory.RecipeUpsert>;
export interface Warehouse { id: string; name: string }
export interface RecipeSummary { id: string; name: string; isSubRecipe: boolean; productId: string | null; modifierId: string | null; cost: number }
export interface RecipeDetail {
  id: string; name: string; isSubRecipe: boolean; yieldQty: number | null; steps: string[]; productId: string | null; cost: number;
  lines: { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number; name: string; unit: string; unitCost: number; cost: number }[];
  product: { id: string; name: string; price: number; netPrice: number; costPct: number } | null;
  modifierRecipes: { id: string; name: string; cost: number }[];
}
export interface InventoryCount {
  id: string; warehouseId: string; status: string; countedBy: string; createdAt: string; totalDiffValue: number;
  lines: { ingredientId: string; name: string; unit: string; theoretical: number; counted: number; diff: number; diffValue: number }[];
}

export interface LiveDashboard {
  salesToday: number;
  salesLastWeek: number;
  tickets: number;
  avgTicket: number;
  guests: number;
  openChecks: number;
  occupancy: { total: number; occupied: number; pidioCuenta: number; free: number };
  hourly: { hour: number; total: number }[];
  topProducts: { name: string; qty: number; amount: number }[];
  paymentMethods: { method: string; amount: number }[];
  prepTimes: { station: string; avgSec: number | null; targetSec: number; samples: number }[];
  alerts: { kind: "cxp" | "insumo" | "fraude"; title: string; detail: string }[];
}

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
  const listeners = new Set<(s: Session | null) => void>();

  async function request<T>(method: string, path: string, body?: unknown, token = session?.accessToken ?? store.get(KEYS.device)): Promise<T> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    // Sesión vencida: se descarta para que la app regrese a la pantalla de acceso.
    if (res.status === 401 && session && token === session.accessToken) setSession(null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "error", data?.message ?? res.statusText);
    return data as T;
  }

  const setSession = (s: Session | null) => {
    session = s;
    store.set(KEYS.session, s ? JSON.stringify(s) : null);
    for (const l of listeners) l(s);
  };

  return {
    get session() { return session; },
    get deviceToken() { return store.get(KEYS.device); },
    can: (perm: string) => !!session?.permissions.includes(perm),
    logout: () => setSession(null),
    /** Avisa cuando la sesión cambia (login, logout o vencimiento). Devuelve la función para desuscribirse. */
    onSessionChange: (l: (s: Session | null) => void) => { listeners.add(l); return () => void listeners.delete(l); },

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
      favorites: () => request<{ productIds: string[] }>("GET", "/catalog/favorites"),
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
      list: (status: "pendiente" | "aprobada" | "rechazada" = "pendiente") => request<ApprovalView[]>("GET", `/approvals?status=${status}`),
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
    inventory: {
      warehouses: () => request<Warehouse[]>("GET", "/inventory/warehouses"),
      ingredients: (warehouseId?: string) => request<Ingredient[]>("GET", `/inventory/ingredients${warehouseId ? `?warehouseId=${warehouseId}` : ""}`),
      saveIngredient: (body: IngredientInput, id?: string) => request(id ? "PUT" : "POST", id ? `/inventory/ingredients/${id}` : "/inventory/ingredients", body),
      recipes: () => request<RecipeSummary[]>("GET", "/inventory/recipes"),
      recipe: (id: string) => request<RecipeDetail>("GET", `/inventory/recipes/${id}`),
      saveRecipe: (body: RecipeInput, id?: string) => request<RecipeDetail>(id ? "PUT" : "POST", id ? `/inventory/recipes/${id}` : "/inventory/recipes", body),
      deleteRecipe: (id: string) => request<{ ok: true }>("DELETE", `/inventory/recipes/${id}`),
      produce: (recipeId: string, batches: number, warehouseId: string) => request<{ produced: number; unit: string }>("POST", "/inventory/production", { recipeId, batches, warehouseId }),
      submitCount: (warehouseId: string, lines: { ingredientId: string; counted: number }[]) => request<InventoryCount>("POST", "/inventory/counts", { warehouseId, lines }),
      counts: (status?: string) => request<InventoryCount[]>("GET", `/inventory/counts${status ? `?status=${status}` : ""}`),
      resolveCount: (id: string, approve: boolean) => request<InventoryCount>("POST", `/inventory/counts/${id}/${approve ? "approve" : "reject"}`),
      suggestions: () => request<{ ingredientId: string; name: string; stock: number; minStock: number; useUnit: string; purchaseUnit: string; suggestedQty: number; supplierId: string | null; supplierName: string | null; unitPrice: number | null }[]>("GET", "/inventory/purchase-suggestions"),
    },
    /** Llamada genérica para endpoints sin método dedicado. */
    request: <T = unknown>(method: string, path: string, body?: unknown) => request<T>(method, path, body),
    reports: {
      live: () => request<LiveDashboard>("GET", "/reports/live"),
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
