import { describe, expect, it } from "vitest";
import { resolveHomeNote } from "../src/core/home-note";
import { homeAction } from "../src/desk/home";

const NFC = "Início.md".normalize("NFC");
const NFD = "Início.md".normalize("NFD");

describe("resolveHomeNote", () => {
  it("prefers the exact spelling over a case variant, in any listing order", () => {
    expect(resolveHomeNote(["home.md", "Home.md"], "Home.md")).toBe("Home.md");
    expect(resolveHomeNote(["Home.md", "home.md"], "home.md")).toBe("home.md");
  });
  it("is deterministic when only case variants exist", () => {
    expect(resolveHomeNote(["home.md", "HOME.md"], "Home.md")).toBe("HOME.md");
    expect(resolveHomeNote(["HOME.md", "home.md"], "Home.md")).toBe("HOME.md");
  });
  it("finds a case variant", () => {
    expect(resolveHomeNote(["Home.md", "x.md"], "home.md")).toBe("Home.md");
    expect(resolveHomeNote(["a.md"], "home.md")).toBeNull();
  });
  it("finds a decomposed name from a composed setting and the reverse", () => {
    expect(resolveHomeNote([NFD], NFC)).toBe(NFD);
    expect(resolveHomeNote([NFC], NFD)).toBe(NFC);
  });
  it("prefers the NFC spelling over a case variant, and exact over NFC", () => {
    expect(resolveHomeNote(["início.md", NFD], NFC)).toBe(NFD);
    expect(resolveHomeNote([NFD, NFC], NFC)).toBe(NFC);
    expect(resolveHomeNote([NFC, NFD], NFD)).toBe(NFD);
  });
  it("does not treat Início and Inicio as the same note", () => {
    expect(resolveHomeNote(["Inicio.md"], "Início.md")).toBeNull();
  });
  it("is null for an empty path", () => {
    expect(resolveHomeNote(["Home.md"], "")).toBeNull();
  });
});

describe("empty setting with Início / Inicio", () => {
  const paths = ["Inicio.md"];
  const exists = (p: string) => resolveHomeNote(paths, p) !== null;
  it("adopts an old Inicio.md instead of offering a second note", () => {
    expect(homeAction("", exists, "Início.md")).toEqual({ kind: "adopt", path: "Inicio.md" });
  });
});
