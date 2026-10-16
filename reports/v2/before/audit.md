# Before audit — frozen portfolio-p3 baseline

Method: Assessment B, independent of Assessment A. Recovery from existing detector/browser artifacts, source verification, and one bounded native Chrome follow-up. No product edits.

## Scope and provenance

- Reviewed source: `portfolio-p3/`; source locations below are relative to that directory.
- Pages: Home, Work, Lab, About, Contact, S1 chip-junction-temperature; Chinese and English; 1440 × 1000 and 390 × 844 CSS-pixel viewports; light and dark preferences.
- Preserve D1 minimal direction, locked colors/fonts, information architecture, and engineering copy. Recommendations below concern implementation/accessibility within those constraints.
- `docs/DESIGN.md` and `docs/PRD.md` were not available. No missing requirements, personas, business claims, or design decisions were invented.
- Impeccable pin supplied for this review: `2f98774f86bc05563876643db37e6c37c322850f`. Read `SKILL.md`, `reference/audit.md`, and the Assessment B requirements of `reference/critique.md`.
- Existing evidence: `.dev-tools/reviews/before-detector-raw.json`, `before-browser-matrix.json`, `before-interactions.json`, `before-targeted-verification.json`, and `b-*.png`. These artifacts were reused; neither detector nor full matrix was rerun.
- Matrix timestamp: 2026-10-14T06:59:30.090Z; Chromium 156.0.8078.4, headless, reduced-motion preference, device scale factor 1. All 48 captures returned HTTP 200, one main and one h1, no recorded pageerror, and no document-level horizontal overflow.
- An isolated Chrome extension tab was opened against the frozen baseline for a settled material-state check, then closed. No product source was changed.

## Implementation Integrity Verdict — PASS with integration gaps

The reviewed implementation has coherent, product-specific behavior: shared localized components, native range controls, a thermal stack renderer, analytical/FEM model switching, explicit model limitations, and progressive fallback. The deterministic artifact is `[]`: zero detector findings, zero rule names, zero file locations. This is not a blanket accessibility or design pass; the source/browser checks below expose defects outside that signal.

The shared shell and S1 use separate token scopes, producing a reproducible dark-theme integration defect. The audit also found incomplete keyboard operation and status communication in the interactive viewer. These are specific integration defects, not evidence that the engineering model or disclosures are fabricated.

## Audit Health Score

| # | Dimension | Score / 4 | Key evidence |
|---|---|---:|---|
| 1 | Accessibility | 2 | Good semantics and keyboard controls, but verified contrast failures, unavailable keyboard orbit/zoom, and an unannounced threshold warning. |
| 2 | Performance | 3 | Dynamic viewer loading, on-demand rendering, reduced tessellation on narrow/coarse-pointer devices; S1 still carries a large font CSS response. |
| 3 | Theming | 2 | S1 has light/dark tokens; other reviewed pages retain light rendering under dark preference, and the shared skip link mixes token scopes. |
| 4 | Responsive Design | 2 | Normal-size 390px layouts have no document overflow and synthesized touch works; text enlargement causes overlapping S1 overlays, and controls are consistently below the audit's 44px target. |
| 5 | Implementation Integrity | 3 | Coherent shared structure and meaningful model disclosures; isolated cross-system integration gaps remain. |
| **Total** | | **12/20** | **Acceptable — significant work needed** |

Scores describe this evidence-backed technical audit. They are not WCAG certification or a measured field-performance rating.

## Executive summary

Ten distinct issues: **P0: 0; P1: 5; P2: 4; P3: 1**.

Prioritize dark skip-link contrast, selected material-pill contrast, keyboard orbit/zoom parity, enlarged-text layout, and announcing the threshold warning. Then improve touch sizing and small technical text, complete shared dark-theme behavior, and reduce unnecessary font CSS. Preserve the existing model, copy, font families, colors, and IA; adjust their use and presentation rather than rewrite product truth.

## Detailed findings

### B-01 [P1] Dark S1 skip link is nearly invisible

