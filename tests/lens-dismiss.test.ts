import { describe, expect, it } from "vitest";
import { addDismissal, cleanDismissed, dismissalOf, isDismissed, mergeDismissals } from "../src/lens/dismiss";
import type { Dismissal, Match } from "../src/lens/types";

function find(text: string, needle: string, nth = 0, rule: Match["rule"] = "adverb"): Match {
  let i = -1;
  for (let k = 0; k <= nth; k++) i = text.indexOf(needle, i + 1);
  return { rule, kind: "base", from: i, to: i + needle.length, text: needle };
}
const key = (t: string, n: string, nth = 0) => dismissalOf(t, find(t, n, nth));

const BASE = "Ela olhou para ele rapidamente e depois saiu da sala sem dizer nada. Ficou tudo quieto.";

describe("dismissalOf", () => {
  it("takes up to 3 normalized words on each side", () => {
    const d = key(BASE, "rapidamente");
    expect(d).toEqual({ rule: "adverb", text: "rapidamente", before: "olhou para ele", after: "e depois saiu" });
  });
  it("has fewer words at the edges of the text", () => {
    const d = dismissalOf("Vá embora", find("Vá embora", "embora"));
    expect(d.before).toBe("vá");
    expect(d.after).toBe("");
  });
  it("survives an insertion before, after and two sentences away", () => {
    const k = key(BASE, "rapidamente");
    const before = "Era noite. Chovia. " + BASE;
    const after = BASE + " Fim de tudo.";
    expect(isDismissed([k], key(before, "rapidamente"))).toBe(true);
    expect(isDismissed([k], key(after, "rapidamente"))).toBe(true);
    const far = "Ela olhou para ele rapidamente e depois saiu da sala sem dizer nada.";
    expect(isDismissed([key(far, "rapidamente")], key(far + " Um. Dois. Três quatro.", "rapidamente"))).toBe(true);
  });
  it("stops matching when a neighbouring word changes", () => {
    const k = key(BASE, "rapidamente");
    expect(isDismissed([k], key(BASE.replace("olhou", "fitou"), "rapidamente"))).toBe(false);
    expect(isDismissed([k], key(BASE.replace("saiu", "foi"), "rapidamente"))).toBe(false);
  });
  it("gives two keys for the same text with different neighbours", () => {
    const t = "Falou lentamente com ela. Depois andou lentamente pelo corredor.";
    const a = key(t, "lentamente", 0);
    const b = key(t, "lentamente", 1);
    expect(a).not.toEqual(b);
    expect(isDismissed([a], b)).toBe(false);
  });
  it("is case and NFD insensitive", () => {
    const nfd = "Ninguém olhou".normalize("NFD") + " RAPIDAMENTE";
    const nfc = "ninguém olhou rapidamente";
    expect(key(nfd, "RAPIDAMENTE")).toEqual(key(nfc, "rapidamente"));
  });
  it("does not depend on a rule's mask, only on the text", () => {
    const t = "um **dois** três quatro";
    expect(dismissalOf(t, find(t, "três")).before).toBe("um dois");
  });
});

describe("list helpers", () => {
  const mk = (n: number): Dismissal => ({ rule: "echo", text: "w" + n, before: "", after: "" });
  it("isDismissed handles undefined", () => {
    expect(isDismissed(undefined, mk(1))).toBe(false);
  });
  it("addDismissal does not duplicate and does not mutate", () => {
    const l = [mk(1)];
    expect(addDismissal(l, mk(1))).toEqual([mk(1)]);
    expect(addDismissal(l, mk(2))).toEqual([mk(1), mk(2)]);
    expect(l).toEqual([mk(1)]);
  });
  it("the cap drops the oldest", () => {
    const l = addDismissal([mk(1), mk(2), mk(3)], mk(4), 3);
    expect(l).toEqual([mk(2), mk(3), mk(4)]);
    let big: Dismissal[] = [];
    for (let i = 0; i < 510; i++) big = addDismissal(big, mk(i));
    expect(big).toHaveLength(500);
    expect(big[0]).toEqual(mk(10));
  });
  it("mergeDismissals concatenates and de-duplicates", () => {
    expect(mergeDismissals([mk(1), mk(2)], [mk(2), mk(3)])).toEqual([mk(1), mk(2), mk(3)]);
    expect(mergeDismissals([], [])).toEqual([]);
  });
});

describe("cleanDismissed", () => {
  it("returns {} for junk", () => {
    for (const x of [null, undefined, 3, "x", [], true]) expect(cleanDismissed(x)).toEqual({});
  });
  it("drops wrong types and unknown rules", () => {
    const good = { rule: "crutch", text: "a", before: "b", after: "c" };
    const out = cleanDismissed({
      "a.md": [good, good, { rule: "nope", text: "a", before: "", after: "" }, { rule: "echo", text: 1, before: "", after: "" }, null, 5],
      "b.md": "not a list",
      "c.md": [{ rule: "echo" }],
    });
    expect(out).toEqual({ "a.md": [good] });
  });
});
