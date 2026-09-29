import { describe, it, expect } from "vitest";
import { insertFirstBeat, insertBeat, setBeatText, removeBeat } from "../src/outline/beats-edit";
import {
  resolveTarget, decideNoteKey, decideKey, noteGoal, type TargetInput, type OutlineTarget, type KeyInput,
} from "../src/outline/model";
import { parseBeats } from "../src/core/markers";

const B = (s: string) => `%% beat: ${s} %%`;
const L = (...lines: string[]) => lines.join("\n");

describe("insertFirstBeat", () => {
  it("fills an empty note", () => {
    expect(insertFirstBeat("", "a")).toBe(B("a"));
    expect(insertFirstBeat("\n", "a")).toBe(B("a") + "\n");
    expect(insertFirstBeat("", "")).toBe("%% beat:  %%");
  });

  it("goes after the frontmatter", () => {
    expect(insertFirstBeat("---\ntarget: 3000\n---\n", "a")).toBe(L("---", "target: 3000", "---", B("a")) + "\n");
    expect(insertFirstBeat("---\ntarget: 3000\n---\n\n\n", "a")).toBe(L("---", "target: 3000", "---", B("a")) + "\n");
  });

  it("opens the first scene: prose already there becomes the beat's scene", () => {
    const out = insertFirstBeat(L("---", "x: 1", "---", "", "Era uma vez.", "", "Fim."), "Abertura");
    expect(out).toBe(L("---", "x: 1", "---", "", B("Abertura"), "", "Era uma vez.", "", "Fim."));
    const beats = parseBeats(out);
    expect(beats).toHaveLength(1);
    expect(beats[0].written).toBe(true);
  });

  it("goes after a leading title heading", () => {
    expect(insertFirstBeat(L("# O conto", "", "Prosa."), "a")).toBe(L("# O conto", "", B("a"), "", "Prosa."));
    expect(insertFirstBeat(L("# O conto", "Prosa."), "a")).toBe(L("# O conto", "", B("a"), "", "Prosa."));
    expect(insertFirstBeat(L("# O conto", ""), "a")).toBe(L("# O conto", "", B("a")) + "\n");
  });

  it("never loses prose and keeps CRLF", () => {
    const t = "---\r\nx: 1\r\n---\r\nUm.\r\n\r\nDois.\r\n";
    const out = insertFirstBeat(t, "a");
    expect(out).toBe("---\r\nx: 1\r\n---\r\n%% beat: a %%\r\n\r\nUm.\r\n\r\nDois.\r\n");
  });

  it("with beats already there, adds one before the first", () => {
    const t = L(B("b"), "Prose.");
    expect(insertFirstBeat(t, "a")).toBe(insertBeat(t, -1, "a"));
    expect(parseBeats(insertFirstBeat(t, "a")).map((b) => b.text)).toEqual(["a", "b"]);
  });

  it("a conto with three beats round-trips edits", () => {
    let t = insertFirstBeat(L("---", "target: 3000", "---", "Prosa."), "Um");
    t = insertBeat(t, 0, "Dois");
    t = insertBeat(t, 1, "Três");
    expect(parseBeats(t).map((b) => b.text)).toEqual(["Um", "Dois", "Três"]);
    t = setBeatText(t, 1, "Dois, revisto");
    expect(parseBeats(t).map((b) => b.text)).toEqual(["Um", "Dois, revisto", "Três"]);
    t = removeBeat(t, 2);
    expect(parseBeats(t).map((b) => b.text)).toEqual(["Um", "Dois, revisto"]);
    expect(t).toContain("Prosa.");
  });
});

