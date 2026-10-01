import { describe, it, expect } from "vitest";
import { bodyStart, compareTexts, paragraphs, tokenize, type Block, type Compare } from "../src/snapshots/compare";
import { applyChange, checkedChange, revertPlan, type AnchoredChange } from "../src/core/note-text";
import { countWords } from "../src/core/wordcount";

/** Every revert, frontmatter first, in text order. */
function reverts(c: Compare): AnchoredChange[] {
  const out: AnchoredChange[] = [];
  if (c.frontmatter) out.push(c.frontmatter.revert);
  for (const b of c.blocks) if (b.revert) out.push(b.revert);
  return out;
}

/** Applies every revert from the last to the first, each checked against the text as it is then. */
function revertAll(c: Compare, cur: string): string {
  let text = cur;
  const rs = reverts(c);
  for (let k = rs.length - 1; k >= 0; k--) {
    const ch = checkedChange(text, rs[k]);
    if (!ch) throw new Error(`revert ${k} no longer applies`);
    text = applyChange(text, ch);
  }
  return text;
}

function nonEqual(c: Compare): Block[] {
  return c.blocks.filter((b) => b.kind !== "equal");
}

function expectExactSpans(c: Compare, old: string, cur: string) {
  for (const b of c.blocks) {
    if (b.old) expect(old.slice(b.old.from, b.old.to)).toBe(b.old.text);
    if (b.cur) expect(cur.slice(b.cur.from, b.cur.to)).toBe(b.cur.text);
    for (const p of b.parts) {
      if (p.oldFrom !== undefined) expect(old.slice(p.oldFrom, p.oldFrom + p.text.length)).toBe(p.text);
      if (p.curFrom !== undefined) expect(cur.slice(p.curFrom, p.curFrom + p.text.length)).toBe(p.text);
    }
  }
}

describe("tokenize / paragraphs / bodyStart", () => {
  it("joins back to the text; Portuguese words stay whole", () => {
    const texts = ["O vento soprava forte.", "d’água, guarda-chuva e ninguém — até 2026!", "", "  \n\t x"];
    for (const t of texts) expect(tokenize(t).join("")).toBe(t);
    expect(tokenize("d’água")).toEqual(["d’água"]);
    expect(tokenize("ninguém viu")).toEqual(["ninguém", " ", "viu"]);
    expect(tokenize("sim, não")).toEqual(["sim", ",", " ", "não"]);
  });
  it("paragraphs are runs of non-blank lines, offsets into the full text", () => {
    const t = "---\na: 1\n---\nUm\nlinha dois\n\n  \n\nTrês\r\n\r\nQuatro\n";
    const body = bodyStart(t);
    expect(body).toBe("---\na: 1\n---\n".length);
    const ps = paragraphs(t, body);
    expect(ps.map((p) => p.text)).toEqual(["Um\nlinha dois", "Três", "Quatro"]);
    for (const p of ps) expect(t.slice(p.from, p.to)).toBe(p.text);
    expect(paragraphs("", 0)).toEqual([]);
    expect(paragraphs("\n\n  \n", 0)).toEqual([]);
    expect(bodyStart("sem propriedades")).toBe(0);
    expect(bodyStart("---\r\na: 1\r\n---\r\nx")).toBe("---\r\na: 1\r\n---\r\n".length);
  });
});

