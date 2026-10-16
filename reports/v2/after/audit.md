# After technical audit - portfolio main v2

Method: independent Assessment B (/root/after_assessment_b), paired with a separately run Assessment A. Only audit/critique playbooks applied; B edited no product source.

Snapshot: 2026-10-14, initial after pass plus verified desktop result-summary follow-up. Two remaining P2 issues below were sent to the coordinator; subsequent closure must be recorded as an addendum rather than retroactively erasing them.

## Implementation integrity verdict

PASS, within the stated review scope. Home / Work / Lab / About / Contact now share the existing D1 surfaces, text colors and font families. S1 retains a recognizably engineering-specific composition: source temperature, resistance, model selection, physical parameters, layer contribution and explicit model limitations. Keyboard and touch controls act on real state. The analytic color field and FEM surrogate are not presented as experimental validation.

The pinned detector exited 0 with [] over the markup-bearing src/components target. The complete inventory has 29 files; 16 are Astro markup. That inventory is not an engine coverage report. It is evidence of an actual invocation, not an accessibility certificate.

## Audit Health Score

| Dimension | Score | Finding |
|---|---:|---|
| Accessibility | 3/4 | Previously verified contrast, keyboard and warning-region failures are corrected; assistive-technology speech output remains untested and numerical text wrapping needs closure. |
| Performance | 3/4 | Lazy viewer, on-demand rendering and much smaller font CSS are sound; Chinese font transfer remains substantial and final Lighthouse budgets are not inferred. |
| Theming | 4/4 | Both theme states now apply coherently to the shared portfolio shell and S1 at both requested widths. |
| Responsive design | 3/4 | Main S1 controls are comfortable, result stays near controls, touch works and enlarged blocks no longer overlap; two residual P2 issues remain. |
| Implementation integrity | 4/4 | Existing brief/tokens/content are preserved; model disclosures, semantics and real controls form a coherent system. |
| **Total** | **17/20** | **Good - close the two bounded usability gaps and complete the independent performance gate.** |

These are review judgments on the inspected states. Theming 4/4 means no issue in the stated state matrix; it does not claim all possible platforms were tested.

## Executive findings

- Initial remaining issue count: P0 0, P1 0, P2 2, P3 0.
- B-AFTER-1: prevent numeric values splitting into multiple lines at 200% text.
- B-AFTER-2: finish the standalone card/contact link hit areas.
- A separate release verification boundary remains: final mobile Lighthouse >=90 performance and >=95 accessibility. B did not run Lighthouse or assert those gates passed.
- The after capture before the desktop-summary amendment and the later targeted follow-up are distinguishable in file names/timestamps.

## Detailed findings

### B-AFTER-1 [P2] Digits separate under 200% text scaling

Location: src/components/lab/thermal-stack/thermal.css, .thermal-temperature / .thermal-control-top output and related flex layout.

Category: Accessibility / Responsive design.

Measured reproduction:
1. Open English S1 at 390 px and set root text size to 200%.
2. Default Tj 125.6 occupies two character line positions. Coolant 65 and convection coefficient 15000 also occupy two.
3. At 1440 px with 200% text, English coolant/convection values still wrap internally.
4. Chinese mobile Tj also occupies two lines.

Impact: a user enlarging technical data must reconstruct a single number from separated digits. The result remains in the DOM and the page no longer overflows, but the visual grouping is weaker precisely for low-vision use.

Evidence: after-b-evidence/after-rebuilt-verification.json; b-text200-s1-en.png; b-numeric-text200-en-390.png; b-sticky-text200-en-dark.png.

Standard boundary: relates to readable resizing and engineering-data interpretation. No information-loss claim or blanket WCAG 1.4.4 failure is made from wrapping alone.

Recommendation: nonshrinking nowrap numeric outputs; permit parent label/value/unit groups to wrap without reducing the requested text scale. Use the existing fonts/tokens. Verify default and hot values in both languages at both widths with 200% text.

Suggested command within authorized main scope: manual fix, then $impeccable audit for bounded closure. No broader style command is required or invoked.

### B-AFTER-2 [P2] Shared-shell standalone links retain small pointer rectangles

Location:
- src/components/CaseCard.astro:17
- src/components/LabCard.astro:20
- src/components/AboutPage.astro:48
- src/components/ContactPage.astro:26
- src/styles/global.css standalone action selectors

Category: Responsive design / Accessibility comfort.

Measured examples at 390 px:
- English S1 title on Home: 240.09 x 25 px.
- English S1 title on Lab: 307.97 x 31 px.
- LinkedIn in About/Contact: 62.06 x 21 px.
- Chinese short card headings also remain below the 44 px review target.

