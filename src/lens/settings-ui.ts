import { Setting } from "obsidian";
import { locale, t } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { listsPath } from "./settings";
import { listsTarget } from "./shown";
import { lensLang } from "./lang";
import { RULES } from "./types";

export function lensSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.lens")).setHeading();
  el.createDiv({ cls: "setting-item-description escrita-lens-desc", text: t("settings.lens.desc") });

  const listsRow = new Setting(el)
    .setName(t("settings.lens.lists"))
    .setDesc(t("settings.lens.lists.desc"))
    .addText((c) => {
      c.setPlaceholder(listsTarget("", lensLang(s.lensLanguage, locale()))).setValue(s.lensListsNote);
      c.inputEl.setAttr("aria-label", t("settings.lens.lists"));
      const commit = () => {
        const path = listsPath(c.getValue());
        c.setValue(path);
        if (path === s.lensListsNote) return;
        s.lensListsNote = path;
        void ui.save();
      };
      c.inputEl.addEventListener("change", commit);
      c.inputEl.addEventListener("blur", commit);
    })
    .addButton((b) => b.setButtonText(t("settings.lens.lists.create"))
      .onClick(async () => { await plugin.lens.createLists(); ui.redraw(); }));
  listsRow.settingEl.addClass("escrita-lens-stack");

  const numberRow = (key: "lensEchoWindow" | "lensLongSentence", name: string, min: number, max: number) => {
    new Setting(el)
      .setName(t(`settings.lens.${name}`))
      .setDesc(t(`settings.lens.${name}.desc`))
      .addText((c) => {
        c.inputEl.type = "text";
        c.inputEl.inputMode = "numeric";
        c.inputEl.addClass("escrita-lens-number");
        c.inputEl.setAttr("aria-label", t(`settings.lens.${name}`));
        c.setValue(String(s[key]));
        // Saved when the field is committed (blur or Enter), never per key; an invalid value is put back.
        c.inputEl.addEventListener("change", () => {
          const raw = c.getValue().trim();
          const n = Number(raw);
          if (raw !== "" && /^\d+$/.test(raw) && n >= min && n <= max && n !== s[key]) { s[key] = n; void ui.save(); }
          c.setValue(String(s[key]));
        });
      })
      .controlEl.createSpan({ cls: "setting-item-description", text: t("settings.lens.words") });
  };
  numberRow("lensEchoWindow", "echoWindow", 10, 200);
  numberRow("lensLongSentence", "longSentence", 15, 200);

  new Setting(el)
    .setName(t("settings.lens.skipQuotes"))
    .setDesc(t("settings.lens.skipQuotes.desc"))
    .addToggle((c) => c.setValue(s.lensSkipQuotes).onChange(async (v) => { s.lensSkipQuotes = v; await ui.save(); }));

  new Setting(el).setName(t("settings.lens.rules")).setHeading();
  const lens = lensLang(s.lensLanguage, locale());
  const english = lens === "en";
  for (const r of RULES) {
    const key = r === "gerund" && english ? "gerund.en" : r;
    const desc = r === "adverb"
      ? t(`settings.lens.rule.adverb.${lens ?? "none"}.desc`)
      : t(`settings.lens.rule.${key}.desc`);
    const row = new Setting(el).setName(t(`lens.rule.${key}`));
    if (desc !== "") row.setDesc(desc);
    row.addToggle((c) => c.setValue(!s.lensRulesOff.includes(r)).onChange(async (v) => {
      const off = s.lensRulesOff.filter((x) => x !== r);
      if (!v) off.push(r);
      s.lensRulesOff = off;
      await ui.save();
    }));
  }

  new Setting(el).setName(t("settings.lens.measures")).setHeading();
  new Setting(el)
    .setName(t("settings.lens.showDialogue"))
    .addToggle((c) => c.setValue(s.lensShowDialogue).onChange(async (v) => { s.lensShowDialogue = v; await ui.save(); }));
  new Setting(el)
    .setName(t("settings.lens.showReadability"))
    .setDesc(t("settings.lens.showReadability.desc"))
    .addToggle((c) => c.setValue(s.lensShowReadability).onChange(async (v) => { s.lensShowReadability = v; await ui.save(); }));
}

export async function lensOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const s = plugin.settings;
  return t("settings.features.off.lens", { note: s.lensListsNote || listsTarget("", lensLang(s.lensLanguage, locale())) });
}
