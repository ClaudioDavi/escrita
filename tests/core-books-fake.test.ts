import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "obsidian";
import { BookService } from "../src/core/books";
import { DEFAULT_SETTINGS } from "../src/settings";

// A small fake of the Obsidian side: real TFile/TFolder stand-in classes (so the
// adapter's instanceof checks run), a root folder that answers isRoot(), a
// path map and a metadata cache.

type Folder = TFolder & { isRoot(): boolean };

function vault(paths: string[], fm: Record<string, Record<string, unknown>> = {}) {
  const map = new Map<string, TFile | Folder>();
  const root = Object.assign(new TFolder(), { path: "/", name: "", isRoot: () => true }) as Folder;
  map.set("/", root);
  const dir = (p: string): Folder => {
    const hit = map.get(p);
    if (hit) return hit as Folder;
    const f = Object.assign(new TFolder(), { path: p, name: p.slice(p.lastIndexOf("/") + 1), isRoot: () => false }) as Folder;
    map.set(p, f);
    const parent = dir(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "/");
    f.parent = parent;
    parent.children.push(f);
    return f;
  };
  for (const p of paths) {
    const name = p.slice(p.lastIndexOf("/") + 1);
    const file = Object.assign(new TFile(), { path: p, name, basename: name.replace(/\.[^.]+$/, ""), extension: name.split(".").pop()! });
    const parent = dir(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "/");
    file.parent = parent;
    parent.children.push(file);
    map.set(p, file);
  }
  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => map.get(p) ?? null,
      getAllLoadedFiles: () => [...map.values()],
    },
    metadataCache: { getFileCache: (f: TFile) => (fm[f.path] ? { frontmatter: fm[f.path] } : null) },
  };
  return { app, map };
}

const service = (v: ReturnType<typeof vault>, over: Partial<typeof DEFAULT_SETTINGS> = {}) =>
  new BookService(v.app as never, () => ({ ...DEFAULT_SETTINGS, chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", ...over }));

describe("BookService on a fake vault", () => {
  const v = vault([
    "Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Novels/Livro/Notes.md",
    "Contos/Conto.md", "Escrita/Exports/Livro.md", "Escrita/Submissions/Conto.md",
  ], { "Contos/Conto.md": { status: "draft" } });
  const s = service(v);

  it("classifies a file handle, a path string and null", () => {
    const chapter = v.map.get("Novels/Livro/Chapters/01.md") as TFile;
    expect(s.classify(chapter)).toMatchObject({ kind: "chapter", tracked: true });
    expect(s.classify("Novels/Livro.md")).toMatchObject({ kind: "book-note" });
    expect(s.classify("Contos/Conto.md")).toMatchObject({ kind: "note", stage: "draft" });
    expect(s.classify(null).kind).toBe("none");
    expect(s.classify("Nope.md").kind).toBe("none");
  });

  it("finds a path that needs normalizing, and treats the empty string as nothing", () => {
    expect(s.classify("/Contos//Conto.md").kind).toBe("note");
    expect(s.classify("").kind).toBe("none");
  });

  it("never reports the root folder as a folder lookup or a book", () => {
    expect(s.classify(v.map.get("/") as TFolder).kind).toBe("folder");
    expect(s.allBooks().map((b) => b.title)).toEqual(["Livro"]);
    expect(s.allBooks().every((b) => !(b.folder as Folder).isRoot())).toBe(true);
  });

  it("a folder is a folder, a file is a file (instanceof, not shape)", () => {
    expect(s.classify("Novels/Livro")).toMatchObject({ kind: "book-folder" });
    expect(s.classify("Novels/Livro/Chapters")).toMatchObject({ kind: "chapters-folder" });
    expect(s.classify("Contos").kind).toBe("folder");
  });

  it("keeps submissions and exports out of tracking, works and books", () => {
    expect(s.classify("Escrita/Exports/Livro.md")).toMatchObject({ kind: "note", export: true, tracked: false, stage: null, book: null });
    expect(s.classify("Escrita/Submissions/Conto.md")).toMatchObject({ kind: "note", submission: true, tracked: false, stage: null });
    expect(s.classify("Contos/Conto.md")).toMatchObject({ submission: false, export: false });
  });

  it("lists chapters in order from the chapters folder", () => {
    const book = s.allBooks()[0];
    expect(s.chapters(book).map((c) => c.file.path)).toEqual(["Novels/Livro/Chapters/01.md"]);
  });
});
