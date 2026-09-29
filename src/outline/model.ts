// Pure logic behind the outline panel (no Obsidian imports): keyboard
// decisions, beat letters, reordering, the ghost-beat scan and the canvas board.

import { BEAT_LINE, bodyStartLine } from "../core/markers";

/** 0 → "a", 25 → "z", 26 → "aa", 27 → "ab"… */
export function beatLetter(i: number): string {
  let n = Math.max(0, Math.floor(i));
  let s = "";
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// ---------------------------------------------------------------- keyboard

export type Field = "title" | "summary" | "beat" | "new";

export interface KeyInput {
  key: string;
  shift: boolean;
  /** Ctrl, Cmd or Alt held */
  mod: boolean;
  /** an IME composition is in progress */
  composing: boolean;
  field: Field;
  /** current text of the field */
  value: string;
  /** caret offset (start of the selection) */
  caret: number;
  selectionEmpty: boolean;
  /** caret is on the field's first / last visual line */
  atFirstLine: boolean;
  atLastLine: boolean;
  /** 0-based chapter position (for "new": number of chapters) */
  chapterIndex: number;
  /** chapter word count */
  words: number;
  /** chapter body holds nothing but blank lines (no beats, no comments, no prose) */
  bodyBlank: boolean;
  /** for a chapter title: the summary is empty */
  summaryEmpty: boolean;
  /** for a beat: it has prose */
  beatWritten: boolean;
}

export type BlockReason = "firstChapter" | "notEmpty" | "written" | "noChapters";

export type KeyAction =
  | { type: "default" }
  | { type: "swallow" }
  | { type: "newChapter"; before: boolean }
  | { type: "newBeat"; before: boolean }
  | { type: "createFromNew" }
  | { type: "newAsBeat" }
  | { type: "chapterToBeat" }
  | { type: "beatToChapter" }
  | { type: "removeBeat" }
  | { type: "trashChapter" }
  | { type: "focus"; dir: -1 | 1 }
  | { type: "blocked"; reason: BlockReason };

/** What a key press in an outline field should do (NEO-style outlining). */
export function decideKey(k: KeyInput): KeyAction {
  if (k.composing || k.mod) return { type: "default" };
  const empty = k.value.trim() === "";
  const atStart = k.selectionEmpty && k.caret === 0;

  switch (k.key) {
    case "Enter": {
      if (k.shift) return { type: "swallow" };
      if (k.field === "title") return { type: "newChapter", before: atStart && !empty };
      if (k.field === "beat") return { type: "newBeat", before: atStart && !empty };
      if (k.field === "summary") return { type: "focus", dir: 1 };
      return empty ? { type: "swallow" } : { type: "createFromNew" };
    }
    case "Tab": {
      if (k.shift) {
        if (k.field !== "beat") return { type: "swallow" };
        return k.beatWritten ? { type: "blocked", reason: "written" } : { type: "beatToChapter" };
      }
      if (k.field === "title") {
        if (k.chapterIndex <= 0) return { type: "blocked", reason: "firstChapter" };
        if (k.words > 0 || !k.bodyBlank) return { type: "blocked", reason: "notEmpty" };
        return { type: "chapterToBeat" };
      }
      if (k.field === "new") {
        if (empty) return { type: "swallow" };
        return k.chapterIndex <= 0 ? { type: "blocked", reason: "noChapters" } : { type: "newAsBeat" };
      }
      return { type: "swallow" };
    }
    case "Backspace": {
      if (k.shift || !atStart) return { type: "default" };
      if (k.field === "beat") return k.value === "" ? { type: "removeBeat" } : { type: "default" };
      if (k.field === "title") {
        if (k.value !== "" || !k.summaryEmpty) return { type: "default" };
        if (k.words > 0 || !k.bodyBlank) return { type: "blocked", reason: "notEmpty" };
        return { type: "trashChapter" };
      }
      if (k.field === "summary") return k.value === "" ? { type: "focus", dir: -1 } : { type: "default" };
      return { type: "default" };
    }
    case "ArrowUp":
      return !k.shift && k.atFirstLine ? { type: "focus", dir: -1 } : { type: "default" };
    case "ArrowDown":
      return !k.shift && k.atLastLine ? { type: "focus", dir: 1 } : { type: "default" };
    default:
      return { type: "default" };
  }
}

/** Beat text for a chapter folded into the previous one with Tab. */
export function chapterAsBeatText(title: string, summary: string, untitled: string): string {
  const t = title.trim(), s = summary.trim();
  if (!t || t === untitled) return s;
  return s ? `${t}: ${s}` : t;
}

// ---------------------------------------------------------------- reordering

/** Final index of an item dragged from `from` and dropped before (or `after`) the item at `target`. */
export function dropIndex(from: number, target: number, after: boolean): number {
  const slot = after ? target + 1 : target;
  return from < slot ? slot - 1 : slot;
}

/** A copy of `arr` with the item at `from` moved to index `to`. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const out = arr.slice();
  if (from < 0 || from >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, x);
  return out;
}

// ---------------------------------------------------------------- ghost beats

export interface GhostBeat {
  /** 0-based line */
  line: number;
  text: string;
  letter: string;
}

