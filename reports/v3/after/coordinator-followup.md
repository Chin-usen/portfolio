# Coordinator follow-up — final UI repairs

This record connects the original independent findings to changes and verification. It is not an independent B rescore or a replacement for the original A/B evidence.

## Changes and focused evidence

| Finding | Implementation                                                                                                                          | Verification                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1      | Convection clears unrelated Cooler selection and activates Conditions, where h is edited.                                               | Eight focused S1 states first open a Cooler card, then verify it is hidden and the correct panel selected.                                           |
| A2      | Analytical and FEM modes use distinct short bilingual captions beside the color scale.                                                  | Both models, both locales and widths are recorded; detailed scientific disclosures remain.                                                           |
| B1      | Result summary follows the heading/model choice/tablist and precedes parameter panels.                                                  | 40 actual tab-center hit checks and 40 tab activations pass; browser regression checks both widths/locales.                                          |
| F1      | ResizeObserver and viewport resizing make the summary static when taller than 35% of viewport height. Cleanup disconnects the observer. | The English 390 px/200% text/500 W case leaves h visible and operable while preserving the full warning. All eight focused states reset to 125.6 °C. |

A's final [follow-up report](A/followup-assessment.md) documents the complete 16-image visual review and eight S1 interaction states. Its final interaction record is timestamped 05:04:06 UTC, and replacement full-page capture metadata 05:05:07 UTC on 2026-10-15. The final English narrow enlarged-text warning state records a static summary and an uncovered h control. Normal-size states retain sticky feedback when it fits.

The first reset evidence sampled before the scheduled update. The harness was corrected to wait for 125.6 °C; all eight final resets pass. Hidden warning text remains in raw textContent and is not evidence of a visible default warning.

## Current regression evidence

- [Release browser log](../ci/browser-release.log): **54 passed, 22.2 s**, exit 0, including the enlarged-warning regression on the final preload build. The [production build](../ci/s1-all-preload-build.log) generated 20 pages.
- [Latest type check](../ci/s1-preload-typecheck.log): **86 files; 0 errors, warnings or hints**.
- [Unit log](../ci/unit-final.log): **48 tests in 5 files passed**. Later font-loading hints leave the tested numerical modules unchanged.
- [Release lint log](../ci/lint-release.log): ESLint and Prettier passed. Subsequent report prose is covered by the final report-inclusive gate.
- [Font integrity](../ci/font-subset-check-final.json): all 12 exact-outline assets checked, including real weights and original-font future-glyph fallback.

PASS: 54 retained mobile measurements across 18 routes, 3 per route; median Performance 92-100, Accessibility >= 100, SEO >= 100. Original 90/95/95 median budgets and Lighthouse assertion engine passed. Same-source interrupted collection resumed without replacing completed samples; see reports/v3/lighthouse/summary.json and collection-sessions.json.

PASS: phone/birthday scan (482 text files at the recorded pre-finalization scan) and Gitleaks for source/history/dist. Custom blocked-keyword policy was not configured. Final report-inclusive scan is recorded in reports/v3/ci/security-release.log; exact archive bytes are independently scanned during packaging.

## Loading-only follow-up after visual review

The old-source full Lighthouse attempt was interrupted after 39/54 samples; Chinese S1 scores 92/86/85 yielded median 86. A Latin-only preload pilot then scored 88/88/88. The final treatment preloads existing Geist and Geist Mono Latin faces on both S1 locales and the seven already-requested Chinese faces on Chinese S1. It scored 92/93/92, with Accessibility/SEO 100 for every pilot run, median FCP 1.274 s and LCP about 3.16 s (3,159.561 ms). Font transfer remains 354,417 bytes. This meets the pilot performance-score threshold but does not establish S1 LCP below 2.5 s.

[Both pilot treatments and source proof](../lighthouse/s1-font-loading-pilot/summary.json) retain six raw reports. Only BaseLayout head hints changed; the other 88 runtime files and 15 font/CSS/support files match the earlier source. The final visual matrix therefore remains evidence of the unchanged settled layout, with the source-based limitation disclosed; it is not relabeled as a post-preload recapture. The browser-release suite verifies the later loading state.

Release collection retains 18 source/configuration-verified samples from six routes after interruption and collects the other 12 routes with per-route checkpoints. Old-source attempt-2 and focused pilots are not combined with release samples. The required complete record is 18 routes × three runs under the unchanged category-median thresholds.

## Retained constraints

The 11 px mobile metric captions follow the immutable D1 reference, and detector warnings remain visible. Thin SVG layers preserve physical proportions; equivalent 44 px legend buttons and keyboard selection remain available. Direct numeric typing is deferred. Nine model/numerical/viewer modules, all 67 tracked P2 files and all 14 supplied docs remain outside these UI changes; the coordinator's final integrity record is authoritative.

Original after scores stay A 30/40 and B 17/20. A's bounded follow-up is not blind to B summaries exposed by startup memory. No new aggregate score, screen-reader certification, physical-device test or scientific validation is claimed.
