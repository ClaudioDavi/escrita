// A writing sprint: a duration and a word target. Pure (no Obsidian imports);
// the goals module drives it with a one-second tick and shows the notices.
// Sprint state is deliberately not persisted across reloads.

export type SprintEvent =
  | { type: "target"; words: number }
  | { type: "done"; words: number; minutes: number; perHour: number };

export class Sprint {
  readonly durationMs: number;
  readonly target: number;
  words = 0;
  private targetNotified = false;
  private finished = false;

  constructor(minutes: number, target: number, readonly startedAt: number) {
    const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 25;
    this.durationMs = Math.round(m * 60000);
    this.target = Number.isFinite(target) && target > 0 ? Math.round(target) : 0;
  }

  get minutes(): number {
    return this.durationMs / 60000;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  remainingMs(now: number): number {
    return Math.max(0, this.startedAt + this.durationMs - now);
  }

  elapsedMs(now: number): number {
    return Math.min(this.durationMs, Math.max(0, now - this.startedAt));
  }

  /** 0–1 of the target (or of the time, when there is no target). */
  progress(now: number): number {
    if (this.target > 0) return Math.min(1, this.words / this.target);
    return this.durationMs > 0 ? this.elapsedMs(now) / this.durationMs : 0;
  }

  /** Count writing. Only positive deltas count; returns the target event the first time it is reached. */
  add(delta: number): SprintEvent | null {
    if (this.finished || !Number.isFinite(delta) || delta <= 0) return null;
    this.words += Math.round(delta);
    if (this.target > 0 && !this.targetNotified && this.words >= this.target) {
      this.targetNotified = true;
      return { type: "target", words: this.words };
    }
    return null;
  }

  /** Called every second. Returns the "done" event once, when time is up. */
  tick(now: number): SprintEvent | null {
    if (this.finished || this.remainingMs(now) > 0) return null;
    return this.finish(now);
  }

  /** End now (stopped early, or time up). Returns null when already finished. */
  finish(now: number): SprintEvent | null {
    if (this.finished) return null;
    this.finished = true;
    const ms = this.elapsedMs(now);
    return { type: "done", words: this.words, minutes: sprintMinutes(ms), perHour: wordsPerHour(this.words, ms) };
  }
}

/** Words per hour, guarded against tiny or zero durations. */
export function wordsPerHour(words: number, ms: number): number {
  if (!Number.isFinite(words) || !Number.isFinite(ms) || ms <= 0 || words <= 0) return 0;
  return Math.round((words * 3600000) / Math.max(ms, 60000));
}

/** Whole minutes for a notice, at least 1. */
export function sprintMinutes(ms: number): number {
  return Math.max(1, Math.round((Number.isFinite(ms) ? ms : 0) / 60000));
}

/** 760000 → "12:40"; over an hour → "1:02:05". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}
