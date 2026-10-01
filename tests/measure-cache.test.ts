import { describe, expect, it, vi } from "vitest";
import { CharactersNotCountedError, MeasureCache } from "../src/core/measure-cache";

interface F { path: string; stat: { mtime: number } }
const file = (path: string, mtime = 1): F => ({ path, stat: { mtime } });

/** A read that resolves only when told to, to control the order of concurrent reads. */
function deferredReads() {
  const waiting: { path: string; resolve: (s: string) => void; reject: (e: unknown) => void }[] = [];
  const read = vi.fn((f: F) => new Promise<string>((resolve, reject) => { waiting.push({ path: f.path, resolve, reject }); }));
  return { read, waiting };
}

function setup(texts: Record<string, string> = { "a.md": "um dois", "b.md": "três" }) {
  const read = vi.fn(async (f: F) => texts[f.path] ?? "");
  const cache = new MeasureCache<F>(read);
  const events: string[][] = [];
  cache.onChange((p) => events.push(p));
  return { read, cache, events, texts };
}

describe("MeasureCache", () => {
  it("reads once per mtime", async () => {
    const { read, cache } = setup();
    const a = await cache.get(file("a.md"));
    const b = await cache.get(file("a.md"));
    expect(read).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
    expect(a.words).toBe(2);
    await cache.get(file("a.md", 2));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("shares a read in flight for the same path and mtime", async () => {
    const { read, cache } = setup();
    const [a, b] = await Promise.all([cache.get(file("a.md")), cache.get(file("a.md"))]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("keeps the newer mtime when an older read resolves last", async () => {
    const { read, waiting } = deferredReads();
    const cache = new MeasureCache<F>(read);
    const old = cache.get(file("a.md", 1));
    const cur = cache.get(file("a.md", 2));
    waiting[1].resolve("um dois três");
    await cur;
    waiting[0].resolve("um");
    expect((await old).words).toBe(1); // the caller still gets its answer
    expect(cache.peek("a.md")?.words).toBe(3);
    expect(cache.fresh("a.md", 2)).toBe(true);
    expect(cache.fresh("a.md", 1)).toBe(false);
  });

  it("measures from given text without reading", async () => {
    const { read, cache } = setup();
    expect((await cache.get(file("a.md"), { seed: { text: "um dois três quatro", mtime: 1 } })).words).toBe(4);
    expect(read).not.toHaveBeenCalled();
    expect(cache.fresh("a.md", 1)).toBe(true);
  });

  it("given text wins over an older read still in flight", async () => {
    const { read, waiting } = deferredReads();
    const cache = new MeasureCache<F>(read);
    const pending = cache.get(file("a.md", 1));
    await cache.get(file("a.md", 2), { seed: { text: "um dois três", mtime: 2 } });
    waiting[0].resolve("um");
    await pending;
    expect(cache.peek("a.md")?.words).toBe(3);
  });

  it("peek is sync: undefined before the first count, the stale value until the next one", async () => {
    const { cache, texts } = setup();
    expect(cache.peek("a.md")).toBeUndefined();
    await cache.get(file("a.md"));
    expect(cache.peek("a.md")?.words).toBe(2);
    texts["a.md"] = "um dois três";
    const next = cache.get(file("a.md", 2));
    expect(cache.peek("a.md")?.words).toBe(2);
    await next;
    expect(cache.peek("a.md")?.words).toBe(3);
  });

  it("rename moves the entry, emits both paths, and drops a read in flight for the old path", async () => {
    const { read, waiting } = deferredReads();
    const cache = new MeasureCache<F>(read, undefined);
    const events: string[][] = [];
    cache.onChange((p) => events.push(p));
    const first = cache.get(file("a.md", 1));
    waiting[0].resolve("um dois");
    await first;
    events.length = 0;
    cache.rename("a.md", "c.md");
    expect(events).toEqual([["a.md", "c.md"]]);
    expect(cache.peek("a.md")).toBeUndefined();
    expect(cache.peek("c.md")?.words).toBe(2);

    const inflight = cache.get(file("x.md", 1));
    cache.rename("x.md", "y.md");
    waiting[1].resolve("um");
    await inflight;
    expect(cache.peek("x.md")).toBeUndefined();
    expect(cache.peek("y.md")).toBeUndefined();
  });

  it("renamePrefix moves a folder's entries only", async () => {
    const { cache, events } = setup({ "A/x.md": "um", "AB/y.md": "dois", "A/B/z.md": "três" });
    for (const p of ["A/x.md", "AB/y.md", "A/B/z.md"]) await cache.get(file(p));
    events.length = 0;
    cache.renamePrefix("A", "C");
    expect(cache.peek("C/x.md")?.words).toBe(1);
    expect(cache.peek("C/B/z.md")?.words).toBe(1);
    expect(cache.peek("AB/y.md")?.words).toBe(1);
    expect(cache.peek("A/x.md")).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0].slice(0, 2)).toEqual(["A", "C"]);
    expect(new Set(events[0])).toEqual(new Set(["A", "C", "A/x.md", "C/x.md", "A/B/z.md", "C/B/z.md"]));
  });

  it("forget and forgetPrefix drop entries and emit only what existed", async () => {
    const { cache, events } = setup({ "A/x.md": "um", "AB/y.md": "dois", "b.md": "três" });
    for (const p of ["A/x.md", "AB/y.md", "b.md"]) await cache.get(file(p));
    events.length = 0;
    cache.forget("nothing.md");
    expect(events).toEqual([]);
    cache.forget("b.md");
    expect(events).toEqual([["b.md"]]);
    cache.forgetPrefix("A");
    expect(events[1]).toEqual(["A/x.md"]);
    expect(cache.peek("AB/y.md")).toBeDefined();
    cache.forgetPrefix("Z");
    expect(events).toHaveLength(2);
  });

  it("forget while reading discards the result", async () => {
    const { read, waiting } = deferredReads();
    const cache = new MeasureCache<F>(read);
    const p = cache.get(file("a.md"));
    cache.forget("a.md");
    waiting[0].resolve("um");
    await p;
    expect(cache.peek("a.md")).toBeUndefined();
  });

  it("onChange: fires on the first store and on a change, not on an identical recount; stops after unsubscribe", async () => {
    const { cache, texts } = setup();
    const events: string[][] = [];
    const off = cache.onChange((p) => events.push(p));
    const chars = { characters: true };
    await cache.get(file("a.md", 1), chars);
    expect(events).toEqual([["a.md"]]);
    await cache.get(file("a.md", 2), chars); // same text, new mtime
    expect(events).toHaveLength(1);
    texts["a.md"] = "um  dois"; // same words and characters (runs of spaces collapse)
    await cache.get(file("a.md", 3), chars);
    expect(events).toHaveLength(1);
    texts["a.md"] = "um dois!";
    await cache.get(file("a.md", 4), chars); // same words, one more character
    expect(events).toHaveLength(2);
    off();
    texts["a.md"] = "um dois três";
    await cache.get(file("a.md", 5), chars);
    expect(events).toHaveLength(2);
  });

  it("a seed read before the file changed is not stored under the new mtime", async () => {
    const { read, cache, texts } = setup();
    // the caller saw mtime 1 and read the old text; the file is now at mtime 2
    texts["a.md"] = "um dois três";
    const f = file("a.md", 2);
    const c = await cache.get(f, { seed: { text: "um", mtime: 1 } });
    expect(read).toHaveBeenCalledTimes(1); // the stale seed was ignored and the file read
    expect(c.words).toBe(3);
    expect(cache.peek("a.md")?.words).toBe(3);
    // a later recount at mtime 2 is a hit with the right count
    expect((await cache.get(f)).words).toBe(3);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("holds numbers only: characters are counted when asked for, words-only entries refuse them", async () => {
    const { read, cache } = setup({ "a.md": "um dois" });
    const w = await cache.get(file("a.md"));
    expect(w.words).toBe(2);
    expect(() => w.characters).toThrow(CharactersNotCountedError);
    expect(cache.peek("a.md", true)).toBeUndefined();
    // asking for characters is a miss on a words-only entry: one more read
    const c = await cache.get(file("a.md"), { characters: true });
    expect(read).toHaveBeenCalledTimes(2);
    expect(c.characters).toBe(7);
    expect(c.charactersNoSpaces).toBe(6);
    expect(cache.peek("a.md", true)?.characters).toBe(7);
    // no getter keeps the text alive: the stored counts are plain data properties
    const d = Object.getOwnPropertyDescriptor(cache.peek("a.md"), "characters");
    expect(d && "value" in d).toBe(true);
    // a note counted in characters keeps them on a recount that doesn't ask
    const again = await cache.get(file("a.md", 2));
    expect(again.characters).toBe(7);
  });

  it("a failed read propagates and doesn't poison the next get", async () => {
    let fail = true;
    const read = vi.fn(async () => { if (fail) throw new Error("boom"); return "um dois"; });
    const cache = new MeasureCache<F>(read);
    await expect(cache.get(file("a.md"))).rejects.toThrow("boom");
    expect(cache.peek("a.md")).toBeUndefined();
    fail = false;
    expect((await cache.get(file("a.md"))).words).toBe(2);
  });

  it("a throwing listener doesn't stop the others", async () => {
    const { cache } = setup();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[][] = [];
    cache.onChange(() => { throw new Error("listener"); });
    cache.onChange((p) => seen.push(p));
    await cache.get(file("a.md"));
    expect(seen.length).toBeGreaterThan(0);
    err.mockRestore();
  });
});
