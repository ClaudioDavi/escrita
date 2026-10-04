import { describe, expect, it } from "vitest";
import { EMPTY_TABLE, type TermTable } from "../src/core/names";
import { mergeNames, namesFor } from "../src/lens/names";

function table(...texts: string[]): TermTable {
	return {
		...EMPTY_TABLE,
		terms: texts.map((text, i) => ({
			id: "e" + i, text, words: [text], keys: [text.toLowerCase()],
			profile: {} as never, origin: "name" as const, caseSensitive: false,
		})),
	};
}

describe("lens names", () => {
	it("mergeNames de-duplicates and keeps list names first", () => {
		expect(mergeNames(["Ana", "Bia"], ["Bia", "Caio", "Caio"])).toEqual(["Ana", "Bia", "Caio"]);
	});
	it("lowercase terms are not fed", () => {
		expect(namesFor(["Ana"], table("Fernando", "o menino"))).toEqual(["Ana", "Fernando"]);
	});
	it("an empty table leaves the list names", () => {
		expect(namesFor(["Ana"], EMPTY_TABLE)).toEqual(["Ana"]);
	});
});
