import { App, Modal, Setting } from "obsidian";
import { FolderSuggest } from "../ui/suggest";
import { t } from "../i18n";

/** Title + parent folder for a new book. */
export class CreateBookModal extends Modal {
  private title = "";

  constructor(
    app: App,
    private folder: string,
    private submit: (title: string, folder: string) => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("outline.create.title"));
    const go = async () => {
      if (await this.submit(this.title, this.folder)) this.close();
    };
    new Setting(this.contentEl)
      .setName(t("outline.create.name"))
      .addText((c) => {
        c.onChange((v) => { this.title = v; });
        c.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void go(); }
        });
        c.inputEl.win.setTimeout(() => c.inputEl.focus(), 0);
      });
    new Setting(this.contentEl)
      .setName(t("outline.create.folder"))
      .setDesc(t("outline.create.folderDesc"))
      .addText((c) => {
        c.setValue(this.folder).onChange((v) => { this.folder = v; });
        new FolderSuggest(this.app, c.inputEl);
      });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("outline.create.submit")).setCta().onClick(() => void go()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
