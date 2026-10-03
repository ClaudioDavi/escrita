// The names port: how the lens, the outline and the editor read names without
// importing the universe (0.7 plan Q36). Empty until the universe provides.

import { EMPTY_TABLE, type TermTable } from "./names";

export interface NamesProvider {
  tableFor(path: string): TermTable;                              // the terms of the note's scope
  entryFor(text: string, path: string): { path: string; name: string } | null;  // exact folded name or alias (POV, Q41)
  version(): number;
  onChange(cb: () => void): () => void;
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
