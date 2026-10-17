import type { RobotJointPartId } from './parts';

/** Functional boundaries, not an electrical wiring or safety circuit diagram. */
export const ROBOT_JOINT_FLOW_NODES = [
  { id: 'dc-bus', partId: 'driver-board', x: '4%', y: 6, width: '48%', external: true },
  { id: 'driver', partId: 'driver-board', x: '4%', y: 92, width: '48%', external: false },
  { id: 'motor', partId: 'motor-stator', x: '4%', y: 178, width: '48%', external: false },
  { id: 'reducer', partId: 'harmonic-reducer', x: '4%', y: 264, width: '48%', external: false },
  { id: 'output', partId: 'output-flange', x: '4%', y: 350, width: '48%', external: false },
  {
    id: 'motor-feedback',
    partId: 'motor-encoder',
    x: '60%',
    y: 178,
    width: '36%',
    external: false,
  },
  { id: 'brake', partId: 'fail-safe-brake', x: '60%', y: 264, width: '36%', external: false },
  {
    id: 'output-feedback',
    partId: 'output-encoder',
    x: '60%',
    y: 350,
    width: '36%',
    external: false,
  },
] as const satisfies readonly {
  id: string;
  partId: RobotJointPartId;
  x: string;
  y: number;
  width: string;
  external: boolean;
}[];
export type RobotJointFlowNodeId = (typeof ROBOT_JOINT_FLOW_NODES)[number]['id'];
export type RobotJointFlowKind = 'power' | 'mechanical' | 'feedback' | 'control';
export const ROBOT_JOINT_FLOW_EDGES = [
  { id: 'dc-power', from: 'dc-bus', to: 'driver', kind: 'power', path: 'M 90 60 V 90' },
  { id: 'motor-power', from: 'driver', to: 'motor', kind: 'power', path: 'M 90 146 V 176' },
  { id: 'motor-torque', from: 'motor', to: 'reducer', kind: 'mechanical', path: 'M 90 232 V 262' },
  {
    id: 'output-torque',
    from: 'reducer',
    to: 'output',
    kind: 'mechanical',
    path: 'M 90 318 V 348',
  },
  {
    id: 'motor-signal',
    from: 'motor-feedback',
    to: 'driver',
    kind: 'feedback',
    path: 'M 250 178 V 162 H 179 V 119 H 169',
  },
  {
    id: 'output-signal',
    from: 'output-feedback',
    to: 'driver',
    kind: 'feedback',
    path: 'M 307 377 H 315 V 154 H 172 V 133 H 169',
  },
  {
    id: 'brake-command',
    from: 'driver',
    to: 'brake',
    kind: 'control',
    path: 'M 166 105 H 186 V 291 H 190',
  },
] as const satisfies readonly {
  id: string;
  from: RobotJointFlowNodeId;
  to: RobotJointFlowNodeId;
  kind: RobotJointFlowKind;
  path: string;
}[];
export function flowNodesForPart(partId: string): RobotJointFlowNodeId[] {
  const mapped = partId === 'motor-rotor' ? 'motor-stator' : partId;
  return ROBOT_JOINT_FLOW_NODES.filter((node) => node.partId === mapped).map((node) => node.id);
}
export function flowEdgesForPart(partId: string): string[] {
  const active = new Set(flowNodesForPart(partId));
  return ROBOT_JOINT_FLOW_EDGES.filter((edge) => active.has(edge.from) || active.has(edge.to)).map(
    (edge) => edge.id,
  );
}
