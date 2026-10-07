// The home block: what to write today, drawn from the works index. Lines are
// real buttons; a click opens the work where the writer left off. The pure
// model is desk/works.ts, the data is desk/gather.ts.

import { Keymap, MarkdownRenderChild, debounce } from "obsidian";
import type EscritaPlugin from "../main";
import type { LeftOffEvents } from "../core/left-off";
import { STAGES, writtenWord } from "../core/stages";
import type { DeskEntry } from "../core/works";
import type { IndexChange } from "../core/vault-index";
import { isoDay } from "../core/dates";
import { fmt, fmtShortDay, lang, plural, t } from "../i18n";
import { gatherDesk, pendingSource, type DeskNotice, type Gathered } from "./gather";
import { openWork } from "../ui/open-work";
import { countBar, factParts, type CountKey, type FactLabels, type FactPart, type WorkLine } from "./works";

const RENDER_MS = 250;
const KEY = "data-escrita-key";

const labels: FactLabels = {
  day: fmtShortDay,
  num: fmt,
  of: (n, total) => `${fmt(n)} / ${fmt(total)}`,
  ofMax: (n, limit) => t("desk.fact.ofMax", { n: fmt(n), limit: fmt(limit) }),
  ofRest: (total) => ` / ${fmt(total)}`,
  ofMaxRest: (limit) => ` / ${t("desk.fact.max", { limit: fmt(limit) })}`,
  unitSuffix: (u) => (u === "words" ? "" : u === "characters" ? t("desk.unit.characters") : t("desk.unit.charactersNoSpaces")),
  deadline: (day) => t("desk.fact.deadline", { day }),
  chaptersReady: (done, total) => plural("desk.fact.chaptersReady", total, { done: fmt(done), total: fmt(total) }),
};

/** "a, b or c" in the interface language. */
function orList(words: string[]): string {
  const LF = (Intl as unknown as { ListFormat?: new (l: string, o: object) => { format(a: string[]): string } }).ListFormat;
  if (LF) return new LF(lang(), { style: "long", type: "disjunction" }).format(words);
  return words.join(", ");
}

export class DeskBlock extends MarkdownRenderChild {
  private expanded = new Set<CountKey>();
  private unbindPending: (() => void) | null = null;
  private last: Gathered | null = null;
  private generation = 0;
  /** the day the last gather used */
  private day = "";
  private shown = new Set<string>();
  /** what a click on a keyed element does; rebuilt on every paint */
  private actions = new Map<string, (newTab: boolean) => void>();
  private soon = debounce(() => { void this.refresh(); }, RENDER_MS, true);

  constructor(
    private plugin: EscritaPlugin,
    containerEl: HTMLElement,
    private source: string,
    private leftOff: LeftOffEvents,
  ) {
    super(containerEl);
  }

  onload(): void {
    const root = this.containerEl;
    root.addClass("escrita-desk");
    // a click on the block never puts the cursor into it in Live Preview
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    this.registerDomEvent(root, "mousedown", stop);
    this.registerDomEvent(root, "pointerdown", stop);
    // one listener for every button: the elements are replaced on each paint
    const act = (e: MouseEvent, newTab: boolean) => {
      const el = (e.target as HTMLElement | null)?.closest?.(`[${KEY}]`);
      const run = el ? this.actions.get(el.getAttribute(KEY) ?? "") : undefined;
      if (run) run(newTab);
    };
    this.registerDomEvent(root, "click", (e) => {
      e.stopPropagation();
      act(e, Keymap.isModifier(e, "Mod"));
    });
    this.registerDomEvent(root, "auxclick", (e) => {
      e.stopPropagation();
      if (e.button !== 1) return;
      e.preventDefault();
      act(e, true);
    });
    // a deadline passes at midnight: redraw when the day turns over
    this.registerInterval(window.setInterval(() => {
      if (this.day !== "" && isoDay(new Date()) !== this.day) void this.refresh();
    }, 60_000));

    const { works, measure } = this.plugin;
    this.register(works.onChange((changes) => { if (changes.some((c) => this.touchesChange(c))) this.soon(); }));
    this.register(works.onReady(() => { void this.refresh(); }));
    this.register(measure.onChange((paths) => { if (paths.some((p) => this.touches(p))) this.soon(); }));
    this.register(this.leftOff.onChange((paths) => { if (paths.some((p) => this.touches(p))) this.soon(); }));
    // the pending count: follow the submissions feature and its list
    this.register(this.plugin.features.onChange((id) => { if (id === "submissions") { this.bindPending(); void this.refresh(); } }));
    this.register(() => { this.unbindPending?.(); this.unbindPending = null; });
    this.bindPending();
    void this.refresh();
  }

  private bindPending(): void {
    this.unbindPending?.();
    this.unbindPending = pendingSource(this.plugin)?.onChange(() => this.soon()) ?? null;
  }

  onunload(): void {
    this.soon.cancel();
    this.generation++;
  }

  /** Redraws now (settings changed, or the index moved). */
  async refresh(): Promise<void> {
    const gen = ++this.generation;
    if (!this.plugin.works.isReady()) {
      // first paint; works.onReady replaces it
      if (!this.last) {
        this.containerEl.empty();
        this.containerEl.createDiv({ cls: "escrita-desk-note", text: t("desk.loading") });
      }
      return;
    }
    let g: Gathered;
    const today = isoDay(new Date());
    try {
      g = await gatherDesk(this.plugin, this.source, today);
    } catch (err) {
      console.error("Escrita: the home block could not be drawn", err);
      return;
    }
    if (gen !== this.generation) return;
    this.day = today;
    this.last = g;
    this.shown = g.shown;
    this.paint();
  }

