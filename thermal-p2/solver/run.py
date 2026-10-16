from __future__ import annotations
import argparse, csv, hashlib, json, time
from pathlib import Path
import numpy as np
from scipy.stats import qmc
from fem import *
ROOT = Path(__file__).resolve().parents[1]
DATA, REPORTS, CHECKPOINTS = ROOT/'data', ROOT/'reports', ROOT/'checkpoints'
for folder in (DATA, REPORTS, CHECKPOINTS): folder.mkdir(exist_ok=True)


def log(message):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), message, flush=True)


def write_csv(path, rows):
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer=csv.DictWriter(handle,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)


def verify_element():
    # Exact uniform-flux / Robin solution on one 3-D rectangular Q1 element.
    hx,hy,hz,k,h,q=.005,.004,.003,150.,5000.,4e4
    mx,my,mz=mass(hx),mass(hy),mass(hz)
    ke=k*(np.kron(mz,np.kron(my,stiffness(hx)))+np.kron(mz,np.kron(stiffness(hy),mx))+np.kron(stiffness(hz),np.kron(my,mx)))
    assert np.allclose(ke,ke.T)
    assert np.max(np.abs(ke@np.ones(8)))<1e-12
    a=ke.copy();a[:4,:4]+=h*np.kron(my,mx)
    load=np.r_[np.zeros(4),np.full(4,q*hx*hy/4)]
    actual=np.linalg.solve(a,load)
    expected=np.r_[np.full(4,q/h),np.full(4,q/h+q*hz/k)]
    error=float(np.max(np.abs(actual-expected)))
    assert error<1e-10
    return {'uniform_flux_robin_max_abs_K':error,'expected_bottom_K':q/h,'expected_top_K':q/h+q*hz/k}


