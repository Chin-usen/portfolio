import { GLYCOL50_TABLE, WATER_TABLE, type CoolantRow } from './coolant-data';
import type { CoolantId } from './parameters';

export interface FluidState {
  /** Temperature actually used for the lookup, °C (clamped to the table). */
  temperature: number;
  density: number;
  cp: number;
  conductivity: number;
  viscosity: number;
  prandtl: number;
  /** True when the requested temperature lay outside the tabulated range. */
  clamped: boolean;
}

const tables: Record<CoolantId, readonly CoolantRow[]> = {
  water: WATER_TABLE,
  glycol50: GLYCOL50_TABLE,
};

export function propertyRange(coolant: CoolantId): { min: number; max: number } {
  const table = tables[coolant];
  return { min: table[0]![0], max: table[table.length - 1]![0] };
}

/**
 * Linear interpolation in temperature for ρ, cp and k; viscosity is interpolated in ln μ,
 * which follows its near-Arrhenius temperature dependence. Pr is derived, not interpolated.
 */
export function fluidProperties(coolant: CoolantId, temperature: number): FluidState {
  if (!Number.isFinite(temperature)) throw new RangeError('Temperature must be finite');
  const table = tables[coolant];
  const { min, max } = propertyRange(coolant);
  const t = Math.min(max, Math.max(min, temperature));
  let upper = table.findIndex((row) => row[0] >= t);
  if (upper <= 0) upper = 1;
  const a = table[upper - 1]!;
  const b = table[upper]!;
  const f = (t - a[0]) / (b[0] - a[0]);
  const lerp = (index: 1 | 2 | 3) => a[index] + (b[index] - a[index]) * f;
  const viscosity = Math.exp(Math.log(a[4]) + (Math.log(b[4]) - Math.log(a[4])) * f);
  const cp = lerp(2);
  const conductivity = lerp(3);
  return {
    temperature: t,
    density: lerp(1),
    cp,
    conductivity,
    viscosity,
    prandtl: (cp * viscosity) / conductivity,
    clamped: t !== temperature,
  };
}

/** Unit conversions used by the evaluator; kept explicit so tests can pin them. */
export const units = {
  litresPerMinuteToCubicMetresPerSecond: (value: number) => value / 60_000,
  millimetresToMetres: (value: number) => value / 1000,
  pascalToKilopascal: (value: number) => value / 1000,
  celsiusToKelvin: (value: number) => value + 273.15,
} as const;
