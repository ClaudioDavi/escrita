import { describe, it, expect } from "vitest";
import { keptOut, linkText, scopeFor, universeNotePath, type ScopeLookup, type ScopeSettings } from "../src/universe/scope";
import { ENTRY_KINDS, FORM_KINDS, defaultUniverseSettings, normalizeUniverse } from "../src/universe/settings";

interface World {
  /** note path → universe property value */
  props?: Record<string, unknown>;
  /** books: folder → note */
  books?: Record<string, string>;
  /** notes that exist (for link resolution), by path */
  notes?: string[];
}

function lookup(w: World): ScopeLookup {
  const books = Object.entries(w.books ?? {});
  const notes = w.notes ?? [];
  return {
    book(path) {
      for (const [folder, note] of books) if (path === note || path.startsWith(folder + "/")) return { note, folder };
      return null;
    },
    universe: (path) => (w.props ?? {})[path],
    resolve(link) {
      const want = link.toLowerCase();
      return notes.find((n) => n.replace(/\.md$/, "").split("/").pop()!.toLowerCase() === want || n.replace(/\.md$/, "").toLowerCase() === want) ?? null;
    },
  };
}

const base = (over: Partial<ScopeSettings> = {}): ScopeSettings => ({
  universeMode: "universe", universeNote: "Universe.md", defaultUniverseFolders: "", ...over,
});

const world: World = {
  notes: ["Universe.md", "Other/Mundo B.md"],
  books: { "Novels/A Casa": "Novels/A Casa.md", "Novels/Solo": "Novels/Solo.md" },
  props: {
    "Novels/A Casa.md": "[[Universe]]",
    "Contos/O farol.md": "[[Universe]]",
    "Contos/Outro.md": "[[Mundo B]]",
  },
};
const L = lookup(world);
const scope = (path: string, s = base(), l = L) => scopeFor({ path }, s, l);

describe("mode off", () => {
  it("is none everywhere, whatever the properties say", () => {
    const s = base({ universeMode: "off" });
    for (const p of ["Contos/O farol.md", "Novels/A Casa/Chapters/01 X.md", "Universe/Characters/Ana.md", "x.md"]) {
      expect(scope(p, s)).toEqual({ kind: "none", root: "", note: null });
    }
  });
});

describe("mode per book", () => {
  const s = base({ universeMode: "perBook", defaultUniverseFolders: "Contos" });
  it("a book's chapters and note scope to the book folder", () => {
    expect(scope("Novels/A Casa/Chapters/01 X.md", s)).toEqual({ kind: "book", root: "Novels/A Casa", note: "Novels/A Casa.md" });
    expect(scope("Novels/A Casa.md", s)).toEqual({ kind: "book", root: "Novels/A Casa", note: "Novels/A Casa.md" });
    expect(scope("Novels/A Casa/Characters/Ana.md", s).kind).toBe("book");
  });
  it("a standalone note has no scope, even with a universe property or default folder", () => {
    expect(scope("Contos/O farol.md", s).kind).toBe("none");
    expect(scope("Universe/Characters/Ana.md", s).kind).toBe("none");
  });
});

