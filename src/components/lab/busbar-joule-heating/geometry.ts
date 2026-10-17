import l1 from '../../../../model/l1-half-bridge/params.json' with { type: 'json' };

/**
 * S2 conductor geometry. Every nominal dimension is read from the L1 half-bridge parameter
 * file; only conductor thickness t and strap width b are replaced by the page inputs.
 * Source frame: millimetres, Z up, identical to model/l1-half-bridge/model.ts.
 */
export type L1Parameters = typeof l1;
export type Vec3 = [number, number, number];
export type ConductorId = 'p-layer' | 'ac-link' | 'n-layer';
export type SwitchState = 'sh' | 'sl';
export type BoxRole =
  'plate' | 'strap' | 'collector' | 'post' | 'terminal-foot' | 'terminal-upright';

export interface ConductorBox {
  id: string;
  role: BoxRole;
  min: Vec3;
  max: Vec3;
  /** Display/field lattice cells along x, y and z; fixed for every t and b. */
  lattice: [number, number, number];
  /** Bolt hole through a terminal upright (axis y). */
  hole?: { x: number; z: number; radius: number };
}

/** A planar contact patch. The axis is the patch normal; value is its coordinate. */
export interface ContactPatch {
  id: string;
  kind: 'terminal' | 'pin';
  axis: 'y' | 'z';
  value: number;
  min: Vec3;
  max: Vec3;
  /** Terminal washer patch excludes the bolt hole. */
  innerRadius?: number;
  center?: Vec3;
}

export interface Conductor {
  id: ConductorId;
  boxes: ConductorBox[];
  terminal: ContactPatch;
  pins: ContactPatch[];
}

export interface ContextBox {
  id: string;
  kind: 'ceramic' | 'drain-island' | 'die' | 'clip';
  arm: 'sh' | 'sl';
  min: Vec3;
  max: Vec3;
}

export interface GeometryInput {
  thicknessMm: number;
  strapWidthMm: number;
}

export interface BusbarGeometry {
  input: GeometryInput;
  conductors: Record<ConductorId, Conductor>;
  context: ContextBox[];
  levels: {
    acBottom: number;
    nCollectorBottom: number;
    pBottom: number;
    nBottom: number;
    padTop: number;
    pinBase: number;
  };
  bounds: { min: Vec3; max: Vec3 };
}

export const L1_PARAMETERS: Readonly<L1Parameters> = l1;
export const CONDUCTOR_IDS: readonly ConductorId[] = ['p-layer', 'ac-link', 'n-layer'];
export const SWITCH_STATES: readonly SwitchState[] = ['sh', 'sl'];

/** L1 nominal values for the two geometric page inputs. */
export const NOMINAL_GEOMETRY: Readonly<GeometryInput> = Object.freeze({
  thicknessMm: l1.busbarThickness,
  strapWidthMm: l1.acBridgeWidth,
});

/**
 * Conductors that carry the load current in each switching state, with the pin patches that
 * are held at V = 0. The terminal of each active conductor is held at V = 1 (scaled later).
 * No P-to-N shoot-through state exists.
 */
export const ACTIVE_PATHS: Readonly<
  Record<SwitchState, readonly { conductor: ConductorId; pins: readonly string[] }[]>
> = Object.freeze({
  sh: [
    { conductor: 'p-layer', pins: ['p-feed'] },
    { conductor: 'ac-link', pins: ['clip-sh-1', 'clip-sh-2', 'clip-sh-3', 'clip-sh-4'] },
  ],
  sl: [
    { conductor: 'ac-link', pins: ['ac-feed'] },
    { conductor: 'n-layer', pins: ['clip-sl-1', 'clip-sl-2', 'clip-sl-3', 'clip-sl-4'] },
  ],
});

/** Same cumulative sums as `layerLevels` in model/l1-half-bridge/model.ts. */
export function l1LayerLevels(p: L1Parameters = l1) {
  const solder = p.baseThickness;
  const bottomCopper = solder + p.ambSolderThickness;
  const ceramic = bottomCopper + p.bottomCopperThickness;
  const topCopper = ceramic + p.ceramicThickness;
  const dieAttach = topCopper + p.topCopperThickness;
  const die = dieAttach + p.dieAttachThickness;
  const pad = die + p.dieThickness;
  return { solder, bottomCopper, ceramic, topCopper, dieAttach, die, pad };
}

