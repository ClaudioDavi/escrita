// The note text port (no Obsidian imports). Every Escrita write into a note's
// text goes through one primitive, `apply(plan)`: the plan sees the exact
// current text and answers with one Change against it, or null to refuse.
// Two adapters: the editor (synchronous read + one transaction, so undo keeps
// working and typing can't slip in between) and a vault-like `process()`
// (the plan runs inside it). core/notes.ts picks between them for a TFile.
//
// Anchored changes carry the text they expect plus some context around it, so a
// change computed earlier (a compare view's "Use the old version") can be
// checked against the note as it is now before anything is replaced.

/** Replace `text.slice(from, to)` with `insert`. */
export interface Change { from: number; to: number; insert: string }

/** A change with the current text it expects, plus context, for check-then-replace later. */
export interface AnchoredChange extends Change {
  /** the text at [from, to) when the change was made */
  expected: string;
  /** up to `context` chars of the text right before `from` */
  before: string;
  /** up to `context` chars of the text right after `to` */
  after: string;
}

export type Applied =
  | { ok: true; before: string; after: string; change: Change; via: "editor" | "vault" }
  | { ok: false; current: string; via: "editor" | "vault" };

export interface NoteText {
  readonly via: "editor" | "vault";
  /** What the user sees: the editor buffer (maybe unsaved), else the file on disk (never a cached read). */
  read(): Promise<string>;
  /**
   * plan(current) → a change against exactly `current`, or null to refuse.
   * Atomic: the editor reads and writes synchronously; the vault runs the plan
   * inside process(). An identity change (from === to, insert "") writes
   * nothing and still returns ok.
   */
  apply(plan: (current: string) => Change | null): Promise<Applied>;
}

export interface Pos { line: number; ch: number }

/** The slice of Obsidian's Editor the port needs. */
export interface EditorLike {
  getValue(): string;
  offsetToPos(offset: number): Pos;
  transaction(tx: { changes: { from: Pos; to: Pos; text: string }[] }): void;
}

/** The slice of a vault the port needs, bound to one file. */
export interface VaultIo {
  read(): Promise<string>;
  process(fn: (text: string) => string): Promise<string>;
}

/** A change that leaves the text as it is. */
export function isIdentity(c: Change): boolean {
  return c.from === c.to && c.insert === "";
}

function validFor(text: string, c: Change): boolean {
  return Number.isInteger(c.from) && Number.isInteger(c.to) && c.from >= 0 && c.from <= c.to && c.to <= text.length;
}

/** `text` with the change applied. Throws on offsets outside the text: a plan bug, never silently clamped. */
export function applyChange(text: string, c: Change): string {
  if (!validFor(text, c)) throw new RangeError(`change [${c.from}, ${c.to}) outside a text of length ${text.length}`);
  return text.slice(0, c.from) + c.insert + text.slice(c.to);
}

/** The editor no longer shows the note the port was made for. */
export class EditorMovedError extends Error {
  constructor() {
    super("the editor no longer shows this note");
    this.name = "EditorMovedError";
  }
}

/**
 * Port over an editor. `afterWrite` runs after a real write (reading view:
 * save and re-render). `bound` says whether the editor still shows the note
 * (Obsidian reuses a view's editor when its tab opens another note): when it
 * doesn't, read() rejects and apply() refuses, so a write planned for one note
 * never lands in another.
 */
