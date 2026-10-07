import { describe, it, expect } from "vitest";
import { dialogueInDoc, dialogueRanges, dimPlan, MAX_WIDEN, type DialogueOptions, type Range } from "../src/core/dialogue";
import { segment } from "../src/core/markdown";
import { dialogueNote } from "./support/dialogue-note";
import type { QuoteStyle } from "../src/settings";

const S = (text: string, rs: Range[]) => rs.map((r) => text.slice(r.from, r.to));
const R = (text: string, style: QuoteStyle = "curly") => S(text, dialogueRanges(text, style));
const BLANK: DialogueOptions = { quoteStyle: "curly", paragraphStyle: "blank" };
const SINGLE: DialogueOptions = { quoteStyle: "curly", paragraphStyle: "single" };
const D = (text: string, opts = BLANK) => {
  const md = segment(text);
  return S(text, dialogueInDoc(md, 0, md.lineCount - 1, opts));
};

function wellFormed(text: string, rs: Range[]): void {
  let prev = -1;
  for (const r of rs) {
    expect(r.to).toBeGreaterThan(r.from);
    expect(r.from).toBeGreaterThan(prev);
    expect(/[\r\n]/.test(text.slice(r.from, r.to))).toBe(false);
    prev = r.to;
  }
}

describe("dialogueRanges: dashes", () => {
  it("a line-leading dash opens speech to the end", () => {
    expect(R("— Vem cá.")).toEqual(["— Vem cá."]);
  });
  it("spaced dashes toggle between speech and narration", () => {
    expect(R("— Vem cá — disse ela.")).toEqual(["— Vem cá"]);
    expect(R("— Vem cá — disse ela. — Agora.")).toEqual(["— Vem cá", "— Agora."]);
  });
  it("accepts en dash and horizontal bar", () => {
    expect(R("– Oi – disse. – Tchau.")).toEqual(["– Oi", "– Tchau."]);
    expect(R("― Oi.")).toEqual(["― Oi."]);
  });
  it("accepts a blockquote prefix and leading spaces, not a list marker", () => {
    expect(R("> — Oi — disse ela.")).toEqual(["— Oi"]);
    expect(R("  — Oi")).toEqual(["— Oi"]);
    expect(R("- — Oi")).toEqual([]);
  });
  it("dashes inside ordinary sentences are not dialogue", () => {
    expect(R("Ele era — como dizer — estranho.")).toEqual([]);
  });
  it("unspaced, trailing and doubled-hyphen dashes don't toggle", () => {
    expect(R("— palavra—palavra fim")).toEqual(["— palavra—palavra fim"]);
    expect(R("— Eu não—")).toEqual(["— Eu não—"]);
    // a trailing spaced dash is the speaker being cut off: it stays speech
    expect(R("— Eu não —")).toEqual(["— Eu não —"]);
    expect(R("— Eu não —  ")).toEqual(["— Eu não —"]);
    expect(R("— Oi -- disse")).toEqual(["— Oi -- disse"]);
  });
  it("narration and speech carry across hard-wrapped lines", () => {
    expect(R("— Vem cá — disse ela,\nandando. — Agora.")).toEqual(["— Vem cá", "— Agora."]);
    expect(R("— Oi.\n— Tudo?")).toEqual(["— Oi.", "— Tudo?"]);
    expect(R("— Oi.\nEle saiu.")).toEqual(["— Oi.", "Ele saiu."]);
  });
  it("a spaced dash that ends a hard-wrapped line toggles like one inside the line", () => {
    expect(R("— Eu não sei —\ndisse ele. — Vem.")).toEqual(["— Eu não sei", "— Vem."]);
    expect(R("— Eu não sei —\ndisse ele. — Vem.")).toEqual(R("— Eu não sei — disse ele. — Vem."));
    expect(R("— Eu não sei —  \r\ndisse ele.")).toEqual(["— Eu não sei"]);
    // at the paragraph's end it is still the speaker being cut off
    expect(R("— Vem —\ndisse ele. — Eu não —")).toEqual(["— Vem", "— Eu não —"]);
  });
  it("a spaced dash inside quoted speech toggles nothing", () => {
    expect(R("— Ele disse “sim — talvez” e saiu — pensou.")).toEqual(["— Ele disse “sim — talvez” e saiu"]);
    expect(R('— Ele disse "sim — talvez" e saiu — pensou.')).toEqual(['— Ele disse "sim — talvez" e saiu']);
    // the quote stays open across a hard wrap
    expect(R("— Ele disse “sim —\ntalvez” e saiu — pensou.")).toEqual(["— Ele disse “sim —", "talvez” e saiu"]);
  });
});

describe("dialogueRanges: quotes", () => {
  it("curly quotes, nesting and apostrophes", () => {
    expect(R("Ele disse “vem cá” e saiu.")).toEqual(["“vem cá”"]);
    expect(R("“Ela disse ‘não’ ontem”")).toEqual(["“Ela disse ‘não’ ontem”"]);
    expect(R("“it’s fine” he said")).toEqual(["“it’s fine”"]);
  });
  it("straight quotes", () => {
    expect(R('a "b" c "d" e')).toEqual(['"b"', '"d"']);
  });
  it("an unclosed quote runs to the end of the paragraph, split per line", () => {
    expect(R("a “b c\nd e")).toEqual(["“b c", "d e"]);
  });
  it("a lone closer is nothing", () => {
    expect(R("a ” b")).toEqual([]);
  });
  it("guillemets ignore other quotes inside", () => {
    expect(R("x «a ‹b› “c” d» y", "guillemets")).toEqual(["«a ‹b› “c” d»"]);
  });
  it("german and curly never mix", () => {
    expect(R("x „a“ y", "german")).toEqual(["„a“"]);
    expect(R("x “a” y", "german")).toEqual([]);
    expect(R("x „a“ y", "curly")).toEqual(["“ y"]);
  });
  it("off recognises curly and straight quotes", () => {
    expect(R('“a” and "b"', "off")).toEqual(["“a”", '"b"']);
  });
  it("dash and quote ranges merge", () => {
    expect(R("— Ele disse “oi” — contou.")).toEqual(["— Ele disse “oi”"]);
  });
});

