/* Diseño: design/stitch/admin-roles-editor.html (Stitch). Marcado y clases originales; datos reales. E1-05, E1-07, E1-08. */
import { client } from "@convivium/app-shell";
import { LOCKED_OWNER, PERMISSIONS, type Permission, type Role } from "@convivium/domain";
import { useCallback, useEffect, useState } from "react";
import { PERM_LABEL, ROLE_LABEL } from "./labels";

interface RoleInfo { role: Role; children: Role[]; inherited: Permission[]; own: Permission[]; grant: Permission[]; deny: Permission[]; effective: Permission[]; cap: number | null; users: number }
interface User { id: string; name: string; active: boolean; roles: Role[] }
const DESC: Record<Role, string> = {
  dueno: "Acceso absoluto e irrestricto", gerente: "Operación total, cortes y cancelaciones", capitan: "Supervisión de salón y autorizaciones",
  mesero: "Comandas, servicio y adiciones", cajero: "Fondo, cobro y Corte X", almacenista: "Recepción, conteos y mermas", cocina: "KDS de cocina", barra: "KDS de barra",
};
const ICON: Partial<Record<Role, string>> = { cajero: "point_of_sale", almacenista: "inventory", cocina: "soup_kitchen", barra: "local_bar" };

export function RolesPage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sel, setSel] = useState<Role>("capitan");
  const load = useCallback(() => client.request<RoleInfo[]>("GET", "/roles").then(setRoles), []);
  useEffect(() => { load(); client.request<User[]>("GET", "/users").then(setUsers); }, [load]);
  const info = roles.find((r) => r.role === sel);
  const n = (r: Role) => roles.find((x) => x.role === r)?.users ?? 0;

  const Card = ({ role, idx }: { role: Role; idx: number }) => (
    <div onClick={() => setSel(role)} className={sel === role ? "p-2.5 rounded-lg bg-[#1E2F28] text-[#EAE6DD] shadow-md border-l-4 border-[#D4AF7C] cursor-pointer" : "p-2.5 rounded-lg border border-[#C9B89F]/40 bg-white/90 hover:border-[#1E2F28]/40 transition-colors cursor-pointer group"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${sel === role ? "bg-[#D4AF7C] text-[#1E2F28]" : idx === 1 ? "bg-[#1E2F28] text-[#D4AF7C]" : "bg-[#1E2F28]/15 text-[#1E2F28]"}`}>{idx}</span>
          <div>
            <div className={`font-semibold flex items-center gap-1.5 ${sel === role ? "text-white" : "text-[#1E2F28] group-hover:text-[#B45A3C] transition-colors"}`}>
              <span>{ROLE_LABEL[role]}</span>{role === "dueno" && <span className="material-symbols-outlined text-[13px] text-[#D4AF7C]">star</span>}
            </div>
            <span className={`text-[10px] ${sel === role ? "text-[#EAE6DD]/70" : "text-[#1A1A1A]/55"}`}>{DESC[role]}</span>
          </div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${sel === role ? "bg-[#D4AF7C] text-[#1E2F28] font-bold" : "bg-[#C9B89F]/20 text-[#1E2F28]"}`}>{n(role)} {n(role) === 1 ? "persona" : "personas"}</span>
      </div>
    </div>
  );
  const Parallel = ({ role }: { role: Role }) => (
    <div onClick={() => setSel(role)} className={sel === role ? "p-2 rounded-lg bg-[#1E2F28] text-white cursor-pointer" : "p-2 rounded-lg border border-[#C9B89F]/40 bg-white/80 hover:border-[#1E2F28]/40 transition-colors cursor-pointer"}>
      <div className="flex items-center gap-1.5">
        <span className={`material-symbols-outlined text-sm ${sel === role ? "text-[#D4AF7C]" : "text-[#1E2F28]"}`}>{ICON[role]}</span>
        <span className={`font-medium text-xs ${sel === role ? "text-white" : "text-[#1E2F28]"}`}>{ROLE_LABEL[role]}</span>
      </div>
      <span className={`text-[9px] block mt-0.5 ${sel === role ? "text-[#EAE6DD]/70" : "text-[#1A1A1A]/50"}`}>{DESC[role]} · {n(role)}</span>
    </div>
  );
  const Line = () => <div className="w-0.5 h-3 bg-[#C9B89F]/60 ml-5 -my-1.5" />;

  return (
    <main className="flex-1 overflow-y-auto p-5 grid grid-cols-12 gap-5 bg-[#EAE6DD]/70 min-h-screen content-start">
      <section className="col-span-12 xl:col-span-3 flex flex-col bg-white/70 backdrop-blur-sm rounded-xl border border-[#C9B89F]/60 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#C9B89F]/30">
          <div>
            <h2 className="font-headline font-semibold text-base text-[#1E2F28] flex items-center gap-2"><span>Jerarquía de Roles</span><span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-[#D4AF7C]/20 text-[#1E2F28] border border-[#D4AF7C]/40 font-semibold">{roles.length} Roles</span></h2>
            <p className="text-[11px] text-[#1A1A1A]/60 mt-0.5">Estructura operativa de personal</p>
          </div>
          <span className="material-symbols-outlined text-[#C9B89F]">account_tree</span>
        </div>
        <div className="my-3 p-3 rounded-lg bg-[#1E2F28]/5 border border-[#1E2F28]/15 text-xs text-[#1E2F28]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[#D4AF7C] shrink-0 mt-0.5">vertical_align_bottom</span>
            <div>
              <span className="font-semibold text-[11px] uppercase tracking-wider text-[#1E2F28] block mb-0.5">Herencia vertical activa</span>
              <p className="text-[11px] text-[#1A1A1A]/75 leading-relaxed">Un rol superior hereda automáticamente todos los permisos del rol inferior.</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 py-1 text-xs">
          <Card role="dueno" idx={1} /><Line /><Card role="gerente" idx={2} /><Line /><Card role="capitan" idx={3} />
          <div className="pl-4 border-l-2 border-[#D4AF7C] ml-2"><Card role="mesero" idx={4} /></div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#1A1A1A]/40">Roles Operativos Paralelos</span>
            <div className="flex-1 h-px bg-[#C9B89F]/40" />
          </div>
          <div className="grid grid-cols-2 gap-2">{(["cajero", "almacenista", "cocina", "barra"] as const).map((r) => <Parallel key={r} role={r} />)}</div>
        </div>
      </section>

      {info && <RoleEditor key={info.role + info.grant.join() + info.deny.join() + info.cap} info={info} onSaved={load} />}

      <section className="col-span-12 xl:col-span-4 flex flex-col bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-sm">
        <div className="pb-3 border-b border-[#C9B89F]/30">
          <h3 className="font-headline font-semibold text-base text-[#1E2F28]">Personal con este rol</h3>
          <p className="text-[11px] text-[#1A1A1A]/60 mt-0.5">Un colaborador suma las facultades de todos sus roles. Asígnalos en Usuarios.</p>
        </div>
        <div className="py-3 space-y-2 text-xs">
          {users.filter((u) => u.roles.includes(sel)).map((u) => (
            <div key={u.id} className={`flex items-center justify-between p-2.5 rounded-lg border border-[#C9B89F]/35 ${u.active ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1E2F28] text-[#D4AF7C] font-headline font-bold text-xs flex items-center justify-center">{u.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                <span className="font-medium text-[#1E2F28]">{u.name}</span>
              </div>
              <div className="flex flex-wrap gap-1 justify-end">{u.roles.map((r) => <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${r === sel ? "bg-[#D4AF7C]/30 text-[#1E2F28] font-semibold" : "bg-[#EAE6DD] text-[#1A1A1A]/70"}`}>{ROLE_LABEL[r]}</span>)}</div>
            </div>
          ))}
          {!users.some((u) => u.roles.includes(sel)) && <p className="text-[#1A1A1A]/50 italic">Nadie tiene este rol en la sucursal.</p>}
        </div>
      </section>
    </main>
  );
}

