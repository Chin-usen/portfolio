/** Public thermal model contract. Geometric inputs are millimetres; calculations use SI. */
export interface ThermalParams {
  t_cooler: number;
  k_cooler: number;
  t_sb: number;
  k_sb: number;
  t_cub: number;
  t_cer: number;
  k_cer: number;
  t_cut: number;
  k_cu: number;
  t_st: number;
  k_st: number;
  h: number;
  P: number;
  T_cool: number;
}

export type ParameterKey = keyof ThermalParams;
export type ParameterGroupId =
  'cooler' | 'bottom-solder' | 'copper' | 'ceramic' | 'top-solder' | 'operating';
export interface ParameterDefinition {
  key: ParameterKey;
  group: ParameterGroupId;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: 'mm' | 'W/(m·K)' | 'W/(m²·K)' | 'W' | '°C';
}

export type ThermalLayerId =
  'chip' | 'solder-top' | 'copper-top' | 'ceramic' | 'copper-bottom' | 'solder-bottom' | 'cooler';

export interface ThermalLayer {
  id: ThermalLayerId;
  /** Stable English descriptive name; UI translates id separately. */
  name: string;
  /** K/W: analytical equivalent resistance, or FEM-surrogate centreline temperature drop / P. */
  rth: number;
  tTop: number;
  tBottom: number;
  /** Physical thickness and square side length, in mm. */
  thickness: number;
  width: number;
  /** Conductivity in W/(m·K). */
  k: number;
  /** Analytical spreading footprints in mm; absent for the FEM-trained surrogate. */
  sourceWidthMm?: number;
  exitWidthMm?: number;
  /** Physical coordinates: cooler bottom is z=0; positive z points toward chip. */
  zTopMm: number;
  zBottomMm: number;
}

export interface CoolerTerms {
  aM: number;
  bM: number;
  epsilon: number;
  tau: number;
  Bi: number;
  lambda: number;
  phi: number;
  rSpreading: number;
  rThrough: number;
}

export interface ThermalField {
  kind: 'synthetic-layer-interpolation' | 'fem-surrogate-central-plane';
  profile?: 'illustrative-chebyshev';
  width: number;
  height: number;
  /** Celsius at cell centres, row-major. Row 0 is the bottom (+z increases with row). */
  values: Float32Array;
  /** 1 inside the physical x-z geometry, 0 outside. Outside values are coolant temperature. */
  mask: Uint8Array;
  xMinMm: number;
  xMaxMm: number;
  zMinMm: number;
  zMaxMm: number;
  /** FEM-POD sample centres; z coordinates are nonuniform and depend on layer thickness. */
  xMm?: Float32Array;
  zMm?: Float32Array;
  /** Physical layer owning each FEM sample row; prevents cross-interface interpolation. */
  rowLayerIds?: readonly ThermalLayerId[];
}

export interface ThermalResult {
  /** Analytical mode: one source node. FEM surrogate: independently predicted surface peak and mean. */
  tjMax: number;
  tjAvg: number;
  rthTotal: number;
  rthAverage?: number;
  layers: ThermalLayer[];
  rConv: number;
  /** Area-average 1/(h A), distinct from the surrogate centreline contribution rConv. */
  rConvAreaAverage?: number;
  tMin: number;
  tMax: number;
  totalHeightMm: number;
  coolerTerms?: CoolerTerms;
  field?: ThermalField;
  model: {
    kind: 'analytic-resistance-network' | 'fem-trained-surrogate';
    junction?: 'single-lumped-source-node';
    peakAndAverageResolvedSeparately: boolean;
    field: 'synthetic-layer-interpolation' | 'fem-surrogate-central-plane' | 'omitted';
    profile?: 'illustrative-chebyshev';
    isFEM: false;
    trainedOnFEM?: true;
    centrelineContributions?: true;
    dataSHA256?: string;
  };
}
