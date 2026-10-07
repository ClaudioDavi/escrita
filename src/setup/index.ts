import { Notice, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { CoreModule } from "../core/module-context";
import { t } from "../i18n";
import { SetupModal } from "./modal";

/**
 * "Set up a writing vault" (1.0, SF 10; boards 35-37). A core module, not a feature: main.ts
 * constructs it after the registry has applied the switches and starts it with
 * `startCoreModule` (ARCHITECTURE.md, "Core modules"), so it loads once and never switches
 * off. It registers only through `this.ctx`: the command (no default hotkey) and, on a fresh
 * install, the first-run notice (a Notice, never a modal, shown once whatever the answer).
 * The modal is setup/modal.ts, the run setup/run.ts.
 */
export class SetupModule extends CoreModule {
  constructor(private readonly plugin: EscritaPlugin) {
    super();
  }

  onload(): void {
    this.ctx.command({ id: "setup", name: t("setup.command"), callback: () => this.open() });
    this.ctx.onLayoutReady(() => {
      if (!this.plugin.data.setupOffered) this.offer();
    });
  }

  /** The first-run notice (board 35 a): "Set up…" or "Not now", offered once, never again. */
  private offer(): void {
    this.markOffered();
    let notice: Notice | null = null;
    const frag = createFragment((f) => {
      f.createDiv({ text: t("setup.notice.text"), cls: "escrita-setup-notice-text" });
      const row = f.createDiv({ cls: "escrita-setup-notice-buttons" });
      row.createEl("button", { text: t("setup.notice.later") }).addEventListener("click", () => notice?.hide());
      row.createEl("button", { text: t("setup.notice.setup"), cls: "mod-cta" }).addEventListener("click", () => {
        notice?.hide();
        this.open();
      });
    });
    notice = new Notice(frag, 20000);
  }

  private markOffered(): void {
    if (this.plugin.data.setupOffered) return;
    this.plugin.data.setupOffered = true;
    this.plugin.requestSave();
  }

  /**
   * Opens the setup's modal at step 1 (the command, the first-run notice's "Set up…", and the
   * Features page's quiet link, task 2.5, all call this). Safe to call at any time.
   *
     */
  open(): void {
    this.markOffered();
    new SetupModal(this.plugin.app, this.plugin).open();
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
