/* Identidad del restaurante (marca blanca del menú). Diseño: design/stitch/admin-identidad-restaurante.html (Stitch). */
import { client } from "@convivium/app-shell";
import { branding } from "@convivium/contracts";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Brand = branding.Branding;
const COLORS = [["primary", "Principal"], ["accent", "Acento"], ["background", "Fondo"], ["text", "Texto"]] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Carga las tipografías elegidas para que la vista previa se vea como el menú real. */
function useGoogleFonts(fonts: string[]) {
  const key = [...new Set(fonts)].join("|");
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${key.split("|").map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;700`).join("&")}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [key]);
}

export function BrandingPage() {
  const [saved, setSaved] = useState<Brand | null>(null);
  const [b, setB] = useState<Brand | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { client.request<Brand>("GET", "/branding").then((x) => { setSaved(x); setB(x); }); }, []);
  useGoogleFonts(b ? [b.fontHeading, b.fontBody] : []);
  if (!b || !saved) return <main className="flex-1 p-8 text-sm text-stone-500">Cargando…</main>;

  const set = (p: Partial<Brand>) => setB({ ...b, ...p });
  const validColors = COLORS.every(([k]) => HEX.test(b[k]));
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const ratio = validColors ? branding.contrastRatio(b.text, b.background) : 0;
  const ratioPrimary = validColors ? branding.contrastRatio(b.primary, b.background) : 0;
  const contrastOk = ratio >= 4.5 && ratioPrimary >= 3;

  const save = async () => {
    setMsg(null); setBusy(true);
    try {
      const { logoUrl: _l, ...body } = b;
      const next = await client.request<Brand>("PUT", "/branding", body);
      setSaved(next); setB(next); setMsg({ ok: true, text: "Identidad guardada. El menú digital y el PDF ya la usan." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  const upload = async (f: File) => {
    setMsg(null);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setMsg({ ok: false, text: "Usa un logo PNG, JPG o WebP (SVG no se acepta por seguridad)." });
    if (f.size > 2 * 1024 * 1024) return setMsg({ ok: false, text: "El logo pesa más de 2 MB." });
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(f); });
      const next = await client.request<Brand>("PUT", "/branding/logo", { dataUrl });
      setSaved({ ...saved, logoUrl: next.logoUrl }); setB({ ...b, logoUrl: next.logoUrl });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  const removeLogo = async () => {
    setBusy(true);
    try { await client.request("DELETE", "/branding/logo"); setSaved({ ...saved, logoUrl: null }); setB({ ...b, logoUrl: null }); } finally { setBusy(false); }
  };
  const reset = () => setB({ ...saved, ...branding.DEFAULT_BRANDING, name: saved.name, slogan: saved.slogan, logoUrl: saved.logoUrl });

  const logo = (cls: string) => b.logoUrl ? <img alt="Logo" className={`${cls} object-cover`} src={b.logoUrl} /> : <span className={`${cls} flex items-center justify-center font-bold`} style={{ background: b.primary, color: b.background, fontFamily: b.fontHeading }}>{b.name.charAt(0).toUpperCase()}</span>;

  return (
    <main className="flex-1 flex flex-col h-full bg-marfil overflow-hidden">
      <div className="px-8 py-5 bg-white border-b border-arena-border shadow-xs shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1"><span>Configuración General</span><span>/</span><span className="font-semibold text-stone-800">Identidad y Marca</span></div>
            <h1 className="font-serif-brand text-2xl font-bold text-stone-900 tracking-tight">Identidad del Restaurante</h1>
          </div>
          <div className="flex items-center gap-3">
            {dirty
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"><span className="w-2 h-2 rounded-full bg-amber-500" />Cambios sin guardar</span>
              : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"><span className="w-2 h-2 rounded-full bg-emerald-600" />Cambios Guardados</span>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-xl border border-arena-border p-6 shadow-xs flex flex-col gap-6">
          <h3 className="font-serif-brand text-base font-semibold text-stone-900 pb-2 border-b border-arena-light">Identidad Visual y Marca</h3>
          <p className="text-[11px] text-stone-500 -mt-3">Se aplica al menú digital (QR) y al PDF impreso. CONVIVIUM solo aparece como “Powered by CONVIVIUM” al pie.</p>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-stone-700">Logotipo del Restaurante</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border border-arena-border overflow-hidden bg-stone-100 flex items-center justify-center shrink-0">{logo("w-full h-full text-2xl")}</div>
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <div className="flex flex-col items-start gap-1.5">
                  <button disabled={busy} onClick={() => file.current?.click()} className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium py-2 px-3 rounded-lg border border-arena-border transition-colors disabled:opacity-50">{busy ? "Subiendo…" : "Cambiar logotipo (PNG, JPG, WebP)"}</button>
                  {b.logoUrl && <button disabled={busy} onClick={removeLogo} className="text-[11px] text-terracota underline">Quitar logotipo</button>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-stone-700 mb-1">Nombre comercial</label><input value={b.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} className="w-full bg-stone-50 border border-arena-border rounded-lg text-xs px-3 py-2 text-stone-800" type="text" /></div>
              <div><label className="block text-xs font-semibold text-stone-700 mb-1">Eslogan / Tagline</label><input value={b.slogan} maxLength={90} onChange={(e) => set({ slogan: e.target.value })} className="w-full bg-stone-50 border border-arena-border rounded-lg text-xs px-3 py-2 text-stone-800" type="text" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLORS.map(([k, label]) => (
                <div key={k}><label className="block text-[11px] font-medium text-stone-600 mb-1">{label}</label>
                  <div className="flex items-center gap-1">
                    <input className="w-6 h-6 rounded border-0 cursor-pointer" type="color" value={HEX.test(b[k]) ? b[k] : "#000000"} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} />
                    <input className={`w-full bg-stone-50 border rounded text-[11px] px-1.5 py-1 font-mono ${HEX.test(b[k]) ? "border-arena-border" : "border-terracota"}`} type="text" value={b[k]} maxLength={7} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([["fontHeading", "Tipografía Títulos"], ["fontBody", "Tipografía Texto"]] as const).map(([k, label]) => (
                <div key={k}><label className="block text-xs font-semibold text-stone-700 mb-1">{label}</label>
                  <select value={b[k]} onChange={(e) => set({ [k]: e.target.value as Brand[typeof k] })} className="w-full bg-stone-50 border border-arena-border rounded-lg text-xs px-3 py-2 text-stone-800" style={{ fontFamily: b[k] }}>
                    {branding.BRAND_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              {!validColors ? <span className="inline-flex items-center gap-1 text-xs text-terracota font-medium bg-terracota/10 px-2 py-1 rounded border border-terracota/30">Usa colores en formato #RRGGBB</span>
                : contrastOk ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-200">✓ Contraste AA OK (Ratio {ratio.toFixed(1)}:1)</span>
                : <span className="inline-flex items-center gap-1 text-xs text-amber-800 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">⚠ Bajo contraste ({ratio.toFixed(1)}:1): el texto puede leerse mal sobre el fondo</span>}
            </div>
          </div>
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-terracota"}`}>{msg.text}</p>}
          <div className="mt-auto pt-4 border-t border-arena-light flex gap-3">
            <button onClick={reset} className="w-1/2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold py-2.5 rounded-lg border border-arena-border transition-colors">Restablecer</button>
            <button disabled={!dirty || !validColors || !b.name.trim() || busy} onClick={save} className="w-1/2 bg-olivo hover:bg-olivo-hover text-white text-xs font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-40">Guardar identidad</button>
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-arena-border p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-serif-brand text-base font-semibold text-stone-900 pb-2 border-b border-arena-light mb-4">Previsualización en Vivo</h3>
              <div className="border border-arena-border rounded-xl bg-marfil-canvas p-6 flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="w-48 bg-stone-900 rounded-3xl p-3 shadow-xl border-4 border-stone-800 shrink-0">
                  <div className="rounded-2xl p-4 flex flex-col items-center text-center space-y-2" style={{ background: b.background, color: b.text, fontFamily: b.fontBody }}>
                    <div className="w-12 h-12 rounded-full overflow-hidden border" style={{ borderColor: b.accent }}>{logo("w-full h-full text-lg")}</div>
                    <h4 className="font-bold text-xs uppercase tracking-[0.15em]" style={{ fontFamily: b.fontHeading, color: b.primary }}>{b.name || "Tu restaurante"}</h4>
                    {b.slogan && <p className="text-[9px] opacity-70">{b.slogan}</p>}
                    <div className="w-full rounded-lg p-2 text-left" style={{ background: b.primary, color: branding.contrastRatio(b.primary, b.background) >= 4.5 ? b.background : "#FFFFFF" }}>
                      <span className="block text-[7px] uppercase tracking-widest font-semibold" style={{ color: b.accent }}>Hoy · 17:00–19:00</span>
                      <span className="block text-[9px] font-semibold" style={{ fontFamily: b.fontHeading }}>Happy hour 2x1</span>
                    </div>
                    <div className="w-full rounded-lg bg-white/80 p-2 text-left">
                      <span className="block text-[9px] font-semibold" style={{ fontFamily: b.fontHeading }}>Platillo de la casa</span>
                      <span className="block text-[8px] font-semibold" style={{ color: b.primary }}>$245 MXN</span>
                    </div>
                    <div className="w-full pt-2 text-[8px] opacity-50" style={{ borderTop: `1px solid ${b.text}22` }}>Powered by CONVIVIUM</div>
                  </div>
                </div>
                <div className="w-52 bg-white shadow-lg border border-stone-200 px-5 py-6 flex flex-col items-center text-center gap-1.5" style={{ fontFamily: "Times New Roman, serif" }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden">{logo("w-full h-full text-sm")}</div>
                  <span className="text-sm uppercase tracking-[0.3em]" style={{ color: b.primary }}>{b.name || "Tu restaurante"}</span>
                  {b.slogan && <span className="text-[9px] italic text-stone-500">{b.slogan}</span>}
                  <span className="w-10 h-px my-1" style={{ background: b.accent }} />
                  <span className="text-[8px] font-bold tracking-widest self-start" style={{ color: b.primary }}>ENTRADAS</span>
                  <span className="w-full flex items-baseline gap-1 text-[8px]"><b>Platillo de la casa</b><span className="flex-1 border-b border-dotted border-stone-300" /><b style={{ color: b.primary }}>245</b></span>
                  <span className="mt-3 text-[6px] tracking-wider text-stone-400">Powered by CONVIVIUM</span>
                </div>
              </div>
              <p className="text-[11px] text-stone-500 mt-3">Izquierda: menú digital (QR). Derecha: encabezado del PDF impreso. <Link to="/generador-menu" className="text-olivo underline">Ir al generador de menú</Link></p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
