// Path-key upkeep: data keyed by vault path follows renames and deletes here,
// in one place. Keys are compared byte for byte (never normalizePath), a key
// matches when it equals the path or sits under `path + "/"`, and the empty
// path is a no-op. Every function is idempotent when per-child events follow a
// folder event. By default the moved value wins a collision.

type Merge<T> = (moved: T, existing: T) => T;

/** True when `key` is `path` or sits inside the folder `path`. */
export function isUnder(key: string, path: string): boolean {
	if (path === "") return false;
	return key === path || key.startsWith(path + "/");
}

/** Where `key` lands when `oldPath` becomes `newPath`; null when it is unaffected. */
export function movedPath(key: string, oldPath: string, newPath: string): string | null {
	if (oldPath === "" || oldPath === newPath) return null;
	if (key === oldPath) return newPath;
	if (key.startsWith(oldPath + "/")) return newPath + key.slice(oldPath.length);
	return null;
}

/** Shared engine: rename inside any keyed store. */
function renameIn<T>(
	keys: Iterable<string>,
	get: (k: string) => T,
	has: (k: string) => boolean,
	del: (k: string) => void,
	set: (k: string, v: T) => void,
	oldPath: string,
	newPath: string,
	merge?: Merge<T>,
): boolean {
	const moves: [string, string][] = [];
	for (const k of keys) {
		const to = movedPath(k, oldPath, newPath);
		if (to !== null) moves.push([k, to]);
	}
	if (moves.length === 0) return false;
	const values = moves.map(([k]) => get(k));
	// Remove first so only keys that are not moving can collide.
	for (const [k] of moves) del(k);
	moves.forEach(([, to], i) => {
		const moved = values[i];
		if (has(to)) set(to, merge ? merge(moved, get(to)) : moved);
		else set(to, moved);
	});
	return true;
}

export function renameKeys<T>(rec: Record<string, T>, oldPath: string, newPath: string, merge?: Merge<T>): boolean {
	return renameIn(
		Object.keys(rec),
		(k) => rec[k],
		(k) => Object.prototype.hasOwnProperty.call(rec, k),
		(k) => { delete rec[k]; },
		(k, v) => { rec[k] = v; },
		oldPath, newPath, merge,
	);
}

export function dropKeys<T>(rec: Record<string, T>, path: string): boolean {
	let changed = false;
	for (const k of Object.keys(rec)) {
		if (isUnder(k, path)) {
			delete rec[k];
			changed = true;
		}
	}
	return changed;
}

export function renameInMap<T>(m: Map<string, T>, o: string, n: string, merge?: Merge<T>): boolean {
	return renameIn(
		[...m.keys()],
		(k) => m.get(k) as T,
		(k) => m.has(k),
		(k) => { m.delete(k); },
		(k, v) => { m.set(k, v); },
		o, n, merge,
	);
}

export function dropFromMap<T>(m: Map<string, T>, p: string): boolean {
	let changed = false;
	for (const k of [...m.keys()]) {
		if (isUnder(k, p)) {
			m.delete(k);
			changed = true;
		}
	}
	return changed;
}

export function renameInSet(s: Set<string>, o: string, n: string): boolean {
	const moves: [string, string][] = [];
	for (const k of s) {
		const to = movedPath(k, o, n);
		if (to !== null) moves.push([k, to]);
	}
	if (moves.length === 0) return false;
	for (const [k] of moves) s.delete(k);
	for (const [, to] of moves) s.add(to);
	return true;
}

export function dropFromSet(s: Set<string>, p: string): boolean {
	let changed = false;
	for (const k of [...s]) {
		if (isUnder(k, p)) {
			s.delete(k);
			changed = true;
		}
	}
	return changed;
}
