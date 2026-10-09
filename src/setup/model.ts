// What the setup's modal shows and says (1.0, task 2.2; boards 35 and 36). Pure, no Obsidian
// imports: the modal draws these rows and the run executes the same items, so what the writer
// saw is what happens.

import type { EscritaSettings } from "../settings";
import type { DefaultsLanguage } from "../core/defaults";
import { PRESETS, type PresetId } from "../core/feature-presets";
import { itemsToRun, planSetup, type SetupChoices, type SetupItem, type SetupTicks, type SetupVault } from "./plan";

/** The preview's groups, in board 37's order. */
export type PreviewGroupKind = "folder" | "example" | "setting" | "home" | "universe" | "layout";

/** `+` new, `=` stays as it is, `·` a setting that changes (board 36 a). */
export type PreviewMark = "+" | "=" | "·";

export interface PreviewRow {
  item: SetupItem;
  mark: PreviewMark;
  /** the row's name: a path for folders and notes, the setting's label for settings */
  label: string;
  /** a setting's value, short; "" when there is none to show */
  value: string;
  /** the tick this row's checkbox flips, or null when it has none (the tick's first row only) */
  box: SetupItem["tick"];
  /** whether the row will run: its tick as the writer left it */
  on: boolean;
}

export interface PreviewGroup {
  kind: PreviewGroupKind;
  rows: PreviewRow[];
}

/** The language the setup starts on: Obsidian's, as the defaults know it. */
export function initialChoices(language: DefaultsLanguage): SetupChoices {
  return { writes: "both", language, preset: "writer", universeMode: null, layout: "desk" };
}

/** The plan for the choices and the ticks so far (re-planned whenever either changes). */
export function planFor(choices: SetupChoices, vault: SetupVault, settings: EscritaSettings, ticks: SetupTicks): SetupItem[] {
  // Everything's "Shared world" answer exists only with Everything.
  const c = choices.preset === "everything" ? choices : { ...choices, universeMode: null };
  return planSetup(c, vault, settings, ticks);
}

/** Whether the item runs: not kept, and ticked (the writer's tick, else its default). */
export const tickOn = (item: SetupItem, ticks: SetupTicks): boolean =>
  item.state !== "kept" && (item.tick === null ? item.ticked : ticks[item.tick] ?? item.ticked);

/** The setting keys that have no row of their own: the layout and the home note cover them. */
function hidden(item: SetupItem, items: readonly SetupItem[]): boolean {
  if (item.kind !== "setting") return false;
  if (item.target === "openInWritingMode") return true;
  // homeNote follows the home note's row while the note is new; kept as its own row otherwise
  if (item.target === "homeNote") return item.state === "change" && items.some((i) => i.kind === "home" && i.state === "new");
  return false;
}

const HOME_SETTINGS = new Set(["homeNote", "openHomeOnStartup"]);

/** Groups the plan into the preview's rows. `label` turns a setting's key into its text; `value` turns an item's value into text. */
export function previewGroups(
  items: readonly SetupItem[],
  ticks: SetupTicks,
  label: (item: SetupItem) => string,
  value: (item: SetupItem) => string,
): PreviewGroup[] {
  const groups: PreviewGroup[] = [];
  const seenTick = new Set<string>();
  const rowOf = (item: SetupItem): PreviewRow => {
    const on = tickOn(item, ticks);
    const first = item.tick !== null && !seenTick.has(item.tick);
    if (item.tick !== null) seenTick.add(item.tick);
    return {
      item,
      mark: item.state === "kept" ? "=" : item.state === "new" ? "+" : "·",
      label: label(item),
      value: value(item),
      box: first ? item.tick : null,
      on,
    };
  };
  const add = (kind: PreviewGroupKind, list: SetupItem[]): void => {
    if (list.length > 0) groups.push({ kind, rows: list.map(rowOf) });
  };
  const visible = items.filter((i) => !hidden(i, items));
  add("folder", visible.filter((i) => i.kind === "folder"));
  add("example", visible.filter((i) => i.kind === "example"));
  const homeSettings = visible.filter((i) => i.kind === "setting" && HOME_SETTINGS.has(i.target));
  add("setting", [
    ...visible.filter((i) => i.kind === "features"),
    ...visible.filter((i) => i.kind === "setting" && !HOME_SETTINGS.has(i.target)),
  ]);
  add("home", [...visible.filter((i) => i.kind === "home"), ...homeSettings]);
  add("universe", visible.filter((i) => i.kind === "universe"));
  add("layout", visible.filter((i) => i.kind === "layout"));
  return groups;
}

/** Reasons that explain why a row comes unticked: they stop being true once the writer ticks it. */
const UNTICKED_REASONS = new Set([
  "setup.reason.folderHasWorks", "setup.reason.exampleHasWorks", "setup.reason.settingHasWorks",
  "setup.reason.trackAddHasWorks", "setup.reason.featuresHasWorks", "setup.reason.layoutTabs", "setup.reason.layoutHasWorks",
]);

/** The reason to show under an item: its own, or "ticked" when it explained an unticked default and the writer has ticked the row since. */
export function reasonFor(item: SetupItem, on: boolean): SetupItem["reason"] {
  return on && UNTICKED_REASONS.has(item.reason.key) ? { key: "setup.reason.tickedByYou" } : item.reason;
}

/** Whether an item makes a file or a folder (what "items" counts), as opposed to a setting or the layout. */
export function isMade(item: SetupItem): boolean {
  return item.kind === "folder" || item.kind === "example" || item.kind === "home" || item.kind === "universe";
}

export function isSetting(item: SetupItem): boolean {
  return item.kind === "setting" || item.kind === "features";
}

/** What "Create" will do, as counts for the summary line (board 36 a). */
export interface PlanCounts {
  items: number;
  settings: number;
  /** items that could run at all (not kept), ticked or not */
  available: number;
}

export function planCounts(items: readonly SetupItem[], ticks: SetupTicks): PlanCounts {
  const run = itemsToRun(items, ticks);
  return {
    items: run.filter(isMade).length,
    settings: run.filter(isSetting).length,
    available: items.filter((i) => i.state !== "kept").length,
  };
}

/** How many features a preset turns on, as the boards count them (the universe is counted as available in Everything). */
export function presetCount(id: PresetId): number {
  return PRESETS[id].length + (id === "everything" ? 1 : 0);
}

/**
 * An item's value as short text: a string as it is (a list of lines joined), a stage mapping
 * as its words, a record of typed values by their `value`s. Anything else is "".
 */
export function valueText(v: unknown): string {
  if (typeof v === "string") return v.split("\n").map((l) => l.trim()).filter((l) => l !== "").join(", ");
  if (Array.isArray(v)) return v.map(valueText).filter((x) => x !== "").join(", ");
  if (v && typeof v === "object") {
    return Object.values(v as Record<string, unknown>).map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object") {
        const o = x as { words?: unknown; value?: unknown };
        if (typeof o.words === "string") return o.words.split(",")[0].trim();
        if (typeof o.value === "string") return o.value;
      }
      return "";
    }).filter((x) => x !== "").join(", ");
  }
  return "";
}
