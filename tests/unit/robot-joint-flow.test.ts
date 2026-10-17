import { describe, expect, test } from 'vitest';
import {
  ROBOT_JOINT_FLOW_EDGES,
  ROBOT_JOINT_FLOW_NODES,
  flowEdgesForPart,
  flowNodesForPart,
} from '../../src/components/lab/robot-joint/flow';
import { ROBOT_JOINT_PART_IDS } from '../../src/components/lab/robot-joint/parts';

describe('robot joint functional flow boundaries', () => {
  test('each diagram node selects a real semantic part and each arrow joins real nodes', () => {
    const parts = new Set<string>(ROBOT_JOINT_PART_IDS);
    const nodes = new Set<string>(ROBOT_JOINT_FLOW_NODES.map((node) => node.id));
    expect(nodes.size).toBe(ROBOT_JOINT_FLOW_NODES.length);
    expect(new Set(ROBOT_JOINT_FLOW_EDGES.map((edge) => edge.id)).size).toBe(
      ROBOT_JOINT_FLOW_EDGES.length,
    );
    for (const node of ROBOT_JOINT_FLOW_NODES) expect(parts.has(node.partId), node.id).toBe(true);
    for (const edge of ROBOT_JOINT_FLOW_EDGES) {
      expect(nodes.has(edge.from), edge.id).toBe(true);
      expect(nodes.has(edge.to), edge.id).toBe(true);
      expect(edge.from).not.toBe(edge.to);
    }
  });

  test('electrical power becomes mechanical output through the motor and reducer in order', () => {
    const forward = ROBOT_JOINT_FLOW_EDGES.filter(
      (edge) => edge.kind === 'power' || edge.kind === 'mechanical',
    );
    const route: string[] = ['dc-bus'];
    const kinds: string[] = [];
    while (route.at(-1) !== 'output') {
      const next = forward.filter((edge) => edge.from === route.at(-1));
      expect(
        next,
        'the forward power path must neither branch ambiguously nor stop early',
      ).toHaveLength(1);
      expect(route).not.toContain(next[0]!.to);
      route.push(next[0]!.to);
      kinds.push(next[0]!.kind);
    }
    expect(route).toEqual(['dc-bus', 'driver', 'motor', 'reducer', 'output']);
    expect(kinds).toEqual(['power', 'power', 'mechanical', 'mechanical']);
    expect(forward).toHaveLength(kinds.length);
  });

  test('two independent encoder feedbacks and the brake command cannot be mistaken for torque transfer', () => {
    const feedback = ROBOT_JOINT_FLOW_EDGES.filter((edge) => edge.kind === 'feedback');
    expect(feedback.map((edge) => edge.from).sort()).toEqual(['motor-feedback', 'output-feedback']);
    expect(feedback.every((edge) => edge.to === 'driver')).toBe(true);
    const encoderParts = feedback.map(
      (edge) => ROBOT_JOINT_FLOW_NODES.find((node) => node.id === edge.from)!.partId,
    );
    expect(encoderParts.sort()).toEqual(['motor-encoder', 'output-encoder']);
    const control = ROBOT_JOINT_FLOW_EDGES.filter((edge) => edge.kind === 'control');
    expect(control.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 'driver', to: 'brake' },
    ]);
    expect(ROBOT_JOINT_FLOW_EDGES.filter((edge) => [edge.from, edge.to].includes('brake'))).toEqual(
      control,
    );
  });

  test('both motor halves share one motor boundary while the external DC bus is explicitly identified', () => {
    expect(flowNodesForPart('motor-stator')).toEqual(['motor']);
    expect(flowNodesForPart('motor-rotor')).toEqual(['motor']);
    expect(flowEdgesForPart('motor-rotor')).toEqual(flowEdgesForPart('motor-stator'));
    expect(ROBOT_JOINT_FLOW_NODES.filter((node) => node.external).map((node) => node.id)).toEqual([
      'dc-bus',
    ]);
    expect(flowNodesForPart('driver-board').sort()).toEqual(['dc-bus', 'driver']);
    expect(flowEdgesForPart('motor-encoder')).toEqual(['motor-signal']);
    expect(flowEdgesForPart('output-encoder')).toEqual(['output-signal']);
    expect(flowEdgesForPart('fail-safe-brake')).toEqual(['brake-command']);
  });

  test('structural and thermal selections stay neutral instead of inventing a signal function', () => {
    for (const id of [
      'housing',
      'cross-roller-bearing',
      'hollow-shaft',
      'thermal-pad',
      'front-cover',
      'rear-cover',
      'unknown-part',
    ]) {
      expect(flowNodesForPart(id), id).toEqual([]);
      expect(flowEdgesForPart(id), id).toEqual([]);
    }
  });
});
