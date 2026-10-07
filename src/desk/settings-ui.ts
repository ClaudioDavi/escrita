import { Setting } from "obsidian";
import { fmt, lang, plural, t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

/** The home note rows. */
export function deskSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.homeNoteHeading")).setHeading();
  new Setting(el)
    .setName(t("settings.homeNote"))
    .setDesc(t("settings.homeNote.desc"))
    .addText((c) => {
      c.setPlaceholder(lang() === "pt-BR" ? "Inicio.md" : "Home.md").setValue(s.homeNote);
      ui.saveOnCommit(c, () => "", (v) => { s.homeNote = v; });
    });
  new Setting(el)
    .setName(t("settings.openHomeOnStartup"))
    .setDesc(t("settings.openHomeOnStartup.desc"))
    .addToggle((c) => c.setValue(s.openHomeOnStartup)
      .onChange(async (v) => { s.openHomeOnStartup = v; await ui.save(); }));
  new Setting(el)
    .setName(t("desk.writingMode.setting"))
    .setDesc(t("desk.writingMode.setting.desc"))
    .addToggle((c) => c.setValue(s.openInWritingMode)
      .onChange(async (v) => { s.openInWritingMode = v; await ui.save(); }));
}

export async function deskOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const n = Object.keys(plugin.data.leftOff).length;
  return n > 0 ? plural("settings.features.off.desk", n, { n: fmt(n) }) : null;
}
