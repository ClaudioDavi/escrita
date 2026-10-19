// The screenplay editor (1.2, SP 2, PLAN-1.2): in a note whose form is `screenplay`, Live Preview
// shows the script laid out as on the page (layout.ts), Tab and Enter do what they do in a
// screenwriting program (keys.ts), and typing a cue, a location or a time offers what the script
// and the universe already know (suggest.ts). It acts only in screenplay notes and changes no text
// without a key press; Source mode and every other note stay as they are.

import { MarkdownView } from "obsidian";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type EscritaPlugin from "../main";
import { FeatureModule, type SettingsUi } from "../core/module-context";
import { fountainOptions, type FountainOptions } from "../core/fountain";
import type { SettingsBlock } from "../ui/settings-rows";
import { cmOf, fileOfState } from "../ui/editor-glue";
import { t } from "../i18n";
import { ScreenplayLayout } from "./layout";
import { ScreenplayKeys } from "./keys";
import { ScreenplaySuggest } from "./suggest";
import { screenplaySettingsItems } from "./settings-ui";
import type { ScriptKey } from "../core/screenplay-keys";

export class ScreenplayModule extends FeatureModule {
  readonly id = "screenplay" as const;
  readonly slots = { editors: 1 };
  private opts: FountainOptions;
  private optsKey: string;
  private layout: ScreenplayLayout;
  private keys: ScreenplayKeys;
  private suggest: ScreenplaySuggest | null = null;

  constructor(private plugin: EscritaPlugin) {
    super();
    this.optsKey = this.keyOfOptions();
    this.opts = fountainOptions(plugin.settings);
    const isScreenplay = (state: EditorState) => {
      const file = fileOfState(state);
      return file !== null && plugin.books.classify(file).form === "screenplay";
    };
    // one options object until the words change, so the per-version cache of the parse holds
    const opts = () => this.opts;
    this.keys = new ScreenplayKeys({ isScreenplay, opts });
    this.layout = new ScreenplayLayout({
      isScreenplay, opts, font: () => plugin.settings.screenplayFont, modes: (state) => this.keys.modesOf(state),
    });
  }

  /** Is the module's suggest still answering? (tests) */
  get suggestEnabled(): boolean { return this.suggest?.enabled ?? false; }

  onload(): void {
    const p = this.plugin;
    this.readOptions();
    this.ctx.editor([this.layout.extension, this.keys.extension]);

    if (!this.suggest) {
      this.suggest = new ScreenplaySuggest(p.app, {
        isScreenplay: (file) => p.books.classify(file).form === "screenplay",
        opts: () => this.opts,
        times: () => this.timesOf(),
        names: (path) => p.names.tableFor(path),
      });
    }
    this.suggest.enabled = true;
    this.ctx.suggest(this.suggest);

    // Tab and Shift-Tab for a phone, which has none (no default hotkeys: rule 8)
    for (const [id, name, key] of [
      ["screenplay-next-element", "screenplay.cmd.next", "Tab"],
      ["screenplay-previous-element", "screenplay.cmd.previous", "Shift-Tab"],
    ] as const) {
      this.ctx.command({
        id,
        name: t(name),
        editorCheckCallback: (checking, editor, view) => {
          if (!(view instanceof MarkdownView) || !view.file || p.books.classify(view.file).form !== "screenplay") return false;
          const cm = cmOf(editor);
          if (!cm) return false;
          if (!checking) this.step(cm, key);
          return true;
        },
      });
    }

    // a note's form is a property: when it changes the layout turns on or off for that editor
    this.registerEvent(p.app.metadataCache.on("changed", () => this.layout.refresh()));
  }

  onunload(): void {
    this.suggest?.disable();
  }

  settingsChanged(): void {
    this.readOptions();
    this.layout.refresh();
  }

  settingsItems(ui: SettingsUi): SettingsBlock[] { return screenplaySettingsItems(ui, this.plugin); }

  private step(cm: EditorView, key: ScriptKey): void {
    this.keys.run(cm, key);
  }

  private keyOfOptions(): string {
    const s = this.plugin.settings;
    return `${s.screenplaySceneHeadings}\u0000${s.screenplayTransitions}`;
  }

  private readOptions(): void {
    const key = this.keyOfOptions();
    if (key === this.optsKey) return;
    this.optsKey = key;
    this.opts = fountainOptions(this.plugin.settings);
  }

  private timesOf(): string[] {
    return this.plugin.settings.screenplayTimes.split(/[,\n]/).map((x) => x.trim()).filter((x) => x !== "");
  }
}
