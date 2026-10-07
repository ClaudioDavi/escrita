// The example notes "Set up a writing vault" creates (1.0, SF 10; PLAN-1.0 Q3, boards 35-37).
// Pure, no Obsidian imports. Task 2.1 owns this file and writes the texts; the seam (Wave 2)
// fixes the API that setup/plan.ts reads, so the plan and the run never wait on it.
//
// What the examples are (Q3, board 35): one conto (two beats, a placeholder, a target of
// 2,000 words) and one book (its book note and two chapters in its chapters folder, one with
// prose and one with beats only). Every example carries `example: true` in its properties
// and its name starts with `SETUP_NAMES[lang].examplePrefix`, so it is safe to delete. The
// names of the conto, the book and its folder are `SETUP_NAMES` (core/defaults.ts); the
// chapter file names are `EXAMPLE_CHAPTERS` below. The plan places every example and never
// plans one over an existing path; the run writes them through `notes.create` with
// `exists: "return"`.
//
// Done when (task 2.1): the conto classifies as a piece with a target, the book note as a
// book note and each chapter as a chapter of it (with the settings in `ExampleContext`);
// beats, a placeholder and a target in each; `en` and `pt-BR`.

import type { EscritaSettings } from "../settings";
import type { DefaultsLanguage } from "../core/defaults";

/** Which example a text is for. `index` is the chapter's place in `EXAMPLE_CHAPTERS[lang]`, from 0. */
export type ExampleRole =
  | { kind: "story" }
  | { kind: "bookNote" }
  | { kind: "chapter"; index: number };

/** What an example's text depends on. */
export interface ExampleContext {
  /** the language of the prose and the titles: the setup's "Language of the defaults" */
  language: DefaultsLanguage;
  /**
   * The settings that will be in effect after the run (planSetup builds them: the live
   * settings with the chosen set's word-bearing values where the writer has none of their
   * own). Read the property names (`statusProperty`, `targetProperty`,
   * `chapterTargetProperty`…), the draft stage word (`writtenWord(settings.stages, "draft")`)
   * and `placeholderMarker` from here, never a literal, so the example classifies in the
   * writer's vault (rule 6).
   */
  settings: EscritaSettings;
}

/**
 * The example book's chapter file names per language, in order, with `.md`. The plan makes
 * one example item per name, inside the book's chapters folder. Task 2.1 may rename them
 * (the Wave 0 fixtures' names are placeholders); a rename updates
 * `tests/fixtures/setup/*.json` in the same commit.
 */
export const EXAMPLE_CHAPTERS: Readonly<Record<DefaultsLanguage, readonly string[]>> = {
  en: ["01 Arrival.md", "02 The storm.md"],
  "pt-BR": ["01 Chegada.md", "02 A tempestade.md"],
};

/**
 * The full text of one example note: frontmatter (`example: true`, the status in the draft
 * stage, the target) and the body (beats as `%% beat: … %%`, a placeholder as
 * `%% <marker>: … %%`). Never empty once task 2.1 lands; deterministic (the same context
 * gives the same text), so a preview and a run agree.
 *
 * Stub until task 2.1: returns "".
 */
export function exampleText(role: ExampleRole, ctx: ExampleContext): string {
  void role;
  void ctx;
  return "";
}
