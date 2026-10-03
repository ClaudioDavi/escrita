import { describe, it, expect } from "vitest";
import {
  insertBeat, setBeatText, removeBeat, moveBeatOut, appendBeat, isBlankBody, beatAtLine, minimalChange, cleanBeatText,
} from "../src/outline/beats-edit";
import {
  beatLetter, decideKey, chapterAsBeatText, dropIndex, moveItem, scanBeats,
  buildBoard, canvasColor, canOverwriteBoard, cardText, mergeBoard, BOARD_MARKER, type KeyInput,
} from "../src/outline/model";
import { statusColor, normalizeStages } from "../src/core/stages";
import { parseBeats } from "../src/core/markers";
import { segment } from "../src/core/markdown";
import { countWords } from "../src/core/wordcount";

const B = (s: string) => `%% beat: ${s} %%`;
const L = (...lines: string[]) => lines.join("\n");

/** Every non-blank, non-beat, non-break line of the input survives, in order. */
function prose(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim() && !/^%% beat:/.test(l) && !/^(---|\*\*\*)$/.test(l.trim()));
}

describe("insertBeat", () => {
  it("empty file", () => {
    expect(insertBeat("", -1, "a")).toBe(B("a"));
    expect(insertBeat("", 0, "a")).toBe(B("a"));
    expect(insertBeat("\n", -1, "a")).toBe(B("a") + "\n");
  });

  it("frontmatter only, with and without a trailing newline", () => {
    expect(insertBeat("---\nsummary: x\n---", -1, "a")).toBe(L("---", "summary: x", "---", B("a")));
    expect(insertBeat("---\nsummary: x\n---\n", -1, "a")).toBe(L("---", "summary: x", "---", B("a"), ""));
    expect(insertBeat("---\nsummary: x\n---\n\n\n", -1, "a")).toBe(L("---", "summary: x", "---", B("a"), ""));
  });

  it("builds the canonical structure when beats are added one after another", () => {
    let t = "---\nstatus: draft\n---\n";
    t = insertBeat(t, -1, "a");
    t = insertBeat(t, 0, "b");
    t = insertBeat(t, 1, "c");
    expect(t).toBe(L("---", "status: draft", "---", B("a"), "", "---", "", B("b"), "", "---", "", B("c"), ""));
    expect(parseBeats(t).map((b) => b.text)).toEqual(["a", "b", "c"]);
  });

  it("inserts between beats, before the scene break that precedes the next one", () => {
    const t = L(B("a"), "prose a", "", "---", "", B("c"), "prose c");
    const out = insertBeat(t, 0, "b");
    expect(out).toBe(L(B("a"), "prose a", "", "---", "", B("b"), "", "---", "", B("c"), "prose c"));
    expect(parseBeats(out).map((b) => [b.text, b.written])).toEqual([["a", true], ["b", false], ["c", true]]);
  });

  it("adds a break after the new beat when the next beat had none", () => {
    const t = L(B("a"), "prose a", B("c"), "prose c");
    const out = insertBeat(t, 0, "b");
    expect(out).toBe(L(B("a"), "prose a", "", "---", "", B("b"), "", "---", "", B("c"), "prose c"));
    expect(prose(out)).toEqual(prose(t));
  });

  it("first beat before existing ones", () => {
    const t = L(B("b"), "", "---", "", B("c"));
    expect(insertBeat(t, -1, "a")).toBe(L(B("a"), "", "---", "", B("b"), "", "---", "", B("c")));
  });

  it("-1 with prose before the first beat puts the new beat after that prose", () => {
    const t = L("Opening lines.", "", "---", "", B("b"), "text");
    const out = insertBeat(t, -1, "a");
    expect(out).toBe(L("Opening lines.", "", "---", "", B("a"), "", "---", "", B("b"), "text"));
  });

  it("after the last beat of a written chapter", () => {
    const t = L("---", "s: 1", "---", B("a"), "", "Words here.", "");
    expect(insertBeat(t, 0, "b")).toBe(L("---", "s: 1", "---", B("a"), "", "Words here.", "", "---", "", B("b"), ""));
  });

  it("reuses a trailing scene break", () => {
    const t = L("Prose.", "", "---", "", "");
    expect(insertBeat(t, -1, "a")).toBe(L("Prose.", "", "---", "", B("a"), ""));
  });

  it("prose without beats: the beat goes at the end after a break", () => {
    expect(insertBeat("Just prose.", -1, "a")).toBe(L("Just prose.", "", "---", "", B("a")));
  });

  it("keeps CRLF line endings and a missing final newline", () => {
    const t = ["---", "s: 1", "---", B("a"), "prose", "", "---", "", B("c")].join("\r\n");
    const out = insertBeat(t, 0, "b");
    expect(out).toBe(["---", "s: 1", "---", B("a"), "prose", "", "---", "", B("b"), "", "---", "", B("c")].join("\r\n"));
    expect(out.endsWith("\r\n")).toBe(false);
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("clamps out-of-range indexes", () => {
    const t = L(B("a"));
    expect(insertBeat(t, 99, "b")).toBe(L(B("a"), "", "---", "", B("b")));
    expect(insertBeat(t, -5, "z")).toBe(L(B("z"), "", "---", "", B("a")));
  });

  it("sanitizes the beat text", () => {
    expect(insertBeat("", -1, "one\ntwo %% three")).toBe("%% beat: one two % three %%");
    expect(insertBeat("", -1, "")).toBe("%% beat:  %%");
    expect(parseBeats(insertBeat("", -1, ""))[0].text).toBe("");
  });

  it("never changes the word count or prose", () => {
    const t = L("---", "s: x", "---", "Intro text.", "", B("a"), "First scene.", "%% XXX: check %%", "", "---", "", B("b"), "Second.");
    for (const i of [-1, 0, 1]) {
      const out = insertBeat(t, i, "new");
      expect(countWords(out)).toBe(countWords(t));
      expect(prose(out)).toEqual(prose(t));
      expect(parseBeats(out)).toHaveLength(3);
    }
  });
});

describe("setBeatText", () => {
  it("replaces only the beat line", () => {
    const t = L("---", "a: 1", "---", B("a"), "prose", "", "---", "", B("b"));
    expect(setBeatText(t, 1, "new b")).toBe(L("---", "a: 1", "---", B("a"), "prose", "", "---", "", B("new b")));
  });
  it("keeps indentation and CRLF", () => {
    const t = ["  " + B("a"), "x"].join("\r\n") + "\r\n";
    expect(setBeatText(t, 0, "b")).toBe(["  " + B("b"), "x"].join("\r\n") + "\r\n");
  });
  it("missing index leaves the text alone", () => {
    expect(setBeatText("prose", 0, "x")).toBe("prose");
    expect(setBeatText(B("a"), 3, "x")).toBe(B("a"));
  });
});

describe("removeBeat", () => {
  it("unwritten middle beat takes one scene break with it", () => {
    const t = L("prev", "", "---", "", B("b"), "", "---", "", B("c"), "next");
    expect(removeBeat(t, 0)).toBe(L("prev", "", "---", "", B("c"), "next"));
  });
  it("unwritten last beat takes the break before it", () => {
    expect(removeBeat(L("prev", "", "---", "", B("b"), ""), 0)).toBe("prev\n");
    expect(removeBeat(L(B("a"), "", "---", "", B("b")), 1)).toBe(B("a"));
  });
  it("unwritten first beat takes the break after it", () => {
    expect(removeBeat(L(B("a"), "", "---", "", B("b"), "x"), 0)).toBe(L(B("b"), "x"));
    expect(removeBeat(L("---", "s: 1", "---", B("a"), "", "---", "", B("b")), 0)).toBe(L("---", "s: 1", "---", B("b")));
  });
  it("only beat in the file", () => {
    expect(removeBeat(B("a"), 0)).toBe("");
    expect(removeBeat(B("a") + "\n", 0)).toBe("");
    expect(removeBeat(L("---", "s: 1", "---", B("a"), ""), 0)).toBe(L("---", "s: 1", "---", ""));
  });
  it("written beat: only the comment line goes, prose stays, breaks stay", () => {
    const t = L("prev", "", "---", "", B("b"), "Scene text.", "", "---", "", B("c"));
    const out = removeBeat(t, 0);
    expect(out).toBe(L("prev", "", "---", "", "Scene text.", "", "---", "", B("c")));
    expect(countWords(out)).toBe(countWords(t));
  });
  it("written beat directly between lines doesn't merge paragraphs", () => {
    expect(removeBeat(L("text", B("b"), "prose"), 0)).toBe(L("text", "prose"));
    expect(removeBeat(L("text", "", B("b"), "", "prose"), 0)).toBe(L("text", "", "prose"));
  });
  it("never removes comments that follow an unwritten beat", () => {
    const t = L("prev", "", "---", "", B("b"), "%% XXX: keep me %%", "", "---", "", B("c"));
    const out = removeBeat(t, 0);
    expect(out).toContain("%% XXX: keep me %%");
    expect(out).toContain(B("c"));
    expect(out).not.toContain(B("b"));
  });
  it("beats without breaks between them", () => {
    expect(removeBeat(L(B("a"), "", B("b"), "", B("c")), 1)).toBe(L(B("a"), "", B("c")));
  });
  it("CRLF", () => {
    const t = ["x", "", "---", "", B("b"), "", "---", "", B("c")].join("\r\n");
    expect(removeBeat(t, 0)).toBe(["x", "", "---", "", B("c")].join("\r\n"));
  });
  it("missing index leaves the text alone", () => {
    expect(removeBeat("prose", 0)).toBe("prose");
  });
  it("insert then remove round-trips the canonical structure", () => {
    const t = L("---", "s: 1", "---", B("a"), "A.", "", "---", "", B("c"), "C.", "");
    for (const i of [-1, 0, 1]) expect(removeBeat(insertBeat(t, i, "new"), i + 1)).toBe(t);
  });
});

describe("moveBeatOut", () => {
  it("returns the text without the beat and its text", () => {
    const t = L(B("a"), "A.", "", "---", "", B("b"));
    expect(moveBeatOut(t, 1)).toEqual({ text: L(B("a"), "A."), beatText: "b" });
  });
  it("refuses written beats and missing ones", () => {
    expect(moveBeatOut(L(B("a"), "A."), 0)).toBeNull();
    expect(moveBeatOut("", 0)).toBeNull();
  });
});

describe("appendBeat / isBlankBody / beatAtLine / minimalChange", () => {
  it("appendBeat adds after the last beat", () => {
    expect(appendBeat(L(B("a"), "", "---", "", B("b")), "c")).toBe(L(B("a"), "", "---", "", B("b"), "", "---", "", B("c")));
    expect(appendBeat("---\ns: 1\n---\n", "a")).toBe("---\ns: 1\n---\n" + B("a") + "\n");
  });
  it("isBlankBody", () => {
    expect(isBlankBody("")).toBe(true);
    expect(isBlankBody("---\nsummary: x\n---\n\n  \n")).toBe(true);
    expect(isBlankBody("---\nsummary: x\n---\n" + B("a"))).toBe(false);
    expect(isBlankBody("%% XXX: note %%")).toBe(false);
    expect(isBlankBody("\r\n\r\n")).toBe(true);
  });
  it("beatAtLine", () => {
    const t = L("intro", B("a"), "x", "", "---", "", B("b"), "y");
    expect(beatAtLine(t, 0)).toBe(-1);
    expect(beatAtLine(t, 1)).toBe(0);
    expect(beatAtLine(t, 4)).toBe(0);
    expect(beatAtLine(t, 7)).toBe(1);
  });
  it("minimalChange reproduces the target", () => {
    const cases: Array<[string, string]> = [
      ["", ""], ["", "abc"], ["abc", ""], ["abc", "abc"], ["abXc", "abc"], ["a\n\nb", "a\n\n---\n\nnew\n\nb"], ["aaa", "aaaa"],
    ];
    for (const [a, b] of cases) {
      const c = minimalChange(a, b);
      expect(a.slice(0, c.from) + c.insert + a.slice(c.to)).toBe(b);
      expect(c.to).toBeGreaterThanOrEqual(c.from);
    }
    expect(minimalChange("abc", "abXc")).toEqual({ from: 2, to: 2, insert: "X" });
  });
});

describe("beatLetter", () => {
  it("letters", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(beatLetter)).toEqual(["a", "b", "z", "aa", "ab", "az", "ba", "zz", "aaa"]);
    expect(beatLetter(-3)).toBe("a");
  });
});

