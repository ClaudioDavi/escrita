// Lens syllables and stem cost per token (10k words); outline loadRows for a
// 30-chapter book (no DOM). Run: npm run bench.
import { bench, describe } from "vitest";
import { segment } from "../../src/core/markdown";
import { readerMask } from "../../src/core/wordcount";
import { tokens } from "../../src/core/tokens";
import { syllables } from "../../src/lens/syllables";
import { normalizeWord } from "../../src/core/stem";
import { loadRows, type RowsPort } from "../../src/outline/rows";
import { measureText } from "../../src/core/measure";
import { chapter } from "./fixtures";

const text = chapter(10000);
const toks = tokens(readerMask(segment(text)));
const opts = { iterations: 20, warmupIterations: 5, time: 0, warmupTime: 0 };

describe(`lens hot loops, ${toks.length} tokens (10k words)`, () => {
  bench("syllables() per token", () => { for (const t of toks) syllables(t.text, "pt-BR"); }, opts);
  bench("normalizeWord() per token", () => { for (const t of toks) normalizeWord(t.text); }, opts);
});

const chapters = Array.from({ length: 30 }, (_, i) => ({ path: `L/Chapters/${i}.md`, basename: `${i} Cap`, text: chapter(5000) }));
const byPath = new Map(chapters.map((c) => [c.path, c]));
const counts = new Map(chapters.map((c) => [c.path, measureText(c.text)]));
const port: RowsPort<null> = {
  chapters: () => chapters, read: async (p) => ({ text: byPath.get(p)!.text, mtime: 1 }),
  frontmatter: () => ({ status: "rascunho" }), counts: async (p) => counts.get(p)!, placeholders: () => 0,
  chapterDefault: () => null, resolvePov: () => null, stages: () => ({}) as never,
  settings: () => ({ statusProperty: "status", povProperty: "pov", targetProperty: "target", limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", chapterTargetProperty: "chapterTarget" }),
};
describe("outline", () => {
  bench("loadRows, 30 chapters x 5k words (counts cached, per save)", async () => { await loadRows(port, null); }, { iterations: 15, warmupIterations: 2, time: 0, warmupTime: 0 });
});
