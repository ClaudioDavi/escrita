import { MarkdownView, Notice, Platform, normalizePath, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { writingModeOf } from "../core/writing-mode";
import type { SetupLayout } from "./plan";
import { planPanels, resolveHomePath } from "./layout-plan";

/**
 * Lays out the workspace once, at the end of the setup's run (1.0, Q4, boards 37 and 39;
 * task 2.3). Called by the run (task 2.2) only when the layout item runs (its tick), after
 * the settings are saved and the features applied, so the views it places exist and
 * `plugin.settings.homeNote` names the home note.
 *
 * - **"desk"** (board 37 a): the home note in front, in the main area (an open tab of it is
 *   reused, else an empty tab, else a new tab); the right sidebar split in half, the outline
 *   on top and the lens below, with placeholders as a second tab behind the lens; with the
 *   universe on, its panel as a second tab of the left sidebar, behind the files. Only the
 *   panels whose feature is on (`plugin.features.isOn`); view ids from core/view-types.ts. On
 *   a phone (`Platform.isPhone`) the drawers don't split: outline and lens are two tabs of the
 *   right drawer (board 37 c). The decisions are pure, in layout-plan.ts.
 * - **"focus"** (board 39): the home note in front, then writing mode through
 *   `writingModeOf(plugin.features)?.enter()` (core/writing-mode.ts). With the desk off there
 *   is no writing mode: the home note alone.
 *
 * Only public workspace calls. Never closes or replaces a leaf the writer has: a panel
 * already open is revealed, not opened twice, and a note is never opened over a tab that
 * holds something else. Escrita stores nothing about the layout. No home note (none set, or
 * missing) leaves the main area as it is. Throws only on an unexpected workspace error; a
 * panel that cannot be placed gets one notice at the end.
 */
export async function applyLayout(plugin: EscritaPlugin, layout: SetupLayout): Promise<void> {
  const { workspace } = plugin.app;
  const on = (id: "outline" | "lens" | "placeholders" | "universe") => plugin.features.isOn(id);
  const steps = planPanels({
    layout,
    phone: Platform.isPhone,
    on: { outline: on("outline"), lens: on("lens"), placeholders: on("placeholders"), universe: on("universe") },
  });

  const leaves = new Map<string, WorkspaceLeaf>();
  const failed: string[] = [];
  const heads: WorkspaceLeaf[] = [];

  for (const step of steps) {
    const existing = workspace.getLeavesOfType(step.view)[0];
    if (existing) {
      leaves.set(step.view, existing);
      if (step.how !== "tabWith") heads.push(existing);
      continue;
    }
    const anchor = step.anchor ? leaves.get(step.anchor) : undefined;
    let leaf: WorkspaceLeaf | null = null;
    if (step.how === "sidebar") leaf = workspace.getRightLeaf(false);
    else if (step.how === "leftTab") leaf = workspace.getLeftLeaf(false);
    else if (step.how === "splitBelow") leaf = anchor ? workspace.createLeafBySplit(anchor, "horizontal") : workspace.getRightLeaf(false);
    else if (anchor) leaf = workspace.createLeafInParent(anchor.parent, -1);
    if (!leaf) {
      failed.push(step.view);
      continue;
    }
    // A tab behind another stays behind: only the head of a group comes to the front.
    await leaf.setViewState({ type: step.view, active: step.how !== "tabWith" });
    leaves.set(step.view, leaf);
    if (step.how !== "tabWith") heads.push(leaf);
  }
  for (const leaf of heads) await workspace.revealLeaf(leaf);

  await openHomeNote(plugin);
  if (layout === "focus") writingModeOf(plugin.features)?.enter();
  if (failed.length > 0) new Notice(t("setup.layout.panelsFailed"));
}

/**
 * Brings the home note to the front; true when it is open now. Never opens over a tab that
 * holds something else (an open tab of it, else an empty one, else a new tab). The setup's run
 * uses it too when the layout doesn't run (setup/apply.ts).
 */
export async function openHomeNote(plugin: EscritaPlugin): Promise<boolean> {
  const { workspace, vault } = plugin.app;
  const raw = plugin.settings.homeNote.trim();
  if (!raw) return false;
  const path = resolveHomePath(normalizePath(raw), vault.getFiles().map((f) => f.path));
  const file = path ? vault.getFileByPath(path) : null;
  if (!file) return false;

  let leaf: WorkspaceLeaf | undefined;
  workspace.iterateRootLeaves((l) => {
    if (!leaf && l.view instanceof MarkdownView && l.view.file?.path === file.path) leaf = l;
  });
  if (!leaf) {
    const recent = workspace.getMostRecentLeaf();
    leaf = recent && recent.view.getViewType() === "empty" ? recent : workspace.getLeaf("tab");
    await leaf.openFile(file);
  }
  await workspace.revealLeaf(leaf);
  return true;
}