  private touches(path: string): boolean {
    if (this.shown.has(path)) return true;
    const book = this.plugin.works.get(path)?.book;
    return !!book && this.shown.has(book);
  }

  private touchesChange(c: IndexChange<DeskEntry>): boolean {
    const e = c.after ?? c.before;
    // a work may be new to the block, so any non-chapter change counts
    if (e && e.role !== "chapter") return true;
    return this.touches(c.path) || (!!e?.book && this.shown.has(e.book));
  }

  private paint(): void {
    const g = this.last;
    if (!g) return;
    const root = this.containerEl;
    const focused = root.contains(root.ownerDocument.activeElement)
      ? root.ownerDocument.activeElement?.getAttribute(KEY) ?? null
      : null;
    root.empty();
    this.actions.clear();

    for (const n of g.notices) this.notice(root, n);
    this.section(root, t("desk.heading.writing"), g.model.writing, "writing");
    this.section(root, t("desk.heading.revising"), g.model.revising, "revising");
    this.counts(root, g);

    if (focused !== null) {
      const el = Array.from(root.querySelectorAll<HTMLElement>(`[${KEY}]`)).find((x) => x.getAttribute(KEY) === focused);
      el?.focus({ preventScroll: true });
    }
  }

  private notice(parent: HTMLElement, n: DeskNotice): void {
    let text: string;
    if (n.kind === "noWorks") {
      text = t("desk.empty.noWorks", { words: orList(STAGES.map((s) => writtenWord(this.plugin.settings.stages, s))) });
    } else if (n.kind === "nothingActive") {
      text = t("desk.empty.nothing", { draft: t("stage.draft").toLowerCase(), revision: t("stage.revision").toLowerCase() });
    } else if (n.kind === "noFolder") {
      text = t("desk.empty.noFolder", { folder: n.folder });
    } else {
      text = t("desk.empty.noneInFolder", { folder: n.folder });
    }
    parent.createDiv({ cls: "escrita-desk-note", text });
  }

  private section(parent: HTMLElement, heading: string, lines: WorkLine[], id: string): void {
    if (lines.length === 0) return;
    const sec = parent.createDiv({ cls: "escrita-desk-section" });
    sec.createDiv({ cls: "escrita-desk-heading", text: heading });
    for (const line of lines) this.row(sec, "escrita-desk-row", line.title, factParts(line.fact, labels), `${id}:${line.path}`, line.path);
  }

  private row(parent: HTMLElement, cls: string, title: string, parts: FactPart[], key: string, path: string): void {
    const b = parent.createEl("button", { cls });
    b.setAttribute("type", "button");
    b.setAttribute(KEY, key);
    b.createSpan({ cls: "escrita-desk-title", text: title });
    if (parts.length > 0) {
      b.createSpan({ cls: "escrita-desk-leader" }).setAttribute("aria-hidden", "true");
      const fact = b.createSpan({ cls: "escrita-desk-fact" });
      for (const p of parts) {
        fact.createSpan({ cls: p.state ? `escrita-desk-${p.state}` : undefined, text: p.text });
      }
    }
    this.actions.set(key, (newTab) => {
      openWork(this.plugin, path, newTab).catch((err) => console.error("Escrita: could not open the work", err));
    });
  }

  private counts(parent: HTMLElement, g: Gathered): void {
    const bar = countBar(g.model);
    if (bar.length === 0) return;
    const wrap = parent.createDiv({ cls: "escrita-desk-counts-wrap" });
    const barEl = wrap.createDiv({ cls: "escrita-desk-counts" });
    bar.forEach((c, i) => {
      if (i > 0) barEl.createSpan({ cls: "escrita-desk-dot", text: "·" }).setAttribute("aria-hidden", "true");
      const open = this.expanded.has(c.key);
      const b = barEl.createEl("button", { cls: "escrita-desk-count" });
      b.setAttribute("type", "button");
      // the stage's color, as a key: the only place the block shows it
      const color = c.key === "none" || c.key === "pending" ? "" : this.plugin.settings.stages[c.key]?.color ?? "";
      if (color) {
        const dot = b.createSpan({ cls: "escrita-desk-stage-dot" });
        dot.setAttribute("aria-hidden", "true");
        dot.setCssProps({ "--escrita-dot": color });
      }
      b.createSpan({ text: plural(`desk.count.${c.key}`, c.n) });
      b.setAttribute(KEY, `count:${c.key}`);
      b.setAttribute("aria-expanded", open ? "true" : "false");
      this.actions.set(`count:${c.key}`, () => {
        const wasOpen = this.expanded.has(c.key);
        this.expanded.clear();
        if (!wasOpen) this.expanded.add(c.key);
        this.paint();
      });
    });
    const open = bar.find((c) => this.expanded.has(c.key));
    if (!open) return;
    const list = wrap.createDiv({ cls: "escrita-desk-items" });
    if (open.key === "pending") {
      for (const s of g.model.pending?.items ?? []) {
        const text = [s.market, s.sent ? fmtShortDay(s.sent) : ""].filter(Boolean).join(" · ");
        this.row(list, "escrita-desk-sub", s.title, text ? [{ text, state: null }] : [], `item:pending:${s.path}`, s.path);
      }
      return;
    }
    const stage = g.model.counts.find((c) => c.stage === open.key);
    for (const line of stage?.items ?? []) this.row(list, "escrita-desk-sub", line.title, factParts(line.fact, labels), `item:${open.key}:${line.path}`, line.path);
  }
}
