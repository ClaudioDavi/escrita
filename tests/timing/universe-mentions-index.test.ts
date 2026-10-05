import { describe, expect, it } from "vitest";
import type { NameSource } from "../../src/core/names";
import { ManualTimers } from "../support/memory-vault";
import { setup, src } from "../support/mentions-setup";

class CountingTimers extends ManualTimers {
  yields = 0;
  override now(): number { return performance.now(); }
  override yieldNow(): Promise<void> { this.yields++; return super.yieldNow(); }
}

// CI ceilings from G0h. Desktop: segment + readerMask + findNames cost 1.9-2.2 ms per 1,000
// words with 300 entries (docs/PLAN-0.7.md, G0h). The phone figure is still open, so these
// are derived from the desktop figure alone. Model: 2.2 ms per 1,000 words x the vault's
// words; ceiling = model x 5, the margin names.test.ts uses (20 ms budget, 100 ms ceiling) to
// catch quadratic code without failing on a loaded CI runner.
const MS_PER_1000_WORDS = 2.2;
const MARGIN = 5;
const WORDS_PER_NOTE = 2000;

function bigVault(notes: number) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const first = ["Maria", "João", "Zélia", "Luísa", "Sebastião", "Conceição", "Ângela", "Inácio", "Têmis", "Joaquim"];
  const last = ["Silva", "Antunes", "Magalhães", "Albuquerque", "Pôrto", "Guimarães", "Vasconcelos", "Nóbrega", "Cavalcanti", "Rêgo"];
  const filler = "o a de que e do da em um para com não uma os no se na por mais as dos como mas ao ele das seu sua ou quando muito casa tempo caminho janela chuva silêncio porta mão noite olhar vento rua cidade manhã lembrança voz mar luz".split(" ");
  const sources: NameSource[] = [];
  for (let i = 0; i < 300; i++) {
    sources.push(src(`Universo/${i}.md`, `${first[i % 10]} ${last[(i / 10 | 0) % 10]} ${String.fromCharCode(65 + (i / 100 | 0))}`, [`${first[(i + 3) % 10]} ${last[(i / 7 | 0) % 10]}inho`]));
  }
  const forms = sources.flatMap((x) => [x.name.replace(/ [A-C]$/, ""), ...x.aliases]);
  const variants: string[] = [];
  for (let v = 0; v < 20; v++) {
    const words: string[] = [];
    for (let w = 0; w < WORDS_PER_NOTE; w++) words.push(rnd() < 0.02 ? forms[Math.floor(rnd() * forms.length)]! : filler[Math.floor(rnd() * filler.length)]!);
    const paras: string[] = [];
    for (let i = 0; i < words.length; i += 40) paras.push(words.slice(i, i + 40).join(" ") + ".");
    variants.push(paras.join("\n\n"));
  }
  const files: Record<string, string> = {};
  for (let n = 0; n < notes; n++) files[`Contos/n${n}.md`] = variants[n % variants.length]!;
  return { files, sources };
}

describe("MentionsIndex performance (CI ceilings from G0h)", () => {
  for (const notes of [500, 5000]) {
    it(`${notes} notes of ${WORDS_PER_NOTE} words, 300 entries: under the ceiling, yielding between batches`, async () => {
      const { files, sources } = bigVault(notes);
      const timers = new CountingTimers();
      const s = setup(files, sources, { timers });
      const t0 = performance.now();
      s.mentions.start();
      s.mentions.demand();
      while (!s.mentions.isReady()) await new Promise((r) => setTimeout(r, 5));
      const took = performance.now() - t0;
      const ceiling = (notes * WORDS_PER_NOTE / 1000) * MS_PER_1000_WORDS * MARGIN;
      expect(took).toBeLessThan(ceiling);
      expect(timers.yields).toBeGreaterThanOrEqual(Math.max(1, Math.floor(took / 100)));
      expect(s.mentions.get("Contos/n0.md")?.occurrences.length).toBeGreaterThan(10);
    }, 300_000);
  }
});
