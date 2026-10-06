// Pure planning for chapter file operations (no Obsidian imports).
// Everything works on basenames (file names without ".md").

import { chapterNumber, numberedName, type RenamePlan } from "./book";
import { hasFrontmatter, renderTemplate, splitTemplate, yamlKey, type TemplateVars } from "./template";

// The template pieces moved to core/template.ts; re-exported for existing importers.
export { hasFrontmatter, renderTemplate, templateVars, type TemplateVars } from "./template";

const PREFIX = /^(\d+)(?:[ \t._-]+|$)/;

/**
 * A chapter operation that can't go ahead. Carries a code and the file name
 * involved so the Obsidian-facing code can show a translated message.
 */
export class ChapterError extends Error {
  constructor(readonly code: "exists" | "duplicate" | "notFound", readonly subject: string) {
    super(`${code}: ${subject}`);
    this.name = "ChapterError";
  }
}

/** The title part of a chapter basename: "" when the name is only a number ("01"). */
export function titlePart(basename: string): string {
  const m = PREFIX.exec(basename);
  return m ? basename.slice(m[0].length).trim() : basename.trim();
}

/** `numberedName`, or just the padded number when there is no title. */
export function chapterName(index1: number, title: string, width: number): string {
  return title ? numberedName(index1, title, width) : String(index1).padStart(width, "0");
}

/**
 * Like core's planRenumber, but a name that is only a number ("01") stays
 * only a number instead of keeping the old number as its title.
 */
export function planRenumberNames(ordered: string[], pad: number): RenamePlan[] {
  const counted = ordered.filter((n) => !isPrologue(n)).length;
  const width = Math.max(pad, String(counted).length);
  const plan: RenamePlan[] = [];
  let n = 0;
  for (const name of ordered) {
    if (isPrologue(name)) continue;   // "00 Prólogo" keeps its prefix and is not counted
    const to = chapterName(++n, titlePart(name), width);
    if (to !== name) plan.push({ from: name, to });
  }
  return plan;
}

/** A chapter whose prefix number is 0 ("00 Prólogo"): sorts first, no number, not counted. */
export function isPrologue(basename: string): boolean {
  return chapterNumber(basename) === 0;
}

const key = (s: string) => s.toLowerCase();

/**
 * Order renames so that no rename ever targets a name that is still taken.
 * Renames are tried last-first (so shifting chapters up never collides);
 * when every remaining rename is blocked by another pending one (a cycle,
 * e.g. swapping two chapters), one goes through a temporary name first.
 * Names are compared case-insensitively, as on macOS and Windows.
 *
 * Throws when a target is taken by a file that isn't being renamed, or when
 * two renames share a target: nothing should be touched in that case.
 */
export function orderRenames(
  plan: RenamePlan[],
  existing: string[],
  tempName: (n: number, from: string) => string = (n, from) => `escrita-tmp-${n} ${from}`,
): RenamePlan[] {
  const pending = plan.filter((p) => p.from !== p.to).map((p) => ({ ...p }));
  const occupied = new Set(existing.map(key));
  const moving = new Set(pending.map((p) => key(p.from)));
  const targets = new Set<string>();
  for (const p of pending) {
    const k = key(p.to);
    if (targets.has(k)) throw new ChapterError("duplicate", p.to);
    targets.add(k);
    if (occupied.has(k) && !moving.has(k)) throw new ChapterError("exists", p.to);
  }

  const out: RenamePlan[] = [];
  let n = 0;
  while (pending.length) {
    let idx = -1;
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (!occupied.has(key(p.to)) || key(p.to) === key(p.from)) { idx = i; break; }
    }
    if (idx === -1) {
      const p = pending[pending.length - 1];
      let tmp: string;
      do { tmp = tempName(++n, p.from); } while (occupied.has(key(tmp)) || targets.has(key(tmp)));
      out.push({ from: p.from, to: tmp });
      occupied.delete(key(p.from));
      occupied.add(key(tmp));
      p.from = tmp;
      continue;
    }
    const [p] = pending.splice(idx, 1);
    out.push(p);
    occupied.delete(key(p.from));
    occupied.add(key(p.to));
  }
  return out;
}

export interface InsertPlan {
  /** renames of existing chapters, unordered (run through orderRenames) */
  renames: RenamePlan[];
  /** basename of the new chapter */
  name: string;
}

/**
 * Plan inserting a chapter titled `title` (already file-safe) at 0-based
 * position `at` among `names` (chapter basenames in order). Every chapter's
 * prefix becomes its new 1-based position, with the width growing past `pad`
 * as needed (same rules as planRenumber).
 */
export function planInsert(names: string[], at: number, title: string, pad: number): InsertPlan {
  const pos = Math.max(0, Math.min(Math.floor(at), names.length));
  const total = names.filter((n) => !isPrologue(n)).length + 1;
  const width = Math.max(pad, String(total).length);
  const renames: RenamePlan[] = [];
  let n = 0;   // "00" chapters keep their prefix and are not counted
  let newIndex = 1;
  names.forEach((name, i) => {
    if (i === pos) newIndex = ++n;
    if (isPrologue(name)) return;
    const to = chapterName(++n, titlePart(name), width);
    if (to !== name) renames.push({ from: name, to });
  });
  if (pos >= names.length) newIndex = n + 1;
  return { renames, name: numberedName(newIndex, title, width) };
}

/** New basename after changing the title, keeping the numeric prefix. Null when the title is empty. */
export function retitledName(basename: string, safeTitle: string): string | null {
  const title = safeTitle.trim();
  if (!title) return null;
  const m = PREFIX.exec(basename);
  return m ? `${m[1]} ${title}` : title;
}

/**
 * Starting content of a new chapter: the rendered template (or nothing), with
 * a frontmatter holding an empty summary property when the template has none,
 * then `body`.
 */
export function buildChapterContent(
  template: string | null,
  vars: TemplateVars,
  summaryProperty: string,
  body?: string,
  status?: { property: string; word: string },
): string {
  let content = template ? renderTemplate(template, vars) : "";
  if (!hasFrontmatter(content)) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    content = `---${eol}${yamlKey(summaryProperty || "summary")}: ""${eol}---${eol}` + content;
  }
  if (status) content = withProperty(content, status.property, status.word);
  if (body) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    content += (content.endsWith("\n") ? "" : eol) + body;
  }
  return content;
}

/**
 * `text` (which starts with frontmatter) with `key: value` as its first property,
 * unless a property of that key is already there (keys compare without case):
 * a template's own value wins.
 */
export function withProperty(text: string, key: string, value: string): string {
  const k = key.trim();
  if (!k || !hasFrontmatter(text)) return text;
  if (splitTemplate(text).properties.some((p) => p.key.toLowerCase() === k.toLowerCase())) return text;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const v = /^[\p{L}][\p{L}\p{N}_-]*$/u.test(value) ? value : JSON.stringify(value);
  const firstEnd = text.indexOf("\n") + 1;
  return text.slice(0, firstEnd) + `${yamlKey(k)}: ${v}${eol}` + text.slice(firstEnd);
}
