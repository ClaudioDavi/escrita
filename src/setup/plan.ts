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
// - New folders and the track-folder change share the "folders" tick: ticked in a vault
//   without works, unticked in one with works, so "Both" changes nothing there unless ticked.
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
//   names, under their tick, "folders" (unticked in a vault with works: the author, 2026-10-07).
//   `universeMode` has its own tick, "universe", ticked: the writer chose it in step 1; `homeNote` goes with "home", `openHomeOnStartup` has its own
//   tick, "startup", and `openInWritingMode` goes with "layout".
// - In a vault with works (`SetupVault.hasWorks`), the examples, the language group,
//   "open the home note on startup", the features row and the layout come unticked (board 36 a: "In a vault with settings…
//   the features row and the layout come unticked"); with more than one open leaf, the
//   layout row does too (Q4). The reason line says why (Wave 0 judge, 2026-10-07).
// - Items come in run order: folders, examples, the home note, then the settings (the
//   features row among them), written last and only if every folder exists; then the
//   layout, which writes nothing (public workspace calls, after the features are applied
//   so the outline and lens views exist). A partial failure says what was made and what
//   wasn't, and undoes nothing. The preview groups items by `kind` in its own order
//   (folders, examples, settings, home note, layout: board 37).
//

import type { EscritaSettings } from "../settings";
import { LANGUAGE_DEFAULTS, SETUP_NAMES, WORD_KEYS, type DefaultsLanguage, type WordKey } from "../core/defaults";
import { presetChanges, presetSwitches, type PresetId } from "../core/feature-presets";
import type { UniverseMode } from "../universe/settings";
import { EXAMPLE_CHAPTERS, exampleText, type ExampleRole } from "./examples";
import { homeNoteText } from "./home-text";
import { HOME_NOTE_NAMES } from "../core/home-note";
import { UNIVERSE_NOTE_TEXT, universeNotePath } from "../core/scope";

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
  /** the writer's main-area tabs that hold something (a note); empty tabs and the sidebar panels are not counted */
  openLeaves: number;
  /** whether the vault has any work (`plugin.works`): a book or a tracked note with a stage */
  hasWorks: boolean;
}

/** The kinds of item, one group each in the preview. */
export type SetupItemKind = "folder" | "example" | "home" | "universe" | "setting" | "features" | "layout";

/**
 * - `new`: does not exist; the run creates it (a folder, a note).
 * - `kept`: exists already, or a setting that is the writer's own or already right; never touched.
 * - `change`: a setting the run writes.
 */
export type SetupItemState = "new" | "kept" | "change";

/**
 * The tickable rows of the preview. Items sharing a tick go together (the examples are one
 * tick, and so is the language group). "startup" is `openHomeOnStartup` alone, its own row
 * under the home note, unticked in a vault with works (Wave 2 seams, 2026-10-07). "folders"
 * is the new folders and the track-folder change they bring, unticked in a vault with works;
 * "universe" is the "Shared world" answer, ticked because the writer chose it in step 1
 * (both settled by the author, 2026-10-07).
 */
export type SetupTick = "folders" | "examples" | "home" | "startup" | "language" | "universe" | "features" | "layout";

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

/** The install's value of the non-word settings the plan writes: DEFAULT_SETTINGS's, copied to keep this file free of obsidian imports (tests/setup-plan.test.ts pins them). */
export const PLAIN_DEFAULTS = { trackFolders: "", lensLanguage: "auto", homeNote: "", openHomeOnStartup: false, openInWritingMode: false } as const;


const keyOf = (path: string): string => path.normalize("NFC").toLowerCase();

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * The plan for `choices` in `vault`, given the live `settings`: every item the preview
 * shows, in run order (see the file comment). `ticks` are the writer's ticks so far; only the
 * language tick changes the plan's items (see `languageRuns`), and the examples tick the home note's line about them. Never throws; an empty vault and a second
 * run in the same vault (board 36 b: every item `kept`, "Nothing to do") are ordinary
 * inputs.
 */
