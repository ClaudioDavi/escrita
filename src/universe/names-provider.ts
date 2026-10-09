// The universe as the source of names (0.7 plan Q36, 3.1; no Obsidian imports). It
// answers the names port with one TermTable per scope, built from the entries, and one
// table over every entry for the mentions index.
//
// Scope is read live (Q20), so the provider keeps no scope of its own: `refresh()` is
// called when entries, settings or the notes' properties may have changed. It groups the
// entries by scope once, compares a cheap signature of each group's sources, and compiles
// only a table whose sources changed. A table nobody asked for since the last refresh is
// dropped (its signature stays, so a change is still noticed) and an unchanged table keeps
// its object, so name marks and the lens can compare by version. A thread edit never
// reaches it.

import { compileTerms, EMPTY_TABLE, findNames, foldName, matchLang, titleSet, type NameSource, type TermTable } from "../core/names";
import type { NamesProvider } from "../core/names-source";
import { normalizeWord } from "../core/stem";
import type { Entry } from "./entries";
import type { Scope } from "../core/scope";

export interface NamesProviderDeps {
  entries(): Iterable<Entry>;
  /** the scope of a note, per the current mode (kind none: it has no names) */
  scopeOf(path: string): Scope;
  /** the language setting ("auto", "pt-BR", "en") */
  language(): "auto" | "pt-BR" | "en";
  /** the Obsidian locale, for "auto" */
  locale(): string;
  /** the `nameTitles` setting, one title per line */
  nameTitles(): string;
  /** quiet time for `refreshSoon` (the metadata cache fires on every save); without it `refreshSoon` refreshes at once */
  timers?: { set(cb: () => void, ms: number): unknown; clear(h: unknown): void };
  /** opens the create-entry dialog for a name found in the note at `from` (the lens's "Create entry") */
  createEntry?(name: string, from: string): void;
  /** the on-demand names index behind `workCount` and `wantNameCounts` (universe/names-index.ts); without it the counts are 0 */
  counts?: { want(): void; count(text: string, path: string): number; ready(): boolean };
}

/** Quiet time before a metadata change refreshes the tables (finding 1). */
export const REFRESH_SOON_MS = 300;

type Opts = { lang: ReturnType<typeof matchLang>; extraTitles: string[] };

/** A cheap stand-in for compiling: equal when the sources and options are. */
const sigOf = (sources: readonly NameSource[], o: Opts): string => JSON.stringify([o.lang, o.extraTitles, sources]);

const scopeKey = (s: Scope): string => `${s.kind}\u0000${s.root}`;

export function sourceOf(e: Entry): NameSource {
  return {
    id: e.path, name: e.name, aliases: e.aliases, person: e.kind === "character",
    firstName: e.firstName, caseSensitive: e.caseSensitive, ignore: e.ignore,
  };
}

export class UniverseNamesProvider implements NamesProvider {
  private bump = 0;
  private countsBump = 0;
  private countListeners = new Set<() => void>();
  private listeners = new Set<() => void>();
  private allScopes: { sig: string; table: TermTable } | null = null;
  /** scope key -> its entries, signature and (while asked for) table; kept current by refresh() */
  private scopes = new Map<string, ScopeRec>();
  /** entries grouped by scope, valid until the next refresh() */
  private groups: Map<string, Entry[]> | null = null;
  private timer: unknown = null;
  private titleCache: { sig: string; set: Set<string> } | null = null;
  /** how many times a table was compiled (tests read it) */
  compiled = 0;

  constructor(private deps: NamesProviderDeps) {}

  private options(): Opts {
    const d = this.deps;
    return {
      lang: matchLang(d.language(), d.locale()),
      extraTitles: d.nameTitles().split(/\r?\n/).map((x) => x.trim()).filter((x) => x !== ""),
    };
  }

  /** The name titles for the current options, rebuilt only when the language or the setting changes. */
  private titles(): Set<string> {
    const o = this.options();
    const sig = JSON.stringify([o.lang, o.extraTitles]);
    if (this.titleCache?.sig !== sig) this.titleCache = { sig, set: titleSet(o.lang, o.extraTitles) };
    return this.titleCache.set;
  }

  private compile(sources: NameSource[], o: Opts): TermTable {
    this.compiled++;
    return compileTerms(sources, o);
  }

  private partition(): Map<string, Entry[]> {
    if (this.groups) return this.groups;
    const by = new Map<string, Entry[]>();
    for (const e of this.deps.entries()) {
      const s = this.deps.scopeOf(e.path);
      if (s.kind === "none") continue;
      const k = scopeKey(s);
      const list = by.get(k);
      if (list) list.push(e);
      else by.set(k, [e]);
    }
    return (this.groups = by);
  }

  private rec(scope: Scope): ScopeRec {
    const key = scopeKey(scope);
    let r = this.scopes.get(key);
    if (!r) {
      const entries = this.partition().get(key) ?? [];
      this.groups = null;   // scope is read live: don't trust this grouping for the next ask
      r = { scope, entries, sig: sigOf(entries.map(sourceOf), this.options()), table: null, lookup: null, asked: false };
      this.scopes.set(key, r);
    }
    return r;
  }

  /** One table over every entry, whatever its scope: what the mentions index matches with. */
  globalTable(): TermTable {
    if (!this.allScopes) {
      const sources = [...this.deps.entries()].map(sourceOf);
      const o = this.options();
      this.allScopes = { sig: sigOf(sources, o), table: this.compile(sources, o) };
    }
    return this.allScopes.table;
  }

