# Before Assessment B — detector and browser evidence

Method: independent Assessment B recovery, held separate from Assessment A until parent synthesis.

## Target and contract

Frozen source `portfolio-p3/`, served at `http://127.0.0.1:4325`. Home, Work, Lab, About, Contact, and S1; Chinese/English; 1440/390; light/dark. D1 direction, palette, fonts, IA, and engineering copy are locked. Missing `docs/DESIGN.md`/`docs/PRD.md` were not invented. No product files were edited.

The full five-dimension, severity-ordered technical report is `.dev-tools/reviews/before-audit.md`. It includes locations, evidence, impacts, standards, false positives, strengths, and limitations.

## Detector result

- Reused `.dev-tools/reviews/before-detector-raw.json`.
- Raw JSON: `[]`.
- Findings: **0**; rule names: **none**; file locations: **none**.
- Supplied skill pin: `2f98774f86bc05563876643db37e6c37c322850f`.
- The artifact does not contain invocation/exit-code/file-inventory metadata. Do not invent those metadata or confuse this empty deterministic signal with a complete accessibility pass.
- No detector rerun occurred.

## Existing browser evidence

| Artifact | Coverage / use |
|---|---|
| `before-browser-matrix.json` | 48 states, timestamp 2026-10-14T06:59:30.090Z, Chromium 156.0.8078.4. All HTTP 200; zero recorded pageerrors; one main/one h1 each; no document horizontal overflow. |
| `b-{zh,en}-{home,work,lab,about,contact,s1}-{1440,390}-{light,dark}.png` | Full-page baseline captures. |
| `b-sheet-{zh,en}-{1440,390}.png` | Contact sheets for the five shared-shell pages. |
| `before-interactions.json` | Keyboard menu/email/routes/tabs/ranges/fallback; dark skip-link colors; synthesized touch; root-font 200% checks. |
| `before-targeted-verification.json` | Settled keyboard-view check; warning semantics; FEM result; immediate preset color sample; 200% overlay geometry. |
| `b-{zh,en}-dark-skip.png` | Visible pale skip-link label on white in the dark S1 shell. |
| `b-text200-{home,s1}-{zh,en}.png` | Root-font 200% captures; S1 overlays collide despite no horizontal overflow. |
| `b-orbit-before.png`, `b-orbit-after.png` | Identical settled canvas captures after ArrowRight and “+”. |

Capture scripts `b-browser-matrix.cjs`, `b-interactions.cjs`, and `b-targeted-verification.cjs` preserve the mechanics. They were read, not rerun.

## Verified findings for synthesis

**Audit score: 12/20 — Acceptable.** Accessibility 2; Performance 3; Theming 2; Responsive Design 2; Implementation Integrity 3. **Ten issues: P0 0 / P1 5 / P2 4 / P3 1.**

| ID | Priority | Finding | Evidence |
|---|---|---|---|
| B-01 | P1 | Dark S1 skip-link text ~1.09:1 on its white background | Interaction computed colors + skip-link screenshots; global and thermal token boundary. |
| B-02 | P1 | Light selected material text ~3.85:1 on the accent-tinted card | Settled native Chrome follow-up; accent/tint computed colors and alpha composition. |
| B-03 | P1 | Keyboard cannot orbit/zoom the WebGL view | Targeted identical canvas hashes + viewer keyboard source only handles Home/Escape. |
| B-04 | P1 | 200% root-font mobile metrics/actions/scale overlap | Text-expansion screenshots and intersecting geometry. |
| B-05 | P1 | Threshold warning is visible but absent from live announcement | Targeted warning attributes and live-result text; source omits warning from live update. |
| B-06 | P2 | Five shared-shell pages remain light under dark preference | Matrix body colors and identical theme screenshots. |
| B-07 | P2 | Repeated control hit areas below 44px audit target | Matrix measured heights; AA failure not assumed from the heuristic alone. |
| B-08 | P2 | S1 mobile secondary text/units are 7.2–10.4px in several places | Matrix computed font sizes + CSS. |
| B-09 | P2 | S1 generated stylesheet is 256,868 decoded bytes | Resource evidence + full font CSS imports; production compression unmeasured. |
| B-10 | P3 | Work/Lab index cards skip h1 to h3 | Matrix heading sequence + shared fixed-h3 cards. |

## One bounded native follow-up

A new Chrome extension tab loaded the frozen English S1 baseline. The AMB substrate tab exposed Al₂O₃ · 24, Si₃N₄ · 90, and AlN · 170. Selecting Al₂O₃ and observing the next AX state showed selected=true, conductivity 24, result 153.5°C and resistance 0.885 K/W. A read-only computed-style query then returned:

```json
{"pressed":"true","color":"rgb(191, 72, 0)","background":"rgba(191, 72, 0, 0.19)"}
```

This rejects a selected-state failure from the immediate older sample but substantiates the selected-label contrast issue. The tab was closed. No extra matrix, detector, or product modification was performed.

## False-positive and evidence reconciliation

- Detector: no findings, so no detector-rule false positives.
- Earlier keyboard-view screenshot change is not a keyboard pass; settled verification/source supersede it.
- Earlier immediate selected-preset colors are a queued-update timing artifact, not a missing selected state.
- Earlier Chinese FEM number matching the analytical result was captured before queued recalculation settled; no broken FEM allegation is made.
- Scrollable tab content is intentional, not document overflow; synthesized touch moves scrollLeft from 0 to 59.
- A target below 44px is an audit/AAA concern, not automatically a WCAG 2.5.8 AA failure.
- Root-font text enlargement is not the same test as browser zoom; its overlap result is still concrete.
- Reduced-motion renderer updates retain final state; no blanket feedback-loss allegation.
- Data-encoding palette constants and disclosed engineering placeholders are intentional, not detector-proof design faults.
- Heavy Three code serves actual 3D rendering and loads dynamically; it is not treated as an unused dependency.

## Positive and interaction evidence

- Keyboard mobile navigation, Escape/focus return, email reveal/focus transfer pass in both locales.
- All six language counterpart routes preserve context in both directions.
- Range ArrowRight changes 100 to 110; selected tabs and analytical/FEM state update.
- Forced 2D fallback supports keyboard layer selection and displays its explanatory note.
- Synthesized Chromium touch changes orbit, works after touchCancel, changes slider 100 to 370, and scrolls the tab strip.
- Scope has labeled ranges, units, live calculation results, visible focus treatment, meaningful model disclosures, dynamic loading, on-demand rendering, reduced-motion state handling, and cleanup paths.
- No A design scores or judgments were accessed.

## Browser overlay / fallback accounting

The first native attempt at the in-app browser returned “Browser is not available: iab.” The available Chrome extension successfully opened a fresh isolated tab and supplied page/AX/screenshot evidence. Its documented evaluate methods are read-only, with no mutable title/script injection surface. Consequently mutable preflight and detect.js injection were not performed; no [Human] overlay was created or claimed; browser detector-console findings are **unavailable**, not zero.

The existing 48-state custom Playwright evidence remains the baseline fallback artifact. Recovery does not claim that this retroactively satisfies the native overlay path. No detector live-server was started. Port 4325 and its cleanup remain parent-owned. Review tab closed; audit evidence retained.

## Boundaries for final synthesis

No physical-device, Safari/Firefox, screen-reader speech, production-network/Core Web Vitals, exhaustive contrast, or full browser text-only zoom assessment. Source conclusions and browser measurements are distinguished in the full audit. No edits or follow-up CI in this worker.

Questions skipped: this is the internal B evidence handoff; the parent owns final synthesis and the user's already-authorized fixes.

