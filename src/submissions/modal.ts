import { App, Modal } from "obsidian";
import { t } from "../i18n";
import { canRecord, cleanMarket, resultLine, whereParts, workLine, type SubmissionProps } from "./logic";

export interface SubmissionModalOptions {
  /** the work's title and, on the right, its stage and size ("pronto · 5.120"); "" for none */
  workTitle: string;
  workInfo: string;
  /** the three most recent markets from existing submission notes */
  markets: string[];
  /** YYYY-MM-DD, today */
  today: string;
  /** the first value of the results list */
  result: string;
  /** the configured property names */
  props: SubmissionProps;
  /** the path the note would get (the "Creates" line) and the work property text */
  pathFor(market: string, sent: string): string;
  linkFor(market: string, sent: string): string;
  /** resolves true when the note was created (the modal then closes) */
  onRecord(market: string, sent: string): Promise<boolean>;
}

/** "Record a submission": the work, where to, the date, what it will create (board 28 a). */
export class SubmissionModal extends Modal {
  private busy = false;

  constructor(app: App, private opts: SubmissionModalOptions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl, opts } = this;
    this.modalEl.addClass("escrita-submission-modal");
    contentEl.addClass("escrita-submission");
    titleEl.setText(t("submissions.title"));

    const work = contentEl.createDiv({ cls: "escrita-submission-field" });
    work.createSpan({ text: t("submissions.work") });
    const workBox = work.createDiv({ cls: "escrita-submission-work" });
    workBox.createSpan({ cls: "escrita-submission-work-title", text: opts.workTitle });
    if (opts.workInfo) workBox.createSpan({ cls: "escrita-submission-work-info", text: opts.workInfo });

    const marketLabel = contentEl.createEl("label", { cls: "escrita-submission-field" });
    marketLabel.createSpan({ text: t("submissions.market") });
    const market = marketLabel.createEl("input", { type: "text", cls: "escrita-submission-input" });
    market.placeholder = t("submissions.market.placeholder");

    if (opts.markets.length > 0) {
      const chips = contentEl.createDiv({ cls: "escrita-submission-chips" });
      chips.setAttribute("aria-label", t("submissions.recent"));
      for (const m of opts.markets) {
        const chip = chips.createEl("button", { cls: "escrita-submission-chip", text: m });
        chip.addEventListener("click", () => { market.value = m; update(); market.focus(); });
      }
    }

    const sentLabel = contentEl.createEl("label", { cls: "escrita-submission-field" });
    sentLabel.createSpan({ text: t("submissions.sent") });
    const sent = sentLabel.createEl("input", { type: "date", cls: "escrita-submission-input escrita-submission-date" });
    sent.value = opts.today;

    const where = contentEl.createDiv({ cls: "escrita-submission-where" });

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: t("submissions.cancel") });
    const record = buttons.createEl("button", { cls: "mod-cta", text: t("submissions.record") });

    const update = (): void => {
      const m = cleanMarket(market.value);
      const ok = canRecord(m, sent.value);
      record.disabled = this.busy || !ok;
      where.empty();
      if (!ok) { where.toggle(false); return; }
      where.toggle(true);
      for (const part of whereParts(t("submissions.where"), {
        path: opts.pathFor(m, sent.value), work: workLine(opts.props, opts.linkFor(m, sent.value)), result: resultLine(opts.props, opts.result),
      })) {
        if (part.code) where.createEl("code", { text: part.text });
        else where.appendText(part.text);
      }
    };
    const submit = (): void => {
      if (record.disabled) return;
      this.busy = true;
      update();
      void opts.onRecord(cleanMarket(market.value), sent.value).then((ok) => {
        this.busy = false;
        if (ok) this.close();
        else update();
      });
    };
    market.addEventListener("input", update);
    sent.addEventListener("input", update);
    market.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
    });
    cancel.addEventListener("click", () => this.close());
    record.addEventListener("click", submit);
    update();
    market.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
