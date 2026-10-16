# P2: real three-dimensional steady-conduction FEM

## Implementation and scope

This solver assembles and solves a **three-dimensional finite-element conduction problem**. It does not label an analytic resistance network as FEM. The scalar comparison formula is evaluated separately and never enters the FEM stiffness matrix, boundary conditions or solution.

The implementation uses custom conforming trilinear Q1 hexahedral elements with NumPy and SciPy's open-source sparse direct solver. This is a deliberate deviation from the suggested gmsh/FEniCS route: the geometry is a nested stack of aligned squares, so a structured conforming mesh can represent every interface exactly, avoid an external mesher and reuse topology across the parameter study. There is no proprietary software, GPU solver or external service dependency.

The implementation is in `solver/fem.py`; sampling, convergence selection and checkpoint orchestration are in `solver/run.py`. Dependency versions are pinned in `requirements.txt`. The custom solver code is provided under the MIT license in `SOLVER-LICENSE.txt`.

## Physical problem

The full stack is centred at x=y=0. From bottom to top:

| Layer | Side length (mm) | Thickness (mm) | Conductivity (W/(m·K)) |
| --- | ---: | --- | --- |
| Cooler | 30 | t_cooler | k_cooler |
| Lower solder | 10 | t_sb | k_sb |
| Lower copper | 10 | t_cub | k_cu |
| Ceramic | 12 | t_cer | k_cer |
| Upper copper | 10 | t_cut | k_cu |
| Upper solder | 5 | t_st | k_st |
| Chip | 5 | 0.18 | 370 |

Conductivity is piecewise constant and isotropic. Contacts are ideal: temperatures and conductive flux are continuous across shared material interfaces. No contact resistance, radiation, transients, fluid flow or volumetric generation is included.

Boundary conditions:

- Uniform prescribed inward heat flux on the chip top: q = 100 W / (5 mm × 5 mm).
- Convective Robin boundary on the complete cooler bottom: outward heat flux h(T−Tcool), Tcool=0 °C.
- Zero normal flux on every other exterior surface.
- The x=0 and y=0 symmetry planes have zero normal flux.

A quarter-domain is exact for this symmetric geometry, material distribution and boundary data. Its applied power is 25 W; resistances are normalized by the **full-device 100 W**, so they represent the complete stack, not a quarter-device resistance. Future asymmetric loads or geometry cannot use this quarter-domain assumption unchanged.

## Weak form and numerical assembly

For each admissible test function v:

∫Ω k ∇T·∇v dV + ∫Γcooler h T v dA = ∫Γchip q v dA.

No essential temperature condition is needed because the positive Robin coefficient anchors the otherwise-Neumann problem. The ambient offset can be added later because the problem is linear with constant properties.

Q1 element matrices use exact tensor products of one-dimensional linear-element mass and stiffness matrices:

- M(L) = L/6 [[2,1],[1,2]]
- S(L) = 1/L [[1,−1],[−1,1]]
- Ke/k = Mz⊗My⊗Sx + Mz⊗Sy⊗Mx + Sz⊗My⊗Mx

The local node order is x-fastest, then y, then z. Surface mass matrices integrate the Robin boundary exactly; consistent top-face load vectors integrate the uniform input flux exactly.

Within each layer, the z coordinate is parameterized by η∈[0,1]. For fixed x/y mesh topology, the two preassembled layer matrices are scaled as k·t·Kxy + (k/t)·Kz, where t is the actual thickness in metres. Each sample thus changes the **actual FEM operator and actual physical geometry**, not just a postprocessed resistance factor.

The mesh uses exact quarter-width breakpoints x/y=0, 2.5, 5, 6, 15 mm. Nodes are shared at material interfaces. Exposed portions of stepped interfaces remain natural zero-flux boundaries. Shared node identity guarantees conforming temperature continuity.

The linear systems use SciPy `spsolve` with SuperLU's symmetric minimum-degree ordering. See the [official sparse solver documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.linalg.spsolve.html). The solver checks the actual algebraic residual and integrated convective heat flow for every sample.

## Validation actually run

### Exact element patch test

A single three-dimensional rectangular Q1 element, with uniform top flux, bottom Robin convection and insulated sides, has an exact linear-in-z solution. The implemented element gives 8.0 K at the bottom and 8.8 K at the top with maximum error **5.33×10⁻¹⁵ K**. Element symmetry and zero conductive row sums are also checked. Raw output: `reports/element-verification.json`.

