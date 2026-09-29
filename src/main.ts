import { Plugin, debounce } from "obsidian";
import { DEFAULT_SETTINGS, EscritaSettingTab, type EscritaSettings } from "./settings";
import type { EscritaData, EscritaModule } from "./data";
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
  private modules: EscritaModule[] = [];

  /** Persist data soon; for frequent writes such as word tracking. */
  requestSave = debounce(() => { void this.persist(); }, 2000, true);

  async onload(): Promise<void> {
    for (const s of [coreStrings, goalsStrings, outlineStrings, placeholdersStrings, darlingsStrings, editorStrings]) {
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
    this.modules = [this.goals, this.outline, this.placeholders, this.darlings, this.editor];
    for (const m of this.modules) await m.load();

    this.addSettingTab(new EscritaSettingTab(this.app, this));
  }

  onunload(): void {
    for (const m of this.modules) m.unload?.();
    void this.persist();
  }

  private async loadAll(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<EscritaData>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings ?? {});
    this.data = { version: 1, settings: this.settings, history: raw.history ?? {} };
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
