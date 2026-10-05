// Test-only renderer from manuscript blocks to Markdown (0.8 task 1.3). The real
// writer is task 2.3's; this one pins what the blocks must be able to say.
import type { Block, Run } from "../../src/core/manuscript";

export interface RenderOptions {
  /** a body heading is written at max(level, minHeading) */
  minHeading?: number;
}

function runText(runs: Run[]): string {
  return runs
    .map((r) => {
      const t = r.text.replace(/\n/g, "\\\n");
      if (r.bold && r.italic) return `***${t}***`;
      if (r.bold) return `**${t}**`;
      if (r.italic) return `*${t}*`;
      return t;
    })
    .join("");
}

/** Blocks to Markdown: one blank line between blocks, one newline at the end. */
export function renderBlocks(blocks: Block[], o: RenderOptions = {}): string {
  const parts: string[] = [];
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    let s: string;
    switch (b.kind) {
      case "paragraph": s = runText(b.runs); break;
      case "heading": s = `${"#".repeat(Math.max(b.level, o.minHeading ?? 1))} ${runText(b.runs)}`; break;
      case "quote": s = "> " + runText(b.runs).replace(/\n/g, "\n> "); break;
      case "sceneBreak": s = "\\#"; break;
    }
    // consecutive quote blocks are one quotation
    if (b.kind === "quote" && prev?.kind === "quote") parts.push(">");
    parts.push(s);
  });
  return parts.length ? parts.join("\n\n").replace(/\n\n>\n\n/g, "\n>\n") + "\n" : "";
}
