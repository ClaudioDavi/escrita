import { describe, expect, it } from "vitest";
import {
	dropFromMap,
	dropFromSet,
	dropKeys,
	isUnder,
	movedPath,
	renameInMap,
	renameInSet,
	renameKeys,
} from "../src/core/path-keys";

describe("movedPath / isUnder", () => {
	it("moves an exact key", () => {
		expect(movedPath("Contos/A.md", "Contos/A.md", "Contos/B.md")).toBe("Contos/B.md");
	});
	it("moves a key under a folder", () => {
		expect(movedPath("Contos/A/1.md", "Contos/A", "Textos/A")).toBe("Textos/A/1.md");
	});
	it("leaves a sibling with a shared prefix alone", () => {
		expect(movedPath("Contos/AB.md", "Contos/A", "Contos/Z")).toBeNull();
		expect(isUnder("Contos/AB", "Contos/A")).toBe(false);
		expect(isUnder("Contos/A/x", "Contos/A")).toBe(true);
		expect(isUnder("Contos/A", "Contos/A")).toBe(true);
	});
	it("treats the empty path as a no-op", () => {
		expect(movedPath("a.md", "", "b")).toBeNull();
		expect(isUnder("a.md", "")).toBe(false);
		expect(isUnder("", "")).toBe(false);
	});
	it("keeps NFD and NBSP byte for byte", () => {
		const nfd = "Capítulo.md";
		expect(movedPath(nfd, "Capítulo.md", "x.md")).toBeNull();
		expect(movedPath(nfd, nfd, "x.md")).toBe("x.md");
		const nb = "A B.md";
		expect(movedPath(nb, "A B.md", "x.md")).toBeNull();
		expect(movedPath(nb, nb, "x.md")).toBe("x.md");
	});
});

describe("renameKeys / dropKeys", () => {
	it("renames an exact key and reports it", () => {
		const r = { "a.md": 1, "b.md": 2 };
		expect(renameKeys(r, "a.md", "c.md")).toBe(true);
		expect(r).toEqual({ "c.md": 1, "b.md": 2 });
		expect(renameKeys(r, "zzz.md", "q.md")).toBe(false);
	});
	it("renames by folder prefix, sibling untouched", () => {
		const r = { "Contos/A/1.md": 1, "Contos/A/2.md": 2, "Contos/AB/1.md": 3 };
		expect(renameKeys(r, "Contos/A", "Textos/A")).toBe(true);
		expect(r).toEqual({ "Textos/A/1.md": 1, "Textos/A/2.md": 2, "Contos/AB/1.md": 3 });
	});
	it("folder event then child events is a no-op; children only gives the same result", () => {
		const a = { "F/1.md": 1, "F/2.md": 2 };
		renameKeys(a, "F", "G");
		expect(renameKeys(a, "F/1.md", "G/1.md")).toBe(false);
		expect(renameKeys(a, "F/2.md", "G/2.md")).toBe(false);
		const b = { "F/1.md": 1, "F/2.md": 2 };
		renameKeys(b, "F/1.md", "G/1.md");
		renameKeys(b, "F/2.md", "G/2.md");
		expect(b).toEqual(a);
	});
	it("moved value wins a collision by default", () => {
		const r = { "a.md": 1, "b.md": 2 };
		renameKeys(r, "a.md", "b.md");
		expect(r).toEqual({ "b.md": 1 });
	});
	it("merges on collision", () => {
		const sum = { "a.md": 3, "b.md": 4 };
		renameKeys(sum, "a.md", "b.md", (m, e) => m + e);
		expect(sum).toEqual({ "b.md": 7 });
		const newest = { "a.md": { at: 5 }, "b.md": { at: 9 } };
		renameKeys(newest, "a.md", "b.md", (m, e) => (m.at >= e.at ? m : e));
		expect(newest).toEqual({ "b.md": { at: 9 } });
	});
	it("does not merge a key into itself", () => {
		const r = { "a.md": 1 };
		expect(renameKeys(r, "a.md", "a.md", (m, e) => m + e)).toBe(false);
		expect(r).toEqual({ "a.md": 1 });
	});
	it("guards the root", () => {
		const r = { "a.md": 1 };
		expect(renameKeys(r, "", "x")).toBe(false);
		expect(dropKeys(r, "")).toBe(false);
		expect(r).toEqual({ "a.md": 1 });
	});
	it("keeps odd keys byte for byte", () => {
		const nfd = "Capí.md";
		const r: Record<string, number> = { [nfd]: 1, "Capí.md": 2 };
		renameKeys(r, nfd, "x.md");
		expect(r).toEqual({ "x.md": 1, "Capí.md": 2 });
	});
	it("drops exact and prefix keys", () => {
		const r = { "F": 0, "F/1.md": 1, "F/s/2.md": 2, "FF/3.md": 3 };
		expect(dropKeys(r, "F")).toBe(true);
		expect(r).toEqual({ "FF/3.md": 3 });
		expect(dropKeys(r, "F")).toBe(false);
	});
});

describe("Map variants", () => {
	it("renames, merges and drops", () => {
		const m = new Map([["F/1.md", 1], ["F/2.md", 2], ["G/1.md", 10], ["FF.md", 5]]);
		expect(renameInMap(m, "F", "G", (a, b) => a + b)).toBe(true);
		expect([...m.entries()].sort()).toEqual([["FF.md", 5], ["G/1.md", 11], ["G/2.md", 2]]);
		expect(renameInMap(m, "F", "G")).toBe(false);
		expect(dropFromMap(m, "G")).toBe(true);
		expect([...m.keys()]).toEqual(["FF.md"]);
		expect(dropFromMap(m, "G")).toBe(false);
		expect(renameInMap(m, "", "x")).toBe(false);
	});
});

describe("Set variants", () => {
	it("renames and drops", () => {
		const s = new Set(["F/1.md", "F/2.md", "FF.md", "G/1.md"]);
		expect(renameInSet(s, "F", "G")).toBe(true);
		expect([...s].sort()).toEqual(["FF.md", "G/1.md", "G/2.md"]);
		expect(renameInSet(s, "F/1.md", "G/1.md")).toBe(false);
	});
	it("a folder delete removes its children (dialogue focus)", () => {
		const s = new Set(["Book/ch1.md", "Book/ch2.md", "BookX/ch.md", "Book"]);
		expect(dropFromSet(s, "Book")).toBe(true);
		expect([...s]).toEqual(["BookX/ch.md"]);
		expect(dropFromSet(s, "Book")).toBe(false);
		expect(dropFromSet(s, "")).toBe(false);
	});
});
