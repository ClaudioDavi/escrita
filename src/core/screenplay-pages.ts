// Screenplay pagination (SP 6, PLAN-1.1; no Obsidian imports): pure arithmetic on lines and
// columns. Courier 12 is 10 characters per inch and 6 lines per inch, so a page is a grid
// of `linesPerPage` rows and a column per character. `paginate(script, preset)` returns the
// body pages; the title page and the drawing are core/screenplay-pdf.ts.
//
// Rules (SP 6): a scene heading never ends a page (two lines of what follows go with it);
// dialogue splits only at a sentence end, with the "more" label under it at the cue's column
// and "NAME (continued)" at the top of the next page; a parenthetical never ends a page; a
// cue never ends a page; a transition never starts a page (the line before goes with it);
// action splits by lines, two or more on each side; dual dialogue sits side by side and never
// splits; sections and synopses do not print; a forced page break starts a page.
// Not done (decided, not forgotten): no automatic "(CONT'D)" when the same character speaks
// again on the same page, and no "CONTINUED:" scene marks.

import type { Script, ScriptElement, ScriptRun } from "./fountain";
import type { ScreenplayPreset } from "./screenplay-presets";

/** One printed line: where it starts (column from the page's left edge) and what it says. */
export interface PageRow {
  /** 0-based line in the body (the first body line is row 0) */
  row: number;
  /** column of the first character, from the page's left edge */
  col: number;
  runs: ScriptRun[];
  /** the note line this text comes from (warnings, comparing with a reference) */
  line: number;
  /** the scene number printed in both margins beside this line */
  sceneNumber?: string;
}

export interface Page {
  /** 1-based position among the body pages; the number is printed from page 2 */
  number: number;
  rows: PageRow[];
}

/** The plain text of a row. */
export function rowText(r: { runs: ScriptRun[] }): string {
  return r.runs.map((x) => x.text).join("");
}

// ---- styled characters and wrapping ----

interface SChar {
  ch: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
}

interface Line {
  col: number;
  runs: ScriptRun[];
  line: number;
  sceneNumber?: string;
}

function charsOf(runs: ScriptRun[], upper = false): SChar[] {
  const out: SChar[] = [];
  for (const r of runs) {
    const text = (upper ? r.text.toUpperCase() : r.text).replace(/\t/g, "    ").replace(/\r/g, "");
    for (const ch of text) {
      const c: SChar = { ch };
      if (r.bold) c.b = true;
      if (r.italic) c.i = true;
      if (r.underline) c.u = true;
      out.push(c);
    }
  }
  return out;
}

function runsOfChars(chars: SChar[]): ScriptRun[] {
  const runs: ScriptRun[] = [];
  for (const c of chars) {
    const last = runs[runs.length - 1];
    if (last && !!last.bold === !!c.b && !!last.italic === !!c.i && !!last.underline === !!c.u) last.text += c.ch;
    else {
      const r: ScriptRun = { text: c.ch };
      if (c.b) r.bold = true;
      if (c.i) r.italic = true;
      if (c.u) r.underline = true;
      runs.push(r);
    }
  }
  return runs;
}

const isSpace = (c: SChar) => c.ch === " " || c.ch === " ";

interface Wrapped {
  chars: SChar[];
  /** index of the hard line (a "\n" in the text) this line came from */
  hard: number;
}

/** Wrap at word boundaries to `width` characters; "\n" is a hard break; styles ride along. */
function wrap(chars: SChar[], width: number): Wrapped[] {
  const out: Wrapped[] = [];
  const w = Math.max(1, width);
  const hardLines: SChar[][] = [[]];
  for (const c of chars) {
    if (c.ch === "\n") hardLines.push([]);
    else hardLines[hardLines.length - 1].push(c);
  }
  hardLines.forEach((hl, hard) => {
    let cur: SChar[] = [];
    let first = true;
    let i = 0;
    while (i < hl.length) {
      const s0 = i;
      while (i < hl.length && isSpace(hl[i])) i++;
      const w0 = i;
      while (i < hl.length && !isSpace(hl[i])) i++;
      if (w0 === i) break; // trailing spaces
      let sep = hl.slice(s0, w0);
      let word = hl.slice(w0, i);
      if (cur.length === 0 && !first) sep = [];
      if (cur.length === 0 && first) first = false;
      if (cur.length > 0 && cur.length + sep.length + word.length > w) {
        out.push({ chars: cur, hard });
        cur = [];
        sep = [];
      }
      while (cur.length === 0 && sep.length + word.length > w && word.length > w - sep.length) {
        // a word longer than the line: break it hard
        const room = Math.max(1, w - sep.length);
        out.push({ chars: [...sep, ...word.slice(0, room)], hard });
        word = word.slice(room);
        sep = [];
      }
      cur = cur.concat(sep, word);
    }
    out.push({ chars: cur, hard });
  });
  return out;
}

