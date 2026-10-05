// Is a note's text ready to leave the desk? (IMPROVEMENTS 19). Pure, no Obsidian
// imports. The marker checks that publish runs today (src/publish/checks.ts:60-160)
// move here in task 1.5, so export can warn the same way while publish is off,
// and 0.10's book-wide check gives the same answer. Publish keeps its own
// property checks (recommended properties, over the limit) and adds them after these.
//
// Messages are not translated here: each check carries an id, a level and
// variables, and the caller's strings turn them into text.

import { segment, type Markdown } from "./markdown";
import { parseBeats, parsePlaceholders } from "./markers";
import { measureText } from "./measure";

export type ReadinessLevel = "blocker" | "warning" | "passed";

/**
 * - `unclosedComment`: a `%%` that never closes (or an odd `%%` inside a closed `<!-- -->`); blocker.
 * - `unclosedHtmlComment` (new in 0.8, the loose end): a `<!--` that never closes.
 *   Reading view hides the rest of the note while the words still count; blocker.
 * - `placeholders`: placeholder markers left in the body; blocker.
 * - `unwrittenBeats`: beats with no prose after them; warning.
 * - `emptyBody`: no words; blocker.
 */
export type ReadinessId = "unclosedComment" | "unclosedHtmlComment" | "placeholders" | "unwrittenBeats" | "emptyBody";

export interface ReadinessItem {
  /** raw text from the note (a placeholder's note, a beat); "" = nothing to show */
  text: string;
  /** 0-based line in the whole file, to jump to */
  line?: number;
}

/** Shaped like publish's `Check`, so publish can list these next to its own. */
export interface ReadinessCheck {
  id: ReadinessId;
  level: ReadinessLevel;
  /** 0-based line in the whole file where the problem is */
  line?: number;
  items: ReadinessItem[];
  vars: Record<string, string | number>;
}

export interface Readiness {
  /** every check, passed ones included, in the order of ReadinessId above */
  checks: ReadinessCheck[];
  /** some check is a blocker */
  blocked: boolean;
}

export interface ReadinessOptions {
  /** the placeholder marker word from settings (`XXX`) */
  placeholderMarker: string;
}

function asMarkdown(src: string | Markdown): Markdown {
  return typeof src === "string" ? segment(src) : src;
}

/**
 * Runs every marker check on one note's text (the editor's, maybe unsaved; never
 * a cache). Markers in code, frontmatter or comments don't count: every check
 * reads the same segmentation.
 */
export function readinessOf(md: string | Markdown, o: ReadinessOptions): Readiness {
  const m = asMarkdown(md);
  const checks: ReadinessCheck[] = [];

  const open = unclosedComment(m);
  checks.push(open === null
    ? { id: "unclosedComment", level: "passed", items: [], vars: {} }
    : { id: "unclosedComment", level: "blocker", line: open, items: [], vars: { line: open + 1 } });

  const html = unclosedHtmlComment(m);
  checks.push(html === null
    ? { id: "unclosedHtmlComment", level: "passed", items: [], vars: {} }
    : { id: "unclosedHtmlComment", level: "blocker", line: html, items: [], vars: { line: html + 1 } });

  const placeholders = parsePlaceholders(m, o.placeholderMarker);
  checks.push({
    id: "placeholders",
    level: placeholders.length ? "blocker" : "passed",
    line: placeholders[0]?.line,
    items: placeholders.map((p) => ({ text: p.text, line: p.line })),
    vars: { n: placeholders.length },
  });

  const beats = parseBeats(m).filter((b) => !b.written);
  checks.push({
    id: "unwrittenBeats",
    level: beats.length ? "warning" : "passed",
    line: beats[0]?.line,
    items: beats.map((b) => ({ text: b.text, line: b.line })),
    vars: { n: beats.length },
  });

  // measured on the text given, never a cache
  const words = measureText(m.text).words;
  checks.push({ id: "emptyBody", level: words === 0 ? "blocker" : "passed", items: [], vars: { n: words } });

  return { checks, blocked: checks.some((c) => c.level === "blocker") };
}

/**
 * The 0-based line where an unclosed `%%` comment opens, or null when every
 * comment is closed. Comments are read by core/markdown: in the body, outside
 * inline and fenced code, across lines (a comment may span paragraphs).
 *
 * Also a blocker: an odd number of `%%` inside a closed `<!-- -->`. core/markdown
 * reads them as literal (the first opener wins), but whether Reading view and
 * other Markdown renderers do is unverified, and if they don't, text after the comment is hidden while
 * it still counts here. Blocking until the writer pairs them keeps publish and export safe
 * under either reading (docs/ARCHITECTURE.md, "Markdown segmentation").
 */
export function unclosedComment(src: string | Markdown): number | null {
  const md = asMarkdown(src);
  const spans = md.spans();
  const last = spans[spans.length - 1];
  if (last && last.kind === "comment" && last.form === "%%" && !last.closed) return md.lineOf(last.from);
  for (const s of spans) {
    if (s.kind !== "comment" || s.form !== "html") continue;
    let odd = -1;
    for (let at = md.text.indexOf("%%", s.from); at !== -1 && at + 2 <= s.to; at = md.text.indexOf("%%", at + 2)) {
      odd = odd === -1 ? at : -1;
    }
    if (odd !== -1) return md.lineOf(odd);
  }
  return null;
}

/**
 * The 0-based line where an unclosed `<!--` opens, or null. Outside code and `%%`
 * comments. The segmenter turns only a closed `<!-- -->` into a comment span, so a
 * `<!--` still in prose never closes.
 */
export function unclosedHtmlComment(src: string | Markdown): number | null {
  const md = asMarkdown(src);
  for (const s of md.spans()) {
    if (s.kind !== "prose") continue;
    const at = md.text.indexOf("<!--", s.from);
    if (at !== -1 && at < s.to) return md.lineOf(at);
  }
  return null;
}
