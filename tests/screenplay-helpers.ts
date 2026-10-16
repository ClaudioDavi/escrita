// Hand-made scripts for the pagination and PDF tests (the parser is tested in fountain.test.ts).
import type { Script, ScriptElement, ScriptRun } from "../src/core/fountain";

let line = 0;
const runs = (t: string | ScriptRun[]): ScriptRun[] => (typeof t === "string" ? [{ text: t }] : t);

export const scene = (t: string, number?: string): ScriptElement => ({ type: "scene", line: line++, runs: runs(t), ...(number ? { number } : {}) });
export const action = (t: string | ScriptRun[], extra: { centered?: boolean } = {}): ScriptElement => ({ type: "action", line: line++, runs: runs(t), ...extra });
export const cue = (name: string, extension?: string, dual?: boolean): ScriptElement => ({
  type: "character", line: line++, runs: runs(name + (extension ? ` (${extension})` : "")), name, ...(extension ? { extension } : {}), ...(dual ? { dual: true } : {}),
});
export const paren = (t: string): ScriptElement => ({ type: "parenthetical", line: line++, runs: runs(t) });
export const dialogue = (t: string | ScriptRun[]): ScriptElement => ({ type: "dialogue", line: line++, runs: runs(t) });
export const transition = (t: string): ScriptElement => ({ type: "transition", line: line++, runs: runs(t) });
export const pageBreak = (): ScriptElement => ({ type: "pageBreak", line: line++, runs: [] });
export const section = (t: string): ScriptElement => ({ type: "section", line: line++, runs: runs(t), depth: 1 });
export const synopsis = (t: string): ScriptElement => ({ type: "synopsis", line: line++, runs: runs(t) });

export const script = (...elements: ScriptElement[]): Script => ({ titleBlock: null, elements });

/** An action paragraph that wraps to exactly `n` lines on Letter (60 columns): n lines of 59 letters. */
export const actionOf = (n: number, ch = "a"): ScriptElement => action(Array.from({ length: n }, () => ch.repeat(59)).join(" "));
