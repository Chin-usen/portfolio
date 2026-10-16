# Impeccable technical audit — independent AFTER B

Status: FINAL for the original independent B-tested state; 17/20 is frozen for that state. Saved dark Home viewport captures were recovered and visually confirmed, and a separately hashed current-build 200% viewport capture is complete. See `finalization-state.md`. Tool pin `2f98774f86bc05563876643db37e6c37c322850f`; target the original B-tested `portfolio-main-v3` Home and S1 in zh/en, light/dark, desktop/mobile. Assessment A and before-run findings/scores were not read. No source edits were made. Later coordinator fixes are not scored by this original-state report.

## Implementation integrity verdict

**Pass.** The implementation has a coherent, product-specific D1 system: the three-terminal power module, black career-metric band, actual analytic preview, and layered thermal exploration are mutually consistent. Placeholder career claims and unimplemented concepts are clearly marked, as required by the fixed brief. S1 obeys the explicit metrics-top/model-left/parameters-right layout rather than the superseded stacked mock. The deterministic warning refers to a fixed-reference typography constraint, not evidence of systemic generic design drift.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 3/4 | Semantic, labelled, keyboard-operable controls and live warnings; a scrolled tab-occlusion edge remains. Small captions are a fixed-reference constraint. No full screen-reader certification. |
| 2 | Performance | 3/4 | Responsive imagery, local font subsets, lazy viewer/FEM and event-based rendering; large lazy Three.js chunk remains and no LH/field budget is certified by B. |
| 3 | Theming | 4/4 | Coherent light/dark tokens, stable domain palette and sampled text contrast; recovered viewport captures confirm dark Home metrics paint correctly. |
| 4 | Responsive Design | 3/4 | All 16 default layouts have no horizontal overflow; primary HTML targets pass both 44px dimensions and real 200% zoom reflows. Fallback geometry has thin optional touch targets. |
| 5 | Implementation Integrity | 4/4 | Product-specific, honest content and model provenance; detector warnings collapse to one verified CSS rule. |
| **Total (original B-tested state)** | | **17/20** | **Good — address weak dimensions; not a score of later fixes** |

Scores are rubric judgments supported by the evidence below. They are not Lighthouse scores or a claim that every WCAG criterion passes.

## Executive summary

Two actionable verified issues in the original B state: **P0 0 / P1 0 / P2 2 / P3 0**, plus one fixed-design readability observation (B2). Both actionable issues have a usable workaround. Prioritize the sticky summary occluding parameter tabs, then direct 2D selection targets. The three saved dark Home viewport captures resolve the blank metric-band ambiguity. A supplementary current-build English Home viewport capture verifies real 200% zoom without horizontal clipping in that viewport.

## Detailed findings

### B1 · P2 — sticky calculation summary masks parameter tabs when scrolled

- **Location:** `src/components/lab/thermal-stack/thermal.css:646`; duplicated sticky settings at line 733. Summary markup: `ThermalStack.astro` `.thermal-control-summary` before parameter controls.
- **Category:** Responsive / Accessibility.
- **Reproduction:** Open English S1 at 1440×1000; focus and activate the Ceramic resistance legend. At document scrollY608 the sticky summary covers the tab controls.
- **Evidence:** `browser-followup.json.scrolledState`; `screenshots/s1-selected-layer-viewport.png`. Summary y52–118.5. Four tabs y47.83–91.83; fifth y93.83–137.83. Every measured tab center hits the summary rather than its button.
- **Impact:** Users cannot see or click the normal tab center until they scroll upward. The visible calculation context competes with the controls it should explain. Keyboard activation works in the separate tested sequence; this audit does not claim a fully obscured focused-tab WCAG failure without that exact focus state.
- **Standard:** Usability/operability defect; assess WCAG 2.4.11 Focus Not Obscured during remediation. No conformance failure is asserted from the mouse hit-test alone.
- **Recommendation:** Put the summary and controls in a layout that reserves sticky space; make the tab strip part of the sticky group or stop sticking the summary where it crosses the choices. Preserve the near-control warning and result context.
- **Allowed verification:** Make a scoped manual layout change, then use `$impeccable audit` or `$impeccable critique` focused on scrolling, hit tests and keyboard focus at the same position. Do not use a style-changing command.

