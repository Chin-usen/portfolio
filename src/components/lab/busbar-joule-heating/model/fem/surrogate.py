"""Fit, cross-validate and export the S2 surrogate from data/ (see sample.py).

Scalar outputs per current-carrying conductor case (4 cases):
  ln R_g(t, b)            geometric resistance, R = R_g / sigma
  ln Theta_max(t, b, beta) normalized peak rise, dT = I^2 R_g^2 Theta_max / (sigma k)
Fields per case: POD of Theta / Theta_max (inputs t, b, beta) and of the current-density ratio
R_g |grad V| b t (inputs t, b). Each scalar and POD coefficient is a Gaussian-process regression
(Matern 5/2, ARD, linear trend) on log-normalized inputs u in [0, 1]^d. Scalar hyperparameters
maximize the marginal likelihood (analytic gradient, profiled signal variance), separately for
every scalar and POD coefficient.

Writes public/models/busbar-joule-heating/{scalar-model.json, field-model.json, field-basis.f16}
and reports/surrogate-validation.json.
"""
from __future__ import annotations

import csv
import json
import math
from collections import defaultdict

import numpy as np
from scipy.linalg import cho_factor, cho_solve
from scipy.optimize import minimize

import common

SQRT5 = math.sqrt(5.0)
FOLDS = 5
MAX_MODES = 12
ENERGY = {"theta": 0.99999, "j": 0.9995}


def kernel(x1, x2, lengths, variance):
    d = np.sqrt((((x1[:, None, :] - x2[None, :, :]) / lengths) ** 2).sum(axis=-1))
    s = SQRT5 * d
    return variance * (1.0 + s + s * s / 3.0) * np.exp(-s)


BOUNDS_LOG_LENGTH = (math.log(0.02), math.log(20.0))
BOUNDS_LOG_NOISE = (math.log(1e-10), math.log(1e-2))


def _nll_and_grad(theta, x, r, sq):
    """Negative log marginal likelihood (unit signal variance profiled out) and its gradient.

    theta = [log l_1..d, log noise ratio]; the signal variance has the closed-form optimum
    sigma^2 = r' K~^-1 r / n for the unit-variance kernel K~.
    """
    d = x.shape[1]
    lengths = np.exp(theta[:d])
    noise = math.exp(theta[d])
    scaled = sq / lengths**2  # (n, n, d) squared scaled differences
    dist = np.sqrt(scaled.sum(axis=-1))
    s = SQRT5 * dist
    e = np.exp(-s)
    k = (1.0 + s + s * s / 3.0) * e + (noise + 1e-10) * np.eye(len(r))
    try:
        c = cho_factor(k, lower=True)
    except np.linalg.LinAlgError:
        return 1e25, np.zeros_like(theta)
    n = len(r)
    alpha = cho_solve(c, r)
    variance = float(r @ alpha) / n
    nll = 0.5 * n * math.log(variance) + np.log(np.diag(c[0])).sum()
    inv = cho_solve(c, np.eye(n))
    w = inv - np.outer(alpha, alpha) / variance
    common_factor = (5.0 / 3.0) * (1.0 + s) * e
    grad = np.empty_like(theta)
    for axis in range(d):
        grad[axis] = 0.5 * np.sum(w * common_factor * scaled[:, :, axis])
    grad[d] = 0.5 * noise * np.trace(w)
    return nll, grad


