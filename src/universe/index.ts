// The universe module (ROADMAP-universe "Modes", 1.1, 1.3, 1.5). It owns:
//   * the entries index   (notes whose type property names an entry type)
//   (the threads index and the first-seen store moved to ThreadsFeature)
//   * the mode-dependent commands, menus and views
// and gives the three UI builders one small API: entries(), threads(), worksIn(),
// scopeOf(), universes(), closeThread(), createEntry()… (documented on each method).
//
// Who owns what: this file, settings.ts, settings-ui.ts and strings.ts are shared
// foundation; view.ts (+view-strings, view.css) is the panel; create.ts (+create-strings,
// create.css) is entry creation and threads in the editor; migrate.ts (+migrate-strings,
// migrate.css) is the migration. Pure logic: entries.ts, threads.ts, first-seen.ts,
// works-list.ts, migration.ts, new-entry.ts, scope.ts (all tested, no Obsidian imports).
//
// Mode off: the feature registry unloads this module (0.7): its leaves are closed, its
// commands and menus are gone, its index is dropped. Open threads are a separate feature
// (threads-feature.ts) and keep working; "Show open threads" opens the standalone view.
// The stateless helpers (scopeOf, closeThread, answerLink, worksIn, createUniverseNote…)
// stay callable while this module is unloaded.

import { Keymap, TFile, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule, type SettingsUi } from "../core/module-context";
import { locale, t } from "../i18n";
import { NoteExistsError } from "../core/notes";
import { closeThreadPlan, reopenThreadPlan, type ThreadMarker } from "../core/markers";
import { macrotaskYield, type VaultIndex } from "../core/vault-index";
import { entriesIn, entriesSpec, type Entry, type ScopedEntry } from "./entries";
import { entryPath, entryText } from "./new-entry";
import { appearsInExtension, type AppearsInAnswer, type AppearsInSource } from "./appears-in-widget";
import { baseName } from "./appears-in-model";
import { defaultLabels, openMention, type AppearsInLabels } from "./appears-in";
import { MentionCtxFactory } from "./mention-ctx";
import { MentionsIndex } from "./mentions-index";
import { NamesIndex, type NoteRuns } from "./names-index";
import { NameMarks, SPELLCHECK_MARKS_WORK } from "./name-marks";
import { UniverseNamesProvider } from "./names-provider";
import { registerAppearsStrings } from "./strings-appears";
import { keptOut, scopeFor, universeNotePath, universeRootOf, type Scope } from "../core/scope";
import type { EntryKind, UniverseMode } from "./settings";
import { inScope, type ThreadRef } from "./threads";
import { formFor, type WorkInfo } from "./works-list";
import { computeMentions, type NoteMentions } from "./mentions";
import { segment } from "../core/markdown";
import { findNames, matchLang } from "../core/names";
import { unlinkedIn } from "./unlinked";
import { rowsOf, type UnlinkedRow } from "./unlinked-link";
import { addUniverseEditorMenuItems, createEntryFromSelection, inSource } from "./create";
import { addMigrateFileMenuItem, migrateActiveBook } from "./migrate";
import { UNIVERSE_VIEW, UniverseView, activateThreadsView, activateUniverseView } from "./view";
import { universeSettingsSection } from "./settings-ui";

/** A universe the vault knows: the settings' one, and any other a work or entry links to. */
export interface UniverseInfo {
  /** the universe note's path (may not exist yet) */
  note: string;
  /** the note's basename, the universe's name */
  name: string;
  /** the folder beside the note with the same basename: where entries live */
  root: string;
  /** whether the note exists in the vault */
  exists: boolean;
  /** the universe named in settings */
  isDefault: boolean;
}

export type CreateEntryReason = "name" | "scope" | "exists";

/** createEntry's refusals: an unusable name, a scope with no place for entries (mode off, a standalone note), or a file already there. */
export class CreateEntryError extends Error {
  constructor(readonly reason: CreateEntryReason, readonly file: TFile | null = null) {
    super(`Couldn't create the entry: ${reason}`);
    this.name = "CreateEntryError";
  }
}

