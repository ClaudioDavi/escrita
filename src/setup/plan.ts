// "Set up a writing vault" (1.0, SF 10; PLAN-1.0 Q3-Q5, boards 35-37): what the setup
// will do, as one list of items. Pure, no Obsidian imports. The preview draws this list
// and the run executes the same list, so what the writer saw is what happens.
//
// Rules the plan follows (the contract; task 1.5 writes the logic and the fixtures in
// tests/fixtures/setup/ pin it):
// - Never an item over an existing note. A path that exists, in any letter case, is
//   `kept` and never written; a folder that exists only in another case is used as it is
//   (the item's `path` is the existing spelling, and what goes inside it follows). The
//   run still goes through `notes.create` with `exists: "return"`, which refuses a
//   case-only clash, as the safety net for a vault that changed after the preview.
// - The setup never changes a saved setting without a tick. A setting counts as the
//   writer's own when its value differs from the install's default set
//   (`defaultsFor(settings.defaultsLanguage)`); then it is `kept`. A setting already
//   equal to what the setup would write is `kept` too. Only the rest are `change`.
// - A track folder is added to `trackFolders`, never swapped: the item's `value` is the
//   current list plus the new folders. An empty list (the whole vault) stays empty: every
//   folder is already tracked, and the item is `kept`.
// - The settings the plan may list (board 37): `defaultsLanguage` and the word-bearing
//   settings of core/defaults.ts `WORD_KEYS` that are not the writer's own (a language
//   other than the install's), `trackFolders`, `chaptersFolder`, `lensLanguage` (the
//   writing language), `homeNote` and `openHomeOnStartup` (with the home note),
//   `openInWritingMode` (with the writing mode layout), `universeMode` (Everything with a
//   "Shared world" answer), and the features row. Nothing else.
// - The language group shares one tick, "language": `defaultsLanguage`, every
//   word-bearing setting that would change, and `lensLanguage`. The writer picked the
//   language, but a value equal to the install's default set is still saved in data.json
//   (SF 10: "a value the writer already saved is never changed"), and some of these move
//   what Escrita reads (`chaptersFolder`, `submissionsFolder`), so they never change
//   without a tick. `trackFolders` (added to, never swapped) goes with the folders it
//   names and has no tick; `homeNote` and `openHomeOnStartup` go with "home",
//   `openInWritingMode` with "layout".
// - In a vault with works (`SetupVault.hasWorks`), the examples, the language group, the
//   features row and the layout come unticked (board 36 a: "In a vault with settings…
//   the features row and the layout come unticked"); with more than one open leaf, the
//   layout row does too (Q4). The reason line says why (Wave 0 judge, 2026-10-07).
// - Items come in run order: folders, examples, the home note, then the settings (the
//   features row among them), written last and only if every folder exists; then the
//   layout, which writes nothing (public workspace calls, after the features are applied
//   so the outline and lens views exist). A partial failure says what was made and what
//   wasn't, and undoes nothing. The preview groups items by `kind` in its own order
//   (folders, examples, settings, home note, layout: board 37).
//
// `planSetup` is a stub until task 1.5.

import type { EscritaSettings } from "../settings";
import type { DefaultsLanguage } from "../core/defaults";
import type { PresetId } from "../core/feature-presets";
import type { UniverseMode } from "../universe/settings";

/** "What do you write?" (board 37): short fiction (contos and essays), a novel, or both. */
export type SetupWrites = "stories" | "books" | "both";

/** The two layouts of the setup (board 37): the writing desk, or writing mode (board 39). */
export type SetupLayout = "desk" | "focus";

/**
 * The writer's answers in step 1 of the modal, and the layout card picked in step 2.
 * The ticks of step 2 (examples, home note, language, features, layout) are not here: their
 * defaults depend on the vault, so they live on the items (`tick`, `ticked`), and the
 * preview keeps the writer's changes to them as a `SetupTicks` record.
 */
