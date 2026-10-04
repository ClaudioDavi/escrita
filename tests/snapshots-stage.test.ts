import { describe, it, expect, beforeEach } from "vitest";
import { StageWatch, STAGE_SETTLE_MS, transitionName, stageTakeTargets } from "../src/snapshots/stage-watch";
import type { DeskEntry, DeskRole } from "../src/core/works";
import type { Stage } from "../src/core/stages";
import type { IndexChange, IndexTimers } from "../src/core/vault-index";

class FakeTimers implements IndexTimers {
	clock = 0;
	now(): number { return this.clock; }
	private next = 1;
	private pending = new Map<number, { at: number; cb: () => void }>();
	set(cb: () => void, ms: number): unknown {
		const id = this.next++;
		this.pending.set(id, { at: this.clock + ms, cb });
		return id;
	}
	clear(h: unknown): void { this.pending.delete(h as number); }
	async yieldNow(): Promise<void> {}
	count(): number { return this.pending.size; }
	advance(ms: number): void {
		const end = this.clock + ms;
		for (;;) {
			let best: [number, { at: number; cb: () => void }] | null = null;
			for (const e of this.pending) if (e[1].at <= end && (!best || e[1].at < best[1].at)) best = e;
			if (!best) break;
			this.pending.delete(best[0]);
			this.clock = best[1].at;
			best[1].cb();
		}
		this.clock = end;
	}
}

const e = (stage: Stage | null, role: DeskRole = "note"): DeskEntry => ({ role, stage, title: "t" });

