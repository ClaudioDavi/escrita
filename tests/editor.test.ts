import { describe, it, expect } from "vitest";
import { blockStateIn, bodyLineIn, inlineProtected } from "../src/core/block-context";
import { breakEdit, decideEnter, isProseLine, trailingBreakKeep, withoutTrailingBreak } from "../src/editor/enter-flow";
import { segment } from "../src/core/markdown";
import { typographyFor, type TypographyOptions } from "../src/core/typography";
import { sceneBreakEdit } from "../src/editor/scene-break";
import { spellcheckSuppressed } from "../src/editor/spellcheck";

const L = (s: string) => s.split("\n");
const D = (s: string) => segment(s);

/** Apply a LineEdit to lines, return the new text. */
function applyLineEdit(lines: string[], e: { fromLine: number; toLine: number; insert: string }): string {
  return [...lines.slice(0, e.fromLine), e.insert, ...lines.slice(e.toLine + 1)].join("\n");
}

describe("blockStateIn", () => {
  it("detects frontmatter, including the closing line", () => {
    const lines = D("---\na: 1\n---\nbody");
    expect(blockStateIn(lines, 0).frontmatter).toBe(false);
    expect(blockStateIn(lines, 1).frontmatter).toBe(true);
    expect(blockStateIn(lines, 2).frontmatter).toBe(true);
    expect(blockStateIn(lines, 3).frontmatter).toBe(false);
  });
  it("treats unclosed frontmatter as frontmatter", () => {
    expect(blockStateIn(D("---\na: 1\nmore"), 2).frontmatter).toBe(true);
  });
  it("accepts ... as the frontmatter closer", () => {
    expect(blockStateIn(D("---\na: 1\n...\nbody"), 3).frontmatter).toBe(false);
  });
  it("tracks fenced code with backticks and tildes", () => {
    const lines = D("a\n```js\nx\n```\nb\n~~~~\n```\n~~~~\nc");
    expect(blockStateIn(lines, 2).code).toBe(true);
    expect(blockStateIn(lines, 4).code).toBe(false);
    expect(blockStateIn(lines, 6).code).toBe(true); // ``` inside ~~~~ doesn't close
    expect(blockStateIn(lines, 8).code).toBe(false);
  });
  it("needs a fence at least as long to close", () => {
    const lines = D("````\n```\nx\n````\ny");
    expect(blockStateIn(lines, 2).code).toBe(true);
    expect(blockStateIn(lines, 4).code).toBe(false);
  });
  it("tracks math blocks and multi-line comments", () => {
    const lines = D("$$\nx^2\n$$\n%%\nnote\n%%\n$$x$$\n%% beat: b %%\nz");
    expect(blockStateIn(lines, 1).math).toBe(true);
    expect(blockStateIn(lines, 3).math).toBe(false);
    expect(blockStateIn(lines, 4).comment).toBe(true);
    expect(blockStateIn(lines, 6).comment).toBe(false);
    const end = blockStateIn(lines, 8);
    expect(end.math || end.comment || end.code).toBe(false);
  });
  it("ignores markers inside code", () => {
    // D18: a $$ not at a line start is no math, an unclosed one neither
    expect(blockStateIn(D("texto $$ x\n%% y\n$$"), 1).math).toBe(false);
    expect(blockStateIn(D("$$\nx"), 1).math).toBe(false);
    expect(blockStateIn(D("```\n%%\n$$\n```\nx"), 4)).toEqual({ frontmatter: false, code: false, math: false, comment: false });
  });
  it("handles empty input and out of range", () => {
    expect(blockStateIn(D(""), 0).frontmatter).toBe(false);
    expect(blockStateIn(D("a"), 10).code).toBe(false);
  });
});

