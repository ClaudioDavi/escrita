import { describe, it, expect } from "vitest";
import {
  alreadyRestored, appendEntry, appendText, applyCut, baseName, decodeMeta, encodeMeta, excerpt,
  findRestoreOffset, formatEntry, matchLineEndings, newId, newestFirst, parseEntries, planCut, removeEntry, restoreText, withMd,
  type DarlingMeta,
} from "../src/darlings/format";

const FROM = "Novels/A Casa/Chapters/03 O porão.md";

function meta(over: Partial<DarlingMeta> = {}): DarlingMeta {
  return { id: "k3j2x", from: FROM, date: "2026-09-29", before: "antes ", after: " depois", ...over };
}

function roundTrip(text: string, m: DarlingMeta = meta()) {
  const note = appendEntry("Intro line.", formatEntry(m, text));
  const entries = parseEntries(note);
  expect(entries).toHaveLength(1);
  return { note, e: entries[0] };
}

describe("formatEntry", () => {
  it("matches the documented layout", () => {
    const out = formatEntry(meta(), "Ela desceu a escada.");
    const lines = out.split("\n");
    expect(lines[0]).toBe("### [[03 O porão]] · 2026-09-29");
    expect(lines[1]).toMatch(/^%% escrita-darling \{"id":"k3j2x","from":"Novels\/A Casa\/Chapters\/03 O porão\.md",.*\} %%$/);
    expect(lines[2]).toBe("Ela desceu a escada.");
    expect(lines[3]).toBe("%% /escrita-darling %%");
  });

  it("uses a given link text", () => {
    expect(formatEntry(meta(), "x", "Chapters/03 O porão").split("\n")[0]).toBe("### [[Chapters/03 O porão]] · 2026-09-29");
  });

  it("never puts %% or newlines in the JSON", () => {
    const m = meta({ before: "100%% sure\nnext line\r\n", after: "%%%\u2028" });
    const line = formatEntry(m, "x").split("\n")[1];
    const json = line.replace(/^%% escrita-darling /, "").replace(/ %%$/, "");
    expect(json).not.toContain("%");
    expect(json).not.toMatch(/[\n\r\u2028\u2029]/);
    expect(decodeMeta(json)).toEqual(m);
  });

  it("omits empty pre/post and keeps them otherwise", () => {
    expect(encodeMeta(meta())).not.toContain("pre");
    const m = meta({ pre: " ", post: "\n\n" });
    expect(decodeMeta(encodeMeta(m))).toEqual(m);
  });
});

