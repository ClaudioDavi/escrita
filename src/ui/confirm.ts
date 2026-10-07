import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

/** Ask a yes/no question. Resolves true only when the confirm button is pressed. */
export function confirmAction(app: App, title: string, message: string, confirm: string, warning = true): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, title, message, confirm, warning, resolve).open();
  });
}

class ConfirmModal extends Modal {
  private answered = false;

  constructor(
    app: App,
    private heading: string,
    private message: string,
    private confirmText: string,
    private warning: boolean,
    private done: (ok: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.heading);
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("outline.cancel")).onClick(() => this.close()))
      .addButton((b) => {
        b.setButtonText(this.confirmText).onClick(() => { this.answered = true; this.close(); });
        if (this.warning) b.setWarning(); else b.setCta();
      });
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answered);
  }
}
