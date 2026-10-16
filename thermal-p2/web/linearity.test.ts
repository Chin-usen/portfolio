import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEvaluator, decodeFieldBasis, type FieldModel, type Params, type ScalarModel } from './evaluator.ts';
import { auditLinearity } from './linearity-check.ts';
const root=new URL('../',import.meta.url);
const model=JSON.parse(readFileSync(new URL('models/scalar-model.json',root),'utf8')) as ScalarModel;
const field=JSON.parse(readFileSync(new URL('models/field-model.json',root),'utf8')) as FieldModel;
const bytes=readFileSync(new URL('models/field-basis.f16',root));
const basis=decodeFieldBasis(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const evaluate=createEvaluator(model,field,basis);
const fixtures=JSON.parse(readFileSync(new URL('web/holdout-fixtures.json',root),'utf8')) as {rows:Params[]};
const metrics=auditLinearity(evaluate,fixtures.rows);

describe('P2 v2: exact affine load law across all 100 holdouts and 8 load/coolant scenarios',()=>{
  it('resistances do not depend on P or T_cool',()=>{
    expect(metrics.cases).toBe(100); expect(metrics.scenariosPerCase).toBe(8);
    expect(metrics.maxResistanceChange).toBe(0);
  });
  it('peak, average and temperature bounds obey T=T_cool+P*R',()=>{
    expect(metrics.maxScalarAffineErrorC).toBeLessThan(1e-10);
  });
  it('all seven layer interfaces obey the same affine law',()=>{
    expect(metrics.maxLayerAffineErrorC).toBeLessThan(1e-10);
  });
  it('all POD field values obey the law within Float32 rounding',()=>{
    expect(metrics.fieldValuesChecked).toBe(100*8*128*64);
    expect(metrics.maxFieldRoundingRatio).toBeLessThanOrEqual(1);
    expect(metrics.coordinateChanges).toBe(0); expect(metrics.maskChanges).toBe(0);
  });
  it('zero power makes every junction, layer and field value exactly coolant temperature',()=>{
    expect(metrics.maxZeroPowerErrorC).toBe(0);
  });
  it('rejects nonphysical power and nonfinite coolant before inference',()=>{
    const row=fixtures.rows[0]!;
    for(const P of [-1,NaN,Infinity]) expect(()=>evaluate({...row,P})).toThrow(RangeError);
    for(const T_cool of [NaN,Infinity,-Infinity]) expect(()=>evaluate({...row,T_cool})).toThrow(RangeError);
  });
});