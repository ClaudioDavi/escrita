// Built-in language data for the revision lens rules (Q9, Q16, Q17, Q18). Pure data:
// no obsidian or CodeMirror imports. These are language tables picked by the language
// setting, not the author's values; the word lists note's `Ignorar` section extends them.
// Entries are normalized at load (NFC, lowercase, trimmed), so the source can be written naturally.

import type { Lexicon, LensLang } from "./types";

const words = (s: string): string[] => s.split(/\s+/).filter(Boolean);

// aumente, comente, lamente, fomente and cimente (Q16) have only 2 letters before -mente,
// so the 3-letter rule already keeps them out; listing them would be dead data.
const PT_ADVERB_EXCEPTIONS = words(`
  clemente veemente dormente
  alimente experimente atormente implemente complemente argumente documente
  cumprimente movimente fundamente fragmente segmente incremente regulamente amamente
  pavimente ornamente suplemente sedimente fermente
`);

const EN_ADVERB_EXCEPTIONS = words(`
  only family reply apply supply imply rely early holy ugly silly lonely lovely
  friendly likely lively july italy assembly butterfly monopoly melancholy anomaly
  lily emily bully belly jelly rally tally sally molly polly billy willy hilly
  curly surly grizzly chilly deadly costly cowardly elderly orderly timely
  homely lowly unlikely jolly folly
`);

const PT_GERUND_EXCEPTIONS = words(`
  quando mundo lindo segundo fundo profundo redondo comando bando brando rotundo
  vagabundo oriundo estupendo horrendo tremendo remendo dividendo adendo
  moribundo furibundo gerundo errabundo nauseabundo pudendo reverendo
  fecundo jucundo infando nefando venerando execrando
  entendo compreendo aprendo pretendo defendo ofendo surpreendo dependo suspendo
  estendo acendo prendo recomendo encomendo mando demando
`);

const PT_IR_FORMS = words(`
  vou vais vai vamos vades vão
  vá vás vades
  ia ias íamos íeis iam
  irei irás irá iremos ireis irão
  iria irias iríamos iríeis iriam
`);

const PT_ESTAR_FORMS = words(`
  estar estou estás está estamos estais estão
  estava estavas estávamos estáveis estavam
  estive estiveste esteve estivemos estivestes estiveram
  estarei estarás estará estaremos estareis estarão
  estaria estarias estaríamos estaríeis estariam
  esteja estejas estejamos estejais estejam
  estivesse estivesses estivéssemos estivésseis estivessem
`);

const EN_STARTED_FORMS = words(`
  begin begins began begun beginning start starts started starting
`);

const norm = (list: readonly string[]): readonly string[] =>
  Array.from(new Set(list.map((w) => w.normalize("NFC").toLowerCase().trim()).filter(Boolean)));

const build = (l: Lexicon): Lexicon => ({
  adverbExceptions: norm(l.adverbExceptions),
  gerundExceptions: norm(l.gerundExceptions),
  irForms: norm(l.irForms),
  estarForms: norm(l.estarForms),
  startedForms: norm(l.startedForms),
});

export const LEXICON: Record<LensLang, Lexicon> = {
  "pt-BR": build({
    adverbExceptions: PT_ADVERB_EXCEPTIONS,
    gerundExceptions: PT_GERUND_EXCEPTIONS,
    irForms: PT_IR_FORMS,
    estarForms: PT_ESTAR_FORMS,
    startedForms: [],
  }),
  en: build({
    adverbExceptions: EN_ADVERB_EXCEPTIONS,
    gerundExceptions: [],
    irForms: [],
    estarForms: [],
    startedForms: EN_STARTED_FORMS,
  }),
};
