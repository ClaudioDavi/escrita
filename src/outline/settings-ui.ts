import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { toggleRow, type SettingsBlock } from "../ui/settings-rows";

/** The Outline section's rows, under the heading the tab draws: ghost beats. */
export function outlineSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      toggleRow(ui, {
        name: t("settings.ghostBeats"),
        desc: t("settings.ghostBeats.desc"),
        get: () => s.ghostBeats,
        set: (v) => { s.ghostBeats = v; },
      }),
    ],
  }];
}
