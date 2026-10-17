import { describe, expect, it } from 'vitest';
import { evaluate, pinLayout } from '../../../src/components/lab/pin-fin-cooler/evaluator';
import type {
  PinFinResult,
  ValidityId,
} from '../../../src/components/lab/pin-fin-cooler/evaluator';
import {
  DEFAULT_PARAMS,
  PARAMETER_DEFINITIONS,
  type PinFinParams,
} from '../../../src/components/lab/pin-fin-cooler/parameters';
import { fluidProperties, units } from '../../../src/components/lab/pin-fin-cooler/properties';
import { formatLimit, formatRange } from '../../../src/components/lab/pin-fin-cooler/format';
import { sweep } from '../../../src/components/lab/pin-fin-cooler/sweep';
import { chartModel } from '../../../src/components/lab/pin-fin-cooler/chart';
import { streamlineSketch } from '../../../src/components/lab/pin-fin-cooler/streamlines';

const within = (actual: number, expected: number, relative: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(relative);

function run(change: Partial<PinFinParams> = {}): PinFinResult {
  const result = evaluate({ ...DEFAULT_PARAMS, ...change });
  if (!result.ok) throw new Error(`evaluation failed: ${result.reason}`);
  return result;
}
const status = (result: PinFinResult, id: ValidityId) =>
  result.checks.find((check) => check.id === id)?.status;

describe('unit conversions', () => {
  it('converts flow, length, pressure and temperature', () => {
    expect(units.litresPerMinuteToCubicMetresPerSecond(60)).toBe(0.001);
    expect(units.litresPerMinuteToCubicMetresPerSecond(8)).toBeCloseTo(1.3333333e-4, 10);
    expect(units.millimetresToMetres(2.5)).toBe(0.0025);
    expect(units.pascalToKilopascal(2140)).toBe(2.14);
    expect(units.celsiusToKelvin(26.85)).toBeCloseTo(300, 12);
  });
  it('reports Δp in kPa and pumping power as Δp·V̇', () => {
    const result = run();
    expect(result.pressureDropKpa).toBeCloseTo(result.pressureDrop / 1000, 12);
    expect(result.pumpingPower).toBeCloseTo((result.pressureDrop * 8) / 60000, 12);
  });
});

/** Incropera 6th ed. Table A.6 (saturated water): 300 K and 350 K rows. */
describe('coolant property table', () => {
  it('matches Incropera Table A.6 at 300 K within 1.5 %', () => {
    const water = fluidProperties('water', 26.85);
    within(water.density, 1 / 1.003e-3, 0.005);
    within(water.cp, 4179, 0.005);
    within(water.viscosity, 855e-6, 0.015);
    within(water.conductivity, 0.613, 0.015);
    within(water.prandtl, 5.83, 0.015);
  });
  // Table A.6 predates the IAPWS 2008/2011 transport formulations; ~1.5 % differences remain.
  it('matches Incropera Table A.6 at 350 K within 2 %', () => {
    const water = fluidProperties('water', 76.85);
    within(water.density, 1 / 1.027e-3, 0.005);
    within(water.cp, 4195, 0.005);
    within(water.viscosity, 365e-6, 0.02);
    within(water.conductivity, 0.668, 0.02);
    within(water.prandtl, 2.29, 0.02);
  });
  it('interpolates between rows and clamps outside the table with a flag', () => {
    const mid = fluidProperties('water', 42.5);
    const low = fluidProperties('water', 40);
    const high = fluidProperties('water', 45);
    expect(mid.density).toBeCloseTo((low.density + high.density) / 2, 9);
    expect(mid.viscosity).toBeCloseTo(Math.sqrt(low.viscosity * high.viscosity), 12);
    expect(mid.clamped).toBe(false);
    const hot = fluidProperties('glycol50', 130);
    expect(hot.clamped).toBe(true);
    expect(hot.temperature).toBe(100);
    expect(() => fluidProperties('water', Number.NaN)).toThrow();
  });
  it('gives 50 % glycol a higher Pr and lower conductivity than water', () => {
    const glycol = fluidProperties('glycol50', 40);
    const water = fluidProperties('water', 40);
    expect(glycol.prandtl).toBeGreaterThan(3 * water.prandtl);
    expect(glycol.conductivity).toBeLessThan(water.conductivity);
    expect(glycol.density).toBeGreaterThan(water.density);
  });
});

describe('pin layout', () => {
  it('fits a centred in-line lattice', () => {
    const layout = pinLayout({ ...DEFAULT_PARAMS, arrangement: 'inline' });
    expect(layout).toMatchObject({ rows: 20, perRow: 12, perOffsetRow: 12, count: 240 });
    expect(layout.centres[0]).toBeCloseTo(3, 12); // (50 − 12·4)/2 + 2
  });
  it('drops one pin from offset rows of a staggered lattice when it does not fit', () => {
    const layout = pinLayout({ ...DEFAULT_PARAMS, width: 48 });
    expect(layout.perRow).toBe(12);
    expect(layout.perOffsetRow).toBe(11);
    expect(layout.count).toBe(10 * 12 + 10 * 11);
  });
});

describe('model evaluation', () => {
  it('is self-consistent at the default point', () => {
    const r = run();
    expect(r.layout.count).toBe(240);
    expect(r.band).toBe('subcritical');
    expect(r.regime).toBe('subcritical');
    expect(r.rth).toBeCloseTo(1 / (r.effectiveness * r.massFlow * r.bulk.cp), 12);
    expect(r.rth).toBeCloseTo(r.rConvective + r.rCaloric, 12);
    expect(r.h).toBeCloseTo((r.nusselt * r.bulk.conductivity) / 0.002, 9);
    expect(r.tOut).toBeCloseTo(40 + 400 / (r.massFlow * r.bulk.cp), 9);
    expect(r.bulk.temperature).toBeCloseTo((40 + r.tOut) / 2, 6);
    expect(r.areas.total).toBeCloseTo(r.areas.fins + r.areas.base, 15);
    expect(r.outCount).toBe(0);
    expect(r.cautionCount).toBe(0);
  });
  it('responds in the physically expected direction', () => {
    const base = run();
    expect(run({ flow: 16 }).rth).toBeLessThan(base.rth);
    expect(run({ flow: 16 }).pressureDrop).toBeGreaterThan(base.pressureDrop);
    expect(run({ coolant: 'glycol50' }).rth).toBeGreaterThan(base.rth);
    expect(run({ material: 'aluminium' }).fin.efficiency).toBeLessThan(base.fin.efficiency);
    expect(run({ arrangement: 'inline' }).pressureDrop).toBeLessThan(base.pressureDrop);
  });
  it('evaluates every slider at both ends', () => {
    for (const definition of PARAMETER_DEFINITIONS)
      for (const value of [definition.min, definition.max]) {
        const result = run({ [definition.key]: value });
        expect(Number.isFinite(result.rth) && result.rth > 0).toBe(true);
        expect(Number.isFinite(result.pressureDrop) && result.pressureDrop > 0).toBe(true);
      }
  });
  it('rejects invalid input and footprints without pins', () => {
    expect(evaluate({ ...DEFAULT_PARAMS, flow: 0 })).toEqual({ ok: false, reason: 'invalid' });
    expect(evaluate({ ...DEFAULT_PARAMS, pitchT: 1 })).toEqual({ ok: false, reason: 'invalid' });
    expect(evaluate({ ...DEFAULT_PARAMS, length: 5, pitchL: 3, diameter: 3 })).toEqual({
      ok: false,
      reason: 'no-pins',
    });
  });
});

describe('validity ranges and out-of-range warnings', () => {
  it('treats exact boundary values as inside', () => {
    const r = run({ pitchT: 1.25, pitchL: 1.25 });
    expect(status(r, 'gg-a')).toBe('ok');
    expect(r.checks.find((check) => check.id === 'gg-a')).toMatchObject({ min: 1.25, max: 3 });
    expect(status(run({ pitchT: 3, pitchL: 3 }), 'gg-b')).toBe('ok');
    expect(status(run({ height: 8, diameter: 2 }), 'geo-short')).toBe('ok'); // H/D = 4 exactly
    expect(status(run({ height: 7.5, diameter: 2 }), 'geo-short')).toBe('caution');
  });
  it('flags Re below the Zukauskas minimum of 10', () => {
    const r = run({ flow: 0.3, coolant: 'glycol50', tIn: 1, diameter: 1, pitchT: 3, height: 10 });
    expect(r.reynolds).toBeLessThan(10);
    expect(status(r, 'zk-re')).toBe('out');
    expect(r.regime).toBe('creeping');
    expect(r.outCount).toBeGreaterThan(0);
  });
  it('flags pitch ratios outside the Gaddis–Gnielinski data', () => {
    expect(status(run({ pitchT: 3.2 }), 'gg-a')).toBe('out');
    expect(status(run({ pitchT: 1.2 }), 'gg-a')).toBe('out');
    expect(status(run({ pitchL: 1.1, arrangement: 'inline' }), 'gg-b')).toBe('out');
    expect(status(run({ pitchL: 1.1, arrangement: 'staggered' }), 'gg-b')).toBe('ok');
  });
  it('flags short arrays, low Re, transitional band and short pins as reachable from the sliders', () => {
    const short = run({ length: 20, diameter: 3, pitchL: 3 });
    expect(short.layout.rows).toBe(2);
    expect(status(short, 'gg-rows')).toBe('out');
    const glycol = run({ coolant: 'glycol50' });
    expect(status(glycol, 'zk-band')).toBe('caution');
    expect(status(glycol, 'gg-low-re')).toBe('caution');
    expect(status(run({ height: 4, diameter: 3 }), 'geo-short')).toBe('caution');
    expect(status(run({ arrangement: 'inline', pitchT: 1.25, pitchL: 3 }), 'zk-aligned')).toBe(
      'caution',
    );
  });
  it('flags hot bases and property-table extrapolation', () => {
    const hot = run({ tIn: 85, heat: 1500, flow: 2, coolant: 'glycol50', length: 20, width: 20 });
    expect(status(hot, 'prop-boil')).toBe('caution');
    expect(status(hot, 'prop-wall')).toBe('caution');
  });
  it('formats ranges for display', () => {
    expect(formatLimit(2e6)).toBe('2×10⁶');
    expect(formatLimit(3e5)).toBe('3×10⁵');
    expect(formatLimit(1e4)).toBe('10⁴');
    expect(formatLimit(0.7)).toBe('0.7');
    expect(formatRange({ min: 10, max: 2e6 })).toBe('10 – 2×10⁶');
    expect(formatRange({ min: 5, max: null })).toBe('≥ 5');
    expect(formatRange({ min: null, max: 0.1 })).toBe('≤ 0.1');
  });
});

describe('trade-off sweep and sketches', () => {
  it('sweeps the full slider range and marks the current point', () => {
    const data = sweep({ ...DEFAULT_PARAMS }, 'flow');
    expect(data.points).toHaveLength(25);
    expect(data.points[0]!.value).toBe(2);
    expect(data.points.at(-1)!.value).toBe(20);
    expect(data.current?.rth).toBeCloseTo(run().rth, 12);
    for (let index = 1; index < data.points.length; index += 1)
      expect(data.points[index]!.dpKpa).toBeGreaterThan(data.points[index - 1]!.dpKpa);
    const chart = chartModel(data);
    expect(chart.marks).toHaveLength(25);
    expect(chart.path.startsWith('M')).toBe(true);
    expect(chart.xTicks.length).toBeGreaterThan(1);
    expect(chart.yTicks.length).toBeGreaterThan(1);
  });
  it('draws one closed circle per pin and streamlines across the footprint', () => {
    const sketch = streamlineSketch({ ...DEFAULT_PARAMS });
    expect(sketch.pins.match(/M/g)).toHaveLength(240);
    expect(sketch.lines).toHaveLength(11);
    for (const line of sketch.lines) {
      const numbers = line.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const xs = numbers.filter((_, index) => index % 2 === 0);
      expect(Math.max(...xs)).toBeGreaterThan(DEFAULT_PARAMS.length);
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
  });
});
