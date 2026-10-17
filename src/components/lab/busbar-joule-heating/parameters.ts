import { NOMINAL_GEOMETRY } from './geometry.ts';
import type { BusbarParams, MaterialId, NumericKey, ParameterDefinition } from './types.ts';

/** Constant-property presets (typical handbook values, not procurement data). */
export const MATERIAL_PRESETS: readonly { id: MaterialId; sigma: number; k: number }[] =
  Object.freeze([
    Object.freeze({ id: 'cu-c1020', sigma: 58.0, k: 391 }),
    Object.freeze({ id: 'al-1060', sigma: 35.4, k: 234 }),
  ]);

const definitions = {
  current: { min: 50, max: 400, step: 10, defaultValue: 200, unit: 'A' },
  tSub: { min: 40, max: 100, step: 1, defaultValue: 70, unit: '°C' },
  thickness: {
    min: 0.5,
    max: 3,
    step: 0.1,
    defaultValue: NOMINAL_GEOMETRY.thicknessMm,
    unit: 'mm',
  },
  strapWidth: {
    min: 2,
    max: 6,
    step: 0.1,
    defaultValue: NOMINAL_GEOMETRY.strapWidthMm,
    unit: 'mm',
  },
  sigma: { min: 10, max: 60, step: 0.1, defaultValue: 58.0, unit: 'MS/m' },
  k: { min: 100, max: 400, step: 1, defaultValue: 391, unit: 'W/(m·K)' },
  h: { min: 5, max: 500, step: 5, defaultValue: 50, unit: 'W/(m²·K)' },
} satisfies Record<NumericKey, Omit<ParameterDefinition, 'key'>>;

export const PARAMETER_DEFINITIONS: readonly ParameterDefinition[] = Object.freeze(
  Object.entries(definitions).map(([key, value]) =>
    Object.freeze({ key: key as NumericKey, ...value }),
  ),
);

export const DEFAULT_PARAMS: Readonly<BusbarParams> = Object.freeze({
  state: 'sh',
  ...(Object.fromEntries(
    PARAMETER_DEFINITIONS.map(({ key, defaultValue }) => [key, defaultValue]),
  ) as Record<NumericKey, number>),
});

export function definition(key: NumericKey): ParameterDefinition {
  return PARAMETER_DEFINITIONS.find((entry) => entry.key === key)!;
}

export function materialOf(params: Pick<BusbarParams, 'sigma' | 'k'>): MaterialId | 'custom' {
  return (
    MATERIAL_PRESETS.find((preset) => preset.sigma === params.sigma && preset.k === params.k)?.id ??
    'custom'
  );
}

/** Reject invalid inputs rather than clamping them silently. */
export function validateParams(input: BusbarParams): BusbarParams {
  if (!input || typeof input !== 'object') throw new TypeError('Parameters must be an object.');
  if (input.state !== 'sh' && input.state !== 'sl')
    throw new TypeError('State must be "sh" or "sl".');
  const output = { state: input.state } as BusbarParams;
  for (const { key, min, max } of PARAMETER_DEFINITIONS) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new TypeError(`${key} must be a finite number.`);
    if (value < min || value > max)
      throw new RangeError(`${key} must be between ${min} and ${max}.`);
    output[key] = value;
  }
  return output;
}
