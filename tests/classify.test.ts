import { describe, it, expect } from "vitest";
import {
  ancestors, classify, DEFAULT_SNAPSHOTS_FOLDER, inBook, inFolder, inSnapshots, listBooks, lookupPath, placementPath,
  snapshotsFolderProblem, snapshotsRoot, type BookOf, type ClassifySettings, type Kind, type VaultTree,
} from "../src/core/classify";
import { readPiece, type Piece } from "../src/core/measure";
import { folderList } from "../src/core/lists";

// ---------------------------------------------------------------------------
// An in-memory vault. Handles keep their identity, like TFile/TFolder.

interface FakeFile { path: string; name: string; extension: string; parent: FakeDir }
interface FakeDir { path: string; name: string; parent: FakeDir | null; children: (FakeFile | FakeDir)[]; root: boolean }

class FakeTree implements VaultTree<FakeFile, FakeDir> {
  readonly root: FakeDir = { path: "/", name: "", parent: null, children: [], root: true };
  private files = new Map<string, FakeFile>();
  private dirs = new Map<string, FakeDir>();
  lookups = 0;

  /** `entries`: file paths, plus "dir/" for empty folders; parents are inferred. */
  constructor(entries: string[], private fm: Record<string, Record<string, unknown>> = {}) {
    for (const e of entries) {
      if (e.endsWith("/")) this.dir(e.slice(0, -1));
      else this.addFile(e);
    }
  }

  private dir(path: string): FakeDir {
    if (path === "") return this.root;
    const hit = this.dirs.get(path);
    if (hit) return hit;
    const i = path.lastIndexOf("/");
    const parent = this.dir(i < 0 ? "" : path.slice(0, i));
    const d: FakeDir = { path, name: path.slice(i + 1), parent, children: [], root: false };
    parent.children.push(d);
    this.dirs.set(path, d);
    return d;
  }

  /** Add a file to this same tree (parents inferred), like a create in the vault. */
  add(path: string): void { this.addFile(path); }

  /** Delete a file or a folder (with everything in it) from this same tree. */
  remove(path: string): void {
    const node = this.get(path);
    if (!node || node === this.root) return;
    const parent = node.parent!;
    parent.children = parent.children.filter((c) => c !== node);
    for (const k of [...this.files.keys()]) if (k === path || k.startsWith(`${path}/`)) this.files.delete(k);
    for (const k of [...this.dirs.keys()]) if (k === path || k.startsWith(`${path}/`)) this.dirs.delete(k);
  }

  private addFile(path: string): void {
    const i = path.lastIndexOf("/");
    const parent = this.dir(i < 0 ? "" : path.slice(0, i));
    const name = path.slice(i + 1);
    const dot = name.lastIndexOf(".");
    const f: FakeFile = { path, name, extension: dot > 0 ? name.slice(dot + 1) : "", parent };
    parent.children.push(f);
    this.files.set(path, f);
  }

  file(path: string): FakeFile | null { this.lookups++; return this.files.get(path) ?? null; }
  folder(path: string): FakeDir | null { this.lookups++; return this.dirs.get(path) ?? null; }
  folders(): Iterable<FakeDir> { return this.dirs.values(); }
  frontmatter(file: FakeFile): Record<string, unknown> | undefined { return this.fm[file.path]; }

  /** getAbstractFileByPath, for the oracle */
  get(path: string): FakeFile | FakeDir | null {
    if (path === "/") return this.root;
    return this.files.get(path) ?? this.dirs.get(path) ?? null;
  }
  allPaths(): string[] { return [...this.files.keys(), ...this.dirs.keys()]; }
  allFiles(): FakeFile[] { return [...this.files.values()]; }
}

const BASE: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit",
  snapshotsFolder: "Escrita/Snapshots",
};

const ENTRIES = [
  // a root-level book
  "A Casa.md", "A Casa/Chapters/01 Chegada.md",
  // a full book
  "Novels/Livro.md",
  "Novels/Livro/Chapters/01 Início.md", "Novels/Livro/Chapters/02 A porta.md",
  "Novels/Livro/Chapters/Old/draft.md", "Novels/Livro/Chapters/notes.txt",
  "Novels/Livro/Darlings.md", "Novels/Livro/Personagens/Teo.md",
  "Novels/Livro/board.canvas", "Novels/Livro/cover.png", "Novels/Livro/Chapters.md",
  "Novels/Livro/Capítulos/01 Um.md", "Novels/Livro/Drafts/Chapters/01 Um.md",
  // a book note placed inside the book's Chapters folder: its own book
  "Novels/Livro/Chapters/Sub.md", "Novels/Livro/Chapters/Sub/Chapters/01.md",
  // not books
  "Novels/Sem capitulos.md", "Novels/Sem capitulos/x.md",
  "Novels/Orfao/Chapters/01.md",
  "Chapters/x.md",
  // a nested book
  "Novels/Saga.md", "Novels/Saga/Chapters/01.md", "Novels/Saga/Notas.md",
  "Novels/Saga/Vol 2.md", "Novels/Saga/Vol 2/Chapters/01.md", "Novels/Saga/Vol 2/Extra.md",
  // standalone pieces and plain notes
  "Contos/Alvo.md", "Contos/Limite.md", "Contos/Prazo.md", "Contos/Nada.md", "Contos/Invalido.md", "Contos/foto.jpg",
  "Templates/Chapter.md", "Notes/x.MD", "Novels2/y.md", "Diários/Ação e reação.md", "Solta.md",
  "Vazio/",
];

