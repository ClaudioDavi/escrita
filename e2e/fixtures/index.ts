// Fixture vaults: a map of files, the language Obsidian runs in, and optionally the plugin's
// data.json. `seeded: true` writes `{ setupOffered: true }`, so the first-run notice stays
// away (the settings are still a fresh install's: the Writer preset in the vault's language).
// Specs that do test the setup build the vault unseeded.

export type Language = "en" | "pt-BR";

export interface VaultSpec {
  language: Language;
  /** vault-relative path -> text */
  files: Record<string, string>;
  /** the plugin's data.json, when the vault should have one */
  data?: Record<string, unknown>;
}

export interface FixtureOptions {
  seeded?: boolean;
}

const seed = (o?: FixtureOptions): Pick<VaultSpec, "data"> => (o?.seeded ? { data: { setupOffered: true } } : {});

/** No notes: a fresh install in Portuguese. */
export function emptyPt(o?: FixtureOptions): VaultSpec {
  return { language: "pt-BR", files: { "Bem-vindo.md": "" }, ...seed(o) };
}

/** No notes: a fresh install in English. */
export function emptyEn(o?: FixtureOptions): VaultSpec {
  return { language: "en", files: { "Welcome.md": "" }, ...seed(o) };
}

const conto = (status: string, body: string, extra = "") => `---\nstatus: ${status}\n${extra}---\n\n${body}\n`;

/**
 * The shape of a working vault in Portuguese: contos in Contos/ with the status words, one
 * book (Livros/O farol) with three chapters, a home note with the works block.
 * Nothing in it is set up for Escrita: specs set the folders they need.
 */
export function writer(o?: FixtureOptions): VaultSpec {
  const chapter = (n: number, body: string) => [`Livros/O farol/Capítulos/0${n} ${["Chegada", "A tempestade", "O barco"][n - 1]}.md`, `${body}\n`] as const;
  return {
    language: "pt-BR",
    files: {
      "Início.md": "Esta nota é sua.\n\n```escrita-works\n```\n",
      "Contos/O afogado.md": conto("rascunho", "O mar subiu devagar naquela noite.", "target: 2000\n"),
      "Contos/A casa.md": conto("ideia", "Uma casa vazia."),
      "Contos/Ponte.md": conto("revisão", "A ponte caiu antes do almoço."),
      "Livros/O farol.md": "---\nstatus: rascunho\n---\n\n## Premissa\n\nInês assume um farol sem guarda há trinta anos.\n",
      ...Object.fromEntries([
        chapter(1, "Ela chegou de barco, com duas malas."),
        chapter(2, "%% beat: o vento vira %%\n"),
        chapter(3, "O barco voltou vazio."),
      ]),
      "Textos/Sobre o mar.md": conto("rascunho", "Um ensaio curto."),
    },
    ...seed(o),
  };
}
