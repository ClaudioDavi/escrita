import type { Setting } from "obsidian";
import { t } from "../i18n";
import type { SettingsUi } from "./module-context";
import type { FolderProblem } from "./folder-problem";

/** The warning text for a folder problem; "overlap" and the shared reasons read the same in every section. */
export function folderProblemText(p: FolderProblem): string {
  switch (p.reason) {
    case "path": return t("settings.folderProblem.path");
    case "config":
    case "tracked":
    case "book": return t("settings.folderProblem.outside", { folder: p.folder });
    case "holds-book": return t("settings.folderProblem.holdsBook", { folder: p.folder });
    case "overlap": return t("settings.folderProblem.overlap", { folder: p.folder });
    case "notes": return t("settings.folderProblem.notes", { folder: p.folder });
  }
}

/**
 * A folder text field that saves only a value that passes `problemOf`. Otherwise the saved value stays
 * and a warning under the setting says why (no notices while typing): `problemText`, or the shared
 * warnings of `folderProblemText`.
 */
export function addFolderField(
  row: Setting, ui: SettingsUi,
  o: {
    placeholder: string; value: string; read?: () => string | number; problemOf: (v: string) => FolderProblem | null; save: (v: string) => void;
    problemText?: (p: FolderProblem) => string;
  },
): void {
  const text = o.problemText ?? folderProblemText;
  const hint = row.descEl.createDiv({ cls: "escrita-setting-warning" });
  hint.toggle(false);
  row.addText((c) => {
    c.setPlaceholder(o.placeholder).setValue(o.value);
    const show = (v: string): boolean => {
      const problem = o.problemOf(v);
      c.inputEl.toggleClass("escrita-invalid", problem !== null);
      hint.setText(problem ? text(problem) : "");
      hint.toggle(problem !== null);
      return problem !== null;
    };
    c.onChange((v) => { show(v); });
    ui.saveOnCommit(c, () => o.placeholder, (v) => { if (!show(v)) o.save(v); }, o.read);
  });
}