const FM: Record<string, Record<string, unknown>> = {
  "Contos/Alvo.md": { target: 3000 },
  "Contos/Limite.md": { limite: 15000, unidade: "caracteres", limit: "15.000", unit: "characters" },
  "Contos/Prazo.md": { deadline: "2026-12-01" },
  "Contos/Nada.md": { tags: ["x"] },
  "Contos/Invalido.md": { target: "abc" },
  "Novels/Livro/Chapters/01 Início.md": { target: 4000, status: "draft" },
  "Novels/Livro.md": { goal: 80000, deadline: "2027-01-01" },
  "Notes/x.MD": { target: 100 },
};

const tree = new FakeTree(ENTRIES, FM);
const at = (path: string | null, s: Partial<ClassifySettings> = {}) => classify(tree, { ...BASE, ...s }, path);
const bookOf = (path: string | null, s: Partial<ClassifySettings> = {}) => at(path, s).book?.note.path ?? null;

// ---------------------------------------------------------------------------

describe("classify: kind table", () => {
  const rows: [string | null, Kind, boolean, string | null][] = [
    // path, kind, markdown, book note
    ["A Casa.md", "book-note", true, "A Casa.md"],
    ["A Casa", "book-folder", false, "A Casa.md"],
    ["A Casa/Chapters", "chapters-folder", false, "A Casa.md"],
    ["A Casa/Chapters/01 Chegada.md", "chapter", true, "A Casa.md"],
    ["Novels/Livro.md", "book-note", true, "Novels/Livro.md"],
    ["Novels/Livro", "book-folder", false, "Novels/Livro.md"],
    ["Novels/Livro/Chapters", "chapters-folder", false, "Novels/Livro.md"],
    ["Novels/Livro/Chapters/01 Início.md", "chapter", true, "Novels/Livro.md"],
    ["Novels/Livro/Chapters/Old", "folder", false, "Novels/Livro.md"],
    ["Novels/Livro/Chapters/Old/draft.md", "book-file", true, "Novels/Livro.md"],
    ["Novels/Livro/Chapters/notes.txt", "book-file", false, "Novels/Livro.md"],
    ["Novels/Livro/Darlings.md", "book-file", true, "Novels/Livro.md"],
    ["Novels/Livro/Personagens", "folder", false, "Novels/Livro.md"],
    ["Novels/Livro/Personagens/Teo.md", "book-file", true, "Novels/Livro.md"],
    ["Novels/Livro/board.canvas", "book-file", false, "Novels/Livro.md"],
    ["Novels/Livro/cover.png", "book-file", false, "Novels/Livro.md"],
    ["Novels/Livro/Chapters.md", "book-file", true, "Novels/Livro.md"],
    ["Novels/Livro/Chapters/Sub.md", "book-note", true, "Novels/Livro/Chapters/Sub.md"],
    ["Novels/Livro/Chapters/Sub", "book-folder", false, "Novels/Livro/Chapters/Sub.md"],
    ["Novels/Livro/Chapters/Sub/Chapters/01.md", "chapter", true, "Novels/Livro/Chapters/Sub.md"],
    ["Novels/Sem capitulos.md", "note", true, null],
    ["Novels/Sem capitulos", "folder", false, null],
    ["Novels/Sem capitulos/x.md", "note", true, null],
    ["Novels/Orfao/Chapters/01.md", "note", true, null],
    ["Novels/Orfao/Chapters", "folder", false, null],
    ["Chapters/x.md", "note", true, null],
    ["Novels/Saga/Chapters/01.md", "chapter", true, "Novels/Saga.md"],
    ["Novels/Saga/Chapters", "chapters-folder", false, "Novels/Saga.md"],
    ["Novels/Saga/Vol 2/Chapters", "chapters-folder", false, "Novels/Saga/Vol 2.md"],
    ["Novels/Livro/Chapters/Sub/Chapters", "chapters-folder", false, "Novels/Livro/Chapters/Sub.md"],
    ["Novels/Saga/Notas.md", "book-file", true, "Novels/Saga.md"],
    ["Novels/Saga/Vol 2.md", "book-note", true, "Novels/Saga/Vol 2.md"],
    ["Novels/Saga/Vol 2", "book-folder", false, "Novels/Saga/Vol 2.md"],
    ["Novels/Saga/Vol 2/Chapters/01.md", "chapter", true, "Novels/Saga/Vol 2.md"],
    ["Novels/Saga/Vol 2/Extra.md", "book-file", true, "Novels/Saga/Vol 2.md"],
    ["Contos/Alvo.md", "note", true, null],
    ["Contos/foto.jpg", "file", false, null],
    ["Notes/x.MD", "file", false, null],
    ["Diários/Ação e reação.md", "note", true, null],
    ["Solta.md", "note", true, null],
    ["Novels", "folder", false, null],
    ["Vazio", "folder", false, null],
    ["/", "folder", false, null],
    [null, "none", false, null],
    ["", "none", false, null],
    ["Novels/Livro/Chapters/99 Apagado.md", "none", false, null],
    ["Novels/Livro/Apagada", "none", false, null],
  ];
  it.each(rows)("%s → %s", (path, kind, markdown, book) => {
    const p = at(path);
    expect(p.kind).toBe(kind);
    expect(p.markdown).toBe(markdown);
    expect(p.book?.note.path ?? null).toBe(book);
    expect(p.path).toBe(path ?? "");
  });

  it("the book carries the live handles and the note's basename as title", () => {
    const b = at("Novels/Livro/Chapters/01 Início.md").book as BookOf<FakeFile, FakeDir>;
    expect(b.note).toBe(tree.get("Novels/Livro.md"));
    expect(b.folder).toBe(tree.get("Novels/Livro"));
    expect(b.chaptersFolder).toBe(tree.get("Novels/Livro/Chapters"));
    expect(b.title).toBe("Livro");
    expect(at("Novels/Saga/Vol 2").book?.title).toBe("Vol 2");
  });
});

