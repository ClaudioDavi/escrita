// "Move this book's entries to the universe" (board 18): the command, the preview
// modal, the progress and the final notices. Planning is migration.ts
// (planMigration) and migrate-plan.ts (what the preview shows); this file applies
// the plan one note at a time with fileManager.renameFile (links update) and adds
// properties only through processFrontMatter, only where missing, never over a value.

import { App, Modal, Notice, Setting, TFile, TFolder, normalizePath, type Menu, type TAbstractFile } from "obsidian";
import { inFolder } from "../core/classify";
import { plural, t } from "../i18n";
import type EscritaPlugin from "../main";
import { ENTRY_KINDS } from "./settings";
import {
  basename, effectiveMoves, folderHint, previewGroup, resultNotice,
  type MigrationResult,
} from "./migrate-plan";
import { planMigration, type MigrationPlan } from "./migration";

interface BookCtx {
  /** the book folder path */
  folder: string;
  /** the book note */
  note: TFile;
  title: string;
}

/** What the preview is about: the book, its plan and where it goes. */
interface Prepared extends BookCtx {
  plan: MigrationPlan;
  universeNote: string;
  universeName: string;
  universeRoot: string;
  /** the link text that reaches the universe note unambiguously from the book note */
  universeLinkText: string;
  /** the settings' universe: only its folder joins notes without a property, so other universes need the property on each moved note */
  universeIsDefault: boolean;
}

const hasValue = (v: unknown): boolean => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** The book of a file: the book note, a chapter or any other file of it. Null when it is in no book. */
function bookOf(plugin: EscritaPlugin, file: TAbstractFile | null): BookCtx | null {
  if (!file) return null;
  const book = plugin.books.classify(file).book;
  if (!book) return null;
  return { folder: book.folder.path, note: book.note, title: book.title };
}

/**
 * Command: the book of the active note (the book note or a chapter) → preview modal.
 * Shows the notices of board 18 c when the mode is not "universe" or the book has
 * no entry folders. Nothing moves before the writer clicks "Move".
 */
export function migrateActiveBook(plugin: EscritaPlugin, active: TFile | null): void {
  const book = bookOf(plugin, active);
  if (!book) {
    new Notice(t("universe.migrate.noBook"));
    return;
  }
  startMigration(plugin, book);
}

/** The explorer's folder menu on a book folder: adds "Move this book's entries to the universe". */
export function addMigrateFileMenuItem(plugin: EscritaPlugin, menu: Menu, file: TAbstractFile): void {
  if (!(file instanceof TFolder)) return;
  if (plugin.books.classify(file).kind !== "book-folder") return;
  const book = bookOf(plugin, file);
  if (!book) return;
  menu.addItem((item) => item
    .setTitle(t("universe.cmd.migrate"))
    .setIcon("folder-input")
    .onClick(() => startMigration(plugin, book)));
}

function startMigration(plugin: EscritaPlugin, book: BookCtx): void {
  const prepared = prepare(plugin, book);
  if (prepared) new MigratePreviewModal(plugin, prepared).open();
}

/** Checks the mode and the folders, builds the plan; shows a notice and returns null when there is nothing to do. */
function prepare(plugin: EscritaPlugin, book: BookCtx): Prepared | null {
  const s = plugin.settings;
  if (s.universeMode !== "universe") {
    new Notice(t("universe.migrate.wrongMode"));
    return null;
  }
  const { vault } = plugin.app;
  // Where the book's entries go: the universe its note names; the settings' one when it names none.
  const scope = plugin.universe.scopeOf(book.note);
  const info = scope.kind === "universe" && scope.note
    ? plugin.universe.universes().find((u) => u.note === scope.note)
    : undefined;
  const universe = info ?? plugin.universe.universes().find((u) => u.isDefault);
  if (!universe) return null;
  const fm = plugin.books.frontmatter(book.note);
  const files = vault.getMarkdownFiles()
    // chapters are never entries, whatever the type folders are called
    .filter((f) => inFolder(f.path, book.folder) && f.path !== book.note.path && plugin.books.classify(f).kind !== "chapter")
    .map((f) => ({ path: f.path, hasType: hasValue(plugin.books.frontmatter(f)[s.typeProperty]) }));
  const plan = planMigration({
    bookFolder: book.folder,
    bookNote: book.note.path,
    bookHasUniverse: hasValue(fm[s.universeProperty]),
    universeRoot: universe.root,
    files,
    exists: (p) => vault.getAbstractFileByPath(normalizePath(p)) !== null,
    types: s.entryTypes,
  });
  if (plan.groups.length === 0) {
    const folders = ENTRY_KINDS.map((k) => s.entryTypes[k].folder).filter((f) => f.trim() !== "");
    new Notice(t("universe.migrate.noFolders", { book: book.title, folders: folderHint(folders) }));
    return null;
  }
  const universeFile = vault.getAbstractFileByPath(universe.note);
  const universeLinkText = universeFile instanceof TFile
    ? plugin.app.metadataCache.fileToLinktext(universeFile, book.note.path, true)
    : universe.name;
  return {
    ...book, plan, universeNote: universe.note, universeName: universe.name, universeRoot: universe.root,
    universeLinkText, universeIsDefault: universe.isDefault,
  };
}

