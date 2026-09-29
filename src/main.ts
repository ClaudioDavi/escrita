import { Plugin, debounce } from "obsidian";
import { DEFAULT_SETTINGS, EscritaSettingTab, normalizeSettings, type EscritaSettings } from "./settings";
import type { EscritaData, EscritaModule, PublishRecord } from "./data";
import { mergeDefaults } from "./core/merge";
import { registerStrings } from "./i18n";
import { coreStrings } from "./strings";
import { BookService } from "./core/books";
import { WordCounter } from "./core/counter";
import { ChapterOps } from "./core/chapter-ops";
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

export default class EscritaPlugin extends Plugin {
  settings!: EscritaSettings;
  data!: EscritaData;
  books!: BookService;
  counter!: WordCounter;
  chapterOps!: ChapterOps;

  goals!: GoalsModule;
  outline!: OutlineModule;
  placeholders!: PlaceholdersModule;
  darlings!: DarlingsModule;
  editor!: EditorModule;
  publish!: PublishModule;
  private modules: EscritaModule[] = [];

  /** Persist data soon; for frequent writes such as word tracking. */
  requestSave = debounce(() => { void this.persist(); }, 2000, true);

  async onload(): Promise<void> {
    for (const s of [coreStrings, goalsStrings, outlineStrings, placeholdersStrings, darlingsStrings, editorStrings, publishStrings]) {
      registerStrings(s);
    }
    await this.loadAll();

    this.books = new BookService(this.app, () => this.settings);
    this.counter = new WordCounter(this.app);
    this.chapterOps = new ChapterOps(this);

    this.goals = new GoalsModule(this);
    this.outline = new OutlineModule(this);
    this.placeholders = new PlaceholdersModule(this);
    this.darlings = new DarlingsModule(this);
    this.editor = new EditorModule(this);
    this.publish = new PublishModule(this);
    this.modules = [this.goals, this.outline, this.placeholders, this.darlings, this.editor, this.publish];
    for (const m of this.modules) await m.load();

    this.addSettingTab(new EscritaSettingTab(this.app, this));
  }

  onunload(): void {
    for (const m of this.modules) m.unload?.();
    // Write now what a pending debounced save would have written.
    this.requestSave.cancel();
    void this.persist();
  }

  private async loadAll(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<EscritaData>;
    this.settings = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, raw.settings));
    this.data = {
      version: 1,
      settings: this.settings,
      history: isRecord(raw.history) ? raw.history : {},
      publish: isRecord(raw.publish) ? (raw.publish as Record<string, PublishRecord>) : {},
    };
  }

  private async persist(): Promise<void> {
    this.data.settings = this.settings;
    await this.saveData(this.data);
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    for (const m of this.modules) m.settingsChanged?.();
  }
}

function isRecord<T>(v: T | undefined | null): v is T {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
