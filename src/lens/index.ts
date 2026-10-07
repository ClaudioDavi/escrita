// The revision lens (SF 5): marks echoes, adverbs, gerunds, crutch words, name
// variants and long sentences in the editor, with a side panel. This file loads
// the word lists, follows renames and deletes and owns the session; the UI and the
// other public methods come with task 5.1.

import type { TFile } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule, type FeatureSlots, type SettingsUi } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { Follower } from "../core/vault-index";
import { locale } from "../i18n";
import { segment } from "../core/markdown";
import { dropKeys, movedPath, renameKeys } from "../core/path-keys";
import type { VaultIndex } from "../core/vault-index";
import { analyze, measuresFor, type AnalyzeOptions } from "./analyze";
import { addDismissal, dismissalOf, mergeDismissals } from "./dismiss";
import { lensLang } from "./lang";
import { EMPTY_TABLE } from "../core/names";
import { namesFor } from "./names";
import { listsPath, parseLists, sameLists } from "./lists";
import { LENS_SETTLE_MOBILE_MS, LENS_SETTLE_MS, LensSession } from "./session";
import { shownResult } from "./shown";
import { LensUi } from "./ui";
import { LENS_VIEW } from "./view";
import { type Dismissal, type Lists, type LensLang, type LensResult, type Match, type Measures, type RuleId } from "./types";
import { enabledRules } from "./panel-model";
import { addNotName, parseNotNames } from "./settings";
import { lensOffNotice, lensSettingsSection } from "./settings-ui";

/** What `Platform.isMobile` reads (the body class); index.ts has no runtime obsidian import, so tests can load it. */
function isMobile(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains("is-mobile");
}

const EMPTY_MD = segment("");
const EMPTY_LISTS: Lists = { crutch: [], names: [], ignore: [] };

export class LensModule extends FeatureModule {
  readonly id: FeatureId = "lens";
  readonly slots: FeatureSlots = { views: [LENS_VIEW], editors: 1 };
  /** undefined while the feature is off */
  private session: LensSession | undefined;
  private listsIndex: VaultIndex<TFile, Lists> | null = null;
  private ui: LensUi | null = null;
  private lastPassKey: string | null = null;
  /** the text each pass was computed on, for the dismissal keys (a pass is shared by result copies) */
  private texts = new WeakMap<object, string>();
  private shownCache = new Map<string, { src: LensResult; list: Dismissal[]; out: LensResult }>();

  constructor(private plugin: EscritaPlugin) {
    super();
  }

  /**
   * Always on (Q8): the dismissals and the word lists note path follow renames and deletes
   * while the lens is off. Touches only plugin.data and plugin.settings.
   */
  dataFollowers(): Follower[] {
    const p = this.plugin;
    return [{
      moved: (oldPath, newPath) => {
        if (renameKeys(p.data.lensDismissed, oldPath, newPath, mergeDismissals)) p.requestSave();
        const moved = movedPath(listsPath(p.settings.lensListsNote), oldPath, newPath);
        if (moved !== null && moved !== "") {
          p.settings.lensListsNote = moved;
          void p.saveSettings(); // triggers the index rebuild and settingsChanged
        }
      },
      // a deleted lists note leaves the setting alone: the panel says it is missing
      deleted: (path) => {
        if (dropKeys(p.data.lensDismissed, path)) p.requestSave();
      },
    }];
  }

