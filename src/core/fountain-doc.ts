// The script of an editor document, cached per document version (1.2, SP 2, PLAN-1.2 Q3), as
// `segmentDoc` caches the Markdown segmentation. Pure, no Obsidian imports: `doc` is any
// immutable object with `toString()` (a CodeMirror `Text`, one per version). A cached entry is
// reused only with the same options object, so a settings change reads the note again.

import { segmentDoc } from "./markdown";
import { fountainLines, parseFountain, type FountainOptions, type LineKind, type Script } from "./fountain";

interface Entry {
  opts: FountainOptions;
  kinds?: (LineKind | null)[];
  script?: Script;
}

const byDoc = new WeakMap<object, Entry>();

function entry(doc: { toString(): string }, opts: FountainOptions): Entry {
  let e = byDoc.get(doc);
  if (!e || e.opts !== opts) {
    e = { opts };
    byDoc.set(doc, e);
  }
  return e;
}

/** What each line of the document is in the script (`fountainLines`), computed once per version. */
export function fountainDocLines(doc: { toString(): string }, opts: FountainOptions): (LineKind | null)[] {
  const e = entry(doc, opts);
  if (!e.kinds) {
    const md = segmentDoc(doc);
    e.kinds = fountainLines(md.text, md, opts);
  }
  return e.kinds;
}

/** The parsed script of the document (`parseFountain`), computed once per version. */
export function fountainDoc(doc: { toString(): string }, opts: FountainOptions): Script {
  const e = entry(doc, opts);
  if (!e.script) {
    const md = segmentDoc(doc);
    e.script = parseFountain(md.text, md, opts);
  }
  return e.script;
}