class MigratePreviewModal extends Modal {
  private addType = true;
  private addUniverse = true;

  constructor(private plugin: EscritaPlugin, private p: Prepared) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle(t("universe.migrate.title", { book: this.p.title, universe: this.p.universeName }));
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    const { plan } = this.p;
    const s = this.plugin.settings;
    contentEl.empty();
    contentEl.addClass("escrita-migrate");
    contentEl.createEl("p", { cls: "escrita-migrate-intro", text: plural("universe.migrate.intro", plan.moves.length) });

    for (const g of plan.groups) {
      const view = previewGroup(g, this.addType);
      const box = contentEl.createDiv({ cls: "escrita-migrate-group" });
      const head = box.createDiv({ cls: "escrita-migrate-head" });
      head.createSpan({ text: g.fromFolder });
      head.createSpan({ cls: "escrita-migrate-arrow", text: "→" });
      head.createSpan({ text: g.toFolder });
      head.createSpan({
        cls: "escrita-migrate-count",
        text: view.moved === view.total ? String(view.moved) : t("universe.migrate.groupCount", { moved: view.moved, total: view.total }),
      });
      for (const row of view.rows) {
        const el = box.createDiv({ cls: row.type === "clash" ? "escrita-migrate-row escrita-migrate-clash" : "escrita-migrate-row" });
        el.createSpan({ cls: "escrita-migrate-row-name", text: row.name });
        if (row.type === "clash") {
          el.createSpan({ cls: "escrita-migrate-row-note", text: t("universe.migrate.clash", { folder: row.folder }) });
        } else if (row.addType !== null) {
          el.createSpan({
            cls: "escrita-migrate-row-note",
            text: t("universe.migrate.addedType", { prop: s.typeProperty, value: row.addType }),
          });
        }
      }
      if (view.hidden > 0) {
        const el = box.createDiv({ cls: "escrita-migrate-row" });
        el.createSpan({ cls: "escrita-migrate-row-note", text: t("universe.migrate.more", { n: view.hidden }) });
      }
    }

    const checks = contentEl.createDiv({ cls: "escrita-migrate-checks" });
    if (plan.missingType > 0) {
      this.check(checks, plural("universe.migrate.addType", plan.missingType, { prop: s.typeProperty }), this.addType, (v) => {
        this.addType = v;
        this.render();
      });
    }
    if (plan.needsUniverse) {
      this.check(checks, t("universe.migrate.addUniverse", {
        prop: s.universeProperty, link: `[[${this.p.universeLinkText}]]`,
      }), this.addUniverse, (v) => { this.addUniverse = v; });
    }
    contentEl.createEl("p", { cls: "escrita-migrate-hint", text: t("universe.migrate.emptyFolders") });

    const n = plan.moves.length;
    new Setting(contentEl)
      .addButton((b) => b.setButtonText(t("universe.migrate.cancel")).onClick(() => this.close()))
      .addButton((b) => b
        .setButtonText(plural("universe.migrate.move", n))
        .setCta()
        .setDisabled(n === 0)
        .onClick(() => {
          this.close();
          void runMigration(this.plugin, this.p, this.addType, plan.needsUniverse && this.addUniverse);
        }));
    contentEl.createEl("p", { cls: "escrita-migrate-hint", text: t("universe.migrate.foot") });
  }

  private check(parent: HTMLElement, label: string, on: boolean, change: (v: boolean) => void): void {
    const row = parent.createEl("label", { cls: "escrita-migrate-check" });
    const input = row.createEl("input", { type: "checkbox" });
    input.checked = on;
    input.addEventListener("change", () => change(input.checked));
    row.createSpan({ text: label });
  }
}

