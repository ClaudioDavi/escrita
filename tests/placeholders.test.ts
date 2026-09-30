import { describe, it, expect, vi } from "vitest";
import {
  scan, placeholderSpans, sanitizeNote, placeholderText, planInsert, locate,
  removalRange, resolvePlaceholder, stepIndex, isIndexable, orderPaths,
  displayName, parentPath, type IndexedMarker,
} from "../src/placeholders/logic";
import { PlaceholderStore } from "../src/placeholders/store";

const X = "XXX";

/** Apply an insert plan at `at` and return the text with a | at the cursor. */
function insertAt(text: string, at: number, selection = ""): string {
  const before = at > 0 && text[at - 1] !== "\n" ? text[at - 1] : "";
  const after = text[at] !== undefined && text[at] !== "\n" ? text[at] : "";
  const plan = planInsert(X, selection, before, after);
  const out = text.slice(0, at) + plan.text + text.slice(at);
  const c = at + plan.cursor;
  return out.slice(0, c) + "|" + out.slice(c);
}

function removeAt(text: string, raw: string, nth = 0): string {
  let from = -1;
  for (let i = 0; i <= nth; i++) from = text.indexOf(raw, from + 1);
  if (from < 0) throw new Error("raw not found");
  const r = removalRange(text, from, from + raw.length);
  return text.slice(0, r.from) + text.slice(r.to);
}

describe("scan", () => {
  it("keeps the raw text and offsets of each placeholder", () => {
    const text = "---\nstatus: draft\n---\nShe opened %% XXX: check the window %% the door.\n%%XXX%%";
    const ms = scan(text, X);
    expect(ms).toHaveLength(2);
    expect(ms[0].raw).toBe("%% XXX: check the window %%");
    expect(text.slice(ms[0].from, ms[0].to)).toBe(ms[0].raw);
    expect(ms[0].text).toBe("check the window");
    expect(ms[0].line).toBe(3);
    expect(ms[1].raw).toBe("%%XXX%%");
    expect(ms[1].text).toBe("");
    expect(ms[1].line).toBe(4);
  });

  it("finds several on one line and ignores other comments and markers", () => {
    const text = "a %% XXX: one %% b %% note to self %% c %% XXX: two %% %% beat: x %% %% XXXY: no %%";
    expect(scan(text, X).map((m) => m.text)).toEqual(["one", "two"]);
  });

  it("uses the configured marker", () => {
    expect(scan("%% TODO: a %% %% XXX: b %%", "TODO").map((m) => m.text)).toEqual(["a"]);
    expect(scan("%% A.B: dot %% %% AxB: no %%", "A.B").map((m) => m.text)).toEqual(["dot"]);
  });

  it("returns nothing for an empty marker or empty text", () => {
    expect(scan("%% XXX: a %%", "")).toEqual([]);
    expect(scan("", X)).toEqual([]);
  });

  it("does not match across lines or unclosed markers", () => {
    expect(scan("%% XXX: a\nb %%", X)).toEqual([]);
    expect(scan("%% XXX: never closed", X)).toEqual([]);
  });

  it("works with CRLF files", () => {
    const text = "one\r\n%% XXX: two %%\r\nthree";
    const ms = scan(text, X);
    expect(ms).toHaveLength(1);
    expect(ms[0].line).toBe(1);
    expect(ms[0].raw).toBe("%% XXX: two %%");
  });
});

