import { isUnder } from "../core/path-keys";

/** What the share decision reads from the vault (faked in tests). */
export interface ShareProbe {
  classify(path: string): { kind: string; piece: unknown };
  /** Paths of every book note in the vault. */
  bookNotes(): string[];
  /** Paths of the files inside a folder, at any depth; empty for a file or a missing path. */
  filesUnder(path: string): string[];
}

/**
 * Should a rename be shared with the other devices even when nothing moved here (D8)? Only when the
 * new path is a book note, a standalone piece, or a folder holding one: a closed device may still
 * record words under the old path. Any other vault rename stays out of the shared list.
 */
export function shouldShareRename(newPath: string, probe: ShareProbe): boolean {
  const own = probe.classify(newPath);
  if (own.kind === "book-note") return true;
  if (own.kind === "note" && own.piece) return true;
  if (probe.bookNotes().some((p) => isUnder(p, newPath))) return true;
  return probe.filesUnder(newPath).some((p) => {
    const c = probe.classify(p);
    return c.kind === "note" && !!c.piece;
  });
}
