# P1-P3 portfolio v2 - 1.1.0

This source release combines the P1 bilingual portfolio, the P3 S1 thermal visualization and the complete P2 computation project. The separate `experiment/bold` source is a comparison deliverable and is not merged into main. All portfolio identities and contact details remain fictional Sample Engineer / example.com placeholders.

Status: all local functional, type, build, security and mobile Lighthouse gates passed. Final mobile Lighthouse passed all 18 routes / 54 measurements: route Performance medians 90-100; Accessibility and SEO were 100 in all 54 runs. Original median thresholds are unchanged. Hosted GitHub Actions was not run; see the release limitations.

## Verified local checks

| Check                               | Result                                                                                                     | Evidence                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Lint and formatting                 | Passed                                                                                                     | `reports/v2/ci/local-checks.json` and `lint.log`                |
| Astro / strict TypeScript           | 73 files; 0 errors, warnings or hints                                                                      | `reports/v2/ci/typecheck.log`                                   |
| Frontend unit tests                 | 48 / 48 passed                                                                                             | `reports/v2/ci/unit.log`                                        |
| Chromium browser tests              | 45 / 45 passed                                                                                             | `reports/v2/ci/browser.log`                                     |
| Production build                    | 20 static pages                                                                                            | `reports/v2/ci/build.log`                                       |
| Personal-data patterns and Gitleaks | Passed for the executed scopes                                                                             | `reports/v2/ci/privacy.log`, `gitleaks.log`                     |
| Independent P2 computation checks   | 30 / 30 unit tests, strict types, evaluator verification, load linearity, FEM audit and mesh export passed | `reports/v2/ci/p2-local-checks.json`                            |
| Independent design review           | 25 / 40 before; 32 / 40 after                                                                              | `reports/v2/before/critique.md`, `reports/v2/after/critique.md` |
| Independent technical audit         | 12 / 20 before; 18 / 20 after                                                                              | `reports/v2/before/audit.md`, `reports/v2/after/audit.md`       |

The browser suite includes the 48 route/locale/viewport/theme review states, keyboard interaction, warning states, mobile targets, 200% root-font enlargement, rendering fallback and header font-loading regressions. Review scores are judgment scales, not automated accessibility certificates or model-accuracy scores. All reproduced high/medium UI findings are closed within the documented review scope; low-priority opportunities and scientific boundaries remain explicit in [FIXES](reports/v2/FIXES.md).

## Mobile Lighthouse - passed

The release gate measures 18 routes three times each using mobile Lighthouse. Required route medians are Performance >= 90, Accessibility >= 95 and SEO >= 95. The completed run started at 2026-10-15T00:46:37.561747+00:00 and finished at 2026-10-15T00:56:28.655585+00:00. `reports/v2/lighthouse/summary.json` records every run score, timestamp and raw-report hash; the archive also includes 18 representative median-performance raw reports. Each category uses its own three-run median.

The first collection exposed a font-induced English mobile header shift and is retained under `reports/v2/lighthouse/attempt-1/`. The correction reserves the existing language-selector row before web fonts load. A controlled hold/release check on all eight affected English non-S1 routes records main content at 145 px and the language selector at 80 px both before and after font loading: zero measured movement, with no horizontal document overflow. This geometry evidence is in `reports/v2/ci/header-font-stability.json`; the final independent Lighthouse collection also passes after this correction.

Final mobile Lighthouse passed all 18 routes / 54 measurements: route Performance medians 90-100; Accessibility and SEO were 100 in all 54 runs. Original median thresholds are unchanged.

| Route                                | Performance median | Accessibility median | SEO median |
| ------------------------------------ | -----------------: | -------------------: | ---------: |
| `/`                                  |                100 |                  100 |        100 |
| `/about/`                            |                 90 |                  100 |        100 |
| `/contact/`                          |                100 |                  100 |        100 |
| `/en/`                               |                100 |                  100 |        100 |
| `/en/about/`                         |                100 |                  100 |        100 |
| `/en/contact/`                       |                100 |                  100 |        100 |
| `/en/lab/`                           |                100 |                  100 |        100 |
| `/en/lab/chip-junction-temperature/` |                 98 |                  100 |        100 |
| `/en/lab/sample-simulation/`         |                 99 |                  100 |        100 |
| `/en/lab/sample-teardown/`           |                 99 |                  100 |        100 |
| `/en/work/`                          |                100 |                  100 |        100 |
| `/en/work/sample-case/`              |                 98 |                  100 |        100 |
| `/lab/`                              |                100 |                  100 |        100 |
| `/lab/chip-junction-temperature/`    |                 98 |                  100 |        100 |
| `/lab/sample-simulation/`            |                 99 |                  100 |        100 |
| `/lab/sample-teardown/`              |                100 |                  100 |        100 |
| `/work/`                             |                100 |                  100 |        100 |
| `/work/sample-case/`                 |                100 |                  100 |        100 |

## Package contents and reproduction

- `src/` and `public/`: complete bilingual P1/P3 source, content and browser model assets; Node 22.23.3 and pnpm 12.11.2 are pinned.
- `thermal-p2/`: independently versioned computation project 2.0.0, with Python 3.12.10, locked dependencies, solver/training/export source, raw data, meshes, model assets and TypeScript evaluator.
- `reports/v2/before/` and `reports/v2/after/`: raw audit and independent A/B assessments, combined critiques, screenshots and evidence manifests.
- `reports/v2/FIXES.md`, `reports/v2/PROVENANCE.md` and `CHANGELOG.md`: correction/deferred lists, source boundaries and SemVer change record.
- `reports/v2/ci/` and `reports/v2/lighthouse/`: local execution logs, measured results and historical failed evidence where relevant.

