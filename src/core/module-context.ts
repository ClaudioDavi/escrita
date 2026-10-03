// What a module may register on the plugin, and the base class of a switchable
// feature (0.7 plan Q1-Q7). Types are filled; class bodies are stubs until 1.1.

import { Component, type Command, type MarkdownPostProcessor, type MarkdownPostProcessorContext, type ViewCreator } from "obsidian";
import type { Extension } from "@codemirror/state";
import type { FeatureId } from "./features";
import type { Follower, IndexFile, IndexSpec, VaultIndex } from "./vault-index";
import type { DecorationId, Drawer } from "./explorer-decorations";

/** A code block processor: what `registerMarkdownCodeBlockProcessor` takes. */
export type CodeBlockHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;

/** What a module registers on the plugin for its whole life, read in init() even when it is off (Q3). */
export interface FeatureSlots {
  views?: readonly string[];          // view types
  codeBlocks?: readonly string[];     // code block languages
  postProcessor?: boolean;            // one Reading-view post-processor (Q34)
  editors?: number;                   // how many extension slots
}

/** The module calls updateOptions after a mid-session set. */
export interface EditorSlot { set(exts: readonly Extension[]): void }

export interface ModuleContext {
  command(cmd: Command): void;                                   // raw id recorded before addCommand; removed on unload (Q2, G0a)
  /** G0f: null (nothing added) when the feature is off at startup; turned off at runtime, the icon stays until restart and its click shows that the feature is off. */
  ribbon(icon: string, title: string, cb: (e: MouseEvent) => void): HTMLElement | null;
  statusBar(): HTMLElement;                                      // el.remove() on unload; on mobile the element is detached (obsidian.d.ts:4941-4947)
  view(type: string, create: ViewCreator): void;                 // binds a declared slot (Q3); throws for an undeclared type; leaves detached on unload
  editor(initial?: readonly Extension[]): EditorSlot;            // takes the next declared slot (Q4); emptied on unload
  codeBlock(lang: string, handler: CodeBlockHandler): void;      // binds a declared slot (Q5)
  postProcessor(fn: MarkdownPostProcessor): void;                // binds the declared slot (Q5, Q34); a no-op while off
  index<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V>;  // disposed and removed on unload (Q7)
  follow(f: Follower): void;                                     // removed on unload
  decorate(id: DecorationId, draw: Drawer): void;                // undrawn on unload
  onLayoutReady(cb: () => void): void;                           // never runs after unload
}

/**
 * A switchable part of Escrita. Constructed once; the registry calls Component.load()
 * and unload() itself, in order (Q6). Subclasses implement onload/onunload, never
 * load/unload.
 */
export abstract class FeatureModule extends Component {
  abstract readonly id: FeatureId;
  readonly slots: FeatureSlots = {};
  protected ctx!: ModuleContext;

  /** Called by the registry before each load. */
  attach(ctx: ModuleContext): void {
    throw new Error("todo");
  }

  settingsChanged?(): void;

  /** Followers that keep this feature's path-keyed data current even while it is off (Q8). Touch only plugin.data and plugin.settings. */
  dataFollowers?(): Follower[];
}
