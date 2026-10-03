import { MarkdownView } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { FeatureModule } from "../core/module-context";
import type { Follower } from "../core/vault-index";
import { newestLeftOff, pruneMissing } from "../core/left-off";
import { homeAfterMove } from "./home";
import { LeftOffRecorder } from "./recorder";
import { DeskBlock } from "./render";
import { openHome, startupOpen } from "./home-note";
import { dropKeys, renameKeys } from "../core/path-keys";

/**
 * The writing desk (feature "desk"). While loaded it binds the `escrita-works` block
 * (the code block slot draws plain source while it is off), runs the left-off recorder,
 * and registers the "Open the home note" command and the cold-start open. Its data
 * follower keeps `data.leftOff` and `settings.homeNote` in step with renames and
 * deletes even while the desk is off.
 */
export class DeskModule extends FeatureModule {
  readonly id = "desk" as const;
  readonly slots = { codeBlocks: ["escrita-works"] } as const;
  private recorder: LeftOffRecorder;
  private blocks = new Set<DeskBlock>();

  constructor(private plugin: EscritaPlugin) {
    super();
    this.recorder = new LeftOffRecorder(plugin);
  }

  onload(): void {
    const p = this.plugin;
    const ctx = this.ctx;
    // a cold start only: enabling the feature mid-session never swaps the active tab
    const coldStart = !p.app.workspace.layoutReady;
    this.recorder.load(this, ctx);
    ctx.codeBlock("escrita-works", (src, el, mdCtx) => {
      const block = new DeskBlock(p, el, src, this.recorder);
      this.blocks.add(block);
      block.register(() => { this.blocks.delete(block); });
      mdCtx.addChild(block);
    });
    ctx.command({
      id: "open-home-note",
      name: t("desk.cmd.openHome"),
      callback: () => { void openHome(p, { create: true }); },
    });
    ctx.onLayoutReady(() => {
      const exists = (path: string) => p.app.vault.getAbstractFileByPath(path) !== null;
      if (pruneMissing(p.data.leftOff, exists)) p.requestSave();
      if (coldStart) void startupOpen(p);
    });
    // Blocks already on screen: draw them now. After an unload the same re-draw runs
    // once the slot is unbound, so they fall back to plain source.
    if (!coldStart) this.rerenderLeaves();
    ctx.afterUnload(() => this.rerenderLeaves());
  }

  onunload(): void {
    this.recorder.unload();
    for (const b of [...this.blocks]) b.unload();
    this.blocks.clear();
  }

  dataFollowers(): Follower[] {
    const p = this.plugin;
    return [{
      moved: (oldPath, newPath) => {
        if (renameKeys(p.data.leftOff, oldPath, newPath, newestLeftOff)) p.requestSave();
        const home = homeAfterMove(p.settings.homeNote, oldPath, newPath);
        if (home !== null) {
          p.settings.homeNote = home;
          void p.saveSettings();
        }
      },
      // a deleted home note leaves the setting alone: the command offers to create it
      deleted: (path) => {
        if (dropKeys(p.data.leftOff, path)) p.requestSave();
      },
    }];
  }

  settingsChanged(): void {
    for (const b of this.blocks) void b.refresh();
  }

  /** A code block processor only runs when a section renders, so open notes are re-rendered on a toggle (Q5). */
  private rerenderLeaves(): void {
    const ws = this.plugin.app.workspace;
    ws.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) return;
      try { view.previewMode.rerender(true); } catch (e) { console.error("Escrita: could not re-render a note", e); }
    });
    ws.updateOptions();   // Live Preview widgets
  }
}
