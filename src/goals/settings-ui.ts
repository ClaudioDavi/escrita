import type { SettingDefinitionRender, TextAreaComponent } from "obsidian";
import { moment } from "obsidian";
import { t } from "../i18n";
import { cleanWeekdays } from "../core/merge";
import { invalidDatesOff } from "../core/daysoff";
import { fmt, plural } from "../i18n";
import type EscritaPlugin from "../main";
import type { SettingsUi } from "../core/module-context";
import { numberRow, textAreaRow, toggleRow, type SettingsBlock } from "../ui/settings-rows";

const MAX = Number.MAX_SAFE_INTEGER;

/** The Goals section's rows, under the heading the tab draws: daily goal, jumps, sprint, status bar, days off. */
export function goalsSettingsItems(ui: SettingsUi, plugin: EscritaPlugin): SettingsBlock[] {
  const s = plugin.settings;
  return [{
    items: [
      numberRow(ui, {
        name: t("settings.dailyGoal"),
        min: 0, max: MAX,
        get: () => s.dailyGoal,
        set: (v) => { s.dailyGoal = v; },
      }),
      numberRow(ui, {
        name: t("settings.ignoreJumpsOver"),
        desc: t("settings.ignoreJumpsOver.desc"),
        min: 50, max: MAX,
        get: () => s.ignoreJumpsOver,
        set: (v) => { s.ignoreJumpsOver = v; },
      }),
      sprintRow(ui, plugin),
      toggleRow(ui, {
        name: t("settings.showStatusBar"),
        get: () => s.showStatusBar,
        set: (v) => { s.showStatusBar = v; },
      }),
      weekdaysRow(ui, plugin),
      datesOffRow(ui, plugin),
    ],
  }];
}

/** The default sprint: minutes, then target words, two fields in one row. */
function sprintRow(ui: SettingsUi, plugin: EscritaPlugin): SettingDefinitionRender {
  const s = plugin.settings;
  const minutes = numberRow(ui, {
    name: t("settings.sprintMinutes"),
    desc: t("settings.sprintMinutes.desc"),
    min: 1, max: 240,
    get: () => s.sprintMinutes,
    set: (v) => { s.sprintMinutes = v; },
  });
  // Only its field is drawn (into the minutes row), so the name is just the field's label.
  const target = numberRow(ui, {
    name: t("goals.sprint.target"),
    min: 0, max: MAX,
    get: () => s.sprintTarget,
    set: (v) => { s.sprintTarget = v; },
  });
  return {
    ...minutes,
    render: (setting, group) => {
      const a = minutes.render?.(setting, group);
      const b = target.render?.(setting, group);
      return () => { a?.(); b?.(); };
    },
  };
}

/** One labeled checkbox per weekday, in the locale's week order. */
function weekdaysRow(ui: SettingsUi, plugin: EscritaPlugin): SettingDefinitionRender {
  const s = plugin.settings;
  return {
    name: t("settings.weekdaysOff"),
    desc: t("settings.weekdaysOff.desc"),
    render: (setting) => {
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
        // The listener lives and dies with the element (the row's control is cleared at each render).
        input.addEventListener("change", () => {
          const set = new Set(s.weekdaysOff);
          if (input.checked) set.add(day);
          else set.delete(day);
          s.weekdaysOff = cleanWeekdays([...set]);
          void ui.save();
        });
      }
    },
  };
}

/** The dates-off text area, with a warning under the description that follows the typing. */
function datesOffRow(ui: SettingsUi, plugin: EscritaPlugin): SettingDefinitionRender {
  const s = plugin.settings;
  /** Redraws the warning of the row as last rendered. */
  let showHint: (value: string) => void = () => {};
  const area = textAreaRow(ui, {
    name: t("settings.datesOff"),
    desc: t("settings.datesOff.desc"),
    placeholder: "2026-12-25\n2027-01-01",
    get: () => s.datesOff,
    set: (v) => { s.datesOff = v; showHint(v); },
  });
  return {
    ...area,
    render: (setting, group) => {
      const hint = setting.descEl.createDiv({ cls: "escrita-setting-warning" });
      showHint = (value) => {
        const bad = invalidDatesOff(value);
        hint.setText(bad.length ? t("settings.datesOff.invalid", { dates: bad.join(", ") }) : "");
        hint.toggle(bad.length > 0);
      };
      showHint(s.datesOff);
      const cleanup = area.render?.(setting, group);
      // The hint follows the typing; the save waits for the commit.
      const field = setting.components[setting.components.length - 1] as TextAreaComponent | undefined;
      field?.onChange((v) => showHint(v));
      return cleanup;
    },
  };
}

export async function goalsOffNotice(plugin: EscritaPlugin): Promise<string | null> {
  const n = Object.keys(plugin.data.history).length;
  return n > 0 ? plural("settings.features.off.goals", n, { n: fmt(n) }) : null;
}
