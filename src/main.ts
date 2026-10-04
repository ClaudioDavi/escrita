import { Plugin, TFile, debounce, setTooltip } from "obsidian";
import { DEFAULT_SETTINGS, EscritaSettingTab, normalizeSettings, type EscritaSettings } from "./settings";
import type { EscritaData, PublishRecord } from "./data";
import { cleanExportChoices } from "./data";
import { mergeDefaults } from "./core/merge";
import { migrateSettings } from "./core/migrate";
import { cleanLeftOff } from "./core/left-off";
import { registerStrings } from "./i18n";
import { coreStrings } from "./strings";
import { BookService } from "./core/books";
import { Measurer } from "./core/measurer";
import { ExplorerDecorations } from "./core/explorer-decorations";
import { ChapterOps } from "./core/chapter-ops";
import { needsDraftStatus } from "./core/new-note-status";
import { writtenWord } from "./core/stages";

import { NoteService } from "./core/notes";
import { GoalsModule } from "./goals";
import { goalsStrings } from "./goals/strings";
import { OutlineModule } from "./outline";
import { cleanPovColors } from "./outline/pov";
import { outlineStrings } from "./outline/strings";
import { PlaceholdersModule } from "./placeholders";
import { placeholdersStrings } from "./placeholders/strings";
import { DarlingsModule } from "./darlings";
import { darlingsStrings } from "./darlings/strings";
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
import { cleanSeen } from "./universe/first-seen";
import { FeatureRegistry } from "./core/feature-registry";
import type { FeatureId } from "./core/features";
import type { FeatureModule } from "./core/module-context";
import { NamesPort } from "./core/names-source";
import { TypingFeature, DialogueFocusFeature, MoveBlocksFeature, SpellcheckFeature, TemplatesFeature } from "./editor/features";
import { StageSnapshotFeature } from "./snapshots/stage-feature";
import { ThreadsFeature } from "./universe/threads-feature";
import { SnapshotsModule } from "./snapshots";
import { snapshotsStrings } from "./snapshots/strings";
import { UniverseModule } from "./universe";
import { universeStrings } from "./universe/strings";
import { universeViewStrings } from "./universe/view-strings";
import { universeCreateStrings } from "./universe/create-strings";
import { universeMigrateStrings } from "./universe/migrate-strings";

/** How long after a note is created before its status is checked: templates land first. */
const DRAFT_DELAY_MS = 1500;

/** The reusable vault index (0.4 task 3.x fills it in). */
export interface VaultIndexes {
  add<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V>;
  /** Disposes an index added with `add` and drops it from the hub (a feature turned off). */
  remove<F extends IndexFile, V>(index: VaultIndex<F, V>): void;
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
  features!: FeatureRegistry;
  names!: NamesPort;

  goals!: GoalsModule;
  outline!: OutlineModule;
  placeholders!: PlaceholdersModule;
  explorer!: ExplorerModule;
  darlings!: DarlingsModule;
  snapshots!: SnapshotsModule;
  desk!: DeskModule;
  publish!: PublishModule;
  lens!: LensModule;
  universe!: UniverseModule;
  threads!: ThreadsFeature;

  /** Persist data soon; for frequent writes such as word tracking. */
  requestSave = debounce(() => { void this.persist(); }, 2000, true);

  async onload(): Promise<void> {
    for (const s of [
      coreStrings, goalsStrings, outlineStrings, placeholdersStrings, darlingsStrings, editorStrings, publishStrings,
      explorerStrings, snapshotsStrings, deskStrings, lensStrings,
      universeStrings, universeViewStrings, universeCreateStrings, universeMigrateStrings,
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
    this.names = new NamesPort();
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
    this.lens = new LensModule(this);
    // before publish: "Before publishing" snapshots
    this.snapshots = new SnapshotsModule(this);
    this.publish = new PublishModule(this);
    this.desk = new DeskModule(this);
    this.universe = new UniverseModule(this);
    this.threads = new ThreadsFeature(this);
    // keyed by feature id
    const modules = new Map<FeatureId, FeatureModule>([
      ["goals", this.goals], ["outline", this.outline], ["placeholders", this.placeholders],
      ["explorerCounts", this.explorer], ["darlings", this.darlings],
      ["typing", new TypingFeature(this)], ["dialogueFocus", new DialogueFocusFeature(this)],
      ["moveBlocks", new MoveBlocksFeature(this)], ["templates", new TemplatesFeature(this)],
      ["spellcheck", new SpellcheckFeature(this)],
      ["lens", this.lens], ["snapshots", this.snapshots], ["stageSnapshot", new StageSnapshotFeature(this)],
      ["publish", this.publish], ["desk", this.desk],
      ["universe", this.universe], ["threads", this.threads],
    ]);
    this.features = new FeatureRegistry(this, modules);
    this.features.init();
    this.features.apply();

    this.addSettingTab(new EscritaSettingTab(this.app, this));

    // A note the writer creates in a tracked folder starts in the draft stage. Only after
    // the layout is ready (the vault fires "create" for every file while it loads), and a
    // moment later, so a template has landed first and its own status wins.
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (f) => {
        if (!(f instanceof TFile) || f.extension !== "md" || !this.settings.draftNewNotes) return;
        const id = window.setTimeout(() => { this.draftTimers.delete(id); void this.draftIfNew(f); }, DRAFT_DELAY_MS);
        this.draftTimers.add(id);
      }));
    });
    this.register(() => { for (const id of this.draftTimers) window.clearTimeout(id); this.draftTimers.clear(); });
  }

  private draftTimers = new Set<number>();

  /** Write the draft word into a just-created note's status, unless it has one (or shouldn't have one). */
  private async draftIfNew(file: TFile): Promise<void> {
    const s = this.settings;
    if (!s.draftNewNotes || this.app.vault.getAbstractFileByPath(file.path) !== file) return;
    const prop = s.statusProperty;
    const o = {
      statusProperty: prop,
      typeProperty: s.typeProperty,
      templateFolders: [s.templatesFolder],
      ownNotes: [s.homeNote, s.lensListsNote, s.universeNote, s.chapterTemplate],
    };
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!needsDraftStatus(this.books.classify(file), fm, o)) return;
    const word = writtenWord(s.stages, "draft");
    try {
      // checked again inside: the file may have gained a status since the cache was read
      await this.app.fileManager.processFrontMatter(file, (front: Record<string, unknown>) => {
        if (needsDraftStatus(this.books.classify(file), front, o)) front[prop] = word;
      });
    } catch {
      // a note that can't take properties (broken frontmatter) is left as it is
    }
  }

  onunload(): void {
    this.features?.unloadAll();
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
      threadSeen: cleanSeen(raw.threadSeen),
      povColors: cleanPovColors(raw.povColors),
      exportChoices: cleanExportChoices(raw.exportChoices),
    };
  }

  private async persist(): Promise<void> {
    // Saving `stages` is what tells the next load the migration is done; the legacy keys stay.
    this.data.settings = this.settings;
    await this.saveData(this.data);
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    this.features.apply();
    this.index.settingsChanged();
    this.features.settingsChanged();
  }
}

function isRecord<T>(v: T | undefined | null): v is T {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