describe("inlineProtected", () => {
  it("inline code", () => {
    expect(inlineProtected("see `code")).toBe(true);
    expect(inlineProtected("see `code` and")).toBe(false);
    expect(inlineProtected("see ``a ` b")).toBe(true);
    expect(inlineProtected("see ``a ` b`` c")).toBe(false);
    expect(inlineProtected("escaped \\` tick")).toBe(false);
  });
  it("inline math, sparing prices", () => {
    expect(inlineProtected("so $x")).toBe(true);
    expect(inlineProtected("so $x$ then")).toBe(false);
    expect(inlineProtected("it cost $5 and")).toBe(false);
    expect(inlineProtected("a $ alone")).toBe(false);
    expect(inlineProtected("block $$")).toBe(false);
  });
  it("link targets but not link text or aliases", () => {
    expect(inlineProtected("go [[Some No")).toBe(true);
    expect(inlineProtected("go [[Note|ali")).toBe(false);
    expect(inlineProtected("go [[Note]] and")).toBe(false);
    expect(inlineProtected("go [te")).toBe(false);
    expect(inlineProtected("go [text](http")).toBe(true);
    expect(inlineProtected("go [text](url) then")).toBe(false);
  });
  it("urls, html, tables", () => {
    expect(inlineProtected("see https://example.com/a")).toBe(true);
    expect(inlineProtected("see https://example.com/a and")).toBe(false);
    expect(inlineProtected('<span class="x')).toBe(true);
    expect(inlineProtected("<span>text")).toBe(false);
    expect(inlineProtected("<!-- note")).toBe(true);
    expect(inlineProtected("<!-- note --> then")).toBe(false);
    expect(inlineProtected("| cell")).toBe(true);
    expect(inlineProtected("plain prose")).toBe(false);
    expect(inlineProtected("")).toBe(false);
  });
});

describe("isProseLine", () => {
  it("classifies lines", () => {
    expect(isProseLine("She opened the door.")).toBe(true);
    expect(isProseLine("— Quem é? — ela disse.")).toBe(true);
    expect(isProseLine("  \tindented prose")).toBe(true);
    for (const l of ["", "   ", "---", "***", "* * *", "- item", "1. item", "2) item", "# Heading",
      "> quote", "| a | b |", "```", "~~~", "$$", "%% beat: x %%", "%% XXX: fix %%  "]) {
      expect(isProseLine(l), l).toBe(false);
    }
    expect(isProseLine("prose %% XXX: note %%")).toBe(true);
    expect(isProseLine("#hashtag at start")).toBe(true);
  });
});

describe("decideEnter", () => {
  it("normal Enter until the paragraph spacing is exceeded (blank style)", () => {
    expect(decideEnter(D("prose"), 0, "blank")).toBe("normal"); // not an empty line
    expect(decideEnter(D("prose\n"), 1, "blank")).toBe("normal"); // 1 empty
    expect(decideEnter(D("prose\n\n"), 2, "blank")).toBe("break"); // 2 empty
    expect(decideEnter(D("prose\n\n\n\n"), 4, "blank")).toBe("break");
  });
  it("single style breaks one Enter sooner", () => {
    expect(decideEnter(D("prose\n"), 1, "single")).toBe("break");
  });
  it("counts only empty lines above the cursor, including whitespace-only", () => {
    expect(decideEnter(D("prose\n  \n\t"), 2, "blank")).toBe("break");
    expect(decideEnter(D("prose\n\n\n"), 1, "blank")).toBe("normal");
  });
  it("works with prose after the cursor (break mid-chapter)", () => {
    expect(decideEnter(D("a\n\n\nb"), 2, "blank")).toBe("break");
  });
  it("never inside frontmatter or right under it", () => {
    expect(decideEnter(D("---\n\n\n---\n"), 2, "blank")).toBe("normal");
    expect(decideEnter(D("---\na: 1\n---\n\n"), 4, "blank")).toBe("normal");
    expect(decideEnter(D("---\na: 1\n---\n\n\n"), 5, "single")).toBe("normal");
  });
  it("unclosed frontmatter disables it", () => {
    expect(decideEnter(D("---\nprose\n\n"), 3, "blank")).toBe("normal");
  });
  it("not in code, math or comment blocks", () => {
    expect(decideEnter(D("```\ncode\n\n\n```"), 3, "blank")).toBe("normal");
    expect(decideEnter(D("$$\nx\n\n\n$$"), 3, "blank")).toBe("normal");
    expect(decideEnter(D("%%\nnote\n\n\n%%"), 3, "blank")).toBe("normal");
    expect(decideEnter(D("```\ncode\n```\n\n"), 4, "blank")).toBe("normal"); // above is a fence
  });
  it("not after lists, headings, quotes, tables, beats", () => {
    for (const above of ["- item", "1. item", "# Title", "> quote", "| a |", "%% beat: b %%"]) {
      expect(decideEnter(D(`${above}\n\n`), 2, "blank"), above).toBe("normal");
    }
  });
  it("not on a line with text or out of range", () => {
    expect(decideEnter(D("prose\n\nx"), 2, "blank")).toBe("normal");
    expect(decideEnter(D("prose"), 5, "blank")).toBe("normal");
    expect(decideEnter(D("prose"), -1, "blank")).toBe("normal");
    expect(decideEnter(D(""), 0, "blank")).toBe("normal");
    expect(decideEnter(D("\n\n"), 2, "blank")).toBe("normal"); // nothing above
  });
  it("chapter after a trailing scene break", () => {
    expect(decideEnter(D("prose\n\n---\n\n"), 4, "blank")).toBe("chapter");
    expect(decideEnter(D("prose\n\n---\n\n\n  "), 4, "blank")).toBe("chapter"); // only whitespace follows
    expect(decideEnter(D("prose\n\n***\n\n"), 4, "blank")).toBe("chapter");
    expect(decideEnter(D("prose\n\n---\n"), 3, "single")).toBe("chapter");
  });
  it("no chapter when anything follows the cursor", () => {
    expect(decideEnter(D("prose\n\n---\n\n\nmore"), 4, "blank")).toBe("normal");
  });
  it("no chapter straight after typing --- (spacing not reached yet)", () => {
    expect(decideEnter(D("prose\n\n---\n"), 3, "blank")).toBe("normal");
  });
  it("a setext heading underline is not a scene break", () => {
    expect(decideEnter(D("Title\n---\n\n"), 3, "blank")).toBe("normal");
  });
  it("a break right after the frontmatter still counts", () => {
    expect(decideEnter(D("---\na: 1\n---\n---\n\n"), 5, "blank")).toBe("chapter");
  });
  it("frontmatter closer is not a scene break", () => {
    expect(decideEnter(D("---\na: 1\n---\n\n\n"), 5, "blank")).toBe("normal");
  });
  it("a break at the very start of a file without frontmatter", () => {
    // line 0 "---" with no closer is treated as unclosed frontmatter → safe no-op
    expect(decideEnter(D("---\n\n"), 2, "blank")).toBe("normal");
  });
});

