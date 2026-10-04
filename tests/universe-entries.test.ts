import { describe, it, expect } from "vitest";
import { aliasesOf, boolOf, entriesIn, entriesSpec, entriesSettingsKey, phrasesOf, sameEntry, type ScopedEntry, foldText, groupByKind, isTemplatePath, kindOf, searchEntries, type Entry, type EntriesSettings } from "../src/universe/entries";
import { defaultUniverseSettings } from "../src/universe/settings";
import { VaultIndex } from "../src/core/vault-index";
import { MemoryVault, ManualTimers, type MemFile } from "./support/memory-vault";
import type { Scope } from "../src/universe/scope";

const U: Scope = { kind: "universe", root: "Universo", note: "Universo.md" };
const B: Scope = { kind: "book", root: "Romances/A Casa", note: "Romances/A Casa.md" };

function settings(over: Partial<EntriesSettings> = {}): EntriesSettings {
  const d = defaultUniverseSettings();
  d.entryTypes.character.value = "personagem";
  return { ...d, universeMode: "universe", chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "", ...over };
}

describe("kindOf", () => {
  const types = settings().entryTypes;
  it("matches the configured value without case or spacing", () => {
    expect(kindOf("Personagem ", types)).toBe("character");
    expect(kindOf(["place", "x"], types)).toBe("place");
    expect(kindOf("character", types)).toBeNull();
    expect(kindOf("", types)).toBeNull();
    expect(kindOf(undefined, types)).toBeNull();
  });
});

describe("aliasesOf", () => {
  it("reads lists and comma strings, from aliases or alias", () => {
    expect(aliasesOf({ aliases: ["Mari", " Mariana ", "Mari", 3, {}] })).toEqual(["Mari", "Mariana", "3"]);
    expect(aliasesOf({ alias: "a, b" })).toEqual(["a", "b"]);
    expect(aliasesOf({})).toEqual([]);
    expect(aliasesOf(undefined)).toEqual([]);
  });
});

describe("isTemplatePath", () => {
  it("covers the templates folder, entry templates and the chapter template", () => {
    const s = settings({ chapterTemplate: "Chap" });
    s.entryTypes.place.template = "Outros/Lugar.md";
    expect(isTemplatePath("Modelos/X.md", s)).toBe(true);
    expect(isTemplatePath("Outros/Lugar.md", s)).toBe(true);
    expect(isTemplatePath("Chap.md", s)).toBe(true);
    expect(isTemplatePath("Universo/Lugares/Y.md", s)).toBe(false);
  });
});

describe("queries", () => {
  const e = (name: string, kind: Entry["kind"], scope: Scope, aliases: string[] = []): ScopedEntry => ({ path: `${scope.root}/${name}.md`, name, kind, scope, aliases, caseSensitive: false, ignore: [], firstName: true });
  const all = [
    e("Teo", "character", U, ["Teodoro"]), e("O farol", "place", U), e("Ana", "character", U), e("Mãe", "character", U),
    e("Porão", "place", B),
  ];
  it("entriesIn sorts by type order then name and only returns the scope", () => {
    expect(entriesIn(all, U).map((x) => x.name)).toEqual(["Ana", "Mãe", "Teo", "O farol"]);
    expect(entriesIn(all, B).map((x) => x.name)).toEqual(["Porão"]);
    expect(entriesIn(all, { kind: "none", root: "", note: null })).toEqual([]);
  });
  it("groupByKind keeps every kind in order", () => {
    expect(groupByKind(entriesIn(all, U)).map((g) => [g.kind, g.entries.length])).toEqual([
      ["character", 3], ["place", 1], ["object", 0], ["group", 0], ["event", 0],
    ]);
  });
  it("search folds accents and looks in aliases", () => {
    expect(foldText("Mãe")).toBe("mae");
    expect(searchEntries(all, "mae").map((x) => x.name)).toEqual(["Mãe"]);
    expect(searchEntries(all, "teodo").map((x) => x.name)).toEqual(["Teo"]);
    expect(searchEntries(all, "  ")).toHaveLength(all.length);
  });
});

