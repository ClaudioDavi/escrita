// The features the writer can turn off (SF 10, 0.7 plan Q9-Q11). Pure data and
// stubs (no Obsidian imports); task 1.1 fills the stubs.

export const FEATURE_IDS = [
  "goals", "outline", "placeholders", "explorerCounts", "darlings", "typing", "dialogueFocus",
  "moveBlocks", "templates", "spellcheck", "lens", "snapshots", "stageSnapshot", "publish",
  "desk", "universe", "threads",
] as const;   // also the load order: today's (main.ts:116-127), Q12; unload runs in reverse
export type FeatureId = typeof FEATURE_IDS[number];
export type FeatureGroup = "writing" | "revision" | "desk" | "publishing" | "world";

export interface FeatureSpec {
  id: FeatureId;
  group: FeatureGroup;
  requires?: readonly FeatureId[];               // stageSnapshot: ["snapshots"]
  /** where the switch lives: the `features` record (default), or an existing setting (Q10) */
  switch?: "explorerCounts" | "spellcheckOnDemand" | "universeMode";
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
  throw new Error("todo");
}

/** Switched on and every requirement on (closure). */
export function wanted(s: FeatureSwitches): Set<FeatureId> {
  throw new Error("todo");
}

/** What to unload (reverse order) and load (FEATURE_IDS order) to go from loaded to want. */
export function planApply(
  loaded: ReadonlySet<FeatureId>,
  want: ReadonlySet<FeatureId>,
): { unload: FeatureId[]; load: FeatureId[] } {
  throw new Error("todo");
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
