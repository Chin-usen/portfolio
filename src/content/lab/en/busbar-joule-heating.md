---
lang: 'en'
translationKey: 'busbar-joule-heating'
title: 'Busbar Joule heating'
kind: 'simulation'
summary: 'DC Joule heating in the L1 half-bridge P layer, AC link and N layer: explore current, conductor size, material and convection.'
basis: 'FEM-trained surrogate; electric potential and steady conduction coupled sequentially, constant properties.'
status: 'FEM surrogate and 3D field connected; analytical checks and independent test'
order: 7
parts:
  - id: 'p-layer'
    name: 'P layer'
    secondaryName: 'P 层'
    short: 'P'
    role: 'Distributes current from the DC+ terminal to the high-side substrate drain copper.'
    features: 'Laminated with the N layer across an insulation film to form a low-inductance busbar; soldered to substrate 1 through a feed foot and post.'
    material: 'Oxygen-free or electrolytic copper sheet, nickel or tin plated'
    order: 0
  - id: 'ac-link'
    name: 'AC link'
    secondaryName: 'AC 连接片'
    short: 'AC'
    role: 'Joins the high-side sources, the low-side drain and the AC terminal to form the half-bridge midpoint.'
    features: 'A collector bar rests on the four high-side source clips and a narrow bridge strap reaches the substrate 2 drain copper; it carries load current in both switching states.'
    material: 'Stamped copper strip or copper alloy, nickel plated'
    order: 1
  - id: 'n-layer'
    name: 'N layer'
    secondaryName: 'N 层'
    short: 'N'
    role: 'Collects the low-side source current and returns it to the DC− terminal.'
    features: 'Its collector bar rises around the P-layer edge through a riser strap to the upper laminated plate.'
    material: 'Oxygen-free or electrolytic copper sheet, nickel or tin plated'
    order: 2
---
