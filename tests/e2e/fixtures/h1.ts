// Fixture builders for the specs that replaced TEST-1.0's by-hand pages (kept apart from
// index.ts so that the harness' own fixtures stay as they were).
import { writer, type FixtureOptions, type VaultSpec } from "./index";

/**
 * What a writer's vault has set up besides the notes (set after launch with `app.setSettings`, so
 * the settings are a fresh install's plus these: a hand-made `settings` block in data.json would
 * count as an older install and bring back the English stage words).
 */
export const WORLD_SETTINGS = {
  universeMode: "universe",
  defaultUniverseFolders: "Contos\nLivros",
  trackFolders: "Contos\nLivros\nTextos",
} as const;

/**
 * The writer vault in a shared universe: Universo.md, one entry (Maria, alias Mari) and a
 * name used in two works (Teo) that has no entry yet. Apply `WORLD_SETTINGS` after launch.
 */
export function world(o?: FixtureOptions): VaultSpec {
  const base = writer(o);
  return {
    ...base,
    files: {
      ...base.files,
      "Universo.md": "Este é o universo.\n",
      "Universo/Personagens/Maria.md": '---\ntype: personagem\nuniverse: "[[Universo]]"\naliases:\n  - Mari\n---\n\nMaria é a farol-keeper.\n',
      "Contos/O afogado.md": "---\nstatus: rascunho\ntarget: 2000\n---\n\nMaria olhou o mar. Mari esperou. Teo chegou tarde.\n\n— Teo, venha aqui — disse Maria.\n",
      "Contos/Ponte.md": "---\nstatus: revisão\n---\n\nTeo atravessou a ponte antes do almoço.\n",
      "Livros/O farol/Capítulos/01 Chegada.md": "Ela chegou de barco, com duas malas.\n",
    },
  };
}
