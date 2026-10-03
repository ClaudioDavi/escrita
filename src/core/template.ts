// Template filling (no Obsidian imports): the variables, the split of a template
// into properties and body, and merging properties into a note's frontmatter
// without ever overwriting one the note already has. Used by new chapters and
// "Insert from a template"; the universe's entry templates will reuse it.
//
// Variables: {{title}}, {{date}} (YYYY-MM-DD), {{time}} (HH:mm), any spacing, any case.
// Properties are read line by line (no YAML library): a property is a top-level
// `key:` line plus the indented, list (`- `) and blank lines that follow it, kept
// exactly as written so lists and multi-line values survive the merge.

import { segment, type Markdown } from "./markdown";
import type { Change } from "./note-text";

export interface TemplateVars {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
}

export function templateVars(title: string, now: Date): TemplateVars {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    title,
    date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    time: `${p(now.getHours())}:${p(now.getMinutes())}`,
  };
}

/** The template with {{title}}, {{date}} and {{time}} filled in. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*title\s*\}\}/gi, () => vars.title)
    .replace(/\{\{\s*date\s*\}\}/gi, () => vars.date)
    .replace(/\{\{\s*time\s*\}\}/gi, () => vars.time);
}

export function hasFrontmatter(text: string): boolean {
  return segment(text).bodyLine > 0;
}

/** A YAML key, quoted when it holds anything but letters, digits, `_` and `-`. */
export function yamlKey(k: string): string {
  return /^[\p{L}\p{N}_-]+$/u.test(k) ? k : JSON.stringify(k);
}

export interface TemplateProp {
  /** the key, unquoted */
  key: string;
  /** the property's lines as written (no line breaks), the `key:` line first */
  lines: string[];
}

export interface TemplateParts {
  properties: TemplateProp[];
  /** everything after the frontmatter (the whole text when there is none) */
  body: string;
}

const KEY_LINE = /^(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s#:'"-][^:]*?|-[^\s:][^:]*?))[ \t]*:(?:[ \t]|$)/u;

function propsOf(lines: string[]): TemplateProp[] {
  const out: TemplateProp[] = [];
  for (const line of lines) {
    const m = KEY_LINE.exec(line);
    if (m) out.push({ key: m[1] ?? m[2] ?? m[3], lines: [line] });
    else if (out.length) out[out.length - 1].lines.push(line);
  }
  // blank lines between properties are not part of the earlier one
  for (const p of out) while (p.lines.length > 1 && p.lines[p.lines.length - 1].trim() === "") p.lines.pop();
  return out;
}

function frontmatterLines(text: string): { lines: string[]; closeLine: number; bodyLine: number; lineStart: (l: number) => number } {
  const md = segment(text);
  if (md.bodyLine === 0) return { lines: [], closeLine: -1, bodyLine: 0, lineStart: md.lineStart };
  const lines: string[] = [];
  for (let l = 1; l < md.bodyLine - 1; l++) lines.push(text.slice(md.lineStart(l), md.lineEnd(l)));
  return { lines, closeLine: md.bodyLine - 1, bodyLine: md.bodyLine, lineStart: md.lineStart };
}

/** Offset where the body starts (the text's end when the closing --- is the last line). */
function bodyStart(md: Markdown): number {
  return md.bodyLine >= md.lineCount ? md.text.length : md.lineStart(md.bodyLine);
}

/** A template's properties and body (the template should be filled first). */
export function splitTemplate(template: string): TemplateParts {
  const fm = frontmatterLines(template);
  if (fm.bodyLine === 0) return { properties: [], body: template };
  const md = segment(template);
  return { properties: propsOf(fm.lines), body: template.slice(bodyStart(md)) };
}

const norm = (k: string) => k.normalize("NFC").trim().toLowerCase();

/** The template properties whose key the note's frontmatter lacks (keys compare without case). */
export function missingProperties(noteText: string, props: TemplateProp[]): TemplateProp[] {
  const have = new Set(propsOf(frontmatterLines(noteText).lines).map((p) => norm(p.key)));
  const out: TemplateProp[] = [];
  for (const p of props) {
    const k = norm(p.key);
    if (have.has(k)) continue;
    have.add(k);
    out.push(p);
  }
  return out;
}

/**
 * The change that adds `props` to the note's frontmatter, only those it lacks:
 * before the closing `---` of an existing frontmatter, or a new frontmatter at
 * the top of a note without one. Existing properties are never touched. Null
 * when nothing is missing or when the note has an unclosed `---` at the top
 * (not a frontmatter we can safely extend).
 */
export function mergeProperties(noteText: string, props: TemplateProp[]): Change | null {
  const md = segment(noteText);
  if (md.unclosedFrontmatter) return null;
  const add = missingProperties(noteText, props);
  if (add.length === 0) return null;
  const eol = noteText.includes("\r\n") ? "\r\n" : "\n";
  const block = add.map((p) => p.lines.join(eol) + eol).join("");
  if (md.bodyLine === 0) return { from: 0, to: 0, insert: `---${eol}${block}---${eol}` };
  const at = md.lineStart(md.bodyLine - 1);
  return { from: at, to: at, insert: block };
}

/** Where a body inserted at `cursor` really goes: never inside the frontmatter. */
function bodyOffset(noteText: string, cursor: number): number {
  const md = segment(noteText);
  const start = bodyStart(md);
  return Math.min(noteText.length, Math.max(cursor, start));
}

/**
 * Everything "Insert from a template" changes, as non-overlapping changes against
 * `noteText` (in order, for one editor transaction): missing properties merged
 * into the frontmatter and the filled template's body at the cursor. Changes at
 * the same offset are joined into one.
 */
export function planTemplateInsert(noteText: string, cursor: number, template: string, vars: TemplateVars): Change[] {
  const { properties, body } = splitTemplate(renderTemplate(template, vars));
  const out: Change[] = [];
  const fm = mergeProperties(noteText, properties);
  if (fm) out.push(fm);
  if (body !== "") {
    const at = bodyOffset(noteText, cursor);
    // the closing --- may be the last line with no newline after it: the body starts on a line of its own
    const eol = noteText.includes("\r\n") ? "\r\n" : "\n";
    const bare = at === noteText.length && at > 0 && !/\n$/.test(noteText) && !segment(noteText).unclosedFrontmatter && segment(noteText).bodyLine > 0;
    const last = out[out.length - 1];
    const text = bare ? eol + body : body;
    if (last && last.to === at) last.insert += text;
    else out.push({ from: at, to: at, insert: text });
  }
  return out;
}
