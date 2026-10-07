// The stages of a work's life and the writer's words for them (no Obsidian imports).

import { lineList } from "./lists";

export const STAGES = ["idea", "draft", "revision", "ready", "published"] as const;
export type Stage = typeof STAGES[number];
/** color: "" (none) or "#rrggbb" */
export interface StageSetting { words: string; color: string }
export type StageMapping = Record<Stage, StageSetting>;

export const DEFAULT_STAGES: StageMapping = deepFreezeStages({
  idea: { words: "idea", color: "#7d7972" },
  draft: { words: "draft", color: "#9a968e" },
  revision: { words: "revision", color: "#e0b567" },
  ready: { words: "ready", color: "#8fb3d9" },
  published: { words: "published", color: "#86c497" },
});

/** Freezes the record and each setting so a shared reference cannot corrupt the defaults. */
function deepFreezeStages(m: StageMapping): StageMapping {
  for (const k of STAGES) Object.freeze(m[k]);
  return Object.freeze(m);
}

/** A fresh, mutable copy of the default stages. */
export function cloneDefaultStages(): StageMapping {
  const out = {} as StageMapping;
  for (const k of STAGES) out[k] = { ...DEFAULT_STAGES[k] };
  return out;
}

export const DEFAULT_STATUS_PROPERTY = "status";

/** The stages a live settings object may mutate: a fresh copy whenever it is (or shares) the frozen defaults. */
export function ownStages(m: StageMapping): StageMapping {
  return m === DEFAULT_STAGES || Object.isFrozen(m) ? cloneDefaultStages() : m;
}

/** NFC, trim, lowercase; string or number only. Empty gives null. */
function normWord(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const out = String(v).normalize("NFC").trim().toLowerCase();
  return out || null;
}

const wordMaps = new WeakMap<StageMapping, { sig: string; map: Map<string, Stage> }>();

function wordMap(stages: StageMapping): Map<string, Stage> {
  // The settings tab edits the mapping in place, so the cache is checked against the words.
  const sig = STAGES.map((k) => stages[k]?.words ?? "").join("\u0000");
  const hit = wordMaps.get(stages);
  if (hit && hit.sig === sig) return hit.map;
  const map = new Map<string, Stage>();
  for (const k of STAGES) {
    for (const w of lineList(stages[k]?.words)) {
      const n = normWord(w);
      if (n && !map.has(n)) map.set(n, k);
    }
  }
  wordMaps.set(stages, { sig, map });
  return map;
}

/** The stage a status word belongs to; the first stage in STAGES order wins a shared word. */
export function stageOf(status: unknown, stages: StageMapping): Stage | null {
  const n = normWord(status);
  return n ? wordMap(stages).get(n) ?? null : null;
}

export function stageWords(stages: StageMapping, stage: Stage): string[] {
  return lineList(stages[stage]?.words);
}

/** The word Escrita writes for a stage: the first one, else the stage id. */
export function writtenWord(stages: StageMapping, stage: Stage): string {
  return stageWords(stages, stage)[0] ?? stage;
}

/** The status of a note: a string or number in the status property, trimmed; else null. */
export function readStatus(fm: unknown, statusProperty: string): string | null {
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) return null;
  const v = (fm as Record<string, unknown>)[statusProperty];
  if (typeof v !== "string" && typeof v !== "number") return null;
  const out = String(v).trim();
  return out || null;
}

export function stageRank(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function atLeast(stage: Stage | null, min: Stage): boolean {
  return stage !== null && stageRank(stage) >= stageRank(min);
}

const COLOR_LINE = /^\s*(.+?)\s*[=:]\s*(#[0-9a-f]{3,8}|[a-z]+)\s*$/i;

export function parseStatusColors(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split(/\r?\n/)) {
    const m = /^\s*(.+?)\s*[=:]\s*(#[0-9a-f]{3,8}|[a-z]+)\s*$/i.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/** Every non-blank line; value and color are null when the line does not parse. */
export function parseStatusColorLines(s: string): { value: string | null; color: string | null; raw: string }[] {
  const out: { value: string | null; color: string | null; raw: string }[] = [];
  if (typeof s !== "string") return out;
  for (const line of s.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = COLOR_LINE.exec(line);
    out.push(m ? { value: m[1], color: m[2], raw: line } : { value: null, color: null, raw: line });
  }
  return out;
}

/** The color for a status word: the stage's color if set, else its entry in otherStatusColors. */
export function statusColor(status: unknown, stages: StageMapping, otherStatusColors: string): string | undefined {
  const stage = stageOf(status, stages);
  const own = stage ? stages[stage]?.color : "";
  if (own) return own;
  const n = normWord(status);
  if (!n || !otherStatusColors) return undefined;
  for (const l of parseStatusColorLines(otherStatusColors)) {
    if (l.value !== null && l.color !== null && normWord(l.value) === n) return l.color;
  }
  return undefined;
}

/** Words that appear under more than one stage (the first stage wins in stageOf). */
export function stageConflicts(stages: StageMapping): { word: string; stages: Stage[] }[] {
  const seen = new Map<string, { word: string; stages: Stage[] }>();
  for (const k of STAGES) {
    for (const w of lineList(stages[k]?.words)) {
      const n = normWord(w);
      if (!n) continue;
      const e = seen.get(n);
      if (!e) seen.set(n, { word: w, stages: [k] });
      else if (!e.stages.includes(k)) e.stages.push(k);
    }
  }
  return [...seen.values()].filter((e) => e.stages.length > 1);
}

/** "#abc" gives "#aabbcc"; "#aabbcc" is lowercased; anything else gives null. */
export function hexColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return "#" + [...s.slice(1)].map((c) => c + c).join("");
  return null;
}

/**
 * Always a fresh, mutable deep copy; never the input and never DEFAULT_STAGES. A missing or
 * blank word, or a missing colour entry, comes from `base` (the install's default set,
 * 1.0 task 1.4; DEFAULT_STAGES when omitted).
 */
export function normalizeStages(v: unknown, base?: StageMapping): StageMapping {
  const out = cloneDefaultStages();
  if (base) for (const k of STAGES) out[k] = { ...base[k] };
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  const src = v as Record<string, unknown>;
  for (const k of STAGES) {
    const e = src[k];
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    const { words, color } = e as Record<string, unknown>;
    if (typeof words === "string" && words.trim()) out[k].words = words.trim();
    if (typeof color === "string") out[k].color = hexColor(color) ?? "";
  }
  return out;
}