class GP:
    def __init__(self, x, y, lengths=None, noise=None):
        """Fit a GP; pass lengths/noise to reuse hyperparameters (variance is re-estimated)."""
        self.x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        h = np.hstack([np.ones((len(self.x), 1)), self.x])
        self.trend = np.linalg.lstsq(h, y, rcond=None)[0]
        residual = y - h @ self.trend
        self.scale = float(residual.std()) or 1.0
        r = residual / self.scale
        d = self.x.shape[1]
        if lengths is None:
            sq = (self.x[:, None, :] - self.x[None, :, :]) ** 2
            best = None
            for start in (0.3, 1.0, 3.0):
                theta0 = np.concatenate([np.full(d, math.log(start)), [math.log(1e-6)]])
                result = minimize(
                    _nll_and_grad, theta0, args=(self.x, r, sq), jac=True, method="L-BFGS-B",
                    bounds=[BOUNDS_LOG_LENGTH] * d + [BOUNDS_LOG_NOISE], options={"maxiter": 300},
                )
                if best is None or result.fun < best.fun:
                    best = result
            lengths = np.exp(best.x[:d])
            noise = math.exp(best.x[d])
        self.lengths = np.asarray(lengths, dtype=float)
        self.noise = float(noise) + 1e-10
        unit = kernel(self.x, self.x, self.lengths, 1.0) + self.noise * np.eye(len(r))
        c = cho_factor(unit, lower=True)
        alpha_unit = cho_solve(c, r)
        self.variance = float(r @ alpha_unit) / len(r)
        # Mean prediction is independent of the variance: k_* (sigma^2 K~)^-1 r = k~_* K~^-1 r.
        self.alpha = alpha_unit / self.variance

    def predict(self, x):
        x = np.atleast_2d(np.asarray(x, dtype=float))
        h = np.hstack([np.ones((len(x), 1)), x])
        return h @ self.trend + self.scale * (kernel(x, self.x, self.lengths, self.variance) @ self.alpha)

    def export(self, digits=9):
        return {
            "lengths": [float(f"{v:.{digits}g}") for v in self.lengths],
            "variance": float(f"{self.variance:.{digits}g}"),
            "scale": float(f"{self.scale:.{digits}g}"),
            "trend": [float(f"{v:.{digits}g}") for v in self.trend],
            "alpha": [float(f"{v:.{digits}g}") for v in self.alpha],
        }


def load():
    rows = list(csv.DictReader((common.DATA / "samples.csv").open(encoding="utf-8")))
    fields = np.load(common.DATA / "fields-float16.npz")
    doe = json.loads((common.DATA / "doe.json").read_text(encoding="utf-8"))
    return rows, fields, doe


def unit_inputs(t, b, beta=None):
    u = [common.to_unit(t, *common.T_RANGE), common.to_unit(b, *common.B_RANGE)]
    if beta is not None:
        u.append(common.to_unit(beta, *common.BETA_RANGE))
    return u


def organize(rows, fields, doe):
    """Per case: geometry-level (2-D) and sample-level (3-D) arrays for train/test splits."""
    groups = {g["geometry"]: g for g in doe["groups"]}
    data = {}
    for key in (common.case_key(s, c) for s, c in common.CASES):
        safe = key.replace(":", "_")
        per = {"train": defaultdict(list), "test": defaultdict(list)}
        seen = set()
        for row in rows:
            if row["case"] != key:
                continue
            g = groups[row["geometry"]]
            split = per[row["split"]]
            t, b, beta = float(row["thickness_mm"]), float(row["strap_width_mm"]), float(row["beta_per_m"])
            rg = float(row["resistance_g_per_m"])
            theta_max = float(row["theta_max"])
            index = g["betas"].index(beta)
            theta_field = fields[f"{row['geometry']}__{safe}__theta"][index].astype(np.float64)
            split["x3"].append(unit_inputs(t, b, beta))
            split["geo3"].append(row["geometry"])
            split["log_theta"].append(math.log(theta_max))
            split["phi_theta"].append(theta_field / theta_max)
            split["rg3"].append(rg)
            split["tb3"].append((t, b, beta))
            if row["geometry"] not in seen:
                seen.add(row["geometry"])
                j_field = fields[f"{row['geometry']}__{safe}__j"].astype(np.float64)
                split["x2"].append(unit_inputs(t, b))
                split["geo2"].append(row["geometry"])
                split["log_rg"].append(math.log(rg))
                split["phi_j"].append(j_field * b * t)
        data[key] = {split: {k: np.array(v) for k, v in values.items()} for split, values in per.items()}
    return data


def pod(snapshots, target):
    mean = snapshots.mean(axis=0)
    centered = snapshots - mean
    u, s, vt = np.linalg.svd(centered, full_matrices=False)
    energy = np.cumsum(s**2) / (s**2).sum()
    modes = int(min(MAX_MODES, np.searchsorted(energy, target) + 1))
    basis = vt[:modes]
    coefficients = centered @ basis.T
    return mean, basis, coefficients, float(energy[modes - 1])


def folds(geometries):
    names = sorted(set(geometries))
    rng = np.random.default_rng(1604)
    order = rng.permutation(len(names))
    return {names[i]: int(rank % FOLDS) for rank, i in enumerate(order)}


def relative(a, b):
    return np.abs(a - b) / np.abs(b)


