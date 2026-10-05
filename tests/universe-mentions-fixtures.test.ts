// The names fixtures (task 0.2, frozen after G3) through the mentions index (task 3.2): the
// per-entry counts the index gives must be the counts the expected files list, and the
// whole table is pinned as a snapshot so a matcher change shows up as a diff here.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { compileTerms, type NameSource } from "../src/core/names";
import { defaultUniverseSettings } from "../src/universe/settings";
import { MentionsIndex } from "../src/universe/mentions-index";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

const read = (n: string) => readFileSync(new URL(`./fixtures/names/${n}`, import.meta.url), "utf8");
const rows = (s: string) => s.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));

interface Entry { src: NameSource; lang: string; scopes: string[] }
const entries: Entry[] = rows(read("entries.tsv")).map((c) => {
  const o = new Map(c[4].split(";").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)] as const));
  return {
    lang: o.get("lang")!,
    scopes: (o.get("scope") ?? "base").split("|"),
    src: {
      id: c[0], name: c[1], aliases: c[2] ? c[2].split("|") : [], person: c[3] === "character",
      firstName: o.get("firstName") !== "false", caseSensitive: o.get("caseSensitive") === "true",
      ignore: o.get("ignore") ? o.get("ignore")!.split("|") : [],
    },
  };
});

async function indexFor(files: Record<string, string>, table: ReturnType<typeof compileTerms>, resolve: (linkpath: string) => string | null) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const events: HubEvents<MemFile> = {
    onCreate: () => {}, onModify: () => {}, onDelete: () => {}, onRename: () => {}, onMetaChanged: () => {},
    onResolved: () => {}, onLayoutReady: (cb) => cb(), layoutReady: () => true, hasCache: () => true,
  };
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
  const mentions = new MentionsIndex<MemFile>({
    add: (s) => hub.add(s),
    rebuild: (n) => hub.rebuild(n),
    table: () => table,
    settings: () => ({ ...defaultUniverseSettings(), universeMode: "universe", chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "" }),
    resolve,
    timers,
  });
  mentions.start();
  mentions.demand();
  while (!mentions.isReady()) await settle();
  return mentions;
}

for (const lang of ["pt", "en"] as const) {
  const text = read(`${lang}-expected.tsv`);
  const scopeOf = new Map<string, string[]>();
  for (const l of text.split("\n")) {
    const c = l.split("\t");
    if (c[0] === "#scope") scopeOf.set(c[1], c[2].split(","));
  }
  const expected = rows(text);
  const files = [...new Set(expected.map((r) => r[0]))];

  describe(`mentions index on the fixtures (${lang})`, () => {
    it("gives each entry the counts the expected file lists, and pins the totals", async () => {
      const mine = entries.filter((e) => e.lang === lang);
      const table = compileTerms(mine.map((e) => e.src), { lang, extraTitles: [] });
      const notes = Object.fromEntries(files.map((f) => [`Contos/${f}`, read(f)]));
      // a link to an entry's note counts as one mention of it (Q30)
      const resolve = (linkpath: string) => mine.find((e) => e.src.name === linkpath)?.src.id ?? null;
      const idx = await indexFor(notes, table, resolve);

      // an entry belongs to a file when one of its scopes is in the file's scope line
      const scopesOf = (id: string) => mine.find((e) => e.src.id === id)!.scopes;
      const inFile = (file: string, id: string) => scopesOf(id).some((s) => (scopeOf.get(file) ?? ["base"]).includes(s));

      const want: Record<string, Record<string, number>> = {};
      for (const [file, , , id] of expected) {
        if (id === "-") continue;
        want[id] ??= {};
        want[id][file] = (want[id][file] ?? 0) + 1;
      }
      const got: Record<string, Record<string, number>> = {};
      for (const e of mine) {
        const r = idx.appearsIn(e.src.id, {
          entry: e.src.id,
          inScope: () => true,
          candidateInScope: (p, id) => inFile(p.replace("Contos/", ""), id),
          resolve,
          workOf: () => null,
          workRank: () => 0,
        });
        for (const row of r.other) {
          got[e.src.id] ??= {};
          got[e.src.id][row.path.replace("Contos/", "")] = row.count;
        }
      }
      expect(got).toEqual(want);
      expect(Object.fromEntries(Object.entries(got).map(([id, per]) => [id, Object.values(per).reduce((a, b) => a + b, 0)]))).toMatchSnapshot();   // the per-entry totals
    });
  });
}
