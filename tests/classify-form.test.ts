import { describe, expect, it } from "vitest";
import { classify, classifyKey, type ClassifySettings, type Named, type VaultTree } from "../src/core/classify";
import { FORM_DEFAULTS } from "../src/core/form";

// PLAN-1.1 Q1: the form is a field on the classifier result, read with the universe off.

const base: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "Contos\nRoteiros\nNovels", excludeFolders: "", chapterTemplate: "", snapshotsFolder: "Escrita/Snapshots",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit",
};
const pt: ClassifySettings = {
  ...base,
  formProperty: "forma",
  formValues: { ...FORM_DEFAULTS, shortStory: "conto", screenplay: "roteiro" },
  formFolders: "Roteiros: roteiro\nContos: conto",
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

const t = tree(
  ["Roteiros/O farol.md", "Roteiros/foto.png", "Contos/A ilha.md", "Contos/Roteiro solto.md", "Solto.md", "Ideias/x.md",
    "Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Escrita/Exports/O farol (A4).pdf"],
  {
    "Contos/Roteiro solto.md": { forma: "Roteiro" },
    "Solto.md": { form: "screenplay" },
    "Ideias/x.md": { forma: "saga" },
    "Novels/Livro/Chapters/01.md": { forma: "roteiro" },
  },
);

describe("classify: form (1.1)", () => {
  it("reads the form property first, then the folder, with the universe off", () => {
    expect(classify(t, pt, "Roteiros/O farol.md").form).toBe("screenplay");
    expect(classify(t, pt, "Contos/A ilha.md").form).toBe("shortStory");
    expect(classify(t, pt, "Contos/Roteiro solto.md").form).toBe("screenplay");
    expect(classify(t, pt, "Ideias/x.md").form).toBeNull();
    expect(classify(t, pt, "Novels/Livro/Chapters/01.md").form).toBe("screenplay");
  });
  it("missing form keys mean the property `form` and the English words", () => {
    expect(classify(t, base, "Solto.md").form).toBe("screenplay");
    expect(classify(t, base, "Roteiros/O farol.md").form).toBeNull();
  });
  it("is null for non-markdown files, folders, missing paths and plugin folders", () => {
    expect(classify(t, pt, "Roteiros/foto.png").form).toBeNull();
    expect(classify(t, pt, "Roteiros").form).toBeNull();
    expect(classify(t, pt, "Gone.md").form).toBeNull();
    expect(classify(t, pt, null).form).toBeNull();
    expect(classify(t, pt, "Escrita/Exports/O farol (A4).pdf").form).toBeNull();
  });
  it("the form keys are part of classifyKey", () => {
    expect(classifyKey(pt)).not.toBe(classifyKey({ ...pt, formFolders: "" }));
    expect(classifyKey(pt)).not.toBe(classifyKey({ ...pt, formValues: { ...pt.formValues!, screenplay: "script" } }));
    expect(classifyKey(pt)).not.toBe(classifyKey({ ...pt, formProperty: "form" }));
  });
});