describe("StageWatch", () => {
	let timers: FakeTimers;
	let store: Map<string, DeskEntry>;
	let calls: [string, Stage, Stage][];
	let w: StageWatch;
	const build = () => [...store.entries()].map(([path, after]): IndexChange<DeskEntry> => ({ path, after, cause: "build" }));
	const set = (p: string, en: DeskEntry | undefined) => {
		const before = store.get(p);
		if (en) store.set(p, en); else store.delete(p);
		w.handle([{ path: p, before, after: en, cause: "update" }]);
	};

	beforeEach(() => {
		timers = new FakeTimers();
		store = new Map();
		calls = [];
		w = new StageWatch({
			timers,
			current: (p) => store.get(p),
			all: () => store.entries(),
			onTransition: (p, f, t) => calls.push([p, f, t]),
		});
	});

	function seed(entries: Record<string, DeskEntry>) {
		for (const [k, v] of Object.entries(entries)) store.set(k, v);
		w.handle(build());
	}

	it("takes one transition after the settle window", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		timers.advance(STAGE_SETTLE_MS - 1);
		expect(calls).toEqual([]);
		timers.advance(1);
		expect(calls).toEqual([["a.md", "draft", "revision"]]);
	});

	it("takes none when a path becomes a work or on build", () => {
		seed({ "a.md": e("draft") });
		set("b.md", e("draft"));
		timers.advance(10000);
		expect(calls).toEqual([]);
		store.set("a.md", e("revision"));
		w.handle(build());
		timers.advance(10000);
		expect(calls).toEqual([]);
	});

	it("draft, null, revision gives one transition", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e(null));
		timers.advance(5000);
		set("a.md", e("revision"));
		timers.advance(5000);
		expect(calls).toEqual([["a.md", "draft", "revision"]]);
	});

	it("a broken yaml window gives none", () => {
		seed({ "a.md": e("draft") });
		set("a.md", undefined);
		timers.advance(5000);
		set("a.md", e("draft"));
		timers.advance(5000);
		expect(calls).toEqual([]);
	});

	it("a rebuild where only A changes keeps B's last stage", () => {
		seed({ "a.md": e("draft"), "b.md": e("draft") });
		store.set("a.md", e("revision"));
		w.handle(build());
		timers.advance(5000);
		expect(calls).toEqual([]);
		set("b.md", e("ready"));
		timers.advance(5000);
		expect(calls).toEqual([["b.md", "draft", "ready"]]);
	});

	it("a rebuild does not reseed a path with a pending timer", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		timers.advance(1000);
		w.handle(build());
		timers.advance(STAGE_SETTLE_MS);
		expect(calls).toEqual([["a.md", "draft", "revision"]]);
	});

	it("an update followed by a build within 3 s gives one transition", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		timers.advance(1000);
		w.handle(build());
		timers.advance(5000);
		expect(calls.length).toBe(1);
	});

	it("repeated updates re-arm the timer", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		timers.advance(2000);
		set("a.md", e("ready"));
		timers.advance(2000);
		expect(calls).toEqual([]);
		timers.advance(1000);
		expect(calls).toEqual([["a.md", "draft", "ready"]]);
	});

	it("an unseeded path is recorded silently, then transitions", () => {
		set("a.md", e("draft"));
		timers.advance(5000);
		expect(calls).toEqual([]);
		set("a.md", e("revision"));
		timers.advance(5000);
		expect(calls).toEqual([["a.md", "draft", "revision"]]);
	});

	it("ignores chapter and unstaged updates", () => {
		seed({ "c.md": e("draft", "chapter") });
		set("c.md", e("ready", "chapter"));
		expect(timers.count()).toBe(0);
		set("u.md", e(null, "unstaged"));
		expect(timers.count()).toBe(0);
	});

	it("book notes re-arm too", () => {
		seed({ "B/B.md": e("draft", "book") });
		set("B/B.md", e("revision", "book"));
		timers.advance(3000);
		expect(calls).toEqual([["B/B.md", "draft", "revision"]]);
	});

	it("rename moves the last stage", () => {
		seed({ "a.md": e("draft") });
		const en = store.get("a.md")!;
		store.delete("a.md");
		store.set("b.md", en);
		w.handle([{ path: "b.md", from: "a.md", before: en, after: en, cause: "rename" }]);
		set("b.md", e("revision"));
		timers.advance(3000);
		expect(calls).toEqual([["b.md", "draft", "revision"]]);
	});

	it("rename during the settle window moves the timer", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		timers.advance(1000);
		const en = store.get("a.md")!;
		store.delete("a.md");
		store.set("b.md", en);
		w.handle([{ path: "b.md", from: "a.md", before: en, after: en, cause: "rename" }]);
		timers.advance(5000);
		expect(calls).toEqual([["b.md", "draft", "revision"]]);
	});

	it("a folder rename moves keys under it", () => {
		seed({ "F/a.md": e("draft") });
		const en = store.get("F/a.md")!;
		store.delete("F/a.md");
		store.set("G/a.md", en);
		w.handle([{ path: "G", from: "F", cause: "rename" }]);
		set("G/a.md", e("revision"));
		timers.advance(3000);
		expect(calls).toEqual([["G/a.md", "draft", "revision"]]);
	});

	it("delete forgets the path and clears its timer", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		store.delete("a.md");
		w.handle([{ path: "a.md", cause: "delete" }]);
		expect(timers.count()).toBe(0);
		timers.advance(5000);
		set("a.md", e("ready"));
		timers.advance(5000);
		expect(calls).toEqual([]);
	});

	it("dispose clears timers", () => {
		seed({ "a.md": e("draft") });
		set("a.md", e("revision"));
		w.dispose();
		timers.advance(5000);
		expect(calls).toEqual([]);
		expect(timers.count()).toBe(0);
	});
});

describe("transitionName", () => {
	const pt: Record<Stage, string> = { idea: "ideia", draft: "rascunho", revision: "revisão", ready: "pronto", published: "publicado" };
	it("joins the canonical words", () => {
		expect(transitionName("draft", "revision", (s) => pt[s])).toBe("rascunho → revisão");
	});
	it("falls back to the id on an empty word", () => {
		expect(transitionName("draft", "revision", (s) => (s === "draft" ? "" : "revisão"))).toBe("draft → revisão");
	});
});

describe("stageTakeTargets", () => {
	it("a book takes the note and every chapter", () => {
		expect(stageTakeTargets("B", "book", ["c1", "c2"])).toEqual(["B", "c1", "c2"]);
	});
	it("a note takes only itself", () => {
		expect(stageTakeTargets("N", "note", ["c1"])).toEqual(["N"]);
		expect(stageTakeTargets("N", "unstaged", [])).toEqual(["N"]);
	});
});
