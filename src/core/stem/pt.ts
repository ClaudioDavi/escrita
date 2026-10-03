// Portuguese stemmer (0.5 plan Q1, Q2, Q4, Q6). Written by hand from the shape of the
// published RSLP algorithm (Orengo & Huyck 2001): ordered suffix steps, each with a
// minimum stem and an exceptions list. The noun-suffix step (-mento, -ção, -dade) is
// left out on purpose (casa / casamento, mente / mentira). No library, no copied lists.
//
// "word" profile: clitic split, adverb, plural, feminine, augmentative / diminutive,
// verb suffix, final vowel, accents. "name" profile: clitic split, plural, diminutive and
// augmentative only; no feminine step and no vowel or accent removal, so Mariano and
// Mariana, or Maria and Mário, stay apart.

import type { StemProfile } from "./index";

const CLITICS = new Set(["me", "te", "se", "lhe", "lhes", "nos", "vos", "o", "a", "os", "as", "lo", "la", "los", "las", "no", "na"]);

const LETTER = /\p{L}/u;
const VOWEL_CHARS = "aeiouáéíóúâêôãõàü";

function len(s: string): number {
  return [...s].length;
}

function isVowel(c: string | undefined): boolean {
  return c !== undefined && VOWEL_CHARS.includes(c);
}

/** Strips one known clitic after the last hyphen (Q6): olhou-me → olhou + me. */
export function splitClitic(normalized: string): { base: string; clitic: string | null } {
  const at = normalized.lastIndexOf("-");
  if (at <= 0) return { base: normalized, clitic: null };
  const base = normalized.slice(0, at);
  const clitic = normalized.slice(at + 1);
  if (!CLITICS.has(clitic) || !LETTER.test(base)) return { base: normalized, clitic: null };
  return { base, clitic };
}

/** Words that look like they carry a suffix and do not. Checked before every suffix step. */
const NOT_INFLECTED = new Set([
  // -inho / -inha (the mandatory list, then more of the same kind)
  "caminho", "caminha", "vizinho", "vizinha", "linha", "cozinha", "rainha", "farinha", "marinho", "marinha",
  "pinho", "vinho", "ninho", "espinho", "espinha", "carinho", "padrinho", "madrinha", "focinho", "moinho",
  "sardinha", "bainha", "galinha", "campainha", "andorinha", "adivinho", "mesquinho", "sozinho", "sozinha",
  "minha", "tinha", "vinha", "cozinho", "daninho", "daninha", "toalhinha", "anzinho", "sobrinho", "sobrinha",
  "bolinho", "pastinha", "mantinha", "caminhos", "caminhas",
  // -ão (the mandatory list, then more)
  "mão", "pão", "chão", "irmão", "coração", "não", "então", "cão", "grão", "são", "cidadão", "pensão", "camarão",
  "sabão", "razão", "opinião", "questão", "paixão", "verão", "campeão", "capitão", "tabelião", "alemão",
  "cristão", "vulcão", "órgão", "órfão", "bênção", "sertão", "portão", "caixão", "colchão", "feijão",
  "balcão", "salão", "violão", "milhão", "refrão", "trovão", "furacão", "ladrão", "gavião", "pavão",
  "lição", "avião", "limão", "balão", "botão", "leão", "patrão", "oração", "ação", "nação", "região",
  "união", "prisão", "visão", "versão", "tensão", "atenção", "intenção", "direção", "estação", "porção",
  // -ona
  "dona", "zona", "poltrona", "persona", "corona", "maratona", "carona", "madona", "lona", "mona", "cona",
  "matrona", "colona", "amazona", "sintona", "anfitriona",
  // -ito / -ita
  "bonito", "bonita", "muito", "muita", "dito", "dita", "escrito", "escrita", "aflito", "aflita", "infinito",
  "finito", "mosquito", "esquisito", "esquisita", "favorito", "favorita", "perito", "conflito", "delito",
  "direito", "direita", "espírito", "circuito", "requisito", "benedito", "apetite", "visita", "palmito",
  "maldito", "maldita", "proibido", "cabrito", "licito", "exito", "êxito", "crédito", "débito", "hábito",
  "oposito", "mérito", "limite", "habitat", "meritíssima", "meritíssimo", "bendito", "benditos", "benedita",
  // -mente (nouns and adjectives that are not adverbs; mente, semente, demente fall out by length)
  "clemente", "veemente", "vemente", "sementes", "elemento", "complemente", "docemente",
  // -ando (not gerunds)
  "comando", "brando", "grando", "fernando", "orlando", "ferdinando", "armando", "ando", "quando", "mando",
  "bando", "cando", "nando", "rando", "lando", "sando", "tando",
  // -ia (nouns)
  "dia", "tia", "via", "mania", "maria", "poesia", "alegria", "energia", "magia", "história", "família",
  "memória", "glória", "vitória", "teoria", "galeria", "ideia", "fantasia", "melodia", "harmonia", "geografia",
  "biologia", "filosofia", "sabedoria", "covardia", "cortesia", "pedagogia", "anarquia", "monarquia",
  "burguesia", "ironia", "euforia", "agonia",
  // -eu / -ei (nouns)
  "judeu", "museu", "europeu", "ateu", "hebreu", "plebeu", "troféu", "apogeu", "mausoléu", "chapéu", "véu",
  "céu", "chapéus", "réu", "rei", "lei", "grei",
  // -ava
  "escrava", "brava", "lava", "cava", "fava", "trava", "prava",
]);

