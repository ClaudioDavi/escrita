/** The one rule for finding the home note in the vault (no Obsidian imports). */

/**
 * The names an empty home note setting adopts, in order. "Inicio.md" (no accent) is what 0.4
 * offered in pt-BR; a vault that has it still adopts it. The desk and the setup both use this.
 */
export const HOME_NOTE_NAMES: readonly string[] = ["Home.md", "Início.md", "Inicio.md"];

/**
 * The vault path that `path` names, or null. Tiers, first hit wins: the exact spelling; the same
 * after Unicode NFC (an "Início" typed composed finds one a sync tool stored decomposed); the
 * same ignoring letter case (vault paths are case-insensitive when creating, so "home.md" is
 * "Home.md"). Inside a tier the first path in code-unit order wins, so the answer does not
 * depend on the order the vault lists files in. The desk and the setup both call this.
 */
export function resolveHomeNote(paths: Iterable<string>, path: string): string | null {
  if (!path) return null;
  const nfc = path.normalize("NFC");
  const lower = nfc.toLowerCase();
  let exact = false;
  let composed: string | null = null;
  let loose: string | null = null;
  for (const p of paths) {
    if (p === path) exact = true;
    const pn = p.normalize("NFC");
    if (pn === nfc && (composed === null || p < composed)) composed = p;
    else if (pn.toLowerCase() === lower && (loose === null || p < loose)) loose = p;
  }
  return exact ? path : (composed ?? loose);
}
