// The names port: how the lens, the outline and the editor read names without
// importing the universe (0.7 plan Q36). Empty until the universe provides.

import { EMPTY_TABLE, type TermTable } from "./names";

/**
 * A source of names. Any change to what `tableFor` or `entryFor` answers must call the
 * `onChange` callbacks: the port's `version()` only grows then, and the lens keys its
 * passes on it.
 */
export interface NamesProvider {
  tableFor(path: string): TermTable;                              // the terms of the note's scope
  entryFor(text: string, path: string): { path: string; name: string } | null;  // name or alias whose foldName form equals foldName(text) (POV, Q41)
  version(): number;
  onChange(cb: () => void): () => void;
  /*
   * What the lens's "names without an entry" rule reads (0.9, PLAN-0.9 Q2-Q4, Q18). Optional:
   * a provider without them answers "not known", 0 and a no-op through the port. The
   * universe's provider adds them (task 2.3, backed by the on-demand `universe-names`
   * index, universe/names-index.ts).
   */
  /**
   * Whether `text` (one word or a run of words, as written) is already a name in the
   * scope of the note at `path`: a term of tableFor(path) (an entry's name, alias or
   * automatic first name), or a name title (core/name-titles plus the "Name titles"
   * setting), compared by foldName of the whole text. The lens's own names list and
   * the "Not names" setting are the rule's to check, not the provider's.
   */
  isKnownName?(text: string, path: string): boolean;
  /**
   * In how many works of the scope of `path` the capitalized run `text` appears, the
   * note's own work included: the runs core/name-runs.ts `nameRuns` finds over
   * `namesMask` (never frontmatter, code, comments or headings), keyed by foldName. 0 when
   * the index hasn't been built yet, is still building, or the run appears nowhere.
   * A change to these counts calls the `onChange` callbacks, so the lens's pass key
   * (built on `version()`) re-runs the rule. Every names consumer (name marks,
   * spellcheck, the outline) refreshes on `onChange`, so the index calls it once when
   * its build finishes and, after that, only when a work's set of runs changes,
   * debounced: never once per file while it builds.
   */
  workCount?(text: string, path: string): number;
  /**
   * Ask for the on-demand `universe-names` index (Q3): the first call starts it, later
   * calls do nothing. The rule calls it when it runs; nothing else starts the index, so
   * a writer who never turns the rule on never pays for it.
   */
  wantNameCounts?(): void;
}

/** plugin.names: empty until the universe provides; the provider withdraws on unload. */
export class NamesPort implements NamesProvider {
  private provider: NamesProvider | null = null;
  private listeners = new Set<() => void>();
  private stopForwarding: (() => void) | null = null;
  private bump = 0;

  /** Install a provider; returns the function that withdraws it. */
  provide(p: NamesProvider): () => void {
    this.stopForwarding?.();
    this.provider = p;
    this.stopForwarding = p.onChange(() => this.changed());
    this.changed();
    return () => {
      if (this.provider !== p) return;
      this.stopForwarding?.();
      this.stopForwarding = null;
      this.provider = null;
      this.changed();
    };
  }

  tableFor(path: string): TermTable {
    return this.provider ? this.provider.tableFor(path) : EMPTY_TABLE;
  }

  entryFor(text: string, path: string): { path: string; name: string } | null {
    return this.provider ? this.provider.entryFor(text, path) : null;
  }

  /** False when the universe is off (no provider) or the provider doesn't answer it. */
  isKnownName(text: string, path: string): boolean {
    return this.provider?.isKnownName?.(text, path) ?? false;
  }

  /** 0 when the universe is off (no provider) or the provider doesn't answer it. */
  workCount(text: string, path: string): number {
    return this.provider?.workCount?.(text, path) ?? 0;
  }

  /** A no-op when the universe is off (no provider). */
  wantNameCounts(): void {
    this.provider?.wantNameCounts?.();
  }

  /** True while a provider is installed (the universe is on): the names rule needs it (Q2). */
  hasProvider(): boolean {
    return this.provider !== null;
  }

  /** Grows on every provide, withdraw and provider change, so a pass key built on it never repeats. */
  version(): number {
    return this.bump;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private changed(): void {
    this.bump++;
    for (const cb of [...this.listeners]) cb();
  }
}
