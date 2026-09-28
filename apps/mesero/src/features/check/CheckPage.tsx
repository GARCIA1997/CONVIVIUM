/* Diseño: design/stitch/mesero-comanda.html (Stitch). Marcado y clases originales; datos reales. E3-02, E3-03, E3-05, E3-09. */
import type { Check, Menu, OrderItem, Product } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReadyNotifications } from "../notifications/ReadyNotifications";

type Course = "entrada" | "fuerte" | "postre" | "bebida" | "sin_tiempo";
type Draft = { key: number; product: Product; modifierIds: string[]; note?: string; guest: number; course: Course };

const mxn = (c: number) => `${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(c / 100)} MXN`;
const COURSES: [Course, string][] = [["entrada", "Entrada"], ["fuerte", "Fuerte"], ["postre", "Postre"]];
const COURSE_BLOCK: Record<Course, { title: string; icon: string; iconClass: string }> = {
  entrada: { title: "1er Tiempo · Entradas", icon: "skillet", iconClass: "text-[#273C33]" },
  fuerte: { title: "2do Tiempo · Fuertes", icon: "outdoor_grill", iconClass: "text-[#273C33]" },
  postre: { title: "3er Tiempo · Postres", icon: "cake", iconClass: "text-[#273C33]" },
  bebida: { title: "Barra & Coctelería", icon: "local_bar", iconClass: "text-[#D4AF7C]" },
  sin_tiempo: { title: "Sin tiempo", icon: "restaurant", iconClass: "text-[#273C33]" },
};
function courseStatus(items: OrderItem[]) {
  if (items.some((i) => i.state === "pendiente")) return { label: "en espera", cls: "bg-amber-100 text-amber-900" };
  if (items.every((i) => ["listo", "entregado", "cancelado", "devuelto"].includes(i.state))) return { label: "preparado", cls: "bg-emerald-100 text-emerald-800" };
  return { label: "marchando", cls: "bg-emerald-100 text-emerald-800" };
}

