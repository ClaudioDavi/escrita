import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { segmentDoc } from "../../src/core/markdown";
import { readerMask } from "../../src/core/wordcount";

// Finding 5: the pass masks the whole note on every typing pause (segment + readerMask), and
// only the matching is limited to the touched paragraphs. Measured on a generated note of 20,000
// words with frontmatter, comments, links, code and emphasis, a new document each run (as an
// edit makes one). Desktop figure 2026-10-03: median 8 ms, min 4 ms, so the plan's 20 ms local
// budget holds without masking only the dirty paragraphs; the phone figure is still open (G0h).
describe("the name marks' full mask on a 20,000-word note", () => {
  const para = 'Mariana olhou para o *mar* e disse: "Não sei", %% um comentário %% depois [[Teo]] riu `code`. ';
  const wordsPer = para.split(/\s+/).length * 5;
  let note = "---\ntitle: x\n---\n";
  for (let n = 0; n < 22000; n += wordsPer) note += para.repeat(5) + "\n\n";

  function median(runs: number): number {
    const ms: number[] = [];
    for (let i = 0; i < runs + 5; i++) {
      const doc = Text.of((note + " ".repeat(i)).split("\n"));
      const t0 = performance.now();
      readerMask(segmentDoc(doc));
      ms.push(performance.now() - t0);
    }
    return ms.slice(5).sort((a, b) => a - b)[Math.floor(runs / 2)]!;
  }

  it("is a long note, and the CI ceiling holds (5x the desktop figure at most 100 ms)", () => {
    expect(note.split(/\s+/).length).toBeGreaterThanOrEqual(20000);
    expect(median(10)).toBeLessThan(100);
  });

  it.skipIf(!!process.env.CI)("is under the plan's 20 ms local budget", () => {
    expect(median(20)).toBeLessThan(20);
  });
});
