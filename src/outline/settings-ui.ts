import { Setting } from "obsidian";
import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

export function outlineSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.outline")).setHeading();
  new Setting(el)
    .setName(t("settings.ghostBeats"))
    .setDesc(t("settings.ghostBeats.desc"))
    .addToggle((c) => c.setValue(s.ghostBeats)
      .onChange(async (v) => { s.ghostBeats = v; await ui.save(); }));
}
