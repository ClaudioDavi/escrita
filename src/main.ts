import { Plugin, TFile, debounce, normalizePath, setTooltip } from "obsidian";
import { loadSettings, type EscritaSettings } from "./settings";
import { EscritaSettingTab } from "./settings-tab";
import type { EscritaData } from "./data";
import { cleanExportChoices, cleanReadPositions, cleanSetupOffered } from "./data";
import { cleanLeftOff } from "./core/left-off";
import { HistoryStore, mergeSettings, stableJson, type HistoryHost } from "./core/history-store";
import { locale, registerStrings } from "./i18n";
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
import { ExportModule } from "./export";
import { exportStrings } from "./export/strings";
import { SubmissionsModule } from "./submissions";
import { submissionsStrings } from "./submissions/strings";
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
import { startCoreModule, type FeatureModule } from "./core/module-context";
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
import { appearsStrings } from "./universe/strings-appears";
import { SetupModule } from "./setup";
import { setupStrings } from "./setup/strings";
import { setupLayoutStrings } from "./setup/layout-strings";
import { NewWorkModule } from "./new-work";
import { newWorkStrings } from "./new-work/strings";
import { screenplayStrings } from "./screenplay/strings";
import { ScreenplayModule } from "./screenplay";
import type { NewWorkStarter } from "./core/new-work";

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
  /** The word-count history shared by this vault's devices (core/history-store.ts, PLAN-1.2.3). */
  history!: HistoryStore;
  /** The settings as last read from or written to data.json: what a reload merges against, per key. */
  private syncedSettings: Record<string, unknown> = {};
  private settingTab: EscritaSettingTab | null = null;

  goals!: GoalsModule;
  outline!: OutlineModule;
  placeholders!: PlaceholdersModule;
  explorer!: ExplorerModule;
  darlings!: DarlingsModule;
  snapshots!: SnapshotsModule;
  desk!: DeskModule;
  publish!: PublishModule;
  export!: ExportModule;
  submissions!: SubmissionsModule;
  lens!: LensModule;
  universe!: UniverseModule;
  threads!: ThreadsFeature;
  /** "Set up a writing vault": a core module, always loaded (ARCHITECTURE.md, "Core modules"). */
  setup!: SetupModule;
  /** "New work…": a core module, always loaded; others call it through this port (core/new-work.ts). */
  newWork!: NewWorkStarter;

  /** Persist data soon; for frequent writes such as word tracking. */
  requestSave = debounce(() => { void this.persist(); }, 2000, true);

  async onload(): Promise<void> {
    for (const s of [
      coreStrings, goalsStrings, outlineStrings, placeholdersStrings, darlingsStrings, editorStrings, publishStrings,
      exportStrings, submissionsStrings,
      explorerStrings, snapshotsStrings, deskStrings, lensStrings,
      universeStrings, universeViewStrings, universeCreateStrings, universeMigrateStrings, appearsStrings,
      setupStrings, setupLayoutStrings, newWorkStrings, screenplayStrings,
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
    this.export = new ExportModule(this);
    this.submissions = new SubmissionsModule(this);
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
      ["publish", this.publish], ["export", this.export], ["submissions", this.submissions],
      ["desk", this.desk],
      ["universe", this.universe], ["threads", this.threads],
      ["screenplay", new ScreenplayModule(this)],
    ]);
    this.features = new FeatureRegistry(this, modules);
    this.features.init();
    this.features.apply();
    // Core modules: after the switches are applied, so they can read features.isOn.
    this.setup = new SetupModule(this);
    startCoreModule(this, this.setup);
    const newWork = new NewWorkModule(this);
    this.newWork = newWork;
    startCoreModule(this, newWork);

    // Obsidian builds the tab's rows here and on its update() only: a change of the loaded features
    // or the switches rebuilds them (PLAN-1.0.3 Q5).
    const tab = new EscritaSettingTab(this.app, this);
    this.settingTab = tab;
    this.addSettingTab(tab);
    this.register(this.features.onApplied(() => tab.refresh()));

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

    // Another device's save arrives through the sync tool as a newer data.json: read it again when
    // the window comes back, and once a minute (PLAN-1.2.3, D6). Our own writes are skipped by mtime.
    this.registerDomEvent(window, "focus", () => { void this.checkDisk(); });
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") void this.checkDisk();
    });
    this.registerInterval(window.setInterval(() => { void this.checkDisk(); }, 60_000));
  }

  /** Obsidian saw data.json change on disk (desktop, from a sync tool or git). */
  async onExternalSettingsChange(): Promise<void> {
    if (!this.history) return;
    await this.history.refresh({ force: true, adopt: (raw) => this.adoptSettings(raw) });
  }

  private async checkDisk(): Promise<void> {
    if (!this.history) return;
    await this.history.refresh({ adopt: (raw) => this.adoptSettings(raw) });
  }

  /**
   * Take the settings of a newer data.json, per key: a key this device didn't change since the last
   * read or write takes the file's value, one it changed keeps its own. Applied as saveSettings
   * does, without writing.
   */
  private adoptSettings(raw: unknown): void {
    const saved = (raw as { settings?: unknown } | null)?.settings;
    if (!isRecord(saved)) return;
    const disk = loadSettings(saved, locale()).settings;
    const settings = mergeSettings(this.syncedSettings, this.settings as unknown as Record<string, unknown>, disk as unknown as Record<string, unknown>);
    this.syncedSettings = cloneJson(disk);
    if (stableJson(settings) === stableJson(this.settings)) return;
    // in place: the modules and the data hold this object
    for (const k of Object.keys(this.settings)) delete (this.settings as unknown as Record<string, unknown>)[k];
    Object.assign(this.settings, settings);
    this.data.settings = this.settings;
    if (!this.features) return;
    this.features.apply();
    this.index.settingsChanged();
    this.features.settingsChanged();
    this.settingTab?.refresh();
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
      structuralProperties: [s.collectionProperty],
    };
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!needsDraftStatus(this.books.classify(file), fm, o)) return;
    const word = writtenWord(s.stages, "draft");
    try {
      // the writer may be typing in the new note: put the editor's unsaved text on disk first, or
      // processFrontMatter reads the older file and its write replaces what was typed (rule 1)
      await this.notes.flush(file);
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
    if (this.history) void this.persist();
  }

  private async loadAll(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<EscritaData>;
    const { settings, fresh } = loadSettings(raw.settings, locale());
    this.settings = settings;
    this.syncedSettings = cloneJson(settings);
    const host: HistoryHost = {
      load: () => this.loadData() as Promise<unknown>,
      save: (d) => this.saveData(d),
      mtime: async () => {
        const st = await this.app.vault.adapter.stat(normalizePath(`${this.manifest.dir ?? ""}/data.json`));
        return st?.mtime ?? 0;
      },
      local: {
        get: (k) => this.app.loadLocalStorage(k) as unknown,
        set: (k, v) => { this.app.saveLocalStorage(k, v); },
      },
      now: () => Date.now(),
    };
    this.history = new HistoryStore(host, () => this.requestSave());
    this.history.absorb(raw);
    await this.history.markSeen();
    this.data = {
      version: 1,
      settings: this.settings,
      history: isRecord(raw.history) ? raw.history : {},
      devices: {},
      renames: [],
      publish: isRecord(raw.publish) ? (raw.publish) : {},
      leftOff: cleanLeftOff(raw.leftOff),
      lensDismissed: cleanDismissed(raw.lensDismissed),
      threadSeen: cleanSeen(raw.threadSeen),
      povColors: cleanPovColors(raw.povColors),
      exportChoices: cleanExportChoices(raw.exportChoices),
      readPosition: cleanReadPositions(raw.readPosition),
      setupOffered: cleanSetupOffered(raw),
    };
    // A fresh install saves once, so its default set never follows Obsidian's language later.
    if (fresh) await this.persist();
  }

  /**
   * One save at a time (the store's queue): read data.json, merge the history sections, write.
   * Settings and the other keys are memory's (PLAN-1.2.3, D5, D6).
   */
  private persist(): Promise<void> {
    // Saving `stages` is what tells the next load the migration is done; the legacy keys stay.
    this.data.settings = this.settings;
    return this.history.persist((parts) => {
      this.data.settings = this.settings;
      this.data.history = parts.history;
      this.data.devices = parts.devices;
      this.data.renames = parts.renames;
      this.syncedSettings = cloneJson(this.settings);
      return this.data;
    }, (raw) => this.adoptSettings(raw));
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    this.features.apply();
    this.index.settingsChanged();
    this.features.settingsChanged();
  }
}

function cloneJson(v: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
}

function isRecord<T>(v: T | undefined | null): v is T {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