/** Beat lines of a document (frontmatter excluded), lettered by their order. */
export function scanBeats(lines: readonly string[]): GhostBeat[] {
  const out: GhostBeat[] = [];
  const start = bodyStartLine(lines as string[]);
  for (let i = start; i < lines.length; i++) {
    const m = BEAT_LINE.exec(lines[i]);
    if (m) out.push({ line: i, text: m[1], letter: beatLetter(out.length) });
  }
  return out;
}

// ---------------------------------------------------------------- canvas board

export const BOARD_MARKER = "%% escrita-board %%";

export interface BoardChapter {
  /** vault path of the chapter file */
  path: string;
  /** file basename, e.g. "01 Chegada" */
  name: string;
  summary: string;
  status: string;
  beats: string[];
}

export interface CanvasNode {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface CanvasData {
  escrita: true;
  nodes: CanvasNode[];
  edges: never[];
}

/** A canvas as read from disk: nodes and edges we don't make are kept as they are. */
type Json = Record<string, unknown>;

const CANVAS_NAMED: Record<string, string> = {
  red: "1", orange: "2", yellow: "3", green: "4", cyan: "5", blue: "5", teal: "5", purple: "6", violet: "6",
};

/** A status color (settings) as a JSON Canvas color: a preset "1"–"6" or #rrggbb. */
export function canvasColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const c = color.trim().toLowerCase();
  if (/^[1-6]$/.test(c)) return c;
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/.exec(c);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c);
  if (m) return `#${m[1]}`;
  return CANVAS_NAMED[c];
}

function oneLine(s: string): string {
  return s.replace(/\s*\r?\n\s*/g, " ").trim();
}

/** The Markdown shown on a chapter's card. */
export function cardText(ch: BoardChapter): string {
  const link = ch.path.replace(/\.md$/i, "");
  const parts = [BOARD_MARKER, `## [[${link}|${ch.name}]]`];
  const summary = oneLine(ch.summary);
  if (summary) parts.push(summary);
  const beats = ch.beats.map(oneLine).filter(Boolean);
  if (beats.length) parts.push(beats.map((b) => `- ${b}`).join("\n"));
  return parts.join("\n\n");
}

export interface BoardOptions {
  columns?: number;
  width?: number;
  gap?: number;
}

/** JSON Canvas 1.0 board: one text card per chapter, in reading order, left to right. */
export function buildBoard(
  chapters: BoardChapter[],
  colorFor: (status: string) => string | undefined,
  opts: BoardOptions = {},
): CanvasData {
  const columns = Math.max(1, opts.columns ?? 4);
  const width = opts.width ?? 320;
  const gap = opts.gap ?? 40;
  const charsPerLine = Math.max(10, Math.floor((width - 40) / 8));
  const heights = chapters.map((ch) => {
    const lines = 2
      + Math.ceil(oneLine(ch.summary).length / charsPerLine)
      + ch.beats.reduce((n, b) => n + Math.max(1, Math.ceil(oneLine(b).length / charsPerLine)), 0);
    return Math.max(140, 60 + lines * 26);
  });
  const nodes: CanvasNode[] = [];
  let y = 0;
  for (let row = 0; row * columns < chapters.length; row++) {
    const idx = chapters.map((_, i) => i).slice(row * columns, row * columns + columns);
    const h = Math.max(...idx.map((i) => heights[i]));
    for (const i of idx) {
      const ch = chapters[i];
      const node: CanvasNode = {
        id: `escrita-${i + 1}`,
        type: "text",
        text: cardText(ch),
        x: (i % columns) * (width + gap),
        y,
        width,
        height: h,
      };
      const color = canvasColor(colorFor(ch.status.toLowerCase()));
      if (color) node.color = color;
      nodes.push(node);
    }
    y += h + gap;
  }
  return { escrita: true, nodes, edges: [] };
}

