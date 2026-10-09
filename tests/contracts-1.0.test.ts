// PLAN-1.0 task 0.1: the parts of the contracts that are data or one-liners. The preset
// logic is task 1.3's (tests/feature-presets.test.ts), the setup plan task 1.5's.

import { describe, expect, it } from "vitest";
import { Component } from "obsidian";
import { PRESETS, PRESET_IDS, PRESET_IGNORED } from "../src/core/feature-presets";
import { FEATURE_IDS, FEATURE_SPECS } from "../src/core/features";
import { cleanSetupOffered } from "../src/data";
import { itemsToRun, type SetupItem } from "../src/setup/plan";
import { CoreModule, startCoreModule } from "../src/core/module-context";
import type EscritaPlugin from "../src/main";

describe("PRESETS (board 38)", () => {
  it("are Essentials 9, Writer 16, Everything 18 plus the universe", () => {
    expect(PRESET_IDS).toEqual(["essentials", "writer", "everything"]);
    expect(PRESETS.essentials.length).toBe(9);
    expect(PRESETS.writer.length).toBe(16);
    expect(PRESETS.everything.length).toBe(18);
    expect([...PRESETS.everything, PRESET_IGNORED].sort()).toEqual([...FEATURE_IDS].sort());
  });

  it("each holds the one before it, and never the universe", () => {
    for (const id of PRESETS.essentials) expect(PRESETS.writer).toContain(id);
    for (const id of PRESETS.writer) expect(PRESETS.everything).toContain(id);
    for (const p of PRESET_IDS) expect(PRESETS[p]).not.toContain("universe");
  });

  it("the lens and export are essentials; spellcheck and threads only in Everything", () => {
    for (const id of ["goals", "outline", "placeholders", "typing", "lens", "darlings", "snapshots", "export", "desk"] as const) {
      expect(PRESETS.essentials).toContain(id);
    }
    for (const id of ["spellcheck", "threads"] as const) {
      expect(PRESETS.writer).not.toContain(id);
      expect(PRESETS.everything).toContain(id);
    }
  });

  it("each list is closed under requires", () => {
    for (const p of PRESET_IDS) {
      for (const spec of FEATURE_SPECS) {
        if (!PRESETS[p].includes(spec.id)) continue;
        for (const r of spec.requires ?? []) expect(PRESETS[p], `${p}: ${spec.id} needs ${r}`).toContain(r);
      }
    }
  });
});

describe("cleanSetupOffered (Q5)", () => {
  it("a fresh install has not been offered the setup", () => {
    expect(cleanSetupOffered({})).toBe(false);
    expect(cleanSetupOffered(null)).toBe(false);
    expect(cleanSetupOffered(undefined)).toBe(false);
  });
  it("an install from before 1.0 (saved settings, no flag) never sees the notice", () => {
    expect(cleanSetupOffered({ settings: { chaptersFolder: "Capítulos" } })).toBe(true);
    expect(cleanSetupOffered({ settings: [] })).toBe(false);
  });
  it("a saved boolean wins", () => {
    expect(cleanSetupOffered({ settings: {}, setupOffered: false })).toBe(false);
    expect(cleanSetupOffered({ setupOffered: true })).toBe(true);
    expect(cleanSetupOffered({ settings: {}, setupOffered: "no" })).toBe(true);
  });
});

describe("itemsToRun", () => {
  const item = (over: Partial<SetupItem>): SetupItem => ({
    kind: "folder", target: "Stories", state: "new", tick: null, ticked: true, reason: { key: "k" }, ...over,
  });
  it("never runs a kept item, ticked or not", () => {
    expect(itemsToRun([item({ state: "kept" }), item({ state: "kept", tick: "examples" })], { examples: true })).toEqual([]);
  });
  it("the writer's tick wins over the default; a missing tick uses the default", () => {
    const ex = item({ kind: "example", tick: "examples", ticked: false });
    const lay = item({ kind: "layout", target: "layout", state: "change", tick: "layout", ticked: true });
    expect(itemsToRun([ex, lay], {})).toEqual([lay]);
    expect(itemsToRun([ex, lay], { examples: true, layout: false })).toEqual([ex]);
  });
});

describe("startCoreModule (the setup's seam)", () => {
  class Probe extends CoreModule {
    log: string[] = [];
    onload(): void {
      this.log.push("load");
      this.ctx.command({ id: "probe", name: "Probe", callback: () => {} });
    }
    onunload(): void { this.log.push("unload"); }
  }

  it("loads once now, registers through its context, and unloads with the plugin", () => {
    const commands = new Set<string>();
    const host = new Component();
    const plugin = host as unknown as EscritaPlugin;
    Object.assign(plugin, {
      addCommand: (c: { id: string }) => { commands.add(c.id); },
      removeCommand: (id: string) => { commands.delete(id); },
    });
    host.load();
    const m = new Probe();
    startCoreModule(plugin, m);
    expect(m.log).toEqual(["load"]);
    expect([...commands]).toEqual(["probe"]);
    host.unload();
    expect(m.log).toEqual(["load", "unload"]);
    expect(commands.size).toBe(0);
  });
});