describe("decideKey", () => {
  const base: KeyInput = {
    key: "Enter", shift: false, mod: false, composing: false, field: "title", value: "Chegada", caret: 7,
    selectionEmpty: true, atFirstLine: true, atLastLine: true, chapterIndex: 1, words: 0, bodyBlank: true,
    summaryEmpty: true, beatWritten: false,
  };
  const k = (o: Partial<KeyInput>) => decideKey({ ...base, ...o });

  it("Enter", () => {
    expect(k({})).toEqual({ type: "newChapter", before: false });
    expect(k({ caret: 0 })).toEqual({ type: "newChapter", before: true });
    expect(k({ caret: 0, value: "" })).toEqual({ type: "newChapter", before: false });
    expect(k({ caret: 0, selectionEmpty: false })).toEqual({ type: "newChapter", before: false });
    expect(k({ field: "beat" })).toEqual({ type: "newBeat", before: false });
    expect(k({ field: "beat", caret: 0 })).toEqual({ type: "newBeat", before: true });
    expect(k({ field: "summary" })).toEqual({ type: "focus", dir: 1 });
    expect(k({ field: "new", value: "  " })).toEqual({ type: "swallow" });
    expect(k({ field: "new", value: "Title" })).toEqual({ type: "createFromNew" });
    expect(k({ shift: true })).toEqual({ type: "swallow" });
  });
  it("modifiers and IME composition fall through", () => {
    expect(k({ mod: true })).toEqual({ type: "default" });
    expect(k({ composing: true })).toEqual({ type: "default" });
    expect(k({ key: "a" })).toEqual({ type: "default" });
  });
  it("Tab on a chapter", () => {
    expect(k({ key: "Tab" })).toEqual({ type: "chapterToBeat" });
    expect(k({ key: "Tab", chapterIndex: 0 })).toEqual({ type: "blocked", reason: "firstChapter" });
    expect(k({ key: "Tab", words: 3 })).toEqual({ type: "blocked", reason: "notEmpty" });
    expect(k({ key: "Tab", bodyBlank: false })).toEqual({ type: "blocked", reason: "notEmpty" });
    expect(k({ key: "Tab", field: "beat" })).toEqual({ type: "swallow" });
    expect(k({ key: "Tab", field: "summary" })).toEqual({ type: "swallow" });
  });
  it("Tab on the new line makes a beat of the last chapter", () => {
    expect(k({ key: "Tab", field: "new", value: "x", chapterIndex: 3 })).toEqual({ type: "newAsBeat" });
    expect(k({ key: "Tab", field: "new", value: "x", chapterIndex: 0 })).toEqual({ type: "blocked", reason: "noChapters" });
    expect(k({ key: "Tab", field: "new", value: "" })).toEqual({ type: "swallow" });
  });
  it("Shift+Tab", () => {
    expect(k({ key: "Tab", shift: true, field: "beat" })).toEqual({ type: "beatToChapter" });
    expect(k({ key: "Tab", shift: true, field: "beat", beatWritten: true })).toEqual({ type: "blocked", reason: "written" });
    expect(k({ key: "Tab", shift: true })).toEqual({ type: "swallow" });
  });
  it("Backspace", () => {
    expect(k({ key: "Backspace", field: "beat", value: "", caret: 0 })).toEqual({ type: "removeBeat" });
    expect(k({ key: "Backspace", field: "beat", value: "x", caret: 0 })).toEqual({ type: "default" });
    expect(k({ key: "Backspace", field: "beat", value: "x", caret: 1 })).toEqual({ type: "default" });
    expect(k({ key: "Backspace", value: "", caret: 0 })).toEqual({ type: "trashChapter" });
    expect(k({ key: "Backspace", value: "", caret: 0, summaryEmpty: false })).toEqual({ type: "default" });
    expect(k({ key: "Backspace", value: "", caret: 0, words: 10 })).toEqual({ type: "blocked", reason: "notEmpty" });
    expect(k({ key: "Backspace", value: "", caret: 0, bodyBlank: false })).toEqual({ type: "blocked", reason: "notEmpty" });
    expect(k({ key: "Backspace", field: "summary", value: "", caret: 0 })).toEqual({ type: "focus", dir: -1 });
    expect(k({ key: "Backspace", field: "new", value: "", caret: 0 })).toEqual({ type: "default" });
  });
  it("arrows move between lines only from the edge lines", () => {
    expect(k({ key: "ArrowUp" })).toEqual({ type: "focus", dir: -1 });
    expect(k({ key: "ArrowDown" })).toEqual({ type: "focus", dir: 1 });
    expect(k({ key: "ArrowUp", atFirstLine: false })).toEqual({ type: "default" });
    expect(k({ key: "ArrowDown", atLastLine: false })).toEqual({ type: "default" });
    expect(k({ key: "ArrowDown", shift: true })).toEqual({ type: "default" });
  });
});

