# Independent AFTER Assessment B

Status: FINAL for the original independently tested B state — technical score 17/20 is frozen for that state. Saved dark Home viewport captures resolve the blank-band ambiguity. A separately hashed current-build 200% zoom viewport capture is complete. See `finalization-state.md`. This score does not evaluate subsequent coordinator fixes.

## Independence and scope

Assessment B reviewed the current `portfolio-main-v3` implementation only. Assessment A and all before-run assessments, findings, and scores were not read. The reviewer reused its own phase-1 detector/source preparation. Impeccable repository pin: `2f98774f86bc05563876643db37e6c37c322850f`; installed skill version 4.5.2. This pin identifies the review tool, not the app. App baseline HEAD: `85fdb504e35ee480f43c98b0237f87ee866fb367`, plus current working tree. No application sources were changed by this audit.

Fixed visual authority is `docs/design/D1-desktop.html/.jpg`, `D1-mobile.html/.jpg` and `docs/DESIGN.md`. For S1, the explicit current brief takes precedence over the older stacked S1 mock: metrics on top, model left, parameters right. The 52px header, 88px desktop / 38px mobile hero, three-terminal module, black placeholder metric band, and live analytic S1 preview remain intentional. Placeholder identity, case values, and concept cards are authorized content; they are not fabricated production claims.

## Evidence provenance

- `phase1-ready.md`, `scope-hashes.json`, `built-scope-hashes.json`: B-only preparation and original hashes.
- `browser-evidence.json`: current source hashes, rendered markup hashes, 16 matrix records, computed geometry, fonts, theme values, controls, browser version, and interaction results.
- Only `src/styles/generated-fonts.css` differed from the prepared source inventory; current SHA-256 `00382b45987ee12d03ae67bb7919d916ec5daaccbd3d24ec7a8c59261299455a`. This incorporates the coordinator's exact-outline Noto subsets. All other inventoried source and design-reference files were unchanged.
- Fresh native Chrome tab `1585785879`: Home and S1 viewed at 1440×1000, fonts loaded, screenshots/AX state recorded in tool transcript. Tab closed and viewport reset. Native read-only evaluation prevented overlay injection. **No user-visible detector overlay was created or claimed.**
- Authorized Playwright 1.64 / Chromium `156.0.8078.4`: 16 full-page captures, plus keyboard, warnings, selected layer, failure, fallback, touch, and zoom captures. Raw harness: `browser-audit.cjs`. The initial S1 test hit a harness locator ambiguity after FEM succeeded; `browser-followup.cjs/.json` corrected the selector to `button[data-model]` and completed it. Do not count that harness error as an application defect.
- All B browser contexts/processes were closed before the coordinator's performance run. Root owns preview PID 31276 and its cleanup. B did not run Lighthouse or read its results.
- Recovery inspection found three dark Home viewport PNGs saved at 04:33:19–20 UTC and corresponding repaint captures. All three viewport PNGs were visually inspected and show the metric text. The interrupted `capture-confirmation.cjs` run did not leave `capture-confirmation.json` or any zoom viewport PNG; its final completion/cleanup message cannot be inferred. Prior report drafts are retained locally in the assessment workspace.
- After explicit coordinator release of the browser lock, one supplementary current-build zoom capture ran at 04:46:22–23 UTC. `zoom-viewport-confirmation.json` records four route hashes before/after (unchanged during capture), actual zoom 2, CSS 720×500, DPR 2, document width 720 and PNG 1440×1000. Its browser was closed. The saved English Home viewport image was visually inspected: the complete header, two-line hero, specialty line and CTAs fit horizontally. All four current route hashes differ from the original B hashes, so this is supplemental current-state evidence, not a retroactive replacement for the original matrix.
- During finalization the coordinator clarified the fixed brief: D1-mobile explicitly specifies 11px secondary metric captions and exact reference sizes must be retained. This instruction is recorded as a design constraint, not claimed as a new independent reference inspection. Only audit/critique commands are allowed; implementation recommendations below are scoped manual changes.

## Deterministic detector, interpreted separately

The source markup scan completed with exit 0 and `[]` (`detector-invocation.json`, `detector.stdout.json`). It did not resolve every imported stylesheet, so this is not evidence that all rendered text is adequate.

