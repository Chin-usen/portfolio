import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEvaluator, decodeFieldBasis, type FieldModel, type Params, type ScalarModel } from './evaluator';
const root=new URL('../',import.meta.url);
const model=JSON.parse(readFileSync(new URL('models/scalar-model.json',root),'utf8')) as ScalarModel;
const field=JSON.parse(readFileSync(new URL('models/field-model.json',root),'utf8')) as FieldModel;
const bytes=readFileSync(new URL('models/field-basis.f16',root));
const basis=decodeFieldBasis(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const evaluate=createEvaluator(model,field,basis);
interface Fixture extends Params {sample_id:number;Rjmax_FEM:number;Rjavg_FEM:number;Rjmax_python:number;Rjavg_python:number;}
const fixture=JSON.parse(readFileSync(new URL('web/holdout-fixtures.json',root),'utf8')) as {rows:Fixture[];random20_ids:number[];random20_seed:number};
const selected=fixture.random20_ids.map(id=>fixture.rows.find(row=>row.sample_id===id)!);
describe('20 seeded random held-out FEM cases (without replacement)',()=>{
  it('uses the independent fixed sampling seed and unique held-out IDs',()=>{expect(fixture.random20_seed).toBe(20261017);expect(new Set(selected.map(r=>r.sample_id)).size).toBe(20);});
  for(const row of selected)it(`FEM sample ${row.sample_id}: max and average resistance error each below 3%`,()=>{
    const r=evaluate(row,{includeField:false});
    expect(Math.abs(r.rthTotal/row.Rjmax_FEM-1)).toBeLessThan(.03);
    expect(Math.abs(r.rthAverage/row.Rjavg_FEM-1)).toBeLessThan(.03);
    expect(Math.abs(r.rthTotal/row.Rjmax_python-1)).toBeLessThan(1e-5);
    expect(Math.abs(r.rthAverage/row.Rjavg_python-1)).toBeLessThan(1e-5);
  });
  it('mean errors across random20 are each below1%',()=>{
    const errors=selected.map(row=>{const r=evaluate(row,{includeField:false});return [Math.abs(r.rthTotal/row.Rjmax_FEM-1),Math.abs(r.rthAverage/row.Rjavg_FEM-1)];});
    for(let j=0;j<2;j++)expect(errors.reduce((sum,row)=>sum+row[j]!,0)/20).toBeLessThan(.01);
  });
});
it('all100 held-out FEM samples satisfy reported acceptance gates',()=>{
  const errors=fixture.rows.map(row=>{const r=evaluate(row,{includeField:false});return [Math.abs(r.rthTotal/row.Rjmax_FEM-1),Math.abs(r.rthAverage/row.Rjavg_FEM-1)];});
  for(let j=0;j<2;j++){expect(errors.reduce((sum,row)=>sum+row[j]!,0)/100).toBeLessThan(.01);expect(Math.max(...errors.map(row=>row[j]!))).toBeLessThan(.03);}
});
it('preserves power/coolant scaling, positive layer closure and POD dimensions',()=>{
  const row=selected[0]!;const a=evaluate({...row,P:50,T_cool:25}),b=evaluate({...row,P:200,T_cool:85});
  expect((b.tjMax-85)/(a.tjMax-25)).toBeCloseTo(4,10);
  expect(a.rConv+a.layers.reduce((sum,l)=>sum+l.rth,0)).toBeCloseTo(a.rthTotal,12);
  expect(a.layers.every(layer=>layer.rth>0)).toBe(true);expect(a.field?.values.length).toBe(8192);
  expect(a.field?.values.every(Number.isFinite)).toBe(true);
  expect(()=>evaluate({...row,h:1999})).toThrow(RangeError);
});
