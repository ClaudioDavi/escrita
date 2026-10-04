import { describe, it, expect } from "vitest";
import { UniverseNamesProvider } from "../src/universe/names-provider";
import type { Entry } from "../src/universe/entries";
import type { Scope } from "../src/universe/scope";
import { NamesPort } from "../src/core/names-source";
import { findNames, EMPTY_TABLE } from "../src/core/names";
import { ManualTimers } from "./support/memory-vault";

const U: Scope = { kind: "universe", root: "Universo", note: "Universo.md" };
const V: Scope = { kind: "universe", root: "Outro", note: "Outro.md" };
const B: Scope = { kind: "book", root: "Livro", note: "Livro.md" };
const NONE: Scope = { kind: "none", root: "", note: null };

const entry = (path: string, kind: Entry["kind"] = "character", aliases: string[] = [], over: Partial<Entry> = {}): Entry => ({
  path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), aliases, kind, caseSensitive: false, ignore: [], firstName: true, ...over,
});

function setup(timers?: ManualTimers) {
  const st = {
    entries: [entry("Universo/Inês Moura.md", "character", ["Inesinha"]), entry("Universo/Farol.md", "place"), entry("Outro/Zé.md")] as Entry[],
    scopes: { "Universo/A.md": U, "Universo/Inês Moura.md": U, "Universo/Farol.md": U, "Outro/Zé.md": V, "Livro/c1.md": B, "x.md": NONE } as Record<string, Scope>,
    titles: "",
  };
  const p = new UniverseNamesProvider({
    entries: () => st.entries,
    scopeOf: (path) => st.scopes[path] ?? NONE,
    language: () => "pt-BR",
    locale: () => "pt-BR",
    nameTitles: () => st.titles,
    timers,
  });
  let notified = 0;
  p.onChange(() => notified++);
  return { st, p, notified: () => notified };
}

describe("UniverseNamesProvider tables", () => {
  it("builds one table per scope and a global one over every entry", () => {
    const { p } = setup();
    const ids = (path: string) => [...new Set(p.tableFor(path).terms.map((t) => t.id))].sort();
    expect(ids("Universo/A.md")).toEqual(["Universo/Farol.md", "Universo/Inês Moura.md"]);
    expect(ids("Outro/Zé.md")).toEqual(["Outro/Zé.md"]);
    expect([...new Set(p.globalTable().terms.map((t) => t.id))].sort()).toEqual(["Outro/Zé.md", "Universo/Farol.md", "Universo/Inês Moura.md"]);
  });
  it("gives the same table object per scope and none for scope none", () => {
    const { p } = setup();
    expect(p.tableFor("Universo/A.md")).toBe(p.tableFor("Universo/Farol.md"));
    expect(p.tableFor("x.md")).toBe(EMPTY_TABLE);
    expect(p.tableFor("Livro/c1.md").terms).toHaveLength(0);
  });
  it("derives the first name for characters only, and matches through the table", () => {
    const { p } = setup();
    const t = p.tableFor("Universo/A.md");
    expect(t.terms.some((x) => x.origin === "first" && x.text === "Inês")).toBe(true);
    const occ = findNames("Ines chegou ao farol.", t);
    expect(occ.map((o) => o.candidates[0].id)).toEqual(["Universo/Inês Moura.md"]);
  });
  it("honours the per-entry options", () => {
    const { st, p } = setup();
    st.entries[0] = entry("Universo/Inês Moura.md", "character", [], { firstName: false });
    expect(p.tableFor("Universo/A.md").terms.some((x) => x.origin === "first")).toBe(false);
  });
});

describe("UniverseNamesProvider version", () => {
  it("is stable until a signature changes, and an alias edit bumps it once", () => {
    const { st, p, notified } = setup();
    p.tableFor("Universo/A.md");
    p.globalTable();
    const v = p.version();
    p.refresh();
    expect(p.version()).toBe(v);
    st.entries[0] = entry("Universo/Inês Moura.md", "character", ["Inesinha", "Nena"]);
    p.refresh();
    expect(p.version()).toBe(v + 1);
    expect(notified()).toBe(1);
    expect(p.tableFor("Universo/A.md").terms.some((x) => x.text === "Nena")).toBe(true);
  });
  it("a thread edit never reaches it (nothing to refresh), and a note's scope change alone does not bump", () => {
    const { st, p } = setup();
    p.tableFor("Livro/c1.md");
    p.globalTable();
    const v = p.version();
    st.scopes["Livro/c1.md"] = NONE; // a note (not an entry) changes scope: tables built so far are unchanged
    p.refresh();
    expect(p.version()).toBe(v);
  });
  it("an entry changing scope changes the tables of both and bumps", () => {
    const { st, p } = setup();
    p.tableFor("Universo/A.md");
    p.tableFor("Outro/Zé.md");
    const v = p.version();
    st.scopes["Outro/Zé.md"] = U;
    p.refresh();
    expect(p.version()).toBe(v + 1);
    expect(p.tableFor("Universo/A.md").terms.some((x) => x.id === "Outro/Zé.md")).toBe(true);
  });
});

