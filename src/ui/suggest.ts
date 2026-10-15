// Input suggests shared by modals and settings rows (1.0.4, PLAN-1.0.4 Q6). Imports only
// `obsidian`, never a module folder.

import { AbstractInputSuggest, TFile, TFolder, type App } from "obsidian";

/** The suggestions for `query` among `items` by path: substring, without case, sorted, at most 50. */
function byPath<T extends { path: string }>(items: T[], query: string): T[] {
  const q = query.toLowerCase().trim();
  return items
    .filter((f) => f.path.toLowerCase().includes(q))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 50);
}

/** Folder paths for a text field (the vault root left out). Moved from outline/modals.ts. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private input: HTMLInputElement) {
    super(app, input);
  }

  getSuggestions(query: string): TFolder[] {
    const folders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder && !f.isRoot());
    return byPath(folders, query);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}

/** Markdown note paths for a text field (a template setting). */
export class NoteSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, private input: HTMLInputElement) {
    super(app, input);
  }

  getSuggestions(query: string): TFile[] {
    return byPath(this.app.vault.getMarkdownFiles(), query);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}
