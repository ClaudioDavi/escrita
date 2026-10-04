// Startup index passes over a synthetic vault (MemoryVault, real timers): total time,
// reads, and the longest main-thread block (the max gap of a 0 ms ticker), which vitest
// bench does not report, so it is printed as "[perf]" lines. Slow (about a minute at
// the default size). Size: ESCRITA_BENCH_FILES (default 3020). Run: npm run bench.
import { IndexHub, type HubEvents } from "../../src/core/index-hub";
import { macrotaskYield, type IndexSpec, type IndexTimers } from "../../src/core/vault-index";
import { MemoryVault, type MemFile } from "../support/memory-vault";
import { placeholderSpec, placeholderValue } from "../../src/placeholders/logic";
import { threadsSpec, type ThreadsSettings } from "../../src/universe/threads";
import { MentionsIndex } from "../../src/universe/mentions-index";
import { computeMentions } from "../../src/universe/mentions";
import { defaultUniverseSettings } from "../../src/universe/settings";
import { segment } from "../../src/core/markdown";
import { parseThreads } from "../../src/core/markers";
import { findNames } from "../../src/core/names";
import { measureText } from "../../src/core/measure";
import { bench, describe } from "vitest";
import { chapter, report, table } from "./fixtures";

const FILES = Math.max(21, Number(process.env.ESCRITA_BENCH_FILES) || 3020);
const CHAPTERS = 20;
const BOOKS = Math.min(20, Math.floor(FILES / (CHAPTERS + 1)));
const NOTES = FILES - BOOKS * (CHAPTERS + 1);
const files: Record<string, string> = {};
for (let i = 0; i < NOTES; i++) files[`Notas/n${i}.md`] = chapter(i % 10 === 0 ? 3000 : 400);
for (let b = 0; b < BOOKS; b++) {
  files[`Livros/L${b}.md`] = "---\nstatus: rascunho\n---\n";
  for (let c = 0; c < CHAPTERS; c++) files[`Livros/L${b}/Chapters/${String(c + 1).padStart(2, "0")} Cap.md`] = chapter(3000);
}
const total = Object.keys(files).length;
const bytes = Object.values(files).reduce((n, t) => n + t.length, 0);
report("vault", `${total} files, ${(bytes / 1e6).toFixed(1)} MB of text`);

const settings = (): ThreadsSettings & ReturnType<typeof defaultUniverseSettings> => ({
  ...defaultUniverseSettings(), universeMode: "universe", chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots",
  templatesFolder: "Modelos", chapterTemplate: "", threadKeyword: "thread", threadClosedWord: "closed",
} as never);

const timers: IndexTimers = {
  set: (cb, ms) => setTimeout(cb, ms),
  clear: (h) => clearTimeout(h as NodeJS.Timeout),
  // the yield that ships (Q14), so the 20 ms check measures it
  yieldNow: macrotaskYield,
  now: () => performance.now(),
};

function hubFor(vault: MemoryVault, batch?: number) {
  const events: HubEvents<MemFile> = {
    onCreate: () => {}, onModify: () => {}, onDelete: () => {}, onRename: () => {}, onMetaChanged: () => {},
    onResolved: () => {}, onLayoutReady: () => {}, layoutReady: () => true, hasCache: () => true,
  };
  return new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots", batch });
}

/** Max gap between 0 ms ticks while `run` is in flight: the longest task that blocks input. */
async function longestBlock(run: () => Promise<void>): Promise<{ ms: number; maxGap: number }> {
  let last = performance.now();
  let maxGap = 0;
  let on = true;
  const tick = () => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; if (on) setTimeout(tick, 0); };
  setTimeout(tick, 0);
  const t0 = performance.now();
  await run();
  const ms = performance.now() - t0;
  on = false;
  return { ms, maxGap };
}

const ready = (ix: { isReady(): boolean; onReady(cb: () => void): () => void }) =>
  new Promise<void>((r) => { if (ix.isReady()) r(); else ix.onReady(() => r()); });

async function one(name: string, add: (hub: IndexHub<MemFile>) => { isReady(): boolean; onReady(cb: () => void): () => void }, batch?: number) {
  const vault = new MemoryVault(files);
  const hub = hubFor(vault, batch);
  const r = await longestBlock(async () => { await ready(add(hub)); });
  report(name, `total ${r.ms.toFixed(0)} ms, longest block ${r.maxGap.toFixed(1)} ms (phone x5 ~ ${(r.maxGap * 5).toFixed(0)} ms), reads ${vault.readCount}`);
  hub.unload();
}

const ph = (hub: IndexHub<MemFile>) => hub.add(placeholderSpec<MemFile>({ marker: () => "XXX", exclude: () => ["Escrita/Snapshots"] }));
const th = (hub: IndexHub<MemFile>) => hub.add(threadsSpec<MemFile>(settings));
const me = (hub: IndexHub<MemFile>) => {
  const m = new MentionsIndex<MemFile>({ add: (s) => hub.add(s), remove: (ix) => hub.remove(ix), rebuild: (n) => hub.rebuild(n), table: () => table, settings, resolve: () => null, timers });
  m.start();
  return { isReady: () => m.isReady(), onReady: (cb: () => void) => m.onChange(() => { if (m.isReady()) cb(); }) };
};

await one("placeholders (batch 40)", ph);
await one("threads (batch 40)", th);
await one("mentions, 300 entries (batch 40)", me);
await one("mentions, 300 entries (batch 8)", me, 8);
await one("mentions, 300 entries (batch 1)", me, 1);

{
  const vault = new MemoryVault(files);
  const hub = hubFor(vault);
  const r = await longestBlock(async () => {
    const a = ph(hub), b = th(hub), c = me(hub);
    await Promise.all([ready(a), ready(b), ready(c)]);
  });
  report("ALL THREE at once (startup, batch 40)", `total ${r.ms.toFixed(0)} ms, longest block ${r.maxGap.toFixed(1)} ms (phone x5 ~ ${(r.maxGap * 5).toFixed(0)} ms), reads ${vault.readCount}`);
  hub.unload();
}

// Compute only (no I/O): separate segmentations per index versus one shared segment() per file.
const texts = Object.values(files).slice(0, 500);
const cs = settings();
const bust = "\u200b"; // force a segment cache miss per spec, as interleaved builds do
const opts = { iterations: 5, warmupIterations: 1, time: 0, warmupTime: 0 };
describe(`index compute only, ${texts.length} files`, () => {
  bench("separate segmentations (placeholders + threads + mentions)", () => {
    for (const t of texts) {
      placeholderValue(t, "XXX");
      segment(bust); parseThreads(t, cs.threadKeyword, cs.threadClosedWord);
      segment(bust); computeMentions(segment(t), (m) => findNames(m, table));
      segment(bust);
    }
  }, opts);
  bench("shared segment() per file", () => {
    for (const t of texts) {
      const md = segment(t);
      placeholderValue(t, "XXX");
      parseThreads(md, cs.threadKeyword, cs.threadClosedWord);
      computeMentions(md, (m) => findNames(m, table));
    }
  }, opts);
  bench("one segment() per file only", () => { for (const t of texts) { segment(bust); segment(t); } }, opts);
  bench("measureText all", () => { for (const t of texts) measureText(t); }, opts);
});
