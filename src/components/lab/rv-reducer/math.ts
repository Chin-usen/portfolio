/**
 * Generic RV schematic. Units: mm, radians, rpm; velocities: mm/s and rad/s.
 * x-right/y-up; positive angles CCW. Reflect display y only at the renderer.
 * No rendering dependencies, load solver, manufactured root geometry or stress claim.
 * Defaults live only in params.json. Call createRvModel once after parameter edits.
 */
export interface Point2 {
  x: number;
  y: number;
}
export interface RvParameters {
  sunTeeth: number;
  planetTeeth: number;
  planetCount: number;
  pinCount: number;
  lobeCount: number;
  pinCircleRadiusMm: number;
  pinRadiusMm: number;
  eccentricityMm: number;
  spurModuleMm: number;
  pressureAngleRad: number;
  addendumCoefficient: number;
  dedendumCoefficient: number;
  normalReliefMm: number;
  profileSamplesPerLobe: number;
  profileChordToleranceMm: number;
  gearFlankSamples: number;
  gearArcSamples: number;
}
export interface SpurDimensions {
  teeth: number;
  pitchRadiusMm: number;
  baseRadiusMm: number;
  tipRadiusMm: number;
  rootRadiusMm: number;
  flankStartRadiusMm: number;
  tipHalfThicknessRad: number;
  tipThicknessMm: number;
}
export interface RvMetrics {
  ratio: number;
  k1: number;
  geometryMarginMm: number;
  adjacentPinGapMm: number;
  minimumRadialExtentMm: number;
  maximumCenterCurveCurvaturePerMm: number;
  offsetRegularityMargin: number;
  crankAxisRadiusMm: number;
  neighboringPlanetTipGapMm: number;
  contactRatio: number;
  approachMm: number;
  recessMm: number;
  basePitchMm: number;
  noUndercutMinimumTeeth: number;
  sunTipToPlanetRootClearanceMm: number;
  planetTipToSunRootClearanceMm: number;
  sun: SpurDimensions;
  planet: SpurDimensions;
}
export interface ValidationIssue {
  code: string;
  message: string;
}
export interface ParameterValidation {
  valid: boolean;
  issues: ValidationIssue[];
  metrics?: RvMetrics;
}
export interface RvModel {
  readonly parameters: Readonly<RvParameters>;
  readonly metrics: Readonly<RvMetrics>;
}
export interface RvKinematics {
  inputAngleRad: number;
  carrierAngleRad: number;
  crankAngleRad: number;
  crankRelativeToCarrierRad: number;
  inputRpm: number;
  outputRpm: number;
  crankRpm: number;
  crankRelativeToCarrierRpm: number;
  inputRadPerSecond: number;
  outputRadPerSecond: number;
  crankRadPerSecond: number;
}
export type DiscIndex = 0 | 1;
export interface DiscPose {
  centerMm: Point2;
  structuralAngleRad: number;
  outlineAngleRad: number;
  eccentricAngleRad: number;
  outlineIndexRad: number;
}
export interface PlanetPose {
  index: number;
  carrierIndexRad: number;
  axisMm: Point2;
  gearAngleRad: number;
  crankAngleRad: number;
  fixedGearToCrankIndexRad: number;
}
export interface ContactSample {
  pinCenterMm: Point2;
  pointMm: Point2;
  outlinePointMm: Point2;
  normal: Point2;
  tangent: Point2;
  parameterRad: number;
  materialVelocityMmPerSecond: Point2;
  normalVelocityMmPerSecond: number;
  tangentialVelocityMmPerSecond: number;
  /** Hypothetical isolated freely spinning pin; generally differs between the two discs. */
  independentPinMatchingRpm: number | null;
  exactNominalTangency: boolean;
}
export const TAU = 2 * Math.PI;
const RAD_PER_SECOND_PER_RPM = TAU / 60;
const GEOMETRY_MARGIN_FRACTION = 1e-8;
const REGULARITY_MARGIN = 1e-8;
export const point = (x: number, y: number): Point2 => ({ x, y });
export const add = (a: Point2, b: Point2): Point2 => point(a.x + b.x, a.y + b.y);
export const subtract = (a: Point2, b: Point2): Point2 => point(a.x - b.x, a.y - b.y);
export const scale = (a: Point2, factor: number): Point2 => point(a.x * factor, a.y * factor);
export const dot = (a: Point2, b: Point2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Point2, b: Point2): number => a.x * b.y - a.y * b.x;
export const length = (a: Point2): number => Math.hypot(a.x, a.y);
export const perpendicular = (a: Point2): Point2 => point(-a.y, a.x);
export const unit = (angleRad: number): Point2 => point(Math.cos(angleRad), Math.sin(angleRad));
export function rotate(a: Point2, angleRad: number): Point2 {
  const c = Math.cos(angleRad),
    s = Math.sin(angleRad);
  return point(c * a.x - s * a.y, s * a.x + c * a.y);
}
export const wrapSigned = (angleRad: number): number =>
  Math.atan2(Math.sin(angleRad), Math.cos(angleRad));
