import { describe, expect, it, vi } from "vitest";
import { TFolder } from "./support/obsidian";
import { fakePlugin } from "./support/fake-plugin";
import { DarlingsModule } from "../src/darlings";
import { TemplatesFeature } from "../src/editor/features";
import { submissionsOffNotice } from "../src/submissions/settings-ui";
import { propertyValue } from "../src/core/book-source";
import { coverLink } from "../src/export/logic";

describe("the templates folder follows a rename", () => {
  it("rewrites the setting, also for a folder holding it, and ignores other moves", () => {
    const p = fakePlugin();
    p.settings.templatesFolder = "Work/Templates";
    p.app.vault.files.set("Trabalho", Object.assign(new TFolder(), { path: "Trabalho" }) as never);
    const save = vi.spyOn(p, "saveSettings");
    const [f] = new TemplatesFeature(p.asPlugin).dataFollowers();
    f.moved?.("Elsewhere", "Trabalho");
    expect(p.settings.templatesFolder).toBe("Work/Templates");
    expect(save).not.toHaveBeenCalled();
    f.moved?.("Work", "Trabalho");
    expect(p.settings.templatesFolder).toBe("Trabalho/Templates");
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("leaves an empty setting alone", () => {
    const p = fakePlugin();
    p.settings.templatesFolder = "";
    p.app.vault.files.set("X", Object.assign(new TFolder(), { path: "X" }) as never);
    const [f] = new TemplatesFeature(p.asPlugin).dataFollowers();
    f.moved?.("", "X");
    expect(p.settings.templatesFolder).toBe("");
  });
});

describe("the global darlings note follows a rename", () => {
  it("follows the note, a folder holding it, and a name saved without .md", () => {
    const p = fakePlugin();
    const save = vi.spyOn(p, "saveSettings");
    const [f] = new DarlingsModule(p.asPlugin).dataFollowers();
    p.settings.globalDarlingsNote = "Darlings.md";
    f.moved?.("Darlings.md", "Cortes.md");
    expect(p.settings.globalDarlingsNote).toBe("Cortes.md");
    p.settings.globalDarlingsNote = "Work/Darlings";
    f.moved?.("Work", "Trabalho");
    expect(p.settings.globalDarlingsNote).toBe("Trabalho/Darlings.md");
    f.moved?.("Other.md", "Another.md");
    expect(p.settings.globalDarlingsNote).toBe("Trabalho/Darlings.md");
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("the cover property is read ignoring case", () => {
  it("finds Cover when the setting says cover", () => {
    expect(coverLink(propertyValue({ Cover: "[[capa.png]]" }, "cover"))).toBe("capa.png");
    expect(coverLink(propertyValue({ title: "x" }, "cover"))).toBeNull();
  });
});

describe("submissionsOffNotice", () => {
  it("counts in the install's default folder when the setting is empty", async () => {
    const p = fakePlugin();
    p.settings.submissionsFolder = "";
    p.settings.defaultsLanguage = "pt-BR";
    (p.app.vault as unknown as { getMarkdownFiles: () => { path: string }[] }).getMarkdownFiles =
      () => [{ path: "Escrita/Envios/a.md" }, { path: "Escrita/Submissions/b.md" }];
    const note = await submissionsOffNotice(p.asPlugin);
    // only the pt-BR default folder counts: one note
    expect(note).toBe("settings.features.off.submissions.one");
  });
});
