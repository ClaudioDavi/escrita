import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSetup, settingsPatch, type RunPorts } from "../src/setup/run";
import { initialChoices, planCounts, planFor, previewGroups, valueText } from "../src/setup/model";
import { homeNoteText } from "../src/setup/home-text";
import { setupStrings } from "../src/setup/strings";
import { itemsToRun, planSetup, type SetupChoices, type SetupItem, type SetupVault } from "../src/setup/plan";
import { defaultsFor, type EscritaSettings } from "../src/settings";
import { presetSwitches } from "../src/core/feature-presets";

const dir = (p: string) => fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url));
const read = <T>(p: string): T => JSON.parse(readFileSync(dir(p), "utf8")) as T;
const empty: SetupVault = { folders: [], files: [], noteCounts: {}, openLeaves: 1, hasWorks: false };

function ports(over: Partial<RunPorts> = {}, log: string[] = []): RunPorts {
  return {
    ensureFolder: (p) => { log.push(`folder ${p}`); return Promise.resolve(); },
    createNote: (p) => { log.push(`note ${p}`); return Promise.resolve("created"); },
    saveSettings: () => { log.push("settings"); return Promise.resolve(); },
    layout: (l) => { log.push(`layout ${l}`); return Promise.resolve(); },
    ...over,
  };
}

describe("runSetup", () => {
  const settings = defaultsFor("en");
  const choices: SetupChoices = { ...initialChoices("en"), preset: "essentials" };
  const plan = planSetup(choices, empty, settings);

  it("runs folders, examples, the home note, the settings, then the layout", async () => {
    const log: string[] = [];
    const r = await runSetup(plan, {}, ports({}, log));
    const order = log.map((l) => l.split(" ")[0]);
    expect(order.indexOf("settings")).toBeGreaterThan(order.lastIndexOf("note"));
    expect(order.indexOf("settings")).toBeGreaterThan(order.lastIndexOf("folder"));
    expect(log[log.length - 1]).toBe("layout desk");
    expect(log[0]).toBe("folder Stories");
    expect(r.failed).toEqual([]);
    expect(r.settingsSkipped).toBe(false);
  });

  it("writes every note through createNote and never a kept item", async () => {
    const second = planSetup(choices, { ...empty, folders: ["Stories", "Books"], files: ["Home.md"] }, settings);
    const log: string[] = [];
    await runSetup(second, {}, ports({}, log));
    expect(log.filter((l) => l.startsWith("note Home"))).toEqual([]);
    expect(log.filter((l) => l.startsWith("folder Stories"))).toEqual([]);
  });

  it("skips the settings when a folder fails, keeps going, and undoes nothing", async () => {
    const log: string[] = [];
    const r = await runSetup(plan, {}, ports({
      ensureFolder: (p) => { if (p === "Books") return Promise.reject(new Error("books is a file")); log.push(`folder ${p}`); return Promise.resolve(); },
    }, log));
    expect(r.failed.map((f) => f.item.target)).toContain("Books");
    expect(r.failed[0].error).toBe("books is a file");
    expect(r.settingsSkipped).toBe(true);
    expect(log).not.toContain("settings");
    expect(log).toContain("folder Stories");
    expect(r.made.some((i) => i.target === "Stories")).toBe(true);
  });

  it("a failed note does not stop the settings", async () => {
    const log: string[] = [];
    const r = await runSetup(plan, {}, ports({
      createNote: (p) => (p === "Home.md" ? Promise.reject(new Error("nope")) : Promise.resolve("created")),
    }, log));
    expect(r.failed.map((f) => f.item.target)).toEqual(["Home.md"]);
    expect(log).toContain("settings");
  });

  it("counts a note that appeared since the preview as skipped, not made", async () => {
    const r = await runSetup(plan, {}, ports({ createNote: () => Promise.resolve("existing") }));
    expect(r.made.some((i) => i.kind === "home")).toBe(false);
    expect(r.skipped.some((i) => i.kind === "home")).toBe(true);
    expect(r.total).toBe(itemsToRun(plan, {}).filter((i) => i.kind === "folder" || (i.kind === "example" && i.content === undefined)).length);
  });

  it("an unticked layout never runs", async () => {
    const log: string[] = [];
    await runSetup(plan, { layout: false }, ports({}, log));
    expect(log.some((l) => l.startsWith("layout"))).toBe(false);
  });

  it("a failing layout is reported and the rest stays", async () => {
    const r = await runSetup(plan, {}, ports({ layout: () => Promise.reject(new Error("workspace")) }));
    expect(r.failed.map((f) => f.item.kind)).toEqual(["layout"]);
    expect(r.made.some((i) => i.kind === "home")).toBe(true);
  });

  it("nothing to do runs nothing", async () => {
    const second = read<{ choices: SetupChoices; vault: SetupVault; settings: { base: "en"; overrides?: Record<string, unknown> } }>("setup/second-run.json");
    const items = planSetup(second.choices, second.vault, { ...defaultsFor("en"), ...second.settings.overrides } as EscritaSettings);
    const log: string[] = [];
    const r = await runSetup(items, {}, ports({}, log));
    expect(log).toEqual([]);
    expect(r.made).toEqual([]);
  });
});

