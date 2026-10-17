# Changelog

## 1.4.0 - 2026-10-16

### Added

- Replace the L1 sample teardown with a bilingual generic SiC half-bridge lesson: four parallel MOSFETs per arm, laminated P/N busbars, an AC interconnect, gate wires and independent Content Collection part descriptions.
- Build the parametric schematic model from TypeScript and one parameter file, with simplified geometry, independently named parts and the specified P/AC/N electrical connections. Repository Node scripts generate compressed glTF and the exploded WebP from the same source; generated assets and their hashes are checked in.
- Add assembled, exploded and transient commutation presentations, linked model/tag/topology selection, and a dimensionally explicit parallel-plate inductance calculator.
- Add regression coverage for actual picking, displayed busbar spacing, orbit/zoom/reset, formula boundaries, static preferences and ten client-route WebGL lifecycles.

- Extract reusable disassembly and simulation templates, page-local discovery/content/font contracts and resource ownership for independent follow-on page patches.
- Discover page-owned model verification hooks and mobile performance routes without central per-page edits.

### Fixed

- Enlarge and center the tall-mobile Home visual, equalize footer link spacing and balance menu contact separators while retaining enlarged-text reflow.
- Regenerate licensed Chinese font subsets for the current bilingual content, preserving original glyph outlines, metrics, weights and notices.
- Keep the lower-arm source collector in contact while exaggerating the displayed P/N layer gap; preserve the actual nominal model assets.
- Limit Chinese L1 font downloads to four route-specific original-font subsets after the initial LCP failure; preserve existing font files, glyph outlines, metrics, weights and the English family stack. Failed measurements and diagnostic collections remain separate from final acceptance.

- Select a smaller 640px prerender at mobile widths while preserving the original full-size WebP and GLB bytes; retain all fixed diagnostic samples.

### Validation status

Generated-asset reproducibility, 99 unit tests, 118 browser tests, the 24-page build and final source checks passed. All 60 fresh mobile Lighthouse measurements passed 66 assertions across 20 routes; Chinese/English L1 LCP medians were 2256.863/1955.714 ms. Independent final template reviews, original before/after reports, limitations and nonblocking recommendations are supplied in the separate v5 evidence tree. Its integrity and release manifests identify the exact tested source and results.

### Preserved

- Continue main v4 commit `f911b27c344a5b58d62d052c1a3378df8a082757`. Design documents, P2 and historical reports retain their baseline bytes. No push or deployment is performed.

## 1.3.0 - 2026-10-16

### Changed

- Follow N1 with independent bilingual Home, Work, Lab and About pages. Home contains only the viewport-height hero, responsive static WebP and footer; the metrics band and three explicitly placeholder case rows now live on Work.
- Replace the navigation with a 52 px sticky glass header, three active-parent segments and a native fullscreen mobile dialog with focus containment, Escape, scroll lock and focus return.
- Merge Contact into About at `#contact`; preserve localized legacy Contact routes as redirects.
- Use Astro ClientRouter transitions with a stationary header, reduced-motion support, destination-heading focus and normal browser history.
- Apply the explicitly requested token exception: dark page background changes from `#000` to `#0E0E10`; the Work metrics band remains `#000` with 1 px `rgba(255,255,255,.08)` top and bottom borders. Immutable `docs/` remain unchanged.
- Balance the S1 thermal legend, show the selected chip detail by default and load four route-scoped Chinese font subsets with original outlines, metrics and real weights.
- Dispose S1 rendering resources, event handlers and animation work on route departure; retain bounded value-only lifecycle diagnostics for the ten-round-trip regression. Guard delayed Three.js imports before allocating a context in the smaller demo.
- Regenerate the existing global Chinese subsets from current v4 content and preload already-used text fonts earlier. This addresses the Chinese Case C heading render delay found in the first full performance run; all original failed measurements remain in external evidence.

### Fixed

- Keep desktop Home within the exact viewport by including the footer border in its height; preserve enlarged-text reflow.
- Composite the existing dark WebP against an explicit isolated page-color backdrop so its black matte disappears without modifying image assets.
- Keep the focused skip link above the sticky header and provide a native mobile S1 jump to its parameter panel.

### Added

- Browser coverage for viewport fitting, active sections, native menu keyboard behavior, localized routes, transition focus/history and repeated S1 lifecycle cleanup.
- Mobile Lighthouse gates for every content route, including a stricter S1 Performance score of 95 and LCP below 2.5 seconds.
- External before/after Impeccable audit and critique evidence pinned to `2f98774f86bc05563876643db37e6c37c322850f`. New generated review and validation artifacts are delivered separately from tracked source.