/** quiet time before the panel and the note's section redraw after the mentions change (finding 4) */
const MENTIONS_EMIT_MS = 1000;
const SCOPE_MS = 300;
const WORKS_MS = 500;

export class UniverseModule extends FeatureModule {
  readonly id = "universe" as const;
  /** two editor slots: the name marks, then the "Appears in" section. No post-processor: Reading view waits on G0d. */
  readonly slots = { views: [UNIVERSE_VIEW], editors: 2 };
  private entriesIdx: VaultIndex<TFile, Entry> | null = null;
  private namesProvider: UniverseNamesProvider | null = null;
  private mentions: MentionsIndex<TFile> | null = null;
  /** the on-demand index behind the names port's cross-work counts (0.9, the lens's names rule) */
  private nameRuns: NamesIndex<TFile> | null = null;
  private ctxFactory: MentionCtxFactory | null = null;
  private marks: NameMarks | null = null;
  private source: AppearsInSource | null = null;
  private listeners = new Set<() => void>();
  /** quiet-time timers by name (scope, works, mentions); all cleared on unload */
  private later_ = new Map<string, number>();
  /** the last `universe` property value seen per note, to tell a real scope change from an ordinary save */
  private universeSeen = new Map<string, string>();
  private mentionsShown = false;
  private lastUnderline = false;

  constructor(private plugin: EscritaPlugin) {
    super();
    registerAppearsStrings();
  }

