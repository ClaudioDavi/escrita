import { Setting } from "obsidian";
import { t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";

/** The explorer's own rows, drawn right under its switch on the Features page (Q13). */
export function explorerSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el)
    .setName(t("settings.explorerFolderTotals"))
    .setDesc(t("settings.explorerFolderTotals.desc"))
    .addToggle((c) => c.setValue(s.explorerFolderTotals)
      .onChange(async (v) => { s.explorerFolderTotals = v; await ui.save(); }))
    .settingEl.addClass("escrita-feature-child");
  new Setting(el)
    .setName(t("settings.explorerShowTarget"))
    .setDesc(t("settings.explorerShowTarget.desc"))
    .addToggle((c) => c.setValue(s.explorerShowTarget)
      .onChange(async (v) => { s.explorerShowTarget = v; await ui.save(); }))
    .settingEl.addClass("escrita-feature-child");
}
