/* Captura de pedido para llevar en mostrador (E3-11). Clases del diseño Stitch de caja (caja-tpv). */
import type { Menu } from "@convivium/api-client";
import { useSession } from "@convivium/app-shell";
import { useEffect, useMemo, useState } from "react";

type Product = Menu["products"][number];
interface Line { key: number; product: Product; modifierIds: string[]; qty: number; note: string }
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);

export function NewTakeout({ onClose, onCreated }: { onClose: () => void; onCreated: (checkId: string) => void }) {
  const { client } = useSession();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState<0 | 15 | 30>(0);
  const [disposables, setDisposables] = useState(true);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { client.catalog.menu().then((m) => { setMenu(m); setCat(m.categories[0]?.id ?? null); }); }, [client]);

  const products = useMemo(() => (menu?.products ?? []).filter((p) => p.active && (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.categoryId === cat)), [menu, cat, q]);
  const unit = (l: Line) => l.product.price + l.product.modifierGroups.flatMap((g) => g.modifiers).filter((m) => l.modifierIds.includes(m.id)).reduce((n, m) => n + m.priceDelta, 0);
  const total = lines.reduce((n, l) => n + unit(l) * l.qty, 0);
  const digits = phone.replace(/\D/g, "");
  const valid = name.trim() && lines.length > 0 && (!digits || digits.length === 10);

  const choose = (p: Product) => (p.modifierGroups.length ? setPicking(p) : addLine(p, []));
  const addLine = (p: Product, modifierIds: string[]) => {
    setLines((ls) => {
      const same = ls.find((l) => l.product.id === p.id && l.modifierIds.join() === modifierIds.join() && !l.note);
      return same ? ls.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { key: Date.now() + Math.random(), product: p, modifierIds, qty: 1, note: "" }];
    });
    setPicking(null);
  };
  const submit = async () => {
    setErr(null); setSaving(true);
    try {
      const check = await client.orders.open({ kind: "llevar", customerName: name.trim(), customerPhone: digits || null, pickupAt: when ? new Date(Date.now() + when * 60000).toISOString() : null, channel: "mostrador", disposables, note: note.trim() || null });
      await client.orders.addItems(check.id, lines.map((l) => ({ productId: l.product.id, quantity: l.qty, modifierIds: l.modifierIds, note: l.note || undefined, course: "sin_tiempo" as const, fireNow: true })));
      onCreated(check.id);
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-marfil w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <section className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-arena/60 bg-white flex items-center gap-3">
            <h2 className="font-headline text-xl font-bold text-olivo shrink-0">Nuevo pedido para llevar</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar platillo…" className="flex-1 border border-arena rounded-lg px-3 py-2 text-sm" />
          </div>
          {!q && (
            <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
              {menu?.categories.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cat === c.id ? "px-4 py-2 rounded-lg bg-olivo text-amber-100 text-sm font-semibold shrink-0" : "px-4 py-2 rounded-lg bg-white border border-arena text-stone-700 text-sm shrink-0"}>{c.name}</button>)}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
            {products.map((p) => (
              <button key={p.id} disabled={p.soldOut} onClick={() => choose(p)} className="text-left bg-white rounded-xl border border-arena/60 p-3 shadow-sm hover:border-olivo transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="block font-semibold text-sm text-stone-900">{p.name}</span>
                <span className="block text-xs text-stone-500 mt-0.5">{p.soldOut ? "Agotado" : p.modifierGroups.length ? "Con opciones" : " "}</span>
                <span className="block font-mono text-sm font-bold text-olivo mt-2">{money(p.price)}</span>
              </button>
            ))}
            {menu && !products.length && <p className="text-sm text-stone-500 col-span-full">Sin platillos en esta vista.</p>}
          </div>
        </section>

        <aside className="w-96 shrink-0 border-l border-arena/60 bg-white flex flex-col">
          <div className="p-4 space-y-2 border-b border-arena/40">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente *" className="w-full border border-arena rounded-lg px-3 py-2 text-sm" />
            <input value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 14))} placeholder="Teléfono (10 dígitos, para avisar por WhatsApp)" className="w-full border border-arena rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-1.5 text-xs">
              {([[0, "Lo antes posible"], [15, "En 15 min"], [30, "En 30 min"]] as const).map(([v, l]) => <button key={v} onClick={() => setWhen(v)} className={when === v ? "flex-1 py-1.5 rounded-lg bg-olivo text-amber-100 font-semibold" : "flex-1 py-1.5 rounded-lg border border-arena text-stone-700"}>{l}</button>)}
            </div>
            <label className="flex items-center justify-between text-xs text-stone-700"><span>Incluir desechables</span><input type="checkbox" checked={disposables} onChange={(e) => setDisposables(e.target.checked)} className="rounded text-olivo border-arena" /></label>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="border border-arena/50 rounded-lg p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-stone-900">{l.product.name}</span>
                    {l.modifierIds.length > 0 && <span className="block text-[11px] text-stone-500">{l.product.modifierGroups.flatMap((g) => g.modifiers).filter((m) => l.modifierIds.includes(m.id)).map((m) => m.name).join(", ")}</span>}
                  </div>
                  <span className="font-mono text-sm shrink-0">{money(unit(l) * l.qty)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="inline-flex items-center border border-arena rounded-lg overflow-hidden">
                    <button onClick={() => setLines(lines.map((x) => (x === l ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))} className="w-8 h-8 hover:bg-stone-100" aria-label="Quitar uno">−</button>
                    <span className="w-8 text-center font-mono">{l.qty}</span>
                    <button onClick={() => setLines(lines.map((x) => (x === l ? { ...x, qty: x.qty + 1 } : x)))} className="w-8 h-8 hover:bg-stone-100" aria-label="Agregar uno">+</button>
                  </div>
                  <input value={l.note} onChange={(e) => setLines(lines.map((x) => (x === l ? { ...x, note: e.target.value.slice(0, 140) } : x)))} placeholder="Nota" className="ml-2 flex-1 border border-arena/60 rounded px-2 py-1 text-xs" />
                </div>
              </div>
            ))}
            {!lines.length && <p className="text-xs text-stone-500">Toca un platillo para agregarlo.</p>}
          </div>
          <div className="p-4 border-t border-arena/40 space-y-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota del pedido (ej. sin cubiertos)" className="w-full border border-arena rounded-lg px-3 py-2 text-xs" />
            <div className="flex justify-between text-sm"><span className="text-stone-600">Total</span><span className="font-mono font-bold text-stone-900">{money(total)}</span></div>
            {err && <p className="text-xs text-terracota">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="py-2.5 rounded-lg border border-arena text-sm text-stone-700">Cancelar</button>
              <button disabled={!valid || saving} onClick={submit} className="py-2.5 rounded-lg bg-olivo text-amber-100 text-sm font-semibold disabled:opacity-40">{saving ? "Enviando…" : "Enviar a cocina"}</button>
            </div>
          </div>
        </aside>
      </div>

      {picking && <ModifierPicker product={picking} onCancel={() => setPicking(null)} onConfirm={(ids) => addLine(picking, ids)} />}
    </div>
  );
}

