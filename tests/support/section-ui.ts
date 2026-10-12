// A fake SettingsUi for tests that draw one module's settings section with the `Setting` stub.
import { vi } from "vitest";
import type { SettingsUi } from "../../src/core/module-context";
import type { TextAreaComponent, TextComponent } from "obsidian";
import { defaultsFor, digitsNumber } from "../../src/settings";
import { wireCommit } from "../../src/ui/settings-rows";

export interface FakeUi {
  ui: SettingsUi;
  save: ReturnType<typeof vi.fn>;
  /** The text fields wired through saveOnCommit, in drawing order. */
  fields: { inputEl: HTMLInputElement }[];
}

export function fakeUi(lang: "en" | "pt-BR" = "en"): FakeUi {
  const save = vi.fn(async () => {});
  const fields: FakeUi["fields"] = [];
  const ui = {
    app: {}, save, defaults: () => defaultsFor(lang), redraw: vi.fn(), num: digitsNumber,
    saveOnCommit(c: TextComponent | TextAreaComponent | HTMLInputElement, fallback: () => string, apply: (v: string) => void, read?: () => string | number) {
      fields.push({ inputEl: (c instanceof HTMLInputElement ? c : c.inputEl) as HTMLInputElement });
      wireCommit(c, fallback, apply, read, save);
    },
  } as unknown as SettingsUi;
  return { ui, save, fields };
}

/** Types `v` into a field and commits it (the `change` event). */
export function commit(field: { inputEl: HTMLInputElement }, v: string): void {
  field.inputEl.value = v;
  field.inputEl.dispatchEvent(new Event("change"));
}
