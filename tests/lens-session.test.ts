import { describe, expect, it } from "vitest";
import { LENS_SETTLE_MS, LensSession } from "../src/lens/session";
import type { LensResult } from "../src/lens/types";
import { ManualTimers } from "./support/memory-vault";

function fakeResult(version: number): LensResult {
	return { version } as unknown as LensResult;
}

function make(settleMs = LENS_SETTLE_MS, analyzeImpl?: (t: string, v: number, path?: string) => LensResult) {
	const timers = new ManualTimers();
	const calls: { text: string; version: number }[] = [];
	const paths: string[] = [];
	const analyze = (path: string, text: string, version: number) => {
		calls.push({ text, version });
		paths.push(path);
		return analyzeImpl ? analyzeImpl(text, version, path) : fakeResult(version);
	};
	const session = new LensSession({ timers, settleMs, analyze });
	const results: [string, LensResult][] = [];
	session.onResult((p, r) => results.push([p, r]));
	return { timers, calls, paths, session, results };
}

describe("LensSession", () => {
	it("a burst of changes gives one analyze call", async () => {
		const { timers, calls, session, results } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "one");
		await timers.advance(100);
		session.changed("a.md", () => "two");
		await timers.advance(100);
		const v = session.changed("a.md", () => "three");
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toEqual([{ text: "three", version: v }]);
		expect(results).toHaveLength(1);
		expect(session.result("a.md")?.version).toBe(v);
	});

	it("after a pass, invalidate reads the kept text, not the editor's reader", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		let reads = 0;
		session.changed("a.md", () => { reads++; return "text"; });
		await timers.advance(LENS_SETTLE_MS);
		session.invalidate();
		expect(reads).toBe(1);
		expect(calls.map((c) => c.text)).toEqual(["text", "text"]);
	});
	it("never analyzes a path that is off", async () => {
		const { timers, calls, session } = make();
		session.changed("a.md", () => "x");
		await timers.advance(LENS_SETTLE_MS * 3);
		expect(calls).toHaveLength(0);
		expect(timers.count).toBe(0);
		expect(session.version("a.md")).toBe(1);
	});

	it("two panes interleaving changes give one analyze at the latest version", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "pane A");
		session.changed("a.md", () => "pane B");
		const v = session.changed("a.md", () => "pane A again");
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toEqual([{ text: "pane A again", version: 3 }]);
		expect(v).toBe(3);
		expect(session.result("a.md")?.version).toBe(3);
	});

	it("now with unchanged text does not analyze again", () => {
		const { calls, session } = make();
		const a = session.now("a.md", "text");
		const b = session.now("a.md", "text");
		expect(calls).toHaveLength(1);
		expect(b.version).toBe(session.version("a.md"));
		expect(a).toBeDefined();
		session.now("a.md", "other");
		expect(calls).toHaveLength(2);
	});

	it("a debounced run reuses the cache for identical text", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.now("a.md", "same");
		session.changed("a.md", () => "same");
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toHaveLength(1);
		expect(session.result("a.md")?.version).toBe(session.version("a.md"));
	});

	it("rename moves the on-state, the counter and a pending timer", async () => {
		const { timers, calls, session, results } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "x");
		session.changed("a.md", () => "y");
		session.renamed("a.md", "b.md");
		expect(session.isOn("a.md")).toBe(false);
		expect(session.isOn("b.md")).toBe(true);
		expect(session.version("b.md")).toBe(2);
		expect(session.version("a.md")).toBe(0);
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toEqual([{ text: "y", version: 2 }]);
		expect(results[0]?.[0]).toBe("b.md");
	});

	it("rename of a folder moves the notes inside", () => {
		const { session } = make();
		session.toggle("Dir/a.md");
		session.renamed("Dir", "Other");
		expect(session.isOn("Other/a.md")).toBe(true);
	});

	it("delete forgets state and cancels timers", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "x");
		session.deleted("a.md");
		await timers.advance(LENS_SETTLE_MS * 2);
		expect(calls).toHaveLength(0);
		expect(session.isOn("a.md")).toBe(false);
		expect(session.version("a.md")).toBe(0);
		expect(session.result("a.md")).toBeUndefined();
	});

	it("invalidate recomputes only paths that are on", () => {
		const { calls, session } = make();
		session.toggle("a.md");
		session.now("a.md", "A");
		session.now("b.md", "B"); // off
		calls.length = 0;
		session.invalidate();
		expect(calls.map((c) => c.text)).toEqual(["A"]);
		expect(session.result("b.md")).toBeUndefined();
		expect(session.result("a.md")?.version).toBe(session.version("a.md"));
	});

	it("drops a stale result", async () => {
		let session!: LensSession;
		const timers = new ManualTimers();
		const results: LensResult[] = [];
		let first = true;
		session = new LensSession({
			timers,
			settleMs: 10,
			analyze: (_p, _t, v) => {
				if (first) { first = false; session.changed("a.md", () => "newer"); }
				return fakeResult(v);
			},
		});
		session.onResult((_p, r) => results.push(r));
		session.toggle("a.md");
		session.changed("a.md", () => "older");
		await timers.advance(10);
		expect(results).toHaveLength(0);
		expect(session.result("a.md")).toBeUndefined();
		await timers.advance(10);
		expect(results).toHaveLength(1);
		expect(results[0]?.version).toBe(2);
	});

	it("dispose clears timers", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "x");
		session.dispose();
		expect(timers.count).toBe(0);
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toHaveLength(0);
	});

	it("honours settleMs", async () => {
		const { timers, calls, session } = make(800);
		session.toggle("a.md");
		session.changed("a.md", () => "x");
		await timers.advance(799);
		expect(calls).toHaveLength(0);
		await timers.advance(1);
		expect(calls).toHaveLength(1);
	});

	it("turning off cancels the pending pass and drops the result", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.changed("a.md", () => "x");
		expect(session.toggle("a.md")).toBe(false);
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toHaveLength(0);
		expect(session.result("a.md")).toBeUndefined();
	});

	it("invalidate leaves a pending pass to run on the latest text", async () => {
		const { timers, calls, session } = make();
		session.toggle("a.md");
		session.now("a.md", "old");
		calls.length = 0;
		const v = session.changed("a.md", () => "new text");
		session.invalidate();
		expect(calls).toEqual([]);
		await timers.advance(LENS_SETTLE_MS);
		expect(calls).toEqual([{ text: "new text", version: v }]);
		expect(session.result("a.md")?.version).toBe(v);
	});

	it("invalidate recomputes an idle note from its cached text", () => {
		const { calls, session } = make();
		session.toggle("a.md");
		session.now("a.md", "old");
		calls.length = 0;
		session.invalidate();
		expect(calls.map((c) => c.text)).toEqual(["old"]);
	});
});

