// Publishing and unpublishing write the properties with processFrontMatter, which reads the disk:
// the note's editor is saved first (notes.flush), or the typing it holds is replaced (rule 1).
import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { PublishModule } from "../src/publish";
import { fakePlugin } from "./support/fake-plugin";

function setup() {
  const plugin = fakePlugin();
  const calls: string[] = [];
  const fm: Record<string, unknown> = { status: "ready" };
  plugin.notes = { flush: async () => { calls.push("flush"); } };
  (plugin.app as unknown as Record<string, unknown>).fileManager = {
    processFrontMatter: async (_f: unknown, fn: (x: Record<string, unknown>) => void) => { calls.push("write"); fn(fm); },
  };
  plugin.features = { isOn: () => false };
  const module = new PublishModule(plugin.asPlugin);
  const file = Object.assign(new TFile(), { path: "Contos/A.md", basename: "A" });
  return { plugin, module, file, calls, fm };
}

describe("publish saves the editor before it writes the properties", () => {
  it("publish: flush, then write", async () => {
    const { module, file, calls } = setup();
    const ok = await (module as unknown as { publish(f: TFile, d: string, c: boolean, t: string): Promise<boolean> }).publish(file, "2026-01-02", false, "2026-01-02");
    expect(ok).toBe(true);
    expect(calls).toEqual(["flush", "write"]);
  });

  it("publish: a failed flush writes nothing", async () => {
    const { plugin, module, file, calls } = setup();
    plugin.notes = { flush: async () => { throw new Error("no"); } };
    const ok = await (module as unknown as { publish(f: TFile, d: string, c: boolean, t: string): Promise<boolean> }).publish(file, "2026-01-02", false, "2026-01-02");
    expect(ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("unpublish: flush, then write", async () => {
    const { plugin, module, file, calls } = setup();
    (module as unknown as { published(f: TFile): boolean }).published = () => true;
    await module.unpublish(file);
    expect(calls).toEqual(["flush", "write"]);
  });
});
