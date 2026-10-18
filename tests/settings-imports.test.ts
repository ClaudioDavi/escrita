// IMPROVEMENTS 11: settings.ts stops importing modules, and so does the tab (settings-tab.ts, 1.0.3).
// They may import shared core and ui, and the settings of a module (`<module>/settings.ts`: types,
// defaults, normalization; no Obsidian code).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
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

// IMPROVEMENTS 53 (1.1.1): shared core imports no module folder. `ui/` is allowed for types only.
describe("core imports", () => {
  const files = readdirSync(join(SRC, "core"), { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts"));

  it("reaches no module folder", () => {
    const bad: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(SRC, "core", f), "utf8");
      for (const m of text.matchAll(/(?:import|export)\s(type\s)?[^;]*?from\s*["']((?:\.\.\/)+)([^"']+)["']/g)) {
        const dir = m[3].split("/")[0];
        const typeOnly = m[1] !== undefined;
        if (dir === "core" || dir === "main" || dir === "i18n" || dir === "settings" || dir === "strings" || dir === "data") continue;
        if (dir === "ui" && typeOnly) continue;
        bad.push(`${f}: ${m[2]}${m[3]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
