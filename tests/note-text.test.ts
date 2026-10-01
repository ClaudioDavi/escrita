import { describe, it, expect, vi } from "vitest";
import {
  anchor, applyChange, checkedChange, editorText, EditorMovedError, isIdentity, matchLineEndings, minimalChange, revertPlan,
  vaultText, wholeText,
  type Change, type EditorLike, type Pos,
} from "../src/core/note-text";
import { minimalChange as fromOutline } from "../src/outline/beats-edit";
import { matchLineEndings as fromDarlings } from "../src/darlings/format";

/** An editor over a string, recording transactions; offsetToPos over "\n" lines like CodeMirror. */
class FakeEditor implements EditorLike {
  transactions: { from: Pos; to: Pos; text: string }[][] = [];
  constructor(public text: string) {}
  getValue(): string { return this.text; }
  offsetToPos(o: number): Pos {
    const before = this.text.slice(0, o);
    const line = before.split("\n").length - 1;
    return { line, ch: o - (before.lastIndexOf("\n") + 1) };
  }
  posToOffset(p: Pos): number {
    const lines = this.text.split("\n");
    let o = 0;
    for (let i = 0; i < p.line; i++) o += lines[i].length + 1;
    return o + p.ch;
  }
  transaction(tx: { changes: { from: Pos; to: Pos; text: string }[] }): void {
    this.transactions.push(tx.changes);
    for (const c of [...tx.changes].reverse()) {
      const from = this.posToOffset(c.from), to = this.posToOffset(c.to);
      this.text = this.text.slice(0, from) + c.text + this.text.slice(to);
    }
  }
}

function fakeVault(initial: string) {
  const io = {
    text: initial,
    writes: 0,
    read: vi.fn(async () => io.text),
    process: vi.fn(async (fn: (s: string) => string) => {
      const next = fn(io.text);
      if (next !== io.text) io.writes++;
      io.text = next;
      return next;
    }),
  };
  return io;
}

describe("minimalChange / wholeText / applyChange", () => {
  const pairs: [string, string][] = [
    ["", ""], ["", "abc"], ["abc", ""], ["abc", "abc"], ["abc", "abXc"], ["O vento soprava.", "O vento parou."],
    ["a\r\nb\r\n", "a\r\nB\r\n"], ["aaaa", "aa"], ["ninguém", "ninguem"],
  ];
  it("reproduces the target and round-trips", () => {
    for (const [a, b] of pairs) {
      const c = minimalChange(a, b);
      expect(applyChange(a, c)).toBe(b);
      expect(wholeText(a, b)).toEqual(c);
    }
  });
  it("is still exported from outline/beats-edit", () => {
    expect(fromOutline).toBe(minimalChange);
    expect(fromOutline("abc", "abXc")).toEqual({ from: 2, to: 2, insert: "X" });
  });
  it("applyChange rejects offsets outside the text", () => {
    expect(() => applyChange("abc", { from: 2, to: 5, insert: "" })).toThrow(RangeError);
    expect(() => applyChange("abc", { from: 2, to: 1, insert: "" })).toThrow(RangeError);
  });
  it("isIdentity", () => {
    expect(isIdentity({ from: 3, to: 3, insert: "" })).toBe(true);
    expect(isIdentity({ from: 3, to: 3, insert: "x" })).toBe(false);
  });
});

describe("matchLineEndings", () => {
  it("follows the document", () => {
    expect(matchLineEndings("um\r\ndois\nfim", "lf\ndoc")).toBe("um\ndois\nfim");
    expect(matchLineEndings("um\r\ndois\nfim", "crlf\r\ndoc")).toBe("um\r\ndois\r\nfim");
    expect(matchLineEndings("a\nb", "")).toBe("a\nb");
  });
  it("is still exported from darlings/format", () => {
    expect(fromDarlings).toBe(matchLineEndings);
  });
});

