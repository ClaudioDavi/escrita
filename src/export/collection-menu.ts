import { Menu, Modal, Notice, TAbstractFile, TFile, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { safeFileName } from "../core/book";
import { fmt, plural, t } from "../i18n";
import { collectionNoteText, explorerSortOf, sortLikeExplorer, type ExplorerSort } from "./logic";

/**
 * The explorer's sort setting, read from the vault config. The API doesn't type it, so it
 * is read through `getConfig` when it exists; without it, name A to Z (natural order).
 */
function explorerSort(plugin: EscritaPlugin): ExplorerSort {
  const vault = plugin.app.vault as { getConfig?: (key: string) => unknown };
  try { return explorerSortOf(vault.getConfig?.("fileSortOrder")); } catch { return "alphabetical"; }
}

/**
 * The "files-menu" listener (SF 13, Q25, board 34a): when two or more files are selected and
 * every one is a Markdown note, one item "Create a collection…" (D9: the new note opens).
 * The links go in the file explorer's order, not the order of the clicks. It is the only code
 * that makes a collection; one written by hand exports the same.
 */
export function onFilesMenu(plugin: EscritaPlugin, exportable: (f: TFile) => boolean): (menu: Menu, files: TAbstractFile[]) => void {
  return (menu, files) => {
    if (files.length < 2) return;
    const notes: TFile[] = [];
    for (const f of files) {
      if (!(f instanceof TFile) || f.extension !== "md" || !exportable(f)) return;
      notes.push(f);
    }
    const stories = sortLikeExplorer(notes.map((file) => ({ file, path: file.path, ctime: file.stat.ctime, mtime: file.stat.mtime })), explorerSort(plugin))
      .map((x) => x.file);
    menu.addItem((item) => item
      .setTitle(t("export.collection.menu"))
      .setIcon("library")
      .onClick(() => { new CollectionModal(plugin, stories).open(); }));
  };
}

/** Writes the collection note beside the first story and opens it. */
export async function createCollection(plugin: EscritaPlugin, stories: readonly TFile[], title: string): Promise<void> {
  const { app, settings } = plugin;
  const first = stories[0];
  const folder = first.parent && first.parent.path !== "/" ? `${first.parent.path}/` : "";
  const path = normalizePath(`${folder}${safeFileName(title)}.md`);
  // the vault's link format; a story whose name another note shares gets a path, so the link finds the same note
  const links = stories.map((f) => `[[${app.metadataCache.fileToLinktext(f, path, true)}]]`);
  const { file } = await plugin.notes.create(path, collectionNoteText(settings.collectionProperty, links), { exists: "unique" });
  await app.workspace.getLeaf(false).openFile(file, { active: true });
}

/** The small modal that asks for the collection's title (board 34). */
class CollectionModal extends Modal {
  constructor(private plugin: EscritaPlugin, private stories: readonly TFile[]) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle(t("export.collection.title"));
    this.modalEl?.addClass("escrita-export-exists");
    const field = this.contentEl.createDiv({ cls: "escrita-export-field" });
    field.createDiv({ cls: "escrita-export-label", text: t("export.collection.name") });
    const input = field.createEl("input", {
      cls: "escrita-export-title-input",
      attr: { type: "text", placeholder: t("export.collection.placeholder"), "aria-label": t("export.collection.name") },
    });
    const n = this.stories.length;
    this.contentEl.createDiv({
      cls: "escrita-export-hint",
      text: plural("export.collection.hint", n, { n: fmt(n), property: this.plugin.settings.collectionProperty }),
    });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const create = buttons.createEl("button", { cls: "mod-cta", text: t("export.collection.create") });
    const cancel = buttons.createEl("button", { text: t("export.exists.cancel") });
    const title = (): string => safeFileName(input.value);
    const sync = (): void => { create.disabled = title() === ""; };
    sync();
    input.addEventListener("input", sync);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !create.disabled) { e.preventDefault(); create.click(); } });
    cancel.addEventListener("click", () => this.close());
    create.addEventListener("click", () => {
      const name = title();
      if (name === "") return;
      create.disabled = true;
      this.close();
      createCollection(this.plugin, this.stories, name).catch((e: unknown) => {
        console.error("Escrita: couldn't create the collection", e);
        new Notice(t("export.collection.error"));
      });
    });
    input.focus();
  }

  onClose(): void { this.contentEl.empty(); }
}