describe("compareTexts", () => {
  it("identical texts: all equal, nothing to report", () => {
    const t = "---\ntitle: A\n---\nUm.\n\nDois.\n";
    const c = compareTexts(t, t);
    expect(c.frontmatter).toBeNull();
    expect(c.blocks.every((b) => b.kind === "equal" && b.revert === null)).toBe(true);
    expect(c.summary).toEqual({ added: 0, removed: 0, changedParagraphs: 0, totalParagraphs: 2, percent: 0 });
    expect(c.degraded).toBe(false);
  });

  it("a one-word Portuguese change is a changed block with word parts", () => {
    const old = "Era noite.\n\nO vento soprava forte.\n\nFim.";
    const cur = "Era noite.\n\nO vento soprava fraco.\n\nFim.";
    const c = compareTexts(old, cur);
    const [b] = nonEqual(c);
    expect(nonEqual(c)).toHaveLength(1);
    expect(b.kind).toBe("changed");
    expect(b.parts.filter((p) => p.kind !== "equal").map((p) => [p.kind, p.text])).toEqual([["removed", "forte"], ["added", "fraco"]]);
    expect(c.summary).toMatchObject({ added: 1, removed: 1, changedParagraphs: 1, totalParagraphs: 3, percent: 33 });
    expectExactSpans(c, old, cur);
    expect(revertAll(c, cur)).toBe(old);
  });

  it("NFD vs NFC is one word pair, never split at the combining mark", () => {
    const old = "Não havia ninguém ali.";
    const cur = "Não havia ninguém ali.";
    const [b] = nonEqual(compareTexts(old, cur));
    expect(b.parts.filter((p) => p.kind !== "equal").map((p) => p.text)).toEqual(["ninguém", "ninguém"]);
  });

  it("d’água stays one token", () => {
    const [b] = nonEqual(compareTexts("Um copo d’água.", "Um copo d’agua."));
    expect(b.parts.filter((p) => p.kind !== "equal").map((p) => p.text)).toEqual(["d’água", "d’agua"]);
  });

  it("a punctuation-only change counts no words", () => {
    const old = "Ele disse, e saiu.";
    const cur = "Ele disse — e saiu.";
    const c = compareTexts(old, cur);
    expect(nonEqual(c).map((b) => b.kind)).toEqual(["changed"]);
    expect(c.summary.added).toBe(0);
    expect(c.summary.removed).toBe(0);
    expect(revertAll(c, cur)).toBe(old);
  });

  it("CRLF on one side only: equal, and reverts follow the current line endings", () => {
    const old = "Um.\n\nDois.\n\nTrês.";
    const curCrlf = "Um.\r\n\r\nDois.\r\n\r\nTrês.";
    expect(nonEqual(compareTexts(old, curCrlf))).toEqual([]);
    const changedOld = "Um.\nlinha.\n\nDois.";
    const c = compareTexts(changedOld, "Um.\r\noutra.\r\n\r\nDois.");
    const [b] = nonEqual(c);
    expect(b.revert?.insert).toBe("Um.\r\nlinha.");
  });

  it("a paragraph moved from the end to the start is a move, counting no words", () => {
    const old = "Primeiro parágrafo.\n\nSegundo parágrafo.\n\nO fim que virou começo.";
    const cur = "O fim que virou começo.\n\nPrimeiro parágrafo.\n\nSegundo parágrafo.";
    const c = compareTexts(old, cur);
    const moved = nonEqual(c);
    expect(moved.map((b) => b.kind).sort()).toEqual(["moved-in", "moved-out"]);
    expect(moved[0].movedId).toBe(moved[1].movedId);
    expect(moved[0].movedId).toBeGreaterThan(0);
    expect(c.blocks.filter((b) => b.kind === "equal")).toHaveLength(2);
    expect(c.summary).toMatchObject({ added: 0, removed: 0, changedParagraphs: 0, percent: 0 });
    expect(revertAll(c, cur)).toBe(old);
    // each revert alone also works
    for (const r of reverts(c)) {
      const ch = checkedChange(cur, r);
      expect(ch).not.toBeNull();
    }
  });

  it("a paragraph split in two, and two merged into one, are single changed blocks", () => {
    const old = "Antes.\n\nEla abriu a porta e viu o mar. Depois fechou os olhos e sorriu.\n\nDepois.";
    const cur = "Antes.\n\nEla abriu a porta e viu o mar.\n\nDepois fechou os olhos e sorriu.\n\nDepois.";
    const split = compareTexts(old, cur);
    const [s] = nonEqual(split);
    expect(nonEqual(split)).toHaveLength(1);
    expect(s).toMatchObject({ kind: "changed", paragraphs: { old: 1, cur: 2 } });
    expect(s.parts.some((p) => p.kind === "added" && p.text.includes("\n\n"))).toBe(true);
    expect(revertAll(split, cur)).toBe(old);

    const merged = compareTexts(cur, old);
    const [m] = nonEqual(merged);
    expect(nonEqual(merged)).toHaveLength(1);
    expect(m).toMatchObject({ kind: "changed", paragraphs: { old: 2, cur: 1 } });
    expect(m.parts.some((p) => p.kind === "removed" && p.text.includes("\n\n"))).toBe(true);
    expect(revertAll(merged, old)).toBe(cur);
  });

  it("a frontmatter-only change is kept apart from the body", () => {
    const old = "---\nstatus: draft\n---\nCorpo.\n\nMais.";
    const cur = "---\nstatus: published\nwords: 3\n---\nCorpo.\n\nMais.";
    const c = compareTexts(old, cur);
    expect(c.blocks.every((b) => b.kind === "equal")).toBe(true);
    expect(c.frontmatter).not.toBeNull();
    expect(c.frontmatter?.old).toBe("---\nstatus: draft\n---\n");
    expect(c.frontmatter?.lines.some((l) => l.kind === "added" && l.text.includes("published"))).toBe(true);
    expect(c.summary.percent).toBe(0);
    const ch = checkedChange(cur, c.frontmatter!.revert);
    expect(applyChange(cur, ch!)).toBe(old);
  });

  it("frontmatter added or removed entirely", () => {
    const bare = "Corpo.";
    const withFm = "---\na: 1\n---\nCorpo.";
    const added = compareTexts(bare, withFm);
    expect(added.frontmatter).toMatchObject({ old: "", cur: "---\na: 1\n---\n" });
    expect(revertAll(added, withFm)).toBe(bare);
    const removed = compareTexts(withFm, bare);
    expect(removed.frontmatter).toMatchObject({ old: "---\na: 1\n---\n", cur: "" });
    expect(revertAll(removed, bare)).toBe(withFm);
  });

  it("empty ↔ text, both ways", () => {
    const t = "Um.\n\nDois.\n\nTrês.";
    const fromEmpty = compareTexts("", t);
    expect(nonEqual(fromEmpty).map((b) => b.kind)).toEqual(["inserted", "inserted", "inserted"]);
    expect(fromEmpty.summary).toMatchObject({ added: 3, removed: 0, percent: 100 });
    expect(revertAll(fromEmpty, t)).toBe("");
    const toEmpty = compareTexts(t, "");
    expect(nonEqual(toEmpty).map((b) => b.kind)).toEqual(["deleted", "deleted", "deleted"]);
    expect(toEmpty.summary).toMatchObject({ added: 0, removed: 3, percent: 100 });
    expect(revertAll(toEmpty, "")).toBe(t);
  });

  it("maps blocks exactly around a %% beat %% and a code fence", () => {
    const old = "%% beat: ela chega %%\nEla chegou cedo.\n\n```\ncódigo\n\nmais código\n```\n\nFim da cena.";
    const cur = "%% beat: ela chega %%\nEla chegou tarde.\n\n```\ncódigo\n\nmais código\n```\n\nFim da cena, enfim.";
    const c = compareTexts(old, cur);
    expectExactSpans(c, old, cur);
    expect(revertAll(c, cur)).toBe(old);
  });

  it("summary words follow Escrita's counting; a pure append adds the difference", () => {
    const old = "Um dois três.\n\nQuatro cinco.";
    const cur = `${old}\n\nSeis sete oito, [[nove|nove]] %% não conta %% dez.`;
    const c = compareTexts(old, cur);
    expect(c.summary.added).toBe(countWords(cur) - countWords(old));
    expect(c.summary.removed).toBe(0);
  });

  it("the percentage uses the larger paragraph count", () => {
    const old = "A.\n\nB.\n\nC.";
    const cur = "A.\n\nB mudou bastante.\n\nC.\n\nD novo.\n\nE novo.";
    const c = compareTexts(old, cur);
    expect(c.summary.totalParagraphs).toBe(5);
    expect(c.summary.changedParagraphs).toBe(3);
    expect(c.summary.percent).toBe(60);
  });

  it("a replaced passage with nothing in common is shown whole", () => {
    const old = "Antes.\n\nO gato dormia no telhado.\n\nDepois.";
    const cur = "Antes.\n\nChovia muito naquela cidade.\n\nDepois.";
    const c = compareTexts(old, cur);
    const [b] = nonEqual(c);
    expect(b.kind).toBe("changed");
    expect(b.parts.map((p) => p.kind)).toEqual(["removed", "added"]);
    expect(c.degraded).toBe(false);
    expect(revertAll(c, cur)).toBe(old);
  });

  it("a timeout of 0 degrades to whole passages with exact ranges", () => {
    const old = "Um.\n\nDois mudou.\n\nTrês.\n\nQuatro.";
    const cur = "Um.\n\nDois agora.\n\nNovo.\n\nQuatro.";
    const c = compareTexts(old, cur, { timeoutMs: 0 });
    expect(c.degraded).toBe(true);
    const ne = nonEqual(c);
    expect(ne).toHaveLength(1);
    expect(ne[0]).toMatchObject({ kind: "changed", paragraphs: { old: 2, cur: 2 } });
    expect(ne[0].parts.map((p) => p.kind)).toEqual(["removed", "added"]);
    expectExactSpans(c, old, cur);
    expect(revertAll(c, cur)).toBe(old);
  });

  it("a long run of changed paragraphs is still paired paragraph by paragraph", () => {
    const paras = Array.from({ length: 150 }, (_, i) => `Parágrafo ${i}: o vento soprava forte sobre a casa.`);
    const old = paras.join("\n\n");
    const cur = paras.map((p) => p.replace("forte", "fraco")).join("\n\n");
    const c = compareTexts(old, cur);
    const ne = nonEqual(c);
    expect(ne).toHaveLength(150);
    expect(ne.every((b) => b.kind === "changed" && b.paragraphs.old === 1 && b.paragraphs.cur === 1)).toBe(true);
    expect(c.summary).toMatchObject({ added: 150, removed: 150, percent: 100 });
    expect(revertAll(c, cur)).toBe(old);
  });

  it("one revert changes only its block; recomputing shows it equal", () => {
    const old = "Um dia.\n\nO vento soprava forte.\n\nMeio.\n\nA chuva caía devagar.\n\nFim.";
    const cur = "Um dia.\n\nO vento soprava fraco.\n\nMeio.\n\nA chuva caía depressa.\n\nFim.\n\nEpílogo novo.";
    const c = compareTexts(old, cur);
    const ne = nonEqual(c);
    expect(ne.map((b) => b.kind)).toEqual(["changed", "changed", "inserted"]);
    const ch = checkedChange(cur, ne[1].revert!);
    const next = applyChange(cur, ch!);
    expect(next).toBe(cur.replace("depressa", "devagar"));
    const again = compareTexts(old, next);
    expect(nonEqual(again).map((b) => b.kind)).toEqual(["changed", "inserted"]);
  });
});

