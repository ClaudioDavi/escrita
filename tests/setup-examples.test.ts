import { describe, expect, it } from "vitest";
import { classify, type VaultTree } from "../src/core/classify";
import { parseBeats, parsePlaceholders } from "../src/core/markers";
import { stageOf } from "../src/core/stages";
import { exampleText, EXAMPLE_CHAPTERS } from "../src/setup/examples";
import { planSetup, settingsAfter, type SetupChoices, type SetupVault } from "../src/setup/plan";
import { defaultsFor } from "../src/settings";
import { SETUP_NAMES, type DefaultsLanguage } from "../src/core/defaults";

// Task 2.1: the example notes classify as what the setup says they are, in both languages.

interface N { path: string; name: string; extension: string; parent: N | null; children: N[] }

function frontmatterOf(text: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const out: Record<string, unknown> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const [k, ...v] = line.split(": ");
    const raw = v.join(": ");
    out[k] = raw === "true" ? true : /^\d+$/.test(raw) ? Number(raw) : raw;
  }
  return out;
}

function treeOf(files: Record<string, string>): VaultTree<N, N> {
  const nodes = new Map<string, N>();
  const dir = (path: string): N | null => {
    if (path === "") return null;
    let n = nodes.get(path);
    if (n) return n;
    const i = path.lastIndexOf("/");
    const parent = dir(i < 0 ? "" : path.slice(0, i));
    n = { path, name: path.slice(i + 1), extension: "", parent, children: [] };
    parent?.children.push(n);
    nodes.set(path, n);
    return n;
  };
  for (const f of Object.keys(files)) {
    const i = f.lastIndexOf("/");
    const parent = i < 0 ? null : dir(f.slice(0, i));
    const n: N = { path: f, name: f.slice(i + 1), extension: "md", parent, children: [] };
    parent?.children.push(n);
    nodes.set(f, n);
  }
  return {
    file: (p) => (p in files ? nodes.get(p) ?? null : null),
    folder: (p) => (!(p in files) ? nodes.get(p) ?? null : null),
    folders: () => [...nodes.values()].filter((n) => !(n.path in files)),
    frontmatter: (f) => frontmatterOf(files[f.path]),
    resolve: (l) => (l in files ? l : null),
  };
}

const empty: SetupVault = { folders: [], files: [], noteCounts: {}, openLeaves: 1, hasWorks: false };

for (const language of ["en", "pt-BR"] as DefaultsLanguage[]) {
  describe(`setup examples (${language})`, () => {
    const choices: SetupChoices = { writes: "both", language, preset: "writer", universeMode: null, layout: "desk" };
    const settings = settingsAfter(defaultsFor(language), language);
    const items = planSetup(choices, empty, defaultsFor(language)).filter((i) => i.kind === "example");
    const files = Object.fromEntries(items.filter((i) => i.target.endsWith(".md")).map((i) => [i.target, i.content ?? ""]));
    const names = SETUP_NAMES[language];
    const story = items.find((i) => i.target.endsWith(`${names.exampleStory}.md`))!;
    const classifySettings = { ...settings, defaultsLanguage: language };
    const at = (p: string) => classify(treeOf(files), classifySettings, p);

    it("every example has text, example: true and the draft status", () => {
      expect(Object.keys(files)).toHaveLength(4);
      for (const [path, text] of Object.entries(files)) {
        const fm = frontmatterOf(text);
        expect(text.trim(), path).not.toBe("");
        expect(fm.example, path).toBe(true);
        expect(stageOf(fm[settings.statusProperty], settings.stages), path).toBe("draft");
        expect(path.split("/").pop()!.startsWith(names.examplePrefix) || EXAMPLE_CHAPTERS[language].includes(path.split("/").pop()!), path).toBe(true);
      }
    });

    it("the conto is a standalone piece with a target of 2000", () => {
      const p = at(story.target);
      expect(p.kind).toBe("note");
      expect(p.piece?.target).toBe(2000);
    });

    it("the book note is a book note and each chapter a chapter of it, with a target", () => {
      const note = items.find((i) => i.target.endsWith(`/${names.exampleBook}.md`))!;
      expect(at(note.target).kind).toBe("book-note");
      const chapters = Object.keys(files).filter((p) => EXAMPLE_CHAPTERS[language].some((c) => p.endsWith(`/${c}`)));
      expect(chapters).toHaveLength(2);
      for (const c of chapters) {
        const p = at(c);
        expect(p.kind, c).toBe("chapter");
        expect(p.book?.note.path, c).toBe(note.target);
        expect(p.piece?.target, c).toBeGreaterThan(0);
      }
    });

    it("each has beats and a placeholder (the book note only a placeholder); one chapter has prose, one only beats", () => {
      const marker = settings.placeholderMarker;
      for (const [path, text] of Object.entries(files)) {
        expect(parsePlaceholders(text, marker).length, path).toBe(1);
        if (!path.endsWith(`/${names.exampleBook}.md`)) expect(parseBeats(text).length, path).toBeGreaterThanOrEqual(2);
      }
      const [c1, c2] = EXAMPLE_CHAPTERS[language].map((c) => parseBeats(files[Object.keys(files).find((p) => p.endsWith(`/${c}`))!]));
      expect(c1.some((b) => b.written)).toBe(true);
      expect(c2.every((b) => !b.written)).toBe(true);
    });

    it("is deterministic and empty for an unknown chapter", () => {
      const ctx = { language, settings };
      expect(exampleText({ kind: "story" }, ctx)).toBe(exampleText({ kind: "story" }, ctx));
      expect(exampleText({ kind: "chapter", index: 9 }, ctx)).toBe("");
    });
  });
}
