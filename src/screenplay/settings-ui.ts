import { t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { dropdownRow, textAreaRow, type SettingsBlock } from "../ui/settings-rows";

/** The screenplay editor's rows: the editor font and the times of day offered after a scene heading's " - ". */
export function screenplaySettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      dropdownRow<"courier" | "theme">(ui, {
        name: t("screenplay.settings.font"),
        desc: t("screenplay.settings.font.desc"),
        options: [["courier", t("screenplay.settings.font.courier")], ["theme", t("screenplay.settings.font.theme")]],
        get: () => s.screenplayFont,
        set: (v) => { s.screenplayFont = v; },
      }),
      textAreaRow(ui, {
        name: t("screenplay.settings.times"),
        desc: t("screenplay.settings.times.desc"),
        key: "screenplayTimes",
        placeholder: ui.defaults().screenplayTimes,
        get: () => s.screenplayTimes,
        set: (v) => { s.screenplayTimes = v; },
      }),
    ],
  }];
}
