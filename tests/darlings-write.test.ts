import { describe, expect, it, vi } from "vitest";
import { TFile } from "./support/obsidian";
import { DarlingsModule } from "../src/darlings";
import { editorText, vaultText } from "../src/core/note-text";
import { appendEntry, formatEntry, parseEntries } from "../src/darlings/format";
import { fakePlugin } from "./support/fake-plugin";

const file = Object.assign(new TFile(), { path: "Darlings.md", basename: "Darlings", extension: "md" });
const meta = { id: "a1b2", from: "Conto.md", date: "2026-10-01", before: "", after: "", pre: "", post: "" };
const entry = formatEntry(meta, "cortado", "[[Conto]]");

function setup(port: "vault" | "editor", start: string) {
  let text = start;
  const processed = vi.fn();
  const io = port === "vault"
    ? vaultText({ read: async () => text, process: async (fn) => { processed(); text = fn(text); return text; } })
    : editorText({
        getValue: () => text,
        offsetToPos: (o) => ({ line: 0, ch: o }),
        transaction: ({ changes }) => { for (const c of changes) text = text.slice(0, c.from.ch) + c.text + text.slice(c.to.ch); },
      });
  const plugin = fakePlugin();
  plugin.notes = { text: () => io };
  const mod = new DarlingsModule(plugin.asPlugin) as unknown as {
    writeNote(n: TFile, f: (t: string) => string): Promise<void>;
    dropEntry(n: TFile, id: string, title: string): Promise<boolean>;
  };
  return { mod, get: () => text, processed };
}

describe("darlings writes go through the note text port", () => {
  for (const port of ["vault", "editor"] as const) {
    it(`appends an entry through the ${port} port, keeping the earlier text`, async () => {
      const { mod, get } = setup(port, "# Darlings\n");
      await mod.writeNote(file, (d) => appendEntry(d, entry));
      expect(get()).toBe(appendEntry("# Darlings\n", entry));
      expect(parseEntries(get()).map((e) => e.id)).toEqual(["a1b2"]);
    });

    it(`removes an entry by id through the ${port} port`, async () => {
      const { mod, get } = setup(port, appendEntry("# Darlings\n", entry));
      expect(await mod.dropEntry(file, "a1b2", "Conto")).toBe(true);
      expect(parseEntries(get())).toEqual([]);
      expect(get()).toContain("# Darlings");
    });
  }

  it("leaves the text alone when the id is absent", async () => {
    const start = appendEntry("# Darlings\n", entry);
    const { mod, get } = setup("vault", start);
    expect(await mod.dropEntry(file, "zzzz", "Conto")).toBe(true);
    expect(get()).toBe(start);
  });
});
