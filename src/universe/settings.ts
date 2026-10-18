// The universe's settings: types, English defaults and normalization (no Obsidian
// imports). EscritaSettings extends UniverseSettings; the author's own words
// (`Universo`, `personagem`, `conto`…) live in the vault's data.json, never here.

export type UniverseMode = "off" | "perBook" | "universe";

// the entry kinds moved to core in 1.1.1; re-exported for the universe's callers
import { ENTRY_KINDS, type EntryKind, type EntryTypeSetting } from "../core/entry-kinds";
export { ENTRY_KINDS, type EntryKind, type EntryTypeSetting };

// the form rule moved to core in 1.1 (PLAN-1.1 Q1) and its settings in 1.1.1; re-exported for the universe's callers
import { FORM_KINDS, type FormKind } from "../core/form";
import { normalizeNotePath } from "../core/paths";
import { UNIVERSE_KEYS, normalizeKeys, schemaDefaults } from "../core/settings-schema";
import type { EscritaSettings } from "../settings";
export { normalizeNotePath };
export { FORM_KINDS, type FormKind };

export interface UniverseSettings {
  universeMode: UniverseMode;
  /** the universe note (path, `.md` optional); its entries live in the folder beside it with the same basename */
  universeNote: string;
  /** newline-separated folders whose notes join the universe without a property */
  defaultUniverseFolders: string;
  /** the word after the thread keyword that marks a closed thread (`%% thread closed: … %%`) */
  threadClosedWord: string;
  /** property on a work or entry linking its universe note */
  universeProperty: string;
  /** property holding an entry's type */
  typeProperty: string;
  entryTypes: Record<EntryKind, EntryTypeSetting>;
  /** per-entry property: `true` makes the name match only with its own capitalization */
  caseSensitiveProperty: string;
  /** per-entry property: phrases where the name must not match ("rosa dos ventos") */
  ignoreProperty: string;
  /** per-entry property: `false` stops a character's first name from matching on its own */
  firstNameProperty: string;
  /** newline-separated extra titles skipped before a first name, beyond the built-in tables (core/name-titles) */
  nameTitles: string;
  /** underline recognized names in the editor (off by default) */
  underlineNames: boolean;
}

/** Fresh copies each call, so live settings never share objects with the defaults. */
export function defaultUniverseSettings(): UniverseSettings {
  return pickUniverse(schemaDefaults());
}

function pickUniverse(s: Partial<EscritaSettings>): UniverseSettings {
  const out: Record<string, unknown> = {};
  for (const k of UNIVERSE_KEYS) out[k] = (s as Record<string, unknown>)[k];
  return out as unknown as UniverseSettings;
}

/**
 * Settings as saved (any shape: old data has none of these fields) → complete
 * universe settings, each key cleaned by its row of the settings table. A missing or
 * wrong-typed value takes its default (or `base`'s, the install's set); a blank name or
 * folder does too. Unknown mode → off.
 */
export function normalizeUniverse(raw: unknown, base?: UniverseSettings): UniverseSettings {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = pickUniverse(src);
  normalizeKeys(out, base ?? defaultUniverseSettings(), UNIVERSE_KEYS);
  return out;
}
