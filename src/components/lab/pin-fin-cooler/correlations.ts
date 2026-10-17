import type { Arrangement } from './parameters';

/**
 * Empirical tube-bank correlations used for the pin array.
 *
 * Heat transfer: Zukauskas (1972) as tabulated in Incropera, DeWitt, Bergman & Lavine,
 * Fundamentals of Heat and Mass Transfer, 6th ed. (Wiley, 2007), Eq. 7.58 with
 * Tables 7.5 (C1, m) and 7.6 (C2, row correction); the 10²–10³ band uses the
 * single-cylinder Zukauskas form of Eq. 7.53 / Table 7.4 as that table instructs.
 *
 * Pressure drop: Gaddis & Gnielinski (1985), Chem. Eng. Process. 19, 39–49, as given in
 * the VDI Heat Atlas (2nd ed., 2010), Chapter L1.
 */

export type ZukauskasBand = 'laminar' | 'single-cylinder' | 'subcritical' | 'critical';

export interface ZukauskasResult {
  nusselt: number;
  c1: number;
  c2: number;
  m: number;
  /** Prandtl exponent actually used. */
  n: number;
  band: ZukauskasBand;
  /** Whether Table 7.6 applied (N_L < 20 and Re_max ≥ 10³). */
  rowCorrectionApplied: boolean;
}

const ROWS = [1, 2, 3, 4, 5, 7, 10, 13, 16, 20] as const;
const C2_ALIGNED = [0.7, 0.8, 0.86, 0.9, 0.92, 0.95, 0.97, 0.98, 0.99, 1] as const;
const C2_STAGGERED = [0.64, 0.76, 0.84, 0.89, 0.92, 0.95, 0.97, 0.98, 0.99, 1] as const;

/** Incropera Table 7.6; linear interpolation between tabulated row counts, 1 at N_L ≥ 20. */
export function rowCorrection(rows: number, arrangement: Arrangement): number {
  if (!(rows >= 1)) throw new RangeError('At least one row is required');
  if (rows >= 20) return 1;
  const values = arrangement === 'inline' ? C2_ALIGNED : C2_STAGGERED;
  const upper = ROWS.findIndex((count) => count >= rows);
  if (ROWS[upper] === rows) return values[upper]!;
  const n0 = ROWS[upper - 1]!;
  const n1 = ROWS[upper]!;
  const f = (rows - n0) / (n1 - n0);
  return values[upper - 1]! + (values[upper]! - values[upper - 1]!) * f;
}

/** Incropera Table 7.5 constants for a bank of N_L ≥ 20 rows. */
export function bankConstants(
  reynolds: number,
  arrangement: Arrangement,
  pitchRatioTL: number,
): { c1: number; m: number; band: ZukauskasBand } {
  if (reynolds < 100) return { c1: arrangement === 'inline' ? 0.8 : 0.9, m: 0.4, band: 'laminar' };
  if (reynolds < 1000) return { c1: 0.51, m: 0.5, band: 'single-cylinder' };
  if (reynolds < 2e5) {
    if (arrangement === 'inline') return { c1: 0.27, m: 0.63, band: 'subcritical' };
    return pitchRatioTL < 2
      ? { c1: 0.35 * Math.pow(pitchRatioTL, 0.2), m: 0.6, band: 'subcritical' }
      : { c1: 0.4, m: 0.6, band: 'subcritical' };
  }
  return { c1: arrangement === 'inline' ? 0.021 : 0.022, m: 0.84, band: 'critical' };
}

/**
 * Nu_D = C1 C2 Re_max^m Pr^0.36 (Pr / Pr_s)^(1/4). Properties at the mean bulk temperature,
 * Pr_s at the wall. In the single-cylinder band (Eq. 7.53) Pr^n uses n = 0.37 for Pr ≤ 10.
 */
export function zukauskasBank(input: {
  reynolds: number;
  prandtl: number;
  prandtlWall: number;
  rows: number;
  arrangement: Arrangement;
  pitchT: number;
  pitchL: number;
}): ZukauskasResult {
  const { reynolds, prandtl, prandtlWall, rows, arrangement } = input;
  if (!(reynolds > 0 && prandtl > 0 && prandtlWall > 0)) throw new RangeError('Invalid Re/Pr');
  const { c1, m, band } = bankConstants(reynolds, arrangement, input.pitchT / input.pitchL);
  const n = band === 'single-cylinder' && prandtl <= 10 ? 0.37 : 0.36;
  const rowCorrectionApplied = rows < 20 && reynolds >= 1000;
  const c2 = rowCorrectionApplied ? rowCorrection(rows, arrangement) : 1;
  const nusselt =
    c1 * c2 * Math.pow(reynolds, m) * Math.pow(prandtl, n) * Math.pow(prandtl / prandtlWall, 0.25);
  return { nusselt, c1, c2, m, n, band, rowCorrectionApplied };
}

/**
 * Maximum (narrowest-section) velocity factor V_max / V for the bank, Incropera Eqs. 7.59–7.61.
 * Staggered banks use the diagonal gap when S_D < (S_T + D) / 2.
 */
export function velocityRatio(pitchT: number, pitchL: number, arrangement: Arrangement) {
  const diagonal = Math.hypot(pitchL, pitchT / 2);
  const diagonalGoverns = arrangement === 'staggered' && diagonal < (pitchT + 1) / 2;
  return {
    ratio: diagonalGoverns ? pitchT / (2 * (diagonal - 1)) : pitchT / (pitchT - 1),
    diagonal,
    diagonalGoverns,
  };
}

