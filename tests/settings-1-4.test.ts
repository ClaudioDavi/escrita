import { describe, expect, it } from "vitest";
import { defaultsFor, loadSettings, normalizeSettings } from "../src/settings";
import { migrateSettings } from "../src/core/migrate";
import { exportRoot, inExports, submissionsRoot } from "../src/core/classify";
import { normalizeStages } from "../src/core/stages";
import { normalizeUniverse } from "../src/universe/settings";
import { matchingPreset } from "../src/core/feature-presets";
import { switchesOf } from "../src/core/feature-registry";

// a small saved object; the full 0.9 fixture is tests/settings-g3.test.ts
const saved09 = { weeklyGoal: 5, exportFolder: "Escrita/Exports", submissionsFolder: "Escrita/Submissions" };

describe("1.4 language defaults on load", () => {
  it("migrateSettings gives a saved object without the key 'en', and leaves a set one", () => {
    expect((migrateSettings({ weeklyGoal: 3 }) as { defaultsLanguage: string }).defaultsLanguage).toBe("en");
    expect((migrateSettings({ defaultsLanguage: "pt-BR" }) as { defaultsLanguage: string }).defaultsLanguage).toBe("pt-BR");
    expect(migrateSettings(undefined)).toBeUndefined();
  });

  it("a 0.9 install loads as English whatever Obsidian's language", () => {
    const pt = loadSettings(saved09, "pt-br");
    const en = loadSettings(saved09, "en");
    expect(pt.fresh).toBe(false);
    expect(pt.settings.defaultsLanguage).toBe("en");
    expect(pt.settings).toEqual(en.settings);
  });

  it("a fresh install takes the set of Obsidian's language and asks to save", () => {
    const pt = loadSettings(undefined, "pt-BR");
    expect(pt.fresh).toBe(true);
    expect(pt.settings.defaultsLanguage).toBe("pt-BR");
    expect(pt.settings.exportFolder).toBe("Escrita/Exportações");
    expect(pt.settings.stages.draft.words).toBe("rascunho");
    expect(pt.settings.entryTypes.character.value).toBe("personagem");
    expect(loadSettings(undefined, "fr").settings.defaultsLanguage).toBe("en");
    expect(loadSettings(null, "pt").fresh).toBe(true);
  });

  it("a blank word-bearing field comes back in the install's language", () => {
    const s = defaultsFor("pt-BR");
    s.defaultsLanguage = "pt-BR";
    s.exportFolder = " "; s.submissionsFolder = ""; s.submissionResults = ""; s.threadKeyword = "";
    s.stages = { draft: { words: "", color: "" } } as never;
    s.universeNote = "";
    normalizeSettings(s);
    expect(s.exportFolder).toBe("Escrita/Exportações");
    expect(s.submissionsFolder).toBe("Escrita/Envios");
    expect(s.submissionResults).toBe("pendente, aceito, recusado, retirado");
    expect(s.threadKeyword).toBe("fio");
    expect(s.stages.draft.words).toBe("rascunho");
    expect(s.universeNote).toBe("Universo.md");
  });

  it("normalizeStages and normalizeUniverse take a base; a copy, never shared", () => {
    const d = defaultsFor("pt-BR");
    const st = normalizeStages({}, d.stages);
    expect(st.idea.words).toBe("ideia");
    expect(st.idea).not.toBe(d.stages.idea);
    const u = normalizeUniverse({ entryTypes: { place: { value: "" } } }, d);
    expect(u.entryTypes.place.value).toBe("lugar");
    expect(u.entryTypes.place).not.toBe(d.entryTypes.place);
    expect(normalizeUniverse({})).toEqual(normalizeUniverse({}, defaultsFor("en")));
  });

  it("classify's folder fallbacks take the install's set", () => {
    expect(exportRoot("")).toBe("Escrita/Exports");
    expect(exportRoot("", "pt-BR")).toBe("Escrita/Exportações");
    expect(submissionsRoot(undefined, "pt-BR")).toBe("Escrita/Envios");
    expect(submissionsRoot("", "xx")).toBe("Escrita/Submissions");
    expect(inExports("Escrita/Exportações/a.docx", { exportFolder: "", defaultsLanguage: "pt-BR" })).toBe(true);
    expect(inExports("Escrita/Exports/a.docx", { exportFolder: "", defaultsLanguage: "pt-BR" })).toBe(false);
  });

  it("a fresh install starts on Writer, in either language, with the universe off (Q7)", () => {
    for (const locale of ["en", "pt-BR"]) {
      const { settings } = loadSettings(undefined, locale);
      expect(matchingPreset(switchesOf(settings)), locale).toBe("writer");
      expect(settings.universeMode, locale).toBe("off");
    }
  });
});
