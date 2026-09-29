/* Diseño: design/stitch/admin-usuarios-permisos.html (Stitch). Marcado y clases originales; datos reales. E1-02, E1-05, E1-07. */
import { client } from "@convivium/app-shell";
import { DEFAULT_DISCOUNT_CAP, permissionsOf, ROLES, type Permission, type Role } from "@convivium/domain";
import { GROUPS, ROLE_LABEL } from "./labels";
import { useCallback, useEffect, useMemo, useState } from "react";

interface User { id: string; name: string; active: boolean; hasPin: boolean; roles: Role[] }
const ROLE_CHIP: Partial<Record<Role, string>> = { dueno: "bg-amber-100/70 text-amber-900", gerente: "bg-amber-100/70 text-amber-900", capitan: "bg-stone-200/80 text-stone-800", cocina: "bg-orange-100/60 text-convivium-terracota" };
const AVATAR: Partial<Record<Role, string>> = { dueno: "bg-convivium-olivo text-convivium-dorado", gerente: "bg-convivium-olivo text-convivium-dorado", capitan: "bg-[#3B2C24] text-amber-200", cocina: "bg-stone-800 text-convivium-dorado" };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const top = (roles: Role[]) => ROLES.find((r) => roles.includes(r)) ?? "mesero";


export function UsersPage() {
  const session = client.session!;
  const canRoles = session.permissions.includes("roles.gestionar");
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<User | "new" | null>(null);
  const [pinFor, setPinFor] = useState<User | null>(null);
  const [filter, setFilter] = useState("all");
  const load = useCallback(() => client.request<User[]>("GET", "/users").then(setUsers), []);
  useEffect(() => { load(); }, [load]);

  const [roleInfo, setRoleInfo] = useState<{ role: Role; effective: Permission[]; cap: number | null }[]>([]);
  useEffect(() => { client.request<typeof roleInfo>("GET", "/roles").then(setRoleInfo); }, []);
  const matrix = useMemo(() => Object.fromEntries(ROLES.map((r) => [r, new Set(roleInfo.find((x) => x.role === r)?.effective ?? permissionsOf([r]))])) as Record<Role, Set<Permission>>, [roleInfo]);
  const shown = users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  const groups = GROUPS.filter((g) => filter === "all" || g.key === filter);
  const total = GROUPS.reduce((n, g) => n + g.perms.length, 0);

  return (
    <main className="flex-1 p-6 lg:p-8 flex gap-6 overflow-hidden bg-[#F8F6F0] min-h-screen">
      <section className="w-80 xl:w-96 flex flex-col bg-white rounded-xl border border-convivium-arena shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-convivium-arena bg-[#FAF8F5]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-convivium-carbon">Personal</h2>
              <p className="text-xs text-stone-500 font-mono">{users.filter((u) => u.active).length} colaboradores activos</p>
            </div>
            <button onClick={() => setSel("new")} className="px-3 py-1.5 rounded-lg bg-convivium-olivo hover:bg-convivium-olivo-light text-convivium-dorado text-xs font-semibold flex items-center gap-1 shadow-sm transition">
              <span className="material-symbols-outlined text-[16px]">person_add</span><span>Nuevo</span>
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-stone-400 text-[18px]">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar colaborador…" className="w-full pl-9 pr-3 py-1.5 bg-white border border-convivium-arena rounded-lg text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-convivium-dorado focus:border-convivium-dorado transition" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2 space-y-1">
          {shown.map((u) => {
            const r = top(u.roles);
            const active = sel !== "new" && sel?.id === u.id;
            return (
              <div key={u.id} onClick={() => setSel(u)} className={`p-3 rounded-lg transition cursor-pointer ${active ? "bg-[#FAF8F4]/70 border border-convivium-dorado/30" : "hover:bg-stone-50 border border-transparent hover:border-convivium-arena/60"} ${u.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full font-serif font-bold text-sm flex items-center justify-center ${AVATAR[r] ?? "bg-stone-100 text-stone-700 border border-stone-200"}`}>{initials(u.name)}</div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${u.active ? "bg-emerald-500" : "bg-stone-300"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-stone-900 leading-tight">{u.name}</h3>
                        {u.id === session.user.id && <span className="px-1.5 py-0.2 rounded text-[9px] bg-convivium-dorado text-white font-mono uppercase tracking-wider font-semibold">Tú</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {u.roles.map((x) => <span key={x} className={`text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded font-mono ${ROLE_CHIP[x] ?? "bg-stone-100 text-stone-700"}`}>{ROLE_LABEL[x]}</span>)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-stone-400">{u.hasPin ? "key" : "lock"}</span>
                    <span>{u.hasPin ? "PIN: • • • •" : "Sin PIN"}</span>
                    <button onClick={(e) => { e.stopPropagation(); setPinFor(u); }} className="text-[10px] text-convivium-dorado hover:underline ml-1 font-sans font-medium">Cambiar</button>
                  </div>
                  <span className={`font-sans text-[11px] ${u.active ? "text-emerald-700 font-medium" : "text-stone-400"}`}>{u.active ? "Activo" : "Desactivado"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1">
        {sel && <UserEditor key={sel === "new" ? "new" : sel.id} user={sel === "new" ? null : sel} canRoles={canRoles} onClose={() => setSel(null)} onSaved={() => { setSel(null); load(); }} />}

        <div className="bg-white rounded-xl border border-convivium-arena shadow-sm overflow-hidden">
          <div className="p-5 border-b border-convivium-arena flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-white to-[#FBF9F5]">
            <div>
              <h2 className="font-serif text-xl font-bold text-convivium-carbon">Matriz de Facultades por Rol</h2>
              <p className="text-xs text-stone-500 mt-1 max-w-2xl">Cada rol hereda lo del rol que contiene: Dueño ⊇ Gerente ⊇ Capitán ⊇ Mesero, Cajero, Cocina, Barra y Almacén. Lo que un rol no tiene, se pide con PIN de quien sí lo tiene.</p>
            </div>
            <div className="flex items-center gap-3 bg-stone-50 px-3.5 py-2 rounded-lg border border-stone-200 text-xs">
              <span className="flex items-center gap-1 text-convivium-olivo font-medium"><span className="material-symbols-outlined text-[16px] text-emerald-700">check_circle</span>Permitido</span>
              <span className="text-stone-300">|</span>
              <span className="flex items-center gap-1 text-convivium-terracota font-medium"><span className="material-symbols-outlined text-[16px] text-convivium-terracota">lock</span>Requiere PIN superior</span>
            </div>
          </div>
          <div className="px-5 py-2.5 bg-[#FAF8F5] border-b border-convivium-arena flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-2 font-mono">Filtrar:</span>
              {[{ key: "all", label: `Todos (${total})` }, ...GROUPS.map((g) => ({ key: g.key, label: `${g.label} (${g.perms.length})` }))].map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? "px-2.5 py-1 rounded text-xs font-semibold bg-convivium-olivo text-white shadow-xs" : "px-2.5 py-1 rounded text-xs font-medium text-stone-600 hover:bg-stone-200/70 transition"}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-convivium-arena text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-72 sticky left-0 bg-stone-100/90 backdrop-blur z-10">Facultad / Operación</th>
                  {ROLES.map((r) => <th key={r} className={`py-3 px-2 text-center ${r === "dueno" || r === "gerente" ? "text-convivium-olivo font-bold" : "text-stone-700"}`}>{ROLE_LABEL[r]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-xs">
                {groups.flatMap((g) => g.perms).map(([p, label, icon]) => (
                  <tr key={p} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-stone-900 sticky left-0 bg-white border-r border-stone-100 min-w-[260px]">
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[17px] text-stone-400">{icon}</span><span>{label}</span></div>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className="text-center py-2">
                        {matrix[r].has(p) ? <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span> : <span className="material-symbols-outlined text-convivium-terracota/60 text-[18px]">lock</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-convivium-arena shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-convivium-dorado/5 blur-2xl pointer-events-none" />
          <div className="mb-5">
            <h3 className="font-serif text-lg font-bold text-convivium-carbon">Topes de Descuentos y Cortesías</h3>
            <p className="text-xs text-stone-500 mt-0.5">Por encima del tope, la operación genera una solicitud que resuelve un Capitán o Gerente.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["mesero", "capitan", "gerente"] as const).map((r) => {
              const info = roleInfo.find((x) => x.role === r);
              const cap = info ? info.cap : DEFAULT_DISCOUNT_CAP[r];
              const main = r === "capitan";
              return (
                <div key={r} className={main ? "p-4 rounded-lg bg-white border-2 border-convivium-dorado/50 shadow-sm flex flex-col justify-between relative" : "p-4 rounded-lg bg-[#FAF8F5] border border-stone-200 flex flex-col justify-between"}>
                  {main && <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-convivium-dorado text-white uppercase tracking-wider">Operación Diaria</span>}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">Rol: {ROLE_LABEL[r]}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${cap === null ? "bg-emerald-100 text-emerald-800" : cap === 0 ? "bg-stone-200 text-stone-600" : "bg-amber-100 text-amber-900"}`}>{cap === null ? "Plena" : cap === 0 ? "Candado 100%" : "Moderado"}</span>
                    </div>
                    <div className="space-y-2 mt-3 text-xs">
                      <div className="flex justify-between pb-1.5 border-b border-stone-200/60"><span className="text-stone-500">Tope de descuento:</span><span className="font-mono font-bold text-stone-800">{cap === null ? "Ilimitado (100%)" : cap === 0 ? "0% (Sin autonomía)" : `Hasta ${cap}%`}</span></div>
                      <div className="flex justify-between pb-1"><span className="text-stone-500">Mecanismo:</span><span className="font-semibold text-convivium-terracota">{cap === 0 ? "PIN Capitán/Gerente" : cap === null ? "Registro en bitácora" : "Arriba del tope: Gerente"}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {pinFor && <PinDialog user={pinFor} onClose={() => setPinFor(null)} onSaved={() => { setPinFor(null); load(); }} />}
    </main>
  );
}

function UserEditor({ user, canRoles, onClose, onSaved }: { user: User | null; canRoles: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? ["mesero"]);
  const [active, setActive] = useState(user?.active ?? true);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const locked = (r: Role) => !canRoles && (r === "dueno" || r === "gerente");
  const save = async () => {
    setErr("");
    try {
      if (user) await client.request("PUT", `/users/${user.id}`, { name, roles, active });
      else await client.request("POST", "/users", { name, roles, pin });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="bg-white rounded-xl border-2 border-convivium-dorado/50 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-convivium-carbon">{user ? `Editar a ${user.name}` : "Nuevo colaborador"}</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><span className="material-symbols-outlined">close</span></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <label><span className="block font-semibold text-stone-600 mb-1">Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-convivium-arena text-xs" /></label>
        {user ? (
          <label className="flex items-center gap-2.5 cursor-pointer select-none self-end pb-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded text-convivium-olivo" />
            <span className="text-stone-700">Usuario activo (puede iniciar sesión)</span>
          </label>
        ) : (
          <label><span className="block font-semibold text-stone-600 mb-1">PIN inicial (4 a 6 dígitos)</span><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" className="w-full rounded-lg border-convivium-arena text-xs font-mono" /></label>
        )}
      </div>
      <div>
        <span className="block text-xs font-semibold text-stone-600 mb-2">Roles en esta sucursal</span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <button key={r} disabled={locked(r)} title={locked(r) ? "Solo el Dueño puede asignar este rol" : undefined} onClick={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${on ? "bg-convivium-olivo text-convivium-dorado border-convivium-olivo" : "bg-white text-stone-600 border-convivium-arena hover:bg-stone-50"}`}>
                {locked(r) && <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">lock</span>}{ROLE_LABEL[r]}
              </button>
            );
          })}
        </div>
      </div>
      {err && <p className="text-xs text-convivium-terracota">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 rounded-lg border border-convivium-arena text-xs">Cancelar</button>
        <button disabled={name.trim().length < 2 || !roles.length || (!user && pin.length < 4)} onClick={save} className="px-4 py-2 rounded-lg bg-convivium-olivo text-convivium-dorado text-xs font-semibold disabled:opacity-50">Guardar</button>
      </div>
    </div>
  );
}

function PinDialog({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-bold text-convivium-carbon">Nuevo PIN · {user.name}</h3>
        <input autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" placeholder="4 a 6 dígitos" className="w-full rounded-lg border-convivium-arena font-mono text-center text-lg tracking-[0.4em]" />
        {err && <p className="text-xs text-convivium-terracota">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-convivium-arena text-xs">Cancelar</button>
          <button disabled={pin.length < 4} onClick={() => client.request("POST", `/users/${user.id}/pin`, { pin }).then(onSaved, (e) => setErr((e as Error).message))} className="px-4 py-2 rounded-lg bg-convivium-olivo text-convivium-dorado text-xs font-semibold disabled:opacity-50">Guardar PIN</button>
        </div>
      </div>
    </div>
  );
}
