// The lens session: which notes have the lens on, a version counter per path, a
// debounced full pass and the cache of its last result (Q22). Pure: time comes in
// as `IndexTimers`, the pass as an injected `analyze`. The session owns versions
// (CodeMirror has no document version, and two panes on one note would each invent
// their own); a result older than the path's latest version is dropped.

import type { IndexTimers } from "../core/vault-index";
import { dropFromMap, renameInMap } from "../core/path-keys";
import type { LensResult } from "./types";

export const LENS_SETTLE_MS = 400;
export const LENS_SETTLE_MOBILE_MS = 800;

interface PathState {
	path: string;
	on: boolean;
	version: number;
	timer: unknown;
	pending: (() => string) | null;
	/** The newest text the session was given (a change or a `now`), for `invalidate`. */
	latest: (() => string) | null;
	cached: { text: string; result: LensResult; gen: number } | null;
}

export class LensSession {
	private states = new Map<string, PathState>();
	private listeners = new Set<(path: string, r: LensResult) => void>();
	private invalidated = new Set<() => void>();
	private disposed = false;
	/** Bumped by `invalidate`: results from an older generation are never used. */
	private gen = 0;

	constructor(private opts: {
		timers: IndexTimers;
		settleMs: number;
		analyze: (path: string, text: string, version: number) => LensResult;
	}) {}

	isOn(path: string): boolean { return this.states.get(path)?.on === true; }

	/** Flips the lens for a note; returns the new state. */
	toggle(path: string): boolean {
		const s = this.state(path);
		s.on = !s.on;
		if (!s.on) {
			this.cancel(s);
			s.cached = null;
			s.latest = null;
		}
		return s.on;
	}

	renamed(oldPath: string, newPath: string): void {
		renameInMap(this.states, oldPath, newPath);
		for (const [k, s] of this.states) s.path = k;
	}

	deleted(path: string): void {
		for (const [k, s] of this.states) {
			if (k === path || k.startsWith(path + "/")) this.cancel(s);
		}
		dropFromMap(this.states, path);
	}

	/** Schedules a pass after a quiet time. Returns the version assigned. Nothing runs when off. */
	changed(path: string, text: () => string): number {
		const s = this.state(path);
		s.version++;
		const version = s.version;
		if (!s.on || this.disposed) return version;
		s.pending = text;
		s.latest = text;
		if (s.timer !== null) this.opts.timers.clear(s.timer);
		s.timer = this.opts.timers.set(() => {
			s.timer = null;
			const read = s.pending;
			s.pending = null;
			if (!read || !s.on || this.disposed) return;
			// keep the text, not the reader: the reader holds the editor, which may close
			const text = read();
			s.latest = () => text;
			this.run(s, text, s.version);
		}, this.opts.settleMs);
		return version;
	}

	/** An immediate pass; the cached result when the text is unchanged. */
	now(path: string, text: string): LensResult {
		const s = this.state(path);
		this.cancel(s);
		s.version++;
		s.latest = () => text;
		return this.run(s, text, s.version);
	}

	/** The cached result, only when it was computed under the current options. */
	result(path: string): LensResult | undefined { return this.current(this.states.get(path))?.result; }

	/** The text the cached result was computed on. */
	cachedText(path: string): string | undefined { return this.current(this.states.get(path))?.text; }

	version(path: string): number { return this.states.get(path)?.version ?? 0; }

	/** The options generation: bumped by every `invalidate`. */
	generation(): number { return this.gen; }

	/**
	 * Settings or lists changed: start a new generation, drop every cache, and recompute
	 * each note that is on from the newest text it was given. A note with a pending pass
	 * is left to it (the pass reads the latest text and options when it fires). One
	 * failing pass does not stop the others; the first error is rethrown at the end.
	 */
	invalidate(): void {
		this.gen++;
		const all = [...this.states.values()];
		for (const s of all) s.cached = null;
		let failure: { error: unknown } | null = null;
		for (const s of all) {
			if (this.disposed) break;
			if (!s.on || s.timer !== null || !s.latest || this.states.get(s.path) !== s) continue;
			s.version++;
			try {
				this.run(s, s.latest(), s.version);
			} catch (error) {
				failure ??= { error };
			}
		}
		for (const cb of [...this.invalidated]) cb();
		if (failure) throw failure.error;
	}

	/** Called after every `invalidate`, once its passes ran, so views can drop old-options marks. */
	onInvalidate(cb: () => void): () => void {
		this.invalidated.add(cb);
		return () => { this.invalidated.delete(cb); };
	}

	onResult(cb: (path: string, r: LensResult) => void): () => void {
		this.listeners.add(cb);
		return () => { this.listeners.delete(cb); };
	}

	dispose(): void {
		this.disposed = true;
		for (const s of this.states.values()) this.cancel(s);
		this.listeners.clear();
		this.invalidated.clear();
	}

	// ---------------------------------------------------------------- internals

	private state(path: string): PathState {
		let s = this.states.get(path);
		if (!s) {
			s = { path, on: false, version: 0, timer: null, pending: null, latest: null, cached: null };
			this.states.set(path, s);
		}
		return s;
	}

	private cancel(s: PathState): void {
		if (s.timer !== null) this.opts.timers.clear(s.timer);
		s.timer = null;
		s.pending = null;
	}

	private current(s: PathState | undefined): PathState["cached"] {
		const c = s?.cached;
		return c && c.gen === this.gen ? c : null;
	}

	/**
	 * One pass. The cache is reused only for the same text under the same options. The
	 * result is cached and announced unless a newer change or an options change arrived
	 * while it ran; it is returned either way.
	 */
	private run(s: PathState, text: string, version: number): LensResult {
		const gen = this.gen;
		const cached = this.current(s);
		if (cached && cached.text === text) {
			const result = cached.result.version === version ? cached.result : { ...cached.result, version };
			s.cached = { text, result, gen };
			this.emit(s, result);
			return result;
		}
		const result = this.opts.analyze(s.path, text, version);
		if (result.version < s.version || gen !== this.gen) return result; // stale: not kept
		s.cached = { text, result, gen };
		this.emit(s, result);
		return result;
	}

	private emit(s: PathState, r: LensResult): void {
		for (const cb of [...this.listeners]) cb(s.path, r);
	}
}
