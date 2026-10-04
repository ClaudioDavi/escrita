// Names from the universe into the lens (0.7 plan Q38). Pure: no obsidian import.

import { capitalizedTerms } from "../core/names";
import type { TermTable } from "../core/names";

/** The word lists note's names first, then the entries' capitalized terms, each once. */
export function mergeNames(listNames: readonly string[], terms: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const n of [...listNames, ...terms]) {
		if (seen.has(n)) continue;
		seen.add(n);
		out.push(n);
	}
	return out;
}

/** `lists.names` for a note: the list's names plus the capitalized terms of its scope. */
export function namesFor(listNames: readonly string[], table: TermTable): string[] {
	return mergeNames(listNames, capitalizedTerms(table));
}
