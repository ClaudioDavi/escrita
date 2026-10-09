// The writing mode port (1.0, board 39; PLAN-1.0 "Design first"). Writing mode is part of the
// home block feature ("desk"), with no switch of its own: the desk module provides the port
// while loaded (desk/writing-mode.ts), and anything else (the setup's "focus"
// layout, setup/layout.ts; the setup's run) reads it through `writingModeOf(plugin.features)`,
// never by importing the desk. With the desk off there is no writing mode: the caller does
// without it. Pure, no Obsidian imports.

import type { FeatureId } from "./features";

/**
 * Only the note: the sidebars, tab bar, ribbon and status bar hide (a body class,
 * `escrita-writing-mode`, plus public workspace calls to collapse the sidebars); a quiet
 * "Exit writing mode" button stays visible; a small goal counter shows at the bottom while
 * goals are on. Nothing is written to the vault, and the mode itself is not saved (the
 * setting `openInWritingMode` only enters it at startup).
 */
export interface WritingModePort {
  /** whether writing mode is on now */
  isActive(): boolean;
  /**
   * Enters writing mode, a no-op when already on. Remembers which sidebars were open, so
   * `exit` reopens only those. Does not open a note: the caller opens one first (the layout
   * opens the home note). Never throws.
   */
  enter(): void;
  /** Leaves writing mode, restoring only what `enter` hid; a no-op when off. Never throws. */
  exit(): void;
  /** `exit` when on, else `enter` (the command). */
  toggle(): void;
  /** called after the mode turns on or off; returns the unsubscribe */
  onChange(cb: (active: boolean) => void): () => void;
}

/** What the desk module exposes: `features.get<WritingModeHost>("desk")?.writingMode`. */
export interface WritingModeHost {
  writingMode?: WritingModePort;
}

/** The writing mode while the desk is on, else null (a soft dependency on "desk"). */
export function writingModeOf(features: { get<T>(id: FeatureId): T | undefined }): WritingModePort | null {
  return features.get<WritingModeHost>("desk")?.writingMode ?? null;
}
