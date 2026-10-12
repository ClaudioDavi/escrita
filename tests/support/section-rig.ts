// A rig for tests that draw one module's settings section with the `Setting` stub
// (tests/support/obsidian.ts records every row): settings, a plugin with books and features, and
// a fake `ui` that records each committed text field, so a test can type into it.
// Shared by the snapshots, explorer, universe and plugin-folder tests. The PLAN-1.0.3 Wave 1
// tasks leave it as it is; a port that needs a different rig copies it into its own test.

import { vi } from "vitest";
import type { SettingsUi } from "../../src/core/module-context";
import { DEFAULT_SETTINGS, defaultsFor, type EscritaSettings } from "../../src/settings";
import { settingLog } from "./obsidian";

export type Commit = { fallback: () => string; apply: (v: string) => void };

export function rig(over: Partial<EscritaSettings> = {}, on: string[] = ["universe", "threads"]) {
  const settings = { ...DEFAULT_SETTINGS, stages: structuredClone(DEFAULT_SETTINGS.stages), entryTypes: structuredClone(DEFAULT_SETTINGS.entryTypes), ...over } as EscritaSettings;
  const commits: Commit[] = [];
  const save = vi.fn(async () => {});
  const ui = {
    app: { vault: { configDir: ".obsidian", getMarkdownFiles: () => [] } },
    save,
    defaults: () => defaultsFor(settings.defaultsLanguage),
    saveOnCommit: (_c: unknown, fallback: () => string, apply: (v: string) => void) => { commits.push({ fallback, apply }); },
    redraw: () => {},
    num: (v: string, fb: number, min = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? fb : Math.max(min, n); },
  } as unknown as SettingsUi;
  const plugin = {
    settings, books: { allBooks: () => [], allBooksEverywhere: () => [] },
    features: { isOn: (id: string) => on.includes(id) },
  };
  return { settings, commits, save, ui, plugin: plugin as never, el: document.createElement("div") };
}

/** A pt-BR install: the pt-BR default set, then `over`. */
export const ptRig = (over: Partial<EscritaSettings> = {}, on?: string[]) => rig({ ...defaultsFor("pt-BR"), defaultsLanguage: "pt-BR", ...over }, on);

/** The names of the rows drawn since the last `resetSettingLog()`. */
export const names = (): string[] => settingLog.map((r) => r.name);
