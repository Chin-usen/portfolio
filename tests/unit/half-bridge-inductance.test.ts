import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INDUCTANCE,
  parallelPlateInductance,
} from '../../src/components/lab/half-bridge/inductance';

describe('half-bridge parallel-plate busbar estimate', () => {
  it('converts millimetres to SI units and returns 1.5708 nH at the displayed default', () => {
    expect(parallelPlateInductance(DEFAULT_INDUCTANCE)).toBeCloseTo(1.5707963267948966e-9, 18);
  });
  it('resolves the minimum and maximum permitted physical estimates', () => {
    expect(parallelPlateInductance({ d: 0.1, w: 60, l: 40 }) * 1e9).toBeCloseTo(
      0.08377580409572782,
      12,
    );
    expect(parallelPlateInductance({ d: 2, w: 10, l: 140 }) * 1e9).toBeCloseTo(
      35.18583772020568,
      12,
    );
  });
  it('scales with length and spacing, and inversely with overlap width', () => {
    const baseline = parallelPlateInductance(DEFAULT_INDUCTANCE);
    expect(parallelPlateInductance({ ...DEFAULT_INDUCTANCE, d: 1 })).toBeCloseTo(baseline * 2, 18);
    expect(parallelPlateInductance({ ...DEFAULT_INDUCTANCE, l: 50 })).toBeCloseTo(baseline / 2, 18);
    expect(parallelPlateInductance({ ...DEFAULT_INDUCTANCE, w: 20 })).toBeCloseTo(baseline * 2, 18);
  });
  it.each([
    { d: 0, w: 40, l: 100 },
    { d: 2.01, w: 40, l: 100 },
    { d: 0.5, w: 0, l: 100 },
    { d: 0.5, w: 61, l: 100 },
    { d: 0.5, w: 40, l: 39 },
    { d: 0.5, w: 40, l: 141 },
    { d: NaN, w: 40, l: 100 },
    { d: 0.5, w: Infinity, l: 100 },
  ])('rejects invalid or unbounded geometry %j', (params) => {
    expect(() => parallelPlateInductance(params)).toThrow(RangeError);
  });
});
