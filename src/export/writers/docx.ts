// The DOCX manuscript writer (PLAN-0.8 Q1, Q10, 2.3): OOXML parts zipped with
// core/zip.ts, no dependency. Pure, no Obsidian imports. Layout comes from the
// preset (lengths in points; DOCX wants twentieths, so x 20; font size in half points).
//
// Layout: a title page (contact block and rounded count on top, title and byline
// below). For a book it is a page of its own and each front matter part and chapter
// starts a new page (`pageBreakBefore` on its first paragraph); for a single note
// the body starts under the byline on page 1 (README choice 5). The running header
// ("Surname / Title / page", live PAGE field) shows from page 2 on (`titlePg`).
import { aboutCount, fillTemplate, isBookDoc, type ExportDoc, type ManuscriptWriter, type Preset } from "../../core/export-pipeline";
import type { Block, Run } from "../../core/manuscript";
import { zipStore } from "../../core/zip";

const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const twips = (pt: number) => Math.round(pt * 20);

// A loop, not a regex: a regex with control characters trips no-control-regex.
function stripForbidden(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0xfffe || c === 0xffff) continue;
    out += ch;
  }
  return out;
}

/** XML text: the five entities, and characters XML 1.0 forbids dropped. */
export function xmlEscape(s: string): string {
  return stripForbidden(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runXml(r: Run): string {
  const props = (r.bold ? "<w:b/>" : "") + (r.italic ? "<w:i/>" : "");
  const parts = r.text.split("\n").map((t) => (t ? `<w:t xml:space="preserve">${xmlEscape(t)}</w:t>` : ""));
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${parts.join("<w:br/>")}</w:r>`;
}

interface ParaOpts {
  style: string;
  pageBreak?: boolean;
  /** extra pPr children, already XML (spacing, tabs) */
  extra?: string;
}

function para(runs: string, o: ParaOpts): string {
  // schema order inside pPr: pStyle, keepNext, pageBreakBefore, tabs, spacing, ...
  const ppr = `<w:pStyle w:val="${o.style}"/>${o.pageBreak ? "<w:pageBreakBefore/>" : ""}${o.extra ?? ""}`;
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
}

const plain = (text: string): string => runXml({ text });

function blockXml(b: Block, preset: Preset, minHeading: number, pageBreak = false): string {
  switch (b.kind) {
    case "paragraph": return para(b.runs.map(runXml).join(""), { style: "BodyText", pageBreak });
    case "quote": return para(b.runs.map(runXml).join(""), { style: "Quote", pageBreak });
    case "heading": return para(b.runs.map(runXml).join(""), { style: `Heading${Math.min(6, Math.max(b.level, minHeading))}`, pageBreak });
    case "sceneBreak": return para(preset.sceneBreak ? plain(preset.sceneBreak) : "", { style: "SceneBreak", pageBreak });
  }
}

/** The title page lines. `tab` is the right tab stop, the text width. */
function titlePageXml(doc: ExportDoc, preset: Preset, book: boolean): string {
  const textWidth = twips(preset.page.width - 2 * preset.page.margin);
  const contact = [doc.author.name.trim(), ...doc.author.contact.map((c) => c.trim())].filter((c) => c !== "");
  const n = doc.count.amount > 0
    ? fillTemplate(preset.countLabel[doc.count.unit], { n: new Intl.NumberFormat(preset.language).format(aboutCount(doc.count.amount)) })
    : "";
  const out: string[] = [];
  const tab = `<w:tabs><w:tab w:val="right" w:pos="${textWidth}"/></w:tabs>`;
  const lines = contact.length ? contact : n ? [""] : [];
  lines.forEach((line, i) => {
    // the count shares the first line, at the right margin
    const runs = plain(line) + (i === 0 && n ? `<w:r><w:tab/></w:r>${plain(n)}` : "");
    out.push(para(runs, { style: "Contact", extra: i === 0 && n ? tab : "" }));
  });
  const before = book ? 4320 : 2880;
  out.push(para(plain(doc.title), { style: "Title", extra: `<w:spacing w:before="${before}"/>` }));
  if (doc.author.name.trim() !== "") out.push(para(plain(fillTemplate(preset.byline, { name: doc.author.name.trim() })), { style: "Byline" }));
  return out.join("");
}

function documentXml(doc: ExportDoc, preset: Preset): string {
  const book = isBookDoc(doc);
  const minHeading = book ? 3 : 2;
  const body: string[] = [titlePageXml(doc, preset, book)];
  let wrote = false;
  for (const part of doc.parts) {
    const blocks = part.manuscript.blocks;
    if (part.role !== "body" && blocks.length === 0) continue;
    wrote = true;
    if (part.role !== "body") {
      // a front matter page: its first paragraph starts the page
      body.push(...blocks.map((b, i) => blockXml(b, preset, minHeading, i === 0)));
      continue;
    }
    if (part.heading !== null) body.push(para(plain(part.heading), { style: "Heading1", pageBreak: true }));
    body.push(...blocks.map((b) => blockXml(b, preset, minHeading)));
  }
  if (wrote && preset.endMark) body.push(para(plain(preset.endMark), { style: "EndMark" }));
  const { width, height, margin } = preset.page;
  const sect =
    `<w:sectPr><w:headerReference w:type="default" r:id="rId10"/><w:headerReference w:type="first" r:id="rId11"/>` +
    `<w:pgSz w:w="${twips(width)}" w:h="${twips(height)}"/>` +
    `<w:pgMar w:top="${twips(margin)}" w:right="${twips(margin)}" w:bottom="${twips(margin)}" w:left="${twips(margin)}" w:header="${twips(36)}" w:footer="${twips(36)}" w:gutter="0"/>` +
    `<w:titlePg/></w:sectPr>`;
  return `${XML}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}"><w:body>${body.join("")}${sect}</w:body></w:document>`;
}

function headerXml(doc: ExportDoc, preset: Preset): string {
  let inner = "";
  if (preset.header) {
    // "{page}" survives the fill and becomes the live field
    const filled = fillTemplate(preset.header, { surname: doc.author.surname.trim(), title: doc.title, page: "{page}" });
    // an empty surname leaves no empty segment: "Title / 3", not " / Title / 3"
    const text = filled.split(" / ").filter((s) => s.trim() !== "").join(" / ");
    const field = (instr: string) =>
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    inner = text.split("{page}").map((s) => (s ? plain(s) : "")).join(field("PAGE"));
  }
  return `${XML}<w:hdr xmlns:w="${NS_W}" xmlns:r="${NS_R}">${para(inner, { style: "Header" })}</w:hdr>`;
}

const emptyHeaderXml = () => `${XML}<w:hdr xmlns:w="${NS_W}" xmlns:r="${NS_R}">${para("", { style: "Header" })}</w:hdr>`;

function stylesXml(preset: Preset): string {
  const f = preset.font.family;
  const fonts = `<w:rFonts w:ascii="${xmlEscape(f)}" w:hAnsi="${xmlEscape(f)}" w:cs="${xmlEscape(f)}" w:eastAsia="${xmlEscape(f)}"/>`;
  const sz = Math.round(preset.font.size * 2);
  const line = Math.round(preset.lineSpacing * 240);
  const style = (id: string, name: string, ppr: string, rpr = "", more = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${more}<w:qFormat/>` +
    `${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}</w:style>`;
  const headings = [2, 3, 4, 5, 6]
    .map((n) => style(`Heading${n}`, `heading ${n}`, `<w:keepNext/><w:jc w:val="center"/><w:outlineLvl w:val="${n - 1}"/>`, "<w:b/>", '<w:next w:val="BodyText"/>'))
    .join("");
  return (
    `${XML}<w:styles xmlns:w="${NS_W}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="${preset.language}" w:eastAsia="${preset.language}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    style("BodyText", "Body Text", `<w:ind w:firstLine="${twips(preset.indent)}"/>`) +
    style("Quote", "Quote", `<w:ind w:left="${twips(36)}" w:right="${twips(36)}"/>`) +
    style("Heading1", "heading 1", `<w:keepNext/><w:spacing w:before="${twips(144)}" w:after="${twips(24)}" w:line="${line}" w:lineRule="auto"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, "<w:b/>", '<w:next w:val="BodyText"/>') +
    headings +
    style("Title", "Title", '<w:jc w:val="center"/>', "<w:b/>", '<w:next w:val="Byline"/>') +
    style("Byline", "Byline", `<w:spacing w:after="${twips(24)}" w:line="${line}" w:lineRule="auto"/><w:jc w:val="center"/>`) +
    style("Contact", "Contact", '<w:spacing w:line="240" w:lineRule="auto"/>') +
    style("SceneBreak", "Scene Break", '<w:jc w:val="center"/>') +
    style("EndMark", "End Mark", `<w:spacing w:before="${twips(24)}" w:line="${line}" w:lineRule="auto"/><w:jc w:val="center"/>`) +
    style("Header", "header", '<w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="right"/>') +
    `</w:styles>`
  );
}

const settingsXml = () =>
  `${XML}<w:settings xmlns:w="${NS_W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/>` +
  `<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

const contentTypesXml = () =>
  `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
  `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
  `<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `</Types>`;

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const relsXml = () =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `</Relationships>`;

const documentRelsXml = () =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/settings" Target="settings.xml"/>` +
  `<Relationship Id="rId10" Type="${REL}/header" Target="header1.xml"/>` +
  `<Relationship Id="rId11" Type="${REL}/header" Target="header2.xml"/>` +
  `</Relationships>`;

/** Title and author only; no dates, so the same model always gives the same bytes. */
const coreXml = (doc: ExportDoc) =>
  `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape(doc.title)}</dc:title>` +
  `<dc:creator>${xmlEscape(doc.author.name)}</dc:creator></cp:coreProperties>`;

function write(doc: ExportDoc, preset: Preset): Uint8Array {
  const enc = new TextEncoder();
  const file = (path: string, xml: string) => ({ path, data: enc.encode(xml) });
  return zipStore([
    file("[Content_Types].xml", contentTypesXml()),
    file("_rels/.rels", relsXml()),
    file("word/document.xml", documentXml(doc, preset)),
    file("word/_rels/document.xml.rels", documentRelsXml()),
    file("word/styles.xml", stylesXml(preset)),
    file("word/settings.xml", settingsXml()),
    file("word/header1.xml", headerXml(doc, preset)),
    file("word/header2.xml", emptyHeaderXml()),
    file("docProps/core.xml", coreXml(doc)),
  ]);
}

export const docxWriter: ManuscriptWriter<ExportDoc> = { id: "docx", ext: "docx", write };
