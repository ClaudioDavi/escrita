// The text of a new book note (the "Create a book" command). Pure: no obsidian imports.

import { writtenWord, type StageMapping } from "../core/stages";

export const NEW_BOOK_GOAL = 80000;

export interface NewBookSettings {
  goalProperty: string;
  deadlineProperty: string;
  statusProperty: string;
  stages: StageMapping;
}

/** A property name, quoted when YAML needs it. */
function yamlKey(k: string): string {
  return /^[\p{L}\p{N}_-]+$/u.test(k) ? k : JSON.stringify(k);
}

/** A plain scalar when it is one word of letters, else a quoted string. */
function yamlValue(v: string): string {
  return /^[\p{L}][\p{L}\p{N}_-]*$/u.test(v) ? v : JSON.stringify(v);
}

/** Frontmatter for a new book: the writer's draft word as its status, a goal and an empty deadline. */
export function newBookNote(s: NewBookSettings): string {
  const status = s.statusProperty.trim() || "status";
  return [
    "---",
    `${yamlKey(status)}: ${yamlValue(writtenWord(s.stages, "draft"))}`,
    `${yamlKey(s.goalProperty)}: ${NEW_BOOK_GOAL}`,
    `${yamlKey(s.deadlineProperty)}: `,
    "---",
    "",
  ].join("\n");
}
