// Small red dot after files with placeholders in the file explorer.
// Uses the explorer's private `fileItems[path].selfEl`, guarded so a future
// Obsidian change just turns the dots off instead of breaking anything.

import type { App } from "obsidian";

export const DOT_CLASS = "escrita-has-placeholder";

/** The explorer's private API failed once; stop touching it (and logging) this session. */
let broken = false;

type FileItems = Record<string, { selfEl?: unknown } | undefined>;

function fileItemsOf(view: unknown): FileItems | null {
  if (!view || typeof view !== "object") return null;
  const items = (view as { fileItems?: unknown }).fileItems;
  return items && typeof items === "object" ? (items as FileItems) : null;
}

function forEachItem(app: App, fn: (path: string, el: HTMLElement) => void): void {
  if (broken) return;
  for (const leaf of app.workspace.getLeavesOfType("file-explorer")) {
    try {
      const items = fileItemsOf(leaf.view);
      if (!items) continue;
      for (const path of Object.keys(items)) {
        const el = items[path]?.selfEl;
        if (el instanceof HTMLElement) fn(path, el);
      }
    } catch (e) {
      broken = true;
      console.error("Escrita: could not update file explorer dots; turning them off", e);
      return;
    }
  }
}

/** Add or remove the dot class on every explorer item. */
export function applyDots(app: App, enabled: boolean, has: (path: string) => boolean): void {
  forEachItem(app, (path, el) => {
    const on = enabled && has(path);
    if (el.hasClass(DOT_CLASS) !== on) el.toggleClass(DOT_CLASS, on);
  });
}

export function clearDots(app: App): void {
  forEachItem(app, (_path, el) => { if (el.hasClass(DOT_CLASS)) el.removeClass(DOT_CLASS); });
}
