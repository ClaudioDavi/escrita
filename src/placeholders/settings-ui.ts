import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { toggleRow, type SettingsBlock } from "../ui/settings-rows";

/**
 * The placeholders module's own row. The heading and the marker row are shared with publish,
 * so the core draws them (settings-tab.ts); this adds the explorer dots under them.
 */
export function placeholdersSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      toggleRow(ui, {
        name: t("settings.showExplorerDots"),
        get: () => s.showExplorerDots,
        set: (v) => { s.showExplorerDots = v; },
      }),
    ],
  }];
}
