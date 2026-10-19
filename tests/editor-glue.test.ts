import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { EditorSet, cmOf, fileOfState, isLivePreview } from "../src/ui/editor-glue";

const flush = () => new Promise<void>((r) => queueMicrotask(r));

function fakeView(dispatch: (spec: unknown) => void): EditorView {
  return { dispatch } as unknown as EditorView;
}

describe("EditorSet", () => {
  it("broadcasts to every editor", () => {
    const a = vi.fn();
    const b = vi.fn();
    const set = new EditorSet();
    set.add(fakeView(a));
    set.add(fakeView(b));
    set.broadcast({ effects: [] });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("builds a spec from the view when given a function", () => {
    const dispatch = vi.fn();
    const view = fakeView(dispatch);
    const set = new EditorSet();
    set.add(view);
    set.broadcast((v) => ({ userEvent: v === view ? "same" : "other" }));
    expect(dispatch).toHaveBeenCalledWith({ userEvent: "same" });
  });

  it("retries once after a failure and keeps the editor when the retry works", async () => {
    const dispatch = vi.fn().mockImplementationOnce(() => { throw new Error("mid-update"); });
    const view = fakeView(dispatch);
    const set = new EditorSet();
    const drop = vi.fn();
    set.add(view);
    set.broadcast({}, drop);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(set.has(view)).toBe(true);
    expect(drop).not.toHaveBeenCalled();
  });

  it("drops the editor and tells onDrop only after the second failure", async () => {
    const err = new Error("still busy");
    const dispatch = vi.fn(() => { throw err; });
    const view = fakeView(dispatch);
    const set = new EditorSet();
    const drop = vi.fn();
    set.add(view);
    expect(() => set.broadcast({}, drop)).not.toThrow();
    expect(set.has(view)).toBe(true);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(set.has(view)).toBe(false);
    expect(drop).toHaveBeenCalledWith(err);
  });

  it("does not retry an editor that left the set meanwhile", async () => {
    const dispatch = vi.fn(() => { throw new Error("busy"); });
    const view = fakeView(dispatch);
    const set = new EditorSet();
    set.add(view);
    set.broadcast({});
    set.delete(view);
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("one failing editor does not stop the others", () => {
    const ok = vi.fn();
    const set = new EditorSet();
    set.add(fakeView(() => { throw new Error("busy"); }));
    set.add(fakeView(ok));
    set.broadcast({});
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("send reaches one editor with the same policy", async () => {
    const dispatch = vi.fn().mockImplementationOnce(() => { throw new Error("busy"); });
    const view = fakeView(dispatch);
    const set = new EditorSet();
    set.add(view);
    set.send(view, { userEvent: "x" });
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("iterates over a copy, so a loop may drop editors", () => {
    const set = new EditorSet();
    const views = [fakeView(vi.fn()), fakeView(vi.fn()), fakeView(vi.fn())];
    views.forEach((v) => set.add(v));
    let n = 0;
    for (const v of set) { set.delete(v); n++; }
    expect(n).toBe(3);
    expect(set.size).toBe(0);
  });
});

describe("state helpers", () => {
  it("fileOfState is null when the state has no editor info", () => {
    expect(fileOfState(EditorState.create({ doc: "x" }))).toBeNull();
  });

  it("isLivePreview reads a state or a view", () => {
    const state = EditorState.create({ doc: "x" });
    expect(isLivePreview(state)).toBe(false);
    expect(isLivePreview({ state } as unknown as EditorView)).toBe(false);
  });

  it("cmOf gives the editor's cm or null", () => {
    const cm = {} as EditorView;
    expect(cmOf({ cm } as never)).toBe(cm);
    expect(cmOf({} as never)).toBeNull();
  });
});
