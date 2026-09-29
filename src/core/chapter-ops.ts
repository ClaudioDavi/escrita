import type { TFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "./books";

/**
 * File operations on a book's chapters. Every chapter create/move goes through
 * here so numbering stays consistent. Implemented by the outline module.
 */
export class ChapterOps {
  constructor(private plugin: EscritaPlugin) {}

  /**
   * Create a chapter at 0-based position `at` (chapters.length = append),
   * renumbering the chapters after it. Uses the chapter template when set.
   * Resolves to the new file.
   */
  async createChapterAt(book: Book, at: number, title: string, body?: string): Promise<TFile> {
    void this.plugin; void book; void at; void title; void body;
    throw new Error("not implemented");
  }

  /** Rename chapter files so their numeric prefixes match `ordered`. */
  async renumber(book: Book, ordered: TFile[]): Promise<void> {
    void book; void ordered;
    throw new Error("not implemented");
  }

  /** Change a chapter's title, keeping its number. */
  async retitle(file: TFile, title: string): Promise<void> {
    void file; void title;
    throw new Error("not implemented");
  }
}
