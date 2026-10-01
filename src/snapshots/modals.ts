import { App, Modal, Setting, SuggestModal } from "obsidian";
import { t } from "../i18n";

export interface NameOptions {
  title: string;
  value: string;
  placeholder: string;
  confirm: string;
}

/** Ask for a snapshot name. Resolves to the text (maybe "") when confirmed, null when cancelled. */
export function askName(app: App, o: NameOptions): Promise<string | null> {
  return new Promise((resolve) => new NameModal(app, o, resolve).open());
}

class NameModal extends Modal {
  private value: string;
  private answer: string | null = null;

  constructor(app: App, private o: NameOptions, private done: (v: string | null) => void) {
    super(app);
    this.value = o.value;
  }

  onOpen(): void {
    this.setTitle(this.o.title);
    const submit = () => {
      this.answer = this.value;
      this.close();
    };
    new Setting(this.contentEl)
      .setName(t("snapshots.name.label"))
      .addText((c) => {
        c.setPlaceholder(this.o.placeholder).setValue(this.value).onChange((v) => { this.value = v; });
        c.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            submit();
          }
        });
        c.inputEl.win.setTimeout(() => { c.inputEl.focus(); c.inputEl.select(); }, 0);
      });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("snapshots.cancel")).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(this.o.confirm).setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answer);
  }
}

/** Pick one of `paths` (fuzzy by substring). Resolves to the path, or null when dismissed. */
export function pickPath(app: App, paths: string[], placeholder: string): Promise<string | null> {
  return new Promise((resolve) => new PathSuggest(app, paths, placeholder, resolve).open());
}

class PathSuggest extends SuggestModal<string> {
  private chosen: string | null = null;

  constructor(app: App, private paths: string[], placeholder: string, private done: (v: string | null) => void) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): string[] {
    const q = query.toLowerCase().trim();
    return q === "" ? this.paths : this.paths.filter((p) => p.toLowerCase().includes(q));
  }

  renderSuggestion(path: string, el: HTMLElement): void {
    el.createDiv({ text: path.replace(/\.md$/, "") });
  }

  onChooseSuggestion(path: string): void {
    this.chosen = path;
  }

  onClose(): void {
    // onChooseSuggestion runs after onClose: answer on the next tick
    window.setTimeout(() => this.done(this.chosen), 0);
  }
}
