"""Measure actual Float16 deployed POD reconstruction against original FEM fields."""
import json
import numpy as np
import train as tr
from threadpoolctl import threadpool_limits

def as_arrays(m):
    return {k:np.asarray(v,dtype=float) if k in ['support','lengths','alpha','trend','scale','coef','w1','b1','w2','b2','mean'] else v for k,v in m.items()}
with threadpool_limits(limits=2):
    with np.load(tr.ROOT/'data/samples.npz') as src:d={k:src[k] for k in src.files}
    sm=json.loads((tr.OUT/'scalar-model.json').read_text());fm=json.loads((tr.OUT/'field-model.json').read_text())
    x=tr.features(d['parameters'],sm['feature_kind']);p=d['parameters'];train=np.flatnonzero(d['split']=='train');test=np.flatnonzero(d['split']=='test')
    baseline=tr.flat_baseline(p) if sm['scalar_mode'].startswith('flat-') else np.array([tr.analytic(row).sum() for row in p])
    scalar=tr.scalar_predictions(as_arrays(sm['scalar']),x,baseline,sm['scalar_mode'],p[:,8])
    coeff=tr.predict(as_arrays(fm['model']),x)
    deployed=np.fromfile(tr.OUT/'field-basis.f16',dtype='<f2').astype(np.float64).reshape(fm['rank']+1,-1)
    reconstructed=(deployed[0]+coeff@deployed[1:])*scalar[:,0,None]
    truth=d['field_K_per_W'].reshape(500,-1).astype(float);mask=d['field_mask'].ravel().astype(bool)
    errors=np.sqrt(np.mean((reconstructed[:,mask]-truth[:,mask])**2,axis=1))/d['Rjmax']
    normalized=truth/d['Rjmax'][:,None];mean=normalized[train].mean(axis=0)
    _,_,vt=np.linalg.svd(normalized[train]-mean,full_matrices=False);rank=fm['rank'];ideal_basis=vt[:rank]
    exact_coeff=(normalized-mean)@ideal_basis.T
    projected=(mean+exact_coeff@ideal_basis)*d['Rjmax'][:,None]
    energy_retained=1-np.sum((projected[train]-truth[train])**2)/np.sum(truth[train]**2)
    float16_only=(deployed[0]+exact_coeff@deployed[1:])*d['Rjmax'][:,None]
    quant_error=np.sqrt(np.mean((float16_only[:,mask]-projected[:,mask])**2,axis=1))/d['Rjmax']
    report={'deployed_float16_field_holdout_mean_NRMSE_by_Rjmax':float(errors[test].mean()),'deployed_float16_field_holdout_max_NRMSE_by_Rjmax':float(errors[test].max()),'field_float16_quantization_only_mean_NRMSE_by_Rjmax':float(quant_error.mean()),'field_float16_quantization_only_max_NRMSE_by_Rjmax':float(quant_error.max()),'training_original_K_per_W_field_uncentred_energy_retained':float(energy_retained),'warning':'POD energy is spatial discrete sample energy, not thermodynamic heat energy or a scalar error guarantee.'}
    tr.dump(tr.REPORT/'field-export-validation.json',report);print(json.dumps(report,indent=2))
