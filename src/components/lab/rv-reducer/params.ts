import defaults from './params.json' with { type: 'json' };
import { createRvModel, type RvModel, type RvParameters } from './math.ts';
/** Shared by the runtime rebuild and offline asset generator. Units: mm and radians. */
export const RV_DEFAULT_PARAMETERS: Readonly<RvParameters> = Object.freeze({ ...defaults });
export const RV_PART_IDS = [
  'housing',
  'pin-ring',
  'pin',
  'input-shaft',
  'sun-gear',
  'planet-gear',
  'crankshaft',
  'cycloid-disc',
  'output-flange',
  'main-bearing',
  'needle-bearing',
  'oil-seal',
  'endcap',
] as const;
export type RvPartId = (typeof RV_PART_IDS)[number];

export interface RvLayout {
  scale: number;
  discThicknessMm: number;
  discCenterZmm: number;
  journalRadiusMm: number;
  needleOuterRadiusMm: number;
  shaftRadiusMm: number;
  centralBoreMm: number;
  carrierRadiusMm: number;
  postRadiusMm: number;
  postCircleMm: number;
  flangeCenterZmm: number;
  flangeThicknessMm: number;
  gearCenterZmm: number;
  gearThicknessMm: number;
  pinLengthMm: number;
  housingOuterRadiusMm: number;
  housingInnerRadiusMm: number;
}
function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
export function deriveRvLayout(model: RvModel): RvLayout {
  const p = model.parameters,
    scale = p.pinCircleRadiusMm / 82;
  const shaftRadiusMm = Math.min(
    model.metrics.sun.rootRadiusMm * 0.42,
    model.metrics.crankAxisRadiusMm * 0.09,
  );
  const journalRadiusMm = model.metrics.crankAxisRadiusMm * 0.15;
  const needleOuterRadiusMm = journalRadiusMm * 1.4;
  const centralBoreMm = Math.max(
    shaftRadiusMm + p.eccentricityMm + 3 * scale,
    model.metrics.crankAxisRadiusMm * 0.34,
  );
  const carrierRadiusMm = p.pinCircleRadiusMm - p.pinRadiusMm - 9 * scale;
  const postCircleMm = (model.metrics.crankAxisRadiusMm + model.metrics.minimumRadialExtentMm) / 2;
  const postRadiusMm = 3 * scale;
  const postHoleRadius = postRadiusMm + p.eccentricityMm + 0.8 * scale;
  const a = model.metrics.crankAxisRadiusMm;
  ensure(
    a - needleOuterRadiusMm > centralBoreMm + scale,
    'Crank bearing holes overlap the central bore',
  );
  ensure(
    a + needleOuterRadiusMm + scale < model.metrics.minimumRadialExtentMm,
    'Crank bearing holes extend through the cycloid outline',
  );
  ensure(
    postCircleMm + postHoleRadius + scale < model.metrics.minimumRadialExtentMm,
    'Carrier post clearance holes extend through the cycloid outline',
  );
  ensure(
    postCircleMm + postRadiusMm + scale < carrierRadiusMm,
    'Carrier posts extend beyond the output flange',
  );
  ensure(
    Math.hypot(a - postCircleMm / 2, (Math.sqrt(3) * postCircleMm) / 2) >
      needleOuterRadiusMm + postHoleRadius + scale,
    'Carrier post and crank bearing holes overlap',
  );
  ensure(
    journalRadiusMm > shaftRadiusMm + p.eccentricityMm,
    'Eccentric journals do not fully contain their crankshaft',
  );
  ensure(
    centralBoreMm > p.eccentricityMm + shaftRadiusMm,
    'Disc center bore does not clear the input shaft',
  );
  return {
    scale,
    discThicknessMm: 10 * scale,
    discCenterZmm: 8 * scale,
    journalRadiusMm,
    needleOuterRadiusMm,
    shaftRadiusMm,
    centralBoreMm,
    carrierRadiusMm,
    postRadiusMm,
    postCircleMm,
    flangeCenterZmm: 27 * scale,
    flangeThicknessMm: 7 * scale,
    gearCenterZmm: -38 * scale,
    gearThicknessMm: 8 * scale,
    pinLengthMm: 34 * scale,
    housingOuterRadiusMm: p.pinCircleRadiusMm + 20 * scale,
    housingInnerRadiusMm: p.pinCircleRadiusMm + p.pinRadiusMm + 2 * scale,
  };
}
/** Same cheap analytic and actual bearing/web guards in static UI and Three assembly. */
export function prepareRvParameters(parameters: Readonly<RvParameters>): {
  model: RvModel;
  layout: RvLayout;
} {
  const model = createRvModel(parameters);
  return { model, layout: deriveRvLayout(model) };
}
