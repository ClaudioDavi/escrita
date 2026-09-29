import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Whether editors should have spellcheck turned off right now. */
export function spellcheckSuppressed(onDemand: boolean, turnedOn: boolean): boolean {
  return onDemand && !turnedOn;
}

/**
 * Editor extensions for spellcheck on demand: `spellcheck="false"` on the
 * content while suppressed, nothing otherwise (Obsidian's own setting rules).
 */
export function spellcheckExtensions(suppressed: boolean): Extension[] {
  // highest precedence: the last-applied source wins, and Obsidian's own
  // spellcheck attribute comes from its core extensions at default precedence
  return suppressed ? [Prec.highest(EditorView.contentAttributes.of({ spellcheck: "false" }))] : [];
}
