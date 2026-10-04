import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { compileTerms, type NameSource, type TermTable } from "../src/core/names";
import { MentionsIndex, MENTIONS_INDEX_NAME } from "../src/universe/mentions-index";
import type { MentionCtx } from "../src/universe/mentions";
import type { EntriesSettings } from "../src/universe/entries";
import { defaultUniverseSettings } from "../src/universe/settings";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

const src = (id: string, name: string, aliases: string[] = []): NameSource => ({
  id, name, aliases, person: true, firstName: false, caseSensitive: false, ignore: [],
});
const table = (sources: NameSource[]): TermTable => compileTerms(sources, { lang: "pt", extraTitles: [] });

function settings(): EntriesSettings {
  return { ...defaultUniverseSettings(), universeMode: "universe", chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "" };
}

class CountingTimers extends ManualTimers {
  yields = 0;
  override yieldNow(): Promise<void> { this.yields++; return super.yieldNow(); }
}

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

function setup(files: Record<string, string>, sources: NameSource[], opts: { batch?: number; resolve?: (l: string, from: string) => string | null; timers?: ManualTimers } = {}) {
  const vault = new MemoryVault(files);
  const timers = opts.timers ?? new ManualTimers();
  const cbs = { modify: [] as ((f: MemFile) => void)[], rename: [] as ((f: MemFile, o: string) => void)[], del: [] as ((f: MemFile) => void)[], create: [] as ((f: MemFile) => void)[] };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb),
    onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.del.push(cb),
    onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: () => {},
    onResolved: () => {},
    onLayoutReady: (cb) => cb(),
    layoutReady: () => true,
    hasCache: () => true,
  };
  vault.onEvent((e) => {
    if (e.type === "create") cbs.create.forEach((c) => c(e.file));
    else if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.del.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "", text: "" }, e.oldPath));
  });
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots", batch: opts.batch });
  const state = { table: table(sources) };
  const mentions = new MentionsIndex<MemFile>({
    add: (spec) => hub.add(spec),
    remove: (ix) => hub.remove(ix),
    rebuild: (n) => hub.rebuild(n),
    table: () => state.table,
    settings,
    resolve: opts.resolve ?? (() => null),
    timers,
  });
  return { vault, timers, hub, mentions, state };
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
    await settle();
    expect(s.mentions.isReady()).toBe(true);
    expect(s.vault.readCount).toBe(2);                       // templates and snapshots are not scanned
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    expect(s.mentions.get("Contos/b.md")).toBeUndefined();   // nothing found: nothing stored (Q31)
    s.mentions.start();                                      // a second call does not add a second index
    await s.timers.advance(5000);
    expect(s.vault.readCount).toBe(2);
  });

  it("follows modify (after the 300 ms settle), rename and delete", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.start();
    await settle();
    let fired = 0;
    s.mentions.onChange(() => fired++);
    s.vault.modify("Contos/a.md", "Teo e Teo.");
    await s.timers.advance(299);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    await s.timers.advance(1);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
    expect(fired).toBeGreaterThan(0);
    s.vault.rename("Contos/a.md", "Contos/b.md");
    await s.timers.advance(400);
    expect(s.mentions.get("Contos/a.md")).toBeUndefined();
    expect(s.mentions.get("Contos/b.md")?.occurrences).toHaveLength(2);
    s.vault.delete("Contos/b.md");
    await s.timers.advance(0);
    expect(s.mentions.get("Contos/b.md")).toBeUndefined();
  });

  it("a work's rename moves its notes' mentions and counts follow", async () => {
    const s = setup({ "Contos/Obra/c1.md": "Teo.", "Contos/Obra/c2.md": "Teo." }, [A]);
    s.mentions.start();
    await settle();
    s.vault.rename("Contos/Obra", "Contos/Nova");
    await s.timers.advance(400);
    expect(s.mentions.get("Contos/Nova/c1.md")).toBeDefined();
    expect(s.mentions.get("Contos/Obra/c1.md")).toBeUndefined();
    s.vault.delete("Contos/Nova");
    await s.timers.advance(0);
    expect(s.mentions.get("Contos/Nova/c2.md")).toBeUndefined();
  });

  it("an alias change rebuilds once after 2 s and keeps the old values until done", async () => {
    const s = setup({ "Contos/a.md": "Quica chegou. Teo também." }, [A, B]);
    s.mentions.start();
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
    await settle();
    await s.timers.advance(5000);
    expect(s.vault.readCount).toBe(1);               // one full build, no second one 2 s later
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
  });

  it("is empty before it is ready and after dispose", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    expect(s.mentions.workCount(A.id, ctx(A.id))).toBe(0);
    s.mentions.start();
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
    await settle();
    const c = () => ctx(A.id);
    expect(s.mentions.appearsIn(A.id, c()).total).toBe(1);
    s.vault.modify("Contos/a.md", "Teo, Teo.");
    await s.timers.advance(300);
    expect(s.mentions.appearsIn(A.id, c()).total).toBe(2);
  });
});

