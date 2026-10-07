// The EPUB 3 writer (0.9, N 7 stage 3; PLAN-0.9 Q5-Q9, Q19). Pure, no Obsidian imports.
// A `ManuscriptWriter` beside the Markdown and DOCX writers, zipped with core/zip.ts:
// the `mimetype` entry first and stored (every entry of core/zip is stored), then
// META-INF/container.xml, the package document, the nav document, an NCX for older
// readers, and the XHTML files.
//
// What goes in the book (Q6): a title page, the dedication and epigraph pages (as in
// 0.8), a table of contents, one XHTML file per chapter with its heading as in DOCX,
// and the ornamental scene break (`EpubLayout.sceneBreak`, never at a chapter boundary:
// the manuscript model already drops a break at a part's edge). No running header, no
// word count, no end mark: an ebook isn't a manuscript. With a cover, the image and a
// first cover page.
//
// Metadata (Q7): title, author, language, `dcterms:modified`, and a `urn:uuid`
// identifier derived from the work's path and title (epubIdentifier), so re-exporting
// the same book keeps its id. Every input is in `EpubBook`, so `write` stays pure: the
// same book and layout give the same bytes. EPUBCheck validates the fixture book in CI
// (task 1.4, gate G0a).

import { fillTemplate, type ExportDoc, type ManuscriptWriter, type Preset } from "../../core/export-pipeline";
import type { Block, Run } from "../../core/manuscript";
import { zipStore } from "../../core/zip";
import { xmlEscape } from "./docx";

/** The cover image (Q8), read as binary through the book source by the export module. */
export interface EpubCover {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
}

/** Everything one EPUB is made of: the prose model plus what only an ebook needs. */
export interface EpubBook {
  doc: ExportDoc;
  /** `urn:uuid:…` from epubIdentifier(work path, title) */
  identifier: string;
  /** `dcterms:modified`: UTC, whole seconds, "2026-10-06T14:32:00Z" (epubModified) */
  modified: string;
  /** null: no cover image and no cover page (a missing or unreadable image is a readiness warning, Q8) */
  cover: EpubCover | null;
}

/**
 * What the EPUB writer reads about layout: the ebook's share of a preset, plus the
 * scene break setting. Built by epubLayout; the writer reads nothing else.
 */
export interface EpubLayout {
  /** BCP 47, the preset's language: "en-US", "pt-BR" (`dc:language`, `xml:lang`) */
  language: string;
  /** the byline under the title on the title page, with `{name}` (the preset's) */
  byline: string;
  /** the table of contents' title: "Contents", "Sumário" (the preset's) */
  contentsLabel: string;
  /** the cover page's title and landmark: "Cover", "Capa" (the preset's) */
  coverLabel: string;
  /** the first chapter's landmark: "Start of content", "Início" (the preset's) */
  startLabel: string;
  /** the scene break line: the `epubSceneBreak` setting ("* * *") */
  sceneBreak: string;
}

/**
 * The layout for a preset (Q5): its language, byline and ebook labels (contents, cover,
 * start), and the scene break from the `epubSceneBreak` setting. The preset's own
 * `sceneBreak` ("#") is a manuscript's, not a book's, so the setting wins.
 */
export function epubLayout(preset: Preset, sceneBreak: string): EpubLayout {
  return {
    language: preset.language,
    byline: preset.byline,
    contentsLabel: preset.contentsLabel,
    coverLabel: preset.coverLabel,
    startLabel: preset.startLabel,
    sceneBreak,
  };
}

/**
 * The book's identifier (Q7): `urn:uuid:` and a version-5-shaped UUID derived from the
 * work's vault path and title, so the same book exported again keeps its id, and a
 * renamed book gets a new one. Deterministic and pure (no crypto API needed): four
 * FNV-1a lanes with different seeds give the 128 bits.
 */
