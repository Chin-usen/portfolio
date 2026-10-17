import type { ConductorId, SwitchState } from './geometry.ts';

export type { ConductorId, SwitchState } from './geometry.ts';
export type MaterialId = 'cu-c1020' | 'al-1060';

/** Page inputs. Geometry in mm, current in A, sigma in MS/m, k in W/(m·K), h in W/(m²·K). */
export interface BusbarParams {
  state: SwitchState;
  current: number;
  thickness: number;
  strapWidth: number;
  sigma: number;
  k: number;
  h: number;
  tSub: number;
}

export type NumericKey = Exclude<keyof BusbarParams, 'state'>;

export interface ParameterDefinition {
  key: NumericKey;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: 'A' | 'mm' | 'MS/m' | 'W/(m·K)' | 'W/(m²·K)' | '°C';
}

export interface ConductorResult {
  id: ConductorId;
  active: boolean;
  /** Resistance between terminal washer and active pins, Ω; 0 when inactive. */
  resistance: number;
  /** Joule loss, W. */
  loss: number;
  /** Peak temperature rise above T_sub, K. */
  riseMax: number;
  /** Surrogate geometric resistance R_g (1/m) and normalized peak Θ; null when inactive. */
  resistanceG: number | null;
  thetaMax: number | null;
}

export interface BusbarResult {
  state: SwitchState;
  conductors: Record<ConductorId, ConductorResult>;
  /** Series resistance of the two current-carrying conductors, Ω. */
  resistance: number;
  loss: number;
  riseMax: number;
  tMax: number;
  hottest: ConductorId;
  /** Mean current density in a strap cross-section, I / (b t), A/mm². */
  strapCurrentDensity: number;
  /** Factor converting normalized Θ to K for this case: I² / (σ k). */
  thermalScale: number;
  beta: number;
}