The prepared built-markup scan returned exit 2 with three `tiny-text` warning records, each attributed to `dist/en/index.html`, line 0, `11px body text`. After the font-generated build changed the rendered hashes, the four current routes were scanned again using the same pinned tool. The first automated rerun had Windows quoting failure (exit 1); its failed stdout/stderr is retained. The corrected actual invocation succeeded:

```powershell
& '..\.dev-tools\skills\impeccable\scripts\impeccable.cmd' detect --json 'dist/index.html' 'dist/en/index.html' 'dist/lab/chip-junction-temperature/index.html' 'dist/en/lab/chip-junction-temperature/index.html'
```

Current verified output: `detector-current-verified.stdout.json`, empty `detector-current-verified.stderr.txt`, and exit 2 in `detector-current-verified.exit.txt`. Three identical 11px records remain. They represent **one shared CSS rule**, not three separate defects: `.home-secondary-metrics dt` resolves to 11px at 390px in both locales. Desktop labels are 15px. The detector's generic phrase “body text” and single minified file attribution are imprecise; the browser verified these are the three secondary metric captions. Their 11px size follows the fixed D1-mobile reference. Retain it under the exact-size instruction; record the readability tradeoff separately rather than silently raising the font. It is not automatically a WCAG minimum-font-size violation.

## Browser coverage and results

| Surface | Locales | Themes | Viewports | Evidence |
|---|---|---|---|---|
| Home | zh, en | light, dark | 1440×1000, 390×1000 | `screenshots/home-{locale}-{theme}-{width}.png` |
| S1 | zh, en | light, dark | 1440×1000, 390×1000 | `screenshots/s1-{locale}-{theme}-{width}.png` |

All 16 DOM snapshots reported loaded fonts and `scrollWidth == clientWidth`; primary visible HTML controls measured at least 44px wide **and** 44px high. Default S1 is WebGL in all matrix states. Desktop geometry places metrics above the two workspace columns; mobile stacks the model and parameter controls. Long English tab text wraps rather than clipping the horizontal viewport.

The matrix screenshots were individually inspected. Three dark Home full-page captures displayed a blank metric band despite populated, visible, correctly colored DOM text; one dark English mobile capture painted normally. The saved 04:33 viewport confirmations for zh/1440, zh/390 and en/1440 visibly contain the primary and all three secondary metrics. The blank full-page band is therefore not retained as a verified product defect; it is an evidence-capture limitation. The PNGs and their hashes are listed in `finalization-state.md`.

### Keyboard, state, and recovery

- Home mobile Tab order starts skip link → identity link → menu. Each had a visible 3px focus outline. Enter opens navigation; Escape closes it and restores focus to the toggle. Slider End changes thickness from 0.32 to 1mm and analytic Tj from 125.6 to 133.4°C.
- S1 tabs: ArrowRight selects/focuses Top solder; End selects/focuses Cooler; Home returns to Conditions. Roving tab state and focus agree.
- S1 power End reaches 500W, changes Tj to 367.8°C, shows both top and near-control warnings, and updates the polite live text. Reset restores 125.6°C and removes warnings.
- Keyboard selection of Ceramic exposes its property card, sets `aria-pressed=true`, and opens AMB parameters. Selection is also available without precise canvas picking.
- FEM loads successfully and shows 114.7°C; switching to Analytical restores 125.6°C. These verify state transitions and displayed results, not scientific model accuracy.
- Aborted FEM module request preserves Analytical at 125.6°C and shows actionable failure text. Removing the route block and clicking again successfully sets `data-model=fem`. The prior loading text remains in a hidden status node; it is not a visible stuck-loading issue. Reload also succeeds at 114.7°C.
- Aborted WebGL viewer module switches to the interactive 2D schematic, clearly announces it, and remains calculable (200W → 186.1°C).
- Explicit `?renderer=2d` verifies layer Enter selection, Escape deselection, property card visibility, and reduced-motion explosion reaching the same final transform by the 100ms and 550ms observations.
- The 2D SVG itself has seven thin layer targets (about 5.95–25.94px high in the tested exploded state); equivalent 44px legend buttons remain available. See the technical audit for the distinction between the requested target standard and WCAG exceptions.

### Touch and zoom

