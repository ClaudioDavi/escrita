import { App, ItemView, Modal, Notice, WorkspaceLeaf, moment, setIcon } from "obsidian";
import { fmt, t } from "../i18n";
import { excerpt, newestFirst, type DarlingEntry } from "./format";
import type { DarlingsModule } from "./index";

export const VIEW_DARLINGS = "escrita-darlings";

/** Side panel listing the darlings of the active book (or the global note). */
export class DarlingsView extends ItemView {
  private renderSeq = 0;

  constructor(leaf: WorkspaceLeaf, private module: DarlingsModule) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_DARLINGS;
  }

  getDisplayText(): string {
    return t("darlings.view.title");
  }

  getIcon(): string {
    return "heart";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  async refresh(): Promise<void> {
    const seq = ++this.renderSeq;
    const notePath = this.module.currentNotePath();
    let entries: DarlingEntry[] = [];
    try {
      entries = newestFirst(await this.module.entries(notePath));
    } catch (err) {
      console.error("Escrita: could not read darlings", err);
    }
    if (seq !== this.renderSeq) return; // a newer refresh started meanwhile
    this.render(notePath, entries);
  }

  /**
   * Rebuild the panel. The elements are thrown away on every render, so they
   * get plain listeners (not registerDomEvent, which would keep each one until
   * the view closes). Keyboard focus survives the rebuild.
   */
  private render(notePath: string, entries: DarlingEntry[]): void {
    const root = this.contentEl;
    const focus = this.focusedAction(entries);
    root.empty();
    root.addClass("escrita-darlings");

    const header = root.createDiv({ cls: "escrita-darlings-header" });
    const titles = header.createDiv({ cls: "escrita-darlings-titles" });
    titles.createDiv({ cls: "escrita-darlings-title", text: t("darlings.view.title") });
    const noteName = notePath.split("/").slice(-2).join("/").replace(/\.md$/i, "");
    titles.createDiv({ cls: "escrita-darlings-note", text: noteName, attr: { title: notePath } });
    if (this.module.noteFile(notePath)) {
      const open = header.createEl("button", {
        cls: "clickable-icon escrita-darlings-icon-btn",
        attr: { "aria-label": t("darlings.openNote"), "data-escrita-action": "open-note" },
      });
      setIcon(open, "file-text");
      open.addEventListener("click", () => { void this.module.openNote(notePath); });
    }

    if (!entries.length) {
      const empty = root.createDiv({ cls: "escrita-darlings-empty" });
      const icon = empty.createDiv({ cls: "escrita-darlings-empty-icon" });
      setIcon(icon, "heart");
      empty.createDiv({ cls: "escrita-darlings-empty-title", text: t("darlings.empty") });
      empty.createDiv({ cls: "escrita-darlings-empty-hint", text: t("darlings.empty.hint") });
      this.restoreFocus(focus);
      return;
    }

    root.createDiv({
      cls: "escrita-darlings-count",
      text: entries.length === 1 ? t("darlings.count.one") : t("darlings.count", { n: fmt(entries.length) }),
    });

    const list = root.createDiv({ cls: "escrita-darlings-list" });
    for (const e of entries) this.renderEntry(list, notePath, e);
    this.restoreFocus(focus);
  }

  /** The focused button in the panel, and the entry to fall back to if its own is gone. */
  private focusedAction(next: DarlingEntry[]): { id: string | null; action: string; fallback: string | null } | null {
    const el = this.contentEl.doc.activeElement;
    if (!(el instanceof HTMLElement) || !this.contentEl.contains(el)) return null;
    const action = el.getAttr("data-escrita-action");
    if (!action) return null;
    const id = el.closest(".escrita-darling")?.getAttr("data-escrita-id") ?? null;
    let fallback: string | null = null;
    if (id && !next.some((e) => e.id === id)) {
      // the entry went away: move to the card that followed it, else the one before
      const cards = Array.from(this.contentEl.querySelectorAll(".escrita-darling"));
      const ids = cards.map((c) => c.getAttr("data-escrita-id"));
      const left = new Set(next.map((e) => e.id));
      const at = ids.indexOf(id);
      fallback = ids.slice(at + 1).find((x) => x && left.has(x))
        ?? ids.slice(0, Math.max(0, at)).reverse().find((x) => x && left.has(x))
        ?? null;
    }
    return { id, action, fallback };
  }

  private restoreFocus(f: { id: string | null; action: string; fallback: string | null } | null): void {
    if (!f) return;
    const root = this.contentEl;
    const card = (id: string) => Array.from(root.querySelectorAll(".escrita-darling"))
      .find((c) => c.getAttr("data-escrita-id") === id) ?? null;
    let target: Element | null = null;
    if (f.id === null) target = root.querySelector(`[data-escrita-action="${f.action}"]`);
    else {
      const same = card(f.id);
      if (same) target = same.querySelector(`[data-escrita-action="${f.action}"]`);
      else if (f.fallback) target = card(f.fallback)?.querySelector("[data-escrita-action]") ?? null;
      if (!target) target = root.querySelector(".escrita-darlings-list [data-escrita-action]")
        ?? root.querySelector("[data-escrita-action]");
    }
    if (target instanceof HTMLElement) target.focus();
  }

  private renderEntry(list: HTMLElement, notePath: string, e: DarlingEntry): void {
    const busy = this.module.isBusy(e.id);
    const card = list.createDiv({ cls: "escrita-darling", attr: { "data-escrita-id": e.id } });
    if (busy) card.addClass("is-busy");

    const meta = card.createDiv({ cls: "escrita-darling-meta" });
    meta.createSpan({ cls: "escrita-darling-source", text: this.module.sourceTitle(e) });
    const date = moment(e.date, "YYYY-MM-DD", true);
    meta.createSpan({ cls: "escrita-darling-date", text: date.isValid() ? date.format("ll") : e.date });

    const text = excerpt(e.text);
    card.createDiv({
      cls: "escrita-darling-text" + (text ? "" : " is-empty"),
      text: text || t("darlings.emptyPassage"),
    });

    const actions = card.createDiv({ cls: "escrita-darling-actions" });
    // aria-disabled rather than disabled while busy, so a focused button keeps focus
    const button = (action: string, icon: string, label: string, cls: string, onClick: () => void) => {
      const b = actions.createEl("button", {
        cls: `escrita-darling-btn ${cls}`,
        attr: { "data-escrita-action": action, "aria-disabled": busy ? "true" : "false" },
      });
      const i = b.createSpan({ cls: "escrita-darling-btn-icon" });
      setIcon(i, icon);
      b.createSpan({ text: label });
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (!this.module.isBusy(e.id)) onClick();
      });
      return b;
    };
    button("restore", "undo-2", t("darlings.restore"), "mod-cta", () => { void this.module.restore(notePath, e.id); });
    button("open-source", "file-symlink", t("darlings.openSource"), "", () => { void this.module.openSource(notePath, e); });
    button("delete", "trash-2", t("darlings.delete"), "escrita-darling-delete", () => this.module.confirmDelete(notePath, e));
  }
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirm: string;
  warning?: boolean;
  onConfirm: () => void | Promise<void>;
}

export class ConfirmModal extends Modal {
  constructor(app: App, private opts: ConfirmOptions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl, opts } = this;
    titleEl.setText(opts.title);
    contentEl.addClass("escrita-darlings-confirm");
    contentEl.createEl("p", { text: opts.body });
    const row = contentEl.createDiv({ cls: "modal-button-container" });
    const ok = row.createEl("button", { text: opts.confirm, cls: opts.warning ? "mod-warning" : "mod-cta" });
    const cancel = row.createEl("button", { text: t("darlings.cancel") });
    ok.addEventListener("click", () => {
      ok.disabled = true;
      this.close();
      // run as a thunk so a synchronous throw is caught too
      Promise.resolve().then(() => opts.onConfirm()).catch((err) => {
        console.error("Escrita: darlings action failed", err);
        new Notice(t("darlings.notice.actionFailed", { error: err instanceof Error ? err.message : String(err) }));
      });
    });
    cancel.addEventListener("click", () => this.close());
    window.setTimeout(() => (opts.warning ? cancel : ok).focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
