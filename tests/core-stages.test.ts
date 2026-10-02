import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAGES, STAGES, atLeast, cloneDefaultStages, normalizeStages, parseStatusColorLines, parseStatusColors,
  readStatus, stageConflicts, stageOf, stageRank, stageWords, statusColor, writtenWord, type StageMapping,
} from "../src/core/stages";
import { migrateSettings, migrateStages } from "../src/core/migrate";
import { mergeDefaults } from "../src/core/merge";

const pt = (): StageMapping => {
  const s = cloneDefaultStages();
  s.idea.words = "ideia"; s.draft.words = "rascunho"; s.revision.words = "revisão, revisando";
  s.ready.words = "pronto"; s.published.words = "publicado";
  return s;
};

describe("stageOf", () => {
  it("matches NFC, trim, case, and numbers", () => {
    const s = pt();
    expect(stageOf("revisão", s)).toBe("revision");
    expect(stageOf("revisão".replace("ã", "ã"), s)).toBe("revision");
    expect(stageOf("revisão", s)).toBe("revision"); // NFD
    expect(stageOf("  REVISANDO ", s)).toBe("revision");
    expect(stageOf("nada", s)).toBeNull();
    expect(stageOf("", s)).toBeNull();
    expect(stageOf(null, s)).toBeNull();
    expect(stageOf(["pronto"], s)).toBeNull();
    const n = cloneDefaultStages(); n.idea.words = "1";
    expect(stageOf(1, n)).toBe("idea");
  });
  it("first stage wins a shared word", () => {
    const s = cloneDefaultStages(); s.revision.words = "pronto"; s.ready.words = "pronto";
    expect(stageOf("pronto", s)).toBe("revision");
    expect(stageConflicts(s)).toEqual([{ word: "pronto", stages: ["revision", "ready"] }]);
    expect(stageConflicts(pt())).toEqual([]);
  });
  it("sees in-place edits of a cached mapping", () => {
    const s = cloneDefaultStages();
    expect(stageOf("rascunho", s)).toBeNull();
    s.draft.words = "rascunho";
    expect(stageOf("rascunho", s)).toBe("draft");
  });
});

describe("words, status and rank", () => {
  it("lists words and writes the first", () => {
    const s = pt();
    expect(stageWords(s, "revision")).toEqual(["revisão", "revisando"]);
    expect(writtenWord(s, "revision")).toBe("revisão");
    s.idea.words = " , ";
    expect(writtenWord(s, "idea")).toBe("idea");
  });
  it("readStatus takes strings and numbers only", () => {
    expect(readStatus({ status: " draft " }, "status")).toBe("draft");
    expect(readStatus({ status: 3 }, "status")).toBe("3");
    expect(readStatus({ status: ["draft"] }, "status")).toBeNull();
    expect(readStatus({ status: "" }, "status")).toBeNull();
    expect(readStatus(null, "status")).toBeNull();
    expect(readStatus({}, "status")).toBeNull();
  });
  it("ranks", () => {
    expect(stageRank("idea")).toBe(0);
    expect(atLeast("ready", "ready")).toBe(true);
    expect(atLeast("draft", "ready")).toBe(false);
    expect(atLeast(null, "idea")).toBe(false);
  });
});

describe("colors", () => {
  it("parses lines", () => {
    expect(parseStatusColors("A = #fff\nb: red")).toEqual({ a: "#fff", b: "red" });
    expect(parseStatusColorLines("a = #fff\n\nnonsense\r\n")).toEqual([
      { value: "a", color: "#fff", raw: "a = #fff" },
      { value: null, color: null, raw: "nonsense" },
    ]);
  });
  it("statusColor falls back to otherStatusColors", () => {
    const s = pt(); s.draft.color = "";
    expect(statusColor("pronto", s, "")).toBe("#8fb3d9");
    expect(statusColor("rascunho", s, "Rascunho = red")).toBe("red");
    expect(statusColor("capítulo", s, "capítulo = #123456")).toBe("#123456");
    expect(statusColor("x", s, "capítulo = #123456")).toBeUndefined();
  });
});

