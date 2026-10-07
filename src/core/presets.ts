// The two manuscript presets of 0.8 (N 7, stage 2). Plain data, no logic: the writers
// read them and nothing else about layout. Pure, no Obsidian imports. In core so the
// outline's reader takes its default chapter heading from here (it never imports export).
import type { Preset } from "./export-pipeline";

/** Standard manuscript format (Shunn), US Letter, English labels. */
export const SHUNN: Preset = {
  id: "shunn",
  language: "en-US",
  page: { width: 612, height: 792, margin: 72 },
  font: { family: "Times New Roman", size: 12 },
  lineSpacing: 2,
  indent: 36,
  sceneBreak: "#",
  chapterHeading: "Chapter {n}: {title}",
  header: "{surname} / {title} / {page}",
  countLabel: {
    words: "about {n} words",
    characters: "about {n} characters",
    "characters-no-spaces": "about {n} characters, no spaces",
  },
  byline: "by {name}",
  endMark: "END",
  contentsLabel: "Contents",
  coverLabel: "Cover",
  startLabel: "Start of content",
};

/** The pt-BR editorial preset: same layout, Portuguese labels, A4. */
export const PTBR: Preset = {
  id: "ptbr",
  language: "pt-BR",
  page: { width: 595.3, height: 841.9, margin: 72 },
  font: { family: "Times New Roman", size: 12 },
  lineSpacing: 2,
  indent: 36,
  sceneBreak: "#",
  chapterHeading: "Capítulo {n} — {title}",
  header: "{surname} / {title} / {page}",
  countLabel: {
    words: "cerca de {n} palavras",
    characters: "cerca de {n} caracteres",
    "characters-no-spaces": "cerca de {n} caracteres, sem espaços",
  },
  byline: "por {name}",
  endMark: "FIM",
  contentsLabel: "Sumário",
  coverLabel: "Capa",
  startLabel: "Início",
};

export const PRESETS: readonly Preset[] = [SHUNN, PTBR];

/** The preset with this id, or the first one for an unknown id. */
export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** The preset a language starts with: pt-BR for Obsidian in Portuguese (Brazil), else Shunn. */
export function presetForLanguage(language: string): Preset {
  return language === "pt-BR" ? PTBR : SHUNN;
}