export function CheckPage() {
  const { checkId } = useParams<{ checkId: string }>();
  const { client, session } = useSession();
  const nav = useNavigate();
  const [check, setCheck] = useState<Check | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [stations, setStations] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [guest, setGuest] = useState(1);
  const [course, setCourse] = useState<Course>("fuerte");
  const [draft, setDraft] = useState<Draft[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => client.orders.get(checkId!).then(setCheck), [client, checkId]);
  useEffect(() => {
    load();
    client.catalog.menu().then((m) => { setMenu(m); setCategoryId(m.categories[0]?.id ?? null); });
    client.catalog.stations().then(setStations);
  }, [client, load]);
  useRealtime(["menu", "floor"], (e) => {
    if (e.type === "product.sold_out") setMenu((m) => m && { ...m, products: m.products.map((p) => (p.id === e.productId ? { ...p, soldOut: e.soldOut } : p)) });
    else load();
  });

  const category = menu?.categories.find((c) => c.id === categoryId);
  const products = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    return menu.products.filter((p) => p.active && (q ? p.name.toLowerCase().includes(q) : p.categoryId === categoryId));
  }, [menu, query, categoryId]);
  const stationKind = (id: string) => stations.find((s) => s.id === id)?.kind;
  const stationName = (p: Product) => stations.find((s) => s.id === p.stationIds[0])?.name ?? "";
  const isBar = (p: Product) => stationKind(p.stationIds[0]!) === "barra";

  const add = (p: Product, modifierIds: string[] = [], note?: string, g = guest, c: Course = course) => {
    setDraft((d) => [...d, { key: Date.now() + Math.random(), product: p, modifierIds, note, guest: g, course: isBar(p) ? "bebida" : c }]);
    setPicking(null);
  };
  const lineTotal = (d: Draft) => d.product.price + d.product.modifierGroups.flatMap((g) => g.modifiers).filter((m) => d.modifierIds.includes(m.id)).reduce((s, m) => s + m.priceDelta, 0);
  const draftTotal = draft.reduce((s, d) => s + lineTotal(d), 0);
  const toBar = draft.filter((d) => isBar(d.product)).length;

  const send = async () => {
    setError(null);
    try {
      await client.orders.addItems(checkId!, draft.map((d) => ({
        productId: d.product.id, quantity: 1, modifierIds: d.modifierIds, note: d.note, guest: d.guest, course: d.course,
        // Entradas y bebidas salen de inmediato; fuertes y postres esperan a "Marchar" (E3-03).
        fireNow: d.course === "entrada" || d.course === "bebida" || d.course === "sin_tiempo",
      })));
      setDraft([]);
      load();
    } catch (e) { setError((e as Error).message); }
  };

  if (!check || !menu) return <div className="bg-[#EAE6DD] min-h-screen p-6 text-sm text-[#1E2F28]">Cargando…</div>;

  const title = check.kind === "barra" ? `Barra · ${check.name}` : `Mesa · ${check.guests} comensales`;
  const minutes = Math.floor((Date.now() - Date.parse(check.openedAt)) / 60000);
  const guests = Array.from({ length: Math.max(1, check.guests ?? 1) }, (_, i) => i + 1);
  const liveItems = check.items.filter((i) => i.unitPrice > 0 || i.priority === "rehacer");
  const byCourse = (["entrada", "fuerte", "postre", "sin_tiempo", "bebida"] as Course[])
    .map((c) => [c, liveItems.filter((i) => i.course === c)] as const)
    .filter(([, xs]) => xs.length);

  return (
    <div className="bg-[#EAE6DD] text-[#1A1A1A] font-body antialiased min-h-screen flex flex-col justify-between selection:bg-[#D4AF7C] selection:text-[#1E2F28]">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 w-full bg-[#1E2F28] text-[#EAE6DD] shadow-sm border-b border-[#C9B89F]/20">
        <div className="flex items-center space-x-3">
          <button onClick={() => nav("/")} aria-label="Volver a plano de mesas" className="p-1 -ml-1 text-[#EAE6DD] hover:text-[#D4AF7C] active:opacity-80 transition-colors flex items-center justify-center" type="button">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline font-bold text-base tracking-wide text-[#EAE6DD] flex items-center gap-1.5">
              <span>{title} · {String(Math.floor(minutes / 60)).padStart(2, "0")}:{String(minutes % 60).padStart(2, "0")}</span>
            </h1>
            <span className="font-body text-xs text-[#C9B89F] block -mt-0.5">Mesero: {session.user.name}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={() => client.orders.requestBill(checkId!).then(() => nav("/"))} aria-label="Pedir cuenta" className="p-2 rounded-lg text-[#EAE6DD] hover:text-[#D4AF7C] active:opacity-80 transition-all flex items-center justify-center relative" type="button">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          </button>
        </div>
      </header>

      <section className="fixed top-14 left-0 right-0 z-40 bg-[#273C33] border-b border-[#C9B89F]/20 px-3 py-2 shadow-sm text-xs text-[#EAE6DD]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar py-0.5">
            <span className="text-[#C9B89F] text-[11px] font-medium uppercase tracking-wider mr-1">Comensal:</span>
            {guests.map((g) =>
              g === guest ? (
                <button key={g} className="w-7 h-7 rounded-full text-xs font-bold bg-[#D4AF7C] text-[#1E2F28] shadow-sm flex items-center justify-center ring-2 ring-[#D4AF7C]/30 shrink-0" type="button">C{g}</button>
              ) : (
                <button key={g} onClick={() => setGuest(g)} className="w-7 h-7 rounded-full text-xs font-semibold bg-[#1E2F28] text-[#EAE6DD]/70 border border-[#C9B89F]/30 hover:border-[#D4AF7C] transition-all flex items-center justify-center shrink-0" type="button">C{g}</button>
              ),
            )}
          </div>
          <div className="flex items-center bg-[#1E2F28] p-0.5 rounded-lg border border-[#C9B89F]/30 shrink-0">
            {COURSES.map(([c, label]) => (
              <button key={c} onClick={() => setCourse(c)} className={c === course ? "px-2 py-1 rounded text-[11px] bg-[#D4AF7C] text-[#1E2F28] font-bold shadow-sm" : "px-2 py-1 rounded text-[11px] text-[#EAE6DD]/70 hover:text-[#EAE6DD]"} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ReadyNotificationsSlot />

      <main className="flex-1 w-full max-w-2xl mx-auto pt-28 pb-44 px-3.5 space-y-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#1E2F28]/60">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar platillo o bebida" className="w-full pl-10 pr-10 py-2.5 bg-[#F8F6F1] border border-[#C9B89F] rounded-lg text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/50 focus:outline-none focus:ring-1 focus:ring-[#1E2F28] focus:border-[#1E2F28] transition-all" type="text" />
        </div>

        <nav aria-label="Categorías de menú" className="flex space-x-2 overflow-x-auto custom-scrollbar pb-1 -mx-3.5 px-3.5">
          {menu.categories.map((c) =>
            c.id === categoryId && !query ? (
              <button key={c.id} className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-[#D4AF7C] text-[#1E2F28] border border-[#D4AF7C] shadow-sm" type="button">{c.name}</button>
            ) : (
              <button key={c.id} onClick={() => { setQuery(""); setCategoryId(c.id); }} className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-[#F8F6F1] text-[#1A1A1A] hover:bg-[#C9B89F]/30 border border-[#C9B89F] transition-colors" type="button">{c.name}</button>
            ),
          )}
        </nav>

        {byCourse.length > 0 && (
          <section className="bg-[#F8F6F1] rounded-lg border border-[#C9B89F] p-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#C9B89F]/40">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[#1E2F28] text-[20px]">room_service</span>
                <h2 className="font-display font-semibold text-sm tracking-wide text-[#1E2F28]">Comanda en curso</h2>
              </div>
              <span className="text-[11px] font-semibold text-[#1E2F28] bg-[#C9B89F]/40 px-2 py-0.5 rounded-full">{liveItems.reduce((s, i) => s + i.quantity, 0)} artículos</span>
            </div>
            <div className="space-y-2.5 text-xs">
              {byCourse.map(([c, items]) => {
                const block = COURSE_BLOCK[c];
                const st = courseStatus(items);
                const pending = items.some((i) => i.state === "pendiente");
                return (
                  <div key={c} className="bg-white/70 p-2.5 rounded border border-[#C9B89F]/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1E2F28] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-[15px] ${block.iconClass}`}>{block.icon}</span>
                        {block.title}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`text-xs px-1.5 py-0.2 rounded font-medium normal-case ${st.cls}`}>{st.label}</span>
                        {pending && (
                          <button onClick={() => client.orders.fire(checkId!, c).then(load)} className="px-2 py-0.5 bg-[#B45A3C] text-white rounded text-[10px] font-semibold tracking-wide hover:bg-[#93432A] active:scale-95 transition-all flex items-center gap-0.5 shadow-sm normal-case" type="button">
                            <span>Marchar</span>
                          </button>
                        )}
                      </span>
                    </div>
                    {items.map((i) => (
                      <div key={i.id} className={`flex justify-between items-center pl-4 py-0.5 text-[#1A1A1A] ${i.state === "cancelado" || i.state === "devuelto" ? "line-through opacity-50" : ""}`}>
                        <div>
                          <p className="font-medium">
                            {i.quantity}x {i.productName}{" "}
                            {(i.guest || i.modifiers.length > 0) && (
                              <span className="text-[10px] text-[#1A1A1A]/60">({[i.guest ? `C${i.guest}` : null, ...i.modifiers].filter(Boolean).join(" · ")})</span>
                            )}
                          </p>
                          {i.note && <p className="text-[11px] text-[#1A1A1A]/60 italic pl-1">{i.note}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#1E2F28]">{mxn(i.unitPrice * i.quantity)}</span>
                          {i.state === "listo" && (
                            <button onClick={() => client.orders.transition(i.id, "entregado").then(load)} className="px-2 py-0.5 bg-[#D4AF7C] text-[#1E2F28] rounded text-[10px] font-semibold tracking-wide active:scale-95 transition-all flex items-center gap-0.5 shadow-sm" type="button">
                              <span className="material-symbols-outlined text-[12px]">done_all</span>
                              <span>Entregar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-[#1E2F28] tracking-tight">{query ? `Resultados para “${query}”` : category?.name}</h3>
            <span className="text-xs text-[#1E2F28]/70">{products.length} opciones</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((p) =>
              p.soldOut ? (
                <div key={p.id} className="bg-stone-200/70 rounded-lg border border-stone-300 p-3 flex flex-col justify-between opacity-75 relative">
                  <div className="flex justify-between items-start gap-2">
                    <div className="pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-stone-500 text-white rounded">Agotado</span>
                        <span className="text-[10px] text-stone-500 font-medium">Sin stock</span>
                      </div>
                      <h4 className="font-display font-semibold text-sm text-stone-600 line-through">{p.name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-300">
                    <span className="text-sm font-medium text-stone-500 line-through">{mxn(p.price)}</span>
                    <span className="w-8 h-8 rounded-full bg-stone-300 text-stone-500 flex items-center justify-center cursor-not-allowed">
                      <span className="material-symbols-outlined text-[18px]">block</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div key={p.id} className="bg-[#F8F6F1] rounded-lg border border-[#C9B89F] p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between bg-gradient-to-br from-white to-[#F8F6F1]">
                  <div className="flex justify-between items-start gap-2">
                    <div className="pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-[#1E2F28]/60 font-medium">{stationName(p)}</span>
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#1A1A1A] leading-snug">{p.name}</h4>
                    </div>
                    {p.photoUrl && (
                      <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 border border-[#C9B89F]">
                        <img className="w-full h-full object-cover" src={p.photoUrl} alt={p.name} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#C9B89F]/30">
                    <span className="text-sm font-bold text-[#1E2F28] tracking-tight">{mxn(p.price)}</span>
                    <button onClick={() => (p.modifierGroups.length ? setPicking(p) : add(p))} className="w-8 h-8 rounded-full bg-[#1E2F28] text-[#D4AF7C] hover:bg-[#273C33] active:scale-95 transition-transform flex items-center justify-center shadow-sm" type="button">
                      <span className="material-symbols-outlined text-[18px]">{p.modifierGroups.length ? "tune" : "add"}</span>
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </main>

      {picking && (
        <ModifierSheet product={picking} guests={guests} guest={guest} course={isBar(picking) ? "bebida" : course}
          onCancel={() => setPicking(null)} onAdd={(ids, note, g) => add(picking, ids, note, g)} />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 px-3 py-2 pb-4 bg-gradient-to-t from-[#EAE6DD] via-[#EAE6DD]/95 to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          {error && <p className="text-[11px] text-[#B45A3C] font-medium mb-1 text-center">{error}</p>}
          {draft.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto custom-scrollbar mb-1.5">
              {draft.map((d) => (
                <button key={d.key} onClick={() => setDraft((xs) => xs.filter((x) => x.key !== d.key))} className="shrink-0 px-2 py-1 rounded-full bg-[#F8F6F1] border border-[#C9B89F] text-[10px] font-medium text-[#1E2F28] flex items-center gap-1">
                  C{d.guest} · {d.product.name}
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              ))}
            </div>
          )}
          <button disabled={!draft.length} onClick={send} className="w-full bg-[#1E2F28] text-[#EAE6DD] p-3 rounded-xl shadow-lg border border-[#D4AF7C]/40 flex items-center justify-between hover:bg-[#273C33] active:scale-[0.98] transition-all disabled:opacity-60" type="button">
            <div className="text-left flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-lg bg-[#D4AF7C] text-[#1E2F28] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">send</span>
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-[#EAE6DD]">Enviar a cocina y barra</span>
                  <span className="bg-[#B45A3C] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">{draft.length} art.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#C9B89F] mt-0.5">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Cocina ({draft.length - toBar})</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#D4AF7C]" />Barra ({toBar})</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#C9B89F] block -mb-1">Total cuenta</span>
              <span className="font-mono font-bold text-lg text-[#D4AF7C]">{mxn(check.total + draftTotal)}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/** El aviso de "listo" también aparece mientras se captura (debajo de las barras fijas). */
function ReadyNotificationsSlot() {
  return (
    <div className="fixed top-[104px] left-0 right-0 z-40 max-w-xl mx-auto">
      <ReadyNotifications />
    </div>
  );
}

function ModifierSheet(props: {
  product: Product;
  guests: number[];
  guest: number;
  course: Course;
  onCancel: () => void;
  onAdd: (ids: string[], note: string | undefined, guest: number) => void;
}) {
  const { product } = props;
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [guest, setGuest] = useState(props.guest);
  const valid = product.modifierGroups.every((g) => {
    const n = g.modifiers.filter((m) => selected.includes(m.id)).length;
    return n >= g.minSelect && n <= g.maxSelect;
  });
  const toggle = (max: number, ids: string[], id: string) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (max === 1) return [...s.filter((x) => !ids.includes(x)), id];
      return s.filter((x) => ids.includes(x)).length < max ? [...s, id] : s;
    });
  const total = product.price + product.modifierGroups.flatMap((g) => g.modifiers).filter((m) => selected.includes(m.id)).reduce((s, m) => s + m.priceDelta, 0);
  const courseLabel = { entrada: "Entrada", fuerte: "Fuerte", postre: "Postre", bebida: "Bebida", sin_tiempo: "—" }[props.course];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] transition-opacity" onClick={props.onCancel}>
      <div className="bg-[#F8F6F1] w-full max-w-xl rounded-t-2xl shadow-2xl border-t border-[#C9B89F] max-h-[751px] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="pt-2 px-4 pb-3 bg-[#1E2F28] text-[#EAE6DD] border-b border-[#C9B89F]/20 relative">
          <div className="w-10 h-1 bg-[#C9B89F]/40 rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#D4AF7C] uppercase tracking-wider block">Modificar Platillo</span>
              <h3 className="font-display font-bold text-lg text-[#EAE6DD]">{product.name} · {mxn(product.price)}</h3>
            </div>
            <button onClick={props.onCancel} aria-label="Cerrar ventana de modificadores" className="w-8 h-8 rounded-full bg-[#273C33] text-[#EAE6DD] hover:text-[#D4AF7C] flex items-center justify-center active:scale-95 transition-transform" type="button">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-3.5 space-y-4 text-xs">
          <div className="bg-white p-3 rounded-lg border border-[#C9B89F]/40 shadow-sm flex items-center justify-between gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E2F28]">Asignar a comensal</label>
              <div className="flex space-x-1.5 mt-1.5">
                {props.guests.map((g) =>
                  g === guest ? (
                    <button key={g} className="w-7 h-7 rounded text-xs font-bold bg-[#1E2F28] text-[#D4AF7C] ring-2 ring-[#D4AF7C]" type="button">C{g}</button>
                  ) : (
                    <button key={g} onClick={() => setGuest(g)} className="w-7 h-7 rounded text-xs font-medium border border-[#C9B89F] bg-white text-[#1A1A1A]" type="button">C{g}</button>
                  ),
                )}
              </div>
            </div>
            <div className="text-right">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E2F28]">Tiempo de cocina</label>
              <div className="inline-flex mt-1.5 bg-[#EAE6DD] p-0.5 rounded border border-[#C9B89F]">
                <span className="px-2 py-1 text-[11px] font-bold bg-[#1E2F28] text-[#D4AF7C] rounded">{courseLabel}</span>
              </div>
            </div>
          </div>

          {product.modifierGroups.map((g) => {
            const single = g.maxSelect === 1;
            return (
              <div key={g.id} className="bg-white p-3.5 rounded-lg border border-[#C9B89F]/40 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-[#1E2F28]">{g.name}</h4>
                  {g.minSelect > 0 ? (
                    <span className="text-[10px] font-semibold text-[#B45A3C] bg-[#B45A3C]/10 px-2 py-0.5 rounded-full">Obligatorio</span>
                  ) : (
                    <span className="text-[10px] text-[#1A1A1A]/60">Opcional</span>
                  )}
                </div>
                <div className="space-y-2 mt-2">
                  {g.modifiers.map((m) => {
                    const on = selected.includes(m.id);
                    const cls = single
                      ? on ? "flex items-center justify-between p-2 rounded border border-[#1E2F28] bg-[#1E2F28]/5 cursor-pointer" : "flex items-center justify-between p-2 rounded border border-[#C9B89F]/40 hover:bg-black/5 cursor-pointer"
                      : on ? "flex items-center justify-between p-2 rounded border border-[#D4AF7C] bg-[#D4AF7C]/10 cursor-pointer" : "flex items-center justify-between p-2 rounded border border-[#C9B89F]/40 hover:bg-black/5 cursor-pointer";
                    return (
                      <label key={m.id} className={cls}>
                        <div className="flex items-center gap-2">
                          <input checked={on} onChange={() => toggle(g.maxSelect, g.modifiers.map((x) => x.id), m.id)} className={single ? "text-[#1E2F28] focus:ring-[#D4AF7C]" : "rounded text-[#1E2F28] focus:ring-[#D4AF7C]"} name={g.id} type={single ? "radio" : "checkbox"} />
                          <span className="font-medium text-[#1A1A1A]">{m.name}</span>
                        </div>
                        {m.priceDelta > 0 ? (
                          <span className="font-semibold text-[#1E2F28]">+{mxn(m.priceDelta)}</span>
                        ) : single && on ? (
                          <span className="material-symbols-outlined text-[#1E2F28] text-[18px]">check_circle</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="bg-white p-3 rounded-lg border border-[#C9B89F]/40 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5 text-[#1E2F28]">
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              <label className="font-headline font-bold text-xs uppercase tracking-wider" htmlFor="order-note">Instrucción para cocina</label>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. sin cebolla, aderezo aparte" className="w-full bg-[#F8F6F1] border border-[#C9B89F] rounded px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1E2F28]" id="order-note" type="text" />
          </div>
        </div>
        <div className="p-3 bg-[#EAE6DD] border-t border-[#C9B89F] flex gap-2">
          <button disabled={!valid} onClick={() => props.onAdd(selected, note || undefined, guest)} className="w-full py-3 px-4 bg-[#1E2F28] text-[#D4AF7C] rounded-lg font-bold text-sm tracking-wide shadow-md flex items-center justify-between hover:bg-[#273C33] active:scale-[0.99] transition-all disabled:opacity-50" type="button">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>Agregar platillo</span>
            </span>
            <span className="text-base text-white font-mono font-bold">{mxn(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
