import { describe, expect, it } from "vitest";
import {
  DEFAULTS_LANGUAGES, LANGUAGE_DEFAULTS, SETUP_NAMES, WORD_KEYS, isDefaultsLanguage, languageOf, overlayDefaults,
} from "../src/core/defaults";
import { DEFAULT_SETTINGS, defaultsFor, normalizeSettings, type EscritaSettings } from "../src/settings";
import { mergeDefaults } from "../src/core/merge";
import { STAGES, stageOf } from "../src/core/stages";
import { ENTRY_KINDS, FORM_KINDS } from "../src/universe/settings";

describe("languageOf", () => {
  it("maps every Portuguese tag to pt-BR", () => {
    for (const l of ["pt", "pt-BR", "pt-br", "PT-BR", "pt_BR", " pt ", "pt-PT"]) expect(languageOf(l), l).toBe("pt-BR");
  });
  it("gives en for everything else, and for nothing", () => {
    for (const l of ["en", "en-GB", "es", "fr", "ptx", "", "  "]) expect(languageOf(l), l).toBe("en");
    expect(languageOf(undefined)).toBe("en");
    expect(languageOf(null)).toBe("en");
  });
});

describe("isDefaultsLanguage", () => {
  it("knows the two sets only", () => {
    expect(DEFAULTS_LANGUAGES).toEqual(["en", "pt-BR"]);
    expect(isDefaultsLanguage("en")).toBe(true);
    expect(isDefaultsLanguage("pt-BR")).toBe(true);
    for (const v of ["pt", "pt-br", "es", "", null, 1, {}]) expect(isDefaultsLanguage(v)).toBe(false);
  });
});

describe("the default sets", () => {
  it("list exactly the word-bearing keys, in both languages", () => {
    for (const lang of DEFAULTS_LANGUAGES) expect(Object.keys(LANGUAGE_DEFAULTS[lang]).sort(), lang).toEqual([...WORD_KEYS].sort());
  });

  it("the English set is DEFAULT_SETTINGS on every key", () => {
    for (const k of WORD_KEYS) expect(LANGUAGE_DEFAULTS.en[k], k).toEqual(DEFAULT_SETTINGS[k]);
  });

  it("hold no property name: those stay English in every set", () => {
    const keys = WORD_KEYS as readonly string[];
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (/Property$/.test(k)) expect(keys).not.toContain(k);
  });

  it("pt-BR uses the Brazilian words", () => {
    const pt = LANGUAGE_DEFAULTS["pt-BR"];
    expect(STAGES.map((k) => pt.stages[k].words)).toEqual(["ideia", "rascunho", "revisão", "pronto", "publicado"]);
    expect(pt.chaptersFolder).toBe("Capítulos");
    expect(pt.exportFolder).toBe("Escrita/Exportações");
    expect(pt.submissionsFolder).toBe("Escrita/Envios");
    expect(pt.universeNote).toBe("Universo.md");
    expect(pt.entryTypes.character).toEqual({ value: "personagem", folder: "Personagens", template: "", label: "Personagem" });
    expect(pt.formValues.shortStory).toBe("conto");
    expect(pt.threadKeyword).toBe("fio");
    expect(pt.threadClosedWord).toBe("fechado");
    expect(pt.submissionResults.split(",")[0].trim()).toBe("pendente");
  });

  it("keep the stage colours and cover every entry kind and form", () => {
    for (const lang of DEFAULTS_LANGUAGES) {
      const set = LANGUAGE_DEFAULTS[lang];
      for (const k of STAGES) expect(set.stages[k].color, `${lang} ${k}`).toBe(DEFAULT_SETTINGS.stages[k].color);
      expect(Object.keys(set.entryTypes).sort()).toEqual([...ENTRY_KINDS].sort());
      expect(Object.keys(set.formValues).sort()).toEqual([...FORM_KINDS].sort());
    }
  });

  it("give every stage its own word", () => {
    for (const lang of DEFAULTS_LANGUAGES) {
      const stages = LANGUAGE_DEFAULTS[lang].stages;
      for (const k of STAGES) expect(stageOf(stages[k].words, stages), `${lang} ${k}`).toBe(k);
    }
  });

  it("are frozen", () => {
    const pt = LANGUAGE_DEFAULTS["pt-BR"];
    expect(Object.isFrozen(pt)).toBe(true);
    expect(Object.isFrozen(pt.stages.draft)).toBe(true);
    expect(Object.isFrozen(pt.entryTypes.place)).toBe(true);
  });
});

