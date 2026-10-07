import { Setting } from "obsidian";
import { t } from "../i18n";
import { DEFAULT_SETTINGS } from "../settings";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";

/**
 * The Export section: the property names, the author on the title page and the
 * chapter heading. The folder is drawn by the core (settings.ts, pluginFolderRows). Every value has an English default in DEFAULT_SETTINGS (rule 6).
 */
export function exportSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("export.settings.heading")).setHeading();
  const text = (key: "compileProperty" | "dedicationProperty" | "epigraphProperty" | "authorProperty" | "coverProperty" | "epubSceneBreak" | "collectionProperty", name: string): void => {
    new Setting(el)
      .setName(t(`export.settings.${name}`))
      .setDesc(t(`export.settings.${name}.desc`))
      .addText((c) => {
        c.setPlaceholder(DEFAULT_SETTINGS[key]).setValue(s[key]);
        ui.saveOnCommit(c, () => DEFAULT_SETTINGS[key], (v) => { s[key] = v; });
      });
  };
  text("compileProperty", "compile");
  text("dedicationProperty", "dedication");
  text("epigraphProperty", "epigraph");
  text("authorProperty", "authorProperty");
  new Setting(el)
    .setName(t("export.settings.authorName"))
    .setDesc(t("export.settings.authorName.desc"))
    .addText((c) => {
      c.setValue(s.authorName);
      ui.saveOnCommit(c, () => "", (v) => { s.authorName = v; });
    });
  new Setting(el)
    .setName(t("export.settings.authorSurname"))
    .setDesc(t("export.settings.authorSurname.desc"))
    .addText((c) => {
      c.setValue(s.authorSurname);
      ui.saveOnCommit(c, () => "", (v) => { s.authorSurname = v; });
    });
  new Setting(el)
    .setName(t("export.settings.contact"))
    .setDesc(t("export.settings.contact.desc"))
    .addTextArea((c) => {
      c.setValue(s.contactLines);
      ui.saveOnCommit(c, () => "", (v) => { s.contactLines = v; });
    });
  new Setting(el)
    .setName(t("export.settings.heading.format"))
    .setDesc(t("export.settings.heading.format.desc"))
    .addText((c) => {
      c.setPlaceholder(t("export.settings.heading.format.placeholder")).setValue(s.chapterHeadingFormat);
      ui.saveOnCommit(c, () => "", (v) => { s.chapterHeadingFormat = v; });
    });
  text("coverProperty", "cover");
  text("epubSceneBreak", "epubBreak");
  text("collectionProperty", "collection");
}
