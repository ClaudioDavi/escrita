import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { textRow, type SettingsBlock } from "../ui/settings-rows";

/** The Darlings section's rows, under the heading the tab draws: the two notes cut passages go to. */
export function darlingsSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      textRow(ui, {
        name: t("settings.darlingsNote"),
        desc: t("settings.darlingsNote.desc"),
        key: "darlingsNote",
        get: () => s.darlingsNote,
        set: (v) => { s.darlingsNote = v; },
      }),
      textRow(ui, {
        name: t("settings.globalDarlingsNote"),
        key: "globalDarlingsNote",
        get: () => s.globalDarlingsNote,
        set: (v) => { s.globalDarlingsNote = v; },
      }),
    ],
  }];
}

export async function darlingsOffNotice(_plugin: EscritaPlugin): Promise<string | null> {
  return t("settings.features.off.darlings");
}