- **Location:** `src/styles/global.css:64` (skip-link background); `src/styles/thermal-tokens.css:46` and `:56` (dark page foreground/link inheritance); `src/layouts/BaseLayout.astro:54`.
- **Category:** Accessibility / Theming.
- **Evidence:** `before-interactions.json`, both `dark-skip` records: foreground and outline `rgb(245,245,247)`, background `rgb(255,255,255)`. `b-zh-dark-skip.png` and `b-en-dark-skip.png` visibly confirm the pale label on white. Computed text contrast is approximately **1.09:1**.
- **Impact:** Keyboard users can focus and activate the link, but low-vision users cannot reliably read the focused bypass action.
- **Standard:** WCAG 1.4.3 Contrast (Minimum), AA. The bypass functionality itself works; main receives focus.
- **Recommendation:** Bind the shared skip-link foreground/background to a matched theme token pair, retaining the locked palette and a visible focus indicator.
- **Suggested command:** `$impeccable harden`.

### B-02 [P1] Selected material preset loses AA text contrast in light mode

- **Location:** `src/components/lab/thermal-stack/thermal.css:484`; `src/styles/thermal-tokens.css:6` and `:10`.
- **Category:** Accessibility / Theming.
- **Evidence:** A bounded native Chrome check selected “Al₂O₃ · 24” in the AMB tab, waited through the next AX observation, and read `aria-pressed=true`, foreground `rgb(191,72,0)`, background `rgba(191,72,0,0.19)`. Over the white parameter card the effective background is approximately `rgb(242.84,220.23,206.55)`; calculated contrast is **3.85:1**, below 4.5:1 for this small label.
- **Impact:** The active preset, which users need to recognize while comparing materials, becomes less legible.
- **Standard:** WCAG 1.4.3 Contrast (Minimum), AA.
- **Recommendation:** Keep the accent border/background and locked palette, but use an existing sufficiently contrasting text token for selected preset labels; verify both themes.
- **Suggested command:** `$impeccable harden`.
- **Important correction:** The older `selectedPill` record in `before-targeted-verification.json` was sampled before the queued update settled. It does **not** establish a broken selected state. State switching works; this finding concerns the settled contrast.

### B-03 [P1] WebGL orbit and zoom are unavailable from the keyboard

- **Location:** `src/components/lab/thermal-stack/viewer.ts:161` (OrbitControls), `:415` (keyboard handler).
- **Category:** Accessibility.
- **Evidence:** `before-targeted-verification.json.keyboardView`: settled canvas screenshot hashes before and after ArrowRight plus “+” are identical. The source keyboard handler handles only Home and Escape; no orbit/zoom key mapping or equivalent view buttons are provided.
- **Impact:** A keyboard-only visitor can select layers through the legend and reset the view, but cannot inspect the same viewing angles or zoom levels available to pointer users.
- **Standard:** WCAG 2.1.1 Keyboard, A; this is missing functionality rather than a focus trap.
- **Recommendation:** Add keyboard-accessible orbit and zoom controls with concise localized instructions using the existing copy conventions. Keep pointer controls and view reset.
- **Suggested command:** `$impeccable harden`.
- **Evidence precedence:** The earlier `keyboard-view-orbit-zoom` hash change in `before-interactions.json` is timing-sensitive and contradicted by the settled targeted check plus source. Do not count it as a pass.

### B-04 [P1] Enlarged text collides inside the fixed-height mobile visualization

- **Location:** `src/components/lab/thermal-stack/thermal.css:64`, `:96`, `:180`, `:269`, and the mobile rules at `:642`.
- **Category:** Responsive Design / Accessibility.
- **Evidence:** At 390px with root font-size 200%, `b-text200-s1-en.png` and `b-text200-s1-zh.png` show metrics, view buttons, scale, and the model overlapping. Targeted geometry confirms English metrics at x=50, y=836.42, w=265.70, h=267.98 and actions at x=198.05, y=833.42, w=146.95, h=145.56: their rectangles intersect. The stage remains 380px high. Chinese also intersects.
- **Impact:** Larger text obscures the main temperature and controls, undermining the accessibility benefit of text enlargement.
- **Standard:** WCAG 1.4.4 Resize Text, AA, relevant criterion. The recorded technique is a root-font enlargement stress test, not a full browser text-only-zoom conformance test.
- **Recommendation:** At narrow widths/enlarged text, lay out metric and action content in non-overlapping flow or reserve explicit space outside the canvas. Let content determine height while retaining the visualization and all engineering text.
- **Suggested command:** `$impeccable adapt`.
- **Boundary:** No document-level overflow was observed. Passing the overflow check does not disprove overlap.

