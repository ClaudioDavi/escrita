// Pure geometry for the progress chart (no Obsidian imports): bars of words per
// day, a dashed daily-goal line, for a book a line for its running total, and
// bands behind the bars for days off.

export interface ChartInput {
  width: number;
  height: number;
  /** words per day, oldest first */
  values: number[];
  /** daily goal; <= 0 draws no goal line */
  goal: number;
  /** the book's total at the end of each day (same length as values), or null */
  totals?: number[] | null;
  /** whether each day is a day off (same length as values), or null */
  off?: readonly boolean[] | null;
}

/** A run of consecutive days off, drawn as a full-height band behind the bars. */
export interface ChartBand {
  /** first and last day index of the run */
  from: number;
  to: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartBar {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  met: boolean;
}

export interface ChartLabel {
  index: number;
  x: number;
  anchor: "start" | "middle" | "end";
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  bars: ChartBar[];
  /** y of the dashed goal line, or null */
  goalY: number | null;
  /** SVG path of the running total, or null */
  totalPath: string | null;
  /** end point of the running total, for its label */
  totalEnd: { x: number; y: number; value: number } | null;
  /** x labels: first day, middle, last (today) */
  xLabels: ChartLabel[];
  /** days off, merged into runs, left to right */
  offBands: ChartBand[];
}

export const CHART_PAD = { top: 12, bottom: 20, left: 2, right: 2, label: 52 };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clean = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function chartGeometry(input: ChartInput): ChartGeometry {
  const width = Math.max(40, clean(input.width) || 40);
  const height = Math.max(40, clean(input.height) || 40);
  const values = input.values.map(clean);
  const n = values.length;
  const goal = clean(input.goal);
  const totals = input.totals && input.totals.length === n && n > 0 ? input.totals.map(clean) : null;

  const plot = {
    left: CHART_PAD.left,
    top: CHART_PAD.top,
    right: width - (totals ? CHART_PAD.label : CHART_PAD.right),
    bottom: height - CHART_PAD.bottom,
  };
  const plotW = Math.max(1, plot.right - plot.left);
  const plotH = Math.max(1, plot.bottom - plot.top);

  const peak = Math.max(goal, ...values, 0);
  const max = peak > 0 ? peak * 1.1 : 1;
  const slot = n > 0 ? plotW / n : plotW;
  const barW = Math.max(1, slot * 0.7);

  const bars: ChartBar[] = values.map((value, i) => {
    let h = (value / max) * plotH;
    if (value > 0) h = Math.max(h, 1.5);
    return {
      index: i,
      x: r2(plot.left + i * slot + (slot - barW) / 2),
      y: r2(plot.bottom - h),
      width: r2(barW),
      height: r2(h),
      value,
      met: goal > 0 && value >= goal,
    };
  });

  const goalY = goal > 0 ? r2(plot.bottom - (goal / max) * plotH) : null;

  let totalPath: string | null = null;
  let totalEnd: ChartGeometry["totalEnd"] = null;
  if (totals) {
    const lo = Math.min(...totals);
    const hi = Math.max(...totals);
    // The line lives in the upper part of the plot, above most bars.
    const yOf = (v: number) =>
      hi === lo ? plot.top + plotH * 0.25 : plot.top + plotH * 0.05 + (1 - (v - lo) / (hi - lo)) * plotH * 0.6;
    const pts = totals.map((v, i) => [r2(plot.left + i * slot + slot / 2), r2(yOf(v))] as const);
    totalPath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    const [ex, ey] = pts[pts.length - 1];
    totalEnd = { x: ex, y: ey, value: totals[totals.length - 1] };
  }

  const xLabels: ChartLabel[] = [];
  if (n > 0) {
    const idx = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));
    for (const i of idx) {
      const anchor = i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle";
      const x = anchor === "start" ? plot.left : anchor === "end" ? plot.left + (i + 1) * slot : plot.left + i * slot + slot / 2;
      xLabels.push({ index: i, x: r2(x), anchor });
    }
  }

  const offBands: ChartBand[] = [];
  const off = input.off && input.off.length === n ? input.off : null;
  if (off) {
    for (let i = 0; i < n; i++) {
      if (!off[i]) continue;
      let j = i;
      while (j + 1 < n && off[j + 1]) j++;
      const x = plot.left + i * slot;
      offBands.push({ from: i, to: j, x: r2(x), y: plot.top, width: r2((j - i + 1) * slot), height: r2(plotH) });
      i = j;
    }
  }

  return { width, height, plot, bars, goalY, totalPath, totalEnd, xLabels, offBands };
}