  onload(): void {
    const p = this.plugin;
    const ctx = this.ctx;
    this.session = new LensSession({
      timers: {
        set: (cb, ms) => window.setTimeout(cb, ms),
        clear: (h) => window.clearTimeout(h as number),
        yieldNow: () => new Promise<void>((r) => window.setTimeout(r, 0)),
      },
      settleMs: isMobile() ? LENS_SETTLE_MOBILE_MS : LENS_SETTLE_MS,
      analyze: (path, text, version) => {
        const r = analyze(segment(text), this.options(path), version);
        this.texts.set(r.pass, text);
        return r;
      },
    });
    this.lastPassKey = this.passKey();
    // a names change (universe edit, mode switch, provider in or out) starts a new generation
    this.register(p.names.onChange(() => {
      this.lastPassKey = this.passKey();
      this.invalidate();
    }));

    // the word lists note: re-parsed on edit, rebuilt when the setting changes
    const idx = ctx.index<TFile, Lists>({
      name: "lens-lists",
      mode: "content",
      include: (f) => {
        const path = listsPath(p.settings.lensListsNote);
        return path !== "" && f.extension === "md" && f.path === path;
      },
      compute: (_f, text) => (text === null ? undefined : parseLists(text)),
      same: sameLists,
      settingsKey: () => listsPath(p.settings.lensListsNote),
    });
    this.listsIndex = idx;
    // the session reads the lists when a pass runs; every change starts a new options
    // generation there, so no note keeps a result computed on the old lists
    this.register(idx.onChange(() => this.invalidate()));
    this.register(idx.onReady(() => this.invalidate()));

    // session state only; the data moves are in dataFollowers()
    ctx.follow({
      moved: (oldPath, newPath) => {
        this.session?.renamed(oldPath, newPath);
        this.shownCache.delete(oldPath);
      },
      deleted: (path) => {
        this.session?.deleted(path);
        this.shownCache.delete(path);
      },
    });

    ctx.onLayoutReady(() => {
      let changed = false;
      for (const k of Object.keys(p.data.lensDismissed)) {
        if (p.app.vault.getAbstractFileByPath(k) === null) { delete p.data.lensDismissed[k]; changed = true; }
      }
      if (changed) p.requestSave();
    });

    this.ui = new LensUi(p, {
      session: this.session,
      shown: (path) => this.shown(path),
      lang: () => this.lensLanguage(),
      dismiss: (path, text, m) => this.dismiss(path, text, m),
    }, ctx, this);
    this.ui.load();
  }

  onunload(): void {
    this.session?.dispose();
    this.session = undefined;
    this.ui = null;
    this.listsIndex = null;
    this.shownCache.clear();
    this.lastPassKey = null;
  }

  /** The settings that change a pass; display-only ones (panel measures) do not need a new one. */
  private passKey(): string {
    const s = this.plugin.settings;
    return JSON.stringify([
      s.lensLanguage, s.lensRulesOff, s.lensRulesOn, s.notNames, s.lensEchoWindow, s.lensLongSentence,
      s.lensSkipQuotes, s.quoteStyle, s.paragraphStyle, listsPath(s.lensListsNote), this.plugin.names.version(),
    ]);
  }

  settingsChanged(): void {
    const key = this.passKey();
    if (key !== this.lastPassKey) {
      this.lastPassKey = key;
      this.invalidate();
    }
    this.ui?.refreshPanels();
  }

  /** Options changed: recompute every note that is on. A failing pass is logged, not thrown into the caller. */
  private invalidate(): void {
    if (!this.session) return;
    this.shownCache.clear();
    try {
      this.session.invalidate();
    } catch (e) {
      console.error("Escrita: the revision lens failed to recompute", e);
    }
  }

  /** The lens language: the setting, or the raw Obsidian locale for "auto" (Q8; i18n's lang() falls back to English). */
  private lensLanguage(): LensLang | null {
    return lensLang(this.plugin.settings.lensLanguage, locale());
  }

  /** The result the writer sees: the session's result minus the ignored matches. */
  private shown(path: string): LensResult | undefined {
    const r = this.session?.result(path);
    const list = this.plugin.data.lensDismissed[path];
    if (!r || !list || list.length === 0) return r;
    const hit = this.shownCache.get(path);
    if (hit && hit.src === r && hit.list === list) return hit.out;
    const text = this.texts.get(r.pass);
    if (text === undefined) return r;
    const out = shownResult(r, text, list);
    this.shownCache.set(path, { src: r, list, out });
    return out;
  }

  private dismiss(path: string, text: string, m: Match): void {
    const p = this.plugin;
    p.data.lensDismissed[path] = addDismissal(p.data.lensDismissed[path] ?? [], dismissalOf(text, m));
    p.requestSave();
  }

