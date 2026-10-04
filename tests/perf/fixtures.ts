// Synthetic Portuguese prose, names and vaults for the perf review benches.
import { compileTerms, type NameSource, type TermTable } from "../../src/core/names";

let seed = 12345;
export const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

const FIRST = ["Maria", "João", "Zélia", "Luísa", "Sebastião", "Conceição", "Ângela", "Inácio", "Têmis", "Joaquim", "Benedita", "Cândido", "Eulália", "Fábio", "Gonçalo", "Heloísa", "Ísis", "Jacira", "Lúcio", "Mônica"];
const LAST = ["Silva", "Antunes", "Magalhães", "Albuquerque", "Conceição", "Pôrto", "Guimarães", "Vasconcelos", "Nóbrega", "Cavalcanti", "Rêgo", "Teixeira", "Araújo", "Pimentel", "Câmara"];
const TITLES = ["Dona", "Seu", "Dr.", "Padre", ""];
export const WORDS = "o a de que e do da em um para com não uma os no se na por mais as dos como mas ao ele das à seu sua ou quando muito nos já eu também só pelo pela até isso ela entre depois sem mesmo aos quem nas me esse eles você essa num nem suas meu às minha numa pelos elas qual nós lhe deles essas esses pelas este dele tu te vocês casa tempo caminho janela chuva silêncio porta mão noite olhar vento rua cidade manhã lembrança voz mar luz rapidamente lentamente andando correndo falando pensando realmente simplesmente estava ficou disse olhou voltou sabia queria".split(" ");

export function makeSources(n = 300): NameSource[] {
  const sources: NameSource[] = [];
  for (let i = 0; i < n; i++) {
    const nm = `${pick(TITLES)} ${pick(FIRST)} ${pick(LAST)} ${i}`.trim();
    const aliases: string[] = [];
    for (let k = Math.floor(rnd() * 3) + 1; k > 0; k--) aliases.push(`${pick(FIRST)} ${pick(LAST)}${k > 1 ? "inho" : ""}`);
    sources.push({ id: `Universe/${i}.md`, name: nm, aliases, person: i % 4 !== 0, firstName: true, caseSensitive: i % 25 === 0, ignore: [] });
  }
  return sources;
}
export const sources = makeSources();
export const table: TermTable = compileTerms(sources, { lang: "pt", extraTitles: [] });
const nameForms = sources.flatMap((s) => [s.name.replace(/ \d+$/, ""), ...s.aliases]);

/** A chapter of about `words` words: dialogue (em dash), names, markup, placeholders, beats, threads, scene breaks. */
export function chapter(words: number): string {
  const paras: string[] = [];
  let w = 0;
  let k = 0;
  while (w < words) {
    const len = 20 + Math.floor(rnd() * 60);
    const ws: string[] = [];
    for (let i = 0; i < len; i++) ws.push(rnd() < 0.02 ? pick(nameForms) : pick(WORDS));
    w += len;
    let p = ws.join(" ");
    p = p[0]!.toUpperCase() + p.slice(1) + ".";
    if (rnd() < 0.3) p = `— ${p} — ${pick(WORDS)} ${pick(nameForms)}. — ${pick(WORDS)} ${pick(WORDS)}?`;
    if (rnd() < 0.1) p = p.replace(/ (\S+) /, " *$1* ");
    paras.push(p);
    k++;
    if (k % 25 === 0) paras.push("---");
    if (k % 40 === 0) paras.push("%% beat: algo acontece na cena %%");
    if (k % 60 === 0) paras.push(`${p.slice(0, 40)} %% XXX: conferir data %%`);
    if (k % 70 === 0) paras.push("%% thread: quem deixou a carta? %%");
  }
  return "---\nstatus: rascunho\ntarget: 10000\n---\n\n# Capítulo\n\n" + paras.join("\n\n") + "\n";
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Print a custom reported number (vitest bench only reports throughput). */
export function report(label: string, value: string): void {
  // eslint-disable-next-line no-console
  console.log(`[perf] ${label.padEnd(60)} ${value}`);
}
