import { beforeEach, describe, expect, it } from "vitest";
import { TFile, type App } from "obsidian";
import { FolderBlockedError, NoteExistsError, NoteService } from "../src/core/notes";
import { toArrayBuffer, uniquePath } from "../src/core/note-text";
import { FileVault } from "./support/file-vault";

let vault: FileVault;
let notes: NoteService;

beforeEach(() => {
  vault = new FileVault();
  notes = new NoteService({ vault, workspace: { getLeavesOfType: () => [] } } as unknown as App);
});

const u8 = (...n: number[]) => new Uint8Array(n);
const asBytes = (b: ArrayBuffer) => [...new Uint8Array(b)];

describe("notes.create: new files", () => {
  it("creates a note and the missing folders", async () => {
    const r = await notes.create("A/B/Note.md", "hi", { exists: "fail" });
    expect(r.outcome).toBe("created");
    expect(r.file).toBeInstanceOf(TFile);
    expect(vault.text.get("A/B/Note.md")).toBe("hi");
    expect(vault.getAbstractFileByPath("A/B")).not.toBeNull();
  });
  it("normalizes the path", async () => {
    await notes.create("/A//Note.md/", "x", { exists: "fail" });
    expect(vault.text.get("A/Note.md")).toBe("x");
  });
  it("throws FolderBlockedError when a folder segment is a file", async () => {
    vault.seedFile("A", "file");
    await expect(notes.create("A/Note.md", "x", { exists: "fail" })).rejects.toBeInstanceOf(FolderBlockedError);
  });
  it("creates an empty text file", async () => {
    await notes.create("E.md", "", { exists: "fail" });
    expect(vault.text.get("E.md")).toBe("");
    expect(vault.calls).toContain("create E.md");
  });
});

describe("notes.create: binary", () => {
  it("writes an ArrayBuffer through createBinary", async () => {
    const buf = u8(1, 2, 3).buffer;
    await notes.create("Out/a.docx", buf, { exists: "fail" });
    expect(vault.calls).toContain("createBinary Out/a.docx");
    expect(asBytes(vault.bytes.get("Out/a.docx")!)).toEqual([1, 2, 3]);
  });
  it("writes a Uint8Array", async () => {
    await notes.create("a.docx", u8(9, 8), { exists: "fail" });
    expect(asBytes(vault.bytes.get("a.docx")!)).toEqual([9, 8]);
  });
  it("converts a subarray view to exactly its own bytes", async () => {
    const big = u8(0, 0, 7, 8, 9, 0, 0);
    const view = big.subarray(2, 5);
    expect(view.buffer.byteLength).toBe(7);
    await notes.create("v.docx", view, { exists: "fail" });
    const out = vault.bytes.get("v.docx")!;
    expect(out.byteLength).toBe(3);
    expect(asBytes(out)).toEqual([7, 8, 9]);
  });
  it("toArrayBuffer returns an ArrayBuffer unchanged and copies a view once", () => {
    const buf = new ArrayBuffer(4);
    expect(toArrayBuffer(buf)).toBe(buf);
    const view = new Uint8Array([1, 2, 3, 4, 5]).subarray(1, 3);
    const out = toArrayBuffer(view);
    expect(out).not.toBe(view.buffer);
    expect(asBytes(out)).toEqual([2, 3]);
  });
  it("replaces bytes through modifyBinary and keeps the file", async () => {
    const f = vault.seedFile("a.docx", u8(1).buffer);
    const r = await notes.create("a.docx", u8(4, 5, 6), { exists: "replace" });
    expect(r.outcome).toBe("replaced");
    expect(r.file).toBe(f);
    expect(vault.calls).toContain("modifyBinary a.docx");
    expect(asBytes(vault.bytes.get("a.docx")!)).toEqual([4, 5, 6]);
  });
  it("unique works for binary files", async () => {
    vault.seedFile("a.docx", u8(1).buffer);
    const r = await notes.create("a.docx", u8(2), { exists: "unique" });
    expect(r.file.path).toBe("a 1.docx");
    expect(asBytes(vault.bytes.get("a 1.docx")!)).toEqual([2]);
    expect(asBytes(vault.bytes.get("a.docx")!)).toEqual([1]);
  });
});