export interface SetupChoices {
  writes: SetupWrites;
  /** the default set the setup writes (`defaultsLanguage` and the word-bearing settings); starts as `languageOf(locale())` */
  language: DefaultsLanguage;
  /** the starting point (core/feature-presets.ts); starts as "writer" */
  preset: PresetId;
  /**
   * "Shared world", asked only with Everything (board 37): the universe mode to set, or
   * null to leave it as it is (always null with Essentials and Writer).
   */
  universeMode: UniverseMode | null;
  /** the layout card; whether the layout is applied at all is the "layout" tick */
  layout: SetupLayout;
}

/**
 * What exists in the vault when the preview opens: a snapshot, read once by the modal
 * (the Obsidian side) and handed to `planSetup`. Paths are vault paths as stored, with
 * their letter case; comparisons for "exists" fold case (`toLowerCase` after NFC).
 */
export interface SetupVault {
  /** every folder path, root excluded */
  folders: readonly string[];
  /** every file path (notes and other files): a note is never created over any of them */
  files: readonly string[];
  /** markdown notes per folder path, direct and nested, for the "212 notes" reason line; a missing folder counts 0 */
  noteCounts: Readonly<Record<string, number>>;
  /** leaves open in the workspace (main area tabs and sidebar views) */
  openLeaves: number;
  /** whether the vault has any work (`plugin.works`): a book or a tracked note with a stage */
  hasWorks: boolean;
}

/** The kinds of item, one group each in the preview. */
export type SetupItemKind = "folder" | "example" | "home" | "setting" | "features" | "layout";

/**
 * - `new`: does not exist; the run creates it (a folder, a note).
 * - `kept`: exists already, or a setting that is the writer's own or already right; never touched.
 * - `change`: a setting the run writes.
 */
export type SetupItemState = "new" | "kept" | "change";

/** The tickable rows of the preview. Items sharing a tick go together (the examples are one tick, and so is the language group). */
export type SetupTick = "examples" | "home" | "language" | "features" | "layout";

/** The writer's ticks, as the preview holds them; a missing tick uses the items' `ticked`. */
export type SetupTicks = Partial<Record<SetupTick, boolean>>;

/**
 * The reason line under an item, as a string key and its values: the plan is pure, so
 * the modal translates it (`t(reason.key, reason.vars)`, keys under `setup.reason.`).
 */
export interface SetupReason {
  key: string;
  vars?: Record<string, string | number>;
}

export interface SetupItem {
  kind: SetupItemKind;
  /**
   * What the item is about: a vault path for folder, example and home (a folder path has
   * no trailing slash; an example book is its folder, its notes are items of their own),
   * a settings key for setting (`trackFolders`, `stages`…), "features" and "layout" for those.
   */
  target: string;
  state: SetupItemState;
  /** the row has a checkbox; `kept` items never do */
  tick: SetupTick | null;
  /** the checkbox's default (Q3, Q4: unticked in a vault with works or open tabs); true for an item with no tick that will run */
  ticked: boolean;
  reason: SetupReason;
  /**
   * For a setting: the value the run writes (`change`) or keeps (`kept`), as stored in
   * the settings. For features: the `FeatureSwitches` the preset gives (presetSwitches).
   * For layout: the `SetupLayout`. Absent for files and folders.
   */
  value?: unknown;
  /** an example note's or the home note's text, for the run; absent for everything else */
  content?: string;
}

/** What the run reports (board 36 c): every item it made, and every one it could not, with the error text. */
export interface SetupOutcome {
  made: SetupItem[];
  failed: { item: SetupItem; error: string }[];
  /** items left out by an unticked box or as `kept` */
  skipped: SetupItem[];
}

/**
 * The plan for `choices` in `vault`, given the live `settings`: every item the preview
 * shows, in run order (see the file comment). Never throws; an empty vault and a second
 * run in the same vault (board 36 b: every item `kept`, "Nothing to do") are ordinary
 * inputs. Task 1.5.
 */
export function planSetup(choices: SetupChoices, vault: SetupVault, settings: EscritaSettings): SetupItem[] {
  void choices;
  void vault;
  void settings;
  return [];
}

/** The items a run executes: not `kept`, and ticked (the writer's tick, else the item's default). */
export function itemsToRun(items: readonly SetupItem[], ticks: SetupTicks): SetupItem[] {
  return items.filter((i) => i.state !== "kept" && (i.tick === null ? i.ticked : ticks[i.tick] ?? i.ticked));
}
