"""Train-only model selection, held-out evaluation, POD and browser export.

Run from any directory: .venv/Scripts/python scripts/train.py
Never changes the fixed FEM holdout or generates synthetic FEM observations.
"""
from __future__ import annotations
import argparse, csv, hashlib, itertools, json, sys, time, subprocess
from pathlib import Path
import numpy as np
from scipy.linalg import cho_factor, cho_solve, svd
from scipy.optimize import minimize
from threadpoolctl import threadpool_limits
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'solver'))
from fem import PARAMETERS, KEYS, LAYER_IDS, physical_arrays, WIDTHS_MM
OUT=ROOT/'models'; REPORT=ROOT/'reports'
for path in (OUT,REPORT): path.mkdir(exist_ok=True)
SEED=20261016

def log(s): print(time.strftime('%H:%M:%S'),s,flush=True)
def dump(path,value): path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
def rounded(a): return np.asarray(a).round(12).tolist()
def rel_metrics(pred,true):
    e=np.abs(pred/true-1)
    return {'mean_relative_error':float(e.mean()),'max_relative_error':float(e.max()),'rmse_K_per_W':float(np.sqrt(np.mean((pred-true)**2))), 'mean_target_pass':bool(e.mean()<.01),'max_target_pass':bool(e.max()<.03)}
def features(p,kind='log'):
    low=np.array([PARAMETERS[k][0] for k in KEYS]);high=np.array([PARAMETERS[k][1] for k in KEYS]);values=p.copy()
    if kind.startswith('invariant'):
        for j,key in enumerate(KEYS):
            if key.startswith('k_') or key=='h':
                values[:,j]/=p[:,8];low[j]/=PARAMETERS['k_cu'][1];high[j]/=PARAMETERS['k_cu'][0]
        values=np.delete(values,8,axis=1);low=np.delete(low,8);high=np.delete(high,8)
    if kind.endswith('linear-thickness'):
        keys=[k for k in KEYS if k!='k_cu']
        for j,key in enumerate(keys):
            if not key.startswith('t_'):values[:,j]=np.log(values[:,j]);low[j]=np.log(low[j]);high[j]=np.log(high[j])
    else:values=np.log(values);low=np.log(low);high=np.log(high)
    return 2*(values-low)/(high-low)-1

def analytic(p):
    """Return eight positive bottom-to-top contributions: convection + 7 layers."""
    t,k=physical_arrays(dict(zip(KEYS,p)));a1=5.;r=np.zeros(8)
    for j in range(6,0,-1):
        a2=min(a1+2*t[j],WIDTHS_MM[j]);r[j+1]=t[j]*1e3/(k[j]*a1*a2);a1=a2
    h=p[-1];a=a1*.001/np.sqrt(np.pi);b=.03/np.sqrt(np.pi)
    eps=a/b; tau=t[0]*.001/b;bi=h*b/k[0];lam=np.pi+1/(np.sqrt(np.pi)*eps)
    tangent=np.tanh(lam*tau);phi=(tangent+lam/bi)/(1+lam/bi*tangent)
    r[1]=(1-eps)**1.5*phi/(np.sqrt(np.pi)*k[0]*a)+t[0]*.001/(k[0]*np.pi*b*b)
    r[0]=1/(h*.0009)
    return r

def design(x,powers):
    return np.column_stack([np.prod(x[:,indices],axis=1) if indices else np.ones(len(x)) for indices in powers])

def fit_poly(x,y,degree=2,ridge=1e-5):
    powers=[()] + [i for d in range(1,degree+1) for i in itertools.combinations_with_replacement(range(x.shape[1]),d)]
    a=design(x,powers); penalty=np.eye(len(powers))*ridge;penalty[0,0]=1e-12
    coef=np.linalg.solve(a.T@a+penalty,a.T@y)
    return {'type':'polynomial','powers':[list(p) for p in powers],'coef':coef}

def kernel(x,z,ell,kind):
    delta=(x[:,None,:]-z[None,:,:])/ell;dist2=np.sum(delta*delta,axis=2)
    if kind=='rbf':return np.exp(-.5*dist2)
    r=np.sqrt(np.maximum(dist2,0));return (1+np.sqrt(5)*r+5*dist2/3)*np.exp(-np.sqrt(5)*r)

