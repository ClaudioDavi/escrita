import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { compileTerms, type NameSource, type TermTable } from "../src/core/names";
import { MentionsIndex, MENTIONS_INDEX_NAME } from "../src/universe/mentions-index";
import type { MentionCtx } from "../src/universe/mentions";
import type { EntriesSettings } from "../src/universe/entries";
import { defaultUniverseSettings } from "../src/universe/settings";
import { settle } from "./support/memory-vault";
import { setup, src, table } from "./support/mentions-setup";

function ctx(entry: string, over: Partial<MentionCtx> = {}): MentionCtx {
  return {
    entry,
    inScope: () => true,
    candidateInScope: () => true,
    resolve: () => null,
    workOf: () => null,
    workRank: () => 0,
    ...over,
  };
}

const A = src("Universo/Teo.md", "Teo");
const B = src("Universo/Ana.md", "Ana", ["Quica"]);

describe("MentionsIndex lifecycle", () => {
  it("scans nothing before start, then builds once", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou.", "Contos/b.md": "Nada aqui.", "Modelos/t.md": "Teo", "Escrita/Snapshots/x.md": "Teo" }, [A]);
    await settle();
    expect(s.vault.readCount).toBe(0);
    expect(s.mentions.isReady()).toBe(false);
    expect(s.mentions.started).toBe(false);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    expect(s.mentions.isReady()).toBe(true);
    expect(s.vault.readCount).toBe(2);                       // templates and snapshots are not scanned
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    expect(s.mentions.get("Contos/b.md")).toBeUndefined();   // nothing found: nothing stored (Q31)
    s.mentions.start();                                      // a second call does not add a second index
    await s.timers.advance(5000);
    expect(s.vault.readCount).toBe(2);
  });

  it("follows modify (after the 4 s settle), rename and delete", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    let fired = 0;
    s.mentions.onChange(() => fired++);
    s.vault.modify("Contos/a.md", "Teo e Teo.");
    await s.timers.advance(3999);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    await s.timers.advance(1);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
    expect(fired).toBeGreaterThan(0);
    s.vault.rename("Contos/a.md", "Contos/b.md");
    await s.timers.advance(4000);
    expect(s.mentions.get("Contos/a.md")).toBeUndefined();
    expect(s.mentions.get("Contos/b.md")?.occurrences).toHaveLength(2);
    s.vault.delete("Contos/b.md");
    await s.timers.advance(0);
    expect(s.mentions.get("Contos/b.md")).toBeUndefined();
  });

  it("a work's rename moves its notes' mentions and counts follow", async () => {
    const s = setup({ "Contos/Obra/c1.md": "Teo.", "Contos/Obra/c2.md": "Teo." }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    s.vault.rename("Contos/Obra", "Contos/Nova");
    await s.timers.advance(4000);
    expect(s.mentions.get("Contos/Nova/c1.md")).toBeDefined();
    expect(s.mentions.get("Contos/Obra/c1.md")).toBeUndefined();
    s.vault.delete("Contos/Nova");
    await s.timers.advance(0);
    expect(s.mentions.get("Contos/Nova/c2.md")).toBeUndefined();
  });

  it("an alias change rebuilds once after 2 s and keeps the old values until done", async () => {
    const s = setup({ "Contos/a.md": "Quica chegou. Teo também." }, [A, B]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
    const reads = s.vault.readCount;

    s.state.table = table([A, src("Universo/Ana.md", "Ana")]);       // the alias is gone
    s.mentions.tableChanged();
    await s.timers.advance(1999);
    expect(s.vault.readCount).toBe(reads);
    s.vault.manualReads = true;
    await s.timers.advance(1);
    expect(s.vault.pendingReads.length).toBe(1);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);   // old values stay visible
    s.vault.manualReads = false;
    s.vault.resolveAllReads();
    await settle();
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    expect(s.vault.readCount).toBe(reads + 1);
  });

  it("several table changes inside 2 s make one rebuild", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    const reads = s.vault.readCount;
    for (const n of ["X", "Y", "Z"]) {
      s.state.table = table([A, src(`Universo/${n}.md`, n + "ana")]);
      s.mentions.tableChanged();
      await s.timers.advance(1500);
    }
    expect(s.vault.readCount).toBe(reads);
    await s.timers.advance(500);
    expect(s.vault.readCount).toBe(reads + 1);
  });

  it("a thread edit or a scope-only change leaves the signature alone and doesn't rebuild", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    const reads = s.vault.readCount;
    s.state.table = table([A]);                      // a new table object, same signature
    s.mentions.tableChanged();
    await s.timers.advance(5000);
    expect(s.vault.readCount).toBe(reads);
  });

  it("does not schedule anything before start, and the first build reads the table as it is then", async () => {
    const s = setup({ "Contos/a.md": "Teo e Ana" }, [A]);
    s.mentions.tableChanged();
    expect(s.timers.count).toBe(0);
    s.state.table = table([A, B]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    await s.timers.advance(5000);
    expect(s.vault.readCount).toBe(1);               // one full build, no second one 2 s later
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
  });

  it("is empty before it is ready and after dispose", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    expect(s.mentions.workCount(A.id, ctx(A.id))).toBe(0);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    expect(s.mentions.workCount(A.id, ctx(A.id, { workOf: () => ({ work: "W", chapter: null }) }))).toBe(1);
    s.mentions.dispose();
    expect(s.mentions.started).toBe(false);
    expect(s.mentions.isReady()).toBe(false);
    s.vault.modify("Contos/a.md", "Teo Teo");
    await s.timers.advance(1000);
    expect(s.mentions.get("Contos/a.md")).toBeUndefined();
    expect(s.hub.rebuild(MENTIONS_INDEX_NAME)).toBeUndefined();
  });
});

