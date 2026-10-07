// Per-keystroke, per-pause, per-save and lens costs on a synthetic Portuguese chapter
// (3,000 and 10,000 words). Run: npm run bench.
import { bench, describe } from "vitest";
import { Text } from "@codemirror/state";
import { segment, segmentDoc } from "../../src/core/markdown";
import { parseThreads } from "../../src/core/markers";
import { measureText } from "../../src/core/measure";
import { readerMask, countSelection } from "../../src/core/wordcount";
import { findNames } from "../../src/core/names";
import { scanBeats } from "../../src/outline/model";
import { placeholderSpans, placeholderValue } from "../../src/placeholders/logic";
import { dimPlan } from "../../src/core/dialogue";
import { analyze } from "../../src/lens/analyze";
import { RULES } from "../../src/lens/types";
import { computeMentions } from "../../src/universe/mentions";
import { compareTexts } from "../../src/snapshots/compare";
import { markableTable, rematch, marksOf } from "../../src/universe/name-marks-model";
import { chapter, table } from "./fixtures";

const opts = { iterations: 20, warmupIterations: 5, time: 0, warmupTime: 0 };
const slow = { iterations: 5, warmupIterations: 2, time: 0, warmupTime: 0 };

for (const words of [3000, 10000]) {
  const text = chapter(words);
  let doc = Text.of(text.split("\n"));
  const mid = Math.floor(text.length / 2);
  const md0 = segmentDoc(doc);
  const flat = text;
  const mdf = segment(flat);
  const mt = markableTable(table);
  const marks = marksOf(findNames(readerMask(mdf), mt));
  const other = chapter(500);
  const lineMid = md0.lineOf(mid);
  const mdOpts = { quoteStyle: "curly" as const, paragraphStyle: "blank" as const };
  const lensOpts = {
    lang: "pt-BR" as const, rules: new Set(RULES), echoWindow: 50, longSentence: 40,
    lists: { crutch: ["realmente", "simplesmente", "então"], names: [], ignore: [] },
    skipQuotes: false, quoteStyle: "curly" as const, paragraphStyle: "blank" as const,
  };
  const edited = flat.slice(0, mid) + " uma frase nova inserida aqui." + flat.slice(mid + 200).replace("casa", "lar");
  const heavy = flat.split("\n\n").map((p, k) => (k % 3 === 0 ? p.replace(/ o /g, " um ") : p)).join("\n\n");
  const sep = () => segment(chapter(10)); // busts the segment cache, as interleaved index builds do
  let i = 0;

  describe(`editor, ${words}-word chapter`, () => {
    // per keystroke
    bench("Text.toString() (whole doc)", () => { doc.toString(); }, opts);
    bench("keystroke: new Text + segment (cache miss)", () => {
      doc = doc.replace(mid + (i % 7), mid + (i % 7), Text.of([String.fromCharCode(97 + (i++ % 26))]));
      segmentDoc(doc);
    }, opts);
    bench("scanBeats (ghost beats, per docChanged)", () => { scanBeats(md0); }, opts);
    bench("placeholderSpans (per docChanged)", () => { placeholderSpans(md0, "XXX"); }, opts);
    bench("threads: toString + parseThreads (segment cache hit)", () => { segment(doc.toString()); parseThreads(doc.toString(), "thread", "closed"); }, opts);
    bench("threads: toString + parseThreads (segment cache miss)", () => { segment(other); parseThreads(doc.toString(), "thread", "closed"); }, opts);
    bench("dimPlan, 60 visible lines (dialogue focus)", () => { dimPlan(md0, lineMid, lineMid + 60, mdOpts); }, opts);
    bench("KEYSTROKE TOTAL (segment + beats + placeholders + threads via toString)", () => {
      doc = doc.replace(mid, mid, Text.of(["x"]));
      const m = segmentDoc(doc);
      scanBeats(m);
      placeholderSpans(m, "XXX");
      parseThreads(doc.toString(), "thread", "closed");
    }, opts);
    bench("KEYSTROKE TOTAL, threads reading segmentDoc", () => {
      doc = doc.replace(mid, mid, Text.of(["x"]));
      const m = segmentDoc(doc);
      scanBeats(m);
      placeholderSpans(m, "XXX");
      parseThreads(m, "thread", "closed");
    }, opts);

    // per pause (debounced)
    bench("measureText (explorer live count, 500 ms)", () => { measureText(doc.toString()); }, opts);
    bench("name marks full pass: readerMask + findNames", () => { findNames(readerMask(segmentDoc(doc)), mt); }, opts);
    bench("name marks rematch one paragraph (readerMask full + slice)", () => {
      const mask = readerMask(mdf);
      rematch(marks, mask, [{ from: mid, to: mid + 1 }], (a, b) => findNames(mask, mt, a, b));
    }, opts);
    bench("readerMask alone", () => { readerMask(mdf); }, opts);
    bench("lens analyze, full pass (400/800 ms after typing)", () => { analyze(segment(flat + " "), lensOpts); }, { iterations: 10, warmupIterations: 3, time: 0, warmupTime: 0 });

    // per save (through the index hub)
    bench("save: placeholders index compute", () => { placeholderValue(flat, "XXX"); }, opts);
    bench("save: threads index compute", () => { parseThreads(flat, "thread", "closed"); }, opts);
    bench("save: mentions index compute (segment + mask + findNames)", () => { computeMentions(segment(flat), (m) => findNames(m, table)); }, opts);
    bench("save: measurer recount", () => { measureText(flat); }, opts);
    bench("SAVE TOTAL, separate texts (3 index computes + measure, cold segment each)", () => {
      placeholderValue(flat + "", "XXX"); sep(); parseThreads(flat + "", "thread", "closed"); sep();
      computeMentions(segment(flat + ""), (m) => findNames(m, table)); sep(); measureText(flat + "");
    }, { iterations: 10, warmupIterations: 2, time: 0, warmupTime: 0 });

    // other
    bench("countSelection, half the doc selected", () => { countSelection(mdf, [{ from: 0, to: mid }]); }, opts);
    bench("snapshots compareTexts, 2 edits", () => { compareTexts(flat, edited); }, slow);
    bench("snapshots compareTexts, a third of paragraphs changed", () => { compareTexts(flat, heavy); }, { iterations: 5, warmupIterations: 1, time: 0, warmupTime: 0 });
  });
}