describe("chapterAsBeatText", () => {
  it("combines title and summary", () => {
    expect(chapterAsBeatText("Chegada", "", "Untitled")).toBe("Chegada");
    expect(chapterAsBeatText("Chegada", "Ela chega.", "Untitled")).toBe("Chegada: Ela chega.");
    expect(chapterAsBeatText("Untitled", "Ela chega.", "Untitled")).toBe("Ela chega.");
    expect(chapterAsBeatText("  ", "", "Untitled")).toBe("");
  });
});

describe("reordering", () => {
  it("dropIndex", () => {
    expect(dropIndex(0, 2, false)).toBe(1);
    expect(dropIndex(0, 2, true)).toBe(2);
    expect(dropIndex(3, 0, false)).toBe(0);
    expect(dropIndex(3, 1, true)).toBe(2);
    expect(dropIndex(1, 1, true)).toBe(1);
  });
  it("moveItem", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 0, 99)).toEqual(["b", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    const src = ["a", "b"];
    moveItem(src, 0, 1);
    expect(src).toEqual(["a", "b"]);
  });
  it("drop then move puts the item where it was dropped", () => {
    const arr = ["a", "b", "c", "d", "e"];
    expect(moveItem(arr, 1, dropIndex(1, 3, true))).toEqual(["a", "c", "d", "b", "e"]);
    expect(moveItem(arr, 4, dropIndex(4, 0, false))).toEqual(["e", "a", "b", "c", "d"]);
  });
});

