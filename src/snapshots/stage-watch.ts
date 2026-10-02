// Detects a work's stage change and settles it (no Obsidian imports).
// The last known stage lives in memory only: a status changed while Obsidian
// was closed is not snapshotted.

import { dropFromMap, isUnder, movedPath, renameInMap } from "../core/path-keys";
import type { DeskEntry, DeskRole } from "../core/works";
import type { Stage } from "../core/stages";
import type { IndexChange, IndexTimers } from "../core/vault-index";

export const STAGE_SETTLE_MS = 3000;

export interface StageWatchOptions {
	timers: IndexTimers;
	current: (path: string) => DeskEntry | undefined;
	all: () => Iterable<[string, DeskEntry]>;
	onTransition: (path: string, from: Stage, to: Stage) => void;
}

export class StageWatch {
	private last = new Map<string, Stage>();
	private pending = new Map<string, unknown>();

	constructor(private opts: StageWatchOptions) {}

	handle(changes: readonly IndexChange<DeskEntry>[]): void {
		if (changes.some((c) => c.cause === "build")) this.reseed();
		for (const c of changes) {
			switch (c.cause) {
				case "rename":
					if (c.from !== undefined) this.rename(c.from, c.path);
					break;
				case "delete":
					this.forget(c.path);
					break;
				case "update":
					if (c.after && (c.after.role === "book" || c.after.role === "note")) this.arm(c.path);
					break;
				default:
					break;
			}
		}
	}

	dispose(): void {
		for (const h of this.pending.values()) this.opts.timers.clear(h);
		this.pending.clear();
		this.last.clear();
	}

	private reseed(): void {
		const next = new Map<string, Stage>();
		const live = new Set<string>();
		for (const [path, entry] of this.opts.all()) {
			live.add(path);
			if (this.pending.has(path)) {
				const old = this.last.get(path);
				if (old) next.set(path, old);
			} else if (entry.stage) {
				next.set(path, entry.stage);
			} else {
				// Not a work right now: keep what we knew.
				const old = this.last.get(path);
				if (old) next.set(path, old);
			}
		}
		this.last = next;
	}

	private arm(path: string): void {
		const old = this.pending.get(path);
		if (old !== undefined) this.opts.timers.clear(old);
		const h = this.opts.timers.set(() => this.fire(path), STAGE_SETTLE_MS);
		this.pending.set(path, h);
	}

	private fire(path: string): void {
		this.pending.delete(path);
		const cur = this.opts.current(path)?.stage ?? null;
		if (!cur) return;
		const prev = this.last.get(path);
		this.last.set(path, cur);
		if (prev && prev !== cur) this.opts.onTransition(path, prev, cur);
	}

	private rename(from: string, to: string): void {
		renameInMap(this.last, from, to);
		const moves: [string, string][] = [];
		for (const k of this.pending.keys()) {
			const n = movedPath(k, from, to);
			if (n !== null) moves.push([k, n]);
		}
		for (const [k] of moves) {
			this.opts.timers.clear(this.pending.get(k));
			this.pending.delete(k);
		}
		for (const [, n] of moves) this.arm(n);
	}

	private forget(path: string): void {
		dropFromMap(this.last, path);
		for (const k of [...this.pending.keys()]) {
			if (isUnder(k, path)) {
				this.opts.timers.clear(this.pending.get(k));
				this.pending.delete(k);
			}
		}
	}
}

export function transitionName(from: Stage, to: Stage, word: (s: Stage) => string): string {
	return `${word(from) || from} → ${word(to) || to}`;
}

/** The files a stage snapshot covers: a book note takes its chapters too. */
export function stageTakeTargets<F>(note: F, role: DeskRole, chapters: readonly F[]): F[] {
	return role === "book" ? [note, ...chapters] : [note];
}
