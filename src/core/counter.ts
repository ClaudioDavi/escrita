import { App, TFile } from "obsidian";
import { countWords } from "./wordcount";

/** Word counts per file, cached by modification time. */
export class WordCounter {
  private cache = new Map<string, { mtime: number; words: number }>();

  constructor(private app: App) {}

  async count(file: TFile): Promise<number> {
    const hit = this.cache.get(file.path);
    if (hit && hit.mtime === file.stat.mtime) return hit.words;
    const words = countWords(await this.app.vault.cachedRead(file));
    this.cache.set(file.path, { mtime: file.stat.mtime, words });
    return words;
  }

  /** Last known count without reading the file. */
  peek(path: string): number | undefined {
    return this.cache.get(path)?.words;
  }

  set(file: TFile, words: number): void {
    this.cache.set(file.path, { mtime: file.stat.mtime, words });
  }

  rename(oldPath: string, newPath: string): void {
    const v = this.cache.get(oldPath);
    if (v) { this.cache.delete(oldPath); this.cache.set(newPath, v); }
  }

  forget(path: string): void {
    this.cache.delete(path);
  }

  async total(files: TFile[]): Promise<number> {
    let n = 0;
    for (const f of files) n += await this.count(f);
    return n;
  }
}
