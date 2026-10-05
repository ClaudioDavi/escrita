import { Setting } from "obsidian";
import { fmt, plural, t } from "../i18n";
import { DEFAULT_SETTINGS } from "../settings";
import { exportRoot, inFolder, snapshotsRoot, submissionsRoot } from "../core/classify";
import { holdsOwnNotes, pluginFolderProblem } from "../core/folder-problem";
import { addFolderField } from "../core/folder-setting";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { duplicateProp, propsOf, resultValues } from "./logic";

/** The Submissions section: the folder and the result values (the first one is "pending"). */
export function submissionsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("submissions.settings.heading")).setHeading();
  addFolderField(
    new Setting(el).setName(t("submissions.settings.folder")).setDesc(t("submissions.settings.folder.desc")), ui,
    {
      placeholder: DEFAULT_SETTINGS.submissionsFolder,
      value: s.submissionsFolder,
      problemOf: (v) => {
        const root = submissionsRoot(v);
        const paths = () => ui.app.vault.getMarkdownFiles().map((f) => f.path);
        return pluginFolderProblem(
          root, [exportRoot(s.exportFolder), snapshotsRoot(s.snapshotsFolder)],
          ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, submissionsRoot(s.submissionsFolder), s),
        );
      },
      save: (v) => { s.submissionsFolder = submissionsRoot(v); },
    },
  );
  new Setting(el)
    .setName(t("submissions.settings.results"))
    .setDesc(t("submissions.settings.results.desc"))
    .addText((c) => {
      c.setPlaceholder(DEFAULT_SETTINGS.submissionResults).setValue(s.submissionResults);
      ui.saveOnCommit(c, () => DEFAULT_SETTINGS.submissionResults, (v) => { s.submissionResults = resultValues(v).join(", "); });
    });
  const props = [
    ["Work", "submissionWorkProperty"], ["Market", "submissionMarketProperty"], ["Sent", "submissionSentProperty"],
    ["Result", "submissionResultProperty"], ["Responded", "submissionRespondedProperty"],
  ] as const;
  for (const [name, key] of props) {
    new Setting(el)
      .setName(t(`submissions.settings.prop${name}`))
      .setDesc(t(`submissions.settings.prop${name}.desc`))
      .addText((c) => {
        c.setPlaceholder(DEFAULT_SETTINGS[key]).setValue(s[key]);
        ui.saveOnCommit(c, () => DEFAULT_SETTINGS[key], (v) => {
          const next = v.trim() || DEFAULT_SETTINGS[key];
          const all = propsOf(s);
          if (duplicateProp(all, name.toLowerCase() as keyof typeof all, next)) { c.setValue(s[key]); return; }
          s[key] = next;
        });
      });
  }
}

/** What stays when the feature is turned off: the notes in the folder (read from the vault, not from live state). */
export async function submissionsOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const folder = submissionsRoot(plugin.settings.submissionsFolder);
  const n = plugin.app.vault.getMarkdownFiles().filter((f) => inFolder(f.path, folder)).length;
  if (n === 0) return t("settings.features.off.submissions.none");
  return plural("settings.features.off.submissions", n, { n: fmt(n), folder });
}