// ---- units ----

type UnitKind = "scene" | "text" | "transition" | "group" | "dual" | "break";

interface DialogueItem {
  kind: "parenthetical" | "dialogue";
  chars: SChar[];
  line: number;
}

interface Group {
  cueText: string;
  cueLine: number;
  items: DialogueItem[];
  /** this piece goes on from the page before */
  continued: boolean;
}

interface Unit {
  kind: UnitKind;
  /** blank lines before it when it is not at the top of a page */
  blank: number;
  lines: Line[];
  group?: Group;
  dual?: [Group, Group];
  /** a speech piece that ends with the "more" label: the line before a transition never pulls it */
  more?: boolean;
}

interface Cols {
  cue: [number, number];
  paren: [number, number];
  dialogue: [number, number];
}

const normalCols = (p: ScreenplayPreset): Cols => ({
  cue: [p.columns.character.left, p.columns.character.right],
  paren: [p.columns.parenthetical.left, p.columns.parenthetical.right],
  dialogue: [p.columns.dialogue.left, p.columns.dialogue.right],
});

/** The two sides of dual dialogue: the action width split in two with a 2-column gap. */
function dualCols(p: ScreenplayPreset): [Cols, Cols] {
  const l = p.columns.action.left;
  const r = p.columns.action.right;
  const side = Math.floor((r - l - 2) / 2);
  const mk = (a: number, b: number): Cols => ({
    cue: [a + 5, b],
    paren: [a + 3, b - 3],
    dialogue: [a, b],
  });
  return [mk(l, l + side), mk(r - side, r)];
}

function cueTextOf(el: ScriptElement & { type: "character" }): string {
  let t = el.name.toUpperCase();
  if (el.extension) t += ` (${el.extension.toUpperCase()})`;
  return t;
}

function plainLines(chars: SChar[], width: number, left: number, line: number, align: "left" | "right" | "center" = "left", right = left + width): Line[] {
  return wrap(chars, width).map((w) => {
    const n = w.chars.length;
    const col = align === "right" ? right - n : align === "center" ? left + Math.max(0, Math.floor((width - n) / 2)) : left;
    return { col, runs: runsOfChars(w.chars), line: line + w.hard };
  });
}

/** The lines of a speech: cue (with the continued label when it goes on), parentheticals, dialogue. */
function groupLines(g: Group, cols: Cols): Line[] {
  const out: Line[] = [];
  const cue = [...g.cueText].map((ch): SChar => ({ ch }));
  out.push(...plainLines(cue, cols.cue[1] - cols.cue[0], cols.cue[0], g.cueLine));
  for (const it of g.items) {
    const c = it.kind === "parenthetical" ? cols.paren : cols.dialogue;
    out.push(...plainLines(it.chars, c[1] - c[0], c[0], it.line));
  }
  return out;
}

/** Offsets in `chars` after which a new sentence starts (after ". ", "?!" and closing quotes). */
function sentenceBoundaries(chars: SChar[]): number[] {
  const out: number[] = [];
  const closers = "\"'”’)»]";
  for (let i = 0; i < chars.length; i++) {
    if (!".?!…".includes(chars[i].ch)) continue;
    let j = i + 1;
    while (j < chars.length && (".?!…".includes(chars[j].ch) || closers.includes(chars[j].ch))) j++;
    if (j < chars.length && isSpace(chars[j])) {
      while (j < chars.length && isSpace(chars[j])) j++;
      if (j < chars.length && out[out.length - 1] !== j) out.push(j);
      i = j - 1;
    }
  }
  return out;
}

function trimEnd(chars: SChar[]): SChar[] {
  let n = chars.length;
  while (n > 0 && isSpace(chars[n - 1])) n--;
  return chars.slice(0, n);
}

/** Where a speech can break: the first part, the rest, in that order. */
function splitPoints(g: Group): { a: DialogueItem[]; b: DialogueItem[] }[] {
  const out: { a: DialogueItem[]; b: DialogueItem[] }[] = [];
  g.items.forEach((it, i) => {
    if (it.kind !== "dialogue") return;
    for (const at of sentenceBoundaries(it.chars)) {
      out.push({
        a: [...g.items.slice(0, i), { ...it, chars: trimEnd(it.chars.slice(0, at)) }],
        b: [{ ...it, chars: it.chars.slice(at) }, ...g.items.slice(i + 1)],
      });
    }
    if (i < g.items.length - 1) out.push({ a: g.items.slice(0, i + 1), b: g.items.slice(i + 1) });
  });
  return out;
}

