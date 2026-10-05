import { describe, it, expect } from "vitest";
import { segment, segmentDoc, type Kind, type Markdown } from "../src/core/markdown";

const ABBR: Record<Kind, string> = { prose: "P", frontmatter: "F", code: "C", comment: "%" };

/** Spans as "K:text" pieces; unclosed spans get a trailing "!", html comments a leading "h". */
function pieces(text: string): string[] {
  return segment(text).spans().map((s) =>
    `${s.form === "html" ? "h" : ""}${ABBR[s.kind]}:${text.slice(s.from, s.to)}${s.closed ? "" : "!"}`);
}

/** What each line starts inside, one letter per line. */
function starts(text: string): string {
  const md = segment(text);
  let out = "";
  for (let i = 0; i < md.lineCount; i++) out += ABBR[md.startsIn(i)];
  return out;
}

/** The non-prose texts only. */
function hidden(text: string): string[] {
  return segment(text).spans().filter((s) => s.kind !== "prose").map((s) => text.slice(s.from, s.to));
}

// ------------------------------------------------------------ invariants

function checkInvariants(text: string, md: Markdown): void {
  const spans = md.spans();
  if (text === "") expect(spans).toEqual([]);
  let at = 0;
  spans.forEach((s, i) => {
    expect(s.from, "contiguous").toBe(at);
    expect(s.to, "non-empty").toBeGreaterThan(s.from);
    if (i > 0) expect(s.kind === "prose" && spans[i - 1].kind === "prose", "merged").toBe(false);
    if (i < spans.length - 1) expect(s.closed, "only the last may be unclosed").toBe(true);
    if (!s.closed) expect(s.to).toBe(text.length);
    // form: comments say which syntax (never an unclosed html one), other kinds have none
    if (s.kind === "comment") expect(["%%", "html"]).toContain(s.form);
    else expect(s.form, "form only on comments").toBeUndefined();
    if (s.form === "html") expect(s.closed, "an html comment is always closed").toBe(true);
    at = s.to;
  });
  expect(at, "covers the text").toBe(text.length);

  expect(md.startsIn(0)).toBe("prose");
  expect(md.startsIn(md.lineCount)).toBe("prose");
  for (let i = 1; i < md.lineCount; i++) {
    const nl = md.lineStart(i) - 1;
    const holder = spans.find((s) => s.from <= nl && nl < s.to)!;
    expect(md.startsIn(i)).toBe(holder.kind);
  }

  const mask = md.masked();
  expect(mask.length).toBe(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n" || c === "\r") expect(mask[i]).toBe(c);
  }
  for (const s of spans) {
    const part = mask.slice(s.from, s.to);
    if (s.kind === "prose") expect(part).toBe(text.slice(s.from, s.to));
    else expect(part.trim()).toBe("");
  }
}

