import { Menu, Modal, Notice, TAbstractFile, TFile, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { safeFileName } from "../core/book";
import { fmt, plural, t } from "../i18n";
import { collectionNoteText, storyLink } from "./logic";

/** the Markdown notes among the selected files, in the order Obsidian gives them (the explorer's, for a range). */
function notesOf(files: readonly TAbstractFile[], exportable: (f: TFile) => boolean): TFile[] {
  return files.filter((f): f is TFile => f instanceof TFile && exportable(f));
}

/**
 * The "files-menu" listener (SF 13, Q25): with two or more Markdown notes selected, one
 * item "Create a collection…" (D9: the new note opens). It is the only code that makes a
 * collection; one written by hand exports the same.
 */
export function onFilesMenu(plugin: EscritaPlugin, exportable: (f: TFile) => boolean): (menu: Menu, files: TAbstractFile[]) => void {
  return (menu, files) => {
    const stories = notesOf(files, exportable);
    if (stories.length < 2) return;
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
  const property = settings.collectionProperty.trim() || "contents";
  // a story whose name another note shares is listed by its path, so the link finds the same note
  const links = stories.map((f) => storyLink(f.path, app.metadataCache.getFirstLinkpathDest(f.basename, path)?.path !== f.path));
  const { file } = await plugin.notes.create(path, collectionNoteText(property, links), { exists: "unique" });
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
      text: plural("export.collection.hint", n, { n: fmt(n), property: this.plugin.settings.collectionProperty.trim() || "contents" }),
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
