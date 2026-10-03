import { describe, it, expect } from "vitest";
import { formFor, formOf, formValuesText, groupWorks, parseFormFolders, parseFormValues, type WorkInfo } from "../src/universe/works-list";
import { planMigration, type MigrationInput } from "../src/universe/migration";
import { entryFileName, entryFolder, entryPath, entryText, yamlValue } from "../src/universe/new-entry";
import { defaultUniverseSettings } from "../src/universe/settings";

const forms = { shortStory: "conto", essay: "ensaio", novella: "novela", novel: "romance", poem: "poema", fragment: "fragmento" };
const w = (title: string, stage: WorkInfo["stage"], form: WorkInfo["form"]): WorkInfo => ({ path: `${title}.md`, title, stage, form, role: "note" });

describe("works", () => {
  it("formOf matches the writer's words and treats the rest as no form", () => {
    expect(formOf("Conto ", forms)).toBe("shortStory");
    expect(formOf(["romance"], forms)).toBe("novel");
    expect(formOf("saga", forms)).toBeNull();
    expect(formOf(undefined, forms)).toBeNull();
    expect(formOf("Ensaio", forms)).toBe("essay");
  });
  it("parseFormFolders reads Folder: form lines and skips the rest", () => {
    expect(parseFormFolders("Contos: conto\n/Textos/ : ensaio\n\nsem dois pontos\n: conto\nRomances:\nA: b: romance")).toEqual([
      { folder: "Contos", word: "conto" }, { folder: "Textos", word: "ensaio" }, { folder: "A: b", word: "romance" },
    ]);
  });
  it("formFor: the property wins, else the deepest matching folder, else no form", () => {
    const s = { formValues: forms, formFolders: "Contos: conto\nTextos: ensaio\nContos/Longos: novela\nRomances: saga" };
    expect(formFor("Contos/O farol.md", undefined, s)).toBe("shortStory");
    expect(formFor("Contos/O farol.md", "novela", s)).toBe("novella");
    expect(formFor("Contos/Longos/A ilha.md", undefined, s)).toBe("novella");
    expect(formFor("Textos/Sobre o sal.md", "", s)).toBe("essay");
    expect(formFor("ContosX/Outro.md", undefined, s)).toBeNull();
    expect(formFor("Contos.md", undefined, s)).toBeNull();
    expect(formFor("Romances/A Casa.md", undefined, s)).toBeNull();
    expect(formFor("Ideias/x.md", "poema", { formValues: forms, formFolders: "" })).toBe("poem");
  });
  it("groups by form in order, No form last, sorted by stage (published first) then name", () => {
    const g = groupWorks([
      w("Z", "draft", "shortStory"), w("B", "published", "shortStory"), w("A", "draft", "shortStory"),
      w("Casa", "revision", "novel"), w("Solto", "idea", null), w("Zeta", "published", "shortStory"),
    ]);
    expect(g.map((x) => x.form)).toEqual(["shortStory", "novel", null]);
    expect(g[0].works.map((x) => x.title)).toEqual(["B", "Zeta", "A", "Z"]);
  });
  it("the forms settings field round-trips and keeps a blank item's value", () => {
    expect(formValuesText(forms)).toBe("conto, ensaio, novela, romance, poema, fragmento");
    expect(parseFormValues("a, b,, d", forms)).toEqual({ shortStory: "a", essay: "b", novella: "novela", novel: "d", poem: "poema", fragment: "fragmento" });
  });
});