describe("placeholderSpans", () => {
  it("locates the note inside the syntax", () => {
    const line = "go %% XXX: fix this %% now";
    const [s] = placeholderSpans(line, X);
    expect(line.slice(s.from, s.to)).toBe("%% XXX: fix this %%");
    expect(line.slice(s.noteFrom, s.noteTo)).toBe("fix this");
    expect(s.note).toBe("fix this");
  });

  it("handles extra spaces, no colon, tabs", () => {
    const line = "%%   XXX:\t  spaced  out   %% | %%XXX note%%";
    const spans = placeholderSpans(line, X);
    expect(spans.map((s) => line.slice(s.noteFrom, s.noteTo))).toEqual(["spaced  out", "note"]);
    expect(spans.map((s) => line.slice(s.noteTo, s.to))).toEqual(["   %%", "%%"]);
  });

  it("gives an empty note range for an empty placeholder", () => {
    for (const line of ["%% XXX:  %%", "%%XXX%%", "%% XXX %%", "%% XXX: %%"]) {
      const [s] = placeholderSpans(line, X);
      expect(s, line).toBeDefined();
      expect(s.noteFrom).toBe(s.noteTo);
      expect(s.note).toBe("");
      expect(s.from).toBe(0);
      expect(s.to).toBe(line.length);
      expect(s.noteFrom).toBeGreaterThanOrEqual(s.from);
      expect(s.noteTo).toBeLessThanOrEqual(s.to);
    }
  });

  it("adds the line offset", () => {
    const [s] = placeholderSpans("a %% XXX: b %%", X, 100);
    expect(s.from).toBe(102);
    expect(s.noteFrom).toBe(110);
    expect(s.noteTo).toBe(111);
    expect(s.to).toBe(114);
  });

  it("keeps a single % inside the note", () => {
    const line = "%% XXX: 50% more %%";
    const [s] = placeholderSpans(line, X);
    expect(s.note).toBe("50% more");
    expect(s.to).toBe(line.length);
  });

  it("skips lines without %% quickly and handles empty marker", () => {
    expect(placeholderSpans("no markers here", X)).toEqual([]);
    expect(placeholderSpans("%% XXX: a %%", "")).toEqual([]);
  });

  it("ranges are ordered and non-overlapping", () => {
    const line = "%% XXX: a %%%% XXX: b %% x %% XXX %%";
    const spans = placeholderSpans(line, X);
    expect(spans).toHaveLength(3);
    for (let i = 1; i < spans.length; i++) expect(spans[i].from).toBeGreaterThanOrEqual(spans[i - 1].to);
  });
});

describe("insertion", () => {
  it("sanitizes notes to a single safe line", () => {
    expect(sanitizeNote("  line one\nline two\r\n\tthree  ")).toBe("line one line two three");
    expect(sanitizeNote("a %% b %%% c")).toBe("a % b % c");
    expect(sanitizeNote("%%%%")).toBe("%");
    expect(sanitizeNote("   ")).toBe("");
  });

  it("builds the placeholder text", () => {
    expect(placeholderText(X, "")).toBe("%% XXX:  %%");
    expect(placeholderText("TODO", "a")).toBe("%% TODO: a %%");
  });

  it("puts the cursor after `XXX: ` in an empty line", () => {
    expect(insertAt("", 0)).toBe("%% XXX: | %%");
  });

  it("adds a space after a word, not after a space", () => {
    expect(insertAt("word", 4)).toBe("word %% XXX: | %%");
    expect(insertAt("word ", 5)).toBe("word %% XXX: | %%");
  });

  it("adds a space before a following word but not before punctuation", () => {
    expect(insertAt("ab", 0)).toBe("%% XXX: | %% ab");
    expect(insertAt("a .", 2)).toBe("a %% XXX: | %%.");
  });

  it("does not add a space after an opening bracket or dash", () => {
    expect(insertAt("(", 1)).toBe("(%% XXX: | %%");
    expect(insertAt("— ", 1)).toBe("—%% XXX: | %% ");
  });

  it("uses the selection as the note and goes right after it", () => {
    const text = "The cellar window was open.";
    const selFrom = 4, selTo = 17; // "cellar window"
    const plan = planInsert(X, text.slice(selFrom, selTo), text[selTo - 1], text[selTo]);
    expect(plan.text).toBe(" %% XXX: cellar window %%");
    const out = text.slice(0, selTo) + plan.text + text.slice(selTo);
    expect(out).toBe("The cellar window %% XXX: cellar window %% was open.");
    expect(out.slice(0, selTo + plan.cursor)).toBe("The cellar window %% XXX: cellar window %%");
    // the prose is untouched
    expect(out.replace(" %% XXX: cellar window %%", "")).toBe(text);
  });

  it("flattens a multi-line selection and removes %%", () => {
    const plan = planInsert(X, "first\nsecond %% x", "x", "");
    expect(plan.text).toBe(" %% XXX: first second % x %%");
    expect(plan.cursor).toBe(plan.text.length);
  });

  it("treats a blank selection like no selection", () => {
    const plan = planInsert(X, "   ", " ", "");
    expect(plan.text).toBe("%% XXX:  %%");
    expect(plan.cursor).toBe(8);
  });

  it("inserted placeholders parse back", () => {
    for (const sel of ["", "note", "a\nb", "50%", "%%"]) {
      const plan = planInsert(X, sel, "", "");
      const ms = scan(plan.text, X);
      expect(ms, sel).toHaveLength(1);
      expect(ms[0].text).toBe(sanitizeNote(sel));
    }
  });

  it("works with a custom marker", () => {
    const plan = planInsert("TK", "", "", "");
    expect(plan.text).toBe("%% TK:  %%");
    expect(plan.cursor).toBe("%% TK: ".length);
  });
});

