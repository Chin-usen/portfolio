"""Analytical verification and mesh-convergence study for the S2 FEM.

Writes reports/analytic-validation.json and reports/mesh-convergence.json.
Run from the repository root:  python src/components/lab/busbar-joule-heating/model/fem/validate.py
"""
from __future__ import annotations

import math
import sys
import time

import numpy as np

import common
import fem

SIGMA_CU = 58.0e6
K_CU = 391.0


def straight_bar(length, width, thickness):
    """A single box along x with full end-face contacts (terminal at x=0, pin at x=L)."""
    def end(pid, x, kind):
        return {
            "id": pid,
            "kind": kind,
            "axis": "x",
            "value": x,
            "min": [x, 0.0, 0.0],
            "max": [x, width, thickness],
        }

    return {
        "id": "bar",
        "boxes": [
            {
                "id": "bar",
                "role": "strap",
                "min": [0.0, 0.0, 0.0],
                "max": [length, width, thickness],
                "lattice": [8, 1, 1],
            }
        ],
        "terminal": end("end-a", 0.0, "terminal"),
        "pins": [end("end-a", 0.0, "pin"), end("end-b", length, "pin")],
    }


def analytic_checks():
    cases = []
    # 1) Resistance R = rho L / A for two cross-sections and two meshes.
    for length, width, thickness in [(40.0, 4.0, 0.8), (60.0, 3.0, 3.0)]:
        bar = straight_bar(length, width, thickness)
        for h_max, n_thin in [(1.0, 2), common.PRODUCTION_MESH.values()]:
            sol = fem.solve_conductor(bar, ["end-b"], [0.0], h_max_mm=h_max, n_thin=n_thin, want_fields=False)
            fem_r = sol.resistance_g / SIGMA_CU
            exact = (length * 1e-3) / (SIGMA_CU * width * thickness * 1e-6)
            cases.append({
                "check": "straight-bar-resistance",
                "geometry_mm": [length, width, thickness],
                "mesh": {"h_max_mm": h_max, "n_thin": n_thin, "nodes": sol.n_nodes},
                "fem_mOhm": fem_r * 1e3,
                "analytic_mOhm": exact * 1e3,
                "relative_error": abs(fem_r - exact) / exact,
                "joule_identity_error": sol.joule_check,
            })
    # 2) One-dimensional conduction with uniform Joule generation, ends at T_sub.
    #    beta = 0: Theta_max = g L^2 / 8 with g = |grad V|^2 = 1/L^2  ->  1/8.
    #    beta > 0: fin with generation, Theta_max = (g/m^2) (1 - 1/cosh(mL/2)), m^2 = beta P / A.
    length, width, thickness = 40.0, 4.0, 0.8
    bar = straight_bar(length, width, thickness)
    betas = [0.0, 0.1, 1.0, 5.0]
    h_max, n_thin = common.PRODUCTION_MESH["h_max_mm"], common.PRODUCTION_MESH["n_thin"]
    sol = fem.solve_conductor(bar, ["end-b"], betas, h_max_mm=h_max, n_thin=n_thin, want_fields=False)
    big_l = length * 1e-3
    g = 1.0 / big_l**2
    perimeter = 2 * (width + thickness) * 1e-3
    area = width * thickness * 1e-6
    for beta in betas:
        if beta == 0.0:
            exact = g * big_l**2 / 8.0
        else:
            m = math.sqrt(beta * perimeter / area)
            exact = g / m**2 * (1.0 - 1.0 / math.cosh(m * big_l / 2.0))
        value = sol.theta_max[beta]
        # Physical example at 200 A in copper with h = beta k.
        scale = 200.0**2 * sol.resistance_g**2 / (SIGMA_CU * K_CU)
        cases.append({
            "check": "1d-conduction-joule-rise",
            "geometry_mm": [length, width, thickness],
            "beta_per_m": beta,
            "mL_over_2": None if beta == 0.0 else math.sqrt(beta * perimeter / area) * big_l / 2,
            "mesh": {"h_max_mm": h_max, "n_thin": n_thin, "nodes": sol.n_nodes},
            "fem_theta_max": value,
            "analytic_theta_max": exact,
            "relative_error": abs(value - exact) / exact,
            "example_copper_200A": {"h_W_m2K": beta * K_CU, "fem_rise_K": scale * value, "analytic_rise_K": scale * exact},
        })
    worst = max(case["relative_error"] for case in cases)
    return {
        "status": "passed" if worst < 0.02 else "failed",
        "criterion": "relative error < 2 %",
        "worst_relative_error": worst,
        "assumptions": "Constant sigma and k; insulated lateral surfaces (resistance); 1-D fin uses all four lateral faces with beta = h/k and both ends at Theta = 0.",
        "cases": cases,
    }


