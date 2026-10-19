// @vitest-environment happy-dom
// The core slots of the tab as definitions (PLAN-1.0.3 Wave 1, task A): the Features page, the
// shared names and folders, the books, the stages, the placeholders marker and the editor's shared
// rows. Opened through tests/support/definitions.ts; the `Setting` stub records every row.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { FEATURE_GROUPS, FEATURE_IDS, FEATURE_PAGE, type FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { STAGES } from "../src/core/stages";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { lensStrings } from "../src/lens/strings";
import { exportStrings } from "../src/export/strings";
import { submissionsStrings } from "../src/submissions/strings";
import { universeStrings } from "../src/universe/strings";
import { screenplayStrings } from "../src/screenplay/strings";
import { SECTION_ORDER } from "../src/core/settings-order";
import { DEFAULT_SETTINGS, defaultsFor, type EscritaSettings } from "../src/settings";
import { EscritaSettingTab, featureGroupHeading } from "../src/settings-tab";
import { toggleRow } from "../src/ui/settings-rows";
import { resetSettingLog } from "./support/obsidian";
import { openTab, rowNamed, type RenderedGroup } from "./support/definitions";
import { commit } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

function build(over: Partial<EscritaSettings> = {}, off: FeatureId[] = [], modules: Partial<Record<FeatureId, Partial<FeatureModule>>> = {}) {
  const settings = {
    ...DEFAULT_SETTINGS, features: {} as EscritaSettings["features"], stages: structuredClone(DEFAULT_SETTINGS.stages),
    universeMode: "perBook" as const, ...over,
  } as EscritaSettings;
  const loaded = new Set<FeatureId>(FEATURE_IDS.filter((id) => !off.includes(id)));
  const saves = vi.fn(async () => {});
  const plugin = {
    settings, saveSettings: saves, data: { history: {}, leftOff: {} },
    books: { allBooks: () => [], allBooksEverywhere: () => [] },
    setup: { hasHomeNote: () => true, open: () => {} },
    features: { isOn: (id: FeatureId) => loaded.has(id), get: (id: FeatureId) => (loaded.has(id) ? modules[id] : undefined) },
  };
  const tab = new EscritaSettingTab(new App() as never, plugin as never);
  const open = openTab(tab);
  return { tab, open, settings, saves };
}

const group = (groups: readonly RenderedGroup[], heading: string) => groups.find((g) => g.def.heading === heading);
const names = (g: RenderedGroup | undefined) => g?.rows.map((r) => r.def.name ?? "") ?? [];
const field = (groups: readonly RenderedGroup[], name: string, i = 0) =>
  rowNamed(groups, name)!.setting.components[i] as unknown as { inputEl: HTMLInputElement; fire(v: unknown): Promise<void> };

