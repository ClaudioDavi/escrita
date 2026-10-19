// A screenplay note read as Fountain (SP 1, PLAN-1.1; no Obsidian imports). The note is
// Markdown on disk; inside a screenplay note the screenplay wins where Fountain and Markdown
// disagree (`#` is a section, `>` a transition or centered text, `_x_` underline; leading
// whitespace is ignored except in action, as Fountain's spec says: PLAN-1.1 Q6). Escrita's
// `%% … %%` notes are skipped through `segment()`; `[[…]]` stays an Obsidian link, written as
// its text; boneyard `/* … */` is read here
// (Q5). The model is what the Fountain and PDF writers take (src/export/writers/), and
// core/screenplay-pages.ts paginates it.

import { segment, type Markdown } from "./markdown";

/** Inline style runs inside an element's text, as Fountain marks them (`*`, `**`, `_`). */
export interface ScriptRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface ElementBase {
  /** the 0-based line in the note where the element starts (click-to-line, warnings) */
  line: number;
  /** the element's text as runs; a multi-line element joins its lines with "\n" inside runs */
  runs: ScriptRun[];
}

export type ScriptElement =
  | (ElementBase & { type: "scene"; /** `#12#` at the end of the heading, without the hashes */ number?: string; /** forced with a leading "." */ forced?: boolean })
  | (ElementBase & { type: "action"; /** forced with "!" */ forced?: boolean; /** centered with `> … <` */ centered?: boolean })
  | (ElementBase & {
    type: "character";
    /** the name as written, without the extension and the `^` */
    name: string;
    /** "V.O.", "O.S.", "CONT'D"… without the parentheses; absent when none */
    extension?: string;
    /** `^` after the cue: this speech sits beside the one before (dual dialogue) */
    dual?: boolean;
    /** forced with "@" */
    forced?: boolean;
  })
  | (ElementBase & { type: "parenthetical" })
  | (ElementBase & { type: "dialogue" })
  | (ElementBase & { type: "lyric" })
  | (ElementBase & { type: "transition"; /** forced with ">" */ forced?: boolean })
  | (ElementBase & { type: "pageBreak" })
  | (ElementBase & { type: "section"; /** the number of `#` */ depth: number })
  | (ElementBase & { type: "synopsis" });

export type ScriptElementType = ScriptElement["type"];

/**
 * The title page. From the note's properties first (title = the note's title; author, credit,
 * source, draft date and contact through the settings, PLAN-1.1 Q9); a Fountain `Title:` block
 * at the top of the body fills what the properties leave empty.
 */
export interface TitlePage {
  title: string;
  credit?: string;
  author?: string;
  source?: string;
  draftDate?: string;
  /** one entry per line */
  contact?: string[];
}

export interface Script {
  /** the `Title:` block read from the body, if there was one; merged with properties by the export */
  titleBlock: Partial<TitlePage> | null;
  elements: ScriptElement[];
}

/** What the parser reads from settings (rule 6): the screenplay words of the install's set. */
export interface FountainOptions {
  /** scene heading prefixes without the trailing "." or space ("INT", "EXT", "INT./EXT", "I/E") */
  sceneHeadings: readonly string[];
  /** a line in capitals ending in one of these is a transition ("TO:", "PARA:") */
  transitions: readonly string[];
}

/** The settings words as parser options (comma or newline separated lists, blanks dropped). */
export function fountainOptions(s: { screenplaySceneHeadings: string; screenplayTransitions: string }): FountainOptions {
  const list = (v: string) => v.split(/[,\n]/).map((x) => x.trim()).filter((x) => x !== "");
  return { sceneHeadings: list(s.screenplaySceneHeadings), transitions: list(s.screenplayTransitions) };
}

// ---------------------------------------------------------------------------
// Reading the text

interface Ln {
  /** 0-based line in the note */
  line: number;
  /** the line's prose with notes and boneyard taken out; "" is a blank line */
  text: string;
}

