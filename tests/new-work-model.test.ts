import { describe, expect, it } from "vitest";
import { classify, type ClassifySettings, type VaultTree } from "../src/core/classify";
import { cloneDefaultStages, type StageMapping } from "../src/core/stages";
import { templateVars } from "../src/core/template";
import { defaultsFor } from "../src/settings";
import { newWorkStrings } from "../src/new-work/strings";
import {
  bookNoteText, cursorAfterBody, defaultFolderFor, fromTemplate, storyNoteText, targetPath, type BookTexts, type NewWorkSettings, type StoryTexts,
} from "../src/new-work/model";

// A frontmatter reader as small as the notes need: `key: value`, a blank value is YAML null.
function readFrontmatter(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const out: Record<string, unknown> = {};
  for (let i = 1; lines[i] !== "---"; i++) {
    const m = /^("[^"]*"|[^:]+): ?(.*)$/.exec(lines[i])!;
    const key = m[1].startsWith('"') ? (JSON.parse(m[1]) as string) : m[1];
    const raw = m[2].trim();
    out[key] = raw === "" ? null : raw.startsWith('"') ? (JSON.parse(raw) as string) : /^\d+$/.test(raw) ? Number(raw) : raw;
  }
  return out;
}

interface Node { path: string; name: string; extension: string; parent: unknown }

/** One note in a vault with a book folder next to it, classified the way the plugin does. */
function classifyNote(path: string, text: string, s: ClassifySettings, folders: string[] = []) {
  const fm = readFrontmatter(text);
  const node = (p: string): Node => ({ path: p, name: p.slice(p.lastIndexOf("/") + 1), extension: p.endsWith(".md") ? "md" : "", parent: null });
  const file = node(path);
  const dirs = new Map(folders.map((f) => [f, node(f)]));
  const tree: VaultTree<Node, Node> = {
    file: (p) => (p === path ? file : null),
    folder: (p) => dirs.get(p) ?? null,
    folders: () => dirs.values(),
    frontmatter: () => fm,
    resolve: () => null,
  };
  return classify(tree, s, path);
}

const en = newWorkStrings.en;
const pt = newWorkStrings["pt-BR"];
const storyTexts = (d: Record<string, string>): StoryTexts => ({ beat: d["new-work.text.beat"] });
const bookTexts = (d: Record<string, string>): BookTexts => ({
  premise: d["new-work.text.premise"], premiseHint: d["new-work.text.premiseHint"],
  characters: d["new-work.text.characters"], charactersHint: d["new-work.text.charactersHint"],
});

const enSettings = defaultsFor("en");
const ptSettings = defaultsFor("pt-BR");
const customStages: StageMapping = { ...cloneDefaultStages(), draft: { ...cloneDefaultStages().draft, words: "esboço\nrascunho" } };
const custom = {
  ...enSettings, statusProperty: "estado", formProperty: "tipo", targetProperty: "meta", goalProperty: "objetivo",
  deadlineProperty: "prazo", stages: customStages,
};

const cases: [string, typeof enSettings, Record<string, string>][] = [
  ["English", enSettings, en],
  ["pt-BR", ptSettings, pt],
  ["custom names", custom, en],
];

describe("storyNoteText", () => {
  for (const [label, s, d] of cases) {
    it(`is a work in the draft stage, a short story with no piece yet (${label})`, () => {
      const text = storyNoteText(s as NewWorkSettings, storyTexts(d));
      const p = classifyNote("Contos/O afogado.md", text, s);
      expect(p.kind).toBe("note");
      expect(p.tracked).toBe(true);
      expect(p.stage).toBe("draft");
      expect(p.piece).toBeNull();
      const fm = readFrontmatter(text);
      expect(fm[s.formProperty]).toBe(s.formValues.shortStory);
      expect(fm[s.targetProperty]).toBeNull();
      expect(fm[s.deadlineProperty]).toBeNull();
    });
  }

  it("ends with one beat and an empty line for the cursor", () => {
    const text = storyNoteText(enSettings, storyTexts(en));
    expect(text.endsWith("---\n%% beat: What happens first %%\n")).toBe(true);
    expect(cursorAfterBody(text)).toBe(text.length);
  });

  it("writes the writer's first draft word and quotes a form value with spaces", () => {
    const text = storyNoteText(custom, storyTexts(en));
    expect(text).toContain("estado: esboço\n");
    expect(text).toContain('tipo: "short story"\n');
    expect(text).toContain("meta: \nprazo: \n");
  });

  it("falls back to the status property's default when it is blank", () => {
    expect(storyNoteText({ ...enSettings, statusProperty: " " }, storyTexts(en))).toContain("status: draft\n");
  });
});

