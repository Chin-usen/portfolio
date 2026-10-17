import { THERMAL_PALETTE } from '../thermal-stack/viewer-shared.ts';
import type { BusbarGeometry, Conductor, ConductorBox, ConductorId, Vec3 } from './geometry.ts';
import type { FieldSet } from './field.ts';
import type { BusbarParams, BusbarResult } from './types.ts';

export type FieldMode = 'temperature' | 'current';

export interface BusbarViewerOptions {
  container: HTMLElement;
  labels: {
    stage: string;
    fallbackStage: string;
    conductors: Record<ConductorId, string>;
    context: string;
    idle: string;
  };
  onHover?: (id: ConductorId | null, probe: Probe | null) => void;
  onSelect?: (id: ConductorId | null) => void;
  onError?: (message: string) => void;
}

/** Local field reading under the pointer, in display units. */
export interface Probe {
  temperature: number;
  currentDensity: number;
}

export interface ViewerState {
  params: BusbarParams;
  result: BusbarResult;
  geometry: BusbarGeometry;
  fields: FieldSet | null;
}

export interface BusbarViewerDiagnostics {
  mode: 'webgl' | 'fallback';
  renderCount: number;
  scheduledFrame: boolean;
  meshCount: number;
  vertexCount: number;
  selectedId: ConductorId | null;
  hoveredId: ConductorId | null;
  cutaway: boolean;
  exploded: boolean;
  fieldMode: FieldMode;
  lastUpdateMs: number;
  disposed: boolean;
  rendererInfo?: {
    geometries: number;
    textures: number;
    programs: number;
    drawCalls: number;
    contextLost: boolean;
  };
  ownedListeners?: number;
  controlsDisposed?: boolean;
}

export interface BusbarViewer {
  update(state: ViewerState): void;
  setFieldMode(mode: FieldMode): void;
  setCutaway(enabled: boolean): void;
  setExploded(enabled: boolean): void;
  setSelected(id: ConductorId | null): void;
  reset(): void;
  dispose(): void;
  getDiagnostics(): BusbarViewerDiagnostics;
}

/** Temperature uses the S1 palette; current density a separate sequential blue scale. */
export const CURRENT_PALETTE = ['#101a2e', '#1d3f73', '#2f6fb8', '#6fb0e6', '#e3f4ff'] as const;
function buildLut(hexes: readonly string[]) {
  const stops = hexes.map((hex) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255),
  );
  const linear = new Float32Array(256 * 3);
  const srgb = new Uint8ClampedArray(256 * 3);
  for (let index = 0; index < 256; index += 1) {
    const t = (index / 255) * (stops.length - 1);
    const low = Math.min(stops.length - 2, Math.floor(t));
    const amount = t - low;
    for (let axis = 0; axis < 3; axis += 1) {
      const a = stops[low]![axis]!;
      const value = a + (stops[low + 1]![axis]! - a) * amount;
      srgb[index * 3 + axis] = Math.round(value * 255);
      linear[index * 3 + axis] =
        value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }
  }
  return { linear, srgb };
}
export const PALETTES: Record<FieldMode, { linear: Float32Array; srgb: Uint8ClampedArray }> = {
  temperature: buildLut(THERMAL_PALETTE),
  current: buildLut(CURRENT_PALETTE),
};

/** Scale range shown by both renderers and the legend. */
export function fieldRange(state: ViewerState, mode: FieldMode): { min: number; max: number } {
  if (mode === 'temperature')
    return {
      min: state.params.tSub,
      max: state.params.tSub + Math.max(state.result.riseMax, 1e-6),
    };
  const values: number[] = [];
  for (const field of Object.values(state.fields ?? {})) {
    if (!field) continue;
    for (let index = 0; index < field.currentDensity.length; index += 7)
      values.push(field.currentDensity[index]!);
  }
  if (!values.length) return { min: 0, max: state.result.strapCurrentDensity };
  values.sort((a, b) => a - b);
  const p99 = values[Math.min(values.length - 1, Math.floor(values.length * 0.99))]!;
  return { min: 0, max: Math.max(p99, 1e-6) };
}

export function paletteIndex(value: number, range: { min: number; max: number }): number {
  const span = range.max - range.min;
  const t = span > 1e-12 ? (value - range.min) / span : 0;
  return Math.round(Math.min(1, Math.max(0, t)) * 255);
}

/** Default camera shared by the WebGL viewer and the rendered static preview (three frame, mm). */
export const CAMERA = {
  fov: 32,
  target: [0, 5, 0] as const,
  direction: [0.62, 0.72, -0.78] as const,
  distance: 162,
  portraitDistance: 235,
};

/** Bolt shaft and washer at a terminal bolt hole (three frame, mm), marking the current inlet. */
export function boltPlacement(conductor: Conductor) {
  const upright = conductor.boxes.find((item) => item.hole);
  if (!upright?.hole) return null;
  const y = conductor.terminal.value;
  const outward = Math.sign(y - (upright.min[1] + upright.max[1]) / 2);
  return {
    x: upright.hole.x,
    height: upright.hole.z,
    washerZ: -(y + outward * 0.3),
    shaftZ: -(y - outward * 1.5),
    washerRadius: 4.4,
    shaftRadius: 2.6,
    shaftLength: 8,
    top: upright.hole.z + 4.4,
  };
}

/** Display offsets of the explode view (source z, mm). */
export const EXPLODE_OFFSET_MM: Record<ConductorId, number> = {
  'ac-link': 0,
  'p-layer': 9,
  'n-layer': 19,
};

/** Horizontal section between the N collector and the laminated plates (source z, mm). */
export function sectionHeight(geometry: BusbarGeometry): number {
  const { nCollectorBottom, pBottom } = geometry.levels;
  const t = geometry.input.thicknessMm;
  return (nCollectorBottom + t + pBottom) / 2;
}

