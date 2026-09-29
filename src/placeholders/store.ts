// The placeholder index as plain data (no Obsidian imports, unit tested).
// The module fills it from the vault; the view, the explorer dots and the
// outline read it and subscribe to changes.

import type { IndexedMarker } from "./logic";

function sameMarkers(a: IndexedMarker[], b: IndexedMarker[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].from !== b[i].from || a[i].to !== b[i].to || a[i].raw !== b[i].raw || a[i].line !== b[i].line) return false;
  }
  return true;
}

export class PlaceholderStore {
  /** only files that have at least one placeholder */
  private map = new Map<string, IndexedMarker[]>();
  private listeners = new Set<() => void>();

  /** Set a file's placeholders. Returns true when something changed. */
  set(path: string, markers: IndexedMarker[]): boolean {
    const old = this.map.get(path);
    if (markers.length === 0) {
      if (!old) return false;
      this.map.delete(path);
      this.emit();
      return true;
    }
    if (old && sameMarkers(old, markers)) return false;
    this.map.set(path, markers);
    this.emit();
    return true;
  }

  remove(path: string): boolean {
    if (!this.map.delete(path)) return false;
    this.emit();
    return true;
  }

  rename(oldPath: string, newPath: string): boolean {
    if (oldPath === newPath) return false;
    const v = this.map.get(oldPath);
    if (!v) return false;
    this.map.delete(oldPath);
    this.map.set(newPath, v);
    this.emit();
    return true;
  }

  /**
   * Replace everything with a freshly built index, in one change notification.
   * Paths in `keep` were updated while the build was running, so their current
   * value (present or absent) wins over the possibly stale fresh one.
   */
  replaceAll(fresh: Map<string, IndexedMarker[]>, keep: Set<string> = new Set()): void {
    const next = new Map<string, IndexedMarker[]>();
    for (const [p, ms] of fresh) if (!keep.has(p) && ms.length > 0) next.set(p, ms);
    for (const p of keep) {
      const cur = this.map.get(p);
      if (cur) next.set(p, cur);
    }
    let changed = next.size !== this.map.size;
    if (!changed) {
      for (const [p, ms] of next) {
        const old = this.map.get(p);
        if (!old || !sameMarkers(old, ms)) { changed = true; break; }
      }
    }
    this.map = next;
    if (changed) this.emit();
  }

  clear(): void {
    if (this.map.size === 0) return;
    this.map.clear();
    this.emit();
  }

  countFor(path: string): number {
    return this.map.get(path)?.length ?? 0;
  }

  markersFor(path: string): IndexedMarker[] {
    return this.map.get(path) ?? [];
  }

  paths(): string[] {
    return [...this.map.keys()];
  }

  entries(): { path: string; markers: IndexedMarker[] }[] {
    return [...this.map].map(([path, markers]) => ({ path, markers }));
  }

  total(): number {
    let n = 0;
    for (const ms of this.map.values()) n += ms.length;
    return n;
  }

  /** Subscribe to changes; returns the unsubscribe function. */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private emit(): void {
    for (const cb of [...this.listeners]) {
      try { cb(); } catch (e) { console.error("Escrita: placeholder listener failed", e); }
    }
  }
}
