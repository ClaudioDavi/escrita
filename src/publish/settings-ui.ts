import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { textAreaRow, textRow, type SettingsBlock } from "../ui/settings-rows";

/** The Publishing section's rows, under the heading the tab draws: the date property and the properties a published note should have. */
export function publishSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      textRow(ui, {
        name: t("settings.dateProperty"),
        desc: t("settings.dateProperty.desc"),
        placeholder: ui.defaults().dateProperty,
        key: "dateProperty",
        get: () => s.dateProperty,
        set: (v) => { s.dateProperty = v; },
      }),
      // A cleared list stays empty (nothing is recommended), so no key: the fallback is "".
      textAreaRow(ui, {
        name: t("settings.recommendedProperties"),
        desc: t("settings.recommendedProperties.desc"),
        placeholder: ui.defaults().recommendedProperties,
        get: () => s.recommendedProperties,
        set: (v) => { s.recommendedProperties = v; },
      }),
    ],
  }];
}
