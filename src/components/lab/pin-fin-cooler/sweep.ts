import { evaluate } from './evaluator';
import { definitionOf, type NumericKey, type PinFinParams } from './parameters';

export interface SweepPoint {
  value: number;
  rth: number;
  dpKpa: number;
  /** Any correlation input outside its stated range. */
  out: boolean;
}

export interface Sweep {
  key: NumericKey;
  points: SweepPoint[];
  current: SweepPoint | null;
}

export const SWEEP_SAMPLES = 25;

/** Re-evaluates the model across the full slider range of one parameter, others fixed. */
export function sweep(params: PinFinParams, key: NumericKey, samples = SWEEP_SAMPLES): Sweep {
  const { min, max } = definitionOf(key);
  const points: SweepPoint[] = [];
  for (let index = 0; index < samples; index += 1) {
    const value = min + ((max - min) * index) / (samples - 1);
    const result = evaluate({ ...params, [key]: value });
    if (result.ok)
      points.push({
        value,
        rth: result.rth,
        dpKpa: result.pressureDropKpa,
        out: result.outCount > 0,
      });
  }
  const now = evaluate(params);
  return {
    key,
    points,
    current: now.ok
      ? { value: params[key], rth: now.rth, dpKpa: now.pressureDropKpa, out: now.outCount > 0 }
      : null,
  };
}
