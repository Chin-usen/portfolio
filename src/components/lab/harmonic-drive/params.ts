import defaults from './params.json' with { type: 'json' };
import { createHarmonicModel, type HarmonicModel, type HarmonicParameters } from './math.ts';
export const HARMONIC_DEFAULT_PARAMETERS: Readonly<HarmonicParameters> = Object.freeze({
  ...defaults,
});
export const HARMONIC_PART_IDS = [
  'input-shaft',
  'wave-generator',
  'flexible-bearing',
  'flexspline',
  'circular-spline',
  'cross-roller-bearing',
  'output-flange',
  'housing',
  'endcap',
] as const;
export type HarmonicPartId = (typeof HARMONIC_PART_IDS)[number];
export interface HarmonicLayout {
  scale: number;
  cupBaseZmm: number;
  cupMouthZmm: number;
  flexRootRadiusMm: number;
  flexInnerRadiusMm: number;
  circularDisplayPitchRadiusMm: number;
  housingInnerRadiusMm: number;
  housingOuterRadiusMm: number;
  shaftRadiusMm: number;
}
export function deriveHarmonicLayout(model: HarmonicModel): HarmonicLayout {
  const r = model.metrics.flexPitchRadiusMm,
    m = model.parameters.moduleMm;
  const circularDisplayPitchRadiusMm =
    model.metrics.circularPitchRadiusMm + model.metrics.circularDisplayOffsetMm;
  return {
    scale: r / 50,
    cupBaseZmm: (-22 * r) / 50,
    cupMouthZmm: (10 * r) / 50,
    flexRootRadiusMm: r - 0.6 * m,
    flexInnerRadiusMm: r - 2 * m,
    circularDisplayPitchRadiusMm,
    housingInnerRadiusMm: circularDisplayPitchRadiusMm + 7 * m,
    housingOuterRadiusMm: circularDisplayPitchRadiusMm + 13 * m,
    shaftRadiusMm: r * 0.12,
  };
}
export function prepareHarmonicParameters(parameters: HarmonicParameters) {
  const model = createHarmonicModel(parameters);
  return { model, layout: deriveHarmonicLayout(model) };
}
