import type EscritaPlugin from "../main";
import type { ModuleContext } from "../core/module-context";
import { Notice } from "obsidian";
import { fmt, t } from "../i18n";
import type { WritingModePort } from "../core/writing-mode";
import { dailyProgressOf, type DailyProgressSource } from "../core/daily-progress";

export const WRITING_MODE_CLASS = "escrita-writing-mode";

interface Dock { collapsed: boolean; collapse(): void; expand(): void }

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
  private ctx: ModuleContext | null = null;
  /** the sidebars `enter` collapsed, so `exit` reopens only those */
  private collapsed: Dock[] = [];
  private exitBtn: HTMLElement | null = null;
  private counter: HTMLElement | null = null;
  private progress: DailyProgressSource | null = null;
  private unsubProgress: (() => void) | null = null;
  private unsubFeatures: (() => void) | null = null;
  private noticed = false;

  constructor(private readonly plugin: EscritaPlugin) {}

  /** Called by the desk module's onload with its context. */
  load(ctx: ModuleContext): void {
    this.ctx = ctx;
    // One toggle shown under the state's name (board 39 c): two commands, each offered only
    // in its state, so the palette reads "Enter" or "Exit" without touching Obsidian's registry.
    ctx.command({
      id: "enter-writing-mode",
      name: t("desk.writingMode.cmd.enter"),
      checkCallback: (checking) => {
        if (this.active) return false;
        if (!checking) this.enter();
        return true;
      },
    });
    ctx.command({
      id: "exit-writing-mode",
      name: t("desk.writingMode.cmd.exit"),
      checkCallback: (checking) => {
        if (!this.active) return false;
        if (!checking) this.exit();
        return true;
      },
    });
  }

  /** Called by the desk module's onunload: exits writing mode, drops the listeners. */
  unload(): void {
    this.exit();
    this.listeners.clear();
    this.ctx = null;
  }

  /** The cold start, called by the desk after the home note opened: enter when the writer asked for it. */
  startup(): void {
    if (this.plugin.settings.openInWritingMode && this.ctx) this.enter();
  }

  isActive(): boolean {
    return this.active;
  }

  enter(): void {
    if (this.active) return;
    try {
      this.active = true;
      const ws = this.plugin.app.workspace;
      this.collapsed = [];
      for (const dock of [ws.leftSplit, ws.rightSplit] as Dock[]) {
        try {
          if (dock && !dock.collapsed) { dock.collapse(); this.collapsed.push(dock); }
        } catch (e) { console.error("Escrita: could not collapse a sidebar", e); }
      }
      document.body.classList.add(WRITING_MODE_CLASS);
      this.drawExit();
      this.watchGoals();
      if (!this.noticed) {
        this.noticed = true;
        new Notice(t("desk.writingMode.notice"));
      }
    } catch (e) {
      console.error("Escrita: could not enter writing mode", e);
    }
    this.emit();
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove(WRITING_MODE_CLASS);
    this.exitBtn?.remove();
    this.exitBtn = null;
    this.stopGoals();
    for (const dock of this.collapsed) {
      try { dock.expand(); } catch (e) { console.error("Escrita: could not reopen a sidebar", e); }
    }
    this.collapsed = [];
    this.emit();
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  onChange(cb: (active: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private emit(): void {
    for (const cb of [...this.listeners]) cb(this.active);
  }

  private drawExit(): void {
    const btn = document.body.createEl("button", {
      cls: "escrita-writing-exit",
      text: t("desk.writingMode.exit"),
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => this.exit());
    this.exitBtn = btn;
  }

  /** The counter exists only while goals are on; it follows goals switching on and off. */
  private watchGoals(): void {
    const refresh = () => this.bindGoals();
    this.unsubFeatures = this.plugin.features.onChange(refresh);
    this.bindGoals();
  }

  private bindGoals(): void {
    const source = dailyProgressOf(this.plugin.features);
    if (source !== this.progress) {
      this.unsubProgress?.();
      this.unsubProgress = null;
      this.progress = source;
      if (source) this.unsubProgress = source.onChange(() => this.drawCounter());
    }
    this.drawCounter();
  }

  private drawCounter(): void {
    const { progress } = this;
    const now = progress && this.active ? progress.current() : null;
    if (!now || now.goal <= 0) {
      this.counter?.remove();
      this.counter = null;
      return;
    }
    if (!this.counter) {
      this.counter = document.body.createDiv({ cls: "escrita-writing-goal", attr: { "aria-live": "off" } });
    }
    this.counter.setText(t("desk.writingMode.goal", { words: fmt(now.words), goal: fmt(now.goal) }));
  }

  private stopGoals(): void {
    this.unsubFeatures?.();
    this.unsubFeatures = null;
    this.unsubProgress?.();
    this.unsubProgress = null;
    this.progress = null;
    this.counter?.remove();
    this.counter = null;
  }
}
