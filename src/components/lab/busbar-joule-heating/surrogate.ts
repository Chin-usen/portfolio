/**
 * Dependency-free evaluation of the FEM-trained Gaussian-process surrogate exported by
 * model/fem/surrogate.py (Matérn 5/2, ARD, linear trend on log-normalized inputs).
 * No FEM runs in the browser.
 */
export interface GpExport {
  lengths: number[];
  variance: number;
  scale: number;
  trend: number[];
  alpha: number[];
}

export interface SurrogateInputs {
  thickness_mm: [number, number];
  strap_width_mm: [number, number];
  beta_per_m: [number, number];
}

export type CaseKey = 'sh:p-layer' | 'sh:ac-link' | 'sl:ac-link' | 'sl:n-layer';
export const CASE_KEYS: readonly CaseKey[] = [
  'sh:p-layer',
  'sh:ac-link',
  'sl:ac-link',
  'sl:n-layer',
];

export interface ErrorSummary {
  mean: number;
  max: number;
  p95: number;
  n: number;
}

export interface ScalarModel {
  schema: 1;
  kernel: string;
  inputs: SurrogateInputs;
  l1ParamsSha256: string;
  samplesSha256: string;
  x2: number[][];
  x3: number[][];
  cases: Record<CaseKey, { logResistanceG: GpExport; logThetaMax: GpExport }>;
  validation: {
    states: Record<
      'sh' | 'sl',
      Record<
        'crossValidation' | 'test',
        { equivalentResistance: ErrorSummary; jouleLoss: ErrorSummary; peakRise: ErrorSummary }
      >
    >;
    trainingSamples: number;
    trainingGeometries: number;
    testSamples: number;
    testGeometries: number;
  };
}

const SQRT5 = Math.sqrt(5);

export function unitLog(value: number, [low, high]: [number, number]): number {
  return (Math.log(value) - Math.log(low)) / (Math.log(high) - Math.log(low));
}

export function normalizedInputs(
  inputs: SurrogateInputs,
  thickness: number,
  strapWidth: number,
  beta?: number,
): number[] {
  const u = [unitLog(thickness, inputs.thickness_mm), unitLog(strapWidth, inputs.strap_width_mm)];
  if (beta !== undefined) u.push(unitLog(beta, inputs.beta_per_m));
  return u;
}

/** Gaussian-process mean prediction at u for training inputs x. */
export function predictGp(
  model: GpExport,
  x: readonly (readonly number[])[],
  u: readonly number[],
) {
  let value = model.trend[0] ?? 0;
  for (let axis = 0; axis < u.length; axis += 1) value += (model.trend[axis + 1] ?? 0) * u[axis]!;
  let sum = 0;
  for (let row = 0; row < x.length; row += 1) {
    const point = x[row]!;
    let d2 = 0;
    for (let axis = 0; axis < u.length; axis += 1) {
      const delta = (u[axis]! - point[axis]!) / model.lengths[axis]!;
      d2 += delta * delta;
    }
    const s = SQRT5 * Math.sqrt(d2);
    sum += (1 + s + (s * s) / 3) * Math.exp(-s) * model.alpha[row]!;
  }
  return value + model.scale * model.variance * sum;
}
