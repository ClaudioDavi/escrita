import { describe, expect, it } from "vitest";
import { pdfOf, pdfString, unsupportedIn, winAnsiByte, type PdfPage } from "../src/core/pdf";

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return s;
};

const page = (...texts: string[]): PdfPage => ({
  width: 612,
  height: 792,
  items: texts.map((text, i) => ({ x: 108, y: 82 + i * 12, text })),
});

describe("pdfOf structure", () => {
  const bytes = pdfOf([page("one"), page("two", "three")], { title: "Título", author: "Ana" });
  const s = latin1(bytes);

  it("has the header, the end marker and a binary comment", () => {
    expect(s.startsWith("%PDF-1.4\n%")).toBe(true);
    expect(s.endsWith("%%EOF\n")).toBe(true);
    expect(bytes[10]).toBeGreaterThan(127);
  });

  it("points every xref entry at its object", () => {
    const m = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(s)!;
    const count = Number(m[1]);
    const entries = m[2].split("\n").filter((l) => l !== "");
    expect(entries).toHaveLength(count);
    expect(entries[0]).toBe("0000000000 65535 f ");
    entries.slice(1).forEach((e, i) => {
      expect(e).toMatch(/^\d{10} 00000 n $/);
      const off = Number(e.slice(0, 10));
      expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("startxref points at the xref table, and the trailer names the root", () => {
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(s)![1]);
    expect(s.slice(start, start + 4)).toBe("xref");
    expect(s).toMatch(/trailer\n<< \/Size 12 \/Root 1 0 R \/Info 7 0 R >>/);
  });

  it("has one page object and one content stream per page, with the right lengths", () => {
    expect(s.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(s).toContain("/Count 2");
    for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) expect(m[2].length).toBe(Number(m[1]));
  });

  it("uses the four Courier faces with WinAnsi encoding and embeds nothing", () => {
    for (const f of ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"]) expect(s).toContain(`/BaseFont /${f} /Encoding /WinAnsiEncoding`);
    expect(s).not.toContain("FontFile");
  });

  it("flips y: the baseline is measured from the top", () => {
    expect(s).toContain("108 710 Td (one) Tj");
  });
});

describe("text encoding", () => {
  it("writes Portuguese as WinAnsi bytes (octal escapes)", () => {
    // ã E3, ç E7, é E9, õ F5, â E2, ê EA
    expect(pdfString("ãçéõâê")).toBe("(\\343\\347\\351\\365\\342\\352)");
  });

  it("writes the typographic characters as their cp1252 bytes", () => {
    expect(pdfString("—–“”‘’…€")).toBe("(\\227\\226\\223\\224\\221\\222\\205\\200)");
    expect(winAnsiByte("—".codePointAt(0)!)).toBe(0x97);
  });

  it("escapes parentheses and backslashes", () => {
    expect(pdfString("a(b)c\\d")).toBe("(a\\(b\\)c\\\\d)");
  });

  it("prints ? for what WinAnsi lacks, and lists it", () => {
    expect(pdfString("ok 😀 ő")).toBe("(ok ? ?)");
    expect(unsupportedIn("ok 😀 ő ã")).toEqual(["😀", "ő"]);
    expect(unsupportedIn("João — “sim”…")).toEqual([]);
  });

  it("puts the escaped bytes in the file", () => {
    const s = latin1(pdfOf([page("São João (v.o.)")]));
    expect(s).toContain("(S\\343o Jo\\343o \\(v.o.\\)) Tj");
  });
});

describe("underline", () => {
  it("draws a line as wide as the text", () => {
    const p: PdfPage = { width: 612, height: 792, items: [{ x: 100, y: 100, text: "abcde", underline: true }] };
    const s = latin1(pdfOf([p]));
    // 5 chars * 7.2 = 36 points
    expect(s).toMatch(/100 \d+(\.\d+)? m 136 \d+(\.\d+)? l S/);
  });
});

describe("no pages", () => {
  it("still writes a valid empty document", () => {
    const s = latin1(pdfOf([]));
    expect(s).toContain("/Count 0");
    expect(s.endsWith("%%EOF\n")).toBe(true);
  });
});
