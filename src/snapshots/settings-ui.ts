import { fmt, plural, t } from "../i18n";
import { exportRoot, inFolder, snapshotsFolderProblem, snapshotsRoot, submissionsRoot } from "../core/classify";
import { bookProblem, overlapProblem, type FolderProblem } from "../core/folder-problem";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { folderRow, textRow, toggleRow, type SettingsBlock } from "../ui/settings-rows";

/**
 * The Snapshots section's rows, under the heading the tab draws. The folder is saved only when
 * it passes snapshotsFolderProblem; otherwise the saved value stays and a warning under the
 * setting says why (no notices while typing).
 */
export function snapshotsSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  const problemOf = (v: string): FolderProblem | null => {
    const first = snapshotsFolderProblem(v, ui.app.vault.configDir, s.trackFolders, () => false);
    if (first) return first;
    const root = snapshotsRoot(v, s.defaultsLanguage);
    const overlap = overlapProblem(root, [exportRoot(s.exportFolder, s.defaultsLanguage), submissionsRoot(s.submissionsFolder, s.defaultsLanguage)]);
    if (overlap) return overlap;
    const inBook = bookProblem(root, plugin.books.allBooksEverywhere());
    if (inBook) return inBook;
    return snapshotsFolderProblem(v, ui.app.vault.configDir, s.trackFolders, (r) =>
      r !== s.snapshotsFolder && ui.app.vault.getMarkdownFiles().some((f) => inFolder(f.path, r)));
  };
  return [{
    items: [
      folderRow(ui, {
        name: t("settings.snapshotsFolder"),
        desc: t("settings.snapshotsFolder.desc"),
        placeholder: snapshotsRoot("", s.defaultsLanguage),
        get: () => s.snapshotsFolder,
        set: (v) => { s.snapshotsFolder = snapshotsRoot(v, s.defaultsLanguage); },
        problemOf,
        problemText: snapshotsProblemText,
      }),
      toggleRow(ui, {
        name: t("settings.snapshotBeforeFirstEdit"),
        desc: t("settings.snapshotBeforeFirstEdit.desc"),
        get: () => s.snapshotBeforeFirstEdit,
        set: (v) => { s.snapshotBeforeFirstEdit = v; },
      }),
      // A text row, not a numberRow: a cleared or wordless field goes back to the default (20),
      // where a numberRow would keep the stored number.
      textRow(ui, {
        name: t("settings.snapshotsKeepAuto"),
        desc: t("settings.snapshotsKeepAuto.desc"),
        get: () => String(s.snapshotsKeepAuto),
        set: (v) => { s.snapshotsKeepAuto = ui.num(v, ui.defaults().snapshotsKeepAuto, 1); },
        fallback: () => String(ui.defaults().snapshotsKeepAuto),
      }),
    ],
  }];
}

function snapshotsProblemText(p: FolderProblem): string {
  switch (p.reason) {
    case "path": return t("settings.snapshotsFolder.path");
    case "config":
    case "tracked":
    case "book": return t("settings.snapshotsFolder.invalid", { folder: p.folder });
    case "holds-book": return t("settings.folderProblem.holdsBook", { folder: p.folder });
    case "notes": return t("settings.snapshotsFolder.notes", { folder: p.folder });
    case "overlap": return t("settings.folderProblem.overlap", { folder: p.folder });
  }
}

export async function snapshotsOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  let n = 0;
  try {
    for (const note of await plugin.snapshots.store.notesWithSnapshots()) n += (await plugin.snapshots.store.list(note)).length;
  } catch { return null; }
  return n > 0 ? plural("settings.features.off.snapshots", n, { n: fmt(n), folder: plugin.settings.snapshotsFolder }) : null;
}
