/** Stable semantic selection IDs for this original generic joint schematic. */
export const ROBOT_JOINT_PART_IDS = [
  'housing',
  'motor-stator',
  'motor-rotor',
  'harmonic-reducer',
  'motor-encoder',
  'output-encoder',
  'fail-safe-brake',
  'driver-board',
  'cross-roller-bearing',
  'hollow-shaft',
  'thermal-pad',
  'front-cover',
  'rear-cover',
  'output-flange',
] as const;
export type RobotJointPartId = (typeof ROBOT_JOINT_PART_IDS)[number];
export type RobotJointMode = 'whole' | 'mechanism';
export const ROBOT_JOINT_HIDDEN_IN_MECHANISM: readonly RobotJointPartId[] = [
  'housing',
  'front-cover',
  'rear-cover',
];
