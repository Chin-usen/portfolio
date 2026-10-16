import { tempAt } from './evaluator';
import type { ThermalField, ThermalLayer, ThermalLayerId, ThermalResult } from './types';

interface SamplingCache {
  rows: Map<ThermalLayerId, number[]>;
  columns: number[][];
}
const caches = new WeakMap<ThermalField, SamplingCache>();

function cacheFor(field: ThermalField): SamplingCache {
  const existing = caches.get(field);
  if (existing) return existing;
  const cache: SamplingCache = { rows: new Map(), columns: [] };
  for (let row = 0; row < field.height; row += 1) {
    const columns: number[] = [];
    for (let column = 0; column < field.width; column += 1) {
      if (field.mask[row * field.width + column]) columns.push(column);
    }
    cache.columns.push(columns);
  }
  caches.set(field, cache);
  return cache;
}

/** Bracket valid sample centres; surfaces outside those centres clamp to the nearest one. */
function bracket(
  indices: readonly number[],
  coordinates: Float32Array,
  value: number,
): [number, number, number] | null {
  if (!indices.length) return null;
  let low = 0;
  let high = indices.length - 1;
  if (value <= coordinates[indices[low]!]!) return [indices[low]!, indices[low]!, 0];
  if (value >= coordinates[indices[high]!]!) return [indices[high]!, indices[high]!, 0];
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (coordinates[indices[middle]!]! <= value) low = middle;
    else high = middle;
  }
  const lower = indices[low]!;
  const upper = indices[high]!;
  const span = coordinates[upper]! - coordinates[lower]!;
  return [lower, upper, span > 0 ? (value - coordinates[lower]!) / span : 0];
}

/**
 * FEM mode samples its predicted central x-z plane, bilinearly within one layer.
 * A Chebyshev radius on exterior 3D faces extends that plane for display only;
 * it does not reconstruct a full 3D FEM solution. Analytical mode remains illustrative.
 */
export function sampleTemperature(
  result: ThermalResult,
  layer: ThermalLayer,
  normalizedHeight: number,
  chebyshevDistanceMm: number,
  coolantTemp: number,
): number | null {
  if (result.model.kind === 'analytic-resistance-network')
    return tempAt(layer, normalizedHeight, chebyshevDistanceMm, coolantTemp);
  if (
    !Number.isFinite(normalizedHeight) ||
    normalizedHeight < 0 ||
    normalizedHeight > 1 ||
    !Number.isFinite(chebyshevDistanceMm) ||
    chebyshevDistanceMm < 0 ||
    chebyshevDistanceMm > layer.width / 2
  )
    return null;
  const field = result.field;
  if (field?.kind !== 'fem-surrogate-central-plane' || !field.xMm || !field.zMm) return null;
  const { xMm, zMm } = field;
  const cache = cacheFor(field);
  let rows = cache.rows.get(layer.id);
  if (!rows) {
    rows = [];
    for (let row = 0; row < field.height; row += 1) {
      const z = zMm[row];
      const inLayer = field.rowLayerIds
        ? field.rowLayerIds[row] === layer.id
        : z !== undefined && z >= layer.zBottomMm - 1e-6 && z <= layer.zTopMm + 1e-6;
      if (inLayer && cache.columns[row]?.length) rows.push(row);
    }
    cache.rows.set(layer.id, rows);
  }
  const z = layer.zBottomMm + normalizedHeight * layer.thickness;
  const vertical = bracket(rows, zMm, z);
  if (!vertical) return null;
  const rowSample = (row: number): number | null => {
    const horizontal = bracket(cache.columns[row] ?? [], xMm, chebyshevDistanceMm);
    if (!horizontal) return null;
    const [left, right, weight] = horizontal;
    const a = field.values[row * field.width + left];
    const b = field.values[row * field.width + right];
    if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b))
      return null;
    return a + (b - a) * weight;
  };
  const a = rowSample(vertical[0]);
  const b = rowSample(vertical[1]);
  if (a === null || b === null) return null;
  return a + (b - a) * vertical[2];
}
