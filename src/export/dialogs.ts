// The export modal's small dialogs: the chapter picker, "where to write" and "the file
// exists" (PLAN-0.8 boards 26 b and 26 d). Moved out of modal.ts; the `ask*` entry points
// for the last two stay there.
import { App, Modal } from "obsidian";
import type { ChapterRef } from "../core/book-source";
import { noteName } from "../core/paths";
import { lang, t } from "../i18n";
import { dayMonthText } from "./logic";

export type ExistsAnswer = "cancel" | "both" | "replace";

/** Stands for the path in a translated sentence until `sentenceWithPath` splits there. */
const PATH_SLOT = "\u0000";

/** A sentence with a path in the middle: the text around it plain, the path in the mono style. */
function sentenceWithPath(host: HTMLElement, sentence: string, path: string): void {
  const body = host.createDiv({ cls: "escrita-export-existsbody" });
  const [before, after] = sentence.split(PATH_SLOT);
  body.createSpan({ text: before });
  body.createSpan({ cls: "escrita-export-mono", text: path });
  body.createSpan({ text: after });
}

// ------------------------------------------------------------------ the chapter picker (board 26 b)

/**
 * Ask which chapters to export. `chapters` is the whole book in order; `headings` has
 * the manuscript heading of each included chapter (a chapter without one is left out
 * by `compile: false` and greyed). Resolves to the ticked paths, in book order, or
 * null when dismissed.
 */
export function askChapters(app: App, chapters: readonly ChapterRef[], headings: ReadonlyMap<string, string>, checked: ReadonlySet<string>, compileProperty = "compile", collection = false): Promise<string[] | null> {
  return new Promise((resolve) => new ChaptersModal(app, chapters, headings, checked, resolve, compileProperty, collection).open());
}

export class ChaptersModal extends Modal {
  private answer: string[] | null = null;
  private boxes: { path: string; input: HTMLInputElement }[] = [];

  constructor(
    app: App,
    private chapters: readonly ChapterRef[],
    private headings: ReadonlyMap<string, string>,
    private checked: ReadonlySet<string>,
    private done: (v: string[] | null) => void,
    private compileProperty = "compile",
    private collection = false,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t(this.collection ? "export.stories" : "export.chapters"));
    this.modalEl?.addClass("escrita-export-picker");
    const list = this.contentEl.createDiv({ cls: "escrita-export-picklist" });
    for (const ref of this.chapters) {
      const left = !ref.include;
      const row = list.createEl("label", { cls: "escrita-export-pick" });
      const input = row.createEl("input", { attr: { type: "checkbox" } });
      input.checked = !left && this.checked.has(ref.path);
      input.disabled = left;
      if (left) row.addClass("is-left");
      row.createSpan({ cls: "escrita-export-pick-name", text: noteName(ref.path) });
      row.createSpan({
        cls: left ? "escrita-export-pick-head escrita-export-mono" : "escrita-export-pick-head",
        text: left ? `${this.compileProperty}: false` : this.headings.get(ref.path) ?? ref.title,
      });
      if (!left) this.boxes.push({ path: ref.path, input });
    }
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: t("export.picker.all") }).addEventListener("click", () => this.setAll(true));
    buttons.createEl("button", { text: t("export.picker.none") }).addEventListener("click", () => this.setAll(false));
    buttons.createEl("button", { cls: "mod-cta", text: t("export.picker.ok") }).addEventListener("click", () => {
      this.answer = this.boxes.filter((b) => b.input.checked).map((b) => b.path);
      this.close();
    });
  }

  private setAll(on: boolean): void {
    for (const b of this.boxes) b.input.checked = on;
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answer);
  }
}


// ------------------------------------------------------------------ where to write, and the file exists (boards 26 d)

export class WhereModal extends Modal {
  private answer = false;

  constructor(app: App, private path: string, private done: (write: boolean) => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("export.where.title"));
    this.modalEl?.addClass("escrita-export-exists");
    sentenceWithPath(this.contentEl, t("export.where.ask", { path: PATH_SLOT }), this.path);
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: t("export.exists.cancel") }).addEventListener("click", () => this.close());
    buttons.createEl("button", { cls: "mod-cta", text: t("export.where.write") }).addEventListener("click", () => { this.answer = true; this.close(); });
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answer);
  }
}

export class ExistsModal extends Modal {
  private answer: ExistsAnswer = "cancel";

  constructor(app: App, private path: string, private mtime: number | null, private done: (a: ExistsAnswer) => void, private canReplace = true) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("export.exists.title"));
    this.modalEl?.addClass("escrita-export-exists");
    const date = this.mtime === null ? "" : dayMonthText(new Date(this.mtime), lang());
    sentenceWithPath(this.contentEl, t("export.exists.body", { path: PATH_SLOT, date }), this.path);
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const pick = (a: ExistsAnswer) => () => { this.answer = a; this.close(); };
    buttons.createEl("button", { text: t("export.exists.cancel") }).addEventListener("click", pick("cancel"));
    buttons.createEl("button", { text: t("export.exists.both") }).addEventListener("click", pick("both"));
    if (this.canReplace) buttons.createEl("button", { cls: "mod-cta", text: t("export.exists.replace") }).addEventListener("click", pick("replace"));
    else buttons.lastElementChild?.classList.add("mod-cta");
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answer);
  }
}
