import type EscritaPlugin from "../main";
import type { ModuleContext } from "../core/module-context";
import type { WritingModePort } from "../core/writing-mode";

/**
 * Writing mode (1.0, board 39; task 2.4): only the note. Part of the desk feature, no switch
 * of its own. The desk module owns one instance for its life and exposes it as the
 * `writingMode` port (core/writing-mode.ts); the setup's layout enters it through that port.
 *
 * Task 2.4 fills it in, within these rules:
 * - Hiding is the body class `escrita-writing-mode` (desk/styles.css) plus public workspace
 *   calls to collapse the sidebars (`leftSplit.collapse()`, `rightSplit.collapse()`);
 *   `exit` reopens only the sidebars that were open when `enter` ran, and removes the class.
 * - A quiet "Exit writing mode" button always visible (no hover on phones), and the goal
 *   counter ("today 312 / 500") at the bottom only while goals are on, read through
 *   `dailyProgressOf(plugin.features)` (core/daily-progress.ts), following goals switching
 *   on and off (`features.onChange`).
 * - One command that enters and exits ("Enter writing mode" / "Exit writing mode"), no
 *   default hotkey, registered through the desk's `ModuleContext` in `load`. A notice once a
 *   session on entering (board 39 d).
 * - The setting `openInWritingMode` enters it on a cold start, after the home note opens
 *   (desk/home-note.ts `startupOpen`); its row sits beside "Open the home note on startup" in
 *   desk/settings-ui.ts.
 * - "Continue" in the home block opens the work in the same tab while the mode is on
 *   (`openWork(plugin, path, !isActive())`, src/ui/open-work.ts).
 * - Unloading (the desk turned off, the plugin disabled) exits first, so nothing stays hidden.
 * - Strings under `desk.writingMode.` in desk/strings.ts.
 */
export class WritingMode implements WritingModePort {
  private active = false;
  private listeners = new Set<(active: boolean) => void>();

  constructor(private readonly plugin: EscritaPlugin) {}

  /** Called by the desk module's onload with its context. Stub until task 2.4. */
  load(ctx: ModuleContext): void {
    void ctx;
    void this.plugin;
  }

  /** Called by the desk module's onunload: exits writing mode, drops the listeners. */
  unload(): void {
    this.exit();
    this.listeners.clear();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Stub until task 2.4: does nothing. */
  enter(): void {
    // task 2.4
  }

  /** Stub until task 2.4: does nothing while off (and it is never on yet). */
  exit(): void {
    if (!this.active) return;
    this.active = false;
    for (const cb of [...this.listeners]) cb(false);
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  onChange(cb: (active: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }
}
