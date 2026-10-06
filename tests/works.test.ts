import { describe, it, expect } from "vitest";
import { deskEntry, sameDeskEntry, bookChapterProgress, type DeskEntry } from "../src/core/works";
import { stageOf, DEFAULT_STAGES, type Stage } from "../src/core/stages";

const so = (s: unknown) => stageOf(s, DEFAULT_STAGES);
type P = Parameters<typeof deskEntry>[0];
const base: P = { kind: "note", tracked: true, snapshot: false, piece: null, stage: null, title: "T" };

describe("deskEntry", () => {
  it("book note with a known stage is a book, with the goal", () => {
    const e = deskEntry({ ...base, kind: "book-note", stage: "draft", title: "Livro" }, "draft", so, 80000);
    expect(e).toEqual({ role: "book", stage: "draft", title: "Livro", goal: 80000 });
  });
  it("book note with unknown status is unstaged", () => {
    const e = deskEntry({ ...base, kind: "book-note", title: "L" }, "zzz", so);
    expect(e).toEqual({ role: "unstaged", stage: null, title: "L" });
  });
  it("untracked book note gives nothing", () => {
    expect(deskEntry({ ...base, kind: "book-note", tracked: false, stage: null }, "draft", so)).toBeUndefined();
  });
  it("tracked note with a known stage carries its piece", () => {
    const e = deskEntry({ ...base, stage: "revision", piece: { unit: "characters", target: 5000, limit: 6000, deadline: "2026-10-15" } }, "revision", so);
    expect(e).toEqual({ role: "note", stage: "revision", title: "T", target: 5000, limit: 6000, unit: "characters", deadline: "2026-10-15" });
  });
  it("tracked note with a stage and no piece has no length fields", () => {
    const e = deskEntry({ ...base, stage: "idea" }, "idea", so)!;
    expect(e).toEqual({ role: "note", stage: "idea", title: "T" });
    expect("target" in e).toBe(false);
  });
  it("tracked note with unknown status is unstaged", () => {
    expect(deskEntry(base, "xyz", so)).toEqual({ role: "unstaged", stage: null, title: "T" });
    expect(deskEntry(base, 3, so)?.role).toBe("unstaged");
  });
  it("tracked note without a status gives nothing", () => {
    for (const s of [undefined, null, "", "  "]) expect(deskEntry(base, s, so)).toBeUndefined();
  });
  it("untracked note and snapshot give nothing", () => {
    expect(deskEntry({ ...base, tracked: false }, "draft", so)).toBeUndefined();
    expect(deskEntry({ ...base, snapshot: true, stage: "draft" }, "draft", so)).toBeUndefined();
  });
  it("tracked chapter gets role chapter with the stage of its status", () => {
    const e = deskEntry({ ...base, kind: "chapter", bookNotePath: "L.md" }, "ready", so);
    expect(e).toEqual({ role: "chapter", stage: "ready", title: "T", book: "L.md" });
  });
  it("chapter with unknown or no status has a null stage", () => {
    expect(deskEntry({ ...base, kind: "chapter", bookNotePath: "L.md" }, "zz", so)?.stage).toBeNull();
    expect(deskEntry({ ...base, kind: "chapter", bookNotePath: "L.md" }, undefined, so)?.stage).toBeNull();
  });
  it("untracked chapter (the template) gives nothing", () => {
    expect(deskEntry({ ...base, kind: "chapter", tracked: false, bookNotePath: "L.md" }, "draft", so)).toBeUndefined();
  });
  it("other kinds give nothing", () => {
    for (const kind of ["folder", "file", "book-file", "none", "book-folder", "chapters-folder"])
      expect(deskEntry({ ...base, kind }, "draft", so)).toBeUndefined();
  });
});

describe("sameDeskEntry", () => {
  const a: DeskEntry = { role: "note", stage: "draft", title: "T", target: 1, unit: "words" };
  it("compares every field", () => {
    expect(sameDeskEntry(a, { ...a })).toBe(true);
    for (const patch of [{ role: "unstaged" }, { stage: null }, { title: "U" }, { book: "x" }, { target: 2 }, { limit: 3 }, { unit: "characters" }, { deadline: "2026-01-01" }, { goal: 5 }])
      expect(sameDeskEntry(a, { ...a, ...patch } as DeskEntry)).toBe(false);
  });
  it("undefined and missing are the same", () => {
    expect(sameDeskEntry(a, { ...a, limit: undefined })).toBe(true);
  });
});

describe("bookChapterProgress", () => {
  const ch = (book: string, stage: Stage | null): DeskEntry => ({ role: "chapter", stage, title: "c", book });
  const entries: [string, DeskEntry][] = [
    ["a1", ch("A.md", "ready")], ["a2", ch("A.md", "published")], ["a3", ch("A.md", "revision")],
    ["a4", ch("A.md", null)], ["b1", ch("B.md", "ready")],
    ["A.md", { role: "book", stage: "draft", title: "A" }],
  ];
  it("counts chapters at or past the minimum", () => {
    expect(bookChapterProgress(entries, "A.md", "ready")).toEqual({ done: 2, total: 4 });
    expect(bookChapterProgress(entries, "A.md", "revision")).toEqual({ done: 3, total: 4 });
  });
  it("is zero for an unknown book", () => {
    expect(bookChapterProgress(entries, "Z.md", "ready")).toEqual({ done: 0, total: 0 });
  });
});

