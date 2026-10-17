import type { InductanceParams } from './types';

/** Ideal parallel plates; all inputs in mm, result in H. Not a module extraction or dielectric rule. */
export const MU_0 = 4 * Math.PI * 1e-7;
export const DEFAULT_INDUCTANCE: Readonly<InductanceParams> = Object.freeze({
  d: 0.5,
  w: 40,
  l: 100,
});
export const INDUCTANCE_LIMITS = {
  d: { min: 0.1, max: 2, step: 0.05 },
  w: { min: 10, max: 60, step: 1 },
  l: { min: 40, max: 140, step: 1 },
} as const;
export function parallelPlateInductance(params: InductanceParams): number {
  for (const key of ['d', 'w', 'l'] as const) {
    const value = params[key];
    const limits = INDUCTANCE_LIMITS[key];
    if (!Number.isFinite(value) || value < limits.min || value > limits.max)
      throw new RangeError(`Invalid ${key}: use ${limits.min}–${limits.max} mm.`);
  }
  return (MU_0 * (params.l * 1e-3) * (params.d * 1e-3)) / (params.w * 1e-3);
}
