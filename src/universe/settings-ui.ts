// The Universe section of the settings tab (boards 19 and 24), drawn by the universe module
// (`UniverseModule.settingsSection`). The tab's core draws the heading (the slot is shared with
// threads); this draws the rows: the description, the mode pointer, the note and folders, the form
// rows, the thread words (while threads is loaded: `threadWordRows`), the types table and the names.
// With the mode off only the thread words draw. Text fields save when the writer leaves them
// (ui.saveOnCommit or a change event), so a word typed letter by letter doesn't rebuild the vault
// indexes at every key.

import { Notice, Setting } from "obsidian";
import { locale, t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { ENTRY_KINDS, normalizeNotePath } from "./settings";
import { builtinTitlesText } from "./names-settings";
import { formValuesText, parseFormValues } from "./works-list";
import { threadWordRows } from "./threads-settings-ui";

const stripSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

export function universeSettingsSection(containerEl: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  const d = ui.defaults();
  const mode = s.universeMode;
  if (mode === "off") {
    if (plugin.features.isOn("threads")) threadWordRows(containerEl, ui, s);
    return;
  }
  containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.desc") });
  containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.mode.pointer") });

  if (mode === "universe") {
    const note = new Setting(containerEl)
      .setName(t("universe.settings.note"))
      .setDesc(t("universe.settings.note.desc", { example: `${s.universeProperty}: "[[${noteName(s.universeNote)}]]"` }));
    note.addText((c) => {
      c.setPlaceholder(d.universeNote).setValue(s.universeNote);
      c.inputEl.setAttr("aria-label", t("universe.settings.note"));
      ui.saveOnCommit(c, () => d.universeNote, (v) => { s.universeNote = normalizeNotePath(v, d.universeNote); });
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
        c.setPlaceholder(t("universe.settings.defaultFolders.example")).setValue(s.defaultUniverseFolders);
        c.inputEl.setAttr("aria-label", t("universe.settings.folders"));
        c.inputEl.addEventListener("change", () => { s.defaultUniverseFolders = c.getValue(); void ui.save(); });
      });
  }

  {
    const form = new Setting(containerEl)
      .setName(t("universe.settings.form"))
      .setDesc(t(mode === "universe" ? "universe.settings.form.desc" : "universe.settings.form.desc.perBook"));
    form.addText((c) => {
      c.setPlaceholder(d.formProperty).setValue(s.formProperty);
      c.inputEl.addClass("escrita-universe-narrow");
      c.inputEl.setAttr("aria-label", t("universe.settings.form"));
      ui.saveOnCommit(c, () => d.formProperty, (v) => { s.formProperty = v; });
    });
    if (mode === "universe") {
      form.addText((c) => {
        c.setPlaceholder(formValuesText(d.formValues)).setValue(formValuesText(s.formValues));
        c.inputEl.addClass("escrita-universe-wide");
        c.inputEl.setAttr("aria-label", t("universe.settings.form.values"));
        c.inputEl.addEventListener("change", () => {
          s.formValues = parseFormValues(c.getValue(), s.formValues);
          c.setValue(formValuesText(s.formValues));
          void ui.save();
        });
      });
      new Setting(containerEl)
        .setName(t("universe.settings.formFolders"))
        .setDesc(t("universe.settings.formFolders.desc"))
        .addTextArea((c) => {
          c.setPlaceholder(t("universe.settings.formFolders.example")).setValue(s.formFolders);
          c.inputEl.setAttr("aria-label", t("universe.settings.formFolders"));
          c.inputEl.addEventListener("change", () => { s.formFolders = c.getValue(); void ui.save(); });
        });
    }
  }

  // The thread words sit between the form rows and the types (today's order).
  if (plugin.features.isOn("threads")) threadWordRows(containerEl, ui, s);

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
      ui.saveOnCommit(c, () => d.typeProperty, (v) => { s.typeProperty = v; });
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
        void ui.save();
      });
    };
    field("value", d.entryTypes[k].value, (v) => { type.value = v; }, () => d.entryTypes[k].value);
    field("folder", d.entryTypes[k].folder, (v) => { type.folder = stripSlashes(v); }, () => d.entryTypes[k].folder);
    field("template", t("universe.settings.types.none"), (v) => { type.template = v; }, () => "");
    field("label", d.entryTypes[k].label, (v) => { type.label = v; }, () => d.entryTypes[k].label);
  }
  containerEl.createDiv({ cls: "setting-item-description escrita-universe-settings-desc", text: t("universe.settings.types.note") });

  renderNameRows(plugin, ui, containerEl);
}

/** "Names" (board 24, l): the underline switch, the extra titles and the three per-entry property names (collapsed). */
function renderNameRows(plugin: EscritaPlugin, ui: SettingsUi, containerEl: HTMLElement): void {
  const s = plugin.settings;
  const d = ui.defaults();
  new Setting(containerEl).setName(t("universe.settings.names")).setHeading();

  new Setting(containerEl)
    .setName(t("universe.settings.underline"))
    .setDesc(t("universe.settings.underline.desc"))
    .addToggle((c) => {
      c.setValue(s.underlineNames).onChange(async (v) => { s.underlineNames = v; await ui.save(); });
      c.toggleEl.setAttr("aria-label", t("universe.settings.underline"));
    });

  const builtin = builtinTitlesText(s.lensLanguage, locale(), (list) => t("universe.settings.titles.also", { list }));
  new Setting(containerEl)
    .setName(t("universe.settings.titles"))
    .setDesc(t("universe.settings.titles.desc", { list: builtin }))
    .addTextArea((c) => {
      c.setPlaceholder(t("universe.settings.titles.none")).setValue(s.nameTitles);
      c.inputEl.addClass("escrita-universe-titles");
      c.inputEl.setAttr("aria-label", t("universe.settings.titles"));
      c.inputEl.addEventListener("change", () => { s.nameTitles = c.getValue(); void ui.save(); });
    });

  // collapsed by default; the writer's click only shows or hides the block, it saves nothing
  const toggle = new Setting(containerEl)
    .setName(t("universe.settings.props"))
    .setDesc(t("universe.settings.props.desc"));
  const block = containerEl.createDiv({ cls: "escrita-universe-props" });
  block.hidden = true;
  toggle.addButton((b) => {
    const sync = () => {
      const open = !block.hidden;
      b.setButtonText(t(open ? "universe.settings.props.hide" : "universe.settings.props.show"));
      b.buttonEl.setAttr("aria-expanded", String(open));
    };
    b.buttonEl.setAttr("aria-controls", "escrita-universe-props");
    sync();
    b.onClick(() => { block.hidden = !block.hidden; sync(); });
  });
  block.id = "escrita-universe-props";

  const row = (key: "caseSensitive" | "ignore" | "firstName", prop: "caseSensitiveProperty" | "ignoreProperty" | "firstNameProperty") => {
    block.createSpan({ cls: "setting-item-description", text: t(`universe.settings.props.${key}`) });
    const input = block.createEl("input", { type: "text", attr: { placeholder: d[prop], spellcheck: "false", "aria-label": t(`universe.settings.props.${key}.label`) } });
    input.value = s[prop];
    input.addEventListener("change", () => {
      const v = input.value.trim() || d[prop];
      input.value = v;
      s[prop] = v;
      void ui.save();
    });
  };
  row("caseSensitive", "caseSensitiveProperty");
  row("ignore", "ignoreProperty");
  row("firstName", "firstNameProperty");
}

function noteName(note: string): string {
  return stripSlashes(note).replace(/\.md$/i, "").split("/").pop() ?? note;
}
