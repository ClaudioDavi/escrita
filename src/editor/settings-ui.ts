import { t } from "../i18n";
import type { Scope } from "../settings";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { dropdownRow, toggleRow, type SettingsBlock } from "../ui/settings-rows";

/**
 * The typing module's rows of the Editor section: Enter flow, smart typography, its scope
 * and the dialogue dash. The heading and the two rows shared with the dialogue focus, the
 * block mover and the lens (paragraph style, quote style) are the tab's (settings-tab.ts).
 */
export function typingSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      toggleRow(ui, {
        name: t("settings.enterFlow"),
        desc: t("settings.enterFlow.desc"),
        get: () => s.enterFlow,
        set: (v) => { s.enterFlow = v; },
      }),
      toggleRow(ui, {
        name: t("settings.smartTypography"),
        desc: t("settings.smartTypography.desc"),
        get: () => s.smartTypography,
        set: (v) => { s.smartTypography = v; },
      }),
      dropdownRow<Scope>(ui, {
        name: t("settings.typographyScope"),
        options: [["books", t("settings.scope.books")], ["all", t("settings.scope.all")]],
        get: () => s.typographyScope,
        set: (v) => { s.typographyScope = v; },
      }),
      toggleRow(ui, {
        name: t("settings.dialogueDash"),
        desc: t("settings.dialogueDash.desc"),
        get: () => s.dialogueDash,
        set: (v) => { s.dialogueDash = v; },
      }),
    ],
  }];
}
