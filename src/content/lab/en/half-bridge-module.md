---
lang: en
translationKey: half-bridge-module
title: SiC half-bridge power module
kind: teardown
summary: Laminated busbars and gate bond wires; two four-die switch groups with linked assembly, topology and inductance views.
basis: Parametric schematic model with simplified geometry.
status: Interactive model
order: 1
---

## Model scope

Each switch uses four parallel SiC MOSFET dies, eight in total. Body diodes belong to the MOSFETs; no separate diode dies are added. The DC-link capacitor is external.

## Commutation and inductance

The illustrated transient represents SH turn-on and SL body-diode reverse recovery, not sustained simultaneous switch conduction. The parallel-plate estimate compares busbar geometry trends and excludes fringing, terminals and internal die inductance.