export const rpmToRadiansPerSecond = (rpm: number): number => rpm * RAD_PER_SECOND_PER_RPM;
export const radiansPerSecondToRpm = (rate: number): number => rate / RAD_PER_SECOND_PER_RPM;
export const involute = (angleRad: number): number => Math.tan(angleRad) - angleRad;
function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}
function indexInRange(index: number, count: number, name: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= count)
    throw new RangeError(`${name} out of range`);
}
export function reductionRatio(
  p: Pick<RvParameters, 'sunTeeth' | 'planetTeeth' | 'pinCount'>,
): number {
  return 1 + (p.planetTeeth / p.sunTeeth) * p.pinCount;
}
/** Involute exists at or above the base circle only. No inverse-cosine clamping. */
export function spurHalfThicknessRad(
  g: SpurDimensions,
  pressureAngleRad: number,
  radiusMm: number,
): number {
  finite(radiusMm, 'radiusMm');
  if (radiusMm < g.baseRadiusMm) throw new RangeError('Involute radius is below the base circle');
  return (
    Math.PI / (2 * g.teeth) +
    involute(pressureAngleRad) -
    involute(Math.acos(g.baseRadiusMm / radiusMm))
  );
}
function spurDimensions(p: RvParameters, teeth: number): SpurDimensions {
  const pitchRadiusMm = p.spurModuleMm * (teeth / 2);
  const baseRadiusMm = pitchRadiusMm * Math.cos(p.pressureAngleRad);
  const tipRadiusMm = pitchRadiusMm + p.spurModuleMm * p.addendumCoefficient;
  const rootRadiusMm = pitchRadiusMm - p.spurModuleMm * p.dedendumCoefficient;
  const g: SpurDimensions = {
    teeth,
    pitchRadiusMm,
    baseRadiusMm,
    tipRadiusMm,
    rootRadiusMm,
    flankStartRadiusMm: Math.max(baseRadiusMm, rootRadiusMm),
    tipHalfThicknessRad: 0,
    tipThicknessMm: 0,
  };
  g.tipHalfThicknessRad = spurHalfThicknessRad(g, p.pressureAngleRad, tipRadiusMm);
  g.tipThicknessMm = 2 * tipRadiusMm * g.tipHalfThicknessRad;
  return g;
}
/** Exact maximum positive curvature of the pin-center curve, without an angular grid. */
export function maximumCenterCurveCurvature(
  p: Pick<RvParameters, 'pinCount' | 'pinCircleRadiusMm' | 'eccentricityMm'>,
): number {
  const n = p.pinCount,
    k = (p.eccentricityMm * n) / p.pinCircleRadiusMm;
  const cosStar = Math.max(-1, Math.min(1, (2 - n + (2 * n - 1) * k * k) / ((n + 1) * k)));
  const denominatorSquared = (1 - k) * (1 - k) + 2 * k * (1 - cosStar);
  return (
    (1 + n * k * k - (n + 1) * k * cosStar) / (p.pinCircleRadiusMm * denominatorSquared ** 1.5)
  );
}
export function validateParameters(p: RvParameters): ParameterValidation {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string) => issues.push({ code, message });
  for (const key of ['sunTeeth', 'planetTeeth', 'planetCount', 'pinCount', 'lobeCount'] as const) {
    if (!Number.isSafeInteger(p[key]) || p[key] <= 0 || p[key] > 512)
      issue('INTEGER_BOUNDS', `${key} must be an integer in [1,512]`);
  }
  if (p.planetCount !== 3)
    issue('PLANET_COUNT', 'This model uses exactly three crankshafts/planets');
  if (p.pinCount < 3 || p.lobeCount !== p.pinCount - 1)
    issue('LOBE_DIFFERENCE', 'Require pinCount>=3 and lobeCount=pinCount-1');
  for (const key of [
    'pinCircleRadiusMm',
    'pinRadiusMm',
    'eccentricityMm',
    'spurModuleMm',
    'addendumCoefficient',
    'dedendumCoefficient',
    'profileChordToleranceMm',
  ] as const) {
    if (!Number.isFinite(p[key]) || p[key] <= 0)
      issue('POSITIVE_FINITE', `${key} must be positive and finite`);
  }
  if (!Number.isFinite(p.normalReliefMm) || p.normalReliefMm < 0)
    issue('RELIEF', 'normalReliefMm must be finite and >=0');
  if (
    !Number.isFinite(p.pressureAngleRad) ||
    p.pressureAngleRad <= 0 ||
    p.pressureAngleRad >= Math.PI / 2
  )
    issue('PRESSURE_ANGLE', 'pressureAngleRad must be in (0,pi/2)');
  for (const key of ['profileSamplesPerLobe', 'gearFlankSamples', 'gearArcSamples'] as const) {
    if (!Number.isInteger(p[key]) || p[key] < 4 || p[key] > 1024)
      issue('SAMPLE_BOUNDS', `${key} must be an integer in [4,1024]`);
  }
  if (issues.length) return { valid: false, issues };
  if (
    ![
      p.eccentricityMm * p.pinCount,
      p.spurModuleMm * (Math.max(p.sunTeeth, p.planetTeeth) / 2 + p.addendumCoefficient),
      p.spurModuleMm * p.dedendumCoefficient,
      p.pinRadiusMm + p.normalReliefMm,
    ].every(Number.isFinite)
  ) {
    issue('DERIVED_NONFINITE', 'Parameter scale overflows derived dimensions');
    return { valid: false, issues };
  }
  const margin = GEOMETRY_MARGIN_FRACTION * p.pinCircleRadiusMm;
  if (!(p.profileChordToleranceMm >= margin))
    issue('CHORD_TOLERANCE', 'Chord tolerance must be at least the scale-aware numerical margin');
  const k1 = (p.eccentricityMm * p.pinCount) / p.pinCircleRadiusMm;
  if (!(k1 > 0 && 1 - k1 > GEOMETRY_MARGIN_FRACTION))
    issue('K1', 'Require 0<K1<1 with 1e-8 margin; no denominator clamp');
  const adjacentPinGapMm =
    2 * (p.pinCircleRadiusMm * Math.sin(Math.PI / p.pinCount) - p.pinRadiusMm);
  if (!(adjacentPinGapMm > margin))
    issue('PIN_CLEARANCE', 'Adjacent physical pins overlap or lack the numerical margin');
  const offset = p.pinRadiusMm + p.normalReliefMm;
  const minimumRadialExtentMm = p.pinCircleRadiusMm - p.eccentricityMm - offset;
  if (!(minimumRadialExtentMm > margin))
    issue('RADIAL_EXTENT', 'Conservative minimum outline radius must be positive');
  const curvature = k1 < 1 ? maximumCenterCurveCurvature(p) : Number.POSITIVE_INFINITY;
  const offsetRegularityMargin = 1 - offset * curvature;
  if (!(offsetRegularityMargin > REGULARITY_MARGIN))
    issue(
      'OFFSET_CUSP',
      'Inward normal offset reaches a local cusp or crosses its regularity margin',
    );
  const sun = spurDimensions(p, p.sunTeeth),
    planet = spurDimensions(p, p.planetTeeth);
  const crankAxisRadiusMm = sun.pitchRadiusMm + planet.pitchRadiusMm;
  const sunTipToPlanetRootClearanceMm = crankAxisRadiusMm - sun.tipRadiusMm - planet.rootRadiusMm;
  const planetTipToSunRootClearanceMm = crankAxisRadiusMm - planet.tipRadiusMm - sun.rootRadiusMm;
  if (!(sunTipToPlanetRootClearanceMm > margin && planetTipToSunRootClearanceMm > margin))
    issue('SPUR_RADIAL_CLEARANCE', 'Each tooth tip must clear the mating root circle');
  const neighboringPlanetTipGapMm =
    2 * crankAxisRadiusMm * Math.sin(Math.PI / 3) - 2 * planet.tipRadiusMm;
  if (!(neighboringPlanetTipGapMm > margin))
    issue('PLANET_CLEARANCE', 'Neighboring planet addendum circles overlap');
  const noUndercutMinimumTeeth = (2 * p.addendumCoefficient) / Math.sin(p.pressureAngleRad) ** 2;
  if (Math.min(p.sunTeeth, p.planetTeeth) < noUndercutMinimumTeeth - 1e-10)
    issue('SPUR_UNDERCUT', 'Unshifted rack-generated no-undercut tooth-count condition fails');
  for (const [name, gear] of [
    ['sun', sun],
    ['planet', planet],
  ] as const) {
    if (!(gear.rootRadiusMm > margin)) issue('SPUR_ROOT', `${name} root circle must be positive`);
    if (!(gear.tipThicknessMm > margin))
      issue('SPUR_TIP', `${name} involute tooth tip is pointed or inverted`);
    if (gear.flankStartRadiusMm >= gear.tipRadiusMm)
      issue('SPUR_RADII', `${name} root/base must be below addendum`);
    if (
      spurHalfThicknessRad(gear, p.pressureAngleRad, gear.flankStartRadiusMm) >=
      Math.PI / gear.teeth
    )
      issue('SPUR_ROOT_SPACE', `${name} flanks leave no root space`);
  }
  const sinAlpha = Math.sin(p.pressureAngleRad);
  const approachMm =
    Math.sqrt(planet.tipRadiusMm ** 2 - planet.baseRadiusMm ** 2) - planet.pitchRadiusMm * sinAlpha;
  const recessMm =
    Math.sqrt(sun.tipRadiusMm ** 2 - sun.baseRadiusMm ** 2) - sun.pitchRadiusMm * sinAlpha;
  const basePitchMm = Math.PI * p.spurModuleMm * Math.cos(p.pressureAngleRad);
  const contactRatio = (approachMm + recessMm) / basePitchMm;
  if (!(contactRatio > 1)) issue('SPUR_CONTACT_RATIO', 'Transverse contact ratio must exceed one');
  if (
    approachMm >= sun.pitchRadiusMm * sinAlpha - margin ||
    recessMm >= planet.pitchRadiusMm * sinAlpha - margin
  )
    issue('SPUR_INTERFERENCE', 'Nominal involute path extends beyond its mate base-circle tangent');
  const metrics: RvMetrics = {
    ratio: reductionRatio(p),
    k1,
    geometryMarginMm: margin,
    adjacentPinGapMm,
    minimumRadialExtentMm,
    maximumCenterCurveCurvaturePerMm: curvature,
    offsetRegularityMargin,
    crankAxisRadiusMm,
    neighboringPlanetTipGapMm,
    noUndercutMinimumTeeth,
    sunTipToPlanetRootClearanceMm,
    planetTipToSunRootClearanceMm,
    sun,
    planet,
    contactRatio,
    approachMm,
    recessMm,
    basePitchMm,
  };
  if (Object.values(metrics).some((value) => typeof value === 'number' && !Number.isFinite(value)))
    issue('DERIVED_NONFINITE', 'Derived geometry is nonfinite');
  return { valid: issues.length === 0, issues, metrics };
}
export function createRvModel(parameters: RvParameters): RvModel {
  const result = validateParameters(parameters);
  if (!result.valid || !result.metrics)
    throw new RangeError(result.issues.map((i) => `${i.code}: ${i.message}`).join('; '));
  return Object.freeze({
    parameters: Object.freeze({ ...parameters }),
    metrics: Object.freeze({
      ...result.metrics,
      sun: Object.freeze(result.metrics.sun),
      planet: Object.freeze(result.metrics.planet),
    }),
  });
}
export function kinematics(model: RvModel, inputAngleRad: number, inputRpm = 0): RvKinematics {
  finite(inputAngleRad, 'inputAngleRad');
  finite(inputRpm, 'inputRpm');
  const carrierAngleRad = inputAngleRad / model.metrics.ratio;
  const crankAngleRad = -model.parameters.lobeCount * carrierAngleRad;
  const outputRpm = inputRpm / model.metrics.ratio,
    crankRpm = -model.parameters.lobeCount * outputRpm;
  return {
    inputAngleRad,
    carrierAngleRad,
    crankAngleRad,
    crankRelativeToCarrierRad: crankAngleRad - carrierAngleRad,
    inputRpm,
    outputRpm,
    crankRpm,
    crankRelativeToCarrierRpm: crankRpm - outputRpm,
    inputRadPerSecond: rpmToRadiansPerSecond(inputRpm),
    outputRadPerSecond: rpmToRadiansPerSecond(outputRpm),
    crankRadPerSecond: rpmToRadiansPerSecond(crankRpm),
  };
}
export function planetPose(model: RvModel, state: RvKinematics, index: number): PlanetPose {
  indexInRange(index, 3, 'planetIndex');
  const p = model.parameters,
    beta = (TAU * index) / 3;
  // Odd/even tooth-count parity for a tooth-center-at-zero outline convention.
  const meshOffset = p.planetTeeth % 2 === 0 ? Math.PI / p.planetTeeth : 0;
  const fixedGearToCrankIndexRad = (1 + p.sunTeeth / p.planetTeeth) * beta + meshOffset;
  return {
    index,
    carrierIndexRad: beta,
    axisMm: scale(unit(state.carrierAngleRad + beta), model.metrics.crankAxisRadiusMm),
    gearAngleRad: state.crankAngleRad + fixedGearToCrankIndexRad,
    crankAngleRad: state.crankAngleRad,
    fixedGearToCrankIndexRad,
  };
}
export function discPose(model: RvModel, state: RvKinematics, discIndex: DiscIndex): DiscPose {
  indexInRange(discIndex, 2, 'discIndex');
  const gamma = discIndex * Math.PI,
    eccentricAngleRad = state.crankAngleRad + gamma;
  const outlineIndexRad = -gamma / model.parameters.lobeCount;
  return {
    centerMm: scale(unit(eccentricAngleRad), model.parameters.eccentricityMm),
    structuralAngleRad: state.carrierAngleRad,
    outlineAngleRad: state.carrierAngleRad + outlineIndexRad,
    eccentricAngleRad,
    outlineIndexRad,
  };
}
/** Holes use structuralAngleRad; the half-lobe tooth index must never rotate the holes. */
export function discHoleCenter(
  model: RvModel,
  state: RvKinematics,
  disc: DiscIndex,
  planet: number,
): Point2 {
  indexInRange(planet, 3, 'planetIndex');
  const pose = discPose(model, state, disc);
  return add(
    pose.centerMm,
    scale(unit(pose.structuralAngleRad + (TAU * planet) / 3), model.metrics.crankAxisRadiusMm),
  );
}
export function crankJournalCenter(
  model: RvModel,
  state: RvKinematics,
  disc: DiscIndex,
  planet: number,
): Point2 {
  return add(planetPose(model, state, planet).axisMm, discPose(model, state, disc).centerMm);
}
export function centerCurveGeometry(
  model: RvModel,
  parameterRad: number,
): {
  centerCurveMm: Point2;
  outwardNormal: Point2;
  centerCurveDerivativeMm: Point2;
  curvaturePerMm: number;
} {
  finite(parameterRad, 'parameterRad');
  const p = model.parameters,
    u = unit(parameterRad),
    v = unit(p.pinCount * parameterRad);
  const w = subtract(scale(u, p.pinCircleRadiusMm), scale(v, p.eccentricityMm * p.pinCount));
  const wLength = length(w); // K1 validation guarantees strictly positive; never clamp.
  const d = wLength / p.pinCircleRadiusMm;
  const curvaturePerMm =
    (1 +
      p.pinCount * model.metrics.k1 ** 2 -
      (p.pinCount + 1) * model.metrics.k1 * Math.cos(p.lobeCount * parameterRad)) /
    (p.pinCircleRadiusMm * d ** 3);
  return {
    centerCurveMm: subtract(scale(u, p.pinCircleRadiusMm), scale(v, p.eccentricityMm)),
    outwardNormal: scale(w, 1 / wLength),
    centerCurveDerivativeMm: perpendicular(w),
    curvaturePerMm,
  };
}
export function cycloidPoint(model: RvModel, parameterRad: number): Point2 {
  const q = centerCurveGeometry(model, parameterRad);
  return subtract(
    q.centerCurveMm,
    scale(q.outwardNormal, model.parameters.pinRadiusMm + model.parameters.normalReliefMm),
  );
}
export function cycloidTangent(model: RvModel, parameterRad: number): Point2 {
  const q = centerCurveGeometry(model, parameterRad);
  return scale(
    q.centerCurveDerivativeMm,
    1 - (model.parameters.pinRadiusMm + model.parameters.normalReliefMm) * q.curvaturePerMm,
  );
}
/** CCW full closed outline. Final vertex is an exact copy of the first. */
export function sampleCycloidProfile(
  model: RvModel,
  samplesPerLobe = model.parameters.profileSamplesPerLobe,
): Point2[] {
  if (!Number.isInteger(samplesPerLobe) || samplesPerLobe < 4 || samplesPerLobe > 1024)
    throw new RangeError('samplesPerLobe must be in [4,1024]');
  const count = model.parameters.lobeCount * samplesPerLobe;
  const points = Array.from({ length: count }, (_, i) => cycloidPoint(model, (TAU * i) / count));
  points.push({ ...points[0]! });
  return points;
}
export interface AdaptiveCycloidProfile {
  points: Point2[];
  toleranceMm: number;
  maximumSampledChordErrorMm: number;
  maximumChordErrorBoundMm: number;
  verticesPerLobe: number;
  parametersPerLobeRad: number[];
}
/**
 * Conservative bound for q'' on one interval of the first lobe. With
 * q=C-r*n, n=exp(i*phi), |q''| <= R+e*N^2+r*(phi'^2+|phi''|).
 * phi' is monotone in cos((N-1)t); its endpoint/extremum values therefore bound
 * the whole interval. The sine maximum and the positive denominator minimum
 * separately bound phi''. Stable half-angle denominators resolve the K->1 seam.
 */