describe("settingsPatch", () => {
  it("applies the features row without its universeMode", () => {
    const settings = { ...defaultsFor("en"), universeMode: "perBook" as const };
    const wanted = presetSwitches("essentials", settings);
    const patch = settingsPatch([{ kind: "features", target: "features", state: "change", tick: "features", ticked: true, reason: { key: "x" }, value: { ...wanted, universeMode: "off" } }]);
    expect(Object.keys(patch.features!).sort()).toEqual(["explorerCounts", "features", "spellcheckOnDemand"]);
    expect(patch.features!.features).toEqual(wanted.features);
  });

  it("takes the other settings by key", () => {
    const item = (target: string, value: unknown): SetupItem => ({ kind: "setting", target, state: "change", tick: null, ticked: true, reason: { key: "x" }, value });
    expect(settingsPatch([item("trackFolders", "A\nB"), item("universeMode", "universe")]).values).toEqual({ trackFolders: "A\nB", universeMode: "universe" });
  });
});

describe("planSetup: the language tick (Wave 1b)", () => {
  // an English install in a vault with works: the writer picks Portuguese and ticks examples only
  const en = defaultsFor("en");
  const choices: SetupChoices = { ...initialChoices("pt-BR"), writes: "books" };
  const vault: SetupVault = { ...empty, hasWorks: true };

  it("example chapters follow the install's chapters folder while the language is unticked", () => {
    const items = planSetup(choices, vault, en, { examples: true });
    const chapters = items.filter((i) => i.kind === "example").map((i) => i.target);
    expect(chapters).toContain("Livros/Exemplo · O farol/Chapters");
    expect(chapters.some((p) => p.includes("/Capítulos"))).toBe(false);
  });

  it("and follow the target language when the language runs", () => {
    const items = planSetup(choices, vault, en, { examples: true, language: true });
    expect(items.filter((i) => i.kind === "example").map((i) => i.target)).toContain("Livros/Exemplo · O farol/Capítulos");
  });

  it("a vault without works has the language on by default", () => {
    const items = planSetup(choices, empty, en);
    expect(items.some((i) => i.target.endsWith("/Capítulos"))).toBe(true);
  });
});

describe("the preview", () => {
  const settings = defaultsFor("en");
  const label = (i: SetupItem) => i.target;

  it("groups in board 37's order and puts a checkbox on each tick's first row only", () => {
    const items = planFor(initialChoices("en"), empty, settings, {});
    const groups = previewGroups(items, {}, label, () => "");
    expect(groups.map((g) => g.kind)).toEqual(["folder", "example", "setting", "home", "layout"]);
    const boxes = groups.flatMap((g) => g.rows).map((r) => r.box).filter((b) => b !== null);
    expect(new Set(boxes).size).toBe(boxes.length);
    expect(boxes).toContain("examples");
    expect(boxes).toContain("layout");
  });

  it("hides the settings the layout and the home note cover", () => {
    const items = planFor({ ...initialChoices("en"), layout: "focus" }, empty, settings, {});
    const targets = previewGroups(items, {}, label, () => "").flatMap((g) => g.rows).map((r) => r.item.target);
    expect(targets).not.toContain("openInWritingMode");
    expect(targets).not.toContain("homeNote");
    expect(targets).toContain("openHomeOnStartup");
  });

  it("drops the shared-world answer unless Everything is picked", () => {
    const items = planFor({ ...initialChoices("en"), universeMode: "universe" }, empty, settings, {});
    expect(items.some((i) => i.target === "universeMode")).toBe(false);
    const all = planFor({ ...initialChoices("en"), preset: "everything", universeMode: "universe" }, empty, settings, {});
    expect(all.some((i) => i.target === "universeMode")).toBe(true);
  });

  it("counts what Create will do", () => {
    const items = planFor(initialChoices("en"), empty, settings, {});
    const c = planCounts(items, {});
    expect(c.items).toBe(items.filter((i) => ["folder", "example", "home"].includes(i.kind) && i.state === "new").length);
    expect(planCounts(items, { examples: false }).items).toBeLessThan(c.items);
  });

  it("shows a value as short text", () => {
    expect(valueText("A\nB")).toBe("A, B");
    expect(valueText({ idea: { words: "idea, notion", color: "#000" }, draft: { words: "draft", color: "#111" } })).toBe("idea, draft");
  });
});

describe("home note text", () => {
  it("carries the works block, in the setup's language, and the examples line only with examples", () => {
    const en = homeNoteText({ language: "en", examples: false });
    expect(en).toContain("```escrita-works\n```");
    expect(en).not.toContain("Example");
    expect(homeNoteText({ language: "pt-BR", examples: true })).toContain("Exemplo ·");
    expect(homeNoteText({ language: "en", examples: true })).toBe(homeNoteText({ language: "en", examples: true }));
  });
});

describe("setup strings", () => {
  const files = readdirSync(dir("setup")).filter((f) => f.endsWith(".json"));
  const keys = new Set<string>();
  for (const f of files) {
    const c = read<{ expected: SetupItem[] }>(`setup/${f}`);
    for (const i of c.expected) keys.add(i.reason.key);
  }

  it("has both languages with the same keys", () => {
    expect(Object.keys(setupStrings["pt-BR"]).sort()).toEqual(Object.keys(setupStrings.en).sort());
  });

  it("answers every reason key the plan emits, in both languages", () => {
    for (const k of keys) {
      expect(setupStrings.en[k], k).toBeTruthy();
      expect(setupStrings["pt-BR"][k], k).toBeTruthy();
    }
  });

  it("names every setting the plan may list", () => {
    for (const f of files) {
      for (const i of read<{ expected: SetupItem[] }>(`setup/${f}`).expected) {
        if (i.kind === "setting" && i.target !== "openInWritingMode") expect(setupStrings.en[`setup.setting.${i.target}`], i.target).toBeTruthy();
      }
    }
  });
});
