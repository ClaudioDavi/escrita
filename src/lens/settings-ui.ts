import type { SettingDefinitionRender } from "obsidian";
import { locale, t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { numberRow, textAreaRow, textRow, toggleRow, noteRow, type SettingsBlock } from "../ui/settings-rows";
import { listsPath, parseNotNames } from "./settings";
import { listsTarget } from "./shown";
import { lensLang } from "./lang";
import { RULES } from "./types";

/**
 * The same ui, but a committed text field saves only when `read()` changed: committing the value
 * the setting already holds (a list path that cleans to itself, a number that clamps back) writes
 * nothing, as these fields always did.
 */
function savingWhenChanged(ui: SettingsUi, read: () => unknown): SettingsUi {
  return {
    ...ui,
    saveOnCommit: (c, fallback, apply) => {
      c.inputEl.addEventListener("change", () => {
        const v = c.getValue().trim() || fallback();
        c.setValue(v);
        const before = read();
        apply(v);
        if (read() !== before) void ui.save();
      });
    },
  };
}

/**
 * The Lens section's rows, under the heading the tab draws: its description, the lists note and
 * the numbers, then the "Rules" and "Measures" blocks, each a group of its own.
 */
export function lensSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;

  const lists = textRow(savingWhenChanged(ui, () => s.lensListsNote), {
    name: t("settings.lens.lists"),
    desc: t("settings.lens.lists.desc"),
    cls: "escrita-lens-stack",
    placeholder: listsTarget("", lensLang(s.lensLanguage, locale())),
    get: () => s.lensListsNote,
    set: (v) => { s.lensListsNote = listsPath(v); },
  });
  const listsRow: SettingDefinitionRender = {
    ...lists,
    render: (setting, group) => {
      const cleanup = lists.render(setting, group);
      setting.addButton((b) => b.setButtonText(t("settings.lens.lists.create"))
        .onClick(async () => { await plugin.lens.createLists(); ui.redraw(); }));
      return cleanup;
    },
  };

  const number = (key: "lensEchoWindow" | "lensLongSentence", name: string, min: number, max: number) =>
    numberRow(savingWhenChanged(ui, () => s[key]), {
      name: t(`settings.lens.${name}`),
      desc: t(`settings.lens.${name}.desc`),
      min, max,
      inputCls: "escrita-lens-number",
      unit: t("settings.lens.words"),
      get: () => s[key],
      set: (v) => { s[key] = v; },
    });

  const lens = lensLang(s.lensLanguage, locale());
  const english = lens === "en";
  const rules = RULES.map((r) => {
    const key = r === "gerund" && english ? "gerund.en" : r;
    return toggleRow(ui, {
      name: t(`lens.rule.${key}`),
      desc: r === "adverb" ? t(`settings.lens.rule.adverb.${lens ?? "none"}.desc`) : t(`settings.lens.rule.${key}.desc`),
      get: () => !s.lensRulesOff.includes(r),
      set: (v) => {
        const off = s.lensRulesOff.filter((x) => x !== r);
        if (!v) off.push(r);
        s.lensRulesOff = off;
      },
    });
  });

  return [
    {
      items: [
        noteRow(t("settings.lens.desc"), "escrita-lens-desc"),
        listsRow,
        number("lensEchoWindow", "echoWindow", 10, 200),
        number("lensLongSentence", "longSentence", 15, 200),
        toggleRow(ui, {
          name: t("settings.lens.skipQuotes"),
          desc: t("settings.lens.skipQuotes.desc"),
          get: () => s.lensSkipQuotes,
          set: (v) => { s.lensSkipQuotes = v; },
        }),
      ],
    },
    {
      heading: t("settings.lens.rules"),
      items: [
        ...rules,
        // the opt-in names rule (0.9, U 2.5): off until the writer turns it on, with its "Not names" list
        toggleRow(ui, {
          name: t("lens.rule.newName"),
          desc: t("settings.lens.rule.newName.desc"),
          get: () => s.lensRulesOn.includes("newName"),
          set: (v) => {
            const on = s.lensRulesOn.filter((x) => x !== "newName");
            if (v) on.push("newName");
            s.lensRulesOn = on;
          },
        }),
        textAreaRow(savingWhenChanged(ui, () => s.notNames), {
          name: t("settings.lens.notNames"),
          desc: t("settings.lens.notNames.desc"),
          get: () => s.notNames,
          set: (v) => { s.notNames = parseNotNames(v).join("\n"); },
        }),
      ],
    },
    {
      heading: t("settings.lens.measures"),
      items: [
        toggleRow(ui, {
          name: t("settings.lens.showDialogue"),
          get: () => s.lensShowDialogue,
          set: (v) => { s.lensShowDialogue = v; },
        }),
        toggleRow(ui, {
          name: t("settings.lens.showReadability"),
          desc: t("settings.lens.showReadability.desc"),
          get: () => s.lensShowReadability,
          set: (v) => { s.lensShowReadability = v; },
        }),
      ],
    },
  ];
}

export async function lensOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const s = plugin.settings;
  return t("settings.features.off.lens", { note: s.lensListsNote || listsTarget("", lensLang(s.lensLanguage, locale())) });
}
