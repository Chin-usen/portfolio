# After critique — main v3, fixed D1 brief

The new Home establishes the requested power-module identity, and desktop S1 keeps the model beside its parameters. The live Home ceramic slider uses the existing analytical evaluator; career metrics remain explicit placeholders. The main residual usability costs are precise value entry and mobile travel between the spatial model and its controls.

This is a coordinator synthesis of the original independent A and B assessments, followed by bounded verification of repairs. It is not a new independent assessment. Original reports, scores and timestamps remain intact in [A](A/assessment-a.md) and [B](B/assessment-b.md). [A's follow-up](A/followup-assessment.md) and the [coordinator record](coordinator-followup.md) describe the later state.

## Design health and comparison

All ten heuristics apply to this combined portfolio and interactive tool. The table preserves A's original scores; repairs were verified without inventing a new aggregate score.

| Heuristic                       |             Before / 4 | Original after / 4 |
| ------------------------------- | ---------------------: | -----------------: |
| Visibility of system status     |                      3 |                  3 |
| Match with the real world       |                      3 |                  3 |
| User control and freedom        |                      3 |                  4 |
| Consistency and standards       |                      2 |                  3 |
| Error prevention                |                      3 |                  3 |
| Recognition rather than recall  |                      2 |                  3 |
| Flexibility and efficiency      |                      3 |                  2 |
| Aesthetic and minimalist design |                      2 |                  3 |
| Error recognition and recovery  |                      2 |                  3 |
| Help and documentation          |                      3 |                  3 |
| **A total**                     | **26/40 — Acceptable** |   **30/40 — Good** |

B's independent technical score is **13/20 before → 17/20 original after**. These are subjective review results against the supplied brief, not statistical effect sizes or performance scores. The before source is the frozen v2 delivery; the after reports review reconstructed v3. Later fixes do not retroactively increase either score. The separate v3 persistence target has its first recorded score, 30/40; 26→30 is an explicit cross-target baseline comparison, not a same-target history manufactured by the storage tool.

## What improved

- **Specific engineering identity.** The 52 px header, 88/38 px two-line title, orange eyebrow, blue links, three-terminal module, black placeholder metric band and 28 px Lab cards form the supplied D1 composition. Both languages and themes retain it.
- **A substantive demonstration.** Home's ceramic control changes the computed Tj from 125.6 to 133.4 °C when thickness changes from 0.32 to 1 mm. The image and initial result remain available without JavaScript; the full simulator preserves its numerical models and disclosures.
- **A clearer operating workspace.** S1 has top measurements, a model-left/parameters-right desktop arrangement, 24 px cards, selection information, thermal scale and resistance breakdown. Mobile retains a vertical sequence and a local result summary.
- **Preserved control and recovery.** Keyboard operation, reset, model choices, reduced-motion behavior and interactive 2D fallback remain exercised. Literal placeholders and unimplemented concept cards are honest about the sample's limits.

## Findings and disposition

| ID  | Finding                                                                 | Current disposition                                                                                                                                             |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Convection selection opened unrelated Cooler details.                   | Resolved: it clears the layer card and opens Conditions, containing h. Eight focused states verify the context change.                                          |
| A2  | The colored field's interpretation caveat was too far from the graphic. | Resolved: a bilingual, model-specific caption now sits beside the scale; detailed limits remain below.                                                          |
| B1  | A scrolled sticky result summary covered parameter tabs.                | Resolved in the tested states: summary follows the heading/tablist; all 40 focused tab hit checks and activations succeed.                                      |
| F1  | At English 390 px/200% text, a long high-temperature warning covered h. | Resolved: summary returns to normal flow above 35% of viewport height. Full warning text remains; final h hit/keyboard checks and reset pass.                   |
| A3  | An arbitrary exact value requires range/key stepping.                   | Open P2 efficiency enhancement. Direct numeric entry is deferred; existing ranges, presets and resets remain.                                                   |
| B3  | Direct picking of thin 2D SVG layers requires precision.                | Open P2 direct-picking tradeoff. Physical geometry and direct/keyboard behavior remain; equivalent adjacent legend buttons provide 44 px targets.               |
| B2  | Secondary mobile metric captions are 11 px.                             | Retained explicit D1-mobile reference constraint. The detector warning is recorded, not suppressed; it is not automatically a WCAG minimum-font-size violation. |

No P0/P1 issue was identified in the reviewed scope. The combined residual list contains two P2 items, A3 and B3; A's own follow-up count of one P2 covers A's scope only. No claim is made that every SVG target measures 44 px.

## Cognitive load, journey and personas

A rates Home's primary path low in cognitive load. S1 has moderate intrinsic load: five parameter groups and eight resistance choices, with mobile scrolling between model and form. Tabs, presets and a nearby numeric summary make this manageable without hiding necessary scientific controls. When an enlarged warning forces the summary into normal flow, accessible inputs take precedence over continuously visible numbers.

Home moves from a calm title and singular hardware object to the contrasting metric band and then an interactive experiment. S1 sustains that interest through direct adjustment and clear recovery. Required placeholder content prevents a meaningful judgment of actual recruiting credibility.

- **First-time recruiter:** the field and next action are clear. Placeholder achievements must remain placeholders until supplied by the owner.
- **Technical reviewer:** model choice, material layers and units support exploration. A3 still slows reproduction of an arbitrary exact case; field captions now place interpretation limits where the graphic is read.
- **Keyboard/low-vision visitor:** tested controls and resets remain reachable. English labels wrap instead of clipping; enlarged warning handling was repaired. Screen-reader output was not tested.
- **Mobile visitor:** the main hierarchy remains coherent, but comparing a 3D consequence with distant controls still requires scrolling. A closer default model view or direct numeric entry would be separate enhancements, not reasons to alter the fixed design now.

## Evidence and interpretation limits

A visually inspected all 16 final normal states: Home/S1 × zh/en × 1440/390 × light/dark. Eight S1 focused states add 100%/200% text at both widths/locales; two Home 390 px text-enlargement states supplement them. The final JSON reports no page errors or horizontal overflow in that matrix. Full-page capture artifacts were resolved by a documented tall-viewport method with identical section geometry; no image compositing or CSS change was used. Sticky behavior is supported by separate 900 px viewport interaction evidence, not by tall screenshots.

Original A and B were independent and the coordinator read A before B. The later A reviewer did not read B's raw reports, but mandatory shared recovery memory exposed terse B summaries. Its follow-up is therefore explicitly not blind to those summaries and is not a new blinded rescore. B's original score is frozen; coordinator follow-up does not impersonate a B re-audit.

The pinned built-markup detector still exits **2** with **three identical warnings for one 11 px CSS rule**. The final invocation and redacted output are retained beside this report. There was no native-browser overlay because the available evaluation API was read-only; CLI findings, fresh native views and saved captures provide the evidence.

Font loading uses the same Noto families, actual weights and exact glyph outlines/metrics. The Chinese Home pilot improved to 99/99/99 with median LCP 1.811 s. A subsequent old-source full attempt stopped after 39/54 samples with Chinese S1 median 86. S1 Latin-only preloads scored 88/88/88; the final existing-font preload treatment scored 92/93/92, with median FCP 1.274 s and LCP about 3.16 s while font transfer stayed 354,417 bytes. This S1 score improvement does not establish S1 LCP below 2.5 s. Full release performance belongs to the separate 54-sample record; no release-wide pass or delivery is inferred from a pilot.

The final S1 preload adjustment happened after the visual captures and changes only BaseLayout head hints. Source comparison verifies the other 88 runtime files and 15 font/CSS/support files unchanged, including layout CSS and font bytes. The existing images document the settled appearance; they are not claimed as new post-preload captures. The later release run passed 54 browser regressions in 22.2 s and built 20 pages; type checking covered 86 files without diagnostics, release lint passed, and 48 earlier unit tests remain valid for unchanged numerical modules. See the [coordinator record](coordinator-followup.md) for logs and provenance.

PASS: 54 retained mobile measurements across 18 routes, 3 per route; median Performance 92-100, Accessibility >= 100, SEO >= 100. Original 90/95/95 median budgets and Lighthouse assertion engine passed. Same-source interrupted collection resumed without replacing completed samples; see reports/v3/lighthouse/summary.json and collection-sessions.json.

PASS: phone/birthday scan (482 text files at the recorded pre-finalization scan) and Gitleaks for source/history/dist. Custom blocked-keyword policy was not configured. Final report-inclusive scan is recorded in reports/v3/ci/security-release.log; exact archive bytes are independently scanned during packaging.

This review does not establish physical-device, cross-engine, screen-reader, whole-site WCAG or experimental thermal validity. No production deployment or hosted Actions run occurred. Questions skipped: the user supplied exact references, priorities and authorized fixes; no new design-direction decision is required.
