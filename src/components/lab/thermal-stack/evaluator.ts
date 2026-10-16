import { FIXED_GEOMETRY, validateParams } from './parameters';
import type {
  CoolerTerms,
  ThermalField,
  ThermalLayer,
  ThermalLayerId,
  ThermalParams,
  ThermalResult,
} from './types';

const MM_TO_M = 1e-3;
const FIELD_WIDTH = 128;
const FIELD_HEIGHT = 64;

/** Visualization-only constants. This shape is not a lateral heat-equation solution. */
export const ILLUSTRATIVE_PROFILE = Object.freeze({
  kind: 'illustrative-chebyshev' as const,
  edgeAttenuation: 0.25,
  referenceHalfWidthMm: FIXED_GEOMETRY.coolerWidthMm / 2,
});

interface LayerDefinition {
  id: ThermalLayerId;
  name: string;
  thickness: number;
  k: number;
  width: number;
}

function layerDefinitions(p: ThermalParams): LayerDefinition[] {
  const g = FIXED_GEOMETRY;
  return [
    {
      id: 'chip',
      name: 'Chip',
      thickness: g.chipThicknessMm,
      k: g.chipConductivity,
      width: g.chipWidthMm,
    },
    {
      id: 'solder-top',
      name: 'Upper solder',
      thickness: p.t_st,
      k: p.k_st,
      width: g.topSolderWidthMm,
    },
    {
      id: 'copper-top',
      name: 'Upper copper',
      thickness: p.t_cut,
      k: p.k_cu,
      width: g.copperWidthMm,
    },
    { id: 'ceramic', name: 'Ceramic', thickness: p.t_cer, k: p.k_cer, width: g.ceramicWidthMm },
    {
      id: 'copper-bottom',
      name: 'Lower copper',
      thickness: p.t_cub,
      k: p.k_cu,
      width: g.copperWidthMm,
    },
    {
      id: 'solder-bottom',
      name: 'Lower solder',
      thickness: p.t_sb,
      k: p.k_sb,
      width: g.bottomSolderWidthMm,
    },
    { id: 'cooler', name: 'Cooler', thickness: p.t_cooler, k: p.k_cooler, width: g.coolerWidthMm },
  ];
}

function coolerResistance(sourceWidthMm: number, p: ThermalParams): CoolerTerms {
  const sourceAreaM2 = (sourceWidthMm * MM_TO_M) ** 2;
  const plateAreaM2 = (FIXED_GEOMETRY.coolerWidthMm * MM_TO_M) ** 2;
  const aM = Math.sqrt(sourceAreaM2 / Math.PI);
  const bM = Math.sqrt(plateAreaM2 / Math.PI);
  const epsilon = aM / bM;
  const tau = (p.t_cooler * MM_TO_M) / bM;
  const Bi = (p.h * bM) / p.k_cooler;
  const lambda = Math.PI + 1 / (Math.sqrt(Math.PI) * epsilon);
  const tanh = Math.tanh(lambda * tau);
  const phi = (tanh + lambda / Bi) / (1 + (lambda / Bi) * tanh);
  const rSpreading = ((1 - epsilon) ** 1.5 * phi) / (Math.sqrt(Math.PI) * p.k_cooler * aM);
  const rThrough = (p.t_cooler * MM_TO_M) / (p.k_cooler * Math.PI * bM ** 2);
  return { aM, bM, epsilon, tau, Bi, lambda, phi, rSpreading, rThrough };
}

/**
 * Analytic resistance network from the user-supplied 45°/circular-equivalent equations.
 * The chip is a single source node: tjMax and tjAvg intentionally report the same value.
 * Optional field data is an explicitly illustrative interpolation, never an FEM output.
 */
