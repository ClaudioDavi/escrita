import { t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { textAreaRow, textRow, type SettingsBlock } from "../ui/settings-rows";

type PropertyKey = "compileProperty" | "dedicationProperty" | "epigraphProperty" | "authorProperty" | "coverProperty" | "epubSceneBreak" | "collectionProperty";

/**
 * The Export section's rows, under the heading the tab draws: the property names, the author on
 * the title page and the chapter heading. The folder is drawn by the core (settings-tab.ts,
 * pluginFolderRows). Every value has a default in the install's set (ui.defaults(), rule 6).
 */
export function exportSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  const property = (key: PropertyKey, name: string) => textRow(ui, {
    name: t(`export.settings.${name}`),
    desc: t(`export.settings.${name}.desc`),
    key,
    placeholder: ui.defaults()[key],
    get: () => s[key],
    set: (v) => { s[key] = v; },
  });
  return [{
    items: [
      property("compileProperty", "compile"),
      property("dedicationProperty", "dedication"),
      property("epigraphProperty", "epigraph"),
      property("authorProperty", "authorProperty"),
      textRow(ui, {
        name: t("export.settings.authorName"),
        desc: t("export.settings.authorName.desc"),
        get: () => s.authorName,
        set: (v) => { s.authorName = v; },
      }),
      textRow(ui, {
        name: t("export.settings.authorSurname"),
        desc: t("export.settings.authorSurname.desc"),
        get: () => s.authorSurname,
        set: (v) => { s.authorSurname = v; },
      }),
      textAreaRow(ui, {
        name: t("export.settings.contact"),
        desc: t("export.settings.contact.desc"),
        get: () => s.contactLines,
        set: (v) => { s.contactLines = v; },
      }),
      textRow(ui, {
        name: t("export.settings.heading.format"),
        desc: t("export.settings.heading.format.desc"),
        placeholder: t("export.settings.heading.format.placeholder"),
        get: () => s.chapterHeadingFormat,
        set: (v) => { s.chapterHeadingFormat = v; },
      }),
      property("coverProperty", "cover"),
      property("epubSceneBreak", "epubBreak"),
      property("collectionProperty", "collection"),
    ],
  }];
}
