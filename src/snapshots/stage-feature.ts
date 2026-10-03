// The stage snapshot as a switchable feature, split out of the snapshots module
// (0.7 plan Q9, Q11; requires snapshots, so the store is there while this is loaded).
// A stage change takes a snapshot, silently (SS3). Fed by the works index.

import { Notice } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import { writingDay } from "../core/dates";
import { measureText } from "../core/measure";
import { writtenWord, type Stage } from "../core/stages";
import { t } from "../i18n";
import { StageWatch, stageTakeTargets, transitionName } from "./stage-watch";

export class StageSnapshotFeature extends FeatureModule {
  readonly id = "stageSnapshot" as const;
  private watch: StageWatch | null = null;
  private stageFailed = false;

  constructor(private plugin: EscritaPlugin) {
    super();
  }

  onload(): void {
    const p = this.plugin;
    const watch = new StageWatch({
      timers: {
        set: (cb, ms) => window.setTimeout(cb, ms),
        clear: (h) => window.clearTimeout(h as number),
        yieldNow: () => new Promise<void>((r) => window.setTimeout(r, 0)),
      },
      current: (path) => p.works.get(path),
      all: () => p.works.list(),
      onTransition: (path, from, to) => { void this.takeStage(path, from, to); },
    });
    this.watch = watch;
    this.register(p.works.onChange((changes) => watch.handle(changes)));
    // seed from the full works list once the index is built
    if (p.works.isReady()) watch.handle([{ path: "", cause: "build" }]);
    else this.register(p.works.onReady(() => watch.handle([{ path: "", cause: "build" }])));
  }

  onunload(): void {
    this.watch?.dispose();
    this.watch = null;
  }

  /** The work's note (and a book's chapters) are saved under the same name, one after another. */
  private async takeStage(path: string, from: Stage, to: Stage): Promise<void> {
    const snapshots = this.plugin.snapshots;
    try {
      const { vault } = this.plugin.app;
      const note = vault.getAbstractFileByPath(path);
      if (!snapshots.canSnapshot(note)) return;
      const entry = this.plugin.works.get(path);
      const placement = this.plugin.books.classify(note);
      const chapters = entry?.role === "book" && placement.book
        ? this.plugin.books.chapters(placement.book).map((c) => c.file)
        : [];
      const targets = stageTakeTargets(note, entry?.role ?? "note", chapters);
      const stages = this.plugin.settings.stages;
      const name = transitionName(from, to, (s) => writtenWord(stages, s));
      const day = writingDay(new Date(), this.plugin.settings.dayEndsAt);
      for (const t0 of targets) {
        // re-resolve by path: the file may have been renamed or deleted meanwhile
        const f = vault.getAbstractFileByPath(t0.path);
        if (!snapshots.canSnapshot(f)) continue;
        const text = await this.plugin.notes.text(f).read();
        await snapshots.store.take(f, text, {
          kind: "stage", name, stage: { from, to }, day, words: measureText(text).words,
        });
      }
    } catch (e) {
      console.error(`Escrita: couldn't take the stage snapshot of ${path}`, e);
      if (this.stageFailed) return;
      this.stageFailed = true;
      new Notice(t("snapshots.notice.stageFailed"));
    }
  }
}
