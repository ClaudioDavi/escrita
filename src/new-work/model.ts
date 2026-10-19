// The text and the paths of a new work (1.0.4, SF 14). Pure: no obsidian imports. The
// built-in notes, a writer's template filled in, where the cursor lands and where the work
// goes. Every property name comes from the settings (rule 6).

import { safeFileName } from "../core/book";
import { withProperty } from "../core/chapter-plan";
import { joinPath, cleanFolder, parentOf } from "../core/paths";
import { writtenWord, type StageMapping } from "../core/stages";
import { hasFrontmatter, renderTemplate, yamlKey, type TemplateVars } from "../core/template";

export interface NewWorkSettings {
  statusProperty: string;
  stages: StageMapping;
  formProperty: string;
  formValues: { shortStory: string; screenplay: string };
  targetProperty: string;
  goalProperty: string;
  deadlineProperty: string;
}

/** The words a built-in note holds, translated by the caller (`new-work.text.*`). */
export interface StoryTexts {
  beat: string;
}

export interface BookTexts {
  premise: string;
  premiseHint: string;
  characters: string;
  charactersHint: string;
}

/** A plain scalar when it is one word of letters, else a quoted string. */
function yamlValue(v: string): string {
  return /^[\p{L}][\p{L}\p{N}_-]*$/u.test(v) ? v : JSON.stringify(v);
}

function statusKey(s: NewWorkSettings): string {
  return s.statusProperty.trim() || "status";
}

/** `key: value` lines between `---`; a blank value stays blank (no target, no deadline, no goal). */
function frontmatter(props: [string, string][]): string[] {
  return ["---", ...props.map(([k, v]) => `${yamlKey(k)}: ${v}`), "---"];
}

/**
 * A conto: the draft word as status, the form, a blank target and deadline, then one beat
 * and an empty line for the cursor. A blank target is no piece until the writer sets one.
 */
export function storyNoteText(s: NewWorkSettings, texts: StoryTexts): string {
  return [
    ...frontmatter([
      [statusKey(s), yamlValue(writtenWord(s.stages, "draft"))],
      [s.formProperty, yamlValue(s.formValues.shortStory)],
      [s.targetProperty, ""],
      [s.deadlineProperty, ""],
    ]),
    `%% beat: ${texts.beat} %%`,
    "",
  ].join("\n");
}

/**
 * A screenplay (1.2): the draft word as status, the screenplay form, then one beat and an
 * empty line for the cursor. No target or deadline: a script is not counted in words.
 */
export function screenplayNoteText(s: NewWorkSettings, texts: StoryTexts): string {
  return [
    ...frontmatter([
      [statusKey(s), yamlValue(writtenWord(s.stages, "draft"))],
      [s.formProperty, yamlValue(s.formValues.screenplay)],
    ]),
    `%% beat: ${texts.beat} %%`,
    "",
  ].join("\n");
}

/** A book note: the draft word as status, a blank goal and deadline, then Premise and Characters. */
export function bookNoteText(s: NewWorkSettings, texts: BookTexts): string {
  return [
    ...frontmatter([
      [statusKey(s), yamlValue(writtenWord(s.stages, "draft"))],
      [s.goalProperty, ""],
      [s.deadlineProperty, ""],
    ]),
    `## ${texts.premise}`,
    `%% ${texts.premiseHint} %%`,
    "",
    `## ${texts.characters}`,
    `%% ${texts.charactersHint} %%`,
    "",
  ].join("\n");
}

/**
 * The writer's own template, filled in. The draft status is added when the template has
 * none (a template with a status keeps its own); a template without any frontmatter gets
 * one holding just the status.
 */
export function fromTemplate(template: string, vars: TemplateVars, s: NewWorkSettings): string {
  const text = renderTemplate(template, vars);
  const key = statusKey(s);
  const word = writtenWord(s.stages, "draft");
  if (hasFrontmatter(text)) return withProperty(text, key, word);
  return `${frontmatter([[key, yamlValue(word)]]).join("\n")}\n${text}`;
}

/** Where the cursor goes in a new note: the end, which is its own empty line for the built-in notes. */
export function cursorAfterBody(text: string): number {
  return text.length;
}

/**
 * The note's path for a work: `<folder>/<safe title>.md`, the vault root for an empty folder.
 * Null when the title leaves no name. A book's folder is the same path without ".md".
 */
export function targetPath(folder: string, title: string): string | null {
  const name = safeFileName(title);
  return name ? joinPath(cleanFolder(folder), `${name}.md`) : null;
}

/**
 * The folder a new work is offered in: the setting's folder, else beside the active note.
 * An active note inside a book (a chapter, the book note) offers the book's parent folder,
 * so the new work doesn't land in the chapters folder and classify as a chapter.
 */
export function defaultFolderFor(settingFolder: string, activePath: string | null, bookFolderPath: string | null): string {
  if (settingFolder) return settingFolder;
  if (bookFolderPath) return parentOf(bookFolderPath);
  return activePath ? parentOf(activePath) : "";
}
