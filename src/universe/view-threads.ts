// The threads list, shared by the panel's Threads tab and the standalone Open threads
// view (board 16): grouped by work in text order, first-seen date, the answering note,
// the close form, show and hide closed, reopen.

import { Notice, TFile, setIcon } from "obsidian";
import { lang, plural, t } from "../i18n";
import { closedPreview, groupThreads, countThreads, seenDate, type WorkOf } from "./panel-model";
import type { ThreadRef } from "./threads";
import { answerChoices, resolveAnswerLink } from "./create";
import { FOCUS_ATTR, button, openNote, type PanelCtx } from "./view-parts";

/** a stand-in for a value that is drawn as an element, so a sentence can be split around it */
const SLOT = "\u0000";
const keyOf = (r: ThreadRef) => `${r.path}:${r.thread.from}`;

/** A chapter belongs to its book (the book note's group, titled with the book); any other note is its own work. */
export function workResolver(ctx: PanelCtx): WorkOf {
  return (r) => {
    const book = ctx.plugin.books.classify(r.path).book;
    return book ? { path: book.note.path, title: book.note.basename } : { path: r.path, title: r.title };
  };
}

export function renderThreads(el: HTMLElement, ctx: PanelCtx, refs: ThreadRef[]): void {
  const workOf = workResolver(ctx);
  const counts = countThreads(refs, workOf);
  const groups = groupThreads(refs, ctx.showClosed, workOf);
  const s = ctx.plugin.settings;

  if (counts.open === 0 && (!ctx.showClosed || counts.closed === 0)) {
    const box = el.createDiv({ cls: "escrita-universe-empty" });
    box.createSpan({ text: t(ctx.scope.kind === "none" ? "universe.view.empty.threadsOff" : "universe.view.empty.threads") });
    box.createEl("code", { cls: "escrita-universe-sample", text: `%% ${s.threadKeyword}: ${lang().startsWith("pt") ? "a pergunta" : "the question"} %%` });
    box.createSpan({ text: t("universe.view.empty.threadsCommand", { command: t("universe.cmd.plantThread") }) });
  }

  const list = el.createDiv({ cls: "escrita-universe-threads" });
  for (const g of groups) {
    const head = list.createDiv({ cls: "escrita-universe-group-head is-static" });
    head.createSpan({ cls: "escrita-universe-group-name", text: g.title });
    const open = g.items.filter((i) => !i.thread.closed).length;
    const count = ctx.showClosed && g.closed > 0
      ? (open > 0 ? `${open} · ${plural("universe.view.count.closed", g.closed)}` : plural("universe.view.count.closed", g.closed))
      : String(open);
    head.createSpan({ cls: "escrita-universe-count", text: count });
    for (const r of g.items) drawThread(list, ctx, r);
  }

  const foot = el.createDiv({ cls: "escrita-universe-foot" });
  if (counts.closed === 0) {
    foot.createSpan({ text: t("universe.view.foot.none") });
  } else if (ctx.showClosed) {
    const b = foot.createEl("button", { cls: "escrita-universe-link", text: t("universe.view.foot.hide") });
    b.setAttribute("type", "button");
    b.addEventListener("click", () => ctx.toggleClosed());
  } else {
    foot.createSpan({ text: `${plural("universe.view.count.closed", counts.closed)} · ` });
    const b = foot.createEl("button", { cls: "escrita-universe-link", text: t("universe.view.foot.show") });
    b.setAttribute("type", "button");
    b.addEventListener("click", () => ctx.toggleClosed());
  }
}

function drawThread(list: HTMLElement, ctx: PanelCtx, r: ThreadRef): void {
  const th = r.thread;
  const row = list.createDiv({ cls: th.closed ? "escrita-universe-thread is-closed" : "escrita-universe-thread" });
  const check = row.createEl("button", { cls: "escrita-universe-check" });
  check.setAttribute("type", "button");
  check.setAttribute("aria-label", t(th.closed ? "universe.view.thread.reopenAria" : "universe.view.thread.closeAria"));
  if (th.closed) setIcon(check, "circle-check");
  else check.createSpan({ cls: "escrita-universe-circle" });
  check.addEventListener("click", () => {
    if (th.closed) void reopen(ctx, r);
    else ctx.openClose(ctx.closing?.key === keyOf(r) ? null : keyOf(r));
  });

  const body = row.createDiv({ cls: "escrita-universe-thread-body" });
  const text = body.createEl("button", { cls: "escrita-universe-thread-text", text: th.text });
  text.setAttribute("type", "button");
  text.setAttribute("title", t("universe.view.thread.go"));
  text.addEventListener("click", (evt) => { void openNote(ctx.plugin, r.path, evt, th.line); });

  const meta = body.createDiv({ cls: "escrita-universe-thread-meta" });
  const answer = th.answeredBy;
  if (th.closed) {
    if (answer) {
      const [before, after = ""] = t("universe.view.thread.answeredIn", { note: SLOT }).split(SLOT);
      meta.appendText(before);
      answerLink(meta, ctx, r.path, answer);
      meta.appendText(after);
    } else {
      meta.appendText(t("universe.view.thread.closed"));
    }
  } else {
    const date = seenDate(r.firstSeen, Date.now(), lang());
    if (date) meta.appendText(t("universe.view.thread.since", { date }));
    if (answer) {
      if (date) meta.appendText(" · ");
      answerLink(meta, ctx, r.path, answer, true);
    }
  }

  if (!th.closed && ctx.closing?.key === keyOf(r)) closeForm(list, ctx, r);
}

