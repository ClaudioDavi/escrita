// The example notes "Set up a writing vault" creates (1.0, SF 10; PLAN-1.0 Q3, boards 35-37).
// Pure, no Obsidian imports. Task 2.1 owns this file and writes the texts; the seam (Wave 2)
// fixes the API that setup/plan.ts reads, so the plan and the run never wait on it.
//
// What the examples are (Q3, board 35): one conto (two beats, a placeholder, a target of
// 2,000 words) and one book (its book note and two chapters in its chapters folder, one with
// prose and one with beats only). Every example carries `example: true` in its properties
// and its name starts with `SETUP_NAMES[lang].examplePrefix`, so it is safe to delete. The
// names of the conto, the book and its folder are `SETUP_NAMES` (core/defaults.ts); the
// chapter file names are `EXAMPLE_CHAPTERS` below. The plan places every example and never
// plans one over an existing path; the run writes them through `notes.create` with
// `exists: "return"`.
//
// Done when (task 2.1): the conto classifies as a piece with a target, the book note as a
// book note and each chapter as a chapter of it (with the settings in `ExampleContext`);
// beats, a placeholder and a target in each; `en` and `pt-BR`.

import type { EscritaSettings } from "../settings";
import type { DefaultsLanguage } from "../core/defaults";
import { writtenWord } from "../core/stages";

/** Which example a text is for. `index` is the chapter's place in `EXAMPLE_CHAPTERS[lang]`, from 0. */
export type ExampleRole =
  | { kind: "story" }
  | { kind: "bookNote" }
  | { kind: "chapter"; index: number };

/** What an example's text depends on. */
export interface ExampleContext {
  /** the language of the prose and the titles: the setup's "Language of the defaults" */
  language: DefaultsLanguage;
  /**
   * The settings that will be in effect after the run (planSetup builds them: the live
   * settings with the chosen set's word-bearing values where the writer has none of their
   * own). Read the property names (`statusProperty`, `targetProperty`,
   * `chapterTargetProperty`…), the draft stage word (`writtenWord(settings.stages, "draft")`)
   * and `placeholderMarker` from here, never a literal, so the example classifies in the
   * writer's vault (rule 6).
   */
  settings: EscritaSettings;
}

/**
 * The example book's chapter file names per language, in order, with `.md`. The plan makes
 * one example item per name, inside the book's chapters folder. Task 2.1 may rename them
 * (the Wave 0 fixtures' names are placeholders); a rename updates
 * `tests/fixtures/setup/*.json` in the same commit.
 */
export const EXAMPLE_CHAPTERS: Readonly<Record<DefaultsLanguage, readonly string[]>> = {
  en: ["01 Arrival.md", "02 The storm.md"],
  "pt-BR": ["01 Chegada.md", "02 A tempestade.md"],
};

/** Targets, in the unit the writer counts in (words by default). */
const STORY_TARGET = 2000;
const BOOK_CHAPTER_TARGET = 1500;

interface Texts {
  story: { beats: [string, string]; prose: string[]; placeholder: string };
  book: { premise: string[]; placeholder: string };
  chapters: { beats: string[]; prose: string[]; placeholder: string; target: number }[];
}