describe("defaultsFor", () => {
  it("en equals DEFAULT_SETTINGS", () => {
    expect(defaultsFor("en")).toEqual(DEFAULT_SETTINGS);
  });

  it("pt-BR changes only the word-bearing keys", () => {
    const pt = defaultsFor("pt-BR");
    const words = new Set<string>(WORD_KEYS);
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof EscritaSettings)[]) {
      if (words.has(k)) expect(pt[k], k).toEqual(LANGUAGE_DEFAULTS["pt-BR"][k as (typeof WORD_KEYS)[number]]);
      else expect(pt[k], k).toEqual(DEFAULT_SETTINGS[k]);
    }
    expect(pt.defaultsLanguage).toBe("en"); // the set does not name itself: loading sets the key
  });

  it("returns a fresh object that shares nothing with the defaults or the sets", () => {
    for (const lang of DEFAULTS_LANGUAGES) {
      const a = defaultsFor(lang);
      const b = defaultsFor(lang);
      expect(a).not.toBe(b);
      for (const [k, v] of Object.entries(a)) {
        if (v && typeof v === "object") {
          expect(v, k).not.toBe((DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k]);
          expect(v, k).not.toBe((b as unknown as Record<string, unknown>)[k]);
        }
      }
      a.stages.draft.words = "x";
      a.entryTypes.place.folder = "y";
      a.lensRulesOff.push("z");
      expect(defaultsFor(lang).stages.draft.words).not.toBe("x");
      expect(LANGUAGE_DEFAULTS[lang].entryTypes.place.folder).not.toBe("y");
      expect(DEFAULT_SETTINGS.lensRulesOff).toEqual([]);
    }
  });

  it("an unknown language falls back to English", () => {
    expect(overlayDefaults(DEFAULT_SETTINGS, "xx" as never)).toEqual(DEFAULT_SETTINGS);
  });

  it("is a base saved values merge over (task 1.4's loading)", () => {
    const s = normalizeSettings(mergeDefaults(defaultsFor("pt-BR"), { chaptersFolder: "Partes", dailyGoal: 300 }));
    expect(s.chaptersFolder).toBe("Partes");
    expect(s.dailyGoal).toBe(300);
    expect(s.exportFolder).toBe("Escrita/Exportações");
    expect(s.stages.revision.words).toBe("revisão");
  });
});

describe("the new 1.0 settings", () => {
  it("default to English and off", () => {
    expect(DEFAULT_SETTINGS.defaultsLanguage).toBe("en");
    expect(DEFAULT_SETTINGS.openInWritingMode).toBe(false);
  });

  it("a 0.9 settings object loads as en, writing mode off", () => {
    const s = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, { chaptersFolder: "Capítulos" }));
    expect(s.defaultsLanguage).toBe("en");
    expect(s.openInWritingMode).toBe(false);
  });

  it("are cleaned on load", () => {
    const s = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, { defaultsLanguage: "klingon", openInWritingMode: "yes" }));
    expect(s.defaultsLanguage).toBe("en");
    expect(s.openInWritingMode).toBe(false);
    const t = normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, { defaultsLanguage: "pt-BR", openInWritingMode: true }));
    expect(t.defaultsLanguage).toBe("pt-BR");
    expect(t.openInWritingMode).toBe(true);
  });
});

describe("SETUP_NAMES", () => {
  it("names the home note and the folders in each language (boards 36, 37)", () => {
    expect(SETUP_NAMES.en.homeNote).toBe("Home.md");
    expect(SETUP_NAMES["pt-BR"].homeNote).toBe("Início.md");
    expect([SETUP_NAMES.en.storiesFolder, SETUP_NAMES.en.booksFolder]).toEqual(["Stories", "Books"]);
    expect([SETUP_NAMES["pt-BR"].storiesFolder, SETUP_NAMES["pt-BR"].booksFolder]).toEqual(["Contos", "Livros"]);
  });
  it("starts every example with the prefix", () => {
    for (const lang of DEFAULTS_LANGUAGES) {
      const n = SETUP_NAMES[lang];
      expect(n.exampleStory.startsWith(n.examplePrefix)).toBe(true);
      expect(n.exampleBook.startsWith(n.examplePrefix)).toBe(true);
    }
  });
});
