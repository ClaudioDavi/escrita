// The long book of docs/TEST-0.9.md ("Make the test notes"): 30 chapters of about 3,000 words
// each (about 90,000 words), a prologue (00), a chapter left out of the book (31, `compile:
// false`), a dedication, an epigraph and a cover. A TypeScript port of the Python generator
// there; the random numbers come from a seeded generator, so every run builds the same book.

/** mulberry32: a tiny seeded generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ("casa mar porta vento noite chuva rua janela barco ponte pedra caminho tempo " +
  "mesa carta lume fogo sombra cidade campo rio areia sal voz silêncio mão olhos " +
  "manhã tarde inverno verão cheiro sono memória escada quarto porão cais feira").split(" ");
const VERBS = ("olhou disse esperou voltou abriu fechou contou ouviu guardou levou trouxe " +
  "pensou lembrou subiu desceu chamou").split(" ");

export const CHAPTER_TITLES = ["A chegada", "A carta", "O cais", "A escada", "O porão", "A feira", "A ponte", "O inverno",
  "A janela", "O sal", "A voz", "O quarto", "A sombra", "O campo", "A areia", "O lume",
  "A cidade", "O sono", "A memória", "O rio", "A tarde", "O verão", "A mesa", "O caminho",
  "A pedra", "O fogo", "A rua", "O cheiro", "A manhã", "A travessia"];

export interface LongBookOptions {
  /** the folder that holds the book note and its companions; default `Romances/Teste 0.9` */
  parent?: string;
  /** the book's title; default `Livro Longo` */
  title?: string;
  /** how many numbered chapters (1 to 30); default 30 */
  chapters?: number;
  seed?: number;
}

/** The book's files, vault-relative path -> text. */
export function longBook(o: LongBookOptions = {}): Record<string, string> {
  const parent = o.parent ?? "Romances/Teste 0.9";
  const title = o.title ?? "Livro Longo";
  const count = Math.min(30, o.chapters ?? 30);
  const rand = rng(o.seed ?? 9);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

  const sentence = () => {
    const n = int(8, 18);
    const body = Array.from({ length: n }, (_, i) => pick(i % 3 ? WORDS : VERBS)).join(" ");
    return `Ela ${body}.`;
  };
  const paragraph = () => {
    if (rand() < 0.15) {
      const s = sentence().slice(4);
      return `— ${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    }
    return Array.from({ length: int(4, 7) }, sentence).join(" ");
  };
  const chapter = (n: number) => {
    const scenes = Array.from({ length: 4 }, () => Array.from({ length: 11 }, paragraph).join("\n\n"));
    let extra = "";
    if (n === 2) extra = "%% beat: ela encontra a carta %%\nA carta estava debaixo da porta, molhada.\n\n%% nota só para mim: rever o tom %%\n\n";
    if (n === 3) extra = "No cais, Willian esperava o barco. Ninguém falou com Willian naquela noite.\n\n";
    return `---\nstatus: rascunho\ndate:\n---\n${extra}${scenes.join("\n\n---\n\n")}\n`;
  };

  const files: Record<string, string> = {};
  files[`${parent}/${title}.md`] = `---\ndedication: "[[Dedicatória 0.9]]"\nepigraph: "[[Epígrafe 0.9]]"\ncover: "[[capa-teste.jpg]]"\n---\n`;
  files[`${parent}/Dedicatória 0.9.md`] = "Para quem lê até o fim.\n";
  files[`${parent}/Epígrafe 0.9.md`] = "> O mar não tem caminhos, só travessias.\n";
  const dir = `${parent}/${title}/Capítulos`;
  files[`${dir}/00 Prólogo.md`] = `---\nstatus: rascunho\n---\n${Array.from({ length: 6 }, paragraph).join("\n\n")}\n`;
  for (let i = 1; i <= count; i++) files[`${dir}/${String(i).padStart(2, "0")} ${CHAPTER_TITLES[i - 1]}.md`] = chapter(i);
  files[`${dir}/31 Notas soltas.md`] = "---\nstatus: rascunho\ncompile: false\n---\nNotas que não entram no livro.\n";
  return files;
}

/** The words in a text, split on whitespace (a rough count for the G0d table). */
export function roughWords(files: Record<string, string>): number {
  let n = 0;
  for (const text of Object.values(files)) n += text.split(/\s+/).filter(Boolean).length;
  return n;
}
