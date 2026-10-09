import { Setting } from "obsidian";
import { fmt, plural, t } from "../i18n";
import { inFolder, submissionsRoot } from "../core/classify";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { duplicateProp, propsOf, resultValues } from "./logic";

/** The Submissions section: the result values (the first one is "pending") and the property names. The folder is drawn by the core (settings.ts, pluginFolderRows). */
export function submissionsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("submissions.settings.heading")).setHeading();
  new Setting(el)
    .setName(t("submissions.settings.results"))
    .setDesc(t("submissions.settings.results.desc"))
    .addText((c) => {
      c.setPlaceholder(ui.defaults().submissionResults).setValue(s.submissionResults);
      ui.saveOnCommit(c, () => ui.defaults().submissionResults, (v) => { s.submissionResults = resultValues(v).join(", "); });
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
        c.setPlaceholder(ui.defaults()[key]).setValue(s[key]);
        ui.saveOnCommit(c, () => ui.defaults()[key], (v) => {
          const next = v.trim() || ui.defaults()[key];
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