/** Words whose last vowel is part of the key: the two genders (or noun and verb) mean different things. */
const KEEP_VOWEL = new Set([
  "bola", "bolo", "mala", "porto", "porta", "caminho", "vinho", "vinha", "tema", "leve", "lava", "lavra",
  "casa", "caso", "mente", "livre", "ponta", "ponte", "mato", "sede", "seda", "sino", "sina", "trema",
  "moda", "modo", "bebê", "copa", "copo", "banca", "cerca", "cerco", "carga", "cargo", "lomba", "lombo",
  "forma", "forno", "pata", "peça", "peço", "cota", "coto", "rota", "roto", "nota", "noto", "vela", "velo",
]);

/** Words ending in z whose -inho / -inha diminutive is read from the z itself (luz + inha, not lu + zinha). */
const Z_FINAL = new Set([
  "luz", "nariz", "juiz", "paz", "voz", "vez", "cruz", "raiz", "feliz", "rapaz", "capaz", "giz", "atriz",
  "perdiz", "cicatriz", "noz", "arroz", "luiz", "diniz", "beatriz", "cruz", "xadrez", "rapariz", "lapiz",
]);

/** Roots that two verbs share: sentar and sentir. The -ir family keeps a mark. */
const IR_ROOTS = new Set(["sent"]);

const NOT_ADVERB = new Set(["clemente", "veemente", "vemente", "docemente"]);

/** -ões, -ães, -ãos, -ais, -éis ... → the singular. Returns the word unchanged when it is not a plural. */
const PLURAL_AIS_KEEP = new Set(["pais", "mais", "cais", "tais", "jamais", "demais", "gás", "ais"]);
const PLURAL_EIS_KEEP = new Set(["reis", "leis", "seis", "deis", "veis", "meis", "eis", "teis"]);