### Midpoint mesh convergence

The baseline uses the arithmetic midpoint of all twelve input bounds, not the P3 default or the midpoint in logarithmic coordinates.

| Mesh | Nodes | Hex elements | Elements through each solder | Rjmax (K/W) | Rjavg (K/W) |
| --- | ---: | ---: | ---: | ---: | ---: |
| L1 | 3,550 | 2,706 | 3 | 0.630422287 | 0.572108420 |
| L2 | 10,291 | 8,541 | 4 | 0.631304186 | 0.575035405 |
| L3 | 24,897 | 21,648 | 6 | 0.631777004 | 0.576301833 |

The final mesh is **L3**. Relative to L2, Rjmax changes by **0.07490%** and source-surface Rjavg by **0.22023%**; both satisfy the required <0.5% baseline criterion after three levels. The final baseline relative residual is 1.79×10⁻¹³ and heat imbalance is 1.63×10⁻¹⁴. Every sampled solder layer has six elements through its thickness, including the 0.05 mm minimum.

Raw mesh results and actual settings are in `reports/convergence.csv` and `reports/selected-mesh.json`; `reports/convergence.png` plots the measured convergence. This is a baseline refinement check, not a rigorous uniform error bound for every parameter combination or every local gradient near a step.

### Default point and independent analytic comparison

At the P3 defaults, the real FEM result is Rjmax=**0.4926774532 K/W**, Rjavg=**0.4348115729 K/W**. At 100 W and 65 °C coolant, these correspond to **114.2677 °C** and **108.4812 °C**.

The separately evaluated 45-degree/circular-equivalent analytic approximation gives **0.6056419028 K/W**, or **125.5642 °C** at those conditions. The models are different and are not forced to agree. In particular, the FEM resolves a peak and surface average while the analytic placeholder has one lumped source temperature. The default FEM raw output is in `reports/default-fem.npz` and `reports/default-fem.json`.

The 500-sample run completed and every case passed the checks. The maximum relative residual is **1.05151×10⁻¹²**, maximum heat imbalance is **1.94632×10⁻¹²**, and mean direct-solve time is **1.21080 s** on the recorded Windows host. Against FEM Rjmax, the separate analytic model has Pearson correlation **0.92654**, Spearman correlation **0.92481**, mean absolute relative error **24.0199%** and maximum absolute relative error **85.6094%**. High correlation does not make the analytic model an accurate substitute. Raw results are in `reports/dataset-verification.json` and `reports/analytic-vs-fem.png`. The runner rejects any sample with relative residual or heat imbalance above 10⁻⁷ instead of silently including it.

## Sampling and split

Twelve parameters use the same ranges as the P3 parameter module. Power and coolant temperature are not sampled because the constant-property steady problem scales linearly.

- Number of samples: 500.
- Latin-hypercube RNG seed: **20261014**.
- Thicknesses: linearly stratified within their bounds.
- Conductivities and h: stratified in natural-log space within their bounds.
- Split: a separate fixed permutation with seed **20261015**, 400 train and 100 held-out test samples.
- The test split must remain unused for training, POD construction and model/hyperparameter selection.

