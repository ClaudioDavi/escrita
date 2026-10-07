// Feature presets (1.0, SF 10; PLAN-1.0 Q6, Q7, boards 36 and 38): three starting
// points for the Features page and the setup. Pure, no Obsidian imports. Not to be
// confused with core/presets.ts, the manuscript presets of the export.
//
// A preset is a starting point, never a mode: nothing records which preset was picked.
// The Features page's label ("Essentials", "Writer", "Everything" or "Custom") is
// `matchingPreset` of the live switches, computed each time it draws.
//
// The universe never changes through a preset (board 38): its "switch" is the universe
// mode (`universeMode`), which moves folders and is the writer's separate choice (in the
// setup, the "Shared world" row shown with Everything; on the settings page, the
// Universe section). So no list below holds "universe", `presetSwitches` keeps
// `universeMode` as it is, `presetChanges` never lists it and `matchingPreset` ignores
// it. Everything is "19 of 19" on the boards because the universe is counted there as
// available, not as switched.
//
import { FEATURE_IDS, FEATURE_SPECS, switchedOn, type FeatureId, type FeatureSwitches } from "./features";

export const PRESET_IDS = ["essentials", "writer", "everything"] as const;
export type PresetId = typeof PRESET_IDS[number];

const ESSENTIALS: readonly FeatureId[] = [
  "goals", "outline", "placeholders", "typing", "lens", "darlings", "snapshots", "export", "desk",
];
const WRITER: readonly FeatureId[] = [
  ...ESSENTIALS, "dialogueFocus", "moveBlocks", "templates", "explorerCounts", "stageSnapshot", "publish", "submissions",
];

/**
 * What each preset switches on (board 38, rebalanced by the author on 2026-10-07: the lens
 * and export are essentials). Every id not in a list is switched off by that preset,
 * "universe" aside (never in a list, never touched). Each list is closed under `requires`
 * (stageSnapshot needs snapshots, which every preset holds). Essentials 9, Writer 16,
 * Everything 18 here (19 with the universe, as the boards count). A fresh install with no
 * setup run starts on Writer (Q7, task 1.4); an existing install keeps its switches (Q6).
 */
export const PRESETS: Readonly<Record<PresetId, readonly FeatureId[]>> = Object.freeze({
  essentials: Object.freeze([...ESSENTIALS]),
  writer: Object.freeze([...WRITER]),
  everything: Object.freeze(FEATURE_IDS.filter((id) => id !== "universe")),
});

/** The one feature no preset touches (see the file comment). */
export const PRESET_IGNORED: FeatureId = "universe";

/**
 * The switches after applying preset `id` to `current`: a new object, `current` untouched.
 * Every feature whose switch lives in the `features` record gets an explicit boolean
 * (on when in the list, off otherwise), so data.json says what the preset chose; a
 * feature added after 1.0 has no key and starts on (missing = on). `explorerCounts`
 * and `spellcheckOnDemand` take the list's value; `universeMode` is copied from
 * `current`. Requirements need no pulling here: the lists are closed under `requires`.
 * The caller writes the result into the settings (one save, then `features.apply()`).
 */
export function presetSwitches(id: PresetId, current: FeatureSwitches): FeatureSwitches {
  const list = PRESETS[id];
  const features = { ...current.features };
  const out: FeatureSwitches = { ...current, features };
  for (const spec of FEATURE_SPECS) {
    if (spec.id === PRESET_IGNORED) continue;
    const on = list.includes(spec.id);
    if (spec.switch === "explorerCounts") out.explorerCounts = on;
    else if (spec.switch === "spellcheckOnDemand") out.spellcheckOnDemand = on;
    else if (!spec.switch) features[spec.id] = on;
  }
  return out;
}

/**
 * The preset the switches match, or null ("Custom"). Compares each feature's own switch
 * (`switchedOn`, not the closure `wanted`) with the list, for every feature but the
 * universe: a match needs the same on/off on all 18. At most one preset matches (the
 * lists differ). A 0.9 install with every switch on matches "everything"; a 0.9 install
 * on its defaults (spellcheck on demand is off by default) matches none and reads
 * "Custom", never an automatic change (board 38).
 */
export function matchingPreset(switches: FeatureSwitches): PresetId | null {
  for (const id of PRESET_IDS) {
    const list = PRESETS[id];
    if (FEATURE_IDS.every((f) => f === PRESET_IGNORED || switchedOn(f, switches) === list.includes(f))) return id;
  }
  return null;
}

/**
 * What applying preset `id` would change, for the confirm step (board 38) and the
 * setup's features row: `off` the features switched on now that the preset leaves out,
 * `on` the features switched off now that the preset turns on, both in FEATURE_IDS order
 * (the Features page sorts them for display). Compared switch by switch (`switchedOn`),
 * so a feature whose switch is on but whose requirement is off is not listed as turned
 * on; its requirement is (stageSnapshot on with snapshots off: Writer lists `snapshots`
 * in `on`, the requirement pulled in). Never lists "universe". Both empty: the switches
 * already match, and the page says "Already on <preset>. Nothing changes."
 */
export function presetChanges(current: FeatureSwitches, id: PresetId): { off: FeatureId[]; on: FeatureId[] } {
  const list = PRESETS[id];
  const ids = FEATURE_IDS.filter((f) => f !== PRESET_IGNORED);
  return {
    off: ids.filter((f) => switchedOn(f, current) && !list.includes(f)),
    on: ids.filter((f) => !switchedOn(f, current) && list.includes(f)),
  };
}
