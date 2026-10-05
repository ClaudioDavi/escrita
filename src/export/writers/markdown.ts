// The Markdown manuscript writer (PLAN-0.8 Q10, 2.3). Pure, no Obsidian imports.
// Reads only `byline` and `sceneBreak` from the preset (chapter headings arrive
// formatted on each part); layout fields are the DOCX writer's.
// Output rules: tests/fixtures/manuscript/README.md.
import { fillTemplate, isBookDoc, type ExportDoc, type ManuscriptWriter, type Preset } from "../../core/export-pipeline";
import type { Block, Run } from "../../core/manuscript";

/** Characters that would turn prose into Markdown structure are escaped. */
function escapeText(t: string): string {
  return t
    .replace(/[\\*_`<]/g, "\\$&")
    .replace(/~~/g, "\\~\\~")
    .replace(/==/g, "\\=\\=")
    .replace(/%%/g, "\\%\\%")
    .replace(/\$\$/g, "\\$\\$")
    .replace(/\[\[/g, "\\[\\[");
}

/** A paragraph that starts like a heading, quote or list item must stay a paragraph. */
function escapeLead(s: string): string {
  return s
    .replace(/^(#{1,6})(?=\s|$)/, "\\$1")
    .replace(/^>/, "\\>")
    .replace(/^([-+])(?=\s)/, "\\$1")
    .replace(/^(\d+)([.)])(?=\s)/, "$1\\$2");
}

/**
 * Runs to inline Markdown. Italic wraps bold; whitespace at the edge of a marked span
 * moves outside the marks (`*a *` would not be emphasis); a "\n" is a hard break.
 */
function inline(runs: readonly Run[]): string {
  let out = "";
  let bold = false;
  let italic = false;
  // italic is the outer mark, bold the inner one: bold closes first, and reopens when italic changes
  const closeAll = (wantBold: boolean, wantItalic: boolean) => {
    const closeItalic = italic && !wantItalic;
    const closeBold = bold && (!wantBold || closeItalic || (wantItalic && !italic));
    if (!closeBold && !closeItalic) return;
    const ws = /[ \t]*$/.exec(out)![0];
    if (ws) out = out.slice(0, -ws.length);
    if (closeBold) { out += "**"; bold = false; }
    if (closeItalic) { out += "*"; italic = false; }
    out += ws;
  };
  for (const r of runs) {
    const wantBold = !!r.bold;
    const wantItalic = !!r.italic;
    closeAll(wantBold, wantItalic);
    let text = escapeText(r.text).replace(/\n/g, "\\\n");
    if ((wantItalic && !italic) || (wantBold && !bold)) {
      const lead = /^[ \t]*/.exec(text)![0];
      out += lead;
      text = text.slice(lead.length);
      if (wantItalic && !italic) { out += "*"; italic = true; }
      if (wantBold && !bold) { out += "**"; bold = true; }
    }
    out += text;
  }
  closeAll(false, false);
  return out;
}

/** The scene break line, escaped when it would parse as Markdown structure. */
function sceneBreakLine(text: string): string {
  if (text.trim() === "") return "&nbsp;"; // a blank line cannot survive Markdown
  if (/^([*\-_])(\s*\1){2,}$/.test(text.trim())) return text; // a thematic break, faithful
  return escapeLead(text.replace(/^\*(?=\s)/, "\\*"));
}

function blocksToMarkdown(blocks: readonly Block[], minHeading: number, preset: Preset): string[] {
  const out: string[] = [];
  blocks.forEach((b, i) => {
    switch (b.kind) {
      case "paragraph":
        out.push(escapeLead(inline(b.runs)));
        break;
      case "heading":
        out.push(`${"#".repeat(Math.max(b.level, minHeading))} ${inline(b.runs)}`);
        break;
      case "quote":
        // consecutive quote blocks are one quotation
        if (blocks[i - 1]?.kind === "quote") out.push(">");
        out.push("> " + escapeLead(inline(b.runs)).replace(/\n/g, "\n> "));
        break;
      case "sceneBreak":
        out.push(sceneBreakLine(preset.sceneBreak));
        break;
    }
  });
  return out;
}

function write(doc: ExportDoc, preset: Preset): string {
  const book = isBookDoc(doc);
  const minHeading = book ? 3 : 2;
  const chunks: string[] = [`# ${escapeText(doc.title)}`];
  if (doc.author.name.trim() !== "") chunks.push(escapeLead(escapeText(fillTemplate(preset.byline, { name: doc.author.name }))));
  // a novel has a separate title page, a short story starts below its title
  if (book) chunks.push("---");
  for (const part of doc.parts) {
    const body = blocksToMarkdown(part.manuscript.blocks, minHeading, preset);
    if (part.role !== "body") {
      if (body.length) chunks.push(...body, "---");
      continue;
    }
    if (part.heading !== null) chunks.push(`## ${escapeText(part.heading)}`);
    chunks.push(...body);
  }
  // quote joiners (">") sit directly under the previous quote line
  return chunks.join("\n\n").replace(/\n\n>\n\n/g, "\n>\n") + "\n";
}

export const markdownWriter: ManuscriptWriter<ExportDoc> = { id: "markdown", ext: "md", write };
