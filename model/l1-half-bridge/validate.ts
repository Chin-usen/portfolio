import { Raycaster, Vector3 } from 'three';
import {
  type ContactBox,
  type Parameters,
  type Part,
  type Point,
  createModel,
  disposeModel,
  validateParameters,
} from './model.ts';

function check(value: boolean, message: string): asserts value {
  if (!value) throw new Error(message);
}
function boxDistance(a: ContactBox, b: ContactBox) {
  return Math.hypot(
    ...a.center.map((center, axis) =>
      Math.max(0, Math.abs(center - b.center[axis]!) - (a.size[axis]! + b.size[axis]!) / 2),
    ),
  );
}
function pointBoxDistance(point: Point, b: ContactBox) {
  return Math.hypot(
    ...point.map((value, axis) =>
      Math.max(0, Math.abs(value - b.center[axis]!) - b.size[axis]! / 2),
    ),
  );
}
function partDistance(a: Part, b: Part) {
  let distance = Infinity;
  for (const first of a.boxes)
    for (const second of b.boxes) distance = Math.min(distance, boxDistance(first, second));
  for (const [wire, other] of [
    [a, b],
    [b, a],
  ] as const)
    for (const point of wire.wirePoints ?? [])
      for (const shape of other.boxes)
        distance = Math.min(
          distance,
          Math.max(0, pointBoxDistance(point, shape) - (wire.radiusMm ?? 0)),
        );
  return distance;
}
function netOf(part: Part) {
  return part.net === 'kelvin-h' ? 'ac' : part.net === 'kelvin-l' ? 'n' : part.net;
}
export function validateModel(model: ReturnType<typeof createModel>) {
  const { parts, parameters: p } = model;
  const names = new Map(parts.map((part) => [part.name, part]));
  check(names.size === parts.length, 'Every node has a unique name');
  check(
    parts.filter((part) => part.name.startsWith('mosfet-')).length === 8,
    'Eight independent MOSFET dies',
  );
  check(
    parts.filter((part) => part.name.startsWith('amb-ceramic-')).length === 2,
    'Two AMB ceramic layers',
  );
  check(parts.filter((part) => part.partId === 'signal-pin').length === 4, 'Four signal pins');
  check(
    parts.filter((part) => part.name.startsWith('gate-wire-')).length === 8,
    'Eight gate bond wires',
  );
  check(
    parts.filter((part) => part.name.startsWith('kelvin-wire-')).length === 8,
    'Eight Kelvin source bond wires',
  );
  check(
    parts.filter((part) => part.name.startsWith('source-clip-')).length === 8,
    'Eight solid metal power clips',
  );
  const meshStats = parts.map((part) => {
    const geometry = part.mesh.geometry;
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    check(
      positions.count > 0 && normals.count === positions.count,
      `Geometry attributes: ${part.name}`,
    );
    check(Array.from(positions.array).every(Number.isFinite), `Finite positions: ${part.name}`);
    check(Array.from(normals.array).every(Number.isFinite), `Finite normals: ${part.name}`);
    const index = geometry.index;
    const count = index?.count ?? positions.count;
    check(count % 3 === 0, `Triangle indices: ${part.name}`);
    let area = 0;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(positions, index?.getX(i) ?? i);
      b.fromBufferAttribute(positions, index?.getX(i + 1) ?? i + 1);
      c.fromBufferAttribute(positions, index?.getX(i + 2) ?? i + 2);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    check(area > 0, `Positive surface area: ${part.name}`);
    return { name: part.name, vertices: positions.count, triangles: count / 3, areaM2: area };
  });
  const pairs: [string, string][] = [
    ['dc-terminal-p', 'busbar-p'],
    ['dc-terminal-n', 'busbar-n'],
    ['busbar-p', 'p-drain-feed'],
    ['p-drain-feed', 'amb-drain-sh'],
    ['busbar-n', 'n-source-collector'],
    ['ac-source-drain-strap', 'amb-drain-sl'],
    ['ac-source-drain-strap', 'ac-terminal-out'],
  ];
  for (const arm of ['sh', 'sl']) {
    pairs.push(
      [`signal-gate-${arm}`, `amb-gate-${arm}`],
      [`signal-kelvin-${arm}`, `amb-kelvin-${arm}`],
    );
    for (let i = 1; i <= 4; i++) {
      const id = `${arm}-${i}`;
      pairs.push(
        [`amb-drain-${arm}`, `die-attach-${id}`],
        [`source-pad-${id}`, `source-clip-${id}`],
        [`source-clip-${id}`, arm === 'sh' ? 'ac-source-drain-strap' : 'n-source-collector'],
        [`gate-wire-${id}`, `gate-pad-${id}`],
        [`gate-wire-${id}`, `amb-gate-${arm}`],
        [`kelvin-wire-${id}`, `source-pad-${id}`],
        [`kelvin-wire-${id}`, `amb-kelvin-${arm}`],
      );
    }
  }
  const contacts = pairs.map(([a, b]) => {
    const distanceMm = partDistance(names.get(a)!, names.get(b)!);
    check(distanceMm < 1e-5, `Nominal contact missing: ${a} to ${b}, ${distanceMm} mm`);
    return { a, b, distanceMm };
  });
  const conductors = parts.filter((part) => part.net);
  const unlikeNetConflicts = [];
  for (let i = 0; i < conductors.length; i++) {
    for (const second of conductors.slice(i + 1)) {
      const first = conductors[i]!;
      if (netOf(first) === netOf(second)) continue;
      // Exact box envelopes for rectangular conductors; sampled circular tube envelope for signal wires.
      if (partDistance(first, second) < 1e-6)
        unlikeNetConflicts.push({ a: first.name, b: second.name });
    }
  }
  check(
    unlikeNetConflicts.length === 0,
    `Unlike nets contact: ${JSON.stringify(unlikeNetConflicts)}`,
  );
  const connectivity = Object.fromEntries(
    ['p', 'ac', 'n', 'gate-h', 'gate-l'].map((net) => {
      const group = conductors.filter((part) => netOf(part) === net);
      const seen = new Set([group[0]!.name]);
      let previous = -1;
      while (previous !== seen.size) {
        previous = seen.size;
        for (const item of group)
          if (
            !seen.has(item.name) &&
            group.some((other) => seen.has(other.name) && partDistance(item, other) < 1e-5)
          )
            seen.add(item.name);
      }
      check(
        seen.size === group.length,
        `Disconnected ${net} conductors: ${group.filter((part) => !seen.has(part.name)).map((part) => part.name)}`,
      );
      return [net, { connected: true, conductorCount: group.length, connectedCount: seen.size }];
    }),
  );
  const pPlate = names.get('busbar-p')!;
  const nPlate = names.get('busbar-n')!;
  const gapMm = nPlate.boundsMm[0][2] - pPlate.boundsMm[1][2];
  check(Math.abs(gapMm - p.busbarGap) < 1e-5, 'Actual nominal P/N mesh separation');
  model.scene.updateMatrixWorld(true);
  const ray = new Raycaster();
  const holeChecks: { name: string; open: boolean; adjacentMetalHit: boolean }[] = [];
  function checkHole(name: string, source: Point, direction: Point, offset: Point) {
    const mesh = names.get(name)!.mesh;
    const transform = ([x, y, z]: Point) => new Vector3(x / 1000, z / 1000, -y / 1000);
    ray.set(transform(source), transform(direction).normalize());
    const open = ray.intersectObject(mesh).length === 0;
    ray.set(
      transform(source.map((value, axis) => value + offset[axis]!) as Point),
      transform(direction).normalize(),
    );
    const adjacentMetalHit = ray.intersectObject(mesh).length > 0;
    check(
      open && adjacentMetalHit,
      `Real open mesh hole and neighboring metal: ${name}; open=${open}, adjacent=${adjacentMetalHit}, source=${source}`,
    );
    holeChecks.push({ name, open, adjacentMetalHit });
  }
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      checkHole(
        'baseplate-copper',
        [sx * p.mountingHoleCenterX, sy * p.mountingHoleCenterY, 100],
        [0, 0, -1],
        [-sx * 3, 0, 0],
      );
      checkHole(
        'housing-pps-frame',
        [sx * p.mountingHoleCenterX, sy * p.mountingHoleCenterY, 100],
        [0, 0, -1],
        [0, -sy * 4, 0],
      );
    }
  checkHole(
    'dc-terminal-p',
    [-p.terminalX, -100, p.pBusbarBottom + p.terminalHoleOffsetZ],
    [0, 1, 0],
    [4, 0, 0],
  );
  checkHole(
    'dc-terminal-n',
    [p.terminalX, -100, p.pBusbarBottom + p.busbarThickness + p.busbarGap + p.terminalHoleOffsetZ],
    [0, 1, 0],
    [4, 0, 0],
  );
  checkHole(
    'ac-terminal-out',
    [0, 100, p.shCollectorBottom + p.terminalHoleOffsetZ],
    [0, -1, 0],
    [4, 0, 0],
  );
  const bad: [string, Partial<Parameters>][] = [
    ['overlapping-dies', { chipCentersY: [-16.5, -16, 5.5, 16.5] }],
    ['overlapping-amb', { armCenterX: 24 }],
    ['p-n-short', { busbarGap: 0 }],
    ['riser-pierces-p', { nRiseX: 49 }],
    ['pins-pierce-laminate', { signalPinY: -19 }],
    ['gate-source-short', { gatePadOffsetX: -0.8 }],
    ['oversize-source-pad', { sourcePadLength: 5 }],
    ['p-feed-ac-conflict', { pFeedY: -19 }],
  ];
  const negativeCasesRejected = bad.map(([name, changes]) => {
    let rejected = false;
    try {
      validateParameters({ ...p, ...changes });
    } catch {
      rejected = true;
    }
    check(rejected, `Reject invalid parameter fixture: ${name}`);
    return name;
  });
  // Endpoint variants actually rebuild and validate the changed plate geometry.
  const gapEndpoints = [0.1, 2].map((busbarGap) => {
    const variant = createModel({ ...p, busbarGap });
    const lower = variant.parts.find((part) => part.name === 'busbar-p')!;
    const upper = variant.parts.find((part) => part.name === 'busbar-n')!;
    const actual = upper.boundsMm[0][2] - lower.boundsMm[1][2];
    check(Math.abs(actual - busbarGap) < 1e-5, 'Endpoint gap geometry');
    disposeModel(variant);
    return { requestedMm: busbarGap, meshGapMm: actual };
  });
  return {
    status: 'passed',
    modelKind: 'parameterized-schematic-mesh',
    scope:
      'Finite indexed polygon meshes, exact rectangular routing envelopes, sampled wire envelopes, nominal contacts and connected conductor graph. Not a manufacturing model, insulation qualification, or an exhaustive triangle-intersection proof. Contact graph excludes semiconductor drain-source conduction.',
    nodeCount: parts.length,
    meshStats,
    totalTriangles: meshStats.reduce((total, mesh) => total + mesh.triangles, 0),
    baseMm: [p.baseLength, p.baseWidth, p.baseThickness],
    dieMm: [p.dieLength, p.dieWidth, p.dieThickness],
    mosfetCount: 8,
    parallelPerArm: 4,
    ceramicCount: 2,
    signalPinCount: 4,
    gateWireCount: 8,
    kelvinWireCount: 8,
    wireDiameterMm: p.gateWireDiameter,
    mainCurrentBondWires: 0,
    actualNominalGapMm: gapMm,
    contacts,
    unlikeNetConflicts,
    connectivity,
    negativeCasesRejected,
    gapEndpoints,
    holeChecks,
    topology: {
      sh: { drain: 'p', source: 'ac', parallelDies: 4, integratedBodyDiode: true },
      sl: { drain: 'ac', source: 'n', parallelDies: 4, integratedBodyDiode: true },
    },
  };
}
