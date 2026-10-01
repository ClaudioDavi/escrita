import { ItemView, TFile, WorkspaceLeaf, moment, setIcon } from "obsidian";
import { t, unitAmount } from "../i18n";
import { AUTO_KINDS, type SnapshotEntry } from "./index-format";
import type { SnapshotsModule } from "./index";
import { SharedFolderError } from "./store";

export const SNAPSHOTS_VIEW = "escrita-snapshots";

interface Action {
  id: string;
  icon: string;
  label: string;
  run: () => void;
}

/** Side panel: the active note's snapshots, newest first. */
export class SnapshotsView extends ItemView {
  private renderSeq = 0;

  constructor(leaf: WorkspaceLeaf, private module: SnapshotsModule) {
    super(leaf);
  }

  getViewType(): string {
    return SNAPSHOTS_VIEW;
  }

  getDisplayText(): string {
    return t("snapshots.view.title");
  }

  getIcon(): string {
    return "history";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  async refresh(): Promise<void> {
    const seq = ++this.renderSeq;
    const path = this.module.currentNotePath();
    const file = path ? this.module.noteFile(path) : null;
    let entries: SnapshotEntry[] = [];
    let words: number | null = null;
    let problem: string | null = null;
    if (file) {
      try {
        [entries, words] = await Promise.all([this.module.list(file), this.module.currentWords(file).catch(() => null)]);
      } catch (e) {
        console.error("Escrita: couldn't list the snapshots", e);
        if (e instanceof SharedFolderError) problem = t("snapshots.notice.sharedFolder", { other: e.owner });
      }
    }
    if (seq !== this.renderSeq) return; // a newer refresh started meanwhile
    this.render(file, entries, words, problem);
  }

  /**
   * Rebuild the panel. Elements are thrown away on every render, so they get
   * plain listeners. Keyboard focus survives the rebuild.
   */
  private render(file: TFile | null, entries: SnapshotEntry[], words: number | null, problem: string | null = null): void {
    const root = this.contentEl;
    const focus = this.focused();
    root.empty();
    root.addClass("escrita-snapshots");

    const header = root.createDiv({ cls: "escrita-snapshots-header" });
    const titles = header.createDiv({ cls: "escrita-snapshots-titles" });
    titles.createDiv({ cls: "escrita-snapshots-title", text: t("snapshots.view.title") });
    if (file) {
      titles.createDiv({ cls: "escrita-snapshots-note", text: file.basename, attr: { title: file.path } });
      const take = header.createEl("button", {
        cls: "clickable-icon escrita-snapshots-icon-btn",
        attr: { "aria-label": t("snapshots.action.take"), "data-escrita-action": "take" },
      });
      setIcon(take, "camera");
      take.addEventListener("click", () => { void this.module.promptTake(file); });
    }

    if (!file || entries.length === 0) {
      root.createDiv({ cls: "escrita-snapshots-empty", text: problem ?? t(file ? "snapshots.empty.none" : "snapshots.empty.noNote") });
      this.restoreFocus(focus);
      return;
    }

    const list = root.createDiv({ cls: "escrita-snapshots-list" });
    for (const e of entries) this.card(list, file, e, words);
    this.restoreFocus(focus);
  }

  private card(list: HTMLElement, file: TFile, e: SnapshotEntry, words: number | null): void {
    const busy = this.module.isBusy(file.path, e.file);
    const card = list.createDiv({ cls: "escrita-snapshot-card", attr: { "data-escrita-file": e.file } });
    card.toggleClass("is-busy", busy);

    const head = card.createDiv({ cls: "escrita-snapshot-head" });
    head.createSpan({ cls: "escrita-snapshot-name", text: this.module.labelOf(e) });
    // an automatic snapshot the writer named still says what it was
    if (AUTO_KINDS.has(e.kind) && e.name.trim() !== "") {
      head.createSpan({ cls: "escrita-snapshot-kind", text: this.module.kindLabel(e.kind) });
    }

    const meta = card.createDiv({ cls: "escrita-snapshot-meta" });
    const when = e.taken > 0 ? moment(e.taken).format("ll LT") : e.file;
    meta.createSpan({ text: when });
    meta.createSpan({ text: e.words >= 0 ? unitAmount("words", e.words) : t("snapshots.row.unknown") });
    if (words !== null && e.words >= 0) {
      const d = words - e.words;
      meta.createSpan({
        cls: "escrita-snapshot-delta",
        text: d === 0 ? t("snapshots.row.same") : t("snapshots.row.delta", { delta: `${d > 0 ? "+" : "−"}${unitAmount("words", Math.abs(d))}` }),
      });
    }

    const actions: Action[] = [
      { id: "view", icon: "eye", label: t("snapshots.action.view"), run: () => { void this.module.openCompare(file.path, e.file, "current", "view"); } },
      { id: "compare", icon: "git-compare", label: t("snapshots.action.compare"), run: () => { void this.module.openCompare(file.path, e.file); } },
      { id: "restore", icon: "rotate-ccw", label: t("snapshots.action.restore"), run: () => { void this.module.restoreAll(file, e); } },
      { id: "rename", icon: "pencil", label: t("snapshots.action.rename"), run: () => { void this.module.rename(file, e); } },
      { id: "delete", icon: "trash-2", label: t("snapshots.action.delete"), run: () => { void this.module.remove(file, e); } },
    ];
    const row = card.createDiv({ cls: "escrita-snapshot-actions" });
    for (const a of actions) {
      const b = row.createEl("button", {
        cls: "clickable-icon escrita-snapshots-icon-btn",
        attr: { "aria-label": a.label, "data-escrita-action": a.id },
      });
      setIcon(b, a.icon);
      b.disabled = busy;
      b.addEventListener("click", a.run);
    }
  }

  private focused(): { file: string | null; action: string } | null {
    const el = this.contentEl.doc.activeElement;
    if (!(el instanceof HTMLElement) || !this.contentEl.contains(el)) return null;
    const action = el.getAttr("data-escrita-action");
    if (!action) return null;
    return { file: el.closest(".escrita-snapshot-card")?.getAttr("data-escrita-file") ?? null, action };
  }

  private restoreFocus(f: { file: string | null; action: string } | null): void {
    if (!f) return;
    const root = this.contentEl;
    const scope = f.file
      ? Array.from(root.querySelectorAll(".escrita-snapshot-card")).find((c) => c.getAttr("data-escrita-file") === f.file)
        ?? root.querySelector(".escrita-snapshot-card")
      : root;
    const target = scope?.querySelector(`[data-escrita-action="${f.action}"]`)
      ?? scope?.querySelector("[data-escrita-action]");
    if (target instanceof HTMLElement) target.focus();
  }
}
