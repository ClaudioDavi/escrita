import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSettings } from "../src/settings";
import { matchingPreset } from "../src/core/feature-presets";
import { switchesOf } from "../src/core/feature-registry";

// G3 guard (PLAN-1.0, Wave 1 judge): the author's 0.9 data.json, loaded the way
// main.ts's loadAll loads settings, gives exactly the expected 1.0 settings. Task 1.4
// changed that load path (the install's default set, `loadSettings`); this test reads
// through it, in an English and a Portuguese Obsidian.
const dir = (p: string) => fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url));
const read = (p: string): unknown => JSON.parse(readFileSync(dir(p), "utf8"));

describe("G3: a 0.9 install loads unchanged", () => {
  for (const locale of ["en", "pt-br"]) {
    it(`every effective setting equals the expected settings (Obsidian in ${locale})`, () => {
      const data = read("settings-0.9/data.json") as { settings: unknown };
      const expected = read("settings-0.9/expected-settings.json");
      const { settings, fresh } = loadSettings(data.settings, locale);
      expect(fresh).toBe(false);
      expect(JSON.parse(JSON.stringify(settings))).toEqual(expected);
    });
  }

  it("no preset is applied (Q6): every feature stays on, so the author's install reads Everything", () => {
    // spellcheck on demand is saved as true and the universe is on, which no preset counts
    const data = read("settings-0.9/data.json") as { settings: unknown };
    expect(matchingPreset(switchesOf(loadSettings(data.settings, "pt-br").settings))).toBe("everything");
  });
});
