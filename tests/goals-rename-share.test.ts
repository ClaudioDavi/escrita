import { describe, it, expect } from "vitest";
import { shouldShareRename, type ShareProbe } from "../src/goals/rename-share";

const probe = (over: Partial<ShareProbe> & { kinds?: Record<string, { kind: string; piece?: unknown }> } = {}): ShareProbe => ({
  classify: (p) => ({ kind: "none", piece: null, ...over.kinds?.[p] }),
  bookNotes: () => [],
  filesUnder: () => [],
  ...over,
});

describe("shouldShareRename", () => {
  it("shares a book note and a standalone piece", () => {
    expect(shouldShareRename("B.md", probe({ kinds: { "B.md": { kind: "book-note" } } }))).toBe(true);
    expect(shouldShareRename("C.md", probe({ kinds: { "C.md": { kind: "note", piece: { target: 1 } } } }))).toBe(true);
  });
  it("shares a folder holding a book note or a piece", () => {
    expect(shouldShareRename("Novels", probe({ bookNotes: () => ["Novels/A.md"] }))).toBe(true);
    const kinds = { "Contos/x.md": { kind: "note", piece: { limit: 9 } } };
    expect(shouldShareRename("Contos", probe({ kinds, filesUnder: () => ["Contos/x.md"] }))).toBe(true);
  });
  it("does not share an ordinary note or a folder of them", () => {
    expect(shouldShareRename("P.md", probe({ kinds: { "P.md": { kind: "note" } } }))).toBe(false);
    expect(shouldShareRename("Dir", probe({ bookNotes: () => ["Other/A.md"], filesUnder: () => ["Dir/p.md"], kinds: { "Dir/p.md": { kind: "note" } } }))).toBe(false);
  });
});