### Preserved

- All 14 design documents and all 67 tracked P2 files retain their approved v3 bytes. Numerical models, P2 version 2.0.0 and the separate bold experiment remain unchanged.
- Career, identity and contact content remain explicit placeholders. No push or deployment is performed.

## 1.2.0 - 2026-10-15

### Changed

- Rebuild the bilingual Home composition from the supplied D1 desktop/mobile references, including the compact navigation, centered hero, black career-placeholder data section and rounded Lab cards.
- Add a live Home S1 analytical preview driven by ceramic thickness; keep career figures and unimplemented Lab subjects explicitly as placeholders.
- Arrange S1 as a top measurement bar and desktop model/parameter columns, using D1 surfaces and controls while retaining existing scientific, keyboard, fallback and accessibility behavior.
- Replace GSAP with native Web Animations and remove the package from the dependency graph; regenerate the installed license inventory.

### Added

- Reproducible native Three.js power-module geometry and small responsive light/dark static assets; no homepage WebGL requirement.
- Localized Home Content Collections, immutable upstream design documents with source hashes, and v3 before/after review and comparison evidence.
- Extend local Chinese font-subset discovery to JSON/YAML content and the 500/700 weights used by the supplied design.
- Reduce Chinese font requests with twelve checked-in assets across four real weights, preserving every retained outline, metric and actual weight. Validate provenance hashes and keep automatic original-font fallback for future content without requiring Python in normal builds.

- Schedule already-used fonts earlier on Chinese Home and the S1 routes through scoped preloads, preserving font bytes and layout.

### Preserved

- The complete `thermal-p2/` 2.0.0 package and its numerical evidence remain byte-for-byte unchanged.
- The separate bold experiment remains untouched. Only the main 1.2.0 release is delivered.
- Impeccable remains development-only at `2f98774f86bc05563876643db37e6c37c322850f`; only audit/critique workflows are used. No Taste workflow or additional style commands are run.

## 1.1.0 - 2026-10-15

### Added

- Complete P2 computation source, FEM data, actual mesh, material parameters, model files and reproducible numerical checks under `thermal-p2/` (independently versioned 2.0.0).
- Independent before/after Impeccable audit and critique evidence, fix list, provenance and local validation reports under `reports/v2/`.
- Keyboard orbit and zoom with localized instructions, mobile synchronized result/warning feedback, and fourteen browser regression tests.
- A separate CI job validates the typed P2 evaluator, exact load scaling, recorded FEM evidence and exported mesh.

### Fixed

- Shared pages now use the existing D1 font families, colors, focus treatment and light/dark surfaces consistently.
- Dark skip-link and selected-material contrast; warning inclusion in the existing polite status announcement.
- Mobile/desktop 200% text reflow, intact numeric values, selected-tab visibility, 44 px controls and standalone links, and readable technical labels.
- Desktop selected-layer details and interaction hints now occupy content-sized nonoverlapping rows when text expands.
- Work/Lab index heading levels now match their surrounding hierarchy.
- Build-time Noto Sans SC CSS selection reduces declarations while retaining the same original licensed font assets and regenerating coverage from source content.
- Generated Lighthouse timing telemetry no longer triggers personal-phone false positives. Only schema-validated report timing fields and encoded image bytes are normalized for text scanning; diagnostics, source/dist, malformed reports and Gitleaks retain their checks. Three regression tests cover that boundary.
- Reserve the existing English mobile language-selector row before web fonts arrive, preventing a measured 60 px header shift without changing its final typography or navigation. Delayed-font, keyboard and no-JavaScript regressions cover the fix.

### Preserved

- Both color-token files, original engineering content/routes, numerical models and 500-sample FEM data remain unchanged. Only interaction instructions were extended.
- Main uses /audit and /critique playbooks only; the separate `experiment/bold` branch is not merged into this release.
- Impeccable development checkout is pinned to `2f98774f86bc05563876643db37e6c37c322850f`; skill files, generated context/configuration and hooks are excluded.

## 1.0.0 - delivered baseline

P1 bilingual static portfolio and P3 S1 thermal visualization, with fictional Sample Engineer content. Baseline source commit: `36dd3d9d9210a9ea20b1d4574c5db366e79805c3`.
