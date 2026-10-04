// The universe as the source of names (0.7 plan Q36, 3.1; no Obsidian imports). It
// answers the names port with one TermTable per scope, built from the entries, and one
// table over every entry for the mentions index.
//
// Scope is read live (Q20), so the provider keeps no scope of its own: `refresh()` is
// called when entries, settings or the notes' properties may have changed, rebuilds
// what was asked for, and bumps `version()` only when a table's signature changed. A
// thread edit never reaches it.

import { compileTerms, EMPTY_TABLE, foldName, matchLang, type NameSource, type TermTable } from "../core/names";
import type { NamesProvider } from "../core/names-source";
import type { Entry } from "./entries";
import { sameScope, type Scope } from "./scope";

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
}

const scopeKey = (s: Scope): string => `${s.kind}\u0000${s.root}`;

export function sourceOf(e: Entry): NameSource {
  return {
    id: e.path, name: e.name, aliases: e.aliases, person: e.kind === "character",
    firstName: e.firstName, caseSensitive: e.caseSensitive, ignore: e.ignore,
  };
}

export class UniverseNamesProvider implements NamesProvider {
  private bump = 0;
  private listeners = new Set<() => void>();
  private global: TermTable | null = null;
  /** scope key -> its scope and table, filled on demand and kept current by refresh() */
  private scopes = new Map<string, { scope: Scope; table: TermTable }>();

  constructor(private deps: NamesProviderDeps) {}

  private options(): { lang: ReturnType<typeof matchLang>; extraTitles: string[] } {
    const d = this.deps;
    return {
      lang: matchLang(d.language(), d.locale()),
      extraTitles: d.nameTitles().split(/\r?\n/).map((x) => x.trim()).filter((x) => x !== ""),
    };
  }

  private buildGlobal(): TermTable {
    return compileTerms([...this.deps.entries()].map(sourceOf), this.options());
  }

  private buildScope(scope: Scope): TermTable {
    if (scope.kind === "none") return EMPTY_TABLE;
    const sources: NameSource[] = [];
    for (const e of this.deps.entries()) if (sameScope(this.deps.scopeOf(e.path), scope)) sources.push(sourceOf(e));
    return compileTerms(sources, this.options());
  }

  /** One table over every entry, whatever its scope: what the mentions index matches with. */
  globalTable(): TermTable {
    return (this.global ??= this.buildGlobal());
  }

  tableFor(path: string): TermTable {
    const scope = this.deps.scopeOf(path);
    if (scope.kind === "none") return EMPTY_TABLE;
    const key = scopeKey(scope);
    let hit = this.scopes.get(key);
    if (!hit) {
      hit = { scope, table: this.buildScope(scope) };
      this.scopes.set(key, hit);
    }
    return hit.table;
  }

  entryFor(text: string, path: string): { path: string; name: string } | null {
    const scope = this.deps.scopeOf(path);
    if (scope.kind === "none") return null;
    const want = foldName(text);
    if (want === "") return null;
    let alias: Entry | null = null;
    for (const e of this.deps.entries()) {
      if (!sameScope(this.deps.scopeOf(e.path), scope)) continue;
      if (foldName(e.name) === want) return { path: e.path, name: e.name };
      if (!alias && e.aliases.some((a) => foldName(a) === want)) alias = e;
    }
    return alias ? { path: alias.path, name: alias.name } : null;
  }

  version(): number {
    return this.bump;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /**
   * Rebuilds the global table and every scope table asked for so far; bumps the version and
   * calls the listeners only when one of their signatures changed.
   */
  refresh(): void {
    let changed = false;
    if (this.global) {
      const next = this.buildGlobal();
      if (next.signature !== this.global.signature) changed = true;
      this.global = next;
    }
    for (const [key, hit] of [...this.scopes]) {
      // an entry moving between scopes changes the tables of both; a scope nobody asks for again is dropped
      const next = this.buildScope(hit.scope);
      if (next.signature !== hit.table.signature) changed = true;
      this.scopes.set(key, { scope: hit.scope, table: next });
    }
    if (!changed) return;
    this.bump++;
    for (const cb of [...this.listeners]) cb();
  }
}
