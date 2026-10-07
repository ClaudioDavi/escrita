// "Menções sem link" (board 29, U 2.5, D1): under the active work in the Works tab, and at
// the bottom of the Entries tab in per-book mode. Rows for the active note only (Q22), each
// with "Create link", which writes that one mention (rule 2: an explicit click, no "link
// all"). The write is check-then-replace through plugin.notes (rule 1).

import { Notice, TFile } from "obsidian";
import { fmt, t } from "../i18n";
import { isTableRow, linkFromGenerated, linkableText, linkPlan, type UnlinkedRow } from "./unlinked-link";
import { button, openNote, type PanelCtx } from "./view-parts";

/** The section for the active note, filled when its rows are known. Draws nothing for a note outside any scope. */
export function renderUnlinked(el: HTMLElement, ctx: PanelCtx): void {
  const { plugin } = ctx;
  const file = plugin.app.workspace.getActiveFile();
  if (!file || file.extension !== "md") return;
  const box = el.createDiv({ cls: "escrita-unlinked" });
  const head = box.createDiv({ cls: "escrita-universe-group-head is-static" });
  head.createSpan({ cls: "escrita-universe-group-name", text: t("universe.unlinked.title") });
  const count = head.createSpan({ cls: "escrita-universe-count" });
  box.createDiv({ cls: "escrita-universe-muted escrita-unlinked-note", text: file.basename });
  const body = box.createDiv({ cls: "escrita-unlinked-body" });
  body.createDiv({ cls: "escrita-universe-muted escrita-unlinked-state", text: t("universe.unlinked.counting") });

  void plugin.universe.unlinkedFor(file).then((rows) => {
    if (!box.isConnected) return;   // the panel redrew meanwhile
    body.empty();
    if (rows === null) { box.remove(); return; }
    if (rows === "counting") {
      body.createDiv({ cls: "escrita-universe-muted escrita-unlinked-state", text: t("universe.unlinked.counting") });
      return;
    }
    if (rows.length === 0) {
      body.createDiv({ cls: "escrita-universe-muted escrita-unlinked-state", text: t("universe.unlinked.empty") });
      return;
    }
    count.setText(fmt(rows.length));
    for (const r of rows) drawRow(body, ctx, file, r);
  }).catch((e) => { console.error("Escrita: couldn't list the unlinked mentions", e); box.remove(); });
}

function drawRow(el: HTMLElement, ctx: PanelCtx, file: TFile, r: UnlinkedRow): void {
  // board 29a: the entry and its line on top with the button, the excerpt below
  const row = el.createDiv({ cls: "escrita-unlinked-row" });
  const side = row.createDiv({ cls: "escrita-unlinked-side" });
  const who = side.createDiv({ cls: "escrita-unlinked-who" });
  who.createSpan({ cls: "escrita-unlinked-entry", text: r.name });
  who.createSpan({ cls: "escrita-universe-muted escrita-unlinked-line", text: t("universe.unlinked.line", { n: fmt(r.line + 1) }) });
  button(side, t("universe.unlinked.create"), false, () => { void createLink(ctx, file, r); });
  const text = row.createEl("button", { cls: "escrita-unlinked-excerpt" });
  text.setAttribute("type", "button");
  text.setAttribute("aria-label", t("universe.unlinked.goTo", { name: r.name }));
  text.createSpan({ text: r.excerpt.before });
  text.createEl("mark", { cls: "escrita-unlinked-match", text: r.excerpt.match });
  text.createSpan({ text: r.excerpt.after });
  text.addEventListener("click", (evt) => { void openNote(ctx.plugin, file.path, evt, r.line); });
}

/** Writes one link. If the text there changed, writes nothing, says so quietly and refreshes. */
async function createLink(ctx: PanelCtx, file: TFile, r: UnlinkedRow): Promise<void> {
  const { plugin } = ctx;
  try {
    const to = plugin.app.vault.getAbstractFileByPath(r.entry);
    // the vault's own setting decides the link's form: [[wikilink]] or [text](path)
    const wiki = (plugin.app.vault as { getConfig?: (key: string) => unknown }).getConfig?.("useMarkdownLinks") !== true;
    if (!linkableText(r.text, wiki)) {
      new Notice(t("universe.unlinked.unlinkable"));
      ctx.refresh();
      return;
    }
    let markup: string | null = null;
    if (to instanceof TFile) {
      const linktext = plugin.app.metadataCache.fileToLinktext(to, file.path, true);
      markup = linkFromGenerated(plugin.app.fileManager.generateMarkdownLink(to, file.path, undefined, r.text), linktext, r.text, isTableRow(r.lineText));
    }
    const done = markup === null ? null : await plugin.notes.text(file).apply(linkPlan(r, markup));
    if (done?.ok && markup !== null) new Notice(t("universe.unlinked.done", { n: fmt(r.line + 1), link: markup }));
    else new Notice(t("universe.unlinked.changed"));
  } catch (e) {
    console.error("Escrita: couldn't write the link", e);
    new Notice(t("universe.unlinked.failed"));
  }
  ctx.refresh();
}
