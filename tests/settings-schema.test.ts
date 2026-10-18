// IMPROVEMENTS 53 (1.1.1): the settings table, row by row. Every row is loaded in both default
// sets and cleaned by its kind; the drift fixes (PLAN-1.1.1, section 3) are pinned by FIXED.

import { describe, expect, it } from "vitest";
import { DEFAULTS_LANGUAGES, WORD_KEYS, type DefaultsLanguage } from "../src/core/defaults";
import { mergeDefaults } from "../src/core/merge";
import { SETTINGS_SCHEMA, SETTING_KEYS, UNIVERSE_KEYS, type KindName, type SettingKey } from "../src/core/settings-schema";
import { defaultsFor, normalizeSettings, type EscritaSettings } from "../src/settings";

type Row = { default: unknown; kind: { kind: KindName; normalize(v: unknown, f: unknown): unknown }; readBy: unknown; lang?: string };
const rowOf = (k: SettingKey): Row => SETTINGS_SCHEMA[k] as unknown as Row;

/** The 13 keys that used to load by their own rule (before 1.1.1) and the kind they now have. */
const FIXED: Partial<Record<SettingKey, KindName>> = {
  summaryProperty: "property", authorProperty: "property", dateProperty: "property",
  quoteStyle: "enum", paragraphStyle: "enum", typographyScope: "enum",
  chaptersFolder: "word", darlingsNote: "word", globalDarlingsNote: "word", placeholderMarker: "word",
  exportFolder: "folder", submissionsFolder: "folder", templatesFolder: "optionalFolder",
};

const load = (lang: DefaultsLanguage, key: SettingKey, v: unknown): unknown =>
  (normalizeSettings(mergeDefaults(defaultsFor(lang), { defaultsLanguage: lang, [key]: v })) as unknown as Record<string, unknown>)[key];

const WRONG = [5, null, undefined, true, ["x"], {}];

