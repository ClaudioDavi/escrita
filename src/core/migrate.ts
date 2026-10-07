// Carries 0.3 status settings (publishedValue, unpublishedValue, statusColors) over to
// the 0.4 stage mapping (no Obsidian imports). Idempotent; never mutates its input; the
// legacy keys stay so a downgrade still works.

import {
  STAGES, cloneDefaultStages, hexColor, parseStatusColorLines, stageOf,
  type Stage, type StageMapping,
} from "./stages";

import { isDefaultsLanguage } from "./defaults";

const norm = (s: string): string => s.normalize("NFC").trim().toLowerCase();
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function migrateStages(legacy: unknown): { stages: StageMapping; otherStatusColors: string } {
  const src = isRecord(legacy) ? legacy : {};
  const stages = cloneDefaultStages();
  const str = (k: string): string => (typeof src[k] === "string" ? (src[k]).trim() : "");

  const published = str("publishedValue");
  const unpublished = str("unpublishedValue");
  if (published) stages.published.words = published;
  // Q34: two equal values would make "ready" published, so ready keeps its default word.
  if (unpublished && norm(unpublished) !== norm(published)) stages.ready.words = unpublished;

  const hasColors = typeof src.statusColors === "string";
  const lines = hasColors ? parseStatusColorLines(src.statusColors as string) : [];
  if (hasColors) for (const k of STAGES) stages[k].color = "";
  else return { stages, otherStatusColors: "" };

  // Q2: the positional rule names the idea, draft and revision words from lines 1-3.
  const defaults = cloneDefaultStages();
  const untouched = (["idea", "draft", "revision"] as const).every((k) => stages[k].words === defaults[k].words);
  if (untouched && lines.length === 5 && lines.every((l) => l.value !== null)) {
    const v = lines.map((l) => l.value as string);
    const in4 = stageOf(v[3], stages) === "ready";
    const in5 = stageOf(v[4], stages) === "published";
    const free = v.slice(0, 3).every((x) => stageOf(x, stages) === null);
    const distinct = new Set(v.slice(0, 3).map(norm)).size === 3;
    if (in4 && in5 && free && distinct) {
      stages.idea.words = v[0].normalize("NFC");
      stages.draft.words = v[1].normalize("NFC");
      stages.revision.words = v[2].normalize("NFC");
    }
  }

  const claimed = new Set<Stage>();
  const other: string[] = [];
  for (const l of lines) {
    const stage = l.value !== null ? stageOf(l.value, stages) : null;
    const color = l.color !== null ? hexColor(l.color) : null;
    if (stage && color && !claimed.has(stage)) {
      stages[stage].color = color;
      claimed.add(stage);
    } else {
      other.push(l.raw);
    }
  }
  return { stages, otherStatusColors: other.join("\n") };
}

export function migrateSettings(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  // 1.0 (Q1): a saved install without the key keeps the English defaults it relies on.
  const withLang = isDefaultsLanguage(raw.defaultsLanguage) ? raw : { ...raw, defaultsLanguage: "en" };
  if (isRecord(withLang.stages)) return withLang;
  const { stages, otherStatusColors } = migrateStages(withLang);
  const kept = typeof withLang.otherStatusColors === "string" ? withLang.otherStatusColors : "";
  return { ...withLang, stages, otherStatusColors: otherStatusColors || kept };
}

