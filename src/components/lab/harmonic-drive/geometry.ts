/** Generic cup-type strain-wave teaching assembly. Not a vendor model or contact solver.
 * Every selectable component owns named mesh nodes. Source geometry is mm; root alone
 * maps (x,y,z) -> (x,z,-y)/1000 metres. The cup carries slow material rotation while
 * the two-lobe deformation follows the fast spatial wave. Tooth forms are schematic.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  SphereGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TAU,
  createHarmonicModel,
  kinematics,
  type HarmonicKinematics,
  type HarmonicModel,
  type HarmonicParameters,
} from './math.ts';
import {
  HARMONIC_DEFAULT_PARAMETERS,
  deriveHarmonicLayout,
  type HarmonicLayout,
  type HarmonicPartId,
} from './params.ts';
export interface HarmonicPart {
  id: string;
  name: string;
  partId: HarmonicPartId;
  role: string;
  explodeZmm: number;
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
}
export interface HarmonicAssembly {
  scene: Group;
  parts: HarmonicPart[];
  model: HarmonicModel;
  layout: HarmonicLayout;
  update(
    inputAngleRad: number,
    options?: { stage?: 'whole' | 'mechanism'; explode?: number },
  ): HarmonicKinematics;
  dispose(): void;
}
const colors = {
  input: 0xd3a452,
  wave: 0xe0ad60,
  bearing: 0xb9cbd5,
  flex: 0x3e92b2,
  circular: 0x70879e,
  output: 0x55998d,
  housing: 0x82909d,
  marker: 0xf2b544,
};
function circle(radius: number, clockwise = false) {
  const path = new Path();
  path.absarc(0, 0, radius, 0, TAU, clockwise);
  return path;
}
function ringShape(inner: number, outer: number) {
  const shape = new Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  shape.holes.push(circle(inner, true));
  return shape;
}
function extrude(shape: Shape, depth: number) {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }).translate(
    0,
    0,
    -depth / 2,
  );
}
function ring(inner: number, outer: number, depth: number) {
  return extrude(ringShape(inner, outer), depth);
}
function cylinder(radius: number, depth: number, segments = 24) {
  return new CylinderGeometry(radius, radius, depth, segments).rotateX(Math.PI / 2);
}
function combine(items: BufferGeometry[]) {
  const normalized = items.map((geometry) => {
    const value = geometry.index ? geometry.toNonIndexed() : geometry;
    value.deleteAttribute('uv');
    return value;
  });
  const result = mergeGeometries(normalized);
  for (const geometry of new Set([...items, ...normalized])) geometry.dispose();
  if (!result) throw new Error('Incompatible harmonic component geometry');
  return result;
}
function sector(inner: number, outer: number, start: number, end: number, depth: number) {
  const shape = new Shape();
  shape.absarc(0, 0, outer, start, end, false);
  shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
  shape.absarc(0, 0, inner, end, start, true);
  shape.closePath();
  return extrude(shape, depth);
}
/** Four corners per tooth: deliberately non-conjugate trapezoids, not involute claims. */
function toothPath(teeth: number, root: number, tip: number, inward = false) {
  const points: Vector2[] = [];
  for (let i = 0; i < teeth; i++) {
    for (const [fraction, radius] of [
      [-0.5, root],
      [-0.22, tip],
      [0.22, tip],
      [0.5, root],
    ] as const) {
      const a = (TAU * (i + fraction)) / teeth;
      points.push(new Vector2(radius * Math.cos(a), radius * Math.sin(a)));
    }
  }
  if (inward) points.reverse();
  return points;
}
function ellipse(geometry: BufferGeometry, amplitude: number, circularBore = 0, outerRadius = 1) {
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      radius = Math.hypot(x, y);
    if (!radius) continue;
    const a = Math.atan2(y, x),
      localAmplitude =
        amplitude *
        (circularBore ? Math.max(0, (radius - circularBore) / (outerRadius - circularBore)) : 1),
      major = radius + localAmplitude,
      minor = radius - localAmplitude;
    const deformed = (major * minor) / Math.hypot(minor * Math.cos(a), major * Math.sin(a));
    positions.setXY(i, deformed * Math.cos(a), deformed * Math.sin(a));
  }
  geometry.computeVertexNormals();
  return geometry;
}
export function createHarmonicAssembly(
  parameters: Readonly<HarmonicParameters> = HARMONIC_DEFAULT_PARAMETERS,
): HarmonicAssembly {
  const model = createHarmonicModel(parameters),
    layout = deriveHarmonicLayout(model);
  const r = model.metrics.flexPitchRadiusMm,
    m = model.parameters.moduleMm,
    s = layout.scale;
  const amplitude = model.metrics.displayDeformationMm;
  const scene = new Group();
  scene.name = 'generic-harmonic-drive';
  scene.rotation.x = -Math.PI / 2;
  scene.scale.setScalar(0.001);
  scene.userData = {
    modelKind: 'parameterized-kinematic-schematic',
    sourceUnits: 'mm',
    units: 'm',
    ratio: model.metrics.ratio,
    deformationScale: model.parameters.deformationScale,
    nominalDeformationMm: model.metrics.nominalDeformationMm,
    contactSolved: false,
  };
  const parts: HarmonicPart[] = [];
  let disposed = false;
  function add(
    id: string,
    partId: HarmonicPartId,
    role: string,
    geometry: BufferGeometry,
    color: keyof typeof colors,
    z: number,
    explodeZmm: number,
  ) {
    geometry.deleteAttribute('uv');
    const material = new MeshStandardMaterial({
      color: colors[color],
      metalness: 0.55,
      roughness: 0.35,
    });
    if (color === 'marker') {
      material.emissive.setHex(0xb76d09);
      material.emissiveIntensity = 0.4;
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = id;
    mesh.position.z = z;
    mesh.userData = { id, partId, role, explodeZmm, restZmm: z, schematic: true };
    const part = { id, name: id, partId, role, explodeZmm, mesh };
    parts.push(part);
    scene.add(mesh);
    return part;
  }
  const input = add(
    'input-shaft',
    'input-shaft',
    'Input shaft keyed to elliptical wave cam',
    combine([
      cylinder(layout.shaftRadiusMm, 40 * s),
      cylinder(layout.shaftRadiusMm * 1.5, 4 * s).translate(0, 0, 15 * s),
    ]),
    'input',
    28 * s,
    96 * s,
  );
  const cam = ellipse(
    ring(layout.shaftRadiusMm * 1.04, r - 8 * m, 7 * s),
    amplitude,
    layout.shaftRadiusMm * 1.04,
    r - 8 * m,
  );
  const wave = add(
    'wave-generator-elliptical-cam',
    'wave-generator',
    'Elliptical input cam; shown with amplified eccentricity',
    cam,
    'wave',
    6 * s,
    69 * s,
  );
  const bearingInner = r - 7 * m,
    bearingOuter = r - 3 * m;
  const bearingItems = [
    ellipse(ring(bearingInner, bearingInner + 0.5 * m, 7 * s), amplitude),
    ellipse(ring(bearingOuter - 0.5 * m, bearingOuter, 7 * s), amplitude),
  ];
  for (let i = 0; i < 48; i++) {
    const a = (TAU * i) / 48,
      radius = (bearingInner + bearingOuter) / 2;
    const major = radius + amplitude,
      minor = radius - amplitude;
    const rad = (major * minor) / Math.hypot(minor * Math.cos(a), major * Math.sin(a));
    bearingItems.push(
      new SphereGeometry(0.65 * m, 10, 8).translate(rad * Math.cos(a), rad * Math.sin(a), 0),
    );
  }
  const flexibleBearing = add(
    'flexible-bearing-thin-races',
    'flexible-bearing',
    'Thin-wall elliptical bearing envelope; individual rolling and race slip not simulated',
    combine(bearingItems),
    'bearing',
    6 * s,
    43 * s,
  );
  // Closed cup has a thin wall, annular base and a central bore, open at the toothed mouth.
  const cupProfile = [
    new Vector2(layout.shaftRadiusMm * 1.7, layout.cupBaseZmm),
    new Vector2(r * 0.84, layout.cupBaseZmm),
    new Vector2(layout.flexRootRadiusMm, layout.cupBaseZmm + 6 * s),
    new Vector2(layout.flexRootRadiusMm, layout.cupMouthZmm),
    new Vector2(layout.flexInnerRadiusMm, layout.cupMouthZmm),
    new Vector2(layout.flexInnerRadiusMm, layout.cupBaseZmm + 7 * s),
    new Vector2(r * 0.82, layout.cupBaseZmm + 2 * s),
    new Vector2(layout.shaftRadiusMm * 1.7, layout.cupBaseZmm + 2 * s),
    new Vector2(layout.shaftRadiusMm * 1.7, layout.cupBaseZmm),
  ];
  // Lathe's Y axis becomes source Z.
  const cup = new LatheGeometry(cupProfile, 192).rotateX(Math.PI / 2);
  const toothShape = new Shape(toothPath(model.parameters.flexTeeth, r - 0.6 * m, r + 0.6 * m));
  toothShape.holes.push(circle(layout.flexInnerRadiusMm, true));
  const teeth = extrude(toothShape, 7 * s).translate(0, 0, layout.cupMouthZmm - 3.5 * s);
  const flex = add(
    'flexspline-cup-external-teeth',
    'flexspline',
    `${model.parameters.flexTeeth} schematic external teeth; cup material follows the opposite slow output`,
    combine([cup, teeth]),
    'flex',
    0,
    3 * s,
  );
  // The position attribute owns complete xyz triples; accessors preserve that invariant.
  const rest = flex.mesh.geometry.getAttribute('position').clone();
  // Find a real tooth-tip vertex in the baked mesh for diagnostics, not an analytic echo.
  let toothTipIndex = 0,
    largest = 0;
  for (let i = 0; i < rest.count; i++) {
    const radius = Math.hypot(rest.getX(i), rest.getY(i));
    if (rest.getZ(i) > 2 * s && radius > largest) {
      largest = radius;
      toothTipIndex = i;
    }
  }
  flex.mesh.userData.diagnosticToothTipIndex = toothTipIndex;
  const circularPitch = layout.circularDisplayPitchRadiusMm;
  const circularShape = new Shape();
  circularShape.absarc(0, 0, circularPitch + 6 * m, 0, TAU, false);
  circularShape.holes.push(
    new Path(
      toothPath(
        model.parameters.circularTeeth,
        circularPitch + 0.6 * m,
        circularPitch - 0.6 * m,
        true,
      ),
    ),
  );
  const circular = add(
    'circular-spline-internal-teeth',
    'circular-spline',
    `${model.parameters.circularTeeth} stationary internal teeth; ring offset outward for schematic display clearance`,
    extrude(circularShape, 10 * s),
    'circular',
    6 * s,
    23 * s,
  );
  circular.mesh.userData.radialDisplayOffsetMm = model.metrics.circularDisplayOffsetMm;
  const zones = [0, 1].map((i) =>
    add(
      `engagement-zone-${i + 1}`,
      'circular-spline',
      'Long-axis engagement direction only; not a solved contact patch',
      sector(circularPitch + 1.2 * m, circularPitch + 4.5 * m, -0.15, 0.15, 0.65 * s),
      'marker',
      11.6 * s,
      23 * s,
    ),
  );
  const crossInner = r * 0.77,
    crossOuter = r * 1.055;
  const crossItems: BufferGeometry[] = [
    ring(crossInner, crossInner + 3 * s, 8 * s),
    ring(crossOuter - 3 * s, crossOuter, 8 * s),
  ];
  for (let i = 0; i < 32; i++) {
    const a = (TAU * i) / 32,
      radius = (crossInner + crossOuter) / 2;
    crossItems.push(
      cylinder(1.6 * s, 5.4 * s, 10)
        .rotateY(((i % 2 ? -1 : 1) * Math.PI) / 4)
        .rotateZ(a)
        .translate(radius * Math.cos(a), radius * Math.sin(a), 0),
    );
  }
  add(
    'cross-roller-bearing',
    'cross-roller-bearing',
    'Output support with alternating crossed rollers; load and roller spin not solved',
    combine(crossItems),
    'bearing',
    -27 * s,
    -28 * s,
  );
  const outputShape = ringShape(layout.shaftRadiusMm * 1.7, r * 0.77);
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8,
      hole = circle(2.5 * s, true);
    const points = hole
      .getPoints(20)
      .map((v) => v.add(new Vector2(r * 0.6 * Math.cos(a), r * 0.6 * Math.sin(a))));
    outputShape.holes.push(new Path(points));
  }
  const output = add(
    'output-flange',
    'output-flange',
    'Flange rigidly coupled to the closed cup end; opposite slow output',
    extrude(outputShape, 7 * s),
    'output',
    -25.5 * s,
    -55 * s,
  );
  add(
    'housing-service-cutaway',
    'housing',
    'Fixed enclosure; a deliberate 110 degree service cutaway exposes the mechanism',
    sector(
      layout.housingInnerRadiusMm,
      layout.housingOuterRadiusMm,
      (55 * Math.PI) / 180,
      (305 * Math.PI) / 180,
      51 * s,
    ),
    'housing',
    -4 * s,
    -6 * s,
  );
  const endcapShape = ringShape(layout.shaftRadiusMm * 1.6, layout.housingOuterRadiusMm);
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8;
    endcapShape.holes.push(
      new Path(
        circle(1.5 * s, true)
          .getPoints(16)
          .map((v) =>
            v.add(
              new Vector2(
                (layout.housingOuterRadiusMm - 2 * s) * Math.cos(a),
                (layout.housingOuterRadiusMm - 2 * s) * Math.sin(a),
              ),
            ),
          ),
      ),
    );
  }
  add(
    'input-endcap',
    'endcap',
    'Stationary input closure with central shaft clearance',
    extrude(endcapShape, 3 * s),
    'housing',
    23 * s,
    123 * s,
  );
  function update(
    inputAngleRad: number,
    options: { stage?: 'whole' | 'mechanism'; explode?: number } = {},
  ) {
    if (disposed) throw new Error('Cannot update disposed harmonic assembly');
    const stage = options.stage ?? 'whole',
      explode = options.explode ?? 0;
    if (!['whole', 'mechanism'].includes(stage)) throw new RangeError('Unknown harmonic stage');
    if (!Number.isFinite(explode) || explode < 0 || explode > 1)
      throw new RangeError('Explosion must be in [0,1]');
    const state = kinematics(model, inputAngleRad);
    input.mesh.rotation.z =
      wave.mesh.rotation.z =
      flexibleBearing.mesh.rotation.z =
        state.inputAngleRad;
    output.mesh.rotation.z = flex.mesh.rotation.z = state.outputAngleRad;
    zones.forEach((zone, i) => {
      zone.mesh.rotation.z = state.engagementAngles[i === 0 ? 0 : 1];
    });
    const positions = flex.mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = rest.getX(i),
        y = rest.getY(i),
        z = rest.getZ(i),
        radius = Math.hypot(x, y);
      const materialAngle = Math.atan2(y, x);
      const weight = Math.min(
        1,
        Math.max(
          0,
          (z - layout.cupBaseZmm - 2 * s) / (layout.cupMouthZmm - layout.cupBaseZmm - 9 * s),
        ),
      );
      const delta =
        amplitude *
        weight *
        Math.cos(2 * (materialAngle + (state.outputAngleRad % TAU) - (state.inputAngleRad % TAU)));
      const factor = radius ? (radius + delta) / radius : 1;
      positions.setXYZ(i, x * factor, y * factor, z);
    }
    positions.needsUpdate = true;
    flex.mesh.geometry.computeVertexNormals();
    flex.mesh.geometry.computeBoundingBox();
    flex.mesh.geometry.computeBoundingSphere();
    for (const part of parts) {
      part.mesh.position.z = Number(part.mesh.userData.restZmm) + part.explodeZmm * explode;
      part.mesh.visible = stage === 'whole' || !['housing', 'endcap'].includes(part.partId);
    }
    scene.updateMatrixWorld(true);
    return state;
  }
  function dispose() {
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
