import {
  flowRegime,
  gaddisGnielinski,
  pinFinEfficiency,
  velocityRatio,
  zukauskasBank,
  type FlowRegime,
  type ZukauskasBand,
} from './correlations';
import { MATERIALS, type Arrangement, type PinFinParams } from './parameters';
import { fluidProperties, propertyRange, units, type FluidState } from './properties';
import { pinLayout, type PinLayout } from './layout';

export { pinLayout, type PinLayout };

export type ValidityStatus = 'ok' | 'caution' | 'out';
export type CorrelationId = 'zukauskas' | 'gaddis' | 'fin' | 'properties' | 'geometry';
export type ValidityId =
  | 'zk-re'
  | 'zk-pr'
  | 'zk-band'
  | 'zk-rows'
  | 'zk-aligned'
  | 'gg-re'
  | 'gg-a'
  | 'gg-b'
  | 'gg-c'
  | 'gg-rows'
  | 'gg-low-re'
  | 'fin-biot'
  | 'prop-bulk'
  | 'prop-wall'
  | 'prop-boil'
  | 'geo-short';

export interface ValidityCheck {
  id: ValidityId;
  correlation: CorrelationId;
  status: ValidityStatus;
  value: number;
  /** Inclusive limits that keep the status at 'ok'; null when one-sided. */
  min: number | null;
  max: number | null;
}

export interface PinFinResult {
  ok: true;
  layout: Omit<PinLayout, 'centres'>;
  arrangement: Arrangement;
  /** m² */
  areas: { fins: number; base: number; total: number; footprint: number; frontal: number };
  bulk: FluidState;
  wall: FluidState;
  massFlow: number;
  velocity: { approach: number; max: number; diagonalGoverns: boolean };
  reynolds: number;
  regime: FlowRegime;
  band: ZukauskasBand;
  nusselt: number;
  c1: number;
  c2: number;
  /** Mean bank heat-transfer coefficient, W/(m²·K). */
  h: number;
  fin: { m: number; mH: number; efficiency: number; biot: number };
  surfaceEfficiency: number;
  /** η_o h A_tot, W/K */
  conductance: number;
  ntu: number;
  effectiveness: number;
  /** Base to coolant inlet, K/W (the headline thermal resistance). */
  rth: number;
  /** Base to mean coolant, 1/(η_o h A), K/W. */
  rConvective: number;
  /** Caloric (coolant temperature rise) part, rth − rConvective, K/W. */
  rCaloric: number;
  tOut: number;
  tBase: number;
  tWall: number;
  pressureDrop: number;
  pressureDropKpa: number;
  pumpingPower: number;
  gaddis: { xi: number; resistances: number; turbulentWeight: number; inletOutlet: number };
  iterations: number;
  checks: ValidityCheck[];
  outCount: number;
  cautionCount: number;
}

export interface PinFinFailure {
  ok: false;
  reason: 'no-pins' | 'invalid';
}

const status = (inside: boolean, failure: ValidityStatus = 'out'): ValidityStatus =>
  inside ? 'ok' : failure;

/**
 * Steady single-phase estimate. Iterates the bulk mean temperature (outlet from the energy
 * balance) and the mean wall temperature (Q / h A_tot above bulk) used for Pr_s.
 */
