// The on-demand `universe-names` index (0.9, U 2.5; PLAN-0.9 Q3, Q18): for each note the
// universe scans, the distinct capitalized runs it names (core/name-runs.ts `nameRuns` over
// `namesMask`, the same runs the lens's names rule finds), and the cross-work count the
// rule reads through the names port (`workCount`). It starts the first time the rule runs
// (`want()`), never before: a writer who never turns the rule on never pays for it.
//
// Same notes as the mentions index. No Obsidian imports: the hub's `add`, the scope and
// work lookups and time come in through `NamesIndexDeps`, so it is tested on MemoryVault.

import { segment } from "../core/markdown";
import { nameRuns, namesMask } from "../core/name-runs";
import { foldName } from "../core/names";
import { sentences } from "../core/sentences";
import type { StemLang } from "../core/stem";
import { tokens } from "../core/tokens";
import type { IndexChange, IndexFile, IndexSpec, IndexTimers, VaultIndex } from "../core/vault-index";
import { classifyKeyOf, isUniverseNote, type EntriesSettings } from "./entries";
import type { MentionCtx } from "./mentions";

export const NAMES_INDEX_NAME = "universe-names";

/** The quiet time after an edit changes a note's runs before the port's listeners hear of it. */
export const NAMES_NOTIFY_MS = 3000;
/** Like the mentions index (IMPROVEMENTS 21): typing doesn't recompute the runs at every save. */
export const NAMES_SETTLE_MS = 4000;

/** One note's distinct run keys (foldName), sorted. */
export type NoteRuns = readonly string[];

export interface NamesIndexDeps<F extends IndexFile> {
  add(spec: IndexSpec<F, NoteRuns>): VaultIndex<F, NoteRuns>;
  /** takes the index out of the hub (module unload); optional in tests */
  remove?(index: VaultIndex<F, NoteRuns>): void;
  settings(): EntriesSettings;
  /** the language the runs are read in (the lens's, as the names provider reads it); null: none */
  lang(): StemLang | null;
  /** the scope and work lookups of the note being asked about (MentionCtxFactory.ctx) */
  ctx(path: string): Pick<MentionCtx, "inScope" | "workOf">;
  timers: IndexTimers;
}

export function sameRuns(a: NoteRuns, b: NoteRuns): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** The keys of a note's runs: what one note stores. Undefined when it names nothing. */
export function runsOf(text: string, lang: StemLang | null): NoteRuns | undefined {
  const md = segment(text);
  const mask = namesMask(md);
  const keys = new Set(nameRuns(tokens(mask), sentences(mask, md, lang), mask, lang).map((r) => r.key));
  return keys.size === 0 ? undefined : [...keys].sort();
}

export class NamesIndex<F extends IndexFile> {
  private index: VaultIndex<F, NoteRuns> | null = null;
  private wanted = false;
  private demanded = false;
  private listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  private timer: unknown = null;
  /** run key -> the notes that name it; built on the first query and kept current note by note */
  private notesByKey: Map<string, Set<string>> | null = null;

  constructor(private deps: NamesIndexDeps<F>) {}

  /** Adds the spec (on demand: it builds nothing until `want()`). Safe to call twice. */
  start(): void {
    if (this.index) return;
    const index = this.deps.add(this.spec());
    this.index = index;
    this.stops.push(
      index.onChange((c) => this.changed(c)),
      index.onReady(() => {
        // a build finished: every listener hears of it once
        this.notesByKey = null;
        this.notify();
      }),
    );
    if (this.wanted) this.want();
  }

  /** The rule ran: the first call starts the build, later calls do nothing. */
  want(): void {
    this.wanted = true;
    const index = this.index;
    if (!index || this.demanded) return;
    this.demanded = true;
    index.demand();
  }

  isReady(): boolean { return this.index?.isReady() ?? false; }
  get started(): boolean { return this.index !== null; }

  /** Fires once when the first build is done and after that, debounced, when a note's runs change. */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  get(path: string): NoteRuns | undefined { return this.index?.get(path); }

  /**
   * In how many works of the scope of `path` the run `text` appears. 0 while the index is
   * not ready (the in-note count alone applies then), or when nothing names it.
   */
  workCount(text: string, path: string): number {
    const index = this.index;
    if (!index || !index.isReady()) return 0;
    const key = foldName(text);
    if (key === "") return 0;
    const notes = this.byKey().get(key);
    if (!notes || notes.size === 0) return 0;
    const ctx = this.deps.ctx(path);
    const works = new Set<string>();
    for (const n of notes) {
      const w = ctx.workOf(n);
      if (w && ctx.inScope(n)) works.add(w.work);
    }
    return works.size;
  }

  /** Scope or structure changed: the lookup is built again on the next query. */
  scopeChanged(): void {
    this.notesByKey = null;
  }

  dispose(): void {
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = null;
    for (const stop of this.stops) stop();
    this.stops = [];
    if (this.index) this.deps.remove?.(this.index);
    this.index = null;
    this.wanted = false;
    this.demanded = false;
    this.listeners.clear();
    this.notesByKey = null;
  }

  // ------------------------------------------------------------------ internals

  private spec(): IndexSpec<F, NoteRuns> {
    return {
      name: NAMES_INDEX_NAME,
      mode: "content",
      include: (f) => this.deps.settings().universeMode !== "off" && isUniverseNote(f, this.deps.settings()),
      compute: (_f, text) => (text === null ? undefined : runsOf(text, this.deps.lang())),
      same: sameRuns,
      settingsKey: () => {
        const s = this.deps.settings();
        return JSON.stringify([classifyKeyOf(s), s.universeMode, s.templatesFolder, this.deps.lang()]);
      },
      start: "demand",
      settleMs: NAMES_SETTLE_MS,
    };
  }

  private changed(changes: readonly IndexChange<NoteRuns>[]): void {
    // a build is announced by onReady, once
    const edits = changes.filter((c) => c.cause !== "build");
    if (edits.length === 0) return;
    if (this.notesByKey) {
      for (const c of edits) {
        const from = c.cause === "rename" && c.from !== undefined ? c.from : c.path;
        for (const k of c.before ?? []) this.notesByKey.get(k)?.delete(from);
        for (const k of c.after ?? []) add(this.notesByKey, k, c.path);
      }
    }
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = this.deps.timers.set(() => {
      this.timer = null;
      this.notify();
    }, NAMES_NOTIFY_MS);
  }

  private notify(): void {
    for (const cb of [...this.listeners]) cb();
  }

  private byKey(): Map<string, Set<string>> {
    if (this.notesByKey) return this.notesByKey;
    const m = new Map<string, Set<string>>();
    for (const [path, keys] of this.index?.entries() ?? []) for (const k of keys) add(m, k, path);
    return (this.notesByKey = m);
  }
}

function add(m: Map<string, Set<string>>, key: string, path: string): void {
  const set = m.get(key);
  if (set) set.add(path);
  else m.set(key, new Set([path]));
}
