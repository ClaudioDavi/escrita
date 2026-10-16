// The Universe section of the settings tab (boards 19, 24 and 40), built by the universe module
// (`UniverseModule.settingsItems`). The tab's core draws the slot's heading (the slot is shared
// with threads); this builds the rows: the description, the mode pointer, the note and folders, the
// form rows, the thread words (while threads is loaded: `threadWordRows`), then the "Types" and
// "Names" blocks, each a group with its own heading. With the mode off only the thread words
// draw. A mode change rebuilds the tab, so the rows are chosen when they are built. Text fields
// save when the writer leaves them (the row helpers, ui.saveOnCommit, or a change event), so a
// word typed letter by letter doesn't rebuild the vault indexes at every key.

import { Notice, type Setting, type SettingDefinitionRender, type SettingGroupItem } from "obsidian";
import { locale, t } from "../i18n";
import type { SettingsUi } from "../core/module-context";
import type EscritaPlugin from "../main";
import { customRow, noteRow, textAreaRow, textRow, toggleRow, type SettingsBlock } from "../ui/settings-rows";
import { ENTRY_KINDS, normalizeNotePath } from "./settings";
import { builtinTitlesText } from "./names-settings";
import { formValuesText, parseFormValues } from "../core/form";
import { threadWordRows } from "./threads-settings-ui";

const stripSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

const DESC_CLS = "escrita-universe-settings-desc";

/** The same row with more controls after its own, in the same Setting. */
function withControls(def: SettingDefinitionRender, more: (s: Setting) => void): SettingDefinitionRender {
  const base = def.render;
  return { ...def, render: (s, g) => { const cleanup = base(s, g); more(s); return cleanup; } };
}

export function universeSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  const mode = s.universeMode;
  const words = plugin.features.isOn("threads");
  if (mode === "off") return words ? [{ items: threadWordRows(ui, s) }] : [];
  return [
    { items: formItems(ui, plugin, mode) },
    { heading: t("universe.settings.types"), items: typesItems(ui, plugin, mode) },
    { heading: t("universe.settings.names"), items: namesItems(ui, plugin) },
  ];
}

/** The "Create" button of the universe note row: makes the note, or says it is there already. */
async function createNote(plugin: EscritaPlugin): Promise<void> {
  try {
    const { file, created } = await plugin.universe.createUniverseNote();
    new Notice(t(created ? "universe.notice.noteCreated" : "universe.notice.noteExists", { path: file.path }));
  } catch (e) {
    console.error("Escrita: couldn't create the universe note", e);
    new Notice(t("universe.notice.noteFailed"));
  }
}

/** The description, the note and folders, the form rows, then the thread words (today's order). */
function formItems(ui: SettingsUi, plugin: EscritaPlugin, mode: "perBook" | "universe"): SettingGroupItem[] {
  const s = plugin.settings;
  const d = ui.defaults();
  const items: SettingGroupItem[] = [
    noteRow(t("universe.settings.desc"), DESC_CLS),
    noteRow(t("universe.settings.mode.pointer"), DESC_CLS),
  ];

  if (mode === "universe") {
    items.push(
      withControls(
        textRow(ui, {
          name: t("universe.settings.note"),
          desc: () => t("universe.settings.note.desc", { example: `${s.universeProperty}: "[[${noteName(s.universeNote)}]]"` }),
          key: "universeNote",
          placeholder: d.universeNote,
          get: () => s.universeNote,
          set: (v) => { s.universeNote = normalizeNotePath(v, d.universeNote); },
        }),
        (setting) => {
          setting.addButton((b) => b.setButtonText(t("universe.settings.note.create")).onClick(() => { void createNote(plugin); }));
        },
      ),
      textAreaRow(ui, {
        name: t("universe.settings.folders"),
        desc: t("universe.settings.folders.desc"),
        placeholder: t("universe.settings.defaultFolders.example"),
        get: () => s.defaultUniverseFolders,
        set: (v) => { s.defaultUniverseFolders = v; },
      }),
    );
  }

  const form = textRow(ui, {
    name: t("universe.settings.form"),
    desc: t(mode === "universe" ? "universe.settings.form.desc" : "universe.settings.form.desc.perBook"),
    key: "formProperty",
    placeholder: d.formProperty,
    inputCls: "escrita-universe-narrow",
    get: () => s.formProperty,
    set: (v) => { s.formProperty = v; },
  });
  if (mode === "universe") {
    // the values sit in the same row, after the property; they parse on change (an unreadable text keeps the saved ones)
    items.push(withControls(form, (setting) => {
      setting.addText((c) => {
        c.setPlaceholder(formValuesText(d.formValues)).setValue(formValuesText(s.formValues));
        c.inputEl.addClass("escrita-universe-wide");
        c.inputEl.setAttr("aria-label", t("universe.settings.form.values"));
        // blank or unreadable text keeps the saved values (parseFormValues)
        ui.saveOnCommit(c, () => formValuesText(s.formValues), (v) => { s.formValues = parseFormValues(v, s.formValues); c.setValue(formValuesText(s.formValues)); }, () => formValuesText(s.formValues));
      });
    }));
    items.push(textAreaRow(ui, {
      name: t("universe.settings.formFolders"),
      desc: t("universe.settings.formFolders.desc"),
      placeholder: t("universe.settings.formFolders.example"),
      get: () => s.formFolders,
      set: (v) => { s.formFolders = v; },
    }));
  } else {
    items.push(form);
  }

  // The thread words sit between the form rows and the types (today's order).
  if (plugin.features.isOn("threads")) items.push(...threadWordRows(ui, s));
  return items;
}

