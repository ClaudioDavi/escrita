import { describe, expect, it, vi } from "vitest";
import { dispatchWithRetry } from "../src/core/dispatch-retry";

const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("dispatchWithRetry", () => {
  it("dispatches once when it works", async () => {
    const dispatch = vi.fn();
    const drop = vi.fn();
    dispatchWithRetry({ dispatch }, () => "a", () => true, drop);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });

  it("retries once after a failure and keeps the editor when the retry works", async () => {
    const dispatch = vi.fn().mockImplementationOnce(() => { throw new Error("mid-update"); });
    const drop = vi.fn();
    dispatchWithRetry({ dispatch }, () => "a", () => true, drop);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(drop).not.toHaveBeenCalled();
  });

  it("drops only when the retry fails too, and never throws", async () => {
    const err = new Error("gone");
    const dispatch = vi.fn(() => { throw err; });
    const drop = vi.fn();
    expect(() => dispatchWithRetry({ dispatch }, () => "a", () => true, drop)).not.toThrow();
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(drop).toHaveBeenCalledWith(err);
  });

  it("does not retry an editor that was destroyed meanwhile", async () => {
    const dispatch = vi.fn(() => { throw new Error("x"); });
    const drop = vi.fn();
    dispatchWithRetry({ dispatch }, () => "a", () => false, drop);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });
});
