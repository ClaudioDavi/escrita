// Words with offsets, by the shared word rule.

import { wordRegex } from "./wordcount";

export interface Token { from: number; to: number; text: string }

/**
 * Words by the shared word rule (wordRegex), over text whose offsets match the
 * document. With `from`/`to` only that slice is read; offsets stay absolute.
 */
export function tokens(text: string, from = 0, to = text.length): Token[] {
  const out: Token[] = [];
  const re = wordRegex();
  const slice = text.slice(from, to);
  for (let m = re.exec(slice); m !== null; m = re.exec(slice)) {
    out.push({ from: from + m.index, to: from + m.index + m[0].length, text: m[0] });
  }
  return out;
}

/**
 * Normalized word sequences, for phrase matching (crutch phrases, later universe
 * names). Whole tokens only; `i` is the first token's index, `j` the last's
 * (inclusive). `phrase` is already normalized; `norm` normalizes each token.
 */
export function findPhrase(
  toks: readonly Token[],
  phrase: readonly string[],
  norm: (s: string) => string,
): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  const n = phrase.length;
  if (n === 0) return out;
  for (let i = 0; i + n <= toks.length; i++) {
    let k = 0;
    while (k < n && norm(toks[i + k].text) === phrase[k]) k++;
    if (k === n) out.push({ i, j: i + n - 1 });
  }
  return out;
}