describe("entriesSpec on a vault index", () => {
  it("indexes typed notes only, skips templates and snapshots, and is empty when the mode is off", async () => {
    const vault = new MemoryVault({
      "Universo/Personagens/Ana.md": "x", "Universo/Lugares/Farol.md": "x", "Universo/Notas.md": "x",
      "Modelos/Personagem.md": "x", "Escrita/Snapshots/a.md": "x",
    });
    const fms: Record<string, Record<string, unknown>> = {
      "Universo/Personagens/Ana.md": { type: "personagem", aliases: ["Aninha"] },
      "Universo/Lugares/Farol.md": { type: "place" },
      "Universo/Notas.md": { type: "nope" },
      "Modelos/Personagem.md": { type: "personagem" },
      "Escrita/Snapshots/a.md": { type: "personagem" },
    };
    let s = settings();
    const spec = entriesSpec<MemFile>({ settings: () => s, frontmatter: (f) => fms[f.path] });
    const timers = new ManualTimers();
    const idx = new VaultIndex(spec, vault, timers);
    await idx.build();
    expect([...idx.entries()].map(([p, v]) => [p, v.kind, v.name, v.aliases])).toEqual([
      ["Universo/Personagens/Ana.md", "character", "Ana", ["Aninha"]],
      ["Universo/Lugares/Farol.md", "place", "Farol", []],
    ]);
    s = settings({ universeMode: "off" });
    await idx.build();
    expect(idx.size).toBe(0);
  });
});

const base: Entry = { path: "U/Ana.md", name: "Ana", aliases: ["Aninha"], kind: "character", caseSensitive: false, ignore: [], firstName: true };

describe("sameEntry", () => {
  it("is true for equal entries and false for each field that differs", () => {
    expect(sameEntry(base, { ...base, ignore: [] })).toBe(true);
    expect(sameEntry(base, { ...base, caseSensitive: true })).toBe(false);
    expect(sameEntry(base, { ...base, firstName: false })).toBe(false);
    expect(sameEntry(base, { ...base, ignore: ["rosa dos ventos"] })).toBe(false);
    expect(sameEntry(base, { ...base, aliases: [] })).toBe(false);
  });
  it("does not know a scope: entries never store one", () => {
    expect("scope" in base).toBe(false);
    expect(sameEntry({ ...base, scope: U } as Entry, { ...base, scope: B } as Entry)).toBe(true);
  });
});

describe("entry properties", () => {
  it("boolOf reads booleans and strings, with a fallback", () => {
    expect(boolOf(true, false)).toBe(true);
    expect(boolOf(" False ", true)).toBe(false);
    expect(boolOf("sim", true)).toBe(true);
    expect(boolOf(undefined, false)).toBe(false);
  });
  it("phrasesOf reads lists and comma strings", () => {
    expect(phrasesOf(["rosa dos ventos", " ", "rosa dos ventos", "x"])).toEqual(["rosa dos ventos", "x"]);
    expect(phrasesOf("a, b")).toEqual(["a", "b"]);
    expect(phrasesOf(undefined)).toEqual([]);
  });
  it("the spec reads the three properties through their setting names, and does not store scope", async () => {
    const vault = new MemoryVault({ "Universo/A.md": "x", "Universo/B.md": "x" });
    const fms: Record<string, Record<string, unknown>> = {
      "Universo/A.md": { type: "personagem", cs: true, skip: ["rosa dos ventos"], first: "false" },
      "Universo/B.md": { type: "personagem" },
    };
    const s = settings({ caseSensitiveProperty: "cs", ignoreProperty: "skip", firstNameProperty: "first" });
    const idx = new VaultIndex(entriesSpec<MemFile>({ settings: () => s, frontmatter: (f) => fms[f.path] }), vault, new ManualTimers());
    await idx.build();
    const a = idx.get("Universo/A.md")!;
    expect([a.caseSensitive, a.ignore, a.firstName]).toEqual([true, ["rosa dos ventos"], false]);
    const b = idx.get("Universo/B.md")!;
    expect([b.caseSensitive, b.ignore, b.firstName]).toEqual([false, [], true]);
    expect("scope" in a).toBe(false);
  });
  it("the spec is not structural, and its settings key includes the property names", () => {
    const spec = entriesSpec<MemFile>({ settings: () => settings(), frontmatter: () => undefined });
    expect(spec.structural).toBeFalsy();
    const k = entriesSettingsKey(settings());
    for (const o of [{ caseSensitiveProperty: "x" }, { ignoreProperty: "x" }, { firstNameProperty: "x" }]) {
      expect(entriesSettingsKey(settings(o))).not.toBe(k);
    }
  });
});
