import { Setting, moment } from "obsidian";
import { t } from "../i18n";
import { cleanWeekdays } from "../core/merge";
import { invalidDatesOff } from "../core/daysoff";
import { fmt, plural } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";

/** The Goals section: daily goal, jumps, sprint, status bar, days off. */
export function goalsSettingsSection(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  new Setting(el).setName(t("settings.goals")).setHeading();
  new Setting(el)
    .setName(t("settings.dailyGoal"))
    .addText((c) => {
      c.setValue(String(s.dailyGoal));
      ui.saveOnCommit(c, () => String(s.dailyGoal), (v) => { s.dailyGoal = ui.num(v, s.dailyGoal); c.setValue(String(s.dailyGoal)); });
    });
  new Setting(el)
    .setName(t("settings.ignoreJumpsOver"))
    .setDesc(t("settings.ignoreJumpsOver.desc"))
    .addText((c) => {
      c.setValue(String(s.ignoreJumpsOver));
      ui.saveOnCommit(c, () => String(s.ignoreJumpsOver), (v) => { s.ignoreJumpsOver = ui.num(v, s.ignoreJumpsOver, 50); c.setValue(String(s.ignoreJumpsOver)); });
    });
  new Setting(el)
    .setName(t("settings.sprintMinutes"))
    .setDesc(t("settings.sprintMinutes.desc"))
    .addText((c) => {
      c.setValue(String(s.sprintMinutes));
      ui.saveOnCommit(c, () => String(s.sprintMinutes), (v) => { s.sprintMinutes = Math.min(240, ui.num(v, s.sprintMinutes, 1)); c.setValue(String(s.sprintMinutes)); });
    })
    .addText((c) => {
      c.setValue(String(s.sprintTarget));
      ui.saveOnCommit(c, () => String(s.sprintTarget), (v) => { s.sprintTarget = ui.num(v, s.sprintTarget, 0); c.setValue(String(s.sprintTarget)); });
    });
  new Setting(el)
    .setName(t("settings.showStatusBar"))
    .addToggle((c) => c.setValue(s.showStatusBar)
      .onChange(async (v) => { s.showStatusBar = v; await ui.save(); }));
  weekdaysSetting(el, ui, plugin);
  const datesOff = new Setting(el)
    .setName(t("settings.datesOff"))
    .setDesc(t("settings.datesOff.desc"));
  const datesHint = datesOff.descEl.createDiv({ cls: "escrita-setting-warning" });
  const showDatesHint = (value: string) => {
    const bad = invalidDatesOff(value);
    datesHint.setText(bad.length ? t("settings.datesOff.invalid", { dates: bad.join(", ") }) : "");
    datesHint.toggle(bad.length > 0);
  };
  showDatesHint(s.datesOff);
  datesOff.addTextArea((c) => {
    c.setPlaceholder("2026-12-25\n2027-01-01").setValue(s.datesOff);
    c.onChange((v) => showDatesHint(v)); // the hint follows the typing; the save waits for the commit
    ui.saveOnCommit(c, () => "", (v) => { s.datesOff = v; showDatesHint(v); });
  });
}

/** One labeled checkbox per weekday, in the locale's week order. */
function weekdaysSetting(el: HTMLElement, ui: SettingsUi, plugin: EscritaPlugin): void {
  const s = plugin.settings;
  const setting = new Setting(el)
    .setName(t("settings.weekdaysOff"))
    .setDesc(t("settings.weekdaysOff.desc"));
  setting.settingEl.addClass("escrita-setting-weekdays");
  const box = setting.controlEl.createDiv({ cls: "escrita-weekdays" });
  const first = moment.localeData().firstDayOfWeek();
  for (let i = 0; i < 7; i++) {
    const day = (first + i) % 7;
    const label = box.createEl("label", { cls: "escrita-weekday" });
    const input = label.createEl("input", { type: "checkbox" });
    input.checked = s.weekdaysOff.includes(day);
    label.createSpan({ text: moment.weekdaysShort(day) });
    label.setAttr("aria-label", moment.weekdays(day));
    // The listener lives and dies with the element (re-rendered on every display()).
    input.addEventListener("change", () => {
      const set = new Set(s.weekdaysOff);
      if (input.checked) set.add(day);
      else set.delete(day);
      s.weekdaysOff = cleanWeekdays([...set]);
      void ui.save();
    });
  }
}

export async function goalsOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const n = Object.keys(plugin.data.history).length;
  return n > 0 ? plural("settings.features.off.goals", n, { n: fmt(n) }) : null;
}