describe("classify: book rules (today's bookFor/isChapter)", () => {
  it("the innermost book owns a path", () => {
    expect(bookOf("Novels/Saga/Vol 2/Chapters/01.md")).toBe("Novels/Saga/Vol 2.md");
    expect(bookOf("Novels/Saga/Vol 2/Extra.md")).toBe("Novels/Saga/Vol 2.md");
    // the inner book's note and folder are its own, not the outer book's files
    expect(at("Novels/Saga/Vol 2.md").kind).toBe("book-note");
  });

  it("a book note inside a Chapters folder is its own book's note, never a chapter", () => {
    const p = at("Novels/Livro/Chapters/Sub.md");
    expect(p.kind).toBe("book-note");
    expect(p.book?.title).toBe("Sub");
  });

  it("follows the chapters folder setting", () => {
    expect(at("Novels/Livro/Capítulos/01 Um.md", { chaptersFolder: "Capítulos" }).kind).toBe("chapter");
    expect(at("Novels/Livro/Chapters/01 Início.md", { chaptersFolder: "Capítulos" }).kind).toBe("book-file");
    expect(at("Novels/Livro/Capítulos", { chaptersFolder: "Capítulos" }).kind).toBe("chapters-folder");
    expect(at("A Casa.md", { chaptersFolder: "Capítulos" }).kind).toBe("note");
    const nested = { chaptersFolder: "Drafts/Chapters" };
    expect(at("Novels/Livro/Drafts/Chapters/01 Um.md", nested).kind).toBe("chapter");
    expect(at("Novels/Livro/Drafts/Chapters", nested).kind).toBe("chapters-folder");
    expect(at("Novels/Livro/Drafts", nested)).toMatchObject({ kind: "folder", book: { title: "Livro" } });
    for (const cf of ["Chapters/", "/Chapters", "Chapters//", "/Drafts//Chapters/"]) {
      const want = cf.includes("Drafts") ? "Novels/Livro/Drafts/Chapters/01 Um.md" : "Novels/Livro/Chapters/01 Início.md";
      expect(at(want, { chaptersFolder: cf }).kind).toBe("chapter");
    }
  });

  it("an empty chapters folder setting makes the book folder its own chapters folder (as normalizePath did)", () => {
    const p = at("Novels/Livro/Darlings.md", { chaptersFolder: "" });
    expect(p.kind).toBe("chapter");
    expect(p.book?.chaptersFolder).toBe(tree.get("Novels/Livro"));
    expect(at("Novels/Livro", { chaptersFolder: "" }).kind).toBe("book-folder");
  });

  it("the chapter test compares against the handle, so a book found through Capítulos matches its own folder", () => {
    const pt = new FakeTree(["Livro.md", "Livro/Capítulos/01.md"]);
    expect(classify(pt, { ...BASE, chaptersFolder: "Capítulos" }, "Livro/Capítulos/01.md").kind).toBe("chapter");
  });
});

describe("classify: tracked", () => {
  const tr = (path: string, s: Partial<ClassifySettings> = {}) => at(path, s).tracked;
  const pt = new FakeTree([
    "Notes/x.md", "Notes/x.canvas", "Notes/x.MD", "Novels/A/Chapters/01 A.md", "Templates/Chapter.md",
    "Novels/Templates/x.md", "Novels/x.md", "Tpl/Chapter.md", "Tpl/Chapter 2.md", "Novels2/x.md",
  ]);
  const ptr = (path: string, s: Partial<ClassifySettings> = {}) => classify(pt, { ...BASE, ...s }, path).tracked;

  it("keeps the goals rules (ported from isTrackedPath)", () => {
    expect(ptr("Notes/x.md")).toBe(true);
    expect(ptr("Notes/x.canvas")).toBe(false);
    expect(ptr("Notes/x.MD")).toBe(false); // B3: exact ".md", as goals.tracked already required
    expect(ptr("Notes/x.md", { trackFolders: "Novels" })).toBe(false);
    expect(ptr("Novels/A/Chapters/01 A.md", { trackFolders: "Fiction\nNovels" })).toBe(true);
    expect(ptr("Novels/A/Chapters/01 A.md", { trackFolders: "Fiction, /Novels/" })).toBe(true);
    expect(ptr("Templates/Chapter.md", { excludeFolders: "Templates" })).toBe(false);
    expect(ptr("Novels/Templates/x.md", { trackFolders: "Novels", excludeFolders: "Novels/Templates" })).toBe(false);
    expect(ptr("Novels/x.md", { excludeFolders: "\n , /" })).toBe(true);
    expect(ptr("Novels2/x.md", { trackFolders: "Novels" })).toBe(false);
    expect(ptr("Tpl/Chapter.md", { chapterTemplate: "Tpl/Chapter.md" })).toBe(false);
    expect(ptr("Tpl/Chapter.md", { chapterTemplate: "Tpl/Chapter" })).toBe(false);
    expect(ptr("Tpl/Chapter.md", { chapterTemplate: " /Tpl/Chapter " })).toBe(false);
    expect(ptr("Tpl/Chapter.md", { chapterTemplate: "Tpl/Chapter.MD" })).toBe(true); // the template keeps its own /i rule
    expect(ptr("Tpl/Chapter 2.md", { chapterTemplate: "Tpl/Chapter" })).toBe(true);
  });

  it("is independent of kind: an excluded chapter is still a chapter", () => {
    const p = at("Novels/Livro/Chapters/01 Início.md", { excludeFolders: "Novels/Livro" });
    expect(p.kind).toBe("chapter");
    expect(p.tracked).toBe(false);
  });

  it("folders, non-md files and missing paths are never tracked", () => {
    expect(tr("Novels/Livro")).toBe(false);
    expect(tr("/")).toBe(false);
    expect(tr("Novels/Livro/board.canvas")).toBe(false);
    expect(tr("Gone.md")).toBe(false);
  });

  it("tracked-folder matching is case-sensitive", () => {
    expect(tr("Contos/Alvo.md", { trackFolders: "contos" })).toBe(false);
  });
});