// ---- building the units ----

function buildUnits(script: Script, preset: ScreenplayPreset): Unit[] {
  const units: Unit[] = [];
  const els = script.elements.filter((e) => e.type !== "section" && e.type !== "synopsis");
  const cols = normalCols(preset);
  const dual = dualCols(preset);
  let sceneNo = 0;
  let prevType: string | null = null;
  for (let k = 0; k < els.length; k++) {
    const el = els[k];
    const lineOfEl = el.line;
    switch (el.type) {
      case "pageBreak":
        units.push({ kind: "break", blank: 0, lines: [] });
        break;
      case "scene": {
        sceneNo++;
        const num = el.number ?? String(sceneNo);
        const a = preset.columns.scene;
        const lines = plainLines(charsOf(el.runs, true), a.right - a.left, a.left, lineOfEl);
        if (preset.sceneNumbers && lines.length > 0) lines[0].sceneNumber = num;
        units.push({ kind: "scene", blank: 1, lines });
        break;
      }
      case "action": {
        const a = preset.columns.action;
        const lines = plainLines(charsOf(el.runs), a.right - a.left, a.left, lineOfEl, el.centered ? "center" : "left");
        units.push({ kind: "text", blank: 1, lines });
        break;
      }
      case "lyric": {
        const a = preset.columns.lyric;
        const chars = charsOf(el.runs).map((c) => ({ ...c, i: true }));
        units.push({ kind: "text", blank: prevType === "lyric" ? 0 : 1, lines: plainLines(chars, a.right - a.left, a.left, lineOfEl) });
        break;
      }
      case "transition": {
        const a = preset.columns.transition;
        units.push({ kind: "transition", blank: 1, lines: plainLines(charsOf(el.runs, true), a.right - a.left, a.left, lineOfEl, "right", a.right) });
        break;
      }
      case "character": {
        const items: DialogueItem[] = [];
        while (k + 1 < els.length && (els[k + 1].type === "parenthetical" || els[k + 1].type === "dialogue")) {
          const n = els[++k] as ScriptElement & { type: "parenthetical" | "dialogue" };
          let chars = charsOf(n.runs);
          if (n.type === "parenthetical") {
            if (!(chars[0]?.ch === "(")) chars = [{ ch: "(" }, ...chars];
            if (!(chars[chars.length - 1]?.ch === ")")) chars = [...chars, { ch: ")" }];
          }
          items.push({ kind: n.type, chars, line: n.line });
        }
        const g: Group = { cueText: cueTextOf(el), cueLine: lineOfEl, items, continued: false };
        const prev = units[units.length - 1];
        if (el.dual && prev && prev.kind === "group" && prev.group) {
          const pair: [Group, Group] = [prev.group, g];
          const l = groupLines(pair[0], dual[0]);
          const r = groupLines(pair[1], dual[1]);
          units[units.length - 1] = { kind: "dual", blank: 1, lines: interleave(l, r), dual: pair };
        } else {
          units.push({ kind: "group", blank: 1, lines: groupLines(g, cols), group: g });
        }
        break;
      }
      default:
        break;
    }
    prevType = el.type;
  }
  return units;
}

/** Dual dialogue: left and right lines side by side; a right line shares the left line's row. */
interface DualLine extends Line {
  /** the row (within the unit) this line sits on */
  at: number;
}

function interleave(l: Line[], r: Line[]): Line[] {
  const out: DualLine[] = [];
  l.forEach((x, i) => out.push({ ...x, at: i }));
  r.forEach((x, i) => out.push({ ...x, at: i }));
  return out;
}

const heightOf = (u: Unit): number => {
  if (u.kind !== "dual") return u.lines.length;
  let h = 0;
  for (const l of u.lines as DualLine[]) h = Math.max(h, l.at + 1);
  return h;
};

// ---- pagination ----

interface Placed {
  unit: Unit;
  blank: number;
  lines: Line[];
}