// ── Property: every revert, applied last to first, rebuilds the old text ──

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CORPUS = [
  "O vento soprava forte sobre o telhado da casa velha.",
  "Ninguém sabia de onde vinha aquele cheiro d’água parada.",
  "Ela abriu a janela, olhou o quintal e suspirou — era tarde demais.",
  "No porão, as caixas guardavam cartas que nunca foram enviadas.",
  "“Você vem?”, perguntou o menino, já com o guarda-chuva na mão.",
  "A cidade dormia; só o relógio da praça insistia em contar as horas.",
  "Havia três cadeiras à mesa, mas apenas duas xícaras de café.",
  "%% beat: a revelação %%",
  "Depois disso, ninguém mais falou no assunto.",
  "* * *",
];
const WORDS = ["noite", "chuva", "silêncio", "porta", "Maria", "então", "devagar", "coração", "rua", "é"];

function mutateParagraph(p: string, r: () => number): string {
  const tokens = p.split(" ");
  const op = Math.floor(r() * 3);
  const i = Math.floor(r() * tokens.length);
  const w = WORDS[Math.floor(r() * WORDS.length)];
  if (op === 0) tokens[i] = w;
  else if (op === 1) tokens.splice(i, 0, w);
  else if (tokens.length > 1) tokens.splice(i, 1);
  return tokens.join(" ");
}

