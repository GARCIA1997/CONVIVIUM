/* E2-01 listado de menú · E2-07 agotado en tiempo real. Clases del sistema de diseño Stitch (admin-menu-editor). */
import type { Menu } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { AdminHeader } from "../layout/AdminLayout";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);

export function MenuPage() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const load = () => client.catalog.menu().then(setMenu);
  useEffect(() => { load(); }, []);

  return (
    <>
      <AdminHeader />
      <main className="flex-1 p-8 space-y-6">
        <div className="border-b border-[#C9B89F]/30 pb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B45A3C]">Catálogo</span>
          <h1 className="font-display text-3xl font-bold text-neutral-900 tracking-tight mt-1">Menú y disponibilidad</h1>
          <p className="text-xs text-neutral-600 mt-1">Marcar un producto como agotado se refleja al instante en los celulares de los meseros.</p>
        </div>
        {menu?.categories.map((c) => (
          <section key={c.id} className="bg-white rounded-xl border border-[#C9B89F]/60 shadow-xs overflow-hidden max-w-4xl">
            <div className="px-5 py-3 border-b border-[#C9B89F]/40 bg-[#FBF9F5] flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-neutral-900">{c.name}</h2>
              <span className="text-[11px] text-neutral-500">{menu.products.filter((p) => p.categoryId === c.id).length} productos</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {menu.products.filter((p) => p.categoryId === c.id).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                  <span className={`flex-1 font-medium ${p.soldOut ? "text-neutral-400 line-through" : "text-neutral-900"}`}>{p.name}</span>
                  {p.iepsPct > 0 && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/60">IEPS {p.iepsPct}%</span>}
                  <span className="font-mono text-neutral-800 w-24 text-right">{money(p.price)}</span>
                  <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer select-none">
                    <input type="checkbox" checked={p.soldOut} onChange={(e) => client.catalog.setSoldOut(p.id, e.target.checked).then(load)} className="rounded border-[#C9B89F] text-[#B45A3C] focus:ring-[#D4AF7C]" />
                    Agotado
                  </label>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
