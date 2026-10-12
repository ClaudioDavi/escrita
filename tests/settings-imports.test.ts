// IMPROVEMENTS 11: settings.ts stops importing modules, and so does the tab (settings-tab.ts, 1.0.3).
// They may import shared core and ui, and the settings of a module (`<module>/settings.ts`: types,
// defaults, normalization; no Obsidian code).

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..", "src");

/** Relative import specifiers of a file (import and export-from, with or without `type`). */
function importsOf(file: string): string[] {
  const text = readFileSync(join(SRC, file), "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(/(?:import|export)\s[^;]*?from\s*["'](\.{1,2}\/[^"']+)["']/g)) out.push(m[1]);
  return out;
}

/** What the specifier points at, from src/ ("./lens/lists" -> "lens/lists"). */
const fromSrc = (spec: string) => spec.replace(/^\.\//, "");

for (const file of ["settings.ts", "settings-tab.ts"]) {
  describe(`${file} imports`, () => {
    const specs = importsOf(file).map(fromSrc);

    it("reaches no module's internals", () => {
      const bad = specs.filter((spec) => {
        const [dir, rest] = spec.split("/");
        if (dir === "core" || dir === "ui" || spec === "main" || spec === "i18n" || !rest) return false;   // shared core, shared ui and top-level files
        if (rest === "settings") return false;                                                           // <module>/settings.ts
        return true;
      });
      expect(bad).toEqual([]);
    });
  });
}
