import type EscritaPlugin from "../main";
import { t } from "../i18n";
import type { EscritaModule } from "../data";
import { newestLeftOff, pruneMissing } from "../core/left-off";
import { homeAfterMove } from "./home";
import { LeftOffRecorder } from "./recorder";
import { DeskBlock } from "./render";
import { openHome, startupOpen } from "./home-note";
import { dropKeys, renameKeys } from "../core/path-keys";

/**
 * The writing desk. It registers the `escrita-works` block processor (DeskBlock),
 * the left-off recorder, the "Open the home note" command and the cold-start open,
 * and it keeps `data.leftOff` and `settings.homeNote` in step with renames and
 * deletes through `plugin.index.follow`.
 */
export class DeskModule implements EscritaModule {
  private recorder: LeftOffRecorder;
  private blocks = new Set<DeskBlock>();

  constructor(private plugin: EscritaPlugin) {
    this.recorder = new LeftOffRecorder(plugin);
  }

  load(): void {
    const p = this.plugin;
    // a cold start only: enabling the plugin mid-session never swaps the active tab
    const coldStart = !p.app.workspace.layoutReady;
    this.recorder.load();
    p.registerMarkdownCodeBlockProcessor("escrita-works", (src, el, ctx) => {
      const block = new DeskBlock(p, el, src, this.recorder);
      this.blocks.add(block);
      block.register(() => { this.blocks.delete(block); });
      ctx.addChild(block);
    });
    p.addCommand({
      id: "open-home-note",
      name: t("desk.cmd.openHome"),
      callback: () => { void openHome(p, { create: true }); },
    });
    const stop = p.index.follow({
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
    });
    p.register(stop);
    p.app.workspace.onLayoutReady(() => {
      const exists = (path: string) => p.app.vault.getAbstractFileByPath(path) !== null;
      if (pruneMissing(p.data.leftOff, exists)) p.requestSave();
      if (coldStart) void startupOpen(p);
    });
  }

  unload(): void {
    this.recorder.unload();
  }

  settingsChanged(): void {
    for (const b of this.blocks) void b.refresh();
  }
}
