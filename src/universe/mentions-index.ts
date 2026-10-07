// The mentions index (0.7 plan 3.2, Q31, Q33): a content index over the notes that may
// mention an entry, and the per-entry reads the Entries tab and the entry note use.
// No Obsidian imports: the hub's `add`, `rebuild`, link resolution and time come in
// through `MentionsDeps`, so it is tested on MemoryVault and ManualTimers.

import { segment } from "../core/markdown";
import { findNames, type TermTable } from "../core/names";
import type { IndexChange, IndexFile, IndexSpec, IndexTimers, VaultIndex } from "../core/vault-index";
import { classifyKeyOf, isUniverseNote, type EntriesSettings } from "./entries";
import {
  appearsIn as appearsInOf,
  computeMentions,
  mentionsSame,
  type AppearsIn,
  type MentionCtx,
  type NoteMentions,
} from "./mentions";

export const MENTIONS_INDEX_NAME = "universe-mentions";

/** Q33: the quiet time after a term table change before the index rebuilds. */
export const TABLE_REBUILD_MS = 2000;

export interface MentionsDeps<F extends IndexFile> {
  add(spec: IndexSpec<F, NoteMentions>): VaultIndex<F, NoteMentions>;
  /** takes the index out of the hub (module unload); optional in tests */
  remove?(index: VaultIndex<F, NoteMentions>): void;
  /** `plugin.index.rebuild(name)` */
  rebuild(name: string): void;
  /** the global term table (the provider's `globalTable()`), read live */
  table(): TermTable;
  settings(): EntriesSettings;
  /** a link path to a note path, from a note (`getFirstLinkpathDest`); null when it resolves to nothing */
  resolve(linkpath: string, from: string): string | null;
  timers: IndexTimers;
}

/** Q15 / IMPROVEMENTS 21: the quiet time after a modify; a mention count can wait while the writer types. */
export const MENTIONS_SETTLE_MS = 4000;

/** What decides which notes the index scans, apart from the table. */
function includeKey(s: EntriesSettings): string {
  return JSON.stringify([
    classifyKeyOf(s), s.universeMode, s.templatesFolder,
    Object.values(s.entryTypes).map((t) => t.template),
  ]);
}

export class MentionsIndex<F extends IndexFile> {
  private index: VaultIndex<F, NoteMentions> | null = null;
  /** something asked for the counts (Q15): the first query, a panel tab, an entry note. Kept until `start`. */
  private wanted = false;
  private lastSignature = "";
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  /** entry path -> the notes with a candidate for it; kept current note by note */
  private notesByEntry: Map<string, Set<string>> | null = null;
  /** entry path -> the notes that link to it; cleared only by scopeChanged() and a build */
  private notesByLink: Map<string, Set<string>> | null = null;
  /** note -> what its links resolved to when notesByLink was built (so an edit can take them out) */
  private linkTargets = new Map<string, string[]>();
  private answers = new Map<string, AppearsIn>();
  private demanded = false;

  constructor(private deps: MentionsDeps<F>) {}

  /**
   * Adds the content spec. Call it once the entries index is ready and the provider has its
   * first table, so startup does one full build, not one against an empty table and a
   * second 2 s later. The spec starts on demand (Q15): adding it builds nothing until
   * `demand()` (a demand made before `start` is kept and fires here). Safe to call twice.
   */
  start(): void {
    if (this.index) return;
    this.lastSignature = this.deps.table().signature;
    const index = this.deps.add(this.spec());
    this.index = index;
    this.stops.push(
      index.onChange((c) => this.changed(c)),
      index.onReady(() => this.changed(null)),
    );
    if (this.wanted) this.demand();
  }

  /**
   * Asks for the counts (Q15): the first `appearsIn` or `workCount` query, opening the panel's
   * Works or entry tab, an entry note becoming active. The first call builds the index;
   * later calls do nothing. Surfaces show their "counting" state until `isReady()`.
   */
  demand(): void {
    this.wanted = true;
    const index = this.index;
    if (!index || this.demanded) return;
    this.demanded = true;
    // the first build reads the table as it is now
    this.lastSignature = this.deps.table().signature;
    index.demand();
  }

  get started(): boolean { return this.index !== null; }
  isReady(): boolean { return this.index?.isReady() ?? false; }

  /** Fires when the stored mentions change (a build, an edit, a rename, a delete). */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  get(path: string): NoteMentions | undefined { return this.index?.get(path); }

  /**
   * The term table may have changed. Debounced 2 s; then rebuilds when the table's signature
   * differs from the last build's (Q33). Old values stay visible until the new build is done.
   * Before the first demand it does nothing: the first build reads the table as it is then.
   */
  tableChanged(): void {
    if (!this.index || !this.demanded) return;
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = this.deps.timers.set(() => {
      this.timer = null;
      const sig = this.deps.table().signature;
      if (sig === this.lastSignature) return;
      this.lastSignature = sig;
      this.deps.rebuild(MENTIONS_INDEX_NAME);
    }, TABLE_REBUILD_MS);
  }

  /**
   * Scope or structure changed (a note created, deleted or renamed, a `universe` property): the
   * grouped answers and the resolved links go. An ordinary edit never calls this; the index's
   * own changes update the lookup maps for the changed note only.
   */
  scopeChanged(): void {
    this.notesByLink = null;
    this.linkTargets.clear();
    this.answers.clear();
  }