### B2 · Design-constrained readability observation — mobile metric captions resolve to 11px

- **Location:** `src/styles/home.css:323` (`font-size:0.6875rem` on `.home-secondary-metrics dt`).
- **Category:** Accessibility / Responsive / Implementation Integrity.
- **Evidence:** Source detector exit0; built detector exit2 with three identical `tiny-text` records. Current output: `detector-current-verified.stdout.json`. Browser measurements show 11px at 390px in both locales, compared with 15px desktop. See Home mobile captures and the `text` records in `browser-evidence.json`.
- **Impact:** The three captions identify what each headline number means; their small size makes scanning and interpretation harder on a phone.
- **Standard:** Readability/craft threshold from the audit rubric. WCAG does not impose a blanket 12/14px minimum; successful browser zoom does not make the base size comfortable.
- **Fixed-brief constraint:** The coordinator clarified during finalization that D1-mobile explicitly specifies 11px captions and the user requires exact reference sizes. This is recorded as a supplied constraint, not a new independent inspection of the reference. The earlier automatic font-increase recommendation is withdrawn.
- **Recommendation:** Preserve the specified 11px size under the current brief. Record the legibility tradeoff separately and verify wrapping/zoom. A size increase would require a changed design instruction; it is not an authorized fix now.
- **Allowed verification:** `$impeccable audit` or `$impeccable critique`; no style-changing command.

### B3 · P2 — fallback SVG layer hit areas are thinner than 44px

- **Location:** `src/components/lab/thermal-stack/viewer-fallback.ts:89` (`makeLayer`) and 164–171 (outline geometry).
- **Category:** Responsive / Accessibility.
- **Evidence:** Explicit 2D, zh, dark, 390×844, exploded state: seven SVG role=button groups have heights 5.95–25.94px (widths 45.34–271.73px). `browser-evidence.json`, check `2d-fallback-keyboard-reduced-motion`, `undersized`. Example top solder: 45.34×5.95px; ceramic:108.73×8.52px.
- **Impact:** Direct touch selection in the diagram requires precision. Equivalent legend buttons meet 44px in both dimensions, and Enter/Escape layer selection works, so layer selection is not blocked.
- **Standard:** Below the requested 44×44 target heuristic. Equivalent controls may satisfy the equivalent-target exception; do not mislabel this alone as a WCAG AA failure. The viewport was emulated; no physical finger testing occurred.
- **Recommendation:** Preserve geometry and expose adjacent labelled 44px layer targets or non-overlapping larger hit regions. Retain keyboard and legend equivalence.
- **Allowed verification:** Make only a scoped manual interaction change if needed, then use `$impeccable audit` or `$impeccable critique` and repeat layer selection/hit-area checks.

## Deterministic scan and false-positive handling

Source scan: pinned CLI, 10 source markup files, exit0, `[]`. Built scan: four current routes, exit2, three `tiny-text` warnings, all line0 of minified `dist/en/index.html`. There is **one rule with three affected captions**. The browser shows both locales share the rule, and it is mobile-only. The generic “body text” label is overbroad. The small size is real but matches the fixed D1-mobile requirement, so it is a documented design tradeoff rather than an implementation deviation to fix automatically. Count neither three distinct defects nor a desktop failure.

A Windows quoting failure in the first current-build detector rerun is recorded in `detector-current.stderr.txt` and `browser-evidence.json.detector`; the succeeding PowerShell invocation is authoritative. Current verified stdout/stderr/exit files preserve the actual tool output. Source/reference hashes plus current rendered markup hashes are in the raw JSON.

No overlay was injected into the native tab because evaluate is read-only. A CLI scan, native visual inspection, and authorized Playwright captures provide evidence; no live overlay is implied.

## Verification evidence

