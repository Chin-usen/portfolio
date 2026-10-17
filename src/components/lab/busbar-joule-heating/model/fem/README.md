# S2 busbar Joule heating — offline FEM and surrogate

参数化示意模型，几何经简化。Parametric illustrative model, simplified geometry. The browser never runs this solver; it evaluates the exported surrogate only.

## Geometry source

`../export-geometry.mjs` runs `../../geometry.ts`, which reads `model/l1-half-bridge/params.json` at run time. Every nominal dimension comes from that file. The page inputs replace only:

- `t` (0.5–3 mm): `busbarThickness` and `collectorThickness` for every plate and strap; layers keep the L1 interlayer clearances and move up together.
- `b` (2–6 mm): `acBridgeWidth`, `nRiseDepth` and `pFeedLength` (all 3 mm in L1).

The SHA-256 of the L1 file is stored in `data/doe.json`, the surrogate JSON and `public/models/busbar-joule-heating/model-manifest.json`; `pnpm model:lab:verify busbar-joule-heating` fails if the L1 file changes without retraining.

## Physics and boundary conditions

Each conductor (P layer, AC link, N layer) is solved separately with constant properties.

1. Electric potential, `div(σ grad V) = 0`, solved with σ = 1: V = 1 on the terminal bolt-washer face (square of 1.6 hole diameters minus the bolt hole), V = 0 on the pin faces of the conducting switch (S_H on: P feed post, four S_H source clips; S_L on: AC drain-feed post on substrate 2, four S_L source clips). Other faces are insulated. The terminal current gives `R_g = 1/I₁` and `R = R_g/σ`.
2. Steady conduction with the Joule source, normalized: `lap Θ + |grad V₁|² = 0`, Θ = 0 (T = T_sub) on every soldered pin and clip face, `−∂Θ/∂n = (h/k) Θ` on all other faces with `T∞ = T_sub`. Then `T − T_sub = I² R_g² Θ / (σ k)`.

Not modelled: chip losses (so clip faces are at T_sub), skin/proximity effect, temperature coefficient of resistivity, radiation, conduction between conductors through the insulation film or air, conduction into external cables.

## Discretization

`fem.py`: trilinear 8-node hexahedra on a rectilinear grid fitted to every box, contact patch and bolt-hole bound; each box receives at least `n_thin` cells across every dimension and no spacing exceeds `h_max`. Production mesh: `h_max = 0.75 mm`, `n_thin = 2` (about 5k–30k nodes per conductor at nominal size). Sparse assembly with numpy, direct solves with SciPy SuperLU. The Joule load uses 2×2×2 Gauss integration; `V'KV`, the Gauss integral and `I₁·V₀` agree to < 1e-11.

## Reports

- `reports/analytic-validation.json`: straight bar `R = ρL/A` (two cross-sections, two meshes) and 1-D conduction with uniform Joule generation (adiabatic `ΔT = gL²/8` and fin `ΔT = g/m² (1 − 1/cosh(mL/2))`); criterion < 2 %.
- `reports/mesh-convergence.json`: nominal geometry, four conductor cases, three nested levels (2 mm/1, 1 mm/2, 0.5 mm/4) plus production; observed order, Richardson reference where asymptotic, production-versus-finest change.
- `reports/surrogate-validation.json`: geometry-grouped 5-fold cross-validation on the training set and an independent random test set never used in fitting; resistance, peak rise and field errors.

## Data

- `data/doe.json`: design (seeded), ranges, mesh, L1 hash. Training: 64 Latin-hypercube geometries in (ln t, ln b) + 4 corners + the L1 nominal, each at 4 stratified β = h/k values (β ∈ [0.0125, 5] 1/m). Test: 20 random geometries × 3 random β.
- `data/samples.csv`: one row per sample and conductor case with R_g and Θ_max (full precision).
- `data/fields-float16.npz`: display-lattice fields in `geometry.ts` lattice order, float16: Θ and the current density per ampere R_g·|grad V₁| in 1/mm². The archive content is deterministic; its zip entry timestamps are not.

## Surrogate

`surrogate.py` fits Gaussian processes (Matérn 5/2, ARD, linear trend) to ln R_g(t, b) and ln Θ_max(t, b, β) for each case, and POD (≤ 12 modes; 99.999 % energy target for temperature, 99.95 % for current density) plus one Gaussian process per POD coefficient for the normalized fields. Exports `public/models/busbar-joule-heating/scalar-model.json` (bundled with the page), `field-model.json` and `field-basis.f16` (fetched with the 3D/2D field view).

## Regenerate

From the repository root, with the pinned Node on `PATH` (the geometry export runs Node):

```sh
python -m venv .venv-s2 && .venv-s2/bin/pip install -r src/components/lab/busbar-joule-heating/model/fem/requirements.txt
cd src/components/lab/busbar-joule-heating/model/fem
../../../../../../.venv-s2/bin/python sample.py --workers 2   # ~20 min on 2 cores
../../../../../../.venv-s2/bin/python validate.py            # ~3 min
../../../../../../.venv-s2/bin/python surrogate.py           # ~5 min
cd - && pnpm model:lab busbar-joule-heating                  # GLB, preview, manifest
pnpm model:lab:verify busbar-joule-heating                   # add --fem with PYTHON=... to re-solve samples
```

Then regenerate the page fonts (`model/subset-fonts.py`) if page text changed. Results are deterministic for the pinned numpy/scipy versions in `requirements.txt` and the pinned Node; other BLAS builds may differ in the last digits.
