/* Generador de menú (E2-09): impreso en PDF, digital con QR. Diseño: design/stitch/admin-menus-publicacion.html y menu-impreso.html. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

interface Config {
  title: string; subtitle: string; footer: string; address: string; phone: string; whatsapp: string;
  template: "clasica" | "moderna" | "bistro"; size: "carta" | "media_carta"; columns: 1 | 2; accent: string;
  showDescriptions: boolean; showSoldOut: boolean; showPromos: boolean;
  categories: { id: string; visible: boolean }[]; hiddenProducts: string[];
}
interface Current { slug: string; published: boolean; publishedAt: string | null; config: Config; publicUrl: string }
interface Brand { name: string; slogan: string; logoUrl: string | null; primary: string; accent: string; background: string; text: string; fontHeading: string; fontBody: string }
interface View { branchName: string; brand: Brand; sections: { id: string; name: string; items: { id: string; name: string; description: string | null; price: number; badges: string[]; soldOut: boolean }[] }[]; promos: { name: string; detail: string }[] }
interface MenuData { categories: { id: string; name: string; sortOrder: number }[]; products: { id: string; name: string; categoryId: string; badges: string[]; active: boolean }[] }

const BADGE: Record<string, string> = { nuevo: "Nuevo", picante: "Picante", vegetariano: "Vegetariano", recomendado: "Recomendado" };
const peso = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

/** Descarga un archivo protegido de la API (PDF, QR). */
async function download(path: string, filename: string) {
  const res = await fetch(`/v1${path}`, { headers: { authorization: `Bearer ${client.session?.accessToken}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MenuGeneratorPage() {
  const [cur, setCur] = useState<Current | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [slug, setSlug] = useState("");
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<"impreso" | "digital">("impreso");
  const [qr, setQr] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();

  const load = useCallback(async () => {
    const c = await client.request<Current>("GET", "/menus/current");
    setCur(c); setCfg(c.config); setSlug(c.slug);
    const res = await fetch("/v1/menus/current/qr?format=svg", { headers: { authorization: `Bearer ${client.session?.accessToken}` } });
    setQr(await res.text());
  }, []);
  useEffect(() => { load(); client.request<MenuData>("GET", "/catalog/menu").then(setMenu); }, [load]);
  // Vista previa en vivo (con la configuración sin guardar), con pausa para no saturar.
  useEffect(() => {
    if (!cfg) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      client.request<View>("POST", "/menus/preview", cfg).then(setView).catch(() => {});
      fetch("/v1/menus/preview.html", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${client.session?.accessToken}` }, body: JSON.stringify(cfg) }).then((r) => (r.ok ? r.text() : null)).then((h) => h && setHtml(h)).catch(() => {});
    }, 250);
  }, [cfg]);

  if (!cfg || !cur || !menu) return <main className="flex-1 p-8 text-sm text-stone-500">Cargando…</main>;
  const set = (p: Partial<Config>) => setCfg({ ...cfg, ...p });
  const dirty = JSON.stringify(cfg) !== JSON.stringify(cur.config) || slug !== cur.slug;
  const cats = [...menu.categories].sort((a, b) => {
    const ia = cfg.categories.findIndex((c) => c.id === a.id), ib = cfg.categories.findIndex((c) => c.id === b.id);
    return (ia < 0 ? 1000 + a.sortOrder : ia) - (ib < 0 ? 1000 + b.sortOrder : ib);
  });
  const catVisible = (id: string) => cfg.categories.find((c) => c.id === id)?.visible ?? true;
  const orderWith = (list: typeof cats) => list.map((c) => ({ id: c.id, visible: catVisible(c.id) }));
  const move = (i: number, d: -1 | 1) => { const l = [...cats]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j]!, l[i]!]; set({ categories: orderWith(l) }); };
  const toggleCat = (id: string) => set({ categories: orderWith(cats).map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)) });
  const toggleProduct = (id: string) => set({ hiddenProducts: cfg.hiddenProducts.includes(id) ? cfg.hiddenProducts.filter((x) => x !== id) : [...cfg.hiddenProducts, id] });

  const save = async () => {
    setMsg(null);
    try { await client.request("PUT", "/menus/current", { slug, config: cfg }); await load(); setMsg({ ok: true, text: "Cambios guardados. El menú digital ya los muestra." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const publish = async (published: boolean) => { if (dirty) await save(); await client.request("POST", "/menus/current/publish", { published }); await load(); setMsg({ ok: true, text: published ? "Menú digital publicado." : "Menú digital retirado." }); };

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden bg-marfil">
      <div className="px-8 py-5 bg-white border-b border-arena-border shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1"><span>Menú</span><span>/</span><span className="font-semibold text-stone-800">Publicación y canales</span></div>
          <h1 className="font-serif-brand text-2xl font-bold text-stone-900 tracking-tight">Centro de publicación de menús</h1>
        </div>
        {cur.published
          ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"><span className="w-2 h-2 rounded-full bg-emerald-600" />Publicado y activo en sucursal</span>
          : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200"><span className="w-2 h-2 rounded-full bg-stone-400" />Sin publicar</span>}
      </div>
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
      <section className="col-span-3 border-r border-arena-border bg-marfil-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-arena-border/70"><h2 className="font-serif-brand text-lg font-bold text-stone-900">Contenido</h2><p className="text-[11px] text-stone-500">Orden y platillos que aparecen en el menú</p></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cats.map((c, i) => (
            <div key={c.id} className={`rounded-lg border border-arena-border bg-white ${catVisible(c.id) ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-arena-light">
                <input type="checkbox" checked={catVisible(c.id)} onChange={() => toggleCat(c.id)} className="rounded text-olivo border-arena-border" />
                <span className="flex-1 text-xs font-semibold text-stone-800">{c.name}</span>
                <button onClick={() => move(i, -1)} className="text-stone-400 hover:text-olivo" title="Subir"><span className="material-symbols-outlined text-sm">arrow_upward</span></button>
                <button onClick={() => move(i, 1)} className="text-stone-400 hover:text-olivo" title="Bajar"><span className="material-symbols-outlined text-sm">arrow_downward</span></button>
              </div>
              <div className="px-3 py-1.5 space-y-1">
                {menu.products.filter((p) => p.categoryId === c.id && p.active).map((p) => {
                  const on = !cfg.hiddenProducts.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-[11px] cursor-pointer py-0.5">
                      <input type="checkbox" checked={on} onChange={() => toggleProduct(p.id)} className="rounded text-olivo border-arena-border" />
                      <span className={`flex-1 ${on ? "text-stone-700" : "text-stone-400 line-through"}`}>{p.name}</span>
                      {p.badges.map((b) => <span key={b} className="text-[9px] px-1 rounded bg-dorado/25 text-stone-700">{BADGE[b]}</span>)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-stone-400 px-1">Las etiquetas (Nuevo, Picante, Vegetariano, Recomendado) se asignan en la ficha del producto en Menú.</p>
        </div>
      </section>

      <section className="col-span-6 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 bg-white border-b border-arena-border flex items-center justify-between">
          <div className="flex gap-6 text-xs font-medium">
            {(["impreso", "digital"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={tab === t ? "pb-3 border-b-2 border-olivo text-stone-900 font-semibold flex items-center gap-1.5" : "pb-3 border-b-2 border-transparent text-stone-500 flex items-center gap-1.5"}><span className="material-symbols-outlined text-base">{t === "impreso" ? "print" : "smartphone"}</span>{t === "impreso" ? "Impreso (PDF)" : "Digital (celular)"}</button>)}
          </div>
          <span className="pb-3 text-[11px] text-stone-500">Vista previa en vivo</span>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-stone-200/50 flex justify-center">
          {view && tab === "impreso" && <PrintPreview view={view} cfg={cfg} qr={qr} url={cur.publicUrl} />}
          {tab === "digital" && html && <DigitalPreview html={html} />}
        </div>
      </section>

      <aside className="col-span-3 border-l border-arena-border bg-white overflow-y-auto p-5 space-y-5 text-xs">
        <div className="space-y-3">
          <h3 className="font-serif-brand text-base font-semibold text-stone-900">Diseño</h3>
          <div className="p-3 rounded-lg border border-arena-border bg-marfil-canvas/40 flex items-center gap-3">
            {view?.brand.logoUrl ? <img src={view.brand.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ background: view?.brand.primary, color: view?.brand.background }}>{view?.brand.name.charAt(0)}</span>}
            <div className="min-w-0 flex-1"><span className="block font-semibold text-stone-800 truncate">{view?.brand.name}</span><span className="block text-[10px] text-stone-500">Logo, nombre, colores y tipografías</span></div>
            <Link to="/identidad" className="text-olivo font-semibold underline shrink-0">Identidad</Link>
          </div>
          {([["address", "Dirección"], ["phone", "Teléfono"], ["whatsapp", "WhatsApp"], ["footer", "Pie"]] as const).map(([k, l]) => (
            <label key={k} className="block"><span className="block font-semibold text-stone-700 mb-1">{l}</span><input value={cfg[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<Config>)} className="w-full border border-arena-border rounded-lg px-2.5 py-1.5" /></label>
          ))}
          <div><span className="block font-semibold text-stone-700 mb-1">Tamaño del impreso</span>
            <div className="grid grid-cols-2 gap-1.5">{([["carta", "Carta"], ["media_carta", "Media carta"]] as const).map(([v, l]) => <button key={v} onClick={() => set({ size: v })} className={cfg.size === v ? "py-1.5 rounded-lg border-2 border-olivo bg-olivo/5 text-olivo font-semibold" : "py-1.5 rounded-lg border border-arena-border text-stone-600"}>{l}</button>)}</div>
          </div>
          <div><span className="block font-semibold text-stone-700 mb-1">Columnas</span>
            <div className="grid grid-cols-2 gap-1.5">{([1, 2] as const).map((n) => <button key={n} onClick={() => set({ columns: n })} className={cfg.columns === n ? "py-1.5 rounded-lg border-2 border-olivo bg-olivo/5 text-olivo font-semibold" : "py-1.5 rounded-lg border border-arena-border text-stone-600"}>{n} columna{n > 1 ? "s" : ""}</button>)}</div>
          </div>
          {([["showDescriptions", "Mostrar descripciones"], ["showSoldOut", "Mostrar agotados como “Agotado hoy” (digital)"], ["showPromos", "Mostrar promociones activas (digital)"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cfg[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<Config>)} className="rounded text-olivo border-arena-border" /><span className="text-stone-700">{l}</span></label>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-arena-border bg-marfil-canvas/40 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-serif-brand text-base font-semibold text-stone-900">Publicar</h3>{cur.published ? <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Publicado</span> : <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">Sin publicar</span>}</div>
          <label className="block"><span className="block font-semibold text-stone-700 mb-1">Dirección del menú digital</span>
            <div className="flex items-center border border-arena-border rounded-lg overflow-hidden bg-white"><span className="px-2 text-stone-400 font-mono text-[10px]">/m/</span><input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="flex-1 border-0 font-mono text-[11px] px-1 py-1.5 focus:ring-0" /></div>
          </label>
          <div className="space-y-1">
            <span className="block font-semibold text-stone-700">Enlace directo</span>
            <div className="flex gap-1">
              <input readOnly value={cur.publicUrl} onFocus={(e) => e.target.select()} className="w-full min-w-0 bg-stone-50 border border-arena-border rounded-lg font-mono text-[10px] px-2 py-1.5 text-stone-600" />
              <button onClick={() => navigator.clipboard.writeText(cur.publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})} className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded-lg font-medium shrink-0">{copied ? "Copiado" : "Copiar"}</button>
            </div>
            <a href={cur.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-olivo underline"><span className="material-symbols-outlined text-[13px]">open_in_new</span>Abrir menú digital</a>
          </div>
          {qr && <div className="flex flex-col items-center p-3 bg-marfil-canvas/60 rounded-lg border border-arena-border"><div className="bg-white rounded p-2 border border-stone-200" dangerouslySetInnerHTML={{ __html: qr.replace("<svg", '<svg width="140" height="140"') }} /><span className="text-[10px] text-stone-500 font-mono mt-1.5">Escanea para ver el menú digital</span></div>}
          <button onClick={() => download("/menus/current/qr?format=png&size=1024", `qr-menu-${cur.slug}.png`)} className="w-full py-2.5 rounded-lg bg-olivo text-white font-semibold flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-sm">qr_code</span>Descargar QR en alta calidad</button>
          <button onClick={() => download("/menus/current/qr?format=svg", `qr-menu-${cur.slug}.svg`)} className="w-full py-1.5 text-olivo font-semibold underline">QR para imprenta (SVG)</button>
          <button disabled={dirty} title={dirty ? "Guarda primero los cambios" : ""} onClick={() => download("/menus/current/pdf", `menu-${cur.slug}.pdf`)} className="w-full py-2.5 rounded-lg bg-white border-2 border-olivo text-olivo font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"><span className="material-symbols-outlined text-sm">picture_as_pdf</span>Descargar PDF para imprimir</button>
          {cur.published
            ? <button onClick={() => publish(false)} className="w-full py-2 rounded-lg border border-terracota/40 text-terracota font-semibold">Retirar menú digital</button>
            : <button onClick={() => publish(true)} className="w-full py-2.5 rounded-lg bg-olivo text-white font-semibold flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-sm text-dorado">public</span>Publicar menú digital</button>}
          <p className="text-[10px] text-stone-500">{cur.published ? "Publicado · se actualiza solo cuando cambian precios, platillos o agotados." : "El QR funciona en cuanto publiques."}</p>
        </div>
        {msg && <p className={msg.ok ? "text-emerald-700" : "text-terracota"}>{msg.text}</p>}
        <button disabled={!dirty} onClick={save} className="w-full py-2.5 rounded-lg bg-olivo text-white font-semibold disabled:opacity-40">Guardar cambios</button>
      </aside>
      </div>
    </main>
  );
}

/** Réplica en pantalla del PDF (carta impresa de Stitch). */
function PrintPreview({ view, cfg, qr, url }: { view: View; cfg: Config; qr: string | null; url: string }) {
  const w = cfg.size === "carta" ? 612 : 396, h = cfg.size === "carta" ? 792 : 612;
  const sections = view.sections.map((s) => ({ ...s, items: s.items.filter((i) => !i.soldOut) })).filter((s) => s.items.length);
  return (
    <div style={{ width: w, minHeight: h }} className="bg-white shadow-xl px-10 py-9 flex flex-col text-stone-900">
      <div className="text-center">
        {view.brand.logoUrl ? <img src={view.brand.logoUrl} alt="" className="inline-block w-12 h-12 object-contain" /> : <span className="inline-flex w-9 h-9 rounded-full border items-center justify-center font-serif-brand font-bold" style={{ borderColor: view.brand.accent, color: view.brand.primary }}>{view.brand.name.charAt(0)}</span>}
        <h1 className="font-serif-brand text-2xl mt-2" style={{ letterSpacing: "0.3em", color: view.brand.primary }}>{view.brand.name.toUpperCase()}</h1>
        {view.brand.slogan && <p className="font-serif-brand italic text-xs text-stone-500 mt-1">{view.brand.slogan}</p>}
        <div className="w-20 h-px mx-auto mt-2" style={{ background: view.brand.accent }} />
      </div>
      <div className="mt-6 flex-1" style={{ columnCount: cfg.columns, columnGap: 28 }}>
        {sections.map((s) => (
          <div key={s.id} className="mb-5 break-inside-avoid-column">
            <h2 className="font-serif-brand font-bold text-[11px] border-b border-arena pb-1 mb-2" style={{ letterSpacing: "0.18em", color: view.brand.primary }}>{s.name.toUpperCase()}</h2>
            {s.items.map((i) => (
              <div key={i.id} className="mb-2 break-inside-avoid">
                <div className="flex items-baseline gap-1 text-[11px]"><span className="font-serif-brand font-bold">{i.name}{i.badges.includes("picante") && " (picante)"}{i.badges.includes("vegetariano") && " (veg.)"}</span><span className="flex-1 border-b border-dotted border-arena translate-y-[-3px]" /><span className="font-bold" style={{ color: view.brand.primary }}>{peso(i.price)}</span></div>
                {i.description && <p className="text-[9px] text-stone-500 leading-snug">{i.description}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-arena pt-3 mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {qr && <div className="w-14 h-14" dangerouslySetInnerHTML={{ __html: qr.replace("<svg", '<svg width="56" height="56"') }} />}
          <div><p className="font-serif-brand font-bold text-[10px]" style={{ color: view.brand.primary }}>Escanea para ver el menú digital</p><p className="text-[8px] text-stone-500 break-all">{url}</p></div>
        </div>
        <p className="text-[8px] text-stone-500 text-right whitespace-pre-line">{[cfg.address, cfg.phone && `Tel. ${cfg.phone}`, cfg.footer].filter(Boolean).join("\n")}</p>
      </div>
      <p className="text-center text-[7px] tracking-wider text-stone-400 mt-2">Powered by CONVIVIUM</p>
    </div>
  );
}

/**
 * Menú digital real (mismo HTML que abre el QR) dentro de un marco de celular.
 * allow-same-origin: el HTML lo genera nuestra API (texto escapado) y, sin él, el navegador bloquea
 * las fotos y el logo servidos desde una dirección local (red del restaurante).
 */
function DigitalPreview({ html }: { html: string }) {
  return (
    <div className="w-[375px] h-[720px] rounded-[2.2rem] border-[10px] border-stone-900 bg-white overflow-hidden shadow-2xl shrink-0">
      <iframe title="Vista previa del menú digital" srcDoc={html.replace("<head>", `<head><base href="${location.origin}/">`)} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0" />
    </div>
  );
}
