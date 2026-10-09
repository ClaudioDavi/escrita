import type { Strings } from "../i18n";

// The setup's layout step (1.0, task 2.3, board 37): anything setup/layout.ts says. Keys under
// `setup.layout.` only; registered in main.ts beside setupStrings.
export const setupLayoutStrings: Strings = {
  en: {
    "setup.layout.panelsFailed": "Some panels could not be opened. You can open them from the command palette.",
  },
  "pt-BR": {
    "setup.layout.panelsFailed": "Alguns painéis não puderam ser abertos. Você pode abri-los pela paleta de comandos.",
  },
};
