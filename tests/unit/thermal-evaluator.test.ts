import { describe, expect, it } from 'vitest';
import {
  evaluate,
  illustrativeTemperature,
  tempAt,
  verticalTemperature,
} from '../../src/components/lab/thermal-stack/evaluator';
import {
  DEFAULT_PARAMS,
  PARAMETER_DEFINITIONS,
} from '../../src/components/lab/thermal-stack/parameters';
import type { ThermalParams } from '../../src/components/lab/thermal-stack/types';

const withoutField = { includeField: false };

describe('analytic thermal resistance network', () => {
  it('reproduces the independently calculated default target without a correction factor', () => {
    const result = evaluate(DEFAULT_PARAMS, withoutField);
    expect(result.rthTotal).toBeCloseTo(0.6056419027959893, 12);
    expect(result.tjMax).toBeCloseTo(125.56419027959893, 10);
    expect(result.tjAvg).toBe(result.tjMax);
    expect(result.model.peakAndAverageResolvedSeparately).toBe(false);
    expect(result.rConv).toBeCloseTo(0.07407407407407407, 12);
    expect(result.coolerTerms!.rSpreading + result.coolerTerms!.rThrough).toBeCloseTo(
      0.3130582374303889,
      12,
    );
    expect(result.layers.slice(0, -1).reduce((sum, layer) => sum + layer.rth, 0)).toBeCloseTo(
      0.21850959129152628,
      12,
    );
    [5, 5, 5.6, 6.24, 6.84, 7.04, 30].forEach((width, index) =>
      expect(result.layers[index]!.exitWidthMm).toBeCloseTo(width, 10),
    );
    expect(result.field).toBeUndefined();
  });

  it('conserves the network temperature drop and matches interfaces', () => {
    const result = evaluate(DEFAULT_PARAMS, withoutField);
    expect(result.rthTotal).toBeCloseTo(
      result.rConv + result.layers.reduce((sum, layer) => sum + layer.rth, 0),
      12,
    );
    for (const [index, layer] of result.layers.entries()) {
      expect(layer.rth).toBeGreaterThan(0);
      expect(layer.tTop - layer.tBottom).toBeCloseTo(DEFAULT_PARAMS.P * layer.rth, 10);
      expect(layer.sourceWidthMm).toBeLessThanOrEqual(layer.width);
      expect(layer.exitWidthMm).toBeLessThanOrEqual(layer.width);
      expect(layer.zTopMm - layer.zBottomMm).toBeCloseTo(layer.thickness, 12);
      const next = result.layers[index + 1];
      if (next) {
        expect(layer.tBottom).toBe(next.tTop);
        expect(layer.zBottomMm).toBe(next.zTopMm);
      }
    }
    const cooler = result.layers.at(-1)!;
    expect(cooler.tBottom).toBeCloseTo(DEFAULT_PARAMS.T_cool + DEFAULT_PARAMS.P * result.rConv, 12);
    expect(cooler.zBottomMm).toBe(0);
  });

  it('scales the rise linearly with power and translates temperatures with coolant', () => {
    const lowPower = evaluate({ ...DEFAULT_PARAMS, P: 50 }, withoutField);
    const highPower = evaluate({ ...DEFAULT_PARAMS, P: 100 }, withoutField);
    expect(highPower.tjMax - DEFAULT_PARAMS.T_cool).toBeCloseTo(
      2 * (lowPower.tjMax - DEFAULT_PARAMS.T_cool),
      10,
    );
    expect(highPower.rthTotal).toBe(lowPower.rthTotal);
    const cold = evaluate({ ...DEFAULT_PARAMS, T_cool: 25 }, withoutField);
    const warm = evaluate({ ...DEFAULT_PARAMS, T_cool: 85 }, withoutField);
    expect(warm.tjMax - cold.tjMax).toBeCloseTo(60, 10);
    expect(warm.rthTotal).toBe(cold.rthTotal);
  });

  it.each(['k_cooler', 'k_sb', 'k_cer', 'k_cu', 'k_st', 'h'] as const)(
    'reduces total resistance when %s increases',
    (key) => {
      const definition = PARAMETER_DEFINITIONS.find((item) => item.key === key)!;
      const low = evaluate({ ...DEFAULT_PARAMS, [key]: definition.min }, withoutField);
      const high = evaluate({ ...DEFAULT_PARAMS, [key]: definition.max }, withoutField);
      expect(high.rthTotal).toBeLessThan(low.rthTotal);
      expect(high.tjMax).toBeLessThan(low.tjMax);
    },
  );

  it('remains finite at each permitted parameter boundary', () => {
    for (const { key, min, max } of PARAMETER_DEFINITIONS) {
      for (const value of [min, max]) {
        const result = evaluate({ ...DEFAULT_PARAMS, [key]: value }, withoutField);
        expect(Number.isFinite(result.tjMax), `${key}=${value}`).toBe(true);
        expect(result.tjMax).toBeGreaterThan(result.tMin);
        expect(result.rthTotal).toBeGreaterThan(0);
        expect(result.coolerTerms!.epsilon).toBeGreaterThan(0);
        expect(result.coolerTerms!.epsilon).toBeLessThan(1);
      }
    }
  });

  it.each([NaN, Infinity, -Infinity, '100', undefined])(
    'rejects non-finite or nonnumeric power %s',
    (P) => {
      expect(() => evaluate({ ...DEFAULT_PARAMS, P } as ThermalParams)).toThrow(
        'P must be a finite number',
      );
    },
  );

  it('rejects values outside the supported domain without mutating inputs', () => {
    const input = { ...DEFAULT_PARAMS };
    const snapshot = { ...input };
    evaluate(input, withoutField);
    expect(input).toEqual(snapshot);
    expect(() => evaluate({ ...input, h: 0 })).toThrow(RangeError);
    expect(() => evaluate({ ...input, t_cer: 1.1 })).toThrow(RangeError);
    expect(() => evaluate({ ...input, P: 501 })).toThrow(RangeError);
  });
});