describe("parseEntries round-trips passages", () => {
  const cases: Record<string, string> = {
    plain: "Ela desceu a escada.",
    "with %%": "Um %% comentário %% e 100% certo, %%%",
    quotes: `"Aspas" ‘curvas’ «guillemets» e \\"escapadas\\" {"json":true}`,
    code: "```js\nconst x = `a`; // %% not a comment\n```",
    paragraphs: "Primeiro parágrafo.\n\nSegundo parágrafo.\n\n\nTerceiro, depois de duas linhas.",
    crlf: "Linha um\r\nLinha dois\r\n\r\nLinha três",
    "leading and trailing newlines": "\n\nMeio\n\n",
    "marker-like lines": "%% /escrita-darling %%\n%% escrita-darling {\"id\":\"zzz\"} %%\n\\%% /escrita-darling %%\n\\\\%% escrita-darling x",
    "heading-like start": "### Not a heading of ours\ntext",
    "only whitespace": "   ",
    empty: "",
    "trailing CR": "abc\r",
    unicode: "Coração 💔 — ação…",
  };
  for (const [name, text] of Object.entries(cases)) {
    it(name, () => {
      const { e } = roundTrip(text);
      expect(e.text).toBe(text);
      expect(e.id).toBe("k3j2x");
      expect(e.from).toBe(FROM);
      expect(e.date).toBe("2026-09-29");
      expect(e.before).toBe("antes ");
      expect(e.after).toBe(" depois");
      expect(e.link).toBe("03 O porão");
    });
  }

  it("reports offsets covering the heading through the closing marker", () => {
    const entry = formatEntry(meta(), "Passagem.");
    const note = appendEntry("# Darlings\n\nIntro.", entry);
    const [e] = parseEntries(note);
    expect(note.slice(e.start, e.end)).toBe(entry);
  });

  it("parses a note saved with CRLF line endings", () => {
    const lf = appendEntry(appendEntry("Intro", formatEntry(meta(), "Um\ndois")), formatEntry(meta({ id: "b" }), "três"));
    const crlf = lf.replace(/\n/g, "\r\n");
    const es = parseEntries(crlf);
    expect(es.map((e) => e.text)).toEqual(["Um\r\ndois", "três"]);
    expect(crlf.slice(es[1].start, es[1].end)).toBe(formatEntry(meta({ id: "b" }), "três").replace(/\n/g, "\r\n"));
  });

  it("parses several entries in order", () => {
    let note = "Intro.";
    for (const id of ["a1", "b2", "c3"]) note = appendEntry(note, formatEntry(meta({ id }), `passage ${id}`));
    expect(parseEntries(note).map((e) => [e.id, e.text])).toEqual([["a1", "passage a1"], ["b2", "passage b2"], ["c3", "passage c3"]]);
  });

  it("works without a heading", () => {
    const note = `x\n%% escrita-darling ${encodeMeta(meta())} %%\nbody\n%% /escrita-darling %%`;
    const [e] = parseEntries(note);
    expect(e.link).toBeNull();
    expect(note.slice(e.start, e.end)).toBe(note.slice(2));
    expect(e.text).toBe("body");
  });

  it("skips invalid JSON, missing ids and unterminated entries", () => {
    const good = formatEntry(meta({ id: "ok" }), "kept");
    const note = [
      "%% escrita-darling {not json} %%", "a", "%% /escrita-darling %%",
      "%% escrita-darling {\"from\":\"x\"} %%", "b", "%% /escrita-darling %%",
      "%% escrita-darling {\"id\":\"open\"} %%", "never closed",
      good,
    ].join("\n");
    expect(parseEntries(note).map((e) => e.id)).toEqual(["ok"]);
  });

  it("tolerates a hand-written entry with no passage line", () => {
    const note = `%% escrita-darling {"id":"e"} %%\n%% /escrita-darling %%`;
    expect(parseEntries(note)[0].text).toBe("");
  });

  it("returns nothing for an empty or unrelated note", () => {
    expect(parseEntries("")).toEqual([]);
    expect(parseEntries("# Just notes\n%% a comment %%")).toEqual([]);
  });
});

describe("appendEntry / removeEntry", () => {
  it("appends with one blank line, to empty notes too", () => {
    expect(appendEntry("", "E")).toBe("E\n");
    expect(appendEntry("Intro\n\n\n", "E")).toBe("Intro\n\nE\n");
  });

  it("removes the middle entry and keeps one blank line between neighbours", () => {
    let note = "Intro.";
    for (const id of ["a", "b", "c"]) note = appendEntry(note, formatEntry(meta({ id }), id.toUpperCase()));
    const out = removeEntry(note, "b");
    expect(out).toBe(appendEntry(appendEntry("Intro.", formatEntry(meta({ id: "a" }), "A")), formatEntry(meta({ id: "c" }), "C")));
    expect(out).not.toMatch(/\n\n\n/);
  });

  it("removes the last and first entries cleanly", () => {
    const note = appendEntry(appendEntry("Intro.", formatEntry(meta({ id: "a" }), "A")), formatEntry(meta({ id: "b" }), "B"));
    expect(removeEntry(removeEntry(note, "b"), "a")).toBe("Intro.\n");
    const bare = appendEntry("", formatEntry(meta({ id: "a" }), "A"));
    expect(removeEntry(bare, "a")).toBe("");
  });

  it("leaves the text alone when the id is unknown", () => {
    const note = appendEntry("Intro.", formatEntry(meta(), "A"));
    expect(removeEntry(note, "nope")).toBe(note);
  });

  it("never touches text of other entries, even marker-like passages", () => {
    const tricky = "%% /escrita-darling %%\nstill inside";
    const note = appendEntry(appendEntry("Intro.", formatEntry(meta({ id: "a" }), tricky)), formatEntry(meta({ id: "b" }), "B"));
    const out = removeEntry(note, "b");
    expect(parseEntries(out).map((e) => e.text)).toEqual([tricky]);
  });

  it("keeps CRLF in the note", () => {
    const note = appendEntry(appendEntry("Intro.", formatEntry(meta({ id: "a" }), "A")), formatEntry(meta({ id: "b" }), "B")).replace(/\n/g, "\r\n");
    const out = removeEntry(note, "a");
    expect(out).not.toMatch(/[^\r]\n/);
    expect(parseEntries(out).map((e) => e.id)).toEqual(["b"]);
  });
});

