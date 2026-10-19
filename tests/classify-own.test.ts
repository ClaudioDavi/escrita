// 1.2.1: Escrita's own notes (the darlings notes and the lens word lists note) are a field on the
// classifier result: never tracked, never a work, never given a draft status.
import { describe, expect, it } from "vitest";
import { classify, classifyKey, type ClassifySettings, type Named, type VaultTree } from "../src/core/classify";
import { needsDraftStatus, type NewNoteOptions } from "../src/core/new-note-status";

const settings: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "", snapshotsFolder: "Escrita/Snapshots",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit",
  darlingsNote: "Darlings.md", globalDarlingsNote: "Darlings.md", lensListsNote: "",
};

function tree(paths: string[], fm: Record<string, Record<string, unknown>> = {}): VaultTree<Named, Named> {
  const files = new Map(paths.map((p) => [p, { path: p }]));
  const dirs = new Map<string, Named>();
  for (const p of paths) for (let d = p.slice(0, Math.max(p.lastIndexOf("/"), 0)); d; d = d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "") dirs.set(d, { path: d });
  return {
    file: (p) => files.get(p) ?? null,
    folder: (p) => dirs.get(p) ?? null,
    folders: () => dirs.values(),
    frontmatter: (f) => fm[f.path],
    resolve: () => null,
  };
}

const t = tree([
  "Darlings.md", "Outros/Darlings.md", "Word lists.md", "Listas de palavras.md", "Minhas listas.md", "Cortes.md",
  "Contos/Conto.md", "Livros/Farol.md", "Livros/Farol/Chapters/01.md", "Livros/Farol/Darlings.md", "Livros/Farol/Cortes.md", "Livros/Farol/Notas.md",
], {
  "Darlings.md": { status: "draft" }, "Word lists.md": { status: "draft" }, "Contos/Conto.md": { status: "draft" },
  "Livros/Farol/Darlings.md": { status: "draft" },
});
const c = (p: string, s: Partial<ClassifySettings> = {}) => classify(t, { ...settings, ...s }, p);

describe("classify: own", () => {
  it("the global darlings note is own, untracked and not a work", () => {
    expect(c("Darlings.md")).toMatchObject({ kind: "note", own: "darlings", tracked: false, stage: null });
  });
  it("a Darlings.md in some other folder is an ordinary note", () => {
    expect(c("Outros/Darlings.md")).toMatchObject({ own: null, tracked: true });
  });
  it("a book's darlings note is own and untracked; the book's other files are not", () => {
    expect(c("Livros/Farol/Darlings.md")).toMatchObject({ kind: "book-file", own: "darlings", tracked: false, stage: null });
    expect(c("Livros/Farol/Notas.md")).toMatchObject({ own: null, tracked: true });
  });
  it("follows the settings: another name for the book's note, another path for the global one", () => {
    expect(c("Livros/Farol/Cortes.md", { darlingsNote: "Cortes" })).toMatchObject({ own: "darlings", tracked: false });
    expect(c("Livros/Farol/Darlings.md", { darlingsNote: "Cortes" })).toMatchObject({ own: null });
    expect(c("Cortes.md", { globalDarlingsNote: "Cortes.md" })).toMatchObject({ own: "darlings", tracked: false });
    expect(c("Darlings.md", { globalDarlingsNote: "Cortes.md" })).toMatchObject({ own: null });
  });
  it("blank settings mean the defaults", () => {
    expect(c("Darlings.md", { globalDarlingsNote: "", darlingsNote: "" })).toMatchObject({ own: "darlings" });
    expect(c("Livros/Farol/Darlings.md", { globalDarlingsNote: "", darlingsNote: "" })).toMatchObject({ own: "darlings" });
  });
  it("the word lists note: the setting when set, else either default name at the root", () => {
    expect(c("Word lists.md")).toMatchObject({ own: "lists", tracked: false, stage: null });
    expect(c("Listas de palavras.md")).toMatchObject({ own: "lists", tracked: false });
    expect(c("Minhas listas.md", { lensListsNote: "Minhas listas" })).toMatchObject({ own: "lists", tracked: false });
    expect(c("Word lists.md", { lensListsNote: "Minhas listas" })).toMatchObject({ own: null, tracked: true });
  });
  it("an ordinary note and a book note are not own", () => {
    expect(c("Contos/Conto.md")).toMatchObject({ own: null, tracked: true, stage: "draft" });
    expect(c("Livros/Farol.md")).toMatchObject({ kind: "book-note", own: null });
    expect(c("Livros/Farol")).toMatchObject({ own: null });
    expect(c("nada.md")).toMatchObject({ kind: "none", own: null });
  });
  it("the classify key changes with the three settings", () => {
    const a = classifyKey(settings);
    expect(classifyKey({ ...settings, darlingsNote: "x" })).not.toBe(a);
    expect(classifyKey({ ...settings, globalDarlingsNote: "x" })).not.toBe(a);
    expect(classifyKey({ ...settings, lensListsNote: "x" })).not.toBe(a);
  });
});

describe("draftIfNew's rule on own notes", () => {
  const o: NewNoteOptions = { statusProperty: "status", typeProperty: "tipo", templateFolders: [], ownNotes: [], structuralProperties: [] };
  it("a new global darlings note or word lists note gets no draft status; a conto does", () => {
    expect(needsDraftStatus(c("Darlings.md"), {}, o)).toBe(false);
    expect(needsDraftStatus(c("Word lists.md"), {}, o)).toBe(false);
    expect(needsDraftStatus(c("Livros/Farol/Darlings.md"), {}, o)).toBe(false);
    expect(needsDraftStatus(c("Contos/Conto.md"), {}, o)).toBe(true);
  });
});
