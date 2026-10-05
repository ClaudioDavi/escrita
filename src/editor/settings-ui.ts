import { Setting } from "obsidian";
import { t } from "../i18n";
import type { Scope } from "../settings";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

/**
 * The typing module's rows of the Editor section: Enter flow, smart typography, its scope
 * and the dialogue dash. The heading and the two rows shared with the dialogue focus, the
 * block mover and the lens (paragraph style, quote style) are drawn by the tab (settings.ts).
 */
export function typingSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el)
    .setName(t("settings.enterFlow"))
    .setDesc(t("settings.enterFlow.desc"))
    .addToggle((c) => c.setValue(s.enterFlow)
      .onChange(async (v) => { s.enterFlow = v; await ui.save(); }));
  new Setting(el)
    .setName(t("settings.smartTypography"))
    .setDesc(t("settings.smartTypography.desc"))
    .addToggle((c) => c.setValue(s.smartTypography)
      .onChange(async (v) => { s.smartTypography = v; await ui.save(); }));
  new Setting(el)
    .setName(t("settings.typographyScope"))
    .addDropdown((d) => d
      .addOption("books", t("settings.scope.books"))
      .addOption("all", t("settings.scope.all"))
      .setValue(s.typographyScope)
      .onChange(async (v) => { s.typographyScope = v as Scope; await ui.save(); }));
  new Setting(el)
    .setName(t("settings.dialogueDash"))
    .setDesc(t("settings.dialogueDash.desc"))
    .addToggle((c) => c.setValue(s.dialogueDash)
      .onChange(async (v) => { s.dialogueDash = v; await ui.save(); }));
}