function pluralWord(w: string): string {
  const n = len(w);
  if (n < 3) return w;
  if (w.endsWith("ões")) return w.slice(0, -3) + "ão";
  if (w === "mães") return "mãe";
  if (w.endsWith("ães")) return w.slice(0, -3) + "ão";
  if (w.endsWith("ãos")) return w.slice(0, -1);
  if (w.endsWith("ais")) return PLURAL_AIS_KEEP.has(w) ? w.slice(0, -1) : w.slice(0, -3) + "al";
  if (w.endsWith("éis")) return w.slice(0, -3) + "el";
  if (w.endsWith("eis")) return PLURAL_EIS_KEEP.has(w) ? w.slice(0, -1) : w.slice(0, -3) + "il";
  if (w.endsWith("óis")) return w.slice(0, -3) + "ol";
  if (w.endsWith("ns") && n >= 4) return w.slice(0, -2) + "m";
  if (/[rz]es$/.test(w) && n - 2 >= 3) return w.slice(0, -2);
  if (/(?:amos|emos|imos)$/.test(w)) return w; // a verb form, not a plural
  if (w.endsWith("s")) {
    if (/(?:ss|us|is|ês|ís|ús|ás)$/.test(w) && !PLURAL_AIS_KEEP.has(w) && !PLURAL_EIS_KEEP.has(w)) return w;
    if (PLURAL_AIS_KEEP.has(w) || PLURAL_EIS_KEEP.has(w) || n - 1 >= 2) return w.slice(0, -1);
  }
  return w;
}

/** Plural for the "name" profile: a name ending in -es or -s is cut only where it is surely a plural. */
function pluralName(w: string): string {
  const n = len(w);
  if (n < 3) return w;
  if (w.endsWith("ões")) return w.slice(0, -3) + "ão";
  if (w.endsWith("ães")) return w.slice(0, -3) + "ão";
  if (w.endsWith("ãos")) return w.slice(0, -1);
  if (w.endsWith("ais") && !PLURAL_AIS_KEEP.has(w)) return w.slice(0, -3) + "al";
  if (w.endsWith("éis")) return w.slice(0, -3) + "el";
  if (w.endsWith("ns") && n >= 4) return w.slice(0, -2) + "m";
  if (/[rz]es$/.test(w) && n - 2 >= 3) return w.slice(0, -2);
  if (w.endsWith("s") && n - 1 >= 3) {
    if (/(?:ss|us|is|ês|ís|ús|ás|ois|eis|ais)$/.test(w)) return w;
    return w.slice(0, -1);
  }
  return w;
}

const FEMININE_ORA_KEEP = new Set(["agora", "outrora", "aurora", "demora", "flora", "hora", "fora", "mora", "senhora"]);
const FEMININE_ESA_KEEP = new Set(["empresa", "surpresa", "defesa", "despesa", "represa", "devesa", "framboesa", "obesa", "teresa", "mesa", "pesa", "presa", "tesa", "reza"]);
const FEMININE_A_KEEP = new Set(["manhã", "amanhã", "maçã", "irmã", "lã", "rã", "fã", "vã", "sã", "romã"]);

function feminine(w: string): string {
  const n = len(w);
  if (w.endsWith("ora") && !FEMININE_ORA_KEEP.has(w) && n - 1 >= 4) return w.slice(0, -1);
  if (w === "senhora") return "senhor";
  if (w.endsWith("esa") && !FEMININE_ESA_KEEP.has(w) && n - 3 >= 4) return w.slice(0, -3) + "ês";
  if (w.endsWith("ã") && !FEMININE_A_KEEP.has(w) && n >= 4) return w.slice(0, -1) + "ão";
  if (w === "irmã") return "irmão";
  return w;
}

function endsConsonant(s: string): boolean {
  const c = [...s].pop();
  return c !== undefined && LETTER.test(c) && !isVowel(c);
}

/**
 * Augmentatives and diminutives, one per word. Diminutives restore the spelling:
 * -quinho → -co, -guinho → -go, -inho / -inha after a consonant → the base plus its vowel,
 * -zinho / -zinha after a vowel, nasal, l or r → the base as it stands.
 */
