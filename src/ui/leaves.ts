import type { App, WorkspaceLeaf } from "obsidian";

/**
 * Does this view state show `path` as a note in a markdown view? Obsidian's own
 * Outline, Backlinks and Outgoing links panels keep the last file in `state.file`
 * too, so the path alone is not enough: the view type has to be "markdown".
 */
export function isMarkdownStateFor(view: { type?: string; state?: unknown } | null | undefined, path: string): boolean {
  if (!view || view.type !== "markdown") return false;
  return (view.state as { file?: string } | undefined)?.file === path;
}

/**
 * The markdown tab in the main area showing `path`, deferred (not yet loaded)
 * tabs included, or null. Sidebar panels never match.
 */
export function markdownLeafFor(app: App, path: string): WorkspaceLeaf | null {
  let found: WorkspaceLeaf | null = null;
  app.workspace.iterateRootLeaves((leaf) => {
    if (!found && isMarkdownStateFor(leaf.getViewState(), path)) found = leaf;
  });
  return found;
}
