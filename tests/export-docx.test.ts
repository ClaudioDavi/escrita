import { describe, expect, it } from "vitest";
import { exportDocOf, type ExportDoc } from "../src/core/export-pipeline";
import { PTBR, SHUNN } from "../src/core/presets";
import { docxWriter } from "../src/export/writers/docx";
import { bookSource, contoSource } from "./support/export-fixture";
import { readZip } from "./support/zip-reader";

const O = { placeholderMarker: "XXX" };

/** A strict-enough XML check: one root, balanced tags, quoted attributes, known entities. */
function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, "");
  const stack: string[] = [];
  let root = 0;
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/g;
  let pos = 0;
  for (let m: RegExpExecArray | null; (m = re.exec(body)); ) {
    if (m.index !== pos) throw new Error(`bad markup at ${pos}: ${body.slice(pos, pos + 40)}`);
    pos = re.lastIndex;
    if (m[5] !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(m[5])) throw new Error("bad entity");
      if (!stack.length && m[5].trim()) throw new Error("text outside the root");
      continue;
    }
    if (m[1]) {
      if (stack.pop() !== m[2]) throw new Error(`mismatched </${m[2]}>`);
    } else if (!m[4]) {
      if (!stack.length) root++;
      stack.push(m[2]);
    } else if (!stack.length) root++;
  }
  if (pos !== body.length) throw new Error("trailing garbage");
  if (stack.length || root !== 1) throw new Error("unbalanced or no single root");
}

function open(doc: ExportDoc, preset = SHUNN) {
  const bytes = docxWriter.write(doc, preset) as Uint8Array;
  const parts = Object.fromEntries(readZip(bytes).map((e) => [e.path, e.text()]));
  return { bytes, parts, doc: parts["word/document.xml"] };
}

