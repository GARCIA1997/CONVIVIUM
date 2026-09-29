import type { App } from "../src/server.js";

let app: App;

/** Levanta la API completa en memoria (sin puerto) contra la base de pruebas. */
export async function startApp() {
  const { buildServer } = await import("../src/server.js");
  app = await buildServer();
  await app.ready();
  return app;
}
export const stopApp = () => app?.close();
export const getApp = () => app;

export async function api<T = any>(method: string, url: string, token?: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await app.inject({
    method: method as "GET",
    url: `/v1${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? res.json() : (null as T) };
}

/** Datos de prueba del seed (packages/db/src/seed.ts). */
export const PIN = { dueno: "1111", gerente: "2222", capitan: "3333", mesero: "4444", cajero: "5555", cocina: "6666", barra: "7777", almacenista: "8888" } as const;
const NAME: Record<keyof typeof PIN, string> = { dueno: "Alejandra", gerente: "Luis", capitan: "Marco", mesero: "Ana", cajero: "Sofía", cocina: "Pedro", barra: "Roberto", almacenista: "Carmen" };

export async function ownerToken() {
  const r = await api("POST", "/auth/login", undefined, { email: "dueno@demo.mx", password: "demo12345" });
  return r.body.accessToken as string;
}

let device: { token: string; id: string } | null = null;
/** Vincula (una vez) un dispositivo con el código del seed y devuelve su token. */
export async function deviceToken() {
  if (!device) {
    const r = await api("POST", "/auth/devices/pair", undefined, { code: "482913", name: "Pruebas", kind: "caja" });
    device = { token: r.body.deviceToken, id: r.body.deviceId };
  }
  return device;
}

/** Sesión por PIN de un rol del seed, desde el dispositivo de pruebas. */
export async function pinToken(role: keyof typeof PIN) {
  const d = await deviceToken();
  const users = await api<{ id: string; name: string }[]>("GET", "/auth/devices/users", d.token);
  const user = users.body.find((u) => u.name === NAME[role])!;
  const r = await api("POST", "/auth/pin", d.token, { userId: user.id, pin: PIN[role] });
  if (r.status !== 200) throw new Error(`PIN ${role}: ${JSON.stringify(r.body)}`);
  return r.body.accessToken as string;
}