export function epubIdentifier(path: string, title: string): string {
  const bytes = new TextEncoder().encode(`${path}\n${title}`);
  const seeds = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b9];
  const hex: string[] = [];
  for (const seed of seeds) {
    let h = seed >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // a final avalanche, so short inputs differ in every lane
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0;
    h ^= h >>> 15;
    hex.push((h >>> 0).toString(16).padStart(8, "0"));
  }
  const all = hex.join("");
  const variant = ((parseInt(all[16], 16) & 0x3) | 0x8).toString(16);
  const uuid = `${all.slice(0, 8)}-${all.slice(8, 12)}-5${all.slice(13, 16)}-${variant}${all.slice(17, 20)}-${all.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
}

/** `dcterms:modified` for a moment: UTC, whole seconds ("2026-10-06T14:32:00Z"). */
export function epubModified(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ------------------------------------------------------------------ XHTML

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS_XHTML = "http://www.w3.org/1999/xhtml";
const NS_EPUB = "http://www.idpf.org/2007/ops";

const esc = xmlEscape;

function runHtml(r: Run): string {
  let out = r.text.split("\n").map(esc).join("<br/>");
  if (r.italic) out = `<em>${out}</em>`;
  if (r.bold) out = `<strong>${out}</strong>`;
  return out;
}

const runsHtml = (runs: Run[]): string => runs.map(runHtml).join("");

/** Blocks as XHTML; consecutive quote blocks make one blockquote. A chapter heading is h1, so body headings start at h2. */
function blocksHtml(blocks: Block[], sceneBreak: string): string {
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    switch (b.kind) {
      case "paragraph": out.push(`<p>${runsHtml(b.runs)}</p>`); break;
      case "heading": {
        const n = Math.min(6, Math.max(b.level, 2));
        out.push(`<h${n}>${runsHtml(b.runs)}</h${n}>`);
        break;
      }
      case "quote": {
        const ps = [`<p>${runsHtml(b.runs)}</p>`];
        while (blocks[i + 1]?.kind === "quote") {
          i++;
          ps.push(`<p>${runsHtml((blocks[i] as Extract<Block, { kind: "quote" }>).runs)}</p>`);
        }
        out.push(`<blockquote>${ps.join("")}</blockquote>`);
        break;
      }
      case "sceneBreak": out.push(`<p class="scene-break">${esc(sceneBreak)}</p>`); break;
    }
  }
  return out.join("\n");
}

function page(lang: string, title: string, body: string, type?: string): string {
  return (
    `${XML}<!DOCTYPE html>\n<html xmlns="${NS_XHTML}" xmlns:epub="${NS_EPUB}" lang="${esc(lang)}" xml:lang="${esc(lang)}">\n` +
    `<head>\n<meta charset="utf-8"/>\n<title>${esc(title)}</title>\n<link rel="stylesheet" type="text/css" href="style.css"/>\n</head>\n` +
    `<body${type ? ` epub:type="${type}"` : ""}>\n${body}\n</body>\n</html>\n`
  );
}

const STYLE = `body { line-height: 1.4; }
h1, h2, h3, h4, h5, h6 { text-align: center; page-break-after: avoid; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, p.scene-break + p, p.first { text-indent: 0; }
p.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
blockquote { margin: 1em 2em; }
blockquote p { text-indent: 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page .byline { text-indent: 0; margin-top: 1em; }
.front { margin-top: 20%; text-align: center; }
.front p { text-indent: 0; }
.cover { text-align: center; margin: 0; }
.cover img { max-width: 100%; max-height: 100%; }
`;

// ------------------------------------------------------------------ package


function write(book: EpubBook, layout: EpubLayout): Uint8Array {
  const { doc, cover } = book;
  const lang = layout.language;
  const enc = new TextEncoder();
  const author = doc.author.name.trim();

  const pages: { id: string; href: string; xhtml: string }[] = [];
  const spine: string[] = [];
  const add = (id: string, xhtml: string, inSpine = true) => {
    pages.push({ id, href: `${id}.xhtml`, xhtml });
    if (inSpine) spine.push(id);
  };

  const coverPath = cover ? `images/cover.${cover.mediaType === "image/png" ? "png" : "jpg"}` : "";
  if (cover) {
    add("cover", page(lang, layout.coverLabel,
      `<div class="cover"><img src="${coverPath}" alt="${esc(doc.title)}"/></div>`, "cover"));
  }
  const bylineText = author ? fillTemplate(layout.byline, { name: author }) : "";
  add("title", page(lang, doc.title,
    `<div class="title-page">\n<h1>${esc(doc.title)}</h1>${bylineText ? `\n<p class="byline">${esc(bylineText)}</p>` : ""}\n</div>`, "titlepage"));
  // the front matter pages, then the visible table of contents (nav) after them (Q6)
  for (const role of ["dedication", "epigraph"] as const) {
    const part = doc.parts.find((p) => p.role === role && p.manuscript.blocks.length > 0);
    if (part) add(role, page(lang, doc.title, `<div class="front">\n${blocksHtml(part.manuscript.blocks, layout.sceneBreak)}\n</div>`, role));
  }
  spine.push("nav");

  const chapters: { id: string; label: string }[] = [];
  doc.parts.filter((p) => p.role === "body").forEach((p) => {
    const id = `chapter-${chapters.length + 1}`;
    const label = p.heading ?? doc.title;
    const head = p.heading !== null ? `<h1>${esc(p.heading)}</h1>\n` : "";
    add(id, page(lang, label, `<section epub:type="chapter">\n${head}${blocksHtml(p.manuscript.blocks, layout.sceneBreak)}\n</section>`, "bodymatter"));
    chapters.push({ id, label });
  });

  // the table of contents lists the chapters (the title page when there are none)
  const toc: { href: string; label: string }[] = chapters.length
    ? chapters.map((c) => ({ href: `${c.id}.xhtml`, label: c.label }))
    : [{ href: "title.xhtml", label: doc.title }];
  const landmarks = [
    ...(cover ? [`<li><a epub:type="cover" href="cover.xhtml">${esc(layout.coverLabel)}</a></li>`] : []),
    `<li><a epub:type="toc" href="nav.xhtml">${esc(layout.contentsLabel)}</a></li>`,
    ...(chapters.length ? [`<li><a epub:type="bodymatter" href="${chapters[0].id}.xhtml">${esc(layout.startLabel)}</a></li>`] : []),
  ];
  const nav = page(lang, layout.contentsLabel,
    `<nav epub:type="toc" id="toc">\n<h1>${esc(layout.contentsLabel)}</h1>\n<ol>\n${toc.map((t) => `<li><a href="${t.href}">${esc(t.label)}</a></li>`).join("\n")}\n</ol>\n</nav>\n` +
    `<nav epub:type="landmarks" id="landmarks" hidden="hidden">\n<ol>\n${landmarks.join("\n")}\n</ol>\n</nav>`);

  const ncx =
    `${XML}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${esc(lang)}">\n<head>\n` +
    `<meta name="dtb:uid" content="${esc(book.identifier)}"/>\n<meta name="dtb:depth" content="1"/>\n<meta name="dtb:totalPageCount" content="0"/>\n<meta name="dtb:maxPageNumber" content="0"/>\n</head>\n` +
    `<docTitle><text>${esc(doc.title)}</text></docTitle>\n<navMap>\n` +
    toc.map((t, i) => `<navPoint id="navpoint-${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(t.label)}</text></navLabel><content src="${t.href}"/></navPoint>`).join("\n") +
    `\n</navMap>\n</ncx>\n`;

  const manifest: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="style" href="style.css" media-type="text/css"/>`,
    ...(cover ? [`<item id="cover-image" href="${coverPath}" media-type="${cover.mediaType}" properties="cover-image"/>`] : []),
    ...pages.map((p) => `<item id="${p.id}" href="${p.href}" media-type="application/xhtml+xml"/>`),
  ];
  const opf =
    `${XML}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${esc(lang)}">\n` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `<dc:identifier id="book-id">${esc(book.identifier)}</dc:identifier>\n<dc:title>${esc(doc.title)}</dc:title>\n` +
    (author ? `<dc:creator>${esc(author)}</dc:creator>\n` : "") +
    `<dc:language>${esc(lang)}</dc:language>\n<meta property="dcterms:modified">${esc(book.modified)}</meta>\n` +
    (cover ? `<meta name="cover" content="cover-image"/>\n` : "") +
    `</metadata>\n<manifest>\n${manifest.join("\n")}\n</manifest>\n<spine toc="ncx">\n` +
    spine.map((id) => `<itemref idref="${id}"/>`).join("\n") +
    `\n</spine>\n</package>\n`;

  const container =
    `${XML}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles>\n` +
    `<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n</rootfiles>\n</container>\n`;

  const files = [
    { path: "mimetype", data: enc.encode("application/epub+zip") },
    { path: "META-INF/container.xml", data: enc.encode(container) },
    { path: "OEBPS/content.opf", data: enc.encode(opf) },
    { path: "OEBPS/nav.xhtml", data: enc.encode(nav) },
    { path: "OEBPS/toc.ncx", data: enc.encode(ncx) },
    ...pages.map((p) => ({ path: `OEBPS/${p.href}`, data: enc.encode(p.xhtml) })),
    ...(cover ? [{ path: `OEBPS/${coverPath}`, data: cover.data }] : []),
    { path: "OEBPS/style.css", data: enc.encode(STYLE) },
  ];
  return zipStore(files);
}

export const epubWriter: ManuscriptWriter<EpubBook, EpubLayout> = { id: "epub", ext: "epub", write };
