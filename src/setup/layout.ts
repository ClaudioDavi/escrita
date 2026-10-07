import type EscritaPlugin from "../main";
import type { SetupLayout } from "./plan";

/**
 * Lays out the workspace once, at the end of the setup's run (1.0, Q4, boards 37 and 39;
 * task 2.3). Called by the run (task 2.2) only when the layout item runs (its tick), after
 * the settings are saved and the features applied, so the views it places exist and
 * `plugin.settings.homeNote` names the home note.
 *
 * - **"desk"** (board 37 a): the home note in front, in the main area (an open tab of it is
 *   reused, else `getLeaf(false)`); the right sidebar split in half, the outline on top and
 *   the lens below, with placeholders as a second tab behind the lens; with the universe
 *   on, its panel as the second tab of the left sidebar, behind the files. Only the panels
 *   whose feature is on (`plugin.features.isOn`); view ids from core/view-types.ts. On a
 *   phone (`Platform.isPhone`) the drawers don't split: outline and lens are two tabs of the
 *   right drawer (board 37 c).
 * - **"focus"** (board 39): the home note in front, then writing mode through
 *   `writingModeOf(plugin.features)?.enter()` (core/writing-mode.ts). With the desk off there
 *   is no writing mode: the home note alone.
 *
 * Only public workspace calls (`getLeaf`, `getRightLeaf`, `getLeftLeaf`, `createLeafBySplit`,
 * `setViewState`, `revealLeaf`). Never closes or replaces a leaf the writer has: a panel
 * already open is revealed, not opened twice. Escrita stores nothing about the layout. No
 * home note (none set, or missing) leaves the main area as it is. Imports no module folder.
 * Throws only on an unexpected workspace error; the run reports it as the layout item
 * failing (board 36 c) and undoes nothing. Strings under `setup.layout.` (layout-strings.ts).
 *
 * Stub until task 2.3: does nothing.
 */
export async function applyLayout(plugin: EscritaPlugin, layout: SetupLayout): Promise<void> {
  void plugin;
  void layout;
  await Promise.resolve();
}