  /** Loaded while the mode is not off (the registry decides); the stateless helpers below work either way. */
  onload(): void {
    const p = this.plugin;
    const entries = this.ctx.index<TFile, Entry>(entriesSpec<TFile>({
      settings: () => p.settings,
      frontmatter: (f) => p.books.frontmatter(f),
    }));
    this.entriesIdx = entries;

    // the names port: provided while loaded, withdrawn on unload (Q36)
    const timers = {
      set: (cb: () => void, ms: number): unknown => window.setTimeout(cb, ms),
      clear: (h: unknown): void => window.clearTimeout(h as number),
    };
    const names = new UniverseNamesProvider({
      entries: () => [...entries.entries()].map(([, e]) => e),
      scopeOf: (path) => this.scopeOf(path),
      language: () => p.settings.lensLanguage,
      locale: () => locale(),
      nameTitles: () => p.settings.nameTitles,
      timers,
      createEntry: (name, from) => {
        const file = p.app.vault.getAbstractFileByPath(from);
        // the lens's names rule (D8): the modal for the note's scope with the whole run filled in; nothing written into the note
        if (file instanceof TFile) createEntryFromSelection(p, null, file, { named: name });
      },
      counts: {
        want: () => this.nameRuns?.want(),
        ready: () => this.nameRuns?.isReady() ?? false,
        count: (text, path) => this.nameRuns?.workCount(text, path) ?? 0,
      },
    });
    this.namesProvider = names;
    this.register(p.names.provide(names));
    this.register(() => names.dispose());

    const factory = new MentionCtxFactory({
      scopeOf: (path) => this.scopeOf(path),
      resolve: (link, from) => p.app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? null,
      place: (path) => {
        const pl = p.books.classify(path);
        if (!pl.book) return null;
        return pl.kind === "chapter" || pl.kind === "book-note" ? { kind: pl.kind, book: pl.book.note.path } : null;
      },
      chapters: (book) => {
        const b = p.books.classify(book).book;
        return b ? p.books.chapters(b).map((c) => c.file.path) : [];
      },
      isWork: (path) => {
        if (entries.get(path)) return false;
        // a book is a work even before its note has a status; a standalone note needs a stage
        if (p.books.classify(path).kind === "book-note") return true;
        const e = p.works.get(path);
        return !!e && e.role === "note" && e.stage !== null;
      },
      worksIn: (scope) => this.worksIn(scope),
    });
    this.ctxFactory = factory;

    const mentions = new MentionsIndex<TFile>({
      add: (spec) => this.ctx.index<TFile, NoteMentions>(spec),
      rebuild: (name) => p.index.rebuild(name),
      table: () => names.globalTable(),
      settings: () => p.settings,
      resolve: (link, from) => p.app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? null,
      timers: { ...timers, yieldNow: macrotaskYield },
    });
    this.mentions = mentions;
    this.mentionsShown = false;
    this.register(() => mentions.dispose());

    // the cross-work counts of the lens's names rule: added now, built only when the rule first runs
    const nameRuns = new NamesIndex<TFile>({
      add: (spec) => this.ctx.index<TFile, NoteRuns>(spec),
      settings: () => p.settings,
      lang: () => matchLang(p.settings.lensLanguage, locale()),
      ctx: (path) => factory.ctx(path),
      timers: { ...timers, yieldNow: macrotaskYield },
    });
    this.nameRuns = nameRuns;
    this.register(() => nameRuns.dispose());
    this.register(nameRuns.onChange(() => names.countsChanged()));
    nameRuns.start();
    this.register(names.onChange(() => mentions.tableChanged()));
    // counts follow edits, but the panel redraws a second after they settle (finding 4); the first build shows at once
    this.register(mentions.onChange(() => {
      if (!this.mentionsShown && mentions.isReady()) {
        this.mentionsShown = true;
        this.emit();
      } else {
        this.later("mentions", MENTIONS_EMIT_MS, () => this.emit());
      }
    }));

    // scope depends on a note's `universe` property, a book's structure and the settings: only those move it
    this.registerEvent(p.app.metadataCache.on("changed", (f, _data, cache) => this.metadataChanged(f, cache?.frontmatter)));
    const structure = (): void => this.scopeMoved();
    this.registerEvent(p.app.vault.on("create", structure));
    this.registerEvent(p.app.vault.on("delete", structure));
    this.registerEvent(p.app.vault.on("rename", structure));
    this.register(p.works.onChange(() => this.later("works", WORKS_MS, () => {
      factory.reset();
      mentions.answersChanged();
      this.emit();
    })));

    this.register(entries.onChange(() => { names.refresh(); this.emit(); }));
    // the first build of the mentions index waits for the entries and a first term table (3.2)
    this.register(entries.onReady(() => { names.refresh(); mentions.start(); this.emit(); }));

    this.source = {
      appearsIn: (path) => this.appearsInAnswer(path),
      labels: () => this.labels(),
    };

    this.lastUnderline = p.settings.underlineNames;
    const marks = new NameMarks({
      names: p.names,
      underline: () => p.settings.underlineNames,
      spellcheckWorks: () => SPELLCHECK_MARKS_WORK,
      open: (path, evt) => this.openEntry(path, evt),
    });
    this.marks = marks;
    this.register(() => marks.dispose());
    this.ctx.editor([marks.extension]);
    this.ctx.editor([appearsInExtension({
      appearsIn: (path) => this.appearsInAnswer(path),
      labels: () => this.labels(),
      open: (entry, path, range, evt) => { void openMention(p, entry, path, range, evt, false); },
      onChange: (cb) => this.onChange(cb),
    })]);

    this.ctx.view(UNIVERSE_VIEW, (leaf) => new UniverseView(leaf, p));
    this.registerCommands();
    this.registerMenus();
    this.emit();
  }

  onunload(): void {
    for (const h of this.later_.values()) window.clearTimeout(h);
    this.later_.clear();
    this.universeSeen.clear();
    this.entriesIdx = null;   // the context disposes the indexes and empties the editor slots
    this.namesProvider = null;
    this.mentions = null;
    this.nameRuns = null;
    this.ctxFactory = null;
    this.marks = null;
    this.source = null;
    this.emit();
  }

  settingsChanged(): void {
    this.namesProvider?.refresh();
    this.ctxFactory?.reset();
    this.mentions?.scopeChanged();
    this.nameRuns?.scopeChanged();
    const underline = this.plugin.settings.underlineNames;
    if (underline !== this.lastUnderline) {
      this.lastUnderline = underline;
      this.marks?.refresh();
    }
    this.emit();
  }

  // ------------------------------------------------------------------ API

  /** The universe mode in force. */
  mode(): UniverseMode { return this.plugin.settings.universeMode; }

  /** Whether the universe panel and commands exist (mode is not off). */
  enabled(): boolean { return this.mode() !== "off"; }

