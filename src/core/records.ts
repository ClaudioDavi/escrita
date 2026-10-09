// Helpers for reading saved JSON (data.json written by hand or by another version).

export type PlainRecord = Record<string, unknown>;

/** A JSON object: not null, not an array. */
export function isRecord(v: unknown): v is PlainRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * The own entries of a parsed JSON object, without "__proto__": `out["__proto__"] = x`
 * on a plain object would change its prototype instead of adding a key. Not a record gives [].
 */
export function safeEntries(raw: unknown): [string, unknown][] {
  if (!isRecord(raw)) return [];
  return Object.entries(raw).filter(([k]) => k !== "__proto__");
}

/**
 * The chapter template: the file at `path` when it is a markdown file, else `path` + ".md".
 * A folder of that name or a non-markdown file is passed over. `get` looks a path up.
 */
export function resolveTemplate<T>(path: string, get: (p: string) => unknown, isMarkdown: (f: unknown) => f is T): T | null {
  for (const p of [`${path}.md`, path]) {
    const f = get(p);
    if (isMarkdown(f)) return f;
  }
  return null;
}
