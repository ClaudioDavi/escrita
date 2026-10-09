// Stop word lists, written by hand. Not copied from Snowball or NLTK
// (Q7, Q31), so no notice is needed. Words the echo rule should never flag:
// articles, pronouns, prepositions, contractions, conjunctions, common forms of
// the everyday verbs, and the said-verbs (repeating "disse" / "said" is normal).
//
// Portuguese entries keep their accents (*está* is not *esta*, Q12); matching is
// NFC and case-folded, never accent-folded.

import type { StemLang } from "./index";

const PT = `
a o as os um uma uns umas
ao aos à às do da dos das dum duma duns dumas no na nos nas num numa nuns numas
pelo pela pelos pelas
de em por para pra pro per com sem sob sobre entre até desde após contra
e ou mas nem que se como porque pois porém contudo todavia entretanto quando enquanto
embora logo assim então
eu tu ele ela nós eles elas você vocês
me te lhe lhes nos si consigo comigo contigo
meu minha meus minhas teu tua seu sua seus suas nosso nossa nossos nossas
este esta estes estas esse essa esses essas aquele aquela
isto isso aquilo desse dessa deste desta neste nesta nesse nessa disto disso
quem qual quais quanto quantos cujo cuja onde
muito muita muitos muitas mais menos tão tanto tanta
todo toda todos todas outro outra outros outras mesmo mesma
algum alguma alguns algumas nenhum nenhuma nada alguém ninguém tudo cada
não sim já ainda também só apenas agora aqui ali lá cá aí
ser sou é somos são era éramos eram fui foi foram seja seria será sendo sido
estar estou está estamos estão estava estavam estive esteve estando estado
ter tenho tem temos têm tinha tinham tive teve tendo tido
haver há havia houve haja
ir vou vai vamos vão ia iam íamos irá iria indo ido
fazer faço faz fazem fazia fez fizeram fazendo feito
dizer digo diz dizem dizia diziam disse disseram dizendo dito
`;

const EN = `
a an the
i me my mine myself you your yours yourself he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves
this that these those who whom whose which what where when why how
of in on at by for with without about against between into through during before
after above below to from up down out off over under again further then once
and but or nor so yet if because as until while although though unless whether
than too very just only also not no yes both either neither each every any some
such own same other another more most less few many much all
here there now still even ever never always
be am is are was were been being
have has had having
do does did doing done
say says said saying
go goes went gone going
will would shall should can could may might must
don't doesn't didn't won't wouldn't can't couldn't shouldn't isn't aren't wasn't weren't
hasn't haven't hadn't mustn't needn't shan't mightn't
i'm i've i'll i'd you're you've you'll you'd he's he'll he'd she's she'll she'd
it's it'll it'd we're we've we'll we'd they're they've they'll they'd
that's there's here's what's who's let's how's where's when's why's
ain't y'all
`;

function build(src: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const w of src.split(/\s+/)) {
    if (w) out.add(w.normalize("NFC").toLowerCase());
  }
  return out;
}

const SETS: Record<StemLang, ReadonlySet<string>> = { pt: build(PT), en: build(EN) };

/** Exposed for tests and for callers that need the size of a list. */
export function stopWordCount(lang: StemLang): number {
  return SETS[lang].size;
}

/**
 * Input should already be normalized (NFC, lowercase, ’ → '), but this
 * re-normalizes (cheap) so a decomposed *não* or *Não* still matches.
 * English contractions are matched whole, before any stemming.
 */
export function isStopWord(normalized: string, lang: StemLang): boolean {
  const set = SETS[lang];
  if (set.has(normalized)) return true;
  return set.has(normalized.normalize("NFC").toLowerCase().replace(/’/g, "'"));
}