  /**
   * Subscribe to anything the panel may show: entries, threads, first-seen dates, the
   * mode and the settings changing. Returns the unsubscribe function (pass it to
   * `view.register(...)`). Not debounced beyond the indexes' own settling.
   */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Whether the entries and threads indexes finished their first build (lists may be partial before). */
  isReady(): boolean {
    return !!this.entriesIdx?.isReady() && this.plugin.threads.isReady();
  }

  /** The scope of a note (kind none / book / universe, with its root folder and naming note), per scopeFor and the current mode. */
  scopeOf(file: TFile | string): Scope {
    const place = this.plugin.books.classify(file);
    if (place.kind !== "none" && !place.snapshot && !place.submission && !place.export) return place.scope;
    // classify gives a missing path and the plugin's own folders no scope; the universe answers
    // them by the rule alone, as it always has (the universe note before it exists is the universe)
    return scopeFor({ path: place.path }, this.plugin.settings, this.plugin.books.scopeLookup(place));
  }

  /** The scope of the active markdown note, or null when none is open. The panel keeps showing its last scope on null. */
  scopeOfActive(): Scope | null {
    const f = this.plugin.app.workspace.getActiveFile();
    return f && f.extension === "md" ? this.scopeOf(f) : null;
  }

  /**
   * The universes in play (universe mode only; [] otherwise): the settings' one first,
   * then every other a work or entry belongs to, by name. Walks the entries and works,
   * so call it when a view opens or its scope changes, not per keystroke.
   */
  universes(): UniverseInfo[] {
    if (this.mode() !== "universe") return [];
    const { vault } = this.plugin.app;
    const own = this.scopeOf(universeNotePath(this.plugin.settings.universeNote));
    const found = new Map<string, UniverseInfo>();
    const add = (scope: Scope, isDefault: boolean) => {
      if (scope.kind !== "universe" || !scope.note || found.has(scope.note)) return;
      const base = scope.note.replace(/\.md$/i, "").split("/").pop() ?? scope.note;
      found.set(scope.note, {
        note: scope.note, name: base, root: scope.root || universeRootOf(scope.note),
        exists: vault.getAbstractFileByPath(scope.note) instanceof TFile, isDefault,
      });
    };
    add(own, true);
    for (const [path] of this.entriesIdx?.entries() ?? []) add(this.scopeOf(path), false);
    for (const [path] of this.plugin.works.list()) add(this.scopeOf(path), false);
    const list = [...found.values()];
    return list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  }

  /**
   * What the panel and the entry note's section read: the answer for an entry ("counting" while
   * the indexes build, null for a note that is not an entry here) and the labels. Null while unloaded.
   */
  appearsInSource(): AppearsInSource | null { return this.source; }

  /**
   * Starts the mentions index if nothing has yet (Q15). The panel calls it when its Works or
   * Entries tab draws; surfaces read "counting" until the first build is done. No-op while unloaded.
   */
  demandMentions(): void { this.mentions?.demand(); }

  /**
   * The unlinked mentions of one note (U 2.5, Q1, Q17), for the panel's section: the places an
   * entry is named and the note links it nowhere. "counting" while the mentions index builds
   * (it is started here); null when the note has no scope here or is an entry itself. The
   * index says when it is safe to answer; the occurrences come from the note's live text with
   * the same matcher the index uses, so a row never points at stale offsets (a write shows at once).
   */
  async unlinkedFor(file: TFile): Promise<UnlinkedRow[] | "counting" | null> {
    const m = this.mentions;
    const f = this.ctxFactory;
    const names = this.namesProvider;
    const idx = this.entriesIdx;
    if (!m || !f || !names || !idx || file.extension !== "md") return null;
    if (this.scopeOf(file).kind === "none" || idx.get(file.path)) return null;
    m.demand();
    if (!m.isReady() || !idx.isReady()) return "counting";
    const text = await this.plugin.notes.text(file).read();
    const md = segment(text);
    const nm = computeMentions(md, (mask) => findNames(mask, names.globalTable()));
    const linked = new Set<string>();
    for (const l of nm.links) {
      const to = this.plugin.app.metadataCache.getFirstLinkpathDest(l.linkpath, file.path)?.path;
      if (to) linked.add(to);
    }
    const ctx = f.ctx(file.path);
    const found = unlinkedIn(nm, linked, { md, inScope: (id) => ctx.candidateInScope(file.path, id) });
    return rowsOf(found, text, (id) => idx.get(id)?.name ?? baseName(id));
  }

