"""Bounded 3-fold training-only selection. The 100 test labels are never read here."""
import json,time
import numpy as np
from threadpoolctl import threadpool_limits
import train as tr

def main():
    with np.load(tr.ROOT/'data/samples.npz') as src:
        train=np.flatnonzero(src['split']=='train');p=src['parameters'][train];truth=np.column_stack([src['Rjmax'][train],src['Rjavg'][train]])
    order=np.random.default_rng(tr.SEED+2).permutation(400);folds=np.array_split(order,3)
    baselines={'analytic':np.array([tr.analytic(row).sum() for row in p]),'flat':tr.flat_baseline(p)}
    configs=[{'family':'gp','kernel':kind,'initial':1.5,'trend_degree':degree} for kind,degree in [('rbf',1),('rbf',2),('matern52',1)]]
    candidates=[];best=None;best_score=float('inf')
    for feature_kind in ['log','invariant-log','invariant-linear-thickness']:
      x=tr.features(p,feature_kind)
      for mode in ['analytic-residual','flat-residual','invariant-linear','flat-additive']:
        base=baselines['flat' if mode.startswith('flat-') else 'analytic'];target=tr.scalar_target(truth,base,mode,p[:,8])
        for config in configs:
          started=time.perf_counter();tr.log(f'CV {feature_kind} {mode} {config}')
          prediction=np.zeros_like(truth);fold_metrics=[]
          for validation in folds:
            fit_indices=np.setdiff1d(np.arange(400),validation)
            model=tr.fit(config,x[fit_indices],target[fit_indices])
            prediction[validation]=tr.scalar_predictions(model,x[validation],base[validation],mode,p[validation,8])
            fold_metrics.append([tr.rel_metrics(prediction[validation,j],truth[validation,j]) for j in range(2)])
          metrics=[tr.rel_metrics(prediction[:,j],truth[:,j]) for j in range(2)]
          score=max(m['mean_relative_error'] for m in metrics)+.15*max(m['max_relative_error'] for m in metrics)
          row={'feature_kind':feature_kind,'mode':mode,'config':config,'metrics':metrics,'fold_metrics':fold_metrics,'selection_score':score,'seconds':time.perf_counter()-started};candidates.append(row)
          if score<best_score:best_score=score;best={'feature_kind':feature_kind,'mode':mode,'config':config}
          tr.log(f'CV result score={score:.6g} means={[m["mean_relative_error"] for m in metrics]} max={[m["max_relative_error"] for m in metrics]}')
          tr.dump(tr.REPORT/'model-selection.json',{'protocol':'3-fold cross-validation of 400 training samples only; test labels excluded; final 100 test samples reused after initial evaluation and must not be described as untouched','fold_validation_ids':[train[v].tolist() for v in folds],'score':'max(mean relative error of max/avg) + 0.15 * max(worst relative error of max/avg)','selected':best,'candidates':candidates,'earlier_family_comparisons':'initial-model-selection.json and second-model-selection.json include polynomial and MLP comparisons'})
    tr.log(f'CV FINISHED {best}')
if __name__=='__main__':
    with threadpool_limits(limits=2):main()
