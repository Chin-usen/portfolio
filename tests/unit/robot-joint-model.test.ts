import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { createRobotJointAssembly } from '../../src/components/lab/robot-joint/geometry';
import { ROBOT_JOINT_PART_IDS } from '../../src/components/lab/robot-joint/parts';
import { ROBOT_JOINT_DEFAULT_PARAMETERS } from '../../src/components/lab/robot-joint/params';

function digest() {
  const assembly = createRobotJointAssembly();
  const hash = createHash('sha256');
  try {
    for (const part of assembly.parts) {
      hash.update(part.id);
      for (const name of ['position', 'normal']) {
        const a = part.mesh.geometry.getAttribute(name).array;
        hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
    }
    return hash.digest('hex');
  } finally {
    assembly.dispose();
  }
}
function envelope(assembly: ReturnType<typeof createRobotJointAssembly>, id: string) {
  const mesh = assembly.parts.find((p) => p.id === id)!.mesh;
  const positions = mesh.geometry.getAttribute('position');
  const radii = Array.from({ length: positions.count }, (_, i) =>
    Math.hypot(positions.getX(i), positions.getY(i)),
  );
  const box = mesh.geometry.boundingBox!.clone().translate(mesh.position);
  return { inner: Math.min(...radii), outer: Math.max(...radii), minZ: box.min.z, maxZ: box.max.z };
}
describe('generic hollow robot joint model', () => {
  it('owns exactly the fourteen semantic groups as independently named original geometry', () => {
    const a = createRobotJointAssembly();
    try {
      expect([...new Set(a.parts.map((p) => p.partId))].sort()).toEqual(
        [...ROBOT_JOINT_PART_IDS].sort(),
      );
      expect(new Set(a.parts.map((p) => p.mesh.name)).size).toBe(a.parts.length);
      expect(a.parts.length).toBe(35);
      expect(a.scene.userData.transmissionAnimated).toBe(false);
      expect(a.parts.every((p) => p.mesh.userData.partId === p.partId)).toBe(true);
    } finally {
      a.dispose();
    }
  });
  it('has finite nondegenerate triangles and normalized outward normals', () => {
    const a = createRobotJointAssembly();
    try {
      for (const { mesh, id } of a.parts) {
        const p = mesh.geometry.getAttribute('position'),
          n = mesh.geometry.getAttribute('normal');
        expect(Array.from(p.array).every(Number.isFinite), id).toBe(true);
        for (let i = 0; i < n.count; i++)
          expect(new Vector3().fromBufferAttribute(n, i).length(), id).toBeCloseTo(1, 5);
        let volume = 0;
        const count = mesh.geometry.index?.count ?? p.count;
        for (let i = 0; i < count; i += 3) {
          const at = (corner: number) =>
            new Vector3().fromBufferAttribute(
              p,
              mesh.geometry.index?.getX(i + corner) ?? i + corner,
            );
          const points = [at(0), at(1), at(2)] as const;
          const [x, y, z] = points;
          const area = y.clone().sub(x).cross(z.clone().sub(x)).length() / 2;
          expect(area, id).toBeGreaterThan(1e-8);
          volume += x.dot(y.clone().cross(z)) / 6;
        }
        expect(volume, id).toBeGreaterThan(0);
      }
    } finally {
      a.dispose();
    }
  });
  it('keeps the nominal 16 mm cable bore open with clearance to rotating input and output sleeves', () => {
    const a = createRobotJointAssembly();
    try {
      for (const part of a.parts) {
        const e = envelope(a, part.id);
        expect(e.inner, part.id).toBeGreaterThanOrEqual(8 - 1e-5);
      }
      const conduit = envelope(a, 'stationary-cable-conduit');
      expect(conduit.inner).toBeCloseTo(8, 5);
      expect(conduit.outer).toBeCloseTo(10, 5);
      expect(conduit.minZ).toBe(-54);
      expect(conduit.maxZ).toBe(64);
      for (const id of ['rotor-input-sleeve', 'output-sleeve'])
        expect(envelope(a, id).inner - conduit.outer).toBeCloseTo(1, 5);
    } finally {
      a.dispose();
    }
  });
  it('retains motor radial air gap, radial thermal contacts and reducer display clearances', () => {
    const a = createRobotJointAssembly();
    try {
      const rotor = envelope(a, 'rotor-magnet-ring'),
        teeth = envelope(a, 'stator-teeth');
      expect(teeth.inner - rotor.outer).toBeGreaterThanOrEqual(2 - 1e-5);
      const stator = envelope(a, 'stator-yoke'),
        pad = envelope(a, 'thermal-interface-sleeve'),
        housing = envelope(a, 'housing-shell');
      expect(stator.outer).toBeCloseTo(pad.inner, 5);
      expect(pad.outer).toBeCloseTo(housing.inner, 5);
      expect(
        envelope(a, 'reducer-fixed-ring').inner - envelope(a, 'reducer-flex-rim').outer,
      ).toBeCloseTo(1, 5);
      expect(
        envelope(a, 'reducer-flex-wall').inner - envelope(a, 'reducer-flex-bearing').outer,
      ).toBeCloseTo(1, 5);
    } finally {
      a.dispose();
    }
  });
  it('assembles actual input/output interfaces without crossing the stationary cover', () => {
    const a = createRobotJointAssembly();
    try {
      const input = envelope(a, 'rotor-input-sleeve'),
        hub = envelope(a, 'reducer-input-hub');
      expect(input.outer).toBeCloseTo(hub.inner, 5);
      expect(input.maxZ).toBeGreaterThan(hub.minZ);
      const cup = envelope(a, 'reducer-cup-base'),
        sleeve = envelope(a, 'output-sleeve'),
        flange = envelope(a, 'output-flange-face');
      expect(cup.maxZ).toBe(sleeve.minZ);
      expect(cup.inner).toBeCloseTo(sleeve.inner, 5);
      expect(sleeve.maxZ).toBe(flange.minZ);
      expect(envelope(a, 'front-cover-ring').inner - flange.outer).toBeCloseTo(1, 5);
      expect(envelope(a, 'output-flange-neck').outer).toBeLessThan(
        envelope(a, 'front-cover-ring').inner,
      );
    } finally {
      a.dispose();
    }
  });
  it('uses independent motor incremental and output absolute encoder planes', () => {
    const a = createRobotJointAssembly();
    try {
      expect(envelope(a, 'motor-encoder-track').maxZ).toBeLessThan(-30);
      expect(envelope(a, 'output-encoder-board').minZ).toBeGreaterThan(30);
      expect(envelope(a, 'brake-friction-disc').minZ).toBeLessThan(
        envelope(a, 'motor-encoder-track').minZ,
      );
    } finally {
      a.dispose();
    }
  });
  it('moves real meshes for separation and only hides enclosure components in mechanism mode', () => {
    const a = createRobotJointAssembly();
    try {
      const rest = a.parts.map((p) => p.mesh.position.clone());
      a.update({ separation: 1, mode: 'mechanism' });
      a.parts.forEach((p, i) =>
        expect(p.mesh.position.distanceTo(rest[i]!), p.id).toBeGreaterThan(0),
      );
      const hidden = [
        ...new Set(a.parts.filter((p) => !p.mesh.visible).map((p) => p.partId)),
      ].sort();
      expect(hidden).toEqual(['front-cover', 'housing', 'rear-cover']);
      a.update({ separation: 0, mode: 'whole' });
      a.parts.forEach((p, i) => {
        expect(p.mesh.visible).toBe(true);
        expect(p.mesh.position.toArray()).toEqual(rest[i]!.toArray());
      });
    } finally {
      a.dispose();
    }
  });
  it('rejects malformed dimensions and separation before introducing nonfinite geometry', () => {
    expect(() =>
      createRobotJointAssembly({ ...ROBOT_JOINT_DEFAULT_PARAMETERS, boreRadiusMm: 0 }),
    ).toThrow();
    expect(() =>
      createRobotJointAssembly({ ...ROBOT_JOINT_DEFAULT_PARAMETERS, boreRadiusMm: 9 }),
    ).toThrow();
    expect(() =>
      createRobotJointAssembly({ ...ROBOT_JOINT_DEFAULT_PARAMETERS, radialSegments: 23 }),
    ).toThrow();
    const a = createRobotJointAssembly();
    try {
      for (const separation of [-1, 2, NaN, Infinity])
        expect(() => a.update({ separation })).toThrow();
    } finally {
      a.dispose();
    }
  });
  it('is exactly reproducible and disposes every owned mesh once', () => {
    expect(digest()).toBe(digest());
    const a = createRobotJointAssembly();
    let geometries = 0,
      materials = 0;
    a.parts.forEach((p) => {
      p.mesh.geometry.addEventListener('dispose', () => geometries++);
      p.mesh.material.addEventListener('dispose', () => materials++);
    });
    a.dispose();
    a.dispose();
    a.update({ separation: 1 });
    expect(geometries).toBe(a.parts.length);
    expect(materials).toBe(a.parts.length);
    expect(a.scene.children).toHaveLength(0);
  });
});
