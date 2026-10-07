import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { itemsToRun, type SetupChoices, type SetupItem, type SetupVault } from "../src/setup/plan";
import type { EscritaData } from "../src/data";
import type { EscritaSettings } from "../src/settings";

// Loader check only: the 1.0 fixtures parse into the contract types. The tests that use
// them as expectations are Wave 1's (tasks 1.4, 1.5).
const dir = (p: string) => fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url));
const read = <T>(p: string): T => JSON.parse(readFileSync(dir(p), "utf8")) as T;

describe("fixtures: settings-0.9", () => {
  it("parses, and the expected settings add only the two 1.0 settings (setupOffered is data)", () => {
    const data = read<EscritaData>("settings-0.9/data.json");
    const expected = read<EscritaSettings>("settings-0.9/expected-settings.json");
    expect(data.version).toBe(1);
    const saved = data.settings as unknown as Record<string, unknown>;
    const exp = expected as unknown as Record<string, unknown>;
    for (const k of Object.keys(saved)) expect(exp[k], k).toEqual(saved[k]);
    expect(expected.defaultsLanguage).toBe("en");
    expect(expected.openInWritingMode).toBe(false);
    expect(Object.keys(history(data)).length).toBe(2);
  });
});

function history(d: EscritaData) { return d.history; }

interface SetupCase {
  description: string;
  choices: SetupChoices;
  settings: { base?: string; overrides?: Record<string, unknown>; fromFile?: string };
  vault: SetupVault;
  expected: SetupItem[];
}

describe("fixtures: setup", () => {
  const files = readdirSync(dir("setup")).filter((f) => f.endsWith(".json"));
  it("has the seven cases", () => expect(files.length).toBe(7));
  for (const f of files) {
    it(`${f} parses into the contract types`, () => {
      const c = read<SetupCase>(`setup/${f}`);
      expect(c.description).not.toBe("");
      expect(["stories", "books", "both"]).toContain(c.choices.writes);
      expect(c.vault.openLeaves).toBeGreaterThan(0);
      expect(Array.isArray(c.vault.folders) && Array.isArray(c.vault.files)).toBe(true);
      for (const i of c.expected) {
        expect(["folder", "example", "home", "setting", "features", "layout"]).toContain(i.kind);
        expect(["new", "kept", "change"]).toContain(i.state);
        expect(typeof i.reason.key).toBe("string");
        if (i.state === "kept") expect(i.tick === null && !i.ticked).toBe(true);
      }
    });
  }
  it("author-like, ticks untouched, changes nothing at all: folders and the track folder are unticked in a vault with works (G2)", () => {
    const run = itemsToRun(read<SetupCase>("setup/author-like.json").expected, {});
    const settings = run.filter((i) => i.kind === "setting" || i.kind === "features");
    expect(settings).toEqual([]);
    expect(run.filter((i) => i.kind === "folder" || i.kind === "example" || i.kind === "home" || i.kind === "layout")).toEqual([]);
  });
  it("second-run has nothing to run", () => {
    expect(itemsToRun(read<SetupCase>("setup/second-run.json").expected, {})).toEqual([]);
  });
});
