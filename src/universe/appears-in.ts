// "Appears in", the DOM (0.7 plan 4.2, Q34, boards 23 and 24): the list of works and
// chapters where an entry is mentioned. The Entries tab draws it under the entry's row and
// the entry note draws it at its end (appears-in-widget.ts). Never written into a note.

import { Keymap, MarkdownView, Notice, TFile, setIcon } from "obsidian";
import type EscritaPlugin from "../main";
import { fmt, t } from "../i18n";
import { baseName, compactWorks, firstLastLine, mentionStillThere, mentionsLabel, summaryLine } from "./appears-in-model";
import type { AppearsIn, MentionRow, WorkMentions } from "./mentions";

/** How rows are named. the universe module wires the real one from `plugin.works`; the default reads file names. */
export interface AppearsInLabels {
  /** A work (a book note or a standalone note, by path): its name and its form ("novel", "short story"), if known. */
  work(work: string): { name: string; form: string | null };
  /** A chapter or any other note. */
  note(path: string): string;
}

export const defaultLabels: AppearsInLabels = {
  work: (work) => ({ name: baseName(work), form: null }),
  note: (path) => baseName(path),
};

/**
 * What stays open, for the session (Q34): the section in the entry note is one setting for
 * all entries, the panel remembers which entries have their list open, and "Other notes"
 * starts closed everywhere.
 */
export const appearsInOpen = {
  note: false,
  other: false,
  /** the phone's "more" row was opened: every work, still without chapters */
  more: false,
  panel: new Set<string>(),
};

export type MentionRange = { from: number; to: number };

export interface ListOptions {
  variant: "panel" | "note";
  labels: AppearsInLabels;
  /** a row was clicked: open the note at its first mention */
  open(path: string, range: MentionRange, evt: MouseEvent | KeyboardEvent): void;
  /** "Other notes" was toggled; the caller redraws */
  toggleOther(): void;
  /** the phone layout (board AppearsInStates k): works only, no chapters, a "more" row. Only with variant "note". */
  compact?: boolean;
  /** the compact layout's "more" row was clicked; the caller redraws */
  toggleMore?(): void;
}

/** The rows under the header (or under the entry's row, in the panel). */
export function renderAppearsInList(parent: HTMLElement, ai: AppearsIn, o: ListOptions): void {
  const note = o.variant === "note";
  if (note && o.compact) {
    renderCompactList(parent, ai, o);
    return;
  }
  for (const w of ai.works) {
    const { name, form } = o.labels.work(w.work);
    const book = w.firstChapter !== undefined || w.notes.length > 1;
    const first = w.notes[0];
    if (!first) continue;
    row(parent, o, {
      cls: "is-work",
      text: name,
      form,
      count: note ? mentionsLabel(w.count) : fmt(w.count),
      target: first,
    });
    if (!book) continue;
    if (note && w.firstChapter && w.lastChapter) {
      const line = firstLastLine(w.firstChapter, w.lastChapter);
      if (line) parent.createDiv({ cls: "escrita-ai-firstlast", text: line });
    }
    for (const n of w.notes) {
      row(parent, o, { cls: "is-chapter", text: chapterText(w, n, o.labels), count: fmt(n.count), target: n });
    }
  }
  if (ai.other.length === 0) return;
  const open = appearsInOpen.other;
  const head = parent.createEl("button", { cls: "escrita-ai-btn escrita-ai-row is-other" });
  head.setAttribute("type", "button");
  head.setAttribute("aria-expanded", String(open));
  setIcon(head.createSpan({ cls: "escrita-ai-chevron" }), open ? "chevron-down" : "chevron-right");
  head.createSpan({ cls: "escrita-ai-name", text: t("universe.appears.other") });
  head.createSpan({ cls: "escrita-ai-n", text: fmt(ai.other.length) });
  head.addEventListener("click", () => o.toggleOther());
  if (!open) return;
  for (const n of ai.other) row(parent, o, { cls: "is-chapter", text: o.labels.note(n.path), count: fmt(n.count), target: n });
}

/** The phone's list: a few works with their counts, no chapters, then "more N" (board AppearsInStates k). */
function renderCompactList(parent: HTMLElement, ai: AppearsIn, o: ListOptions): void {
  const { shown, hidden } = compactWorks(ai, appearsInOpen.more);
  for (const w of shown) {
    const first = w.notes[0];
    if (!first) continue;
    const { name, form } = o.labels.work(w.work);
    row(parent, o, { cls: "is-work", text: name, form, count: mentionsLabel(w.count), target: first });
  }
  if (hidden === 0) return;
  const more = parent.createEl("button", { cls: "escrita-ai-btn escrita-ai-row is-more" });
  more.setAttribute("type", "button");
  setIcon(more.createSpan({ cls: "escrita-ai-chevron" }), "chevron-right");
  more.createSpan({ cls: "escrita-ai-name", text: t("universe.appears.more", { n: fmt(hidden) }) });
  more.addEventListener("click", () => o.toggleMore?.());
}

