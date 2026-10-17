# L1 half-bridge model

参数化示意模型，几何经简化。This educational model is generated from TypeScript and Three.js, with one dimension file: `params.json`. It illustrates package construction and circuit connections, rather than a qualified manufactured device.

## Rebuild

Use the pinned Node and pnpm versions from the repository, then:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm model:l1
pnpm model:l1:verify
```

`CHROME_PATH` may select an already installed compatible Chromium. `pnpm model:l1 -- --evidence <directory>` is not needed; use `pnpm model:l1 --evidence <directory>` to write validation JSON and actual exploded/assembled PNG render evidence outside source control.

The generation command creates the geometry twice, validates nominal routing, exports and decodes both compressed GLBs, requires identical geometry and GLB hashes, and renders the actual compressed model to a transparent 1600 × 1400 WebP. The full-size WebP is encoded by Chromium from the rendered canvas; a 640 × 560 responsive WebP is a high-quality browser canvas downsample of that same render. Both sizes are decoded to verify dimensions and visible pixels. Two renders of each size in that browser session must agree; pixels may vary with a different browser, GPU, or operating system. The verification command rebuilds geometry twice, checks identical GLB bytes against the checked-in artifact, and checks both existing WebP assets against the manifest without imposing cross-platform raster equality.

Checked-in artifacts:

- `public/models/l1/half-bridge.glb`: independent named mesh nodes, Meshopt compression.
- `public/models/l1/model-manifest.json`: dimensions, part mapping, circuit metadata, source/asset hashes, units, ranges and evidence boundaries.
- `public/images/l1/half-bridge-exploded.webp`: 1600 × 1400 image generated from that GLB.
- `public/images/l1/half-bridge-exploded-640.webp`: 640 × 560 responsive image from the same rendered canvas; selected with `srcset` and stage-width `sizes`.

No timestamp, random identifier, or host-specific path enters the generated model or manifest. The generator uses only Node, Three.js, glTF Transform, meshoptimizer and Playwright. Versions and licenses are recorded in `RELEASE-v5.md` and the repository lockfile.

## Geometry and electrical scope

The base is 120 × 62 × 3 mm, with four actual open mounting holes. Two AMB stacks each include bottom copper, Si3N4 ceramic, a separated drain island and gate/Kelvin traces. Each arm has four 4 × 5 mm SiC dies, separate source/gate pads, 0.3 mm aluminum gate and Kelvin signal wires, and two vertical signal pins. Eight solid metal clips carry power; there are no main-current bond wires or separate diode chips. Each MOSFET metadata entry identifies its integrated body diode.

P connects DC+ to the upper-arm drain island. The independent AC strap joins all four upper-arm source clips to the lower-arm drain island and AC terminal. N joins the four lower-arm source clips to DC−. The N riser passes outside the P plate and dielectric edge. DC+/DC− folded, bored terminals are on the same end; the AC bored terminal is opposite. A translucent PPS frame includes real corner holes and terminal slots.

Source dimensions use millimetres with Z up. The exported model uses metres with Y up, through the proper rotation `(x,y,z) → (x,z,−y)/1000`. Each named mesh exposes `partId`, `circuitNode`, `explodeZmm` and, where relevant, `gapMotion`/`gapScale`. The exact `busbar-p` and `busbar-n` nodes identify the opposed plates.

Validation checks finite triangle geometry, nonzero areas, part counts, nominal rectangular-conductor contacts, sampled signal-wire envelopes, unlike-net conflicts and conductor connectivity. CPU ray tests confirm that mounting and terminal holes are open and adjacent metal is present. Invalid parameter fixtures and rebuilt 0.1/2 mm gap endpoints are checked. These checks do not establish insulation rating, manufacturing tolerances, exhaustive triangle intersections, thermal performance or a qualified electrical design. Semiconductor drain/source conduction is a circuit relationship, not a permanent metallic short.

The web page's spacing slider deliberately exaggerates separation fourfold; its display is an educational transformation of the nominal assembly. Width and length controls affect the parallel-plate trend calculation. They do not rebuild a qualified package layout.

## Source license

The authored model and scripts are provided under the MIT license in this folder. Third-party tools keep their own licenses.
