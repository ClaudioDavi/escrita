// 1.2.4: every property write goes through plugin.notes.frontmatter, which saves the note's views
// first (rule 1). This fails on processFrontMatter anywhere in src/ outside NoteService. Full-line
// comments (`//`, `/*`, JSDoc `*` lines) are skipped. A trailing comment on a code line still
// counts: reword it.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");
const BARE = /\bprocessFrontMatter\b/;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("property writes", () => {
  it("only NoteService calls processFrontMatter, once", () => {
    const hits: string[] = [];
    for (const f of files(join(ROOT, "src"))) {
      const code = readFileSync(f, "utf8").split("\n").filter((l) => {
        const t = l.trim();
        return !(t.startsWith("//") || t.startsWith("/*") || t.startsWith("*"));
      });
      // one entry per line, so a second call inside notes.ts fails too
      for (const l of code) if (BARE.test(l)) hits.push(relative(ROOT, f));
    }
    expect(hits).toEqual(["src/core/notes.ts"]);
  });
});
