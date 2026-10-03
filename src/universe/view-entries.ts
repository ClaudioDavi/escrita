// The Entries tab (board 15): search, one group per entry type, the entry menu.

import { Menu, Notice, TFile, setIcon } from "obsidian";
import type { EntryKind } from "./settings";
import { t } from "../i18n";
import { groupByKind, searchEntries, type Entry } from "./entries";
import { linkInsertPoint, splitHighlight } from "./panel-model";
import { createEntryFromSelection } from "./create";
import { FOCUS_ATTR, openNote, type PanelCtx } from "./view-parts";

/**
 * The group heading: the last segment of the type's folder, which is the writer's own
 * plural word ("Personagens"); while the folder is still the English default, the localized
 * plural. The type's label stays for menus and chips.
 */
export function kindHeading(ctx: PanelCtx, kind: EntryKind): string {
  const folder = ctx.plugin.settings.entryTypes[kind].folder.replace(/^\/+|\/+$/g, "");
  const word = folder.slice(folder.lastIndexOf("/") + 1).trim();
  const english = { character: "Characters", place: "Places", object: "Objects", group: "Groups", event: "Events" }[kind];
  return word === "" || word === english ? t(`universe.view.kind.${kind}`) : word;
}

function highlighted(el: HTMLElement, text: string, query: string): void {
  for (const seg of splitHighlight(text, query)) {
    if (seg.hit) el.createSpan({ cls: "escrita-universe-hit", text: seg.text });
    else el.appendText(seg.text);
  }
}

/** The new-entry modal for a group's + button, in the scope the panel is showing. */
function newEntry(ctx: PanelCtx, kind: EntryKind | undefined): void {
  const { plugin, scope } = ctx;
  const named = scope.note ? plugin.app.vault.getAbstractFileByPath(scope.note) : null;
  const file = named instanceof TFile ? named : plugin.app.workspace.getActiveFile();
  createEntryFromSelection(plugin, null, file, kind, scope);
}

export function renderEntries(el: HTMLElement, ctx: PanelCtx, entries: Entry[]): void {
  if (entries.length === 0) {
    const box = el.createDiv({ cls: "escrita-universe-empty" });
    box.createSpan({ text: t("universe.view.empty.entries", { command: t("universe.cmd.createEntry") }) });
    const b = box.createEl("button", { cls: "escrita-universe-btn mod-cta", text: t("universe.view.newEntry") });
    b.setAttribute("type", "button");
    b.addEventListener("click", () => newEntry(ctx, undefined));
    return;
  }

  const search = el.createEl("input", { cls: "escrita-universe-search", type: "search" });
  search.setAttribute("placeholder", t("universe.view.search"));
  search.setAttribute("aria-label", t("universe.view.search.aria"));
  search.setAttribute(FOCUS_ATTR, "search");
  search.value = ctx.query;
  const list = el.createDiv({ cls: "escrita-universe-groups" });
  const draw = () => { list.empty(); drawGroups(list, ctx, entries); };
  search.addEventListener("input", () => { ctx.query = search.value; draw(); });
  draw();
}

function drawGroups(list: HTMLElement, ctx: PanelCtx, entries: Entry[]): void {
  const searching = ctx.query.trim() !== "";
  const found = searchEntries(entries, ctx.query);
  if (searching && found.length === 0) {
    list.createDiv({ cls: "escrita-universe-muted", text: t("universe.view.noMatch") });
    return;
  }
  const active = ctx.plugin.app.workspace.getActiveFile()?.path;
  for (const group of groupByKind(found)) {
    const kind = group.kind;
    if (searching && group.entries.length === 0) continue;
    const collapsed = !searching && ctx.collapsed.has(kind);
    const head = list.createDiv({ cls: "escrita-universe-group-head" });
    const toggle = head.createEl("button", { cls: "escrita-universe-group-toggle" });
    toggle.setAttribute("type", "button");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", t("universe.view.toggleGroup", { kind: kindHeading(ctx, kind) }));
    setIcon(toggle.createSpan({ cls: "escrita-universe-chevron" }), collapsed ? "chevron-right" : "chevron-down");
    toggle.createSpan({ cls: "escrita-universe-group-name", text: kindHeading(ctx, kind) });
    toggle.createSpan({ cls: "escrita-universe-count", text: String(group.entries.length) });
    toggle.addEventListener("click", () => ctx.toggleCollapsed(kind));
    if (!searching) {
      const add = head.createEl("button", { cls: "escrita-universe-icon-btn" });
      add.setAttribute("type", "button");
      add.setAttribute("aria-label", t("universe.view.newIn", { kind: kindHeading(ctx, kind) }));
      setIcon(add, "plus");
      add.addEventListener("click", () => newEntry(ctx, kind));
    }
    if (collapsed) continue;
    for (const e of group.entries) drawEntry(list, ctx, e, e.path === active);
  }
}