function cut(doc: string, sel: string, nth = 0) {
  let from = -1;
  for (let i = 0; i <= nth; i++) from = doc.indexOf(sel, from + 1);
  expect(from).toBeGreaterThanOrEqual(0);
  const plan = planCut(doc, from, from + sel.length);
  return { plan, result: applyCut(doc, plan) };
}

describe("planCut", () => {

  it("tidies a doubled space", () => {
    const { plan, result } = cut("Ela viu tudo ontem.", "tudo");
    expect(result).toBe("Ela viu ontem.");
    expect(plan.post).toBe(" ");
  });

  it("tidies a space left at a line start", () => {
    expect(cut("Ontem ela viu.", "Ontem").result).toBe("ela viu.");
    expect(cut("a\nOntem ela viu.", "Ontem").result).toBe("a\nela viu.");
  });

  it("tidies a space left before punctuation or at the end of a line", () => {
    expect(cut("Ela viu tudo.", "tudo").result).toBe("Ela viu.");
    expect(cut("Ela viu tudo\nfim", "tudo").result).toBe("Ela viu\nfim");
    expect(cut("Ela viu tudo", "tudo").result).toBe("Ela viu");
  });

  it("does not tidy inside words", () => {
    const { plan, result } = cut("gatos", "s");
    expect(result).toBe("gato");
    expect(plan.pre + plan.post).toBe("");
  });

  it("tidies a leftover triple blank line", () => {
    const { plan, result } = cut("P1.\n\nP2.\n\nP3.", "P2.");
    expect(result).toBe("P1.\n\nP3.");
    expect(plan.post).toBe("\n\n");
  });

  it("keeps the writer's wider spacing", () => {
    expect(cut("P1.\n\n\nP2.\n\n\nP3.", "P2.").result).toBe("P1.\n\n\nP3.");
    expect(cut("L1\nL2\nL3", "L2").result).toBe("L1\nL3");
  });

  it("does nothing extra when the selection includes its line breaks", () => {
    const { plan, result } = cut("P1.\n\nP2.\n\nP3.", "P2.\n\n");
    expect(result).toBe("P1.\n\nP3.");
    expect(plan.pre + plan.post).toBe("");
  });

  it("removes blank lines left at the start of the file", () => {
    expect(cut("P1.\n\nP2.", "P1.").result).toBe("P2.");
  });

  it("handles CRLF documents", () => {
    const { result } = cut("P1.\r\n\r\nP2.\r\n\r\nP3.", "P2.");
    expect(result).toBe("P1.\r\n\r\nP3.");
  });

  it("clamps and orders the range", () => {
    const plan = planCut("abc", 10, -5);
    expect([plan.from, plan.to]).toEqual([0, 3]);
  });

  it("records up to 80 chars of context", () => {
    const doc = "a".repeat(200) + " X " + "b".repeat(200);
    const { plan } = cut(doc, "X");
    expect(plan.before).toBe("a".repeat(79) + " ");
    expect(plan.after).toBe("b".repeat(80));
  });

  it("restores the exact original text", () => {
    const docs: Array<[string, string]> = [
      ["Ela viu tudo ontem.", "tudo"], ["Ontem ela viu.", "Ontem"], ["Ela viu tudo.", "tudo"],
      ["P1.\n\nP2.\n\nP3.", "P2."], ["P1.\n\nP2.", "P1."], ["P1.\r\n\r\nP2.\r\n\r\nP3.", "P2."],
      ["Um parágrafo longo com muitas palavras. Outra frase aqui.", "Outra frase aqui."],
      ["fim do livro", "livro"],
    ];
    for (const [doc, sel] of docs) {
      const { plan, result } = cut(doc, sel);
      const at = findRestoreOffset(result, plan.before, plan.after);
      expect(at).toBe(plan.from);
      const back = result.slice(0, at!) + restoreText({ text: sel, pre: plan.pre, post: plan.post }) + result.slice(at!);
      expect(back).toBe(doc);
    }
  });
});