function cycloidSecondDerivativeBound(model: RvModel, lo: number, hi: number): number {
  const p = model.parameters,
    n = p.pinCount,
    lobes = p.lobeCount,
    k = model.metrics.k1;
  const a = lobes * lo,
    b = lobes * hi,
    extrema = [a, b];
  for (const theta of [0, Math.PI, TAU]) if (theta >= a && theta <= b) extrema.push(theta);
  const denominator = (theta: number) => (1 - k) ** 2 + 4 * k * Math.sin(theta / 2) ** 2;
  const minimumDenominator = Math.min(...extrema.map(denominator));
  const maximumPhiPrime = Math.max(
    ...extrema.map((theta) =>
      Math.abs(
        ((1 - k) * (1 - n * k) + 2 * (n + 1) * k * Math.sin(theta / 2) ** 2) / denominator(theta),
      ),
    ),
  );
  let maximumSine = Math.max(Math.abs(Math.sin(a)), Math.abs(Math.sin(b)));
  for (const theta of [Math.PI / 2, (3 * Math.PI) / 2])
    if (theta >= a && theta <= b) maximumSine = 1;
  const maximumPhiSecond = (lobes ** 2 * k * (1 - k * k) * maximumSine) / minimumDenominator ** 2;
  return (
    (p.pinCircleRadiusMm +
      p.eccentricityMm * n ** 2 +
      (p.pinRadiusMm + p.normalReliefMm) * (maximumPhiPrime ** 2 + maximumPhiSecond)) *
    (1 + 1e-12)
  );
}
/**
 * Render/extrusion outline. Accept a chord only when h^2*sup|q''|/8 is below
 * tolerance (linear interpolation remainder), not merely when a few probes pass.
 * Quarter/midpoint probes are retained as diagnostic evidence. The real-arithmetic
 * bound includes a floating-point guard; it is not a manufacturing certificate.
 */