function RoleEditor({ info, onSaved }: { info: RoleInfo; onSaved: () => void }) {
  const inherited = new Set(info.inherited);
  const base = new Set([...info.own, ...inherited]);
  // Estado deseado de cada permiso no heredado-inmutable: activo o no.
  const initial = new Set(info.effective);
  const [on, setOn] = useState(initial);
  const [cap, setCap] = useState<number | null>(info.cap);
  const [err, setErr] = useState("");
  const candidates = PERMISSIONS.filter((p) => PERM_LABEL[p]);
  const grants = candidates.filter((p) => on.has(p) && !base.has(p));
  const denies = candidates.filter((p) => !on.has(p) && base.has(p));
  const dirty = grants.join() !== info.grant.filter((p) => !base.has(p)).join() || denies.join() !== info.deny.join() || cap !== info.cap;
  const locked = (p: Permission) => info.role === "dueno" && LOCKED_OWNER.includes(p);
  const toggle = (p: Permission) => { const s = new Set(on); s.has(p) ? s.delete(p) : s.add(p); setOn(s); };
  const save = () => client.request("PUT", `/roles/${info.role}`, { grant: grants, deny: denies, cap }).then(onSaved, (e) => setErr((e as Error).message));
  const reset = () => client.request("DELETE", `/roles/${info.role}`).then(onSaved);
  const inheritedFrom = info.children.map((c) => ROLE_LABEL[c]).join(", ");

  return (
    <section className="col-span-12 xl:col-span-5 flex flex-col bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-sm overflow-hidden">
      <div className="pb-4 border-b border-[#C9B89F]/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] bg-[#D4AF7C]/25 text-[#1E2F28] font-semibold px-2.5 py-0.5 rounded-full border border-[#D4AF7C]/40">{info.grant.length || info.deny.length ? "Personalizado" : "Configuración base"}{inheritedFrom && ` · Hereda de: ${inheritedFrom}`}</span>
        </div>
        <h2 className="font-headline text-xl font-bold text-[#1E2F28]">{ROLE_LABEL[info.role]}</h2>
        <p className="text-xs text-[#1A1A1A]/70 mt-1.5">{DESC[info.role]}. Los cambios aplican a toda la empresa y se registran en la bitácora.</p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
        {inherited.size > 0 && (
          <div className="rounded-lg bg-[#EAE6DD]/40 border border-[#C9B89F]/40 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#1E2F28] text-base">lock</span><h3 className="text-xs font-semibold text-[#1E2F28] uppercase tracking-wider">Permisos Heredados ({inheritedFrom})</h3></div>
              <span className="text-[10px] text-[#1A1A1A]/50 bg-white/60 px-2 py-0.5 rounded border border-[#C9B89F]/40">Se editan en su rol</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[...inherited].filter((p) => PERM_LABEL[p]).map((p) => (
                <div key={p} className={`flex items-center gap-2 p-2 rounded border border-[#C9B89F]/25 ${on.has(p) ? "bg-white/70 text-[#1A1A1A]/80" : "bg-[#B45A3C]/5 text-[#1A1A1A]/50 line-through"}`} title={`Heredado de ${inheritedFrom}`}>
                  <span className={`material-symbols-outlined text-[15px] ${on.has(p) ? "text-emerald-700" : "text-[#B45A3C]"}`}>{on.has(p) ? "check_circle" : "block"}</span>
                  <span className="truncate flex-1">{PERM_LABEL[p].label}</span>
                  <button onClick={() => toggle(p)} className="text-[10px] text-[#B45A3C] hover:underline no-underline shrink-0" style={{ textDecoration: "none" }}>{on.has(p) ? "Negar" : "Restaurar"}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#1E2F28] uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[#D4AF7C] text-base">toggle_on</span><span>Permisos Propios y Adicionales</span></h3>
            <span className="text-[11px] text-[#B45A3C] font-medium">{grants.length} adicionales · {denies.length} denegados</span>
          </div>
          <div className="space-y-2 text-xs">
            {candidates.filter((p) => !inherited.has(p)).map((p) => {
              const active = on.has(p);
              const extra = active && !base.has(p);
              const removed = !active && base.has(p);
              return (
                <div key={p} className={`flex items-center justify-between p-2.5 rounded-lg border border-[#C9B89F]/35 transition-colors ${active ? "hover:bg-[#EAE6DD]/20" : "bg-[#EAE6DD]/20 opacity-80"}`}>
                  <div className="pr-3">
                    <span className="font-medium text-[#1E2F28] flex items-center gap-1.5">
                      <span>{PERM_LABEL[p].label}</span>
                      {extra && <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-1.5 py-0.2 rounded">Adicional</span>}
                      {removed && <span className="text-[10px] text-[#B45A3C] font-semibold bg-[#B45A3C]/10 px-1.5 py-0.2 rounded">Denegado</span>}
                    </span>
                    <span className="text-[11px] text-[#1A1A1A]/60">{PERM_LABEL[p].group}{locked(p) ? " · El Dueño siempre lo conserva" : !active ? " · Se pedirá PIN de un rol que lo tenga" : ""}</span>
                  </div>
                  <button disabled={locked(p)} onClick={() => toggle(p)} className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-colors shrink-0 disabled:opacity-50 ${active ? "bg-[#1E2F28]" : "bg-[#C9B89F]/60"}`} type="button">
                    {active ? <span className="w-5 h-5 bg-[#D4AF7C] rounded-full shadow-sm transform translate-x-4 transition-transform flex items-center justify-center"><span className="w-1.5 h-1.5 bg-[#1E2F28] rounded-full" /></span> : <span className="w-5 h-5 bg-white rounded-full shadow-sm transform translate-x-0 transition-transform" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 rounded-lg border border-[#C9B89F]/50 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#1E2F28] uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[#D4AF7C] text-base">payments</span><span>Tope de Descuento Autónomo</span></h3>
            <label className="flex items-center gap-1.5 text-[11px] text-[#1A1A1A]/70"><input type="checkbox" checked={cap === null} onChange={(e) => setCap(e.target.checked ? null : 0)} className="rounded text-[#1E2F28]" />Ilimitado</label>
          </div>
          {cap !== null && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#1A1A1A]/80 font-medium">Límite de descuento autónomo:</span>
                <span className="font-bold text-[#1E2F28] font-mono bg-[#EAE6DD] px-2 py-0.5 rounded border border-[#C9B89F]/40">{cap}%{cap === 0 && " (Sin permiso)"}</span>
              </div>
              <input className="w-full accent-[#1E2F28] h-1.5 bg-[#C9B89F]/30 rounded-lg cursor-pointer" max="100" min="0" step="5" type="range" value={cap} onChange={(e) => setCap(Number(e.target.value))} />
              <div className="flex justify-between text-[10px] text-[#1A1A1A]/50"><span>0% (Sin permiso)</span><span>50%</span><span>100%</span></div>
              <p className="text-[11px] text-[#1A1A1A]/60">Por encima de este tope, la cuenta genera una solicitud de autorización.</p>
            </div>
          )}
        </div>
      </div>
      {err && <p className="text-xs text-[#B45A3C] pb-2">{err}</p>}
      <div className="pt-4 border-t border-[#C9B89F]/30 flex items-center justify-between gap-2">
        <button onClick={reset} className="text-xs text-[#1E2F28] font-semibold hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">restart_alt</span>Restaurar a {ROLE_LABEL[info.role]} original</button>
        <div className="flex gap-2">
          <button disabled={!dirty} onClick={() => { setOn(initial); setCap(info.cap); }} className="px-3 py-2 rounded-lg border border-[#C9B89F] text-xs font-medium text-[#1E2F28] disabled:opacity-40">Descartar</button>
          <button disabled={!dirty} onClick={save} className="px-4 py-2 rounded-lg bg-[#1E2F28] text-[#D4AF7C] text-xs font-semibold shadow-sm disabled:opacity-40">Aplicar al Rol</button>
        </div>
      </div>
    </section>
  );
}
