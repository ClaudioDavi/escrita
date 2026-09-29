// Pure planning for chapter file operations (no Obsidian imports).
// Everything works on basenames (file names without ".md").

import { numberedName, type RenamePlan } from "./book";

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
  const width = Math.max(pad, String(ordered.length).length);
  const plan: RenamePlan[] = [];
  ordered.forEach((name, i) => {
    const to = chapterName(i + 1, titlePart(name), width);
    if (to !== name) plan.push({ from: name, to });
  });
  return plan;
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
  const total = names.length + 1;
  const width = Math.max(pad, String(total).length);
  const renames: RenamePlan[] = [];
  names.forEach((name, i) => {
    const index1 = i < pos ? i + 1 : i + 2;
    const to = chapterName(index1, titlePart(name), width);
    if (to !== name) renames.push({ from: name, to });
  });
  return { renames, name: numberedName(pos + 1, title, width) };
}

/** New basename after changing the title, keeping the numeric prefix. Null when the title is empty. */
export function retitledName(basename: string, safeTitle: string): string | null {
  const title = safeTitle.trim();
  if (!title) return null;
  const m = PREFIX.exec(basename);
  return m ? `${m[1]} ${title}` : title;
}

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

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*title\s*\}\}/gi, () => vars.title)
    .replace(/\{\{\s*date\s*\}\}/gi, () => vars.date)
    .replace(/\{\{\s*time\s*\}\}/gi, () => vars.time);
}

export function hasFrontmatter(text: string): boolean {
  return /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.test(text);
}

function yamlKey(k: string): string {
  return /^[\p{L}\p{N}_-]+$/u.test(k) ? k : JSON.stringify(k);
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
): string {
  let content = template ? renderTemplate(template, vars) : "";
  if (!hasFrontmatter(content)) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    content = `---${eol}${yamlKey(summaryProperty || "summary")}: ""${eol}---${eol}` + content;
  }
  if (body) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    content += (content.endsWith("\n") ? "" : eol) + body;
  }
  return content;
}