  /** The lists from the word lists note; empty when the setting is empty or the note is missing. */
  lists(): Lists {
    const path = listsPath(this.plugin.settings.lensListsNote);
    return (path !== "" ? this.listsIndex?.get(path) : undefined) ?? EMPTY_LISTS;
  }

  private listsState(): "ok" | "unset" | "missing" {
    const path = listsPath(this.plugin.settings.lensListsNote);
    if (path === "") return "unset";
    if (this.listsIndex?.get(path) !== undefined) return "ok";
    return this.plugin.app.vault.getAbstractFileByPath(path) !== null ? "ok" : "missing";
  }

  private options(path: string): AnalyzeOptions {
    const s = this.plugin.settings;
    const lists = this.lists();
    const rules = enabledRules(s.lensRulesOff, s.lensRulesOn);
    return {
      lang: this.lensLanguage(),
      rules,
      newName: rules.has("newName") ? this.newNameOptions(path) : undefined,
      echoWindow: s.lensEchoWindow,
      longSentence: s.lensLongSentence,
      lists: { ...lists, names: namesFor(lists.names, this.plugin.names.tableFor(path)) },
      skipQuotes: s.lensSkipQuotes,
      quoteStyle: s.quoteStyle,
      paragraphStyle: s.paragraphStyle,
    };
  }

  /**
   * The names rule's inputs (U 2.5, Q18), read through the names port: undefined while the
   * universe is off or the note is in no universe (the rule finds nothing). Asking starts the
   * cross-work index the first time; the index tells the port when it is built (a new pass).
   */
  private newNameOptions(path: string): AnalyzeOptions["newName"] {
    const names = this.plugin.names;
    if (!names.hasProvider() || names.tableFor(path) === EMPTY_TABLE) return undefined;
    names.wantNameCounts();
    return {
      notNames: parseNotNames(this.plugin.settings.notNames),
      query: {
        known: (text) => names.isKnownName(text, path),
        works: (text) => names.workCount(text, path),
      },
    };
  }

  /** "Dismiss" on a marked name: adds it to "Not names" for every note. False when it is already there. */
  async dismissName(text: string): Promise<boolean> {
    const next = addNotName(this.plugin.settings.notNames, text);
    if (next === null) return false;
    this.plugin.settings.notNames = next;
    await this.plugin.saveSettings();
    return true;
  }

  activeState(): {
    path: string | null;
    on: boolean;
    lang: LensLang | null;
    result: LensResult | undefined;
    selection: Measures | null;
    listsState: "ok" | "unset" | "missing";
  } {
    const path = this.ui?.activePath() ?? null;
    const base = { lang: this.lensLanguage(), listsState: this.listsState() };
    if (path === null) return { path, on: false, result: undefined, selection: null, ...base };
    const on = this.session?.isOn(path) ?? false;
    const result = on ? this.shown(path) : undefined;
    let selection: Measures | null = null;
    const range = result ? this.ui?.selectionFor(path, result) ?? null : null;
    if (result && range) selection = measuresFor(result.pass, EMPTY_MD, this.options(path), range);
    return { path, on, result, selection, ...base };
  }

  turnOn(path: string): void {
    this.ui?.turnOn(path);
  }

  step(rule: RuleId, dir: 1 | -1): void {
    this.ui?.step(rule, dir, true);
  }

  clearDismissed(path: string): void {
    if (!(path in this.plugin.data.lensDismissed)) return;
    delete this.plugin.data.lensDismissed[path];
    this.shownCache.delete(path);
    this.plugin.requestSave();
    this.ui?.refresh();
  }

  dismissedCount(path: string): number {
    return this.plugin.data.lensDismissed[path]?.length ?? 0;
  }

  createLists(): Promise<void> {
    return this.ui?.createLists() ?? Promise.resolve();
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { lensSettingsSection(el, ui, this.plugin); }
  offNotice(): Promise<string | null> { return lensOffNotice(this.plugin); }
}
