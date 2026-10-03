import { describe, expect, it } from "vitest";
import { addToList, listable, menuEntry } from "../src/lens/lists-edit";
import { parseLists } from "../src/lens/lists";

const add = (t: string, l: "crutch" | "names" | "ignore", e: string, lang: "en" | "pt-BR" = "en") => {
  const r = addToList(t, l, e, lang);
  if (!("text" in r)) throw new Error(Object.keys(r)[0]);
  return r.text;
};

describe("addToList", () => {
  const note = "# Listas\n\n## Vícios\n%% hint %%\n\n- viu\n- ouviu\n\n## Nomes\n- Ana\n\n## Ignorar\n";

  it("appends after the last entry, before blank lines and the next heading", () => {
    expect(add(note, "crutch", "meio que")).toBe(
      "# Listas\n\n## Vícios\n%% hint %%\n\n- viu\n- ouviu\n- meio que\n\n## Nomes\n- Ana\n\n## Ignorar\n");
  });
  it("goes after the hint when the section has no entries", () => {
    expect(add(note, "ignore", "Fulano")).toBe(note + "- Fulano\n");
    const t = "## Names\n%% hint %%\n\n## Ignore\n";
    expect(add(t, "names", "Ana")).toBe("## Names\n%% hint %%\n- Ana\n\n## Ignore\n");
  });
  it("keeps CRLF", () => {
    const t = "## Names\r\n- Ana\r\n\r\n## Ignore\r\n";
    expect(add(t, "names", "Bia")).toBe("## Names\r\n- Ana\r\n- Bia\r\n\r\n## Ignore\r\n");
    expect(add("## Names\r\n- Ana", "names", "Bia")).toBe("## Names\r\n- Ana\r\n- Bia");
  });
  it("handles no trailing newline", () => {
    expect(add("## Names\n- Ana", "names", "Bia")).toBe("## Names\n- Ana\n- Bia");
    expect(add("## Names", "names", "Bia")).toBe("## Names\n- Bia");
  });
  it("appends a missing heading, in the lens language", () => {
    expect(add("# T\n\nbody\n", "crutch", "x", "en")).toBe("# T\n\nbody\n\n## Crutch words\n- x\n");
    expect(add("# T\n\nbody\n", "names", "Ana", "pt-BR")).toBe("# T\n\nbody\n\n## Nomes\n- Ana\n");
    expect(add("# T\nbody", "ignore", "x", "pt-BR")).toBe("# T\nbody\n\n## Ignorar\n- x");
    expect(add("", "crutch", "x", "pt-BR")).toBe("## Vícios\n- x\n");
    expect(add("a\r\n", "ignore", "x")).toBe("a\r\n\r\n## Ignore\r\n- x\r\n");
  });
  it("finds headings at any level and by alias", () => {
    expect(add("### crutches\n- a\n", "crutch", "b")).toBe("### crutches\n- a\n- b\n");
    expect(add("# VICIOS\n- a\n", "crutch", "b")).toBe("# VICIOS\n- a\n- b\n");
  });
  it("skips frontmatter and headings inside comments", () => {
    const t = "---\ntitle: x\n## Names\n---\n%%\n## Names\n%%\n## Names\n- Ana\n";
    expect(add(t, "names", "Bia")).toBe("---\ntitle: x\n## Names\n---\n%%\n## Names\n%%\n## Names\n- Ana\n- Bia\n");
  });
  it("reports duplicates after NFC and case folding", () => {
    expect(addToList(note, "crutch", "VIU", "pt-BR")).toEqual({ already: true });
    expect(addToList("## Names\n- Ana\n", "names", "Aná".normalize("NFD"), "en")).not.toEqual({ already: true });
    expect(addToList("## Names\n- Já\n", "names", "Já".normalize("NFD"), "en")).toEqual({ already: true });
    expect(addToList(note, "names", "  ana ", "pt-BR")).toEqual({ already: true });
    // same word in another list is not a duplicate
    expect("text" in addToList(note, "names", "viu", "pt-BR")).toBe(true);
  });
  it("never changes anything outside the section", () => {
    const out = add(note, "names", "Bia");
    const i = out.indexOf("- Bia");
    expect(out.slice(0, i) + out.slice(i + "- Bia\n".length)).toBe(note);
  });
  it("writes special characters as they are, and parseLists reads them back", () => {
    for (const e of ["*dizer*", "a_b", "#tag", "[[Ana]]", "C&A", "`x`", "1984"]) {
      const out = add("## Crutch words\n- a\n", "crutch", e);
      expect(parseLists(out).crutch).toContain(e);
    }
  });
  it("collapses whitespace in the entry", () => {
    expect(add("## Names\n", "names", "  Ana   Maria ")).toBe("## Names\n- Ana Maria\n");
  });
});

describe("listable", () => {
  it("rejects what would not survive a re-read", () => {
    expect(listable("a %% b")).toBe(false);
    expect(listable("- x")).toBe(false);
    expect(listable("1. x")).toBe(false);
    expect(listable("   ")).toBe(false);
    expect(listable("123")).toBe(false);
    expect(listable("viu")).toBe(true);
  });
});

describe("menuEntry", () => {
  it("prefers the selection, else the word at the cursor", () => {
    expect(menuEntry("de repente", "de")).toEqual({ entry: "de repente", name: false, word: false });
    expect(menuEntry("", "viu")).toEqual({ entry: "viu", name: false, word: true });
  });
  it("offers names for capitalized words and names", () => {
    expect(menuEntry("", "Ana")?.name).toBe(true);
    expect(menuEntry("Maria da Silva", "")?.name).toBe(true);
    expect(menuEntry("Maria da Silva", "")?.word).toBe(false);
    expect(menuEntry("Maria silva", "")?.name).toBe(false);
    expect(menuEntry("Maria da", "")?.name).toBe(false);
  });
  it("limits selections to one line and 1 to 6 words", () => {
    expect(menuEntry("a b c d e f g", "")).toBeNull();
    expect(menuEntry("a b c d e f", "")).not.toBeNull();
    expect(menuEntry("a\nb", "")).toBeNull();
    expect(menuEntry("", "")).toBeNull();
    expect(menuEntry("a %% b", "")).toBeNull();
  });
});

describe("addToList unreadable results", () => {
  it("refuses when an unclosed comment would swallow the entry", () => {
    const r = addToList("## Vícios\n- a\n%% note\n\n## Nomes\n", "crutch", "zeta", "pt-BR");
    expect(r).toEqual({ unreadable: true });
  });
  it("refuses when the frontmatter is never closed", () => {
    const r = addToList("---\ntitle: x\n## Vícios\n- a\n", "crutch", "zeta", "pt-BR");
    expect(r).toEqual({ unreadable: true });
  });
});