export function sampleAdaptiveCycloidProfile(
  model: RvModel,
  toleranceMm = model.parameters.profileChordToleranceMm,
): AdaptiveCycloidProfile {
  finite(toleranceMm, 'toleranceMm');
  if (toleranceMm < model.metrics.geometryMarginMm)
    throw new RangeError('Chord tolerance is below the numerical geometry margin');
  const pitch = TAU / model.parameters.lobeCount,
    lobe: Point2[] = [cycloidPoint(model, 0)];
  const parametersPerLobeRad = [0];
  let maximumSampledChordErrorMm = 0,
    maximumChordErrorBoundMm = 0;
  const subdivide = (lo: number, hi: number, a: Point2, b: Point2, depth: number): void => {
    const bound = ((hi - lo) ** 2 * cycloidSecondDerivativeBound(model, lo, hi)) / 8;
    if (bound > toleranceMm * (1 - 1e-10)) {
      if (depth >= 40)
        throw new RangeError('Adaptive chord bound did not converge within 40 subdivisions');
      const mid = (lo + hi) / 2,
        middlePoint = cycloidPoint(model, mid);
      subdivide(lo, mid, a, middlePoint, depth + 1);
      subdivide(mid, hi, middlePoint, b, depth + 1);
    } else {
      const sampled = Math.max(
        ...[0.25, 0.5, 0.75].map((fraction) =>
          distanceToSegmentMm(cycloidPoint(model, lo + fraction * (hi - lo)), a, b),
        ),
      );
      if (sampled > bound + model.metrics.geometryMarginMm)
        throw new RangeError('Adaptive derivative bound failed its diagnostic probes');
      maximumSampledChordErrorMm = Math.max(maximumSampledChordErrorMm, sampled);
      maximumChordErrorBoundMm = Math.max(maximumChordErrorBoundMm, bound);
      lobe.push(b);
      parametersPerLobeRad.push(hi);
    }
  };
  for (let i = 0; i < 4; i++)
    subdivide(
      (pitch * i) / 4,
      (pitch * (i + 1)) / 4,
      cycloidPoint(model, (pitch * i) / 4),
      cycloidPoint(model, (pitch * (i + 1)) / 4),
      0,
    );
  const verticesPerLobe = lobe.length - 1,
    points: Point2[] = [];
  for (let sector = 0; sector < model.parameters.lobeCount; sector++) {
    for (let j = 0; j < verticesPerLobe; j++) points.push(rotate(lobe[j]!, pitch * sector));
  }
  points.push({ ...points[0]! });
  return {
    points,
    toleranceMm,
    maximumSampledChordErrorMm,
    maximumChordErrorBoundMm,
    verticesPerLobe,
    parametersPerLobeRad,
  };
}
/** Exact involute flanks with tip/root arcs; sub-base transition is schematic radial geometry. */
export function sampleSpurProfile(model: RvModel, kind: 'sun' | 'planet'): Point2[] {
  const p = model.parameters,
    g = model.metrics[kind],
    points: Point2[] = [];
  const append = (radius: number, angle: number) => {
    const q = scale(unit(angle), radius),
      last = points.at(-1);
    if (!last || length(subtract(last, q)) > 1e-12 * g.tipRadiusMm) points.push(q);
  };
  const psi = (radius: number) => spurHalfThicknessRad(g, p.pressureAngleRad, radius);
  const rootPsi = psi(g.flankStartRadiusMm),
    tipPsi = psi(g.tipRadiusMm);
  for (let tooth = 0; tooth < g.teeth; tooth++) {
    const center = (TAU * tooth) / g.teeth;
    append(g.rootRadiusMm, center - rootPsi);
    for (let j = 0; j <= p.gearFlankSamples; j++) {
      const radius =
        g.flankStartRadiusMm + ((g.tipRadiusMm - g.flankStartRadiusMm) * j) / p.gearFlankSamples;
      append(radius, center - psi(radius));
    }
    for (let j = 1; j <= p.gearArcSamples; j++)
      append(g.tipRadiusMm, center - tipPsi + (2 * tipPsi * j) / p.gearArcSamples);
    for (let j = p.gearFlankSamples - 1; j >= 0; j--) {
      const radius =
        g.flankStartRadiusMm + ((g.tipRadiusMm - g.flankStartRadiusMm) * j) / p.gearFlankSamples;
      append(radius, center + psi(radius));
    }
    append(g.rootRadiusMm, center + rootPsi);
    for (let j = 1; j <= p.gearArcSamples; j++)
      append(
        g.rootRadiusMm,
        center + rootPsi + ((TAU / g.teeth - 2 * rootPsi) * j) / p.gearArcSamples,
      );
  }
  if (length(subtract(points.at(-1)!, points[0]!)) <= 1e-12 * g.tipRadiusMm)
    points[points.length - 1] = { ...points[0]! };
  else points.push({ ...points[0]! });
  return points;
}
export function profilePointWorld(
  model: RvModel,
  state: RvKinematics,
  disc: DiscIndex,
  parameterRad: number,
): Point2 {
  const pose = discPose(model, state, disc);
  return add(pose.centerMm, rotate(cycloidPoint(model, parameterRad), pose.outlineAngleRad));
}
export function pinCenter(model: RvModel, index: number): Point2 {
  indexInRange(index, model.parameters.pinCount, 'pinIndex');
  return scale(unit((TAU * index) / model.parameters.pinCount), model.parameters.pinCircleRadiusMm);
}
/** Nominal geometric marker, not a force/load-sharing or simultaneous no-slip solution. */
export function pinContact(
  model: RvModel,
  state: RvKinematics,
  disc: DiscIndex,
  pin: number,
): ContactSample {
  const p = model.parameters,
    pose = discPose(model, state, disc),
    pinCenterMm = pinCenter(model, pin);
  const w = subtract(pinCenterMm, scale(pose.centerMm, p.pinCount)),
    normal = scale(w, 1 / length(w));
  const pointMm = subtract(pinCenterMm, scale(normal, p.pinRadiusMm));
  const parameterRad = (TAU * pin) / p.pinCount - pose.outlineAngleRad;
  const outlinePointMm = profilePointWorld(model, state, disc, parameterRad);
  const tangent = rotate(cycloidTangent(model, parameterRad), pose.outlineAngleRad);
  // Velocity at the nominal outline point; relief moves this point inward by h.
  const materialVelocityMmPerSecond = add(
    scale(perpendicular(pose.centerMm), state.crankRadPerSecond),
    scale(perpendicular(subtract(outlinePointMm, pose.centerMm)), state.outputRadPerSecond),
  );
  const tangentialVelocityMmPerSecond = dot(materialVelocityMmPerSecond, perpendicular(normal));
  return {
    pinCenterMm,
    pointMm,
    outlinePointMm,
    normal,
    tangent,
    parameterRad,
    materialVelocityMmPerSecond,
    normalVelocityMmPerSecond: dot(materialVelocityMmPerSecond, normal),
    tangentialVelocityMmPerSecond,
    independentPinMatchingRpm:
      p.normalReliefMm === 0
        ? radiansPerSecondToRpm(-tangentialVelocityMmPerSecond / p.pinRadiusMm)
        : null,
    exactNominalTangency: p.normalReliefMm === 0,
  };
}