describe("anchor / checkedChange", () => {
  const text = "Primeiro parágrafo.\n\nO vento soprava forte.\n\nÚltimo.";
  const from = text.indexOf("forte"), to = from + "forte".length;
  const a = anchor(text, { from, to, insert: "fraco" }, 10);

  it("records the expected text and clipped context", () => {
    expect(a.expected).toBe("forte");
    expect(a.before).toBe("o soprava ");
    expect(a.after).toBe(".\n\nÚltimo.");
    expect(anchor(text, { from: 0, to: 0, insert: "x" }).before).toBe("");
  });
  it("exact position gives the same change", () => {
    expect(checkedChange(text, a)).toEqual({ from, to, insert: "fraco" });
  });
  it("follows a unique anchor shifted by an earlier insertion", () => {
    const moved = "Novo começo. " + text;
    const c = checkedChange(moved, a);
    expect(c).toEqual({ from: from + 13, to: to + 13, insert: "fraco" });
    expect(applyChange(moved, c as Change)).toBe("Novo começo. " + text.replace("forte", "fraco"));
  });
  it("refuses an anchor that occurs twice", () => {
    const twice = "x" + text + "\n\n" + text;
    expect(checkedChange(twice, a)).toBeNull();
  });
  it("refuses when the expected text was edited", () => {
    expect(checkedChange(text.replace("forte", "forte demais"), a)).toBeNull();
    expect(checkedChange(text.replace("forte", "fortes"), a)).toBeNull();
  });
  it("pure insertion: exact, then shifted through before + after", () => {
    const at = text.indexOf("\n\nÚltimo");
    const ins = anchor(text, { from: at, to: at, insert: "\n\nMeio." }, 8);
    expect(ins.expected).toBe("");
    expect(checkedChange(text, ins)).toEqual({ from: at, to: at, insert: "\n\nMeio." });
    const shifted = "Antes.\n\n" + text;
    const c = checkedChange(shifted, ins) as Change;
    expect(c.from).toBe(at + 8);
    expect(applyChange(shifted, c)).toBe("Antes.\n\n" + text.replace("\n\nÚltimo", "\n\nMeio.\n\nÚltimo"));
  });
  it("CRLF document", () => {
    const crlf = text.replace(/\n/g, "\r\n");
    const f = crlf.indexOf("forte");
    const c = anchor(crlf, { from: f, to: f + 5, insert: "fraco" });
    expect(c.after.startsWith(".\r\n\r\n")).toBe(true);
    expect(applyChange(crlf, checkedChange(crlf, c) as Change)).toBe(crlf.replace("forte", "fraco"));
    expect(checkedChange(text, c)).toBeNull();
  });
  it("empty document with an empty anchor: only the exact offset", () => {
    const e = anchor("", { from: 0, to: 0, insert: "Olá" });
    expect(e).toMatchObject({ expected: "", before: "", after: "" });
    expect(checkedChange("", e)).toEqual({ from: 0, to: 0, insert: "Olá" });
    expect(checkedChange("abc", { ...e, from: 5, to: 5 })).toBeNull();
  });
});

