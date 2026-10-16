"""One-command numerical workflow; web parity is optional and requires Node 22."""
import argparse, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(*args):
    print('RUN',*args,flush=True)
    subprocess.run(args,cwd=ROOT,check=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--reuse-data',action='store_true',help='Validate supplied 500-case data instead of repeating FEM.')
    parser.add_argument('--verify-only',action='store_true',help='Validate/export supplied data; do not train or solve.')
    parser.add_argument('--check-web',action='store_true',help='Also run TypeScript parity with node on PATH.')
    args=parser.parse_args()
    if not args.reuse_data and not args.verify_only:
        run(sys.executable,'solver/run.py','convergence')
        run(sys.executable,'solver/run.py','dataset')
    run(sys.executable,'scripts/verify_dataset.py')
    if not args.verify_only:
        run(sys.executable,'scripts/train.py')
        run(sys.executable,'scripts/verify_field_export.py')
        run(sys.executable,'scripts/plot_errors.py')
        report=json.loads((ROOT/'reports/surrogate-validation.json').read_text(encoding='utf-8'))
        passed=all(metric['mean_target_pass'] and metric['max_target_pass'] for metric in report['scalar'].values())
        passed=passed and report['scalar_size_pass'] and report['total_size_pass']
        if not passed:raise SystemExit('Surrogate acceptance gates failed. See reports/surrogate-validation.json; generated artifacts were retained.')
    if args.check_web:run('node','--experimental-strip-types','web/test.mjs')