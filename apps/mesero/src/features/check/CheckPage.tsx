import type { Check, Menu, Product } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { Badge, Button, Money } from "@convivium/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Draft = { productId: string; name: string; price: number; quantity: number; modifierIds: string[]; note?: string; course: "entrada" | "fuerte" | "postre" | "bebida" | "sin_tiempo" };

const stateLabel: Record<string, string> = {
  pendiente: "En espera", enviado: "Enviado", en_preparacion: "Preparando", listo: "¡Listo!", entregado: "Entregado", cancelado: "Cancelado", devuelto: "Devuelto",
};

/** E3-02 · Captura de comanda; E3-03 marchar; E3-05 entregado; E3-09 pedir cuenta. */
export function CheckPage() {
  const { checkId } = useParams<{ checkId: string }>();
  const { client } = useSession();
  const nav = useNavigate();
  const [check, setCheck] = useState<Check | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);

  const load = useCallback(() => client.orders.get(checkId!).then(setCheck), [client, checkId]);
  useEffect(() => { load(); client.catalog.menu().then((m) => { setMenu(m); setCategoryId(m.categories[0]?.id ?? null); }); }, [client, load]);
  useRealtime(["menu", "floor"], (e) => {
    if (e.type === "product.sold_out") setMenu((m) => m && { ...m, products: m.products.map((p) => (p.id === e.productId ? { ...p, soldOut: e.soldOut } : p)) });
    else load();
  });

  const products = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    return menu.products.filter((p) => p.active && (q ? p.name.toLowerCase().includes(q) : p.categoryId === categoryId));
  }, [menu, query, categoryId]);

  const add = (p: Product, modifierIds: string[] = [], note?: string) => {
    const bebida = menu?.categories.find((c) => c.id === p.categoryId)?.name.match(/coctel|cerveza|bebida|vino/i);
    setDraft((d) => [...d, { productId: p.id, name: p.name, price: p.price, quantity: 1, modifierIds, note, course: bebida ? "bebida" : "fuerte" }]);
    setPicking(null);
  };

  const send = async () => {
    await client.orders.addItems(checkId!, draft.map(({ name: _n, price: _p, ...i }) => ({ ...i, fireNow: true })));
    setDraft([]);
    load();
  };

  if (!check || !menu) return <p style={{ padding: 16 }}>Cargando…</p>;
  const draftTotal = draft.reduce((s, d) => s + d.price * d.quantity, 0);

  return (
    <main style={{ padding: 16, paddingBottom: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{check.kind === "barra" ? `Barra · ${check.name}` : `Mesa · ${check.guests} comensales`}</h2>
        <Button variant="ghost" onClick={() => nav("/")}>Mesas</Button>
      </div>

      <section style={{ marginTop: 16 }}>
        {check.items.map((i) => (
          <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", textDecoration: i.state === "cancelado" ? "line-through" : undefined }}>
            <div style={{ flex: 1 }}>
              {i.quantity}× {i.productName}
              {i.modifiers.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{i.modifiers.join(", ")}{i.note ? ` · ${i.note}` : ""}</div>}
            </div>
            <Badge color={i.state === "listo" ? "var(--c-dorado)" : "var(--c-arena)"}>{stateLabel[i.state]}</Badge>
            {i.state === "listo" && <Button style={{ minHeight: 36 }} onClick={() => client.orders.transition(i.id, "entregado").then(load)}>Entregado</Button>}
          </div>
        ))}
        <div style={{ textAlign: "right", marginTop: 8, fontWeight: 700 }}>Total <Money cents={check.total} /></div>
      </section>

      <input placeholder="Buscar platillo o bebida" value={query} onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", marginTop: 16, height: 44, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)" }} />
      <nav style={{ display: "flex", gap: 8, overflowX: "auto", margin: "12px 0" }}>
        {menu.categories.map((c) => (
          <button key={c.id} className={`cv-btn ${c.id === categoryId && !query ? "cv-btn--primary" : "cv-btn--ghost"}`} style={{ minHeight: 36, whiteSpace: "nowrap" }} onClick={() => { setQuery(""); setCategoryId(c.id); }}>{c.name}</button>
        ))}
      </nav>
      <div style={{ display: "grid", gap: 8 }}>
        {products.map((p) => (
          <button key={p.id} disabled={p.soldOut} onClick={() => (p.modifierGroups.length ? setPicking(p) : add(p))}
            className="cv-card" style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", textAlign: "left", opacity: p.soldOut ? 0.5 : 1 }}>
            <span>{p.name} {p.soldOut && <Badge color="var(--c-arena)">Agotado</Badge>}</span>
            <Money cents={p.price} />
          </button>
        ))}
      </div>

      {picking && <ModifierSheet product={picking} onCancel={() => setPicking(null)} onAdd={(ids, note) => add(picking, ids, note)} />}

      <footer style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 12, background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <Button variant="ghost" onClick={() => client.orders.requestBill(checkId!).then(() => nav("/"))}>Pedir cuenta</Button>
        <Button style={{ flex: 1 }} disabled={!draft.length} onClick={send}>
          Enviar {draft.length ? `(${draft.length}) · ` : ""}<Money cents={draftTotal} />
        </Button>
      </footer>
    </main>
  );
}

function ModifierSheet({ product, onCancel, onAdd }: { product: Product; onCancel: () => void; onAdd: (ids: string[], note?: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const valid = product.modifierGroups.every((g) => {
    const n = g.modifiers.filter((m) => selected.includes(m.id)).length;
    return n >= g.minSelect && n <= g.maxSelect;
  });
  const toggle = (groupMax: number, groupIds: string[], id: string) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      const inGroup = s.filter((x) => groupIds.includes(x));
      return groupMax === 1 ? [...s.filter((x) => !groupIds.includes(x)), id] : inGroup.length < groupMax ? [...s, id] : s;
    });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={onCancel}>
      <div className="cv-card" style={{ width: "100%", borderRadius: "16px 16px 0 0" }} onClick={(e) => e.stopPropagation()}>
        <h3>{product.name}</h3>
        {product.modifierGroups.map((g) => (
          <div key={g.id} style={{ marginTop: 12 }}>
            <div className="cv-label">{g.name} {g.minSelect > 0 ? "· obligatorio" : "· opcional"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {g.modifiers.map((m) => (
                <button key={m.id} className={`cv-btn ${selected.includes(m.id) ? "cv-btn--primary" : "cv-btn--ghost"}`} style={{ minHeight: 40 }}
                  onClick={() => toggle(g.maxSelect, g.modifiers.map((x) => x.id), m.id)}>
                  {m.name}{m.priceDelta ? ` +${m.priceDelta / 100}` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
        <input placeholder="Nota (ej. sin cebolla)" value={note} onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%", marginTop: 12, height: 44, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
        <Button style={{ width: "100%", marginTop: 12 }} disabled={!valid} onClick={() => onAdd(selected, note || undefined)}>Agregar</Button>
      </div>
    </div>
  );
}