// "Lens marks can stay on an old result" (IMPROVEMENTS, 0.5.1): a list or settings
// change must reach every note that is on; no result computed under older options
// may be reused, cached or shown after it.
describe("LensSession after an options change", () => {
	/** A session whose results carry the options they were computed under. */
	function tagged() {
		const timers = new ManualTimers();
		const o = { opts: "old", fail: new Set<string>() };
		const session = new LensSession({
			timers, settleMs: LENS_SETTLE_MS,
			analyze: (_p, text, version) => {
				if (o.fail.has(text)) throw new Error("boom");
				return { version, opts: o.opts, text } as unknown as LensResult;
			},
		});
		const optsOf = (p: string) => (session.result(p) as unknown as { opts: string } | undefined)?.opts;
		return { timers, o, session, optsOf };
	}

	it("now() with unchanged text gives a result under the new options", () => {
		const { o, session, optsOf } = tagged();
		session.toggle("a.md");
		session.now("a.md", "T");
		o.opts = "new";
		session.invalidate();
		expect((session.now("a.md", "T") as unknown as { opts: string }).opts).toBe("new");
		expect(optsOf("a.md")).toBe("new");
	});

	it("a pending pass on the cached text runs under the new options", async () => {
		const { timers, o, session, optsOf } = tagged();
		session.toggle("a.md");
		session.now("a.md", "T");
		session.changed("a.md", () => "T");
		o.opts = "new";
		session.invalidate();
		expect(session.result("a.md")).toBeUndefined();
		await timers.advance(LENS_SETTLE_MS);
		expect(optsOf("a.md")).toBe("new");
	});

	it("a list read mid-edit is replaced by the next one", () => {
		const { o, session, optsOf } = tagged();
		session.toggle("a.md");
		session.now("a.md", "T");
		o.opts = "Marian";
		session.invalidate();
		expect(optsOf("a.md")).toBe("Marian");
		o.opts = "Mariana";
		session.invalidate();
		expect(optsOf("a.md")).toBe("Mariana");
	});

	it("a pass that fails during invalidate does not leave other notes on old options", async () => {
		const { timers, o, session, optsOf } = tagged();
		session.toggle("a.md");
		session.toggle("b.md");
		session.now("a.md", "A");
		session.now("b.md", "B");
		o.opts = "new";
		o.fail.add("A");
		expect(() => session.invalidate()).toThrow("boom");
		expect(optsOf("b.md")).toBe("new");
		expect(session.result("a.md")).toBeUndefined();
		// b's next pass on the same text must not bring back an old-options result
		session.changed("b.md", () => "B");
		await timers.advance(LENS_SETTLE_MS);
		expect(optsOf("b.md")).toBe("new");
	});

	it("a note whose result was dropped is recomputed by the next invalidate", () => {
		const { o, session, optsOf } = tagged();
		session.toggle("a.md");
		session.now("a.md", "A");
		o.fail.add("A");
		o.opts = "mid";
		expect(() => session.invalidate()).toThrow();
		expect(session.result("a.md")).toBeUndefined();
		o.fail.clear();
		o.opts = "final";
		session.invalidate();
		expect(optsOf("a.md")).toBe("final");
	});

	it("invalidate recomputes from the latest text the session was given", async () => {
		const { timers, o, session } = tagged();
		session.toggle("a.md");
		session.now("a.md", "first");
		session.changed("a.md", () => "second");
		await timers.advance(LENS_SETTLE_MS);
		o.opts = "new";
		session.invalidate();
		expect(session.cachedText("a.md")).toBe("second");
		expect((session.result("a.md") as unknown as { text: string }).text).toBe("second");
	});

	it("bumps the generation on every invalidate", () => {
		const { session } = tagged();
		const g = session.generation();
		session.invalidate();
		expect(session.generation()).toBe(g + 1);
	});
});