describe("findRestoreOffset", () => {
  const src = "O relógio parou às três. Ninguém subiu ao sótão desde então. A chave ficou na gaveta.";

  it("finds the exact adjacency", () => {
    const at = src.indexOf("Ninguém");
    expect(findRestoreOffset(src, src.slice(0, at), src.slice(at))).toBe(at);
  });

  it("prefers adjacency over a first match of one side", () => {
    const s = "abc XYZ abc DEF";
    expect(findRestoreOffset(s, "abc ", "DEF")).toBe(12);
  });

  it("trims context progressively when far text was edited", () => {
    const at = src.indexOf("Ninguém");
    const before = "TEXTO APAGADO " + src.slice(0, at);
    const after = src.slice(at, at + 30) + " MUDOU TUDO AQUI";
    const edited = src.replace("O relógio", "Um relógio velho");
    expect(findRestoreOffset(edited, before, after)).toBe(edited.indexOf("Ninguém"));
  });

  it("falls back to before alone, then after alone", () => {
    const s = "Parte um intacta. [texto novo] Parte dois intacta.";
    expect(findRestoreOffset(s, "Parte um intacta. ", "outra coisa totalmente")).toBe(s.indexOf("[texto"));
    expect(findRestoreOffset(s, "algo que sumiu do texto", "Parte dois intacta.")).toBe(s.indexOf("Parte dois"));
  });

  it("returns null when nothing matches", () => {
    expect(findRestoreOffset("completely different", "nothing like this here", "nor this one either")).toBeNull();
    expect(findRestoreOffset("", "algum contexto", "mais contexto")).toBeNull();
  });

  it("does not match on tiny fragments", () => {
    expect(findRestoreOffset("a e o", "xxxxxxx a", "o yyyyyyyy")).toBeNull();
  });

  it("handles cuts at the start and end of the file", () => {
    expect(findRestoreOffset("Resto do texto.", "", "Resto do texto.")).toBe(0);
    expect(findRestoreOffset("Novo começo. Resto do texto.", "", "Resto do texto.")).toBe(13);
    expect(findRestoreOffset("Texto antes.", "Texto antes.", "")).toBe(12);
    expect(findRestoreOffset("Texto antes. E mais.", "Texto antes.", "")).toBe(12);
  });

  it("never restores at an ambiguous short match (repeated scene breaks)", () => {
    const second = "Segunda cena, bem mais longa, com muita coisa acontecendo entre as personagens até que ";
    const doc = "Primeira cena termina aqui com calma.\n\n---\n\n" + second + "Ela acaba.\n\n---\n\n"
      + "Parágrafo cortado.\n\n" + "Terceira cena começa.";
    const { plan, result } = cut(doc, "Parágrafo cortado.");
    // the end of the second scene and the start of the third were rewritten
    const edited = result.replace("Ela acaba.", "E então, de repente, tudo terminou.")
      .replace("Terceira cena começa.", "Outra manhã chegou.");
    const at = findRestoreOffset(edited, plan.before, plan.after);
    expect(at).not.toBe(edited.indexOf("\n\n---\n\n") + 7);
    expect(at).toBeNull();
    // unambiguous context still wins
    const kept = result.replace("Terceira cena começa.", "Outra manhã chegou.");
    expect(findRestoreOffset(kept, plan.before, plan.after)).toBe(kept.lastIndexOf("---\n\n") + 5);
  });

  it("rejects a repeated single side but accepts a unique one", () => {
    const before = "a gone gone\n\n---\n\n";
    expect(findRestoreOffset("x gone\n\n---\n\ny gone\n\n---\n\nz", before, "vanished text here")).toBeNull();
    expect(findRestoreOffset("x gone\n\n---\n\ny", before, "vanished text here")).toBe(13);
  });

  it("handles a whole-file cut", () => {
    expect(findRestoreOffset("", "", "")).toBe(0);
    expect(findRestoreOffset("\n", "", "")).toBe(1);
    expect(findRestoreOffset("new text", "", "")).toBeNull();
  });
});