/** The lines that are script: frontmatter, code and `%%` comments out; a comment inside a line removed. */
function proseLines(md: Markdown): Ln[] {
  const out: Ln[] = [];
  const text = md.text;
  for (let line = 0; line < md.lineCount; line++) {
    const s = md.lineStart(line);
    const e = md.lineEnd(line);
    if (e <= s) {
      // an empty line is blank unless it sits inside a comment, a fence or the frontmatter
      if (md.startsIn(line) === "prose") out.push({ line, text: "" });
      continue;
    }
    let kept = "";
    let removed = false;
    for (const sp of md.spans(s, e)) {
      if (sp.kind !== "prose") { removed = true; continue; }
      kept += text.slice(Math.max(sp.from, s), Math.min(sp.to, e));
    }
    if (removed && kept.trim() === "") continue;
    out.push({ line, text: kept });
  }
  return out;
}

/** Take the boneyard out (Q5); an opener with no closer later is plain text. A line left empty is skipped. */
function withoutBoneyard(lines: Ln[]): Ln[] {
  const joined = lines.map((l) => l.text).join("\n");
  const ranges: Array<[number, number]> = [];
  let pos = 0;
  for (;;) {
    const a = joined.indexOf("/*", pos);
    if (a < 0) break;
    const b = joined.indexOf("*/", a + 2);
    if (b < 0) break;
    ranges.push([a, b + 2]);
    pos = b + 2;
  }
  if (ranges.length === 0) return lines;
  const out: Ln[] = [];
  let offset = 0;
  let r = 0;
  for (const l of lines) {
    const from = offset;
    const to = offset + l.text.length;
    offset = to + 1;
    while (r < ranges.length && ranges[r][1] <= from) r++;
    let kept = "";
    let cur = from;
    let removed = false;
    for (let k = r; k < ranges.length && ranges[k][0] < to; k++) {
      const [ra, rb] = ranges[k];
      if (ra > cur) kept += joined.slice(cur, Math.min(ra, to));
      cur = Math.max(cur, Math.min(rb, to));
      removed = true;
    }
    if (!removed) { out.push(l); continue; }
    if (cur < to) kept += joined.slice(cur, to);
    if (kept.trim() === "") continue;
    out.push({ line: l.line, text: kept });
  }
  return out;
}

/** `[[target|alias]]` is its alias, `[[folder/Note.md]]` its last path part: Obsidian links, not Fountain notes. */
function unlink(text: string): string {
  if (text.indexOf("[[") < 0) return text;
  return text.replace(/\[\[([^[\]]*)\]\]/g, (_m, inner: string) => {
    const bar = inner.indexOf("|");
    if (bar >= 0) return inner.slice(bar + 1);
    const base = inner.slice(inner.lastIndexOf("/") + 1);
    return base.replace(/\.md$/i, "");
  });
}

// ---------------------------------------------------------------------------
// Inline emphasis

type Mark = "***" | "**" | "*" | "_";
type Item = { lit: string } | { mark: Mark; open: boolean; close: boolean; paired: boolean };

const ESCAPABLE = "*_\\";
const isWord = (c: string) => c !== "" && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string) => c === "" || /\s/.test(c);

// Inline emphasis: one asterisk italic, two bold, three both, underscores underline, a backslash
// before a mark makes it plain text. Marks with no partner stay text.
export function parseRuns(raw: string): ScriptRun[] {
  const items: Item[] = [];
  let lit = "";
  const flush = () => { if (lit !== "") { items.push({ lit }); lit = ""; } };
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length && ESCAPABLE.includes(raw[i + 1])) {
      lit += raw[i + 1];
      i += 2;
      continue;
    }
    if (c === "*") {
      let n = 0;
      while (raw[i + n] === "*") n++;
      const before = raw[i - 1] ?? "";
      const after = raw[i + n] ?? "";
      flush();
      let left = n;
      while (left > 0) {
        const take = left === 4 ? 2 : Math.min(left, 3);
        items.push({ mark: take === 3 ? "***" : take === 2 ? "**" : "*", open: !isSpace(after), close: !isSpace(before), paired: false });
        left -= take;
      }
      i += n;
      continue;
    }
    if (c === "_") {
      flush();
      const before = raw[i - 1] ?? "";
      const after = raw[i + 1] ?? "";
      items.push({ mark: "_", open: !isSpace(after) && !isWord(before), close: !isSpace(before) && !isWord(after), paired: false });
      i++;
      continue;
    }
    lit += c;
    i++;
  }
  flush();

  const stacks: Record<Mark, number[]> = { "***": [], "**": [], "*": [], "_": [] };
  items.forEach((it, idx) => {
    if (!("mark" in it)) return;
    const st = stacks[it.mark];
    if (it.close && st.length > 0) {
      (items[st.pop() as number] as { paired: boolean }).paired = true;
      it.paired = true;
    } else if (it.open) st.push(idx);
  });

  const runs: ScriptRun[] = [];
  let bold = 0, italic = 0, underline = 0;
  const add = (text: string) => {
    if (text === "") return;
    const prev = runs[runs.length - 1];
    const b = bold % 2 === 1, it = italic % 2 === 1, u = underline % 2 === 1;
    if (prev && !!prev.bold === b && !!prev.italic === it && !!prev.underline === u) { prev.text += text; return; }
    const run: ScriptRun = { text };
    if (b) run.bold = true;
    if (it) run.italic = true;
    if (u) run.underline = true;
    runs.push(run);
  };
  for (const it of items) {
    if ("lit" in it) add(it.lit);
    else if (!it.paired) add(it.mark);
    else if (it.mark === "***") { bold++; italic++; }
    else if (it.mark === "**") bold++;
    else if (it.mark === "*") italic++;
    else underline++;
  }
  return runs;
}

