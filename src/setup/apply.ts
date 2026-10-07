import { Notice } from "obsidian";
import type EscritaPlugin from "../main";
import { plural, t } from "../i18n";
import { isMade } from "./model";
import { applyLayout, openHomeNote } from "./layout";
import { runSetup, type RunPorts, type RunResult, type SettingsPatch } from "./run";
import type { SetupItem, SetupTicks } from "./plan";

/** A value from the plan, copied so the live settings never share a frozen set's objects. */
function copy(v: unknown): unknown {
  return v && typeof v === "object" ? (JSON.parse(JSON.stringify(v)) as unknown) : v;
}

/** Writes the patch into the live settings and saves once (the registry applies the features). */
async function saveSettings(plugin: EscritaPlugin, patch: SettingsPatch): Promise<void> {
  const settings = plugin.settings as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch.values)) if (key in settings) settings[key] = copy(value);
  // the features row without its `universeMode`: the "Shared world" answer is its own item
  if (patch.features) {
    plugin.settings.features = { ...patch.features.features };
    plugin.settings.explorerCounts = patch.features.explorerCounts;
    plugin.settings.spellcheckOnDemand = patch.features.spellcheckOnDemand;
  }
  await plugin.saveSettings();
}

/** Opens the home note when the layout didn't run (the layout's own rule: never over a writer's tab). */
async function openHome(plugin: EscritaPlugin): Promise<boolean> {
  try {
    return await openHomeNote(plugin);
  } catch (e) {
    console.error("Escrita: could not open the home note", e);
    return false;
  }
}

/** The one notice that says what was made and what wasn't (board 36 c). */
export function outcomeMessage(r: RunResult, homeOpen: boolean): string {
  const items = r.made.filter(isMade).length;
  const settings = r.made.filter((i) => i.kind === "setting" || i.kind === "features").length;
  const failedFiles = r.failed.filter((f) => isMade(f.item));
  const layoutFailed = r.failed.find((f) => f.item.kind === "layout");
  const saveFailed = r.failed.find((f) => f.item.kind === "setting" || f.item.kind === "features");
  let text: string;
  if (failedFiles.length > 0) {
    const first = failedFiles[0];
    text = t("setup.done.partial", { made: items, total: r.total, path: first.item.target, error: first.error });
    if (failedFiles.length > 1) text += t("setup.done.more", { n: failedFiles.length - 1 });
    if (r.settingsSkipped) text += t("setup.done.settingsSkipped");
    text += t("setup.done.kept");
  } else {
    text = t("setup.done.ok", { items: plural("setup.summary.items", items), settings: plural("setup.summary.settings", settings) });
    if (saveFailed) text += t("setup.done.saveFailed", { error: saveFailed.error });
    if (homeOpen) text += t("setup.done.home");
  }
  if (layoutFailed) text += t("setup.done.layoutFailed", { error: layoutFailed.error });
  return text;
}

/** Runs the ticked items for the writer: every file through `notes.create`, settings last, then the layout and the notice. */
export async function performSetup(plugin: EscritaPlugin, plan: readonly SetupItem[], ticks: SetupTicks): Promise<RunResult> {
  const ports: RunPorts = {
    ensureFolder: (path) => plugin.notes.ensureFolder(path),
    createNote: async (path, content) => (await plugin.notes.create(path, content, { exists: "return" })).outcome === "created" ? "created" : "existing",
    saveSettings: (patch) => saveSettings(plugin, patch),
    layout: (layout) => applyLayout(plugin, layout),
  };
  const result = await runSetup(plan, ticks, ports);
  const layoutRan = result.made.some((i) => i.kind === "layout");
  const homeMade = result.made.some((i) => i.kind === "home" || (i.kind === "setting" && i.target === "homeNote"));
  // The layout opens the home note itself; without it the setup does, so "the home note is open" holds.
  const homeOpen = layoutRan ? homeMade : homeMade && await openHome(plugin);
  const failed = result.failed.length > 0;
  new Notice(outcomeMessage(result, homeOpen), failed ? 12000 : 6000);
  return result;
}