export interface Surface {
  /** Three.js frame positions: source (x, y, z) mm → (x, z, −y). */
  positions: Float32Array;
  /** Per-vertex face shade multiplier (depth cue for unlit materials). */
  shade: Float32Array;
  /** Field lookup: value = (1 − w) f[i0] + w f[i1], indices into the conductor lattice vector. */
  i0: Int32Array;
  i1: Int32Array;
  w: Float32Array;
  indices: Uint32Array;
}

const FACE_SHADE = { top: 1, bottom: 0.62, side: 0.8, end: 0.88 };

/**
 * Six subdivided faces of one box on its field lattice. A clip keeps z ≤ clipZ; the truncated
 * face receives values interpolated along z. Quads inside a bolt hole are omitted.
 */
export function buildBoxSurface(
  item: ConductorBox,
  offset: number,
  clipZ?: number,
): Surface | null {
  const [nx, ny, nz] = item.lattice;
  const min = item.min;
  const max: Vec3 = [
    item.max[0],
    item.max[1],
    clipZ === undefined ? item.max[2] : Math.min(item.max[2], clipZ),
  ];
  if (max[2] - min[2] <= 1e-9) return null;
  const fullHeight = item.max[2] - item.min[2];
  const positions: number[] = [];
  const shade: number[] = [];
  const i0: number[] = [];
  const i1: number[] = [];
  const w: number[] = [];
  const indices: number[] = [];
  const latticeIndex = (i: number, j: number, k: number) =>
    offset + i + (nx + 1) * (j + (ny + 1) * k);
  const vertex = (i: number, j: number, kz: number, tone: number) => {
    // kz is a fractional lattice coordinate along z after clipping.
    const z = min[2] + ((max[2] - min[2]) * kz) / nz;
    const kf = ((z - item.min[2]) / fullHeight) * nz;
    const k0 = Math.min(nz, Math.max(0, Math.floor(kf + 1e-9)));
    const k1 = Math.min(nz, k0 + 1);
    const weight = Math.min(1, Math.max(0, kf - k0));
    const x = min[0] + ((max[0] - min[0]) * i) / nx;
    const y = min[1] + ((max[1] - min[1]) * j) / ny;
    positions.push(x, z, -y);
    shade.push(tone);
    i0.push(latticeIndex(i, j, k0));
    i1.push(latticeIndex(i, j, k1));
    w.push(k1 === k0 ? 0 : weight);
    return positions.length / 3 - 1;
  };
  const inHole = (x: number, z: number) =>
    item.hole !== undefined &&
    (x - item.hole.x) ** 2 + (z - item.hole.z) ** 2 < item.hole.radius ** 2;
  // Each face: (axis fixed, value index), two in-plane lattice axes, outward orientation.
  type Face = { fixed: 0 | 1 | 2; at: number; tone: number; flip: boolean };
  const faces: Face[] = [
    { fixed: 2, at: nz, tone: FACE_SHADE.top, flip: false },
    { fixed: 2, at: 0, tone: FACE_SHADE.bottom, flip: true },
    { fixed: 1, at: 0, tone: FACE_SHADE.side, flip: false },
    { fixed: 1, at: ny, tone: FACE_SHADE.side, flip: true },
    { fixed: 0, at: 0, tone: FACE_SHADE.end, flip: true },
    { fixed: 0, at: nx, tone: FACE_SHADE.end, flip: false },
  ];
  for (const face of faces) {
    const axes = ([0, 1, 2] as const).filter((axis) => axis !== face.fixed) as [number, number];
    const counts = [item.lattice[axes[0]]!, item.lattice[axes[1]]!];
    const grid: number[][] = [];
    for (let a = 0; a <= counts[0]!; a += 1) {
      const row: number[] = [];
      for (let b = 0; b <= counts[1]!; b += 1) {
        const ijk = [0, 0, 0];
        ijk[face.fixed] = face.at;
        ijk[axes[0]] = a;
        ijk[axes[1]] = b;
        row.push(vertex(ijk[0]!, ijk[1]!, ijk[2]!, face.tone));
      }
      grid.push(row);
    }
    for (let a = 0; a < counts[0]!; a += 1) {
      for (let b = 0; b < counts[1]!; b += 1) {
        const v00 = grid[a]![b]!;
        const v10 = grid[a + 1]![b]!;
        const v01 = grid[a]![b + 1]!;
        const v11 = grid[a + 1]![b + 1]!;
        if (item.hole && face.fixed === 1) {
          // Source x/z centre of the quad (three frame stores z in the second component).
          const cx = (positions[v00 * 3]! + positions[v11 * 3]!) / 2;
          const cz = (positions[v00 * 3 + 1]! + positions[v11 * 3 + 1]!) / 2;
          if (inHole(cx, cz)) continue;
        }
        // Winding chosen so that normals point outward after the (x, z, −y) mapping.
        const ccw = face.fixed === 1 ? !face.flip : face.flip;
        if (ccw) indices.push(v00, v10, v11, v00, v11, v01);
        else indices.push(v00, v11, v10, v00, v01, v11);
      }
    }
  }
  return {
    positions: Float32Array.from(positions),
    shade: Float32Array.from(shade),
    i0: Int32Array.from(i0),
    i1: Int32Array.from(i1),
    w: Float32Array.from(w),
    indices: Uint32Array.from(indices),
  };
}

/** Field value at each surface vertex. */
export function sampleSurface(surface: Surface, values: Float32Array, out: Float32Array): void {
  for (let index = 0; index < out.length; index += 1) {
    const w = surface.w[index]!;
    out[index] = values[surface.i0[index]!]! * (1 - w) + values[surface.i1[index]!]! * w;
  }
}
