// Language choice for the revision lens (0.5 plan Q8). Pure: no obsidian imports.

import type { StemLang } from "../core/stem";
import type { LensLang } from "./types";

/**
 * The lens language. An explicit setting wins; "auto" maps any pt* locale to pt-BR and any
 * en* locale to en. Any other locale (or none) gives null: the language rules are off.
 */
export function lensLang(setting: "auto" | "pt-BR" | "en", obsidianLang: string): LensLang | null {
  if (setting === "pt-BR" || setting === "en") return setting;
  const code = (obsidianLang ?? "").trim().toLowerCase().split(/[-_]/)[0];
  if (code === "pt") return "pt-BR";
  if (code === "en") return "en";
  return null;
}

export function stemLang(l: LensLang): StemLang {
  return l === "pt-BR" ? "pt" : "en";
}
