// G0h: cost of segment + readerMask + findNames per 1,000 words, 300 entries.
// Run: npx vitest bench --run tests/names.bench.ts (not part of `npm test`: the
// test projects only include *.test.ts).
import { bench, describe } from "vitest";
import { segment } from "../src/core/markdown";
import { readerMask } from "../src/core/wordcount";
import { compileTerms, findNames, type NameSource } from "../src/core/names";

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

const FIRST = ["Maria", "João", "Zélia", "Luísa", "Sebastião", "Conceição", "Ângela", "Inácio", "Têmis", "Joaquim", "Benedita", "Cândido", "Eulália", "Fábio", "Gonçalo", "Heloísa", "Ísis", "Jacira", "Lúcio", "Mônica"];
const LAST = ["Silva", "Antunes", "Magalhães", "Albuquerque", "Conceição", "Pôrto", "Guimarães", "Vasconcelos", "Nóbrega", "Cavalcanti", "Rêgo", "Teixeira", "Araújo", "Pimentel", "Câmara"];
const TITLES = ["Dona", "Seu", "Dr.", "Padre", ""];
const WORDS = "o a de que e do da em um para com não uma os no se na por mais as dos como mas ao ele das à seu sua ou quando muito nos já eu também só pelo pela até isso ela entre depois sem mesmo aos seu quem nas me esse eles você essa num nem suas meu às minha numa pelos elas qual nós lhe deles essas esses pelas este dele tu te vocês vos lhes meus minhas teu tua teus tuas nosso nossa nossos nossas dela delas esta estes estas aquele aquela aqueles aquelas isto aquilo casa tempo caminho janela chuva silêncio porta mão noite olhar vento rua cidade manhã lembrança voz mar luz".split(" ");

const sources: NameSource[] = [];
for (let i = 0; i < 300; i++) {
  const nm = `${pick(TITLES)} ${pick(FIRST)} ${pick(LAST)} ${i}`.trim();
  const aliases: string[] = [];
  for (let k = Math.floor(rnd() * 3) + 1; k > 0; k--) aliases.push(`${pick(FIRST)} ${pick(LAST)}${k > 1 ? "inho" : ""}`);
  sources.push({ id: `Universe/${i}.md`, name: nm, aliases, person: i % 4 !== 0, firstName: true, caseSensitive: i % 25 === 0, ignore: [] });
}
const table = compileTerms(sources, { lang: "pt", extraTitles: [] });

// 2,000 words, about 2% name hits, paragraphs with the odd markup.
const nameForms = sources.flatMap((s) => [s.name.replace(/ \d+$/, ""), ...s.aliases]);
const out: string[] = [];
let para: string[] = [];
for (let w = 0; w < 2000; w++) {
  para.push(rnd() < 0.02 ? pick(nameForms) : pick(WORDS));
  if (para.length >= 40) { out.push(para.join(" ") + "."); para = []; }
}
if (para.length) out.push(para.join(" ") + ".");
const text = "---\ntitle: bench\n---\n\n" + out.map((p, i) => (i % 5 === 4 ? `*${p}*` : p)).join("\n\n") + "\n";

const run = () => findNames(readerMask(segment(text)), table);
const WORDS_IN_TEXT = 2000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
// The figure to record: median of 20 runs after 5 warm-ups, scaled to 1,000 words.
for (let i = 0; i < 5; i++) run();
const times: number[] = [];
let hitCount = 0;
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  hitCount = run().length;
  times.push(performance.now() - t0);
}
// eslint-disable-next-line no-console
console.log(
  `G0h desktop: ${table.terms.length} terms, ${WORDS_IN_TEXT} words, ${hitCount} hits (${((hitCount / WORDS_IN_TEXT) * 100).toFixed(1)}%); ` +
    `median ${median(times).toFixed(2)} ms per run = ${((median(times) / WORDS_IN_TEXT) * 1000).toFixed(2)} ms per 1,000 words (min ${Math.min(...times).toFixed(2)}, max ${Math.max(...times).toFixed(2)})`,
);

describe("names: segment + readerMask + findNames", () => {
  bench("2,000 words, 300 entries", () => { run(); }, { iterations: 20, warmupIterations: 5, time: 0, warmupTime: 0 });
});
