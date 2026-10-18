// Page object for "Set up a writing vault" (src/setup/modal.ts). Locators by the modal's own
// classes; labels are passed in by the spec (they depend on the language).
import type { Locator } from "@playwright/test";
import type { App } from "./app";

export interface PreviewRow {
  label: string;
  mark: string | null;
  pill: string | null;
  off: boolean;
  tick: boolean;
  value: string;
  reason: string;
}

export interface PreviewGroup {
  title: string;
  rows: PreviewRow[];
}

export class SetupModal {
  constructor(private readonly app: App) {}

  get root(): Locator {
    return this.app.page.locator(".modal.escrita-setup-modal");
  }

  /** The step line, "1 · Escolhas › 2 · O que vou criar", with the current one marked. */
  steps(): Promise<{ texts: string[]; current: string }> {
    return this.root.evaluate((el) => {
      const spans = [...el.querySelectorAll(".escrita-setup-steps span")] as HTMLElement[];
      return { texts: spans.map((s) => s.innerText), current: spans.find((s) => s.classList.contains("is-on"))?.innerText ?? "" };
    });
  }

  field(label: string): Locator {
    return this.root.locator(".escrita-setup-field").filter({ has: this.app.page.locator(".escrita-setup-label", { hasText: label }) });
  }

  chip(name: string): Locator {
    return this.root.locator(".escrita-setup-chip").filter({ hasText: new RegExp(`^${name}$`) });
  }

  card(name: string): Locator {
    return this.root.locator(".escrita-setup-card").filter({ has: this.app.page.locator("b", { hasText: new RegExp(`^${name}$`) }) });
  }

  button(name: string | RegExp): Locator {
    return this.root.locator(".escrita-setup-buttons button").filter({ hasText: name });
  }

  /** Which chips or cards are pressed (aria-pressed), by text. */
  async pressed(scope: Locator = this.root): Promise<string[]> {
    return scope.locator('[aria-pressed="true"]').evaluateAll((els) => els.map((e) => (e.querySelector("b") ?? e as HTMLElement).textContent ?? ""));
  }

  /** Step 2, read from the DOM in order: each group with its rows. */
  preview(): Promise<PreviewGroup[]> {
    return this.root.locator(".escrita-setup-scroll").evaluate((scroll) => {
      const groups: { title: string; rows: any[] }[] = [];
      for (const el of [...scroll.children] as HTMLElement[]) {
        if (el.classList.contains("escrita-setup-group")) groups.push({ title: el.textContent ?? "", rows: [] });
        else if (el.classList.contains("escrita-setup-row") && groups.length > 0) {
          const text = (sel: string) => (el.querySelector(sel) as HTMLElement | null)?.innerText ?? "";
          const ck = el.querySelector(".escrita-setup-ck");
          groups[groups.length - 1].rows.push({
            label: text(".escrita-setup-line > span:first-child"),
            mark: el.querySelector(".escrita-setup-mark") ? text(".escrita-setup-mark") : null,
            pill: el.querySelector(".escrita-setup-pill.is-example") ? text(".escrita-setup-pill.is-example") : null,
            off: el.classList.contains("is-off"),
            tick: ck ? ck.getAttribute("aria-checked") === "true" : false,
            value: text(".escrita-setup-value"),
            reason: text(".escrita-setup-reason"),
          });
        }
      }
      return groups;
    });
  }

  /** The tick button of a row, by the aria-label "Include: <label>" (a prefix of it works too). */
  tick(includePrefix: string, label: string): Locator {
    return this.root.locator(`.escrita-setup-ck[aria-label="${includePrefix}${label}"]`);
  }

  summary(): Promise<string> {
    return this.root.locator(".escrita-setup-summary").innerText();
  }
}
