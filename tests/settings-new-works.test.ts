// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EscritaSettingTab } from "../src/settings-tab";
import { DEFAULT_SETTINGS, type EscritaSettings } from "../src/settings";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import { t } from "../src/i18n";
import { registerStrings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { newWorkStrings } from "../src/new-work/strings";
import { App } from "obsidian";
import { resetSettingLog } from "./support/obsidian";
import { openTab, rowNamed, type RenderedGroup } from "./support/definitions";
import { commit } from "./support/section-ui";

beforeAll(() => { registerStrings(coreStrings); registerStrings(newWorkStrings); });
beforeEach(() => resetSettingLog());

function build(off: FeatureId[] = [], over: Partial<EscritaSettings> = {}) {
  const settings = { ...DEFAULT_SETTINGS, features: {} as EscritaSettings["features"], stages: structuredClone(DEFAULT_SETTINGS.stages), ...over } as EscritaSettings;
  const loaded = new Set<FeatureId>(FEATURE_IDS.filter((id) => !off.includes(id)));
  const saves = vi.fn(async () => {});
  const plugin = {
    settings, saveSettings: saves, data: { history: {}, leftOff: {} },
    books: { allBooks: () => [], allBooksEverywhere: () => [] },
    setup: { hasHomeNote: () => true, open: () => {} },
    features: { isOn: (id: FeatureId) => loaded.has(id), get: () => undefined },
  };
  return { open: openTab(new EscritaSettingTab(new App() as never, plugin as never)), settings, saves };
}

const group = (groups: readonly RenderedGroup[], heading: string) => groups.find((g) => g.def.heading === heading);
const names = (g: RenderedGroup | undefined) => g?.rows.map((r) => r.def.name ?? "") ?? [];

describe("the New works rows", () => {
  it("a group after Books, with the four rows; the writing day stays in Books", () => {
    const { open } = build();
    const headings = open.groups().map((g) => g.def.heading);
    expect(headings.indexOf(t("settings.newWorks"))).toBe(headings.indexOf(t("settings.books")) + 1);
    expect(names(group(open.groups(), t("settings.newWorks")))).toEqual([
      t("settings.storiesFolder"), t("settings.storyTemplate"), t("settings.booksFolder"), t("settings.bookNoteTemplate"),
    ]);
    expect(names(group(open.groups(), t("settings.books")))).toContain(t("settings.dayEndsAt"));
  });

  it("the book rows follow the outline; the story rows stay", () => {
    const { open } = build(["outline"]);
    expect(names(group(open.groups(), t("settings.newWorks")))).toEqual([t("settings.storiesFolder"), t("settings.storyTemplate")]);
  });

  it("the template fields show the built-in label as a placeholder, the folders none", () => {
    const { open } = build();
    const input = (name: string) => (rowNamed(open.groups(), name)!.setting.components[0] as unknown as { inputEl: HTMLInputElement }).inputEl;
    expect(input(t("settings.storyTemplate")).placeholder).toBe(t("new-work.modal.builtIn"));
    expect(input(t("settings.bookNoteTemplate")).placeholder).toBe(t("new-work.modal.builtIn"));
    expect(input(t("settings.storiesFolder")).placeholder).toBe("");
  });

  it("committing a value saves it, and blank clears it", () => {
    const { open, settings, saves } = build();
    const field = (name: string) => rowNamed(open.groups(), name)!.setting.components[0] as unknown as { inputEl: HTMLInputElement };
    commit(field(t("settings.storyTemplate")), "Templates/Story.md");
    expect(settings.storyTemplate).toBe("Templates/Story.md");
    commit(field(t("settings.booksFolder")), "Livros");
    expect(settings.booksFolder).toBe("Livros");
    expect(saves).toHaveBeenCalled();
    commit(field(t("settings.storyTemplate")), "");
    expect(settings.storyTemplate).toBe("");
  });
});