describe("scanBeats", () => {
  it("letters beats in order and skips frontmatter", () => {
    const lines = ["---", "x: %% beat: no %%", "---", B("one"), "text", "  %% beat: two %%  ", "%% beat:three%%", "%% XXX: no %%"];
    expect(scanBeats(segment(lines.join("\n")))).toEqual([
      { line: 3, text: "one", letter: "a" },
      { line: 5, text: "two", letter: "b" },
      { line: 6, text: "three", letter: "c" },
    ]);
    expect(scanBeats(segment(""))).toEqual([]);
  });
});

describe("canvas board", () => {
  const chapters = [
    { path: "N/A Casa/Chapters/01 Chegada.md", name: "01 Chegada", summary: "Ela chega.", status: "Draft", beats: ["a", "b"] },
    { path: "N/A Casa/Chapters/02 Porta.md", name: "02 Porta", summary: "", status: "", beats: [] },
    { path: "N/A Casa/Chapters/03 Três.md", name: "03 Três", summary: "line\nbreak", status: "odd", beats: ["x\ny"] },
  ];
  const colors: Record<string, string> = { draft: "#abc", odd: "blue" };

  it("builds a grid with colors and the marker", () => {
    const board = buildBoard(chapters, (s) => colors[s], { columns: 2, width: 300, gap: 20 });
    expect(board.escrita).toBe(true);
    expect(board.edges).toEqual([]);
    expect(board.nodes.map((n) => [n.x, n.id])).toEqual([[0, "escrita-1"], [320, "escrita-2"], [0, "escrita-3"]]);
    expect(board.nodes[0].y).toBe(0);
    expect(board.nodes[1].height).toBe(board.nodes[0].height);
    expect(board.nodes[2].y).toBe(board.nodes[0].height + 20);
    expect(board.nodes[0].color).toBe("#aabbcc");
    expect(board.nodes[1].color).toBeUndefined();
    expect(board.nodes[2].color).toBe("5");
    expect(board.nodes[0].text.startsWith(BOARD_MARKER)).toBe(true);
    expect(new Set(board.nodes.map((n) => n.id)).size).toBe(3);
  });
  it("colors a board from the stage mapping, then the other status colors", () => {
    const stages = normalizeStages({ draft: { words: "rascunho, draft", color: "#abc" } });
    const board = buildBoard(chapters, (s) => statusColor(s, stages, "odd = blue"), { columns: 2, width: 300, gap: 20 });
    expect(board.nodes[0].color).toBe("#aabbcc");
    expect(board.nodes[1].color).toBeUndefined();
    expect(board.nodes[2].color).toBe("5");
  });
  it("card text", () => {
    expect(cardText(chapters[0])).toBe(`${BOARD_MARKER}\n\n## [[N/A Casa/Chapters/01 Chegada|01 Chegada]]\n\nEla chega.\n\n- a\n- b`);
    expect(cardText(chapters[2])).toContain("line break");
    expect(cardText(chapters[2])).toContain("- x y");
  });
  it("empty book", () => {
    expect(buildBoard([], () => undefined).nodes).toEqual([]);
  });
  it("canvasColor", () => {
    expect(canvasColor(undefined)).toBeUndefined();
    expect(canvasColor("#7d7972")).toBe("#7d7972");
    expect(canvasColor("#7D7972ff")).toBe("#7d7972");
    expect(canvasColor("#fff")).toBe("#ffffff");
    expect(canvasColor("3")).toBe("3");
    expect(canvasColor("red")).toBe("1");
    expect(canvasColor("chartreuse")).toBeUndefined();
    expect(canvasColor("#12")).toBeUndefined();
  });
  it("canOverwriteBoard", () => {
    expect(canOverwriteBoard("")).toBe(true);
    expect(canOverwriteBoard(JSON.stringify(buildBoard(chapters, () => undefined)))).toBe(true);
    expect(canOverwriteBoard('{"nodes":[],"edges":[]}')).toBe(true);
    expect(canOverwriteBoard('{"nodes":[{"id":"1","type":"text","text":"mine"}],"edges":[]}')).toBe(false);
    expect(canOverwriteBoard(`{"nodes":[{"id":"1","type":"text","text":"${BOARD_MARKER} x"}]}`)).toBe(true);
    expect(canOverwriteBoard('{"nodes":[{"id":"1","type":"file","file":"a.md"}]}')).toBe(false);
    expect(canOverwriteBoard("not json")).toBe(false);
    expect(canOverwriteBoard("null")).toBe(false);
  });
});