  /** The names provider while loaded (the mentions index reads `globalTable()` and the entries' readiness from here). */
  names(): UniverseNamesProvider | null { return this.namesProvider; }

  /** The entry at a path, or undefined when the note isn't an entry (or the mode is off). */
  entry(path: string): Entry | undefined { return this.entriesIdx?.get(path); }

  /** The entries of a scope, by type order then name. Scope none gives []. */
  entries(scope: Scope): Entry[] {
    return entriesIn(this.scopedEntries(), scope);
  }

  /** Every entry with its scope read now, not from the index: it depends on other notes (Q20). */
  private *scopedEntries(): Generator<ScopedEntry> {
    for (const [, e] of this.entriesIdx?.entries() ?? []) yield { ...e, scope: this.scopeOf(e.path) };
  }

  /** The threads of a scope (see ThreadsFeature.threads); [] while open threads are off. */
  threads(scope: Scope, opts: { open?: boolean } = {}): ThreadRef[] {
    return this.plugin.threads.threads(scope, opts);
  }

  /** The threads of one note, in order (open and closed). */
  threadsOf(path: string): ThreadRef[] {
    return this.plugin.threads.threadsOf(path);
  }

  /** When the thread with this text was first seen in the note (ms since epoch), or null. Kept in plugin data, never in the note. */
  firstSeen(path: string, text: string): number | null {
    const ref = this.threadsOf(path).find((r) => r.thread.text === text);
    return ref ? ref.firstSeen : null;
  }

  /** Whether `universe: false` keeps this note out of the universe (its own, or its book note's), by the same rules as scopeOf. */
  keptOut(file: TFile | string): boolean {
    const place = this.plugin.books.classify(file);
    return keptOut(place.path, this.plugin.books.scopeLookup(place), this.plugin.settings);
  }

  /**
   * The works of a scope (a universe, in practice): books and tracked standalone notes
   * with a known stage, entries excluded, with their stage and form (null form = "No form").
   * Group and sort with groupWorks(); count words with plugin.measure; open with ui/open-work.openWork.
   */
  worksIn(scope: Scope): WorkInfo[] {
    if (scope.kind === "none") return [];
    const s = this.plugin.settings;
    const out: WorkInfo[] = [];
    for (const [path, e] of this.plugin.works.list()) {
      if ((e.role !== "book" && e.role !== "note") || e.stage === null) continue;
      if (this.entriesIdx?.get(path)) continue;
      if (!inScope(this.scopeOf(path), scope)) continue;
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      const fm = file instanceof TFile ? this.plugin.books.frontmatter(file) : {};
      out.push({ path, title: e.title, stage: e.stage, form: formFor(path, fm[s.formProperty], s), role: e.role });
    }
    return out;
  }

  /**
   * Closes a thread: rewrites its marker to the closed form (recording `answeredBy`, a
   * link target such as answerLink() gives). Goes through plugin.notes, so it joins the
   * editor's undo when the note is open. Returns false, changing nothing, when the marker
   * moved or changed since `thread` was read (no searching) or it is already closed:
   * tell the writer and refresh the list.
   */
  async closeThread(file: TFile, thread: ThreadMarker, answeredBy?: string): Promise<boolean> {
    const s = this.plugin.settings;
    const r = await this.plugin.notes.text(file).apply(closeThreadPlan(thread, s.threadKeyword, s.threadClosedWord, answeredBy));
    return r.ok;
  }

  /** The inverse of closeThread (same check, same refusal). The answer link stays. */
  async reopenThread(file: TFile, thread: ThreadMarker): Promise<boolean> {
    const s = this.plugin.settings;
    const r = await this.plugin.notes.text(file).apply(reopenThreadPlan(thread, s.threadKeyword, s.threadClosedWord));
    return r.ok;
  }

