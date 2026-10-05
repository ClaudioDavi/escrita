// 0.8 task 2.5: the create sites call plugin.notes.create with their old policy,
// and the outline reads its rows through the book source.
import { describe, expect, it, vi } from "vitest";
import { TFile } from "./support/obsidian";
import { DarlingsModule } from "../src/darlings";
import { OutlineModule } from "../src/outline";
import { FolderBlockedError, NoteExistsError } from "../src/core/notes";
import { DEFAULT_SETTINGS } from "../src/settings";
import { loadRows } from "../src/outline/rows";

function file(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.name = path.slice(path.lastIndexOf("/") + 1);
  f.basename = f.name.replace(/\.md$/, "");
  return f;
}

describe("darlings ensureNote", () => {
  const run = (create: (...a: unknown[]) => unknown) => {
    const mod = new DarlingsModule({ notes: { create } } as never);
    return (mod as unknown as { ensureNote(p: string): Promise<TFile> }).ensureNote("Darlings/a.md");
  };

  it("finds or creates through notes.create, policy return", async () => {
    const f = file("Darlings/a.md");
    const create = vi.fn(async () => ({ file: f, outcome: "created" }));
    expect(await run(create)).toBe(f);
    expect(create).toHaveBeenCalledWith("Darlings/a.md", expect.any(String), { exists: "return" });
  });

  it("keeps its two messages", async () => {
    await expect(run(async () => { throw new NoteExistsError("Darlings/a.md", "Darlings/a.md", true); })).rejects.toThrow("darlings.error.notAFile");
    await expect(run(async () => { throw new FolderBlockedError("Darlings"); })).rejects.toThrow("darlings.error.notAFolder");
  });
});

describe("outline rowsPort", () => {
  it("reads through plugin.notes: an open editor gives no mtime seed", async () => {
    const ch = file("Book/Chapters/01 Abertura.md");
    const counts = vi.fn(async (..._a: unknown[]) => ({ words: 2, characters: 3, charactersNoSpaces: 3 }));
    const plugin = {
      app: {
        vault: { getAbstractFileByPath: (p: string) => (p === ch.path ? ch : null) },
        metadataCache: { getFileCache: () => ({ frontmatter: { status: "draft", compile: false } }), getFirstLinkpathDest: () => null },
      },
      books: { chapters: () => [{ file: ch, index: 1, number: 1, title: "Abertura" }], frontmatter: () => ({}) },
      notes: { editorView: () => ({}), text: () => ({ read: async () => "unsaved text" }) },
      measure: { counts },
      features: { isOn: () => false },
      settings: { ...DEFAULT_SETTINGS },
      names: { entryFor: () => null },
    };
    const mod = new OutlineModule(plugin as never);
    const rows = await loadRows(mod.rowsPort(), { note: ch } as never);
    expect(rows).toHaveLength(1);          // a left-out chapter still shows
    expect(rows[0].title).toBe("Abertura");
    expect(rows[0].label).toBe("01");
    expect(counts.mock.calls[0][1]).toBeUndefined();
  });
});
