// The universe module (ROADMAP-universe "Modes", 1.1, 1.3, 1.5). It owns:
//   * the entries index   (notes whose type property names an entry type)
//   * the threads index   (every note's thread markers, in every mode)
//   * the first-seen store (when each thread was first seen, in plugin data)
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
// Mode off: the panel's view type stays registered (Obsidian can't unregister a view)
// but its leaves are closed and every universe command hides itself; threads still work
// (command "Show open threads" opens the standalone threads view).

import { MarkdownView, TFile, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import { t } from "../i18n";
import { closeThreadPlan, reopenThreadPlan, type ThreadMarker } from "../core/markers";
import type { VaultIndex } from "../core/vault-index";
import { entriesIn, entriesSpec, type Entry } from "./entries";
import { dropSeen, pruneSeen, recordSeen, renameSeen } from "./first-seen";
import { entryPath, entryText } from "./new-entry";
import { linkText, scopeFor, universeNotePath, universeRootOf, type Scope, type ScopeLookup } from "./scope";
import type { EntryKind, UniverseMode } from "./settings";
import { collectThreads, inScope, threadsSpec, type NoteThreads, type ThreadRef } from "./threads";
import { formFor, type WorkInfo } from "./works-list";
import { addEditorMenuItems, closeThreadAtCursor, createEntryFromSelection, plantThread, threadAtCursor, threadMarkerExtension } from "./create";
import { addMigrateFileMenuItem, migrateActiveBook } from "./migrate";
import { THREADS_VIEW, ThreadsView, UNIVERSE_VIEW, UniverseView, activateThreadsView, activateUniverseView } from "./view";

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

const NONE: Scope = { kind: "none", root: "", note: null };

export class UniverseModule implements EscritaModule {
  private entriesIdx: VaultIndex<TFile, Entry> | null = null;
  private threadsIdx: VaultIndex<TFile, NoteThreads> | null = null;
  private listeners = new Set<() => void>();
  private lastMode: UniverseMode | null = null;

  constructor(private plugin: EscritaPlugin) {}

  load(): void {
    const p = this.plugin;
    this.entriesIdx = p.index.add<TFile, Entry>(entriesSpec<TFile>({
      settings: () => p.settings,
      frontmatter: (f) => p.books.frontmatter(f),
      scope: (f) => this.scopeOf(f),
    }));
    this.threadsIdx = p.index.add<TFile, NoteThreads>(threadsSpec<TFile>(() => p.settings));

    const entries = this.entriesIdx;
    const threads = this.threadsIdx;
    p.register(entries.onChange(() => this.emit()));
    p.register(entries.onReady(() => this.emit()));
    p.register(threads.onReady(() => { this.recordAll(); this.emit(); }));
    p.register(threads.onChange((changes) => {
      let dirty = false;
      for (const c of changes) {
        if (c.after && recordSeen(p.data.threadSeen, c.path, c.after.map((x) => x.text), Date.now())) dirty = true;
      }
      if (dirty) p.requestSave();
      this.emit();
    }));

    // first-seen dates follow renames and go with deleted notes (index.follow runs before the indexes' own events)
    p.register(p.index.follow({
      moved: (oldPath, newPath) => { if (renameSeen(p.data.threadSeen, oldPath, newPath)) p.requestSave(); },
      deleted: (path) => { if (dropSeen(p.data.threadSeen, path)) p.requestSave(); },
    }));
    p.app.workspace.onLayoutReady(() => {
      const exists = (path: string) => p.app.vault.getAbstractFileByPath(path) !== null;
      if (pruneSeen(p.data.threadSeen, exists)) p.requestSave();
    });

    p.registerView(UNIVERSE_VIEW, (leaf) => new UniverseView(leaf, p));
    p.registerView(THREADS_VIEW, (leaf) => new ThreadsView(leaf, p));
    p.registerEditorExtension(threadMarkerExtension(p));
    this.registerCommands();
    this.registerMenus();
    this.syncMode();
  }

  settingsChanged(): void {
    this.syncMode();
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

  /** Whether both indexes finished their first build (lists may be partial before). */
  isReady(): boolean {
    return !!this.entriesIdx?.isReady() && !!this.threadsIdx?.isReady();
  }

  /** The scope of a note (kind none / book / universe, with its root folder and naming note), per scopeFor and the current mode. */
  scopeOf(file: TFile | string): Scope {
    const path = typeof file === "string" ? file : file.path;
    return scopeFor({ path }, this.plugin.settings, this.lookup());
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

  /** The entry at a path, or undefined when the note isn't an entry (or the mode is off). */
  entry(path: string): Entry | undefined { return this.entriesIdx?.get(path); }

  /** The entries of a scope, by type order then name. Scope none gives []. */
  entries(scope: Scope): Entry[] {
    // the scope is read now, not from the index: it depends on other notes (a book note's `universe` property)
    const live = (function* (self: UniverseModule) {
      for (const [, e] of self.entriesIdx?.entries() ?? []) yield { ...e, scope: self.scopeOf(e.path) };
    })(this);
    return entriesIn(live, scope);
  }

  /**
   * The threads of a scope (open and closed; `{ open: true }` drops the closed), by note
   * path then position. Scope kind none means the tracked works (mode off, or a note
   * outside any book in per-book mode); book and universe scopes cover every note of
   * that book or universe, entries included. Each ref carries its first-seen time (ms).
   */
  threads(scope: Scope, opts: { open?: boolean } = {}): ThreadRef[] {
    const all = this.threadsIdx?.entries() ?? [];
    const belongs = scope.kind === "none"
      ? (path: string) => this.plugin.books.classify(path).tracked
      : (path: string) => inScope(this.scopeOf(path), scope);
    return collectThreads(all, belongs, this.plugin.data.threadSeen, opts.open === true);
  }

  /** The threads of one note, in order (open and closed). */
  threadsOf(path: string): ThreadRef[] {
    return collectThreads(this.threadsIdx?.entries() ?? [], (p) => p === path, this.plugin.data.threadSeen);
  }

  /** When the thread with this text was first seen in the note (ms since epoch), or null. Kept in plugin data, never in the note. */
  firstSeen(path: string, text: string): number | null {
    const ref = this.threadsOf(path).find((r) => r.thread.text === text);
    return ref ? ref.firstSeen : null;
  }

  /**
   * The works of a scope (a universe, in practice): books and tracked standalone notes
   * with a known stage, entries excluded, with their stage and form (null form = "No form").
   * Group and sort with groupWorks(); count words with plugin.measure; open with desk/open.openWork.
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
    await p.notes.ensureFolder(target.slice(0, target.lastIndexOf("/")));
    const uniFile = o.scope.kind === "universe" && o.scope.note ? p.app.vault.getAbstractFileByPath(o.scope.note) : null;
    const universeLink = uniFile instanceof TFile ? p.app.metadataCache.fileToLinktext(uniFile, target, true) : undefined;
    const text = entryText(s, { name: o.name.trim(), kind: o.kind, scope: o.scope, alias: o.alias, universeLink, template, now: new Date() });
    try {
      return await p.app.vault.create(target, text);
    } catch (e) {
      const raced = p.app.vault.getAbstractFileByPath(target);
      if (raced instanceof TFile) throw new CreateEntryError("exists", raced);
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
    const there = p.app.vault.getAbstractFileByPath(path);
    if (there instanceof TFile) return { file: there, created: false };
    const slash = path.lastIndexOf("/");
    if (slash > 0) await p.notes.ensureFolder(path.slice(0, slash));
    return { file: await p.app.vault.create(path, "---\nname:\ndescription:\n---\n"), created: true };
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
    if (this.enabled()) await activateUniverseView(this.plugin, "threads");
    else await activateThreadsView(this.plugin);
  }

  // ------------------------------------------------------------------ wiring

  private lookup(): ScopeLookup {
    const { metadataCache, vault } = this.plugin.app;
    const prop = this.plugin.settings.universeProperty;
    return {
      book: (path) => {
        const b = this.plugin.books.classify(path).book;
        return b ? { note: b.note.path, folder: b.folder.path } : null;
      },
      universe: (path) => {
        const f = vault.getAbstractFileByPath(path);
        return f instanceof TFile ? metadataCache.getFileCache(f)?.frontmatter?.[prop] : undefined;
      },
      resolve: (link, from) => metadataCache.getFirstLinkpathDest(linkText(link) ?? link, from)?.path ?? null,
    };
  }

  private recordAll(): void {
    const p = this.plugin;
    let dirty = false;
    for (const [path, list] of this.threadsIdx?.entries() ?? []) {
      if (recordSeen(p.data.threadSeen, path, list.map((x) => x.text), Date.now())) dirty = true;
    }
    if (dirty) p.requestSave();
  }

  private emit(): void {
    for (const cb of [...this.listeners]) {
      try { cb(); } catch (e) { console.error("Escrita: a universe listener failed", e); }
    }
  }

  /** Mode off closes the panel; the commands check the mode themselves, so nothing else changes. */
  private syncMode(): void {
    const mode = this.mode();
    if (mode === "off" && this.lastMode !== "off") {
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(UNIVERSE_VIEW)) leaf.detach();
    }
    this.lastMode = mode;
  }

  private registerCommands(): void {
    const p = this.plugin;
    p.addCommand({
      id: "open-universe",
      name: t("universe.cmd.open"),
      checkCallback: (checking) => {
        if (!this.enabled()) return false;
        if (!checking) void activateUniverseView(p);
        return true;
      },
    });
    p.addCommand({
      id: "show-threads",
      name: t("universe.cmd.showThreads"),
      callback: () => { void this.showThreads(); },
    });
    p.addCommand({
      id: "plant-thread",
      name: t("universe.cmd.plantThread"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!inSource(ctx)) return false;
        if (!checking) plantThread(p, editor);
        return true;
      },
    });
    p.addCommand({
      id: "create-entry",
      name: t("universe.cmd.createEntry"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!this.enabled() || !inSource(ctx)) return false;
        if (!checking) createEntryFromSelection(p, editor, ctx.file);
        return true;
      },
    });
    p.addCommand({
      id: "close-thread",
      name: t("universe.cmd.closeThread"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!inSource(ctx) || !ctx.file) return false;
        const thread = threadAtCursor(p, editor);
        if (!thread || thread.closed) return false;
        if (!checking) closeThreadAtCursor(p, editor, ctx.file, thread);
        return true;
      },
    });
    p.addCommand({
      id: "move-book-entries",
      name: t("universe.cmd.migrate"),
      checkCallback: (checking) => {
        if (!this.enabled()) return false;
        if (!checking) migrateActiveBook(p, p.app.workspace.getActiveFile());
        return true;
      },
    });
  }

  private registerMenus(): void {
    const p = this.plugin;
    p.registerEvent(p.app.workspace.on("editor-menu", (menu, editor, info) => addEditorMenuItems(p, menu, editor, info)));
    p.registerEvent(p.app.workspace.on("file-menu", (menu, file) => {
      if (this.mode() === "universe") addMigrateFileMenuItem(p, menu, file);
    }));
  }
}

/** The command runs in the editor (Live Preview or Source), not Reading view. */
function inSource(ctx: unknown): ctx is MarkdownView & { file: TFile } {
  return ctx instanceof MarkdownView && ctx.getMode() === "source";
}


