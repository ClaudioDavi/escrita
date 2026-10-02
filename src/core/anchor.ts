// Shared anchor rule (pure, no Obsidian imports): a spot in a note is remembered
// as the text around it, and found again after the note has been edited.

export const CONTEXT = 80;

/** The text around `offset` (clamped to the document), up to `size` chars each side. */
export function contextAt(text: string, offset: number, size = CONTEXT): { offset: number; before: string; after: string } {
  const at = Math.max(0, Math.min(offset, text.length));
  return { offset: at, before: text.slice(Math.max(0, at - size), at), after: text.slice(at, at + size) };
}

const STEPS = [CONTEXT, 64, 48, 32, 24, 16, 12, 8];
const MIN_ALONE = 8;

/** Offset of `x` in `source` when it occurs exactly once; -1 when absent or ambiguous. */
function uniqueIndex(source: string, x: string): number {
  const i = source.indexOf(x);
  return i !== -1 && source.lastIndexOf(x) === i ? i : -1;
}

/**
 * Where to put a darling back. Tries the exact `before`+`after` adjacency,
 * then shorter and shorter context around the cut, then `before` alone, then
 * `after` alone. Apart from the full, exact adjacency, a match only counts
 * when it is unique: short fragments (scene breaks, dialogue punctuation,
 * blank-line runs) repeat a lot in fiction, and a wrong place is worse than
 * none. Null when nothing matches unambiguously.
 */
export function findRestoreOffset(source: string, before: string, after: string): number | null {
  if (!before && !after) return source.trim() ? null : source.length;

  // both sides together
  if (before && after) {
    const full = source.indexOf(before + after);
    if (full !== -1) return full + before.length;
    for (const k of STEPS) {
      const b = before.slice(-k), a = after.slice(0, k);
      if (b.length + a.length < MIN_ALONE) break;
      const i = uniqueIndex(source, b + a);
      if (i !== -1) return i + b.length;
    }
  }
  // context at the very start or end of the file (anchored, so never ambiguous)
  if (!before) {
    for (const k of [Infinity, ...STEPS]) {
      const a = after.slice(0, k);
      if (source.startsWith(a) && a.length >= Math.min(MIN_ALONE, after.length)) return 0;
    }
  }
  if (!after) {
    for (const k of [Infinity, ...STEPS]) {
      const b = before.slice(-k);
      if (source.endsWith(b) && b.length >= Math.min(MIN_ALONE, before.length)) return source.length;
    }
  }
  // one side alone
  for (const k of [Infinity, ...STEPS]) {
    const b = before.slice(-k);
    if (b.length < Math.min(MIN_ALONE, before.length) || !b) break;
    const i = uniqueIndex(source, b);
    if (i !== -1) return i + b.length;
  }
  for (const k of [Infinity, ...STEPS]) {
    const a = after.slice(0, k);
    if (a.length < Math.min(MIN_ALONE, after.length) || !a) break;
    const i = uniqueIndex(source, a);
    if (i !== -1) return i;
  }
  return null;
}
