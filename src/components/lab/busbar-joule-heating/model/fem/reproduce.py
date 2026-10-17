"""Re-solve committed FEM samples and compare with data/samples.csv (used by verify.mjs --fem).

Solves the L1 nominal training geometry and the first two independent test geometries with the
production mesh and prints one JSON line with the largest relative differences.
"""
from __future__ import annotations

import csv
import json
import sys

import common
import fem

GROUPS = ["train-068", "test-000", "test-001"]


def main():
    doe = json.loads((common.DATA / "doe.json").read_text(encoding="utf-8"))
    groups = [g for g in doe["groups"] if g["geometry"] in GROUPS]
    exported = common.export_geometries(
        [{"thicknessMm": g["thicknessMm"], "strapWidthMm": g["strapWidthMm"]} for g in groups]
    )
    rows = list(csv.DictReader((common.DATA / "samples.csv").open(encoding="utf-8")))
    worst_r = worst_t = 0.0
    for group, geometry in zip(groups, exported["geometries"]):
        for state, conductor in common.CASES:
            key = common.case_key(state, conductor)
            pins = common.ground_pins(exported["activePaths"], state, conductor)
            sol = fem.solve_conductor(
                geometry["conductors"][conductor], pins, group["betas"], want_fields=False, **common.PRODUCTION_MESH
            )
            for row in rows:
                if row["geometry"] != group["geometry"] or row["case"] != key:
                    continue
                beta = float(row["beta_per_m"])
                worst_r = max(worst_r, abs(sol.resistance_g / float(row["resistance_g_per_m"]) - 1))
                worst_t = max(worst_t, abs(sol.theta_max[beta] / float(row["theta_max"]) - 1))
    result = {"groups": GROUPS, "maxRelativeDifference": {"resistanceG": worst_r, "thetaMax": worst_t}}
    print(json.dumps(result))
    if worst_r > 1e-6 or worst_t > 1e-6:
        sys.exit(1)


if __name__ == "__main__":
    main()
