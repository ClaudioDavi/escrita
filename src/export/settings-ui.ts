import { Setting } from "obsidian";
import { t } from "../i18n";
import { DEFAULT_SETTINGS } from "../settings";
import { exportRoot, snapshotsRoot, submissionsRoot } from "../core/classify";
import { holdsOwnNotes, pluginFolderProblem } from "../core/folder-problem";
import { addFolderField } from "../core/folder-setting";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";

/**
 * The Export section: the folder, the property names, the author on the title page and the
 * chapter heading. Every value has an English default in DEFAULT_SETTINGS (rule 6).
 */
export function exportSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("export.settings.heading")).setHeading();
  addFolderField(
    new Setting(el).setName(t("export.settings.folder")).setDesc(t("export.settings.folder.desc")), ui,
    {
      placeholder: DEFAULT_SETTINGS.exportFolder,
      value: s.exportFolder,
      problemOf: (v) => {
        const root = exportRoot(v);
        const paths = () => ui.app.vault.getMarkdownFiles().map((f) => f.path);
        return pluginFolderProblem(
          root, [submissionsRoot(s.submissionsFolder), snapshotsRoot(s.snapshotsFolder)],
          ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, exportRoot(s.exportFolder), s),
        );
      },
      save: (v) => { s.exportFolder = exportRoot(v); },
    },
  );
  const text = (key: "compileProperty" | "dedicationProperty" | "epigraphProperty" | "authorProperty", name: string): void => {
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
}
