import { describe, expect, it } from "vitest";
import { bookProblem, holdsOwnNotes, overlapProblem, pluginFolderProblem } from "../src/core/folder-problem";

const S = { exportFolder: "Escrita/Exports", submissionsFolder: "Escrita/Submissions", snapshotsFolder: "Escrita/Snapshots" };
const none = () => false;

describe("pluginFolderProblem", () => {
  it("accepts a plain folder", () => {
    expect(pluginFolderProblem("Out/Exports", ["Escrita/Snapshots"], ".obsidian", "Contos", none)).toBeNull();
  });
  it("rejects dot segments, the config folder and track folders", () => {
    expect(pluginFolderProblem("../x", [], ".obsidian", "", none)).toEqual({ reason: "path" });
    expect(pluginFolderProblem(".obsidian", [], ".obsidian", "", none)).toEqual({ reason: "config", folder: ".obsidian" });
    expect(pluginFolderProblem("Contos", [], ".obsidian", "Contos", none)).toEqual({ reason: "tracked", folder: "Contos" });
  });
  it("rejects a folder that holds the writer's notes", () => {
    expect(pluginFolderProblem("Contos", [], ".obsidian", "", () => true)).toEqual({ reason: "notes", folder: "Contos" });
  });
  it("rejects overlap with another plugin folder, both ways", () => {
    expect(overlapProblem("Escrita", ["Escrita/Snapshots"])).toEqual({ reason: "overlap", folder: "Escrita/Snapshots" });
    expect(overlapProblem("Escrita/Snapshots/x", ["Escrita/Snapshots"])).toEqual({ reason: "overlap", folder: "Escrita/Snapshots" });
    expect(overlapProblem("Escrita2", ["Escrita"])).toBeNull();
    expect(pluginFolderProblem("Same", ["Same"], ".obsidian", "", none)).toEqual({ reason: "overlap", folder: "Same" });
  });
});

describe("holdsOwnNotes", () => {
  it("ignores the saved folder and the plugin's own files", () => {
    const paths = ["Escrita/Exports/a.md", "Escrita/Submissions/b.md", "Escrita/Snapshots/c.md", "Old/x.md"];
    expect(holdsOwnNotes(paths, "Escrita/Exports", "Escrita/Exports", S)).toBe(false);
    expect(holdsOwnNotes(["Escrita/Exports/a.md"], "Escrita", "Escrita/Exports", S)).toBe(false);
    expect(holdsOwnNotes(paths, "Old", "Escrita/Exports", S)).toBe(true);
    expect(holdsOwnNotes(["Contos/a.md"], "Contos", "Escrita/Exports", S)).toBe(true);
  });
});

describe("book folders", () => {
  const book = { note: { path: "Novels/B.md" }, folder: { path: "Novels/B" } };
  it("refuses a book's folder, its chapters folder, and a folder holding the book", () => {
    expect(pluginFolderProblem("Novels/B", [], ".obsidian", "", none, [book])).toEqual({ reason: "book", folder: "Novels/B" });
    expect(pluginFolderProblem("Novels/B/Chapters", [], ".obsidian", "", none, [book])).toEqual({ reason: "book", folder: "Novels/B" });
  });
  it("tells a folder holding a book from a folder inside one", () => {
    expect(bookProblem("Novels", [book])).toEqual({ reason: "holds-book", folder: "Novels" });
    expect(bookProblem("Novels/B/Chapters", [book])).toEqual({ reason: "book", folder: "Novels/B" });
  });
  it("accepts a folder beside the book", () => {
    expect(pluginFolderProblem("Novels/B2", [], ".obsidian", "", none, [book])).toBeNull();
    expect(pluginFolderProblem("Out/Exports", [], ".obsidian", "", none, [book])).toBeNull();
  });
});

describe("holdsOwnNotes with every file", () => {
  it("counts a .docx the writer keeps in the folder", () => {
    expect(holdsOwnNotes(["Manuscritos/A Casa (Shunn).docx"], "Manuscritos", "Escrita/Exports", S)).toBe(true);
  });
});
