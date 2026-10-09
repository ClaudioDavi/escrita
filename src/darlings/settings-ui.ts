import { Setting } from "obsidian";
import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

export function darlingsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.darlings")).setHeading();
  new Setting(el)
    .setName(t("settings.darlingsNote"))
    .setDesc(t("settings.darlingsNote.desc"))
    .addText((c) => {
      c.setValue(s.darlingsNote);
      ui.saveOnCommit(c, () => ui.defaults().darlingsNote, (v) => { s.darlingsNote = v; });
    });
  new Setting(el)
    .setName(t("settings.globalDarlingsNote"))
    .addText((c) => {
      c.setValue(s.globalDarlingsNote);
      ui.saveOnCommit(c, () => ui.defaults().globalDarlingsNote, (v) => { s.globalDarlingsNote = v; });
    });
}

export async function darlingsOffNotice(_plugin: EscritaPlugin): Promise<string | null> {
  return t("settings.features.off.darlings");
}
