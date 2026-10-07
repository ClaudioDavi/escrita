// The pure decisions of the setup's layout step (1.0, task 2.3, boards 37 and 39): which
// panels go where, and which file is the home note. No Obsidian imports; layout.ts does the
// workspace calls from this plan.

import { VIEW_TYPES } from "../core/view-types";

/**
 * How a panel is placed:
 * - `sidebar`: a new tab in the right sidebar (`getRightLeaf(false)`), the first of a group.
 * - `splitBelow`: a new group below the `anchor` panel's (`createLeafBySplit`, horizontal).
 * - `tabWith`: a new tab in the same group as the `anchor` panel (`createLeafInParent`).
 * - `leftTab`: a new tab in the left sidebar, behind the files (`getLeftLeaf(false)`).
 */
export type PanelHow = "sidebar" | "splitBelow" | "tabWith" | "leftTab";

export interface PanelStep {
  view: string;
  how: PanelHow;
  /** the view type of the panel this one is placed against (splitBelow, tabWith) */
  anchor?: string;
}

export interface PanelPlanInput {
  /** `desk` places panels; `focus` places none (the writing mode hides them) */
  layout: "desk" | "focus";
  phone: boolean;
  /** whether the feature behind a panel is on (`features.isOn`) */
  on: { outline: boolean; lens: boolean; placeholders: boolean; universe: boolean };
}

/**
 * Board 37 a: the right sidebar split in half, the outline on top, the lens below with the
 * placeholders as its second tab; the universe panel behind the files on the left. Board 37 c
 * (phone): drawers don't split, so outline and lens are two tabs of the right drawer. A panel
 * whose feature is off is left out, and the groups close up around it.
 */
export function planPanels(input: PanelPlanInput): PanelStep[] {
  if (input.layout === "focus") return [];
  const { on, phone } = input;
  const steps: PanelStep[] = [];

  if (phone) {
    if (on.outline) steps.push({ view: VIEW_TYPES.outline, how: "sidebar" });
    if (on.lens) steps.push({ view: VIEW_TYPES.lens, how: "sidebar" });
    return steps;
  }

  const groups: string[][] = [
    on.outline ? [VIEW_TYPES.outline] : [],
    [on.lens ? VIEW_TYPES.lens : "", on.placeholders ? VIEW_TYPES.placeholders : ""].filter(Boolean),
  ].filter((g) => g.length > 0);

  let previousHead: string | undefined;
  for (const group of groups) {
    const [head, ...rest] = group as [string, ...string[]];
    steps.push(previousHead === undefined
      ? { view: head, how: "sidebar" }
      : { view: head, how: "splitBelow", anchor: previousHead });
    for (const view of rest) steps.push({ view, how: "tabWith", anchor: head });
    previousHead = head;
  }
  if (on.universe) steps.push({ view: VIEW_TYPES.universe, how: "leftTab" });
  return steps;
}

/**
 * The vault path the `homeNote` setting names, matched like `SetupModule.hasHomeNote`: letter
 * case ignored, ".md" added when missing. Null when the setting is blank or nothing matches.
 * `normalized` is the setting already passed through `normalizePath`.
 */
export function resolveHomePath(normalized: string, paths: readonly string[]): string | null {
  if (!normalized) return null;
  const want = (/\.md$/i.test(normalized) ? normalized : `${normalized}.md`).normalize("NFC").toLowerCase();
  return paths.find((p) => p.normalize("NFC").toLowerCase() === want) ?? null;
}