export interface GaddisResult {
  /** Pressure-drop coefficient ξ (per main resistance, based on ρ u₀² / 2). */
  xi: number;
  xiLaminar: number;
  xiTurbulent: number;
  inletOutlet: number;
  /** Weight of the turbulent part, 1 − exp(−(Re + k₁)/k₂). */
  turbulentWeight: number;
  /** Number of main resistances N_W. */
  resistances: number;
  diagonal: number;
  diagonalGoverns: boolean;
  /** Pa. */
  pressureDrop: number;
}

/**
 * Gaddis–Gnielinski cross-flow bundle pressure drop Δp = ξ N_W ρ u₀² / 2, with u₀ and Re₀ in
 * the narrowest cross-section. a = S_T/D, b = S_L/D, c = √((a/2)² + b²).
 * In-line:   ξ = ξ_lam + (ξ_t + f_n)[1 − exp(−(Re + 1000)/2000)]
 * Staggered: ξ = ξ_lam + (ξ_t + f_n)[1 − exp(−(Re + 200)/1000)]
 * f_n (inlet/outlet) is defined for 5 ≤ N_W ≤ 10 and zero above; it is evaluated at N_W = 5 for
 * shorter arrays, which the validity check flags. No wall-viscosity correction is applied.
 */
export function gaddisGnielinski(input: {
  reynolds: number;
  a: number;
  b: number;
  rows: number;
  arrangement: Arrangement;
  density: number;
  velocityNarrowest: number;
}): GaddisResult {
  const { reynolds: re, a, b, rows, arrangement, density, velocityNarrowest } = input;
  if (!(re > 0 && a > 1 && b > 0 && rows >= 1)) throw new RangeError('Invalid bundle input');
  const diagonal = Math.hypot(a / 2, b);
  const diagonalGoverns = arrangement === 'staggered' && b < 0.5 * Math.sqrt(2 * a + 1);
  const shape = (280 * Math.PI * ((Math.sqrt(b) - 0.6) ** 2 + 0.75)) / (4 * a * b - Math.PI);
  const xiLaminar = shape / (Math.pow(diagonalGoverns ? diagonal : a, 1.6) * re);
  let xiTurbulent: number;
  if (arrangement === 'inline') {
    const ft =
      (0.22 + (1.2 * Math.pow(1 - 0.94 / b, 0.6)) / Math.pow(a - 0.85, 1.3)) *
        Math.pow(10, 0.47 * (b / a - 1.5)) +
      0.03 * (a - 1) * (b - 1);
    xiTurbulent = ft / Math.pow(re, (0.1 * b) / a);
  } else {
    const ft =
      2.5 + 1.2 / Math.pow(a - 0.85, 1.08) + 0.4 * (b / a - 1) ** 3 - 0.01 * (a / b - 1) ** 3;
    xiTurbulent = ft / Math.pow(re, 0.25);
  }
  const resistances = Math.max(1, diagonalGoverns ? rows - 1 : rows);
  const nForInlet = Math.max(5, resistances);
  const inletFactor = diagonalGoverns ? ((2 * (diagonal - 1)) / (a * (a - 1))) ** 2 : 1 / (a * a);
  const inletOutlet = nForInlet <= 10 ? inletFactor * (1 / nForInlet - 0.1) : 0;
  const turbulentWeight =
    arrangement === 'inline' ? 1 - Math.exp(-(re + 1000) / 2000) : 1 - Math.exp(-(re + 200) / 1000);
  const xi = xiLaminar + (xiTurbulent + inletOutlet) * turbulentWeight;
  return {
    xi,
    xiLaminar,
    xiTurbulent,
    inletOutlet,
    turbulentWeight,
    resistances,
    diagonal,
    diagonalGoverns,
    pressureDrop: (xi * resistances * density * velocityNarrowest ** 2) / 2,
  };
}

/** Uniform-section pin with an adiabatic tip: η_f = tanh(mH)/(mH), m = √(4h / (k D)). */
export function pinFinEfficiency(input: {
  h: number;
  conductivity: number;
  diameter: number;
  height: number;
}): { m: number; mH: number; efficiency: number } {
  const { h, conductivity, diameter, height } = input;
  if (!(h > 0 && conductivity > 0 && diameter > 0 && height > 0))
    throw new RangeError('Invalid fin input');
  const m = Math.sqrt((4 * h) / (conductivity * diameter));
  const mH = m * height;
  return { m, mH, efficiency: Math.tanh(mH) / mH };
}

/** Heat rate of one adiabatic-tip pin fin, W: √(h P k A_c) θ_b tanh(mH). */
export function pinFinHeatRate(input: {
  h: number;
  conductivity: number;
  diameter: number;
  height: number;
  excessTemperature: number;
}): number {
  const { h, conductivity, diameter, excessTemperature } = input;
  const { mH } = pinFinEfficiency(input);
  const perimeter = Math.PI * diameter;
  const area = (Math.PI * diameter * diameter) / 4;
  return Math.sqrt(h * perimeter * conductivity * area) * excessTemperature * Math.tanh(mH);
}

export type FlowRegime = 'creeping' | 'laminar' | 'transitional' | 'subcritical' | 'critical';

/** Bank flow regimes after Zukauskas (1972), by Re_max. */
export function flowRegime(reynolds: number): FlowRegime {
  if (reynolds < 10) return 'creeping';
  if (reynolds < 100) return 'laminar';
  if (reynolds < 1000) return 'transitional';
  if (reynolds < 2e5) return 'subcritical';
  return 'critical';
}