describe("MentionsIndex queries", () => {
  it("reads a per-entry aggregate: 300 entries' counts without walking every note per entry", async () => {
    const sources: NameSource[] = [];
    const files: Record<string, string> = {};
    for (let i = 0; i < 300; i++) sources.push(src(`Universo/E${i}.md`, `Nomex${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) | 0))}`));
    for (let n = 0; n < 200; n++) {
      // each note mentions two entries only
      files[`Contos/n${n}.md`] = `${sources[n]!.name} e ${sources[n + 50]!.name} foram.`;
    }
    const s = setup(files, sources);
    s.mentions.start();
    s.mentions.demand();
    while (!s.mentions.isReady()) await settle();
    let scopeCalls = 0;
    const work = (p: string) => ({ work: p.split("/")[0]!, chapter: null });
    let total = 0;
    for (const e of sources) {
      total += s.mentions.workCount(e.id, ctx(e.id, { inScope: () => (scopeCalls++, true), workOf: work }));
    }
    expect(total).toBe(250);                                // entries 0-249 are each in at least one note
    // a walk would call inScope once per note per entry: 300 x 200 = 60,000
    expect(scopeCalls).toBeLessThanOrEqual(400);
    const again = scopeCalls;
    s.mentions.workCount(sources[0]!.id, ctx(sources[0]!.id, { inScope: () => (scopeCalls++, true) }));
    expect(scopeCalls).toBe(again);                         // answered from the cache until the next change
  });

  it("counts links through the resolver, and scopeChanged re-resolves them", async () => {
    const target = { v: "Universo/Teo.md" as string | null };
    const s = setup({ "Contos/a.md": "Veja [[Teo]] hoje." }, [], { resolve: () => target.v });
    s.mentions.start();
    s.mentions.demand();
    await settle();
    const w = (p: string) => ({ work: "W", chapter: p === "x" ? 1 : null });
    expect(s.mentions.appearsIn("Universo/Teo.md", ctx("Universo/Teo.md", { resolve: () => target.v, workOf: w })).total).toBe(1);
    target.v = "Universo/Outro.md";
    s.mentions.scopeChanged();
    expect(s.mentions.appearsIn("Universo/Teo.md", ctx("Universo/Teo.md", { resolve: () => target.v, workOf: w })).total).toBe(0);
    expect(s.mentions.appearsIn("Universo/Outro.md", ctx("Universo/Outro.md", { resolve: () => target.v, workOf: w })).total).toBe(1);
  });

  it("answers again after an edit changes the counts", async () => {
    const s = setup({ "Contos/a.md": "Teo." }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    const c = () => ctx(A.id);
    expect(s.mentions.appearsIn(A.id, c()).total).toBe(1);
    s.vault.modify("Contos/a.md", "Teo, Teo.");
    await s.timers.advance(4000);
    expect(s.mentions.appearsIn(A.id, c()).total).toBe(2);
  });
});

describe("MentionsIndex lookup maps follow an edit for the changed note only (finding 4)", () => {
  const wk = (p: string) => ({ work: p.split("/")[0]!, chapter: null });

  async function built(extra: Record<string, string> = {}) {
    const resolves = { n: 0 };
    const files: Record<string, string> = { "Contos/a.md": "Teo e [[Teo]].", "Contos/b.md": "Ana sozinha.", ...extra };
    for (let i = 0; i < 20; i++) files[`Contos/l${i}.md`] = `Ver [[Ana]] ${i}.`;
    const s = setup(files, [A, B], { resolve: (l) => { resolves.n++; return l === "Teo" ? A.id : l === "Ana" ? B.id : null; } });
    s.mentions.start();
    s.mentions.demand();
    await settle();
    const c = (id: string) => ctx(id, { workOf: wk, resolve: (l) => (l === "Teo" ? A.id : l === "Ana" ? B.id : null) });
    return { s, resolves, c };
  }

  it("an edit resolves the changed note's links only, not the vault's", async () => {
    const { s, resolves, c } = await built();
    s.mentions.appearsIn(B.id, c(B.id));                    // builds the maps: every note's links resolved once
    const built1 = resolves.n;
    expect(built1).toBeGreaterThanOrEqual(20);
    s.vault.modify("Contos/b.md", "Ana e [[Ana]] sozinha.");
    await s.timers.advance(4000);
    expect(s.mentions.appearsIn(B.id, c(B.id)).total).toBe(22);   // 20 links, and b's name and link
    expect(resolves.n - built1).toBeLessThanOrEqual(2);
  });

  it("an answer for an entry the edit did not touch is the same object", async () => {
    const { s, c } = await built();
    const forA = s.mentions.appearsIn(A.id, c(A.id));
    const forB = s.mentions.appearsIn(B.id, c(B.id));
    s.vault.modify("Contos/b.md", "Ana e Ana.");
    await s.timers.advance(4000);
    expect(s.mentions.appearsIn(A.id, c(A.id))).toBe(forA);
    expect(s.mentions.appearsIn(B.id, c(B.id))).not.toBe(forB);
  });

  it("a note that stops mentioning an entry leaves its list", async () => {
    const { s, c } = await built();
    expect(s.mentions.appearsIn(A.id, c(A.id)).total).toBe(2);
    s.vault.modify("Contos/a.md", "Nada.");
    await s.timers.advance(4000);
    expect(s.mentions.appearsIn(A.id, c(A.id)).total).toBe(0);
    s.vault.modify("Contos/a.md", "Teo voltou.");
    await s.timers.advance(4000);
    expect(s.mentions.appearsIn(A.id, c(A.id)).total).toBe(1);
  });

  it("a rename moves the note in the maps, and scopeChanged is what re-resolves every link", async () => {
    const { s, resolves, c } = await built();
    s.mentions.appearsIn(A.id, c(A.id));
    s.vault.rename("Contos/a.md", "Contos/z.md");
    await s.timers.advance(4000);
    const r = s.mentions.appearsIn(A.id, c(A.id));
    expect(r.other.length + r.works.flatMap((w) => w.notes).length).toBe(1);
    expect(r.works.flatMap((w) => w.notes.map((n) => n.path))).toEqual(["Contos/z.md"]);
    const before = resolves.n;
    s.mentions.appearsIn(A.id, c(A.id));
    expect(resolves.n).toBe(before);                         // cached
    s.mentions.scopeChanged();
    s.mentions.appearsIn(B.id, c(B.id));
    expect(resolves.n - before).toBeGreaterThanOrEqual(20);
  });
});