GRADIENT_CHECKS={}
def fit_gp(x,y,kind='rbf',initial=1.5,maxiter=160,trend_degree=1):
    # Linear trend fitted on this training fold only; GP corrects its residual.
    powers=[()] + [i for degree in range(1,trend_degree+1) for i in itertools.combinations_with_replacement(range(x.shape[1]),degree)]
    matrix=design(x,powers);trend=np.linalg.lstsq(matrix,y,rcond=None)[0]
    residual=y-matrix@trend
    scale=np.maximum(residual.std(axis=0),1e-8); z=residual/scale
    n,m=z.shape; d=x.shape[1];identity=np.eye(n)
    rawdiff=x[:,None,:]-x[None,:,:]
    def objective(theta):
        ell=np.exp(theta[:d]);noise=np.exp(theta[-1]);deltas=(rawdiff/ell)**2;ds=deltas.sum(axis=2)
        if kind=='rbf':base=np.exp(-.5*ds)
        else:
            r=np.sqrt(np.maximum(ds,0));exp=np.exp(-np.sqrt(5)*r);base=(1+np.sqrt(5)*r+5*ds/3)*exp
        try:
            chol=cho_factor(base+noise*identity,lower=True,check_finite=False)
            alpha=cho_solve(chol,z,check_finite=False)
        except np.linalg.LinAlgError:return 1e30,np.zeros_like(theta)
        val=.5*np.sum(z*alpha)+m*np.log(np.diag(chol[0])).sum()+.5*n*m*np.log(2*np.pi)
        common=m*cho_solve(chol,identity,check_finite=False)-alpha@alpha.T
        derivative=base if kind=='rbf' else (5/3)*(1+np.sqrt(5)*r)*exp
        grad=np.r_[.5*np.einsum('ij,ij,ijd->d',common,derivative,deltas),.5*noise*np.trace(common)]
        return float(val),grad
    theta0=np.r_[np.full(d,np.log(initial)),np.log(1e-7)]
    if kind not in GRADIENT_CHECKS:
        _,analytic_gradient=objective(theta0);numeric=[]
        for j in range(d+1):
            delta=np.zeros(d+1);delta[j]=1e-5
            numeric.append((objective(theta0+delta)[0]-objective(theta0-delta)[0])/2e-5)
        error=float(np.max(np.abs(analytic_gradient-numeric)/(1+np.abs(numeric))))
        GRADIENT_CHECKS[kind]=error;dump(REPORT/'gp-gradient-check.json',GRADIENT_CHECKS)
        assert error<2e-4,(kind,error)
    opt=minimize(objective,theta0,jac=True,method='L-BFGS-B',bounds=[(np.log(.1),np.log(100))]*d+[(np.log(1e-10),np.log(.03))],options={'maxiter':maxiter,'ftol':1e-8,'maxls':25})
    ell=np.exp(opt.x[:d]);noise=float(np.exp(opt.x[-1]));alpha=cho_solve(cho_factor(kernel(x,x,ell,kind)+noise*identity,lower=True),z)
    return {'type':'gp','kernel':kind,'support':x,'lengths':ell,'alpha':alpha,'trend':trend,'scale':scale,'noise':noise,'trend_powers':[list(v) for v in powers],'optimizer_iterations':int(opt.nit),'optimizer_success':bool(opt.success),'optimizer_message':str(opt.message)}

def fit_mlp(x,y,hidden=32,ridge=1e-4,maxiter=700):
    rng=np.random.default_rng(SEED);n,d=x.shape;m=y.shape[1];mean=y.mean(axis=0);scale=np.maximum(y.std(axis=0),1e-8);target=(y-mean)/scale
    sizes=[d*hidden,hidden,hidden*m,m];offset=np.cumsum([0]+sizes)
    def unpack(w):return w[offset[0]:offset[1]].reshape(d,hidden),w[offset[1]:offset[2]],w[offset[2]:offset[3]].reshape(hidden,m),w[offset[3]:offset[4]]
    start=np.r_[rng.normal(0,.15,d*hidden),np.zeros(hidden),rng.normal(0,.15,hidden*m),np.zeros(m)]
    def objective(w):
        w1,b1,w2,b2=unpack(w);activation=np.tanh(x@w1+b1);err=activation@w2+b2-target
        loss=.5*np.mean(err*err)+.5*ridge*(np.sum(w1*w1)+np.sum(w2*w2))
        q=err/(n*m);back=(q@w2.T)*(1-activation*activation)
        gradient=np.r_[(x.T@back+ridge*w1).ravel(),back.sum(axis=0),(activation.T@q+ridge*w2).ravel(),q.sum(axis=0)]
        return float(loss),gradient
    opt=minimize(objective,start,jac=True,method='L-BFGS-B',options={'maxiter':maxiter,'ftol':1e-10,'maxls':25})
    w1,b1,w2,b2=unpack(opt.x)
    return {'type':'mlp','w1':w1,'b1':b1,'w2':w2,'b2':b2,'mean':mean,'scale':scale,'optimizer_success':bool(opt.success)}

