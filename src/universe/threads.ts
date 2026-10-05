// Open threads as the vault index sees them (no Obsidian imports): every note's
// thread markers, and the queries over them.
//
// Threads work in every mode. Which notes a query covers:
//   scope none      the tracked works (mode off, or a note outside any book in per-book mode)
//   scope book      the notes of that book (its note, chapters and entries)
//   scope universe  every note of that universe (works and entries)

import { parseThreads, type ThreadMarker } from "../core/markers";
import type { IndexFile, IndexSpec } from "../core/vault-index";
import { basenameOf, classifyKeyOf, isUniverseNote, type EntriesSettings } from "./entries";
import { seenAt, type SeenStore } from "./first-seen";
import { sameScope, type Scope } from "./scope";

export type { ThreadMarker };

/** What the threads index holds for a note: its thread markers, in order. Notes without any are not indexed. */
export type NoteThreads = ThreadMarker[];

/** A thread in a query result: where it is, and when it was first seen (ms since epoch, null when not yet recorded). */
export interface ThreadRef {
  path: string;
  /** the note's basename */
  title: string;
  thread: ThreadMarker;
  firstSeen: number | null;
}

export type ThreadsSettings = EntriesSettings & { threadKeyword: string; threadClosedWord: string };

export function sameThreads(a: NoteThreads, b: NoteThreads): boolean {
  return a.length === b.length
    && a.every((t, i) => t.raw === b[i].raw && t.from === b[i].from && t.line === b[i].line);
}

export function threadsSettingsKey(s: ThreadsSettings): string {
  return JSON.stringify([s.threadKeyword, s.threadClosedWord, s.templatesFolder, classifyKeyOf(s),
    s.entryTypes.character.template, s.entryTypes.place.template, s.entryTypes.object.template,
    s.entryTypes.group.template, s.entryTypes.event.template]);
}

export function threadsSpec<F extends IndexFile>(settings: () => ThreadsSettings): IndexSpec<F, NoteThreads> {
  return {
    name: "universe-threads",
    mode: "content",
    include: (f) => isUniverseNote(f, settings()),
    compute: (_f, text) => {
      if (text === null) return undefined;
      const s = settings();
      const found = parseThreads(text, s.threadKeyword, s.threadClosedWord);
      return found.length > 0 ? found : undefined;
    },
    same: sameThreads,
    settingsKey: () => threadsSettingsKey(settings()),
  };
}

/** The thread refs of the notes `belongs` accepts, by note path then position; `open` drops the closed ones. */
export function collectThreads(
  all: Iterable<[string, NoteThreads]>,
  belongs: (path: string) => boolean,
  seen: SeenStore,
  open = false,
): ThreadRef[] {
  const out: ThreadRef[] = [];
  for (const [path, list] of all) {
    if (!belongs(path)) continue;
    for (const thread of list) {
      if (open && thread.closed) continue;
      out.push({ path, title: basenameOf(path), thread, firstSeen: seenAt(seen, path, thread.text) });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.thread.from - b.thread.from);
}

/** Whether a note with scope `of` is covered by a query for `scope` (kind none is decided by the caller: tracked works). */
export function inScope(of: Scope, scope: Scope): boolean {
  return scope.kind !== "none" && sameScope(of, scope);
}
