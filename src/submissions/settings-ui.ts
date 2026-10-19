import { fmt, plural, t } from "../i18n";
import { inFolder, pluginRoot } from "../core/classify";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { textRow, type SettingsBlock } from "../ui/settings-rows";
import { duplicateProp, propsOf, resultValues } from "./logic";

/** The Submissions section's rows, under the heading the tab draws: the result values (the first one is "pending") and the property names. The folder is drawn by the core (settings-tab.ts, pluginFolderRows). */
export function submissionsSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  const props = [
    ["Work", "submissionWorkProperty"], ["Market", "submissionMarketProperty"], ["Sent", "submissionSentProperty"],
    ["Result", "submissionResultProperty"], ["Responded", "submissionRespondedProperty"],
  ] as const;
  return [{
    items: [
      textRow(ui, {
        name: t("submissions.settings.results"),
        desc: t("submissions.settings.results.desc"),
        key: "submissionResults",
        placeholder: ui.defaults().submissionResults,
        get: () => s.submissionResults,
        set: (v) => { s.submissionResults = resultValues(v).join(", "); },
      }),
      ...props.map(([name, key]) => textRow(ui, {
        name: t(`submissions.settings.prop${name}`),
        desc: t(`submissions.settings.prop${name}.desc`),
        key,
        placeholder: ui.defaults()[key],
        get: () => s[key],
        // A name another property already uses is not stored; the field then shows the saved one again.
        set: (v) => {
          const next = v.trim() || ui.defaults()[key];
          const all = propsOf(s);
          if (duplicateProp(all, name.toLowerCase() as keyof typeof all, next)) return;
          s[key] = next;
        },
      })),
    ],
  }];
}

/** What stays when the feature is turned off: the notes in the folder (read from the vault, not from live state). */
export async function submissionsOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const folder = pluginRoot("submissions", plugin.settings);
  const n = plugin.app.vault.getMarkdownFiles().filter((f) => inFolder(f.path, folder)).length;
  if (n === 0) return t("settings.features.off.submissions.none");
  return plural("settings.features.off.submissions", n, { n: fmt(n), folder });
}
