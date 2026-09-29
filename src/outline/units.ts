// Pure helpers for unit/plural string keys (no obsidian import, so vitest can load it).

import type { PieceUnit } from "../core/piece";

/** "outline.beats" + 1 → "outline.beats.one"; anything else → ".other" (right for en and pt-BR, including 0). */
export function pluralKey(base: string, n: number): string {
  return `${base}.${Math.round(n) === 1 ? "one" : "other"}`;
}

/** The plural base key for an amount in a piece's unit. */
export function unitKey(unit: PieceUnit): string {
  if (unit === "characters") return "outline.unit.characters";
  if (unit === "characters-no-spaces") return "outline.unit.charactersNoSpaces";
  return "outline.unit.words";
}
