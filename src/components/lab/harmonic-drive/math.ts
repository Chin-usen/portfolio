/** Generic strain-wave kinematics. Dimensions mm; angles radians; positive CCW.
 * The cosine deformation is an educational approximation, not an elastic/contact solver.
 * Circular spline is fixed, wave generator input, cup flexspline output.
 */
export interface HarmonicParameters {
  flexTeeth: number;
  circularTeeth: number;
  moduleMm: number;
  deformationScale: number;
}
export interface HarmonicMetrics {
  ratio: number;
  toothDifference: number;
  flexPitchRadiusMm: number;
  circularPitchRadiusMm: number;
  nominalDeformationMm: number;
  displayDeformationMm: number;
  circularDisplayOffsetMm: number;
  schematicToothClearanceMm: number;
}
export interface HarmonicModel {
  readonly parameters: Readonly<HarmonicParameters>;
  readonly metrics: Readonly<HarmonicMetrics>;
}
export interface HarmonicKinematics {
  inputAngleRad: number;
  outputAngleRad: number;
  inputRpm: number;
  outputRpm: number;
  inputRadPerSecond: number;
  outputRadPerSecond: number;
  engagementAngles: [number, number];
}
export const TAU = 2 * Math.PI;
function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}
export function validateParameters(parameters: HarmonicParameters) {
  const issues: { code: string; message: string }[] = [];
  const issue = (code: string, message: string) => issues.push({ code, message });
  if (
    !Number.isSafeInteger(parameters.flexTeeth) ||
    parameters.flexTeeth < 80 ||
    parameters.flexTeeth > 240 ||
    parameters.flexTeeth % 2 !== 0
  )
    issue('FLEX_TEETH', 'flexTeeth must be even, from 80 through 240');
  if (parameters.circularTeeth !== parameters.flexTeeth + 2)
    issue('TOOTH_DIFFERENCE', 'circularTeeth must equal flexTeeth + 2');
  if (!Number.isFinite(parameters.moduleMm) || parameters.moduleMm < 0.1 || parameters.moduleMm > 2)
    issue('MODULE', 'moduleMm must be finite in [0.1,2]');
  if (
    !Number.isFinite(parameters.deformationScale) ||
    parameters.deformationScale < 1 ||
    parameters.deformationScale > 8
  )
    issue('DEFORMATION_SCALE', 'deformationScale must be finite in [1,8]');
  return { valid: issues.length === 0, issues };
}
export function createHarmonicModel(parameters: HarmonicParameters): HarmonicModel {
  const validation = validateParameters(parameters);
  if (!validation.valid)
    throw new RangeError(validation.issues.map((v) => `${v.code}: ${v.message}`).join('; '));
  const { flexTeeth, circularTeeth, moduleMm, deformationScale } = parameters;
  const toothDifference = circularTeeth - flexTeeth;
  const nominalDeformationMm = (moduleMm * toothDifference) / 2;
  const displayDeformationMm = nominalDeformationMm * deformationScale;
  return Object.freeze({
    parameters: Object.freeze({ ...parameters }),
    metrics: Object.freeze({
      ratio: -flexTeeth / toothDifference,
      toothDifference,
      flexPitchRadiusMm: (moduleMm * flexTeeth) / 2,
      circularPitchRadiusMm: (moduleMm * circularTeeth) / 2,
      nominalDeformationMm,
      displayDeformationMm,
      // A deliberate clearance isolates schematic teeth; no amplified contact is claimed.
      circularDisplayOffsetMm: displayDeformationMm - nominalDeformationMm + 1.6 * moduleMm,
      schematicToothClearanceMm: 0.4 * moduleMm,
    }),
  });
}
export function rpmToRadiansPerSecond(rpm: number) {
  finite(rpm, 'rpm');
  const result = (rpm / 60) * TAU;
  finite(result, 'angular speed');
  return result;
}
export function kinematics(
  model: HarmonicModel,
  inputAngleRad: number,
  inputRpm = 0,
): HarmonicKinematics {
  finite(inputAngleRad, 'inputAngleRad');
  finite(inputRpm, 'inputRpm');
  return {
    inputAngleRad,
    outputAngleRad: inputAngleRad / model.metrics.ratio,
    inputRpm,
    outputRpm: inputRpm / model.metrics.ratio,
    inputRadPerSecond: rpmToRadiansPerSecond(inputRpm),
    outputRadPerSecond: rpmToRadiansPerSecond(inputRpm / model.metrics.ratio),
    engagementAngles: [inputAngleRad, inputAngleRad + Math.PI],
  };
}
/** Spatial angle, not material angle. Display amplification never changes nominal w0. */
export function radialDeformationMm(
  model: HarmonicModel,
  azimuthRad: number,
  inputAngleRad: number,
  amplified = false,
) {
  finite(azimuthRad, 'azimuthRad');
  finite(inputAngleRad, 'inputAngleRad');
  const amplitude = amplified
    ? model.metrics.displayDeformationMm
    : model.metrics.nominalDeformationMm;
  return amplitude * Math.cos(2 * ((azimuthRad % TAU) - (inputAngleRad % TAU)));
}
/** A labeled tooth is material: it follows the slow output while the wave passes through it. */
export function flexToothPosition(
  model: HarmonicModel,
  index: number,
  inputAngleRad: number,
  amplified = true,
) {
  if (!Number.isInteger(index) || index < 0 || index >= model.parameters.flexTeeth)
    throw new RangeError('tooth index out of range');
  const state = kinematics(model, inputAngleRad);
  const angleRad = (TAU * index) / model.parameters.flexTeeth + state.outputAngleRad;
  const radiusMm =
    model.metrics.flexPitchRadiusMm +
    radialDeformationMm(model, angleRad, inputAngleRad, amplified);
  return { angleRad, radiusMm, x: radiusMm * Math.cos(angleRad), y: radiusMm * Math.sin(angleRad) };
}