export function editorText(ed: EditorLike, afterWrite?: () => void, bound: () => boolean = () => true): NoteText {
  return {
    via: "editor",
    read: () => (bound() ? Promise.resolve(ed.getValue()) : Promise.reject(new EditorMovedError())),
    apply(plan) {
      try {
        if (!bound()) return Promise.resolve({ ok: false, current: "", via: "editor" });
        const cur = ed.getValue();
        const c = plan(cur);
        if (c === null) return Promise.resolve({ ok: false, current: cur, via: "editor" });
        if (!validFor(cur, c)) throw new RangeError(`change [${c.from}, ${c.to}) outside a text of length ${cur.length}`);
        const change = { from: c.from, to: c.to, insert: c.insert };
        if (isIdentity(change)) return Promise.resolve({ ok: true, before: cur, after: cur, change, via: "editor" });
        ed.transaction({ changes: [{ from: ed.offsetToPos(c.from), to: ed.offsetToPos(c.to), text: c.insert }] });
        afterWrite?.();
        return Promise.resolve({ ok: true, before: cur, after: ed.getValue(), change, via: "editor" });
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };
}

/** Port over a vault file: the plan runs inside process(), so nothing can write in between. */
export function vaultText(io: VaultIo): NoteText {
  return {
    via: "vault",
    read: () => io.read(),
    async apply(plan) {
      let result: Applied | null = null;
      await io.process((cur) => {
        const c = plan(cur);
        if (c === null) {
          result = { ok: false, current: cur, via: "vault" };
          return cur;
        }
        const change = { from: c.from, to: c.to, insert: c.insert };
        const after = applyChange(cur, change);
        result = { ok: true, before: cur, after, change, via: "vault" };
        return after;
      });
      if (result === null) throw new Error("process() never called the plan");
      return result;
    },
  };
}

/**
 * The smallest single replacement turning `a` into `b`: replace
 * `a.slice(from, to)` with `insert`. Applies whole-text edits through an
 * editor as one small change (keeps undo and the cursor sane).
 */
export function minimalChange(a: string, b: string): Change {
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
  return { from: s, to: ea, insert: b.slice(s, eb) };
}

/** The change that turns `current` into `next` (a whole-text replace, kept small). */
export function wholeText(current: string, next: string): Change {
  return minimalChange(current, next);
}

/** `c` with what it replaces and up to `context` chars around it, for checkedChange later. */
export function anchor(text: string, c: Change, context = 40): AnchoredChange {
  if (!validFor(text, c)) throw new RangeError(`change [${c.from}, ${c.to}) outside a text of length ${text.length}`);
  const n = Math.max(0, Math.floor(context));
  return {
    from: c.from,
    to: c.to,
    insert: c.insert,
    expected: text.slice(c.from, c.to),
    before: text.slice(Math.max(0, c.from - n), c.from),
    after: text.slice(c.to, Math.min(text.length, c.to + n)),
  };
}

/**
 * The anchored change as it applies to `text` now: at its own offsets when the
 * expected text and its context are still there; else at the one place where
 * before + expected + after occurs (offsets shifted); else null (gone, edited,
 * or ambiguous). With an empty anchor only the exact offset counts.
 */
export function checkedChange(text: string, a: AnchoredChange): Change | null {
  const needle = a.before + a.expected + a.after;
  const start = a.from - a.before.length;
  if (start >= 0 && a.from <= a.to && a.to + a.after.length <= text.length && text.slice(start, start + needle.length) === needle) {
    return { from: a.from, to: a.to, insert: a.insert };
  }
  if (needle === "") return null;
  const at = text.indexOf(needle);
  if (at === -1) return null;
  if (text.indexOf(needle, at + 1) !== -1) return null;
  const from = at + a.before.length;
  return { from, to: from + a.expected.length, insert: a.insert };
}

/**
 * The plan for reverting one anchored change from a compare view that showed
 * `shown` as the note's text: refuses as soon as the note differs from what the
 * writer saw (a stale view could otherwise put a short-anchored insert at a
 * shifted offset). Without `shown`, only the anchor is checked.
 */
export function revertPlan(a: AnchoredChange, shown?: string): (text: string) => Change | null {
  return (text) => (shown !== undefined && text !== shown ? null : checkedChange(text, a));
}

/** `text` with the line endings `doc` uses (CRLF when `doc` has any, else LF). */
export function matchLineEndings(text: string, doc: string): string {
  const lf = text.replace(/\r\n/g, "\n");
  return doc.includes("\r\n") ? lf.replace(/\n/g, "\r\n") : lf;
}