const plain = (runs: ScriptRun[]) => runs.map((r) => r.text).join("");

// ---------------------------------------------------------------------------
// Title block

const TITLE_KEYS = /^(title|credit|authors?|source|notes|draft date|date|contact|copyright|revision|tl|tc|tr|bl|br|font|watermark)\s*:(.*)$/i;

function readTitleBlock(lines: Ln[]): { block: Partial<TitlePage> | null; next: number } {
  let i = 0;
  while (i < lines.length && lines[i].text.trim() === "") i++;
  if (i >= lines.length || !TITLE_KEYS.test(lines[i].text)) return { block: null, next: 0 };
  const entries: Array<{ key: string; values: string[] }> = [];
  while (i < lines.length && lines[i].text.trim() !== "") {
    const t = lines[i].text;
    const m = TITLE_KEYS.exec(t);
    if (m && !/^\s/.test(t)) entries.push({ key: m[1].toLowerCase(), values: m[2].trim() === "" ? [] : [m[2].trim()] });
    else if (/^\s/.test(t) && entries.length > 0) entries[entries.length - 1].values.push(t.trim());
    else break;
    i++;
  }
  const block: Partial<TitlePage> = {};
  for (const { key, values } of entries) {
    const clean = values.map((v) => plain(parseRuns(unlink(v))).trim()).filter((v) => v !== "");
    if (clean.length === 0) continue;
    if (key === "title") block.title = clean.join("\n");
    else if (key === "credit") block.credit = clean.join("\n");
    else if (key === "author" || key === "authors") block.author = clean.join("\n");
    else if (key === "source") block.source = clean.join("\n");
    else if (key === "draft date") block.draftDate = clean.join("\n");
    else if (key === "contact") block.contact = clean;
  }
  return { block, next: i };
}

// ---------------------------------------------------------------------------
// Elements

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasLower = (s: string) => /\p{Ll}/u.test(s);
const hasLetter = (s: string) => /\p{L}/u.test(s);

interface Draft {
  el: ScriptElement;
  raw: string;
}

/**
 * The note's body as a script. `md` is `segment(text)` of the same text: frontmatter, code and
 * `%%` comments are never script. Pure and total: any text gives a script (unknown lines are
 * action).
 *
 * Reading order of a line, outside a speech: page break, section, synopsis, forced marks (`!`
 * `.` `@` `>` `~`), scene heading, transition, character cue, action. Leading whitespace is
 * ignored by every rule; only a line that falls through to action keeps a 4-space or tab indent
 * (and `!` keeps what follows it as typed, indent included). A speech (cue, then parentheticals and dialogue) runs to the next blank line; a line of only
 * spaces keeps it going. Emphasis in a cue is read, then dropped from `name`.
 */
export function parseFountain(text: string, md: Markdown, opts: FountainOptions): Script {
  const { block, drafts } = readScript(text, md, opts);
  const elements = drafts.map(({ el, raw }) => {
    el.runs = parseRuns(raw);
    return el;
  });
  return { titleBlock: block, elements };
}

/**
 * What each line of the note is in the script (1.2, SP 2, PLAN-1.2 Q3): the type of the element
 * that holds it, `centered` for a centered action, `titlePage` for the `Title:` block, and null
 * for everything else (blank lines, frontmatter, code, `%%` notes, boneyard). Index = the
 * note's 0-based line; the length is the note's line count. The same reading as
 * `parseFountain`, so the editor's layout never disagrees with the export.
 */
