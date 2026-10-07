import { describe, expect, it } from "vitest";
import { planPanels, resolveHomePath, type PanelPlanInput } from "../src/setup/layout-plan";

const allOn = { outline: true, lens: true, placeholders: true, universe: true };
const plan = (over: Partial<PanelPlanInput>) => planPanels({ layout: "desk", phone: false, on: allOn, ...over });

describe("planPanels", () => {
  it("desk: outline on top, lens below, placeholders behind the lens, universe on the left", () => {
    expect(plan({})).toEqual([
      { view: "escrita-outline", how: "sidebar" },
      { view: "escrita-lens", how: "splitBelow", anchor: "escrita-outline" },
      { view: "escrita-placeholders", how: "tabWith", anchor: "escrita-lens" },
      { view: "escrita-universe", how: "leftTab" },
    ]);
  });
  it("focus places no panel", () => {
    expect(plan({ layout: "focus" })).toEqual([]);
  });
  it("skips a panel whose feature is off and closes the groups up", () => {
    expect(plan({ on: { ...allOn, outline: false, universe: false } })).toEqual([
      { view: "escrita-lens", how: "sidebar" },
      { view: "escrita-placeholders", how: "tabWith", anchor: "escrita-lens" },
    ]);
    expect(plan({ on: { ...allOn, lens: false } })).toEqual([
      { view: "escrita-outline", how: "sidebar" },
      { view: "escrita-placeholders", how: "splitBelow", anchor: "escrita-outline" },
      { view: "escrita-universe", how: "leftTab" },
    ]);
  });
  it("places nothing when every panel is off", () => {
    expect(plan({ on: { outline: false, lens: false, placeholders: false, universe: false } })).toEqual([]);
  });
  it("phone: outline and lens are two tabs of the right drawer, nothing else", () => {
    expect(plan({ phone: true })).toEqual([
      { view: "escrita-outline", how: "sidebar" },
      { view: "escrita-lens", how: "sidebar" },
    ]);
  });
});

describe("resolveHomePath", () => {
  const paths = ["Home.md", "Contos/a.md"];
  it("ignores case and adds .md", () => {
    expect(resolveHomePath("home", paths)).toBe("Home.md");
    expect(resolveHomePath("HOME.md", paths)).toBe("Home.md");
  });
  it("is null when blank or missing", () => {
    expect(resolveHomePath("", paths)).toBeNull();
    expect(resolveHomePath("Início", paths)).toBeNull();
  });
});