def convergence():
    verification=verify_element()
    (REPORTS/'element-verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
    rows=[];selected=None
    for level in LEVELS:
        log(f'Building {level.name}')
        mesh=StackMesh(level)
        log(f'{level.name}: nodes={mesh.n_nodes} elements={mesh.n_elements} build={mesh.build_seconds:.2f}s')
        result=mesh.solve(MIDPOINT,include_field=False)
        row={'level':level.name,'nodes':mesh.n_nodes,'elements':mesh.n_elements,'min_solder_elements':min(level.z_counts[1],level.z_counts[5]),'Rjmax_K_per_W':result['Rjmax'],'Rjavg_K_per_W':result['Rjavg'],'max_change_from_previous':abs(result['Rjmax']/rows[-1]['Rjmax_K_per_W']-1) if rows else np.nan,'avg_change_from_previous':abs(result['Rjavg']/rows[-1]['Rjavg_K_per_W']-1) if rows else np.nan,'residual_rel':result['residual_rel'],'heat_balance_rel':result['heat_balance_rel'],'solve_seconds':result['solve_seconds'],'mesh_build_seconds':mesh.build_seconds}
        rows.append(row);write_csv(REPORTS/'convergence.csv',rows);log(str(row))
        if len(rows)>=3 and max(row['max_change_from_previous'],row['avg_change_from_previous'])<.005:
            selected=level;break
    if selected is None: raise RuntimeError('Convergence target not met; no final mesh selected.')
    settings={'name':selected.name,'xy_counts':selected.xy_counts,'z_counts':selected.z_counts,'criterion':'both Rjmax and source-surface Rjavg change <0.5% vs previous mesh after >=3 levels','baseline':'arithmetic midpoint of all 12 parameter bounds','parameters':MIDPOINT,'nodes':rows[-1]['nodes'],'elements':rows[-1]['elements']}
    (REPORTS/'selected-mesh.json').write_text(json.dumps(settings,indent=2),encoding='utf-8')
    import matplotlib;matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,ax=plt.subplots(figsize=(7.2,4.5))
    ax.plot([r['nodes'] for r in rows],[r['Rjmax_K_per_W'] for r in rows],'o-',label='Junction maximum')
    ax.plot([r['nodes'] for r in rows],[r['Rjavg_K_per_W'] for r in rows],'s-',label='Junction surface mean')
    ax.set(xlabel='FEM nodes',ylabel='Thermal resistance (K/W)',title='Midpoint baseline mesh convergence');ax.grid(alpha=.25);ax.legend();fig.tight_layout();fig.savefig(REPORTS/'convergence.png',dpi=180);plt.close(fig)
    default_result=mesh.solve(DEFAULTS)
    np.savez_compressed(REPORTS/'default-fem.npz',**default_result,field_mask=mesh.field_mask,field_x_mm=mesh.field_x_mm)
    default_scalar={key:float(value) for key,value in default_result.items() if np.isscalar(value)}
    default_scalar['analytic_K_per_W']=float(analytic_resistance(DEFAULTS))
    (REPORTS/'default-fem.json').write_text(json.dumps(default_scalar,indent=2),encoding='utf-8')
    log(f'SELECTED {selected.name}; default {default_scalar}')


def make_design():
    sampler=qmc.LatinHypercube(d=len(KEYS),rng=np.random.default_rng(SEED))
    unit=sampler.random(500)
    x=np.empty_like(unit)
    for j,key in enumerate(KEYS):
        low,high,_=PARAMETERS[key]
        x[:,j]=np.exp(np.log(low)+unit[:,j]*(np.log(high)-np.log(low))) if key.startswith('k_') or key=='h' else low+unit[:,j]*(high-low)
    indices=np.random.default_rng(SEED+1).permutation(500)
    split=np.full(500,'train',dtype='<U5');split[indices[400:]]='test'
    records=[{'sample_id':i,'split':split[i],**dict(zip(KEYS,x[i]))} for i in range(500)]
    write_csv(DATA/'parameters.csv',records)
    return x,split


def dataset(limit=500):
    settings=json.loads((REPORTS/'selected-mesh.json').read_text(encoding='utf-8'))
    level=MeshLevel(settings['name'],tuple(settings['xy_counts']),tuple(settings['z_counts']))
    x,split=make_design()
    mesh=StackMesh(level)
    log(f'Dataset mesh {level.name}: {mesh.n_nodes} nodes/{mesh.n_elements} elements; resume checkpoints')
    started=time.perf_counter()
    for i in range(min(limit,500)):
        path=CHECKPOINTS/f'{i:04d}.npz'
        if path.exists():
            with np.load(path) as saved:
                if not np.array_equal(saved['parameters'],x[i]) or str(saved['mesh_name']) != level.name or str(saved['solver_version']) != 'q1-hex-v1': raise RuntimeError(f'Checkpoint parameter/mesh/version mismatch {i}')
            continue
        p=dict(zip(KEYS,x[i]));result=mesh.solve(p)
        result['analytic_Rth']=analytic_resistance(p)
        np.savez_compressed(path,parameters=x[i],sample_id=i,mesh_name=level.name,solver_version='q1-hex-v1',**result)
        if (i+1)%10==0 or i==0: log(f'Completed {i+1}/500 elapsed={time.perf_counter()-started:.1f}s Rmax={result["Rjmax"]:.6g} solve={result["solve_seconds"]:.3f}s')
    if limit<500:return
    aggregate={key:[] for key in ['Rjmax','Rjavg','interface_axis_K_per_W','layer_drop_K_per_W','field_K_per_W','field_z_mm','residual_rel','heat_balance_rel','heat_out_quarter_W','solve_seconds','analytic_Rth']}
    sample_rows=[]
    for i in range(500):
        with np.load(CHECKPOINTS/f'{i:04d}.npz') as saved:
            for key in aggregate:aggregate[key].append(saved[key])
            sample_rows.append({'sample_id':i,'split':split[i],**{key:float(saved[key]) for key in ['Rjmax','Rjavg','analytic_Rth','residual_rel','heat_balance_rel','solve_seconds']}})
    arrays={key:np.asarray(value) for key,value in aggregate.items()}
    np.savez_compressed(DATA/'samples.npz',parameters=x,parameter_keys=np.array(KEYS),split=split,sample_id=np.arange(500),layer_ids=np.array(LAYER_IDS),field_x_mm=mesh.field_x_mm,field_mask=mesh.field_mask,field_layer=mesh.field_layer,field_eta=mesh.field_eta,**arrays)
    write_csv(DATA/'samples.csv',sample_rows)
    from scipy.stats import pearsonr,spearmanr
    analytic=arrays['analytic_Rth'];fem=arrays['Rjmax'];relative=np.abs(analytic/fem-1)
    report={'sample_count':500,'train_count':int(np.count_nonzero(split=='train')),'test_count':int(np.count_nonzero(split=='test')),'seed':SEED,'mesh':settings,'max_residual_rel':float(arrays['residual_rel'].max()),'max_heat_balance_rel':float(arrays['heat_balance_rel'].max()),'mean_solve_seconds':float(arrays['solve_seconds'].mean()),'analytic_comparison':{'pearson_r':float(pearsonr(analytic,fem).statistic),'spearman_r':float(spearmanr(analytic,fem).statistic),'mean_absolute_relative_error':float(relative.mean()),'max_absolute_relative_error':float(relative.max()),'analytic_bias_mean_relative':float((analytic/fem-1).mean())},'samples_sha256':hashlib.sha256((DATA/'samples.npz').read_bytes()).hexdigest()}
    (REPORTS/'dataset-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    import matplotlib;matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,ax=plt.subplots(figsize=(6,5));ax.scatter(fem,analytic,s=12,alpha=.6);low=min(fem.min(),analytic.min());high=max(fem.max(),analytic.max());ax.plot([low,high],[low,high],'k--',lw=1);ax.set(xlabel='3D FEM Rjmax (K/W)',ylabel='45-degree analytic Rth (K/W)',title='500-sample comparison: independent models');ax.grid(alpha=.2);fig.tight_layout();fig.savefig(REPORTS/'analytic-vs-fem.png',dpi=180);plt.close(fig)
    log(f'FINISHED {json.dumps(report)}')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['convergence','dataset']);parser.add_argument('--limit',type=int,default=500);args=parser.parse_args()
    convergence() if args.command=='convergence' else dataset(args.limit)