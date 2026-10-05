import { describe, expect, it } from "vitest";
import { HOME_TEMPLATE, homeAction, homeAfterMove, homePath, settingToSave } from "../src/desk/home";

const has = (...paths: string[]) => (p: string) => paths.includes(p);

describe("homePath", () => {
  it("trims and appends .md", () => {
    expect(homePath("  Escrita/Início ")).toBe("Escrita/Início.md");
    expect(homePath("Home.md")).toBe("Home.md");
    expect(homePath("Home.MD")).toBe("Home.MD");
  });
  it("keeps an empty setting empty", () => {
    expect(homePath("")).toBe("");
    expect(homePath("   ")).toBe("");
  });
});

describe("homeAction", () => {
  it("opens a set note that exists", () => {
    expect(homeAction("Início.md", has("Início.md"))).toEqual({ kind: "open", path: "Início.md" });
  });
  it("offers a set note that is missing", () => {
    expect(homeAction("Início.md", has())).toEqual({ kind: "offer", path: "Início.md" });
  });
  it("adopts an existing default note when the setting is empty", () => {
    expect(homeAction("", has("Home.md"))).toEqual({ kind: "adopt", path: "Home.md" });
    expect(homeAction("", has("Inicio.md"))).toEqual({ kind: "adopt", path: "Inicio.md" });
  });
  it("offers Home.md when the setting is empty and nothing exists", () => {
    expect(homeAction("", has())).toEqual({ kind: "offer", path: "Home.md" });
    expect(homeAction("", has(), "Inicio.md")).toEqual({ kind: "offer", path: "Inicio.md" });
  });
  it("appends .md to a setting without extension", () => {
    expect(homeAction("Escrita/Início", has("Escrita/Início.md"))).toEqual({
      kind: "open",
      path: "Escrita/Início.md",
    });
    expect(homeAction("Escrita/Início", has())).toEqual({ kind: "offer", path: "Escrita/Início.md" });
  });
});

describe("HOME_TEMPLATE", () => {
  it("is an empty escrita-works block", () => {
    expect(HOME_TEMPLATE).toBe("```escrita-works\n```\n");
  });
});

describe("homeAfterMove", () => {
  it("follows a rename of the note", () => {
    expect(homeAfterMove("Home", "Home.md", "Casa.md")).toBe("Casa.md");
  });
  it("follows a folder rename", () => {
    expect(homeAfterMove("Notes/Home.md", "Notes", "N")).toBe("N/Home.md");
  });
  it("ignores an unrelated rename", () => {
    expect(homeAfterMove("Home", "Other.md", "X.md")).toBeNull();
  });
  it("ignores an empty setting", () => {
    expect(homeAfterMove("", "Home.md", "Casa.md")).toBeNull();
    expect(homeAfterMove("  ", "", "Casa.md")).toBeNull();
  });
});

describe("settingToSave", () => {
  it("saves an adopted note when the setting is empty", () => {
    const a = homeAction("", has("Inicio.md"));
    expect(settingToSave("", a)).toBe("Inicio.md");
  });
  it("saves nothing for open, offer, or a set setting", () => {
    expect(settingToSave("Home.md", homeAction("Home.md", has("Home.md")))).toBeNull();
    expect(settingToSave("", homeAction("", has()))).toBeNull();
    expect(settingToSave("X.md", { kind: "adopt", path: "Home.md" })).toBeNull();
  });
});

import { resolveCaseless } from "../src/desk/home";
describe("resolveCaseless", () => {
  it("finds a case variant, preferring the exact spelling", () => {
    expect(resolveCaseless(["Home.md", "x.md"], "home.md")).toBe("Home.md");
    expect(resolveCaseless(["home.md", "Home.md"], "Home.md")).toBe("Home.md");
    expect(resolveCaseless(["a.md"], "home.md")).toBeNull();
  });
});
