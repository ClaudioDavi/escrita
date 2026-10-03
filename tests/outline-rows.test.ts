import { describe, expect, it, vi } from "vitest";

// Task 1.4 fills effectivePiece in parallel; the rows are tested against its contract (Q47-Q48).
vi.mock("../src/core/measure", async (orig) => {
  const actual = await orig<typeof import("../src/core/measure")>();
  return {
    ...actual,
    effectivePiece: (own: any, def: any, ownUnit: any) => {
      if (own?.target !== undefined || !def) return { piece: own, source: own ? "own" : null };
      return { piece: { ...own, target: def.target, unit: ownUnit ?? def.unit ?? "words" }, source: "book" };
    },
  };
});

import { loadRows, type RowsPort, type RowSettings } from "../src/outline/rows";
import { DEFAULT_STAGES } from "../src/core/stages";
import { povValue } from "../src/outline/pov";

const settings: RowSettings = {
  summaryProperty: "summary", statusProperty: "status", povProperty: "pov", targetProperty: "target",
  limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", chapterTargetProperty: "chapterTarget",
};

interface Fake { text: string; fm?: Record<string, unknown> }
function port(files: Record<string, Fake>, o: { def?: { target: number; unit: any } | null; placeholders?: Record<string, number> } = {}): RowsPort<string[]> {
  return {
    chapters: (b) => b.map((p) => ({ path: p, basename: p.replace(/\.md$/, "") })),
    read: async (p) => ({ text: files[p].text, mtime: 1 }),
    frontmatter: (p) => files[p].fm,
    counts: async (_p, seed) => ({ words: seed.text.split(/\s+/).filter(Boolean).length, characters: seed.text.length, charactersNoSpaces: seed.text.replace(/\s/g, "").length }),
    placeholders: (p) => o.placeholders?.[p] ?? 0,
    chapterDefault: () => o.def ?? null,
    resolvePov: (v) => povValue(v, (l) => (l === "Maria" ? { path: "Maria.md", name: "Maria" } : null)),
    settings: () => settings,
    stages: () => DEFAULT_STAGES,
  };
}

describe("loadRows", () => {
  it("reads title, label, summary, status and stage", async () => {
    const p = port({
      "01 Abertura.md": { text: "um dois três", fm: { summary: "line one\nline two", status: " draft " } },
      "Sem número.md": { text: "", fm: { status: "xyz" } },
    });
    const rows = await loadRows(p, ["01 Abertura.md", "Sem número.md"]);
    expect(rows[0]).toMatchObject({ path: "01 Abertura.md", index: 0, label: "1", title: "Abertura", summary: "line one line two", status: "draft", stage: "draft", words: 3, count: 3, unit: "words", bodyBlank: false });
    expect(rows[1]).toMatchObject({ index: 1, label: "2", title: "Sem número", status: "xyz", stage: null, bodyBlank: true, piece: null, progress: null });
  });

  it("handles no frontmatter", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "x" } }), ["a.md"]);
    expect(r).toMatchObject({ status: "", stage: null, pov: null, summary: "" });
  });

  it("reads POV as a link and as text", async () => {
    const rows = await loadRows(port({
      "a.md": { text: "", fm: { pov: "[[Maria|Mari]]" } },
      "b.md": { text: "", fm: { pov: "Inês" } },
      "c.md": { text: "", fm: { pov: "Ines" } },
    }), ["a.md", "b.md", "c.md"]);
    expect(rows[0].pov).toEqual({ key: "Maria.md", label: "Maria", path: "Maria.md" });
    expect(rows[1].pov).toMatchObject({ label: "Inês", path: null });
    expect(rows[1].pov!.key).toBe(rows[2].pov!.key);
  });

  it("uses the chapter's own target", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "a b c", fm: { target: 10, limit: 20 } } }, { def: { target: 99, unit: "words" } }), ["a.md"]);
    expect(r.piece).toMatchObject({ target: 10, limit: 20 });
    expect(r.pieceSource).toBe("own");
    expect(r.progress).toMatchObject({ count: 3, of: 10, kind: "target" });
  });

  it("fills the target from the book default, in the book's unit", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "a b c" } }, { def: { target: 500, unit: "characters" } }), ["a.md"]);
    expect(r.pieceSource).toBe("book");
    expect(r.piece).toMatchObject({ target: 500, unit: "characters" });
    expect(r.unit).toBe("characters");
    expect(r.count).toBe(5);
    expect(r.words).toBe(3);
    expect(r.progress).toMatchObject({ unit: "characters", count: 5, of: 500 });
  });

  it("counts a characters piece in characters", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "ab cd", fm: { target: 100, unit: "characters-no-spaces" } } }), ["a.md"]);
    expect(r.unit).toBe("characters-no-spaces");
    expect(r.count).toBe(4);
    expect(r.words).toBe(2);
  });

  it("has no piece when nothing sets one", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "a" } }), ["a.md"]);
    expect(r).toMatchObject({ piece: null, pieceSource: null, progress: null, unit: "words" });
  });

  it("takes the placeholder count from the port and parses beats", async () => {
    const [r] = await loadRows(port({ "a.md": { text: "%% beat: a door %%\n\nShe knocked.\n\n%% beat: b %%\n" } }, { placeholders: { "a.md": 2 } }), ["a.md"]);
    expect(r.placeholders).toBe(2);
    expect(r.beats.map((b) => [b.text, b.written])).toEqual([["a door", true], ["b", false]]);
  });
});