describe("editorText", () => {
  it("applies one transaction equal to applyChange and calls afterWrite", async () => {
    const ed = new FakeEditor("linha um\nlinha dois\nlinha três");
    const after = vi.fn();
    const port = editorText(ed, after);
    expect(port.via).toBe("editor");
    const before = ed.text;
    const change = { from: before.indexOf("dois"), to: before.indexOf("dois") + 4, insert: "2\nnova" };
    const res = await port.apply((cur) => (cur === before ? change : null));
    expect(res).toEqual({ ok: true, before, after: applyChange(before, change), change, via: "editor" });
    expect(ed.text).toBe(applyChange(before, change));
    expect(ed.transactions).toHaveLength(1);
    expect(ed.transactions[0][0].from).toEqual({ line: 1, ch: 6 });
    expect(after).toHaveBeenCalledTimes(1);
  });
  it("an identity change writes nothing and is ok", async () => {
    const ed = new FakeEditor("abc");
    const after = vi.fn();
    const res = await editorText(ed, after).apply(() => ({ from: 1, to: 1, insert: "" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.before).toBe(res.after);
    expect(ed.transactions).toHaveLength(0);
    expect(after).not.toHaveBeenCalled();
  });
  it("a refusal writes nothing and returns the current text", async () => {
    const ed = new FakeEditor("abc");
    const after = vi.fn();
    const res = await editorText(ed, after).apply(() => null);
    expect(res).toEqual({ ok: false, current: "abc", via: "editor" });
    expect(ed.transactions).toHaveLength(0);
    expect(after).not.toHaveBeenCalled();
  });
  it("read returns the buffer", async () => {
    expect(await editorText(new FakeEditor("não salvo")).read()).toBe("não salvo");
  });
  it("refuses once the editor shows another note (a tab that opened another file)", async () => {
    const ed = new FakeEditor("Nota A.\n\nFim.");
    let path = "A.md";
    const port = editorText(ed, undefined, () => path === "A.md");
    const cur = await port.read();
    expect(cur).toBe("Nota A.\n\nFim.");
    // the same editor now shows note B while a snapshot was being written
    path = "B.md";
    ed.text = "Nota B.\n\nOutra.";
    const plan = vi.fn(() => ({ from: 7, to: 7, insert: "\n\nVelho." }));
    const res = await port.apply(plan);
    expect(res.ok).toBe(false);
    expect(plan).not.toHaveBeenCalled();
    expect(ed.text).toBe("Nota B.\n\nOutra.");
    expect(ed.transactions).toHaveLength(0);
    await expect(port.read()).rejects.toBeInstanceOf(EditorMovedError);
  });
  it("rejects a change outside the text without writing", async () => {
    const ed = new FakeEditor("abc");
    await expect(editorText(ed).apply(() => ({ from: 0, to: 9, insert: "" }))).rejects.toThrow(RangeError);
    expect(ed.transactions).toHaveLength(0);
  });
});

describe("vaultText", () => {
  it("runs the plan inside process and writes once", async () => {
    const io = fakeVault("O vento soprava forte.");
    const port = vaultText(io);
    expect(port.via).toBe("vault");
    const res = await port.apply((t) => ({ from: t.indexOf("forte"), to: t.indexOf("forte") + 5, insert: "fraco" }));
    expect(res).toMatchObject({ ok: true, before: "O vento soprava forte.", after: "O vento soprava fraco.", via: "vault" });
    expect(io.text).toBe("O vento soprava fraco.");
    expect(io.process).toHaveBeenCalledTimes(1);
    expect(io.writes).toBe(1);
  });
  it("a refusal returns the input unchanged", async () => {
    const io = fakeVault("abc");
    const res = await vaultText(io).apply(() => null);
    expect(res).toEqual({ ok: false, current: "abc", via: "vault" });
    expect(io.text).toBe("abc");
    expect(io.writes).toBe(0);
  });
  it("read delegates", async () => {
    const io = fakeVault("disco");
    expect(await vaultText(io).read()).toBe("disco");
    expect(io.read).toHaveBeenCalledTimes(1);
  });
  it("a plan that throws leaves the file alone", async () => {
    const io = fakeVault("abc");
    await expect(vaultText(io).apply(() => ({ from: 0, to: 9, insert: "" }))).rejects.toThrow(RangeError);
    expect(io.text).toBe("abc");
  });
});

describe("revertPlan", () => {
  const shown = "Alpha 1.\n\nBeta 2.\n";
  const a = anchor(shown, { from: 8, to: 8, insert: "\n\nMiddle gone." }, 0);
  it("applies against the text the compare view showed", () => {
    expect(revertPlan(a, shown)(shown)).toEqual({ from: 8, to: 8, insert: "\n\nMiddle gone." });
  });
  it("refuses when the note differs from what was shown (a stale view)", () => {
    const now = "Hi, mom.\n\n" + shown;
    expect(revertPlan(a, shown)(now)).toBeNull();
  });
  it("without a shown text only the anchor is checked", () => {
    expect(revertPlan(a)(shown)).toEqual({ from: 8, to: 8, insert: "\n\nMiddle gone." });
  });
});