function openVertexCount(points: readonly Point2[]): number {
  const first = points[0],
    last = points.at(-1);
  return first !== undefined &&
    last !== undefined &&
    points.length > 1 &&
    first.x === last.x &&
    first.y === last.y
    ? points.length - 1
    : points.length;
}
export function signedArea(points: readonly Point2[]): number {
  const count = openVertexCount(points);
  let twiceArea = 0;
  for (let i = 0; i < count; i++) twiceArea += cross(points[i]!, points[(i + 1) % count]!);
  return twiceArea / 2;
}
export function distanceToSegmentMm(p: Point2, a: Point2, b: Point2): number {
  const ab = subtract(b, a),
    denominator = dot(ab, ab);
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, dot(subtract(p, a), ab) / denominator));
  return length(subtract(p, add(a, scale(ab, t))));
}
export function polygonContainsPoint(points: readonly Point2[], p: Point2): boolean {
  const count = openVertexCount(points);
  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function minimumPolygonDistanceMm(points: readonly Point2[], p: Point2): number {
  const count = openVertexCount(points);
  let minimum = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++)
    minimum = Math.min(minimum, distanceToSegmentMm(p, points[i]!, points[(i + 1) % count]!));
  return minimum;
}
/** Sweep broad phase; robust distance check also catches touching nonadjacent edges. */
export function findSelfIntersection(
  points: readonly Point2[],
  toleranceMm = 1e-10,
): [number, number] | null {
  const count = openVertexCount(points);
  const edges = Array.from({ length: count }, (_, index) => {
    const a = points[index]!,
      b = points[(index + 1) % count]!;
    return {
      index,
      a,
      b,
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    };
  }).sort((a, b) => a.minX - b.minX);
  for (let i = 0; i < count; i++) {
    const a = edges[i]!;
    for (let j = i + 1; j < count && edges[j]!.minX <= a.maxX + toleranceMm; j++) {
      const b = edges[j]!,
        indexDelta = Math.abs(a.index - b.index);
      if (
        indexDelta === 1 ||
        indexDelta === count - 1 ||
        b.minY > a.maxY + toleranceMm ||
        b.maxY < a.minY - toleranceMm
      )
        continue;
      const ac = cross(subtract(a.b, a.a), subtract(b.a, a.a)),
        ad = cross(subtract(a.b, a.a), subtract(b.b, a.a));
      const ca = cross(subtract(b.b, b.a), subtract(a.a, b.a)),
        cb = cross(subtract(b.b, b.a), subtract(a.b, b.a));
      const crossing =
        ((ac > 0 && ad < 0) || (ac < 0 && ad > 0)) && ((ca > 0 && cb < 0) || (ca < 0 && cb > 0));
      const touching =
        Math.min(
          distanceToSegmentMm(a.a, b.a, b.b),
          distanceToSegmentMm(a.b, b.a, b.b),
          distanceToSegmentMm(b.a, a.a, a.b),
          distanceToSegmentMm(b.b, a.a, a.b),
        ) <= toleranceMm;
      if (crossing || touching) return [a.index, b.index];
    }
  }
  return null;
}
/**
 * Numerical GLOBAL candidate search followed by analytic-curve minimization in each
 * sampled local-minimum bracket. This is evidence at the stated resolution, not a proof.
 */
