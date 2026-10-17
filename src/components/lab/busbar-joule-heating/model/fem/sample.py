"""Design of experiments and FEM sampling for the S2 surrogate.

Training: 64 Latin-hypercube geometries in (log t, log b) plus the four (t, b) corners and the
L1 nominal geometry; each geometry is solved at four stratified beta = h/k values.
Test: 20 independent random geometries, three random beta values each (never used in fitting).

Outputs (deterministic for the pinned numpy/scipy/Node versions):
  data/samples.csv            inputs and scalar FEM results, one row per (sample, case)
  data/fields-float16.npz     display-lattice fields (Theta and R_g|grad V|) as float16
  data/doe.json               the design, mesh settings and geometry/L1 hashes
Run: python src/components/lab/busbar-joule-heating/model/fem/sample.py [--workers 2]
"""
from __future__ import annotations

import argparse
import csv
import json
import time
from multiprocessing import Pool

import numpy as np

import common
import fem

N_LHS = 64
N_BETA = 4
N_TEST = 20
N_BETA_TEST = 3
SEED_TRAIN = 1602
SEED_TEST = 1603


def design():
    rng = np.random.default_rng(SEED_TRAIN)
    # Latin hypercube in the unit square of (log t, log b).
    u = np.empty((N_LHS, 2))
    for axis in range(2):
        u[:, axis] = (rng.permutation(N_LHS) + rng.random(N_LHS)) / N_LHS
    extra = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
    nominal = np.array([[common.to_unit(0.8, *common.T_RANGE), common.to_unit(3.0, *common.B_RANGE)]])
    train_u = np.vstack([u, extra, nominal])
    train_beta = []
    for g in range(len(train_u)):
        offsets = rng.random(N_BETA)
        values = (np.arange(N_BETA) + offsets) / N_BETA
        if N_LHS <= g < N_LHS + 4:
            values[0], values[-1] = 0.0, 1.0
        train_beta.append(values)
    rng_test = np.random.default_rng(SEED_TEST)
    test_u = rng_test.random((N_TEST, 2))
    test_beta = rng_test.random((N_TEST, N_BETA_TEST))
    groups = []
    for split, us, betas in (("train", train_u, train_beta), ("test", test_u, test_beta)):
        for index, (point, beta_u) in enumerate(zip(us, betas)):
            groups.append({
                "split": split,
                "geometry": f"{split}-{index:03d}",
                "u": [float(point[0]), float(point[1])],
                "thicknessMm": round(common.from_unit(point[0], *common.T_RANGE), 9),
                "strapWidthMm": round(common.from_unit(point[1], *common.B_RANGE), 9),
                "beta_u": [float(v) for v in beta_u],
                "betas": [common.from_unit(float(v), *common.BETA_RANGE) for v in beta_u],
            })
    return groups


def solve_group(args):
    group, geometry, active_paths = args
    start = time.time()
    out = {"group": group, "cases": {}}
    for state, conductor in common.CASES:
        body = geometry["conductors"][conductor]
        pins = common.ground_pins(active_paths, state, conductor)
        sol = fem.solve_conductor(body, pins, group["betas"], **common.PRODUCTION_MESH)
        out["cases"][common.case_key(state, conductor)] = {
            "resistance_g": sol.resistance_g,
            "theta_max": [sol.theta_max[b] for b in group["betas"]],
            "theta_field": np.stack([sol.theta_field[b] for b in group["betas"]]),
            "j_field": sol.j_field,
            "nodes": sol.n_nodes,
            "joule_check": sol.joule_check,
        }
    out["seconds"] = time.time() - start
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    groups = design()
    exported = common.export_geometries(
        [{"thicknessMm": g["thicknessMm"], "strapWidthMm": g["strapWidthMm"]} for g in groups]
    )
    jobs = [(g, geometry, exported["activePaths"]) for g, geometry in zip(groups, exported["geometries"])]
    results = []
    with Pool(args.workers) as pool:
        for result in pool.imap(solve_group, jobs):
            results.append(result)
            print(result["group"]["geometry"], f"{result['seconds']:.1f}s", flush=True)
    common.DATA.mkdir(parents=True, exist_ok=True)
    rows = []
    fields = {}
    for result in results:
        g = result["group"]
        for key, case in result["cases"].items():
            for index, beta in enumerate(g["betas"]):
                rows.append({
                    "split": g["split"],
                    "geometry": g["geometry"],
                    "case": key,
                    "thickness_mm": g["thicknessMm"],
                    "strap_width_mm": g["strapWidthMm"],
                    "beta_per_m": beta,
                    "resistance_g_per_m": case["resistance_g"],
                    "theta_max": case["theta_max"][index],
                    "mesh_nodes": case["nodes"],
                    "joule_identity_error": case["joule_check"],
                })
            safe = key.replace(":", "_")
            fields[f"{g['geometry']}__{safe}__theta"] = case["theta_field"].astype(np.float16)
            # Current density per ampere in 1/mm^2 (J [A/mm^2] = I * value); fits float16.
            fields[f"{g['geometry']}__{safe}__j"] = (case["j_field"] * 1e-6).astype(np.float16)
    with (common.DATA / "samples.csv").open("w", newline="\n", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: (repr(v) if isinstance(v, float) else v) for k, v in row.items()})
    np.savez_compressed(common.DATA / "fields-float16.npz", **fields)
    doe = {
        "seeds": {"train": SEED_TRAIN, "test": SEED_TEST},
        "ranges": {
            "thickness_mm": common.T_RANGE,
            "strap_width_mm": common.B_RANGE,
            "beta_per_m": common.BETA_RANGE,
            "h_W_m2K": common.H_RANGE,
            "k_W_mK": common.K_RANGE,
        },
        "normalization": "u = (ln x - ln x_min) / (ln x_max - ln x_min) for t, b and beta",
        "production_mesh": common.PRODUCTION_MESH,
        "cases": [common.case_key(s, c) for s, c in common.CASES],
        "l1ParamsSha256": exported["l1ParamsSha256"],
        "groups": [
            {k: g[k] for k in ("split", "geometry", "thicknessMm", "strapWidthMm", "betas")}
            for g in groups
        ],
        "fieldEncoding": "float16 per display-lattice point, order of geometry.ts latticeOffsets; theta = normalized rise, j = R_g |grad V1| in 1/mm^2",
    }
    common.write_json(common.DATA / "doe.json", doe)
    print("samples", len(rows), "fields", len(fields), flush=True)


if __name__ == "__main__":
    main()