describe.each(DEFAULTS_LANGUAGES)("the settings table, set %s", (lang) => {
  const d = defaultsFor(lang) as unknown as Record<string, unknown>;

  describe.each(SETTING_KEYS)("%s", (key) => {
    const row = rowOf(key);
    // a fixed key is held to the kind it is meant to have, whatever its row says
    const kind = FIXED[key] ?? row.kind.kind;
    const norm = (v: unknown) => row.kind.normalize(v, structuredClone(d[key]));
    const same = (a: unknown, b: unknown) => expect(a).toEqual(b);

    it("is a kind it is meant to be", () => {
      if (key in FIXED) expect(row.kind.kind).toBe(FIXED[key]);
      expect(row.kind.kind).not.toBe("legacy");
    });

    it("loads as the set's value when missing, and keeps that value", () => {
      same(load(lang, key, undefined), d[key]);
      same(load(lang, key, structuredClone(d[key])), d[key]);
      same(norm(structuredClone(d[key])), d[key]);
    });

    it("is idempotent", () => {
      const samples = [d[key], "  /A b/ ", "/ x /", "", "x", 7, false, ["a"]];
      for (const v of samples) {
        const once = norm(structuredClone(v));
        same(norm(structuredClone(once)), once);
      }
    });

    if (kind === "word" || kind === "property") {
      it("restores a blank or wrong value from the set and trims a good one", () => {
        for (const v of ["", "   ", ...WRONG]) same(norm(v), d[key]);
        same(norm("  Zed "), "Zed");
      });
    }
    if (kind === "folder" || kind === "vaultFolder") {
      it("restores a blank or wrong folder and cleans a typed one", () => {
        for (const v of ["", "  ", "/", ...WRONG]) same(norm(v), d[key]);
        same(norm("/ Out Dir/"), "Out Dir");
      });
    }
    if (kind === "optionalFolder") {
      it("keeps a blank folder, cleans a typed one, restores a wrong one", () => {
        same(norm("  "), "");
        same(norm("/ A/b/"), "A/b");
        for (const v of WRONG) same(norm(v), d[key]);
      });
    }
    if (kind === "vaultFolder") {
      it("turns backslashes and repeated slashes into single slashes", () => same(norm("a\\b//c/"), "a/b/c"));
    }
    if (kind === "trimmed") {
      it("trims, keeps a blank, restores a wrong value", () => {
        same(norm("  Zed "), "Zed");
        same(norm("   "), "");
        for (const v of WRONG) same(norm(v), d[key]);
      });
    }
    if (kind === "text") {
      it("keeps the text as typed, restores a wrong value", () => {
        same(norm("  a\nb  "), "  a\nb  ");
        same(norm(""), "");
        for (const v of WRONG) same(norm(v), d[key]);
      });
    }
    if (kind === "templatePath") {
      it("trims and drops the leading slash", () => {
        same(norm("  /Templates/a.md "), "Templates/a.md");
        for (const v of WRONG) same(norm(v), d[key]);
      });
    }
    if (kind === "bool") {
      it("keeps a boolean, restores anything else", () => {
        same(norm(true), true);
        same(norm(false), false);
        for (const v of ["yes", 1, null, undefined, {}]) same(norm(v), d[key]);
      });
    }
    if (kind === "number") {
      it("keeps a finite number, restores anything else", () => {
        same(norm(3), 3);
        for (const v of ["3", NaN, Infinity, null, undefined, {}]) same(norm(v), d[key]);
      });
    }
    if (kind === "int") {
      it("rounds a number, restores anything else", () => {
        for (const v of ["3", NaN, null, undefined, {}]) same(norm(v), d[key]);
        expect(Number.isInteger(norm(12.4))).toBe(true);
      });
    }
    if (kind === "strings") {
      it("keeps the strings of a list, restores a non-list", () => {
        same(norm(["a", 1, "b"]), ["a", "b"]);
        for (const v of ["a", 5, null, undefined, {}]) same(norm(v), d[key]);
      });
    }
    if (kind === "enum") {
      it("restores an unknown value from the set", () => {
        same(norm("zzz"), d[key]);
        for (const v of WRONG) same(norm(v), d[key]);
        same(load(lang, key, "zzz"), d[key]);
      });
    }

    it("shares no object with the set", () => {
      const v = d[key];
      if (v && typeof v === "object") expect(norm(v)).not.toBe(v);
    });
  });

  describe("nested values", () => {
    it("a blank stage word comes back from the set; a colour is kept", () => {
      const s = normalizeSettings(mergeDefaults(defaultsFor(lang), {
        defaultsLanguage: lang, stages: { draft: { words: "", color: "#ff0000" }, idea: { words: " ideia x " } },
      }));
      const set = d.stages as EscritaSettings["stages"];
      expect(s.stages.draft.words).toBe(set.draft.words);
      expect(s.stages.draft.color).toBe("#ff0000");
      expect(s.stages.idea.words).toBe("ideia x");
    });
    it("entry type fields come back from the set when blank, and the template is trimmed", () => {
      const set = d.entryTypes as EscritaSettings["entryTypes"];
      const s = normalizeSettings(mergeDefaults(defaultsFor(lang), {
        defaultsLanguage: lang, entryTypes: { place: { value: "", folder: " Lá ", template: " t.md ", label: "  " }, object: "x" },
      }));
      expect(s.entryTypes.place).toEqual({ value: set.place.value, folder: "Lá", template: "t.md", label: set.place.label });
      expect(s.entryTypes.object).toEqual(set.object);
    });
    it("a blank form word comes back from the set", () => {
      const set = d.formValues as EscritaSettings["formValues"];
      const s = normalizeSettings(mergeDefaults(defaultsFor(lang), { defaultsLanguage: lang, formValues: { essay: " ", novel: " livro " } }));
      expect(s.formValues.essay).toBe(set.essay);
      expect(s.formValues.novel).toBe("livro");
    });
    it("days off are cleaned, features keep known ids, the notes get their paths", () => {
      const s = normalizeSettings(mergeDefaults(defaultsFor(lang), {
        defaultsLanguage: lang, weekdaysOff: [6, "0", 9, 6], universeNote: " /Mundo ", lensListsNote: " /Listas/Palavras ",
      }));
      expect(s.weekdaysOff).toEqual([0, 6]);
      expect(s.universeNote).toBe("Mundo.md");
      expect(s.lensListsNote).toBe("Listas/Palavras.md");
    });
  });

  it("cleaning a whole messy object twice changes nothing", () => {
    const messy = mergeDefaults(defaultsFor(lang), {
      defaultsLanguage: lang, chaptersFolder: " ", quoteStyle: "x", exportFolder: "/ A/", templatesFolder: " /T/ ", summaryProperty: "",
      lensEchoWindow: 9999, snapshotsKeepAuto: 0, stages: { draft: { words: "" } }, universeNote: "u", formFolders: "a: b",
    });
    const once = normalizeSettings(structuredClone(messy));
    expect(normalizeSettings(structuredClone(once))).toEqual(once);
  });
});

describe("the table itself", () => {
  it("WORD_KEYS has no duplicates and every word key has a pt-BR value", () => {
    expect(new Set(WORD_KEYS).size).toBe(WORD_KEYS.length);
    for (const k of WORD_KEYS) expect(rowOf(k).lang, k).toBe("word");
  });
  it("a property row is never language-bearing", () => {
    for (const k of SETTING_KEYS) if (rowOf(k).kind.kind === "property") expect(rowOf(k).lang, k).toBeUndefined();
  });
  it("the universe's rows are marked, and only they", () => {
    expect([...UNIVERSE_KEYS].sort()).toEqual(SETTING_KEYS.filter((k) => rowOf(k).readBy === "universe").sort());
    expect(UNIVERSE_KEYS.length).toBeGreaterThan(0);
  });
  it("the int rows clamp", () => {
    const s = normalizeSettings(mergeDefaults(defaultsFor("en"), { lensEchoWindow: 9999, lensLongSentence: 1, snapshotsKeepAuto: 0 }));
    expect([s.lensEchoWindow, s.lensLongSentence, s.snapshotsKeepAuto]).toEqual([200, 15, 1]);
  });
});