describe("breakEdit", () => {
  it("turns the empty run into blank, ---, blank, cursor line", () => {
    const lines = L("prose\n\n");
    const e = breakEdit(D(lines.join("\n")), 2);
    expect(e).toEqual({ fromLine: 1, toLine: 2, insert: "\n---\n\n" });
    expect(applyLineEdit(lines, e)).toBe("prose\n\n---\n\n");
  });
  it("collapses longer runs and keeps text below", () => {
    const lines = L("a\n\n\n\nb");
    const e = breakEdit(D(lines.join("\n")), 3);
    expect(applyLineEdit(lines, e)).toBe("a\n\n---\n\n\nb");
  });
  it("single style", () => {
    const lines = L("a\n");
    expect(applyLineEdit(lines, breakEdit(D(lines.join("\n")), 1))).toBe("a\n\n---\n\n");
  });
  it("after the break, the next Enter makes a chapter", () => {
    const lines = L(applyLineEdit(L("prose\n\n"), breakEdit(D("prose\n\n"), 2)));
    expect(decideEnter(D(lines.join("\n")), lines.length - 1, "blank")).toBe("chapter");
    expect(decideEnter(D(lines.join("\n")), lines.length - 1, "single")).toBe("chapter");
  });
});

describe("trailingBreakKeep", () => {
  it("finds the lines to keep", () => {
    expect(trailingBreakKeep(D("prose\n\n---\n\n"))).toBe(1);
    expect(trailingBreakKeep(D("a\nb\n\n\n* * *"))).toBe(2);
  });
  it("keeps the frontmatter", () => {
    expect(trailingBreakKeep(D("---\na: 1\n---\n\n---\n"))).toBe(3);
    expect(trailingBreakKeep(D("---\na: 1\n---\n---\n"))).toBe(3);
  });
  it("null when the text doesn't end with a break", () => {
    expect(trailingBreakKeep(D("prose\n"))).toBeNull();
    expect(trailingBreakKeep(D("---\na: 1\n---\n"))).toBeNull(); // frontmatter closer
    expect(trailingBreakKeep(D("Title\n---"))).toBeNull(); // setext heading
    expect(trailingBreakKeep(D(""))).toBeNull();
    expect(trailingBreakKeep(D(""))).toBeNull();
  });
  it("never drops prose", () => {
    const lines = L("one\n\ntwo\n\n---\n\n\n");
    const keep = trailingBreakKeep(D(lines.join("\n")))!;
    expect(lines.slice(0, keep).join("\n")).toBe("one\n\ntwo");
  });
});