function drawEntry(list: HTMLElement, ctx: PanelCtx, e: Entry, isActive: boolean): void {
  const row = list.createDiv({ cls: isActive ? "escrita-universe-entry is-active" : "escrita-universe-entry" });
  row.setAttribute("role", "button");
  row.tabIndex = 0;
  highlighted(row.createSpan({ cls: "escrita-universe-entry-name" }), e.name, ctx.query);
  if (e.aliases.length > 0) highlighted(row.createSpan({ cls: "escrita-universe-entry-alias" }), e.aliases.join(", "), ctx.query);
  row.addEventListener("click", (evt) => { void openNote(ctx.plugin, e.path, evt); });
  row.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); void openNote(ctx.plugin, e.path, evt); }
  });
  row.addEventListener("contextmenu", (evt) => { evt.preventDefault(); entryMenu(ctx, e).showAtMouseEvent(evt); });
}

function entryMenu(ctx: PanelCtx, e: Entry): Menu {
  const { plugin } = ctx;
  const menu = new Menu();
  menu.addItem((i) => i.setTitle(t("universe.view.menu.open")).setIcon("file-text").onClick(() => { void openNote(plugin, e.path, null); }));
  menu.addItem((i) => i.setTitle(t("universe.view.menu.openSide")).setIcon("separator-vertical").onClick(() => { void openNote(plugin, e.path, null, undefined, true); }));
  menu.addItem((i) => i.setTitle(t("universe.view.menu.insertLink")).setIcon("link").onClick(() => insertLink(ctx, e)));
  menu.addItem((i) => i.setTitle(t("universe.view.menu.reveal")).setIcon("folder-open").onClick(() => reveal(ctx, e.path)));
  return menu;
}

/** `[[Name|alias]]` (as the vault's link settings write it) after the selection of the last edited note, never inside the properties, code or a comment. */
function insertLink(ctx: PanelCtx, e: Entry): void {
  const { plugin } = ctx;
  const target = ctx.lastEditor();
  const file = plugin.app.vault.getAbstractFileByPath(e.path);
  const into = target ? plugin.app.vault.getAbstractFileByPath(target.path) : null;
  if (!target || !(into instanceof TFile) || !(file instanceof TFile)) {
    new Notice(t("universe.view.noEditor"));
    return;
  }
  const link = plugin.app.fileManager.generateMarkdownLink(file, target.path, undefined, e.aliases[0]);
  const at = target.editor.posToOffset(target.editor.getCursor("to"));
  void plugin.notes.text(into).apply((text) => {
    // the editor buffer is what the port reads when the note is open, so the offset is valid
    const point = linkInsertPoint(text, at);
    return point === null ? null : { from: point, to: point, insert: link };
  }).then((r) => { if (!r.ok) new Notice(t("universe.view.linkRefused")); });
}

function reveal(ctx: PanelCtx, path: string): void {
  const { workspace, vault } = ctx.plugin.app;
  const file = vault.getAbstractFileByPath(path);
  const leaf = workspace.getLeavesOfType("file-explorer")[0];
  const explorer = leaf?.view as unknown as { revealInFolder?: (f: TFile) => void } | undefined;
  if (!leaf || !(file instanceof TFile) || !explorer?.revealInFolder) return;
  void workspace.revealLeaf(leaf);
  explorer.revealInFolder(file);
}