/** Break a script into pages for `preset`. Always at least one page when anything prints. */
export function paginate(script: Script, preset: ScreenplayPreset): Page[] {
  const q = buildUnits(script, preset);
  const max = preset.linesPerPage;
  const cols = normalCols(preset);
  const pages: Page[] = [];
  let placed: Placed[] = [];
  let used = 0;

  const flush = () => {
    if (placed.length === 0) return;
    const rows: PageRow[] = [];
    let row = 0;
    placed.forEach((p, idx) => {
      if (idx > 0) row += p.blank;
      if (p.unit.kind === "dual") {
        for (const l of p.lines as DualLine[]) rows.push({ row: row + l.at, col: l.col, runs: l.runs, line: l.line });
        row += heightOf({ ...p.unit, lines: p.lines });
      } else {
        for (const l of p.lines) rows.push({ row: row++, col: l.col, runs: l.runs, line: l.line, ...(l.sceneNumber ? { sceneNumber: l.sceneNumber } : {}) });
      }
    });
    pages.push({ number: pages.length + 1, rows });
    placed = [];
    used = 0;
  };

  const put = (unit: Unit, lines: Line[]) => {
    const blank = placed.length > 0 ? unit.blank : 0;
    placed.push({ unit, blank, lines });
    used += blank + (unit.kind === "dual" ? heightOf({ ...unit, lines }) : lines.length);
  };

  const room = (unit: Unit) => max - used - (placed.length > 0 ? unit.blank : 0);

  const textUnit = (blank: number, lines: Line[]): Unit => ({ kind: "text", blank, lines });

  let qi = 0;
  let guard = 0;
  while (qi < q.length) {
    if (++guard > 100000) break;
    const u = q[qi];
    if (u.kind === "break") {
      flush();
      qi++;
      continue;
    }
    const h = heightOf(u);
    const r = room(u);

    if (u.kind === "scene") {
      const next = q[qi + 1];
      const follow = next && next.kind !== "break" ? 1 + Math.min(2, heightOf(next)) : 0;
      if (h + follow <= r || placed.length === 0) {
        put(u, u.lines);
        qi++;
      } else flush();
      continue;
    }

    if (h <= r) {
      put(u, u.lines);
      qi++;
      continue;
    }

    // it does not fit
    if (u.kind === "text") {
      const take = Math.min(r, u.lines.length - 2);
      if (u.lines.length >= 4 && take >= 2) {
        put(textUnit(u.blank, u.lines.slice(0, take)), u.lines.slice(0, take));
        q[qi] = textUnit(0, u.lines.slice(take));
        flush();
        continue;
      }
    } else if (u.kind === "group" && u.group) {
      const g = u.group;
      let best: { a: DialogueItem[]; b: DialogueItem[]; lines: Line[] } | null = null;
      for (const sp of splitPoints(g)) {
        const lines = groupLines({ ...g, items: sp.a }, cols);
        if (lines.length + 1 > r) continue;
        if (!best || lines.length >= best.lines.length) best = { ...sp, lines };
      }
      if (best) {
        const more: Line = { col: cols.cue[0], runs: [{ text: preset.more }], line: best.lines[best.lines.length - 1].line };
        const first: Unit = { kind: "group", blank: u.blank, lines: [...best.lines, more], group: { ...g, items: best.a }, more: true };
        put(first, first.lines);
        const rest: Group = { ...g, items: best.b, continued: true, cueText: continuedCue(g, preset) };
        q[qi] = { kind: "group", blank: 0, lines: groupLines(rest, cols), group: rest };
        flush();
        continue;
      }
    } else if (u.kind === "transition" && placed.length >= 2) {
      const last = placed[placed.length - 1];
      const before = placed[placed.length - 2];
      if (last.unit.kind === "text" && last.lines.length >= 4) {
        const moved = last.lines[last.lines.length - 1];
        last.lines = last.lines.slice(0, -1);
        used -= 1;
        q.splice(qi, 0, textUnit(0, [moved]));
        flush();
        continue;
      }
      if (!last.unit.more && last.unit.kind !== "dual" && before.unit.kind !== "scene") {
        placed.pop();
        used -= last.blank + last.lines.length;
        q.splice(qi, 0, { ...last.unit, blank: 0, lines: last.lines });
        flush();
        continue;
      }
    }

    if (placed.length > 0) {
      flush();
      continue;
    }
    // nothing fits even on an empty page: cut it at the page's end
    const cut = Math.max(1, max);
    if (u.kind === "dual") {
      const ls = (u.lines as DualLine[]).filter((l) => l.at < cut);
      put(u, ls);
      const rest = (u.lines as DualLine[]).filter((l) => l.at >= cut).map((l) => ({ ...l, at: l.at - cut }));
      q[qi] = { ...u, blank: 0, lines: rest };
    } else {
      put(u, u.lines.slice(0, cut));
      q[qi] = textUnit(0, u.lines.slice(cut));
    }
    flush();
    if (heightOf(q[qi]) === 0) qi++;
  }
  flush();
  return pages;
}

/** "NAME (CONT'D)" for the top of the next page; the cue text was built without the label. */
function continuedCue(g: Group, preset: ScreenplayPreset): string {
  const label = preset.continued;
  const already = g.cueText.toUpperCase().endsWith(label.toUpperCase());
  return already ? g.cueText : `${g.cueText} ${label}`;
}