  /** Something outside the index that the answers read changed (the works' order or stages): only the answers go. */
  answersChanged(): void {
    this.answers.clear();
  }

  /** The entry's mentions grouped for display; the same object until the next change. */
  appearsIn(entry: string, ctx: MentionCtx): AppearsIn {
    this.demand();
    const hit = this.answers.get(entry);
    if (hit) return hit;
    const index = this.index;
    const all: [string, NoteMentions][] = [];
    if (index) {
      for (const p of this.candidateNotes(entry)) {
        const nm = index.get(p);
        if (nm) all.push([p, nm]);
      }
    }
    const out = appearsInOf(all, ctx);
    this.answers.set(entry, out);
    return out;
  }

  /** The number of works the entry appears in (zero while not ready). */
  workCount(entry: string, ctx: MentionCtx): number {
    return this.appearsIn(entry, ctx).workCount;
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
    this.notesByEntry = null;
    this.notesByLink = null;
    this.linkTargets.clear();
    this.answers.clear();
  }

  // ------------------------------------------------------------------ internals

  private spec(): IndexSpec<F, NoteMentions> {
    return {
      name: MENTIONS_INDEX_NAME,
      mode: "content",
      include: (f) => this.deps.settings().universeMode !== "off" && isUniverseNote(f, this.deps.settings()),
      compute: (_f, text) => {
        if (text === null) return undefined;
        const nm = computeMentions(segment(text), (m) => findNames(m, this.deps.table()));
        return nm.occurrences.length === 0 && nm.links.length === 0 ? undefined : nm;   // Q31
      },
      same: mentionsSame,
      settingsKey: () => includeKey(this.deps.settings()),
      start: "demand",
      settleMs: MENTIONS_SETTLE_MS,
    };
  }

  /** `changes` null: a build finished, nothing is known about which notes moved. */
  private changed(changes: readonly IndexChange<NoteMentions>[] | null): void {
    if (!changes || changes.some((c) => c.cause === "build")) {
      this.notesByEntry = null;
      this.notesByLink = null;
      this.linkTargets.clear();
      this.answers.clear();
    } else {
      for (const c of changes) {
        this.detach(c.cause === "rename" && c.from !== undefined ? c.from : c.path, c.before);
        if (c.after) this.attach(c.path, c.after);
      }
    }
    for (const cb of [...this.listeners]) cb();
  }

  private detach(path: string, before: NoteMentions | undefined): void {
    if (this.notesByEntry && before) {
      for (const id of idsOf(before)) {
        this.notesByEntry.get(id)?.delete(path);
        this.answers.delete(id);
      }
    }
    if (this.notesByLink) {
      for (const to of this.linkTargets.get(path) ?? []) {
        this.notesByLink.get(to)?.delete(path);
        this.answers.delete(to);
      }
    }
    this.linkTargets.delete(path);
  }

  private attach(path: string, after: NoteMentions): void {
    if (this.notesByEntry) {
      for (const id of idsOf(after)) {
        add(this.notesByEntry, id, path);
        this.answers.delete(id);
      }
    }
    if (this.notesByLink) {
      const targets = this.resolved(path, after);
      this.linkTargets.set(path, targets);
      for (const to of targets) {
        add(this.notesByLink, to, path);
        this.answers.delete(to);
      }
    }
  }

  private resolved(path: string, nm: NoteMentions): string[] {
    const seen = new Set<string>();
    for (const l of nm.links) {
      const to = this.deps.resolve(l.linkpath, path);
      if (to) seen.add(to);
    }
    return [...seen];
  }

  /**
   * The inverted lists, built once and then kept current note by note: which notes have a
   * candidate for an entry (not filtered by scope, so a scope change leaves it valid), and
   * which notes link to it (resolved once per scope or structure change). A query then reads
   * only the notes that mention the entry, not every occurrence of every note.
   */
  private candidateNotes(entry: string): Set<string> {
    const out = new Set<string>(this.byEntry().get(entry));
    for (const p of this.byLink().get(entry) ?? []) out.add(p);
    return out;
  }

  private byEntry(): Map<string, Set<string>> {
    if (this.notesByEntry) return this.notesByEntry;
    const m = new Map<string, Set<string>>();
    for (const [path, nm] of this.index?.entries() ?? []) for (const id of idsOf(nm)) add(m, id, path);
    return (this.notesByEntry = m);
  }

  private byLink(): Map<string, Set<string>> {
    if (this.notesByLink) return this.notesByLink;
    const m = new Map<string, Set<string>>();
    this.linkTargets.clear();
    for (const [path, nm] of this.index?.entries() ?? []) {
      const targets = this.resolved(path, nm);
      if (targets.length === 0) continue;
      this.linkTargets.set(path, targets);
      for (const to of targets) add(m, to, path);
    }
    return (this.notesByLink = m);
  }
}

function idsOf(nm: NoteMentions): Set<string> {
  const ids = new Set<string>();
  for (const o of nm.occurrences) for (const c of o.candidates) ids.add(c.id);
  return ids;
}

function add(m: Map<string, Set<string>>, key: string, path: string): void {
  const set = m.get(key);
  if (set) set.add(path);
  else m.set(key, new Set([path]));
}