export function closestProfilePoint(
  model: RvModel,
  targetLocalMm: Point2,
  samplesPerLobe = 64,
): {
  pointMm: Point2;
  parameterRad: number;
  distanceMm: number;
  candidateCount: number;
} {
  if (!Number.isInteger(samplesPerLobe) || samplesPerLobe < 4 || samplesPerLobe > 1024)
    throw new RangeError('samplesPerLobe must be in [4,1024]');
  const count = model.parameters.lobeCount * samplesPerLobe,
    step = TAU / count;
  const squared = (t: number) => {
    const v = subtract(cycloidPoint(model, t), targetLocalMm);
    return dot(v, v);
  };
  const values = Array.from({ length: count }, (_, i) => squared(i * step));
  let bestValue = Number.POSITIVE_INFINITY,
    bestT = 0,
    candidateCount = 0;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < count; i++) {
    if (values[i]! > values[(i - 1 + count) % count]! || values[i]! > values[(i + 1) % count]!)
      continue;
    candidateCount++;
    let lo = (i - 1) * step,
      hi = (i + 1) * step;
    let left = hi - phi * (hi - lo),
      right = lo + phi * (hi - lo),
      fl = squared(left),
      fr = squared(right);
    for (let iteration = 0; iteration < 64; iteration++) {
      if (fl < fr) {
        hi = right;
        right = left;
        fr = fl;
        left = hi - phi * (hi - lo);
        fl = squared(left);
      } else {
        lo = left;
        left = right;
        fl = fr;
        right = lo + phi * (hi - lo);
        fr = squared(right);
      }
    }
    const t = (lo + hi) / 2,
      value = squared(t);
    if (value < bestValue) {
      bestValue = value;
      bestT = t;
    }
  }
  return {
    pointMm: cycloidPoint(model, bestT),
    parameterRad: bestT,
    distanceMm: Math.sqrt(bestValue),
    candidateCount,
  };
}
export function measurePinClearance(
  model: RvModel,
  state: RvKinematics,
  disc: DiscIndex,
  pin: number,
  samplesPerLobe = 64,
  polygonOverride?: readonly Point2[],
): {
  analyticMinimumGapMm: number;
  polygonMinimumGapMm: number;
  pinCenterInsidePolygon: boolean;
  candidateCount: number;
} {
  const pose = discPose(model, state, disc);
  const localPin = rotate(subtract(pinCenter(model, pin), pose.centerMm), -pose.outlineAngleRad);
  const closest = closestProfilePoint(model, localPin, samplesPerLobe),
    polygon = polygonOverride ?? sampleCycloidProfile(model, samplesPerLobe);
  return {
    analyticMinimumGapMm: closest.distanceMm - model.parameters.pinRadiusMm,
    polygonMinimumGapMm: minimumPolygonDistanceMm(polygon, localPin) - model.parameters.pinRadiusMm,
    pinCenterInsidePolygon: polygonContainsPoint(polygon, localPin),
    candidateCount: closest.candidateCount,
  };
}
/** Global polyline acceptance is deliberately separate from cheap analytic parameter guards. */
export function validateSampledProfiles(
  model: RvModel,
  samplesPerLobe = model.parameters.profileSamplesPerLobe,
): {
  valid: boolean;
  issues: ValidationIssue[];
  cycloidVertexCount: number;
} {
  const issues: ValidationIssue[] = [],
    cycloid = sampleCycloidProfile(model, samplesPerLobe);
  for (const [name, points] of [
    ['cycloid', cycloid],
    ['sun', sampleSpurProfile(model, 'sun')],
    ['planet', sampleSpurProfile(model, 'planet')],
  ] as const) {
    if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      issues.push({ code: 'NONFINITE_PROFILE', message: `${name} contains nonfinite points` });
    if (!(signedArea(points) > 0))
      issues.push({ code: 'PROFILE_WINDING', message: `${name} must have positive CCW area` });
    const crossing = findSelfIntersection(points, 1e-10 * model.parameters.pinCircleRadiusMm);
    if (crossing)
      issues.push({
        code: 'SELF_INTERSECTION',
        message: `${name} nonadjacent segments ${crossing[0]},${crossing[1]} intersect`,
      });
  }
  return { valid: issues.length === 0, issues, cycloidVertexCount: cycloid.length };
}