function edit(paras: string[], r: () => number): string[] {
  const out = [...paras];
  const steps = 1 + Math.floor(r() * 4);
  for (let s = 0; s < steps; s++) {
    const op = Math.floor(r() * 6);
    const i = Math.floor(r() * Math.max(out.length, 1));
    if (op === 0 && out.length) out[i] = mutateParagraph(out[i], r);
    else if (op === 1) out.splice(i, 0, CORPUS[Math.floor(r() * CORPUS.length)]);
    else if (op === 2 && out.length) out.splice(i, 1);
    else if (op === 3 && out.length > 1) { const [p] = out.splice(i, 1); out.splice(Math.floor(r() * (out.length + 1)), 0, p); }
    else if (op === 4 && out.length) { const cut = out[i].indexOf(" ", out[i].length >> 1); if (cut > 0) out.splice(i, 1, out[i].slice(0, cut), out[i].slice(cut + 1)); }
    else if (op === 5 && i + 1 < out.length) out.splice(i, 2, `${out[i]} ${out[i + 1]}`);
  }
  return out;
}

function withFm(r: () => number): string {
  const k = Math.floor(r() * 3);
  return k === 0 ? "" : k === 1 ? "---\nstatus: draft\n---\n" : "---\nstatus: published\nwords: 120\n---\n";
}

