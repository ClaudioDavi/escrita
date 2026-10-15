// The new work port (1.0.4, SF 14; PLAN-1.0.4 Q2). Starting a work belongs to the core
// module `src/new-work/`, always loaded; anything else (the desk's footer, the outline view's
// empty state) starts one through `plugin.newWork`, typed by this interface, and never
// imports that module. Pure, no Obsidian imports.

/** What "New work…" offers. The list is built from this, so a later kind adds a member. */
export type NewWorkKind = "story" | "book";

export const NEW_WORK_KINDS: readonly NewWorkKind[] = ["story", "book"];

export interface NewWorkStarter {
  /**
   * Opens the modal for `kind` (title, folder, Create), or the list of kinds when `kind` is
   * left out. A kind not offered now does nothing. Never throws.
   */
  start(kind?: NewWorkKind): void;
  /** Whether `kind` is offered now: a book needs the outline on (board 42 a′). */
  offers(kind: NewWorkKind): boolean;
}
