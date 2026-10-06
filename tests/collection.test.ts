import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { collectionOf } from "../src/core/collection";
import { collectionAt, collectionSource } from "../src/core/books";
import { DEFAULT_SETTINGS } from "../src/settings";

const names: Record<string, string> = { "A visita": "Contos/A visita.md", "1984": "Contos/1984.md", "Mar": "Contos/Mar.md" };
const resolve = (l: string) => names[l] ?? null;

describe("collectionOf", () => {
  it("is null without the property or with a wrong type", () => {
    expect(collectionOf({}, "contents", resolve)).toBeNull();
    expect(collectionOf(undefined, "contents", resolve)).toBeNull();
    expect(collectionOf({ contents: 3 }, "contents", resolve)).toBeNull();
    expect(collectionOf({ contents: { a: 1 } }, "contents", resolve)).toBeNull();
    expect(collectionOf({ contents: true }, "contents", resolve)).toBeNull();
  });
  it("is empty when the property has no value", () => {
    for (const v of [null, undefined, [], "", "  "]) expect(collectionOf({ contents: v }, "contents", resolve)).toEqual({ stories: [], missing: [] });
  });
  it("finds the property ignoring case", () => {
    expect(collectionOf({ Contents: ["[[Mar]]"] }, "contents", resolve)?.stories).toEqual(["Contos/Mar.md"]);
  });
  it("keeps order, strips alias and heading, accepts plain text", () => {
    const c = collectionOf({ contents: ["[[Mar]]", "[[A visita|a visita]]", "1984", "[[Mar#Parte]]"] }, "contents", resolve);
    expect(c).toEqual({ stories: ["Contos/Mar.md", "Contos/A visita.md", "Contos/1984.md"], missing: [] });
  });
  it("reads a single text value and nested lists from unquoted links", () => {
    expect(collectionOf({ contents: "[[Mar]]" }, "contents", resolve)?.stories).toEqual(["Contos/Mar.md"]);
    expect(collectionOf({ contents: "[[Mar]], [[A visita]] [[Nada]]" }, "contents", resolve)).toEqual({ stories: ["Contos/Mar.md", "Contos/A visita.md"], missing: ["Nada"] });
    expect(collectionOf({ contents: [["Mar"], ["A visita"]] }, "contents", resolve)?.stories).toEqual(["Contos/Mar.md", "Contos/A visita.md"]);
  });
  it("reports missing links once, in order, and skips blanks and non-text", () => {
    const c = collectionOf({ contents: ["[[Nada]]", "", "  ", 4, null, "[[Mar]]", "[[Nada|x]]", "[[Outro]]"] }, "contents", resolve);
    expect(c).toEqual({ stories: ["Contos/Mar.md"], missing: ["Nada", "Outro"] });
  });
  it("keeps a story listed twice once, at its first place", () => {
    const c = collectionOf({ contents: ["[[Mar]]", "[[A visita]]", "[[Mar]]", "Mar"] }, "contents", resolve);
    expect(c?.stories).toEqual(["Contos/Mar.md", "Contos/A visita.md"]);
  });
});

function setup(open = new Set<string>()) {
  const mk = (path: string, ext = "md", mtime = 4) => {
    const name = path.slice(path.lastIndexOf("/") + 1);
    return Object.assign(new TFile(), { path, name, basename: name.replace(new RegExp(`\\.${ext}$`), ""), extension: ext, stat: { ctime: 0, mtime, size: 0 } });
  };
  const coll = mk("Coletânea.md");
  const files = [coll, mk("Contos/A visita.md"), mk("Contos/1984.md"), mk("Contos/capa.png", "png")];
  const fm: Record<string, Record<string, unknown>> = {
    "Coletânea.md": { contents: ["[[1984]]", "[[A visita]]", "[[capa.png]]", "[[Coletânea]]", "[[Sumiu]]", "[[A visita]]"] },
    "Contos/1984.md": { compile: false },
  };
  const app = {
    vault: { getAbstractFileByPath: (p: string) => files.find((f) => f.path === p) ?? null },
    metadataCache: {
      getFileCache: (f: TFile) => (fm[f.path] ? { frontmatter: fm[f.path] } : null),
      getFirstLinkpathDest: (link: string, from: string) => {
        expect(from).toBe("Coletânea.md");
        return files.find((f) => f.name === link || f.basename === link) ?? null;
      },
    },
  };
  const notes = {
    editorView: (f: TFile) => (open.has(f.path) ? ({} as never) : null),
    text: () => ({ read: async () => (open.size ? "unsaved" : "saved") }) as never,
  };
  return { app: app as never, notes, coll, files };
}

describe("collectionAt and collectionSource", () => {
  const s = () => ({ collectionProperty: DEFAULT_SETTINGS.collectionProperty });
  it("resolves from the note; non-Markdown, itself and unknown links are missing", () => {
    const { app, coll } = setup();
    expect(collectionAt(app, coll, s)).toEqual({ stories: ["Contos/1984.md", "Contos/A visita.md"], missing: ["capa.png", "Coletânea", "Sumiu"] });
  });
  it("is null for a note without the property", () => {
    const { app, files } = setup();
    expect(collectionAt(app, files[1], s)).toBeNull();
  });
  it("lists stories unnumbered, included, titled by basename", () => {
    const { app, notes, coll } = setup();
    expect(collectionSource(app, notes, s).chapters(coll)).toEqual([
      { path: "Contos/1984.md", title: "1984", number: null, include: true },
      { path: "Contos/A visita.md", title: "A visita", number: null, include: true },
    ]);
  });
  it("reads text, editor text with null mtime when open", async () => {
    const a = setup();
    expect(await collectionSource(a.app, a.notes, s).read("Contos/1984.md")).toEqual({ text: "saved", mtime: 4 });
    const o = setup(new Set(["Contos/1984.md"]));
    expect(await collectionSource(o.app, o.notes, s).read("Contos/1984.md")).toEqual({ text: "unsaved", mtime: null });
  });
  it("frontmatter is {} when there is none", () => {
    const { app, notes } = setup();
    const src = collectionSource(app, notes, s);
    expect(src.frontmatter("Contos/1984.md")).toEqual({ compile: false });
    expect(src.frontmatter("nope.md")).toEqual({});
  });
});