describe("planMigration", () => {
  const types = defaultUniverseSettings().entryTypes;
  const base = (over: Partial<MigrationInput> = {}): MigrationInput => ({
    bookFolder: "Romances/A Casa", bookNote: "Romances/A Casa.md", bookHasUniverse: false, universeRoot: "Universo",
    files: [
      { path: "Romances/A Casa/Characters/Ana.md", hasType: true },
      { path: "Romances/A Casa/Characters/Teo.md", hasType: false },
      { path: "Romances/A Casa/Characters/Sub/Vi.md", hasType: false },
      { path: "Romances/A Casa/Places/Porão.md", hasType: false },
      { path: "Romances/A Casa/Chapters/01 X.md", hasType: false },
    ],
    exists: () => false, types, ...over,
  });
  it("moves each type's folder, keeping subfolders, and adds the type only where missing", () => {
    const p = planMigration(base());
    expect(p.groups.map((g) => [g.kind, g.fromFolder, g.toFolder, g.moves.length])).toEqual([
      ["character", "Romances/A Casa/Characters", "Universo/Characters", 3],
      ["place", "Romances/A Casa/Places", "Universo/Places", 1],
    ]);
    expect(p.moves.map((m) => [m.to, m.addType])).toContainEqual(["Universo/Characters/Sub/Vi.md", "character"]);
    expect(p.moves.find((m) => m.from.endsWith("Ana.md"))!.addType).toBeNull();
    expect(p.missingType).toBe(3);
    expect(p.needsUniverse).toBe(true);
  });
  it("a name that already exists stays put and is reported, never overwritten", () => {
    const p = planMigration(base({ exists: (x) => x === "Universo/Characters/Teo.md", bookHasUniverse: true }));
    expect(p.conflicts).toEqual([{ kind: "character", from: "Romances/A Casa/Characters/Teo.md", to: "Universo/Characters/Teo.md" }]);
    expect(p.moves.some((m) => m.from.endsWith("Teo.md"))).toBe(false);
    expect(p.needsUniverse).toBe(false);
  });
  it("two types with the same folder name do not take the same destination twice", () => {
    const t = defaultUniverseSettings().entryTypes;
    t.object.folder = "Places";
    const p = planMigration(base({ types: t }));
    expect(p.moves.filter((m) => m.to === "Universo/Places/Porão.md")).toHaveLength(1);
    expect(p.conflicts).toHaveLength(1);
  });
  it("a nested type folder takes its own notes: the deepest folder wins", () => {
    const t = defaultUniverseSettings().entryTypes;
    t.place.folder = "World";
    t.group.folder = "World/Groups";
    const p = planMigration(base({
      types: t,
      files: [
        { path: "Romances/A Casa/World/Porão.md", hasType: true },
        { path: "Romances/A Casa/World/Groups/Clã.md", hasType: true },
      ],
    }));
    expect(p.groups.map((g) => [g.kind, g.moves.map((m) => m.from)])).toEqual([
      ["place", ["Romances/A Casa/World/Porão.md"]],
      ["group", ["Romances/A Casa/World/Groups/Clã.md"]],
    ]);
  });
  it("nothing to move gives an empty plan", () => {
    expect(planMigration(base({ files: [] })).groups).toEqual([]);
  });
});

describe("new entries", () => {
  const s = defaultUniverseSettings();
  const U = { kind: "universe" as const, root: "Universo", note: "Universo.md" };
  const now = new Date(2026, 9, 3, 14, 5);
  it("file names lose the characters Obsidian refuses", () => {
    expect(entryFileName(' Ana: a "Mari" / #1 ')).toBe("Ana a Mari 1");
    expect(entryFileName("???")).toBe("");
    expect(entryFileName(".oculta")).toBe("oculta");
  });
  it("folder and path per scope", () => {
    expect(entryFolder(U, "place", s.entryTypes)).toBe("Universo/Places");
    expect(entryFolder({ kind: "book", root: "R/A Casa", note: "R/A Casa.md" }, "character", s.entryTypes)).toBe("R/A Casa/Characters");
    expect(entryFolder({ kind: "none", root: "", note: null }, "place", s.entryTypes)).toBeNull();
    expect(entryPath(U, "character", "Ana", s.entryTypes)).toBe("Universo/Characters/Ana.md");
    expect(entryPath(U, "character", "  ", s.entryTypes)).toBeNull();
  });
  it("text without a template: type, universe link and alias", () => {
    expect(entryText(s, { name: "Teodoro", kind: "character", scope: U, alias: "Teo", template: null, now })).toBe(
      '---\ntype: character\nuniverse: "[[Universo]]"\naliases:\n  - Teo\n---\n');
  });
  it("a template: its body, {{title}}, its other properties; the entry's own type wins", () => {
    const tpl = "---\ntype: outro\ntags: [a]\ncriado: {{date}}\n---\n# {{title}}\n\nNotas.\n";
    expect(entryText(s, { name: "Ana", kind: "character", scope: U, template: tpl, now })).toBe(
      '---\ntype: character\nuniverse: "[[Universo]]"\ntags: [a]\ncriado: 2026-10-03\n---\n# Ana\n\nNotas.\n');
  });
  it("a book scope gets no universe property; an alias equal to the name is dropped", () => {
    const B = { kind: "book" as const, root: "R/A Casa", note: "R/A Casa.md" };
    expect(entryText(s, { name: "Ana", kind: "character", scope: B, alias: "Ana", template: null, now })).toBe("---\ntype: character\n---\n");
  });
  it("yamlValue quotes what YAML would misread", () => {
    expect(yamlValue("Mari")).toBe("Mari");
    expect(yamlValue("a: b")).toBe('"a: b"');
    expect(yamlValue("yes")).toBe('"yes"');
    expect(yamlValue("1984")).toBe('"1984"');
  });
});
