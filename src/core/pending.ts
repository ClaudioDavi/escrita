// The pending-submissions port (PLAN-0.8 Q12, task 3.2 fills it, 3.3 reads it). The
// submissions module provides it while loaded; the desk reads it only while
// `features.isOn("submissions")`, through `features.get<{ pending?: PendingSource }>`,
// and never imports the submissions module. Pure types, no Obsidian imports.

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
