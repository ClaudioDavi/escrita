// Publishing and unpublishing write the properties through notes.frontmatter. The save-first order
// (rule 1) belongs to NoteService and is tested in notes-frontmatter.test.ts.
import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { PublishModule } from "../src/publish";
import { fakePlugin } from "./support/fake-plugin";

function setup() {
  const plugin = fakePlugin();
  const calls: string[] = [];
  const fm: Record<string, unknown> = { status: "ready" };
  plugin.notes = { frontmatter: async (_f: unknown, fn: (x: Record<string, unknown>) => void) => { calls.push("frontmatter"); fn(fm); } };
  plugin.features = { isOn: () => false };
  const module = new PublishModule(plugin.asPlugin);
  const file = Object.assign(new TFile(), { path: "Contos/A.md", basename: "A" });
  return { plugin, module, file, calls, fm };
}

type Publish = { publish(f: TFile, d: string, c: boolean, t: string): Promise<boolean> };

describe("publish writes the properties through notes.frontmatter", () => {
  it("publish writes through notes.frontmatter", async () => {
    const { module, file, calls, fm } = setup();
    const ok = await (module as unknown as Publish).publish(file, "2026-01-02", false, "2026-01-02");
    expect(ok).toBe(true);
    expect(calls).toEqual(["frontmatter"]);
    expect(fm.status).not.toBe("ready");
  });

  it("a failed property write publishes nothing", async () => {
    const { plugin, module, file } = setup();
    plugin.notes = { frontmatter: async () => { throw new Error("no"); } };
    const ok = await (module as unknown as Publish).publish(file, "2026-01-02", false, "2026-01-02");
    expect(ok).toBe(false);
    expect(plugin.data.publish?.[file.path]).toBeUndefined();
  });

  it("unpublish writes through notes.frontmatter", async () => {
    const { module, file, calls } = setup();
    (module as unknown as { published(f: TFile): boolean }).published = () => true;
    await module.unpublish(file);
    expect(calls).toEqual(["frontmatter"]);
  });
});
