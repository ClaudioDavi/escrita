import { parseDeadline } from "../core/piece";

/** Whether a frontmatter date value is there at all (any value but missing, null or blank). */
export function hasDate(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string") return raw.trim() !== "";
  if (Array.isArray(raw)) return raw.length > 0;
  return true;
}

/**
 * Publishing writes the date only when the user picked one, or when the note
 * has no date. An existing value is kept as it is, even one that isn't
 * YYYY-MM-DD (e.g. "2024-5-3" or "3 de maio de 2024").
 */
export function shouldWriteDate(raw: unknown, dateChanged: boolean): boolean {
  return dateChanged || !hasDate(raw);
}

/** A kept date as text for messages: YYYY-MM-DD when it parses, the value as written otherwise. */
export function dateText(raw: unknown): string {
  const parsed = parseDeadline(raw);
  if (parsed) return parsed;
  if (raw instanceof Date) return String(raw);
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  try {
    return JSON.stringify(raw) ?? "";
  } catch {
    return String(raw);
  }
}

/** What the modal's date field starts with, and the note's own value when it can't be shown there. */
export function initialDate(raw: unknown, today: string): { value: string; unparsed?: string } {
  const parsed = parseDeadline(raw);
  if (parsed) return { value: parsed };
  if (!hasDate(raw)) return { value: today };
  return { value: "", unparsed: dateText(raw) };
}