// CI ceilings from G0h. Desktop: segment + readerMask + findNames cost 1.9-2.2 ms per 1,000
// words with 300 entries (docs/PLAN-0.7.md, G0h). The phone figure is still open, so these
// are derived from the desktop figure alone. Model: 2.2 ms per 1,000 words x the vault's
// words; ceiling = model x 5, the margin names.test.ts uses (20 ms budget, 100 ms ceiling) to
// catch quadratic code without failing on a loaded CI runner.
const MS_PER_1000_WORDS = 2.2;
const MARGIN = 5;
const WORDS_PER_NOTE = 2000;

function bigVault(notes: number) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const first = ["Maria", "João", "Zélia", "Luísa", "Sebastião", "Conceição", "Ângela", "Inácio", "Têmis", "Joaquim"];
  const last = ["Silva", "Antunes", "Magalhães", "Albuquerque", "Pôrto", "Guimarães", "Vasconcelos", "Nóbrega", "Cavalcanti", "Rêgo"];
  const filler = "o a de que e do da em um para com não uma os no se na por mais as dos como mas ao ele das seu sua ou quando muito casa tempo caminho janela chuva silêncio porta mão noite olhar vento rua cidade manhã lembrança voz mar luz".split(" ");
  const sources: NameSource[] = [];
  for (let i = 0; i < 300; i++) {
    sources.push(src(`Universo/${i}.md`, `${first[i % 10]} ${last[(i / 10 | 0) % 10]} ${String.fromCharCode(65 + (i / 100 | 0))}`, [`${first[(i + 3) % 10]} ${last[(i / 7 | 0) % 10]}inho`]));
  }
  const forms = sources.flatMap((x) => [x.name.replace(/ [A-C]$/, ""), ...x.aliases]);
  const variants: string[] = [];
  for (let v = 0; v < 20; v++) {
    const words: string[] = [];
    for (let w = 0; w < WORDS_PER_NOTE; w++) words.push(rnd() < 0.02 ? forms[Math.floor(rnd() * forms.length)]! : filler[Math.floor(rnd() * filler.length)]!);
    const paras: string[] = [];
    for (let i = 0; i < words.length; i += 40) paras.push(words.slice(i, i + 40).join(" ") + ".");
    variants.push(paras.join("\n\n"));
  }
  const files: Record<string, string> = {};
  for (let n = 0; n < notes; n++) files[`Contos/n${n}.md`] = variants[n % variants.length]!;
  return { files, sources };
}

describe("MentionsIndex performance (CI ceilings from G0h)", () => {
  for (const notes of [500, 5000]) {
    it(`${notes} notes of ${WORDS_PER_NOTE} words, 300 entries: under the ceiling, yielding between batches`, async () => {
      const { files, sources } = bigVault(notes);
      const timers = new CountingTimers();
      const s = setup(files, sources, { timers });
      const t0 = performance.now();
      s.mentions.start();
      while (!s.mentions.isReady()) await new Promise((r) => setTimeout(r, 5));
      const took = performance.now() - t0;
      const ceiling = (notes * WORDS_PER_NOTE / 1000) * MS_PER_1000_WORDS * MARGIN;
      expect(took).toBeLessThan(ceiling);
      expect(timers.yields).toBeGreaterThanOrEqual(Math.floor(notes / 40));    // default batch 40
      expect(s.mentions.get("Contos/n0.md")?.occurrences.length).toBeGreaterThan(10);
    }, 300_000);
  }
});
