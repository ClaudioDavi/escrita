// The features the writer can turn off (SF 10, 0.7 plan Q9-Q11). Pure data and
// functions, no Obsidian imports. The registry (feature-registry.ts) acts on them.

export const FEATURE_IDS = [
  "goals", "outline", "placeholders", "explorerCounts", "darlings", "typing", "dialogueFocus",
  "moveBlocks", "templates", "spellcheck", "lens", "snapshots", "stageSnapshot", "publish",
  "export", "submissions", "desk", "universe", "threads",
] as const;   // also the load order: today's (main.ts:116-127), Q12; unload runs in reverse
// 0.8 (PLAN-0.8 Q11): "export" and "submissions" follow "publish" (19 ids); their modules arrive in Wave 3,
// until then the registry finds no module for them and loads nothing.
export type FeatureId = typeof FEATURE_IDS[number];
export type FeatureGroup = "writing" | "revision" | "desk" | "publishing" | "world";

export interface FeatureSpec {
  id: FeatureId;
  group: FeatureGroup;
  requires?: readonly FeatureId[];               // stageSnapshot: ["snapshots"]
  /** where the switch lives: the `features` record (default), or an existing setting (Q10) */
  switch?: "explorerCounts" | "spellcheckOnDemand" | "universeMode";
  /**
   * Position of the switch on the Features page within its group, ascending
   * (IMPROVEMENTS 20). The page shows the groups in a fixed order and, inside a
   * group, the switches by `page`; FEATURE_PAGE below is derived from it.
   * Set on every spec (task 1.9); optional in the type only to keep the contract.
   */
  page?: number;
}

export const FEATURE_SPECS: readonly FeatureSpec[] = [
  { id: "goals", group: "writing", page: 1 },
  { id: "outline", group: "writing", page: 2 },
  { id: "placeholders", group: "writing", page: 3 },
  { id: "explorerCounts", group: "writing", switch: "explorerCounts", page: 9 },
  { id: "darlings", group: "revision", page: 3 },
  { id: "typing", group: "writing", page: 4 },
  { id: "dialogueFocus", group: "writing", page: 5 },
  { id: "moveBlocks", group: "writing", page: 6 },
  { id: "templates", group: "writing", page: 7 },
  { id: "spellcheck", group: "writing", switch: "spellcheckOnDemand", page: 8 },
  { id: "lens", group: "revision", page: 1 },
  { id: "snapshots", group: "revision", page: 2 },
  { id: "stageSnapshot", group: "desk", requires: ["snapshots"], page: 1 },
  { id: "publish", group: "publishing", page: 1 },
  { id: "export", group: "publishing", page: 2 },
  { id: "submissions", group: "publishing", page: 3 },
  { id: "desk", group: "desk", page: 2 },
  { id: "universe", group: "world", switch: "universeMode", page: 1 },
  { id: "threads", group: "world", page: 2 },
];

export interface FeatureSwitches {
  features: Partial<Record<FeatureId, boolean>>;
  explorerCounts: boolean;
  spellcheckOnDemand: boolean;
  universeMode: "off" | "perBook" | "universe";
}

/** The writer's switch alone (missing key = on). */
export function switchedOn(id: FeatureId, s: FeatureSwitches): boolean {
  switch (FEATURE_SPECS.find((f) => f.id === id)?.switch) {
    case "explorerCounts": return s.explorerCounts;
    case "spellcheckOnDemand": return s.spellcheckOnDemand;
    case "universeMode": return s.universeMode !== "off";
    default: return s.features[id] !== false;
  }
}

/** Switched on and every requirement on (closure). */
export function wanted(s: FeatureSwitches): Set<FeatureId> {
  // `requires` is one level deep today, but the closure is computed to a fixed point.
  const on = new Set<FeatureId>(FEATURE_IDS.filter((id) => switchedOn(id, s)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const spec of FEATURE_SPECS) {
      if (on.has(spec.id) && spec.requires?.some((r) => !on.has(r))) {
        on.delete(spec.id);
        changed = true;
      }
    }
  }
  return on;
}

/** What to unload (reverse order) and load (FEATURE_IDS order) to go from loaded to want. */
export function planApply(
  loaded: ReadonlySet<FeatureId>,
  want: ReadonlySet<FeatureId>,
): { unload: FeatureId[]; load: FeatureId[] } {
  return {
    unload: FEATURE_IDS.filter((id) => loaded.has(id) && !want.has(id)).reverse(),
    load: FEATURE_IDS.filter((id) => want.has(id) && !loaded.has(id)),
  };
}

/** Saved `features` (any shape) → a clean record: unknown ids and non-booleans dropped. */
export function cleanFeatures(raw: unknown): Partial<Record<FeatureId, boolean>> {
  const out: Partial<Record<FeatureId, boolean>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const id of FEATURE_IDS) {
    if (Object.prototype.hasOwnProperty.call(src, id) && typeof src[id] === "boolean") out[id] = src[id] as boolean;
  }
  return out;
}

/** The groups in the order the Features page shows them. */
export const FEATURE_GROUPS: readonly FeatureGroup[] = ["writing", "revision", "desk", "publishing", "world"];

/** The Features page: the groups in fixed order, inside each the switches by `page` (ties by load order). */
export const FEATURE_PAGE: readonly { group: FeatureGroup; ids: readonly FeatureId[] }[] = FEATURE_GROUPS.map((group) => ({
  group,
  ids: FEATURE_SPECS
    .map((spec, i) => ({ spec, i }))
    .filter(({ spec }) => spec.group === group)
    .sort((a, b) => (a.spec.page ?? Infinity) - (b.spec.page ?? Infinity) || a.i - b.i)
    .map(({ spec }) => spec.id),
}));