  /** The link target to record for a note that answers a thread written in `from`: no alias, heading or block. */
  answerLink(target: TFile, from: string): string {
    return this.plugin.app.metadataCache.fileToLinktext(target, from, true);
  }

  /**
   * Creates an entry note and returns it. The folder is the type's folder inside the scope's
   * root (the universe's folder, or the book's folder); the text comes from the type's
   * template ({{title}} = name; a missing template note is treated as none) with the
   * type property, the universe property (universe scope only) and the alias set.
   * Never overwrites: a file already at the path throws CreateEntryError("exists", file).
   * Throws "name" for a name with nothing usable and "scope" for scope none. Not opened.
   */
  async createEntry(o: { name: string; kind: EntryKind; scope: Scope; alias?: string }): Promise<TFile> {
    const p = this.plugin;
    const s = p.settings;
    if (o.scope.kind === "none") throw new CreateEntryError("scope");
    const path = entryPath(o.scope, o.kind, o.name, s.entryTypes);
    if (path === null) throw new CreateEntryError("name");
    const target = normalizePath(path);
    const there = p.app.vault.getAbstractFileByPath(target);
    if (there instanceof TFile) throw new CreateEntryError("exists", there);
    let template: string | null = null;
    const tpl = s.entryTypes[o.kind].template.trim();
    if (tpl !== "") {
      const tf = p.app.vault.getAbstractFileByPath(normalizePath(/\.md$/i.test(tpl) ? tpl : `${tpl}.md`));
      if (tf instanceof TFile) {
        try { template = await p.app.vault.cachedRead(tf); } catch (e) { console.error("Escrita: couldn't read the entry template", e); }
      }
    }
    const uniFile = o.scope.kind === "universe" && o.scope.note ? p.app.vault.getAbstractFileByPath(o.scope.note) : null;
    const universeLink = uniFile instanceof TFile ? p.app.metadataCache.fileToLinktext(uniFile, target, true) : undefined;
    const text = entryText(s, { name: o.name.trim(), kind: o.kind, scope: o.scope, alias: o.alias, universeLink, template, now: new Date() });
    try {
      // never overwrites: a file at the path (or one that differs only in case) stays as it is
      return (await p.notes.create(target, text, { exists: "fail" })).file;
    } catch (e) {
      if (e instanceof NoteExistsError && !e.folder) {
        const there = p.app.vault.getAbstractFileByPath(e.existing);
        throw new CreateEntryError("exists", there instanceof TFile ? there : null);
      }
      throw e;
    }
  }

  /**
   * Creates the universe note (properties `name` and `description`, empty) and its
   * folder, only what is missing. `created` is false when the note was already there.
   */
  async createUniverseNote(): Promise<{ file: TFile; created: boolean }> {
    const p = this.plugin;
    const path = normalizePath(universeNotePath(p.settings.universeNote));
    await p.notes.ensureFolder(universeRootOf(path));
    // only what is missing: a note already there is returned untouched
    const r = await p.notes.create(path, "---\nname:\ndescription:\n---\n", { exists: "return" });
    return { file: r.file, created: r.outcome === "created" };
  }