describe("removalRange", () => {
  it("removes an inline placeholder and one space", () => {
    expect(removeAt("She opened %% XXX: x %% the door.", "%% XXX: x %%")).toBe("She opened the door.");
  });

  it("keeps punctuation tight", () => {
    expect(removeAt("the door %% XXX: x %%.", "%% XXX: x %%")).toBe("the door.");
    expect(removeAt("wait %% XXX: x %%, no", "%% XXX: x %%")).toBe("wait, no");
    expect(removeAt("“Go %% XXX: x %%”", "%% XXX: x %%")).toBe("“Go”");
  });

  it("leaves glued text alone apart from the marker", () => {
    expect(removeAt("word%% XXX: x %%next", "%% XXX: x %%")).toBe("wordnext");
    expect(removeAt("word%% XXX: x %% next", "%% XXX: x %%")).toBe("word next");
  });

  it("removes spaces left at the end of the line", () => {
    expect(removeAt("end of line %% XXX: x %%  \nnext", "%% XXX: x %%")).toBe("end of line\nnext");
    expect(removeAt("end %% XXX: x %%", "%% XXX: x %%")).toBe("end");
  });

  it("removes spaces left at the start of the line", () => {
    expect(removeAt("%% XXX: x %% Start here", "%% XXX: x %%")).toBe("Start here");
    expect(removeAt("a\n%% XXX: x %%   Start", "%% XXX: x %%")).toBe("a\nStart");
  });

  it("keeps indentation before an inline placeholder at line start", () => {
    expect(removeAt("> %% XXX: x %% quoted", "%% XXX: x %%")).toBe("> quoted");
    expect(removeAt("    %% XXX: x %% code-ish", "%% XXX: x %%")).toBe("    code-ish");
  });

  it("removes a line holding only the placeholder", () => {
    expect(removeAt("one\n%% XXX: x %%\ntwo", "%% XXX: x %%")).toBe("one\ntwo");
    expect(removeAt("one\n  %% XXX: x %%  \ntwo", "%% XXX: x %%")).toBe("one\ntwo");
  });

  it("does not leave a doubled blank line", () => {
    expect(removeAt("para one\n\n%% XXX: x %%\n\npara two", "%% XXX: x %%")).toBe("para one\n\npara two");
  });

  it("does not leave a leading blank line at the top", () => {
    expect(removeAt("%% XXX: x %%\n\nFirst line", "%% XXX: x %%")).toBe("First line");
    expect(removeAt("%% XXX: x %%\nFirst line", "%% XXX: x %%")).toBe("First line");
  });

  it("keeps a single blank line between paragraphs when only one side is blank", () => {
    expect(removeAt("para one\n%% XXX: x %%\n\npara two", "%% XXX: x %%")).toBe("para one\n\npara two");
    expect(removeAt("para one\n\n%% XXX: x %%\npara two", "%% XXX: x %%")).toBe("para one\n\npara two");
  });

  it("handles the last line without a trailing newline", () => {
    expect(removeAt("one\n%% XXX: x %%", "%% XXX: x %%")).toBe("one");
    expect(removeAt("one\n\n%% XXX: x %%", "%% XXX: x %%")).toBe("one\n");
    expect(removeAt("%% XXX: x %%", "%% XXX: x %%")).toBe("");
  });

  it("handles CRLF", () => {
    expect(removeAt("one\r\n%% XXX: x %%\r\ntwo", "%% XXX: x %%")).toBe("one\r\ntwo");
    expect(removeAt("one\r\n%% XXX: x %%", "%% XXX: x %%")).toBe("one");
    expect(removeAt("a %% XXX: x %%\r\nb", "%% XXX: x %%")).toBe("a\r\nb");
    expect(removeAt("p1\r\n\r\n%% XXX: x %%\r\n\r\np2", "%% XXX: x %%")).toBe("p1\r\n\r\np2");
  });

  it("keeps frontmatter intact", () => {
    const text = "---\nstatus: draft\n---\n%% XXX: x %%\n\nBody";
    expect(removeAt(text, "%% XXX: x %%")).toBe("---\nstatus: draft\n---\n\nBody");
  });

  it("removes only one of two placeholders on a line", () => {
    const text = "a %% XXX: one %% b %% XXX: two %% c";
    expect(removeAt(text, "%% XXX: two %%")).toBe("a %% XXX: one %% b c");
    expect(removeAt(text, "%% XXX: one %%")).toBe("a b %% XXX: two %% c");
  });

  it("only ever removes whitespace besides the placeholder", () => {
    const cases = [
      "x %% XXX: a %% y", "x\n\n%% XXX: a %%\n\ny", "%% XXX: a %%", "  %% XXX: a %%  ",
      "x %% XXX: a %%.", "x\r\n%% XXX: a %%\r\n", "x%% XXX: a %%y", "\n%% XXX: a %%\n",
    ];
    for (const text of cases) {
      const from = text.indexOf("%%");
      const to = text.indexOf("%%", from + 2) + 2;
      const r = removalRange(text, from, to);
      expect(r.from, text).toBeLessThanOrEqual(from);
      expect(r.to, text).toBeGreaterThanOrEqual(to);
      expect(text.slice(r.from, from).trim(), text).toBe("");
      expect(text.slice(to, r.to).trim(), text).toBe("");
    }
  });
});