const TEXTS: Readonly<Record<DefaultsLanguage, Texts>> = {
  en: {
    story: {
      beats: ["Mara and her father cross the bay before dawn", "The ferry stops and neither of them says why"],
      prose: [
        "The boat smelled of wet rope and diesel. Mara sat at the bow with her father's thermos between her knees, watching the far shore refuse to get any closer.",
        "\"You can steer, if you like,\" he said. She shook her head. Steering meant deciding where they were going.",
      ],
      placeholder: "the name of the town they are leaving",
    },
    book: {
      premise: [
        "Ines takes over a lighthouse that has not had a keeper in thirty years. The sea does not seem to have noticed.",
        "Use this note for what holds the book together: the premise, the cast, the rules of the place. Each chapter below can have its own target; this one is the default.",
      ],
      placeholder: "the island's real name",
    },
    chapters: [
      {
        beats: ["Ines reaches the island and finds the door unlocked", "A light is already burning at the top"],
        prose: [
          "The supply boat left her on the jetty with two crates and a key that turned out not to be needed. The door gave way at the first push, as if it had been expecting someone.",
          "She climbed the spiral stairs counting, because counting was easier than wondering. At the hundred and twelfth step she saw the glow above her.",
        ],
        placeholder: "who left the lamp lit",
        target: 1200,
      },
      {
        beats: ["The storm closes the channel for three days", "Ines finds the keeper's logbook, last entry unfinished", "She writes the next line"],
        prose: [],
        placeholder: "what the last entry says",
        target: 1500,
      },
    ],
  },
  "pt-BR": {
    story: {
      beats: ["Mara e o pai atravessam a baía antes do amanhecer", "A balsa para e nenhum dos dois diz por quê"],
      prose: [
        "O barco cheirava a corda molhada e diesel. Mara se sentou na proa, com a garrafa térmica do pai entre os joelhos, vendo a margem do outro lado se recusar a chegar mais perto.",
        "— Pode pegar o leme, se quiser — ele disse.",
        "Ela balançou a cabeça. Pegar o leme era decidir para onde iam.",
      ],
      placeholder: "o nome da cidade que eles estão deixando",
    },
    book: {
      premise: [
        "Inês assume um farol que não tem faroleiro há trinta anos. O mar parece não ter percebido.",
        "Use esta nota para o que sustenta o livro: a premissa, os personagens, as regras do lugar. Cada capítulo pode ter a sua meta; esta é a padrão.",
      ],
      placeholder: "o nome verdadeiro da ilha",
    },
    chapters: [
      {
        beats: ["Inês chega à ilha e encontra a porta destrancada", "Já há uma luz acesa lá no alto"],
        prose: [
          "O barco de suprimentos a deixou no cais com duas caixas e uma chave que não chegou a ser usada. A porta cedeu ao primeiro empurrão, como se esperasse alguém.",
          "Ela subiu a escada em espiral contando os degraus, porque contar era mais fácil do que se perguntar. No centésimo décimo segundo, viu o brilho lá em cima.",
        ],
        placeholder: "quem deixou a lâmpada acesa",
        target: 1200,
      },
      {
        beats: ["A tempestade fecha o canal por três dias", "Inês encontra o diário do faroleiro, com a última entrada pela metade", "Ela escreve a linha seguinte"],
        prose: [],
        placeholder: "o que diz a última entrada",
        target: 1500,
      },
    ],
  },
};

const beat = (text: string) => `%% beat: ${text} %%`;

/**
 * The full text of one example note: frontmatter (`example: true`, the status in the draft
 * stage, the target) and the body (beats as `%% beat: … %%`, a placeholder as
 * `%% <marker>: … %%`). Deterministic: the same context gives the same text, so a preview
 * and a run agree. The book note carries `chapterTarget` (the chapters' default); the
 * chapters carry their own target.
 */
export function exampleText(role: ExampleRole, ctx: ExampleContext): string {
  const { settings: s } = ctx;
  const texts = TEXTS[ctx.language];
  const status = writtenWord(s.stages, "draft");
  const marker = (what: string) => `%% ${s.placeholderMarker}: ${what} %%`;
  const front = (extra: [string, number][]) =>
    ["---", "example: true", `${s.statusProperty}: ${status}`, ...extra.map(([k, v]) => `${k}: ${v}`), "---"].join("\n");
  const join = (blocks: string[]) => blocks.join("\n\n") + "\n";

  if (role.kind === "story") {
    const t = texts.story;
    return join([front([[s.targetProperty, STORY_TARGET]]), beat(t.beats[0]), t.prose[0], marker(t.placeholder), t.prose[1], beat(t.beats[1])]);
  }
  if (role.kind === "bookNote") {
    const t = texts.book;
    return join([front([[s.chapterTargetProperty, BOOK_CHAPTER_TARGET]]), ...t.premise, marker(t.placeholder)]);
  }
  const c = texts.chapters[role.index];
  if (!c) return "";
  const [first, ...rest] = c.beats;
  const blocks = [front([[s.targetProperty, c.target]]), beat(first), ...c.prose, ...rest.map(beat), marker(c.placeholder)];
  return join(blocks);
}
