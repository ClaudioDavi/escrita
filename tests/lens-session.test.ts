import { describe, expect, it } from "vitest";
import { LENS_SETTLE_MS, LensSession } from "../src/lens/session";
import type { LensResult } from "../src/lens/types";
import { ManualTimers } from "./support/memory-vault";

function fakeResult(version: number): LensResult {
	return { version } as unknown as LensResult;
}

function make(settleMs = LENS_SETTLE_MS, analyzeImpl?: (t: string, v: number) => LensResult) {
	const timers = new ManualTimers();
	const calls: { text: string; version: number }[] = [];
	const analyze = (text: string, version: number) => {
		calls.push({ text, version });
		return analyzeImpl ? analyzeImpl(text, version) : fakeResult(version);
	};
	const session = new LensSession({ timers, settleMs, analyze });
	const results: [string, LensResult][] = [];
	session.onResult((p, r) => results.push([p, r]));
	return { timers, calls, session, results };
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
			analyze: (_t, v) => {
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