const count = (s: string, sub: string) => s.split(sub).length - 1;
const paras = (xml: string) => xml.match(/<w:p>.*?<\/w:p>/g) ?? [];
const textOf = (p: string | undefined) => ((p ?? "").match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("");
const conto = () => exportDocOf(contoSource(), O);
const book = (preset = SHUNN) => exportDocOf(bookSource(preset), O);

describe("docx writer: package", () => {
  it("is a zip of well-formed parts, content types first", () => {
    const { bytes } = open(conto());
    const entries = readZip(bytes);
    expect(entries[0].path).toBe("[Content_Types].xml");
    expect(entries.map((e) => e.path)).toEqual(
      expect.arrayContaining(["_rels/.rels", "word/document.xml", "word/styles.xml", "word/settings.xml", "word/header1.xml", "word/header2.xml", "word/_rels/document.xml.rels", "docProps/core.xml"]),
    );
    for (const e of entries) assertWellFormed(e.text());
  });

  it("every override and relationship points at a part that exists", () => {
    const { parts } = open(book());
    for (const m of parts["[Content_Types].xml"].matchAll(/PartName="\/([^"]+)"/g)) expect(parts[m[1]]).toBeDefined();
    for (const m of parts["word/_rels/document.xml.rels"].matchAll(/Target="([^"]+)"/g)) expect(parts["word/" + m[1]]).toBeDefined();
    for (const m of parts["_rels/.rels"].matchAll(/Target="([^"]+)"/g)) expect(parts[m[1]]).toBeDefined();
  });

  it("same model and preset give the same bytes", () => {
    expect(Array.from(open(book()).bytes)).toEqual(Array.from(open(book()).bytes));
  });

  it("reports id and extension", () => {
    expect([docxWriter.id, docxWriter.ext]).toEqual(["docx", "docx"]);
  });
});

describe("docx writer: page and styles", () => {
  it("Shunn is Letter, one inch margins, Times New Roman 12, double spaced, half-inch indent", () => {
    const { doc, parts } = open(conto());
    expect(doc).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
    expect(doc).toContain('w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"');
    expect(parts["word/styles.xml"]).toContain('w:ascii="Times New Roman"');
    expect(parts["word/styles.xml"]).toContain('<w:sz w:val="24"/>');
    expect(parts["word/styles.xml"]).toContain('w:line="480" w:lineRule="auto"');
    expect(parts["word/styles.xml"]).toMatch(/styleId="BodyText".*?<w:ind w:firstLine="720"\/>/);
    expect(parts["word/styles.xml"]).toContain('w:lang w:val="en-US"');
  });

  it("pt-BR is A4 with a pt-BR language", () => {
    const { doc, parts } = open(book(PTBR), PTBR);
    expect(doc).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(parts["word/styles.xml"]).toContain('w:lang w:val="pt-BR"');
  });
});

describe("docx writer: header", () => {
  it("shows Surname / Title / PAGE from page 2 and nothing on page 1", () => {
    const { doc, parts } = open(conto());
    expect(doc).toContain("<w:titlePg/>");
    expect(doc).toContain('<w:headerReference w:type="default" r:id="rId10"/>');
    expect(doc).toContain('<w:headerReference w:type="first" r:id="rId11"/>');
    const h = parts["word/header1.xml"];
    expect(textOf(h)).toBe("Souza / A visita / 2");
    expect(h).toContain("PAGE");
    expect(h).toContain('w:fldCharType="begin"');
    expect(textOf(parts["word/header2.xml"])).toBe("");
  });

  it("an empty surname leaves no empty segment", () => {
    const d = conto();
    d.author = { name: "", surname: "", contact: [] };
    expect(textOf(open(d).parts["word/header1.xml"])).toBe("A visita / 2");
  });

  it("a preset with no header has an empty one", () => {
    expect(textOf(open(conto(), { ...SHUNN, header: null }).parts["word/header1.xml"])).toBe("");
  });
});

describe("docx writer: title page", () => {
  it("a single note: contact, rounded count, title and byline, then the body on page 1", () => {
    const d = conto();
    d.author = { name: "Ana Souza", surname: "Souza", contact: ["Rua A, 1", "ana@example.com"] };
    const p = paras(open(d).doc);
    expect(textOf(p[0])).toBe("Ana Souzaabout 600 words");
    expect(p[0]).toContain("<w:tab/>");
    expect(p[0]).toContain('<w:tab w:val="right" w:pos="9360"/>');
    expect(textOf(p[1])).toBe("Rua A, 1");
    expect(textOf(p[2])).toBe("ana@example.com");
    expect(p[3]).toContain('w:val="Title"');
    expect(textOf(p[3])).toBe("A visita");
    expect(textOf(p[4])).toBe("by Ana Souza");
    expect(p[5]).toContain('w:val="BodyText"');
    expect(open(d).doc).not.toContain("<w:pageBreakBefore/>");
  });

  it("pt-BR labels and number format", () => {
    const d = book(PTBR);
    d.count = { amount: 12480, unit: "words" };
    const first = paras(open(d, PTBR).doc)[0];
    expect(textOf(first)).toContain("cerca de 12.500 palavras");
    const d2 = book(PTBR);
    d2.count = { amount: 9000, unit: "characters" };
    expect(textOf(paras(open(d2, PTBR).doc)[0])).toContain("cerca de 9.000 caracteres");
  });

  it("no count line for an empty work, and the count shares line 1 even with no contact", () => {
    const d = conto();
    d.count = { amount: 0, unit: "words" };
    d.author = { name: "", surname: "", contact: [] };
    expect(textOf(paras(open(d).doc)[0])).toBe("A visita");
    d.count = { amount: 5000, unit: "words" };
    expect(textOf(paras(open(d).doc)[0])).toBe("about 5,000 words");
  });

  it("a book's title page is its own page: the next part starts a new page", () => {
    const p = paras(open(book()).doc);
    const dedication = p.findIndex((x) => textOf(x).startsWith("Para minha avó"));
    expect(p[dedication]).toContain("<w:pageBreakBefore/>");
    expect(textOf(p[dedication - 1])).toBe("by Ana Souza");
  });
});

describe("docx writer: body", () => {
  it("one page break before each chapter and each front matter part", () => {
    const { doc } = open(book());
    // dedication, epigraph, Prólogo, Chapter 1, Chapter 2
    expect(count(doc, "<w:pageBreakBefore/>")).toBe(5);
    const heads = paras(doc).filter((p) => p.includes('w:val="Heading1"'));
    expect(heads.map(textOf)).toEqual(["Prólogo", "Chapter 1: A chegada", "Chapter 2: A casa"]);
    for (const h of heads) expect(h).toContain("<w:pageBreakBefore/>");
  });

  it("pt-BR chapter headings come through", () => {
    const heads = paras(open(book(PTBR), PTBR).doc).filter((p) => p.includes('w:val="Heading1"'));
    expect(heads.map(textOf)).toEqual(["Prólogo", "Capítulo 1 — A chegada", "Capítulo 2 — A casa"]);
  });

  it("scene breaks use the preset text, centered, never at a chapter edge", () => {
    const { doc, parts } = open(book());
    const breaks = paras(doc).filter((p) => p.includes('w:val="SceneBreak"'));
    expect(breaks.map(textOf)).toEqual(["#"]);
    expect(parts["word/styles.xml"]).toMatch(/styleId="SceneBreak".*?<w:jc w:val="center"\/>/);
    const blank = open(conto(), { ...SHUNN, sceneBreak: "" }).doc;
    expect(paras(blank).filter((p) => p.includes('w:val="SceneBreak"'))).toHaveLength(2);
    expect(paras(blank).filter((p) => p.includes('w:val="SceneBreak"')).every((p) => !p.includes("<w:r>"))).toBe(true);
    expect(textOf(paras(open(conto(), { ...SHUNN, sceneBreak: "* * *" }).doc).find((p) => p.includes("SceneBreak"))!)).toBe("* * *");
  });

  it("keeps italics and bold as run properties", () => {
    const { doc } = open(conto());
    expect(doc).toContain("<w:r><w:rPr><w:i/></w:rPr><w:t xml:space=\"preserve\">prender a respiração</w:t></w:r>");
    expect(doc).toContain("<w:rPr><w:b/></w:rPr><w:t xml:space=\"preserve\">inconfundível</w:t>");
    const both: ExportDoc = conto();
    both.parts[0].manuscript.blocks = [{ kind: "paragraph", runs: [{ text: "x", bold: true, italic: true }] }];
    expect(open(both).doc).toContain("<w:rPr><w:b/><w:i/></w:rPr>");
  });

  it("quotes get the Quote style; body headings sit under the title (single) or the chapter (book)", () => {
    const single = paras(open(conto()).doc);
    expect(single.some((p) => p.includes('w:val="Quote"') && textOf(p).startsWith("A memória"))).toBe(true);
    expect(single.find((p) => textOf(p) === "Interlúdio")).toContain('w:val="Heading2"');
    const b = paras(open(book()).doc);
    expect(b.find((p) => textOf(p) === "Parte")).toContain('w:val="Heading3"');
  });

  it("a line break inside a paragraph is a w:br; text is escaped; the prose has no markers", () => {
    const d = conto();
    d.title = "Tom & <Jerry>";
    d.parts[0].manuscript.blocks = [{ kind: "paragraph", runs: [{ text: "um\ndois & três < 4\u0001" }] }];
    const { doc, parts } = open(d);
    assertWellFormed(doc);
    expect(doc).toContain('<w:t xml:space="preserve">um</w:t><w:br/><w:t xml:space="preserve">dois &amp; três &lt; 4</w:t>');
    expect(parts["docProps/core.xml"]).toContain("Tom &amp; &lt;Jerry&gt;");
    const real = open(conto()).doc;
    for (const m of ["%%", "<!--", "[[", "XXX", "beat:", "foto.png"]) expect(real).not.toContain(m);
  });

  it("ends with the end mark, centered, once", () => {
    const p = paras(open(conto()).doc);
    expect(textOf(p[p.length - 1])).toBe("END");
    expect(p[p.length - 1]).toContain('w:val="EndMark"');
    const pt = paras(open(book(PTBR), PTBR).doc);
    expect(textOf(pt[pt.length - 1])).toBe("FIM");
    const none = paras(open(conto(), { ...SHUNN, endMark: null }).doc);
    expect(none.some((x) => x.includes("EndMark"))).toBe(false);
  });

  it("an empty part still gets its heading; empty front matter is skipped; an empty note is valid", () => {
    const d = book();
    d.parts[0].manuscript.blocks = [];
    const { doc } = open(d);
    expect(paras(doc).some((p) => textOf(p).startsWith("Para minha avó"))).toBe(false);
    expect(count(doc, "<w:pageBreakBefore/>")).toBe(4);
    const empty: ExportDoc = { ...conto(), parts: [] };
    const out = open(empty);
    assertWellFormed(out.doc);
    const last = paras(out.doc); expect(textOf(last[last.length - 1])).toBe("by Ana Souza");
  });
});
