// A small PDF 1.4 writer (no Obsidian imports, no Node APIs). It draws text lines with the
// four base-14 Courier faces (never embedded, WinAnsi encoded) and underlines as plain lines.
// It knows nothing about screenplays: core/screenplay-pdf.ts feeds it pages, and a prose PDF
// could later do the same. Every byte of the file is ASCII except the binary comment in the
// header, so an offset is a string index while the file is built.

export type PdfFace = "regular" | "bold" | "italic" | "boldItalic";

/** A piece of text on a page. `x` and `y` are in points from the page's top left; `y` is the baseline. */
export interface PdfText {
  x: number;
  y: number;
  text: string;
  face?: PdfFace;
  /** points; Courier is 0.6 of it wide per character */
  size?: number;
  underline?: boolean;
}

export interface PdfPage {
  width: number;
  height: number;
  items: PdfText[];
}

export interface PdfMeta {
  title?: string;
  author?: string;
  producer?: string;
}

const FACE_NAMES: Record<PdfFace, string> = {
  regular: "Courier",
  bold: "Courier-Bold",
  italic: "Courier-Oblique",
  boldItalic: "Courier-BoldOblique",
};
const FACE_ORDER: PdfFace[] = ["regular", "bold", "italic", "boldItalic"];

/** Courier's advance as a fraction of the size. */
export const COURIER_ADVANCE = 0.6;

// The cp1252 bytes 0x80-0x9F that WinAnsiEncoding defines (0x81, 0x8D, 0x8F, 0x90, 0x9D are undefined).
const WIN_1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** The WinAnsi byte of a code point, or null when Courier's encoding has no such character. */
export function winAnsiByte(cp: number): number | null {
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  return WIN_1252_HIGH[cp] ?? null;
}

/** The characters of `text` that print as "?" (each once per place). */
export function unsupportedIn(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) if (winAnsiByte(ch.codePointAt(0) as number) === null) out.push(ch);
  return out;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** A PDF string literal for `text`: WinAnsi bytes, "?" for the rest, ( ) \ escaped, high bytes as octal. */
export function pdfString(text: string): string {
  let out = "(";
  for (const ch of text) {
    const b = winAnsiByte(ch.codePointAt(0) as number) ?? 0x3f;
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += "\\" + String.fromCharCode(b);
    else if (b < 0x80) out += String.fromCharCode(b);
    else out += "\\" + b.toString(8);
  }
  return out + ")";
}

/** A PDF text string (Info entries) as UTF-16BE hex, so any character survives. */
function pdfTextString(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return "<" + hex + ">";
}

function contentOf(page: PdfPage): string {
  const ops: string[] = [];
  for (const it of page.items) {
    if (it.text === "") continue;
    const size = it.size ?? 12;
    const font = FACE_ORDER.indexOf(it.face ?? "regular") + 1;
    const y = page.height - it.y;
    ops.push(`BT /F${font} ${num(size)} Tf ${num(it.x)} ${num(y)} Td ${pdfString(it.text)} Tj ET`);
    if (it.underline) {
      const w = [...it.text].length * size * COURIER_ADVANCE;
      const uy = y - size * 0.12;
      ops.push(`q 0.6 w ${num(it.x)} ${num(uy)} m ${num(it.x + w)} ${num(uy)} l S Q`);
    }
  }
  return ops.join("\n");
}

/** The PDF file for `pages`. */
export function pdfOf(pages: PdfPage[], meta: PdfMeta = {}): Uint8Array {
  // object numbers: 1 catalog, 2 pages, 3-6 fonts, 7 info, then a page and its content per page
  const objects: string[] = [];
  const kids: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  FACE_ORDER.forEach((f, i) => {
    objects[3 + i] = `<< /Type /Font /Subtype /Type1 /BaseFont /${FACE_NAMES[f]} /Encoding /WinAnsiEncoding >>`;
  });
  const info: string[] = [`/Producer ${pdfTextString(meta.producer ?? "Escrita")}`];
  if (meta.title) info.push(`/Title ${pdfTextString(meta.title)}`);
  if (meta.author) info.push(`/Author ${pdfTextString(meta.author)}`);
  objects[7] = `<< ${info.join(" ")} >>`;
  const fonts = FACE_ORDER.map((_, i) => `/F${i + 1} ${3 + i} 0 R`).join(" ");
  pages.forEach((p, i) => {
    const pageNo = 8 + i * 2;
    const content = contentOf(p);
    kids.push(`${pageNo} 0 R`);
    objects[pageNo] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.width)} ${num(p.height)}] ` +
      `/Resources << /Font << ${fonts} >> >> /Contents ${pageNo + 1} 0 R >>`;
    objects[pageNo + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++) out += `${pad(offsets[n], 10)} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
