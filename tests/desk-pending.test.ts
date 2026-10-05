import { describe, expect, it } from "vitest";
import type { PendingSubmission } from "../src/core/pending";
import { buildDesk, buildPending, countBar, type WorkSource } from "../src/desk/works";

const sub = (path: string, workPath: string | null, market = "Revista", sent: string | null = "2026-10-05"): PendingSubmission =>
  ({ path, workPath, workTitle: workPath ?? "?", market, sent });
const work = (path: string, stage: WorkSource["stage"]): WorkSource =>
  ({ path, role: "note", stage, title: path, count: 10, unit: "words", editedAt: 1 });

describe("pending count", () => {
  it("counts submissions, not works", () => {
    const p = buildPending([sub("s1", "a.md"), sub("s2", "a.md")]);
    expect(p?.n).toBe(2);
    expect(p?.items.map((i) => i.path)).toEqual(["s1", "s2"]);
  });
  it("is absent when there are none", () => {
    expect(buildPending([])).toBeUndefined();
    expect(buildDesk([work("a.md", "ready")]).pending).toBeUndefined();
  });
  it("keeps only submissions of kept works, unresolved ones drop out", () => {
    const p = buildPending([sub("s1", "a.md"), sub("s2", "b.md"), sub("s3", null)], new Set(["a.md"]));
    expect(p?.items.map((i) => i.path)).toEqual(["s1"]);
  });
  it("sits after ready", () => {
    const d = buildDesk([work("a", "idea"), work("b", "ready"), work("c", "published")], undefined, [sub("s", "b")]);
    expect(countBar(d).map((c) => c.key)).toEqual(["idea", "ready", "pending", "published"]);
  });
  it("sits after idea when nothing is ready, and last when nothing follows", () => {
    expect(countBar(buildDesk([work("a", "idea"), work("c", "published")], undefined, [sub("s", "a")])).map((c) => c.key))
      .toEqual(["idea", "pending", "published"]);
    expect(countBar(buildDesk([work("a", "ready")], undefined, [sub("s", "a")])).map((c) => c.key)).toEqual(["ready", "pending"]);
    expect(countBar(buildDesk([], undefined, [sub("s", "a")])).map((c) => c.key)).toEqual(["pending"]);
  });
});

import { pendingSource } from "../src/desk/gather";
import type { PendingSource } from "../src/core/pending";

describe("pendingSource", () => {
  const src: PendingSource = { list: () => [], onChange: () => () => {} };
  const plugin = (on: boolean, provided: unknown) =>
    ({ features: { isOn: (id: string) => id === "submissions" && on, get: () => provided } }) as never;
  it("reads the port only while the feature is on", () => {
    expect(pendingSource(plugin(true, { pending: src }))).toBe(src);
    expect(pendingSource(plugin(false, { pending: src }))).toBeNull();
  });
  it("is null when the module provides nothing", () => {
    expect(pendingSource(plugin(true, undefined))).toBeNull();
    expect(pendingSource(plugin(true, {}))).toBeNull();
  });
});
