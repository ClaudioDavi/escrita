import { dateText, hasDate, parseDeadline } from "../core/measure";

/**
 * Publishing writes the date only when the user picked one, or when the note
 * has no date. An existing value is kept as it is, even one that isn't
 * YYYY-MM-DD (e.g. "2024-5-3" or "3 de maio de 2024").
 */
export function shouldWriteDate(raw: unknown, dateChanged: boolean): boolean {
  return dateChanged || !hasDate(raw);
}

/** What the modal's date field starts with, and the note's own value when it can't be shown there. */
export function initialDate(raw: unknown, today: string): { value: string; unparsed?: string } {
  const parsed = parseDeadline(raw);
  if (parsed) return { value: parsed };
  if (!hasDate(raw)) return { value: today };
  return { value: "", unparsed: dateText(raw) };
}
