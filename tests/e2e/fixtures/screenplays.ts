// A vault for the screenplay export checks (PLAN-1.1 G2, Wave 2 J): a Brazilian short script in
// Roteiros/ (a screenplay by the "Form by folder" rule, no property), one with the form property
// outside the folder, a script with notes and a character Courier cannot print, a prose conto.
// Brick & Steel (the reference script) is not in tests/fixtures/screenplay/, so it is not here.
import fs from "node:fs";
import path from "node:path";
import type { VaultSpec } from "./index";

const FOUNTAIN = path.join(process.cwd(), "tests", "fixtures", "screenplay", "pt-short.fountain");

export const SCRIPT = "Roteiros/A lata do faroleiro.md";
export const BY_PROPERTY = "Outros/Com propriedade.md";
export const NOTES = "Roteiros/Com notas.md";
export const LONG = "Roteiros/Fala longa.md";
export const PROSE = "Contos/Prosa.md";

/** One speech longer than a page, so it breaks whatever comes before it: (MAIS) and (CONT.) in pt-BR. */
function longSpeech(): string {
  const sentence = (i: number) => `Esta é a frase número ${i} e ela segue pelo cais devagar.`;
  const speech = Array.from({ length: 70 }, (_, i) => sentence(i + 1)).join(" ");
  return `INT. CAIS - NOITE\n\nMara chega ao fim do cais.\n\nMARA\n${speech}\n\nTomé não responde.\n`;
}

export function screenplays(): VaultSpec {
  const script = fs.readFileSync(FOUNTAIN, "utf8");
  return {
    language: "pt-BR",
    data: { setupOffered: true },
    files: {
      [SCRIPT]: script,
      [BY_PROPERTY]: `---\nform: roteiro\n---\n\nINT. SALA - DIA\n\nUma sala vazia.\n\nANA\nOlá?\n`,
      [NOTES]: [
        "INT. PORTO - DIA",
        "",
        "Mara espera no cais.",
        "",
        "%% reescrever esta cena depois %%",
        "",
        "MARA",
        "Estrela ★ no céu.",
        "",
        "%% beat: Tomé chega %%",
        "",
      ].join("\n"),
      [LONG]: longSpeech(),
      [PROSE]: "---\nstatus: rascunho\n---\n\nO mar subiu devagar naquela noite.\n",
    },
  };
}

// ---- the screenplay editor (PLAN-1.2, Wave 2 F) ----

export const ELEMENTS = "Roteiros/Elementos.md";
export const CAST = "Roteiros/Elenco.md";
export const HUGE = "Roteiros/Longo.md";
export const CONTO = "Contos/Conto.md";

/** One of each element, then a line with `_underline_` and `*italic*`; the cursor is put on the first line by the spec. */
const ELEMENTS_TEXT = [
  "Title: Elementos",
  "",
  "INT. COZINHA - DIA",
  "",
  "Mara abre a janela e _respira_ fundo, com *medo*.",
  "",
  "MARA",
  "(baixo)",
  "Tem alguém aí?",
  "",
  "> CORTA PARA:",
  "",
  "# Primeiro ato",
  "",
  "= a sinopse da cena",
  "",
  "> FIM <",
  "",
  "---",
  "",
  "Última linha.",
  "",
].join("\n");

/** MARIA speaks three times and MARCOS twice; two locations; a time already in use. */
export const CAST_TEXT = [
  "INT. COZINHA - DIA",
  "",
  "Duas pessoas à mesa.",
  "",
  "MARIA",
  "Quem chegou?",
  "",
  "MARCOS",
  "Ninguém.",
  "",
  "MARIA",
  "Então fecha a porta.",
  "",
  "EXT. PRAIA - NOITE",
  "",
  "A maré sobe.",
  "",
  "MARCOS",
  "Está frio.",
  "",
  "MARIA",
  "Está.",
  "",
  "",
].join("\n");

/** About 120 pages (58 lines a page): scenes of speeches, so every element kind is in it. */
export function longScript(pages = 120): string {
  const names = ["MARA", "TOMÉ", "INÊS", "JOÃO"];
  const lines: string[] = ["Title: O roteiro longo", ""];
  let scene = 0;
  while (lines.length < pages * 58) {
    scene++;
    lines.push(`${scene % 2 ? "INT." : "EXT."} LUGAR ${scene} - ${scene % 3 ? "DIA" : "NOITE"}`, "");
    lines.push(`A luz muda devagar no lugar ${scene}. Alguém atravessa o quadro sem pressa e deixa a porta aberta atrás de si.`, "");
    for (let k = 0; k < 6; k++) {
      lines.push(names[(scene + k) % names.length]);
      if (k % 2) lines.push("(baixo)");
      lines.push(`Esta é a fala ${k + 1} da cena ${scene}, comprida o bastante para passar de uma linha na coluna do diálogo.`, "");
    }
    lines.push("> CORTA PARA:", "");
  }
  return lines.join("\n");
}

/** The vault for the screenplay editor checks: scripts in Roteiros/ (the form by folder), a prose conto in Contos/. */
export function screenplayEditorVault(): VaultSpec {
  return {
    language: "pt-BR",
    data: { setupOffered: true },
    files: {
      [ELEMENTS]: ELEMENTS_TEXT,
      [CAST]: CAST_TEXT,
      [HUGE]: longScript(),
      [CONTO]: "---\nstatus: rascunho\n---\n\nA ponte caiu antes do almoço. *Ela* viu, _e calou_.\n\n> uma citação\n\n# Um título\n",
    },
  };
}
