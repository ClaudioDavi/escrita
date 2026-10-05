import { describe, it, expect } from "vitest";
import { segment } from "../../src/core/markdown";

describe("performance", () => {
  it("segments a long chapter quickly", () => {
    const para = "Ela abriu a porta `devagar` e %% XXX: conferir %% saiu para a rua molhada, sem olhar para trás.\n\n";
    const small = para.repeat(10000 / 18);
    const big = para.repeat(100000 / 18) + "```\ncode\n```\n<!-- x -->\n";
    const t0 = performance.now();
    segment(small).masked();
    const t1 = performance.now();
    segment(big).masked();
    const t2 = performance.now();
    // eslint-disable-next-line no-console
    console.info(`markdown: 10k words ${(t1 - t0).toFixed(1)} ms, 100k words ${(t2 - t1).toFixed(1)} ms`);
    expect(t2 - t1).toBeLessThan(100);
  });
});
