import { Setting } from "obsidian";
import { fmt, plural, t } from "../i18n";
import { DEFAULT_SETTINGS } from "../settings";
import { DEFAULT_SNAPSHOTS_FOLDER, exportRoot, inFolder, snapshotsFolderProblem, snapshotsRoot, submissionsRoot } from "../core/classify";
import { bookProblem, overlapProblem, type FolderProblem } from "../core/folder-problem";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";

/**
 * The Snapshots section. The folder is saved only when it passes snapshotsFolderProblem;
 * otherwise the saved value stays and a warning under the setting says why (no notices while typing).
 */
export function snapshotsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.snapshots")).setHeading();
  const folder = new Setting(el)
    .setName(t("settings.snapshotsFolder"))
    .setDesc(t("settings.snapshotsFolder.desc"));
  const hint = folder.descEl.createDiv({ cls: "escrita-setting-warning" });
  hint.toggle(false);
  const problemOf = (v: string): FolderProblem | null => {
    const first = snapshotsFolderProblem(v, ui.app.vault.configDir, s.trackFolders, () => false);
    if (first) return first;
    const root = snapshotsRoot(v);
    const overlap = overlapProblem(root, [exportRoot(s.exportFolder), submissionsRoot(s.submissionsFolder)]);
    if (overlap) return overlap;
    const inBook = bookProblem(root, plugin.books.allBooksEverywhere());
    if (inBook) return inBook;
    return snapshotsFolderProblem(v, ui.app.vault.configDir, s.trackFolders, (r) =>
      r !== s.snapshotsFolder && ui.app.vault.getMarkdownFiles().some((f) => inFolder(f.path, r)));
  };
  folder.addText((c) => {
    c.setPlaceholder(DEFAULT_SNAPSHOTS_FOLDER).setValue(s.snapshotsFolder);
    const show = (v: string) => {
      const problem = problemOf(v);
      c.inputEl.toggleClass("escrita-invalid", problem !== null);
      hint.setText(problem ? snapshotsProblemText(problem) : "");
      hint.toggle(problem !== null);
      return problem;
    };
    c.onChange((v) => { show(v); }); // the warning follows the typing; the save waits for the commit
    ui.saveOnCommit(c, () => DEFAULT_SNAPSHOTS_FOLDER, (v) => {
      if (show(v)) return;
      s.snapshotsFolder = snapshotsRoot(v);
    });
  });
  new Setting(el)
    .setName(t("settings.snapshotBeforeFirstEdit"))
    .setDesc(t("settings.snapshotBeforeFirstEdit.desc"))
    .addToggle((c) => c.setValue(s.snapshotBeforeFirstEdit)
      .onChange(async (v) => { s.snapshotBeforeFirstEdit = v; await ui.save(); }));
  new Setting(el)
    .setName(t("settings.snapshotsKeepAuto"))
    .setDesc(t("settings.snapshotsKeepAuto.desc"))
    .addText((c) => {
      c.setValue(String(s.snapshotsKeepAuto));
      ui.saveOnCommit(c, () => String(DEFAULT_SETTINGS.snapshotsKeepAuto), (v) => {
        s.snapshotsKeepAuto = ui.num(v, DEFAULT_SETTINGS.snapshotsKeepAuto, 1);
        c.setValue(String(s.snapshotsKeepAuto));
      });
    });
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