const round = (value: number) => Math.round(value * 1e9) / 1e9;
function box(
  id: string,
  role: BoxRole,
  center: [number, number],
  size: [number, number],
  z0: number,
  z1: number,
  lattice: [number, number, number],
): ConductorBox {
  return {
    id,
    role,
    min: [round(center[0] - size[0] / 2), round(center[1] - size[1] / 2), round(z0)],
    max: [round(center[0] + size[0] / 2), round(center[1] + size[1] / 2), round(z1)],
    lattice,
  };
}
function zPatch(id: string, center: [number, number], size: [number, number], z: number) {
  return {
    id,
    kind: 'pin' as const,
    axis: 'z' as const,
    value: round(z),
    min: [round(center[0] - size[0] / 2), round(center[1] - size[1] / 2), round(z)] as Vec3,
    max: [round(center[0] + size[0] / 2), round(center[1] + size[1] / 2), round(z)] as Vec3,
  };
}

export function validateGeometryInput(input: GeometryInput): GeometryInput {
  const { thicknessMm: t, strapWidthMm: b } = input;
  if (!Number.isFinite(t) || t < 0.5 || t > 3) throw new RangeError('Thickness must be 0.5–3 mm.');
  if (!Number.isFinite(b) || b < 2 || b > 6) throw new RangeError('Strap width must be 2–6 mm.');
  return { thicknessMm: t, strapWidthMm: b };
}

/** Bolted terminal: a foot on its conductor and an upright with the L1 bolt hole. */
function terminal(
  p: L1Parameters,
  prefix: string,
  x: number,
  y0: number,
  z0: number,
  direction: 1 | -1,
): { boxes: ConductorBox[]; contact: ContactPatch } {
  const endY = direction * p.terminalEndY;
  const thickness = p.terminalThickness;
  const footCenterY = (y0 + endY) / 2;
  const footLength = Math.abs(endY - y0) + thickness;
  const foot = box(
    `${prefix}-terminal-foot`,
    'terminal-foot',
    [x, footCenterY],
    [p.terminalLength, footLength],
    z0,
    z0 + thickness,
    [6, 5, 1],
  );
  const upright = box(
    `${prefix}-terminal-upright`,
    'terminal-upright',
    [x, endY],
    [p.terminalLength, thickness],
    z0,
    z0 + p.terminalHeight,
    [12, 1, 11],
  );
  const holeZ = round(z0 + p.terminalHoleOffsetZ);
  upright.hole = { x, z: holeZ, radius: p.terminalHoleDiameter / 2 };
  const outerY = round(endY + (direction * thickness) / 2);
  // Washer/lug face around the bolt: square of 1.6 hole diameters on the outer face.
  const half = Math.min(p.terminalLength / 2, 0.8 * p.terminalHoleDiameter);
  const contact: ContactPatch = {
    id: `${prefix}-bolt`,
    kind: 'terminal',
    axis: 'y',
    value: outerY,
    min: [round(x - half), outerY, round(holeZ - half)],
    max: [round(x + half), outerY, round(holeZ + half)],
    innerRadius: p.terminalHoleDiameter / 2,
    center: [x, outerY, holeZ],
  };
  return { boxes: [foot, upright], contact };
}

