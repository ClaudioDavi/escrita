import type { SettingGroupItem } from "obsidian";
import { t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import type { EscritaSettings } from "../settings";
import { textRow, type SettingsBlock } from "../ui/settings-rows";

/**
 * The threads section: the thread words under the "Universe" heading the tab draws, when the
 * universe is off. With the universe loaded its own section draws them, in the middle
 * (`threadWordRows`), so this has no rows.
 */
export function threadsSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  if (plugin.features.isOn("universe")) return [];
  return [{ items: threadWordRows(ui, plugin.settings) }];
}

/**
 * The thread words (the keyword after `%%` and the word for a closed thread), drawn while threads
 * is on, in every universe mode. The universe mode decides whether they carry a description, and
 * a mode change rebuilds the tab; the example in it follows the words as they are at each render.
 */
export function threadWordRows(ui: SettingsUi, s: EscritaSettings): SettingGroupItem[] {
  const off = s.universeMode === "off";
  return [
    textRow(ui, {
      name: t("universe.settings.threadWord"),
      desc: () => (off ? "" : t("universe.settings.threadWord.desc", { example: `%% ${s.threadKeyword}: … %%` })),
      key: "threadKeyword",
      placeholder: ui.defaults().threadKeyword,
      inputCls: "escrita-universe-narrow",
      get: () => s.threadKeyword,
      set: (v) => { s.threadKeyword = v; },
    }),
    textRow(ui, {
      name: t("universe.settings.closedWord"),
      desc: () => (off ? "" : t("universe.settings.closedWord.desc", { example: `%% ${s.threadKeyword} ${s.threadClosedWord}: … %%` })),
      key: "threadClosedWord",
      placeholder: ui.defaults().threadClosedWord,
      inputCls: "escrita-universe-narrow",
      get: () => s.threadClosedWord,
      set: (v) => { s.threadClosedWord = v; },
    }),
  ];
}