### B-05 [P1] Crossing the temperature threshold is not announced as a warning

- **Location:** `src/components/lab/thermal-stack/ThermalStack.astro:115`; `src/components/lab/thermal-stack/client.ts:139` and `:159`.
- **Category:** Accessibility.
- **Evidence:** At 500W, `before-targeted-verification.json.warning` records a visible warning with no role, no aria-live, and no live-region ancestor. The live result says “Current calculation: Junction temperature 367.8 °C; Junction-to-fluid resistance 0.606 K/W.” and omits the threshold warning.
- **Impact:** Screen-reader users hear a new numerical result but are not informed that the UI has entered its warning state.
- **Standard:** WCAG 4.1.3 Status Messages, AA.
- **Recommendation:** Include the existing localized warning in the result announcement when crossing the threshold, or give it an appropriate status mechanism. Avoid repeated assertive announcements on every slider tick; keep the engineering disclaimer unchanged.
- **Suggested command:** `$impeccable harden`.

### B-06 [P2] Shared pages do not respond to dark preference

- **Location:** `src/styles/tokens.css:1`; `src/styles/global.css:10`; contrast with `src/styles/thermal-tokens.css:20`.
- **Category:** Theming.
- **Evidence:** All Home/Work/Lab/About/Contact light/dark screenshots are visually identical in each locale/width. Matrix body values remain white/background, black/text, `colorScheme=normal`. S1 correctly changes to black/background and pale text under the same preference.
- **Impact:** Dark-preferring visitors encounter a bright shell and an abrupt theme transition when moving between S1 and other pages.
- **Standard:** Product theme consistency, not an automatic WCAG violation.
- **Recommendation:** Apply the approved light/dark token system to the shared shell using the locked palette and fonts; do not infer a new visual direction from missing design documents.
- **Suggested command:** `$impeccable harden`.

### B-07 [P2] Common controls are smaller than the audit's 44 × 44 target

- **Location:** `src/styles/global.css:85` and `:101`; `src/components/lab/thermal-stack/thermal.css:513`, `:683`, `:755`, `:775`, `:801`, `:861`.
- **Category:** Responsive Design / Accessibility.
- **Evidence:** Matrix at English 390px: shared menu 31.59px high (S1 28.39px); language links 20px high (S1 18px); S1 view buttons 31px; model choices 25.92px; tabs 36.80px; legends 32px; native range boxes 16px high with 14px visual thumbs. The same shared rules affect both locales.
- **Impact:** One-handed tapping and precise slider targeting require more effort, especially around neighboring controls.
- **Standard:** The audit's 44 × 44 heuristic and WCAG 2.5.5 Target Size (Enhanced), AAA. A blanket WCAG 2.5.8 AA failure is **not** claimed: its 24px/spacing/equivalent-control exceptions require per-target assessment, and inline links have exceptions.
- **Recommendation:** Increase effective control hit areas to at least 44px where feasible, with clear spacing. Preserve compact visual marks if needed; avoid making every inline prose link a button.
- **Suggested command:** `$impeccable adapt`.
- **Boundary:** The baseline synthesized touch orbit, slider tap, and tab-strip swipe work; small targets do not mean gestures are broken.

### B-08 [P2] S1 technical explanations and units become very small on mobile

- **Location:** `src/components/lab/thermal-stack/thermal.css:659`, `:673`, `:707`, `:714`, `:755`, `:805`.
- **Category:** Responsive Design / Accessibility.
- **Evidence:** 390px matrix reports node label 8.32px, metric units 7.68px, view-action text 8.8px, scale title 7.84px, scale note 7.2px, legend values 8px, and engineering-note body 9.76px.
- **Impact:** Visitors must magnify essential units, model limitations, and control labels; the enlargement collision in B-04 then makes inspection harder.
- **Standard:** Readability concern. WCAG has no blanket minimum font-size rule; this is not scored as a standalone font-size conformance violation.
- **Recommendation:** Retain the specified font families and engineering copy, raise readable sizes for secondary text/controls, and rebalance mobile space in concert with B-04.
- **Suggested command:** `$impeccable typeset`.