/** A small deterministic PRNG so the fuzz corpus is the same on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const TOKENS = ["a ", "palavra", "\n", "\n\n", "\r\n", "%%", "`", "```", "````", "~~~", "  ```", "    ```",
  "---", "...", "$$", "<!--", "-->", "\\`", "%% XXX: n %%", "%% beat: b %%", " ", "``",
  "\\\\", "\\\\`", "\t", "\t```", "~~~~"];

function corpus(count: number, seed = 7): string[] {
  const r = rng(seed);
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    const len = Math.floor(r() * 24);
    let s = "";
    for (let i = 0; i < len; i++) s += TOKENS[Math.floor(r() * TOKENS.length)];
    out.push(s);
  }
  return out;
}

const TABLE = [
  "", "a", "---\na: 1\n---\nb", "---\na\n", "```\nx\n```", "```\nx", "a %% b\nc %% d", "a %% b",
  "`a` b ``c`` d", "<!-- a\nb --> c", "<!-- a", "\\`a` b", "---\r\na\r\n...\r\n```\r\n%%\r\n```\r\nx",
  "%%\n```\n%%\nx", "a\n  ```\n%%\n  ```\nb", "x\n    ```\ny", "😀 %% 😀 %% 😀",
];

describe("invariants", () => {
  it("hold on the table and a seeded fuzz corpus", () => {
    for (const text of [...TABLE, ...corpus(3000)]) checkInvariants(text, segment(text));
  }, 30000);

  it("a line's state depends only on the text before it (except frontmatter and <!-- look-ahead)", () => {
    for (const text of [...TABLE, ...corpus(1500, 11)]) {
      // a <!-- looks ahead for its -->: only lines up to the first one are checked
      // so does a line-start $$ for its closing $$ (D16)
      const html = Math.min(...["<!--", "$$"].map((k) => { const x = text.indexOf(k); return x === -1 ? Infinity : x; }));
      const md = segment(text);
      for (let i = md.bodyLine + 1; i < md.lineCount; i++) {
        if (md.lineStart(i) > html) break;
        const cut = segment(text.slice(0, md.lineStart(i)));
        if (cut.bodyLine !== md.bodyLine) continue; // the frontmatter's closer was cut off
        expect(cut.startsIn(i), JSON.stringify(text) + " line " + i).toBe(md.startsIn(i));
      }
    }
  });

  it("CRLF and LF give the same kinds per line", () => {
    for (const text of [...TABLE, ...corpus(1500, 13)]) {
      const lf = text.replace(/\r\n/g, "\n");
      const crlf = lf.replace(/\n/g, "\r\n");
      expect(starts(crlf), JSON.stringify(lf)).toBe(starts(lf));
      const a = segment(lf);
      const b = segment(crlf);
      expect(b.bodyLine).toBe(a.bodyLine);
      expect(b.unclosedFrontmatter).toBe(a.unclosedFrontmatter);
      expect(b.spans().map((s) => s.kind)).toEqual(a.spans().map((s) => s.kind));
    }
  });

  it("is deterministic and caches only the exact string", () => {
    const t = "a %% b %% c";
    const md = segment(t);
    expect(segment(t)).toBe(md);
    const other = segment(t + " ");
    expect(other).not.toBe(md);
    expect(other.text).toBe(t + " ");
    expect(segment(t).spans()).toEqual(md.spans());
  });
});

// ------------------------------------------------------------ rules

describe("frontmatter", () => {
  it("is a span from line 0 to the end of its closer's content", () => {
    expect(pieces("---\na: 1\n---\nbody")).toEqual(["F:---\na: 1\n---", "P:\nbody"]);
    expect(segment("---\na: 1\n---\nbody").bodyLine).toBe(3);
  });
  it("accepts ... as the closer and trailing blanks", () => {
    expect(pieces("--- \na\n...\t\nb")).toEqual(["F:--- \na\n...\t", "P:\nb"]);
  });
  it("can be empty", () => {
    expect(pieces("---\n---\nx")).toEqual(["F:---\n---", "P:\nx"]);
    expect(segment("---\n---").bodyLine).toBe(2);
  });
  it("closes on the last line without a newline", () => {
    expect(pieces("---\na: 1\n---")).toEqual(["F:---\na: 1\n---"]);
  });
  it("unclosed: no span, flag set, body from line 0", () => {
    const md = segment("---\na: %% x %%\nb");
    expect(md.unclosedFrontmatter).toBe(true);
    expect(md.bodyLine).toBe(0);
    expect(pieces(md.text)).toEqual(["P:---\na: ", "%:%% x %%", "P:\nb"]);
  });
  it("only on line 0", () => {
    expect(hidden("\n---\na\n---\nb")).toEqual([]);
    expect(segment("\n---\na\n---").bodyLine).toBe(0);
  });
  it("hides markers inside it", () => {
    expect(pieces("---\nx: \"%% XXX %%\"\n---\n")).toEqual(["F:---\nx: \"%% XXX %%\"\n---", "P:\n"]);
  });
  it("CRLF", () => {
    expect(pieces("---\r\na\r\n---\r\nb")).toEqual(["F:---\r\na\r\n---", "P:\r\nb"]);
  });
});

describe("fenced code", () => {
  it("backticks and tildes, fence lines included", () => {
    expect(pieces("a\n```js\nx\n```\nb")).toEqual(["P:a\n", "C:```js\nx\n```", "P:\nb"]);
    expect(pieces("~~~\nx\n~~~")).toEqual(["C:~~~\nx\n~~~"]);
  });
  it("indent 0-3 opens, 4 does not", () => {
    expect(hidden("   ```\nx\n   ```")).toEqual(["   ```\nx\n   ```"]);
    expect(hidden("    ```\nx\n    ```")).toEqual([]);
  });
  it("a tab in the indent doesn't open a fence (D4: only spaces, like CommonMark)", () => {
    expect(hidden("\t```\nx\n\t```")).toEqual([]);
    expect(hidden(" \t```\nx")).toEqual([]);
  });
  it("closer: same char, at least as long, blanks only after", () => {
    expect(hidden("````\n```\nx\n````\ny")).toEqual(["````\n```\nx\n````"]);
    expect(hidden("```\nx\n`````\ny")).toEqual(["```\nx\n`````"]);
    expect(hidden("~~~~\n```\n~~~\n~~~~ \nb")).toEqual(["~~~~\n```\n~~~\n~~~~ "]);
    expect(pieces("```\nx\n``` js\ny")).toEqual(["C:```\nx\n``` js\ny!"]);
  });
  it("a backtick info string can't contain a backtick", () => {
    expect(hidden("```a`b\nnot code")).toEqual([]);
    expect(hidden("~~~a`b\ncode\n~~~")).toEqual(["~~~a`b\ncode\n~~~"]);
  });
  it("unclosed runs to the end", () => {
    const md = segment("a\n```\nx %% y");
    expect(pieces(md.text)).toEqual(["P:a\n", "C:```\nx %% y!"]);
  });
  it("%%, <!-- and backticks inside are literal", () => {
    expect(hidden("```\n%% x\n<!-- y\n`z`\n```\nb")).toEqual(["```\n%% x\n<!-- y\n`z`\n```"]);
  });
  it("a fence inside an open %% comment is literal", () => {
    expect(pieces("%%\n```\n%%\nprose")).toEqual(["%:%%\n```\n%%", "P:\nprose"]);
  });
  it("opens after a comment that closed on the line before", () => {
    expect(hidden("%% a\nb %%\n```\nc\n```")).toEqual(["%% a\nb %%", "```\nc\n```"]);
  });
  it("only at a line start", () => {
    expect(hidden("a ```\nb")).toEqual([]);
  });
});

describe("inline code", () => {
  it("closes with a run of the same length", () => {
    expect(pieces("a `b` c")).toEqual(["P:a ", "C:`b`", "P: c"]);
    expect(hidden("a ``x ` %%`` b")).toEqual(["``x ` %%``"]);
  });
  it("an unmatched run is literal", () => {
    expect(hidden("a ` %% b")).toEqual(["%% b"]);
    expect(hidden("a ``x` b")).toEqual([]);
  });
  it("adjacent runs", () => {
    expect(hidden("`a``b`")).toEqual(["`a``b`"]);
    expect(hidden("`a` `b`")).toEqual(["`a`", "`b`"]);
  });
  it("an escaped backtick doesn't open", () => {
    expect(hidden("a \\`b` c")).toEqual([]);
    expect(hidden("a \\\\`b` c")).toEqual(["`b`"]);
  });
  it("%% inside is literal", () => {
    expect(hidden("use `%%` here")).toEqual(["`%%`"]);
  });
  it("is single-line", () => {
    expect(hidden("a `b\nc` d")).toEqual([]);
  });
});

describe("%% comments", () => {
  it("single and multi-line", () => {
    expect(pieces("a %% b %% c")).toEqual(["P:a ", "%:%% b %%", "P: c"]);
    expect(pieces("a %%\nb\n%% c")).toEqual(["P:a ", "%:%%\nb\n%%", "P: c"]);
  });
  it("unclosed runs to the end", () => {
    const s = segment("a\n%% b\nc").spans();
    expect(s[s.length - 1]).toMatchObject({ kind: "comment", closed: false, form: "%%" });
  });
  it("backticks inside are literal, and an inline code span opened first protects %%", () => {
    expect(pieces("a %% `b %% c`")).toEqual(["P:a ", "%:%% `b %%", "P: c`"]);
  });
  it("%%%% is an empty comment", () => {
    expect(pieces("a%%%%b")).toEqual(["P:a", "%:%%%%", "P:b"]);
  });
  it("a single % is prose", () => {
    expect(hidden("50% off")).toEqual([]);
  });
});

describe("HTML comments", () => {
  it("closed, single and multi-line", () => {
    expect(pieces("a <!-- b --> c")).toEqual(["P:a ", "h%:<!-- b -->", "P: c"]);
    expect(hidden("a <!-- b\nc --> d")).toEqual(["<!-- b\nc -->"]);
  });
  it("unclosed is literal prose", () => {
    expect(hidden("a <!-- b\nc")).toEqual([]);
    expect(hidden("a <!-- b %% c %%")).toEqual(["%% c %%"]);
  });
  it("%% inside is literal", () => {
    expect(hidden("<!-- %% -->")).toEqual(["<!-- %% -->"]);
    // D14: an odd %% inside a closed <!-- --> is literal; the next %% opens a comment
    expect(pieces("<!-- a %% --> b %% c")).toEqual(["h%:<!-- a %% -->", "P: b ", "%:%% c!"]);
  });
  it("<!-- inside %% is literal", () => {
    expect(pieces("%% <!-- %% b -->")).toEqual(["%:%% <!-- %%", "P: b -->"]);
  });
});

describe("cases moved from publish's fencedLines / blankInlineCode", () => {
  it("fenced blocks, fence lines included, unclosed runs to the end", () => {
    expect(starts("a\n```js\nx\n```\nb")).toBe("PPCCP");
    expect(hidden("a\n```js\nx\n```\nb")).toEqual(["```js\nx\n```"]);
    expect(hidden("~~~~\n```\n~~~\n~~~~\nb")).toEqual(["~~~~\n```\n~~~\n~~~~"]);
    expect(pieces("```\nx")).toEqual(["C:```\nx!"]);
  });
  it("inline code only when closed by an equal run", () => {
    expect(segment("a `%%` b").masked()).toBe("a      b");
    expect(segment("a ``x ` %%`` b").masked()).toBe("a            b");
    expect(hidden("a ` %% b")).toEqual(["%% b"]);
  });
});

describe("math (D16)", () => {
  it("a $$ block from a line start is prose with nothing opening inside", () => {
    expect(hidden("$$\nx %% y %%\n$$")).toEqual([]);
    expect(hidden("$$\nx %% y\n$$\nprosa %% z %% fim")).toEqual(["%% z %%"]);
    expect(hidden("$$ a %% b $$ c %% d %%")).toEqual(["%% d %%"]);
    expect(hidden("$$\n```\nx\n```\n$$")).toEqual([]);
    expect(hidden("$$\n<!-- a $$ %% b %%")).toEqual(["%% b %%"]);
  });
  it("up to 3 spaces of indent open it, 4 do not", () => {
    expect(hidden("   $$\n%% a\n$$\n")).toEqual([]);
    expect(hidden("    $$\n%% a %%\n$$\n")).toEqual(["%% a %%"]);
  });
  it("an unclosed $$ is plain prose", () => {
    expect(hidden("$$\nx %% y %%")).toEqual(["%% y %%"]);
  });
  it("$$ after text, in a comment, in code or in frontmatter opens nothing", () => {
    expect(hidden("a $$ %% b %%\n$$")).toEqual(["%% b %%"]);
    expect(hidden("%% $$ %%\n%% a %%\n$$")).toEqual(["%% $$ %%", "%% a %%"]);
    expect(hidden("`$$`\n%% a %%\n$$")).toEqual(["`$$`", "%% a %%"]);
    expect(hidden("```\n$$\n```\n%% a %%\n$$")).toEqual(["```\n$$\n```", "%% a %%"]);
  });
});

describe("inMath (D18)", () => {
  const math = (t: string) => {
    const md = segment(t);
    return Array.from({ length: md.lineCount }, (_, l) => (md.inMath(l) ? "M" : ".")).join("");
  };
  it("lines after the opener, through the one holding the closer", () => {
    expect(math("a\n$$\nx\n$$\nb")).toBe("..MM.");
    expect(math("$$\nx\n\ny\n$$\nz")).toBe(".MMMM.");
  });
  it("a one-line block and an indented opener", () => {
    expect(math("$$ x $$\ny")).toBe("..");
    expect(math("   $$\n%% a\n$$\nz")).toBe(".MM.");
    expect(math("    $$\n%% a\n$$\nz")).toBe("....");
  });
  it("$$ not at a line start is no math, so the line-start $$ later has no closer", () => {
    expect(math("texto $$ x\n%% y\n$$")).toBe("...");
  });
  it("an unclosed $$ is not math", () => {
    expect(math("$$\nx\ny")).toBe("...");
  });
  it("$$ in code, a comment or frontmatter opens nothing; out of range is false", () => {
    expect(math("```\n$$\n```\nx\n$$")).toBe(".....");
    expect(math("%% $$ %%\nx\n$$")).toBe("...");
    expect(math("---\na: $$\n---\nx\n$$")).toBe(".....");
    const md = segment("$$\nx\n$$");
    expect([md.inMath(-1), md.inMath(0), md.inMath(99)]).toEqual([false, false, false]);
  });
});

describe("not segmented", () => {
  it("indented code, fences in quotes and lists", () => {
    expect(hidden("> ```\n> x")).toEqual([]);
    expect(hidden("- ```\n  x")).toEqual([]);
  });
});

// ------------------------------------------------------------ lines

describe("lines", () => {
  it("lineOf, lineStart, lineEnd with CRLF and clamping", () => {
    const md = segment("ab\r\ncd\n\nef");
    expect(md.lineCount).toBe(4);
    expect([0, 1, 2, 3].map((l) => md.lineStart(l))).toEqual([0, 4, 7, 8]);
    expect([0, 1, 2, 3].map((l) => md.lineEnd(l))).toEqual([2, 6, 7, 10]);
    expect(md.lineOf(0)).toBe(0);
    expect(md.lineOf(3)).toBe(0);
    expect(md.lineOf(4)).toBe(1);
    expect(md.lineOf(7)).toBe(2);
    expect(md.lineOf(10)).toBe(3);
    expect(md.lineOf(-5)).toBe(0);
    expect(md.lineOf(99)).toBe(3);
    expect(md.lineStart(-1)).toBe(0);
    expect(md.lineStart(9)).toBe(8);
    expect(md.lineEnd(9)).toBe(10);
  });
  it("empty text", () => {
    const md = segment("");
    expect(md.lineCount).toBe(1);
    expect(md.spans()).toEqual([]);
    expect(md.lineEnd(0)).toBe(0);
    expect(md.masked()).toBe("");
  });
  it("startsIn: opener line is prose, inside and closer are the block, after is prose", () => {
    expect(starts("a\n```\nx\n```\nb")).toBe("PPCCP");
    expect(starts("---\na\n---\nb")).toBe("PFFP");
    expect(starts("a %%\nb\nc %% d\ne")).toBe("P%%P");
    expect(starts("<!--\nx\n-->\ny")).toBe("P%%P");
    expect(starts("a\n```\nx")).toBe("PPC");
  });
});

describe("spans(from, to)", () => {
  it("returns the spans overlapping a range, unclipped", () => {
    const md = segment("aa %% b %% cc `d` ee");
    expect(md.spans(0, 1).map((s) => s.kind)).toEqual(["prose"]);
    expect(md.spans(2, 4).map((s) => s.kind)).toEqual(["prose", "comment"]);
    expect(md.spans(4, 5)[0]).toMatchObject({ kind: "comment", from: 3, to: 10 });
    expect(md.spans(10, 20).map((s) => s.kind)).toEqual(["prose", "code", "prose"]);
    expect(md.spans(5)).toHaveLength(4);
    expect(md.spans(3, 3)).toEqual([]);
  });
});

describe("masked", () => {
  it("blanks everything but prose, keeping line breaks and offsets", () => {
    expect(segment("---\na\n---\nx `y` %% z\r\nw %% v").masked()).toBe("   \n \n   \nx " + " ".repeat(8) + "\r\n" + " ".repeat(5) + "v");
  });
});

describe("segmentDoc", () => {
  it("caches by document object", () => {
    class Doc { constructor(private s: string) {} toString() { return this.s; } }
    const d1 = new Doc("a %% b %%");
    const md = segmentDoc(d1);
    expect(segmentDoc(d1)).toBe(md);
    segment("something else");
    expect(segmentDoc(d1)).toBe(md);
    const d2 = new Doc("a %% b %% c");
    const md2 = segmentDoc(d2);
    expect(md2).not.toBe(md);
    expect(md2.spans()).toEqual(segment("a %% b %% c").spans());
  });
});
