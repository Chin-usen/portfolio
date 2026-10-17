# Main v5 - 1.4.0 release guide

## Scope and current status

This local release continues main v4 commit `f911b27c344a5b58d62d052c1a3378df8a082757`. The delivery manifest identifies the final source commit; the separate evidence tree binds validation logs and measured assets to that source. No source has been pushed or deployed.

L1 is a **parametric schematic model with simplified geometry**. It illustrates a generic half bridge, not a vendor product or a qualified manufacturing design. The Chinese interface states: 参数化示意模型，几何经简化。 All personal, career and case content remains fictional placeholder content.

The routes are `/lab/half-bridge-module/` and `/en/lab/half-bridge-module/`. Home links to L1 and the Lab index contains its active entry. The former sample-teardown route has been replaced. The rest of the bilingual Home, Work, Lab and About structure follows v4.

## Model generation and engineering boundary

`model/l1-half-bridge/` contains the TypeScript generator and one parameter file. Node scripts generate independently named Three.js meshes, export glTF, apply meshopt compression and render the exploded WebP with a headless browser. The scene and image come from the same parameterized geometry. Generated assets are checked into `public/models/l1/` and `public/images/l1/`; the model manifest records content hashes and geometry provenance.

```sh
pnpm model:l1
pnpm model:l1:verify
```

The release checks require reproducible geometry, matching emitted hashes, preserved node names/metadata and a compressed model payload of at most 1,500,000 bytes. The actual image must decode and contain visible model pixels. The delivered scene has 83 independently named mesh nodes and 10,012 triangles. Its compressed GLB is 87,484 bytes; the 32,589-byte manifest brings the model payload to 120,073 bytes. The 1600x1400 transparent WebP is 99,344 bytes; its same-geometry 640x560 responsive variant is 44,986 bytes. Browser srcset selection avoids downloading the large image at the standard mobile measurement viewport. Geometry and compressed GLB regeneration were byte-identical; the two raster runs matched in the recorded browser environment, without a cross-platform raster guarantee. Exact hashes and reproducibility results are in the accompanying `model-js/` evidence.

Each arm has four parallel SiC MOSFET dies and their intrinsic body diodes. Main current connections are solid copper conductors. Aluminum bonding wires carry gate or Kelvin sensing signals. The electrical path is DC+ to P laminate, upper-arm drain, upper-arm source, AC node, lower-arm drain, lower-arm source, N laminate and DC-. The lower-arm drain island is part of AC; the upper-arm drain island is part of P. The four vertical signal pins are G and Kelvin S for each arm. The DC-link capacitor is external to the illustrated module.

Simplified dimensions, contacts and separation checks make the educational geometry internally consistent; they do not establish manufacturing tolerances, dielectric withstand, switching safety or thermal qualification. The transient animation illustrates upper-arm turn-on and the lower-arm body diode's reverse-recovery current. It does not depict sustained simultaneous turn-on of both transistors.

The calculator uses `L = mu0 * l * d / w`, converting millimeter inputs to SI and output to nanohenries. Defaults d=0.5 mm, w=40 mm and l=100 mm give approximately 1.57 nH. Fringing, terminals and chip-internal inductance are excluded. Displayed P/N separation is exaggerated fourfold and labeled; w and l change the analytical comparison only. The schematic N-source collector stretches vertically about its lower contact plane as d changes, keeping all four lower-arm clips connected while its upper end follows the N plate. This also stretches its shelf thickness; it is an explanatory deformation, not a manufacturable adjustment.

## Interaction and fallback

Three presentations share the same part selection: assembly, exploded and commutation. Model picking, visible part tags and SVG topology update the selected-part details together. Orbit, zoom and reset are supported, with keyboard alternatives. Exploded movement lasts 480 ms; reduced motion uses immediate state changes and the static rendered view.

Low-resource or reduced-motion devices use the exploded WebP with the same textual part information, topology and inductance controls. The static image remains exploded when modes change; mode-specific circuit explanations remain available. The interactive renderer is loaded only when needed. Navigation releases rendering resources, listeners, observers and pending animation work. The ten-round-trip browser evidence measures actual native context disposal and bounded diagnostic values; it is not a complete heap census or a guarantee for every graphics driver.

Home's tall-mobile composition uses more of the available height. Footer links and mobile menu contact separators have balanced spacing. Enlarged text may reflow and scroll rather than clip. The exact standard viewport checks remain 1440x900, 1280x720 and 390x844 in both languages and themes.

## Run and verify

