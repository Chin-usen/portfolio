import { describe, expect, it } from 'vitest';
import {
  bankConstants,
  flowRegime,
  gaddisGnielinski,
  pinFinEfficiency,
  pinFinHeatRate,
  rowCorrection,
  velocityRatio,
  zukauskasBank,
} from '../../../src/components/lab/pin-fin-cooler/correlations';

const within = (actual: number, expected: number, relative: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(relative);

/**
 * Incropera, DeWitt, Bergman & Lavine, Fundamentals of Heat and Mass Transfer, 6th ed. (Wiley,
 * 2007), Example 7.7: staggered bank, D = 16.4 mm, S_T = 31.3 mm, S_L = 34.3 mm, N_L = 7,
 * N_T = 8, air at 15 °C and V = 6 m/s, tube surface at 70 °C. Air (Table A.4): ρ = 1.217 kg/m³,
 * c_p = 1007 J/(kg·K), ν = 14.82e-6 m²/s, k = 0.0253 W/(m·K), Pr = 0.710; Pr_s = 0.701.
 * Book results: V_max = 12.6 m/s, Re_max = 13 943, C1 = 0.34, C2 = 0.95, Nu = 87.9,
 * h = 135.6 W/(m²·K), q′ = 19.4 kW/m, Δp = 246 N/m² (from the Zukauskas charts, χ = 1.04, f = 0.35).
 */
describe('Incropera 6th ed. Example 7.7 (staggered tube bank)', () => {
  const D = 0.0164;
  const a = 31.3 / 16.4;
  const b = 34.3 / 16.4;

  it('uses the transverse gap for V_max because S_D > (S_T + D)/2', () => {
    const { ratio, diagonalGoverns } = velocityRatio(a, b, 'staggered');
    expect(diagonalGoverns).toBe(false);
    within(6 * ratio, 12.6, 0.005);
    within((6 * ratio * D) / 14.82e-6, 13943, 0.005);
  });

  it('reproduces C1, C2, Nu and h (book rounds C1 to 0.34)', () => {
    const result = zukauskasBank({
      reynolds: 13943,
      prandtl: 0.71,
      prandtlWall: 0.701,
      rows: 7,
      arrangement: 'staggered',
      pitchT: a,
      pitchL: b,
    });
    expect(result.c1).toBeCloseTo(0.34, 2);
    expect(result.c2).toBe(0.95);
    expect(result.m).toBe(0.6);
    within(result.nusselt, 87.9, 0.015);
    within((result.nusselt * 0.0253) / D, 135.6, 0.015);
  });

  it('reproduces the heat rate per unit length with ε = 1 − exp(−NTU)', () => {
    const h = 135.6;
    const capacity = 1.217 * 6 * 8 * 0.0313 * 1007; // ρ V N_T S_T c_p per metre of tube
    const ntu = (h * Math.PI * D * 56) / capacity;
    const effectiveness = 1 - Math.exp(-ntu);
    within(effectiveness * capacity * (70 - 15), 19.4e3, 0.01);
  });

  it('Gaddis–Gnielinski Δp agrees with the book chart value within 5 %', () => {
    const result = gaddisGnielinski({
      reynolds: 13943,
      a,
      b,
      rows: 7,
      arrangement: 'staggered',
      density: 1.217,
      velocityNarrowest: 12.6,
    });
    expect(result.resistances).toBe(7);
    expect(result.diagonalGoverns).toBe(false);
    // Independent closed-form evaluation of the VDI L1 terms for this geometry.
    expect(result.xiTurbulent).toBeCloseTo(0.334, 3);
    expect(result.inletOutlet).toBeCloseTo((1 / a ** 2) * (1 / 7 - 0.1), 10);
    within(result.pressureDrop, 246, 0.05);
  });
});

/**
 * Incropera 6th ed. Example 3.9: very long 5 mm rods, base 100 °C, air 25 °C, h = 100 W/(m²·K).
 * Book heat losses: copper (k = 398) 8.3 W, 2024 aluminium (k = 180) 5.6 W, AISI 316 (k = 14)
 * 1.6 W. Infinite-fin length estimate L∞ ≈ 2.65/m.
 */
describe('Incropera 6th ed. Example 3.9 (long pin fins)', () => {
  const base = { h: 100, diameter: 0.005, excessTemperature: 75 };
  it.each([
    [398, 8.3],
    [180, 5.6],
    [14, 1.6],
  ])('k = %d W/(m·K) gives %d W for a long adiabatic-tip pin', (conductivity, expected) => {
    const q = pinFinHeatRate({ ...base, conductivity, height: 1 });
    within(q, expected, 0.03);
  });
  it('at L = 2.65/m the finite pin carries ≥ 99 % of the infinite-fin heat', () => {
    const { m } = pinFinEfficiency({ h: 100, conductivity: 398, diameter: 0.005, height: 1 });
    within(2.65 / m, 0.19, 0.03);
    const finite = pinFinHeatRate({ ...base, conductivity: 398, height: 2.65 / m });
    const infinite = pinFinHeatRate({ ...base, conductivity: 398, height: 10 });
    expect(finite / infinite).toBeGreaterThanOrEqual(0.99);
  });
  it('efficiency is tanh(mH)/(mH) and approaches 1 for short pins', () => {
    const { mH, efficiency } = pinFinEfficiency({
      h: 20000,
      conductivity: 390,
      diameter: 0.002,
      height: 0.008,
    });
    expect(mH).toBeCloseTo(Math.sqrt((4 * 20000) / (390 * 0.002)) * 0.008, 12);
    expect(efficiency).toBeCloseTo(Math.tanh(mH) / mH, 12);
    expect(
      pinFinEfficiency({ h: 1, conductivity: 390, diameter: 0.002, height: 0.001 }).efficiency,
    ).toBeGreaterThan(0.9999);
  });
});

describe('Incropera Tables 7.5 and 7.6', () => {
  it('selects the Re bands and S_T/S_L branches', () => {
    expect(bankConstants(50, 'inline', 1)).toEqual({ c1: 0.8, m: 0.4, band: 'laminar' });
    expect(bankConstants(50, 'staggered', 1)).toEqual({ c1: 0.9, m: 0.4, band: 'laminar' });
    expect(bankConstants(100, 'inline', 1).band).toBe('single-cylinder');
    expect(bankConstants(999, 'staggered', 1)).toEqual({
      c1: 0.51,
      m: 0.5,
      band: 'single-cylinder',
    });
    expect(bankConstants(1000, 'inline', 1)).toEqual({ c1: 0.27, m: 0.63, band: 'subcritical' });
    expect(bankConstants(5000, 'staggered', 2.5)).toEqual({ c1: 0.4, m: 0.6, band: 'subcritical' });
    expect(bankConstants(5000, 'staggered', 1.5).c1).toBeCloseTo(0.35 * 1.5 ** 0.2, 12);
    expect(bankConstants(3e5, 'inline', 1)).toEqual({ c1: 0.021, m: 0.84, band: 'critical' });
  });
  it('tabulates and interpolates the row correction', () => {
    expect(rowCorrection(1, 'inline')).toBe(0.7);
    expect(rowCorrection(1, 'staggered')).toBe(0.64);
    expect(rowCorrection(7, 'staggered')).toBe(0.95);
    expect(rowCorrection(6, 'inline')).toBeCloseTo(0.935, 12);
    expect(rowCorrection(20, 'staggered')).toBe(1);
    expect(rowCorrection(64, 'inline')).toBe(1);
    expect(() => rowCorrection(0, 'inline')).toThrow();
  });
  it('applies C2 only for Re ≥ 10³ and uses Pr^0.37 in the single-cylinder band', () => {
    const common = { prandtl: 5, prandtlWall: 5, rows: 5, arrangement: 'inline' as const };
    const low = zukauskasBank({ ...common, reynolds: 500, pitchT: 2, pitchL: 2 });
    expect(low.rowCorrectionApplied).toBe(false);
    expect(low.c2).toBe(1);
    expect(low.n).toBe(0.37);
    expect(low.nusselt).toBeCloseTo(0.51 * 500 ** 0.5 * 5 ** 0.37, 10);
    const high = zukauskasBank({ ...common, reynolds: 2000, pitchT: 2, pitchL: 2 });
    expect(high.c2).toBe(0.92);
    expect(high.n).toBe(0.36);
  });
  it('classifies the flow regime', () => {
    expect([5, 50, 500, 5000, 3e5].map(flowRegime)).toEqual([
      'creeping',
      'laminar',
      'transitional',
      'subcritical',
      'critical',
    ]);
  });
});

describe('Gaddis–Gnielinski structure', () => {
  it('uses the diagonal section and N_W = N_R − 1 for narrow staggered banks', () => {
    const narrow = gaddisGnielinski({
      reynolds: 5000,
      a: 3,
      b: 1.25,
      rows: 20,
      arrangement: 'staggered',
      density: 1000,
      velocityNarrowest: 1,
    });
    // b < 0.5√(2a + 1) = 1.32 → diagonal governs, same criterion as S_D < (S_T + D)/2.
    expect(narrow.diagonalGoverns).toBe(true);
    expect(velocityRatio(3, 1.25, 'staggered').diagonalGoverns).toBe(true);
    expect(narrow.resistances).toBe(19);
    expect(narrow.inletOutlet).toBe(0);
  });
  it('blends laminar and turbulent terms with the published weights', () => {
    const inline = gaddisGnielinski({
      reynolds: 100,
      a: 2,
      b: 2,
      rows: 20,
      arrangement: 'inline',
      density: 1000,
      velocityNarrowest: 1,
    });
    expect(inline.turbulentWeight).toBeCloseTo(1 - Math.exp(-1100 / 2000), 12);
    const laminar =
      (280 * Math.PI * ((Math.sqrt(2) - 0.6) ** 2 + 0.75)) / (2 ** 1.6 * (16 - Math.PI) * 100);
    expect(inline.xiLaminar).toBeCloseTo(laminar, 12);
    expect(inline.pressureDrop).toBeCloseTo((inline.xi * 20 * 1000) / 2, 9);
  });
});