describe("alreadyRestored", () => {
  it("detects a cut that was undone in the chapter", () => {
    for (const [doc, sel] of [["Ela viu tudo ontem.", "tudo"], ["P1.\n\nP2.\n\nP3.", "P2."], ["Ontem ela viu.", "Ontem"], ["fim do livro", "livro"]] as const) {
      const { plan } = cut(doc, sel);
      const e = { text: sel, pre: plan.pre, post: plan.post, before: plan.before, after: plan.after };
      const at = findRestoreOffset(doc, plan.before, plan.after);
      expect(at, `${doc} / ${sel}`).not.toBeNull();
      expect(alreadyRestored(doc, e, at!), `${doc} / ${sel}`).toBe(true);
    }
  });

  it("is false after the cut, and for blank passages", () => {
    const { plan, result } = cut("P1.\n\nP2.\n\nP3.", "P2.");
    const e = { text: "P2.", pre: plan.pre, post: plan.post, before: plan.before, after: plan.after };
    expect(alreadyRestored(result, e, findRestoreOffset(result, plan.before, plan.after)!)).toBe(false);
    expect(alreadyRestored("a   b", { text: "   ", before: "a", after: "b" }, 1)).toBe(false);
  });
});

describe("matchLineEndings", () => {
  it("converts to the target document's line endings", () => {
    expect(matchLineEndings("um\r\ndois\nfim", "lf\ndoc")).toBe("um\ndois\nfim");
    expect(matchLineEndings("um\r\ndois\nfim", "crlf\r\ndoc")).toBe("um\r\ndois\r\nfim");
    expect(matchLineEndings("a\nb", "")).toBe("a\nb");
  });

  it("keeps a passage from a CRLF-converted darlings note clean in an LF chapter", () => {
    const note = appendEntry("Intro", formatEntry(meta(), "one\ntwo")).replace(/\n/g, "\r\n");
    const [e] = parseEntries(note);
    expect(matchLineEndings(restoreText(e), "chapter\ntext")).toBe("one\ntwo");
  });
});

describe("helpers", () => {
  it("newId avoids taken ids and grows when needed", () => {
    const taken = new Set(["aaaaa"]);
    let n = 0;
    const seq = () => (n++ < 20 ? 0 : 0.5);
    const id = newId(taken, seq);
    expect(id).not.toBe("aaaaa");
    expect(id.length).toBeGreaterThanOrEqual(5);
    expect(newId(new Set())).toMatch(/^[a-z0-9]{5}$/);
    const always0 = () => 0;
    expect(newId(new Set(["aaaaa"]), always0)).toBe("aaaaaa");
  });

  it("newestFirst sorts by date, then by position", () => {
    const e = (id: string, date: string, start: number) => ({ ...meta({ id, date }), text: "", link: null, start, end: start + 1 });
    expect(newestFirst([e("a", "2026-01-01", 0), e("b", "2026-02-01", 10), e("c", "2026-01-01", 20)]).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("excerpt flattens and cuts at a word", () => {
    expect(excerpt("um\n\ndois   três")).toBe("um dois três");
    expect(excerpt("palavra ".repeat(50), 20)).toBe("palavra palavra…");
    expect(excerpt("x".repeat(30), 10)).toBe("x".repeat(10) + "…");
  });

  it("appendText separates from existing text", () => {
    expect(appendText("", "P")).toBe("P");
    expect(appendText("A", "P")).toBe("\n\nP");
    expect(appendText("A\n", "P")).toBe("\nP");
    expect(appendText("A\n\n", "P")).toBe("P");
  });

  it("baseName and withMd", () => {
    expect(baseName(FROM)).toBe("03 O porão");
    expect(baseName("x.MD")).toBe("x");
    expect(withMd("Darlings")).toBe("Darlings.md");
    expect(withMd("/Extra/Darlings.md/")).toBe("Extra/Darlings.md");
  });
});
