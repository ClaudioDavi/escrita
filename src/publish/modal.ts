import { App, Modal, setIcon } from "obsidian";
import { fmt, t, unitAmount } from "../i18n";
import { parseUnit } from "../core/measure";
import { hasBlockers, sortChecks, type Check, type CheckLevel } from "./checks";

export interface PublishModalOptions {
  title: string;
  checks: Check[];
  /** YYYY-MM-DD shown in the date field; empty when the note's own date can't be shown there */
  date: string;
  /** the note's date as written, when it isn't YYYY-MM-DD (it's kept unless the user picks a date) */
  unparsedDate?: string;
  /** jump to a 0-based line of the note */
  onJump(line: number): void;
  /** open another note (URL taken) */
  /** `dateChanged` false = keep whatever date the note has; resolves true when published */
  onPublish(date: string, dateChanged: boolean): Promise<boolean>;
}

const ICONS: Record<CheckLevel, string> = {
  blocker: "x-circle",
  warning: "alert-triangle",
  passed: "check-circle",
};

/** "Publish “O farol”": the checks, a date and the Publish button. */
export class PublishModal extends Modal {
  private busy = false;

  constructor(app: App, private opts: PublishModalOptions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl, opts } = this;
    this.modalEl.addClass("escrita-publish-modal");
    contentEl.addClass("escrita-publish");
    titleEl.setText(t("publish.title", { title: opts.title }));

    const blockers = hasBlockers(opts.checks);
    const warnings = opts.checks.some((c) => c.level === "warning");
    contentEl.createDiv({
      cls: `escrita-publish-summary is-${blockers ? "blocker" : warnings ? "warning" : "passed"}`,
      text: t(blockers ? "publish.summary.blockers" : warnings ? "publish.summary.warnings" : "publish.summary.clean"),
    });

    const list = contentEl.createEl("ul", { cls: "escrita-publish-checks" });
    for (const check of sortChecks(opts.checks)) this.renderCheck(list, check);

    const dateRow = contentEl.createDiv({ cls: "escrita-publish-date" });
    const label = dateRow.createEl("label", { cls: "escrita-publish-date-label" });
    label.createSpan({ text: t("publish.date") });
    const date = label.createEl("input", { type: "date" });
    date.value = opts.date;
    let dateChanged = false;
    dateRow.createDiv({ cls: "escrita-publish-hint", text: t("publish.dateHint") });
    if (opts.unparsedDate !== undefined) {
      dateRow.createDiv({
        cls: "escrita-publish-hint escrita-publish-date-warning",
        text: t("publish.dateUnparsed", { value: opts.unparsedDate }),
      });
    }

    const footer = contentEl.createDiv({ cls: "escrita-publish-footer" });
    let anyway: HTMLInputElement | null = null;
    if (blockers) {
      const wrap = footer.createDiv({ cls: "escrita-publish-anyway" });
      const l = wrap.createEl("label");
      anyway = l.createEl("input", { type: "checkbox" });
      l.createSpan({ text: t("publish.anyway") });
      wrap.createDiv({ cls: "escrita-publish-hint", text: t("publish.anywayHint") });
    }
    const buttons = footer.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: t("publish.cancel") });
    const publish = buttons.createEl("button", { cls: "mod-cta", text: t("publish.button") });

    const update = () => {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date.value);
      publish.disabled = this.busy || (blockers && !anyway?.checked) || (dateChanged && !validDate);
    };
    date.addEventListener("input", () => { dateChanged = true; update(); });
    anyway?.addEventListener("change", update);
    cancel.addEventListener("click", () => this.close());
    publish.addEventListener("click", () => {
      if (publish.disabled) return;
      this.busy = true;
      update();
      void opts.onPublish(date.value, dateChanged).then((ok) => {
        this.busy = false;
        if (ok) this.close();
        else update();
      });
    });
    update();
  }

  private renderCheck(list: HTMLElement, check: Check): void {
    const li = list.createEl("li", { cls: `escrita-publish-check is-${check.level}` });
    const row = li.createDiv({ cls: "escrita-publish-row" });
    const icon = row.createSpan({ cls: "escrita-publish-icon", attr: { "aria-label": t(`publish.level.${check.level}`) } });
    setIcon(icon, ICONS[check.level]);
    const text = row.createSpan({ cls: "escrita-publish-text", text: checkText(check) });
    if (check.line !== undefined && check.items.length === 0) this.jumpable(text, check.line);

    if (check.level === "passed" || check.items.length === 0) return;
    const items = li.createEl("ul", { cls: "escrita-publish-items" });
    for (const item of check.items) {
      const el = items.createEl("li", { cls: "escrita-publish-item" });
      const label = item.text.trim() || t("publish.noNote");
      if (item.line !== undefined) {
        el.createSpan({ cls: "escrita-publish-line", text: fmt(item.line + 1) });
        el.createSpan({ text: label });
        this.jumpable(el, item.line);
      } else {
        el.setText(label);
      }
    }
  }

  private jumpable(el: HTMLElement, line: number): void {
    this.clickable(el, t("publish.jump", { line: fmt(line + 1) }), () => this.opts.onJump(line));
  }

  private clickable(el: HTMLElement, label: string, go: () => void): void {
    el.addClass("is-clickable");
    el.setAttr("role", "button");
    el.setAttr("tabindex", "0");
    el.setAttr("aria-label", label);
    const run = () => { this.close(); go(); };
    el.addEventListener("click", run);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** The translated sentence for a check. */
export function checkText(check: Check): string {
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(check.vars)) vars[k] = typeof v === "number" ? fmt(v) : v;
  if (check.id === "overLimit") {
    vars.limit = unitAmount(parseUnit(check.vars.unit), Number(check.vars.limit));
    delete vars.unit;
  }
  return t(`publish.check.${check.id}.${check.level === "passed" ? "ok" : "bad"}`, vars);
}
