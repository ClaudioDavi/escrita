// The Universe section of the settings tab (board 19). It sits right after the
// revision lens section. Mode off shows only the mode, the thread word and the
// closed word; per book hides the universe note and the folders; universe shows
// everything. Text fields save when the writer leaves them (a change event), so a
// word typed letter by letter doesn't rebuild the vault indexes at every key.

import { Notice, Setting, type TextComponent } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { ENTRY_KINDS, defaultUniverseSettings, normalizeNotePath, type UniverseMode } from "./settings";
import { formValuesText, parseFormValues } from "./works-list";

/** Saves when the field loses focus or Enter is pressed; the field shows what was kept (blank → the fallback). */
function commit(c: TextComponent, fallback: () => string, apply: (v: string) => void): TextComponent {
  c.inputEl.addEventListener("change", () => {
    const v = c.getValue().trim() || fallback();
    c.setValue(v);
    apply(v);
  });
  return c;
}

const stripSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

export function renderUniverseSettings(plugin: EscritaPlugin, containerEl: HTMLElement, save: () => Promise<void>, redisplay: () => void): void {
  const s = plugin.settings;
  const d = defaultUniverseSettings();
  const mode = s.universeMode;

  new Setting(containerEl).setName(t("universe.settings")).setHeading();
  if (mode !== "off") containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.desc") });

  new Setting(containerEl)
    .setName(t("universe.settings.mode"))
    .setDesc(mode === "off" ? "" : t("universe.settings.mode.desc"))
    .addDropdown((dd) => {
      dd.addOption("universe", t("universe.settings.mode.universe"));
      dd.addOption("perBook", t("universe.settings.mode.perBook"));
      dd.addOption("off", t("universe.settings.mode.off"));
      dd.setValue(mode).onChange(async (v) => {
        s.universeMode = v as UniverseMode;
        await save();
        redisplay();
      });
    });

  if (mode === "universe") {
    const note = new Setting(containerEl)
      .setName(t("universe.settings.note"))
      .setDesc(t("universe.settings.note.desc", { example: `${s.universeProperty}: "[[${noteName(s.universeNote)}]]"` }));
    note.addText((c) => {
      c.setPlaceholder(d.universeNote).setValue(s.universeNote);
      c.inputEl.setAttr("aria-label", t("universe.settings.note"));
      commit(c, () => d.universeNote, (v) => { s.universeNote = normalizeNotePath(v, d.universeNote); void save(); });
    });
    note.addButton((b) => b.setButtonText(t("universe.settings.note.create")).onClick(async () => {
      try {
        const { file, created } = await plugin.universe.createUniverseNote();
        new Notice(t(created ? "universe.notice.noteCreated" : "universe.notice.noteExists", { path: file.path }));
      } catch (e) {
        console.error("Escrita: couldn't create the universe note", e);
        new Notice(t("universe.notice.noteFailed"));
      }
    }));

    new Setting(containerEl)
      .setName(t("universe.settings.folders"))
      .setDesc(t("universe.settings.folders.desc"))
      .addTextArea((c) => {
        c.setPlaceholder("Short stories\nNovels").setValue(s.defaultUniverseFolders);
        c.inputEl.setAttr("aria-label", t("universe.settings.folders"));
        c.inputEl.addEventListener("change", () => { s.defaultUniverseFolders = c.getValue(); void save(); });
      });
  }

  if (mode !== "off") {
    const form = new Setting(containerEl)
      .setName(t("universe.settings.form"))
      .setDesc(t(mode === "universe" ? "universe.settings.form.desc" : "universe.settings.form.desc.perBook"));
    form.addText((c) => {
      c.setPlaceholder(d.formProperty).setValue(s.formProperty);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.form"));
      commit(c, () => d.formProperty, (v) => { s.formProperty = v; void save(); });
    });
    if (mode === "universe") {
      form.addText((c) => {
        c.setPlaceholder(formValuesText(d.formValues)).setValue(formValuesText(s.formValues));
        c.inputEl.addClass("escrita-universe-wide");
        c.inputEl.setAttr("aria-label", t("universe.settings.form.values"));
        c.inputEl.addEventListener("change", () => {
          s.formValues = parseFormValues(c.getValue(), s.formValues);
          c.setValue(formValuesText(s.formValues));
          void save();
        });
      });
      new Setting(containerEl)
        .setName(t("universe.settings.formFolders"))
        .setDesc(t("universe.settings.formFolders.desc"))
        .addTextArea((c) => {
          c.setPlaceholder("Short stories: short story\nEssays: essay").setValue(s.formFolders);
          c.inputEl.setAttr("aria-label", t("universe.settings.formFolders"));
          c.inputEl.addEventListener("change", () => { s.formFolders = c.getValue(); void save(); });
        });
    }
  }

  new Setting(containerEl)
    .setName(t("universe.settings.threadWord"))
    .setDesc(mode === "off" ? "" : t("universe.settings.threadWord.desc", { example: `%% ${s.threadKeyword}: … %%` }))
    .addText((c) => {
      c.setPlaceholder("thread").setValue(s.threadKeyword);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.threadWord"));
      commit(c, () => "thread", (v) => { s.threadKeyword = v; void save(); });
    });
  new Setting(containerEl)
    .setName(t("universe.settings.closedWord"))
    .setDesc(mode === "off" ? "" : t("universe.settings.closedWord.desc", { example: `%% ${s.threadKeyword} ${s.threadClosedWord}: … %%` }))
    .addText((c) => {
      c.setPlaceholder(d.threadClosedWord).setValue(s.threadClosedWord);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.closedWord"));
      commit(c, () => d.threadClosedWord, (v) => { s.threadClosedWord = v; void save(); });
    });

  if (mode === "off") return;

  new Setting(containerEl).setName(t("universe.settings.types")).setHeading();
  if (mode === "perBook") {
    const book = plugin.books.allBooks()[0]?.folder.name ?? t("universe.settings.bookExample");
    containerEl.createDiv({
      cls: "setting-item-description escrita-universe-settings-desc",
      text: t("universe.settings.types.bookDesc", { example: `${book}/${s.entryTypes.character.folder}` }),
    });
  } else {
    containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.types.desc") });
  }

  new Setting(containerEl)
    .setName(t("universe.settings.types.property"))
    .addText((c) => {
      c.setPlaceholder(d.typeProperty).setValue(s.typeProperty);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.types.property"));
      commit(c, () => d.typeProperty, (v) => { s.typeProperty = v; void save(); });
    });

  const table = containerEl.createDiv({ cls: "escrita-types", attr: { role: "group", "aria-label": t("universe.settings.types") } });
  const head = table.createDiv({ cls: "escrita-types-head" });
  for (const col of ["value", "folder", "template", "label"]) head.createSpan({ text: t(`universe.settings.types.${col}`) });
  for (const k of ENTRY_KINDS) {
    const row = table.createDiv({ cls: "escrita-types-row" });
    const name = t(`universe.kind.${k}`);
    // the type's own name titles the block on a phone, where the table becomes one block per type
    row.createDiv({ cls: "escrita-types-name", text: name });
    const type = s.entryTypes[k];
    const field = (col: "value" | "folder" | "template" | "label", placeholder: string, apply: (v: string) => void, fallback: () => string) => {
      const cell = row.createDiv({ cls: "escrita-types-cell" });
      cell.createSpan({ cls: "escrita-types-cell-label", text: t(`universe.settings.types.${col}`) });
      const input = cell.createEl("input", { type: "text", attr: { placeholder, spellcheck: "false", "aria-label": `${name}: ${t(`universe.settings.types.${col}`)}` } });
      input.value = type[col];
      input.addEventListener("change", () => {
        const v = input.value.trim() || fallback();
        input.value = v;
        apply(v);
        void save();
      });
    };
    field("value", d.entryTypes[k].value, (v) => { type.value = v; }, () => d.entryTypes[k].value);
    field("folder", d.entryTypes[k].folder, (v) => { type.folder = stripSlashes(v); }, () => d.entryTypes[k].folder);
    field("template", t("universe.settings.types.none"), (v) => { type.template = v; }, () => "");
    field("label", d.entryTypes[k].label, (v) => { type.label = v; }, () => d.entryTypes[k].label);
  }
  containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.types.note") });
}

function noteName(note: string): string {
  return stripSlashes(note).replace(/\.md$/i, "").split("/").pop() ?? note;
}

