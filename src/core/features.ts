// The features the writer can turn off (SF 10, 0.7 plan Q9-Q11). Pure data and
// functions, no Obsidian imports. The registry (feature-registry.ts) acts on them.

export const FEATURE_IDS = [
  "goals", "outline", "placeholders", "explorerCounts", "darlings", "typing", "dialogueFocus",
  "moveBlocks", "templates", "spellcheck", "lens", "snapshots", "stageSnapshot", "publish",
  "desk", "universe", "threads",
] as const;   // also the load order: today's (main.ts:116-127), Q12; unload runs in reverse
// 0.8 (PLAN-0.8 Q11): task 1.9 adds "export" and "submissions" right after "publish",
// both in the "publishing" group, making 19. Not added in the Wave 0 contracts: the
// registry would look for modules that don't exist yet and the 17-feature tests would break.
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
   * group, the switches by `page`; settings.ts's FEATURE_PAGE is derived from it.
   * Optional until task 1.9 sets it on every spec.
   */
  page?: number;
}

export const FEATURE_SPECS: readonly FeatureSpec[] = [
  { id: "goals", group: "writing" },
  { id: "outline", group: "writing" },
  { id: "placeholders", group: "writing" },
  { id: "explorerCounts", group: "writing", switch: "explorerCounts" },
  { id: "darlings", group: "revision" },
  { id: "typing", group: "writing" },
  { id: "dialogueFocus", group: "writing" },
  { id: "moveBlocks", group: "writing" },
  { id: "templates", group: "writing" },
  { id: "spellcheck", group: "writing", switch: "spellcheckOnDemand" },
  { id: "lens", group: "revision" },
  { id: "snapshots", group: "revision" },
  { id: "stageSnapshot", group: "desk", requires: ["snapshots"] },
  { id: "publish", group: "publishing" },
  { id: "desk", group: "desk" },
  { id: "universe", group: "world", switch: "universeMode" },
  { id: "threads", group: "world" },
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
