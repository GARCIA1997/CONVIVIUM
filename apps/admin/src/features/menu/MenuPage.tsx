import type { Menu } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { Card, Money } from "@convivium/ui";
import { useEffect, useState } from "react";

/** E2-01 listado de menú · E2-07 agotado en tiempo real. */
export function MenuPage() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const load = () => client.catalog.menu().then(setMenu);
  useEffect(() => { load(); }, []);
  if (!menu) return <p>Cargando…</p>;
  return (
    <>
      <h1>Menú</h1>
      {menu.categories.map((c) => (
        <section key={c.id} style={{ marginTop: 24 }}>
          <div className="cv-label">{c.name}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8, maxWidth: 720 }}>
            {menu.products.filter((p) => p.categoryId === c.id).map((p) => (
              <Card key={p.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ flex: 1 }}>{p.name}{p.iepsPct > 0 && <span className="cv-label" style={{ marginLeft: 8 }}>IEPS {p.iepsPct}%</span>}</span>
                <Money cents={p.price} />
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={p.soldOut} onChange={(e) => client.catalog.setSoldOut(p.id, e.target.checked).then(load)} /> Agotado
                </label>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