def fit(config,x,y):
    if config['family']=='gp':return fit_gp(x,y,kind=config['kernel'],initial=config.get('initial',1.5),trend_degree=config.get('trend_degree',1))
    if config['family']=='polynomial':return fit_poly(x,y,degree=config['degree'],ridge=config['ridge'])
    return fit_mlp(x,y,hidden=config['hidden'],ridge=config['ridge'])

def predict(model,x):
    if model['type']=='gp':return design(x,model['trend_powers'])@model['trend']+(kernel(x,model['support'],model['lengths'],model['kernel'])@model['alpha'])*model['scale']
    if model['type']=='polynomial':return design(x,model['powers'])@model['coef']
    return (np.tanh(x@model['w1']+model['b1'])@model['w2']+model['b2'])*model['scale']+model['mean']

def serialize(value):
    if isinstance(value,np.ndarray):return rounded(value)
    if isinstance(value,dict):return {k:serialize(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [serialize(v) for v in value]
    if isinstance(value,np.generic):return value.item()
    return value

def flat_baseline(p):
    out=[]
    for row in p:
        t,k=physical_arrays(dict(zip(KEYS,row)))
        out.append(np.sum(t*1000/(k*WIDTHS_MM**2))+1/(row[-1]*.0009))
    return np.array(out)
def scalar_target(true,base,mode,conductivity):
    if mode in ['analytic-residual','flat-residual']:return np.log(true/base[:,None])
    if mode=='invariant-linear':return true*conductivity[:,None]/1000
    if mode in ['scaled-additive','flat-additive']:return (true-base[:,None])*conductivity[:,None]/1000
    if mode=='invariant-log':return np.log(true*conductivity[:,None]/1000)
    return np.log(true)
def scalar_predictions(model,x,base,mode,conductivity):
    value=predict(model,x)
    if mode in ['scaled-additive','flat-additive']:return base[:,None]+value*1000/conductivity[:,None]
    if mode=='invariant-linear':return value*1000/conductivity[:,None]
    if mode=='invariant-log':return np.exp(value)*1000/conductivity[:,None]
    p=np.exp(value);return p*base[:,None] if mode in ['analytic-residual','flat-residual'] else p

def main():
    args=argparse.ArgumentParser();args.add_argument('--data',type=Path,default=ROOT/'data/samples.npz');args.add_argument('--reuse-selection',action='store_true');args.add_argument('--benchmark-single-split',action='store_true');options=args.parse_args()
    if not options.reuse_selection and not options.benchmark_single_split:
        subprocess.run([sys.executable,str(ROOT/'scripts/cv_select.py')],check=True)
        options.reuse_selection=True
    started=time.perf_counter()
    with np.load(options.data,allow_pickle=False) as src:data={key:src[key] for key in src.files}
    assert tuple(data['parameter_keys'])==KEYS
    assert len(data['parameters'])==500,'Exactly 500 real FEM samples required'
    train=np.flatnonzero(data['split']=='train');test=np.flatnonzero(data['split']=='test')
    assert len(train)==400 and len(test)==100
    p=data['parameters'];x=features(p);components=np.array([analytic(row) for row in p]);base=components.sum(axis=1)
    true=np.column_stack([data['Rjmax'],data['Rjavg']]);rng=np.random.default_rng(SEED);shuffled=rng.permutation(train);fit_idx=shuffled[:320];val_idx=shuffled[320:]
    selection_path=REPORT/'model-selection.json'
    if options.reuse_selection and selection_path.exists():selection=json.loads(selection_path.read_text());best=selection['selected']
    else:
        candidates=[{'family':'polynomial','degree':degree,'ridge':ridge} for degree in [2,3] for ridge in [1e-5,1e-2]]
        candidates += [{'family':'mlp','hidden':32,'ridge':r} for r in [1e-5,1e-3]]
        candidates += [{'family':'gp','kernel':k,'initial':1.5,'trend_degree':degree} for k in ['rbf','matern52'] for degree in [1,2]]
        rows=[];best=None;best_score=float('inf')
        for feature_kind in ['log','invariant-log','invariant-linear-thickness']:
          x=features(p,feature_kind)
          for mode in ['analytic-residual','scaled-additive','invariant-log']:
            target=scalar_target(true,base,mode,p[:,8])
            for config in candidates:
                tick=time.perf_counter();log(f'Select {feature_kind} {mode} {config}')
                model=fit(config,x[fit_idx],target[fit_idx]);prediction=scalar_predictions(model,x[val_idx],base[val_idx],mode,p[val_idx,8])
                metric=[rel_metrics(prediction[:,j],true[val_idx,j]) for j in range(2)]
                score=max(m['mean_relative_error'] for m in metric)+.15*max(m['max_relative_error'] for m in metric)
                row={'feature_kind':feature_kind,'mode':mode,'config':config,'metrics':metric,'selection_score':score,'seconds':time.perf_counter()-tick};rows.append(row);log(str(row))
                if score<best_score:best_score=score;best={'feature_kind':feature_kind,'mode':mode,'config':config}
                dump(selection_path,{'protocol':'fixed 320 fit / 80 validation within 400 training samples; final 100 labels excluded from all candidate fits and selection; initial holdout already observed, refinement prompted by training validation failure; final holdout is therefore reused','fit_ids':fit_idx.tolist(),'validation_ids':val_idx.tolist(),'selected':best,'candidates':rows})
        selection={'selected':best,'candidates':rows}
    log(f'Final scalar fit {best}')
    if best['mode'].startswith('flat-'):base=flat_baseline(p)
    x=features(p,best.get('feature_kind','log'));target=scalar_target(true,base,best['mode'],p[:,8])
    scalar=fit(best['config'],x[train],target[train]);pred=scalar_predictions(scalar,x,base,best['mode'],p[:,8]);pred[:,1]=np.minimum(pred[:,1],pred[:,0])
    scalar_metrics={name:rel_metrics(pred[test,j],true[test,j]) for j,name in enumerate(['Rjmax','Rjavg'])}
    log(f'HELD-OUT (REUSED AFTER TRAIN-ONLY REFINEMENT) {scalar_metrics}')
    dump(REPORT/'scalar-holdout.json',scalar_metrics)
    # Eight positive centreline contributions close exactly to predicted peak R.
    axis=data['interface_axis_K_per_W'];axisparts=np.column_stack([axis[:,0],np.diff(axis,axis=1)])
    if np.any(axisparts<=0):raise ValueError('Nonpositive centreline rise: cannot log-transform this model')
    ratios=np.log(axisparts/components)
    log('Fit centreline contribution GP')
    centre=fit_gp(x[train],ratios[train],kind='rbf',maxiter=120)
    cp=components*np.exp(predict(centre,x));cp*=pred[:,0,None]/cp.sum(axis=1)[:,None];axis_pred=np.cumsum(cp,axis=1)
    axis_error=np.abs(axis_pred[test]-axis[test])/true[test,0,None]
    # POD uses centred, peak-normalized fields and training rows only. Fixed mask and layer eta coordinates.
    fields=data['field_K_per_W'].reshape(500,-1).astype(np.float64);mask=data['field_mask'].reshape(-1).astype(bool)
    normalized=fields/true[:,0,None];mean=normalized[train].mean(axis=0);centered=normalized[train]-mean
    log('POD SVD on 400 training fields')
    _,singular,vt=svd(centered,full_matrices=False,check_finite=False,lapack_driver='gesdd')
    energy=np.cumsum(singular*singular)/np.sum(singular*singular);rank=int(np.searchsorted(energy,.999)+1)
    basis=vt[:rank];coeff=(normalized-mean)@basis.T
    log(f'POD rank={rank} energy={energy[rank-1]:.9f}; fit coefficients')
    field_model=fit_gp(x[train],coeff[train],kind='rbf',maxiter=120)
    coefficient_prediction=predict(field_model,x[test]);reconstructed=(mean+coefficient_prediction@basis)*pred[test,0,None]
    projection=(mean+coeff[test]@basis)*true[test,0,None]
    field_relative=np.sqrt(np.mean((reconstructed[:,mask]-fields[test][:,mask])**2,axis=1))/true[test,0]
    projection_relative=np.sqrt(np.mean((projection[:,mask]-fields[test][:,mask])**2,axis=1))/true[test,0]
    # Binary basis and mean are IEEE754 little-endian float16; metadata states every offset and shape.
    field_binary=np.vstack([mean,basis]).astype('<f2').tobytes();(OUT/'field-basis.f16').write_bytes(field_binary)
    metadata={'schema':1,'kind':'FEM-trained-surrogate','data_sha256':hashlib.sha256(options.data.read_bytes()).hexdigest(),'seed':SEED,'keys':list(KEYS),'bounds':[[PARAMETERS[k][0],PARAMETERS[k][1]] for k in KEYS],'default':{k:PARAMETERS[k][2] for k in KEYS},'normalization':'all 12 positive parameters mapped by log(bounds) to [-1,1]','feature_kind':best.get('feature_kind','log'),'scalar_mode':best['mode'],'scalar':serialize(scalar),'centre':serialize(centre),'layer_ids':list(LAYER_IDS),'layer_widths_mm':WIDTHS_MM.tolist(),'holdout':scalar_metrics,'sample_count':500,'training_count':400,'holdout_count':100,'centreline_semantics':'effective centreline rises/P; rConv is local centre coolant-to-bottom rise/P, not area-average 1/(h A)'}
    dump(OUT/'scalar-model.json',metadata)
    field_metadata={'schema':1,'width':128,'height':64,'rank':rank,'training_centered_normalized_energy':float(energy[rank-1]),'binary':'field-basis.f16','dtype':'float16-le','layout':'row-major [mean, mode0, mode1, ...], each 64*128; shapes normalized by Rjmax','model':serialize(field_model),'x_mm':rounded(data['field_x_mm']),'layer':data['field_layer'].astype(int).tolist(),'eta':rounded(data['field_eta']),'mask':data['field_mask'].astype(int).ravel().tolist(),'coordinates':'nonuniform physical z computed from per-layer eta and current thickness; x-z plane y=0','field_semantics':'POD/GP approximation of FEM central plane; not complete 3-D field'}
    dump(OUT/'field-model.json',field_metadata)
    model_bytes=sum((OUT/name).stat().st_size for name in ['scalar-model.json','field-model.json','field-basis.f16'])
    report={'scalar':scalar_metrics,'centreline_mean_abs_error_normalized_by_Rmax':float(axis_error.mean()),'centreline_max_abs_error_normalized_by_Rmax':float(axis_error.max()),'pod_rank':rank,'pod_training_centered_normalized_energy':float(energy[rank-1]),'pod_field_holdout_mean_nrmse':float(field_relative.mean()),'pod_field_holdout_max_nrmse':float(field_relative.max()),'pod_projection_only_holdout_mean_nrmse':float(projection_relative.mean()),'scalar_json_bytes':(OUT/'scalar-model.json').stat().st_size,'total_model_bytes':model_bytes,'scalar_size_pass':(OUT/'scalar-model.json').stat().st_size<300000,'total_size_pass':model_bytes<1000000,'elapsed_seconds':time.perf_counter()-started}
    dump(REPORT/'surrogate-validation.json',report)
    rows=[]
    for i in test:
        rows.append({'sample_id':int(i),**{k:float(v) for k,v in zip(KEYS,p[i])},'P':100.,'T_cool':0.,'Rjmax_FEM':float(true[i,0]),'Rjavg_FEM':float(true[i,1]),'Rjmax_python':float(pred[i,0]),'Rjavg_python':float(pred[i,1]),'interface_axis_FEM':rounded(axis[i])})
    random20=np.random.default_rng(20261017).choice(test,size=20,replace=False).tolist()
    dump(ROOT/'web/holdout-fixtures.json',{'schema':1,'rows':rows,'random20_ids':random20,'random20_seed':20261017,'sampling':'20 held-out IDs without replacement, seed fixed independently of outcomes'})
    with (REPORT/'holdout-predictions.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.writer(f);writer.writerow(['sample_id','Rjmax_FEM','Rjmax_surrogate','Rjavg_FEM','Rjavg_surrogate','Rjmax_abs_relative','Rjavg_abs_relative'])
        for i in test:writer.writerow([i,*[true[i,0],pred[i,0],true[i,1],pred[i,1]],abs(pred[i,0]/true[i,0]-1),abs(pred[i,1]/true[i,1]-1)])
    import matplotlib;matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(1,2,figsize=(10,4.4))
    for j,ax in enumerate(axes):
        ax.scatter(true[test,j],pred[test,j],s=16,alpha=.7);lo=min(true[test,j]);hi=max(true[test,j]);ax.plot([lo,hi],[lo,hi],'k--',lw=1);ax.set(xlabel='3D FEM (K/W)',ylabel='Surrogate (K/W)',title=['Rjmax: 100 held-out samples','Rjavg: 100 held-out samples'][j]);ax.grid(alpha=.2)
    fig.tight_layout();fig.savefig(REPORT/'surrogate-vs-fem.png',dpi=180);plt.close(fig)
    log(f'FINISHED {json.dumps(report)}')

if __name__=='__main__':
    with threadpool_limits(limits=2):main()
