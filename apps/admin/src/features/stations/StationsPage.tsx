/* Diseño: design/stitch/admin-estaciones.html (Stitch). Marcado y clases originales; datos reales. E2-03, E4-09, E1-04. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";

interface Station { id: string; name: string; kind: "cocina" | "barra"; output: "pantalla" | "impresora" | "ambos"; printerFallback: boolean; printerAddress: string | null; defaultTargetSec: number; screensOnline: number; categories: string[]; productCount: number }
interface Device { id: string; name: string; kind: string; revoked: boolean; lastSeenAt: string | null }
const KIND_ICON: Record<string, string> = { mesero: "smartphone", kds_tv: "tv", estacion_tactil: "tablet_mac", caja: "point_of_sale", admin: "computer", nodo: "dns" };
const KIND_LABEL: Record<string, string> = { mesero: "Celular de mesero", kds_tv: "TV KDS", estacion_tactil: "Táctil de despacho", caja: "Caja", admin: "Administración", nodo: "Nodo local" };
const ago = (iso: string | null) => { if (!iso) return "Sin uso"; const m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "Hace un momento" : m < 60 ? `Hace ${m} min` : m < 1440 ? `Hace ${Math.floor(m / 60)} h` : `Hace ${Math.floor(m / 1440)} d`; };

export function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([client.request<Station[]>("GET", "/catalog/stations/overview"), client.request<Device[]>("GET", "/auth/devices")]);
    setStations(s); setDevices(d);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const save = (st: Station, patch: Partial<Station>) => {
    const n = { ...st, ...patch };
    setStations((xs) => xs.map((x) => (x.id === st.id ? n : x)));
    return client.request("PUT", `/catalog/stations/${st.id}`, { name: n.name, kind: n.kind, output: n.output, printerFallback: n.printerFallback, printerAddress: n.printerAddress || null, defaultTargetSec: n.defaultTargetSec });
  };
  const create = async (name: string, kind: "cocina" | "barra") => { await client.request("POST", "/catalog/stations", { name, kind }); setAdding(false); load(); };

  return (
    <main className="flex-1 flex overflow-hidden bg-[#F7F5F0] min-h-screen">
      <section className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E2F28]" />
            <h2 className="font-serif text-lg font-bold text-[#1E2F28] tracking-tight">Estaciones de Línea Activas</h2>
            <span className="ml-2 text-xs font-medium text-stone-500 bg-white px-2 py-0.5 rounded-full border border-[#DCD5C9]">{stations.length} áreas operativas</span>
          </div>
          <button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-lg bg-[#1E2F28] text-amber-200 text-xs font-semibold flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">add</span>Nueva estación</button>
        </div>
        {adding && <NewStation onCancel={() => setAdding(false)} onCreate={create} />}

        <div className="space-y-5 pb-12">
          {stations.map((st) => {
            const bar = st.kind === "barra";
            return (
              <article key={st.id} className="bg-white border border-[#DCD5C9] rounded-xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#FAF8F5]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#DCD5C9] flex items-center justify-center text-[#1E2F28]">
                      <span className={`material-symbols-outlined text-2xl ${bar ? "text-[#B8860B]" : "text-[#C85A32]"}`}>{bar ? "local_bar" : "local_fire_department"}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-serif text-lg font-bold text-stone-900 tracking-tight">Estación {st.name}</h3>
                        <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">{bar ? "Barra" : "Cocina"}</span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{st.productCount} productos ruteados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FAF8F5] p-1.5 rounded-lg border border-[#DCD5C9] self-start md:self-auto">
                    <span className="text-[11px] font-medium text-stone-600 px-2">SLA Objetivo:</span>
                    <div className="flex items-center bg-white rounded border border-[#DCD5C9]">
                      <button onClick={() => save(st, { defaultTargetSec: Math.max(60, st.defaultTargetSec - 60) })} className="px-2 py-0.5 text-stone-500 hover:text-stone-800 text-xs font-bold hover:bg-stone-100 rounded-l">−</button>
                      <span className="font-mono text-xs font-bold text-stone-900 px-2.5">{Math.round(st.defaultTargetSec / 60)} min</span>
                      <button onClick={() => save(st, { defaultTargetSec: st.defaultTargetSec + 60 })} className="px-2 py-0.5 text-stone-500 hover:text-stone-800 text-xs font-bold hover:bg-stone-100 rounded-r">+</button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD5]">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-stone-700">tv</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-stone-900">Pantallas KDS / táctil</span>
                          {st.screensOnline > 0 && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
                        </div>
                        <span className="font-mono text-[10px] text-stone-500">{st.screensOnline} conectada(s) en tiempo real</span>
                      </div>
                    </div>
                    {st.screensOnline > 0 ? (
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">En línea</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#B45A3C] bg-[#F8ECE8] border border-[#B45A3C]/30 px-2 py-0.5 rounded">Sin pantalla</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD5]">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="material-symbols-outlined text-stone-700">print</span>
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-stone-900">Impresora térmica 80 mm</span>
                        <input defaultValue={st.printerAddress ?? ""} onBlur={(e) => e.target.value !== (st.printerAddress ?? "") && save(st, { printerAddress: e.target.value || null })} placeholder="IP:puerto (ej. 192.168.1.50:9100)" className="block w-full mt-0.5 font-mono text-[10px] text-stone-600 bg-transparent border-0 border-b border-dashed border-stone-300 p-0 focus:ring-0 focus:border-[#1E2F28]" />
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${st.printerAddress ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-stone-600 bg-stone-100 border-stone-200"}`}>{st.printerAddress ? "Configurada" : "Sin impresora"}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#FAF8F5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-stone-600">Modo de salida:</span>
                    <div className="inline-flex rounded-lg bg-stone-100 p-1 border border-[#DCD5C9]/80 text-xs">
                      {([["pantalla", "Solo pantalla"], ["impresora", "Solo impresora"], ["ambos", "Ambos"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => save(st, { output: k })} className={st.output === k ? "px-3 py-1 rounded-md bg-[#1E2F28] text-amber-200 font-semibold shadow-xs" : "px-3 py-1 rounded-md text-stone-600 hover:text-stone-900 transition-colors"}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div className="relative">
                      <input checked={st.printerFallback} onChange={(e) => save(st, { printerFallback: e.target.checked })} className="sr-only peer" type="checkbox" />
                      <div className="w-9 h-5 bg-stone-300 rounded-full peer peer-checked:bg-[#1E2F28] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </div>
                    <span className="text-xs text-stone-700">Imprimir como respaldo si la pantalla se desconecta</span>
                  </label>
                </div>
                {st.categories.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-dashed border-[#E5DFD5]">
                    <span className="text-[11px] font-medium text-stone-500">Categorías ruteadas:</span>
                    <div className="flex flex-wrap gap-1.5">{st.categories.map((c) => <span key={c} className="text-[11px] bg-[#FAF8F5] text-stone-700 px-2 py-0.5 rounded border border-[#DCD5C9]">{c}</span>)}</div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <aside className="w-80 shrink-0 border-l border-[#DCD5C9] bg-white overflow-y-auto p-5 space-y-4 hidden lg:block">
        <div>
          <h3 className="font-serif text-base font-bold text-[#1E2F28]">Dispositivos del restaurante</h3>
          <p className="text-[11px] text-stone-500">Solo equipos vinculados pueden operar.</p>
        </div>
        <div className="p-4 rounded-xl bg-[#1E2F28] text-white">
          <span className="text-[10px] uppercase tracking-widest text-[#D4AF7C] font-semibold">Vincular dispositivo</span>
          {code ? (
            <>
              <p className="font-mono text-3xl font-bold tracking-[0.3em] mt-2 text-amber-100">{code.code.slice(0, 3)} {code.code.slice(3)}</p>
              <p className="text-[11px] text-stone-300 mt-1">Ingrésalo en el dispositivo. Válido hasta {new Date(code.expiresAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}.</p>
            </>
          ) : <p className="text-[11px] text-stone-300 mt-1">Genera un código de 6 dígitos y escríbelo en el celular, TV o táctil.</p>}
          <button onClick={() => client.request<{ code: string; expiresAt: string }>("POST", "/auth/devices/pairing-code").then(setCode)} className="mt-3 w-full py-2 rounded-lg bg-[#D4AF7C] text-[#1E2F28] text-xs font-bold">{code ? "Generar otro código" : "Generar código"}</button>
        </div>
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${d.revoked ? "bg-stone-50 border-stone-200 opacity-60" : "bg-[#FAF8F5] border-[#E5DFD5]"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-stone-700">{KIND_ICON[d.kind] ?? "devices"}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-900 truncate">{d.name}</div>
                  <div className="text-[10px] text-stone-500">{KIND_LABEL[d.kind] ?? d.kind} · {d.revoked ? "Revocado" : ago(d.lastSeenAt)}</div>
                </div>
              </div>
              {!d.revoked && (
                <button onClick={() => confirm(`¿Revocar "${d.name}"? Dejará de poder iniciar sesión.`) && client.request("POST", `/auth/devices/${d.id}/revoke`).then(load)} className="text-[10px] font-semibold text-[#B45A3C] border border-[#B45A3C]/30 px-2 py-1 rounded hover:bg-[#F8ECE8]">Revocar</button>
              )}
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

function NewStation({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string, kind: "cocina" | "barra") => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"cocina" | "barra">("cocina");
  return (
    <div className="bg-white border-2 border-[#D4AF7C] rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs">
      <label className="flex-1 min-w-[180px]"><span className="block text-[11px] font-semibold text-stone-600 mb-1">Nombre</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Parrilla" className="w-full rounded-lg border-[#DCD5C9] text-xs" /></label>
      <div className="inline-flex rounded-lg bg-stone-100 p-1 border border-[#DCD5C9]">
        {(["cocina", "barra"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={kind === k ? "px-3 py-1 rounded-md bg-[#1E2F28] text-amber-200 font-semibold" : "px-3 py-1 rounded-md text-stone-600"}>{k === "cocina" ? "Cocina" : "Barra"}</button>)}
      </div>
      <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[#DCD5C9]">Cancelar</button>
      <button disabled={!name.trim()} onClick={() => onCreate(name.trim(), kind)} className="px-3 py-2 rounded-lg bg-[#1E2F28] text-amber-200 font-semibold disabled:opacity-50">Crear</button>
    </div>
  );
}
