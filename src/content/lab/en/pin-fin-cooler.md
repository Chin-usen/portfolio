---
lang: 'en'
translationKey: 'pin-fin-cooler'
title: 'Pin-fin cold plate'
kind: 'simulation'
summary: 'Estimate thermal resistance and pressure drop of a pin-fin cold plate with tube-bank correlations, and sweep the trade-off.'
basis: 'Zukauskas heat transfer, Gaddis–Gnielinski pressure drop and uniform pin-fin efficiency; not CFD.'
status: 'Empirical correlations · live validity checks'
order: 6
parts:
  - id: 'base-plate'
    name: 'Base plate'
    secondaryName: '底板'
    short: 'Base'
    role: 'Receives heat from the device and rejects it to the coolant through the pin roots and the uncovered base area.'
    features: 'Thermal resistance starts at the base top surface (pin roots); base conduction and spreading are not included.'
    material: 'Oxygen-free copper or aluminium alloy'
    order: 0
  - id: 'pin-array'
    name: 'Pin-fin array'
    secondaryName: '针翅阵列'
    short: 'Pins'
    role: 'Extends the wetted area and disturbs the flow to raise the heat-transfer coefficient.'
    features: 'Cylindrical pins, in-line or staggered; efficiency of a uniform pin with an adiabatic tip.'
    material: 'Same as the base; brazed, skived or additively manufactured'
    order: 1
  - id: 'cover'
    name: 'Cover and side walls'
    secondaryName: '盖板与侧壁'
    short: 'Cover'
    role: 'Closes the channel so that the coolant passes between the pins.'
    features: 'Assumed to touch the pin tips with no bypass; cover and side walls are treated as adiabatic.'
    material: 'Aluminium alloy, copper or engineering plastic'
    order: 2
  - id: 'inlet-manifold'
    name: 'Inlet manifold'
    secondaryName: '入口集流腔'
    short: 'Inlet'
    role: 'Distributes the incoming flow across the width of the pin array.'
    features: 'Uniform distribution is assumed; manifold and fitting losses are not included.'
    material: 'Aluminium alloy or engineering plastic'
    order: 3
  - id: 'outlet-manifold'
    name: 'Outlet manifold'
    secondaryName: '出口集流腔'
    short: 'Outlet'
    role: 'Collects the coolant leaving the array and leads it to the outlet fitting.'
    features: 'Outlet temperature follows from the energy balance; local losses are not included.'
    material: 'Aluminium alloy or engineering plastic'
    order: 4
---

Original generic parametric schematic. Cold-plate geometry, materials and the default operating point are placeholder teaching values and do not represent any vendor product. Results are correlation estimates, not a substitute for testing or CFD.
