import { Setting } from "obsidian";
import { t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import type { EscritaSettings } from "../settings";

/**
 * The threads section: the thread words under the "Universe" heading the tab draws, when the
 * universe is off. With the universe loaded its own section draws them, in the middle
 * (`threadWordRows`), so this draws nothing.
 */
export function threadsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  if (plugin.features.isOn("universe")) return;
  threadWordRows(el, ui, plugin.settings);
}

/**
 * The thread words (the keyword after `%%` and the word for a closed thread), drawn while threads
 * is on, in every universe mode.
 */
export function threadWordRows(el: HTMLElement, ui: SettingsUi, s: EscritaSettings): void {
  const off = s.universeMode === "off";
  new Setting(el)
    .setName(t("universe.settings.threadWord"))
    .setDesc(off ? "" : t("universe.settings.threadWord.desc", { example: `%% ${s.threadKeyword}: … %%` }))
    .addText((c) => {
      c.setPlaceholder(ui.defaults().threadKeyword).setValue(s.threadKeyword);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.threadWord"));
      ui.saveOnCommit(c, () => ui.defaults().threadKeyword, (v) => { s.threadKeyword = v; });
    });
  new Setting(el)
    .setName(t("universe.settings.closedWord"))
    .setDesc(off ? "" : t("universe.settings.closedWord.desc", { example: `%% ${s.threadKeyword} ${s.threadClosedWord}: … %%` }))
    .addText((c) => {
      c.setPlaceholder(ui.defaults().threadClosedWord).setValue(s.threadClosedWord);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.closedWord"));
      ui.saveOnCommit(c, () => ui.defaults().threadClosedWord, (v) => { s.threadClosedWord = v; });
    });
}