def summary(errors):
    errors = np.asarray(errors)
    return {"mean": float(errors.mean()), "max": float(errors.max()), "p95": float(np.percentile(errors, 95)), "n": int(len(errors))}


def cross_validate(x, y, groups):
    assignment = folds(groups)
    fold_of = np.array([assignment[g] for g in groups])
    prediction = np.empty(len(y))
    for fold in range(FOLDS):
        held = fold_of == fold
        model = GP(x[~held], y[~held])
        prediction[held] = model.predict(x[held])
    return prediction


def main():
    rows, fields, doe = load()
    data = organize(rows, fields, doe)
    keys = [common.case_key(s, c) for s, c in common.CASES]
    scalar_models, field_models = {}, {}
    validation = {"cases": {}, "states": {}}
    cv_pred, test_pred = {}, {}
    blobs = []
    offset = 0
    for key in keys:
        train, test = data[key]["train"], data[key]["test"]
        gp_r = GP(train["x2"], train["log_rg"])
        gp_t = GP(train["x3"], train["log_theta"])
        cv_r = cross_validate(train["x2"], train["log_rg"], list(train["geo2"]))
        cv_t = cross_validate(train["x3"], train["log_theta"], list(train["geo3"]))
        cv_pred[key] = {"rg2": np.exp(cv_r), "theta": np.exp(cv_t)}
        test_pred[key] = {"rg2": np.exp(gp_r.predict(test["x2"])), "theta": np.exp(gp_t.predict(test["x3"]))}
        scalar_models[key] = {"logResistanceG": gp_r.export(), "logThetaMax": gp_t.export()}
        # Fields.
        mean_t, basis_t, coef_t, energy_t = pod(train["phi_theta"], ENERGY["theta"])
        mean_j, basis_j, coef_j, energy_j = pod(train["phi_j"], ENERGY["j"])
        gps_t = [GP(train["x3"], coef_t[:, m]) for m in range(len(basis_t))]
        gps_j = [GP(train["x2"], coef_j[:, m]) for m in range(len(basis_j))]
        rec_t = mean_t + np.stack([gp.predict(test["x3"]) for gp in gps_t], axis=1) @ basis_t
        rec_j = mean_j + np.stack([gp.predict(test["x2"]) for gp in gps_j], axis=1) @ basis_j
        field_err_t = np.sqrt(((rec_t - test["phi_theta"]) ** 2).mean(axis=1))
        field_max_t = np.abs(rec_t - test["phi_theta"]).max(axis=1)
        j_scale = np.percentile(test["phi_j"], 99, axis=1)
        field_err_j = np.sqrt(((rec_j - test["phi_j"]) ** 2).mean(axis=1)) / j_scale
        n_points = basis_t.shape[1]
        segments = {}
        for name, array in (("thetaMean", mean_t), ("thetaModes", basis_t), ("jMean", mean_j), ("jModes", basis_j)):
            flat = np.asarray(array, dtype=np.float16).ravel()
            segments[name] = {"offset": offset, "length": int(flat.size)}
            blobs.append(flat)
            offset += flat.size
        field_models[key] = {
            "points": n_points,
            "thetaModes": len(basis_t),
            "jModes": len(basis_j),
            "thetaEnergy": energy_t,
            "jEnergy": energy_j,
            "segments": segments,
            "thetaCoefficients": [gp.export(7) for gp in gps_t],
            "jCoefficients": [gp.export(7) for gp in gps_j],
        }
        validation["cases"][key] = {
            "resistance": {
                "crossValidation": summary(relative(cv_pred[key]["rg2"], np.exp(train["log_rg"]))),
                "test": summary(relative(test_pred[key]["rg2"], np.exp(test["log_rg"]))),
            },
            "thetaMax": {
                "crossValidation": summary(relative(cv_pred[key]["theta"], np.exp(train["log_theta"]))),
                "test": summary(relative(test_pred[key]["theta"], np.exp(test["log_theta"]))),
            },
            "field": {
                "thetaModes": len(basis_t),
                "thetaPodEnergy": energy_t,
                "jModes": len(basis_j),
                "jPodEnergy": energy_j,
                "testThetaRmsOverMax": summary(field_err_t),
                "testThetaMaxAbsOverMax": summary(field_max_t),
                "testCurrentDensityRmsOverP99": summary(field_err_j),
            },
        }
        print(key, json.dumps(validation["cases"][key]["thetaMax"]["test"]), flush=True)

    # State-level quantities: equivalent resistance and peak rise across the two conductors.
    for state in ("sh", "sl"):
        pair = [k for k in keys if k.startswith(state + ":")]
        out = {}
        for split, predictions in (("crossValidation", cv_pred), ("test", test_pred)):
            source = data[pair[0]]["train" if split == "crossValidation" else "test"]
            # Geometry-level resistance: rows align because every case shares the same groups.
            r_true = sum(np.exp(data[k]["train" if split == "crossValidation" else "test"]["log_rg"]) for k in pair)
            r_pred = sum(predictions[k]["rg2"] for k in pair)
            # Peak rise per sample: max_c R_g,c^2 Theta_max,c (common factor I^2 / (sigma k)).
            def peak(kind):
                values = []
                for k in pair:
                    d = data[k]["train" if split == "crossValidation" else "test"]
                    if kind == "true":
                        values.append(np.array(d["rg3"]) ** 2 * np.exp(d["log_theta"]))
                    else:
                        lookup = dict(zip(d["geo2"], predictions[k]["rg2"]))
                        rg = np.array([lookup[g] for g in d["geo3"]])
                        values.append(rg**2 * predictions[k]["theta"])
                return np.max(values, axis=0)
            assert len(source["geo3"]) == len(data[pair[1]]["train" if split == "crossValidation" else "test"]["geo3"])
            out[split] = {
                "equivalentResistance": summary(relative(r_pred, r_true)),
                "jouleLoss": summary(relative(r_pred, r_true)),
                "peakRise": summary(relative(peak("pred"), peak("true"))),
            }
        validation["states"][state] = out

    basis = np.concatenate(blobs).astype("<f2")
    common.PUBLIC.mkdir(parents=True, exist_ok=True)
    (common.PUBLIC / "field-basis.f16").write_bytes(basis.tobytes())
    first = data[keys[0]]["train"]
    shared = {
        "schema": 1,
        "kernel": "matern52-ard-linear-trend",
        "inputs": {
            "thickness_mm": common.T_RANGE,
            "strap_width_mm": common.B_RANGE,
            "beta_per_m": common.BETA_RANGE,
            "normalization": "u = (ln x - ln min) / (ln max - ln min)",
        },
        "l1ParamsSha256": doe["l1ParamsSha256"],
        "samplesSha256": common.sha256(common.DATA / "samples.csv"),
        "fieldsSha256": common.sha256(common.DATA / "fields-float16.npz"),
    }
    scalar = {
        **shared,
        "x2": [[round(v, 9) for v in row] for row in first["x2"].tolist()],
        "x3": [[round(v, 9) for v in row] for row in first["x3"].tolist()],
        "cases": scalar_models,
        "validation": {
            "states": validation["states"],
            "trainingSamples": int(len(first["x3"])),
            "trainingGeometries": int(len(first["x2"])),
            "testSamples": int(len(data[keys[0]]["test"]["x3"])),
            "testGeometries": int(len(data[keys[0]]["test"]["x2"])),
        },
    }
    field = {**shared, "basisSha256": common.sha256(common.PUBLIC / "field-basis.f16"), "basisValues": int(basis.size), "cases": field_models}
    (common.PUBLIC / "scalar-model.json").write_text(json.dumps(scalar, separators=(",", ":")) + "\n", encoding="utf-8")
    (common.PUBLIC / "field-model.json").write_text(json.dumps(field, separators=(",", ":")) + "\n", encoding="utf-8")
    common.prettier(common.PUBLIC / "scalar-model.json", common.PUBLIC / "field-model.json")
    validation.update({
        "method": shared["kernel"],
        "folds": FOLDS,
        "foldGrouping": "by geometry (all beta samples of one geometry share a fold)",
        "trainingSamples": scalar["validation"]["trainingSamples"],
        "testSamples": scalar["validation"]["testSamples"],
        "podEnergyTarget": ENERGY,
        "maxModes": MAX_MODES,
        "exactScaling": "Current, sigma and k enter analytically: R = R_g/sigma, P = I^2 R, dT = I^2 R_g^2 Theta/(sigma k).",
    })
    common.write_json(common.REPORTS / "surrogate-validation.json", validation)
    print(json.dumps(validation["states"], indent=1))


if __name__ == "__main__":
    main()
