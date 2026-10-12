import { parseDay } from "../ui/day";
import { fmtShortDay } from "../i18n";

/** YYYY-MM-DD → a short localized date ("Mar 1, 2027" / "1 de mar. de 2027"). */
export function fmtDay(day: string): string {
  const m = parseDay(day);
  return m.isValid() ? m.format("ll") : day;
}

export { fmtShortDay };
