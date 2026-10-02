// Move a paragraph or scene: the swap (pure, no Obsidian or CodeMirror imports).
//
// The group of blocks under the cursor trades places with its neighbour. The text
// between the two (the separator) stays where it is, so the note keeps its length
// and its blank lines. The change is one range, `{from: x0, to: y1, insert: Y + sep + X}`,
// so the editor applies it as one transaction and one undo puts it back.

import { segment, type Markdown } from "../core/markdown";
import { isSceneBreakAt } from "../core/markers";
import type { ParagraphStyle } from "../settings";
import {
  groupAt,
  inProperties,
  paragraphBlocks,
  sceneBlocks,
  type Block,
  type MoveDir,
  type MoveResult,
  type Sel,
} from "./move-blocks";

type Change = { from: number; to: number; insert: string };

/**
 * Swap the blocks `group.i..group.j` with their neighbour. A paragraph steps over a
 * unit or a break as one neighbour (the trailing break, with nothing after it, is a
 * wall). A scene steps over the breaks to the next scene. No neighbour is `edge`.
 * The cursor moves with the group. A change that would alter how the note reads
 * (see `sameStructure`) is `unsafe`.
 */
export function swap(
  md: Markdown,
  blocks: Block[],
  group: { i: number; j: number },
  dir: MoveDir,
  sel: Sel,
  rebuild?: (md: Markdown) => Block[],
): MoveResult {
  const scene = blocks.some((b) => b.kind === "scene");
  const neighbour = findNeighbour(blocks, group, dir, scene);
  if (neighbour === -1) return { refused: "edge" };

  const g0 = blocks[group.i].from;
  const g1 = blocks[group.j].to;
  const n0 = blocks[neighbour].from;
  const n1 = blocks[neighbour].to;
  // first and second in the text, before the swap
  const [f0, f1, s0, s1] = dir === "down" ? [g0, g1, n0, n1] : [n0, n1, g0, g1];
  const first = md.text.slice(f0, f1);
  const sep = md.text.slice(f1, s0);
  const second = md.text.slice(s0, s1);
  const change: Change = { from: f0, to: s1, insert: second + sep + first };
  const newText = md.text.slice(0, f0) + change.insert + md.text.slice(s1);
  if (!sameStructure(md, change, newText)) return { refused: "unsafe" };
  // the blocks after the swap are the same blocks: no two paragraphs merged or split
  if (rebuild && !sameBlocks(md, blocks, segment(newText), rebuild)) return { refused: "unsafe" };

  // the group is `first` when moving down, `second` when moving up
  const shift = dir === "down" ? s1 - f1 : -(s0 - f0);
  const map = (p: number) => Math.min(Math.max(p, g0), g1) + shift;
  return { change, selection: { anchor: map(sel.anchor), head: map(sel.head) } };
}

function sameBlocks(md: Markdown, before: Block[], next: Markdown, rebuild: (md: Markdown) => Block[]): boolean {
  const key = (m: Markdown, bs: Block[]) => bs.map((b) => `${b.kind}|${m.text.slice(b.from, b.to)}`).sort();
  const a = key(md, before);
  const b = key(next, rebuild(next));
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function findNeighbour(blocks: Block[], group: { i: number; j: number }, dir: MoveDir, scene: boolean): number {
  const step = dir === "down" ? 1 : -1;
  let k = (dir === "down" ? group.j : group.i) + step;
  if (scene) {
    while (k >= 0 && k < blocks.length && blocks[k].kind !== "scene") k += step;
    return k >= 0 && k < blocks.length ? k : -1;
  }
  if (k < 0 || k >= blocks.length) return -1;
  // the trailing break has nothing after it: a wall
  if (dir === "down" && blocks[k].kind === "break" && k === blocks.length - 1) return -1;
  // and a move up must not leave the last scene empty behind a dangling break
  if (dir === "up" && blocks[k].kind === "break" && group.j === blocks.length - 1) return -1;
  return k;
}

/** What a note is made of, as numbers a permutation of whole blocks must not change. */
function signature(md: Markdown): string {
  const spans = new Map<string, number>();
  for (const s of md.spans()) {
    if (s.kind === "prose") continue; // neighbouring prose merges, so its count moves
    const key = `${s.kind}|${s.form ?? ""}|${s.closed}`;
    spans.set(key, (spans.get(key) ?? 0) + 1);
  }
  let breaks = 0;
  const lineKinds = { prose: 0, frontmatter: 0, code: 0, comment: 0 };
  for (let i = 0; i < md.lineCount; i++) {
    lineKinds[md.startsIn(i)]++;
    if (isSceneBreakAt(md, i)) breaks++;
  }
  const masked = md.masked();
  let math = 0;
  for (let k = masked.indexOf("$$"); k !== -1; k = masked.indexOf("$$", k + 2)) math++;
  return JSON.stringify([
    md.bodyLine,
    md.unclosedFrontmatter,
    [...spans.entries()].sort(),
    lineKinds,
    breaks,
    math,
  ]);
}

/**
 * The data-safety guard: the note after the change is made of the same things as
 * before: the same comments (paired the same way), code, frontmatter, scene breaks
 * and `$$` marks. A change that is not a pure swap (the length differs) fails too.
 */
export function sameStructure(md: Markdown, change: Change, newText: string): boolean {
  if (change.insert.length !== change.to - change.from) return false;
  if (newText.length !== md.text.length) return false;
  return signature(md) === signature(segment(newText));
}

export function moveParagraph(md: Markdown, style: ParagraphStyle, sel: Sel, dir: MoveDir): MoveResult {
  if (inProperties(md, sel)) return { refused: "properties" };
  const blocks = paragraphBlocks(md, style);
  const group = groupAt(blocks, sel, "paragraph");
  if ("refused" in group) return group;
  return swap(md, blocks, group, dir, sel, (m) => paragraphBlocks(m, style));
}

export function moveScene(md: Markdown, sel: Sel, dir: MoveDir): MoveResult {
  if (inProperties(md, sel)) return { refused: "properties" };
  const blocks = sceneBlocks(md);
  const group = groupAt(blocks, sel, "scene");
  if ("refused" in group) return group;
  return swap(md, blocks, group, dir, sel, sceneBlocks);
}
