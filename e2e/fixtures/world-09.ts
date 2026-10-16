// The test notes of docs/TEST-0.9.md, "Make the test notes", plus the world they need: the
// universe note, one entry (Willian), Textos/Noite.md (`universe: false`) and the folder
// layout of the author's vault (contos in Contos/, books in Romances/, essays in Textos/).
// The book is the long book fixture; `chapters` can make it shorter for specs that don't
// measure it. The cover image is binary: `installCover(app.vaultDir)` writes it after launch.
import fs from "node:fs";
import path from "node:path";
import type { App } from "../lib/app";
import type { VaultSpec } from "./index";
import { longBook } from "./long-book";

/** The sentences the unlinked and names specs count on. Line numbers are 1-based in the panel ("linha 4"). */
export const FAROL = `---
status: rascunho
---
A porta rangeu e Willian não olhou para trás.

Lá fora, o vento. Ninguém esperava que Willian voltasse tão cedo.

O barco de Almeida estava no cais, e o filho de Almeida dormia na proa.

Disseram que Almeida tinha visto Dona Zefa no mercado, e que Dona Zefa ria alto.

A casa de Almeida ficava longe do Rio Pequeno, mas a de Dona Zefa não.

Na véspera do Natal, Almeida trouxe peixe. Até no Natal ela cozinhava para Dona Zefa, como em todo Natal.

O chapéu de Almeida pingava. No Natal anterior, Dona Zefa tinha dito que o Natal era triste, e Dona Zefa nunca mentia. Era a noite de Natal outra vez.

Depois Teodoro disse que ia chover. Depois Teodoro foi embora.

| Quem | Onde |
|---|---|
| o velho Willian | no cais |

Li sobre [o barco do Willian](https://example.org/barco) num jornal antigo.
`;

export const MARE = `---
status: rascunho
---
A maré subiu cedo. A água do Rio Pequeno chegava salgada até a ponte.

Ela esperou o barco de Almeida até a noite.
`;

export const SAL = `---
status: rascunho
---
O sal secava nas pedras, e [[Willian]] contava os sacos.

No fim da tarde, Willian voltou para casa sem dizer nada.
`;

/** A 1x1 JPEG: enough for an EPUB cover (the exporter reads bytes, not pixels). */
const JPEG_1X1 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export interface World09Options {
  /** numbered chapters in Livro Longo (default 30) */
  chapters?: number;
}

export function world09(o: World09Options = {}): VaultSpec {
  const book = "Romances/Teste 0.9";
  const files: Record<string, string> = {
    "Início.md": "Esta nota é sua.\n",
    "Universo.md": "---\ntype: universo\n---\n",
    "Universo/Personagens/Willian.md": "---\ntype: personagem\n---\nUm faroleiro.\n",
    "Contos/Teste 0.9/O farol apagado.md": FAROL,
    "Contos/Teste 0.9/Maré.md": MARE,
    "Contos/Teste 0.9/Sal.md": SAL,
    "Textos/Noite.md": "---\nstatus: rascunho\nuniverse: false\n---\nNoite. Willian saiu e Almeida ficou.\n",
    // a second book, with three chapters, the second with a POV
    "Romances/Teste 0.9/Livro Teste.md": "---\nstatus: rascunho\n---\n",
    "Romances/Teste 0.9/Livro Teste/Capítulos/01 Um.md": "Um.\n",
    "Romances/Teste 0.9/Livro Teste/Capítulos/02 Dois.md": "---\npov: Willian\n---\nDois.\n",
    "Romances/Teste 0.9/Livro Teste/Capítulos/03 Três.md": "Três.\n",
    // a book with an empty chapters folder is made by installCover (an empty folder has no file)
    [`${book}/Livro Vazio.md`]: "---\nstatus: rascunho\n---\n",
    ...longBook({ chapters: o.chapters }),
  };
  return {
    language: "pt-BR",
    files,
    // a fresh install in Portuguese (its pt-BR default set); `configureWorld09` adds the universe
    data: { setupOffered: true },
  };
}

/**
 * The universe settings of the author's vault, set through the plugin the way the settings tab
 * does (a saved `settings` object would replace the pt-BR default set's stages). Call after launch.
 */
export async function configureWorld09(app: App, extra: Record<string, unknown> = {}): Promise<void> {
  await app.setSettings({
    universeMode: "universe",
    universeNote: "Universo.md",
    defaultUniverseFolders: "Contos\nRomances\nTextos",
    ...extra,
  });
}

/** What a vault file cannot be: the cover (binary) and the empty chapters folder. Call once after launch. */
export function installWorld09Extras(vaultDir: string): void {
  const cover = path.join(vaultDir, "Anexos", "capa-teste.jpg");
  fs.mkdirSync(path.dirname(cover), { recursive: true });
  fs.writeFileSync(cover, Buffer.from(JPEG_1X1, "base64"));
  fs.mkdirSync(path.join(vaultDir, "Romances", "Teste 0.9", "Livro Vazio", "Capítulos"), { recursive: true });
}
