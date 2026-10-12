import { fmt, lang, plural, t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { textRow, toggleRow, type SettingsBlock } from "../ui/settings-rows";

/** The home note rows, under the heading the tab draws. */
export function deskSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      // A cleared home note stays empty (no home), so no key: the fallback is "".
      textRow(ui, {
        name: t("settings.homeNote"),
        desc: t("settings.homeNote.desc"),
        placeholder: lang() === "pt-BR" ? "Início.md" : "Home.md",
        get: () => s.homeNote,
        set: (v) => { s.homeNote = v; },
      }),
      toggleRow(ui, {
        name: t("settings.openHomeOnStartup"),
        desc: t("settings.openHomeOnStartup.desc"),
        get: () => s.openHomeOnStartup,
        set: (v) => { s.openHomeOnStartup = v; },
      }),
      toggleRow(ui, {
        name: t("desk.writingMode.setting"),
        desc: t("desk.writingMode.setting.desc"),
        get: () => s.openInWritingMode,
        set: (v) => { s.openInWritingMode = v; },
      }),
    ],
  }];
}

export async function deskOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const n = Object.keys(plugin.data.leftOff).length;
  return n > 0 ? plural("settings.features.off.desk", n, { n: fmt(n) }) : null;
}