  tableFor(path: string): TermTable {
    const scope = this.deps.scopeOf(path);
    if (scope.kind === "none") return EMPTY_TABLE;
    const r = this.rec(scope);
    r.asked = true;
    return (r.table ??= this.compile(r.entries.map(sourceOf), this.options()));
  }

  entryFor(text: string, path: string): { path: string; name: string } | null {
    const scope = this.deps.scopeOf(path);
    if (scope.kind === "none") return null;
    const want = foldName(text);
    if (want === "") return null;
    const r = this.rec(scope);
    return (r.lookup ??= lookupOf(r.entries)).get(want) ?? null;
  }

  /**
   * The lens's names rule (0.9, Q18): is `text`, a run as written, already a name in the scope
   * of the note: an occurrence of a term (name, alias, automatic first name) covering all of
   * it, or a name title (built in, plus the "Name titles" setting).
   */
  isKnownName(text: string, path: string): boolean {
    const run = text.trim();
    if (run === "") return true;
    if (this.titles().has(normalizeWord(run))) return true;
    const table = this.tableFor(path);
    if (table === EMPTY_TABLE) return false;
    return findNames(run, table).some((x) => x.from === 0 && x.to === run.length);
  }

  workCount(text: string, path: string): number {
    return this.deps.counts?.count(text, path) ?? 0;
  }

  wantNameCounts(): void {
    this.deps.counts?.want();
  }

  nameCountsReady(): boolean {
    return this.deps.counts?.ready() ?? false;
  }

  createEntry(name: string, from: string): void {
    this.deps.createEntry?.(name, from);
  }

  /** The cross-work counts changed (the names index was built, or a note's runs changed): only the counts signal fires, so the lens runs its rule again and nothing else refreshes. */
  countsChanged(): void {
    this.countsBump++;
    for (const cb of [...this.countListeners]) cb();
  }

  countsVersion(): number {
    return this.countsBump;
  }

  onCountsChange(cb: () => void): () => void {
    this.countListeners.add(cb);
    return () => { this.countListeners.delete(cb); };
  }

  version(): number {
    return this.bump;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** `refresh()` after a quiet time: for the metadata cache, which fires on every save. */
  refreshSoon(): void {
    const timers = this.deps.timers;
    if (!timers) { this.refresh(); return; }
    if (this.timer !== null) timers.clear(this.timer);
    this.timer = timers.set(() => { this.timer = null; this.refresh(); }, REFRESH_SOON_MS);
  }

  dispose(): void {
    if (this.timer !== null) this.deps.timers?.clear(this.timer);
    this.timer = null;
    this.listeners.clear();
    this.countListeners.clear();
  }

  /**
   * Re-reads the entries. Compiles a table only when its sources' signature changed, keeps
   * the old object when the compiled signature is the same, drops the tables nobody asked for
   * since the last refresh, and bumps the version (calling the listeners) only when a
   * table's signature changed.
   */
  refresh(): void {
    if (this.timer !== null) {
      this.deps.timers?.clear(this.timer);
      this.timer = null;
    }
    this.groups = null;
    const o = this.options();
    let changed = false;
    if (this.allScopes) {
      const sources = [...this.deps.entries()].map(sourceOf);
      const sig = sigOf(sources, o);
      if (sig !== this.allScopes.sig) {
        const next = this.compile(sources, o);
        if (next.signature !== this.allScopes.table.signature) {
          this.allScopes.table = next;
          changed = true;
        }
        this.allScopes.sig = sig;
      }
    }
    if (this.scopes.size > 0) {
      const groups = this.partition();
      for (const [key, r] of this.scopes) {
        const entries = groups.get(key) ?? [];
        const sources = entries.map(sourceOf);
        const sig = sigOf(sources, o);
        if (sig !== r.sig) {
          r.entries = entries;
          r.lookup = null;
          r.sig = sig;
          if (r.table) {
            const next = this.compile(sources, o);
            if (next.signature !== r.table.signature) {
              r.table = next;
              changed = true;
            }
          } else {
            changed = true;   // nobody holds a table, but a pass keyed on the version may
          }
        }
        if (!r.asked) r.table = null;
        r.asked = false;
      }
    }
    this.groups = null;
    if (!changed) return;
    this.bump++;
    for (const cb of [...this.listeners]) cb();
  }
}

interface ScopeRec {
  scope: Scope;
  entries: Entry[];
  sig: string;
  /** null until asked for, and after a refresh nobody asked in */
  table: TermTable | null;
  /** foldName of a name or alias to its entry, built on the first entryFor */
  lookup: Map<string, { path: string; name: string }> | null;
  asked: boolean;
}

/** A name beats an alias; among equals the first entry wins (the order a linear scan would find). */
function lookupOf(entries: readonly Entry[]): Map<string, { path: string; name: string }> {
  const out = new Map<string, { path: string; name: string }>();
  for (const e of entries) {
    const k = foldName(e.name);
    if (k !== "" && !out.has(k)) out.set(k, { path: e.path, name: e.name });
  }
  for (const e of entries) {
    for (const a of e.aliases) {
      const k = foldName(a);
      if (k !== "" && !out.has(k)) out.set(k, { path: e.path, name: e.name });
    }
  }
  return out;
}