/** "Types": its description, the type property and the table of entry types. */
function typesItems(ui: SettingsUi, plugin: EscritaPlugin, mode: "perBook" | "universe"): SettingGroupItem[] {
  const s = plugin.settings;
  const d = ui.defaults();
  return [
    noteRow(mode === "perBook"
      ? () => {
        const book = plugin.books.allBooks()[0]?.folder.name ?? t("universe.settings.bookExample");
        return t("universe.settings.types.bookDesc", { example: `${book}/${s.entryTypes.character.folder}` });
      }
      : t("universe.settings.types.desc"), DESC_CLS),
    textRow(ui, {
      name: t("universe.settings.types.property"),
      key: "typeProperty",
      placeholder: d.typeProperty,
      inputCls: "escrita-universe-narrow",
      get: () => s.typeProperty,
      set: (v) => { s.typeProperty = v; },
    }),
    customRow("", (el) => typesTable(el, ui, plugin)),
    noteRow(t("universe.settings.types.note"), DESC_CLS),
  ];
}

/** The table of entry types: value, folder, template and label for each kind (one block per type on a phone). */
function typesTable(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  const d = ui.defaults();
  const table = el.createDiv({ cls: "escrita-types", attr: { role: "group", "aria-label": t("universe.settings.types") } });
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
      ui.saveOnCommit(input, fallback, apply, () => type[col]);
    };
    field("value", d.entryTypes[k].value, (v) => { type.value = v; }, () => d.entryTypes[k].value);
    field("folder", d.entryTypes[k].folder, (v) => { type.folder = stripSlashes(v); }, () => d.entryTypes[k].folder);
    field("template", t("universe.settings.types.none"), (v) => { type.template = v; }, () => "");
    field("label", d.entryTypes[k].label, (v) => { type.label = v; }, () => d.entryTypes[k].label);
  }
}

/** "Names" (board 24, l): the underline switch, the extra titles and the three per-entry property names (collapsed). */
function namesItems(ui: SettingsUi, plugin: EscritaPlugin): SettingGroupItem[] {
  const s = plugin.settings;
  // collapsed by default; the writer's click only shows or hides the block, it saves nothing
  let expanded = false;
  let blockRow: HTMLElement | null = null;
  return [
    toggleRow(ui, {
      name: t("universe.settings.underline"),
      desc: t("universe.settings.underline.desc"),
      get: () => s.underlineNames,
      set: (v) => { s.underlineNames = v; },
    }),
    textAreaRow(ui, {
      name: t("universe.settings.titles"),
      desc: () => t("universe.settings.titles.desc", { list: builtinTitlesText(s.lensLanguage, locale(), (list) => t("universe.settings.titles.also", { list })) }),
      placeholder: t("universe.settings.titles.none"),
      inputCls: "escrita-universe-titles",
      get: () => s.nameTitles,
      set: (v) => { s.nameTitles = v; },
    }),
    {
      name: t("universe.settings.props"),
      desc: t("universe.settings.props.desc"),
      render: (setting) => {
        setting.addButton((b) => {
          const sync = () => {
            b.setButtonText(t(expanded ? "universe.settings.props.hide" : "universe.settings.props.show"));
            b.buttonEl.setAttr("aria-expanded", String(expanded));
          };
          b.buttonEl.setAttr("aria-controls", "escrita-universe-props");
          sync();
          b.onClick(() => {
            expanded = !expanded;
            blockRow?.toggle(expanded);
            sync();
          });
        });
      },
    },
    customRow("", (el) => {
      blockRow = el;
      propertyInputs(el.createDiv({ cls: "escrita-universe-props", attr: { id: "escrita-universe-props" } }), ui, plugin);
    }, { visible: () => expanded }),
  ];
}

/** The three per-entry property names: a label and a field each, saved when the writer commits the field. */
function propertyInputs(block: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  const d = ui.defaults();
  const row = (key: "caseSensitive" | "ignore" | "firstName", prop: "caseSensitiveProperty" | "ignoreProperty" | "firstNameProperty") => {
    block.createSpan({ cls: "setting-item-description", text: t(`universe.settings.props.${key}`) });
    const input = block.createEl("input", { type: "text", attr: { placeholder: d[prop], spellcheck: "false", "aria-label": t(`universe.settings.props.${key}.label`) } });
    input.value = s[prop];
    ui.saveOnCommit(input, () => d[prop], (v) => { s[prop] = v; }, () => s[prop]);
  };
  row("caseSensitive", "caseSensitiveProperty");
  row("ignore", "ignoreProperty");
  row("firstName", "firstNameProperty");
}

function noteName(note: string): string {
  return stripSlashes(note).replace(/\.md$/i, "").split("/").pop() ?? note;
}