describe("resolveTarget", () => {
  const books = new Set(["Novels/Book.md"]);
  const notes = new Set(["Contos/A.md", "Contos/B.md"]);
  const valid = (mode: "book" | "note", path: string) => (mode === "book" ? books : notes).has(path);
  const base = (over: Partial<TargetInput>): TargetInput => ({
    active: null, lastActive: undefined, shown: { mode: "empty" }, bookPath: null, valid, ...over,
  });
  const note = (path: string) => ({ path, markdown: true, bookPath: null });
  const chapter = (path: string) => ({ path, markdown: true, bookPath: "Novels/Book.md" });
  const noteT = (path: string): OutlineTarget => ({ mode: "note", path });
  const bookT: OutlineTarget = { mode: "book", path: "Novels/Book.md" };

  it("a note outside any book shows the note", () => {
    expect(resolveTarget(base({ active: note("Contos/A.md") }))).toEqual({ target: noteT("Contos/A.md"), lastActive: "Contos/A.md" });
  });

  it("a chapter or the book note shows the book", () => {
    expect(resolveTarget(base({ active: chapter("Novels/Book/Chapters/01 A.md") })).target).toEqual(bookT);
    expect(resolveTarget(base({ active: chapter("Novels/Book.md") })).target).toEqual(bookT);
    // a non-Markdown file inside a book still follows the book
    expect(resolveTarget(base({ active: { path: "Novels/Book/board.canvas", markdown: false, bookPath: "Novels/Book.md" } })).target).toEqual(bookT);
  });

  it("nothing active and nothing shown: empty", () => {
    expect(resolveTarget(base({})).target).toEqual({ mode: "empty" });
  });

  it("a non-Markdown active leaf keeps the last note (the outline itself taking focus)", () => {
    const r = resolveTarget(base({ active: null, lastActive: "Contos/A.md", shown: noteT("Contos/A.md") }));
    expect(r).toEqual({ target: noteT("Contos/A.md"), lastActive: "Contos/A.md" });
    const pdf = { path: "x.pdf", markdown: false, bookPath: null };
    expect(resolveTarget(base({ active: pdf, lastActive: "Contos/A.md", shown: noteT("Contos/A.md") })).target).toEqual(noteT("Contos/A.md"));
  });

  it("keeps the last book the same way", () => {
    expect(resolveTarget(base({ active: null, lastActive: "Novels/Book/Chapters/01 A.md", shown: bookT, bookPath: "Novels/Book.md" })).target).toEqual(bookT);
  });

  it("switching from a book to a note shows the note, and back shows the book", () => {
    const r1 = resolveTarget(base({ active: note("Contos/A.md"), lastActive: "Novels/Book.md", shown: bookT, bookPath: "Novels/Book.md" }));
    expect(r1.target).toEqual(noteT("Contos/A.md"));
    const r2 = resolveTarget(base({ active: chapter("Novels/Book.md"), lastActive: r1.lastActive, shown: r1.target, bookPath: "Novels/Book.md" }));
    expect(r2.target).toEqual(bookT);
  });

  it("a book picked by hand stays until another note is opened", () => {
    // the panel shows A, then the user picks the book: shown = book, active still A
    const picked = resolveTarget(base({ active: note("Contos/A.md"), lastActive: "Contos/A.md", shown: bookT, bookPath: "Novels/Book.md" }));
    expect(picked.target).toEqual(bookT);
    // focus goes to the outline, then back to A: still the book
    const away = resolveTarget(base({ active: null, lastActive: picked.lastActive, shown: bookT, bookPath: "Novels/Book.md" }));
    const back = resolveTarget(base({ active: note("Contos/A.md"), lastActive: away.lastActive, shown: bookT, bookPath: "Novels/Book.md" }));
    expect(back.target).toEqual(bookT);
    // opening another note follows it
    expect(resolveTarget(base({ active: note("Contos/B.md"), lastActive: back.lastActive, shown: bookT })).target).toEqual(noteT("Contos/B.md"));
  });

  it("a shown note that is gone (deleted, moved into a book) falls back to the book, else empty", () => {
    expect(resolveTarget(base({ active: null, lastActive: "Contos/Gone.md", shown: noteT("Contos/Gone.md"), bookPath: "Novels/Book.md" })).target).toEqual(bookT);
    expect(resolveTarget(base({ active: null, lastActive: "Contos/Gone.md", shown: noteT("Contos/Gone.md") })).target).toEqual({ mode: "empty" });
  });

  it("an active note that is no longer valid is not followed", () => {
    expect(resolveTarget(base({ active: note("Contos/New.md"), shown: noteT("Contos/A.md") })).target).toEqual(noteT("Contos/A.md"));
  });
});