describe("beat text with percent signs (regression)", () => {
  it("runs of % collapse so the comment can't close early", () => {
    expect(cleanBeatText("Grow %%%")).toBe("Grow %");
    expect(cleanBeatText("50% off")).toBe("50% off");
    const t = setBeatText(B("a") + "\n", 0, "Grow %%%");
    expect(parseBeats(t)[0].text).toBe("Grow %");
    const line = t.trimEnd();
    expect(countWords(line + "\n\nhello world\n\n" + B("b") + "\n\nmore words")).toBe(4);
    expect(parseBeats(insertBeat("", -1, "x %% y"))[0].text).toBe("x % y");
    expect(parseBeats(appendBeat("prose", "%%%%"))[0].text).toBe("%");
  });
});

describe("mixed line endings (regression)", () => {
  const mixed = "---\nsummary: x\n---\r\nprose one\n\n%% beat: a %%\r\nmore\n";
  it("setBeatText only changes the edited line", () => {
    expect(setBeatText(mixed, 0, "b")).toBe(mixed.replace("beat: a", "beat: b"));
  });
  it("insert and remove keep the endings of untouched lines", () => {
    const ins = insertBeat(mixed, 0, "new");
    expect(ins.startsWith("---\nsummary: x\n---\r\nprose one\n\n%% beat: a %%\r\nmore\n")).toBe(true);
    expect(parseBeats(ins).map((b) => b.text)).toEqual(["a", "new"]);
    expect(removeBeat(ins, 1)).toBe(mixed);
  });
  it("a missing final newline stays missing; pure CRLF stays CRLF", () => {
    expect(appendBeat("a\r\nb", "x")).toBe(["a", "b", "", "---", "", B("x")].join("\r\n"));
    expect(insertBeat("x\n", -1, "b").endsWith("\n")).toBe(true);
  });
});

