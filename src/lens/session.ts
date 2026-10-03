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
	cached: { text: string; result: LensResult } | null;
}

export class LensSession {
	private states = new Map<string, PathState>();
	private listeners = new Set<(path: string, r: LensResult) => void>();
	private disposed = false;

	constructor(private opts: {
		timers: IndexTimers;
		settleMs: number;
		analyze: (text: string, version: number) => LensResult;
	}) {}

	isOn(path: string): boolean { return this.states.get(path)?.on === true; }

	/** Flips the lens for a note; returns the new state. */
	toggle(path: string): boolean {
		const s = this.state(path);
		s.on = !s.on;
		if (!s.on) {
			this.cancel(s);
			s.cached = null;
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
		if (s.timer !== null) this.opts.timers.clear(s.timer);
		s.timer = this.opts.timers.set(() => {
			s.timer = null;
			const read = s.pending;
			s.pending = null;
			if (!read || !s.on || this.disposed) return;
			this.run(s, read(), s.version);
		}, this.opts.settleMs);
		return version;
	}

	/** An immediate pass; the cached result when the text is unchanged. */
	now(path: string, text: string): LensResult {
		const s = this.state(path);
		this.cancel(s);
		s.version++;
		const cached = s.cached;
		if (cached && cached.text === text) {
			const result = cached.result.version === s.version ? cached.result : { ...cached.result, version: s.version };
			s.cached = { text, result };
			this.emit(s, result);
			return result;
		}
		const result = this.opts.analyze(text, s.version);
		if (result.version >= s.version) {
			s.cached = { text, result };
			this.emit(s, result);
		}
		return result;
	}

	result(path: string): LensResult | undefined { return this.states.get(path)?.cached?.result; }

	/** The text the cached result was computed on. */
	cachedText(path: string): string | undefined { return this.states.get(path)?.cached?.text; }

	version(path: string): number { return this.states.get(path)?.version ?? 0; }

	/** Settings or lists changed: drop every cache and recompute the notes that are on. */
	invalidate(): void {
		for (const s of [...this.states.values()]) {
			const text = s.cached?.text;
			s.cached = null;
			// a pending pass reads the latest text when it fires, and options are read then
			// too: let it run instead of recomputing from the stale cached text
			if (s.on && s.timer === null && text !== undefined && !this.disposed) {
				s.version++;
				this.run(s, text, s.version);
			}
		}
	}

	onResult(cb: (path: string, r: LensResult) => void): () => void {
		this.listeners.add(cb);
		return () => { this.listeners.delete(cb); };
	}

	dispose(): void {
		this.disposed = true;
		for (const s of this.states.values()) this.cancel(s);
		this.listeners.clear();
	}

	// ---------------------------------------------------------------- internals

	private state(path: string): PathState {
		let s = this.states.get(path);
		if (!s) {
			s = { path, on: false, version: 0, timer: null, pending: null, cached: null };
			this.states.set(path, s);
		}
		return s;
	}

	private cancel(s: PathState): void {
		if (s.timer !== null) this.opts.timers.clear(s.timer);
		s.timer = null;
		s.pending = null;
	}

	private run(s: PathState, text: string, version: number): void {
		if (s.cached && s.cached.text === text) {
			const result = s.cached.result.version === version ? s.cached.result : { ...s.cached.result, version };
			s.cached = { text, result };
			this.emit(s, result);
			return;
		}
		const result = this.opts.analyze(text, version);
		if (result.version < s.version) return; // stale: a newer change arrived meanwhile
		s.cached = { text, result };
		this.emit(s, result);
	}

	private emit(s: PathState, r: LensResult): void {
		for (const cb of [...this.listeners]) cb(s.path, r);
	}
}