Impact: those standalone navigation actions require more accurate thumb placement than the now-improved thermal controls, despite enough surrounding whitespace to enlarge their hit boxes.

Standard boundary: the requested audit uses 44 x 44 px, aligned with enhanced target comfort. WCAG 2.2 AA uses a 24 px minimum with spacing, inline and other exceptions; isolated short links can meet AA by spacing. Do not label every under-44 rectangle an AA violation. Sources: [W3C SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [W3C SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

Recommendation: enlarge standalone card-heading links and contact actions to at least 44 px. Keep inline prose links in their text flow. Preserve headings, copy, route structure and visual direction.

Suggested command within authorized main scope: manual fix, then $impeccable audit for bounded closure.

## Verified improvements

### Contrast and focus

Computed colors were composited against their actual ancestor backgrounds:
- Skip link: 16.83:1 light, 16.61:1 dark.
- Selected material preset: 12.79:1 light, 10.68:1 dark.
- Sampled supporting secondary label: 5.07:1 light, 7.03:1 dark.

Skip is the first keyboard focus target and Enter transfers focus to main. A visible theme-token focus outline remains present.

### Keyboard and status

The canvas accepts arrow keys, plus/minus and Home with descriptive accessible instructions. B's settled before/after images changed under orbit/zoom in both languages; the delivered focused regression tests exercise all directions, reset and bounds. Tab leaves the canvas.

Native ranges use labels and visible outputs; tablist Home/End/arrow navigation updates the selected pane. End brings the English Cooler tab fully into view, rather than leaving the focused selection clipped.

Warning above the 175 C reference appears visually near controls and in the polite atomic result region. The duplicate sticky result is aria-hidden, so it supplements sighted mobile reading without introducing a second live region.

Mobile menu and email reveal work by keyboard; all 12 language transitions preserve the equivalent route; SVG fallback exposes selectable layers and an explanation.

### Responsive and touch

All 48 route/language/width/theme states returned 200, one h1 and main, no captured pageerror and no page-wide horizontal overflow.

At 200% text, metrics, action buttons, 380 px model viewport and scale occupy nonoverlapping normal-flow blocks. Numeric wrapping is tracked separately above so the no-overlap pass is not overstated.

Synthetic touch in Chromium mobile context:
- orbit changed rendered pixels;
- orbit continued after touchCancel;
- range tap changed P 100 to 370;
- English tab-strip swipe changed scrollLeft 0 to 111.

A rendered narrow screenshot alone would not establish touch support; the interaction event evidence is retained. Physical iOS/Android devices were not tested.

The initial mobile-only result summary was extended by the coordinator to all viewport widths during this review. B's follow-up found result and hot warning visible at the controls at 1440 and 390 in both languages. See after-rebuilt-verification.json, timestamp 13:42:06 UTC.

### Semantics, tokens and implementation

Work/Lab indexes now have h2 cards below h1, while Home retains h2 section / h3 card nesting. Numeric and technical copy stay source-driven. The light/dark theme tokens are consistently reflected in the shell. Thermal palette constants represent temperature/layer data; they are not arbitrary style drift. Existing D1 rounded panels, restrained eyebrow and large numeric result are explicit product choices, not generic anti-pattern findings.

## Performance evidence and limits

The generated Noto stylesheet is 17,833 bytes with 40 selected faces, compared with 210,548 bytes for both original full stylesheets. It references unchanged locked OFL font binaries and updates when source text changes.

Captured localhost decoded resources:
| Route | Font requests | Font bytes | CSS bytes |
|---|---:|---:|---:|
| zh Home | 25 | 787,924 | 24,777 |
| en Home | 3 | 95,408 | 24,777 |
| zh S1 | 26 | 812,052 | 41,805 |
| en S1 | 4 | 118,536 | 41,805 |

S1's viewer-related scripts after viewport-triggered loading total 796,688 decoded bytes, including Three. English routes still contain the Chinese language-switch label and legitimately request supporting Chinese font subsets.

These sizes were observed after network idle on a localhost browser. They are not gzip network totals, field metrics, mobile scores, or proof of an LCP regression. Chinese font load is still the primary resource cost to monitor in the coordinator's real mobile Lighthouse run.

The renderer is requested lazily, uses bounded camera controls and schedules work on demand. Reduced-motion handling preserves final state rather than delaying an indispensable interaction. B did not run a simultaneous performance workload.

## Patterns and positives

- The fixes now propagate through shared shell rules rather than only repairing S1.
- Enlarging hit areas and semantic headings helps across bilingual routes while preserving the existing visual brief.
- Model provenance remains visible. Analytic, FEM-trained surrogate and experimental validation are not conflated.
- Camera navigation is now available to keyboard users and can reset; it remains a real view operation.
- The source still contains some earlier declarations overridden by explicit v2 rules. This is maintainability context, not an additional noisy P3 finding requiring a redesign.

## Recommended actions

1. Close B-AFTER-1 and B-AFTER-2 with the two targeted manual CSS changes already sent to the coordinator.
2. Recheck only those changed behaviors plus the desktop sticky result in a bounded follow-up. Preserve this raw snapshot and append exact closure evidence.
3. Complete the required Lighthouse gate separately; if it fails, diagnose the measured bottleneck without lowering thresholds.
4. Synthesize this report with independent A. The main branch remains audit/critique-only; no polish, adapt, bolder or other workflow is invoked merely because a generic playbook lists it.

## Run notes

- Stable target: src/components, parent-resolved critique slug src-components.
- Ignore file absent.
- Assessment independence maintained until the parent explicitly confirmed A was complete/read.
- Detector actual command, version, pinned commit, exit code, raw output, stderr and 29-file inventory retained.
- Fresh CUA Chrome tab inspected and closed.
- Native evaluate is read-only: no mutable overlay injection; no browser detector console findings claimed; no Impeccable live-server launched.
- Existing repository Playwright harness used for the user's requested regression matrix/interaction evidence.
- Browser scripts closed their isolated contexts and browser processes.
- The coordinator owns the preview server and final cleanup.
- Evidence scripts, reports and screenshots are intentional deliverables, not forgotten temporary files.
- All report and metadata paths are relative; any later shareable path redaction must be declared.
- No complete screen-reader, physical-device, hosted-CI or Lighthouse certification is claimed here.

Questions skipped: the user already supplied scope/direction and authorized all high/medium fixes without waiting for confirmation.



## Bounded final closure - 2026-10-14T13:55:48Z onward

Final audit score: **18/20, Excellent within the bounded review scope**. Accessibility 3/4; performance 3/4; theming 4/4; responsive design 4/4; implementation integrity 4/4. The original 17/20 snapshot above is deliberately retained so the additional findings and their resolution remain auditable.

Both initial P2 findings are now closed by independently observed behavior:
- **B-AFTER-1 closed.** The coordinator applied nowrap and no flex shrinking to numeric outputs and allowed their surrounding groups to wrap. At 200% text, values 125.6, 65 and 15000 each occupied exactly one per-character line position in all four language/width combinations (zh/en x 390/1440). CSS values are white-space:nowrap and flex-shrink:0. The enlarged label may flow above its value; the number stays intact. Evidence: after-b-evidence/after-final-verification.json and b-final-numeric-text200-*.png.
- **B-AFTER-2 closed.** Across 20 affected page states (Home/Work/Lab/About/Contact x zh/en x 390/1440), all 40 sampled standalone card-heading/contact links measured at least 44 x 44 CSS px. No document overflow in those states. Evidence: after-b-evidence/after-final-targets.json, b-final-targets-home-en-390.png and b-final-targets-contact-en-390.png.
- The result summary and >175 C warning remained visible at controls at 390 and 1440 in both languages after these fixes. Evidence: b-final-summary-*.png and after-final-verification.json.

Current reproduced UI issue count in B's bounded scope: P0 0, P1 0, P2 0, P3 0. This does not convert limited browser sampling into proof of absence across every platform. The final focused checks were light-theme geometry checks; the earlier full matrix and targeted contrast pass cover both themes, whose color tokens were unchanged by these final geometry fixes.

No full matrix was redundantly rerun. The original 48-state captures reflect the initial after build; b-rebuilt-* documents the later desktop-summary amendment; b-final-* documents the final numeric/target closure. Keep those capture stages distinct when packaging or summarizing.

The coordinator separately reported 41 browser tests and 45 unit tests plus lint, typecheck, build, privacy and gitleaks passing on the rebuilt source. B's independent closure is the evidence above; the coordinator's CI logs remain the authority for that full check run.

Lighthouse, physical-device testing and actual screen-reader speech output remain outside B's verification. In particular, the 18/20 score does not waive the separate mobile Performance >=90 / Accessibility >=95 gate.

Raw-output encoding note: after-detector-raw.json is the exact PowerShell-redirection UTF-16LE stdout with BOM. Metadata JSON is UTF-8 and browser-generated JSON is UTF-8. If making a UTF-8 delivery copy of raw detector stdout, declare the encoding normalization in provenance and preserve the original outside the package. No operator-path redaction was necessary in these relative-path evidence files.

Questions skipped: scope, fixed visual direction and authorization for these high/medium fixes were already supplied by the human.