function answerLink(el: HTMLElement, ctx: PanelCtx, from: string, target: string, arrow = false): void {
  const dest = ctx.plugin.app.metadataCache.getFirstLinkpathDest(target, from);
  const text = arrow ? t("universe.view.thread.answeredBy", { note: target }) : target;
  if (!dest) {
    el.createSpan({ cls: "escrita-universe-answer", text });
    return;
  }
  const a = el.createEl("a", { cls: "escrita-universe-answer", text });
  a.addEventListener("click", (evt) => { evt.preventDefault(); void openNote(ctx.plugin, dest.path, evt); });
}

/** The close form under the row (inline, so it also works on a phone). */
function closeForm(list: HTMLElement, ctx: PanelCtx, r: ThreadRef): void {
  const s = ctx.plugin.settings;
  const form = list.createDiv({ cls: "escrita-universe-close" });
  form.createDiv({ cls: "escrita-universe-close-title", text: t("universe.view.close.title", { text: r.thread.text }) });
  const label = form.createEl("label", { cls: "escrita-universe-close-label", text: t("universe.view.close.answer") });
  const input = label.createEl("input", { cls: "escrita-universe-close-input", type: "text" });
  input.setAttribute(FOCUS_ATTR, "close");
  input.value = ctx.closing?.answer ?? "";
  const listId = "escrita-universe-works-list";
  input.setAttribute("list", listId);
  const options = label.createEl("datalist");
  options.id = listId;
  const known = ctx.plugin.app.vault.getAbstractFileByPath(r.path);
  if (known instanceof TFile) for (const w of answerChoices(ctx.plugin, known)) options.createEl("option", { value: w.title });

  const hint = form.createDiv({ cls: "escrita-universe-close-hint" });
  const paintHint = () => {
    hint.empty();
    const [before, after = ""] = t("universe.view.close.hint", { note: r.title, marker: SLOT }).split(SLOT);
    hint.appendText(before);
    hint.createEl("code", { text: closedPreview(s.threadKeyword, s.threadClosedWord, input.value) });
    hint.appendText(after);
  };
  paintHint();
  input.addEventListener("input", () => { if (ctx.closing) ctx.closing.answer = input.value; paintHint(); });

  const actions = form.createDiv({ cls: "escrita-universe-close-actions" });
  const cancel = () => ctx.openClose(null);
  button(actions, t("universe.view.close.cancel"), false, cancel);
  const confirm = () => { void close(ctx, r, input.value); };
  button(actions, t("universe.view.close.confirm"), true, confirm);
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") { evt.preventDefault(); confirm(); }
    else if (evt.key === "Escape") { evt.preventDefault(); cancel(); }
  });
  if (ctx.closing?.focus) {
    ctx.closing.focus = false;
    window.setTimeout(() => input.focus(), 0);
  }
}

async function close(ctx: PanelCtx, r: ThreadRef, typed: string): Promise<void> {
  const { plugin } = ctx;
  const file = plugin.app.vault.getAbstractFileByPath(r.path);
  if (!(file instanceof TFile)) { new Notice(t("universe.view.notice.missing", { path: r.path })); ctx.refresh(); return; }
  const { link: answer, unknown } = resolveAnswerLink(plugin, file, answerChoices(plugin, file), typed);
  const name = unknown ?? "";
  const ok = await plugin.universe.closeThread(file, r.thread, answer);
  ctx.openClose(null);
  if (!ok) { new Notice(t("universe.view.notice.stale")); ctx.refresh(); return; }
  new Notice(t("universe.view.notice.closed", { note: r.title }));
  if (unknown !== null) new Notice(t("universe.view.notice.unknownAnswer", { name }));
}

async function reopen(ctx: PanelCtx, r: ThreadRef): Promise<void> {
  const file = ctx.plugin.app.vault.getAbstractFileByPath(r.path);
  if (!(file instanceof TFile)) { new Notice(t("universe.view.notice.missing", { path: r.path })); ctx.refresh(); return; }
  const ok = await ctx.plugin.universe.reopenThread(file, r.thread);
  if (!ok) { new Notice(t("universe.view.notice.stale")); ctx.refresh(); return; }
  new Notice(t("universe.view.notice.reopened", { note: r.title }));
}