describe("typographyFor", () => {
  const curly: TypographyOptions = { quoteStyle: "curly", dialogueDash: true };
  const apply = (before: string, typed: string, o = curly) => {
    const r = typographyFor(before, typed, o);
    return r ? before.slice(0, before.length - r.deleteBefore) + r.insert : before + typed;
  };

  it("em dash from --, not at the start of a line", () => {
    expect(apply("word-", "-")).toBe("word—");
    expect(apply("word -", "-")).toBe("word —");
    expect(apply("-", "-")).toBe("--");
    expect(apply("   -", "-")).toBe("   --");
    expect(apply("> -", "-")).toBe("> --");
    expect(apply("word--", "-")).toBe("word---");
    expect(apply("<!-", "-")).toBe("<!--");
    expect(apply("word", "-")).toBe("word-");
  });
  it("dialogue dash", () => {
    expect(apply("--", " ")).toBe("— ");
    expect(apply("  --", " ")).toBe("  — ");
    expect(apply("> --", " ")).toBe("> — ");
    expect(apply("--", " ", { ...curly, dialogueDash: false })).toBe("-- ");
    expect(apply("a --", " ")).toBe("a -- ");
    expect(apply("---", " ")).toBe("--- ");
  });
  it("ellipsis", () => {
    expect(apply("wait..", ".")).toBe("wait…");
    expect(apply("..", ".")).toBe("…");
    expect(apply("wait...", ".")).toBe("wait....");
    expect(apply("wait.", ".")).toBe("wait..");
  });
  it("curly quotes by context", () => {
    expect(apply("", '"')).toBe("“");
    expect(apply("she said ", '"')).toBe("she said “");
    expect(apply("she said “hi", '"')).toBe("she said “hi”");
    expect(apply("“hi.", '"')).toBe("“hi.”");
    expect(apply("(", '"')).toBe("(“");
    expect(apply("—", '"')).toBe("—“");
    expect(apply("“", "'")).toBe("“‘");
    expect(apply("it", "'")).toBe("it’");
    expect(apply(" ", "'")).toBe(" ‘");
    expect(apply("‘quoted.", "'")).toBe("‘quoted.’");
    expect(apply("*", '"')).toBe("*“");
    expect(apply("*“hi”*", " ")).toBe("*“hi”* ");
    expect(apply("hi*", '"')).toBe("hi*”");
    expect(apply("d", "'")).toBe("d’");
    expect(apply("água", "'")).toBe("água’");
    expect(apply("90", "'")).toBe("90’");
  });
  it("guillemets and German quotes", () => {
    const g = { ...curly, quoteStyle: "guillemets" as const };
    expect(apply(" ", '"', g)).toBe(" «");
    expect(apply("«oui", '"', g)).toBe("«oui»");
    expect(apply(" ", "'", g)).toBe(" ‹");
    expect(apply("l", "'", g)).toBe("l’");
    const de = { ...curly, quoteStyle: "german" as const };
    expect(apply(" ", '"', de)).toBe(" „");
    expect(apply("„Hallo", '"', de)).toBe("„Hallo“");
    expect(apply("„", "'", de)).toBe("„‚");
    expect(apply("‚Hallo!", "'", de)).toBe("‚Hallo!‘");
    expect(apply("geht", "'", de)).toBe("geht’");
  });
  it("quotes off", () => {
    const off = { ...curly, quoteStyle: "off" as const };
    expect(apply(" ", '"', off)).toBe(' "');
    expect(apply("it", "'", off)).toBe("it'");
    expect(apply("a-", "-", off)).toBe("a—"); // dashes still work
  });
  it("skips protected inline contexts and escapes", () => {
    expect(apply("`a-", "-")).toBe("`a--");
    expect(apply("`x", '"')).toBe('`x"');
    expect(apply("[[Note-", "-")).toBe("[[Note--");
    expect(apply("[t](a..", ".")).toBe("[t](a...");
    expect(apply("https://x.com/a-", "-")).toBe("https://x.com/a--");
    expect(apply('<a href=', '"')).toBe('<a href="');
    expect(apply("| a-", "-")).toBe("| a--");
    expect(apply("\\", '"')).toBe('\\"');
    expect(apply("\\\\", '"')).toBe("\\\\”"); // escaped backslash: the quote still curls
    expect(apply("$x-", "-")).toBe("$x--");
  });
  it("records the original for Backspace", () => {
    expect(typographyFor("a-", "-", curly)).toEqual({ deleteBefore: 1, insert: "—", original: "--" });
    expect(typographyFor("..", ".", curly)).toEqual({ deleteBefore: 2, insert: "…", original: "..." });
    expect(typographyFor("--", " ", curly)).toEqual({ deleteBefore: 2, insert: "— ", original: "-- " });
    expect(typographyFor(" ", '"', curly)).toEqual({ deleteBefore: 0, insert: "“", original: '"' });
  });
  it("ignores other characters and multi-character input", () => {
    expect(typographyFor("a", "b", curly)).toBeNull();
    expect(typographyFor("a", "--", curly)).toBeNull();
    expect(typographyFor("a", "", curly)).toBeNull();
    expect(typographyFor("a", " ", curly)).toBeNull();
  });
});

