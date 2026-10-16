# Thermal stack analytic model

## Scope and source

This is the P3 analytic placeholder specified by the user. Its governing resistance equations and material preset values come from the task, not an imported FEM model or external solver. This document describes the analytical comparison mode. The separate FEM option now loads the P2-trained surrogate and its POD field through fem-adapter.ts; see P3-IMPLEMENTATION.md and reports/surrogate-validation.json. The implementation does not claim validated design temperatures.

The seven square layers, from top to bottom, are chip, upper solder, upper copper, ceramic, lower copper, lower solder and cooler. Their physical side lengths are 5, 5, 10, 12, 10, 10 and 30 mm. The chip is fixed at 0.18 mm and 370 W/(m·K). Every remaining input, bound, default, control step and preset is defined in `parameters.ts`.

## Equations and units

Input thickness and width are in mm, but all resistance calculations convert to metres. Conductivity k is in W/(m·K), h in W/(m²·K), power P in W and temperatures in °C. Temperature differences in °C equal differences in K.

Start with effective square side a1 = 5 mm. For each layer through the lower solder:

- a2 = min(a1 + 2t, physical layer width)
- Rlayer = t / (k a1 a2), with t, a1 and a2 in metres
- pass a2 to the next layer as a1

For the cooler, As is the square exit footprint of the lower solder and Ap is the full 30 × 30 mm plate:

- a = sqrt(As / π), b = sqrt(Ap / π)
- ε = a/b, τ = t/b, Bi = hb/k
- λ = π + 1/(sqrt(π) ε)
- φ = [tanh(λτ) + λ/Bi] / [1 + (λ/Bi) tanh(λτ)]
- Rspreading = (1 − ε)^1.5 φ / (sqrt(π) k a)
- Rthrough = t / (k π b²)
- Rcooler = Rspreading + Rthrough
- Rconv = 1 / (h π b²)
- Rtotal = sum(Rlayer, including Rcooler) + Rconv
- Tsource = Tcool + P Rtotal

All of P flows through the network. The cooler bottom node is Tcool + P Rconv; each upward layer adds P Rlayer. Thus neighboring layer interface temperatures match. Interface coordinates use physical millimetres, with z = 0 at the cooler bottom and positive z toward the chip.

The parameters are validated, never silently clamped. Missing, nonnumeric, nonfinite and out-of-range inputs fail explicitly. Thickness changes can improve spreading while increasing the one-dimensional path; no universal monotonic relation with thickness is asserted.

## Default calculation checked independently

At the specified defaults (100 W, 65 °C coolant):

| Quantity                                |              Result |
| --------------------------------------- | ------------------: |
| Effective lower-solder exit side        |             7.04 mm |
| Chip through lower-solder sum           |  0.218509591292 K/W |
| Cooler spreading plus through-thickness |  0.313058237430 K/W |
| Convection                              |  0.074074074074 K/W |
| Total resistance                        |  0.605641902796 K/W |
| Source-node temperature                 | 125.564190279599 °C |

The requested rounded values **0.606 K/W and 125.6 °C** are reproduced without a correction factor.

`evaluate().tjMax` and `evaluate().tjAvg` both report this same source-node value. The supplied resistor model does not resolve a separate junction maximum and area average. They must not be presented as two independently calculated statistics or derived from the illustrative field.

## Synthetic field: explicit visualization boundary

The optional 128 × 64 field is an **illustrative x–z cross-section**, not an FEM result. The centreline temperature is linearly interpolated between a layer's two network nodes. For visual separation of the centre and edge, the user-requested Chebyshev profile is applied:

- d = max(|x|, |y|), in mm
- Tv = Tbottom + zNorm × (Ttop − Tbottom), where zNorm is 0 at the layer bottom and 1 at the top
- Tillustrative = Tcool + (Tv − Tcool) × [1 − 0.25 × min(1, d/15)]

The coefficient **0.25 is an arbitrary visualization parameter**, not a calibrated material property or heat-transfer correlation. The common 15 mm reference radius retains continuity at shared layer interfaces at the same x/y coordinate. This lateral profile does not modify the resistance network, its node values, or `tjMax`/`tjAvg`.

`tempAt(layer, zNorm, chebyshevDistanceMm, coolantTemp)` supplies the common value used by renderers and field export. `illustrativeTemperature(layer, zNorm, absXmm, absYmm, coolantTemp)` computes the Chebyshev distance for the caller. Points outside the physical square layer footprint return null. `verticalTemperature()` exposes the unmodified centreline interpolation.

Field values are Celsius at **cell centres**, row-major, with row zero nearest the bottom. `xMinMm/xMaxMm/zMinMm/zMaxMm` describe physical bounds, not display exaggeration. `mask=1` marks geometry and `mask=0` marks empty space. Empty values are filled with Tcool solely to remain finite and must not be drawn as material. The 64-row raster may not visibly resolve very thin layers; the layer geometry and temperature interfaces are the authoritative render contract.

## Limits

No contact resistance, radiation, nonlinear material properties, fluid-flow solution, stress calculation, transient response, numerical mesh or solver convergence is represented. Material pills are illustrative constant-conductivity choices supplied in the task. Their conductivity values should not be treated as procurement specifications or validated temperature-dependent properties.

The analytic approximation, arbitrary lateral visualization and unresolved peak/average must remain labeled in the UI and any exported image or data. Future FEM integration should replace the analytic evaluator/field through the same public interface, with its own units, coordinates, provenance and validation documented.

## Delivered FEM option

The shipped scalar model is trained on 400 actual FEM cases from a 500-case Latin hypercube. Final model selection uses three-fold cross-validation within those 400. The final 100-case evaluation gives mean/max relative Rjmax error 0.5490% / 2.6801% and Rjavg error 0.4566% / 2.4177%. The same holdout had already been inspected during earlier development; it is not a fresh blind test. No holdout labels were used for fitting or final CV selection.

The exported model uses an additive Gaussian-process correction to a smooth simple one-dimensional resistance baseline. This baseline differs from the user-specified 45-degree analytical comparison mode above. Eight POD modes retain 99.9288% of centred peak-normalized training-field variation. Field values returned by the browser are Celsius, with explicit nonuniform z coordinates and a material mask.

The scalar JSON is 216,323 bytes; scalar plus field metadata and float16 basis total 509,168 bytes. The included inference module is dependency-free. Full solver, fixed FEM data and reproduction scripts are in the separate P2 delivery. Source code license is included beside fem/evaluator.ts.
