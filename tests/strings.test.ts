import { describe, it, expect } from "vitest";
import type { Strings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { goalsStrings } from "../src/goals/strings";
import { outlineStrings } from "../src/outline/strings";
import { placeholdersStrings } from "../src/placeholders/strings";
import { darlingsStrings } from "../src/darlings/strings";
import { editorStrings } from "../src/editor/strings";
import { publishStrings } from "../src/publish/strings";
import { explorerStrings } from "../src/explorer/strings";
import { snapshotsStrings } from "../src/snapshots/strings";

const all: Record<string, Strings> = {
  core: coreStrings,
  goals: goalsStrings,
  outline: outlineStrings,
  placeholders: placeholdersStrings,
  darlings: darlingsStrings,
  editor: editorStrings,
  publish: publishStrings,
  explorer: explorerStrings,
  snapshots: snapshotsStrings,
};

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("strings", () => {
  for (const [name, s] of Object.entries(all)) {
    describe(name, () => {
      const en = Object.keys(s.en).sort();
      for (const lang of Object.keys(s).filter((l) => l !== "en")) {
        it(`${lang} has exactly the English keys`, () => {
          expect(Object.keys(s[lang]).sort()).toEqual(en);
        });
        it(`${lang} uses the same {variables}`, () => {
          for (const k of en) {
            if (k in s[lang]) expect([k, vars(s[lang][k])]).toEqual([k, vars(s.en[k])]);
          }
        });
      }
      it("has a pt-BR translation", () => {
        expect(s["pt-BR"]).toBeDefined();
      });
    });
  }

  it("never defines a key in two modules", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [name, s] of Object.entries(all)) {
      for (const k of Object.keys(s.en)) {
        if (seen.has(k)) dupes.push(`${k} (${seen.get(k)}, ${name})`);
        seen.set(k, name);
      }
    }
    expect(dupes).toEqual([]);
  });
});
