import { Modal, Setting, SuggestModal, type App } from "obsidian";
import { NEW_WORK_KINDS, type NewWorkKind } from "../core/new-work";
import { t } from "../i18n";
import { FolderSuggest } from "../ui/suggest";

/**
 * "New work…": what are you writing? Each kind with a muted line saying where it goes
 * (the setting's folder, or the active note's). A kind not offered now is not listed.
 */
export class NewWorkList extends SuggestModal<NewWorkKind> {
  constructor(
    app: App,
    private offers: (kind: NewWorkKind) => boolean,
    private folderOf: (kind: NewWorkKind) => string,
    private onPick: (kind: NewWorkKind) => void,
  ) {
    super(app);
    this.setPlaceholder(t("new-work.list.placeholder"));
    this.setInstructions([
      { command: "↑↓", purpose: t("new-work.list.navigate") },
      { command: "↵", purpose: t("new-work.list.choose") },
      { command: "esc", purpose: t("new-work.list.close") },
    ]);
  }

  getSuggestions(query: string): NewWorkKind[] {
    const q = query.trim().toLowerCase();
    return NEW_WORK_KINDS.filter((k) => this.offers(k) && t(`new-work.kind.${k}`).toLowerCase().includes(q));
  }

  renderSuggestion(kind: NewWorkKind, el: HTMLElement): void {
    el.createDiv({ text: t(`new-work.kind.${kind}`) });
    const folder = this.folderOf(kind);
    const key = folder ? `new-work.where.${kind}` : `new-work.where.${kind}Here`;
    el.createDiv({ cls: "escrita-template-path", text: t(key, { folder }) });
  }

  onChooseSuggestion(kind: NewWorkKind): void {
    this.onPick(kind);
  }
}

export interface NewWorkModalOptions {
  kind: NewWorkKind;
  /** the folder field's first value */
  folder: string;
  /** the template note's path from the settings; empty = the built-in one */
  template: string;
  /** Resolves true when the work was created (the modal closes), false to stay open. */
  submit: (title: string, folder: string) => Promise<boolean>;
}

/** Title, folder and the template in use, then Create. Enter in the title field creates too. */
export class NewWorkModal extends Modal {
  private title = "";
  private folder: string;
  private busy = false;

  constructor(app: App, private opts: NewWorkModalOptions) {
    super(app);
    this.folder = opts.folder;
  }

  onOpen(): void {
    const { kind, template } = this.opts;
    this.setTitle(t(`new-work.modal.${kind}`));
    const go = async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        if (await this.opts.submit(this.title, this.folder)) this.close();
      } finally {
        this.busy = false;
      }
    };
    new Setting(this.contentEl)
      .setName(t("new-work.modal.title"))
      .addText((c) => {
        c.onChange((v) => { this.title = v; });
        c.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void go(); }
        });
        c.inputEl.win.setTimeout(() => c.inputEl.focus(), 0);
      });
    new Setting(this.contentEl)
      .setName(t("new-work.modal.folder"))
      .setDesc(t(`new-work.modal.folderDesc.${kind}`))
      .addText((c) => {
        c.setValue(this.folder).onChange((v) => { this.folder = v; });
        new FolderSuggest(this.app, c.inputEl);
      });
    new Setting(this.contentEl)
      .setName(t("new-work.modal.template"))
      .setDesc(template ? t("new-work.modal.templateDesc.own") : t(`new-work.modal.templateDesc.${kind}`))
      .addText((c) => {
        c.setValue(template || t("new-work.modal.builtIn")).setDisabled(true);
      });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("new-work.modal.create")).setCta().onClick(() => void go()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