def convergence(geometry, active_paths):
    betas = [common.BETA_RANGE[0], 50.0 / K_CU, common.BETA_RANGE[1]]
    levels = [(2.0, 1), (1.0, 2), (0.5, 4)]
    production = (common.PRODUCTION_MESH["h_max_mm"], common.PRODUCTION_MESH["n_thin"])
    rows = []
    for state, conductor in common.CASES:
        body = geometry["conductors"][conductor]
        pins = common.ground_pins(active_paths, state, conductor)
        results = {}
        for level in [*levels, production]:
            start = time.time()
            sol = fem.solve_conductor(body, pins, betas, h_max_mm=level[0], n_thin=level[1], want_fields=False)
            results[level] = {
                "h_max_mm": level[0],
                "n_thin": level[1],
                "nodes": sol.n_nodes,
                "elements": sol.n_elements,
                "seconds": round(time.time() - start, 2),
                "resistance_g": sol.resistance_g,
                "theta_max": [sol.theta_max[b] for b in betas],
            }
            print(state, conductor, level, sol.n_nodes, f"{time.time() - start:.1f}s", flush=True)

        def richardson(values):
            f1, f2, f3 = values
            d12, d23 = f2 - f1, f3 - f2
            if abs(d23) < 1e-15 or d12 * d23 <= 0:
                return {"order": None, "asymptotic": False, "reference": f3}
            order = math.log(abs(d12 / d23)) / math.log(2.0)
            if not 0.5 <= order <= 3.0:
                # Outside the asymptotic range the finest level is the reference value.
                return {"order": order, "asymptotic": False, "reference": f3}
            return {"order": order, "asymptotic": True, "reference": f3 + d23 / (2.0**order - 1.0)}

        r = richardson([results[level]["resistance_g"] for level in levels])
        thetas = [richardson([results[level]["theta_max"][i] for level in levels]) for i in range(len(betas))]
        prod = results[production]
        rows.append({
            "case": common.case_key(state, conductor),
            "levels": [results[level] for level in levels],
            "production": prod,
            "resistance": {
                **r,
                "production_error_vs_reference": abs(prod["resistance_g"] - r["reference"]) / r["reference"],
                "production_change_vs_finest": abs(prod["resistance_g"] - results[levels[2]]["resistance_g"]) / results[levels[2]]["resistance_g"],
                "finest_change_vs_previous": abs(results[levels[2]]["resistance_g"] - results[levels[1]]["resistance_g"]) / results[levels[2]]["resistance_g"],
            },
            "theta_max": [
                {
                    "beta_per_m": betas[i],
                    **thetas[i],
                    "production_error_vs_reference": abs(prod["theta_max"][i] - thetas[i]["reference"]) / thetas[i]["reference"],
                    "production_change_vs_finest": abs(prod["theta_max"][i] - results[levels[2]]["theta_max"][i]) / results[levels[2]]["theta_max"][i],
                    "finest_change_vs_previous": abs(results[levels[2]]["theta_max"][i] - results[levels[1]]["theta_max"][i]) / results[levels[2]]["theta_max"][i],
                }
                for i in range(len(betas))
            ],
        })
    worst_r = max(row["resistance"]["production_error_vs_reference"] for row in rows)
    worst_t = max(item["production_error_vs_reference"] for row in rows for item in row["theta_max"])
    return {
        "geometry": geometry["input"],
        "levels": [{"h_max_mm": a, "n_thin": b} for a, b in levels],
        "production_mesh": common.PRODUCTION_MESH,
        "betas_per_m": betas,
        "worst_production_error": {"resistance": worst_r, "theta_max": worst_t},
        "note": "Each level halves every spacing. The reference value is the Richardson extrapolation of the three nested levels when the observed order lies in [0.5, 3]; otherwise (non-monotone or pre-asymptotic) it is the finest level. Contact-patch edges make the current density singular, so resistance converges at roughly first order.",
        "cases": rows,
    }


def main():
    common.REPORTS.mkdir(parents=True, exist_ok=True)
    analytic = analytic_checks()
    common.write_json(common.REPORTS / "analytic-validation.json", analytic)
    print("analytic", analytic["status"], analytic["worst_relative_error"], flush=True)
    exported = common.export_geometries([{"thicknessMm": 0.8, "strapWidthMm": 3.0}])
    geometry = exported["geometries"][0]
    report = convergence(geometry, exported["activePaths"])
    report["l1ParamsSha256"] = exported["l1ParamsSha256"]
    common.write_json(common.REPORTS / "mesh-convergence.json", report)
    print("convergence", report["worst_production_error"], flush=True)
    if analytic["status"] != "passed":
        sys.exit(1)


if __name__ == "__main__":
    np.set_printoptions(precision=6)
    main()
