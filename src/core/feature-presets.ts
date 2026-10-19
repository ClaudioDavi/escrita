// Feature presets (1.0, SF 10; PLAN-1.0 Q6, Q7, boards 36 and 38): four starting
// points for the Features page and the setup. Pure, no Obsidian imports. Not to be
// confused with core/presets.ts, the manuscript presets of the export.
//
// A preset is a starting point, never a mode: nothing records which preset was picked.
// The Features page's label ("Essentials", "Writer", "Screenwriter", "Everything" or "Custom") is
// `matchingPreset` of the live switches, computed each time it draws.
//
// The universe never changes through a preset (board 38): its "switch" is the universe
// mode (`universeMode`), which moves folders and is the writer's separate choice (in the
// setup, the "Shared world" row shown with Everything; on the settings page, the
// Universe section). So no list below holds "universe", `presetSwitches` keeps
// `universeMode` as it is, `presetChanges` never lists it and `matchingPreset` ignores
// it. Everything is "20 of 20" in the setup (1.2) because the universe is counted there as
// available, not as switched.
//
import { FEATURE_IDS, FEATURE_SPECS, OFF_WHEN_MISSING, switchedOn, type FeatureId, type FeatureSwitches } from "./features";

export const PRESET_IDS = ["essentials", "writer", "screenwriter", "everything"] as const;
export type PresetId = typeof PRESET_IDS[number];

const ESSENTIALS: readonly FeatureId[] = [
  "goals", "outline", "placeholders", "typing", "lens", "darlings", "snapshots", "export", "desk",
];
const WRITER: readonly FeatureId[] = [
  ...ESSENTIALS, "dialogueFocus", "moveBlocks", "templates", "explorerCounts", "stageSnapshot", "publish", "submissions",
];

// The screenplay-only list (1.2, author's request 2026-10-19). Off: typing (Enter flow is
// off in a script, and smart typography turns the "--" scripts keep into em dashes),
// dialogueFocus, moveBlocks, templates, explorerCounts (words, not pages), spellcheck,
// publish and threads.
const SCREENWRITER: readonly FeatureId[] = [
  "goals", "outline", "placeholders", "screenplay", "lens", "snapshots", "darlings", "stageSnapshot", "desk", "export", "submissions",
];

/**
 * What each preset switches on (board 38, rebalanced by the author on 2026-10-07: the lens
 * and export are essentials). Every id not in a list is switched off by that preset,
 * "universe" aside (never in a list, never touched). Each list is closed under `requires`
 * (stageSnapshot needs snapshots, which every preset holds). Essentials 9, Writer 16,
 * Screenwriter 11, Everything 19 here (20 with the universe, as the setup counts). The screenplay editor
 * (1.2) is in Screenwriter and Everything (PLAN-1.2 Q2). A fresh install with no
 * setup run starts on Writer (Q7); an existing install keeps its switches (Q6).
 */
export const PRESETS: Readonly<Record<PresetId, readonly FeatureId[]>> = Object.freeze({
  essentials: Object.freeze([...ESSENTIALS]),
  writer: Object.freeze([...WRITER]),
  screenwriter: Object.freeze([...SCREENWRITER]),
  everything: Object.freeze(FEATURE_IDS.filter((id) => id !== "universe")),
});

/**
 * The `features` record with a value for each OFF_WHEN_MISSING id the saved switches lack
 * (PLAN-1.2 Q2): on when the rest of the switches match "everything" (so that install still
 * matches it), off otherwise. Ids already stored are kept. Returns `current.features` itself
 * when nothing is missing. `loadSettings` applies it to a saved install; a fresh one gets the
 * Writer preset, which writes every key.
 */
export function settleNewSwitches(current: FeatureSwitches): FeatureSwitches["features"] {
  const missing = OFF_WHEN_MISSING.filter((id) => !Object.prototype.hasOwnProperty.call(current.features, id));
  if (missing.length === 0) return current.features;
  const allOn = { ...current.features };
  for (const id of missing) allOn[id] = true;
  const everything = matchingPreset({ ...current, features: allOn }) === "everything";
  const out = { ...current.features };
  for (const id of missing) out[id] = everything;
  return out;
}

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
  const out: FeatureSwitches = {
    features,
    explorerCounts: current.explorerCounts,
    spellcheckOnDemand: current.spellcheckOnDemand,
    universeMode: current.universeMode,
  };
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
