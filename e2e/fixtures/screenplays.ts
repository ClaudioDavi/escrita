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
