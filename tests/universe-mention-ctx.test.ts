import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { compileTerms, type NameSource } from "../src/core/names";
import { MentionCtxFactory, type MentionCtxDeps } from "../src/universe/mention-ctx";
import { MentionsIndex } from "../src/universe/mentions-index";
import type { EntriesSettings } from "../src/universe/entries";
import type { Scope } from "../src/universe/scope";
import { defaultUniverseSettings } from "../src/universe/settings";
import type { WorkInfo } from "../src/universe/works-list";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

const U: Scope = { kind: "universe", root: "Universo", note: "Universo.md" };
const V: Scope = { kind: "universe", root: "Outro", note: "Outro.md" };
const NONE: Scope = { kind: "none", root: "", note: null };

const TEO = "Universo/Teo.md";
const files: Record<string, string> = {
  "Livros/Casa.md": "Teo abre a porta.",
  "Livros/Casa/Capítulos/01 Chegada.md": "Teo chegou.",
  "Livros/Casa/Capítulos/02 Porão.md": "Veja [[Teo]] e Teo.",
  "Contos/Faca.md": "Teo tem uma faca.",
  "Outro/Nota.md": "Teo em outro universo.",
  "Soltas/x.md": "Teo sem universo.",
  "Livros/Casa/Rascunho.md": "Teo num arquivo do livro.",
};

const works: WorkInfo[] = [
  { path: "Livros/Casa.md", title: "Casa", stage: "draft", form: "novel", role: "book" },
  { path: "Contos/Faca.md", title: "Faca", stage: "published", form: "shortStory", role: "note" },
  { path: "Outro/Nota.md", title: "Nota", stage: "draft", form: null, role: "note" },
];

