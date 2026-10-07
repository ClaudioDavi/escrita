// What "create entry" writes (no Obsidian imports): the file name and folder, and
// the note's text from the type's template. The properties the entry needs
// (type, universe, aliases) are always written as given; the template's own
// properties are kept unless they are one of those keys.

import { renderTemplate, splitTemplate, templateVars, yamlKey } from "../core/template";
import type { Scope } from "../core/scope";
import type { EntryKind, UniverseSettings } from "./settings";

/** The name as a file basename: characters Obsidian and the file systems refuse are dropped. Empty means unusable. */
export function entryFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
}

/** The folder new entries of `kind` go to in `scope`; null when the scope has none (kind none). */
export function entryFolder(scope: Scope, kind: EntryKind, types: UniverseSettings["entryTypes"]): string | null {
  if (scope.kind === "none") return null;
  const folder = types[kind].folder.replace(/^\/+|\/+$/g, "");
  return [scope.root, folder].filter((p) => p !== "").join("/");
}

export function entryPath(scope: Scope, kind: EntryKind, name: string, types: UniverseSettings["entryTypes"]): string | null {
  const folder = entryFolder(scope, kind, types);
  const file = entryFileName(name);
  if (folder === null || file === "") return null;
  return `${folder}/${file}.md`;
}

/** `"[[Universo]]"` for a universe note path (quoted, as a property value needs). */
export function universeLinkValue(noteName: string, linkText?: string): string {
  return JSON.stringify(`[[${linkText ?? noteName.replace(/\.md$/i, "").split("/").pop()}]]`);
}

export interface NewEntryText {
  name: string;
  kind: EntryKind;
  scope: Scope;
  alias?: string;
  /** the link text that reaches the universe note unambiguously (fileToLinktext); the note's basename when omitted */
  universeLink?: string;
  /** the template note's text, or null for none */
  template: string | null;
  now: Date;
}

/**
 * The new note's text. Universe scope gets the universe property (a link to the
 * scope's note, which is the universe note); a book scope gets none (a book's
 * entries belong to it by folder).
 */
export function entryText(s: UniverseSettings, o: NewEntryText): string {
  const own: { key: string; lines: string[] }[] = [{ key: s.typeProperty, lines: [`${yamlKey(s.typeProperty)}: ${yamlValue(s.entryTypes[o.kind].value)}`] }];
  if (o.scope.kind === "universe" && o.scope.note) {
    own.push({ key: s.universeProperty, lines: [`${yamlKey(s.universeProperty)}: ${universeLinkValue(o.scope.note, o.universeLink)}`] });
  }
  const alias = o.alias?.trim() ?? "";
  if (alias !== "" && alias !== o.name) {
    own.push({ key: "aliases", lines: ["aliases:", `  - ${yamlValue(alias)}`] });
  }
  const { properties, body } = splitTemplate(renderTemplate(o.template ?? "", templateVars(o.name, o.now)));
  const taken = new Set(own.map((p) => p.key.normalize("NFC").toLowerCase()));
  const kept = properties.filter((p) => !taken.has(p.key.normalize("NFC").toLowerCase()));
  const lines = [...own, ...kept].flatMap((p) => p.lines);
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

/** A scalar for YAML: plain when safe, else JSON-quoted. */
export function yamlValue(v: string): string {
  return /^[\p{L}\p{N}][\p{L}\p{N} _.'()-]*$/u.test(v) && !/^(true|false|null|yes|no|on|off|~|\d.*)$/i.test(v) && !/\s$/.test(v)
    ? v
    : JSON.stringify(v);
}