describe("locate and resolve", () => {
  const text = "Intro.\n\nShe opened %% XXX: window? %% the door.\n\nLater %% XXX: date %% again.";
  const markers = scan(text, X);

  it("finds a marker at its recorded offset", () => {
    expect(locate(text, markers[0], X, true)).toEqual({ from: markers[0].from, to: markers[0].to });
  });

  it("follows a marker that moved when it is unique", () => {
    const edited = "New first line.\n" + text;
    expect(locate(edited, markers[1], X, true)).toEqual({ from: markers[1].from + 16, to: markers[1].to + 16 });
  });

  it("returns null when the marker is gone or changed", () => {
    const edited = text.replace("%% XXX: window? %%", "%% XXX: window %%");
    expect(locate(edited, markers[0], X, true)).toBeNull();
    expect(locate("", markers[0], X, false)).toBeNull();
  });

  it("refuses ambiguous duplicates in strict mode, picks the nearest otherwise", () => {
    const dup = "a %% XXX: same %% b\n\nc %% XXX: same %% d\n\ne %% XXX: same %% f";
    const ms = scan(dup, X);
    // recorded on a line with no match, with several identical ones nearby
    const stale: IndexedMarker = { ...ms[1], line: 1, from: ms[1].from + 3, to: ms[1].to + 3 };
    expect(locate(dup, stale, X, true)).toBeNull();
    expect(locate(dup, stale, X, false)).toEqual({ from: ms[1].from, to: ms[1].to });
    // without a line to anchor on, the old offset rule applies
    const { line: _l, ...noLine } = stale;
    expect(locate(dup, noLine, X, true)).toBeNull();
    expect(locate(dup, noLine, X, false)).toEqual({ from: ms[1].from, to: ms[1].to });
  });

  it("anchors on the recorded line when offsets drift (CRLF on disk, LF in the editor)", () => {
    const lines = ["# T", "", "Prose.", "%% XXX:  %%", ...Array(10).fill("more prose"), "%% XXX:  %%", "end"];
    const disk = lines.join("\r\n");
    const editor = lines.join("\n");
    const ms = scan(disk, X);
    expect(ms.length).toBe(2);
    const inEditor = scan(editor, X);
    // identical placeholders: the exact-offset check fails in the editor text
    expect(editor.slice(ms[0].from, ms[0].to)).not.toBe(ms[0].raw);
    expect(locate(editor, ms[0], X, true)).toEqual({ from: inEditor[0].from, to: inEditor[0].to });
    expect(locate(editor, ms[1], X, true)).toEqual({ from: inEditor[1].from, to: inEditor[1].to });
    expect(locate(editor, ms[1], X, false)).toEqual({ from: inEditor[1].from, to: inEditor[1].to });
    const r = resolvePlaceholder(editor, ms[0], X);
    expect(r?.text).toBe(["# T", "", "Prose.", ...Array(10).fill("more prose"), "%% XXX:  %%", "end"].join("\n"));
  });

  it("follows a placeholder a few lines away when it is the only one nearby", () => {
    const text2 = "a\n%% XXX: n %%\nb\n\n\n\n\n\n\n\nc %% XXX: n %%";
    const ms = scan(text2, X);
    const edited = "new\nlines\n" + text2; // unsaved edit: both moved down two lines
    const at = locate(edited, ms[0], X, true);
    expect(at).toEqual({ from: ms[0].from + 10, to: ms[0].to + 10 });
    // two identical ones on the recorded line: strict refuses, navigation picks the nearest
    const same = "x %% XXX: n %% y %% XXX: n %%";
    const [a, b] = scan(same, X);
    const shifted = "zz" + same;
    expect(locate(shifted, a, X, true)).toBeNull();
    expect(locate(shifted, b, X, false)).toEqual({ from: b.from + 2, to: b.to + 2 });
  });

  it("does not match text that merely resembles the raw at the offset", () => {
    const m: IndexedMarker = { line: 0, from: 0, to: 4, text: "", raw: "" };
    expect(locate("abcd", m, X, true)).toBeNull();
  });

  it("resolves by removing the placeholder", () => {
    const r = resolvePlaceholder(text, markers[0], X);
    expect(r?.text).toBe("Intro.\n\nShe opened the door.\n\nLater %% XXX: date %% again.");
  });

  it("resolves after the text shifted", () => {
    const shifted = "Added.\n" + text;
    const r = resolvePlaceholder(shifted, markers[1], X);
    expect(r?.text).toBe("Added.\nIntro.\n\nShe opened %% XXX: window? %% the door.\n\nLater again.");
  });

  it("changes nothing when the placeholder can't be verified", () => {
    expect(resolvePlaceholder(text.replace("date", "data"), markers[1], X)).toBeNull();
    // the marker word changed in settings: the raw no longer parses as a placeholder
    expect(resolvePlaceholder(text, markers[0], "TODO")).toBeNull();
  });

  it("prose is preserved exactly around every resolution", () => {
    const doc = "# T\n\nA %% XXX: 1 %% b.\n%% XXX: 2 %%\nC %% XXX: 3 %%";
    let cur = doc;
    for (let i = 0; i < 3; i++) {
      const [first] = scan(cur, X);
      const r = resolvePlaceholder(cur, first, X);
      expect(r).not.toBeNull();
      cur = r!.text;
    }
    expect(cur).toBe("# T\n\nA b.\nC");
    expect(scan(cur, X)).toEqual([]);
  });
});

