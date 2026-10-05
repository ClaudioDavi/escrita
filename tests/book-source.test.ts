import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "obsidian";
import { includeChapter } from "../src/core/book-source";
import { BookService, bookSource } from "../src/core/books";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("includeChapter", () => {
  it("leaves out only false or 'false'", () => {
    expect(includeChapter({ compile: false }, "compile")).toBe(false);
    expect(includeChapter({ compile: " False " }, "compile")).toBe(false);
    expect(includeChapter({ Compile: false }, "compile")).toBe(false);
    for (const v of [true, "true", "no", 0, null, undefined, "falsey"]) expect(includeChapter({ compile: v }, "compile")).toBe(true);
    expect(includeChapter(undefined, "compile")).toBe(true);
    expect(includeChapter(null, "compile")).toBe(true);
    expect(includeChapter({ publish: false }, "compile")).toBe(true);
  });
  it("prefers the exact name over a case variant", () => {
    expect(includeChapter({ compile: true, Compile: false }, "compile")).toBe(true);
  });
});

function setup(open: Set<string>, onRead?: (f: TFile) => void) {
  const mk = (path: string, mtime = 0) => {
    const name = path.slice(path.lastIndexOf("/") + 1);
    return Object.assign(new TFile(), { path, name, basename: name.replace(/\.md$/, ""), extension: "md", stat: { ctime: 0, mtime, size: 0 } });
  };
  const folder = (path: string) => Object.assign(new TFolder(), { path, name: path.split("/").pop(), isRoot: () => false });
  const chapters = folder("Novels/L/Chapters");
  const files = [mk("Novels/L/Chapters/10 Dez.md", 7), mk("Novels/L/Chapters/02 Dois.md", 5), mk("Novels/L/Chapters/Prólogo.md", 3), mk("Novels/L/Chapters/img.png")];
  files[3].extension = "png";
  chapters.children = files;
  const fm: Record<string, Record<string, unknown>> = { "Novels/L/Chapters/02 Dois.md": { compile: false } };
  const app = {
    vault: { getAbstractFileByPath: (p: string) => files.find((f) => f.path === p) ?? null },
    metadataCache: { getFileCache: (f: TFile) => (fm[f.path] ? { frontmatter: fm[f.path] } : null) },
  };
  const notes = {
    editorView: (f: TFile) => (open.has(f.path) ? ({} as never) : null),
    text: (f: TFile) => ({ read: async () => { onRead?.(f); return open.has(f.path) ? "unsaved" : "saved"; } }) as never,
  };
  const s = { ...DEFAULT_SETTINGS };
  const books = new BookService(app as never, () => s);
  const book = { chaptersFolder: chapters } as never;
  return { src: bookSource(app as never, books, notes, () => s), book, files };
}

describe("bookSource adapter", () => {
  it("lists chapters in order, with title, number and include", () => {
    const { src, book } = setup(new Set());
    const list = src.chapters(book);
    expect(list.map((c) => c.path)).toEqual(["Novels/L/Chapters/Prólogo.md", "Novels/L/Chapters/02 Dois.md", "Novels/L/Chapters/10 Dez.md"].sort((a, b) => list.map((c) => c.path).indexOf(a) - list.map((c) => c.path).indexOf(b)));
    const two = list.find((c) => c.number === 2)!;
    expect(two).toMatchObject({ title: "Dois", include: false });
    expect(list.find((c) => c.number === 10)).toMatchObject({ include: true });
    expect(list.find((c) => c.number === null)).toMatchObject({ title: "Prólogo", include: true });
    expect(list.findIndex((c) => c.number === 2)).toBeLessThan(list.findIndex((c) => c.number === 10));
  });
  it("reads the file with its mtime when no editor is open", async () => {
    const { src } = setup(new Set());
    expect(await src.read("Novels/L/Chapters/10 Dez.md")).toEqual({ text: "saved", mtime: 7 });
  });
  it("reads the editor's text with a null mtime when open", async () => {
    const { src } = setup(new Set(["Novels/L/Chapters/10 Dez.md"]));
    expect(await src.read("Novels/L/Chapters/10 Dez.md")).toEqual({ text: "unsaved", mtime: null });
  });
  it("frontmatter is {} when there is none", () => {
    const { src } = setup(new Set());
    expect(src.frontmatter("Novels/L/Chapters/10 Dez.md")).toEqual({});
    expect(src.frontmatter("Novels/L/Chapters/02 Dois.md")).toEqual({ compile: false });
    expect(src.frontmatter("missing.md")).toEqual({});
  });
});

describe("bookSource read races", () => {
  it("gives no mtime when the file is saved during the read", async () => {
    const { src, files } = setup(new Set(), (f) => { f.stat.mtime = 99; });
    expect(await src.read("Novels/L/Chapters/10 Dez.md")).toEqual({ text: "saved", mtime: null });
    void files;
  });
});
