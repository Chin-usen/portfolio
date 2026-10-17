/** Millimetres; teaching proportions, not manufacturing or vendor dimensions. */
export interface RobotJointParameters {
  boreRadiusMm: number;
  housingOuterRadiusMm: number;
  radialSegments: number;
  statorSlots: number;
  bearingRollers: number;
}
export const ROBOT_JOINT_DEFAULT_PARAMETERS: Readonly<RobotJointParameters> = Object.freeze({
  boreRadiusMm: 8,
  housingOuterRadiusMm: 67,
  radialSegments: 96,
  statorSlots: 24,
  bearingRollers: 24,
});
export function validateRobotJointParameters(p: RobotJointParameters) {
  if (
    !Number.isFinite(p.boreRadiusMm) ||
    p.boreRadiusMm <= 0 ||
    !Number.isFinite(p.housingOuterRadiusMm) ||
    p.housingOuterRadiusMm <= p.boreRadiusMm * 6 ||
    !Number.isInteger(p.radialSegments) ||
    p.radialSegments < 48 ||
    p.radialSegments > 192 ||
    !Number.isInteger(p.statorSlots) ||
    p.statorSlots < 12 ||
    p.statorSlots > 48 ||
    !Number.isInteger(p.bearingRollers) ||
    p.bearingRollers < 12 ||
    p.bearingRollers > 48
  )
    throw new RangeError('Invalid generic robot joint parameters');
  // Scale all radial/axial dimensions together so every interface and clearance is retained.
  if (Math.abs(p.boreRadiusMm / p.housingOuterRadiusMm - 8 / 67) > 1e-10)
    throw new RangeError('Bore and housing must use the same uniform scale');
  return p.housingOuterRadiusMm / 67;
}
