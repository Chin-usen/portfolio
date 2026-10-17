import scalarModelJson from '../../../../public/models/busbar-joule-heating/scalar-model.json' with { type: 'json' };
import { ACTIVE_PATHS, CONDUCTOR_IDS } from './geometry.ts';
import { validateParams } from './parameters.ts';
import { normalizedInputs, predictGp, type CaseKey, type ScalarModel } from './surrogate.ts';
import type { BusbarParams, BusbarResult, ConductorId, ConductorResult } from './types.ts';

export const SCALAR_MODEL = scalarModelJson as unknown as ScalarModel;

/** Geometric surrogate quantities of one current-carrying case. */
export function caseQuantities(
  model: ScalarModel,
  key: CaseKey,
  thickness: number,
  strapWidth: number,
  beta: number,
) {
  const entry = model.cases[key];
  const resistanceG = Math.exp(
    predictGp(
      entry.logResistanceG,
      model.x2,
      normalizedInputs(model.inputs, thickness, strapWidth),
    ),
  );
  const thetaMax = Math.exp(
    predictGp(
      entry.logThetaMax,
      model.x3,
      normalizedInputs(model.inputs, thickness, strapWidth, beta),
    ),
  );
  return { resistanceG, thetaMax };
}

/**
 * Constant-property scaling is exact: R = R_g / σ, P = I² R and
 * T − T_sub = I² R_g² Θ(t, b, h/k) / (σ k). Only R_g and Θ come from the surrogate.
 */
export function evaluate(input: BusbarParams, model: ScalarModel = SCALAR_MODEL): BusbarResult {
  const params = validateParams(input);
  const sigma = params.sigma * 1e6;
  const beta = params.h / params.k;
  const thermalScale = (params.current * params.current) / (sigma * params.k);
  const conductors = {} as Record<ConductorId, ConductorResult>;
  for (const id of CONDUCTOR_IDS)
    conductors[id] = {
      id,
      active: false,
      resistance: 0,
      loss: 0,
      riseMax: 0,
      resistanceG: null,
      thetaMax: null,
    };
  for (const { conductor } of ACTIVE_PATHS[params.state]) {
    const key = `${params.state}:${conductor}` as CaseKey;
    const { resistanceG, thetaMax } = caseQuantities(
      model,
      key,
      params.thickness,
      params.strapWidth,
      beta,
    );
    const resistance = resistanceG / sigma;
    conductors[conductor] = {
      id: conductor,
      active: true,
      resistance,
      loss: params.current * params.current * resistance,
      riseMax: thermalScale * resistanceG * resistanceG * thetaMax,
      resistanceG,
      thetaMax,
    };
  }
  const list = CONDUCTOR_IDS.map((id) => conductors[id]);
  const resistance = list.reduce((sum, item) => sum + item.resistance, 0);
  const hottest = list.reduce((best, item) => (item.riseMax > best.riseMax ? item : best)).id;
  const riseMax = conductors[hottest].riseMax;
  return {
    state: params.state,
    conductors,
    resistance,
    loss: params.current * params.current * resistance,
    riseMax,
    tMax: params.tSub + riseMax,
    hottest,
    strapCurrentDensity: params.current / (params.strapWidth * params.thickness),
    thermalScale,
    beta,
  };
}
