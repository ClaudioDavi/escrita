import { Setting } from "obsidian";
import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

/** The Publishing section: the date property and the properties a published note should have. */
export function publishSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.publishing")).setHeading();
  new Setting(el)
    .setName(t("settings.dateProperty"))
    .setDesc(t("settings.dateProperty.desc"))
    .addText((c) => {
      c.setPlaceholder(ui.defaults().dateProperty).setValue(s.dateProperty);
      ui.saveOnCommit(c, () => ui.defaults().dateProperty, (v) => { s.dateProperty = v; });
    });
  new Setting(el)
    .setName(t("settings.recommendedProperties"))
    .setDesc(t("settings.recommendedProperties.desc"))
    .addTextArea((c) => {
      c.setPlaceholder(ui.defaults().recommendedProperties).setValue(s.recommendedProperties);
      ui.saveOnCommit(c, () => "", (v) => { s.recommendedProperties = v; });
    });
}