/** A chapter of a book shows its file name ("03 O porão"); the book's own note shows the label. */
function chapterText(w: WorkMentions, n: MentionRow, labels: AppearsInLabels): string {
  return n.path === w.work ? labels.note(n.path) : baseName(n.path);
}

function row(
  parent: HTMLElement,
  o: ListOptions,
  r: { cls: string; text: string; form?: string | null; count: string; target: MentionRow },
): void {
  const el = parent.createDiv({ cls: `escrita-ai-row ${r.cls}` });
  el.setAttribute("role", "link");
  el.tabIndex = 0;
  el.createSpan({ cls: "escrita-ai-name", text: r.text });
  if (r.form) el.createSpan({ cls: "escrita-ai-form", text: r.form });
  el.createSpan({ cls: "escrita-ai-n", text: r.count });
  const go = (evt: MouseEvent | KeyboardEvent) => o.open(r.target.path, r.target.first, evt);
  el.addEventListener("click", go);
  el.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); go(evt); }
  });
}

export interface SectionOptions extends Omit<ListOptions, "variant"> {
  /** the section's open state flipped */
  toggle(): void;
}

/**
 * The entry note's section (board 24b, c, d, e). `ai` null while the index is still counting.
 * Collapsed to one line by default.
 */
export function renderAppearsInSection(parent: HTMLElement, ai: AppearsIn | null, o: SectionOptions): HTMLElement {
  const sect = parent.createDiv({ cls: "escrita-ai-section" });
  sect.setAttribute("role", "region");
  sect.setAttribute("aria-label", t("universe.appears.title"));
  const hasList = ai !== null && ai.total > 0;
  if (!hasList) {
    const head = sect.createDiv({ cls: "escrita-ai-head is-static" });
    head.createSpan({ text: t("universe.appears.title") });
    head.createSpan({ cls: "escrita-ai-summary", text: ai === null ? t("universe.appears.counting") : summaryLine(ai) });
    return sect;
  }
  const open = appearsInOpen.note;
  const head = sect.createEl("button", { cls: "escrita-ai-btn escrita-ai-head" });
  head.setAttribute("type", "button");
  head.setAttribute("aria-expanded", String(open));
  setIcon(head.createSpan({ cls: "escrita-ai-chevron" }), open ? "chevron-down" : "chevron-right");
  head.createSpan({ text: t("universe.appears.title") });
  head.createSpan({ cls: "escrita-ai-summary", text: summaryLine(ai) });
  head.addEventListener("click", () => o.toggle());
  if (open) renderAppearsInList(sect, ai, { ...o, variant: "note" });
  return sect;
}

/**
 * Opens a note and selects its first mention of the entry, after checking that the text at
 * the stored range is still a mention (the index may be behind a recent edit). If not, the
 * note opens at the top and nothing is selected. It changes only the selection (rule 2).
 * From the panel the note opens in the main area; Ctrl/Cmd-click opens beside.
 */
export async function openMention(
  plugin: EscritaPlugin,
  entry: string,
  path: string,
  range: MentionRange,
  evt: MouseEvent | KeyboardEvent,
  fromPanel: boolean,
): Promise<void> {
  const { workspace, vault } = plugin.app;
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    new Notice(t("universe.view.notice.missing", { path }));
    return;
  }
  const mod = Keymap.isModEvent(evt);
  const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
  const leaf = fromPanel
    ? (mod && recent ? workspace.createLeafBySplit(recent, "vertical") : (recent ?? workspace.getLeaf("tab")))
    : workspace.getLeaf(mod);
  await leaf.openFile(file, { active: true });
  await workspace.revealLeaf(leaf);
  const view = leaf.view;
  if (!(view instanceof MarkdownView) || view.getMode() !== "source") return;
  const editor = view.editor;
  if (!mentionStillThere(editor.getValue(), range, plugin.names.tableFor(path), entry)) return;
  editor.setSelection(editor.offsetToPos(range.from), editor.offsetToPos(range.to));
  editor.scrollIntoView({ from: editor.offsetToPos(range.from), to: editor.offsetToPos(range.to) }, true);
  editor.focus();
}

