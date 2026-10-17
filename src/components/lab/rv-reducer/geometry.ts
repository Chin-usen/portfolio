/**
 * Generic two-stage RV teaching assembly. All dimensions derive from the same parameters.
 * Curves use the analytical nominal profile; root blends, cages, bearing races and seals
 * are simplified. This is not a production drawing or a load/contact-stress calculation.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TAU,
  createRvModel,
  discHoleCenter,
  discPose,
  kinematics,
  pinCenter,
  planetPose,
  rotate,
  sampleAdaptiveCycloidProfile,
  sampleSpurProfile,
  type DiscIndex,
  type Point2,
  type RvKinematics,
  type RvModel,
  type RvParameters,
} from './math.ts';
import { RV_DEFAULT_PARAMETERS, deriveRvLayout, type RvLayout, type RvPartId } from './params.ts';
export { deriveRvLayout, type RvLayout } from './params.ts';

export type RvStage = 'whole' | 'first' | 'second';
export interface RvUpdateOptions {
  stage?: RvStage;
  explode?: number;
}
export interface RvPart {
  id: string;
  name: string;
  partId: RvPartId;
  role: string;
  stage: 'first' | 'second' | 'support';
  visibleInStages: ('first' | 'second')[];
  explodeZmm: number;
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
}
export interface RvAssembly {
  scene: Group;
  parts: RvPart[];
  model: RvModel;
  layout: RvLayout;
  update: (inputAngleRad: number, options?: RvUpdateOptions) => RvKinematics;
  dispose: () => void;
}
const palette: Record<string, number> = {
  housing: 0x718096,
  pin: 0xb8c2ce,
  input: 0xd38b36,
  planet: 0xd3b06c,
  crank: 0xc5754a,
  discA: 0x4689ad,
  discB: 0x8365ab,
  output: 0x4b9987,
  bearing: 0xb6c9d4,
  seal: 0x343b47,
};
function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
function discZ(layout: RvLayout, disc: DiscIndex): number {
  return (disc === 0 ? -1 : 1) * layout.discCenterZmm;
}
function circlePath(x: number, y: number, radius: number): Path {
  const path = new Path();
  path.absarc(x, y, radius, 0, TAU, true);
  return path;
}
function outlineShape(points: readonly Point2[]): Shape {
  const shape = new Shape();
  const first = points[0];
  ensure(first !== undefined, 'Outline requires at least one point');
  shape.moveTo(first.x, first.y);
  for (const p of points.slice(1)) shape.lineTo(p.x, p.y);
  shape.closePath();
  return shape;
}
function roundShape(radius: number, holes: { x: number; y: number; radius: number }[] = []): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, radius, 0, TAU, false);
  for (const hole of holes) shape.holes.push(circlePath(hole.x, hole.y, hole.radius));
  return shape;
}
function extrude(shape: Shape, depth: number): BufferGeometry {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }).translate(
    0,
    0,
    -depth / 2,
  );
}
function ring(inner: number, outer: number, depth: number): BufferGeometry {
  return extrude(roundShape(outer, [{ x: 0, y: 0, radius: inner }]), depth);
}
function cylinder(radius: number, length: number, segments = 24): BufferGeometry {
  return new CylinderGeometry(radius, radius, length, segments).rotateX(Math.PI / 2);
}
function combine(items: BufferGeometry[]): BufferGeometry {
  const normalized = items.map((g) => {
    const value = g.index ? g.toNonIndexed() : g;
    value.deleteAttribute('uv');
    return value;
  });
  const merged = mergeGeometries(normalized);
  ensure(merged !== null, 'Incompatible RV component geometry');
  for (const geometry of new Set([...items, ...normalized])) geometry.dispose();
  return merged;
}
function holeCenters(
  radius: number,
  holeRadius: number,
  index = 0,
): { x: number; y: number; radius: number }[] {
  return Array.from({ length: 3 }, (_, j) => ({
    x: radius * Math.cos((TAU * j) / 3 + index),
    y: radius * Math.sin((TAU * j) / 3 + index),
    radius: holeRadius,
  }));
}
/** Components are separate named meshes. The root is the only mm-to-m conversion. */
export function createRvAssembly(
  parameters: Readonly<RvParameters> = RV_DEFAULT_PARAMETERS,
): RvAssembly {
  const model = createRvModel(parameters),
    p = model.parameters,
    layout = deriveRvLayout(model);
  const s = layout.scale,
    scene = new Group();
  scene.name = 'generic-rv-reducer';
  scene.rotation.x = -Math.PI / 2;
  scene.scale.setScalar(0.001);
  scene.userData = {
    modelKind: 'parameterized-kinematic-schematic',
    units: 'm',
    sourceUnits: 'mm',
    ratio: model.metrics.ratio,
  };
  const parts: RvPart[] = [],
    motions: ((state: RvKinematics) => void)[] = [];
  let disposed = false;
  function add(
    id: string,
    partId: RvPartId,
    role: string,
    stage: RvPart['stage'],
    geometry: BufferGeometry,
    color: keyof typeof palette,
    z: number,
    explodeZmm: number,
    visibleInStages: ('first' | 'second')[] = stage === 'support' ? [] : [stage],
  ): RvPart {
    geometry.deleteAttribute('uv');
    const material = new MeshStandardMaterial({
      color: palette[color],
      metalness: color === 'seal' ? 0.04 : 0.55,
      roughness: 0.38,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = id;
    mesh.position.z = z;
    const part: RvPart = { id, name: id, partId, role, stage, visibleInStages, explodeZmm, mesh };
    mesh.userData = { id, partId, role, stage, visibleInStages, explodeZmm, restZmm: z };
    parts.push(part);
    scene.add(mesh);
    return part;
  }
  const fixed = (part: RvPart, x = 0, y = 0, angle = 0): void => {
    motions.push(() => {
      part.mesh.position.x = x;
      part.mesh.position.y = y;
      part.mesh.rotation.z = angle;
    });
  };
  const carrierMotion = (part: RvPart, x = 0, y = 0): void => {
    motions.push((state) => {
      const xy = rotate({ x, y }, state.carrierAngleRad);
      part.mesh.position.x = xy.x;
      part.mesh.position.y = xy.y;
      part.mesh.rotation.z = state.carrierAngleRad;
    });
  };
  // A deliberate 90-degree service cutaway exposes the stage geometry; no clipping shader.
  const cutaway = new Shape();
  cutaway.absarc(0, 0, layout.housingOuterRadiusMm, Math.PI / 4, TAU - Math.PI / 4, false);
  cutaway.lineTo(
    layout.housingInnerRadiusMm / Math.sqrt(2),
    -layout.housingInnerRadiusMm / Math.sqrt(2),
  );
  cutaway.absarc(0, 0, layout.housingInnerRadiusMm, TAU - Math.PI / 4, Math.PI / 4, true);
  cutaway.closePath();
  fixed(
    add(
      'housing-cutaway',
      'housing',
      'stationary housing, 90 degree service cutaway',
      'support',
      extrude(cutaway, 48 * s),
      'housing',
      0,
      0,
    ),
  );
  for (const side of [-1, 1]) {
    fixed(
      add(
        `fixed-pin-ring-${side < 0 ? 'left' : 'right'}`,
        'pin-ring',
        'fixed housing pin support',
        'second',
        ring(p.pinCircleRadiusMm - p.pinRadiusMm - 1.5 * s, layout.housingInnerRadiusMm, 5 * s),
        'housing',
        side * 20 * s,
        side * 12 * s,
      ),
    );
  }
  for (let index = 0; index < p.pinCount; index++) {
    const position = pinCenter(model, index);
    fixed(
      add(
        `housing-pin-${String(index + 1).padStart(2, '0')}`,
        'pin',
        'fixed-center pin; no imposed simultaneous no-slip spin',
        'second',
        cylinder(p.pinRadiusMm, layout.pinLengthMm, 20),
        'pin',
        0,
        0,
      ),
      position.x,
      position.y,
    );
  }
  const input = add(
    'input-shaft',
    'input-shaft',
    'input shaft keyed to sun',
    'first',
    cylinder(layout.shaftRadiusMm, 40 * s),
    'input',
    -52 * s,
    -90 * s,
  );
  const sunShape = outlineShape(sampleSpurProfile(model, 'sun'));
  sunShape.holes.push(circlePath(0, 0, layout.shaftRadiusMm));
  const sun = add(
    'sun-gear',
    'sun-gear',
    'stage-one involute input sun',
    'first',
    extrude(sunShape, layout.gearThicknessMm),
    'input',
    layout.gearCenterZmm,
    -60 * s,
  );
  for (const part of [input, sun])
    motions.push((state) => {
      part.mesh.rotation.z = state.inputAngleRad;
    });
  for (let planet = 0; planet < 3; planet++) {
    const gearShape = outlineShape(sampleSpurProfile(model, 'planet'));
    gearShape.holes.push(circlePath(0, 0, layout.shaftRadiusMm));
    const gear = add(
      `planet-gear-${planet + 1}`,
      'planet-gear',
      'involute planet rigidly keyed to its eccentric crank',
      'first',
      extrude(gearShape, layout.gearThicknessMm),
      'planet',
      layout.gearCenterZmm,
      -60 * s,
    );
    const crank = add(
      `crankshaft-${planet + 1}`,
      'crankshaft',
      'parallel-axis shaft with opposite eccentric journals',
      'support',
      cylinder(layout.shaftRadiusMm, 72 * s),
      'crank',
      -3 * s,
      0,
      ['first', 'second'],
    );
    motions.push((state) => {
      const pose = planetPose(model, state, planet);
      for (const part of [gear, crank]) {
        part.mesh.position.x = pose.axisMm.x;
        part.mesh.position.y = pose.axisMm.y;
      }
      gear.mesh.rotation.z = pose.gearAngleRad;
      crank.mesh.rotation.z = pose.crankAngleRad;
    });
    for (const disc of [0, 1] as const) {
      const tag = disc === 0 ? 'a' : 'b';
      const journal = add(
        `eccentric-journal-${tag}-${planet + 1}`,
        'crankshaft',
        `disc ${tag.toUpperCase()} eccentric journal, 180 degree opposed pair`,
        'second',
        cylinder(layout.journalRadiusMm, layout.discThicknessMm),
        'crank',
        discZ(layout, disc),
        (disc === 0 ? -20 : 20) * s,
      );
      const inner = layout.journalRadiusMm,
        outer = layout.needleOuterRadiusMm;
      const needleItems = [
        ring(inner, inner + 0.5 * s, layout.discThicknessMm),
        ring(outer - 0.5 * s, outer, layout.discThicknessMm),
      ];
      for (let j = 0; j < 16; j++) {
        const theta = (TAU * j) / 16,
          radius = (inner + outer) / 2;
        needleItems.push(
          cylinder((outer - inner) * 0.28, layout.discThicknessMm * 0.75, 8).translate(
            radius * Math.cos(theta),
            radius * Math.sin(theta),
            0,
          ),
        );
      }
      const needle = add(
        `needle-bearing-${tag}-${planet + 1}`,
        'needle-bearing',
        'simplified eccentric needle bearing; cage/roller spin not solved',
        'second',
        combine(needleItems),
        'bearing',
        discZ(layout, disc),
        (disc === 0 ? -20 : 20) * s,
      );
      motions.push((state) => {
        const center = discHoleCenter(model, state, disc, planet);
        for (const part of [journal, needle]) {
          part.mesh.position.x = center.x;
          part.mesh.position.y = center.y;
        }
        journal.mesh.rotation.z = discPose(model, state, disc).eccentricAngleRad;
        needle.mesh.rotation.z = state.carrierAngleRad;
      });
    }
  }
  const profile = sampleAdaptiveCycloidProfile(model);
  for (const disc of [0, 1] as const) {
    // Only the outer tooth outline is half-lobe indexed. Structural holes remain in the carrier frame.
    const index = (-disc * Math.PI) / p.lobeCount;
    const shape = outlineShape(profile.points.map((point) => rotate(point, index)));
    shape.holes.push(circlePath(0, 0, layout.centralBoreMm));
    for (const hole of holeCenters(model.metrics.crankAxisRadiusMm, layout.needleOuterRadiusMm))
      shape.holes.push(circlePath(hole.x, hole.y, hole.radius));
    for (const hole of holeCenters(
      layout.postCircleMm,
      layout.postRadiusMm + p.eccentricityMm + 0.8 * s,
      Math.PI / 3,
    ))
      shape.holes.push(circlePath(hole.x, hole.y, hole.radius));
    const part = add(
      `cycloid-disc-${disc === 0 ? 'a' : 'b'}`,
      'cycloid-disc',
      `${p.lobeCount}/${p.pinCount} nominal conjugate disc ${disc === 0 ? 'A' : 'B'}; structural and tooth phases separated`,
      'second',
      extrude(shape, layout.discThicknessMm),
      disc === 0 ? 'discA' : 'discB',
      discZ(layout, disc),
      (disc === 0 ? -20 : 20) * s,
    );
    part.mesh.userData.profileIndexRad = index;
    part.mesh.userData.profileChordToleranceMm = profile.toleranceMm;
    part.mesh.userData.profileChordErrorBoundMm = profile.maximumChordErrorBoundMm;
    motions.push((state) => {
      const pose = discPose(model, state, disc);
      part.mesh.position.x = pose.centerMm.x;
      part.mesh.position.y = pose.centerMm.y;
      part.mesh.rotation.z = pose.structuralAngleRad;
    });
  }
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const flangeHoles = [
      { x: 0, y: 0, radius: layout.centralBoreMm },
      ...holeCenters(model.metrics.crankAxisRadiusMm, layout.shaftRadiusMm),
      ...holeCenters(layout.postCircleMm, layout.postRadiusMm, Math.PI / 3),
    ];
    carrierMotion(
      add(
        `output-flange-${label}`,
        'output-flange',
        'rigid output carrier flange',
        'support',
        extrude(roundShape(layout.carrierRadiusMm, flangeHoles), layout.flangeThicknessMm),
        'output',
        side * layout.flangeCenterZmm,
        side * 45 * s,
        ['first', 'second'],
      ),
    );
    const bearingInner = layout.carrierRadiusMm,
      bearingOuter = layout.housingInnerRadiusMm;
    const innerRace = add(
      `main-bearing-inner-${label}`,
      'main-bearing',
      'angular-contact main bearing rotating inner race',
      'support',
      ring(bearingInner, bearingInner + 3 * s, 7 * s),
      'bearing',
      side * layout.flangeCenterZmm,
      side * 64 * s,
    );
    carrierMotion(innerRace);
    fixed(
      add(
        `main-bearing-outer-${label}`,
        'main-bearing',
        'angular-contact main bearing fixed outer race',
        'support',
        ring(bearingOuter - 3 * s, bearingOuter, 7 * s),
        'bearing',
        side * layout.flangeCenterZmm,
        side * 64 * s,
      ),
    );
    const balls: BufferGeometry[] = [],
      ballCircle = (bearingInner + bearingOuter) / 2;
    for (let j = 0; j < 20; j++)
      balls.push(
        new SphereGeometry(2.8 * s, 10, 8).translate(
          ballCircle * Math.cos((TAU * j) / 20),
          ballCircle * Math.sin((TAU * j) / 20),
          side * 0.8 * s,
        ),
      );
    fixed(
      add(
        `main-bearing-balls-${label}`,
        'main-bearing',
        'opposed angular-contact rows, simplified balls; spin and contact load not simulated',
        'support',
        combine(balls),
        'bearing',
        side * layout.flangeCenterZmm,
        side * 64 * s,
      ),
    );
    fixed(
      add(
        `oil-seal-${label}`,
        'oil-seal',
        'stationary schematic oil seal',
        'support',
        ring(layout.carrierRadiusMm - 2 * s, layout.housingInnerRadiusMm, 2.5 * s),
        'seal',
        side * 33 * s,
        side * 84 * s,
      ),
    );
  }
  for (let index = 0; index < 3; index++) {
    const angle = (TAU * index) / 3 + Math.PI / 3;
    carrierMotion(
      add(
        `output-carrier-post-${index + 1}`,
        'output-flange',
        'rigid connection between output flanges; clearance holes allow disc orbit',
        'support',
        cylinder(layout.postRadiusMm, 54 * s, 18),
        'output',
        0,
        0,
        ['first', 'second'],
      ),
      layout.postCircleMm * Math.cos(angle),
      layout.postCircleMm * Math.sin(angle),
    );
  }
  fixed(
    add(
      'input-endcap',
      'endcap',
      'schematic stationary input-side endcap',
      'support',
      ring(layout.centralBoreMm + 2 * s, layout.housingOuterRadiusMm, 4 * s),
      'housing',
      -47 * s,
      -105 * s,
    ),
  );
  function update(inputAngleRad: number, options: RvUpdateOptions = {}): RvKinematics {
    ensure(!disposed, 'Cannot update a disposed RV assembly');
    const stage = options.stage ?? 'whole',
      explode = options.explode ?? 0;
    ensure(['whole', 'first', 'second'].includes(stage), 'Unknown RV stage');
    ensure(Number.isFinite(explode) && explode >= 0 && explode <= 1, 'Explosion must be in [0,1]');
    const state = kinematics(model, inputAngleRad);
    for (const motion of motions) motion(state);
    for (const part of parts) {
      part.mesh.position.z = Number(part.mesh.userData.restZmm) + part.explodeZmm * explode;
      part.mesh.visible = stage === 'whole' || part.visibleInStages.includes(stage);
    }
    scene.updateMatrixWorld(true);
    return state;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const part of parts) {
      part.mesh.geometry.dispose();
      part.mesh.material.dispose();
    }
    scene.clear();
  }
  update(0);
  return { scene, parts, model, layout, update, dispose };
}
/** World position of a component origin, useful for selection anchors and tests. */
export function rvPartWorldPosition(part: RvPart): Vector3 {
  return part.mesh.getWorldPosition(new Vector3());
}
