import type { ParameterDefinition, ParameterGroupId, ParameterKey, ThermalParams } from './types';

/** Single source for bounds, control increments, units and initial values. */
const parameters = {
  t_cooler: { group: 'cooler', min: 1, max: 5, step: 0.1, defaultValue: 3, unit: 'mm' },
  k_cooler: { group: 'cooler', min: 120, max: 400, step: 1, defaultValue: 390, unit: 'W/(m·K)' },
  t_sb: { group: 'bottom-solder', min: 0.05, max: 0.3, step: 0.01, defaultValue: 0.1, unit: 'mm' },
  k_sb: { group: 'bottom-solder', min: 20, max: 250, step: 1, defaultValue: 58, unit: 'W/(m·K)' },
  t_cub: { group: 'copper', min: 0.1, max: 1, step: 0.01, defaultValue: 0.3, unit: 'mm' },
  t_cer: { group: 'ceramic', min: 0.2, max: 1, step: 0.01, defaultValue: 0.32, unit: 'mm' },
  k_cer: { group: 'ceramic', min: 20, max: 200, step: 1, defaultValue: 90, unit: 'W/(m·K)' },
  t_cut: { group: 'copper', min: 0.1, max: 1, step: 0.01, defaultValue: 0.3, unit: 'mm' },
  k_cu: { group: 'copper', min: 250, max: 400, step: 1, defaultValue: 390, unit: 'W/(m·K)' },
  t_st: { group: 'top-solder', min: 0.05, max: 0.3, step: 0.01, defaultValue: 0.08, unit: 'mm' },
  k_st: { group: 'top-solder', min: 20, max: 250, step: 1, defaultValue: 200, unit: 'W/(m·K)' },
  h: {
    group: 'operating',
    min: 2000,
    max: 20000,
    step: 500,
    defaultValue: 15000,
    unit: 'W/(m²·K)',
  },
  P: { group: 'operating', min: 50, max: 500, step: 10, defaultValue: 100, unit: 'W' },
  T_cool: { group: 'operating', min: 25, max: 85, step: 1, defaultValue: 65, unit: '°C' },
} satisfies Record<ParameterKey, Omit<ParameterDefinition, 'key'>>;

export const PARAMETER_DEFINITIONS: readonly ParameterDefinition[] = Object.freeze(
  Object.entries(parameters).map(([key, definition]) =>
    Object.freeze({ key: key as ParameterKey, ...definition }),
  ),
);

export const DEFAULT_PARAMS: Readonly<ThermalParams> = Object.freeze(
  Object.fromEntries(
    PARAMETER_DEFINITIONS.map(({ key, defaultValue }) => [key, defaultValue]),
  ) as unknown as ThermalParams,
);

const groupOrder: ParameterGroupId[] = [
  'operating',
  'top-solder',
  'copper',
  'ceramic',
  'bottom-solder',
  'cooler',
];
export const PARAMETER_GROUPS = Object.freeze(
  groupOrder.map((id) =>
    Object.freeze({
      id,
      keys: Object.freeze(
        PARAMETER_DEFINITIONS.filter((definition) => definition.group === id).map(({ key }) => key),
      ),
    }),
  ),
);

/** Illustrative constant-property material choices supplied in the task, not certified material data. */
export const MATERIAL_PRESETS = Object.freeze({
  solder: Object.freeze([
    { id: 'sac305', conductivity: 58 },
    { id: 'sintered-ag', conductivity: 200 },
  ]),
  ceramic: Object.freeze([
    { id: 'alumina', conductivity: 24 },
    { id: 'silicon-nitride', conductivity: 90 },
    { id: 'aluminium-nitride', conductivity: 170 },
  ]),
  cooler: Object.freeze([
    { id: 'copper', conductivity: 390 },
    { id: 'al6061', conductivity: 167 },
  ]),
});

/** Scenario presets isolate one change for comparison. Material pills use MATERIAL_PRESETS. */
export const PRESETS = Object.freeze([
  { id: 'baseline', params: DEFAULT_PARAMS },
  { id: 'limited-cooling', params: Object.freeze({ ...DEFAULT_PARAMS, h: 2000 }) },
  { id: 'high-conductivity-ceramic', params: Object.freeze({ ...DEFAULT_PARAMS, k_cer: 200 }) },
]);

export const FIXED_GEOMETRY = Object.freeze({
  chipThicknessMm: 0.18,
  chipConductivity: 370,
  chipWidthMm: 5,
  topSolderWidthMm: 5,
  copperWidthMm: 10,
  ceramicWidthMm: 12,
  bottomSolderWidthMm: 10,
  coolerWidthMm: 30,
});

/** Reject invalid inputs instead of silently clamping or propagating NaN to rendering. */
export function validateParams(input: ThermalParams): ThermalParams {
  if (!input || typeof input !== 'object')
    throw new TypeError('Thermal parameters must be an object.');
  const output = {} as ThermalParams;
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
