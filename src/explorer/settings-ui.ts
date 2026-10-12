import { t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { toggleRow, type SettingsBlock } from "../ui/settings-rows";

/** The explorer's own rows; the core places them right under its switch on the Features page (Q13). */
export function explorerSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      toggleRow(ui, {
        name: t("settings.explorerFolderTotals"),
        desc: t("settings.explorerFolderTotals.desc"),
        cls: "escrita-feature-child",
        get: () => s.explorerFolderTotals,
        set: (v) => { s.explorerFolderTotals = v; },
      }),
      toggleRow(ui, {
        name: t("settings.explorerShowTarget"),
        desc: t("settings.explorerShowTarget.desc"),
        cls: "escrita-feature-child",
        get: () => s.explorerShowTarget,
        set: (v) => { s.explorerShowTarget = v; },
      }),
    ],
  }];
}