export function evaluate(params: PinFinParams): PinFinResult | PinFinFailure {
  const numbers = [
    params.flow,
    params.tIn,
    params.heat,
    params.diameter,
    params.pitchT,
    params.pitchL,
    params.height,
    params.width,
    params.length,
  ];
  if (numbers.some((value) => !Number.isFinite(value) || value <= 0) || params.pitchT <= 1)
    return { ok: false, reason: 'invalid' };
  const layout = pinLayout(params);
  if (layout.count === 0 || layout.rows === 0) return { ok: false, reason: 'no-pins' };
  const mm = units.millimetresToMetres;
  const d = mm(params.diameter);
  const height = mm(params.height);
  const width = mm(params.width);
  const length = mm(params.length);
  const flow = units.litresPerMinuteToCubicMetresPerSecond(params.flow);
  const kFin = MATERIALS[params.material].conductivity;
  const fins = layout.count * Math.PI * d * height;
  const footprint = width * length;
  const base = footprint - (layout.count * Math.PI * d * d) / 4;
  const total = fins + base;
  const frontal = width * height;
  const approach = flow / frontal;
  const { ratio, diagonalGoverns } = velocityRatio(
    params.pitchT,
    params.pitchL,
    params.arrangement,
  );
  const vMax = approach * ratio;

  let tMean = params.tIn;
  let tWall = params.tIn + 5;
  let iterations = 0;
  let state = solve();
  for (; iterations < 60; iterations += 1) {
    const nextMean = (params.tIn + state.tOut) / 2;
    const nextWall = nextMean + params.heat / (state.h * total);
    const change = Math.abs(nextMean - tMean) + Math.abs(nextWall - tWall);
    tMean = nextMean;
    tWall = nextWall;
    state = solve();
    if (change < 1e-9) break;
  }

  function solve() {
    const bulk = fluidProperties(params.coolant, tMean);
    const wall = fluidProperties(params.coolant, tWall);
    const reynolds = (bulk.density * vMax * d) / bulk.viscosity;
    const zk = zukauskasBank({
      reynolds,
      prandtl: bulk.prandtl,
      prandtlWall: wall.prandtl,
      rows: layout.rows,
      arrangement: params.arrangement,
      pitchT: params.pitchT,
      pitchL: params.pitchL,
    });
    const h = (zk.nusselt * bulk.conductivity) / d;
    const fin = pinFinEfficiency({ h, conductivity: kFin, diameter: d, height });
    const surfaceEfficiency = 1 - (fins / total) * (1 - fin.efficiency);
    const conductance = surfaceEfficiency * h * total;
    const massFlow = bulk.density * flow;
    const capacity = massFlow * bulk.cp;
    const ntu = conductance / capacity;
    const effectiveness = 1 - Math.exp(-ntu);
    const rth = 1 / (effectiveness * capacity);
    return {
      bulk,
      wall,
      reynolds,
      zk,
      h,
      fin,
      surfaceEfficiency,
      conductance,
      massFlow,
      capacity,
      ntu,
      effectiveness,
      rth,
      tOut: params.tIn + params.heat / capacity,
    };
  }

  const { bulk, wall, reynolds, zk, h, fin } = state;
  const gg = gaddisGnielinski({
    reynolds,
    a: params.pitchT,
    b: params.pitchL,
    rows: layout.rows,
    arrangement: params.arrangement,
    density: bulk.density,
    velocityNarrowest: vMax,
  });
  const biot = (h * d) / (4 * kFin);
  const range = propertyRange(params.coolant);
  const bMin = params.arrangement === 'inline' ? 1.2 : 0.6;
  const checks: ValidityCheck[] = [
    check('zk-re', 'zukauskas', reynolds, 10, 2e6),
    check('zk-pr', 'zukauskas', bulk.prandtl, 0.7, 500),
    {
      id: 'zk-band',
      correlation: 'zukauskas',
      value: reynolds,
      min: null,
      max: null,
      status: zk.band === 'single-cylinder' ? 'caution' : 'ok',
    },
    {
      id: 'zk-rows',
      correlation: 'zukauskas',
      value: layout.rows,
      min: 20,
      max: null,
      status: layout.rows >= 20 || reynolds >= 1000 ? 'ok' : 'caution',
    },
    {
      id: 'zk-aligned',
      correlation: 'zukauskas',
      value: params.pitchT / params.pitchL,
      min: params.arrangement === 'inline' ? 0.7 : null,
      max: null,
      status:
        params.arrangement === 'inline' && params.pitchT / params.pitchL < 0.7 ? 'caution' : 'ok',
    },
    check('gg-re', 'gaddis', reynolds, 1, 3e5),
    check('gg-a', 'gaddis', params.pitchT, 1.25, 3),
    check('gg-b', 'gaddis', params.pitchL, bMin, 3),
    {
      id: 'gg-c',
      correlation: 'gaddis',
      value: gg.diagonal,
      min: params.arrangement === 'staggered' ? 1.25 : null,
      max: null,
      status: params.arrangement === 'staggered' && gg.diagonal < 1.25 ? 'out' : 'ok',
    },
    {
      id: 'gg-rows',
      correlation: 'gaddis',
      value: gg.resistances,
      min: 5,
      max: null,
      status: status(gg.resistances >= 5),
    },
    {
      id: 'gg-low-re',
      correlation: 'gaddis',
      value: reynolds,
      min: 1000,
      max: null,
      status: status(reynolds >= 1000, 'caution'),
    },
    {
      id: 'fin-biot',
      correlation: 'fin',
      value: biot,
      min: null,
      max: 0.1,
      status: status(biot <= 0.1, 'caution'),
    },
    check('prop-bulk', 'properties', tMean, range.min, range.max, 'caution'),
    check('prop-wall', 'properties', tWall, range.min, range.max, 'caution'),
    {
      id: 'prop-boil',
      correlation: 'properties',
      value: state.rth * params.heat + params.tIn,
      min: null,
      max: 100,
      status: status(state.rth * params.heat + params.tIn <= 100, 'caution'),
    },
    {
      id: 'geo-short',
      correlation: 'geometry',
      value: params.height / params.diameter,
      min: 4,
      max: null,
      status: status(params.height / params.diameter >= 4, 'caution'),
    },
  ];
  const rConvective = 1 / state.conductance;
  return {
    ok: true,
    layout: {
      count: layout.count,
      rows: layout.rows,
      perRow: layout.perRow,
      perOffsetRow: layout.perOffsetRow,
    },
    arrangement: params.arrangement,
    areas: { fins, base, total, footprint, frontal },
    bulk,
    wall,
    massFlow: state.massFlow,
    velocity: { approach, max: vMax, diagonalGoverns },
    reynolds,
    regime: flowRegime(reynolds),
    band: zk.band,
    nusselt: zk.nusselt,
    c1: zk.c1,
    c2: zk.c2,
    h,
    fin: { ...fin, biot },
    surfaceEfficiency: state.surfaceEfficiency,
    conductance: state.conductance,
    ntu: state.ntu,
    effectiveness: state.effectiveness,
    rth: state.rth,
    rConvective,
    rCaloric: state.rth - rConvective,
    tOut: state.tOut,
    tBase: params.tIn + state.rth * params.heat,
    tWall,
    pressureDrop: gg.pressureDrop,
    pressureDropKpa: units.pascalToKilopascal(gg.pressureDrop),
    pumpingPower: gg.pressureDrop * flow,
    gaddis: {
      xi: gg.xi,
      resistances: gg.resistances,
      turbulentWeight: gg.turbulentWeight,
      inletOutlet: gg.inletOutlet,
    },
    iterations,
    checks,
    outCount: checks.filter((entry) => entry.status === 'out').length,
    cautionCount: checks.filter((entry) => entry.status === 'caution').length,
  };
}

function check(
  id: ValidityId,
  correlation: CorrelationId,
  value: number,
  min: number,
  max: number,
  failure: ValidityStatus = 'out',
): ValidityCheck {
  return {
    id,
    correlation,
    value,
    min,
    max,
    status: value >= min && value <= max ? 'ok' : failure,
  };
}