describe("decideNoteKey", () => {
  const k = (over: Partial<KeyInput>): KeyInput => ({
    key: "Enter", shift: false, mod: false, composing: false, field: "beat", value: "x", caret: 1,
    selectionEmpty: true, atFirstLine: true, atLastLine: true, chapterIndex: 0, words: 0, bodyBlank: true,
    summaryEmpty: true, beatWritten: false, ...over,
  });

  it("Enter adds a beat, like in a book", () => {
    expect(decideNoteKey(k({}))).toEqual({ type: "newBeat", before: false });
    expect(decideNoteKey(k({ caret: 0 }))).toEqual({ type: "newBeat", before: true });
    expect(decideNoteKey(k({ shift: true }))).toEqual({ type: "swallow" });
  });

  it("Backspace on an empty beat removes it", () => {
    expect(decideNoteKey(k({ key: "Backspace", value: "", caret: 0 }))).toEqual({ type: "removeBeat" });
    expect(decideNoteKey(k({ key: "Backspace", value: "abc", caret: 0 }))).toEqual({ type: "default" });
  });

  it("arrows move between beats", () => {
    expect(decideNoteKey(k({ key: "ArrowUp" }))).toEqual({ type: "focus", dir: -1 });
    expect(decideNoteKey(k({ key: "ArrowDown" }))).toEqual({ type: "focus", dir: 1 });
  });

  it("Tab and Shift+Tab do nothing (no chapters), even on a written beat", () => {
    expect(decideKey(k({ key: "Tab", shift: true }))).toEqual({ type: "beatToChapter" });
    expect(decideNoteKey(k({ key: "Tab", shift: true }))).toEqual({ type: "swallow" });
    expect(decideNoteKey(k({ key: "Tab", shift: true, beatWritten: true }))).toEqual({ type: "swallow" });
    expect(decideNoteKey(k({ key: "Tab" }))).toEqual({ type: "swallow" });
  });

  it("treats every field as a beat and leaves IME and modifiers alone", () => {
    expect(decideNoteKey(k({ field: "title" }))).toEqual({ type: "newBeat", before: false });
    expect(decideNoteKey(k({ composing: true }))).toEqual({ type: "default" });
    expect(decideNoteKey(k({ mod: true }))).toEqual({ type: "default" });
  });
});

describe("noteGoal", () => {
  it("plain count without a target or limit", () => {
    expect(noteGoal(1234, null)).toEqual({ count: 1234, kind: "none", state: "none", fill: 0, reached: false });
    expect(noteGoal(-3, { })).toMatchObject({ count: 0, kind: "none" });
  });

  it("against the target", () => {
    expect(noteGoal(1500, { target: 3000 })).toEqual({ count: 1500, goal: 3000, kind: "target", state: "under", fill: 0.5, reached: false });
    expect(noteGoal(3500, { target: 3000 })).toMatchObject({ fill: 1, reached: true, state: "under" });
  });

  it("against the limit when there is no target", () => {
    expect(noteGoal(960, { limit: 1000 })).toMatchObject({ goal: 1000, kind: "limit", state: "near", fill: 0.96 });
    expect(noteGoal(1000, { limit: 1000 })).toMatchObject({ state: "near" });
    expect(noteGoal(1001, { limit: 1000 })).toMatchObject({ state: "over", fill: 1 });
  });

  it("target and limit: shown against the target, limit kept for the state", () => {
    expect(noteGoal(2000, { target: 1800, limit: 2000 })).toEqual({
      count: 2000, goal: 1800, kind: "target", limit: 2000, state: "near", fill: 1, reached: true,
    });
  });
});