export function evaluate(
  input: ThermalParams,
  options: { includeField?: boolean } = {},
): ThermalResult {
  const p = validateParams(input);
  const definitions = layerDefinitions(p);
  let sourceWidthMm: number = FIXED_GEOMETRY.chipWidthMm;
  let coolerTerms: CoolerTerms | undefined;
  const layers: ThermalLayer[] = definitions.map((definition) => {
    const { id, thickness, k, width } = definition;
    const entryWidthMm = sourceWidthMm;
    let exitWidthMm: number;
    let rth: number;
    if (id === 'cooler') {
      coolerTerms = coolerResistance(entryWidthMm, p);
      rth = coolerTerms.rSpreading + coolerTerms.rThrough;
      exitWidthMm = width;
    } else {
      exitWidthMm = Math.min(entryWidthMm + 2 * thickness, width);
      rth = (thickness * MM_TO_M) / (k * (entryWidthMm * MM_TO_M) * (exitWidthMm * MM_TO_M));
    }
    sourceWidthMm = exitWidthMm;
    return {
      ...definition,
      rth,
      sourceWidthMm: entryWidthMm,
      exitWidthMm,
      tTop: 0,
      tBottom: 0,
      zTopMm: 0,
      zBottomMm: 0,
    };
  });
  if (!coolerTerms) throw new Error('The stack must contain a cooler.');
  const plateAreaM2 = (FIXED_GEOMETRY.coolerWidthMm * MM_TO_M) ** 2;
  const rConv = 1 / (p.h * plateAreaM2);
  const rthTotal = layers.reduce((sum, layer) => sum + layer.rth, rConv);
  const totalHeightMm = layers.reduce((sum, layer) => sum + layer.thickness, 0);
  let bottomTemperature = p.T_cool + p.P * rConv;
  let zBottomMm = 0;
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];
    if (!layer) throw new Error('Invalid layer order.');
    layer.tBottom = bottomTemperature;
    layer.tTop = bottomTemperature + p.P * layer.rth;
    layer.zBottomMm = zBottomMm;
    layer.zTopMm = zBottomMm + layer.thickness;
    bottomTemperature = layer.tTop;
    zBottomMm = layer.zTopMm;
  }
  const tj = p.T_cool + p.P * rthTotal;
  const result: ThermalResult = {
    tjMax: tj,
    tjAvg: tj,
    rthTotal,
    layers,
    rConv,
    tMin: p.T_cool,
    tMax: tj,
    totalHeightMm,
    coolerTerms,
    model: {
      kind: 'analytic-resistance-network',
      junction: 'single-lumped-source-node',
      peakAndAverageResolvedSeparately: false,
      field: 'synthetic-layer-interpolation',
      profile: 'illustrative-chebyshev',
      isFEM: false,
    },
  };
  if (options.includeField !== false)
    result.field = createSyntheticField(layers, totalHeightMm, p.T_cool);
  return result;
}

/** Height fraction is 0 at the physical layer bottom and 1 at its top. */
export function verticalTemperature(layer: ThermalLayer, normalizedHeight: number): number {
  if (!Number.isFinite(normalizedHeight) || normalizedHeight < 0 || normalizedHeight > 1) {
    throw new RangeError('Normalized height must be finite and between 0 and 1.');
  }
  return layer.tBottom + normalizedHeight * (layer.tTop - layer.tBottom);
}

/**
 * Synthetic color temperature in °C. Lateral variation is illustrative, not predicted.
 * The common 15 mm reference radius preserves temperature continuity at layer interfaces.
 * Returns null outside the layer's physical square footprint.
 */
export function tempAt(
  layer: ThermalLayer,
  normalizedHeight: number,
  chebyshevDistanceMm: number,
  coolantTemp: number,
): number | null {
  if (
    !Number.isFinite(chebyshevDistanceMm) ||
    chebyshevDistanceMm < 0 ||
    !Number.isFinite(coolantTemp)
  ) {
    throw new RangeError(
      'Distance and coolant temperature must be finite; distance must be nonnegative.',
    );
  }
  const verticalCenterTemp = verticalTemperature(layer, normalizedHeight);
  if (chebyshevDistanceMm > layer.width / 2) return null;
  const fraction = Math.min(1, chebyshevDistanceMm / ILLUSTRATIVE_PROFILE.referenceHalfWidthMm);
  return (
    coolantTemp +
    (verticalCenterTemp - coolantTemp) * (1 - ILLUSTRATIVE_PROFILE.edgeAttenuation * fraction)
  );
}

/** Absolute lateral coordinates in mm, with the chip centre at x=y=0. */
export function illustrativeTemperature(
  layer: ThermalLayer,
  normalizedHeight: number,
  absXmm: number,
  absYmm: number,
  coolantTemp: number,
): number | null {
  if (!Number.isFinite(absXmm) || !Number.isFinite(absYmm))
    throw new RangeError('Coordinates must be finite.');
  return tempAt(layer, normalizedHeight, Math.max(Math.abs(absXmm), Math.abs(absYmm)), coolantTemp);
}

function createSyntheticField(
  layers: readonly ThermalLayer[],
  totalHeightMm: number,
  coolantTemp: number,
): ThermalField {
  const halfWidthMm = FIXED_GEOMETRY.coolerWidthMm / 2;
  const values = new Float32Array(FIELD_WIDTH * FIELD_HEIGHT);
  const mask = new Uint8Array(values.length);
  values.fill(coolantTemp);
  for (let row = 0; row < FIELD_HEIGHT; row += 1) {
    const zMm = ((row + 0.5) / FIELD_HEIGHT) * totalHeightMm;
    const layer = layers.find((candidate) => zMm >= candidate.zBottomMm && zMm <= candidate.zTopMm);
    if (!layer) continue;
    const height = (zMm - layer.zBottomMm) / layer.thickness;
    for (let column = 0; column < FIELD_WIDTH; column += 1) {
      const xMm = -halfWidthMm + ((column + 0.5) / FIELD_WIDTH) * 2 * halfWidthMm;
      const temperature = tempAt(layer, height, Math.abs(xMm), coolantTemp);
      if (temperature === null) continue;
      const index = row * FIELD_WIDTH + column;
      values[index] = temperature;
      mask[index] = 1;
    }
  }
  return {
    kind: 'synthetic-layer-interpolation',
    profile: 'illustrative-chebyshev',
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    values,
    mask,
    xMinMm: -halfWidthMm,
    xMaxMm: halfWidthMm,
    zMinMm: 0,
    zMaxMm: totalHeightMm,
  };
}