describe("UniverseNamesProvider entryFor", () => {
  it("matches names and aliases by foldName within the scope", () => {
    const { p } = setup();
    expect(p.entryFor("Ines Moura", "Universo/A.md")).toEqual({ path: "Universo/Inês Moura.md", name: "Inês Moura" });
    expect(p.entryFor("INESINHA", "Universo/A.md")?.name).toBe("Inês Moura");
    expect(p.entryFor("Ze", "Universo/A.md")).toBeNull();
    expect(p.entryFor("Ze", "Outro/Zé.md")?.path).toBe("Outro/Zé.md");
    expect(p.entryFor("Farol", "x.md")).toBeNull();
    expect(p.entryFor("  ", "Universo/A.md")).toBeNull();
  });
  it("a name beats an alias that folds the same", () => {
    const { st, p } = setup();
    st.entries.unshift(entry("Universo/Outra.md", "character", ["Farol"]));
    expect(p.entryFor("farol", "Universo/A.md")?.path).toBe("Universo/Farol.md");
  });
});

describe("the port", () => {
  it("answers through the provider and is empty after withdraw", () => {
    const { p } = setup();
    const port = new NamesPort();
    const withdraw = port.provide(p);
    expect(port.tableFor("Universo/A.md").terms.length).toBeGreaterThan(0);
    expect(port.entryFor("Farol", "Universo/A.md")?.name).toBe("Farol");
    const v = port.version();
    withdraw();
    expect(port.tableFor("Universo/A.md")).toBe(EMPTY_TABLE);
    expect(port.entryFor("Farol", "Universo/A.md")).toBeNull();
    expect(port.version()).toBeGreaterThan(v);
  });
});

describe("UniverseNamesProvider refresh cost (finding 1, 2, 3)", () => {
  it("a no-op refresh keeps the same table objects and compiles nothing", () => {
    const { p, notified } = setup();
    const a = p.tableFor("Universo/A.md");
    const g = p.globalTable();
    const compiled = p.compiled;
    p.refresh();
    expect(p.tableFor("Universo/A.md")).toBe(a);
    expect(p.globalTable()).toBe(g);
    expect(p.compiled).toBe(compiled);
    expect(notified()).toBe(0);
  });

  it("an edit to one scope recompiles that scope and not the other", () => {
    const { st, p } = setup();
    const outro = p.tableFor("Outro/Zé.md");
    p.tableFor("Universo/A.md");
    p.refresh();                                   // both were asked for since the provider was built
    p.tableFor("Outro/Zé.md");
    p.tableFor("Universo/A.md");
    const compiled = p.compiled;
    st.entries[0] = entry("Universo/Inês Moura.md", "character", ["Inesinha", "Nena"]);
    p.refresh();
    expect(p.compiled).toBe(compiled + 1);
    expect(p.tableFor("Outro/Zé.md")).toBe(outro);
  });

  it("a table nobody asked for since the last refresh is dropped, and its change is still noticed", () => {
    const { st, p } = setup();
    const first = p.tableFor("Universo/A.md");
    p.refresh();                                   // asked since build: kept
    expect(p.tableFor("Universo/A.md")).toBe(first);
    p.refresh();                                   // not asked in between: dropped
    p.refresh();
    const compiled = p.compiled;
    const v = p.version();
    st.entries[0] = entry("Universo/Inês Moura.md", "character", ["Inesinha", "Nena"]);
    p.refresh();
    expect(p.compiled).toBe(compiled);             // nothing compiled for a table nobody holds
    expect(p.version()).toBe(v + 1);               // but a pass keyed on the version still re-runs
    const again = p.tableFor("Universo/A.md");
    expect(again).not.toBe(first);
    expect(again.terms.some((x) => x.text === "Nena")).toBe(true);
  });

  it("a change that leaves the compiled signature alone keeps the object and the version", () => {
    const { st, p } = setup();
    const t = p.tableFor("Universo/A.md");
    const v = p.version();
    st.entries[1] = entry("Universo/Farol.md", "place", [], {});
    st.entries.push(entry("Fora/Nada.md"));          // an entry in no scope: not in any table
    p.refresh();
    expect(p.tableFor("Universo/A.md")).toBe(t);
    expect(p.version()).toBe(v);
  });

  it("refreshSoon waits 300 ms of quiet and refreshes once", async () => {
    const timers = new ManualTimers();
    const { st, p, notified } = setup(timers);
    p.tableFor("Universo/A.md");
    st.entries[0] = entry("Universo/Inês Moura.md", "character", ["Inesinha", "Nena"]);
    p.refreshSoon();
    await timers.advance(200);
    p.refreshSoon();
    await timers.advance(200);
    expect(notified()).toBe(0);
    await timers.advance(100);
    expect(notified()).toBe(1);
    expect(timers.count).toBe(0);
  });

  it("dispose clears the pending refresh", async () => {
    const timers = new ManualTimers();
    const { p } = setup(timers);
    p.refreshSoon();
    expect(timers.count).toBe(1);
    p.dispose();
    expect(timers.count).toBe(0);
  });

  it("entryFor reads a per-scope map: 300 entries, 1,000 lookups, no per-call scan", () => {
    const entries = Array.from({ length: 300 }, (_, i) => entry(`Universo/Pessoa ${i}.md`, "character", [`Apelido ${i}`]));
    let scopeCalls = 0;
    const p = new UniverseNamesProvider({
      entries: () => entries,
      scopeOf: (path) => { scopeCalls++; return path.startsWith("Universo/") ? U : NONE; },
      language: () => "pt-BR", locale: () => "pt-BR", nameTitles: () => "",
    });
    p.entryFor("Pessoa 1", "Universo/A.md");
    const warm = scopeCalls;
    for (let i = 0; i < 1000; i++) expect(p.entryFor(`apelido ${i % 300}`, "Universo/A.md")?.name).toBe(`Pessoa ${i % 300}`);
    expect(scopeCalls - warm).toBe(1000);            // one scopeOf for the asking note, none per entry
  });
});
