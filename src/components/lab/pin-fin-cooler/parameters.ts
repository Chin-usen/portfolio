/** Single source for slider bounds, increments, units and the default operating point. */
export type Arrangement = 'inline' | 'staggered';
export type CoolantId = 'water' | 'glycol50';
export type PinMaterialId = 'copper' | 'aluminium';

export interface PinFinParams {
  /** Volumetric flow, L/min. */
  flow: number;
  /** Coolant inlet temperature, °C. */
  tIn: number;
  /** Heat load applied to the base, W (sets outlet and wall temperatures only). */
  heat: number;
  /** Pin diameter, mm. */
  diameter: number;
  /** Transverse pitch ratio S_T / D. */
  pitchT: number;
  /** Longitudinal pitch ratio S_L / D. */
  pitchL: number;
  /** Pin height = channel height, mm. */
  height: number;
  /** Footprint width across the flow, mm. */
  width: number;
  /** Footprint length along the flow, mm. */
  length: number;
  arrangement: Arrangement;
  coolant: CoolantId;
  material: PinMaterialId;
}

export type NumericKey = Exclude<keyof PinFinParams, 'arrangement' | 'coolant' | 'material'>;
export type GroupId = 'flow' | 'pins' | 'footprint';

export interface ParameterDefinition {
  key: NumericKey;
  group: GroupId;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  /** Decimal places shown next to the slider. */
  digits: number;
}

const definitions = {
  flow: { group: 'flow', min: 2, max: 20, step: 0.5, defaultValue: 8, unit: 'L/min', digits: 1 },
  tIn: { group: 'flow', min: 25, max: 85, step: 1, defaultValue: 40, unit: '°C', digits: 0 },
  heat: { group: 'flow', min: 50, max: 1500, step: 10, defaultValue: 400, unit: 'W', digits: 0 },
  diameter: { group: 'pins', min: 1, max: 3, step: 0.1, defaultValue: 2, unit: 'mm', digits: 1 },
  pitchT: { group: 'pins', min: 1.25, max: 3, step: 0.05, defaultValue: 2, unit: '× D', digits: 2 },
  pitchL: { group: 'pins', min: 1.25, max: 3, step: 0.05, defaultValue: 2, unit: '× D', digits: 2 },
  height: { group: 'pins', min: 4, max: 10, step: 0.5, defaultValue: 8, unit: 'mm', digits: 1 },
  width: {
    group: 'footprint',
    min: 20,
    max: 100,
    step: 5,
    defaultValue: 50,
    unit: 'mm',
    digits: 0,
  },
  length: {
    group: 'footprint',
    min: 20,
    max: 120,
    step: 5,
    defaultValue: 80,
    unit: 'mm',
    digits: 0,
  },
} satisfies Record<NumericKey, Omit<ParameterDefinition, 'key'>>;

export const PARAMETER_DEFINITIONS: readonly ParameterDefinition[] = Object.freeze(
  (Object.keys(definitions) as NumericKey[]).map((key) =>
    Object.freeze({ key, ...definitions[key] } as ParameterDefinition),
  ),
);

export const NUMERIC_KEYS: readonly NumericKey[] = PARAMETER_DEFINITIONS.map(({ key }) => key);

export function definitionOf(key: NumericKey): ParameterDefinition {
  const found = PARAMETER_DEFINITIONS.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown parameter ${key}`);
  return found;
}

export const DEFAULT_PARAMS: Readonly<PinFinParams> = Object.freeze({
  ...(Object.fromEntries(
    PARAMETER_DEFINITIONS.map(({ key, defaultValue }) => [key, defaultValue]),
  ) as Record<NumericKey, number>),
  arrangement: 'staggered',
  coolant: 'water',
  material: 'copper',
});

/** Pin/base conductivities at room temperature, W/(m·K): typical handbook values, not certified data. */
export const MATERIALS: Readonly<Record<PinMaterialId, { conductivity: number }>> = Object.freeze({
  copper: { conductivity: 390 },
  aluminium: { conductivity: 167 },
});

export const ARRANGEMENTS: readonly Arrangement[] = ['inline', 'staggered'];
export const COOLANTS: readonly CoolantId[] = ['water', 'glycol50'];
export const PIN_MATERIALS: readonly PinMaterialId[] = ['copper', 'aluminium'];
export const GROUPS: readonly GroupId[] = ['flow', 'pins', 'footprint'];

/** Base plate thickness drawn in 3D only; the model reports base-surface-to-coolant resistance. */
export const BASE_THICKNESS_MM = 3;
