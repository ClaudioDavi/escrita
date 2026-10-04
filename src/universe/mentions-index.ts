// The mentions index (0.7 plan 3.2, Q31, Q33): a content index over the notes that may
// mention an entry, and the per-entry reads the Entries tab and the entry note use.
// No Obsidian imports: the hub's `add`, `rebuild`, link resolution and time come in
// through `MentionsDeps`, so it is tested on MemoryVault and ManualTimers.

import { segment } from "../core/markdown";
import { findNames, type TermTable } from "../core/names";
import type { IndexFile, IndexSpec, IndexTimers, VaultIndex } from "../core/vault-index";
import { isUniverseNote, type EntriesSettings } from "./entries";
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

/** What decides which notes the index scans, apart from the table. */
function includeKey(s: EntriesSettings): string {
  return JSON.stringify([
    s.universeMode, s.snapshotsFolder, s.templatesFolder, s.chapterTemplate,
    Object.values(s.entryTypes).map((t) => t.template),
  ]);
}

export class MentionsIndex<F extends IndexFile> {
  private index: VaultIndex<F, NoteMentions> | null = null;
  private lastSignature = "";
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  private notesByEntry: Map<string, string[]> | null = null;
  private notesByLink: Map<string, string[]> | null = null;
  private answers = new Map<string, AppearsIn>();

  constructor(private deps: MentionsDeps<F>) {}

  /**
   * Adds the content spec. Call it once the entries index is ready and the provider has its
   * first table, so startup does one full build, not one against an empty table and a
   * second 2 s later (the hub builds a content spec at layout ready). Safe to call twice.
   */
  start(): void {
    if (this.index) return;
    this.lastSignature = this.deps.table().signature;
    const index = this.deps.add(this.spec());
    this.index = index;
    this.stops.push(
      index.onChange(() => this.changed()),
      index.onReady(() => this.changed()),
    );
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
   * Before `start` it does nothing: the first build reads the table as it is then.
   */
  tableChanged(): void {
    if (!this.index) return;
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = this.deps.timers.set(() => {
      this.timer = null;
      const sig = this.deps.table().signature;
      if (sig === this.lastSignature) return;
      this.lastSignature = sig;
      this.deps.rebuild(MENTIONS_INDEX_NAME);
    }, TABLE_REBUILD_MS);
  }

  /** Metadata or structure changed (a link target, a book note's `universe`): the memos go. */
  scopeChanged(): void {
    this.notesByLink = null;
    this.answers.clear();
  }

  /** The entry's mentions grouped for display; the same object until the next change. */
  appearsIn(entry: string, ctx: MentionCtx): AppearsIn {
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
    this.listeners.clear();
    this.notesByEntry = null;
    this.notesByLink = null;
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
    };
  }

  private changed(): void {
    this.notesByEntry = null;
    this.notesByLink = null;
    this.answers.clear();
    for (const cb of [...this.listeners]) cb();
  }

  /**
   * The inverted lists, built once per index change: which notes have a candidate for an
   * entry (not filtered by scope, so a scope change leaves it valid), and which notes link
   * to it (resolved once per metadata or structure change). A query then reads only the
   * notes that mention the entry, not every occurrence of every note.
   */
  private candidateNotes(entry: string): Set<string> {
    const out = new Set<string>(this.byEntry().get(entry));
    for (const p of this.byLink().get(entry) ?? []) out.add(p);
    return out;
  }

  private byEntry(): Map<string, string[]> {
    if (this.notesByEntry) return this.notesByEntry;
    const m = new Map<string, string[]>();
    for (const [path, nm] of this.index?.entries() ?? []) {
      const seen = new Set<string>();
      for (const o of nm.occurrences) for (const c of o.candidates) seen.add(c.id);
      for (const id of seen) {
        const list = m.get(id);
        if (list) list.push(path);
        else m.set(id, [path]);
      }
    }
    return (this.notesByEntry = m);
  }

  private byLink(): Map<string, string[]> {
    if (this.notesByLink) return this.notesByLink;
    const m = new Map<string, string[]>();
    for (const [path, nm] of this.index?.entries() ?? []) {
      const seen = new Set<string>();
      for (const l of nm.links) {
        const to = this.deps.resolve(l.linkpath, path);
        if (to) seen.add(to);
      }
      for (const to of seen) {
        const list = m.get(to);
        if (list) list.push(path);
        else m.set(to, [path]);
      }
    }
    return (this.notesByLink = m);
  }
}