describe("stepIndex", () => {
  const starts = [10, 20, 30];
  it("goes to the next one after the cursor, wrapping", () => {
    expect(stepIndex(starts, 0, 1)).toBe(0);
    expect(stepIndex(starts, 10, 1)).toBe(1);
    expect(stepIndex(starts, 15, 1)).toBe(1);
    expect(stepIndex(starts, 30, 1)).toBe(0);
    expect(stepIndex(starts, 99, 1)).toBe(0);
  });
  it("goes to the previous one before the cursor, wrapping", () => {
    expect(stepIndex(starts, 99, -1)).toBe(2);
    expect(stepIndex(starts, 30, -1)).toBe(1);
    expect(stepIndex(starts, 11, -1)).toBe(0);
    expect(stepIndex(starts, 10, -1)).toBe(2);
    expect(stepIndex(starts, 0, -1)).toBe(2);
  });
  it("handles one or no placeholders", () => {
    expect(stepIndex([], 5, 1)).toBe(-1);
    expect(stepIndex([], 5, -1)).toBe(-1);
    expect(stepIndex([7], 7, 1)).toBe(0);
    expect(stepIndex([7], 7, -1)).toBe(0);
  });
});

describe("files", () => {
  it("isIndexable accepts markdown outside excluded folders", () => {
    expect(isIndexable("Novels/A.md", ["Templates"])).toBe(true);
    // B4: an exact ".md", as the rebuild (getMarkdownFiles) already required
    expect(isIndexable("Novels/A.MD", [])).toBe(false);
    expect(isIndexable("Templates2/a.md", ["Templates"])).toBe(true);
    expect(isIndexable("Templates/a.md", ["/Templates/"])).toBe(false);
    expect(isIndexable("Novels/A.md", ["  "])).toBe(true);
    expect(isIndexable("Templates/Chapter.md", ["Templates"])).toBe(false);
    expect(isIndexable("Novels/board.canvas", [])).toBe(false);
    expect(isIndexable("Novels/A.md", [""])).toBe(true);
    expect(isIndexable("Novels/A.md", ["/", " // "])).toBe(true); // blank after edge slashes, like folderList
  });

  it("orderPaths puts chapters first in chapter order, then the rest naturally", () => {
    const paths = ["Notes/b.md", "Book/Chapters/10 Ten.md", "Notes/a10.md", "Book/Chapters/02 Two.md", "Notes/a9.md", "Book.md"];
    const chapters = ["Book/Chapters/01 One.md", "Book/Chapters/02 Two.md", "Book/Chapters/10 Ten.md"];
    expect(orderPaths(paths, chapters)).toEqual([
      "Book/Chapters/02 Two.md", "Book/Chapters/10 Ten.md", "Book.md", "Notes/a9.md", "Notes/a10.md", "Notes/b.md",
    ]);
  });

  it("orderPaths handles empty inputs and duplicates", () => {
    expect(orderPaths([], ["a.md"])).toEqual([]);
    expect(orderPaths(["b.md", "a.md"], [])).toEqual(["a.md", "b.md"]);
    expect(orderPaths(["a.md", "a.md"], ["a.md", "a.md"])).toEqual(["a.md"]);
  });

  it("displayName and parentPath", () => {
    expect(displayName("Novels/A Casa/Chapters/03 O porão.md")).toBe("03 O porão");
    expect(displayName("root.md")).toBe("root");
    expect(parentPath("Novels/A Casa.md")).toBe("Novels");
    expect(parentPath("root.md")).toBe("");
  });
});

