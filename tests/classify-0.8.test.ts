import { describe, expect, it } from "vitest";
import {
  classify, classifyKey, DEFAULT_EXPORT_FOLDER, DEFAULT_SUBMISSIONS_FOLDER, exportRoot, listBooks, submissionsRoot,
  type ClassifySettings, type Named, type VaultTree,
} from "../src/core/classify";

const settings: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "", snapshotsFolder: "Escrita/Snapshots",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit",
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
  };
}

describe("submissionsRoot and exportRoot", () => {
  it("normalize like snapshotsRoot and never return empty", () => {
    expect(submissionsRoot(" /Envios//Contos/ ")).toBe("Envios/Contos");
    expect(exportRoot("Saída\\Docs")).toBe("Saída/Docs");
    for (const v of ["", "  ", "/", null, undefined, 4]) {
      expect(submissionsRoot(v)).toBe(DEFAULT_SUBMISSIONS_FOLDER);
      expect(exportRoot(v)).toBe(DEFAULT_EXPORT_FOLDER);
    }
  });
});

describe("classify: submissions and exports", () => {
  const t = tree([
    "Submissions/Conto A.md", "Submissions/Sub/x.pdf", "Escrita/Exports/Conto A.md", "Escrita/Exports/Livro (Shunn).docx",
    "Contos/Conto A.md", "Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Novels/Livro/Submissions/s.md",
  ], { "Submissions/Conto A.md": { status: "rascunho" }, "Escrita/Exports/Conto A.md": { status: "rascunho", target: 500 } });
  const c = (p: string, s: ClassifySettings = settings) => classify(t, s, p);

  it("a submission note is a plain note: not tracked, no piece-less work, no stage", () => {
    expect(c("Submissions/Conto A.md")).toMatchObject({ kind: "note", markdown: true, submission: true, export: false, snapshot: false, tracked: false, stage: null, book: null, piece: null });
    expect(c("Submissions/Sub/x.pdf")).toMatchObject({ kind: "file", submission: true, tracked: false });
    expect(c("Submissions")).toMatchObject({ kind: "folder", submission: true });
  });

  it("an export is never tracked, a work or a piece, even with a status and a target", () => {
    expect(c("Escrita/Exports/Conto A.md")).toMatchObject({ kind: "note", export: true, submission: false, tracked: false, stage: null, piece: null });
    expect(c("Escrita/Exports/Livro (Shunn).docx")).toMatchObject({ kind: "file", export: true });
    expect(c("Escrita/Exports")).toMatchObject({ kind: "folder", export: true });
  });

  it("other paths have both flags false in every return", () => {
    for (const p of ["Contos/Conto A.md", "Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Novels", "Nope.md", "", "/"]) {
      expect(c(p)).toMatchObject({ submission: false, export: false });
    }
    expect(c("Contos/Conto A.md")).toMatchObject({ tracked: true });
  });

  it("a folder named Submissions inside a book is a submissions folder only when it is the setting", () => {
    // the setting is a vault path: Novels/Livro/Submissions is not Submissions
    expect(c("Novels/Livro/Submissions/s.md")).toMatchObject({ kind: "book-file", submission: false });
    const own = { ...settings, submissionsFolder: "Novels/Livro/Submissions" };
    expect(c("Novels/Livro/Submissions/s.md", own)).toMatchObject({ kind: "note", submission: true, book: null, tracked: false });
  });

  it("follows the settings, and an empty setting means the default", () => {
    expect(c("Contos/Conto A.md", { ...settings, submissionsFolder: "Contos" })).toMatchObject({ submission: true, tracked: false });
    expect(c("Submissions/Conto A.md", { ...settings, submissionsFolder: "" })).toMatchObject({ submission: true });
    expect(c("Escrita/Exports/Conto A.md", { ...settings, exportFolder: "Outro" })).toMatchObject({ export: false, tracked: true });
  });

  it("listBooks skips a book folder inside either folder", () => {
    const t2 = tree(["Submissions/B.md", "Submissions/B/Chapters/1.md", "Escrita/Exports/E.md", "Escrita/Exports/E/Chapters/1.md", "Novels/L.md", "Novels/L/Chapters/1.md"]);
    expect(listBooks(t2, settings).map((b) => b.title)).toEqual(["L"]);
  });
});

describe("classifyKey", () => {
  const key = (o: Partial<ClassifySettings> = {}) => classifyKey({ ...settings, ...o });
  it("is stable for equal settings, and the empty folder equals its default", () => {
    expect(key()).toBe(key());
    expect(key({ submissionsFolder: "" })).toBe(key({ submissionsFolder: "/Submissions/" }));
    expect(key({ exportFolder: undefined })).toBe(key({ exportFolder: "Escrita/Exports" }));
  });
  it("changes with every input classify reads", () => {
    const base = key();
    const changes: Partial<ClassifySettings>[] = [
      { trackFolders: "A" }, { excludeFolders: "A" }, { chaptersFolder: "Cap" }, { chapterTemplate: "T" },
      { snapshotsFolder: "S" }, { submissionsFolder: "Envios" }, { exportFolder: "Saída" },
      { statusProperty: "estado" }, { stages: { idea: ["a"], draft: ["b"], revision: ["c"], ready: ["d"], published: ["e"] } as never },
      { targetProperty: "alvo" }, { limitProperty: "teto" }, { unitProperty: "un" }, { deadlineProperty: "prazo" },
    ];
    for (const ch of changes) expect(key(ch), JSON.stringify(ch)).not.toBe(base);
  });
});
