"""Verify the completed immutable FEM dataset and export compressed Float16 fields."""
import csv, hashlib, json, sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'solver'))
from fem import KEYS, PARAMETERS

def main():
    path=ROOT/'data/samples.npz'
    with np.load(path,allow_pickle=False) as loaded: data={key:loaded[key] for key in loaded.files}
    assert data['parameters'].shape==(500,12)
    assert tuple(data['parameter_keys'])==KEYS
    assert data['field_K_per_W'].shape==(500,64,128)
    assert data['field_mask'].shape==(64,128)
    assert data['field_z_mm'].shape==(500,64)
    assert data['interface_axis_K_per_W'].shape==(500,8)
    assert data['layer_drop_K_per_W'].shape==(500,7)
    assert np.sum(data['split']=='train')==400 and np.sum(data['split']=='test')==100
    assert np.array_equal(data['sample_id'],np.arange(500))
    assert np.all(np.isfinite(data['field_K_per_W']))
    assert np.all(data['Rjmax']>=data['Rjavg']) and np.all(data['Rjavg']>0)
    assert data['residual_rel'].max()<1e-7 and data['heat_balance_rel'].max()<1e-7
    assert np.max(np.abs(data['heat_out_quarter_W']-25.))<1e-6
    for col,key in enumerate(KEYS):
        low,high,_=PARAMETERS[key];values=data['parameters'][:,col]
        assert np.all(values>=low) and np.all(values<=high)
        unit=(np.log(values)-np.log(low))/(np.log(high)-np.log(low)) if key.startswith('k_') or key=='h' else (values-low)/(high-low)
        assert len(np.unique(np.floor(500*unit).astype(int)))==500, f'LHS strata mismatch: {key}'
    for filename in ('parameters.csv','samples.csv'):
        with (ROOT/'data'/filename).open(encoding='utf-8') as handle: assert len(list(csv.DictReader(handle)))==500
    mask=data['field_mask'].astype(bool)
    original=data['field_K_per_W'].astype(np.float64)
    quantized=original.astype(np.float16)
    reconstructed=quantized.astype(np.float64)
    actual=original[:,mask];delta=reconstructed[:,mask]-actual
    rel_l2=np.linalg.norm(delta,axis=1)/np.linalg.norm(actual,axis=1)
    compact={**data,'field_K_per_W':quantized}
    output=ROOT/'data/samples-float16.npz'
    np.savez_compressed(output,**compact)
    with np.load(output,allow_pickle=False) as check: assert check['field_K_per_W'].dtype==np.float16
    report={'sample_count':500,'csv_rows_each':500,'lhs_strata_each':500,'split':{'train':400,'test':100},'source_file':str(path.relative_to(ROOT)),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'float16_file':str(output.relative_to(ROOT)),'float16_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'source_field_dtype':str(data['field_K_per_W'].dtype),'export_field_dtype':'float16','float16_archive_bytes':output.stat().st_size,'quantization':{'max_abs_K_per_W':float(np.max(np.abs(delta))),'max_pointwise_relative_valid':float(np.max(np.abs(delta)/np.abs(actual))),'mean_relative_l2_per_sample':float(rel_l2.mean()),'max_relative_l2_per_sample':float(rel_l2.max())}}
    (ROOT/'reports/data-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()