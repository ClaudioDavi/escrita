// A fake SettingsUi for tests that draw one module's settings section with the `Setting` stub.
import { vi } from "vitest";
import type { SettingsUi } from "../../src/core/module-context";
import { defaultsFor } from "../../src/settings";

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
    app: {}, save, defaults: () => defaultsFor(lang), redraw: vi.fn(), num: (v: string, fb: number) => (/^\d+$/.test(v) ? Number(v) : fb),
    saveOnCommit(c: { inputEl: HTMLInputElement; getValue(): string; setValue(v: string): unknown }, fallback: () => string, apply: (v: string) => void) {
      fields.push(c);
      c.inputEl.addEventListener("change", () => {
        const v = c.getValue().trim() || fallback();
        c.setValue(v);
        apply(v);
        void save();
      });
    },
  } as unknown as SettingsUi;
  return { ui, save, fields };
}

/** Types `v` into a field and commits it (the `change` event). */
export function commit(field: { inputEl: HTMLInputElement }, v: string): void {
  field.inputEl.value = v;
  field.inputEl.dispatchEvent(new Event("change"));
}
