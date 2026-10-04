// Titles that can come before a character's name, by language (0.7 plan Q29).
// Pure data, picked by the writing language like the stop words
// (core/stem/stopwords.ts) and the lens lexicon. A leading title is skipped when a
// first name is derived: "Dona Benta Encerrabodes" gives "Benta". Dots are left out
// (a trailing "." on a title is ignored by the matcher); the `nameTitles` setting
// extends these tables. Titles compare with accents kept (G3): "Irma" is a given name,
// not the title "Irmã".

import type { StemLang } from "./stem";

export const NAME_TITLES: Record<StemLang, readonly string[]> = {
  pt: ["Dona", "Dom", "Seu", "Sr", "Sra", "Srta", "Dr", "Dra", "Padre", "Frei", "Irmã", "Irmão", "Senhor", "Senhora", "Doutor", "Doutora", "Tia", "Tio", "Vó", "Vô", "Coronel", "Capitão", "Professor", "Professora"],
  en: ["Mr", "Mrs", "Ms", "Miss", "Dr", "Sir", "Lady", "Lord", "Aunt", "Uncle"],
};