function setup() {
  const scopes: Record<string, Scope> = {};
  const scopeOf = (path: string): Scope => {
    if (scopes[path]) return scopes[path]!;
    if (/^(Universo|Livros|Contos)\//.test(path)) return U;
    return path.startsWith("Outro/") ? V : NONE;
  };
  const vault = new MemoryVault(files);
  const base = (p: string) => p.slice(p.lastIndexOf("/") + 1).replace(/\.md$/, "");
  const calls = { scope: 0, worksIn: 0 };
  const deps: MentionCtxDeps = {
    scopeOf: (p) => { calls.scope++; return scopeOf(p); },
    resolve: (link) => vault.files().find((f) => base(f.path) === link)?.path ?? null,
    place: (path) => {
      if (path === "Livros/Casa.md") return { kind: "book-note", book: path };
      if (path.startsWith("Livros/Casa/Capítulos/")) return { kind: "chapter", book: "Livros/Casa.md" };
      return null;
    },
    chapters: () => ["Livros/Casa/Capítulos/01 Chegada.md", "Livros/Casa/Capítulos/02 Porão.md"],
    isWork: (p) => works.some((w) => w.path === p),
    worksIn: (scope) => { calls.worksIn++; return works.filter((w) => scopeOf(w.path).root === scope.root && scope.kind !== "none"); },
  };
  const factory = new MentionCtxFactory(deps);
  return { scopes, factory, vault, calls, deps };
}

describe("MentionCtx: workOf", () => {
  it("a book's chapters carry the chapter's position, the book note none", () => {
    const { factory } = setup();
    const c = factory.ctx(TEO);
    expect(c.workOf("Livros/Casa.md")).toEqual({ work: "Livros/Casa.md", chapter: null });
    expect(c.workOf("Livros/Casa/Capítulos/01 Chegada.md")).toEqual({ work: "Livros/Casa.md", chapter: 1 });
    expect(c.workOf("Livros/Casa/Capítulos/02 Porão.md")).toEqual({ work: "Livros/Casa.md", chapter: 2 });
  });
  it("a standalone work is its own work; a loose note and a file inside a book are other notes", () => {
    const { factory } = setup();
    const c = factory.ctx(TEO);
    expect(c.workOf("Contos/Faca.md")).toEqual({ work: "Contos/Faca.md", chapter: null });
    expect(c.workOf("Soltas/x.md")).toBeNull();
    expect(c.workOf("Livros/Casa/Rascunho.md")).toBeNull();
    expect(c.workOf(TEO)).toBeNull();
  });
  it("a chapter of a book that is not a work is an other note", () => {
    const { factory, deps } = setup();
    const f = new MentionCtxFactory({ ...deps, isWork: () => false });
    expect(f.ctx(TEO).workOf("Livros/Casa/Capítulos/01 Chegada.md")).toBeNull();
  });
});

describe("MentionCtx: scope and rank", () => {
  it("only notes in the entry's scope count; a note with no scope never does", () => {
    const { factory } = setup();
    const c = factory.ctx(TEO);
    expect(c.inScope("Livros/Casa.md")).toBe(true);
    expect(c.inScope("Outro/Nota.md")).toBe(false);
    expect(c.inScope("Soltas/x.md")).toBe(false);
    expect(factory.ctx("Soltas/x.md").inScope("Soltas/x.md")).toBe(false);   // an entry with no scope has no notes
  });
  it("a candidate counts only when its entry is in the note's own scope", () => {
    const { factory } = setup();
    const c = factory.ctx(TEO);
    expect(c.candidateInScope("Livros/Casa.md", TEO)).toBe(true);
    expect(c.candidateInScope("Outro/Nota.md", TEO)).toBe(false);
    expect(c.candidateInScope("Soltas/x.md", "Soltas/y.md")).toBe(false);
  });
  it("ranks works as the Works tab does: forms first (stories before novels), then by stage", () => {
    const { factory } = setup();
    const c = factory.ctx(TEO);
    expect(c.workRank("Contos/Faca.md")).toBeLessThan(c.workRank("Livros/Casa.md"));
    expect(c.workRank("Outro/Nota.md")).toBeGreaterThan(c.workRank("Livros/Casa.md") - 1);   // out of scope: ranked last
    expect(c.workRank("Outro/Nota.md")).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("reads each note's scope once until reset(), then again", () => {
    const { factory, scopes, calls } = setup();
    const c = factory.ctx(TEO);
    c.inScope("Contos/Faca.md");
    c.inScope("Contos/Faca.md");
    const reads = calls.scope;
    c.inScope("Contos/Faca.md");
    expect(calls.scope).toBe(reads);
    scopes["Contos/Faca.md"] = V;                       // the note's universe property changed
    expect(factory.ctx(TEO).inScope("Contos/Faca.md")).toBe(true);    // still the memo
    factory.reset();
    expect(factory.ctx(TEO).inScope("Contos/Faca.md")).toBe(false);
  });
  it("builds the rank table once per scope until reset()", () => {
    const { factory, calls } = setup();
    const c = factory.ctx(TEO);
    c.workRank("Livros/Casa.md");
    c.workRank("Contos/Faca.md");
    factory.ctx(TEO).workRank("Livros/Casa.md");
    expect(calls.worksIn).toBe(1);
    factory.reset();
    factory.ctx(TEO).workRank("Livros/Casa.md");
    expect(calls.worksIn).toBe(2);
  });
  it("resolves a link from a note through the dependency", () => {
    const { factory } = setup();
    expect(factory.ctx(TEO).resolve("Teo", "Livros/Casa/Capítulos/02 Porão.md")).toBeNull();   // no such file by that basename
    expect(factory.ctx(TEO).resolve("Faca", "Livros/Casa.md")).toBe("Contos/Faca.md");
  });
});

describe("MentionCtx over the mentions index", () => {
  const teo: NameSource = { id: TEO, name: "Teo", aliases: [], person: true, firstName: false, caseSensitive: false, ignore: [] };

  async function run() {
    const s = setup();
    const timers = new ManualTimers();
    const cbs: ((f: MemFile) => void)[] = [];
    const events: HubEvents<MemFile> = {
      onCreate: () => {}, onModify: (cb) => void cbs.push(cb), onDelete: () => {}, onRename: () => {},
      onMetaChanged: () => {}, onResolved: () => {}, onLayoutReady: (cb) => cb(), layoutReady: () => true, hasCache: () => true,
    };
    const hub = new IndexHub<MemFile>(events, s.vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
    const settings: EntriesSettings = { ...defaultUniverseSettings(), universeMode: "universe", chaptersFolder: "Capítulos", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "" };
    const table = compileTerms([teo], { lang: "pt", extraTitles: [] });
    const mentions = new MentionsIndex<MemFile>({
      add: (spec) => hub.add(spec), rebuild: (n) => hub.rebuild(n), table: () => table, settings: () => settings,
      resolve: (l, f) => s.deps.resolve(l, f), timers,
    });
    mentions.start();
    mentions.demand();
    while (!mentions.isReady()) await settle();
    return { ...s, mentions };
  }

  it("groups a book with its chapters, a story, and the other notes; leaves out other universes and loose notes", async () => {
    const { mentions, factory } = await run();
    const r = mentions.appearsIn(TEO, factory.ctx(TEO));
    expect(r.works.map((w) => w.work)).toEqual(["Contos/Faca.md", "Livros/Casa.md"]);
    const casa = r.works[1]!;
    expect(casa.notes.map((n) => n.path)).toEqual(["Livros/Casa.md", "Livros/Casa/Capítulos/01 Chegada.md", "Livros/Casa/Capítulos/02 Porão.md"]);
    expect(casa.firstChapter).toBe("Livros/Casa/Capítulos/01 Chegada.md");
    expect(casa.lastChapter).toBe("Livros/Casa/Capítulos/02 Porão.md");
    expect(casa.notes[2]!.count).toBe(1);                // "[[Teo]] e Teo": the link has no note to resolve to here, so only the bare name counts
    expect(r.other.map((n) => n.path)).toEqual(["Livros/Casa/Rascunho.md"]);
    expect(r.workCount).toBe(2);
  });

  it("after a scope change and reset(), the note moves out of the answer", async () => {
    const { mentions, factory, scopes } = await run();
    expect(mentions.appearsIn(TEO, factory.ctx(TEO)).works.map((w) => w.work)).toContain("Contos/Faca.md");
    scopes["Contos/Faca.md"] = V;
    mentions.scopeChanged();
    factory.reset();
    expect(mentions.appearsIn(TEO, factory.ctx(TEO)).works.map((w) => w.work)).not.toContain("Contos/Faca.md");
  });
});