### B-09 [P2] S1 loads a large generated font stylesheet

- **Location:** `src/components/lab/thermal-stack/ThermalStack.astro:2` (Geist/Mono imports) and `:4` (Noto Sans SC 400/600 imports).
- **Category:** Performance.
- **Evidence:** The recorded S1 CSS response `LabDetail.DaM3fsho.css` has **256,868 decoded bytes / 257,168 transferred bytes** on the local static server. The S1 Three chunk is also 736,440 decoded bytes, but is an intentional dynamically loaded dependency for the actual 3D view.
- **Impact:** Large CSS adds parsing/download work before the full font presentation on slower devices/connections.
- **Standard:** Performance opportunity; no Core Web Vitals failure or field-network timing is claimed.
- **Recommendation:** Keep the locked font families/weights and multilingual coverage, inspect generated font-face duplication/subset declarations, and consolidate only proven-unused declarations. Measure a production compressed build before changing the loading strategy.
- **Suggested command:** `$impeccable optimize`.
- **Boundary:** Local network timings are not representative, and transferred bytes may differ under production compression/cache. Do not treat Three as an unused import.

### B-10 [P3] Index cards skip from h1 to h3

- **Location:** `src/components/WorkIndex.astro:16`, `:19`; `src/components/LabIndex.astro:16`, `:19`; `src/components/CaseCard.astro:15`; `src/components/LabCard.astro:18`.
- **Category:** Accessibility / Implementation Integrity.
- **Evidence:** The Work and Lab matrix heading sequences start h1 then h3. The cards' fixed h3 is appropriate below Home's h2 sections but not directly below an index h1.
- **Impact:** Heading navigation conveys an unnecessary missing level to assistive-technology users.
- **Standard:** Semantic hierarchy best practice; no unsupported blanket WCAG failure is asserted.
- **Recommendation:** Parameterize card heading level for context or add a meaningful section heading only if already supported by the IA. Preserve labels and visual typography.
- **Suggested command:** `$impeccable polish`.

## Patterns and systemic issues

1. **Token boundaries are incomplete:** global Canvas/CanvasText tokens and S1 thermal tokens coexist; the skip-link defect and theme discontinuity follow from that boundary.
2. **Density is achieved through small text/targets:** repeated mobile reductions throughout S1 create readability and tapping costs. Fix these together with the fixed overlay layout rather than growing individual labels into collisions.
3. **Visual state is richer than announced/keyboard state:** pointer orbit/zoom and the visible threshold warning lack equivalent keyboard/status behavior.
4. **Component reuse needs semantic context:** identical card markup is reused under different heading levels.

## False positives, corrections, and rejected claims

- Detector JSON contains zero findings; therefore there are no detector rule false positives to enumerate. Empty detector output does not validate theme behavior, zoom, touch, keyboard parity, or contrast.
- “Keyboard orbit passed because the screenshot changed” is rejected: the settled targeted hash and source show no orbit/zoom key handler.
- “Preset selected styling never updates” is rejected: the immediate older sample preceded queued calculation. Native follow-up confirms pressed state and styling; only settled contrast is defective.
- “FEM did not change the Chinese result” is not established: the first interaction captured the previous number before queued recalculation. The targeted FEM check produced 313.3 with the FEM-trained label, and the English interaction changed 131.6 to 119.6.
- “The mobile page horizontally overflows” is rejected for tested normal-size states: document widths match viewport in all 48 captures. A horizontally scrollable tab strip is intentional and responds to synthesized touch.
- “Every target below 44px is an AA violation” is rejected. This report uses the audit heuristic, discloses the AA spacing/exception boundary, and excludes the off-screen unfocused skip link from primary touch criticism.
- “Reduced-motion CSS deletes all useful feedback” is not supported. Renderer state updates remain, and reduced-motion explosion uses the final state without interpolation; this is intentional static feedback, not a destructive 0.01ms timing hack.
- System palette constants in the thermal visualization represent data encoding. They are not automatically decorative hard-coded-color drift.
- Sparse sample content, the placeholder analytical-model label, and explicit validation limitations are preserved product truth. No new claims or content are requested here.

