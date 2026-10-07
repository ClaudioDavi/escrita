import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { exportDocOf } from "../src/core/export-pipeline";
import { PTBR, SHUNN } from "../src/core/presets";
import { epubIdentifier, epubLayout, epubModified, epubWriter, type EpubBook, type EpubCover } from "../src/export/writers/epub";
import { bookSource, contoSource } from "./support/export-fixture";
import { readZip } from "./support/zip-reader";

const FX = new URL("./fixtures/epub/", import.meta.url);
const fx = (p: string) => readFileSync(new URL(p, FX), "utf8");
const O = { placeholderMarker: "XXX" };
const MODIFIED = "2026-10-06T14:32:00Z";
const COVER: EpubCover = { data: new Uint8Array(readFileSync(new URL("cover.png", FX))), mediaType: "image/png" };

function bookOf(preset = PTBR, cover: EpubCover | null = COVER): EpubBook {
  return {
    doc: exportDocOf(bookSource(preset), O),
    identifier: epubIdentifier("book/A Casa.md", "A Casa"),
    modified: MODIFIED,
    cover,
  };
}

function open(b: EpubBook, preset = PTBR) {
  const bytes = epubWriter.write(b, epubLayout(preset, "* * *")) as Uint8Array;
  const entries = readZip(bytes);
  return { bytes, entries, parts: Object.fromEntries(entries.map((e) => [e.path, e.text()])) };
}

const norm = (s: string) => s.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

describe("epub writer: package", () => {
  it("lists the entries in the expected order, mimetype first and stored", () => {
    const { bytes, entries } = open(bookOf());
    const expected = fx("expected-files.txt").split("\n").map((l) => l.trim()).filter(Boolean);
    expect(entries.map((e) => e.path).sort()).toEqual([...expected].sort());
    expect(entries[0].path).toBe("mimetype");
    expect(entries[0].text()).toBe("application/epub+zip");
    // local header: method 0 (stored), no extra field
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    expect(v.getUint16(8, true)).toBe(0);
    expect(v.getUint16(28, true)).toBe(0);
  });

  it("writes the expected content.opf for the ptbr preset", () => {
    const { parts } = open(bookOf());
    const uuid = epubIdentifier("book/A Casa.md", "A Casa").replace("urn:uuid:", "");
    const want = fx("expected-content.ptbr.opf").replace("@UUID@", uuid).replace("@MODIFIED@", MODIFIED);
    expect(norm(parts["OEBPS/content.opf"])).toBe(norm(want));
  });

  it("is the same bytes for the same book", () => {
    const a = open(bookOf()).bytes;
    const b = open(bookOf()).bytes;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("shunn differs in language and labels only", () => {
    const { parts, entries } = open(bookOf(SHUNN), SHUNN);
    expect(parts["OEBPS/content.opf"]).toContain("<dc:language>en-US</dc:language>");
    expect(parts["OEBPS/nav.xhtml"]).toContain("<h1>Contents</h1>");
    expect(entries.map((e) => e.path)).toContain("OEBPS/chapter-3.xhtml");
  });

  it("without a cover leaves out the cover page, image, item, meta and spine entry", () => {
    const { parts, entries } = open(bookOf(PTBR, null));
    const paths = entries.map((e) => e.path);
    expect(paths).not.toContain("OEBPS/cover.xhtml");
    expect(paths).not.toContain("OEBPS/images/cover.png");
    const opf = parts["OEBPS/content.opf"];
    expect(opf).not.toContain("cover");
    expect(parts["OEBPS/nav.xhtml"]).not.toContain("cover.xhtml");
  });
});

describe("epub writer: content", () => {
  it("names chapters by position, with headings, the ornamental break and no running header", () => {
    const { parts } = open(bookOf());
    expect(parts["OEBPS/chapter-1.xhtml"]).toContain("<h1>Prólogo</h1>");
    expect(parts["OEBPS/chapter-2.xhtml"]).toMatch(/<h1>Capítulo 1 — A chegada<\/h1>/);
    const all = Object.values(parts).join("\n");
    expect(all).toContain('<p class="scene-break">* * *</p>');
    expect(all).not.toContain("<p class=\"scene-break\">#</p>");
  });

  it("the nav lists the chapters and the landmarks point at the cover, contents and start", () => {
    const { parts } = open(bookOf());
    const nav = parts["OEBPS/nav.xhtml"];
    expect(nav).toContain("<h1>Sumário</h1>");
    expect(nav).toContain('<a href="chapter-3.xhtml">');
    expect(nav).toContain('epub:type="cover" href="cover.xhtml"');
    expect(nav).toContain('epub:type="bodymatter" href="chapter-1.xhtml"');
    expect(parts["OEBPS/toc.ncx"]).toContain('<content src="chapter-3.xhtml"/>');
  });

  it("escapes text and renders italics, bold, quotes and line breaks", () => {
    const doc = exportDocOf(contoSource(), O);
    doc.title = "Tom & <Jerry>";
    doc.parts[0].manuscript.blocks = [
      { kind: "paragraph", runs: [{ text: "a & b ", italic: true }, { text: "c\nd", bold: true }] },
      { kind: "quote", runs: [{ text: "um" }] },
      { kind: "quote", runs: [{ text: "dois" }] },
      { kind: "heading", level: 1, runs: [{ text: "H" }] },
    ];
    const { parts } = open({ doc, identifier: "urn:uuid:x", modified: MODIFIED, cover: null });
    const c = parts["OEBPS/chapter-1.xhtml"];
    expect(c).toContain("<em>a &amp; b </em><strong>c<br/>d</strong>");
    expect(c).toContain("<blockquote><p>um</p><p>dois</p></blockquote>");
    expect(c).toContain("<h2>H</h2>");
    expect(parts["OEBPS/content.opf"]).toContain("<dc:title>Tom &amp; &lt;Jerry&gt;</dc:title>");
  });
});

describe("epub identifier", () => {
  it("is stable for a path and title, and changes with either", () => {
    const a = epubIdentifier("a/b.md", "T");
    expect(a).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(epubIdentifier("a/b.md", "T")).toBe(a);
    expect(epubIdentifier("a/c.md", "T")).not.toBe(a);
    expect(epubIdentifier("a/b.md", "U")).not.toBe(a);
  });
  it("formats the modified time", () => {
    expect(epubModified(new Date("2026-10-06T14:32:00.123Z"))).toBe("2026-10-06T14:32:00Z");
  });
});

// Gate G0a / Q9: CI sets ESCRITA_EPUB_OUT and runs EPUBCheck on the file.
describe.skipIf(!process.env.ESCRITA_EPUB_OUT)("epub fixture build for EPUBCheck", () => {
  it("writes the fixture book's EPUB", () => {
    const out = process.env.ESCRITA_EPUB_OUT as string;
    mkdirSync(dirname(out), { recursive: true });
    const bytes = epubWriter.write(bookOf(), epubLayout(PTBR, "* * *")) as Uint8Array;
    writeFileSync(out, bytes);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