describe("mode universe", () => {
  it("a work with a universe property joins the universe", () => {
    expect(scope("Contos/O farol.md")).toEqual({ kind: "universe", root: "Universe", note: "Universe.md" });
  });
  it("a chapter inherits the universe from its book note", () => {
    expect(scope("Novels/A Casa/Chapters/01 X.md")).toEqual({ kind: "universe", root: "Universe", note: "Universe.md" });
    expect(scope("Novels/A Casa.md").kind).toBe("universe");
  });
  it("a chapter's own property wins over the book's", () => {
    const l = lookup({ ...world, props: { ...world.props, "Novels/A Casa/Chapters/02 Y.md": "[[Mundo B]]" } });
    expect(scope("Novels/A Casa/Chapters/02 Y.md", base(), l)).toEqual({ kind: "universe", root: "Other/Mundo B", note: "Other/Mundo B.md" });
  });
  it("several universes: the linked note's own folder is the root", () => {
    expect(scope("Contos/Outro.md")).toEqual({ kind: "universe", root: "Other/Mundo B", note: "Other/Mundo B.md" });
  });
  it("entries join by folder, the universe note by path", () => {
    expect(scope("Universe/Characters/Ana.md")).toEqual({ kind: "universe", root: "Universe", note: "Universe.md" });
    expect(scope("Universe.md").kind).toBe("universe");
  });
  it("default universe folders let a note join without the property", () => {
    const s = base({ defaultUniverseFolders: "Contos\nTextos, Romances/" });
    expect(scope("Contos/Sem propriedade.md", s).kind).toBe("universe");
    expect(scope("Textos/Ensaio.md", s).kind).toBe("universe");
    expect(scope("Romances/Livro.md", s).kind).toBe("universe");
    expect(scope("Romances/Livro/Chapters/01.md", s).kind).toBe("universe");
    expect(scope("Contosx/Nao.md", s).kind).toBe("none");
  });
  it("mixed vault: no property and no default folder is standalone", () => {
    expect(scope("Rascunhos/solto.md")).toEqual({ kind: "none", root: "", note: null });
  });
  it("mixed vault: a book outside the universe keeps per-book rules", () => {
    expect(scope("Novels/Solo/Chapters/01.md")).toEqual({ kind: "book", root: "Novels/Solo", note: "Novels/Solo.md" });
    expect(scope("Novels/Solo/Characters/Bia.md").kind).toBe("book");
  });
  it("the property beats a default folder's neighbours: a book in a default folder but with another universe", () => {
    const l = lookup({ ...world, props: { "Contos/Outro.md": "[[Mundo B]]" } });
    const s = base({ defaultUniverseFolders: "Contos" });
    expect(scope("Contos/Outro.md", s, l).root).toBe("Other/Mundo B");
  });
  it("a link to nothing is a typo: it joins nothing by itself", () => {
    const l = lookup({ ...world, props: { "Rascunhos/a.md": "[[Nada]]" } });
    expect(scope("Rascunhos/a.md", base(), l).kind).toBe("none");
    // but a default folder still applies
    expect(scope("Rascunhos/a.md", base({ defaultUniverseFolders: "Rascunhos" }), l).kind).toBe("universe");
  });
  it("an unresolved link to the settings' universe name still joins it", () => {
    const l = lookup({ props: { "a.md": "[[Universe]]" }, notes: [] });
    expect(scope("a.md", base(), l)).toEqual({ kind: "universe", root: "Universe", note: "Universe.md" });
  });
  it("a localized universe note and folder", () => {
    const s = base({ universeNote: "Universo.md" });
    const l = lookup({ notes: ["Universo.md"], props: { "Contos/Farol.md": "[[Universo]]" } });
    expect(scope("Contos/Farol.md", s, l)).toEqual({ kind: "universe", root: "Universo", note: "Universo.md" });
    expect(scope("Universo/Personagens/Ana.md", s, l).kind).toBe("universe");
  });
});

describe("linkText", () => {
  it("reads wikilinks, aliases, headings, lists and plain strings", () => {
    expect(linkText("[[Universe]]")).toBe("Universe");
    expect(linkText("[[Universe|U]]")).toBe("Universe");
    expect(linkText("[[Universe#Sec]]")).toBe("Universe");
    expect(linkText("Universe")).toBe("Universe");
    expect(linkText(["", "[[A]]", "[[B]]"])).toBe("A");
    expect(linkText("")).toBeNull();
    expect(linkText(null)).toBeNull();
    expect(linkText(3)).toBeNull();
    expect(linkText("[[ ]]")).toBeNull();
  });
});

describe("universe settings", () => {
  it("defaults: off, English names, every kind present", () => {
    const d = defaultUniverseSettings();
    expect(d.universeMode).toBe("off");
    expect(d.universeNote).toBe("Universe.md");
    expect(d.typeProperty).toBe("type");
    expect(d.formProperty).toBe("form");
    expect(Object.keys(d.entryTypes)).toEqual([...ENTRY_KINDS]);
    expect(d.entryTypes.character).toEqual({ value: "character", folder: "Characters", template: "", label: "Character" });
    expect(d.threadClosedWord).toBe("closed");
    expect(d.entryTypes.place.label).toBe("Place");
    expect(Object.keys(d.formValues)).toEqual([...FORM_KINDS]);
    expect(d.formValues.shortStory).toBe("short story");
  });
  it("defaults are fresh objects", () => {
    const a = defaultUniverseSettings();
    a.entryTypes.character.folder = "X";
    expect(defaultUniverseSettings().entryTypes.character.folder).toBe("Characters");
  });
  it("old data with none of the fields gets the defaults", () => {
    expect(normalizeUniverse({ chaptersFolder: "Chapters" })).toEqual(defaultUniverseSettings());
    expect(normalizeUniverse(undefined)).toEqual(defaultUniverseSettings());
  });
  it("keeps the writer's values, fills the rest, repairs wrong types", () => {
    const n = normalizeUniverse({
      universeMode: "universe", universeNote: " Universo.md ", threadClosedWord: " fechado ", typeProperty: 5,
      entryTypes: { character: { value: "personagem", folder: "Personagens" }, place: "x" },
      formValues: { shortStory: "conto" },
      defaultUniverseFolders: "Contos\nTextos",
    });
    expect(n.universeMode).toBe("universe");
    expect(n.universeNote).toBe("Universo.md");
    expect(n.threadClosedWord).toBe("fechado");
    expect(n.typeProperty).toBe("type");
    expect(n.entryTypes.character).toEqual({ value: "personagem", folder: "Personagens", template: "", label: "Character" });
    expect(n.entryTypes.place.folder).toBe("Places");
    expect(n.formValues).toMatchObject({ shortStory: "conto", novel: "novel" });
    expect(n.defaultUniverseFolders).toBe("Contos\nTextos");
  });
  it("an unknown mode is off", () => {
    expect(normalizeUniverse({ universeMode: "everything" }).universeMode).toBe("off");
  });
});