describe("normalizeStages", () => {
  it("never returns its input or the defaults", () => {
    expect(normalizeStages(DEFAULT_STAGES)).not.toBe(DEFAULT_STAGES);
    expect(normalizeStages(DEFAULT_STAGES)).toEqual(DEFAULT_STAGES);
    const mine = cloneDefaultStages();
    const out = normalizeStages(mine);
    expect(out).not.toBe(mine);
    for (const k of STAGES) { expect(out[k]).not.toBe(mine[k]); expect(out[k]).not.toBe(DEFAULT_STAGES[k]); }
    expect(Object.isFrozen(out)).toBe(false);
    out.draft.words = "x";
    expect(DEFAULT_STAGES.draft.words).toBe("draft");
  });
  it("repairs bad values", () => {
    for (const bad of [null, [], "x", 3, undefined]) expect(normalizeStages(bad)).toEqual(DEFAULT_STAGES);
    const out = normalizeStages({ idea: { words: "  ", color: "#ABC" }, draft: { words: "r", color: "red" }, ready: { words: "p", color: "#AABBCC" }, revision: 5 });
    expect(out.idea).toEqual({ words: "idea", color: "#aabbcc" });
    expect(out.draft).toEqual({ words: "r", color: "" });
    expect(out.ready.color).toBe("#aabbcc");
    expect(out.revision).toEqual(DEFAULT_STAGES.revision);
  });
});

const authorRaw = {
  statusColors: "ideia = #7d7972\nrascunho = #9a968e\nrevisão = #e0b567\npronto = #8fb3d9\npublicado = #86c497",
  publishedValue: "publicado", unpublishedValue: "pronto", statusProperty: "status",
};

