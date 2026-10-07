import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";
import { mergeDefaults } from "../src/core/merge";
import { migrateSettings } from "../src/core/migrate";

// G3 guard (PLAN-1.0, Wave 1 judge): the author's 0.9 data.json, loaded the way
// main.ts's loadAll loads settings, gives exactly the expected 1.0 settings. Task 1.4
// changes that load path (the install's default set); this test must keep passing.
const dir = (p: string) => fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url));
const read = (p: string): unknown => JSON.parse(readFileSync(dir(p), "utf8"));

describe("G3: a 0.9 install loads unchanged", () => {
  it("every effective setting equals the expected settings", () => {
    const data = read("settings-0.9/data.json") as { settings: unknown };
    const expected = read("settings-0.9/expected-settings.json");
    const loaded = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, migrateSettings(data.settings)));
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(expected);
  });
});
