import { describe, expect, it } from 'vitest';
import { evaluate, tempAt } from '../../src/components/lab/thermal-stack/evaluator';
import { sampleTemperature } from '../../src/components/lab/thermal-stack/field-sampler';
import { DEFAULT_PARAMS } from '../../src/components/lab/thermal-stack/parameters';
import type { ThermalResult } from '../../src/components/lab/thermal-stack/types';

function fixture(mask?: Uint8Array): ThermalResult {
  const source = evaluate({ ...DEFAULT_PARAMS });
  return {
    ...source,
    layers: [{ ...source.layers[0]!, width: 4, thickness: 0.5, zBottomMm: 0.5, zTopMm: 1 }],
    model: {
      kind: 'fem-trained-surrogate',
      isFEM: false,
      trainedOnFEM: true,
      peakAndAverageResolvedSeparately: true,
      field: 'fem-surrogate-central-plane',
    },
    field: {
      kind: 'fem-surrogate-central-plane',
      width: 3,
      height: 4,
      values: Float32Array.from([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]),
      mask: mask ?? new Uint8Array(12).fill(1),
      xMm: Float32Array.from([-2, 0, 2]),
      zMm: Float32Array.from([0.1, 0.4, 0.7, 0.9]),
      rowLayerIds: ['cooler', 'cooler', 'chip', 'chip'],
      xMinMm: -2,
      xMaxMm: 2,
      zMinMm: 0,
      zMaxMm: 1,
    },
  };
}

describe('thermal field renderer sampling', () => {
  it('bilinearly interpolates nonuniform FEM cell centres within a layer', () => {
    const result = fixture();
    expect(sampleTemperature(result, result.layers[0]!, 0.6, 1, 0)).toBeCloseTo(90, 5);
  });
  it('clamps to the layer own sample rows instead of blending across an interface', () => {
    const result = fixture();
    expect(sampleTemperature(result, result.layers[0]!, 0, 1, 0)).toBeCloseTo(75, 5);
    expect(sampleTemperature(result, result.layers[0]!, 1, 1, 0)).toBeCloseTo(105, 5);
  });
  it('does not blend masked exterior values into a physical face', () => {
    const mask = new Uint8Array(12).fill(1);
    mask[8] = 0;
    mask[11] = 0;
    const result = fixture(mask);
    expect(sampleTemperature(result, result.layers[0]!, 0.6, 1, 0)).toBeCloseTo(85, 5);
  });
  it('rejects points outside the physical layer', () => {
    const result = fixture();
    expect(sampleTemperature(result, result.layers[0]!, 0.5, 3, 0)).toBeNull();
    expect(sampleTemperature(result, result.layers[0]!, -0.1, 1, 0)).toBeNull();
  });
  it('preserves the analytical illustrative field in analytical mode', () => {
    const result = evaluate({ ...DEFAULT_PARAMS });
    const layer = result.layers[0]!;
    expect(sampleTemperature(result, layer, 0.5, 1, 65)).toBe(tempAt(layer, 0.5, 1, 65));
  });
});
