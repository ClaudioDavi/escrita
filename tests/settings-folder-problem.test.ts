import { describe, expect, it } from "vitest";
import { holdsOwnNotes, overlapProblem, pluginFolderProblem } from "../src/core/folder-problem";

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
