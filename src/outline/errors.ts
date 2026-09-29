import { Notice } from "obsidian";
import { t } from "../i18n";
import { ChapterError } from "../core/chapter-plan";

/** A user-facing, translated message for an error from a chapter or file operation. */
export function errorMessage(e: unknown): string {
  if (e instanceof ChapterError) return t(`outline.err.${e.code}`, { name: e.subject });
  return e instanceof Error ? e.message : String(e);
}

/** Log an error and show it in a Notice. */
export function reportError(e: unknown): void {
  console.error("Escrita:", e);
  new Notice(t("outline.error", { msg: errorMessage(e) }));
}