export function planSetup(choices: SetupChoices, vault: SetupVault, settings: EscritaSettings, ticks: SetupTicks = {}): SetupItem[] {
  const { hasWorks, openLeaves } = vault;
  // Whether the language group will run (the writer's tick, else its default): the example
  // book's chapters folder and the example texts follow the language only when it does
  // (Wave 1b result: the preview re-plans with the ticks, so what it shows is what runs).
  const languageRuns = ticks.language ?? !hasWorks;
  const names = SETUP_NAMES[choices.language];
  const target = LANGUAGE_DEFAULTS[choices.language];
  const install = LANGUAGE_DEFAULTS[settings.defaultsLanguage];
  const items: SetupItem[] = [];

  // What exists, by folded path: the existing spelling wins, and what goes inside follows it.
  const existing = new Map<string, string>();
  for (const p of vault.folders) existing.set(keyOf(p), p);
  for (const p of vault.files) existing.set(keyOf(p), p);
  const place = (parent: string, name: string): { path: string; exists: boolean } => {
    const wanted = parent ? `${parent}/${name}` : name;
    const found = existing.get(keyOf(wanted));
    return found === undefined ? { path: wanted, exists: false } : { path: found, exists: true };
  };

  // Folders
  const folderPaths: string[] = [];
  const addFolder = (name: string): void => {
    const f = place("", name);
    folderPaths.push(f.path);
    items.push(f.exists
      ? { kind: "folder", target: f.path, state: "kept", tick: null, ticked: false, reason: { key: "setup.reason.folderExists", vars: { count: vault.noteCounts[f.path] ?? 0 } } }
      : { kind: "folder", target: f.path, state: "new", tick: "folders", ticked: !hasWorks, reason: { key: hasWorks ? "setup.reason.folderHasWorks" : "setup.reason.folderNew" } });
  };
  const stories = choices.writes !== "books";
  const books = choices.writes !== "stories";
  if (stories) addFolder(names.storiesFolder);
  if (books) addFolder(names.booksFolder);

  // Examples: the chapters folder follows the writer's own name when they have one.
  const ownChapters = !same(settings.chaptersFolder, install.chaptersFolder);
  const chaptersName = ownChapters || !languageRuns ? settings.chaptersFolder : target.chaptersFolder;
  // The example notes' text (setup/examples.ts) reads the settings in effect after the run.
  const exampleCtx = { language: choices.language, settings: languageRuns ? settingsAfter(settings, choices.language) : settings };
  const addExample = (parent: string, name: string, role: ExampleRole | null): string => {
    const e = place(parent, name);
    const content = role && !e.exists ? { content: exampleText(role, exampleCtx) } : {};
    items.push(e.exists
      ? { kind: "example", target: e.path, state: "kept", tick: null, ticked: false, reason: { key: "setup.reason.exists" } }
      : { kind: "example", target: e.path, state: "new", tick: "examples", ticked: !hasWorks, reason: { key: hasWorks ? "setup.reason.exampleHasWorks" : "setup.reason.exampleNew" }, ...content });
    return e.path;
  };
  if (stories) addExample(folderPaths[0], `${names.exampleStory}.md`, { kind: "story" });
  if (books) {
    // The book note sits NEXT TO the book's folder (Books/X.md beside Books/X/), as the
    // classifier reads a book (core/classify.ts, bookAt); inside the folder it'd be a plain note.
    const booksParent = folderPaths[folderPaths.length - 1];
    const book = addExample(booksParent, names.exampleBook, null);
    addExample(booksParent, `${names.exampleBook}.md`, { kind: "bookNote" });
    const chapters = addExample(book, chaptersName, null);
    EXAMPLE_CHAPTERS[choices.language].forEach((c, index) => addExample(chapters, c, { kind: "chapter", index }));
  }

  // The home note: the one the setting names, else one an empty setting adopts (the desk's
  // rule, desk/home.ts), else the language's name. Never a second home note beside an existing one.
  const ownHome = settings.homeNote.trim();
  const home = ownHome
    ? place("", /\.md$/i.test(ownHome) ? ownHome : `${ownHome}.md`)
    : [names.homeNote, ...HOME_NOTE_NAMES].map((n) => place("", n)).find((h) => h.exists) ?? place("", names.homeNote);
  items.push(home.exists
    ? { kind: "home", target: home.path, state: "kept", tick: null, ticked: false, reason: { key: "setup.reason.exists" } }
    : { kind: "home", target: home.path, state: "new", tick: "home", ticked: true, reason: { key: "setup.reason.homeNew" }, content: homeNoteText({ language: choices.language, examples: (ticks.examples ?? !hasWorks) && items.some((i) => i.kind === "example" && i.state === "new") }) });

  // The universe note of a "Shared world" answer: made with the universe tick, never over a note
  // that exists (the run goes through notes.create with exists "return"). Its path is the one in
  // effect after the run (the language group may move the default name).
  if (choices.universeMode === "universe") {
    const noteSetting = (languageRuns ? settingsAfter(settings, choices.language) : settings).universeNote;
    const u = place("", universeNotePath(noteSetting));
    if (!u.exists) items.push({ kind: "universe", target: u.path, state: "new", tick: "universe", ticked: true, reason: { key: "setup.reason.universeNew" }, content: UNIVERSE_NOTE_TEXT });
  }

  // Settings, last. `ticked` of a tick's items follows the tick's default.
  const keep = (key: string, value: unknown, reason: "settingSame" | "settingOwn"): void => {
    items.push({ kind: "setting", target: key, state: "kept", tick: null, ticked: false, reason: { key: `setup.reason.${reason}` }, value });
  };
  const change = (key: string, value: unknown, tick: SetupTick | null, ticked: boolean, reasonKey = "settingChange"): void => {
    items.push({ kind: "setting", target: key, state: "change", tick, ticked, reason: { key: `setup.reason.${reasonKey}` }, value });
  };
  const langTicked = !hasWorks;
  const langChange = (key: string, value: unknown): void =>
    change(key, value, "language", langTicked, langTicked ? "settingChange" : "settingHasWorks");
  const word = (key: WordKey, always: boolean): void => {
    const cur: unknown = settings[key];
    const wanted: unknown = target[key];
    const own = !same(cur, install[key]);
    if (own) keep(key, cur, "settingOwn");
    else if (same(cur, wanted)) { if (always) keep(key, cur, "settingSame"); }
    else langChange(key, wanted);
  };

  if (same(settings.defaultsLanguage, choices.language)) keep("defaultsLanguage", settings.defaultsLanguage, "settingSame");
  else langChange("defaultsLanguage", choices.language);
  for (const key of WORD_KEYS) if (key !== "chaptersFolder") word(key, false);

  // The track folder is added to the list, never swapped; an empty list tracks the whole vault.
  const tracked = settings.trackFolders.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  if (tracked.length === 0) {
    items.push({ kind: "setting", target: "trackFolders", state: "kept", tick: null, ticked: false, reason: { key: "setup.reason.trackAll" }, value: settings.trackFolders });
  } else {
    const have = new Set(tracked.map(keyOf));
    const added = folderPaths.filter((f) => !have.has(keyOf(f)));
    if (added.length === 0) keep("trackFolders", settings.trackFolders, "settingSame");
    else items.push({
      kind: "setting", target: "trackFolders", state: "change", tick: "folders", ticked: !hasWorks,
      reason: { key: hasWorks ? "setup.reason.trackAddHasWorks" : "setup.reason.trackAdd", vars: { folders: added.join(", ") } }, value: [...tracked, ...added].join("\n"),
    });
  }

  word("chaptersFolder", true);
  if (same(settings.lensLanguage, choices.language)) keep("lensLanguage", settings.lensLanguage, "settingSame");
  else if (settings.lensLanguage !== PLAIN_DEFAULTS.lensLanguage) keep("lensLanguage", settings.lensLanguage, "settingOwn");
  else langChange("lensLanguage", choices.language);

  if (choices.universeMode !== null) {
    if (settings.universeMode === choices.universeMode) keep("universeMode", settings.universeMode, "settingSame");
    else change("universeMode", choices.universeMode, "universe", true, "universeChoice");
  }

  // A home note that exists in another case (home.md for Home.md) is used as it is, under
  // the home tick (Wave 2 seams, 2026-10-07: case-clash.json).
  if (settings.homeNote === home.path) keep("homeNote", settings.homeNote, "settingSame");
  else if (settings.homeNote !== PLAIN_DEFAULTS.homeNote) keep("homeNote", settings.homeNote, "settingOwn");
  else change("homeNote", home.path, "home", true, "homeNoteSet");
  // Its own row, unticked in a vault with works (Wave 2 seams, 2026-10-07).
  if (settings.openHomeOnStartup) keep("openHomeOnStartup", true, "settingSame");
  else change("openHomeOnStartup", true, "startup", !hasWorks, hasWorks ? "settingHasWorks" : "startupNew");

  // Only the writer's own tabs count (the vault index reads main-area tabs with a note), so a
  // fresh vault with Obsidian's default sidebar panels gets the layout ticked.
  const layoutTicked = openLeaves <= 1 && !hasWorks;
  if (choices.layout === "focus") {
    if (settings.openInWritingMode) keep("openInWritingMode", true, "settingSame");
    else change("openInWritingMode", true, "layout", layoutTicked);
  }

  // The features row
  const switches = presetSwitches(choices.preset, settings);
  const diff = presetChanges(settings, choices.preset);
  const featuresSame = diff.on.length === 0 && diff.off.length === 0;
  items.push(featuresSame
    ? { kind: "features", target: "features", state: "kept", tick: null, ticked: false, reason: { key: "setup.reason.featuresSame", vars: { preset: choices.preset } }, value: switches }
    : { kind: "features", target: "features", state: "change", tick: "features", ticked: !hasWorks, reason: { key: hasWorks ? "setup.reason.featuresHasWorks" : "setup.reason.featuresChange", vars: { preset: choices.preset } }, value: switches });

  // The layout: writes nothing itself, so it is always a new row.
  items.push({
    kind: "layout", target: "layout", state: "new", tick: "layout", ticked: layoutTicked, value: choices.layout,
    reason: openLeaves > 1 ? { key: "setup.reason.layoutTabs", vars: { leaves: openLeaves } }
      : hasWorks ? { key: "setup.reason.layoutHasWorks" } : { key: "setup.reason.layoutNew" },
  });
  return items;
}

/**
 * The settings in effect after a run that writes `language`'s set: the live settings with
 * that set's word-bearing values on every key that is not the writer's own (differs from
 * the install's set), as the plan's language group writes them. What the example texts read.
 * A shallow copy that may share nested values with the live settings and the frozen sets:
 * read it, never mutate it or hand it to the live settings.
 */
export function settingsAfter(settings: EscritaSettings, language: DefaultsLanguage): EscritaSettings {
  const target = LANGUAGE_DEFAULTS[language];
  const install = LANGUAGE_DEFAULTS[settings.defaultsLanguage];
  const out = { ...settings } as Record<string, unknown>;
  for (const key of WORD_KEYS) if (same(settings[key], install[key])) out[key] = target[key];
  return out as unknown as EscritaSettings;
}

/** The items a run executes: not `kept`, and ticked (the writer's tick, else the item's default). */
export function itemsToRun(items: readonly SetupItem[], ticks: SetupTicks): SetupItem[] {
  return items.filter((i) => i.state !== "kept" && (i.tick === null ? i.ticked : ticks[i.tick] ?? i.ticked));
}