/**
 * Whether an existing .canvas file is Escrita's (or empty), so it can be
 * updated without asking. Updating goes through `mergeBoard`, which keeps
 * everything the user added.
 */
export function canOverwriteBoard(json: string): boolean {
  if (json.trim() === "") return true;
  try {
    const data = JSON.parse(json) as { escrita?: unknown; nodes?: Array<{ text?: unknown }> };
    if (!data || typeof data !== "object") return false;
    if (data.escrita === true) return true;
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    if (!nodes.length) return true;
    const first = nodes[0];
    return typeof first?.text === "string" && first.text.includes(BOARD_MARKER);
  } catch {
    return false;
  }
}

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** A card Escrita generated: id "escrita-…", a text card, with the marker in its text. */
function isEscritaNode(n: Json): boolean {
  return typeof n.id === "string" && /^escrita-/.test(n.id) && n.type === "text"
    && typeof n.text === "string" && n.text.includes(BOARD_MARKER);
}

/** The chapter link inside a generated card's text (`[[path|name]]` → path). */
function cardLink(text: string): string | null {
  const m = /\[\[([^\]|]+)\|/.exec(text);
  return m ? m[1] : null;
}

/**
 * Update an existing Escrita board with a freshly built one, keeping the
 * user's work: cards and arrows they added, other top-level keys, and the
 * position and size of every chapter card (matched by the chapter it links
 * to). Only the text and color of Escrita's own cards are replaced. New
 * chapters get cards below everything else; cards of chapters that no longer
 * exist are dropped along with arrows that pointed at them.
 */
export function mergeBoard(existing: string, fresh: CanvasData, gap = 40, columns = 4): Json {
  let data: Json = {};
  try {
    const parsed: unknown = existing.trim() ? JSON.parse(existing) : {};
    if (isObj(parsed)) data = parsed;
  } catch {
    // unreadable: start over
  }
  const oldNodes = (Array.isArray(data.nodes) ? data.nodes : []).filter(isObj);
  const oldEdges = (Array.isArray(data.edges) ? data.edges : []).filter(isObj);

  const ours = new Map<string, Json>();
  for (const n of oldNodes) {
    if (!isEscritaNode(n)) continue;
    const link = cardLink(n.text as string);
    if (link && !ours.has(link)) ours.set(link, n);
  }
  const used = new Set(oldNodes.map((n) => String(n.id)));
  let seq = 0;
  const newId = () => {
    let id: string;
    do { id = `escrita-${++seq}`; } while (used.has(id));
    used.add(id);
    return id;
  };
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const bottom = oldNodes.reduce((m, n) => Math.max(m, num(n.y, 0) + num(n.height, 0)), -Infinity);
  const shift = Number.isFinite(bottom) ? bottom + gap : 0;

  const kept = new Set<Json>();
  const placed = new Map<Json, Json>();
  const added: CanvasNode[] = [];
  for (const f of fresh.nodes) {
    const link = cardLink(f.text);
    const old = link ? ours.get(link) : undefined;
    if (old && !kept.has(old)) {
      kept.add(old);
      const next: Json = { ...old, text: f.text };
      if (f.color) next.color = f.color; else delete next.color;
      placed.set(old, next);
    } else {
      added.push({ ...f, id: newId() });
    }
  }
  // New cards: their own grid, below everything already on the board.
  let y = shift;
  for (let r = 0; r * columns < added.length; r++) {
    const rowCards = added.slice(r * columns, r * columns + columns);
    rowCards.forEach((c, k) => { c.x = k * (c.width + gap); c.y = y; });
    y += Math.max(...rowCards.map((c) => c.height)) + gap;
  }

  const nodes: Json[] = [];
  const dropped = new Set<string>();
  for (const n of oldNodes) {
    if (!isEscritaNode(n)) nodes.push(n);
    else if (placed.has(n)) nodes.push(placed.get(n) as Json);
    else dropped.add(String(n.id));
  }
  nodes.push(...added.map((c): Json => ({ ...c })));
  const edges = oldEdges.filter((e) => !dropped.has(String(e.fromNode)) && !dropped.has(String(e.toNode)));
  return { ...data, escrita: true, nodes, edges };
}
