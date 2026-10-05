import { describe, expect, it, vi } from "vitest";
import * as measure from "../src/core/measure";
import { runChecks } from "../src/publish/checks";

describe("runChecks measures once", () => {
  it("reuses readiness's counts for the limit check", () => {
    const spy = vi.spyOn(measure, "measureText");
    const checks = runChecks("um dois tres", { limit: 2 }, {
      placeholderMarker: "XXX", recommendedProperties: [],
      piece: { targetProperty: "target", limitProperty: "limit", unitProperty: "unit" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(checks.find((c) => c.id === "overLimit")).toBeDefined();
    spy.mockRestore();
  });
});
