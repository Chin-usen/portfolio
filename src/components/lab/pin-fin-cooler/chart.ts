import type { Sweep } from './sweep';

/** Geometry for the R_th–Δp trade-off chart, shared by server rendering and the client. */
export const CHART = { width: 640, height: 320, left: 64, right: 20, top: 34, bottom: 48 } as const;

export interface ChartTick {
  value: number;
  position: number;
  label: string;
}
export interface ChartMark {
  x: number;
  y: number;
  value: number;
  rth: number;
  dpKpa: number;
  out: boolean;
}
export interface ChartModel {
  path: string;
  marks: ChartMark[];
  current: ChartMark | null;
  xTicks: ChartTick[];
  yTicks: ChartTick[];
  first: ChartMark | null;
  last: ChartMark | null;
}

const trim = (value: number) => Number(value.toFixed(2)).toString();

/** Compact engineering text: 3 significant digits without exponent notation for UI values. */
export function formatSignificant(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, digits - 1 - magnitude);
  return value.toFixed(Math.min(decimals, 8));
}

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (
    let exponent = Math.floor(Math.log10(min));
    exponent <= Math.ceil(Math.log10(max));
    exponent++
  )
    for (const mantissa of [1, 2, 5]) {
      const value = mantissa * Math.pow(10, exponent);
      if (value >= min * 0.999 && value <= max * 1.001) ticks.push(value);
    }
  if (ticks.length > 6) return ticks.filter((value) => Math.abs(Math.log10(value) % 1) < 1e-9);
  return ticks;
}

export function chartModel(data: Sweep): ChartModel {
  const all = data.current ? [...data.points, data.current] : data.points;
  const empty = {
    path: '',
    marks: [],
    current: null,
    xTicks: [],
    yTicks: [],
    first: null,
    last: null,
  };
  if (!all.length) return empty;
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  let dpMin = Math.min(...all.map((p) => p.dpKpa));
  let dpMax = Math.max(...all.map((p) => p.dpKpa));
  if (dpMax / dpMin < 1.5) {
    const mid = Math.sqrt(dpMax * dpMin);
    dpMin = mid / 1.25;
    dpMax = mid * 1.25;
  }
  const lx0 = Math.log10(dpMin) - 0.05;
  const lx1 = Math.log10(dpMax) + 0.05;
  const rMin = Math.min(...all.map((p) => p.rth));
  const rMax = Math.max(...all.map((p) => p.rth));
  const span = rMax - rMin || rMax * 0.2 || 1;
  const step = niceStep(span, 4);
  const y0 = Math.max(0, Math.floor((rMin - span * 0.06) / step) * step);
  const y1 = Math.ceil((rMax + span * 0.06) / step) * step;
  const x = (dp: number) => CHART.left + ((Math.log10(dp) - lx0) / (lx1 - lx0)) * plotW;
  const y = (r: number) => CHART.top + (1 - (r - y0) / (y1 - y0)) * plotH;
  const mark = (p: (typeof all)[number]): ChartMark => ({
    x: Number(x(p.dpKpa).toFixed(2)),
    y: Number(y(p.rth).toFixed(2)),
    value: p.value,
    rth: p.rth,
    dpKpa: p.dpKpa,
    out: p.out,
  });
  const marks = data.points.map(mark);
  const path = marks.map((m, i) => `${i ? 'L' : 'M'}${m.x} ${m.y}`).join(' ');
  const xTicks = logTicks(Math.pow(10, lx0), Math.pow(10, lx1)).map((value) => ({
    value,
    position: Number(x(value).toFixed(2)),
    label: trim(value),
  }));
  const yTicks: ChartTick[] = [];
  const exponent = Math.floor(Math.log10(step) + 1e-9);
  const mantissa = Math.round((step / Math.pow(10, exponent)) * 10) / 10;
  const decimals = Math.max(0, -exponent + (mantissa === 2.5 ? 1 : 0));
  for (let value = y0; value <= y1 + step * 1e-6; value += step)
    yTicks.push({ value, position: Number(y(value).toFixed(2)), label: value.toFixed(decimals) });
  return {
    path,
    marks,
    current: data.current ? mark(data.current) : null,
    xTicks,
    yTicks,
    first: marks[0] ?? null,
    last: marks[marks.length - 1] ?? null,
  };
}