describe("notes.create: exists policies", () => {
  beforeEach(() => { vault.seedFile("N/T.md", "old"); });

  it("return keeps the file and writes nothing", async () => {
    const existing = vault.getAbstractFileByPath("N/T.md");
    const r = await notes.create("N/T.md", "new", { exists: "return" });
    expect(r).toEqual({ file: existing, outcome: "existing" });
    expect(vault.text.get("N/T.md")).toBe("old");
    expect(vault.calls.some((c) => c.startsWith("modify") || c.startsWith("create "))).toBe(false);
  });
  it("fail throws NoteExistsError", async () => {
    const err = await notes.create("N/T.md", "new", { exists: "fail" }).catch((e) => e);
    expect(err).toBeInstanceOf(NoteExistsError);
    expect(err.path).toBe("N/T.md");
    expect(err.existing).toBe("N/T.md");
    expect(err.folder).toBe(false);
    expect(vault.text.get("N/T.md")).toBe("old");
  });
  it("unique picks the first free numbered name", async () => {
    vault.seedFile("N/T 1.md", "one");
    const r = await notes.create("N/T.md", "new", { exists: "unique" });
    expect(r.outcome).toBe("created");
    expect(r.file.path).toBe("N/T 2.md");
    expect(vault.text.get("N/T 2.md")).toBe("new");
    expect(vault.text.get("N/T.md")).toBe("old");
  });
  it("unique on a free path uses the path as is", async () => {
    const r = await notes.create("N/Free.md", "x", { exists: "unique" });
    expect(r.file.path).toBe("N/Free.md");
  });
  it("replace overwrites through modify and keeps the same file", async () => {
    const existing = vault.getAbstractFileByPath("N/T.md");
    const r = await notes.create("N/T.md", "new", { exists: "replace" });
    expect(r).toEqual({ file: existing, outcome: "replaced" });
    expect(vault.text.get("N/T.md")).toBe("new");
    expect(vault.calls).toContain("modify N/T.md");
  });
  it("a folder at the path throws with folder: true, except under unique", async () => {
    vault.seedFolder("N/Dir.md");
    for (const exists of ["return", "fail", "replace"] as const) {
      const err = await notes.create("N/Dir.md", "x", { exists }).catch((e) => e);
      expect(err).toBeInstanceOf(NoteExistsError);
      expect(err.folder).toBe(true);
    }
    const r = await notes.create("N/Dir.md", "x", { exists: "unique" });
    expect(r.file.path).toBe("N/Dir 1.md");
  });
});

describe("notes.create: case clash", () => {
  beforeEach(() => { vault.seedFile("N/Title.md", "old"); });

  it("counts as existing under return, with the clashing file", async () => {
    const r = await notes.create("N/title.md", "new", { exists: "return" });
    expect(r.outcome).toBe("existing");
    expect(r.file.path).toBe("N/Title.md");
  });
  it("fail reports the path that was found", async () => {
    const err = await notes.create("N/TITLE.md", "new", { exists: "fail" }).catch((e) => e);
    expect(err).toBeInstanceOf(NoteExistsError);
    expect(err.path).toBe("N/TITLE.md");
    expect(err.existing).toBe("N/Title.md");
  });
  it("replace overwrites the clashing file, not a second one", async () => {
    const r = await notes.create("N/title.md", "new", { exists: "replace" });
    expect(r.outcome).toBe("replaced");
    expect(vault.text.get("N/Title.md")).toBe("new");
    expect(vault.getAbstractFileByPath("N/title.md")).toBeNull();
  });
  it("unique avoids the clashing name and its numbered case variants", async () => {
    vault.seedFile("N/title 1.md", "x");
    const r = await notes.create("N/title.md", "new", { exists: "unique" });
    expect(r.file.path).toBe("N/title 2.md");
  });
});

describe("notes.create: race", () => {
  it("a file that appears between check and create follows the policy (return)", async () => {
    vault.beforeNextCreate = () => vault.seedFile("R.md", "theirs");
    const r = await notes.create("R.md", "mine", { exists: "return" });
    expect(r.outcome).toBe("existing");
    expect(vault.text.get("R.md")).toBe("theirs");
  });
  it("follows the policy (fail)", async () => {
    vault.beforeNextCreate = () => vault.seedFile("R.md", "theirs");
    await expect(notes.create("R.md", "mine", { exists: "fail" })).rejects.toBeInstanceOf(NoteExistsError);
  });
  it("follows the policy (replace)", async () => {
    vault.beforeNextCreate = () => vault.seedFile("R.md", "theirs");
    const r = await notes.create("R.md", "mine", { exists: "replace" });
    expect(r.outcome).toBe("replaced");
    expect(vault.text.get("R.md")).toBe("mine");
  });
  it("follows the policy (unique) and keeps the bytes of a binary", async () => {
    vault.beforeNextCreate = () => vault.seedFile("R.docx", u8(0).buffer);
    const r = await notes.create("R.docx", u8(1, 2), { exists: "unique" });
    expect(r.file.path).toBe("R 1.docx");
    expect(asBytes(vault.bytes.get("R 1.docx")!)).toEqual([1, 2]);
  });
  it("a create error with nothing at the path passes through", async () => {
    vault.create = async () => { throw new Error("disk full"); };
    await expect(notes.create("X.md", "x", { exists: "fail" })).rejects.toThrow("disk full");
  });
  it("a second race is not retried again", async () => {
    let n = 0;
    const orig = vault.create.bind(vault);
    vault.create = async (p: string, c: string) => {
      n++;
      vault.seedFile(p, "theirs");
      return orig(p, c);
    };
    // unique: attempt 0 loses to a file at R.md, attempt 1 loses to "R 1.md"
    await expect(notes.create("R.md", "x", { exists: "unique" })).rejects.toThrow("already exists");
    expect(n).toBe(2);
  });
});

describe("uniquePath", () => {
  it("numbers before the extension", () => {
    expect(uniquePath("a/b.md", ["a/b.md"])).toBe("a/b 1.md");
  });
  it("handles no extension and dots in folders", () => {
    expect(uniquePath("a.b/c", ["a.b/c"])).toBe("a.b/c 1");
  });
  it("returns the path when free", () => {
    expect(uniquePath("a.md", ["b.md"])).toBe("a.md");
  });
});