describe("the Features page", () => {
  it("the slot's group holds the description, the language and the presets; then one group per feature group", () => {
    const { open } = build();
    const g = open.groups();
    expect(names(group(g, t("settings.features")))).toEqual(["", t("settings.language"), t("settings.features.preset.label")]);
    const headings = g.map((x) => x.def.heading);
    expect(headings.slice(0, 6)).toEqual([t("settings.features"), ...FEATURE_GROUPS.map(featureGroupHeading)]);
    // every feature has a row in its own group, in the page's order; the desk group opens with the always-on stages row
    for (const { group: id, ids } of FEATURE_PAGE) {
      const want = ids.map((f) => t(`settings.features.${f}`));
      if (id === "desk") want.unshift(t("settings.features.stages"));
      const own = names(group(g, featureGroupHeading(id)));
      // the explorer's rows sit right after its switch; here its module draws none
      expect(own, id).toEqual(want);
    }
  });

  it("a Features page group heading is the group's plain name (board 40)", () => {
    for (const id of FEATURE_GROUPS) expect(featureGroupHeading(id)).toBe(t(`settings.features.group.${id}`));
  });

  it("no heading of the tab repeats another, in either language (Obsidian matches groups by heading)", () => {
    const keys = [
      ...SECTION_ORDER.flatMap((slot) => (slot.heading === null ? [] : [slot.heading])),
      ...FEATURE_GROUPS.map((g) => `settings.features.group.${g}`),
      "settings.lens.rules", "settings.lens.measures", "universe.settings.types", "universe.settings.names",
    ];
    for (const language of ["en", "pt-BR"]) {
      const dict = Object.assign({}, ...[coreStrings, lensStrings, exportStrings, submissionsStrings, universeStrings, screenplayStrings].map((s) => s[language])) as Record<string, string>;
      const texts = keys.map((k) => dict[k]);
      expect(texts.every((x) => typeof x === "string" && x !== ""), language).toBe(true);
      expect(new Set(texts).size, `${language}: ${texts.join(" | ")}`).toBe(keys.length);
    }
  });

  it("the language dropdown saves, then rebuilds the rows once (the lens's rows are named for it)", async () => {
    const { open, tab, settings, saves } = build();
    const update = vi.spyOn(tab, "update");
    await field(open.groups(), t("settings.language")).fire("pt-BR");
    expect(settings.lensLanguage).toBe("pt-BR");
    expect(saves).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("the universe row is the mode dropdown; a change saves", async () => {
    const { open, settings, saves } = build();
    await field(open.groups(), t("settings.features.universe")).fire("off");
    expect(settings.universeMode).toBe("off");
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("the explorer's rows follow its switch while it is on and loaded", () => {
    const items = { settingsItems: (ui: never): never[] => [{ items: [toggleRow(ui, { name: "Folder totals", get: () => true, set: () => {} })] }] as never };
    const rows = (over: Partial<EscritaSettings>, off: FeatureId[]) => {
      const { open } = build(over, off, { explorerCounts: items as never });
      return names(group(open.groups(), featureGroupHeading("writing")));
    };
    const on = rows({}, []);
    expect(on[on.indexOf(t("settings.features.explorerCounts")) + 1]).toBe("Folder totals");
    expect(rows({ explorerCounts: false }, ["explorerCounts"])).not.toContain("Folder totals");
    expect(rows({ explorerCounts: false }, [])).not.toContain("Folder totals");
    expect(rows({}, ["explorerCounts"])).not.toContain("Folder totals");
  });

  it("a feature that needs another is disabled with a hint, and the hint turns the other on", async () => {
    const { open, settings, saves } = build({ features: { snapshots: false } as never }, ["snapshots"]);
    const row = rowNamed(open.groups(), t("settings.features.stageSnapshot"))!;
    const el = row.setting.settingEl;
    const sw = el.querySelector<HTMLButtonElement>("button.escrita-switch")!;
    expect(sw.disabled).toBe(true);
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(el.classList.contains("escrita-feature-child")).toBe(true);
    expect(el.textContent).toContain(t("settings.features.needs.snapshots"));
    el.querySelector<HTMLButtonElement>("button.escrita-link")!.click();
    await Promise.resolve();
    expect(settings.features.snapshots).toBe(true);
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("turning a feature off says nothing when its module has no notice, and saves the switch", async () => {
    const { open, settings, saves } = build();
    const sw = rowNamed(open.groups(), t("settings.features.goals"))!.setting.settingEl.querySelector<HTMLButtonElement>("button.escrita-switch")!;
    expect(sw.getAttribute("aria-checked")).toBe("true");
    sw.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.features.goals).toBe(false);
    expect(saves).toHaveBeenCalledTimes(1);
  });
});

describe("shared names and folders, books, the writing day", () => {
  it("the shared group keeps today's rows and order, ending with the export and submissions folders", () => {
    const { open } = build();
    expect(names(group(open.groups(), t("settings.shared")))).toEqual([
      "", t("settings.targetProperty"), t("settings.limitProperty"), t("settings.unitProperty"), t("settings.deadlineProperty"),
      t("settings.goalProperty"), t("settings.povProperty"), t("settings.chapterTargetProperty"),
      t("settings.trackFolders"), t("settings.excludeFolders"), t("export.settings.folder"), t("submissions.settings.folder"),
    ]);
  });

  it("a cleared property or folder field falls back to the install's language, and the track folders to empty", async () => {
    const { open, settings, saves } = build({ ...defaultsFor("pt-BR"), defaultsLanguage: "pt-BR", trackFolders: "Contos" });
    commit(field(open.groups(), t("settings.targetProperty")), "  ");
    expect(settings.targetProperty).toBe(defaultsFor("pt-BR").targetProperty);
    commit(field(open.groups(), t("settings.chaptersFolder")), "");
    expect(settings.chaptersFolder).toBe("Capítulos");
    commit(field(open.groups(), t("settings.trackFolders")), "");
    expect(settings.trackFolders).toBe("");
    // the first two commits leave the stored value as it was (it already is the default), so they write nothing
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("the books group, with the writing day after its rows while a feature reads it", () => {
    const { open } = build();
    expect(names(group(open.groups(), t("settings.books")))).toEqual([
      t("settings.chaptersFolder"), t("settings.chapterTemplate"), t("settings.templatesFolder"), t("settings.numberPadding"),
      t("settings.unnumberedTitles"), t("settings.statusProperty"), t("settings.dayEndsAt"),
    ]);
    const off = build({}, ["goals", "darlings", "snapshots", "publish"]);
    expect(names(group(off.open.groups(), t("settings.books")))).not.toContain(t("settings.dayEndsAt"));
  });

  it("the templates folder shows while templates or the universe is loaded", () => {
    const rows = (off: FeatureId[]) => names(group(build({}, off).open.groups(), t("settings.books")));
    expect(rows([])).toContain(t("settings.templatesFolder"));
    expect(rows(["templates"])).toContain(t("settings.templatesFolder"));
    expect(rows(["templates", "universe"])).not.toContain(t("settings.templatesFolder"));
  });

  it("the padding and the writing day save as numbers; the status row has two fields", async () => {
    const { open, settings } = build();
    await field(open.groups(), t("settings.numberPadding")).fire("3");
    expect(settings.numberPadding).toBe(3);
    await field(open.groups(), t("settings.dayEndsAt")).fire("4");
    expect(settings.dayEndsAt).toBe(4);
    const status = rowNamed(open.groups(), t("settings.statusProperty"))!.setting;
    expect(status.components).toHaveLength(2);
    commit(status.components[1] as never, "");
    expect(settings.summaryProperty).toBe(DEFAULT_SETTINGS.summaryProperty);
    commit(status.components[0] as never, "");
    expect(settings.statusProperty).toBe(DEFAULT_SETTINGS.statusProperty);
    // both fields are labeled and show the defaults as placeholders
    const [first, second] = status.components as unknown as { inputEl: HTMLInputElement }[];
    expect(first.inputEl.getAttribute("aria-label")).toBe(t("settings.statusProperty"));
    expect(second.inputEl.getAttribute("aria-label")).toBe(t("settings.summaryProperty"));
    expect(first.inputEl.placeholder).toBe(DEFAULT_SETTINGS.statusProperty);
    expect(second.inputEl.placeholder).toBe(DEFAULT_SETTINGS.summaryProperty);
  });
});

describe("the stages group", () => {
  const stageNames = () => STAGES.map((k) => t(`stage.${k}`));
  const warning = (g: readonly RenderedGroup[], stage: string) =>
    rowNamed(g, stage)!.setting.descEl.querySelector<HTMLElement>(".escrita-stage-warning")!;

  it("is the description, one row per stage, the other colors and the draft switch", () => {
    const { open } = build();
    expect(names(group(open.groups(), t("settings.stages")))).toEqual(["", ...stageNames(), t("settings.otherStatusColors"), t("settings.draftNewNotes")]);
  });

  it("a repeated word warns under the last stage that repeats it, and follows the words", async () => {
    const { open, settings, saves } = build();
    const g = open.groups();
    for (const n of stageNames()) expect(warning(g, n).textContent).toBe("");
    const first = settings.stages.idea.words;
    const lastStage = STAGES[STAGES.length - 1];
    commit(field(g, t(`stage.${lastStage}`)), first);
    await Promise.resolve();
    expect(settings.stages[lastStage].words).toBe(first);
    expect(saves).toHaveBeenCalledTimes(1);
    expect(warning(g, t(`stage.${lastStage}`)).textContent).toContain(first);
    expect(warning(g, t("stage.idea")).textContent).toBe("");
    // restoring the words clears it
    commit(field(g, t(`stage.${lastStage}`)), "carimbado");
    await Promise.resolve();
    expect(warning(g, t(`stage.${lastStage}`)).textContent).toBe("");
  });

  it("the warning is part of its row: a re-render draws it again, once", () => {
    const { open, tab, settings } = build();
    settings.stages.draft.words = settings.stages.idea.words;
    tab.update();
    const g = open.groups();
    expect(rowNamed(g, t("stage.draft"))!.setting.descEl.querySelectorAll(".escrita-stage-warning")).toHaveLength(1);
    expect(warning(g, t("stage.draft")).textContent).toContain(settings.stages.idea.words);
  });

  it("an emptied words field shows the words again and is never stored empty", () => {
    const { open, settings, saves } = build();
    const before = settings.stages.draft.words;
    const f = field(open.groups(), t("stage.draft"));
    f.inputEl.value = "  ";
    f.inputEl.dispatchEvent(new Event("change"));
    expect(settings.stages.draft.words).toBe(before);
    expect(f.inputEl.value).toBe(before);
    expect(saves).not.toHaveBeenCalled();
  });

  it("a committed words field is trimmed", () => {
    const { open, settings, saves } = build();
    commit(field(open.groups(), t("stage.draft")), " rascunho ");
    expect(settings.stages.draft.words).toBe("rascunho");
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("a blank commit over blank stored words stores the default, with one save", () => {
    const { open, settings, saves } = build();
    settings.stages.draft.words = "";
    const f = field(open.groups(), t("stage.draft"));
    commit(f, "");
    const def = defaultsFor(settings.defaultsLanguage).stages.draft.words;
    expect(def).not.toBe("");
    expect(settings.stages.draft.words).toBe(def);
    expect(f.inputEl.value).toBe(def);
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("the draft switch describes the draft word and saves at once", async () => {
    const { open, settings, saves } = build();
    const row = rowNamed(open.groups(), t("settings.draftNewNotes"))!;
    expect(row.setting.row.desc).toContain(settings.stages.draft.words);
    await row.setting.components[0].fire(true);
    expect(settings.draftNewNotes).toBe(true);
    expect(saves).toHaveBeenCalledTimes(1);
  });
});

describe("the placeholders and editor slots", () => {
  it("the marker sits under the slot's heading, cleaned on commit, and falls back to XXX", () => {
    const { open, settings } = build();
    const g = group(open.groups(), t("settings.placeholders"))!;
    expect(names(g)).toEqual([t("settings.placeholderMarker")]);
    commit(field(open.groups(), t("settings.placeholderMarker")), "TO DO!");
    expect(settings.placeholderMarker).toBe("TODO");
    commit(field(open.groups(), t("settings.placeholderMarker")), "!!!");
    expect(settings.placeholderMarker).toBe("XXX");
  });

  it("the paragraph and quote styles come after the typing module's rows", async () => {
    const typing = { settingsItems: (ui: never) => [{ items: [toggleRow(ui, { name: "Enter flow", get: () => true, set: () => {} })] }] };
    const { open, settings } = build({}, [], { typing: typing as never });
    expect(names(group(open.groups(), t("settings.editor")))).toEqual(["Enter flow", t("settings.paragraphStyle"), t("settings.quoteStyle")]);
    await field(open.groups(), t("settings.paragraphStyle")).fire("single");
    expect(settings.paragraphStyle).toBe("single");
    await field(open.groups(), t("settings.quoteStyle")).fire("german");
    expect(settings.quoteStyle).toBe("german");
  });

  it("the universe slot holds only its heading: with the module off, the thread words open under it", () => {
    const threads = { settingsItems: (ui: never) => [{ items: [toggleRow(ui, { name: "Thread word", get: () => true, set: () => {} })] }] };
    const { open } = build({}, ["universe"], { threads: threads as never });
    expect(names(group(open.groups(), t("universe.settings")))).toEqual(["Thread word"]);
  });
});