- **Matrix:** 16 individually viewed captures: Home/S1 × zh/en × light/dark × 1440/390. Fonts loaded. Document widths matched client widths. No clipped page-level horizontal content in DOM geometry.
- **Touch targets:** Every visible default-state HTML control passed width≥44 and height≥44 in all 16 samples. SVG fallback microtargets are separately reported, so “all targets pass” is not claimed.
- **Keyboard:** Skip link, mobile menu Enter/Escape/focus return, visible focus outlines, roving tab Arrow/Home/End, native slider End, reset, and legend selection. Home analytic preview 125.6→133.4°C; S1 power500 warning367.8°C; reset125.6°C.
- **Models:** Analytical125.6°C ↔ FEM114.7°C, with correct pressed state and labelling. Values test UI continuity, not scientific validation.
- **Failure:** Blocking FEM leaves analytical results and actionable failure; retry works after network restoration. Blocking the lazy viewer chunk yields an interactive declared 2D fallback; power200 recalculates186.1°C.
- **Reduced motion:** Explicit 2D layer selection/deselection works; explosion reaches identical final transform at both 100ms and550ms observations rather than prolonged motion.
- **Touch:** Chromium/CDP synthesized slider drag, cancellation, different-value recovery, and WebGL orbit. Page scroll did not change during orbit. Physical-device interaction was not tested.
- **Zoom:** Actual Chrome extension `tabs.setZoom(2)` verified by `getZoom=2`, DPR2 and 720×500 CSS viewport. All four original routes retained720px scroll/client width and primary targets. CSS zoom, font-size mutation and pinch scale were not substituted. Original full-page PNG cropping remains unsuitable as visual proof. The separately hashed current-build English Home viewport PNG is 1440×1000 and visibly fits the full header/hero horizontally; its JSON independently verifies zoom2 and document width720. This supplements the original geometry evidence, without claiming visual checks of all four current routes.
- **Recovered captures:** The zh/1440, zh/390 and en/1440 dark Home metric viewport PNGs from 04:33:19–20 UTC all visibly contain the primary and secondary metrics. The interrupted harness never left its final JSON or zoom images. The later bounded zoom capture has its own harness/JSON; completion of the older interrupted harness is not claimed.
- **Contrast:** Solid-background sampled text:57 Home/90 S1 entries per theme, minimum4.905:1 light/5.998:1 dark; no sampled failures. Gradient/3D colors excluded.
- **Errors:** No unexpected page errors in the 16 normal matrix loads. Intentional blocked requests belong to failure tests. An initial broad `[data-model]` selector error was corrected in the harness and is not an app failure.

## Patterns and strengths

The remaining layout issue is localized to sticky context within the parameter panel. The fixed mobile caption size carries a readability tradeoff. Small optional targets follow physical layer thickness in the fallback; their accessible alternate control system already exists. None is a widespread missing-label, desktop-only, or misleading-demo pattern.

Maintain the semantic landmarks, single H1, content-specific image alternative text, native range inputs, roving tabs, near-control/live warnings, explicit analytic/FEM boundary, 2D recovery, theme tokens, and honest concept labels. Source inspection found lazy viewer/FEM imports, responsive WebP sources, local Noto subsets, intersection/idle initialization, frame-coalesced updates, and rendering cleanup. The 736,440-byte raw Three.js chunk is deferred; do not replace the coordinator's performance evidence with this source-level observation.

## Recommended actions

1. **P2 manual layout correction** — prevent the sticky summary from covering tabs; validate the captured scrolled position and focused tabs in both locales.
2. **Preserve D1-mobile's specified 11px captions** — document the readability tradeoff; verify wrapping and zoom without silently changing exact sizes.
3. **P2 manual interaction correction where necessary** — improve optional direct 2D selection targets while preserving physical geometry and equivalent keyboard/legend controls.
4. **Audit/critique only** — repeat `$impeccable audit` or `$impeccable critique` after scoped manual fixes. The fixed brief prohibits other style commands.

The 17/20 score is final only for the original B-tested state. Do not use these original-state findings as evidence that subsequent coordinator changes remain faulty, or the one current-build zoom capture as a complete rescore of those changes.

## Scope limits

This audit is local Chromium evidence plus source inspection, not screen-reader, cross-engine, physical-device, production-network, thermal-physics, or full WCAG certification. Performance score is source/browser-informed; B neither ran nor read Lighthouse. Browser zoom was exercised on a desktop physical viewport, not every mobile browser's text-only scaling feature. Native browser screenshots are in the tool transcript; persisted matrix screenshots come from Playwright. Root owns server cleanup. No automatic fixes were made.

Questions skipped: the coordinator owns the combined review and user questions; this report is the independent technical slice.