  /**
   * The panel's "Add to <universe>" click: sets the universe property to a link to the
   * universe note, only when the note has none. Returns whether it wrote. Never called
   * on its own: only on that explicit click.
   */
  async addToUniverse(file: TFile, universe: UniverseInfo): Promise<boolean> {
    const p = this.plugin;
    let wrote = false;
    const uf = p.app.vault.getAbstractFileByPath(universe.note);
    const link = uf instanceof TFile ? p.app.metadataCache.fileToLinktext(uf, file.path, true) : universe.name;
    await p.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const cur = fm[p.settings.universeProperty];
      if (cur !== undefined && cur !== null && cur !== "") return;
      fm[p.settings.universeProperty] = `[[${link}]]`;
      wrote = true;
    });
    return wrote;
  }

  /** "Show open threads": the standalone view when the mode is off, else the panel's Threads tab. */
  async showThreads(): Promise<void> {
    if (this.plugin.features.isOn("universe")) await activateUniverseView(this.plugin, "threads");
    else await activateThreadsView(this.plugin);
  }

  // ------------------------------------------------------------------ wiring

  private appearsInAnswer(path: string): AppearsInAnswer {
    const m = this.mentions;
    const f = this.ctxFactory;
    if (!m || !f || !this.entriesIdx?.get(path) || this.scopeOf(path).kind === "none") return null;
    m.demand();
    if (!m.isReady() || !this.entriesIdx.isReady()) return "counting";
    return m.appearsIn(path, f.ctx(path));
  }

  /** A work's name and form (the form word follows the name, board AppearsIn); other notes by file name. */
  private labels(): AppearsInLabels {
    const p = this.plugin;
    const title = (path: string): string => p.works.get(path)?.title ?? baseName(path);
    return {
      work: (work) => {
        const file = p.app.vault.getAbstractFileByPath(work);
        const fm = file instanceof TFile ? p.books.frontmatter(file) : {};
        const form = formFor(work, fm[p.settings.formProperty], p.settings);
        return { name: title(work), form: form ? t(`universe.appears.form.${form}`) : null };
      },
      note: (path) => (p.works.get(path) ? title(path) : defaultLabels.note(path)),
    };
  }

  /** Ctrl/Cmd-click on an underlined name: its entry opens in a tab, the way a link does. */
  private openEntry(path: string, evt: MouseEvent): void {
    const f = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return;
    void this.plugin.app.workspace.getLeaf(Keymap.isModEvent(evt) ? "tab" : false).openFile(f);
  }

  /** A save only moves scope when the `universe` property changed (finding 1). */
  private metadataChanged(file: TFile, frontmatter: Record<string, unknown> | undefined): void {
    const fm = frontmatter ?? this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    const now = JSON.stringify(fm?.[this.plugin.settings.universeProperty] ?? null);
    const before = this.universeSeen.get(file.path) ?? "null";
    if (now === before) return;
    if (now === "null") this.universeSeen.delete(file.path);
    else this.universeSeen.set(file.path, now);
    this.scopeMoved();
  }

  /** A `universe` property, a note created, deleted or renamed: scope may have moved. Settles for 300 ms. */
  private scopeMoved(): void {
    this.namesProvider?.refreshSoon();
    this.later("scope", SCOPE_MS, () => {
      this.ctxFactory?.reset();
      this.mentions?.scopeChanged();
      this.emit();
    });
  }

  private later(name: string, ms: number, fn: () => void): void {
    const prev = this.later_.get(name);
    if (prev !== undefined) window.clearTimeout(prev);
    this.later_.set(name, window.setTimeout(() => {
      this.later_.delete(name);
      fn();
    }, ms));
  }

  /** Tells the panel and the threads view that something they show changed. */
  emit(): void {
    for (const cb of [...this.listeners]) {
      try { cb(); } catch (e) { console.error("Escrita: a universe listener failed", e); }
    }
  }

  private registerCommands(): void {
    const p = this.plugin;
    this.ctx.command({
      id: "open-universe",
      name: t("universe.cmd.open"),
      callback: () => { void activateUniverseView(p); },
    });
    this.ctx.command({
      id: "create-entry",
      name: t("universe.cmd.createEntry"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!inSource(ctx)) return false;
        if (!checking) createEntryFromSelection(p, editor, ctx.file);
        return true;
      },
    });
    this.ctx.command({
      id: "move-book-entries",
      name: t("universe.cmd.migrate"),
      callback: () => { migrateActiveBook(p, p.app.workspace.getActiveFile()); },
    });
  }

  private registerMenus(): void {
    const p = this.plugin;
    this.registerEvent(p.app.workspace.on("editor-menu", (menu, editor, info) => addUniverseEditorMenuItems(p, menu, editor, info)));
    this.registerEvent(p.app.workspace.on("file-menu", (menu, file) => {
      if (this.mode() === "universe") addMigrateFileMenuItem(p, menu, file);
    }));
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { universeSettingsSection(el, ui, this.plugin); }
}
