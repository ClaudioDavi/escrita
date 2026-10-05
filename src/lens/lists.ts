// The word lists note (0.5 plan Q10, Q11, Q14). Pure: no obsidian imports.
// Three headings, in Portuguese or English, hold one entry per line.

import type { LensLang, Lists } from "./types";
import { listsPath } from "./settings";

export { listsPath };

type Section = keyof Lists;

/** Fixed bilingual aliases, compared without case or accents (Q10). */
export const HEADINGS: Record<string, Section> = {
  vicios: "crutch",
  "crutch words": "crutch",
  crutches: "crutch",
  nomes: "names",
  names: "names",
  ignorar: "ignore",
  ignore: "ignore",
};

export function foldHeading(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sectionOf(line: string): Section | null | undefined {
  const m = /^ {0,3}#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
  if (!m) return undefined; // not a heading
  return HEADINGS[foldHeading(m[1])] ?? null; // null: another heading, skip what follows
}

/** Parse the note's text into the three lists. Entries keep their casing; duplicates (case-folded) keep the first. */
export function parseLists(text: string): Lists {
  let t = text.normalize("NFC").replace(/\r\n?/g, "\n");
  if (/^---[ \t]*\n/.test(t)) {
    const end = /\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(t.slice(3));
    t = end ? t.slice(3 + end.index + end[0].length) : "";
  }
  t = t.replace(/%%[\s\S]*?(?:%%|$)/g, "");
  const out: Lists = { crutch: [], names: [], ignore: [] };
  const seen: Record<Section, Set<string>> = { crutch: new Set(), names: new Set(), ignore: new Set() };
  let current: Section | null = null;
  for (const raw of t.split("\n")) {
    const heading = sectionOf(raw);
    if (heading !== undefined) {
      current = heading;
      continue;
    }
    if (!current) continue;
    const entry = raw
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen[current].has(key)) continue;
    seen[current].add(key);
    out[current].push(entry);
  }
  return out;
}


interface Starter {
  title: string; intro: string;
  crutch: string; names: string; ignore: string;
  crutchHint: string; namesHint: string; ignoreHint: string;
  words: string[];
}

const STARTER: Record<LensLang, Starter> = {
  "pt-BR": {
    title: "Listas de palavras",
    intro: "A lente de revisão lê esta nota. Uma palavra ou expressão por linha.",
    crutchHint: "palavras e expressões que você usa demais",
    namesHint: "personagens e lugares; a lente avisa quando um nome sai quase igual",
    ignoreHint: "palavras que a lente não deve marcar",
    crutch: "Vícios",
    names: "Nomes",
    ignore: "Ignorar",
    words: ["de repente", "começou a", "meio que", "viu", "ouviu", "sentiu", "percebeu"],
  },
  en: {
    title: "Word lists",
    intro: "The revision lens reads this note. One word or phrase per line.",
    crutchHint: "words and phrases you overuse",
    namesHint: "characters and places; the lens warns when a name comes out almost the same",
    ignoreHint: "words the lens should not mark",
    crutch: "Crutch words",
    names: "Names",
    ignore: "Ignore",
    words: ["all of a sudden", "started to", "sort of", "saw", "heard", "felt", "noticed"],
  },
};

/** Text for a new word lists note: the three headings and a short starter crutch list (Q11). */
export function starterNote(l: LensLang): string {
  const s = STARTER[l];
  return `# ${s.title}\n\n${s.intro}\n\n`
    + `## ${s.crutch}\n%% ${s.crutchHint} %%\n\n${s.words.map((w) => `- ${w}`).join("\n")}\n\n`
    + `## ${s.names}\n%% ${s.namesHint} %%\n\n`
    + `## ${s.ignore}\n%% ${s.ignoreHint} %%\n`;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function sameLists(a: Lists, b: Lists): boolean {
  return sameList(a.crutch, b.crutch) && sameList(a.names, b.names) && sameList(a.ignore, b.ignore);
}