// ── the works index over a MemoryVault ───────────────────────────────────
import { VaultIndex } from "../src/core/vault-index";
import { classify, snapshotsRoot, type ClassifySettings, type VaultTree } from "../src/core/classify";
import { worksSpec, settingsKeyOf } from "../src/core/works-index";
import { cloneDefaultStages } from "../src/core/stages";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

function wsetup(files: Record<string, string>, over: Partial<ClassifySettings> = {}) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const settings: ClassifySettings & { stages: ReturnType<typeof cloneDefaultStages> } = {
    chaptersFolder: "Capítulos", chapterTemplate: "", trackFolders: "", excludeFolders: "", snapshotsFolder: "",
    statusProperty: "status", stages: cloneDefaultStages(),
    targetProperty: "target", limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", ...over,
  };
  const fm = (f: MemFile) => {
    const m = /^---\n([\s\S]*?)\n---/.exec(f.text);
    const out: Record<string, unknown> = {};
    for (const line of (m?.[1] ?? "").split("\n")) {
      const kv = /^(\w+):\s*(.*)$/.exec(line);
      if (kv) out[kv[1]] = kv[2];
    }
    return out;
  };
  const tree: VaultTree<MemFile, { path: string }> = {
    file: (p) => vault.file(p),
    folder: (p) => (vault.files().some((f) => f.path.startsWith(p + "/")) ? { path: p } : null),
    folders: () => {
      const set = new Set<string>();
      for (const f of vault.files()) {
        const parts = f.path.split("/");
        for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"));
      }
      return [...set].map((path) => ({ path }));
    },
    frontmatter: fm,
    resolve: () => null,
  };
  const spec = worksSpec<MemFile>({
    settings: () => settings,
    placement: (f) => classify(tree, settings, f.path),
    frontmatter: fm,
    bookGoal: () => undefined,
  });
  const index = new VaultIndex<MemFile, DeskEntry>(spec, vault, timers);
  vault.attach(index);
  return { vault, timers, index, settings, spec };
}

describe("works index", () => {
  const note = (status: string) => `---\nstatus: ${status}\n---\ntext`;

  it("builds entries for tracked notes with a status and skips the rest", async () => {
    const { index } = wsetup({ "A.md": note("draft"), "B.md": "no status", "C.md": note("zzz"), "s.txt": "x" });
    await index.build();
    expect(index.get("A.md")).toMatchObject({ role: "note", stage: "draft", title: "A" });
    expect(index.get("B.md")).toBeUndefined();
    expect(index.get("C.md")).toMatchObject({ role: "unstaged" });
    expect(index.get("s.txt")).toBeUndefined();
  });

  it("is metadata mode and structural", () => {
    const { spec } = wsetup({});
    expect(spec.mode).toBe("metadata");
    expect(spec.structural).toBe(true);
    expect(spec.name).toBe("desk");
  });

  it("leaves out files in the snapshots folder", async () => {
    const { index, settings } = wsetup({ [`${snapshotsRoot("")}/A.md`]: note("draft"), "A.md": note("draft") });
    await index.build();
    expect(index.paths()).toEqual(["A.md"]);
    expect(settings.snapshotsFolder).toBe("");
  });

  it("creating F/Capítulos turns F.md into a book (structural recompute)", async () => {
    const { index, vault, timers } = wsetup({ "F.md": note("draft") });
    await index.build();
    expect(index.get("F.md")?.role).toBe("note");
    vault.create("F/Capítulos/Um.md", note("ready"));
    index.structureChanged();
    await timers.advance(1000);
    await settle();
    expect(index.get("F.md")?.role).toBe("book");
    expect(index.get("F/Capítulos/Um.md")).toMatchObject({ role: "chapter", stage: "ready", book: "F.md", title: "Um" });
  });

  it("a status edit updates the entry", async () => {
    const { index, vault } = wsetup({ "A.md": note("draft") });
    await index.build();
    vault.changeMeta("A.md", note("revision"));
    expect(index.get("A.md")?.stage).toBe("revision");
  });
});

describe("settingsKeyOf", () => {
  const base = { trackFolders: "a", excludeFolders: "b", chaptersFolder: "c", chapterTemplate: "", snapshotsFolder: "", statusProperty: "status", stages: cloneDefaultStages(), targetProperty: "target", limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", goalProperty: "goal" };
  it("changes with every setting the entries depend on", () => {
    const k = settingsKeyOf(base);
    expect(settingsKeyOf({ ...base })).toBe(k);
    for (const patch of [{ trackFolders: "x" }, { excludeFolders: "x" }, { chaptersFolder: "x" }, { chapterTemplate: "x" }, { snapshotsFolder: "x" }, { statusProperty: "x" }, { targetProperty: "x" }, { limitProperty: "x" }, { unitProperty: "x" }, { deadlineProperty: "x" }, { goalProperty: "x" }, { stages: { ...cloneDefaultStages(), draft: { words: "x", color: "" } } }])
      expect(settingsKeyOf({ ...base, ...patch })).not.toBe(k);
  });
  it("ignores other settings", () => {
    expect(settingsKeyOf({ ...base, dailyGoal: 5 } as typeof base)).toBe(settingsKeyOf(base));
  });
});