describe("compareTexts property", () => {
  it("over 40 seeded edit scripts, applying every revert from last to first yields the old text", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const n = Math.floor(r() * 7);
      const base = Array.from({ length: n }, () => CORPUS[Math.floor(r() * CORPUS.length)]);
      const oldParas = r() < 0.5 ? base : edit(base, r);
      const curParas = edit(oldParas, r);
      const old = withFm(r) + oldParas.join("\n\n");
      const cur = withFm(r) + curParas.join("\n\n");
      const c = compareTexts(old, cur);
      expectExactSpans(c, old, cur);
      let rebuilt: string;
      try {
        rebuilt = revertAll(c, cur);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}\nOLD:\n${old}\nCUR:\n${cur}`);
      }
      expect(rebuilt, `seed ${seed}\nOLD:\n${old}\nCUR:\n${cur}`).toBe(old);
      // and each revert alone still applies to the current text
      for (const rv of reverts(c)) expect(checkedChange(cur, rv), `seed ${seed}`).not.toBeNull();
    }
  });
});

describe("a stale compare view never reverts at a shifted offset", () => {
  it("a deleted paragraph between two changed ones is refused once the note changed", () => {
    const old = "Alpha one.\n\nMiddle gone.\n\nBeta two.\n";
    const shown = "Alpha 1.\n\nBeta 2.\n";
    const cmp = compareTexts(old, shown);
    const del = cmp.blocks.find((b) => b.kind === "deleted");
    const revert = del?.revert as AnchoredChange;
    expect(revert.expected).toBe("");
    const now = "Hi, mom.\n\n" + shown;
    // the anchor alone is only the paragraph gap: it would land before Alpha
    expect(checkedChange(now, revert)).not.toBeNull();
    // the plan the compare view uses refuses
    expect(revertPlan(revert, shown)(now)).toBeNull();
    const ok = revertPlan(revert, shown)(shown);
    expect(ok).not.toBeNull();
    expect(applyChange(shown, ok as NonNullable<typeof ok>)).toBe("Alpha 1.\n\nMiddle gone.\n\nBeta 2.\n");
  });
});