## Positive findings

- All 48 baseline states load successfully without recorded pageerrors or document horizontal overflow.
- One main landmark and one h1 per reviewed page; localized html language attributes and counterpart routes are present.
- Mobile navigation opens by Enter, exposes the first nav item in the tab order, closes with Escape, and returns focus to its toggle in both languages.
- Revealing email by keyboard makes the address visible and moves focus to it.
- Language switching preserves the equivalent page on all six routes in both directions.
- Native range controls are labeled, expose units and aria-valuetext, support keyboard increments, and update results. Tabs support the End key and their selected state.
- The analytical/FEM selection is a real state change with explicit model labels and disclosures. The baseline is not presented as experimentally validated.
- The 2D fallback is keyboard selectable; selecting the ceramic layer activates the AMB panel.
- Chromium CDP synthesized-touch checks demonstrate orbit movement, recovery after touchCancel, range-value change, and horizontal tab-strip scrolling.
- On-demand requestAnimationFrame scheduling, hidden-document cancellation, dynamic viewer import, IntersectionObserver/idle scheduling, mobile/coarse-pointer mesh reduction, and disposal paths are visible in source. There is no evidence of an always-running idle render loop.
- Theme-aware S1 tokens, focus indicators, status region for model loading, error alert, reduced-motion handling, and textual data alternatives provide a sound basis for the fixes.

## Recommended actions

1. **[P1] `$impeccable harden`:** Resolve B-01/B-02 contrast, B-03 keyboard view parity, and B-05 threshold announcements with existing localized copy and locked tokens.
2. **[P1/P2] `$impeccable adapt`:** Resolve B-04 overlay collisions and B-07 target sizes together.
3. **[P2] `$impeccable typeset`:** Raise B-08 secondary-text readability without changing font families or factual copy.
4. **[P2] `$impeccable harden`:** Complete shared theme behavior (B-06).
5. **[P2] `$impeccable optimize`:** Inspect generated font CSS and production compression before a bounded reduction (B-09).
6. **[P3] `$impeccable polish`:** Correct contextual card headings and verify the final keyboard/focus/theme presentation.

The parent task already authorizes fixes and will own post-fix validation. This raw evidence report does not ask for a second authorization or run edits. Re-run the bounded audit after fixes to compare the score against this baseline.

## Limitations and run notes

- This is a technical Assessment B audit, not Assessment A's independent design judgment. No A artifact or findings were read.
- The stored detector artifact contains valid JSON `[]`, but does not preserve its invocation, file inventory, or exit code. Those metadata cannot be reconstructed from the file; they should not be invented. The parent supplied it as the completed pinned-detector baseline and explicitly requested reuse.
- The initial in-app-browser attempt returned “Browser is not available: iab.” A fresh Chrome extension tab then loaded successfully. The documented browser evaluate surface is read-only and exposes no mutable script-injection API. Consequently the title/script injection preflight cannot be legally performed through that API; live-server overlay injection, [Human] presentation, and detector console overlay findings are **unavailable**, not “clean.”
- No detector live-server was started by this recovery. The baseline preview at port 4325 is parent-owned; this worker did not stop it. The fresh review tab was closed. Existing evidence/scripts were retained as audit artifacts, not silently deleted.
- The matrix was captured using its existing custom Playwright harness. Recovery does not claim to have regenerated it or retrospectively satisfied a native-overlay path.
- Gesture evidence is synthesized Chromium CDP touch with mobile/hasTouch context. No physical touch device, Safari, Firefox, or native assistive-technology speech session was tested.
- Most matrix states use reduced-motion preference. Full normal-motion performance, slow network, production compression, bundle coverage, and field vitals were not measured in this recovery.
- 200% evidence changes the root font size; it is a targeted text-expansion stress test. Full browser zoom/OS text scaling needs separate bounded confirmation if required.
- No exhaustive automated accessibility engine or full contrast inventory was run. Ratios in B-01/B-02 derive from observed computed sRGB colors and alpha compositing.
- No repo-wide checks, detector rerun, full browser-matrix rerun, or product edits were performed by this recovery.