describe("classify: piece", () => {
  it("reads the piece of any markdown file, with the configured property names", () => {
    expect(at("Contos/Alvo.md").piece).toEqual({ unit: "words", target: 3000 });
    expect(at("Contos/Limite.md").piece).toEqual({ unit: "characters", limit: 15000 });
    expect(at("Contos/Limite.md", { limitProperty: "limite", unitProperty: "unidade" }).piece)
      .toEqual({ unit: "characters", limit: 15000 });
    expect(at("Contos/Prazo.md").piece).toEqual({ unit: "words", deadline: "2026-12-01" });
    expect(at("Contos/Nada.md").piece).toBeNull();
    expect(at("Contos/Invalido.md").piece).toBeNull();
    expect(at("Solta.md").piece).toBeNull(); // no frontmatter yet
  });

  it("a standalone piece is a note with a piece; a chapter can carry one too", () => {
    const conto = at("Contos/Alvo.md");
    expect(conto.kind === "note" && conto.piece !== null).toBe(true);
    const ch = at("Novels/Livro/Chapters/01 Início.md");
    expect(ch.kind).toBe("chapter");
    expect(ch.book?.title).toBe("Livro");
    expect(ch.piece).toEqual({ unit: "words", target: 4000 });
  });

  it("folders and non-md files never read frontmatter", () => {
    expect(at("Notes/x.MD").piece).toBeNull();
    let reads = 0;
    const counting: VaultTree<FakeFile, FakeDir> = {
      file: (p) => tree.file(p), folder: (p) => tree.folder(p), folders: () => tree.folders(),
      frontmatter: (f) => { reads++; return tree.frontmatter(f); },
    };
    classify(counting, BASE, "Novels/Livro");
    classify(counting, BASE, "Novels/Livro/board.canvas");
    listBooks(counting, BASE);
    expect(reads).toBe(0);
  });
});

describe("listBooks", () => {
  it("lists every book by the classify rule, sorted by title", () => {
    expect(listBooks(tree, BASE).map((b) => b.note.path)).toEqual([
      "A Casa.md", "Novels/Livro.md", "Novels/Saga.md", "Novels/Livro/Chapters/Sub.md", "Novels/Saga/Vol 2.md",
    ]);
  });

  it("B1: finds books with a nested or slashed chapters folder", () => {
    expect(listBooks(tree, { ...BASE, chaptersFolder: "Drafts/Chapters" }).map((b) => b.title)).toEqual(["Livro"]);
    expect(listBooks(tree, { ...BASE, chaptersFolder: "Chapters/" }).map((b) => b.title))
      .toEqual(["A Casa", "Livro", "Saga", "Sub", "Vol 2"]);
    expect(listBooks(tree, { ...BASE, chaptersFolder: "Capítulos" }).map((b) => b.title)).toEqual(["Livro"]);
  });

  it("returns the same handles as classify", () => {
    const b = listBooks(tree, BASE).find((x) => x.title === "Livro");
    expect(b?.note).toBe(at("Novels/Livro/Darlings.md").book?.note);
    expect(b?.chaptersFolder).toBe(tree.get("Novels/Livro/Chapters"));
  });
});

describe("inFolder (the one copy)", () => {
  it("matches the folder itself and what is inside it only", () => {
    expect(inFolder("Novels/A.md", "Novels")).toBe(true);
    expect(inFolder("Novels/A/B.md", "Novels/")).toBe(true);
    expect(inFolder("Novels2/A.md", "Novels")).toBe(false);
    expect(inFolder("A.md", "")).toBe(true);
    expect(inFolder("Templates/a.md", "Templates")).toBe(true);
    expect(inFolder("Templates", "Templates")).toBe(true);
    expect(inFolder("Templates2/a.md", "Templates")).toBe(false);
    expect(inFolder("x/Templates/a.md", "Templates")).toBe(false);
    expect(inFolder("Templates/a.md", "/Templates/")).toBe(true);
    expect(inFolder("templates/a.md", "Templates")).toBe(false);
    expect(inFolder("anything", "/")).toBe(true);
  });
});

describe("inBook (containment, not ownership)", () => {
  const livro = at("Novels/Livro.md").book!;
  const saga = at("Novels/Saga.md").book!;
  it("holds the note, the folder and anything under it, existing or not", () => {
    expect(inBook("Novels/Livro.md", livro)).toBe(true);
    expect(inBook("Novels/Livro", livro)).toBe(true); // B2
    expect(inBook("Novels/Livro/Chapters/99 Apagado.md", livro)).toBe(true);
    expect(inBook("Novels/Livro2/x.md", livro)).toBe(false);
    expect(inBook("Novels/Livro2.md", livro)).toBe(false);
    expect(inBook("Novels/Saga.md", livro)).toBe(false);
  });
  it("a nested book's files are inside the outer book, but owned by the inner one", () => {
    expect(inBook("Novels/Saga/Vol 2/Chapters/01.md", saga)).toBe(true);
    expect(bookOf("Novels/Saga/Vol 2/Chapters/01.md")).toBe("Novels/Saga/Vol 2.md");
  });
});

