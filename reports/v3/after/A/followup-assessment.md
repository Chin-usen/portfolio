# Assessment A — bounded follow-up

**Complete: all 16 normal-state matrix views were visually verified. A1, A2 and the newly found enlarged-text warning overlap are resolved in the reviewed evidence. No P0/P1 issue remains identified; A3 is the sole open P2 efficiency enhancement.** This is a follow-up to the preserved independent `assessment-a.md` (30/40), not a new blinded full audit.

## Method and independence boundary

Reviewer: `/root/v3_a_final_report`, 2026-10-15. The reviewer read the original A report/preparation, the capture and interaction harnesses, and the fixed `docs/DESIGN.md`, `docs/PRD.md`, and `docs/design/README.md`. No B report/evidence or v2 before findings were opened. The mandatory shared startup memory incidentally exposed terse B summaries; therefore this follow-up is explicitly **not blind to those summaries**. This does not alter the independence or provenance recorded by the original A reviewer.

The parent ran the browser captures and interactions; this reviewer inspected saved PNGs and JSON, launched no browser, and edited no production files. Chromium 156.0.8078.4, 1440/390 px width, device scale factor 1, and a 900 px interaction viewport were used. Enlarged-text tests set root font size to 200%; they are not native browser zoom, real-device, screen-reader, or cross-browser tests.

Evidence:

- `followup-observed-geometry.json`: 16 normal-state observations, errors, visible control dimensions, six source-file hashes, screenshot hashes; initial capture at 04:57:58Z.
- `final-fullpage-capture.json`: 12 replacement full-page captures, refreshed after the summary remedy at 05:05:07Z, recording capture method, dimensions and section geometry.
- `followup-interaction-evidence.json`: eight S1 states (zh/en × 1440/390 × 100%/200% text), plus two Home 390/200% observations. Initial run at 04:59:12Z; the final post-remedy run at 05:04:06Z supersedes it. All 8 final state records were reviewed; the changed English 390/200% screenshot and both mobile 200% warning/control views were reopened.
- Original report and original evidence remain in `assessment-a.md` and `pre-followup/`, with its archive manifest. No before-v2 comparison is made here.

## Final normal-state visual matrix

Every cell below was opened and visually inspected, including lower-page content and footer. At least one corresponding section crop per cell was also inspected for legibility. All 12 replacement full pages were reopened after recapture.

| Surface / locale | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|
| Home zh | `home-zh-1440-light.png` | `home-zh-1440-dark.png` | `home-zh-390-light.png` | `home-zh-390-dark.png` |
| Home en | `home-en-1440-light.png` | `home-en-1440-dark.png` | `home-en-390-light.png` | `home-en-390-dark.png` |
| S1 zh | `s1-zh-1440-light.png` | `s1-zh-1440-dark.png` | `s1-zh-390-light.png` | `s1-zh-390-dark.png` |
| S1 en | `s1-en-1440-light.png` | `s1-en-1440-dark.png` | `s1-en-390-light.png` | `s1-en-390-dark.png` |

Home retains the two-line default headline, orange eyebrow, blue routes, three-terminal module, career placeholder band, and rounded Lab cards. The enlarged-text Home views retain content with additional wrapping. S1 retains top measurements, desktop model-left/parameters-right ordering, 24 px stage surfaces, and a vertically stacked mobile sequence. The new field caption is close to the scale, not buried below the form. English parameter tabs wrap coherently; notes and footer remain present in both themes. No visible missing glyphs were found in the inspected content. Exact font-outline equivalence was not independently audited by this reviewer.

Normal-state JSON records 52 px headers in all 16 states, 88/38 px Home titles, no page errors, document scrollWidth equal to viewport width, and no measured visible a/button/input box below 44×44 px. These are bounded observations, not universal accessibility certification.