describe("sceneBreakEdit", () => {
  const run = (doc: string, pos: number) => {
    const e = sceneBreakEdit(doc, pos);
    const out = doc.slice(0, e.from) + e.insert + doc.slice(e.to);
    return { out, cursorAt: out.slice(e.cursor) };
  };
  it("at the end of prose", () => {
    expect(run("prose", 5)).toEqual({ out: "prose\n\n---\n\n", cursorAt: "" });
    expect(run("prose\n\n\n", 8)).toEqual({ out: "prose\n\n---\n\n", cursorAt: "" });
    expect(run("prose  ", 7).out).toBe("prose\n\n---\n\n");
  });
  it("in the middle of a line splits it", () => {
    expect(run("abcdef", 3)).toEqual({ out: "abc\n\n---\n\ndef", cursorAt: "def" });
    expect(run("abc def", 4)).toEqual({ out: "abc\n\n---\n\ndef", cursorAt: "def" });
  });
  it("between paragraphs normalizes blank lines", () => {
    expect(run("a\n\n\n\nb", 2)).toEqual({ out: "a\n\n---\n\nb", cursorAt: "b" });
    expect(run("a\nb", 1).out).toBe("a\n\n---\n\nb");
  });
  it("keeps the next line's indentation", () => {
    expect(run("a\n\n\tb", 1).out).toBe("a\n\n---\n\n\tb");
    expect(run("a\n\n    b", 2).out).toBe("a\n\n---\n\n    b");
  });
  it("at the start never creates frontmatter", () => {
    expect(run("", 0).out).toBe("\n---\n\n");
    expect(run("prose", 0)).toEqual({ out: "\n---\n\nprose", cursorAt: "prose" });
    expect(run("\n\nprose", 1).out).toBe("\n---\n\nprose");
  });
  it("after frontmatter", () => {
    expect(run("---\na: 1\n---\n", 13).out).toBe("---\na: 1\n---\n\n---\n\n");
  });
  it("handles CRLF whitespace and clamps positions", () => {
    expect(run("a\r\n\r\nb", 1).out).toBe("a\n\n---\n\nb");
    expect(run("a", 99).out).toBe("a\n\n---\n\n");
    expect(run("a", -5).out).toBe("\n---\n\na");
  });
  it("never removes non-whitespace", () => {
    const doc = "Uma frase.  Outra\n\n\nfrase — fim.";
    for (let p = 0; p <= doc.length; p++) {
      const { out } = run(doc, p);
      expect(out.replace(/\s|---/g, "")).toBe(doc.replace(/\s/g, ""));
    }
  });
});

describe("spellcheckSuppressed", () => {
  it("only when on demand and not turned on", () => {
    expect(spellcheckSuppressed(true, false)).toBe(true);
    expect(spellcheckSuppressed(true, true)).toBe(false);
    expect(spellcheckSuppressed(false, false)).toBe(false);
    expect(spellcheckSuppressed(false, true)).toBe(false);
  });
});

describe("withoutTrailingBreak", () => {
  it("drops the break and blank lines of an LF file", () => {
    expect(withoutTrailingBreak("one\n\ntwo\n\n---\n\n")).toBe("one\n\ntwo\n");
  });
  it("keeps a CRLF file's endings", () => {
    expect(withoutTrailingBreak("one\r\n\r\ntwo\r\n\r\n---\r\n\r\n")).toBe("one\r\n\r\ntwo\r\n");
  });
  it("keeps a mixed LF/CRLF file's own endings", () => {
    expect(withoutTrailingBreak("one\r\ntwo\nthree\r\n\n---\r\n")).toBe("one\r\ntwo\nthree\r\n");
  });
  it("returns the same string when there is no trailing break", () => {
    const text = "one\r\n\ntwo\n";
    expect(withoutTrailingBreak(text)).toBe(text);
    expect(withoutTrailingBreak("---\na: 1\n---\n")).toBe("---\na: 1\n---\n");
  });
  it("a text that is only a break gives an empty string", () => {
    expect(withoutTrailingBreak("* * *\n")).toBe("");
    expect(withoutTrailingBreak("\n---\n\n")).toBe("");
  });
});
