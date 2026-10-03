import { describe, expect, it } from "vitest";
import { fakePlugin } from "./support/fake-plugin";

describe("the fake plugin", () => {
  it("records listeners on workspace, vault and metadataCache and counts the live ones", () => {
    const p = fakePlugin();
    const { workspace, vault, metadataCache } = p.app;
    const seen: string[] = [];
    const a = workspace.on("file-open", () => seen.push("w"));
    const b = vault.on("rename", () => seen.push("v"));
    metadataCache.on("changed", () => seen.push("m"));
    expect(p.liveListeners()).toBe(3);
    workspace.trigger("file-open");
    vault.trigger("rename");
    metadataCache.trigger("changed");
    expect(seen).toEqual(["w", "v", "m"]);
    a.off();
    vault.offref(b);
    expect(p.liveListeners()).toBe(1);
    workspace.trigger("file-open");
    expect(seen).toHaveLength(3);
  });

  it("registerEvent on the component ends the listener when the component unloads", () => {
    const p = fakePlugin();
    p.load();
    p.registerEvent(p.app.vault.on("create", () => {}));
    expect(p.liveListeners()).toBe(1);
    p.unload();
    expect(p.liveListeners()).toBe(0);
  });

  it("answers the lookups tests set up and nothing else", () => {
    const p = fakePlugin();
    const file = { path: "a.md" };
    expect(p.app.vault.getAbstractFileByPath("a.md")).toBeNull();
    p.app.vault.files.set("a.md", file);
    expect(p.app.vault.getAbstractFileByPath("a.md")).toBe(file);
    p.app.metadataCache.caches.set("a.md", { frontmatter: { x: 1 } });
    expect(p.app.metadataCache.getFileCache(file)).toEqual({ frontmatter: { x: 1 } });
    expect(p.app.metadataCache.getFileCache(null)).toBeNull();
    expect(p.app.workspace.getActiveViewOfType()).toBeNull();
    p.app.workspace.activeView = { v: 1 };
    expect(p.app.workspace.getActiveViewOfType()).toEqual({ v: 1 });
    const leaves: unknown[] = [];
    p.app.workspace.allLeaves.push(1, 2);
    p.app.workspace.iterateAllLeaves((l) => leaves.push(l));
    expect(leaves).toEqual([1, 2]);
  });

  it("index.add returns a handle with get, onChange, onReady and dispose", () => {
    const p = fakePlugin();
    const h = p.index.add({ name: "x" });
    h.values.set("a.md", 1);
    expect(h.get("a.md")).toBe(1);
    const changes: unknown[] = [];
    let ready = 0;
    h.onChange((c) => changes.push(...c));
    h.onReady(() => ready++);
    h.emitChange([1, 2]);
    expect(changes).toEqual([1, 2]);
    expect(ready).toBe(0);
    h.becomeReady();
    expect(ready).toBe(1);
    h.onReady(() => ready++);
    expect(ready).toBe(2);
    h.dispose();
    h.emitChange([3]);
    expect(changes).toEqual([1, 2]);
    expect(h.disposed).toBe(true);
    p.index.remove(h);
    expect(p.indexRemoved).toEqual([h]);
  });
});