describe("PlaceholderStore", () => {
  const ms = (text: string) => scan(text, X);

  it("counts, lists and only keeps files with placeholders", () => {
    const s = new PlaceholderStore();
    s.set("a.md", ms("%% XXX: 1 %% %% XXX: 2 %%"));
    s.set("b.md", ms("nothing"));
    expect(s.countFor("a.md")).toBe(2);
    expect(s.countFor("b.md")).toBe(0);
    expect(s.countFor("missing.md")).toBe(0);
    expect(s.paths()).toEqual(["a.md"]);
    expect(s.total()).toBe(2);
    expect(s.entries()[0].markers.map((m) => m.text)).toEqual(["1", "2"]);
    expect(s.markersFor("nope.md")).toEqual([]);
  });

  it("notifies only on real changes", () => {
    const s = new PlaceholderStore();
    const cb = vi.fn();
    const off = s.onChange(cb);
    expect(s.set("a.md", ms("%% XXX: 1 %%"))).toBe(true);
    expect(s.set("a.md", ms("%% XXX: 1 %%"))).toBe(false);
    expect(s.set("b.md", [])).toBe(false);
    expect(s.set("a.md", ms("x %% XXX: 1 %%"))).toBe(true); // moved
    expect(s.rename("a.md", "c.md")).toBe(true);
    expect(s.rename("zzz.md", "y.md")).toBe(false);
    expect(s.rename("c.md", "c.md")).toBe(false);
    expect(s.countFor("c.md")).toBe(1);
    expect(s.countFor("a.md")).toBe(0);
    expect(s.remove("c.md")).toBe(true);
    expect(s.remove("c.md")).toBe(false);
    expect(cb).toHaveBeenCalledTimes(4);
    off();
    s.set("a.md", ms("%% XXX: 1 %%"));
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it("setting an empty list removes the file", () => {
    const s = new PlaceholderStore();
    s.set("a.md", ms("%% XXX: 1 %%"));
    expect(s.set("a.md", [])).toBe(true);
    expect(s.paths()).toEqual([]);
  });

  it("replaceAll swaps the index in one notification and keeps paths touched during a build", () => {
    const s = new PlaceholderStore();
    s.set("live.md", ms("%% XXX: new %%"));
    s.set("old.md", ms("%% XXX: gone %%"));
    const cb = vi.fn();
    s.onChange(cb);
    const fresh = new Map([
      ["live.md", ms("%% XXX: stale %%")],
      ["deleted.md", ms("%% XXX: stale %%")],
      ["x.md", ms("%% XXX: x %% %% XXX: y %%")],
      ["empty.md", []],
    ]);
    s.replaceAll(fresh, new Set(["live.md", "deleted.md"]));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.markersFor("live.md")[0].text).toBe("new");
    expect(s.countFor("deleted.md")).toBe(0);
    expect(s.countFor("old.md")).toBe(0);
    expect(s.countFor("x.md")).toBe(2);
    expect(s.paths().sort()).toEqual(["live.md", "x.md"]);
  });

  it("replaceAll with identical content does not notify", () => {
    const s = new PlaceholderStore();
    s.set("a.md", ms("%% XXX: 1 %%"));
    const cb = vi.fn();
    s.onChange(cb);
    s.replaceAll(new Map([["a.md", ms("%% XXX: 1 %%")]]));
    s.replaceAll(new Map([["a.md", ms("%% XXX: 1 %%")]]));
    expect(cb).not.toHaveBeenCalled();
    s.replaceAll(new Map());
    expect(cb).toHaveBeenCalledTimes(1);
    s.clear();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("a failing listener doesn't stop the others", () => {
    const s = new PlaceholderStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = vi.fn();
    s.onChange(() => { throw new Error("boom"); });
    s.onChange(good);
    s.set("a.md", ms("%% XXX: 1 %%"));
    expect(good).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("a listener may unsubscribe while being notified", () => {
    const s = new PlaceholderStore();
    const calls: string[] = [];
    const offA = s.onChange(() => { calls.push("a"); offA(); });
    s.onChange(() => calls.push("b"));
    s.set("a.md", ms("%% XXX: 1 %%"));
    s.set("a.md", []);
    expect(calls).toEqual(["a", "b", "b"]);
  });
});
