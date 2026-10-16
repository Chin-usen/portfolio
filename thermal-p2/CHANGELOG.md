# Changelog

## 2.0.0 — 2026-10-14

- Preserve the completed 500-sample FEM dataset, train/test partition, final scalar model, POD assets and original 24 tests byte for byte.
- Add six Vitest tests covering load/coolant affine invariance across all 100 holdout parameters, all seven layers, zero load, invalid inputs and 6,553,600 field values with explicit Float32 rounding tolerances.
- Add `pnpm verify:linearity` and its machine-readable report.
- Add `scripts/audit_v2.py`: trace fixtures/prediction CSV back to raw FEM data, verify training-only CV IDs and directly solve 15 fresh FEM boundary-load scenarios.
- Add material parameter table and self-contained `V2-VALIDATION.md`; retain the reused-holdout limitation prominently.
- Re-run strict TypeScript, all 30 tests and native validation. No model retraining or fitted prediction changes.

## 1.0.0 — 2026-10-14

- Seven-layer Q1 hexahedral FEM, 500 seeded Latin-hypercube samples, train-only model selection, independent peak/average scalar surrogate, eight-mode POD field and dependency-free TypeScript evaluator.
- Original FEM convergence, error distributions, model history, reproducibility and validation reports are retained.