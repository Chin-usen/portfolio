"""Re-audit immutable P2 source/data and solve affine FEM load scenarios (no training)."""
from pathlib import Path
import csv, hashlib, json, sys
import numpy as np
from scipy.sparse.linalg import splu
from threadpoolctl import threadpool_limits
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'solver'))
from fem import StackMesh, LEVELS, KEYS, PARAMETERS, DEFAULTS, POWER_W, physical_arrays

def read_json(relative): return json.loads((ROOT/relative).read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    with np.load(ROOT/'data/samples.npz',allow_pickle=False) as archive:
        data={key:archive[key] for key in archive.files}
    assert data['parameters'].shape==(500,12)
    assert data['field_K_per_W'].shape==(500,64,128)
    assert np.all(np.isfinite(data['field_K_per_W']))
    assert tuple(data['parameter_keys'])==KEYS
    train=set(data['sample_id'][data['split']=='train'].tolist())
    test=set(data['sample_id'][data['split']=='test'].tolist())
    assert len(train)==400 and len(test)==100 and not train.intersection(test)
    fixture=read_json('web/holdout-fixtures.json')
    assert {row['sample_id'] for row in fixture['rows']}==test
    for row in fixture['rows']:
        sid=row['sample_id']
        np.testing.assert_allclose([row[key] for key in KEYS],data['parameters'][sid],rtol=1e-14,atol=0)
        np.testing.assert_allclose([row['Rjmax_FEM'],row['Rjavg_FEM']],[data['Rjmax'][sid],data['Rjavg'][sid]],rtol=1e-14,atol=0)
    scalar=read_json('models/scalar-model.json')
    assert scalar['data_sha256']==sha(ROOT/'data/samples.npz')
    cv=read_json('reports/model-selection.json')
    folds=[set(ids) for ids in cv['fold_validation_ids']]
    assert set.union(*folds)==train and sum(map(len,folds))==400
    assert all(not test.intersection(fold) for fold in folds)
    with (ROOT/'reports/holdout-predictions.csv').open(encoding='utf-8') as handle:
        predictions=list(csv.DictReader(handle))
    assert {int(row['sample_id']) for row in predictions}==test
    metrics={}
    recorded=read_json('reports/scalar-holdout.json')
    for key in ('Rjmax','Rjavg'):
        errors=[]
        for row in predictions:
            sid=int(row['sample_id']); truth=float(data[key][sid])
            assert abs(float(row[key+'_FEM'])-truth)<1e-13
            errors.append(abs(float(row[key+'_surrogate'])/truth-1))
        mean=float(np.mean(errors)); maximum=float(np.max(errors))
        assert abs(mean-recorded[key]['mean_relative_error'])<1e-12
        assert abs(maximum-recorded[key]['max_relative_error'])<1e-12
        assert mean<.01 and maximum<.03
        metrics[key]={'mean_relative_error':mean,'max_relative_error':maximum}
    # Fresh solve of the finite-element system with changed physical boundary loads.
    # This validates affine physics directly, independently of exported TS equations.
    mesh=StackMesh(LEVELS[2])
    selected=[('default',DEFAULTS)]
    for label,sid in [('holdout_low_Rmax',min(test,key=lambda i:data['Rjmax'][i])),('holdout_high_Rmax',max(test,key=lambda i:data['Rjmax'][i]))]:
        selected.append((label,dict(zip(KEYS,data['parameters'][sid]))))
    scenarios=((0.,25.),(0.,85.),(25.,0.),(100.,65.),(300.,85.))
    solve_metrics=[]
    for label,p in selected:
        thickness,conductivity=physical_arrays(p)
        matrix=mesh.robin*p['h']
        for xy,zz,t,k in zip(mesh.kxy,mesh.kz,thickness,conductivity):
            metres=t*1e-3; matrix=matrix+xy*(k*metres)+zz*(k/metres)
        with threadpool_limits(limits=1):
            factor=splu(matrix.tocsc(),permc_spec='MMD_AT_PLUS_A')
            reference=factor.solve(mesh.load)
            worst_node=worst_peak=worst_avg=worst_residual=0.
            for power,coolant in scenarios:
                rhs=(power/POWER_W)*mesh.load+p['h']*coolant*mesh.bottom_weights
                temperature=factor.solve(rhs)
                expected=coolant+(power/POWER_W)*reference
                worst_node=max(worst_node,float(np.max(np.abs(temperature-expected))))
                worst_peak=max(worst_peak,float(abs(temperature[mesh.top_nodes].max()-expected[mesh.top_nodes].max())))
                worst_avg=max(worst_avg,float(abs(np.dot(mesh.top_weights,temperature-expected)/mesh.chip_quarter_area)))
                worst_residual=max(worst_residual,float(np.linalg.norm(matrix@temperature-rhs)/max(np.linalg.norm(rhs),1.)))
        assert worst_node<1e-7 and worst_residual<1e-8
        solve_metrics.append({'parameters':label,'scenarios':len(scenarios),'max_nodal_affine_error_C':worst_node,'max_peak_affine_error_C':worst_peak,'max_average_affine_error_C':worst_avg,'max_relative_residual':worst_residual})
    preserved={str(path.relative_to(ROOT)):sha(path) for parent in ('data','models','solver') for path in sorted((ROOT/parent).rglob('*')) if path.is_file() and '__pycache__' not in path.parts}
    report={'version':'2.0.0','pass':True,'dataset':{'count':500,'train':400,'test':100,'shape':list(data['field_K_per_W'].shape),'source_sha256':sha(ROOT/'data/samples.npz')},'fixture_ids_and_fem_truth_match_raw_data':True,'cross_validation_excludes_holdout_ids':True,'recomputed_holdout_metrics':metrics,'fem_affine_checks':solve_metrics,'mesh_nodes':mesh.n_nodes,'mesh_elements':mesh.n_elements,'preserved_source_data_model_sha256':preserved,'holdout_caveat':'The 100 holdouts were inspected during earlier development; reused validation, not a fresh blind test. Final selection used training-only 3-fold CV; v2 performs no retraining.','field_note':'A physical 3D FEM y=0 slice; exported POD Float32 temperatures have final-rounding deviations from exact affine arithmetic.'}
    (ROOT/'reports/v2-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (ROOT/'reports/material-parameters-v2.json').write_text(json.dumps({'parameters':{key:{'min':value[0],'max':value[1],'default':value[2]} for key,value in PARAMETERS.items()},'length_unit':'mm','conductivity_unit':'W/(m K)','h_unit':'W/(m^2 K)','fixed_chip':{'thickness_mm':.18,'width_mm':5,'conductivity_W_per_mK':370},'source':'solver/fem.py'},indent=2),encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key!='preserved_source_data_model_sha256'},indent=2))

if __name__=='__main__': main()