function augDim(w: string): string {
  if (NOT_INFLECTED.has(w)) return w;
  const n = len(w);
  let m: RegExpExecArray | null;
  if ((m = /^(.+)inh([oa])$/u.exec(w)) && Z_FINAL.has(m[1]!)) return m[1]! + m[2]!;
  if ((m = /^(.+)z(?:inh|it)([oa])$/u.exec(w)) && len(m[1]!) >= 2) return m[1]!;
  if ((m = /^(.+)quinh([oa])$/u.exec(w)) && len(m[1]!) >= 2) return m[1]! + (m[2] === "o" ? "co" : "ca");
  if ((m = /^(.+)guinh([oa])$/u.exec(w)) && len(m[1]!) >= 2) return m[1]! + (m[2] === "o" ? "go" : "ga");
  if ((m = /^(.+)inh([oa])$/u.exec(w)) && len(m[1]!) >= 3 && endsConsonant(m[1]!)) return m[1]! + m[2]!;
  if ((m = /^(.+)it([oa])$/u.exec(w)) && len(m[1]!) >= 4 && endsConsonant(m[1]!)) return m[1]! + m[2]!;
  if (w.endsWith("ão") && !/(?:ç|s)ão$/.test(w) && n - 2 >= 4) return w.slice(0, -2);
  if (w.endsWith("ona") && n - 3 >= 4) return w.slice(0, -3);
  return w;
}

/** Diminutives for the "name" profile: Mariazinha → Maria, Luizinho → Luiz, Pedrinho → Pedro. */
function augDimName(w: string): string {
  if (NOT_INFLECTED.has(w)) return w;
  let m: RegExpExecArray | null;
  if ((m = /^(.+)inh[oa]$/u.exec(w)) && Z_FINAL.has(m[1]!)) return m[1]!;
  if ((m = /^(.+)z(?:inh|it)[oa]$/u.exec(w)) && len(m[1]!) >= 2) return m[1]!;
  if ((m = /^(.+)z(?:ão|ona)$/u.exec(w)) && len(m[1]!) >= 2) return m[1]!;
  if ((m = /^(.+)inh([oa])$/u.exec(w)) && len(m[1]!) >= 2 && endsConsonant(m[1]!)) {
    return m[1]!.endsWith("z") ? m[1]! : m[1]! + m[2]!;
  }
  return w;
}

/** Regular verb endings, longest first. Each leaves a stem of at least 3 characters. */
const VERB_ENDINGS = [
  "aríamos", "eríamos", "iríamos", "ássemos", "êssemos", "íssemos", "aremos", "eremos", "iremos", "ávamos",
  "ariam", "eriam", "iriam", "avam", "assem", "essem", "issem", "aram", "eram", "iram", "arem", "erem", "irem",
  "aria", "eria", "iria", "asse", "esse", "isse", "ando", "endo", "indo", "arão", "erão", "irão",
  "amos", "emos", "imos", "ava", "ar", "er", "ir", "ia", "ou", "eu", "iu", "ei",
].sort((a, b) => b.length - a.length);

function verbStep(w: string): string | null {
  if (NOT_INFLECTED.has(w)) return null;
  for (const e of VERB_ENDINGS) {
    if (w.endsWith(e) && len(w) - len(e) >= 3) {
      const root = w.slice(0, w.length - e.length);
      return IR_ROOTS.has(root) && e.startsWith("i") ? root + "i" : root;
    }
  }
  return null;
}

function removeVowel(w: string): string {
  if (KEEP_VOWEL.has(w)) return w;
  if (/[aeoáéóêô]$/.test(w) && len(w) - 1 >= 3) return w.slice(0, -1);
  return w;
}

function removeAccents(w: string): string {
  return w.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

function adverb(w: string): string {
  if (w.endsWith("mente") && len(w) - 5 >= 3 && !NOT_ADVERB.has(w) && !NOT_INFLECTED.has(w)) return w.slice(0, -5);
  return w;
}

function stemWordProfile(base: string): string {
  let s = adverb(base);
  s = pluralWord(s);
  s = feminine(s);
  s = augDim(s);
  const verb = verbStep(s);
  if (verb !== null) s = verb;
  else s = removeVowel(s);
  return removeAccents(s);
}

/** Input is already normalized (NFC, lowercase). */
export function stemPt(w: string, profile: StemProfile): string {
  if (!LETTER.test(w)) return w;
  const { base } = splitClitic(w.normalize("NFC"));
  if (!LETTER.test(base)) return base;
  if (profile === "name") return augDimName(pluralName(base));
  return stemWordProfile(base);
}