Use Node 22.23.3 and pnpm 12.11.2:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm build
pnpm security:scan
pnpm lhci
```

Use an HTTP preview, not file URLs. Browser artifacts are directed outside source by `PLAYWRIGHT_OUTPUT_DIR`, `PLAYWRIGHT_HTML_REPORT` and `V5_REPORT_DIR`. The browser suite requires actual generated assets; mocks do not replace model acceptance.

Final mobile Lighthouse validation uses three fresh samples on each of 20 content routes: Performance at least 90, Accessibility and SEO at least 95. Both L1 routes require LCP below 2.5 seconds. The existing stricter S1 Performance 95 and LCP below 2.5 seconds remain. Original raw reports, failures, final assertions, source/build bindings and measurement dates are retained in external evidence. The initial Chinese L1 measurement exceeded the LCP gate at 3.31 seconds; adding preloads alone did not resolve it. Those measurements remain separate from acceptance. Chinese L1 now selects four route-specific original-font subsets totaling 82,980 bytes instead of the broad 207,004-byte Chinese font set requested by that diagnostic. All original outlines, metrics and genuine weights are preserved; English retains its existing family stack. The font-only correction still measured 2.562 seconds; the smaller responsive prerender then measured 2.257 seconds in Chinese and 1.955 seconds in English in six fixed diagnostic samples. These pilots are retained separately and are never imported into the final set. The final full collection on 2026-10-16 passed all 66 assertions across 60 fresh measurements on 20 routes. Minimum route medians were Performance 94, Accessibility 100 and SEO 100. Chinese/English L1 LCP medians were 2256.863/1955.714 ms; S1 medians were 2120.340/1808.247 ms with Performance 99 in both locales. No pilot samples were imported, no score-based reruns were performed, and exact runtime/build hashes remained unchanged.

## Reusable lab base

The requested follow-on page batch uses this 1.4.0 commit as its base. L1's disassembly shell, stage, part tags, selected-part card, static policy and controller are reusable; domain-specific topology, inductance and commutation remain local. S1 exposes shared simulation shell/card boundaries. Shared viewer lifetime ownership supports idempotent disposal, late async completion and owned resources without changing the model equations.

Page-local `Page.astro` and `page.json` descriptors are discovered at build time. New bilingual Content Collection parts, asset hooks, font policy, tests and Lighthouse routes can be added inside a page's own directory without shared list/routing edits. The contract is documented in `src/components/lab/_shared/README.md`. The derived global font CSS is regenerated by dev/build/typecheck and excluded from independent patches. Existing source font assets and licenses remain checked in.

The six follow-on page implementations are separate tasks and are not represented as delivered in this base archive. Their patches must target this release's final commit and be independently applicable in any order.

## Review, immutable files and delivery

Impeccable audit and critique are pinned to `2f98774f86bc05563876643db37e6c37c322850f`. Before/after reports disclose independent assessment identities, screenshot provenance, detector limitations and bounded correction confirmation. Only audit and critique workflows were used. New review output is external evidence and is not committed. The final template assessment records design health 29/40 and technical audit health 17/20, with no observed P0/P1 issue in the bounded review. Four P2 recommendations remain: grouping mobile part choices and bringing feedback closer, keeping enlarged English mode words whole, direct numeric entry beside sliders, and navigation text that follows root sizing. Batched projected-label layout reads are a P3 recommendation. These refinements are disclosed rather than represented as completed. The detector returned no findings across 11 explicit Astro targets. Original before/after reports remain unchanged; the final template review has separate source bindings. A system wake interrupted both original review streams after native inspection, so their artifact-writing continuations disclose which observations were inherited and which source checks they performed. The original A total was locked before detector exposure; individual heuristic subscores were reconstructed transparently. Native screenshot persistence and mutable overlay injection were unavailable. The 52 saved final images are supplemental repository Playwright captures; 200% root text scaling is not browser zoom, and no S1 mobile visual coverage or physical-device test is claimed.

Final source checks include 99 unit tests, 118 browser tests, a 24-page build, type checking, lint, model verification and sensitive-information scanning. The custom BLOCKED_KEYWORDS policy was not configured; the built-in phone/date rules and Gitleaks scans were executed. Source scans and the separate exact-archive credential scan have distinct scopes.

The 14 design documents, 67 P2 files and historical tracked reports retain their v4 baseline bytes. Historical documents describe their own releases; current behavior and scope are specified here. P2 remains independently versioned 2.0.0.

The completed delivery contains `portfolio-main-v5/` source and a separate `v5-evidence/` root. Each numbered part and `00-START-HERE.zip` is at most 1,000,000 bytes. The starter manifest records every part SHA-256 and the full archive hash. Both actual restoration scripts must reconstruct and verify the emitted archive before attachment delivery. The manifest and `ci/integrity.json` bind the final source and check evidence.

## Open-source dependencies

Existing Three.js 0.186.1 (MIT) supplies geometry, GLTFExporter, GLTFLoader, OrbitControls and the bundled meshopt decoder. Existing Playwright 1.64.0 (Apache-2.0) renders the real browser scene and captures the image. These tools are reused; no native modeling library is needed for L1.

| New development dependency | Exact version | Purpose                                | License |
| -------------------------- | ------------- | -------------------------------------- | ------- |
| @gltf-transform/core       | 4.2.1         | Read and write the exported glTF scene | MIT     |
| @gltf-transform/extensions | 4.2.1         | Preserve and encode meshopt metadata   | MIT     |
| @gltf-transform/functions  | 4.2.1         | Optimize mesh buffers and scene output | MIT     |
| meshoptimizer              | 0.23.0        | Compress mesh geometry                 | MIT     |

The new dependencies are generation tools, not external runtime services. Exact installed metadata is recorded in `DEPENDENCIES.md` and the external dependency inventory. Fonts retain their original OFL-1.1 notices; optional FontTools/Brotli tooling is unchanged. Node/browser assets are served locally without third-party font or analytics requests.

## Engineering references

The switching explanation follows Infineon's [CoolSiC MOSFET 1200 V application note](https://www.infineon.com/dgdl/Infineon-CoolSiC_MOSFET_1200V-SiC_trench_power_device-ApplicationNotes-v01_01-EN.pdf?fileId=5546d462617643590161c27fbcda0aae) and its [technology explanation](https://www.infineon.com/technology/coolsic-technology-details). These sources support the device behavior, not qualification of this generic geometry. Scene export uses the documented [Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html).
