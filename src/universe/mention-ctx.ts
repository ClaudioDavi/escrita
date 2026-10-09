// The MentionCtx the mentions index answers with (0.7 plan Q20, Q31, Q32): live scope,
// which work a note belongs to and where that work stands in the Works tab. No Obsidian
// imports: the universe module feeds the deps, tests feed a MemoryVault-backed set.
//
// Scope is read live and never stored (Q20), so the factory memoizes it per path until
// `reset()`, which the module calls when a `universe` property, the structure, the settings
// or the works change.

import type { MentionCtx } from "./mentions";
import { sameScope, type Scope } from "../core/scope";
import { inScope } from "./threads";
import { groupWorks, type WorkInfo } from "./works-list";

export interface MentionCtxDeps {
  /** the scope of a note, per the current mode and its book and universe property */
  scopeOf(path: string): Scope;
  /** a link path resolved from a note, or null */
  resolve(linkpath: string, from: string): string | null;
  /** what the note is in a book: a chapter or the book note itself, with the book note's path; null for anything else */
  place(path: string): { kind: "chapter" | "book-note"; book: string } | null;
  /** the chapters of a book, in order (their paths) */
  chapters(book: string): string[];
  /** whether the path is a work: a book note or a tracked standalone note with a known stage, never an entry */
  isWork(path: string): boolean;
  /** the works of a scope (UniverseModule.worksIn) */
  worksIn(scope: Scope): WorkInfo[];
}

const key = (s: Scope): string => `${s.kind}\u0000${s.root}`;

export class MentionCtxFactory {
  private scopes = new Map<string, Scope>();
  private chapterAt = new Map<string, Map<string, number>>();
  private ranks = new Map<string, Map<string, number>>();

  constructor(private deps: MentionCtxDeps) {}

  /** Forget everything read from the vault: the next answer reads it again. */
  reset(): void {
    this.scopes.clear();
    this.chapterAt.clear();
    this.ranks.clear();
  }

  private scope(path: string): Scope {
    let s = this.scopes.get(path);
    if (!s) {
      s = this.deps.scopeOf(path);
      this.scopes.set(path, s);
    }
    return s;
  }

  private chapterIndex(book: string, path: string): number | null {
    let m = this.chapterAt.get(book);
    if (!m) {
      m = new Map(this.deps.chapters(book).map((p, i) => [p, i + 1]));
      this.chapterAt.set(book, m);
    }
    return m.get(path) ?? null;
  }

  private rankOf(scope: Scope): Map<string, number> {
    const k = key(scope);
    let m = this.ranks.get(k);
    if (!m) {
      m = new Map();
      let i = 0;
      for (const g of groupWorks(this.deps.worksIn(scope))) for (const w of g.works) m.set(w.path, i++);
      this.ranks.set(k, m);
    }
    return m;
  }

  ctx(entry: string): MentionCtx {
    const own = this.scope(entry);
    const d = this.deps;
    return {
      entry,
      inScope: (note) => inScope(this.scope(note), own),
      candidateInScope: (note, id) => {
        const s = this.scope(note);
        return s.kind !== "none" && sameScope(this.scope(id), s);
      },
      resolve: (linkpath, from) => d.resolve(linkpath, from),
      workOf: (note) => {
        const p = d.place(note);
        if (p && d.isWork(p.book)) {
          return p.kind === "book-note" ? { work: p.book, chapter: null } : { work: p.book, chapter: this.chapterIndex(p.book, note) };
        }
        if (!p && d.isWork(note)) return { work: note, chapter: null };
        return null;
      },
      workRank: (work) => this.rankOf(own).get(work) ?? Number.MAX_SAFE_INTEGER,
    };
  }
}