describe("mergeBoard (regression: keep the user's edits)", () => {
  const ch = (n: number, beats: string[] = []) => ({
    path: `B/Chapters/0${n} C${n}.md`, name: `0${n} C${n}`, summary: "", status: "", beats,
  });
  const colors = () => undefined;

  it("an empty or new file gets the fresh board", () => {
    const fresh = buildBoard([ch(1), ch(2)], colors);
    expect(mergeBoard("", fresh)).toEqual(fresh);
  });

  it("keeps user cards, arrows, positions and extra keys; refreshes chapter text", () => {
    const first = buildBoard([ch(1), ch(2)], colors);
    const edited = {
      ...first,
      custom: 1,
      nodes: [
        { ...first.nodes[0], x: 900, y: 900 },
        first.nodes[1],
        { id: "mine", type: "text", text: "my note", x: 0, y: 500, width: 100, height: 50 },
      ],
      edges: [{ id: "e1", fromNode: "mine", toNode: first.nodes[0].id }],
    };
    const fresh = buildBoard([ch(1, ["new beat"]), ch(2)], colors);
    const out = mergeBoard(JSON.stringify(edited), fresh) as { nodes: Array<Record<string, unknown>>; edges: unknown[]; custom: number };
    expect(out.custom).toBe(1);
    expect(out.edges).toEqual(edited.edges);
    const c1 = out.nodes.find((n) => n.id === first.nodes[0].id)!;
    expect([c1.x, c1.y]).toEqual([900, 900]);
    expect(String(c1.text)).toContain("- new beat");
    expect(out.nodes.find((n) => n.id === "mine")).toEqual(edited.nodes[2]);
    expect(out.nodes).toHaveLength(3);
  });

  it("matches cards by chapter, adds new ones below, drops removed ones and their arrows", () => {
    const first = buildBoard([ch(1), ch(2)], colors);
    const edited = {
      ...first,
      edges: [{ id: "e", fromNode: first.nodes[1].id, toNode: first.nodes[0].id }],
    };
    // chapter 2 removed, chapter 3 added before chapter 1
    const fresh = buildBoard([ch(3), ch(1)], colors);
    const out = mergeBoard(JSON.stringify(edited), fresh) as { nodes: Array<Record<string, unknown>>; edges: unknown[] };
    expect(out.edges).toEqual([]);
    expect(out.nodes).toHaveLength(2);
    const c1 = out.nodes.find((n) => String(n.text).includes("01 C1"))!;
    expect(c1.id).toBe(first.nodes[0].id);
    expect(c1.x).toBe(first.nodes[0].x);
    const c3 = out.nodes.find((n) => String(n.text).includes("03 C3"))!;
    expect(Number(c3.y)).toBeGreaterThan(Number(first.nodes[0].y) + Number(first.nodes[0].height));
    expect(new Set(out.nodes.map((n) => n.id)).size).toBe(2);
  });
});
