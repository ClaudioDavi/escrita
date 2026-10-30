// notes.frontmatter saves every view of the file, then writes the properties (rule 1).
import { describe, expect, it } from "vitest";
import { MarkdownView, TFile } from "./support/obsidian";
import { NoteService } from "../src/core/notes";

type View = { path: string; mode: string };

function setup(views: View[], opts: { saveFails?: boolean; writeFails?: boolean } = {}) {
  const calls: string[] = [];
  const fm: Record<string, unknown> = {};
  const leaves = views.map((v) => ({
    view: Object.assign(new MarkdownView(), {
      file: { path: v.path },
      getMode: () => v.mode,
      save: async () => {
        if (opts.saveFails) throw new Error("save failed");
        calls.push(`save ${v.path} ${v.mode}`);
      },
    }),
  }));
  const app = {
    workspace: { getLeavesOfType: () => leaves },
    fileManager: {
      processFrontMatter: async (f: { path: string }, fn: (x: Record<string, unknown>) => void) => {
        if (opts.writeFails) throw new Error("write failed");
        calls.push(`write ${f.path}`);
        fn(fm);
      },
    },
  };
  const notes = new NoteService(app as never);
  const a = Object.assign(new TFile(), { path: "A.md" });
  return { notes, a: a as never, calls, fm };
}

describe("NoteService.frontmatter", () => {
  it("saves the file's views, then writes", async () => {
    const { notes, a, calls, fm } = setup([{ path: "A.md", mode: "source" }]);
    await notes.frontmatter(a, (x) => { x.status = "x"; });
    expect(calls).toEqual(["save A.md source", "write A.md"]);
    expect(fm.status).toBe("x");
  });

  it("saves every view of the file in any mode, and only that file's", async () => {
    const { notes, a, calls } = setup([
      { path: "A.md", mode: "source" },
      { path: "A.md", mode: "preview" },
      { path: "B.md", mode: "source" },
    ]);
    await notes.frontmatter(a, () => {});
    expect(calls).toEqual(["save A.md source", "save A.md preview", "write A.md"]);
  });

  it("no open view: writes straight", async () => {
    const { notes, a, calls } = setup([]);
    await notes.frontmatter(a, () => {});
    expect(calls).toEqual(["write A.md"]);
  });

  it("a failed save writes nothing", async () => {
    const { notes, a, calls } = setup([{ path: "A.md", mode: "source" }], { saveFails: true });
    await expect(notes.frontmatter(a, () => {})).rejects.toThrow("save failed");
    expect(calls.some((c) => c.startsWith("write"))).toBe(false);
  });

  it("a failed write is passed on", async () => {
    const { notes, a } = setup([], { writeFails: true });
    await expect(notes.frontmatter(a, () => {})).rejects.toThrow("write failed");
  });
});
