// The pending-submissions port (PLAN-0.8 Q12). The
// submissions module provides it while loaded; the desk reads it only while
// `features.isOn("submissions")`, through `pendingOf` (typed by core/feature-ports.ts),
// and never imports the submissions module. Pure types, no Obsidian imports.

import { port, type PortSource } from "./feature-ports";

/** One submission whose result is the first value of the result list (pending). */
export interface PendingSubmission {
  /** path of the submission note */
  path: string;
  /** path of the work it points at (the `work` link, resolved); null when the link doesn't resolve */
  workPath: string | null;
  /** the work's title as the home block shows it (the link text when unresolved) */
  workTitle: string;
  /** the `market` property as written; "" when missing */
  market: string;
  /** the `sent` date as YYYY-MM-DD; null when missing or unreadable */
  sent: string | null;
}

/** The live list of pending submissions, newest `sent` first. */
export interface PendingSource {
  list(): readonly PendingSubmission[];
  /** called after the list changes; returns the unsubscribe */
  onChange(cb: () => void): () => void;
}

/** What the submissions module exposes: its `pending` list while loaded (core/feature-ports.ts). */
export interface PendingHost {
  pending?: PendingSource;
}

/** The pending list while the submissions feature is on, else null (a soft dependency on "submissions"). */
export function pendingOf(features: PortSource & { isOn(id: "submissions"): boolean }): PendingSource | null {
  if (!features.isOn("submissions")) return null;
  return port(features, "submissions")?.pending ?? null;
}