Run the frontend from this repository root:

```sh
npm install --global pnpm@12.11.2
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:scan
pnpm lhci
```

Lighthouse needs Chrome/Chromium; set `CHROME_PATH` when discovery is unavailable. Install Gitleaks 8.30.1, set `GITLEAKS_BIN` if needed, and run `node scripts/run-gitleaks.mjs` for the independent secret scan. These commands write local reports; they do not deploy the site.

Run the separate P2 checks from `thermal-p2/`, using a Python environment with the pinned dependencies:

```sh
pnpm install --frozen-lockfile
python -m pip install -r requirements-lock.txt
pnpm typecheck
pnpm test
pnpm verify
pnpm verify:linearity
python scripts/audit_v2.py
python scripts/export_mesh.py
```

The full solve/train/export procedure is documented in the P2 README and `scripts/reproduce.py`. Verifying the delivered data and model does not require retraining or replacing the original 500 FEM samples.

## Impeccable and preserved design authority

Impeccable is pinned to [commit 2f98774f86bc05563876643db37e6c37c322850f](https://github.com/pbakaus/impeccable/tree/2f98774f86bc05563876643db37e6c37c322850f). Main uses only the /audit and /critique playbooks, with scoped manual corrections. The deterministic detector is one evidence input; its output does not generate the written design/technical scores. The development-only installation, generated PRODUCT/DESIGN context, agent configuration and hooks are excluded from product source. [PROVENANCE](reports/v2/PROVENANCE.md) records the exact method and retained evidence gaps.

The requested `docs/DESIGN.md` and `docs/PRD` were not supplied. No replacement specifications were invented. The explicit D1 brief and incumbent implementation govern the changes: existing color-token files, Geist / Noto Sans SC / Geist Mono families, routes, engineering content and numerical models are preserved. The generated font CSS selects coverage from original licensed font assets without modifying glyph files. Preservation checks are in `reports/v2/preserved-source.json`.

## P2 numerical evidence and limits

The dataset contains 500 real FEM samples, with 400 training and 100 reused holdout cases. Recomputed holdout errors in thermal resistance are:

| Output                               | Mean absolute relative error | Maximum absolute relative error |
| ------------------------------------ | ---------------------------- | ------------------------------- |
| Peak junction resistance, Rjmax      | 0.549001%                    | 2.680149%                       |
| Area-mean junction resistance, Rjavg | 0.456551%                    | 2.417713%                       |

These 100 cases were inspected during earlier model development: this is reused validation, not a fresh blind test. Training-only cross-validation maximum errors remain 8.5695% and 8.5118%. The holdout result does not guarantee less than 3% error across the full parameter domain, and it is not experimental validation.

For fixed geometry, conductivity and convection coefficient h, the model equations give `T(P, T_cool) = T_cool + (P / 100) * T(100, 0)`, with P in watts. This affine relation is exact for the stated constant-property equations, while numerical outputs retain floating-point rounding. The TypeScript check covers 100 parameter cases, eight loads each and 6,553,600 field-value comparisons: resistance changes are zero, maximum scalar/interface affine deviation is 1.13687e-13 C, and maximum Float32 field deviation is 4.57764e-5 C. At zero power, every reported temperature equals T_cool exactly. Fifteen independent FEM load solves give a maximum nodal affine deviation of approximately 3.68345e-11 C and maximum relative algebraic residual of approximately 1.62847e-12. Full precision and test conditions are retained in `thermal-p2/reports/v2-audit.json` and `linearity-v2.json`.

`thermal-p2/data/mesh-l3-quarter.npz` contains 24,897 nodes and 21,648 Q1 hexahedra, physical default coordinates in millimetres, connectivity, material layers, boundary-node sets and layer/eta coordinates for reconstructing each sample's z coordinates. All nodes are referenced, all element volumes are positive, and total default quarter-domain volume is 705.645 mm^3. Both original Float32 and Float16 datasets, CSVs, material tables, POD model assets and solver/training/export source are retained. The reported field is the y=0 central slice of the 3D solution with layer-dependent physical z sampling; it is not a complete 3D volume or a uniform-z grid. Mobile evaluates the TypeScript surrogate or analytical model, not a FEM solve.

The FEM model assumes steady state, constant isotropic conductivity, ideal contacts, uniform heat input and a bottom Robin boundary. Temperature-dependent materials, radiation, coupled fluid flow and contact resistance are outside this model. Mesh convergence was checked at the specified midpoint parameters, not across the entire domain. See `thermal-p2/V2-VALIDATION.md` for the complete numerical boundary.

## Release limitations

- No hosted GitHub repository or deployment account was supplied. Workflow definitions and passing local checks are not proof of hosted GitHub Actions execution or deployment.
- No custom `BLOCKED_KEYWORDS` policy was configured. Built-in personal-data patterns and Gitleaks ran; project-specific forbidden words remain a separate configurable policy.
- Chromium captures and 200% root-font tests do not establish physical-device behavior, Safari/Firefox compatibility, screen-reader speech, complete accessibility conformance or field Web Vitals.
- The before detector's invocation metadata was not retained, and native read-only browser controls could not inject the detector overlay. The archive states these limitations rather than recreating evidence.
- The Docker daemon was unavailable. A reproducible container definition is included, but container build/run has not been verified.
- The separate bold experiment remains an optional comparison branch. Human design review and review of these engineering limitations remain part of acceptance.