describe("dialogueRanges: line endings", () => {
  it("CRLF offsets exclude the \\r", () => {
    const text = "— Oi — disse.\r\n— Tchau.";
    const second = text.indexOf("— Tchau");
    expect(dialogueRanges(text, "curly")).toEqual([{ from: 0, to: 4 }, { from: second, to: second + 8 }]);
  });
  it("a trailing lone \\r is not speech", () => {
    const text = "— Oi.\r";
    expect(R(text)).toEqual(["— Oi."]);
  });
  it("every fixture gives sorted, disjoint, single-line, non-empty ranges", () => {
    const fixtures = [
      "— Vem cá — disse ela. — Agora.", "— Vem cá — disse ela,\r\nandando. — Agora.",
      "a “b c\r\nd e\r", "x «a ‹b› “c” d» y", "— Ele disse “oi” — contou.", "“a\n\n\nb”", "  \t", "",
      "— Oi.\r\n— Tudo?\r\n", "a\rb “c\rd”",
    ];
    for (const f of fixtures) for (const st of ["curly", "guillemets", "german", "off"] as const) wellFormed(f, dialogueRanges(f, st));
  });
});

describe("dialogueInDoc", () => {
  it("frontmatter is never speech", () => {
    expect(D("---\ntitle: “x”\n---\n— Oi.")).toEqual(["— Oi."]);
    expect(D("---\na: “x”\n— Oi")).toEqual([]);
  });
  it("code blocks are never speech; inline code stays inside speech", () => {
    expect(D("```\n— Oi\n```")).toEqual([]);
    expect(D("— Diz `x` agora.")).toEqual(["— Diz `x` agora."]);
  });
  it("comments are never speech", () => {
    expect(D("%%\n— Oi\n%%\n— Real.")).toEqual(["— Real."]);
    expect(D("%% n %% — Oi")).toEqual(["— Oi"]);
  });
  it("math blocks are never speech", () => {
    expect(D("$$\n“a”\n$$")).toEqual([]);
  });
  it("headings and scene breaks are never speech and end paragraphs", () => {
    expect(D("# “Título”")).toEqual([]);
    expect(D("a “b\n\n---\n\nc”")).toEqual(["“b"]);
    expect(D("a “b\n***\nc”")).toEqual(["“b"]);
    expect(D("a “b\n## x\nc”")).toEqual(["“b"]);
  });
  it("paragraph style: blank joins lines, single keeps them apart", () => {
    expect(D("x “a\ny” z")).toEqual(["“a", "y”"]);
    expect(D("x “a\ny” z", SINGLE)).toEqual(["“a"]);
    expect(D("— Oi.\nEle saiu.", SINGLE)).toEqual(["— Oi."]);
  });
  it("widens to the paragraph start to find an open quote", () => {
    const text = "x “a\nb\nc\nd e”\nf";
    const md = segment(text);
    expect(S(text, dialogueInDoc(md, 3, 3, BLANK))).toEqual(["“a", "b", "c", "d e”"]);
  });
  it("widening stops at MAX_WIDEN", () => {
    const lines = ["x “a", ...Array.from({ length: MAX_WIDEN + 5 }, (_, i) => `l${i}`)];
    const text = lines.join("\n");
    const md = segment(text);
    const last = lines.length - 1;
    // the opener is more than MAX_WIDEN lines above: cut off (documented limitation)
    expect(dialogueInDoc(md, last, last, BLANK)).toEqual([]);
    expect(dialogueInDoc(md, MAX_WIDEN, MAX_WIDEN, BLANK).length).toBeGreaterThan(0);
  });
  it("clamps its line range", () => {
    const md = segment("— Oi");
    expect(dialogueInDoc(md, -5, 99, BLANK)).toEqual([{ from: 0, to: 4 }]);
    expect(dialogueInDoc(segment(""), 0, 0, BLANK)).toEqual([]);
  });
});

describe("dimPlan", () => {
  it("dims whole lines without speech and the gaps on mixed lines", () => {
    const text = "Narração.\n\n— Vem cá — disse ela.\n\nEle disse “oi” e saiu.";
    const md = segment(text);
    const plan = dimPlan(md, 0, md.lineCount - 1, BLANK);
    expect(plan.lines).toEqual([0, 1, 3]);
    expect(S(text, plan.marks)).toEqual([" — disse ela.", "Ele disse ", " e saiu."]);
  });
  it("a line that is all speech has no marks and isn't dimmed", () => {
    const md = segment("— Oi.");
    expect(dimPlan(md, 0, 0, BLANK)).toEqual({ lines: [], marks: [] });
  });
});

describe("performance: viewport-limited", () => {
  const text = dialogueNote();
  const md = segment(text);

  it("the fixture is a 10k-word note", () => {
    expect(text.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(10000);
  });

  it("only looks at the neighbourhood of the requested lines", () => {
    const rs = dialogueInDoc(md, 2000, 2040, BLANK);
    expect(rs.length).toBeGreaterThan(0);
    const lo = md.lineStart(2000 - MAX_WIDEN);
    const hi = md.lineEnd(2040 + MAX_WIDEN);
    for (const r of rs) {
      expect(r.from).toBeGreaterThanOrEqual(lo);
      expect(r.to).toBeLessThanOrEqual(hi);
    }
  });
});
