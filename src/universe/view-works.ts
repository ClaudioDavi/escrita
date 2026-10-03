// The Works tab (board 16d): the universe's works grouped by form, sorted by stage then
// name, a dot in the stage's color, the word count, a click that opens where you left off.

import { fmt, plural, t } from "../i18n";
import { openWork } from "../desk/open";
import { groupWorks, type WorkInfo } from "./works-list";
import type { PanelCtx } from "./view-parts";

/** The words of a work if they are already counted (a book sums its chapters), else undefined. */
export function peekWords(ctx: PanelCtx, w: WorkInfo): number | undefined {
  const { measure, books } = ctx.plugin;
  if (w.role === "book") {
    const book = books.classify(w.path).book;
    return book ? measure.bookPeek(book)?.words : undefined;
  }
  return measure.peek(w.path, "words")?.words;
}

/** Counts the works not counted yet; resolves when done so the panel can redraw once. */
export async function countMissing(ctx: PanelCtx, works: WorkInfo[]): Promise<boolean> {
  const { measure, books, app } = ctx.plugin;
  const todo = works.filter((w) => peekWords(ctx, w) === undefined);
  await Promise.all(todo.map(async (w) => {
    try {
      if (w.role === "book") {
        const book = books.classify(w.path).book;
        if (book) await measure.book(book);
      } else {
        const f = app.vault.getFileByPath(w.path);
        if (f) await measure.counts(f, undefined, "words");
      }
    } catch (e) { console.error(`Escrita: couldn't count ${w.path}`, e); }
  }));
  // true only when something new landed in the cache, so a count that keeps failing can't redraw forever
  return todo.some((w) => peekWords(ctx, w) !== undefined);
}

export function totalWords(ctx: PanelCtx, works: WorkInfo[]): number {
  return works.reduce((n, w) => n + (peekWords(ctx, w) ?? 0), 0);
}

export function renderWorks(el: HTMLElement, ctx: PanelCtx, works: WorkInfo[]): void {
  if (works.length === 0) {
    el.createDiv({ cls: "escrita-universe-empty" }).createSpan({ text: t("universe.view.empty.works") });
    return;
  }
  const stages = ctx.plugin.settings.stages;
  for (const g of groupWorks(works)) {
    const head = el.createDiv({ cls: "escrita-universe-group-head is-static" });
    head.createSpan({ cls: "escrita-universe-group-name", text: g.form ? t(`universe.view.form.${g.form}`) : t("universe.view.noForm") });
    head.createSpan({ cls: "escrita-universe-count", text: String(g.works.length) });
    for (const w of g.works) {
      const row = el.createDiv({ cls: "escrita-universe-work" });
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      const dot = row.createSpan({ cls: "escrita-universe-dot" });
      dot.setAttribute("aria-hidden", "true");
      const color = stages[w.stage]?.color;
      if (color) dot.setCssProps({ "--escrita-dot": color });
      row.createSpan({ cls: "escrita-universe-work-name", text: w.title });
      const words = peekWords(ctx, w);
      row.createSpan({ cls: "escrita-universe-work-words", text: words === undefined ? t("universe.view.noWords") : fmt(words) });
      const open = (evt: MouseEvent | KeyboardEvent) => { void openWork(ctx.plugin, w.path, evt.ctrlKey || evt.metaKey); };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (evt) => { if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); open(evt); } });
    }
  }
}

export const wordsLabel = (n: number): string => plural("universe.view.count.words", n);