describe("migrateStages", () => {
  it("defaults give the default stages", () => {
    const r = migrateStages({
      statusColors: "idea = #7d7972\ndraft = #9a968e\nrevision = #e0b567\nready = #8fb3d9\npublished = #86c497",
      publishedValue: "published", unpublishedValue: "ready",
    });
    expect(r.stages).toEqual(DEFAULT_STAGES);
    expect(r.otherStatusColors).toBe("");
    expect(migrateStages(undefined).stages).toEqual(DEFAULT_STAGES);
    expect(migrateStages({}).stages).toEqual(DEFAULT_STAGES);
  });
  it("the author's settings", () => {
    const r = migrateStages(authorRaw);
    expect(r.stages).toEqual({
      idea: { words: "ideia", color: "#7d7972" },
      draft: { words: "rascunho", color: "#9a968e" },
      revision: { words: "revisão", color: "#e0b567" },
      ready: { words: "pronto", color: "#8fb3d9" },
      published: { words: "publicado", color: "#86c497" },
    });
    expect(r.otherStatusColors).toBe("");
  });
  it("a custom published value", () => {
    const r = migrateStages({ publishedValue: "done", unpublishedValue: "ready", statusColors: "done = #111111\nready = #222222" });
    expect(r.stages.published).toEqual({ words: "done", color: "#111111" });
    expect(r.stages.ready.color).toBe("#222222");
  });
  it("equal published and unpublished values keep ready at its default", () => {
    const r = migrateStages({ publishedValue: "Publicado", unpublishedValue: " publicado " });
    expect(r.stages.published.words).toBe("Publicado");
    expect(r.stages.ready.words).toBe("ready");
  });
  it("red survives, #abc expands", () => {
    const r = migrateStages({ ...authorRaw, statusColors: authorRaw.statusColors.replace("ideia = #7d7972", "ideia = red").replace("rascunho = #9a968e", "rascunho = #abc") });
    expect(r.stages.idea).toEqual({ words: "ideia", color: "" });
    expect(r.stages.draft).toEqual({ words: "rascunho", color: "#aabbcc" });
    expect(r.otherStatusColors).toBe("ideia = red");
    expect(statusColor("ideia", r.stages, r.otherStatusColors)).toBe("red");
  });
  it("keeps unmatched and unparsable lines", () => {
    const r = migrateStages({ ...authorRaw, statusColors: authorRaw.statusColors + "\ncapítulo = #123456\njunk line\nx = #12345678" });
    expect(r.otherStatusColors).toBe("ideia = #7d7972\nrascunho = #9a968e\nrevisão = #e0b567\ncapítulo = #123456\njunk line\nx = #12345678");
    expect(r.stages.published.words).toBe("publicado");
    expect(r.stages.idea.words).toBe("idea"); // six lines: no positional rule
  });
  it("positional rule does not fire with 4 lines", () => {
    const r = migrateStages({ ...authorRaw, statusColors: "rascunho = #9a968e\nrevisão = #e0b567\npronto = #8fb3d9\npublicado = #86c497" });
    expect(r.stages.draft.words).toBe("draft");
    expect(r.stages.revision.words).toBe("revision");
    expect(r.otherStatusColors).toBe("rascunho = #9a968e\nrevisão = #e0b567");
  });
  it("positional rule needs lines 4 and 5 to be ready and published", () => {
    const r = migrateStages({ ...authorRaw, statusColors: "a = #111111\nb = #222222\nc = #333333\nd = #444444\ne = #555555" });
    expect(r.stages.idea.words).toBe("idea");
    expect(r.otherStatusColors.split("\n")).toHaveLength(5);
  });
  it("never loses a value", () => {
    const lines = ["ideia = red", "rascunho = #abc", "revisão = #e0b567", "pronto = rgb", "publicado = #86c497", "outro = #123", "ideia = #999999", "???"];
    for (let n = 0; n <= lines.length; n++) {
      const statusColors = lines.slice(0, n).join("\n");
      const r = migrateStages({ ...authorRaw, statusColors });
      const kept = new Set(r.otherStatusColors.split("\n"));
      for (const l of parseStatusColorLines(statusColors)) {
        const st = l.value ? stageOf(l.value, r.stages) : null;
        const hex = l.color && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(l.color);
        const onStage = !!st && hex && r.stages[st].color !== "";
        expect(onStage || kept.has(l.raw)).toBe(true);
      }
    }
  });
});

describe("migrateSettings", () => {
  it("is idempotent and does not mutate", () => {
    const raw = JSON.parse(JSON.stringify(authorRaw));
    const once = migrateSettings(raw) as Record<string, unknown>;
    expect(raw).toEqual(authorRaw);
    expect(once.publishedValue).toBe("publicado");
    expect(migrateSettings(once)).toBe(once);
    expect(migrateSettings(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
  it("returns non-records untouched and records with stages as-is", () => {
    for (const v of [undefined, null, "x", 3, [1]]) expect(migrateSettings(v)).toBe(v);
    const has = { stages: { idea: {} } };
    expect(migrateSettings(has)).toBe(has);
  });
  it("pipeline: legacy keys survive, stages are the author's and fresh", () => {
    const defaults = { stages: DEFAULT_STAGES, otherStatusColors: "", publishedValue: "published", unpublishedValue: "ready", statusColors: "x = #000000" };
    const merged = mergeDefaults(defaults, migrateSettings(authorRaw));
    expect(merged.publishedValue).toBe("publicado");
    expect(merged.statusColors).toBe(authorRaw.statusColors);
    const stages = normalizeStages(merged.stages);
    expect(stages).not.toBe(DEFAULT_STAGES);
    expect(stages.revision).toEqual({ words: "revisão", color: "#e0b567" });
    expect(merged.otherStatusColors).toBe("");
  });
  it("a settings object with no stages and default merge yields a fresh copy", () => {
    const merged = mergeDefaults({ stages: DEFAULT_STAGES }, undefined);
    expect(normalizeStages(merged.stages)).not.toBe(DEFAULT_STAGES);
  });
});
