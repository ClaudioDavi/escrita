import { describe, expect, it } from "vitest";
import { parseBlock } from "../src/desk/block";

describe("parseBlock", () => {
  it("empty source has no folders", () => {
    expect(parseBlock("")).toEqual({ folders: [] });
    expect(parseBlock("  \n\n")).toEqual({ folders: [] });
  });
  it("reads a plain folder line, trimming slashes", () => {
    expect(parseBlock("Folder: /Contos/")).toEqual({ folders: ["Contos"] });
    expect(parseBlock("folder: Contos")).toEqual({ folders: ["Contos"] });
    expect(parseBlock("  FOLDER :   Textos/Ensaios  ")).toEqual({ folders: ["Textos/Ensaios"] });
  });
  it("reads quoted names", () => {
    expect(parseBlock('folder: "Meus Contos"')).toEqual({ folders: ["Meus Contos"] });
    expect(parseBlock("folder: 'A casa: livro'")).toEqual({ folders: ["A casa: livro"] });
  });
  it("reads a wikilink, with alias or heading dropped", () => {
    expect(parseBlock("folder: [[Contos]]")).toEqual({ folders: ["Contos"] });
    expect(parseBlock("folder: [[Romances/A Casa|a casa]]")).toEqual({ folders: ["Romances/A Casa"] });
    expect(parseBlock('folder: "[[Contos]]"')).toEqual({ folders: ["Contos"] });
  });
  it("collects several lines, dropping duplicates", () => {
    expect(parseBlock("folder: Contos\nfolder: Textos\nfolder: /Contos/")).toEqual({ folders: ["Contos", "Textos"] });
  });
  it("handles CRLF", () => {
    expect(parseBlock("folder: Contos\r\nfolder: Textos\r\n")).toEqual({ folders: ["Contos", "Textos"] });
  });
  it("ignores unknown lines, empty values and the vault root", () => {
    expect(parseBlock("color: red\nfolder:\nfolder: /\nfolder: Contos")).toEqual({ folders: ["Contos"] });
    expect(parseBlock("# comment\nfoldery: x")).toEqual({ folders: [] });
  });
});