Chromium mobile emulation plus CDP-synthesized touch was exercised, not just viewport resizing. Home slider changed 0.32→0.81mm; S1 slider changed 100→400W. A cancelled S1 gesture was followed by a successful different-value gesture (420→180W), showing recovery. Canvas orbit changed its screenshot while page scroll remained 414px; computed `touch-action:none`. The initial S1 high-power gesture changed document scroll 1336→1438 while warning content expanded; the evidence does not establish unwanted gesture scrolling, and it is not counted as a defect. No physical handset was used.

Actual browser zoom used a local test-only extension's `chrome.tabs.setZoom(tabId, 2)` and `getZoom=2`, producing CSS viewport 720×500 at DPR2 with visualViewport scale1. All four Home/S1×zh/en routes remained `clientWidth=scrollWidth=720` with no undersized primary HTML controls. Native Ctrl+plus had no effect and was explicitly excluded from the evidence. Recovery inspection confirmed those raw JSON measurements. The English Home full-page zoom PNG is visibly cropped horizontally, so those images do not independently prove visual reflow. The supplementary current-build direct viewport capture at actual 200% shows the complete English Home header and hero fitting horizontally; `finalization-state.md` records the method and scope. It confirms this current viewport, not every original route visually.

### Contrast and performance boundaries

Read-only contrast calculations composited solid ancestor backgrounds and inspected visible text-bearing elements: 57 Home and 90 S1 entries per theme, minimum 4.905:1 light and 5.998:1 dark, no failures in this sample. Gradient text, rendered WebGL/SVG colors, and unexercised states were excluded. This is not a whole-site WCAG certification.

The source uses responsive small WebP assets, local subset fonts, deferred viewer/FEM imports, intersection/idle viewer initialization, frame-coalesced parameter updates, and disposal on pagehide. The large Three.js chunk is lazy (736,440 raw bytes); no claim is made that all performance budgets pass. Lighthouse and final suite scores belong to the coordinator's separate evidence.

## Findings for synthesis

1. **P2 — sticky result summary covers tabs at a realistic scrolled state.** At scrollY608 after keyboard Ceramic selection, the summary occupies viewport y52–118.5; four tab buttons occupy y47.83–91.83 and the fifth y93.83–137.83. `elementFromPoint` at every tab center returns the summary or its descendants. `screenshots/s1-selected-layer-viewport.png` confirms visible occlusion. Scroll upward is a workaround. This is an implementation issue, not a screenshot-only artifact. Location: `src/components/lab/thermal-stack/thermal.css:646` and the repeated mobile rule at 733. Keep result context without allowing it to mask parameter choices.
2. **Design-constrained readability observation — mobile secondary metric captions are 11px.** Verified detector result; location `src/styles/home.css:323`. The captions identify the headline values. D1-mobile explicitly requires this size, so preserve it and record the tradeoff. This is not an actionable implementation deviation under the current exact-size brief; do not automatically increase it.
3. **P2 — direct fallback layer targets are thin.** `src/components/lab/thermal-stack/viewer-fallback.ts:89` defines interactive SVG groups whose height follows layer geometry. Keyboard and equivalent legend controls work; direct touch picking is still precise. Keep scientific geometry intact and offer explicit adjacent selection targets or larger non-overlapping hit areas.

## What works

The implementation expresses the requested engineering portfolio identity rather than an unrelated generic dashboard. The three-terminal hero, black placeholder outcomes, working analytic preview, material layer controls, and explicit model limitations all connect to the same subject. Both locales and themes share a coherent token system. Honest concept labels and model provenance prevent the visual treatment from implying unimplemented demos or validated FEM results.

## Limits and close

This is an independent technical/browser assessment, not Assessment A's design-heuristic score. No A/before evidence or scores were consumed. No screen reader, Firefox/WebKit, physical phone, field performance, experimental thermal validation, or production network was tested. Input/data corruption and every possible WebGL context-loss sequence were not exhaustively tested. No source edits were made.

Scoped manual remediation can address B1/B3, followed only by `$impeccable audit` or `$impeccable critique` verification. No style-changing command is recommended. The coordinator's later changes require separate targeted verification and do not retroactively alter this original-state evidence.

Questions skipped: this isolated B assessment returns evidence to the coordinator; the parent synthesis owns any user questions.
