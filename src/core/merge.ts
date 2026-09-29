// Merging saved settings over defaults (no Obsidian imports).
// Old or hand-edited data.json can hold missing keys, nulls or values of the
// wrong type; each of those falls back to the default so the rest of the
// plugin can trust the types. Unknown keys are kept (a newer version's
// settings survive a downgrade).

export function mergeDefaults<T extends object>(defaults: T, raw: unknown): T {
  const out = { ...defaults } as Record<string, unknown>;
  const def = defaults as Record<string, unknown>;
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(src)) {
    if (!(k in def)) { out[k] = v; continue; }
    const d = def[k];
    if (Array.isArray(d)) { if (Array.isArray(v)) out[k] = [...v]; continue; }
    if (typeof d === "number") { if (typeof v === "number" && Number.isFinite(v)) out[k] = v; continue; }
    if (v !== null && v !== undefined && typeof v === typeof d) out[k] = v;
  }
  // Never share the defaults' arrays with the live settings.
  for (const [k, d] of Object.entries(def)) if (Array.isArray(d) && out[k] === d) out[k] = [...d];
  return out as T;
}

/** Weekday numbers 0 (Sunday) … 6 (Saturday), deduplicated and sorted; anything else dropped. */
export function cleanWeekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const set = new Set<number>();
  for (const x of v) {
    const n = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
