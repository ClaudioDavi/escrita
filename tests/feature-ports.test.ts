import { describe, expect, it } from "vitest";
import { port } from "../src/core/feature-ports";
import { pendingOf, type PendingSource } from "../src/core/pending";

const registry = (mods: Record<string, unknown>) => ({
  get: <T>(id: string) => mods[id] as T | undefined,
  isOn: (id: string) => id in mods,
});

describe("port", () => {
  it("returns the loaded module's port", () => {
    const writingMode = { isActive: () => false };
    const desk = { writingMode };
    expect(port(registry({ desk }), "desk")).toBe(desk);
    expect(port(registry({ desk }), "desk")?.writingMode).toBe(writingMode);
  });
  it("is undefined when the feature is off", () => {
    expect(port(registry({}), "goals")).toBeUndefined();
    expect(port(registry({}), "publish")).toBeUndefined();
  });
});

describe("pendingOf", () => {
  const pending = { list: () => [], onChange: () => () => {} } as PendingSource;
  it("reads the pending list while submissions is on", () => {
    expect(pendingOf(registry({ submissions: { pending } }))).toBe(pending);
  });
  it("is null when off or without a list", () => {
    expect(pendingOf(registry({}))).toBeNull();
    expect(pendingOf(registry({ submissions: {} }))).toBeNull();
  });
});
