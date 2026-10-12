import { moment } from "obsidian";

/**
 * The slice of Obsidian's `moment` that Escrita calls, typed here. Calling `moment(...)`
 * types as `any` where moment's own types resolve without esModuleInterop (the community
 * review bot), so every call goes through this file instead.
 */
export interface Day {
  isValid(): boolean;
  format(pattern?: string): string;
  localeData(): { longDateFormat(key: string): string };
}

type DayFn = (input: string | number, pattern?: string, strict?: boolean) => Day;

const call = moment as unknown as DayFn;

/** A strict YYYY-MM-DD date (check `isValid()`). */
export function parseDay(day: string): Day {
  return call(day, "YYYY-MM-DD", true);
}

/** A moment from a timestamp in milliseconds. */
export function fromTime(ms: number): Day {
  return call(ms);
}
