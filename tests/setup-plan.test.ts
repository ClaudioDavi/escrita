import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { itemsToRun, planSetup, type SetupChoices, type SetupItem, type SetupVault } from "../src/setup/plan";
import { DEFAULT_SETTINGS, defaultsFor, type EscritaSettings } from "../src/settings";
import type { DefaultsLanguage } from "../src/core/defaults";

const dir = (p: string) => fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url));
const read = <T>(p: string): T => JSON.parse(readFileSync(dir(p), "utf8")) as T;

interface SetupCase {
  description: string;
  choices: SetupChoices;
  settings: { base?: DefaultsLanguage; overrides?: Record<string, unknown>; fromFile?: string };
  vault: SetupVault;
  expected: SetupItem[];
}

function settingsOf(c: SetupCase): EscritaSettings {
  if (c.settings.fromFile) return read<EscritaSettings>(`setup/${c.settings.fromFile}`);
  return { ...defaultsFor(c.settings.base ?? "en"), ...c.settings.overrides } as EscritaSettings;
}

const noContent = (items: SetupItem[]) => items.map(({ content, ...rest }) => (void content, rest));

describe("planSetup: fixtures", () => {
  const files = readdirSync(dir("setup")).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    it(f, () => {
      const c = read<SetupCase>(`setup/${f}`);
      const settings = settingsOf(c);
      const before = JSON.stringify(settings);
      expect(noContent(planSetup(c.choices, c.vault, settings))).toEqual(noContent(c.expected));
      expect(JSON.stringify(settings)).toBe(before);
    });
  }
});

describe("planSetup: rules", () => {
  const base: SetupChoices = { writes: "both", language: "en", preset: "writer", universeMode: null, layout: "desk" };
  const empty: SetupVault = { folders: [], files: [], noteCounts: {}, openLeaves: 1, hasWorks: false };

  it("second run: nothing to run", () => {
    const c = read<SetupCase>("setup/second-run.json");
    expect(itemsToRun(planSetup(c.choices, c.vault, settingsOf(c)), {})).toEqual([]);
  });

  it("never plans a new item over an existing path, in any letter case", () => {
    const vault: SetupVault = { ...empty, folders: ["BOOKS", "books/EXAMPLE · THE LIGHTHOUSE"], files: ["HOME.MD", "BOOKS/Example · The Lighthouse/example · the lighthouse.md"] };
    const items = planSetup(base, vault, DEFAULT_SETTINGS);
    for (const i of items.filter((x) => x.kind === "folder" || x.kind === "example" || x.kind === "home")) {
      const hit = [...vault.folders, ...vault.files].some((p) => p.toLowerCase() === i.target.toLowerCase());
      if (hit) expect(i.state, i.target).toBe("kept");
    }
    expect(items.find((i) => i.kind === "folder" && i.target === "BOOKS")?.state).toBe("kept");
    expect(items.find((i) => i.kind === "home")?.target).toBe("HOME.MD");
    expect(items.find((i) => i.target === "BOOKS/Example · The Lighthouse/example · the lighthouse.md")?.state).toBe("kept");
  });

  it("adds a track folder, never swaps; keeps a list that already has it", () => {
    const has = planSetup(base, empty, { ...DEFAULT_SETTINGS, trackFolders: "books\nOther" });
    expect(has.find((i) => i.target === "trackFolders")?.value).toBe("books\nOther\nStories");
    const all = planSetup({ ...base, writes: "books" }, empty, { ...DEFAULT_SETTINGS, trackFolders: "books" });
    expect(all.find((i) => i.target === "trackFolders")?.state).toBe("kept");
  });

  it("lists settings after every folder, example and home item", () => {
    const kinds = planSetup(base, empty, DEFAULT_SETTINGS).map((i) => i.kind);
    expect(kinds.lastIndexOf("folder")).toBeLessThan(kinds.indexOf("setting"));
    expect(kinds.lastIndexOf("home")).toBeLessThan(kinds.indexOf("setting"));
    expect(kinds[kinds.length - 1]).toBe("layout");
  });
});