export function createBusbarGeometry(
  input: GeometryInput = NOMINAL_GEOMETRY,
  p: L1Parameters = l1,
): BusbarGeometry {
  const { thicknessMm: t, strapWidthMm: b } = validateGeometryInput(input);
  const levels = l1LayerLevels(p);
  const pinBase = levels.dieAttach;
  const padTop = levels.pad + p.padThickness;
  // L1 stacking clearances are preserved when t changes; layers move up together.
  const acBottom = p.shCollectorBottom;
  const acToN = p.slCollectorBottom - (p.shCollectorBottom + p.collectorThickness);
  const nToP = p.pBusbarBottom - (p.slCollectorBottom + p.collectorThickness);
  const nCollectorBottom = acBottom + t + acToN;
  const pBottom = nCollectorBottom + t + nToP;
  const nBottom = pBottom + t + p.busbarGap;
  const shX = -p.armCenterX + p.sourceClipOffsetX;
  const slX = p.armCenterX + p.sourceClipOffsetX;
  const clipSize: [number, number] = [p.sourceClipLength, p.sourceClipWidth];

  // P layer: plate, drain feed foot and post to substrate 1, DC+ terminal.
  const feedX = -p.armCenterX + p.pFeedOffsetX;
  const pTerminal = terminal(p, 'p', -p.terminalX, p.terminalStartY, pBottom, -1);
  const pLayer: Conductor = {
    id: 'p-layer',
    boxes: [
      box(
        'p-plate',
        'plate',
        [0, 0],
        [p.busbarLength, p.busbarOverlapWidth],
        pBottom,
        pBottom + t,
        [50, 20, 1],
      ),
      box(
        'p-feed-foot',
        'strap',
        [feedX, p.pFeedY],
        [b, p.pFootLengthY],
        pBottom,
        pBottom + t,
        [2, 4, 1],
      ),
      box(
        'p-feed-post',
        'post',
        [feedX, p.pFeedY],
        [b, p.pFeedWidth],
        pinBase,
        pBottom + t,
        [2, 1, 8],
      ),
      ...pTerminal.boxes,
    ],
    terminal: pTerminal.contact,
    pins: [zPatch('p-feed', [feedX, p.pFeedY], [b, p.pFeedWidth], pinBase)],
  };

  // AC link: S_H source collector, bridge, drain feed to substrate 2, AC terminal.
  const acTop = acBottom + t;
  const acTerminal = terminal(p, 'ac', 0, p.acBridgeY, acBottom, 1);
  const acLink: Conductor = {
    id: 'ac-link',
    boxes: [
      box(
        'ac-collector',
        'collector',
        [shX, 0],
        [p.collectorLength, p.collectorWidth],
        acBottom,
        acTop,
        [2, 20, 1],
      ),
      box(
        'ac-bridge',
        'strap',
        [(shX + p.armCenterX) / 2, p.acBridgeY],
        [p.armCenterX - shX + p.collectorLength, b],
        acBottom,
        acTop,
        [30, 2, 1],
      ),
      box(
        'ac-feed-post',
        'post',
        [p.armCenterX, p.acBridgeY],
        [p.acDrainFeedLength, p.acDrainFeedWidth],
        pinBase,
        acTop,
        [2, 2, 4],
      ),
      ...acTerminal.boxes,
    ],
    terminal: acTerminal.contact,
    pins: [
      zPatch(
        'ac-feed',
        [p.armCenterX, p.acBridgeY],
        [p.acDrainFeedLength, p.acDrainFeedWidth],
        pinBase,
      ),
      ...p.chipCentersY.map((y, index) =>
        zPatch(`clip-sh-${index + 1}`, [shX, y], clipSize, acBottom),
      ),
    ],
  };

  // N layer: S_L source collector, riser strap and post, return, plate, DC- terminal.
  const nTerminal = terminal(p, 'n', p.terminalX, p.terminalStartY, nBottom, -1);
  const nLayer: Conductor = {
    id: 'n-layer',
    boxes: [
      box(
        'n-collector',
        'collector',
        [slX, 0],
        [p.collectorLength, p.collectorWidth],
        nCollectorBottom,
        nCollectorBottom + t,
        [2, 20, 1],
      ),
      box(
        'n-riser-strap',
        'strap',
        [(slX + p.nRiseX) / 2, p.nRiseY],
        [p.nRiseX - slX + p.nRiseWidth, b],
        nCollectorBottom,
        nCollectorBottom + t,
        [12, 2, 1],
      ),
      box(
        'n-riser-post',
        'post',
        [p.nRiseX, p.nRiseY],
        [p.nRiseWidth, b],
        nCollectorBottom,
        nBottom + t,
        [1, 2, 6],
      ),
      box(
        'n-return',
        'strap',
        [(p.nRiseX + p.nReturnX) / 2, p.nRiseY],
        [p.nRiseX - p.nReturnX + p.nRiseWidth, b],
        nBottom,
        nBottom + t,
        [3, 2, 1],
      ),
      box(
        'n-plate',
        'plate',
        [0, 0],
        [p.busbarLength, p.busbarOverlapWidth],
        nBottom,
        nBottom + t,
        [50, 20, 1],
      ),
      ...nTerminal.boxes,
    ],
    terminal: nTerminal.contact,
    pins: p.chipCentersY.map((y, index) =>
      zPatch(`clip-sl-${index + 1}`, [slX, y], clipSize, nCollectorBottom),
    ),
  };

  const context: ContextBox[] = [];
  for (const arm of ['sh', 'sl'] as const) {
    const x = (arm === 'sh' ? -1 : 1) * p.armCenterX;
    const clipTop = arm === 'sh' ? acBottom : nCollectorBottom;
    context.push({
      id: `ceramic-${arm}`,
      kind: 'ceramic',
      arm,
      min: [x - p.ambLength / 2, -p.ambWidth / 2, levels.ceramic],
      max: [x + p.ambLength / 2, p.ambWidth / 2, levels.topCopper],
    });
    context.push({
      id: `drain-${arm}`,
      kind: 'drain-island',
      arm,
      min: [x + p.drainOffsetX - p.drainLength / 2, -p.drainWidth / 2, levels.topCopper],
      max: [x + p.drainOffsetX + p.drainLength / 2, p.drainWidth / 2, levels.dieAttach],
    });
    p.chipCentersY.forEach((y, index) => {
      context.push({
        id: `die-${arm}-${index + 1}`,
        kind: 'die',
        arm,
        min: [x - p.dieLength / 2, y - p.dieWidth / 2, levels.dieAttach],
        max: [x + p.dieLength / 2, y + p.dieWidth / 2, padTop],
      });
      const cx = x + p.sourceClipOffsetX;
      context.push({
        id: `clip-${arm}-${index + 1}`,
        kind: 'clip',
        arm,
        min: [cx - p.sourceClipLength / 2, y - p.sourceClipWidth / 2, padTop],
        max: [cx + p.sourceClipLength / 2, y + p.sourceClipWidth / 2, clipTop],
      });
    });
  }
  const conductors = { 'p-layer': pLayer, 'ac-link': acLink, 'n-layer': nLayer };
  const all = [...Object.values(conductors).flatMap((entry) => entry.boxes), ...context];
  const bounds = {
    min: [0, 1, 2].map((axis) => Math.min(...all.map((item) => item.min[axis]!))) as Vec3,
    max: [0, 1, 2].map((axis) => Math.max(...all.map((item) => item.max[axis]!))) as Vec3,
  };
  return {
    input: { thicknessMm: t, strapWidthMm: b },
    conductors,
    context,
    levels: {
      acBottom,
      nCollectorBottom: round(nCollectorBottom),
      pBottom: round(pBottom),
      nBottom: round(nBottom),
      padTop: round(padTop),
      pinBase: round(pinBase),
    },
    bounds,
  };
}

/** Lattice points of a box in x-fastest order: index = i + (nx+1)(j + (ny+1)k). */
export function latticeSize(item: Pick<ConductorBox, 'lattice'>): number {
  const [nx, ny, nz] = item.lattice;
  return (nx + 1) * (ny + 1) * (nz + 1);
}
export function latticePoint(item: ConductorBox, i: number, j: number, k: number): Vec3 {
  const [nx, ny, nz] = item.lattice;
  return [
    item.min[0] + ((item.max[0] - item.min[0]) * i) / nx,
    item.min[1] + ((item.max[1] - item.min[1]) * j) / ny,
    item.min[2] + ((item.max[2] - item.min[2]) * k) / nz,
  ];
}
/** Field offsets of each box inside one conductor's concatenated lattice vector. */
export function latticeOffsets(conductor: Conductor): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const item of conductor.boxes) {
    offsets.push(offset);
    offset += latticeSize(item);
  }
  offsets.push(offset);
  return offsets;
}