describe("the universe note path", () => {
  it("is one path however it was typed", () => {
    expect(universeNotePath("Universo/")).toBe("Universo.md");
    expect(universeNotePath("/Mundos/Universo")).toBe("Mundos/Universo.md");
    expect(universeNotePath("Universo.md")).toBe("Universo.md");
  });
  it("normalizeUniverse keeps it that way", () => {
    expect(normalizeUniverse({ universeNote: "Universo/" }).universeNote).toBe("Universo.md");
    expect(normalizeUniverse({ universeNote: " /A/B " }).universeNote).toBe("A/B.md");
    expect(normalizeUniverse({ universeNote: "" }).universeNote).toBe("Universe.md");
  });
});

describe("universe: false", () => {
  const w: World = {
    notes: ["Universe.md"],
    books: { "Novels/A Casa": "Novels/A Casa.md" },
    props: {
      "Universe/Characters/Ana.md": false,
      "Contos/Fora.md": false,
      "Universe.md": false,
      "Novels/A Casa.md": false,
      "Novels/A Casa/Chapters/02 Dentro.md": "[[Universe]]",
      "Novels/Solo.md": "[[Universe]]",
    },
  };
  const l = lookup(w);
  const sc = (path: string, s = base({ defaultUniverseFolders: "Contos" }), look = l) => scopeFor({ path }, s, look);
  const NONE = { kind: "none", root: "", note: null };

  it("beats the universe folder, a default folder and the universe note", () => {
    expect(sc("Universe/Characters/Ana.md")).toEqual(NONE);
    expect(sc("Contos/Fora.md")).toEqual(NONE);
    expect(sc("Universe.md")).toEqual(NONE);
  });

  it("on a book note keeps every file of the book out, at book scope", () => {
    const book = { kind: "book", root: "Novels/A Casa", note: "Novels/A Casa.md" };
    expect(sc("Novels/A Casa.md")).toEqual(book);
    expect(sc("Novels/A Casa/Chapters/01 X.md")).toEqual(book);
    expect(sc("Novels/A Casa/Characters/Ana.md")).toEqual(book);
  });

  it("a chapter's own link beats the book's false", () => {
    expect(sc("Novels/A Casa/Chapters/02 Dentro.md").kind).toBe("universe");
  });

  it("a chapter's own false beats the book note's link", () => {
    const l2 = lookup({ notes: ["Universe.md"], books: w.books, props: { "Novels/A Casa.md": "[[Universe]]", "Novels/A Casa/Chapters/01 X.md": false } });
    expect(sc("Novels/A Casa/Chapters/01 X.md", undefined, l2).kind).toBe("book");
    expect(sc("Novels/A Casa/Chapters/03 Y.md", undefined, l2).kind).toBe("universe");
  });

  it("per-book and off modes are unchanged", () => {
    expect(sc("Contos/Fora.md", base({ universeMode: "off" }))).toEqual(NONE);
    expect(sc("Novels/A Casa/Chapters/01 X.md", base({ universeMode: "perBook" })).kind).toBe("book");
    expect(sc("Contos/Fora.md", base({ universeMode: "perBook" }))).toEqual(NONE);
  });

  it("true, 0 and empty text behave as before", () => {
    for (const v of [true, 0, "", "0", "true"]) {
      const lv = lookup({ props: { "Universe/Characters/Ana.md": v } });
      expect(sc("Universe/Characters/Ana.md", undefined, lv).kind).toBe("universe");
      expect(keptOut("Universe/Characters/Ana.md", lv)).toBe(false);
    }
  });

  it("the string false counts, trimmed and in any case; a list does not", () => {
    for (const v of ["false", " False ", "FALSE"]) {
      const lv = lookup({ props: { "Universe/Characters/Ana.md": v } });
      expect(sc("Universe/Characters/Ana.md", undefined, lv)).toEqual(NONE);
      expect(keptOut("Universe/Characters/Ana.md", lv)).toBe(true);
    }
    const lv = lookup({ props: { "Universe/Characters/Ana.md": ["false"] } });
    expect(sc("Universe/Characters/Ana.md", undefined, lv).kind).toBe("universe");
    expect(keptOut("Universe/Characters/Ana.md", lv)).toBe(false);
  });

  it("keptOut: own false, book false without own link, own link wins, plain notes stay in", () => {
    expect(keptOut("Contos/Fora.md", l)).toBe(true);
    expect(keptOut("Novels/A Casa.md", l)).toBe(true);
    expect(keptOut("Novels/A Casa/Chapters/01 X.md", l)).toBe(true);
    expect(keptOut("Novels/A Casa/Chapters/02 Dentro.md", l)).toBe(false);
    expect(keptOut("Novels/Solo.md", l)).toBe(false);
    expect(keptOut("Other/Plain.md", l)).toBe(false);
  });
});