/** Opciones del platillo: respeta mínimos y máximos de cada grupo (p. ej. término obligatorio). */
function ModifierPicker({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const ok = product.modifierGroups.every((g) => { const n = g.modifiers.filter((m) => sel.includes(m.id)).length; return n >= g.minSelect && n <= g.maxSelect; });
  const toggle = (g: Product["modifierGroups"][number], id: string) => {
    const inGroup = sel.filter((x) => g.modifiers.some((m) => m.id === x));
    if (sel.includes(id)) return setSel(sel.filter((x) => x !== id));
    if (g.maxSelect === 1) return setSel([...sel.filter((x) => !inGroup.includes(x)), id]);
    if (inGroup.length < g.maxSelect) setSel([...sel, id]);
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className="bg-white rounded-xl p-5 w-[420px] space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-headline text-lg font-bold text-olivo">{product.name}</h3>
        {product.modifierGroups.map((g) => (
          <div key={g.id}>
            <span className="block text-xs font-semibold text-stone-700 mb-1.5">{g.name} <span className="font-normal text-stone-500">{g.minSelect > 0 ? "· obligatorio" : "· opcional"}{g.maxSelect > 1 ? ` · hasta ${g.maxSelect}` : ""}</span></span>
            <div className="flex flex-wrap gap-1.5">
              {g.modifiers.map((m) => <button key={m.id} onClick={() => toggle(g, m.id)} className={sel.includes(m.id) ? "px-3 py-1.5 rounded-lg bg-olivo text-amber-100 text-xs font-semibold" : "px-3 py-1.5 rounded-lg border border-arena text-stone-700 text-xs"}>{m.name}{m.priceDelta ? ` +${money(m.priceDelta)}` : ""}</button>)}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="py-2 rounded-lg border border-arena text-sm">Cancelar</button>
          <button disabled={!ok} onClick={() => onConfirm(sel)} className="py-2 rounded-lg bg-olivo text-amber-100 text-sm font-semibold disabled:opacity-40">Agregar</button>
        </div>
      </div>
    </div>
  );
}
