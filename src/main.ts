import { Plugin, debounce, setTooltip } from "obsidian";
import { DEFAULT_SETTINGS, EscritaSettingTab, normalizeSettings, type EscritaSettings } from "./settings";
import type { EscritaData, EscritaModule, PublishRecord } from "./data";
import { mergeDefaults } from "./core/merge";
import { migrateSettings } from "./core/migrate";
import { cleanLeftOff } from "./core/left-off";
import { registerStrings } from "./i18n";
import { coreStrings } from "./strings";
import { BookService } from "./core/books";
import { Measurer } from "./core/measurer";
import { ExplorerDecorations } from "./core/explorer-decorations";
import { ChapterOps } from "./core/chapter-ops";
import { NoteService } from "./core/notes";
import { GoalsModule } from "./goals";
import { goalsStrings } from "./goals/strings";
import { OutlineModule } from "./outline";
import { outlineStrings } from "./outline/strings";
import { PlaceholdersModule } from "./placeholders";
import { placeholdersStrings } from "./placeholders/strings";
import { DarlingsModule } from "./darlings";
import { darlingsStrings } from "./darlings/strings";
import { EditorModule } from "./editor";
import { editorStrings } from "./editor/strings";
import { PublishModule } from "./publish";
import { publishStrings } from "./publish/strings";
import { ExplorerModule } from "./explorer";
import { explorerStrings } from "./explorer/strings";
import type { Follower, IndexSpec, IndexFile, VaultIndex } from "./core/vault-index";
import type { WorksReader } from "./core/works";
import { VaultIndexesShell } from "./core/vault-indexes";
import { WorksService } from "./core/works-index";
import { DeskModule } from "./desk";
import { deskStrings } from "./desk/strings";
import { LensModule } from "./lens";
import { lensStrings } from "./lens/strings";
import { cleanDismissed } from "./lens/dismiss";
import { SnapshotsModule } from "./snapshots";
import { snapshotsStrings } from "./snapshots/strings";

/** The reusable vault index (0.4 task 3.x fills it in). */
export interface VaultIndexes {
  add<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V>;
  follow(f: Follower): () => void;
  rebuild(name?: string): void;
  settingsChanged(): void;
  unload(): void;
}

export default class EscritaPlugin extends Plugin {
  settings!: EscritaSettings;
  data!: EscritaData;
  books!: BookService;
  measure!: Measurer;
  decorations!: ExplorerDecorations;
  chapterOps!: ChapterOps;
  notes!: NoteService;
  index!: VaultIndexes;
  works!: WorksReader;

  goals!: GoalsModule;
  outline!: OutlineModule;
  placeholders!: PlaceholdersModule;
  explorer!: ExplorerModule;
  darlings!: DarlingsModule;
  editor!: EditorModule;
  snapshots!: SnapshotsModule;
  desk!: DeskModule;
  publish!: PublishModule;
  lens!: LensModule;
  private modules: EscritaModule[] = [];

  /** Persist data soon; for frequent writes such as word tracking. */
  requestSave = debounce(() => { void this.persist(); }, 2000, true);

  async onload(): Promise<void> {
    for (const s of [
      coreStrings, goalsStrings, outlineStrings, placeholdersStrings, darlingsStrings, editorStrings, publishStrings,
      explorerStrings, snapshotsStrings, deskStrings, lensStrings,
    ]) {
      registerStrings(s);
    }
    await this.loadAll();

    this.books = new BookService(this.app, () => this.settings);
    // before the modules: its rename/delete handlers must run before theirs
    this.measure = new Measurer(this);
    // order: measure -> index -> followers -> modules, so counts are fresh when
    // the index computes, and followers run before any module reacts
    this.index = new VaultIndexesShell(this);
    this.works = new WorksService(this, this.index);
    this.chapterOps = new ChapterOps(this);
    this.notes = new NoteService(this.app);
    // The file explorer's dots and counts. It re-renders its items without
    // telling anyone; layout-change is the closest signal.
    this.decorations = new ExplorerDecorations(
      () => this.app.workspace.getLeavesOfType("file-explorer").map((l) => l.view),
      {
        tooltip: (el, text) => {
          if (text) setTooltip(el as unknown as HTMLElement, text);
          else el.removeAttribute("aria-label");
        },
      },
    );
    this.registerEvent(this.app.workspace.on("layout-change", debounce(() => this.decorations.refresh(), 100, true)));
    // Obsidian keeps the explorer's DOM after the plugin is disabled.
    this.register(() => this.decorations.clear());

    this.goals = new GoalsModule(this);
    this.outline = new OutlineModule(this);
    this.placeholders = new PlaceholdersModule(this);
    this.explorer = new ExplorerModule(this);
    this.darlings = new DarlingsModule(this);
    this.editor = new EditorModule(this);
    this.lens = new LensModule(this);
    // before publish: "Before publishing" snapshots
    this.snapshots = new SnapshotsModule(this);
    this.publish = new PublishModule(this);
    this.desk = new DeskModule(this);
    this.modules = [
      this.goals, this.outline, this.placeholders, this.explorer, this.darlings, this.editor, this.lens, this.snapshots, this.publish, this.desk,
    ];
    for (const m of this.modules) await m.load();

    this.addSettingTab(new EscritaSettingTab(this.app, this));
  }

  onunload(): void {
    for (const m of this.modules) m.unload?.();
    this.index?.unload();
    this.measure?.unload();
    // Write now what a pending debounced save would have written.
    this.requestSave.cancel();
    void this.persist();
  }

  private async loadAll(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<EscritaData>;
    this.settings = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, migrateSettings(raw.settings)));
    this.data = {
      version: 1,
      settings: this.settings,
      history: isRecord(raw.history) ? raw.history : {},
      publish: isRecord(raw.publish) ? (raw.publish as Record<string, PublishRecord>) : {},
      leftOff: cleanLeftOff(raw.leftOff),
      lensDismissed: cleanDismissed(raw.lensDismissed),
    };
  }

  private async persist(): Promise<void> {
    // Saving `stages` is what tells the next load the migration is done; the legacy keys stay.
    this.data.settings = this.settings;
    await this.saveData(this.data);
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    this.index.settingsChanged();
    for (const m of this.modules) m.settingsChanged?.();
  }
}

function isRecord<T>(v: T | undefined | null): v is T {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