/** The modal while notes move. It can't be closed midway (Escape and clicks outside do nothing). */
class MigrateProgressModal extends Modal {
  private locked = true;
  private line!: HTMLElement;
  private fill!: HTMLElement;

  constructor(app: App, private book: string, private total: number) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("universe.migrate.progressTitle", { book: this.book }));
    const { contentEl } = this;
    contentEl.addClass("escrita-migrate");
    const bar = contentEl.createDiv({ cls: "escrita-migrate-bar" });
    this.fill = bar.createDiv({ cls: "escrita-migrate-bar-fill" });
    this.line = contentEl.createDiv({ cls: "escrita-migrate-progress-line" });
    contentEl.createEl("p", { cls: "escrita-migrate-hint", text: t("universe.migrate.noCancel") });
    this.update(0, "");
  }

  update(done: number, name: string): void {
    this.fill.setCssProps({ width: `${this.total === 0 ? 100 : Math.round((done / this.total) * 100)}%` });
    this.line.setText(t("universe.migrate.progress", { done, total: this.total, name }));
  }

  finish(): void {
    this.locked = false;
    this.close();
  }

  close(): void {
    if (this.locked) return;
    super.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

async function runMigration(plugin: EscritaPlugin, p: Prepared, addType: boolean, addUniverse: boolean): Promise<void> {
  const { vault, fileManager } = plugin.app;
  const s = plugin.settings;
  const moves = effectiveMoves(p.plan, addType);
  const result: MigrationResult = {
    moved: 0, clashes: [...p.plan.conflicts], failed: [], typesAdded: 0, universeAdded: false,
  };
  const progress = new MigrateProgressModal(plugin.app, p.title, moves.length);
  progress.open();
  try {
    for (const [i, m] of moves.entries()) {
      progress.update(i, basename(m.from));
      const file = vault.getAbstractFileByPath(m.from);
      if (!(file instanceof TFile)) {
        result.failed.push(m.from);
        continue;
      }
      // The vault may have changed since the preview: never overwrite.
      if (vault.getAbstractFileByPath(normalizePath(m.to)) !== null) {
        result.clashes.push({ kind: m.kind, from: m.from, to: m.to });
        continue;
      }
      try {
        await plugin.notes.ensureFolder(m.to.slice(0, m.to.lastIndexOf("/")));
        await fileManager.renameFile(file, normalizePath(m.to));
        result.moved++;
      } catch {
        result.failed.push(m.from);
        continue;
      }
      if (m.addType !== null) {
        const value = m.addType;
        try {
          let added = false;
          await fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            if (hasValue(fm[s.typeProperty])) return;
            fm[s.typeProperty] = value;
            added = true;
          });
          if (added) result.typesAdded++;
        } catch {
          // The note moved; a type that couldn't be added is not worth failing the move.
        }
      }
      if (!p.universeIsDefault) {
        // another universe's folder doesn't join notes by itself: the moved note names its universe (only where it has none)
        try {
          await fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            if (!hasValue(fm[s.universeProperty])) fm[s.universeProperty] = `[[${p.universeLinkText}]]`;
          });
        } catch {
          // The note moved; the writer can add the property by hand.
        }
      }
      progress.update(i + 1, basename(m.to));
    }
    if (addUniverse) {
      try {
        let added = false;
        await fileManager.processFrontMatter(p.note, (fm: Record<string, unknown>) => {
          if (hasValue(fm[s.universeProperty])) return;
          fm[s.universeProperty] = `[[${p.universeLinkText}]]`;
          added = true;
        });
        result.universeAdded = added;
      } catch {
        // Same: the entries are already moved.
      }
    }
  } finally {
    progress.finish();
  }
  announce(p, result);
}

function announce(p: Prepared, result: MigrationResult): void {
  const n = resultNotice(result, p.folder);
  const lines = [plural("universe.migrate.done", n.moved, { universe: p.universeName })];
  if (n.clashCount > 0) {
    lines.push(plural("universe.migrate.clashed", n.clashCount, { folder: n.clashFolder, names: n.clashNames }));
  }
  if (n.failedCount > 0) lines.push(plural("universe.migrate.failed", n.failedCount, { names: n.failedNames }));
  new Notice(lines.join(" "), n.clashCount + n.failedCount > 0 ? 10000 : 5000);
}
