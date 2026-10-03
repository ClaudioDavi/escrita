// One fake plugin for every lifecycle test: the services a module reaches through
// `plugin`, plus a recording `app.workspace` and the Plugin-only registration calls
// (commands, ribbon, status bar, views, editor extensions, code blocks). Obsidian's
// rules are kept where a test depends on them: addCommand prefixes the id on the
// object it is given (G0a), a second registerView for one type throws (G0b), a
// ribbon icon is keyed by title and stays (G0f).

import { Component } from "obsidian";
import type { Command, MarkdownPostProcessor } from "obsidian";
import type { Extension } from "@codemirror/state";
import { DEFAULT_SETTINGS, type EscritaSettings } from "../../src/settings";
import type { EscritaData } from "../../src/data";
import { NamesPort } from "../../src/core/names-source";
import type { Follower } from "../../src/core/vault-index";
import type { DecorationId, Drawer } from "../../src/core/explorer-decorations";
import type EscritaPlugin from "../../src/main";

export interface FakeIndexHandle { disposed: boolean; spec: { name: string }; dispose(): void }

export class FakeWorkspace {
  ready = false;
  private pending: (() => void)[] = [];
  updateOptionsCalls = 0;
  detached: string[] = [];
  /** leaves of a view type, by type; tests push into it */
  leaves = new Map<string, { id: number }[]>();
  get layoutReady(): boolean { return this.ready; }
  onLayoutReady(cb: () => void): void {
    if (this.ready) cb();
    else this.pending.push(cb);
  }
  /** Layout ready: runs what was queued, in order. */
  fireLayoutReady(): void {
    this.ready = true;
    const q = this.pending.splice(0);
    for (const cb of q) cb();
  }
  updateOptions(): void { this.updateOptionsCalls++; }
  getLeavesOfType(type: string): { id: number }[] { return this.leaves.get(type) ?? []; }
  detachLeavesOfType(type: string): void {
    this.detached.push(type);
    this.leaves.delete(type);
  }
  on(): { off(): void } { return { off() {} }; }
  getActiveFile(): null { return null; }
}

export class FakePlugin extends Component {
  settings: EscritaSettings = structuredClone(DEFAULT_SETTINGS);
  data = {
    version: 1, history: {}, publish: {}, leftOff: {}, lensDismissed: {}, threadSeen: {}, povColors: {},
  } as unknown as EscritaData;
  names = new NamesPort();
  app = { workspace: new FakeWorkspace(), vault: {}, metadataCache: {} };

  // services a module may touch; tests overwrite what they use
  books = {} as unknown;
  measure = {} as unknown;
  works = {} as unknown;
  notes = {} as unknown;
  features: unknown = undefined;
  requestSave = Object.assign(() => {}, { cancel: () => {} });
  saves = 0;
  saveSettingsHook: (() => void) | null = null;
  async saveSettings(): Promise<void> {
    this.saves++;
    this.saveSettingsHook?.();
  }

  // the index shell
  indexAdded: FakeIndexHandle[] = [];
  indexRemoved: FakeIndexHandle[] = [];
  followers = new Set<Follower>();
  index = {
    add: (spec: { name: string }): FakeIndexHandle => {
      const h: FakeIndexHandle = { disposed: false, spec, dispose() { this.disposed = true; } };
      this.indexAdded.push(h);
      return h;
    },
    remove: (h: FakeIndexHandle): void => { h.dispose(); this.indexRemoved.push(h); },
    follow: (f: Follower): (() => void) => { this.followers.add(f); return () => { this.followers.delete(f); }; },
    rebuild: (): void => {},
    settingsChanged: (): void => {},
    unload: (): void => {},
  };

  // decorations
  drawn = new Map<DecorationId, Drawer>();
  decorations = {
    add: (id: DecorationId, draw: Drawer): (() => void) => {
      this.drawn.set(id, draw);
      return () => { if (this.drawn.get(id) === draw) this.drawn.delete(id); };
    },
    clear: (): void => {},
    refresh: (): void => {},
  };

  // Plugin-only registration
  commands = new Map<string, Command>();
  commandLog: string[] = [];
  addCommand(cmd: Command): Command {
    cmd.id = `escrita:${cmd.id}`;
    cmd.name = `Escrita: ${cmd.name}`;
    this.commands.set(cmd.id, cmd);
    this.commandLog.push(`add ${cmd.id}`);
    return cmd;
  }
  removeCommand(id: string): void {
    this.commands.delete(`escrita:${id}`);
    this.commandLog.push(`remove ${id}`);
  }

  ribbon = new Map<string, { icon: string; title: string; el: HTMLElement; cb: (e: MouseEvent) => void }>();
  ribbonAdds: string[] = [];
  addRibbonIcon(icon: string, title: string, cb: (e: MouseEvent) => void): HTMLElement {
    this.ribbonAdds.push(title);
    const known = this.ribbon.get(title);
    const el = known?.el ?? document.createElement("div");
    this.ribbon.set(title, { icon, title, el, cb });
    return el;
  }
  /** What a click on the ribbon icon does. */
  clickRibbon(title: string): void { this.ribbon.get(title)?.cb(new MouseEvent("click")); }

  statusBars: HTMLElement[] = [];
  addStatusBarItem(): HTMLElement {
    const el = document.createElement("div");
    document.body.appendChild(el);
    this.statusBars.push(el);
    return el;
  }

  views = new Map<string, (leaf: unknown) => unknown>();
  registerView(type: string, creator: (leaf: unknown) => unknown): void {
    if (this.views.has(type)) throw new Error(`Attempting to register an existing view type "${type}"`);
    this.views.set(type, creator);
  }
  extensions: Extension[] = [];
  registerEditorExtension(ext: Extension): void { this.extensions.push(ext); }
  codeBlocks = new Map<string, (source: string, el: HTMLElement, ctx: unknown) => unknown>();
  registerMarkdownCodeBlockProcessor(lang: string, h: (source: string, el: HTMLElement, ctx: unknown) => unknown): void {
    this.codeBlocks.set(lang, h);
  }
  postProcessors: MarkdownPostProcessor[] = [];
  registerMarkdownPostProcessor(fn: MarkdownPostProcessor): MarkdownPostProcessor {
    this.postProcessors.push(fn);
    return fn;
  }

  /** The plugin as the code under test sees it. */
  get asPlugin(): EscritaPlugin { return this as unknown as EscritaPlugin; }
}

export function fakePlugin(): FakePlugin {
  return new FakePlugin();
}
