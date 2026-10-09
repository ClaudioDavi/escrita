import { FuzzySuggestModal, MarkdownView, Notice, TFile, type App, type Editor, type FuzzyMatch } from "obsidian";
import type EscritaPlugin from "../main";
import { inFolder } from "../core/classify";
import { planTemplateInsert, templateVars } from "../core/template";
import { t } from "../i18n";

/** The notes offered as templates: the markdown files in the templates folder, by path. */
function templateFiles(app: App, folder: string): TFile[] {
  return app.vault.getMarkdownFiles()
    .filter((f) => inFolder(f.path, folder))
    .sort((a, b) => a.path.localeCompare(b.path));
}

class TemplateModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private folder: string, private onPick: (f: TFile) => void) {
    super(app);
    this.setPlaceholder(t("editor.template.placeholder"));
    this.setInstructions([
      { command: "↑↓", purpose: t("editor.template.navigate") },
      { command: "↵", purpose: t("editor.template.insert") },
      { command: "esc", purpose: t("editor.template.close") },
    ]);
  }

  /** The template's name, with its path in a muted line below. */
  renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    el.createDiv({ cls: "escrita-template-path", text: match.item.path });
  }

  getItems(): TFile[] { return this.files; }

  getItemText(f: TFile): string {
    return f.path.slice(this.folder.length + 1).replace(/\.md$/i, "");
  }

  onChooseItem(f: TFile): void { this.onPick(f); }
}

/** The warning for no templates folder, with a button that opens Escrita's settings. */
function noFolderNotice(plugin: EscritaPlugin): void {
  const frag = createFragment((f) => f.appendText(t("editor.template.noFolder")));
  const notice = new Notice(frag, 10000);
  const messageEl = notice.messageEl as HTMLElement | undefined;
  if (!messageEl) return;
  const button = messageEl.createEl("button", { text: t("editor.template.openSettings"), cls: "escrita-notice-button" });
  button.addEventListener("click", () => {
    notice.hide();
    try {
      const setting = (plugin.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
      setting?.open();
      setting?.openTabById(plugin.manifest.id);
    } catch { /* the settings tab is not reachable: nothing to do */ }
  });
}

/**
 * "Insert from a template": pick a note from the templates folder; its body goes
 * in at the cursor and its properties are added to the note where it lacks them,
 * all in one editor transaction so one undo takes everything back.
 */
export function insertFromTemplate(plugin: EscritaPlugin, editor: Editor, file: TFile | null): void {
  const folder = plugin.settings.templatesFolder.replace(/^\/+|\/+$/g, "");
  if (folder === "") {
    noFolderNotice(plugin);
    return;
  }
  const files = templateFiles(plugin.app, folder).filter((f) => f.path !== file?.path);
  if (files.length === 0) {
    new Notice(t("editor.template.empty", { folder }));
    return;
  }
  new TemplateModal(plugin.app, files, folder, (tpl) => {
    void (async () => {
      let text: string;
      try {
        text = await plugin.app.vault.cachedRead(tpl);
      } catch {
        new Notice(t("editor.template.readFailed"));
        return;
      }
      // the editor must still show this note (the writer may have moved on while the template loaded)
      const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || view.editor !== editor || view.file?.path !== file?.path) {
        new Notice(t("editor.template.moved"));
        return;
      }
      // read the editor after the await: the writer may have typed while the template loaded
      const doc = editor.getValue();
      const title = file?.basename ?? "";
      const changes = planTemplateInsert(doc, editor.posToOffset(editor.getCursor("to")), text, templateVars(title, new Date()));
      if (changes.length === 0) return;
      editor.transaction({
        changes: changes.map((c) => ({ from: editor.offsetToPos(c.from), to: editor.offsetToPos(c.to), text: c.insert })),
      });
    })();
  }).open();
}