describe('explicitly illustrative thermal field', () => {
  it('keeps centreline interfaces exact and the lateral profile continuous between layers', () => {
    const result = evaluate(DEFAULT_PARAMS, withoutField);
    const chip = result.layers[0]!;
    const solder = result.layers[1]!;
    expect(verticalTemperature(chip, 1)).toBe(chip.tTop);
    expect(tempAt(chip, 1, 0, DEFAULT_PARAMS.T_cool)).toBe(chip.tTop);
    expect(tempAt(chip, 0, 2, DEFAULT_PARAMS.T_cool)).toBe(
      tempAt(solder, 1, 2, DEFAULT_PARAMS.T_cool),
    );
    expect(illustrativeTemperature(chip, 0.5, -1, 2, DEFAULT_PARAMS.T_cool)).toBe(
      illustrativeTemperature(chip, 0.5, 2, -1, DEFAULT_PARAMS.T_cool),
    );
    expect(tempAt(chip, 1, 3, DEFAULT_PARAMS.T_cool)).toBeNull();
    expect(() => tempAt(chip, 1.1, 0, DEFAULT_PARAMS.T_cool)).toThrow(RangeError);
  });

  it('exports physical coordinates, finite Celsius values and an explicit geometry mask', () => {
    const result = evaluate(DEFAULT_PARAMS);
    const field = result.field!;
    expect(field.profile).toBe('illustrative-chebyshev');
    expect(result.model.isFEM).toBe(false);
    expect(field.width).toBe(128);
    expect(field.height).toBe(64);
    expect(field.values).toHaveLength(field.width * field.height);
    expect(field.mask).toHaveLength(field.values.length);
    expect(field.xMinMm).toBe(-15);
    expect(field.xMaxMm).toBe(15);
    expect(field.zMinMm).toBe(0);
    expect(field.zMaxMm).toBeCloseTo(result.totalHeightMm, 12);
    expect(field.mask.some((value) => value === 0)).toBe(true);
    expect(field.mask.some((value) => value === 1)).toBe(true);
    for (let index = 0; index < field.values.length; index += 1) {
      const temperature = field.values[index]!;
      expect(Number.isFinite(temperature)).toBe(true);
      expect(temperature).toBeGreaterThanOrEqual(result.tMin - 1e-4);
      expect(temperature).toBeLessThanOrEqual(result.tMax + 1e-4);
      if (field.mask[index] === 0) expect(temperature).toBe(DEFAULT_PARAMS.T_cool);
    }
  });
});
