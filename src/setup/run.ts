// The setup's run (1.0, task 2.2; board 36 c): executes the plan's ticked items in order,
// folders, examples, the home note, then the settings (only if every folder exists), then
// the layout. A failure is recorded and the run goes on; nothing is undone. Pure: the
// Obsidian side comes in as `RunPorts`, so the order and the failure rules are tested.

import type { FeatureSwitches } from "../core/features";
import { isMade, isSetting } from "./model";
import { itemsToRun, type SetupItem, type SetupLayout, type SetupOutcome, type SetupTicks } from "./plan";

export interface RunPorts {
  /** a folder, with any missing parents; throws when a segment is a file */
  ensureFolder(path: string): Promise<void>;
  /** a note through `notes.create` with `exists: "return"`: "existing" when something was already there */
  createNote(path: string, content: string): Promise<"created" | "existing">;
  /** writes the settings patch and saves once (features applied); the last write before the layout */
  saveSettings(patch: SettingsPatch): Promise<void>;
  /** the layout item (task 2.3's `applyLayout`) */
  layout(layout: SetupLayout): Promise<void>;
}

/** What the settings write changes: plain keys, and the features row split into its three switches. */
export interface SettingsPatch {
  values: Record<string, unknown>;
  /** the features row without its `universeMode` (Wave 1b: the `universeMode` item is the writer's own answer) */
  features?: Pick<FeatureSwitches, "features" | "explorerCounts" | "spellcheckOnDemand">;
}

export interface RunResult extends SetupOutcome {
  /** the settings were not written because a folder is missing (or the save failed) */
  settingsSkipped: boolean;
  /** the items of the run that make files or folders, made or not: the "of 5" of "Created 4 of 5" */
  total: number;
}

/** The patch the ticked setting items make. */
export function settingsPatch(items: readonly SetupItem[]): SettingsPatch {
  const patch: SettingsPatch = { values: {} };
  for (const i of items) {
    if (i.kind === "setting") patch.values[i.target] = i.value;
    else if (i.kind === "features") {
      const v = i.value as FeatureSwitches;
      patch.features = { features: { ...v.features }, explorerCounts: v.explorerCounts, spellcheckOnDemand: v.spellcheckOnDemand };
    }
  }
  return patch;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Runs the ticked items of `plan`. Never throws. */
export async function runSetup(plan: readonly SetupItem[], ticks: SetupTicks, ports: RunPorts): Promise<RunResult> {
  const run = itemsToRun(plan, ticks);
  const result: RunResult = {
    made: [],
    failed: [],
    skipped: plan.filter((i) => !run.includes(i)),
    settingsSkipped: false,
    total: run.filter(isMade).length,
  };
  let folderFailed = false;

  for (const item of run.filter(isMade)) {
    try {
      // A folder, or an example folder (a book, its chapters folder): no content. A note carries its text.
      if (item.content === undefined) {
        await ports.ensureFolder(item.target);
        result.made.push(item);
      } else if (await ports.createNote(item.target, item.content) === "created") {
        result.made.push(item);
      } else {
        // something appeared since the preview: used as it is, never overwritten
        result.skipped.push(item);
        result.total -= 1;
      }
    } catch (e) {
      result.failed.push({ item, error: message(e) });
      if (item.kind === "folder") folderFailed = true;
    }
  }

  const settings = run.filter(isSetting);
  if (settings.length > 0) {
    if (folderFailed) {
      result.settingsSkipped = true;
      result.skipped.push(...settings);
    } else {
      try {
        await ports.saveSettings(settingsPatch(settings));
        result.made.push(...settings);
      } catch (e) {
        result.settingsSkipped = true;
        result.failed.push({ item: settings[0], error: message(e) });
      }
    }
  }

  const layout = run.find((i) => i.kind === "layout");
  if (layout) {
    try {
      await ports.layout(layout.value as SetupLayout);
      result.made.push(layout);
    } catch (e) {
      result.failed.push({ item: layout, error: message(e) });
    }
  }
  return result;
}
