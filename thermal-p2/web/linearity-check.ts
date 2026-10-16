import type { Params, Result } from './evaluator.ts';

export interface LinearityMetrics {
  cases: number; scenariosPerCase: number; fieldValuesChecked: number;
  maxResistanceChange: number; maxScalarAffineErrorC: number;
  maxLayerAffineErrorC: number; maxFieldAffineErrorC: number;
  maxFieldRoundingRatio: number; maxZeroPowerErrorC: number;
  coordinateChanges: number; maskChanges: number;
}

/** Metamorphic check: thermal response is affine in load and coolant.
 * Float32 fields allow their two rounding steps; doubles use absolute tolerance.
 * This validates an invariant of the physical model, not fitted test labels.
 */
export function auditLinearity(evaluate: (p: Params) => Result, rows: Params[]): LinearityMetrics {
  const scenarios = [[0,25],[0,85],[25,0],[100,0],[300,0],[25,25],[100,65],[300,85]] as const;
  const metrics: LinearityMetrics = {
    cases: rows.length, scenariosPerCase: scenarios.length, fieldValuesChecked: 0,
    maxResistanceChange: 0, maxScalarAffineErrorC: 0, maxLayerAffineErrorC: 0,
    maxFieldAffineErrorC: 0, maxFieldRoundingRatio: 0, maxZeroPowerErrorC: 0,
    coordinateChanges: 0, maskChanges: 0,
  };
  for (const row of rows) {
    const reference = evaluate({ ...row, P: 100, T_cool: 0 });
    if (!reference.field) throw new Error('Full field required for affine audit');
    for (const [P,T_cool] of scenarios) {
      const actual = evaluate({ ...row, P, T_cool });
      if (!actual.field) throw new Error('Field missing from evaluated scenario');
      const scale = P / 100;
      for (const key of ['rthTotal','rthAverage','rConv','rConvAreaAverage'] as const)
        metrics.maxResistanceChange = Math.max(metrics.maxResistanceChange,Math.abs(actual[key]-reference[key]));
      for (const key of ['tjMax','tjAvg','tMax','tMin'] as const)
        metrics.maxScalarAffineErrorC = Math.max(metrics.maxScalarAffineErrorC,Math.abs(actual[key]-(T_cool+scale*reference[key])));
      for (let j=0;j<reference.layers.length;j++) {
        const before=reference.layers[j]!, after=actual.layers[j]!;
        if (before.id!==after.id) throw new Error('Layer order changed with thermal load');
        metrics.maxResistanceChange=Math.max(metrics.maxResistanceChange,Math.abs(after.rth-before.rth));
        for (const key of ['tTop','tBottom'] as const)
          metrics.maxLayerAffineErrorC=Math.max(metrics.maxLayerAffineErrorC,Math.abs(after[key]-(T_cool+scale*before[key])));
        if (P===0) metrics.maxZeroPowerErrorC=Math.max(metrics.maxZeroPowerErrorC,Math.abs(after.tTop-T_cool),Math.abs(after.tBottom-T_cool));
      }
      for (let i=0;i<reference.field.values.length;i++) {
        const before=reference.field.values[i]!, after=actual.field.values[i]!;
        const expected=T_cool+scale*before;
        const error=Math.abs(after-expected);
        // One Float32 rounding at the reference and one at the transformed field.
        const tolerance=4*2**-23*Math.max(1,Math.abs(expected),Math.abs(scale*before));
        metrics.maxFieldAffineErrorC=Math.max(metrics.maxFieldAffineErrorC,error);
        metrics.maxFieldRoundingRatio=Math.max(metrics.maxFieldRoundingRatio,error/tolerance);
        metrics.fieldValuesChecked++;
        if (actual.field.mask[i]!==reference.field.mask[i]) metrics.maskChanges++;
        if (P===0) metrics.maxZeroPowerErrorC=Math.max(metrics.maxZeroPowerErrorC,Math.abs(after-T_cool));
      }
      for (const key of ['xMm','zMm'] as const)
        for (let i=0;i<reference.field[key].length;i++)
          if (actual.field[key][i]!==reference.field[key][i]) metrics.coordinateChanges++;
      if (P===0) metrics.maxZeroPowerErrorC=Math.max(metrics.maxZeroPowerErrorC,Math.abs(actual.tjMax-T_cool),Math.abs(actual.tjAvg-T_cool));
    }
  }
  return metrics;
}