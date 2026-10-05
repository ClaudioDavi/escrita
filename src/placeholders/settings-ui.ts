import { Setting } from "obsidian";
import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

/**
 * The placeholders module's own row. The heading and the marker row are shared with publish,
 * so the tab draws them (settings.ts); this adds the explorer dots under them.
 */
export function placeholdersSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el)
    .setName(t("settings.showExplorerDots"))
    .addToggle((c) => c.setValue(s.showExplorerDots)
      .onChange(async (v) => { s.showExplorerDots = v; await ui.save(); }));
}