// ---------------------------------------------------------------------------
// Parity with the code classify replaced, transliterated over the fake tree.

const normalize = (p: string) => p.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "") || "/";

const legacy = {
  bookFromFolder(t: FakeTree, s: ClassifySettings, folder: FakeDir | null) {
    if (!folder || folder.root) return null;
    const note = t.get(normalize(`${folder.path}.md`));
    const ch = t.get(normalize(`${folder.path}/${s.chaptersFolder}`));
    if (note && "extension" in note && ch && "children" in ch && !ch.root) {
      return { note, folder, chaptersFolder: ch, title: note.name.replace(/\.[^.]*$/, "") };
    }
    return null;
  },
  bookFor(t: FakeTree, s: ClassifySettings, file: FakeFile | null) {
    if (!file) return null;
    if (file.extension === "md") {
      const folder = t.get(file.path.replace(/\.md$/, ""));
      if (folder && "children" in folder) {
        const b = legacy.bookFromFolder(t, s, folder);
        if (b) return b;
      }
    }
    let f: FakeDir | null = file.parent;
    while (f && !f.root) {
      const b = legacy.bookFromFolder(t, s, f);
      if (b) return b;
      f = f.parent;
    }
    return null;
  },
  isChapter(t: FakeTree, s: ClassifySettings, file: FakeFile | null) {
    if (!file || file.extension !== "md") return false;
    const b = legacy.bookFor(t, s, file);
    return !!b && file.parent?.path === b.chaptersFolder.path;
  },
  allBooks(t: FakeTree, s: ClassifySettings) {
    const out = [];
    for (const f of t.folders()) {
      if (f.name === s.chaptersFolder && f.parent) {
        const b = legacy.bookFromFolder(t, s, f.parent);
        if (b) out.push(b);
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  },
  isTrackedPath(path: string, track: string[], exclude: string[], template = "") {
    const inF = (p: string, folder: string) => {
      const f = folder.replace(/^\/+|\/+$/g, "");
      if (!f) return true;
      return p === f || p.startsWith(f + "/");
    };
    if (!/\.md$/i.test(path)) return false;
    if (track.length > 0 && !track.some((f) => inF(path, f))) return false;
    if (exclude.some((f) => f.replace(/^\/+|\/+$/g, "") && inF(path, f))) return false;
    const tpl = template.trim().replace(/^\/+/, "");
    if (tpl) {
      const withExt = /\.md$/i.test(tpl) ? tpl : `${tpl}.md`;
      if (path === withExt) return false;
    }
    return true;
  },
  tracked(file: FakeFile | null, s: ClassifySettings) {
    if (!file || file.extension !== "md") return false;
    return legacy.isTrackedPath(file.path, folderList(s.trackFolders), folderList(s.excludeFolders), s.chapterTemplate);
  },
  pieceOf(t: FakeTree, s: ClassifySettings, file: FakeFile | null): Piece | null {
    if (!file || file.extension !== "md") return null;
    return readPiece(t.frontmatter(file), s);
  },
  /** outline view's valid() lambda */
  valid(t: FakeTree, s: ClassifySettings, mode: "book" | "note", path: string) {
    const f = t.get(path);
    if (!f || !("extension" in f) || f.extension !== "md") return false;
    const b = legacy.bookFor(t, s, f);
    return mode === "book" ? b?.note.path === path : !b;
  },
};

const MATRIX: ClassifySettings[] = [];
for (const chaptersFolder of ["Chapters", "Capítulos", "Drafts/Chapters", "Chapters/", ""]) {
  for (const trackFolders of ["", "Novels", "Novels\nContos"]) {
    for (const excludeFolders of ["", "Templates", "Novels/Saga"]) {
      for (const chapterTemplate of ["", "Templates/Chapter", "Novels/Livro/Chapters/Tpl.md"]) {
        MATRIX.push({ ...BASE, chaptersFolder, trackFolders, excludeFolders, chapterTemplate });
      }
    }
  }
}
const PATHS = [...tree.allPaths(), "/", "", "Gone.md", "Novels/Livro/Chapters/99 Apagado.md"];

describe("parity with the replaced code", () => {
  it("book, chapter, tracked, piece and the outline's valid() agree on every path × settings", () => {
    for (const s of MATRIX) {
      for (const path of PATHS) {
        const p = classify(tree, s, path);
        const node = tree.get(path);
        const file = node && "extension" in node ? node : null;
        if (!file) continue;
        const ob = legacy.bookFor(tree, s, file);
        const ctx = `${path} @ ${JSON.stringify(s)}`;
        expect(p.book?.note ?? null, ctx).toBe(ob?.note ?? null);
        expect(p.book?.folder ?? null, ctx).toBe(ob?.folder ?? null);
        expect(p.book?.chaptersFolder ?? null, ctx).toBe(ob?.chaptersFolder ?? null);
        expect(p.book?.title ?? null, ctx).toBe(ob?.title ?? null);
        expect(p.kind === "chapter", ctx).toBe(legacy.isChapter(tree, s, file));
        expect(p.tracked, ctx).toBe(legacy.tracked(file, s));
        expect(p.piece, ctx).toEqual(legacy.pieceOf(tree, s, file));
        expect(p.kind === "note" && p.piece !== null, ctx).toBe(!ob && legacy.pieceOf(tree, s, file) !== null);
        expect(p.kind === "book-note", ctx).toBe(legacy.valid(tree, s, "book", path));
        expect(p.kind === "note", ctx).toBe(legacy.valid(tree, s, "note", path));
      }
    }
  });

  it("listBooks equals the old allBooks for non-empty single-segment chapters folders", () => {
    // the old allBooks never matched "" (B1)
    for (const s of MATRIX.filter((x) => x.chaptersFolder !== "" && !x.chaptersFolder.includes("/"))) {
      expect(listBooks(tree, s).map((b) => b.note)).toEqual(legacy.allBooks(tree, s).map((b) => b.note));
    }
  });

  it("B1: the old allBooks missed books the old bookFor found", () => {
    for (const cf of ["Drafts/Chapters", "Chapters/"]) {
      const s = { ...BASE, chaptersFolder: cf };
      expect(legacy.allBooks(tree, s)).toEqual([]);
      expect(listBooks(tree, s).length).toBeGreaterThan(0);
    }
  });
});

describe("invariants", () => {
  it("hold for every path × settings", () => {
    const bookKinds: Kind[] = ["chapter", "book-note", "book-file", "book-folder", "chapters-folder"];
    for (const s of MATRIX) {
      const books = listBooks(tree, s);
      const bookFolders: string[] = [];
      for (const path of PATHS) {
        const p = classify(tree, s, path);
        const ctx = `${path} @ ${s.chaptersFolder}`;
        if (bookKinds.includes(p.kind)) expect(p.book, ctx).not.toBeNull();
        if (p.kind === "note" || p.kind === "file" || p.kind === "none") expect(p.book, ctx).toBeNull();
        if (p.tracked) expect(p.markdown, ctx).toBe(true);
        if (p.markdown) expect(["chapter", "book-note", "book-file", "note"], ctx).toContain(p.kind);
        if (p.kind === "none") expect(p).toMatchObject({ markdown: false, book: null, tracked: false, piece: null });
        // chapter ⇔ a markdown file directly in its book's chapters folder (what chapters(book) lists)
        const node = tree.get(path);
        if (p.book && node && "extension" in node) {
          const inChapters = p.book.chaptersFolder.children.includes(node) && node.extension === "md";
          expect(p.kind === "chapter", ctx).toBe(inChapters);
        }
        if (p.kind === "book-folder") {
          expect(p.book!.folder).toBe(node);
          bookFolders.push(path);
        }
        if (node && "children" in node && !node.root) {
          // chapters-folder ⇔ the owning book's chapters folder (and not the book folder itself)
          expect(p.kind === "chapters-folder", ctx).toBe(p.book?.chaptersFolder === node && p.book.folder !== node);
          if (p.kind === "folder" || p.kind === "chapters-folder") {
            // the book of a plain folder is the innermost proper ancestor book
            let want = null;
            for (let f = node.parent; f && !f.root && !want; f = f.parent) want = legacy.bookFromFolder(tree, s, f);
            expect(p.book?.note ?? null, ctx).toBe(want?.note ?? null);
          }
        }
      }
      expect(books.map((b) => b.folder.path).sort()).toEqual(bookFolders.sort());
    }
  });

  it("never throws, whatever the path or settings", () => {
    const garbage = [
      {}, { chaptersFolder: null }, { chaptersFolder: 3, trackFolders: undefined, excludeFolders: {}, chapterTemplate: [] },
      { targetProperty: undefined, limitProperty: null },
    ] as unknown as ClassifySettings[];
    const paths = [...PATHS, "//", "a//b", "../x.md", ".md", "Novels/", "\u0000", " "];
    for (const g of garbage) {
      for (const path of paths) expect(() => classify(tree, g, path)).not.toThrow();
      expect(() => listBooks(tree, g)).not.toThrow();
    }
    const broken: VaultTree<FakeFile, FakeDir> = {
      file: () => { throw new Error("x"); }, folder: () => { throw new Error("x"); },
      folders: () => { throw new Error("x"); }, frontmatter: () => { throw new Error("x"); },
    };
    expect(classify(broken, BASE, "a.md").kind).toBe("none");
    expect(listBooks(broken, BASE)).toEqual([]);
    const badFm = new FakeTree(["a.md"]);
    badFm.frontmatter = () => { throw new Error("x"); };
    expect(classify(badFm, BASE, "a.md")).toMatchObject({ kind: "note", piece: null });
  });

  it("reads the live tree: the same tree, changed between calls, answers anew", () => {
    const t = new FakeTree(["Livro.md", "Livro/Chapters/01.md"]);
    const s = { ...BASE };
    expect(classify(t, s, "Livro/Chapters/01.md").kind).toBe("chapter");
    t.remove("Livro.md");
    expect(classify(t, s, "Livro/Chapters/01.md").kind).toBe("note");
    t.add("Livro.md");
    expect(classify(t, s, "Livro/Chapters/01.md").kind).toBe("chapter");
    expect(classify(t, s, "Livro/Chapters/02.md").kind).toBe("none");
    t.add("Livro/Chapters/02.md");
    expect(classify(t, s, "Livro/Chapters/02.md").kind).toBe("chapter");
    s.chaptersFolder = "Capítulos"; // the same settings object, mutated
    expect(classify(t, s, "Livro/Chapters/02.md").kind).toBe("note");
  });

  it("reads the live tree: no cache across calls", () => {
    const t = new FakeTree(["Livro.md", "Livro/Chapters/01.md"]);
    expect(classify(t, BASE, "Livro/Chapters/01.md").kind).toBe("chapter");
    const t2 = new FakeTree(["Livro/Chapters/01.md"]);
    expect(classify(t2, BASE, "Livro/Chapters/01.md").kind).toBe("note");
    expect(classify(t, { ...BASE, chaptersFolder: "Capítulos" }, "Livro/Chapters/01.md").kind).toBe("note");
  });

  it("costs at most a few lookups per ancestor", () => {
    const deep = "a/b/c/d/e/f/g/h.md";
    const t = new FakeTree([deep]);
    classify(t, BASE, deep);
    expect(t.lookups).toBeLessThanOrEqual(3 * 8 + 2);
  });
});

// ---------------------------------------------------------------------------
// The adapter's pure pieces (core/books.ts wires them to the vault).

/** Obsidian's normalizePath: odd spaces to " ", slashes collapsed and trimmed, NFC; "" → "/". */
const obsidianNormalize = (p: string) =>
  (p.replace(/[\u00A0\u202F]/g, " ").replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "") || "/").normalize("NFC");

describe("adapter: lookupPath", () => {
  it("finds a live file whose own path normalizing would change (U+00A0, NFD)", () => {
    const nbsp = "Novels/Livro/Chapters/01\u00A0Chegada.md";
    const nfd = "Contos/Ac\u0327a\u0303o.md";
    const t = new FakeTree(["Novels/Livro.md", nbsp, nfd, "Contos/O farol.md"]);
    const get = lookupPath((p) => t.get(p), obsidianNormalize);
    const adapted: VaultTree<FakeFile, FakeDir> = {
      file: (p) => { const f = get(p); return f && "extension" in f ? f : null; },
      folder: (p) => { const f = get(p); return f && "children" in f && !f.root ? f : null; },
      folders: () => t.folders(),
      frontmatter: () => undefined,
    };
    expect(classify(adapted, BASE, nbsp)).toMatchObject({ kind: "chapter", tracked: true, book: { title: "Livro" } });
    expect(classify(adapted, BASE, nfd)).toMatchObject({ kind: "note", tracked: true });
    // the normalized form is still a fallback: a joined or typed path with a doubled slash
    expect(get("Contos//O farol.md")).toBe(t.get("Contos/O farol.md"));
    // normalizing only, as the adapter did before this fix, misses them
    const normOnly = (p: string) => t.get(obsidianNormalize(p));
    expect(normOnly(nbsp)).toBeNull();
    expect(normOnly(nfd)).toBeNull();
  });

  it("returns null when neither form exists, without a second lookup of the same path", () => {
    const seen: string[] = [];
    const get = lookupPath((p) => { seen.push(p); return null; }, obsidianNormalize);
    expect(get("a/b.md")).toBeNull();
    expect(seen).toEqual(["a/b.md"]);
  });
});

describe("adapter: placementPath", () => {
  const exists = (p: string) => tree.get(p) !== null;
  const pp = (x: Parameters<typeof placementPath>[0]) => placementPath(x, obsidianNormalize, exists);
  it("keeps a handle's own path, null and \"\"", () => {
    expect(pp({ path: "Novels/Livro/Chapters/01\u00A0x.md" })).toBe("Novels/Livro/Chapters/01\u00A0x.md");
    expect(pp(null)).toBeNull();
    expect(pp(undefined)).toBeNull();
    expect(pp("")).toBe(""); // not "/", the root
    expect(classify(tree, BASE, pp(""))).toMatchObject({ kind: "none" });
  });
  it("uses an existing string as is, else normalizes it", () => {
    expect(pp("Novels/Livro.md")).toBe("Novels/Livro.md");
    expect(pp("a//b")).toBe("a/b");
    expect(pp("/Novels/Livro/")).toBe("Novels/Livro");
    expect(pp("/")).toBe("/");
    expect(classify(tree, BASE, pp("/"))).toMatchObject({ kind: "folder" });
    expect(classify(tree, BASE, pp("Novels//Livro.md"))).toMatchObject({ kind: "book-note" });
  });
});

// ---------------------------------------------------------------------------
// Snapshots: one folder per note (the note path, .md included) of .txt files.

describe("snapshotsRoot", () => {
  it("trims, collapses and strips slashes", () => {
    expect(snapshotsRoot("Escrita/Snapshots")).toBe("Escrita/Snapshots");
    expect(snapshotsRoot("  /Arquivo//Instantâneos/ ")).toBe("Arquivo/Instantâneos");
    expect(snapshotsRoot("Arquivo\\Snaps")).toBe("Arquivo/Snaps");
    expect(snapshotsRoot(".escrita/snapshots")).toBe(".escrita/snapshots");
  });
  it("never means the whole vault: empty or not a string gives the default", () => {
    for (const v of ["", "   ", "/", "//", null, undefined, 3]) expect(snapshotsRoot(v)).toBe(DEFAULT_SNAPSHOTS_FOLDER);
    expect(DEFAULT_SNAPSHOTS_FOLDER).toBe("Escrita/Snapshots");
  });
  it("inSnapshots matches the folder and what is inside it only", () => {
    const s = { snapshotsFolder: "/Escrita/Snapshots/" };
    expect(inSnapshots("Escrita/Snapshots", s)).toBe(true);
    expect(inSnapshots("Escrita/Snapshots/Novels/Livro.md/2026-09-30 1200.txt", s)).toBe(true);
    expect(inSnapshots("Escrita/Snapshots2/x.md", s)).toBe(false);
    expect(inSnapshots("Escrita/x.md", s)).toBe(false);
    expect(inSnapshots("x.md", { snapshotsFolder: "" })).toBe(false);
  });
});

describe("ancestors", () => {
  it("lists containing folders, nearest first, never the root", () => {
    expect(ancestors("A/B/c.md")).toEqual(["A/B", "A"]);
    expect(ancestors("A/B")).toEqual(["A"]);
    expect(ancestors("c.md")).toEqual([]);
    expect(ancestors("")).toEqual([]);
  });
});

describe("classify: the snapshots folder", () => {
  const snaps = new FakeTree([
    "Novels/Livro.md", "Novels/Livro/Chapters/01.md",
    "Escrita/Snapshots/Novels/Livro.md/2026-09-30 1200.txt",
    "Escrita/Snapshots/Novels/Livro.md/index.json",
    "Escrita/Snapshots/Stray.md",
    // a snapshot dir X.md beside a stray X.md.md with a Chapters folder must never form a book
    "Escrita/Snapshots/Contos/A.md.md", "Escrita/Snapshots/Contos/A.md/Chapters/x.txt",
    // a snapshots folder placed inside a book
    "Novels/Livro/Snaps/Novels/Livro/Chapters/01.md/2026-09-30 1200.txt",
    "Novels/Livro/Snaps/Novels/Livro/Chapters/01.md/old.md",
  ], { "Escrita/Snapshots/Stray.md": { target: 100 } });
  const c = (path: string, s: Partial<ClassifySettings> = {}) => classify(snaps, { ...BASE, ...s }, path);

  it("flags files and folders there, and never tracks them", () => {
    const txt = c("Escrita/Snapshots/Novels/Livro.md/2026-09-30 1200.txt");
    expect(txt).toMatchObject({ kind: "file", snapshot: true, tracked: false, book: null, piece: null, markdown: false });
    expect(c("Escrita/Snapshots/Stray.md")).toMatchObject({ kind: "note", snapshot: true, tracked: false, piece: null, markdown: true });
    expect(c("Escrita/Snapshots/Novels/Livro.md")).toMatchObject({ kind: "folder", snapshot: true, book: null });
    expect(c("Escrita/Snapshots")).toMatchObject({ kind: "folder", snapshot: true });
  });

  it("leaves everything else alone", () => {
    expect(c("Novels/Livro.md")).toMatchObject({ kind: "book-note", snapshot: false, tracked: true });
    expect(c("Novels/Livro/Chapters/01.md")).toMatchObject({ kind: "chapter", snapshot: false });
    expect(c("Escrita")).toMatchObject({ kind: "folder", snapshot: false });
    expect(c("nothing/here.md")).toMatchObject({ kind: "none", snapshot: false });
    expect(classify(snaps, BASE, null).snapshot).toBe(false);
  });

  it("wins over books: a snapshots folder inside a book yields no chapters or book files", () => {
    const s = { snapshotsFolder: "Novels/Livro/Snaps" };
    expect(c("Novels/Livro/Snaps/Novels/Livro/Chapters/01.md/old.md", s))
      .toMatchObject({ kind: "note", book: null, tracked: false, snapshot: true });
    expect(c("Novels/Livro/Snaps", s)).toMatchObject({ kind: "folder", book: null, snapshot: true });
    // without that setting the same file is an ordinary book file
    expect(c("Novels/Livro/Snaps/Novels/Livro/Chapters/01.md/old.md"))
      .toMatchObject({ kind: "book-file", snapshot: false, tracked: true });
  });

  it("the default applies when the setting is empty", () => {
    expect(c("Escrita/Snapshots/Stray.md", { snapshotsFolder: "" }).snapshot).toBe(true);
  });

  it("listBooks skips folders inside the snapshots folder", () => {
    expect(listBooks(snaps, BASE).map((b) => b.note.path)).toEqual(["Novels/Livro.md"]);
    expect(listBooks(snaps, { ...BASE, snapshotsFolder: "Elsewhere" }).map((b) => b.note.path))
      .toEqual(["Escrita/Snapshots/Contos/A.md.md", "Novels/Livro.md"]);
  });
});

describe("snapshotsFolderProblem", () => {
  const none = () => false;
  it("accepts a plain or hidden folder", () => {
    expect(snapshotsFolderProblem("Escrita/Snapshots", ".obsidian", "", none)).toBeNull();
    expect(snapshotsFolderProblem(".escrita/snapshots", ".obsidian", "Novels", none)).toBeNull();
    expect(snapshotsFolderProblem("", ".obsidian", "", none)).toBeNull();
  });
  it("rejects .. and . segments", () => {
    expect(snapshotsFolderProblem("../outside", ".obsidian", "", none)).toEqual({ reason: "path" });
    expect(snapshotsFolderProblem("a/./b", ".obsidian", "", none)).toEqual({ reason: "path" });
  });
  it("rejects the config folder, inside it or holding it", () => {
    expect(snapshotsFolderProblem(".obsidian", ".obsidian", "", none)).toEqual({ reason: "config", folder: ".obsidian" });
    expect(snapshotsFolderProblem("/.obsidian/snaps/", ".obsidian", "", none)).toEqual({ reason: "config", folder: ".obsidian" });
    expect(snapshotsFolderProblem(".obsidian2", ".obsidian", "", none)).toBeNull();
  });
  it("rejects a folder inside a track folder, or holding one", () => {
    expect(snapshotsFolderProblem("Novels/Snaps", ".obsidian", "Contos\n/Novels/", none)).toEqual({ reason: "tracked", folder: "Novels" });
    expect(snapshotsFolderProblem("Writing", ".obsidian", "Writing/Novels", none)).toEqual({ reason: "tracked", folder: "Writing/Novels" });
    expect(snapshotsFolderProblem("Novels2", ".obsidian", "Novels", none)).toBeNull();
  });
  it("rejects a folder that already has notes", () => {
    const seen: string[] = [];
    const has = (root: string) => { seen.push(root); return root === "Contos"; };
    expect(snapshotsFolderProblem(" Contos/ ", ".obsidian", "", has)).toEqual({ reason: "notes", folder: "Contos" });
    expect(seen).toEqual(["Contos"]);
    expect(snapshotsFolderProblem("Escrita/Snapshots", ".obsidian", "", has)).toBeNull();
  });
});