export function fountainLines(text: string, md: Markdown, opts: FountainOptions): (LineKind | null)[] {
  const doc = md.text === text ? md : segment(text);
  const { titleLines, owner } = readScript(text, doc, opts);
  const kinds = new Array<LineKind | null>(doc.lineCount).fill(null);
  for (const line of titleLines) if (line < kinds.length) kinds[line] = "titlePage";
  for (const [line, d] of owner) {
    if (line >= kinds.length) continue;
    kinds[line] = d.el.type === "action" && d.el.centered ? "centered" : d.el.type;
  }
  return kinds;
}

/** The kind of a line in a screenplay note (`fountainLines`). */
export type LineKind = ScriptElementType | "centered" | "titlePage";

function readScript(text: string, md: Markdown, opts: FountainOptions): {
  block: Partial<TitlePage> | null; titleLines: number[]; drafts: Draft[]; owner: Map<number, Draft>;
} {
  const doc = md.text === text ? md : segment(text);
  const all = withoutBoneyard(proseLines(doc)).map((l) => ({ line: l.line, text: unlink(l.text) }));
  const { block, next } = readTitleBlock(all);
  const titleLines = all.slice(0, next).map((l) => l.line);
  const lines = all.slice(next);
  const owner = new Map<number, Draft>();   // each script line and the element that holds it

  const prefixes = [...opts.sceneHeadings].map((p) => p.trim().replace(/[. ]+$/, "")).filter((p) => p !== "").sort((a, b) => b.length - a.length);
  const sceneRe = prefixes.length > 0 ? new RegExp("^(?:" + prefixes.map(escapeRe).join("|") + ")[. ]", "i") : null;
  const endings = opts.transitions.map((x) => x.trim()).filter((x) => x !== "");

  const drafts: Draft[] = [];
  let inSpeech = false;
  let open: Draft | null = null; // the action or dialogue or lyric still taking lines
  let prevBlank = true;

  const emit = (el: ScriptElement, raw: string): Draft => {
    const d = { el, raw };
    drafts.push(d);
    owner.set(el.line, d);
    open = null;
    return d;
  };
  const isBlank = (k: number) => k >= lines.length || lines[k].text.trim() === "";

  for (let k = 0; k < lines.length; k++) {
    const { line, text: t } = lines[k];
    const trimmed = t.trim();
    if (trimmed === "") {
      // two spaces (or more) inside a speech keep it going; anything else ends it
      if (!(inSpeech && t !== "")) { inSpeech = false; prevBlank = true; }
      open = null;
      continue;
    }
    const startsBlock = prevBlank;
    prevBlank = false;

    if (inSpeech) {
      if (trimmed.startsWith("~")) {
        if (open && open.el.type === "lyric") { open.raw += "\n" + trimmed.slice(1).trim(); owner.set(line, open); }
        else open = emit({ type: "lyric", line, runs: [] }, trimmed.slice(1).trim());
        continue;
      }
      if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
        emit({ type: "parenthetical", line, runs: [] }, trimmed);
        continue;
      }
      if (open && open.el.type === "dialogue") { open.raw += "\n" + trimmed; owner.set(line, open); }
      else open = emit({ type: "dialogue", line, runs: [] }, trimmed);
      continue;
    }

    // page break, section, synopsis
    if (/^={3,}$/.test(trimmed)) { emit({ type: "pageBreak", line, runs: [] }, ""); continue; }
    const sec = /^(#+)\s*(.*)$/.exec(trimmed);
    if (sec) { emit({ type: "section", line, depth: sec[1].length, runs: [] }, sec[2]); continue; }
    const syn = /^=(?!=)\s*(.*)$/.exec(trimmed);
    if (syn) { emit({ type: "synopsis", line, runs: [] }, syn[1]); continue; }

    const addAction = (rawText: string, forced: boolean) => {
      if (!forced && open && open.el.type === "action" && !(open.el as { forced?: boolean }).forced && !(open.el as { centered?: boolean }).centered) {
        open.raw += "\n" + rawText;
        owner.set(line, open);
        return;
      }
      const el: ScriptElement = { type: "action", line, runs: [] };
      if (forced) el.forced = true;
      open = emit(el, rawText);
    };

    // forced elements
    if (trimmed.startsWith("!")) { addAction(t.trimStart().slice(1).trimEnd(), true); continue; }
    if (trimmed.startsWith(".") && !trimmed.startsWith("..")) {
      const { rest, number } = sceneNumber(trimmed.slice(1).trim());
      emit({ type: "scene", line, forced: true, ...(number !== undefined ? { number } : {}), runs: [] }, rest);
      continue;
    }
    if (trimmed.startsWith("@")) {
      const cue = cueOf(trimmed.slice(1));
      emit({ type: "character", line, name: "", forced: true, runs: [] }, cue.raw);
      patchCue(drafts[drafts.length - 1], cue);
      inSpeech = true;
      continue;
    }
    if (trimmed.startsWith(">")) {
      if (trimmed.endsWith("<") && trimmed.length >= 2) {
        const inner = trimmed.slice(1, -1).trim();
        // centered lines with no blank between are one centered block (Brick & Steel's titles, as Afterwriting reads them)
        const prev: Draft | null = open;
        if (!startsBlock && prev && prev.el.type === "action" && (prev.el as { centered?: boolean }).centered) { prev.raw += "\n" + inner; owner.set(line, prev); }
        else open = emit({ type: "action", line, centered: true, runs: [] }, inner);
      } else {
        emit({ type: "transition", line, forced: true, runs: [] }, trimmed.slice(1).trim());
      }
      continue;
    }
    if (trimmed.startsWith("~")) {
      if (open && open.el.type === "lyric") { open.raw += "\n" + trimmed.slice(1).trim(); owner.set(line, open); }
      else open = emit({ type: "lyric", line, runs: [] }, trimmed.slice(1).trim());
      continue;
    }

    if (startsBlock && sceneRe && sceneRe.test(trimmed)) {
      const { rest, number } = sceneNumber(trimmed);
      emit({ type: "scene", line, ...(number !== undefined ? { number } : {}), runs: [] }, rest);
      continue;
    }
    if (startsBlock && isBlank(k + 1) && !hasLower(trimmed) && hasLetter(trimmed) && endings.some((x) => trimmed.endsWith(x))) {
      emit({ type: "transition", line, runs: [] }, trimmed);
      continue;
    }
    if (startsBlock && !isBlank(k + 1)) {
      const cue = cueOf(trimmed);
      const name = cue.name;
      if (name !== "" && hasLetter(name) && !hasLower(name)) {
        emit({ type: "character", line, name: "", runs: [] }, cue.raw);
        patchCue(drafts[drafts.length - 1], cue);
        inSpeech = true;
        continue;
      }
    }
    // action keeps its indent (Fountain's "Indenting"); every other element ignores it
    addAction(/^(\t| {4})/.test(t) ? t.trimEnd() : trimmed, false);
  }

  return { block, titleLines, drafts, owner };
}

