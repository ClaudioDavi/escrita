import { describe, it, expect } from "vitest";
import { closedPreview, countThreads, groupThreads, pickStillValid, readPanelState, linkInsertPoint, seenDate, splitHighlight, toggled } from "../src/universe/panel-model";
import type { ThreadRef } from "../src/universe/threads";

const ref = (path: string, from: number, text: string, closed = false): ThreadRef => ({
  path, title: path.replace(/\.md$/, ""), firstSeen: null,
  thread: { line: 0, from, to: from + 5, text, closed, answeredBy: null, raw: "" },
});

describe("splitHighlight", () => {
  it("highlights a multi-word query across spaces", () => {
    expect(splitHighlight("Ana Maria", "ana maria")).toEqual([{ text: "Ana Maria", hit: true }]);
    expect(splitHighlight("a Ana Mária b", "ana maria")).toEqual([{ text: "a ", hit: false }, { text: "Ana Mária", hit: true }, { text: " b", hit: false }]);
  });
  it("marks the match ignoring case", () => {
    expect(splitHighlight("Mariana", "mar")).toEqual([{ text: "Mar", hit: true }, { text: "iana", hit: false }]);
  });
  it("ignores accents both ways", () => {
    expect(splitHighlight("A enchente de março", "marco")).toEqual([{ text: "A enchente de ", hit: false }, { text: "março", hit: true }]);
    expect(splitHighlight("Mãe", "mae")).toEqual([{ text: "Mãe", hit: true }]);
  });
  it("handles several matches and always joins back", () => {
    const parts = splitHighlight("Mar e mar e Mar", "mar");
    expect(parts.filter((p) => p.hit)).toHaveLength(3);
    expect(parts.map((p) => p.text).join("")).toBe("Mar e mar e Mar");
  });
  it("returns the text whole for an empty query or no match", () => {
    expect(splitHighlight("Teo", "")).toEqual([{ text: "Teo", hit: false }]);
    expect(splitHighlight("Teo", "xyz")).toEqual([{ text: "Teo", hit: false }]);
  });
  it("copes with decomposed accents", () => {
    const text = "Mãe";
    expect(splitHighlight(text, "mae").map((p) => p.text).join("")).toBe(text);
  });
});

describe("groupThreads and countThreads", () => {
  const refs = [ref("A.md", 1, "a"), ref("A.md", 9, "b", true), ref("B.md", 2, "c", true), ref("C.md", 3, "d")];
  it("hides closed threads and empty groups by default", () => {
    const g = groupThreads(refs, false);
    expect(g.map((x) => x.path)).toEqual(["A.md", "C.md"]);
    expect(g[0].items).toHaveLength(1);
    expect(g[0].closed).toBe(1);
  });
  it("lists closed ones when asked, in text order", () => {
    const g = groupThreads(refs, true);
    expect(g.map((x) => x.path)).toEqual(["A.md", "B.md", "C.md"]);
    expect(g[0].items.map((i) => i.thread.text)).toEqual(["a", "b"]);
  });
  it("counts open, closed and works with open threads", () => {
    expect(countThreads(refs)).toEqual({ open: 2, closed: 2, works: 2 });
  });
});

describe("seenDate", () => {
  const now = Date.UTC(2026, 9, 3, 12);
  it("is null without a date", () => expect(seenDate(null, now, "en")).toBeNull());
  it("omits the current year", () => {
    expect(seenDate(Date.UTC(2026, 8, 14, 12), now, "en")).not.toMatch(/2026/);
  });
  it("shows the year for another year", () => {
    expect(seenDate(Date.UTC(2025, 8, 14, 12), now, "en")).toMatch(/2025/);
  });
});

describe("small helpers", () => {
  it("toggled adds and removes", () => {
    expect(toggled(["a"], "b")).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
  });
  it("readPanelState survives junk", () => {
    expect(readPanelState(null)).toEqual({ tab: "entries", collapsed: [], showClosed: false });
    expect(readPanelState({ tab: "works", collapsed: ["place", 3], showClosed: true })).toEqual({ tab: "works", collapsed: ["place"], showClosed: true });
    expect(readPanelState({ tab: "nope" }).tab).toBe("entries");
  });
  it("closedPreview shows the marker", () => {
    expect(closedPreview("thread", "closed", "A Casa")).toBe("%% thread closed: … → [[A Casa]] %%");
    expect(closedPreview("fio", "fechado", " ")).toBe("%% fio fechado: … %%");
  });
  it("a picked universe holds until the active note changes universe", () => {
    expect(pickStillValid({ note: "T.md", at: "U.md" }, "U.md")).toBe(true);
    expect(pickStillValid({ note: "T.md", at: "U.md" }, "V.md")).toBe(false);
    expect(pickStillValid(null, "U.md")).toBe(false);
  });
});

describe("threads grouped by work", () => {
  const book = (r: ThreadRef) => (r.path.startsWith("A Casa/") ? { path: "A Casa/A Casa.md", title: "A Casa" } : { path: r.path, title: r.title });
  const refs = [ref("A Casa/Capitulos/03 O porao.md", 1, "a"), ref("A Casa/Capitulos/07 A carta.md", 2, "b"), ref("Conto.md", 3, "c")];
  it("puts a book's chapters in one group titled with the book", () => {
    const g = groupThreads(refs, false, book);
    expect(g.map((x) => x.title)).toEqual(["A Casa", "Conto"]);
    expect(g[0].items).toHaveLength(2);
  });
  it("counts works, not notes", () => {
    expect(countThreads(refs, book).works).toBe(2);
  });
});

describe("seenDate in Portuguese", () => {
  it("reads day and month only, without de or a trailing period", () => {
    const now = Date.UTC(2026, 9, 3, 12);
    expect(seenDate(Date.UTC(2026, 8, 14, 12), now, "pt-BR")).toBe("14 set");
  });
});

describe("linkInsertPoint", () => {
  it("is the cursor in prose", () => {
    expect(linkInsertPoint("---\nstatus: x\n---\nTexto aqui", 20)).toBe(20);
  });
  it("moves a cursor in the properties to the start of the body", () => {
    const t = "---\nstatus: rascunho\n---\nTexto";
    expect(linkInsertPoint(t, 19)).toBe(t.indexOf("Texto"));
  });
  it("refuses code and comments, allows right after a comment", () => {
    expect(linkInsertPoint("a\n```\ncode\n```\n", 8)).toBeNull();
    expect(linkInsertPoint("x %% nota %% y", 6)).toBeNull();
    expect(linkInsertPoint("x %% nota %% y", 12)).toBe(12);
  });
});
