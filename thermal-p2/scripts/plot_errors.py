"""Publish the fixed held-out scalar error distribution (percent)."""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parents[1]
with (root/'reports/holdout-predictions.csv').open(encoding='utf-8') as handle:rows=list(csv.DictReader(handle))
errors=[100*np.array([float(row[key]) for row in rows]) for key in ['Rjmax_abs_relative','Rjavg_abs_relative']]
fig,axes=plt.subplots(1,2,figsize=(10.5,4.3))
for values,label,color in zip(errors,['Rjmax','Rjavg'],['#BF4800','#1766A4']):
    axes[0].hist(values,bins=np.linspace(0,3,16),alpha=.55,label=label,color=color)
    axes[1].step(np.sort(values),np.arange(1,101)/100,where='post',label=label,color=color)
axes[0].set(xlabel='Absolute relative error (%)',ylabel='Held-out sample count',title='Fixed 100 FEM holdouts: error distribution')
axes[1].set(xlabel='Absolute relative error (%)',ylabel='Empirical cumulative fraction',title='Held-out error ECDF',ylim=(0,1.02))
for ax in axes:ax.axvline(3,color='#555',linestyle='--',linewidth=1,label='3% maximum target');ax.grid(alpha=.18);ax.legend()
fig.tight_layout();fig.savefig(root/'reports/holdout-error-distribution.png',dpi=180);plt.close(fig)