/** `Heading #12#` into the heading and `12`. */
function sceneNumber(s: string): { rest: string; number?: string } {
  const m = /^(.*?)\s*#([\w.-]+)#$/.exec(s);
  return m ? { rest: m[1], number: m[2] } : { rest: s };
}

interface Cue {
  /** the cue as written, without "@" and "^" */
  raw: string;
  name: string;
  extension?: string;
  dual: boolean;
}

/** A cue line split into its parts. `name` is plain text (emphasis dropped, extensions out). */
function cueOf(s: string): Cue {
  let body = s.trim();
  let dual = false;
  if (body.endsWith("^")) { dual = true; body = body.slice(0, -1).trimEnd(); }
  const exts: string[] = [];
  let nameRaw = body;
  for (;;) {
    const m = /^(.*?)\s*\(([^()]*)\)$/.exec(nameRaw);
    if (!m) break;
    exts.unshift(m[2].trim());
    nameRaw = m[1];
  }
  const name = plain(parseRuns(nameRaw)).trim();
  const extension = exts.filter((x) => x !== "").join(" ");
  return { raw: body, name, ...(extension !== "" ? { extension } : {}), dual };
}

function patchCue(d: Draft, cue: Cue): void {
  const el = d.el as ScriptElement & { type: "character" };
  el.name = cue.name;
  if (cue.extension !== undefined) el.extension = cue.extension;
  if (cue.dual) el.dual = true;
}
