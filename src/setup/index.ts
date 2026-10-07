import { normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { CoreModule } from "../core/module-context";

/**
 * "Set up a writing vault" (1.0, SF 10; boards 35-37; task 2.2). A core module, not a
 * feature: main.ts constructs it after the registry has applied the switches and starts it
 * with `startCoreModule` (ARCHITECTURE.md, "Core modules"), so it loads once and never
 * switches off. It registers only through `this.ctx`.
 *
 * Task 2.2 fills in, within these rules:
 * - `onload`: the command "Set up a writing vault" (`ctx.command`, no default hotkey), and the
 *   first-run notice on layout ready (`ctx.onLayoutReady`) when `plugin.data.setupOffered` is
 *   false: a Notice with "Set up…" and "Not now", never a modal, and `setupOffered` set true
 *   and saved with any answer (Q5, board 35 a).
 * - `open()`: the two-step modal (setup/modal.ts or similar): choices, then the preview of
 *   `planSetup`'s items with their ticks, then the run (`itemsToRun`), every file through
 *   `plugin.notes.create` with `exists: "return"`, settings written last (the features row
 *   without its `universeMode`), then `applyLayout` (setup/layout.ts), then the notice that
 *   says what was made and what wasn't.
 * - Strings under `setup.` in setup/strings.ts.
 */
export class SetupModule extends CoreModule {
  constructor(private readonly plugin: EscritaPlugin) {
    super();
  }

  onload(): void {
    // task 2.2: the command and the first-run notice
  }

  /**
   * Opens the setup's modal at step 1 (the command, the first-run notice's "Set up…", and the
   * Features page's quiet link, task 2.5, all call this). Safe to call at any time.
   *
   * Stub until task 2.2: does nothing.
   */
  open(): void {
    void this.plugin;
  }

  /**
   * Whether the vault has a home note: `settings.homeNote` names a note that exists, in any
   * letter case (with ".md" added when missing). The Features page shows its setup link only
   * when this is false (board 38). Does not adopt a `Home.md` the setting doesn't name.
   */
  hasHomeNote(): boolean {
    const raw = this.plugin.settings.homeNote.trim();
    if (!raw) return false;
    const setting = normalizePath(raw);
    const want = (/\.md$/i.test(setting) ? setting : `${setting}.md`).normalize("NFC").toLowerCase();
    return this.plugin.app.vault.getFiles().some((f) => f.path.normalize("NFC").toLowerCase() === want);
  }
}