Sampling uses [SciPy's LatinHypercube implementation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.qmc.LatinHypercube.html). The generator, dependency versions, actual input CSV and split labels are supplied so the design is reproducible.

## Data contract

Final files: `data/parameters.csv`, `data/samples.csv`, `data/samples.npz`. The preview fixture, if present, contains only the first 20 completed rows and must not be mistaken for the final dataset.

| NPZ key | Shape / meaning |
| --- | --- |
| parameters | (500,12), physical values in parameter_keys order |
| parameter_keys | t_cooler,k_cooler,t_sb,k_sb,t_cub,t_cer,k_cer,t_cut,k_cu,t_st,k_st,h |
| sample_id, split | (500,), integer ID and string train/test |
| Rjmax | (500,), maximum nodal temperature on chip-top facets / full power, K/W |
| Rjavg | (500,), exact Q1 facet-integrated source-surface mean / full power, K/W |
| interface_axis_K_per_W | (500,8), centre-axis temperatures at the eight stack boundaries, bottom→top, K/W |
| layer_drop_K_per_W | (500,7), upward differences of adjacent centre-axis interface values |
| layer_ids | cooler,solder-bottom,copper-bottom,ceramic,copper-top,solder-top,chip |
| field_K_per_W | (500,64,128), x–z centre-plane solution sampled with exact Q1 interpolation, K/W |
| field_x_mm | (128,), physical x cell centres from −15 to +15 mm |
| field_z_mm | (500,64), actual physical z for each sample and each field row |
| field_mask | (64,128), 1 inside material, 0 outside |
| field_layer, field_eta | (64,), layer index and within-layer normalized row height |
| residual_rel, heat_balance_rel | (500,), actual solve verification metrics |
| heat_out_quarter_W | (500,), integrated Robin outflow; expected 25 W |
| solve_seconds | (500,), direct solve runtime |
| analytic_Rth | (500,), independently evaluated analytic approximation for comparison |

The centre-axis layer drops are diagnostics normalized by full power. They are **not** whole-layer series resistances: the local flux distribution in a 3D spreading problem varies across a layer.

### Geometry-aligned field map

The exported field is a centre-plane slice of the solved **3D** model, not a separate 2D calculation. The full x interval is obtained by exact reflection of the symmetric quarter solution.

Rows are allocated to layers as 16,6,8,12,8,6,8 from bottom to top. Within each layer the rows lie at η=(i+0.5)/n. As thicknesses change, each row follows its own physical layer. The mask is consequently fixed across samples and the basis representation is aligned with material interfaces for POD. The z spacing is **not globally uniform**. Consumers must use field_z_mm or reconstruct it from field_layer, field_eta and thicknesses; stretching a globally uniform z image without this map misrepresents the geometry.

Masked-out field values are zero placeholders. Exclude them from errors/POD fitting or respect the mask; they are not zero-temperature material. To obtain physical Celsius at arbitrary operating conditions, use T = Tcool + P × field_K_per_W on valid cells. The same scaling applies independently to Rjmax and Rjavg. No synthetic lateral attenuation is applied to these FEM fields.

## Reproduce and resume

Use Python 3.12 and install `requirements.txt` in an isolated environment. From this directory:

```text
python solver/run.py convergence
python solver/run.py dataset
```

The first command runs the exact-element test, measures at least three mesh levels and writes the actually selected mesh. The second generates the fixed sampling design and solves 500 cases using that mesh.

Each successful case is checkpointed as `checkpoints/0000.npz` through `0499.npz`. Rerunning the dataset command resumes only after validating parameters, mesh name and solver version; the aggregated dataset is published only after all 500 checkpoints are present. Keep only one dataset writer active. Checkpoint files and logs are operational aids; the final dataset and reports are the review artifacts.

A stopped or failed process must not be represented as a completed 500-case run. Inspect the final verification JSON and array sizes, not just the existence of parameters.csv.
## Completed dataset storage verification

The final 500-row parameter and result CSVs, array shapes, train/test counts, finite values, power balance and all 500 LHS strata in every dimension were independently checked by `scripts/verify_dataset.py`.

The immutable training source is `data/samples.npz` (Float32 field). The compressed `data/samples-float16.npz` has the same schema and preserves scalar/parameter precision while storing only `field_K_per_W` as Float16. Its archive size is 3,242,615 bytes. Float16 quantization alone has maximum valid-cell relative error **0.0487924%**, mean per-sample relative L2 error **0.0207019%**, and maximum per-sample relative L2 error **0.0240841%**. These storage errors are separate from FEM discretization error and surrogate prediction error. Raw values and checksums are in `reports/data-verification.json`.

The original training archive SHA-256 is `cc8aab1ec1e4c473c0944617f3de40da3305e4b2fd186c4b2e61926a0c2a56a4`.

## Reproducibility environment status

The native Windows/Python 3.12.10 workflow was actually run through the full 500 FEM cases. Primary and transitive Python packages are pinned in `requirements-lock.txt`. The Dockerfile pins the official Python 3.12.10 slim Bookworm multi-architecture manifest at `sha256:fd95fa221297a88e1cf49c55ec1828edd7c5a428187e67b5d1805692d11588db`, verified against the official registry on 2026-10-14.

A Docker build was attempted but could not start because the local Docker Desktop Linux daemon was unavailable. **The container build and container execution are not verified here.** This limitation does not change the recorded native FEM results. `scripts/reproduce.py` provides the complete solver → data verification/Float16 export → training sequence, with an optional Node TypeScript check. It exits with failure if the generated surrogate acceptance flags do not pass; see README for commands.