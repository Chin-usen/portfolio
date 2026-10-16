import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {cpus,platform} from 'node:os';
import {createEvaluator,decodeFieldBasis} from './evaluator.ts';
const root=new URL('../',import.meta.url);
const readJSON=async(path)=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const scalar=await readJSON('models/scalar-model.json');
const field=await readJSON('models/field-model.json');
const binary=await readFile(new URL('models/field-basis.f16',root));
const basis=decodeFieldBasis(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength));
const evaluate=createEvaluator(scalar,field,basis),fixtures=await readJSON('web/holdout-fixtures.json');
const errorsMax=[],errorsAvg=[],parity=[];let closureError=0;
for(const row of fixtures.rows){
  const r=evaluate(row,{includeField:false});
  assert.ok(Number.isFinite(r.tjMax)&&Number.isFinite(r.tjAvg),`finite ${row.sample_id}`);
  assert.ok(r.tjMax>=r.tjAvg,`peak >= average ${row.sample_id}`);
  assert.ok(r.layers.every(layer=>layer.rth>0),`positive layers ${row.sample_id}`);
  closureError=Math.max(closureError,Math.abs(r.rConv+r.layers.reduce((s,v)=>s+v.rth,0)-r.rthTotal));
  errorsMax.push(Math.abs(r.rthTotal/row.Rjmax_FEM-1));errorsAvg.push(Math.abs(r.rthAverage/row.Rjavg_FEM-1));
  parity.push(Math.max(Math.abs(r.rthTotal/row.Rjmax_python-1),Math.abs(r.rthAverage/row.Rjavg_python-1)));
}
assert.ok(closureError<1e-12,'Centreline contributions close to junction maximum');
assert.ok(Math.max(...parity)<1e-5,'Python/export/TypeScript prediction parity');
const probe=fixtures.rows[0];
const a=evaluate({...probe,P:50,T_cool:25}),b=evaluate({...probe,P:200,T_cool:85});
assert.ok(Math.abs((b.tjMax-85)/(a.tjMax-25)-4)<1e-10,'Linear power scaling and coolant translation');
assert.ok(a.field&&a.field.values.length===128*64,'Reconstructed central field');
assert.ok(a.field.values.every(Number.isFinite),'Finite decoded POD field');
for(let i=0;i<a.field.mask.length;i++)if(!a.field.mask[i])assert.equal(a.field.values[i],25,'Outside domain is coolant sentinel');
assert.throws(()=>evaluate({...probe,h:1999}),RangeError,'Parameter bound rejected');
assert.throws(()=>evaluate({...probe,k_cer:NaN}),RangeError,'Nonfinite input rejected');
const stats=(values)=>({mean:values.reduce((s,v)=>s+v,0)/values.length,max:Math.max(...values)});
const selected20=fixtures.random20_ids.map(id=>fixtures.rows.findIndex(row=>row.sample_id===id));
const first20={Rjmax:stats(selected20.map(i=>errorsMax[i])),Rjavg:stats(selected20.map(i=>errorsAvg[i]))};
const all100={Rjmax:stats(errorsMax),Rjavg:stats(errorsAvg)};
function benchmark(includeField){
  for(let i=0;i<500;i++)evaluate(fixtures.rows[i%100],{includeField});
  const values=[];
  for(let i=0;i<1000;i++){const start=performance.now();evaluate(fixtures.rows[i%100],{includeField});values.push(performance.now()-start);}
  values.sort((x,y)=>x-y);return{median_ms:values[500],p95_ms:values[950],max_ms:values[999],mean_ms:values.reduce((s,v)=>s+v,0)/1000};
}
const inference={scalar_only:benchmark(false),scalar_and_field:benchmark(true),node:process.version,platform:platform(),cpu:cpus()[0]?.model};
const scalarBytes=(await stat(new URL('models/scalar-model.json',root))).size;
const totalBytes=scalarBytes+(await stat(new URL('models/field-model.json',root))).size+binary.byteLength;
const errorPass=[...Object.values(first20),...Object.values(all100)].every(s=>s.mean<.01&&s.max<.03);
const report={first20,all100,python_ts_max_relative_difference:Math.max(...parity),closure_max_abs:closureError,inference,scalar_model_bytes:scalarBytes,total_model_bytes:totalBytes,accuracy_target_pass:errorPass,scalar_size_target_pass:scalarBytes<300000,total_size_target_pass:totalBytes<1000000,scalar_time_target_pass:inference.scalar_only.p95_ms<2,field_time_target_pass:inference.scalar_and_field.p95_ms<2};
await writeFile(new URL('reports/typescript-validation.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
// These acceptance gates intentionally fail if a scientific target has not been achieved.
assert.ok(errorPass,'FEM error targets: mean <1%, maximum <3% for first20 and all100 holdouts');
assert.ok(scalarBytes<300000&&totalBytes<1000000,'Uncompressed asset budgets');
assert.ok(inference.scalar_only.p95_ms<2,'Scalar inference p95 <2ms on recorded host');
assert.ok(inference.scalar_and_field.p95_ms<2,'Scalar + field inference p95 <2ms on recorded host');
console.log('20 explicit held-out FEM cases + 100-row aggregate, parity, invariants, sizes and timing passed.');
