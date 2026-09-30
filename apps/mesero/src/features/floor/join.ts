import type { FloorPlan } from "@convivium/api-client";

type Table = FloorPlan["tables"][number];

/**
 * Mesas que se pueden unir a `main` para un grupo grande (E3-10).
 * - sugeridas: libres y conectadas en el plano como unibles, también en cadena (M5 → M6 → M7).
 * - otras: el resto de mesas libres de la misma área (en la vida real se juntan las que estén cerca).
 * `taken` son las mesas que ya forman parte del grupo (se omiten).
 */
export function joinCandidates(tables: Table[], main: Table, taken: string[] = []) {
  const free = new Map(tables.filter((t) => t.areaId === main.areaId && t.status === "libre" && t.id !== main.id && !taken.includes(t.id)).map((t) => [t.id, t]));
  const suggested: Table[] = [];
  const seen = new Set<string>([main.id, ...taken]);
  const queue = [main.id, ...taken];
  while (queue.length) {
    const cur = tables.find((t) => t.id === queue.shift());
    for (const id of cur?.mergeableWith ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = free.get(id);
      if (t) { suggested.push(t); queue.push(id); }
    }
  }
  const byLabel = (a: Table, b: Table) => a.label.localeCompare(b.label, "es", { numeric: true });
  const others = [...free.values()].filter((t) => !suggested.includes(t)).sort(byLabel);
  return { suggested: suggested.sort(byLabel), others };
}
