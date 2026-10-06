import { describe, expect, it } from "vitest";

import { loadRows, type RowsPort, type RowSettings } from "../src/outline/rows";
import { DEFAULT_STAGES } from "../src/core/stages";
import { chapterNumber, chapterTitle } from "../src/core/book";
import { povValue } from "../src/outline/pov";

const settings: RowSettings = {
  summaryProperty: "summary", statusProperty: "status", povProperty: "pov", targetProperty: "target",
  limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", chapterTargetProperty: "chapterTarget",
};

interface Fake { text: string; fm?: Record<string, unknown> }
function port(files: Record<string, Fake>, o: { def?: { target: number; unit: any } | null; placeholders?: Record<string, number>; editor?: boolean; seeds?: unknown[]; unnumbered?: string } = {}): RowsPort<string[]> {
  return {
    chapters: (b) => b.map((p) => {
      const base = p.replace(/\.md$/, "");
      return { path: p, title: chapterTitle(base), number: chapterNumber(base), include: true };
    }),
    read: async (p) => ({ text: files[p].text, mtime: o.editor ? null : 1 }),
    frontmatter: (p) => files[p].fm ?? {},
    counts: async (p, seed) => {
      o.seeds?.push(seed);
      const text = seed?.text ?? files[p].text;
      return { words: text.split(/\s+/).filter(Boolean).length, characters: text.length, charactersNoSpaces: text.replace(/\s/g, "").length };
    },
    placeholders: (p) => o.placeholders?.[p] ?? 0,
    chapterDefault: () => o.def ?? null,
    resolvePov: (v) => povValue(v, (l) => (l === "Maria" ? { path: "Maria.md", name: "Maria" } : null)),
    settings: () => (o.unnumbered === undefined ? settings : { ...settings, unnumberedTitles: o.unnumbered }),
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
    expect(rows[0]).toMatchObject({ path: "01 Abertura.md", index: 0, label: "01", title: "Abertura", summary: "line one line two", status: "draft", stage: "draft", words: 3, count: 3, unit: "words", bodyBlank: false });
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

  it("keeps the label as the digits written in the file name, as the view did", async () => {
    const rows = await loadRows(port({ "01 Abertura.md": { text: "" }, "007.md": { text: "" }, "Sem número.md": { text: "" }, "12abc.md": { text: "" } }),
      ["01 Abertura.md", "007.md", "Sem número.md", "12abc.md"]);
    expect(rows.map((r) => r.label)).toEqual(["01", "007", "3", "12"]);
  });

  it("a listed title shows no number and the next chapters show the counted number", async () => {
    const names = ["01 Prefácio.md", "02 Prólogo.md", "03 A chegada.md", "04 Interlúdio — a carta.md", "05 O porão.md", "06 Epílogo.md"];
    const files = Object.fromEntries(names.map((n) => [n, { text: "" }]));
    const rows = await loadRows(port(files, { unnumbered: "prefacio, Prólogo, Interlúdio, Epílogo" }), names);
    expect(rows.map((r) => r.label)).toEqual(["", "", "01", "", "02", ""]);
    // the list is empty: the file digits, as before
    const plain = await loadRows(port(files, { unnumbered: "" }), names);
    expect(plain.map((r) => r.label)).toEqual(["01", "02", "03", "04", "05", "06"]);
  });

  it("a blank unit never overrides the book's unit", async () => {
    const files = { "a.md": { text: "ab cd", fm: { unit: "" } }, "b.md": { text: "ab cd", fm: { unit: "  " } }, "c.md": { text: "ab cd", fm: { unit: "words" } } };
    const rows = await loadRows(port(files, { def: { target: 500, unit: "characters" } }), ["a.md", "b.md", "c.md"]);
    expect(rows[0]).toMatchObject({ unit: "characters", pieceSource: "book" });
    expect(rows[1].unit).toBe("characters");
    expect(rows[2].unit).toBe("words");
  });

  it("seeds the measurer with saved text only", async () => {
    const seeds: unknown[] = [];
    await loadRows(port({ "a.md": { text: "a b" } }, { seeds }), ["a.md"]);
    expect(seeds).toEqual([{ text: "a b", mtime: 1 }]);
  });

  it("gives no seed for editor text (mtime null) and still reads beats from it", async () => {
    const seeds: unknown[] = [];
    const [r] = await loadRows(port({ "a.md": { text: "%% beat: x %%\n\nProse here.\n" } }, { seeds, editor: true }), ["a.md"]);
    expect(seeds).toEqual([undefined]);
    expect(r.beats.map((b) => b.text)).toEqual(["x"]);
  });

  it("lists left-out chapters too", async () => {
    const p = port({ "a.md": { text: "x" } });
    const rows = await loadRows({ ...p, chapters: (b) => p.chapters(b).map((c) => ({ ...c, include: false })) }, ["a.md"]);
    expect(rows).toHaveLength(1);
  });

  it("skips a chapter that vanished while rows load instead of rejecting", async () => {
    const p = port({ "a.md": { text: "x" }, "b.md": { text: "y" } });
    const read = p.read;
    p.read = async (path) => { if (path === "a.md") throw new Error("not a file"); return read(path); };
    const rows = await loadRows(p, ["a.md", "b.md"]);
    expect(rows.map((r) => r.path)).toEqual(["b.md"]);
  });
  it("skips a chapter whose counts fail", async () => {
    const p = port({ "a.md": { text: "x" }, "b.md": { text: "y" } });
    const counts = p.counts;
    p.counts = async (path, seed, unit) => { if (path === "b.md") throw new Error("gone"); return counts(path, seed, unit); };
    expect((await loadRows(p, ["a.md", "b.md"])).map((r) => r.path)).toEqual(["a.md"]);
  });
});
