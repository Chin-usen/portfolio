/** Original generic integrated hollow joint. Static system packaging schematic.
 * Local dimensions are mm; the root maps (x,y,z) -> (x,z,-y)/1000 metres.
 * Deliberate clearances separate teaching solids. No contact, brake force, motor field,
 * encoder resolution, thermal resistance, gear kinematics or load capacity is solved.
 */
import {
  BufferGeometry,
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ROBOT_JOINT_DEFAULT_PARAMETERS,
  validateRobotJointParameters,
  type RobotJointParameters,
} from './params.ts';
import {
  ROBOT_JOINT_HIDDEN_IN_MECHANISM,
  type RobotJointMode,
  type RobotJointPartId,
} from './parts.ts';

export interface RobotJointPart {
  id: string;
  name: string;
  partId: RobotJointPartId;
  role: string;
  restPositionMm: [number, number, number];
  explodeOffsetMm: [number, number, number];
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
}
export interface RobotJointAssembly {
  scene: Group;
  parts: RobotJointPart[];
  parameters: RobotJointParameters;
  update(options?: { mode?: RobotJointMode; separation?: number }): void;
  dispose(): void;
}
const TAU = Math.PI * 2;
const offsets: Record<RobotJointPartId, [number, number, number]> = {
  housing: [135, 0, 0],
  'motor-stator': [0, 0, -50],
  'motor-rotor': [0, 0, -20],
  'harmonic-reducer': [0, 0, 35],
  'motor-encoder': [0, 0, -75],
  'output-encoder': [0, 0, 75],
  'fail-safe-brake': [0, 0, -100],
  'driver-board': [0, 0, -125],
  'cross-roller-bearing': [0, 0, 105],
  'hollow-shaft': [-100, 0, 0],
  'thermal-pad': [90, 0, -45],
  'front-cover': [0, 0, 160],
  'rear-cover': [0, 0, -155],
  'output-flange': [0, 0, 130],
};
export function createRobotJointAssembly(
  parameters: Readonly<RobotJointParameters> = ROBOT_JOINT_DEFAULT_PARAMETERS,
): RobotJointAssembly {
  const scale = validateRobotJointParameters(parameters);
  const scene = new Group();
  scene.name = 'generic-hollow-robot-joint';
  scene.rotation.x = -Math.PI / 2;
  scene.scale.setScalar(0.001);
  scene.userData = {
    modelKind: 'static-integrated-joint-schematic',
    sourceUnits: 'mm',
    units: 'm',
    transmissionAnimated: false,
    cableBoreRadiusMm: parameters.boreRadiusMm,
  };
  const parts: RobotJointPart[] = [];
  let disposed = false;
  function ring(inner: number, outer: number, depth: number) {
    const shape = new Shape();
    shape.absarc(0, 0, outer, 0, TAU, false);
    const hole = new Path();
    hole.absarc(0, 0, inner, 0, TAU, true);
    shape.holes.push(hole);
    return new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: parameters.radialSegments / 2,
    }).translate(0, 0, -depth / 2);
  }
  function combine(items: BufferGeometry[]) {
    const values = items.map((g) => {
      const v = g.index ? g.toNonIndexed() : g;
      v.deleteAttribute('uv');
      return v;
    });
    const result = mergeGeometries(values);
    for (const g of new Set([...items, ...values])) g.dispose();
    if (!result) throw new Error('Incompatible robot joint geometry');
    return result;
  }
  function blocks(count: number, radius: number, radial: number, tangent: number, depth: number) {
    return combine(
      Array.from({ length: count }, (_, i) => {
        const a = (TAU * i) / count;
        return new BoxGeometry(radial, tangent, depth)
          .rotateZ(a)
          .translate(radius * Math.cos(a), radius * Math.sin(a), 0);
      }),
    );
  }
  // Extrude triangulation can emit zero-area seam triangles for very thin annuli.
  // Remove those triangles and retain the valid face normals before export/runtime use.
  function cleanTriangles(input: BufferGeometry) {
    const source = input.index ? input.toNonIndexed() : input;
    const positions = source.getAttribute('position'),
      normals = source.getAttribute('normal');
    const xyz: number[] = [],
      normal: number[] = [];
    let removed = false;
    for (let i = 0; i < positions.count; i += 3) {
      const vertices = [
        new Vector3().fromBufferAttribute(positions, i),
        new Vector3().fromBufferAttribute(positions, i + 1),
        new Vector3().fromBufferAttribute(positions, i + 2),
      ] as const;
      const face = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      if (face.lengthSq() < 4e-16) {
        removed = true;
        continue;
      }
      face.normalize();
      for (const [j, vertex] of vertices.entries()) {
        xyz.push(...vertex.toArray());
        const n = new Vector3().fromBufferAttribute(normals, i + j);
        normal.push(...(n.lengthSq() ? n.normalize() : face).toArray());
      }
    }
    if (!removed) {
      if (source !== input) source.dispose();
      return input;
    }
    const clean = new BufferGeometry();
    clean.setAttribute('position', new Float32BufferAttribute(xyz, 3));
    clean.setAttribute('normal', new Float32BufferAttribute(normal, 3));
    if (source !== input) source.dispose();
    input.dispose();
    return clean;
  }
  function add(
    id: string,
    partId: RobotJointPartId,
    role: string,
    geometry: BufferGeometry,
    color: number,
    z: number,
    metalness = 0.55,
  ) {
    geometry = cleanTriangles(geometry);
    geometry.deleteAttribute('uv');
    geometry.scale(scale, scale, scale);
    geometry.normalizeNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new MeshStandardMaterial({ color, metalness, roughness: 0.4 });
    const mesh = new Mesh(geometry, material);
    mesh.name = id;
    mesh.position.z = z * scale;
    const restPositionMm: [number, number, number] = [0, 0, z * scale];
    const explodeOffsetMm = offsets[partId].map((v) => v * scale) as [number, number, number];
    mesh.userData = { id, partId, role, restPositionMm, explodeOffsetMm, schematic: true };
    parts.push({ id, name: id, partId, role, restPositionMm, explodeOffsetMm, mesh });
    scene.add(mesh);
    return mesh;
  }
  add(
    'housing-shell',
    'housing',
    'Stationary structural enclosure and heat sink',
    ring(63, 67, 104),
    0x82909d,
    2,
  );
  add(
    'stator-yoke',
    'motor-stator',
    'Stationary laminated magnetic return path',
    ring(52, 58, 26),
    0x526b81,
    -14,
  );
  add(
    'stator-teeth',
    'motor-stator',
    '24 schematic stator teeth; no electromagnetic model',
    blocks(parameters.statorSlots, 47.5, 9, 5.3, 24),
    0x738797,
    -14,
  );
  add(
    'stator-copper-windings',
    'motor-stator',
    'Separated copper winding envelopes between teeth',
    blocks(parameters.statorSlots, 48, 7, 4.2, 22).rotateZ(Math.PI / parameters.statorSlots),
    0xbd783f,
    -14,
    0.35,
  );
  add(
    'rotor-magnet-ring',
    'motor-rotor',
    'Permanent magnet rotor envelope; 2 mm motor air gap',
    ring(39, 41, 24),
    0x547e91,
    -14,
  );
  add('rotor-back-iron', 'motor-rotor', 'Rotor back iron', ring(35, 39, 26), 0x8c9aa8, -14);
  add(
    'rotor-front-web',
    'motor-rotor',
    'Hollow rotor web couples motor to reducer input sleeve',
    ring(14, 39, 3),
    0xa6adb5,
    0.5,
  );
  add(
    'rotor-input-sleeve',
    'motor-rotor',
    'Hollow rotating input sleeve around stationary cable conduit',
    ring(11, 14, 58),
    0xa6adb5,
    -15,
  );
  add(
    'reducer-fixed-ring',
    'harmonic-reducer',
    'Simplified fixed circular spline envelope; no L4 mechanism code',
    ring(44, 52, 20),
    0x697e93,
    18,
  );
  add(
    'reducer-flex-wall',
    'harmonic-reducer',
    'Simplified flexible cup wall; undeformed static schematic',
    ring(39, 41, 20),
    0x4b9ab3,
    18,
  );
  add(
    'reducer-flex-rim',
    'harmonic-reducer',
    'Schematic tooth band with 1 mm display clearance to fixed ring',
    ring(41, 43, 7),
    0x6baac0,
    11.5,
  );
  add(
    'reducer-cup-base',
    'harmonic-reducer',
    'Cup base transfers reduced output to output sleeve',
    ring(11, 41, 2),
    0x4b9ab3,
    29,
  );
  add(
    'reducer-input-hub',
    'harmonic-reducer',
    'Hollow wave-generator hub envelope; no transmission animation',
    ring(14, 30, 4),
    0xd2a55d,
    12,
  );
  add(
    'reducer-flex-bearing',
    'harmonic-reducer',
    'Simplified wave bearing annulus; elasticity omitted',
    ring(31, 38, 6),
    0xb9c8d0,
    12,
  );
  add(
    'motor-encoder-track',
    'motor-encoder',
    'Incremental motor-side encoder track, schematic graduation',
    combine([ring(14, 28, 1), blocks(48, 26, 2, 0.45, 0.3).translate(0, 0, 0.65)]),
    0xd2b46c,
    -33.5,
  );
  add(
    'motor-encoder-readhead',
    'motor-encoder',
    'Fixed incremental encoder readhead',
    new BoxGeometry(7, 9, 2).translate(32, 0, 0),
    0x6d87a1,
    -33,
  );
  add(
    'output-encoder-target',
    'output-encoder',
    'Absolute output-side magnetic target ring',
    ring(15, 17, 3),
    0xc9a764,
    39.5,
  );
  add(
    'output-encoder-board',
    'output-encoder',
    'Output absolute encoder PCB independent of motor encoder',
    ring(18, 36, 2),
    0x4b8d7d,
    40,
    0.15,
  );
  add(
    'output-encoder-readhead',
    'output-encoder',
    'Fixed absolute encoder sensor near output target',
    new BoxGeometry(4, 7, 1.5).translate(21, 0, 0),
    0x454c5b,
    41.75,
    0.1,
  );
  add(
    'brake-coil-body',
    'fail-safe-brake',
    'Normally engaged spring brake coil body; power releases brake',
    ring(30, 39, 8),
    0x5f6b7e,
    -41,
  );
  add(
    'brake-friction-disc',
    'fail-safe-brake',
    'Brake friction disc on motor input side',
    ring(14, 29, 2),
    0xad976f,
    -43,
  );
  add(
    'brake-armature',
    'fail-safe-brake',
    'Spring-applied armature shown with assembly clearance',
    ring(14, 29, 2),
    0xb9c5cc,
    -38.5,
  );
  add(
    'driver-pcb',
    'driver-board',
    'Annular drive board with distinct power and control components',
    ring(14, 59, 2),
    0x3e8271,
    -48,
    0.1,
  );
  add(
    'driver-power-stage',
    'driver-board',
    'Three schematic power stage packages',
    combine([
      new BoxGeometry(9, 14, 2.5).translate(49, 0, 0),
      new BoxGeometry(9, 14, 2.5).translate(-49, 0, 0),
      new BoxGeometry(14, 9, 2.5).translate(0, 49, 0),
    ]),
    0x4b5362,
    -45.75,
    0.1,
  );
  add(
    'driver-control-ic',
    'driver-board',
    'Control processor package separated from power stage',
    new BoxGeometry(10, 8, 1.5).translate(0, -48, 0),
    0x303d4c,
    -46.25,
    0.1,
  );
  add(
    'cross-roller-inner-race',
    'cross-roller-bearing',
    'Output bearing inner race',
    ring(40, 45, 12),
    0xbac8d2,
    42,
  );
  add(
    'cross-roller-outer-race',
    'cross-roller-bearing',
    'Stationary output bearing outer race',
    ring(53, 58, 12),
    0xa1b2c2,
    42,
  );
  const rollers = Array.from({ length: parameters.bearingRollers }, (_, i) => {
    const a = (TAU * i) / parameters.bearingRollers;
    return new CylinderGeometry(2.1, 2.1, 4, 12)
      .rotateZ(i % 2 ? Math.PI / 4 : -Math.PI / 4)
      .rotateX(Math.PI / 2)
      .rotateZ(a)
      .translate(49 * Math.cos(a), 49 * Math.sin(a), 0);
  });
  add(
    'cross-roller-elements',
    'cross-roller-bearing',
    'Alternating roller orientations; contact mechanics omitted',
    combine(rollers),
    0xd1dce2,
    42,
  );
  add(
    'stationary-cable-conduit',
    'hollow-shaft',
    'Continuous nominal 16 mm cable passage; stationary protected conduit',
    ring(8, 10, 118),
    0xc1a779,
    5,
  );
  add(
    'thermal-interface-sleeve',
    'thermal-pad',
    'Schematic thermal interface contacts stator OD and housing ID',
    ring(58, 63, 24),
    0x69aaa0,
    -14,
    0.05,
  );
  add(
    'front-cover-ring',
    'front-cover',
    'Stationary front cover around rotating output neck',
    ring(46, 67, 4),
    0x8795a2,
    56,
  );
  add(
    'rear-cover-ring',
    'rear-cover',
    'Rear enclosure cover with cable opening',
    ring(10.5, 67, 4),
    0x8795a2,
    -52,
  );
  add(
    'output-sleeve',
    'output-flange',
    'Reduced output sleeve coupled to cup base',
    ring(11, 14, 18),
    0x5c9c90,
    39,
  );
  add(
    'output-flange-face',
    'output-flange',
    'Rotating load-side flange, independent of front enclosure cover',
    ring(11, 45, 6),
    0x5c9c90,
    51,
  );
  add(
    'output-flange-neck',
    'output-flange',
    'Hollow load attachment neck through front cover',
    ring(11, 24, 7),
    0x80b6aa,
    57.5,
  );
  scene.updateMatrixWorld(true);
  return {
    scene,
    parts,
    parameters: { ...parameters },
    update({ mode = 'whole', separation = 0 } = {}) {
      if (disposed) return;
      if (!Number.isFinite(separation) || separation < 0 || separation > 1)
        throw new RangeError('Separation must be in [0,1]');
      for (const part of parts) {
        part.mesh.position
          .fromArray(part.restPositionMm)
          .addScaledVector(new Vector3().fromArray(part.explodeOffsetMm), separation);
        part.mesh.visible =
          mode === 'whole' || !ROBOT_JOINT_HIDDEN_IN_MECHANISM.includes(part.partId);
      }
      scene.updateMatrixWorld(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const part of parts) {
        part.mesh.geometry.dispose();
        part.mesh.material.dispose();
      }
      scene.clear();
    },
  };
}