describe("LensSession.onInvalidate", () => {
	it("is called after the passes, even when one fails", () => {
		const timers = new ManualTimers();
		const order: string[] = [];
		const session = new LensSession({
			timers, settleMs: 10,
			analyze: (_p, text, version) => {
				if (order.includes("ready") && text === "bad") throw new Error("boom");
				order.push("analyze " + text);
				return { version } as unknown as LensResult;
			},
		});
		session.toggle("a.md");
		session.toggle("b.md");
		session.now("a.md", "bad");
		session.now("b.md", "ok");
		order.length = 0;
		order.push("ready");
		session.onInvalidate(() => order.push("invalidated"));
		expect(() => session.invalidate()).toThrow("boom");
		expect(order).toEqual(["ready", "analyze ok", "invalidated"]);
	});

	it("a different path is analyzed with its own path (per-scope names)", () => {
		const { paths, session } = make();
		session.toggle("a.md");
		session.toggle("b.md");
		session.now("a.md", "same");
		session.now("b.md", "same");
		expect(paths).toEqual(["a.md", "b.md"]);
	});

	it("an invalidate (a names version bump) re-runs a note that is on", () => {
		const { paths, session } = make();
		session.toggle("a.md");
		session.now("a.md", "text");
		session.invalidate();
		expect(paths).toEqual(["a.md", "a.md"]);
	});
});
