import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLAIN_DEFAULTS, itemsToRun, planSetup, settingsAfter, type SetupChoices, type SetupItem, type SetupVault } from "../src/setup/plan";
import { reasonFor } from "../src/setup/model";
import { UNIVERSE_NOTE_TEXT } from "../src/core/scope";
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
    const vault: SetupVault = { ...empty, folders: ["BOOKS", "books/EXAMPLE · THE LIGHTHOUSE"], files: ["HOME.MD", "BOOKS/example · the lighthouse.md"] };
    const items = planSetup(base, vault, DEFAULT_SETTINGS);
    for (const i of items.filter((x) => x.kind === "folder" || x.kind === "example" || x.kind === "home")) {
      const hit = [...vault.folders, ...vault.files].some((p) => p.toLowerCase() === i.target.toLowerCase());
      if (hit) expect(i.state, i.target).toBe("kept");
    }
    expect(items.find((i) => i.kind === "folder" && i.target === "BOOKS")?.state).toBe("kept");
    expect(items.find((i) => i.kind === "home")?.target).toBe("HOME.MD");
    expect(items.find((i) => i.target === "BOOKS/example · the lighthouse.md")?.state).toBe("kept");
  });

  it("adds a track folder, never swaps; keeps a list that already has it", () => {
    const has = planSetup(base, empty, { ...DEFAULT_SETTINGS, trackFolders: "books\nOther" });
    expect(has.find((i) => i.target === "trackFolders")?.value).toBe("books\nOther\nStories");
    const all = planSetup({ ...base, writes: "books" }, empty, { ...DEFAULT_SETTINGS, trackFolders: "books" });
    expect(all.find((i) => i.target === "trackFolders")?.state).toBe("kept");
  });

  it("new folders and the track-folder change share the folders tick: ticked without works, unticked with works", () => {
    const settings = { ...DEFAULT_SETTINGS, trackFolders: "Other" };
    const rows = (vault: SetupVault) => planSetup(base, vault, settings).filter((i) => i.kind === "folder" || i.target === "trackFolders");
    for (const i of rows(empty)) expect(i, i.target).toMatchObject({ state: expect.stringMatching(/new|change/), tick: "folders", ticked: true });
    const withWorks = rows({ ...empty, hasWorks: true });
    expect(withWorks).toHaveLength(3);
    for (const i of withWorks) expect(i, i.target).toMatchObject({ tick: "folders", ticked: false });
    expect(itemsToRun(planSetup(base, { ...empty, hasWorks: true }, settings), {}).filter((i) => i.kind === "folder" || i.target === "trackFolders")).toEqual([]);
  });

  it("the shared world answer is its own ticked row", () => {
    const row = planSetup({ ...base, preset: "everything", universeMode: "universe" }, { ...empty, hasWorks: true }, DEFAULT_SETTINGS).find((i) => i.target === "universeMode");
    expect(row).toMatchObject({ state: "change", tick: "universe", ticked: true });
  });

  it("the shared world plans the universe note, ticked, never over an existing one", () => {
    const choices = { ...base, universeMode: "universe" as const };
    const row = planSetup(choices, empty, DEFAULT_SETTINGS).find((i) => i.kind === "universe");
    expect(row).toMatchObject({ state: "new", tick: "universe", ticked: true, content: UNIVERSE_NOTE_TEXT });
    expect(row?.target.endsWith(".md")).toBe(true);
    const has = planSetup(choices, { ...empty, files: [row!.target.toUpperCase()] }, DEFAULT_SETTINGS);
    expect(has.some((i) => i.kind === "universe")).toBe(false);
    expect(planSetup({ ...base, universeMode: "perBook" }, empty, DEFAULT_SETTINGS).some((i) => i.kind === "universe")).toBe(false);
  });

  it("an unticked-default reason gives way once the row is ticked; other reasons stay", () => {
    const item = (key: string) => ({ reason: { key } }) as SetupItem;
    expect(reasonFor(item("setup.reason.layoutTabs"), false).key).toBe("setup.reason.layoutTabs");
    expect(reasonFor(item("setup.reason.layoutTabs"), true).key).toBe("setup.reason.tickedByYou");
    expect(reasonFor(item("setup.reason.startupNew"), true).key).toBe("setup.reason.startupNew");
  });

  it("the startup row has its own reason, not the language one", () => {
    const row = planSetup(base, empty, DEFAULT_SETTINGS).find((i) => i.target === "openHomeOnStartup");
    expect(row?.reason.key).toBe("setup.reason.startupNew");
  });

  it("lists settings after every folder, example and home item", () => {
    const kinds = planSetup(base, empty, DEFAULT_SETTINGS).map((i) => i.kind);
    expect(kinds.lastIndexOf("folder")).toBeLessThan(kinds.indexOf("setting"));
    expect(kinds.lastIndexOf("home")).toBeLessThan(kinds.indexOf("setting"));
    expect(kinds[kinds.length - 1]).toBe("layout");
  });

  it("open the home note on startup: its own tick, unticked in a vault with works (Wave 2 seams)", () => {
    const row = (vault: SetupVault) => planSetup(base, vault, DEFAULT_SETTINGS).find((i) => i.target === "openHomeOnStartup");
    expect(row(empty)).toMatchObject({ state: "change", tick: "startup", ticked: true });
    expect(row({ ...empty, hasWorks: true })).toMatchObject({ state: "change", tick: "startup", ticked: false, reason: { key: "setup.reason.settingHasWorks" } });
  });

  it("uses a home note that exists in another case as the home note, under the home tick", () => {
    const items = planSetup(base, { ...empty, files: ["home.md"] }, DEFAULT_SETTINGS);
    expect(items.find((i) => i.kind === "home")).toMatchObject({ target: "home.md", state: "kept" });
    expect(items.find((i) => i.target === "homeNote")).toMatchObject({ state: "change", tick: "home", value: "home.md" });
  });

  it("never plans a second home note beside one the desk would adopt (Home.md, Inicio.md)", () => {
    const pt = { ...base, language: "pt-BR" } as SetupChoices;
    for (const f of ["Inicio.md", "Home.md"]) {
      const items = planSetup(pt, { ...empty, files: [f] }, DEFAULT_SETTINGS);
      expect(items.find((i) => i.kind === "home")).toMatchObject({ target: f, state: "kept" });
      expect(items.find((i) => i.target === "homeNote")).toMatchObject({ state: "change", value: f });
    }
    // with none of them, the language's name is offered
    expect(planSetup(pt, empty, DEFAULT_SETTINGS).find((i) => i.kind === "home")).toMatchObject({ target: "Início.md", state: "new" });
  });

  it("uses the home note the setting names, not a second one under the default name", () => {
    const own = { ...DEFAULT_SETTINGS, homeNote: "Notas/Painel" };
    const items = planSetup(base, { ...empty, files: ["Notas/Painel.md"] }, own);
    expect(items.find((i) => i.kind === "home")).toMatchObject({ target: "Notas/Painel.md", state: "kept" });
    expect(items.some((i) => i.target === "Home.md")).toBe(false);
    expect(items.find((i) => i.target === "homeNote")).toMatchObject({ state: "kept" });
  });

  it("settingsAfter: the chosen set where the writer has no word of their own", () => {
    const own = { ...DEFAULT_SETTINGS, chaptersFolder: "Partes" };
    const after = settingsAfter(own, "pt-BR");
    expect(after.chaptersFolder).toBe("Partes");
    expect(after.stages.draft.words).toBe("rascunho");
    expect(after.statusProperty).toBe(DEFAULT_SETTINGS.statusProperty);
    expect(own.stages.draft.words).toBe("draft");
  });

  it("carries the home note's text, for the run", () => {
    const home = planSetup(base, empty, DEFAULT_SETTINGS).find((i) => i.kind === "home");
    expect(home?.content).toContain("```escrita-works");
  });

  it("mentions the examples in the home note only while their tick is on", () => {
    const homeText = (ticks: { examples?: boolean }) => planSetup(base, empty, DEFAULT_SETTINGS, ticks).find((i) => i.kind === "home")?.content ?? "";
    expect(homeText({})).toMatch(/Example ·|Exemplo ·/);
    expect(homeText({ examples: false })).not.toMatch(/Example ·|Exemplo ·/);
  });

  it("its copy of the plain defaults matches DEFAULT_SETTINGS", () => {
    for (const [k, v] of Object.entries(PLAIN_DEFAULTS)) expect(DEFAULT_SETTINGS[k as keyof typeof DEFAULT_SETTINGS], k).toEqual(v);
  });
});