describe("bookNoteText", () => {
  for (const [label, s, d] of cases) {
    it(`is a book note in the draft stage with a blank goal (${label})`, () => {
      const text = bookNoteText(s as NewWorkSettings, bookTexts(d));
      const p = classifyNote("Livros/Livro.md", text, s, ["Livros/Livro", `Livros/Livro/${s.chaptersFolder}`]);
      expect(p.kind).toBe("book-note");
      expect(p.stage).toBe("draft");
      expect(p.piece).toBeNull();
      const fm = readFrontmatter(text);
      expect(fm[s.goalProperty]).toBeNull();
      expect(fm[s.deadlineProperty]).toBeNull();
    });
  }

  it("has the two headings, each with its hint", () => {
    const text = bookNoteText(ptSettings, bookTexts(pt));
    expect(text).toContain(`## Premissa\n%% ${pt["new-work.text.premiseHint"]} %%\n\n## Personagens\n%% ${pt["new-work.text.charactersHint"]} %%\n`);
  });

  it("starts in the draft stage in the writer's own word, with quoting where YAML needs it", () => {
    const stages: StageMapping = { ...cloneDefaultStages(), draft: { ...cloneDefaultStages().draft, words: "first draft" } };
    const text = bookNoteText({ ...enSettings, statusProperty: "book status", stages }, bookTexts(en));
    expect(text).toContain('"book status": "first draft"\n');
  });
});

describe("fromTemplate", () => {
  const vars = templateVars("O afogado", new Date(2026, 9, 15, 9, 5));

  it("fills the variables and adds the draft status to a template without one", () => {
    const out = fromTemplate("---\nform: conto\n---\n# {{title}}\n{{date}}\n", vars, enSettings);
    expect(out).toBe("---\nstatus: draft\nform: conto\n---\n# O afogado\n2026-10-15\n");
  });

  it("keeps a template's own status", () => {
    const out = fromTemplate("---\nstatus: idea\n---\n{{ Title }}", vars, enSettings);
    expect(out).toBe("---\nstatus: idea\n---\nO afogado");
  });

  it("gives a template with no frontmatter one holding the status", () => {
    expect(fromTemplate("Text {{time}}", vars, enSettings)).toBe("---\nstatus: draft\n---\nText 09:05");
  });

  it("uses the writer's status property and word", () => {
    expect(fromTemplate("---\ntags: x\n---\n", vars, custom)).toBe("---\nestado: esboço\ntags: x\n---\n");
  });
});

describe("cursorAfterBody", () => {
  it("is the end of the text", () => {
    expect(cursorAfterBody("")).toBe(0);
    expect(cursorAfterBody("a\nb\n")).toBe(4);
    expect(cursorAfterBody("a\nb")).toBe(3);
  });
});

describe("targetPath", () => {
  it("joins the folder and the safe name", () => {
    expect(targetPath("Contos", "O afogado")).toBe("Contos/O afogado.md");
    expect(targetPath("/Contos/Sub/ ", "A: B?")).toBe("Contos/Sub/A B.md");
  });

  it("is at the vault root for an empty folder", () => {
    expect(targetPath("", "Conto")).toBe("Conto.md");
    expect(targetPath(" / ", "Conto")).toBe("Conto.md");
  });

  it("is null when the title leaves no name", () => {
    expect(targetPath("Contos", "   ")).toBeNull();
    expect(targetPath("Contos", "/:*?")).toBeNull();
  });
});

describe("defaultFolderFor", () => {
  it("prefers the setting", () => {
    expect(defaultFolderFor("Contos", "Novels/A/Chapters/1.md", "Novels/A")).toBe("Contos");
  });
  it("leaves a book for its parent folder, not the chapters folder", () => {
    expect(defaultFolderFor("", "Novels/A/Chapters/1.md", "Novels/A")).toBe("Novels");
    expect(defaultFolderFor("", "A/Chapters/1.md", "A")).toBe("");
  });
  it("is the active note's folder outside a book, else the root", () => {
    expect(defaultFolderFor("", "Textos/x.md", null)).toBe("Textos");
    expect(defaultFolderFor("", null, null)).toBe("");
  });
});