The first refreshed dark Home full pages omitted painted career text despite complete section crops. The first S1 full pages preserved the sticky summary's scrolled position after section capture. Both were capture problems. Root recaptured four dark Home and eight S1 pages from scroll0 with viewport height temporarily expanded to document height; all 12 recorded section-geometry objects were exactly equal before/after. The replacement images show career text and initial summary placement correctly. No image editing, compositing, or source/CSS change was used to fix the evidence. Full-page tall-viewport images do not prove sticky behavior; 900 px viewport interaction captures provide that evidence separately.

## Findings checked

| Finding | Follow-up observation | Disposition |
|---|---|---|
| A1 — convection opens Cooler context | In all 8 focused states a visible Cooler card was first opened. Selecting convection hides that card and selects Conditions/工况, whose panel contains h. All 8 convection screenshots and JSON were reviewed. Mobile may require scrolling within that selected panel to reach h; no automatic focus transfer to h is claimed. | Resolved |
| A2 — interpretation caveat is remote | Analytic mode says `Illustrative field · local temperatures unvalidated.` / `示意温度场 · 局部温度未经验证。` directly under the scale. FEM changes it to `Reconstructed central plane · not a complete 3D field.` / `中央截面重建 · 非完整三维温度场。` Both models, languages and widths were visually checked at 200%; default matrix and normal FEM crops were also inspected. Detailed notes remain. | Resolved |
| A3 — exact case entry requires slider/key stepping | Focused JSON records no numeric inputs; ranges and readouts remain. Direct-value entry is still deferred, as intended. | Open P2 enhancement; not a blocker |
| Requested summary placement follow-up | The summary is after the heading/model choice/tablist and before parameter panels. All40 focused tab hit checks are uncovered and all 40 activations select their tab. Corrected normal-state screenshots show the same order. | Tab obstruction resolved in tested states |
| F1 - English narrow enlarged-text high-warning overlap | Initial 390 px/200% text/500 W evidence hid h under the long sticky warning. After remedy, the final screenshot shows its label, 15000 value, slider and units. Final JSON reports the summary in normal flow (`position: static`, bottom -433.05), with h at 427.67-471.67, clear of the summary. The full warning remains in the parameter crop. Other 7 final states retain a clear h control. | Resolved in the retested state |

The initial focused harness sampled reset before the next update, so its reset snapshots still showed 367.8 degrees C. The final harness waits for 125.6 degrees C; all 8 final reset snapshots contain that result. The summary uses `textContent`, which also returns hidden warning-node text: its presence in that JSON is not evidence of a visible warning. The full-page reset views show the default result without a visible warning. This timing flaw was corrected in the evidence rather than reported as a product reset failure.

The summary now returns to normal document flow when its measured height exceeds 35% of viewport height, preserving the full warning rather than clipping it. In the tested English 390/200% high-power state, that trades continuously visible Tj for accessible parameter controls. This is appropriate at the constrained size; numerical recall is a residual usability tradeoff, not an unresolved overlap.

## Score treatment

The original independent **30/40** score remains unchanged in its own report. This bounded follow-up does not substitute a new blind aggregate score. The two original issue resolutions support improvement in consistency of context navigation and documentation placement; untested failure paths, scientific validity, exact-value efficiency and mobile model/form distance remain outside or unchanged by these fixes. Final follow-up disposition: A1 and A2 are closed; the tab-obstruction check and newly found F1 overlap pass the supplied final evidence; A3 remains deferred. **Open priority counts: P0 0 / P1 0 / P2 1 / P3 0.** No revised aggregate score is claimed from this bounded method.

## Retained design judgment and limits

The original strengths remain visible: a subject-specific engineering identity, a real analytical Home demonstration, and clear grouping of output/model/parameters. Required placeholders, 52 px header, 88/38 px titles and desktop left/right S1 layout remain brief constraints rather than defects. The five parameter groups/eight resistance choices still create moderate intrinsic task load, and mobile spatial comparison still requires scrolling. No extra issue is added to meet a quota.

This review does not certify the solver or FEM-surrogate predictions, all possible glyphs, all zoom levels, assistive-technology behavior, device touch, network failures, Lighthouse performance, or contrast ratios. Those claims require their own evidence. No P0/P1 issue has been identified in this bounded review. Future text/viewport combinations remain outside this tested matrix.
